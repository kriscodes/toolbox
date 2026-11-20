import { useEffect, useLayoutEffect, useRef, useState, type SetStateAction } from 'react';
import { createConfirmationRequest } from './confirmation-request';
import type { ConfirmationOptions } from './confirmation';
import {
  STORAGE_KEY,
  isDraftDirty,
  readBrowserLibrary,
  serializeLibrary,
  type Draft,
  type Library,
} from './library';

/** Own persistence, recovery and snapshot-safe mutations for the local prompt library. */
export function usePromptLibrary() {
  const [loaded] = useState(readBrowserLibrary);
  const [library, updateLibrary] = useState(loaded.library);
  const [recovery, setRecovery] = useState(loaded.recovery);
  const [storageError, setStorageError] = useState(loaded.error ?? '');
  const [externalChange, setExternalChange] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{
    id: number;
    options: ConfirmationOptions;
  } | null>(null);
  const confirmationId = useRef(0);
  const libraryRef = useRef(library);
  const storageBlockedRef = useRef(recovery !== null);
  const mounted = useRef(false);
  const confirmationRequest = useRef<ReturnType<typeof createConfirmationRequest> | null>(null);
  const draft = library.draft;
  const group = library.groups.find(function activeGroup(item) {
    return item.id === draft.groupId;
  })!;
  const savedPrompts = library.prompts.filter(function inActiveGroup(prompt) {
    return prompt.groupId === group.id;
  });
  const dirty = isDraftDirty(library);
  const storageBlocked = recovery !== null || externalChange;
  const savingPaused = Boolean(storageError) || storageBlocked;
  const visibleNotice =
    savingPaused &&
    /^(?:Saved to |Copy saved to |Group context saved\.|Prompt deleted\.|Group deleted\.|Backup imported as new copies\.|A fresh library is ready\.)/u.test(
      notice,
    )
      ? ''
      : notice;

  // Recreate the controller on effect setup so development StrictMode remains usable.
  useLayoutEffect(function attachConfirmations() {
    mounted.current = true;
    const controller = createConfirmationRequest({
      getSnapshot: function currentLibrary() {
        return libraryRef.current;
      },
      onChange: function showConfirmation(options) {
        setConfirmation(options ? { id: ++confirmationId.current, options } : null);
      },
    });
    confirmationRequest.current = controller;
    return function disposeConfirmations() {
      mounted.current = false;
      controller.dispose();
      confirmationRequest.current = null;
    };
  }, []);

  /** Request consent against the current library snapshot. */
  function ask(options: ConfirmationOptions): Promise<boolean> {
    return confirmationRequest.current?.ask(options) ?? Promise.resolve(false);
  }
  /** Resolve the current dialog once, leaving stale decisions declined. */
  function resolve(confirmed: boolean): void {
    confirmationRequest.current?.resolve(confirmed);
  }
  const confirmations = { ask, resolve };

  /** Publish the latest snapshot synchronously so asynchronous work cannot use stale state. */
  function setLibrary(value: SetStateAction<Library>): void {
    if (!mounted.current || storageBlockedRef.current) return;
    const next = typeof value === 'function' ? value(libraryRef.current) : value;
    if (next !== libraryRef.current) confirmationRequest.current?.cancel();
    libraryRef.current = next;
    updateLibrary(next);
  }

  /** Clear recovery only after a confirmed reset, without dismissing a cross-tab conflict. */
  function replaceDamagedLibrary(next: Library): void {
    if (!mounted.current || externalChange) return;
    storageBlockedRef.current = false;
    setRecovery(null);
    setStorageError('');
    setLibrary(next);
  }

  useEffect(
    function persistLibrary() {
      if (storageBlockedRef.current) return;
      try {
        localStorage.setItem(STORAGE_KEY, serializeLibrary(library));
        setStorageError('');
      } catch (error) {
        setStorageError(
          error instanceof Error && error.message.startsWith('This library')
            ? error.message
            : 'Changes could not be saved in this browser. Export a backup before leaving.',
        );
      }
    },
    [library, storageBlocked],
  );

  useEffect(function observeOtherTabs() {
    /** Block pending writes immediately when another tab changes stored data. */
    function onStorage(event: StorageEvent): void {
      if (event.key === STORAGE_KEY || event.key === null) {
        storageBlockedRef.current = true;
        confirmationRequest.current?.cancel();
        setExternalChange(true);
      }
    }
    window.addEventListener('storage', onStorage);
    return function stopObserving() {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  /** Patch only the active draft while preserving every saved group and prompt. */
  function patchDraft(patch: Partial<Draft>): void {
    if (storageBlockedRef.current || !mounted.current) return;
    setLibrary(function applyDraftPatch(current) {
      return { ...current, draft: { ...current.draft, ...patch } };
    });
    setNotice('');
    setError('');
  }

  return {
    library,
    libraryRef,
    mounted,
    setLibrary,
    replaceDamagedLibrary,
    draft,
    group,
    savedPrompts,
    dirty,
    recovery,
    storageError,
    externalChange,
    storageBlocked,
    storageBlockedRef,
    savingPaused,
    notice,
    visibleNotice,
    error,
    setNotice,
    setError,
    patchDraft,
    confirmation,
    confirmations,
  };
}
export type PromptLibrary = ReturnType<typeof usePromptLibrary>;
