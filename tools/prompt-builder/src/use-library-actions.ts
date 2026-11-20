import { useState, type MouseEvent } from 'react';
import {
  MAX_NAME_LENGTH,
  createDraft,
  deleteGroup,
  deletePrompt,
  draftFromPrompt,
  saveDraft,
  saveGroup,
  type Group,
} from './library';
import { makeId } from './browser-files';
import type { PromptLibrary } from './use-prompt-library';

/** Coordinate deliberate prompt and group mutations, including unsaved-work confirmations. */
export function useLibraryActions(state: PromptLibrary, busy: boolean) {
  const {
    library,
    setLibrary,
    draft,
    group,
    dirty,
    storageBlockedRef,
    storageBlocked,
    confirmations,
    setNotice,
    setError,
  } = state;
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  /** Confirm a destructive editor replacement; a running request must first be canceled. */
  async function mayReplaceDraft(): Promise<boolean> {
    if (storageBlockedRef.current) return false;
    if (busy) {
      setError('Cancel the current generation before changing prompts.');
      return false;
    }
    return (
      !dirty ||
      confirmations.ask({
        kicker: 'Unsaved draft',
        title: 'Replace this draft?',
        description:
          'Your current changes haven’t been saved to the library. Continuing will discard them.',
        recordName: draft.name.trim() || 'Untitled prompt',
        recordMeta: `${group.name} · Unsaved changes`,
        confirmLabel: 'Discard & continue',
        cancelLabel: 'Keep editing',
      })
    );
  }

  /** Start an empty prompt within the current project group after protecting unsaved work. */
  async function newPrompt(): Promise<void> {
    if (!(await mayReplaceDraft())) return;
    setLibrary({ ...library, draft: createDraft(group.id) });
    setError('');
    setNotice('New prompt ready.');
    setShowSaved(false);
  }

  /** Switch groups and open a fresh composer after checking for unsaved editor changes. */
  async function selectGroup(event: MouseEvent<HTMLButtonElement>): Promise<void> {
    const id = event.currentTarget.dataset.groupId;
    if (!id || id === group.id || !(await mayReplaceDraft())) return;
    setLibrary({ ...library, draft: createDraft(id) });
    setError('');
    setNotice('');
  }

  /** Reopen a saved prompt with its generation preferences and editable text intact. */
  async function openSaved(event: MouseEvent<HTMLButtonElement>): Promise<void> {
    const id = event.currentTarget.dataset.promptId;
    const prompt = library.prompts.find(function findPrompt(item) {
      return item.id === id;
    });
    if (!prompt || prompt.id === draft.savedId || !(await mayReplaceDraft())) return;
    setLibrary({ ...library, draft: draftFromPrompt(prompt) });
    setError('');
    setNotice('Saved prompt opened.');
    setShowSaved(false);
  }

  /** Store a new prompt or update its existing saved record using the current editable content. */
  function saveCurrentPrompt(): void {
    try {
      setLibrary(saveDraft(library, makeId(), new Date().toISOString()));
      setNotice(`Saved to ${group.name}.`);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The prompt could not be saved.');
    }
  }

  /** Save an independent copy without overwriting the prompt currently being edited. */
  function saveCopy(): void {
    try {
      const copy = {
        ...library,
        draft: {
          ...draft,
          savedId: null,
          name: `${draft.name.slice(0, MAX_NAME_LENGTH - 7)} (copy)`,
        },
      };
      setLibrary(saveDraft(copy, makeId(), new Date().toISOString()));
      setNotice(`Copy saved to ${group.name}.`);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The copy could not be saved.');
    }
  }

  /** Remove a saved prompt only after naming the entry and confirming the deletion. */
  async function removeCurrentPrompt(): Promise<void> {
    if (
      !draft.savedId ||
      storageBlockedRef.current ||
      !(await confirmations.ask({
        kicker: 'Delete prompt',
        title: 'Delete this prompt?',
        description: `“${draft.name.trim() || 'Untitled prompt'}” and its current edits will be permanently removed. This cannot be undone.`,
        recordName: draft.name.trim() || 'Untitled prompt',
        recordMeta: `Saved in ${group.name}`,
        confirmLabel: 'Delete prompt',
        cancelLabel: 'Keep prompt',
        destructive: true,
      }))
    )
      return;
    setLibrary(deletePrompt(library, draft.savedId));
    setNotice('Prompt deleted.');
    setError('');
  }

  /** Open the current group's name and context for editing. */
  function editCurrentGroup(): void {
    setEditingGroup(group);
  }
  /** Prepare an empty group without adding it until its dialog is saved. */
  function addGroup(): void {
    if (!busy) setEditingGroup({ id: makeId(), name: '', context: '' });
  }
  /** Close the group editing dialog without making an additional library mutation. */
  function closeGroupEditor(): void {
    setEditingGroup(null);
  }
  /** Commit validated group changes while retaining the currently open prompt. */
  function commitGroup(id: string, name: string, context: string): void {
    if (storageBlocked) throw new Error('Saving is paused. Recover or reload your library first.');
    const next = saveGroup(library, id, name, context);
    // Select a newly added group when there is no unfinished draft to protect.
    const isNew = !library.groups.some(function existingGroup(item) {
      return item.id === id;
    });
    setLibrary(isNew && !dirty ? { ...next, draft: createDraft(id) } : next);
    setNotice('Group context saved.');
  }
  /** Confirm a whole-group deletion, including its saved prompts and active draft. */
  async function removeEditingGroup(): Promise<void> {
    if (!editingGroup || storageBlockedRef.current) return;
    const count = library.prompts.filter(function countGroupPrompts(prompt) {
      return prompt.groupId === editingGroup.id;
    }).length;
    if (
      !(await confirmations.ask({
        kicker: 'Delete group',
        title: `Delete “${editingGroup.name}”?`,
        description: `This will permanently remove its context, ${count} saved prompt${count === 1 ? '' : 's'}, and any open draft in this group. This cannot be undone.`,
        recordName: editingGroup.name,
        recordMeta: `${count} saved prompt${count === 1 ? '' : 's'} · Project context · Open draft`,
        confirmLabel: 'Delete group',
        cancelLabel: 'Keep group',
        destructive: true,
      }))
    )
      return;
    try {
      setLibrary(deleteGroup(library, editingGroup.id));
      setEditingGroup(null);
      setNotice('Group deleted.');
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The group could not be deleted.');
      setEditingGroup(null);
    }
  }

  /** Show or hide the saved prompt list on compact mobile screens. */
  function toggleSaved(): void {
    setShowSaved(!showSaved);
  }

  return {
    editingGroup,
    showSaved,
    toggleSaved,
    newPrompt,
    selectGroup,
    openSaved,
    saveCurrentPrompt,
    saveCopy,
    removeCurrentPrompt,
    editCurrentGroup,
    addGroup,
    closeGroupEditor,
    commitGroup,
    removeEditingGroup,
  };
}
export type LibraryActions = ReturnType<typeof useLibraryActions>;
