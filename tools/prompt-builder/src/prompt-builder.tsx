import { useRef, type ReactNode } from 'react';
import { ConfirmationDialog } from './confirmation';
import { AccessEditor, GroupEditor } from './editors';
import { WorkbenchHeader } from './workbench-header';
import { LibrarySidebar } from './library-sidebar';
import { PromptEditor } from './prompt-editor';
import { PromptResult } from './prompt-result';
import { StorageWarning } from './storage-warning';
import { usePromptLibrary } from './use-prompt-library';
import { usePromptGeneration } from './use-prompt-generation';
import { useLibraryActions } from './use-library-actions';
import { useLibraryBackups } from './use-library-backups';
import { useUnsavedWarning } from './use-unsaved-warning';

/** Compose the local-first workbench from focused state owners and editor views. */
export function PromptBuilder(): ReactNode {
  const output = useRef<HTMLTextAreaElement>(null);
  const state = usePromptLibrary();
  const generation = usePromptGeneration(state, output);
  const actions = useLibraryActions(state, generation.busy);
  const backups = useLibraryBackups(state);
  const {
    library,
    draft,
    group,
    dirty,
    storageError,
    storageBlocked,
    visibleNotice,
    error,
    confirmation,
    confirmations,
  } = state;
  const { busy, accessKey, accessOpen, showAccess, closeAccess, unlockAccess, lockAccess } =
    generation;
  const { editingGroup, editCurrentGroup, commitGroup, closeGroupEditor, removeEditingGroup } =
    actions;
  useUnsavedWarning(dirty || busy || Boolean(storageError) || storageBlocked);

  return (
    <div className="pb-app">
      <a className="pb-skip" href="#pb-idea">
        Skip to prompt editor
      </a>
      <WorkbenchHeader busy={busy} unlocked={Boolean(accessKey)} showAccess={showAccess} />
      <div className="pb-shell">
        <LibrarySidebar state={state} actions={actions} backups={backups} busy={busy} />
        <main className="pb-main">
          <div className="pb-heading">
            <div>
              <p className="pb-eyebrow">{group.name}</p>
              <h2>{draft.savedId ? 'Make it your own.' : 'Start with an idea.'}</h2>
            </div>
            <button
              className="pb-text-button"
              type="button"
              onClick={editCurrentGroup}
              disabled={busy || storageBlocked}
            >
              Edit group
            </button>
          </div>
          <StorageWarning state={state} backups={backups} />
          <div className="pb-columns">
            <PromptEditor
              state={state}
              generation={generation}
              editCurrentGroup={editCurrentGroup}
            />
            <PromptResult state={state} generation={generation} actions={actions} output={output} />
          </div>
          <div className="pb-feedback" aria-live="polite" role="status">
            {visibleNotice}
          </div>
          {error && (
            <p className="pb-error" role="alert">
              {error}
            </p>
          )}
        </main>
      </div>
      {editingGroup && (
        <GroupEditor
          key={editingGroup.id}
          group={editingGroup}
          disabled={storageBlocked}
          isNew={
            !library.groups.some(function existingGroup(item) {
              return item.id === editingGroup.id;
            })
          }
          onSave={commitGroup}
          onClose={closeGroupEditor}
          onDelete={removeEditingGroup}
          confirm={confirmations.ask}
        />
      )}
      {accessOpen && (
        <AccessEditor
          unlocked={Boolean(accessKey)}
          onUnlock={unlockAccess}
          onLock={lockAccess}
          onClose={closeAccess}
        />
      )}
      {confirmation && (
        <ConfirmationDialog
          key={confirmation.id}
          options={confirmation.options}
          onResolve={confirmations.resolve}
        />
      )}
    </div>
  );
}
