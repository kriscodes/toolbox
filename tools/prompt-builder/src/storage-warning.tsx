import type { ReactNode } from 'react';
import type { PromptLibrary } from './use-prompt-library';
import type { LibraryBackups } from './use-library-backups';

/** Explain paused saving and expose recovery actions without hiding the current draft. */
export function StorageWarning({
  state,
  backups,
}: {
  state: PromptLibrary;
  backups: LibraryBackups;
}): ReactNode {
  const { storageError, externalChange, recovery } = state;
  const { exportRecovery, resetLibrary, reloadLibrary } = backups;
  return (
    <>
      {(storageError || externalChange) && (
        <div className="pb-storage-warning" role="alert">
          <p>
            {externalChange
              ? 'Another tab changed this library. Saving is paused here to protect both copies. Export this tab’s work before reloading.'
              : storageError}
          </p>
          <div>
            {recovery !== null && (
              <>
                <button type="button" className="pb-text-button" onClick={exportRecovery}>
                  Download recovery copy
                </button>
                <button type="button" className="pb-text-button" onClick={resetLibrary}>
                  Start fresh
                </button>
              </>
            )}
            {externalChange && (
              <button type="button" className="pb-text-button" onClick={reloadLibrary}>
                Reload library
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
