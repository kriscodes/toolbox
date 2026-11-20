import type { ReactNode } from 'react';
import type { Group, SavedPrompt } from './library';
import { Icon } from './icon';
import type { PromptLibrary } from './use-prompt-library';
import type { LibraryActions } from './use-library-actions';
import type { LibraryBackups } from './use-library-backups';

/** Render navigation and backup controls for the current browser library. */
export function LibrarySidebar({
  state,
  actions,
  backups,
  busy,
}: {
  state: PromptLibrary;
  actions: LibraryActions;
  backups: LibraryBackups;
  busy: boolean;
}): ReactNode {
  const { library, draft, group, savedPrompts, storageBlocked, savingPaused } = state;
  const { newPrompt, addGroup, selectGroup, openSaved, showSaved, toggleSaved } = actions;
  const { fileInput, exportBackup, chooseBackup, importBackup } = backups;
  /** Render one group button using its stable ID, never its editable name, as the reference. */
  function renderGroup(item: Group): ReactNode {
    return (
      <button
        type="button"
        className="pb-group"
        key={item.id}
        data-group-id={item.id}
        aria-pressed={item.id === group.id}
        onClick={selectGroup}
        disabled={busy || storageBlocked}
      >
        <Icon name="folder" />
        <span>{item.name}</span>
      </button>
    );
  }
  /** Render a saved prompt as a navigable entry scoped to the active project group. */
  function renderSaved(prompt: SavedPrompt): ReactNode {
    return (
      <button
        type="button"
        key={prompt.id}
        className="pb-saved-item"
        data-prompt-id={prompt.id}
        aria-current={draft.savedId === prompt.id ? 'true' : undefined}
        onClick={openSaved}
        disabled={busy || storageBlocked}
      >
        <Icon name="save" />
        <span>{prompt.name}</span>
      </button>
    );
  }

  return (
    <aside className="pb-sidebar" aria-label="Prompt library">
      <button
        type="button"
        className="pb-new"
        onClick={newPrompt}
        disabled={busy || storageBlocked}
      >
        <Icon name="plus" />
        New prompt
      </button>
      <section>
        <div className="pb-group-heading">
          <h2>Groups</h2>
          <button
            className="pb-icon-button"
            type="button"
            onClick={addGroup}
            aria-label="Add group"
            disabled={busy || storageBlocked}
          >
            <Icon name="plus" />
          </button>
        </div>
        <nav className="pb-group-nav" aria-label="Prompt groups">
          {library.groups.map(renderGroup)}
        </nav>
      </section>
      <section className={`pb-recent ${showSaved ? 'pb-recent-open' : ''}`}>
        <div className="pb-group-heading">
          <h2>
            Saved prompts <span className="pb-count">{savedPrompts.length}</span>
          </h2>
          <button
            className="pb-mobile-toggle pb-text-button"
            type="button"
            onClick={toggleSaved}
            aria-expanded={showSaved}
          >
            {showSaved ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="pb-recent-list">
          {savedPrompts.length ? (
            savedPrompts.map(renderSaved)
          ) : (
            <p className="pb-empty">Saved prompts will appear here.</p>
          )}
        </div>
      </section>
      <div className="pb-library-footer">
        <p>
          {savingPaused ? 'Saving paused' : 'Saved in this browser'} ·{' '}
          <a href="/privacy/">Privacy & analytics</a>
        </p>
        <div className="pb-backup-actions">
          <button type="button" className="pb-text-button" onClick={exportBackup}>
            Export
          </button>
          <span>·</span>
          <button
            type="button"
            className="pb-text-button"
            onClick={chooseBackup}
            disabled={storageBlocked || busy}
          >
            Import
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={importBackup}
          aria-label="Import prompt backup"
        />
      </div>
    </aside>
  );
}
