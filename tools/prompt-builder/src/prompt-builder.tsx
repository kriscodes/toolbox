import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode, type SyntheticEvent } from 'react';
import { MAX_CONTEXT_LENGTH, MAX_IDEA_LENGTH, MAX_PROMPT_LENGTH, MODELS, TASKS, type GenerationRequest } from '@toolbox/prompt-contracts';
import { PromptApiError, requestPrompt } from './client';
import {
  STORAGE_KEY, MAX_LIBRARY_BYTES, MAX_NAME_LENGTH, createDraft, createLibrary, deleteGroup, deletePrompt,
  draftFromPrompt, generationRequest, importLibrary, isDraftDirty, parseLibrary, readBrowserLibrary,
  saveDraft, saveGroup, serializeLibrary, serializedBytes, type Draft, type Group, type SavedPrompt,
} from './library';

type IconName = 'box' | 'plus' | 'folder' | 'copy' | 'spark' | 'arrow' | 'save' | 'close' | 'download' | 'lock';
const ICON_PATHS: Record<IconName, string> = {
  box: 'M21 8l-9 5-9-5M12 13v9M21 8v10l-9 5-9-5V8l9-5 9 5z',
  plus: 'M12 5v14M5 12h14', folder: 'M3 7V5a1 1 0 011-1h5l2 3h9a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V7z',
  copy: 'M9 9h12v12H9zM5 15H3V3h12v2', spark: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z',
  arrow: 'M15 5l-7 7 7 7M8 12h13', save: 'M5 3h14v19l-7-5-7 5V3z', close: 'M6 6l12 12M18 6L6 18',
  download: 'M12 3v12M7 10l5 5 5-5M4 17v4h16v-4', lock: 'M6 10h12v11H6zM8 10V6a4 4 0 018 0v4',
};

/** Draw small decorative interface icons without adding an icon framework to the tool. */
function Icon({ name }: { name: IconName }): ReactNode {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={ICON_PATHS[name]} /></svg>;
}

/** Give stored records collision-resistant IDs without depending on a server or network. */
function makeId(): string { return crypto.randomUUID(); }

/** Turn fixed internal option names into short readable labels. */
function titleCase(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }

/** Download a local backup without uploading any saved prompts or context. */
function downloadJson(value: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  // Give the browser time to begin the download before releasing its temporary URL.
  setTimeout(function releaseDownloadUrl() { URL.revokeObjectURL(url); }, 1000);
}

/** Use the browser's modal focus handling and Escape behavior for small editing dialogs. */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  /** Open the mounted dialog after React has attached its DOM reference. */
  function openModal(): void { dialog.current?.showModal(); }
  useEffect(openModal, []);
  /** Keep the controlled dialog state in sync when the user presses Escape. */
  function cancelModal(event: SyntheticEvent<HTMLDialogElement>): void { event.preventDefault(); onClose(); }
  return <dialog ref={dialog} className="pb-modal" aria-labelledby="pb-dialog-title" onCancel={cancelModal}>
    <div className="pb-modal-top"><h2 id="pb-dialog-title">{title}</h2><button type="button" className="pb-icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

