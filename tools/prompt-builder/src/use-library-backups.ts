import { useRef, type ChangeEvent } from 'react';
import {
  MAX_LIBRARY_BYTES,
  createLibrary,
  importLibrary,
  isDraftDirty,
  parseLibrary,
  serializedBytes,
} from './library';
import { downloadJson, makeId } from './browser-files';
import type { PromptLibrary } from './use-prompt-library';

/** Manage portable backups and recovery without uploading private library content. */
export function useLibraryBackups(state: PromptLibrary) {
  const {
    library,
    libraryRef,
    mounted,
    setLibrary,
    replaceDamagedLibrary,
    draft,
    group,
    dirty,
    recovery,
    storageBlockedRef,
    confirmations,
    setNotice,
    setError,
  } = state;
  const fileInput = useRef<HTMLInputElement>(null);
  /** Download all groups, saved prompts, and the current draft as a portable local backup. */
  function exportBackup(): void {
    try {
      const data = JSON.stringify(library);
      const oversized = serializedBytes(data) > MAX_LIBRARY_BYTES;
      downloadJson(
        data,
        `toolbox-prompts-${oversized ? 'recovery-' : ''}${new Date().toISOString().slice(0, 10)}.json`,
      );
      setNotice(
        oversized
          ? 'Recovery copy downloaded. Shorten the current draft or remove unused prompts before creating an importable backup.'
          : 'Backup downloaded.',
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The backup could not be downloaded.');
    }
  }
  /** Open the native file picker so the user explicitly chooses the backup to import. */
  function chooseBackup(): void {
    fileInput.current?.click();
  }
  /** Merge a backup as new copies and explicitly restore its unfinished draft after confirmation. */
  async function importBackup(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_LIBRARY_BYTES) throw new Error('Choose a backup smaller than 2 MB.');
      const imported = parseLibrary(JSON.parse(await file.text()) as unknown);
      if (!mounted.current) return;
      if (storageBlockedRef.current)
        throw new Error('Saving is paused. Recover or reload your library before importing.');
      // Validate before setting state so an invalid merge cannot throw during React's render cycle.
      const merged = importLibrary(libraryRef.current, imported, makeId);
      const draftWarning = isDraftDirty(libraryRef.current)
        ? ' This replaces your unsaved draft. Save or export it first if you want to keep it.'
        : '';
      if (
        !(await confirmations.ask({
          kicker: 'Import backup',
          title: 'Import this backup?',
          description: `Groups and saved prompts will be added as new copies, then the backed-up draft will open.${draftWarning}`,
          recordName: file.name,
          recordMeta: `${imported.groups.length} groups · ${imported.prompts.length} saved prompts`,
          confirmLabel: 'Import backup',
          cancelLabel: 'Keep current library',
        }))
      )
        return;
      setLibrary(merged);
      setNotice('Backup imported as new copies.');
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The backup could not be imported.');
    }
  }

  /** Download the untouched unreadable data before the user chooses whether to reset it. */
  function exportRecovery(): void {
    if (recovery !== null) downloadJson(recovery, 'toolbox-prompts-recovery.json');
  }
  /** Replace damaged storage only after explicit confirmation; the recovery download remains available first. */
  async function resetLibrary(): Promise<void> {
    if (
      !(await confirmations.ask({
        kicker: 'Reset library',
        title: 'Start a fresh library?',
        description:
          'The stored library will be replaced. Download the recovery copy first if you want to keep the old data. This cannot be undone.',
        recordName: 'Stored library',
        recordMeta: 'Recovery copy available before resetting',
        confirmLabel: 'Start fresh',
        cancelLabel: 'Keep library',
        destructive: true,
      }))
    )
      return;
    replaceDamagedLibrary(createLibrary());
    setNotice('A fresh library is ready.');
  }
  /** Reload only after protecting edits when a second browser tab has changed the library. */
  async function reloadLibrary(): Promise<void> {
    if (
      !dirty ||
      (await confirmations.ask({
        kicker: 'Library changed',
        title: 'Reload this library?',
        description:
          'This will load the other tab’s library and replace this tab’s current edits. Export a backup first if you want to keep them.',
        recordName: draft.name.trim() || 'Current draft',
        recordMeta: `${group.name} · Changes in another tab`,
        confirmLabel: 'Reload library',
        cancelLabel: 'Keep this tab open',
      }))
    )
      window.location.reload();
  }

  return {
    fileInput,
    exportBackup,
    chooseBackup,
    importBackup,
    exportRecovery,
    resetLibrary,
    reloadLibrary,
  };
}
export type LibraryBackups = ReturnType<typeof useLibraryBackups>;