/** Edit a group's reusable context in a separate draft until the user explicitly saves it. */
function GroupEditor({ group, isNew, disabled, onSave, onClose, onDelete }: {
  group: Group; isNew: boolean; onSave: (id: string, name: string, context: string) => void;
  onClose: () => void; onDelete: () => void; disabled: boolean;
}): ReactNode {
  const [name, setName] = useState(group.name);
  const [context, setContext] = useState(group.context);
  const [error, setError] = useState('');
  /** Preserve edits when validation fails and close only after the group was accepted. */
  function submitGroup(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    try { onSave(group.id, name, context); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : 'The group could not be saved.'); }
  }
  /** Update the temporary group name without touching the stored library yet. */
  function changeName(event: ChangeEvent<HTMLInputElement>): void { setName(event.target.value); }
  /** Update the temporary project context without touching the stored library yet. */
  function changeContext(event: ChangeEvent<HTMLTextAreaElement>): void { setContext(event.target.value); }
  /** Ask before dismissing edited group details, including an Escape-key dismissal. */
  function closeEditor(): void {
    if ((name !== group.name || context !== group.context) && !window.confirm('Discard these unsaved group changes?')) return;
    onClose();
  }
  return <Modal title={isNew ? 'New group' : 'Project context'} onClose={closeEditor}>
    <form onSubmit={submitGroup}><fieldset className="pb-fieldset" disabled={disabled}>
      <label className="pb-field"><span>Group name</span><input className="pb-input" value={name} onChange={changeName} required maxLength={MAX_NAME_LENGTH} autoFocus placeholder="e.g. Weekend projects" /></label>
      <label className="pb-field"><span>Saved project context</span><textarea className="pb-input pb-context-editor" value={context} onChange={changeContext} maxLength={MAX_CONTEXT_LENGTH} rows={8} placeholder="What is this project? Include useful background, preferences, constraints, or decisions to remember." /></label>
      <p className="pb-help">Reused only when “Include context” is on.</p>
      {error && <p className="pb-error" role="alert">{error}</p>}
      <div className="pb-modal-actions">{!isNew && <button type="button" className="pb-text-button pb-danger" onClick={onDelete}>Delete group</button>}<button className="pb-primary" type="submit">Save group</button></div>
    </fieldset>{disabled && <p className="pb-error" role="alert">Saving is paused. Close this dialog and recover or reload your library first.</p>}</form>
  </Modal>;
}

/** Unlock paid generation with a separate workbench key kept in memory for this visit only. */
function AccessEditor({ unlocked, onUnlock, onLock, onClose }: {
  unlocked: boolean; onUnlock: (key: string) => void; onLock: () => void; onClose: () => void;
}): ReactNode {
  const [key, setKey] = useState('');
  /** Keep the key in this dialog's local state while the user enters it. */
  function changeKey(event: ChangeEvent<HTMLInputElement>): void { setKey(event.target.value); }
  /** Pass the trimmed private workbench key to the parent without writing browser storage. */
  function unlock(event: FormEvent<HTMLFormElement>): void { event.preventDefault(); onUnlock(key.trim()); onClose(); }
  return <Modal title={unlocked ? 'AI access' : 'Unlock AI generation'} onClose={onClose}>
    {unlocked ? <><p className="pb-help">AI generation is unlocked for this visit.</p><button type="button" className="pb-secondary pb-wide" onClick={onLock}>Lock AI generation</button></> :
      <form onSubmit={unlock}><label className="pb-field"><span>Workbench access key</span><input className="pb-input" type="password" autoComplete="current-password" value={key} onChange={changeKey} minLength={24} maxLength={256} required autoFocus /></label><p className="pb-help">Use your private Workbench key. This is separate from your OpenAI API key, which stays on the server.</p><button className="pb-primary pb-wide" type="submit">Unlock for this visit</button></form>}
  </Modal>;
}

/** Render the complete local-first workbench, coordinating its library, editor, and generation request. */
export function PromptBuilder(): ReactNode {
  const [loaded] = useState(readBrowserLibrary);
  const [library, setLibrary] = useState(loaded.library);
  const [recovery, setRecovery] = useState(loaded.recovery);
  const [storageError, setStorageError] = useState(loaded.error ?? '');
  const [externalChange, setExternalChange] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [accessOpen, setAccessOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const libraryRef = useRef(library);
  const fileInput = useRef<HTMLInputElement>(null);
  const output = useRef<HTMLTextAreaElement>(null);
  const request = useRef<AbortController | null>(null);
  const draft = library.draft;
  const group = library.groups.find(function activeGroup(item) { return item.id === draft.groupId; })!;
  const savedPrompts = library.prompts.filter(function inActiveGroup(prompt) { return prompt.groupId === group.id; });
  const dirty = isDraftDirty(library);
  const selectedModel = MODELS.find(function chosenModel(model) { return model.id === draft.modelId; })!;
  const storageBlocked = recovery !== null || externalChange;
  const savingPaused = Boolean(storageError) || storageBlocked;
  // Mutation feedback must not imply that an in-memory change was persisted successfully.
  const visibleNotice = savingPaused && /^(?:Saved to |Copy saved to |Group context saved\.|Prompt deleted\.|Group deleted\.|Backup imported as new copies\.|A fresh library is ready\.)/u.test(notice) ? '' : notice;

  /** Keep file-import completion pointed at the newest editor state after its asynchronous read. */
  function rememberCurrentLibrary(): void { libraryRef.current = library; }
  useEffect(rememberCurrentLibrary, [library]);

  /** Autosave the library and unfinished editor, but never overwrite damaged or concurrently changed data. */
  function persistLibrary(): void {
    if (storageBlocked) return;
    try { localStorage.setItem(STORAGE_KEY, serializeLibrary(library)); setStorageError(''); }
    catch (error) { setStorageError(error instanceof Error && error.message.startsWith('This library') ? error.message : 'Changes could not be saved in this browser. Export a backup before leaving.'); }
  }
  useEffect(persistLibrary, [library, storageBlocked]);

  /** Detect another tab writing the same local library so neither tab silently overwrites the other. */
  function observeOtherTabs(): () => void {
    /** Pause persistence when another tab changes or clears this library's storage key. */
    function onStorage(event: StorageEvent): void { if (event.key === STORAGE_KEY || event.key === null) setExternalChange(true); }
    window.addEventListener('storage', onStorage);
    /** Release the cross-tab listener when the user leaves the tool. */
    function stopObserving(): void { window.removeEventListener('storage', onStorage); }
    return stopObserving;
  }
  useEffect(observeOtherTabs, []);

  /** Warn on page navigation while work is unsaved or a generation is still running. */
  function protectDraft(): () => void {
    /** Ask the browser to display its standard unsaved-work confirmation. */
    function beforeUnload(event: BeforeUnloadEvent): void {
      if (dirty || busy || storageError || storageBlocked) { event.preventDefault(); event.returnValue = ''; }
    }
    window.addEventListener('beforeunload', beforeUnload);
    /** Remove the navigation listener before its dependent state changes. */
    function removeProtection(): void { window.removeEventListener('beforeunload', beforeUnload); }
    return removeProtection;
  }
  useEffect(protectDraft, [dirty, busy, storageError, storageBlocked]);

  /** Cancel any pending network call when this React tool is unmounted by its shell. */
  function attachRequestCleanup(): () => void {
    /** Abort the current request so it cannot update an unmounted workbench. */
    function abortOnExit(): void { request.current?.abort(); }
    return abortOnExit;
  }
  useEffect(attachRequestCleanup, []);

  /** Patch only the active draft while preserving every saved group and prompt. */
  function patchDraft(patch: Partial<Draft>): void {
    if (storageBlocked) return;
    setLibrary(function applyDraftPatch(current) { return { ...current, draft: { ...current.draft, ...patch } }; });
    setNotice(''); setError('');
  }

  /** Confirm a destructive editor replacement; a running request must first be canceled. */
  function mayReplaceDraft(): boolean {
    if (busy) { setError('Cancel the current generation before changing prompts.'); return false; }
    return !dirty || window.confirm('Replace this unsaved draft? Save it first if you want to keep it.');
  }

  /** Start an empty prompt within the current project group after protecting unsaved work. */
  function newPrompt(): void {
    if (!mayReplaceDraft()) return;
    setLibrary({ ...library, draft: createDraft(group.id) }); setError(''); setNotice('New prompt ready.'); setShowSaved(false);
  }

  /** Switch groups and open a fresh composer after checking for unsaved editor changes. */
  function selectGroup(event: React.MouseEvent<HTMLButtonElement>): void {
    const id = event.currentTarget.dataset.groupId;
    if (!id || id === group.id || !mayReplaceDraft()) return;
    setLibrary({ ...library, draft: createDraft(id) }); setError(''); setNotice('');
  }

  /** Reopen a saved prompt with its generation preferences and editable text intact. */
  function openSaved(event: React.MouseEvent<HTMLButtonElement>): void {
    const id = event.currentTarget.dataset.promptId;
    const prompt = library.prompts.find(function findPrompt(item) { return item.id === id; });
    if (!prompt || prompt.id === draft.savedId || !mayReplaceDraft()) return;
    setLibrary({ ...library, draft: draftFromPrompt(prompt) }); setError(''); setNotice('Saved prompt opened.'); setShowSaved(false);
  }

  /** Select a task preset without inserting fictional input or generating a paid request. */
  function selectTask(event: React.MouseEvent<HTMLButtonElement>): void { patchDraft({ task: event.currentTarget.dataset.task as GenerationRequest['task'] }); }
  /** Preserve the user's natural-language idea as they edit it. */
  function changeIdea(event: ChangeEvent<HTMLTextAreaElement>): void { patchDraft({ idea: event.target.value }); }
  /** Keep the generated prompt freely editable and mark its saved copy as changed. */
  function changePrompt(event: ChangeEvent<HTMLTextAreaElement>): void { patchDraft({ prompt: event.target.value }); }
  /** Update the saved prompt's display name without changing its body. */
  function changePromptName(event: ChangeEvent<HTMLInputElement>): void { patchDraft({ name: event.target.value }); }
  /** Allow context to be omitted from the next request without deleting the saved project background. */
  function toggleContext(event: ChangeEvent<HTMLInputElement>): void { patchDraft({ includeContext: event.target.checked }); }
  /** Choose only model IDs rendered from the shared server allowlist. */
  function changeModel(event: ChangeEvent<HTMLSelectElement>): void { patchDraft({ modelId: event.target.value as Draft['modelId'] }); }
  /** Change the tone instruction sent with the next generation request. */
  function changeTone(event: ChangeEvent<HTMLSelectElement>): void { patchDraft({ tone: event.target.value as Draft['tone'] }); }
  /** Change how the prompt builder structures its generated prompt. */
  function changeFormat(event: ChangeEvent<HTMLSelectElement>): void { patchDraft({ format: event.target.value as Draft['format'] }); }

  /** Generate a real prompt once, replacing output only after a complete validated server response. */
  async function generate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy || !draft.idea.trim()) return;
    if (!accessKey) { setAccessOpen(true); return; }
    if (draft.prompt.trim() && dirty && !window.confirm('Replace your current unsaved prompt with a new generation?')) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setNotice('Building your prompt…');
    // Include time for a sleeping free backend to wake up, while still giving requests a finite lifetime.
    const timeout = window.setTimeout(function expireRequest() { controller.abort(new Error('timeout')); }, 120_000);
    try {
      const response = await requestPrompt(generationRequest(library), accessKey, controller.signal, import.meta.env.VITE_PROMPT_API_URL ?? '');
      if (controller.signal.aborted) return;
      patchDraft({ prompt: response.prompt, generatedModelId: response.modelId });
      setNotice('Prompt ready. Edit it, copy it, or save it to this group.');
      output.current?.focus();
    } catch (error) {
      if (controller.signal.aborted) setNotice(controller.signal.reason instanceof Error && controller.signal.reason.message === 'timeout' ? 'Generation timed out. Your previous prompt is unchanged.' : 'Generation canceled. Your previous prompt is unchanged.');
      else {
        if (error instanceof PromptApiError && error.code === 'unauthorized') { setAccessKey(''); setAccessOpen(true); }
        setError(error instanceof PromptApiError ? error.message : 'Could not reach the prompt service. Check your connection and try again.'); setNotice('');
      }
    } finally { window.clearTimeout(timeout); if (request.current === controller) request.current = null; setBusy(false); }
  }

  /** Stop waiting for the current generation without clearing the existing editor. */
  function cancelGeneration(): void { request.current?.abort(); }

  /** Store a new prompt or update its existing saved record using the current editable content. */
  function saveCurrentPrompt(): void {
    try { setLibrary(saveDraft(library, makeId(), new Date().toISOString())); setNotice(`Saved to ${group.name}.`); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'The prompt could not be saved.'); }
  }

  /** Save an independent copy without overwriting the prompt currently being edited. */
  function saveCopy(): void {
    try {
      const copy = { ...library, draft: { ...draft, savedId: null, name: `${draft.name.slice(0, MAX_NAME_LENGTH - 7)} (copy)` } };
      setLibrary(saveDraft(copy, makeId(), new Date().toISOString())); setNotice(`Copy saved to ${group.name}.`); setError('');
    } catch (error) { setError(error instanceof Error ? error.message : 'The copy could not be saved.'); }
  }

  /** Remove a saved prompt only after naming the entry and confirming the deletion. */
  function removeCurrentPrompt(): void {
    if (!draft.savedId || !window.confirm(`Delete “${draft.name}” and its current edits? This cannot be undone.`)) return;
    setLibrary(deletePrompt(library, draft.savedId)); setNotice('Prompt deleted.'); setError('');
  }

  /** Copy exactly the edited output; select it for manual copying if clipboard access is unavailable. */
  async function copyPrompt(): Promise<void> {
    try { await navigator.clipboard.writeText(draft.prompt); setNotice('Prompt copied.'); setError(''); }
    catch { output.current?.focus(); output.current?.select(); setError('Clipboard access is unavailable. The prompt is selected so you can copy it manually.'); }
  }

  /** Open the current group's name and context for editing. */
  function editCurrentGroup(): void { setEditingGroup(group); }
  /** Prepare an empty group without adding it until its dialog is saved. */
  function addGroup(): void { if (!busy) setEditingGroup({ id: makeId(), name: '', context: '' }); }
  /** Close the group editing dialog without making an additional library mutation. */
  function closeGroupEditor(): void { setEditingGroup(null); }
  /** Commit validated group changes while retaining the currently open prompt. */
  function commitGroup(id: string, name: string, context: string): void {
    if (storageBlocked) throw new Error('Saving is paused. Recover or reload your library first.');
    const next = saveGroup(library, id, name, context);
    // Select a newly added group when there is no unfinished draft to protect.
    const isNew = !library.groups.some(function existingGroup(item) { return item.id === id; });
    setLibrary(isNew && !dirty ? { ...next, draft: createDraft(id) } : next); setNotice('Group context saved.');
  }
  /** Confirm a whole-group deletion, including its saved prompts and active draft. */
  function removeEditingGroup(): void {
    if (!editingGroup || storageBlocked) return;
    const count = library.prompts.filter(function countGroupPrompts(prompt) { return prompt.groupId === editingGroup.id; }).length;
    if (!window.confirm(`Delete “${editingGroup.name}”, its context, and ${count} saved prompt${count === 1 ? '' : 's'}? Any open draft in this group will also be removed. This cannot be undone.`)) return;
    try { setLibrary(deleteGroup(library, editingGroup.id)); setEditingGroup(null); setNotice('Group deleted.'); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'The group could not be deleted.'); setEditingGroup(null); }
  }

  /** Download all groups, saved prompts, and the current draft as a portable local backup. */
  function exportBackup(): void {
    try {
      const data = JSON.stringify(library);
      const oversized = serializedBytes(data) > MAX_LIBRARY_BYTES;
      downloadJson(data, `toolbox-prompts-${oversized ? 'recovery-' : ''}${new Date().toISOString().slice(0, 10)}.json`);
      setNotice(oversized ? 'Recovery copy downloaded. Shorten the current draft or remove unused prompts before creating an importable backup.' : 'Backup downloaded.');
    }
    catch (error) { setError(error instanceof Error ? error.message : 'The backup could not be downloaded.'); }
  }
  /** Open the native file picker so the user explicitly chooses the backup to import. */
  function chooseBackup(): void { fileInput.current?.click(); }
  /** Merge a backup as new copies and explicitly restore its unfinished draft after confirmation. */
  async function importBackup(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_LIBRARY_BYTES) throw new Error('Choose a backup smaller than 2 MB.');
      const imported = parseLibrary(JSON.parse(await file.text()) as unknown);
      // Validate before setting state so an invalid merge cannot throw during React's render cycle.
      const merged = importLibrary(libraryRef.current, imported, makeId);
      const draftWarning = isDraftDirty(libraryRef.current) ? ' This replaces your current unsaved draft; save or export it first if you want to keep it.' : '';
      if (!window.confirm(`Import ${imported.groups.length} groups and ${imported.prompts.length} saved prompts as new copies, then open the backed-up draft?${draftWarning}`)) return;
      setLibrary(merged);
      setNotice('Backup imported as new copies.'); setError('');
    } catch (error) { setError(error instanceof Error ? error.message : 'The backup could not be imported.'); }
  }

  /** Download the untouched unreadable data before the user chooses whether to reset it. */
  function exportRecovery(): void { if (recovery !== null) downloadJson(recovery, 'toolbox-prompts-recovery.json'); }
  /** Replace damaged storage only after explicit confirmation; the recovery download remains available first. */
  function resetLibrary(): void {
    if (!window.confirm('Start a fresh library? Download the recovery copy first if you want to keep the old data.')) return;
    setRecovery(null); setStorageError(''); setLibrary(createLibrary()); setNotice('A fresh library is ready.');
  }
  /** Reload only after protecting edits when a second browser tab has changed the library. */
  function reloadLibrary(): void { if (!dirty || window.confirm('Reload the other tab’s library? Export a backup first to keep this tab’s current edits.')) window.location.reload(); }
  /** Show or hide the saved prompt list on compact mobile screens. */
  function toggleSaved(): void { setShowSaved(!showSaved); }
  /** Open AI access settings without making a generation request. */
  function showAccess(): void { setAccessOpen(true); }
  /** Close the AI access dialog while retaining the current editor. */
  function closeAccess(): void { setAccessOpen(false); }
  /** Keep the separate workbench key only in this mounted page's memory. */
  function unlockAccess(key: string): void { setAccessKey(key); setNotice('AI unlocked for this visit.'); }
  /** Forget the in-memory key immediately when the user locks AI generation. */
  function lockAccess(): void { setAccessKey(''); setAccessOpen(false); setNotice('AI generation locked.'); }

  /** Render one group button using its stable ID, never its editable name, as the reference. */
  function renderGroup(item: Group): ReactNode {
    return <button type="button" className="pb-group" key={item.id} data-group-id={item.id} aria-pressed={item.id === group.id} onClick={selectGroup} disabled={busy || storageBlocked}><Icon name="folder" /><span>{item.name}</span></button>;
  }
  /** Render a saved prompt as a navigable entry scoped to the active project group. */
  function renderSaved(prompt: SavedPrompt): ReactNode {
    return <button type="button" key={prompt.id} className="pb-saved-item" data-prompt-id={prompt.id} aria-current={draft.savedId === prompt.id ? 'true' : undefined} onClick={openSaved} disabled={busy || storageBlocked}><Icon name="save" /><span>{prompt.name}</span></button>;
  }
  /** Render a task preset from the same allowed values used by the server. */
  function renderTask(task: GenerationRequest['task']): ReactNode {
    return <button type="button" key={task} data-task={task} aria-pressed={draft.task === task} onClick={selectTask}>{titleCase(task)}</button>;
  }
  /** Render the small shared model catalog without exposing an arbitrary model input. */
  function renderModel(model: typeof MODELS[number]): ReactNode { return <option value={model.id} key={model.id}>{model.name} · {model.label}</option>; }

  return <div className="pb-app">
    <a className="pb-skip" href="#pb-idea">Skip to prompt editor</a>
    <header className="pb-top"><a className="pb-brand" href="/"><Icon name="box" /><span>toolbox</span></a><span className="pb-divider" /><h1>Prompt Builder</h1><button className="pb-access" type="button" onClick={showAccess} disabled={busy}><Icon name="lock" /><span>{accessKey ? 'AI unlocked' : 'Unlock AI'}</span></button></header>
    <div className="pb-shell">
      <aside className="pb-sidebar" aria-label="Prompt library">
        <button type="button" className="pb-new" onClick={newPrompt} disabled={busy || storageBlocked}><Icon name="plus" />New prompt</button>
        <section><div className="pb-group-heading"><h2>Groups</h2><button className="pb-icon-button" type="button" onClick={addGroup} aria-label="Add group" disabled={busy || storageBlocked}><Icon name="plus" /></button></div><nav className="pb-group-nav" aria-label="Prompt groups">{library.groups.map(renderGroup)}</nav></section>
        <section className={`pb-recent ${showSaved ? 'pb-recent-open' : ''}`}><div className="pb-group-heading"><h2>Saved prompts <span className="pb-count">{savedPrompts.length}</span></h2><button className="pb-mobile-toggle pb-text-button" type="button" onClick={toggleSaved} aria-expanded={showSaved}>{showSaved ? 'Hide' : 'Show'}</button></div><div className="pb-recent-list">{savedPrompts.length ? savedPrompts.map(renderSaved) : <p className="pb-empty">Saved prompts will appear here.</p>}</div></section>
        <div className="pb-library-footer"><p>{savingPaused ? 'Saving paused' : 'Saved in this browser'}</p><div className="pb-backup-actions"><button type="button" className="pb-text-button" onClick={exportBackup}>Export</button><span>·</span><button type="button" className="pb-text-button" onClick={chooseBackup} disabled={storageBlocked || busy}>Import</button></div><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importBackup} aria-label="Import prompt backup" /></div>
      </aside>
      <main className="pb-main">
        <div className="pb-heading"><div><p className="pb-eyebrow">{group.name}</p><h2>{draft.savedId ? 'Make it your own.' : 'Start with an idea.'}</h2></div><button className="pb-text-button" type="button" onClick={editCurrentGroup} disabled={busy || storageBlocked}>Edit group</button></div>
        {(storageError || externalChange) && <div className="pb-storage-warning" role="alert"><p>{externalChange ? 'Another tab changed this library. Saving is paused here to protect both copies. Export this tab’s work before reloading.' : storageError}</p><div>{recovery !== null && <><button type="button" className="pb-text-button" onClick={exportRecovery}>Download recovery copy</button><button type="button" className="pb-text-button" onClick={resetLibrary}>Start fresh</button></>}{externalChange && <button type="button" className="pb-text-button" onClick={reloadLibrary}>Reload library</button>}</div></div>}
        <div className="pb-columns">
          <form className="pb-editor" onSubmit={generate}>
            <fieldset disabled={busy || storageBlocked} className="pb-fieldset"><legend className="pb-label">What are you working on?</legend><div className="pb-presets" role="group" aria-label="Task preset">{TASKS.map(renderTask)}</div>
              <label className="pb-field" htmlFor="pb-idea"><span>Your idea</span><textarea id="pb-idea" className="pb-input pb-goal" rows={5} value={draft.idea} onChange={changeIdea} required maxLength={MAX_IDEA_LENGTH} placeholder="What do you want ChatGPT to help you do?" /></label>
              <div className="pb-context"><div className="pb-context-bar"><Icon name="folder" /><span>Project context</span><label className="pb-context-switch"><span>Include context</span><input type="checkbox" checked={draft.includeContext} onChange={toggleContext} /></label></div><p className="pb-context-copy">{group.context || 'Add the background you want every prompt to remember.'}</p><button className="pb-context-edit pb-text-button" type="button" onClick={editCurrentGroup}>{group.context ? 'Edit context' : 'Add context'}</button></div>
              <details className="pb-details"><summary>Fine-tune <span aria-hidden="true">+</span></summary><div className="pb-options"><label className="pb-field"><span>Tone</span><select className="pb-select" value={draft.tone} onChange={changeTone}><option value="clear">Clear</option><option value="friendly">Friendly</option><option value="direct">Direct</option></select></label><label className="pb-field"><span>Prompt format</span><select className="pb-select" value={draft.format} onChange={changeFormat}><option value="structured">Structured</option><option value="concise">Concise</option><option value="checklist">Checklist</option></select></label></div></details>
              <label className="pb-field pb-model"><span>Generation model</span><select className="pb-select" value={draft.modelId} onChange={changeModel} aria-describedby="pb-model-help">{MODELS.map(renderModel)}</select><small id="pb-model-help">{selectedModel.description}</small></label>
              <button className="pb-primary pb-generate" type="submit" disabled={!draft.idea.trim()}><Icon name="spark" />{busy ? 'Building prompt…' : 'Build prompt'}</button>
            </fieldset>
            {busy ? <button className="pb-secondary pb-wide pb-cancel" type="button" onClick={cancelGeneration}>Cancel generation</button> : <p className="pb-generation-note">A prompt you can take to ChatGPT.</p>}
          </form>
          <section className="pb-result" aria-label="Your editable prompt" aria-busy={busy}>
            <div className="pb-output"><div className="pb-output-header"><label htmlFor="pb-prompt">Your prompt</label><span>{busy ? 'Building…' : draft.prompt && savingPaused ? 'Not saved to browser' : draft.savedId && !dirty ? 'Saved' : draft.prompt ? 'Editable draft' : 'Ready when you are'}</span></div><textarea ref={output} id="pb-prompt" className="pb-draft" value={draft.prompt} onChange={changePrompt} maxLength={MAX_PROMPT_LENGTH} disabled={busy} readOnly={storageBlocked} placeholder="Your prompt will take shape here. You can also write or paste one of your own." spellCheck={false} />
              <div className="pb-save-name"><label htmlFor="pb-prompt-name">Prompt name</label><input id="pb-prompt-name" value={draft.name} onChange={changePromptName} maxLength={MAX_NAME_LENGTH} placeholder="e.g. Plan the first version" disabled={busy || storageBlocked} /></div>
              <div className="pb-output-footer"><button type="button" className="pb-save" onClick={saveCurrentPrompt} disabled={busy || !draft.prompt.trim() || !draft.name.trim() || storageBlocked}><Icon name="save" />{draft.savedId ? 'Save changes' : 'Save to group'}</button><button type="button" className="pb-copy" onClick={copyPrompt} disabled={!draft.prompt.trim() || busy}><Icon name="copy" />Copy prompt</button></div>
            </div>
            {draft.savedId && <div className="pb-saved-actions"><button className="pb-text-button" type="button" onClick={saveCopy} disabled={busy || storageBlocked || !draft.prompt.trim()}>Save a copy</button><button className="pb-text-button" type="button" onClick={removeCurrentPrompt} disabled={busy || storageBlocked}>Delete prompt</button></div>}
            <p className="pb-private-note">Only your idea and included context are sent when you build.</p>
          </section>
        </div>
        <div className="pb-feedback" aria-live="polite" role="status">{visibleNotice}</div>{error && <p className="pb-error" role="alert">{error}</p>}
      </main>
    </div>
    {editingGroup && <GroupEditor key={editingGroup.id} group={editingGroup} disabled={storageBlocked} isNew={!library.groups.some(function existingGroup(item) { return item.id === editingGroup.id; })} onSave={commitGroup} onClose={closeGroupEditor} onDelete={removeEditingGroup} />}
    {accessOpen && <AccessEditor unlocked={Boolean(accessKey)} onUnlock={unlockAccess} onLock={lockAccess} onClose={closeAccess} />}
  </div>;
}
