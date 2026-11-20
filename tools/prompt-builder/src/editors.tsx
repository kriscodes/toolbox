import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ChangeEvent,
  type FormEvent,
  type SyntheticEvent,
} from 'react';
import { MAX_CONTEXT_LENGTH } from '@toolbox/prompt-contracts';
import { MAX_NAME_LENGTH, type Group } from './library';
import type { ConfirmationOptions } from './confirmation';
import { Icon } from './icon';

/** Use the browser's modal focus handling and Escape behavior for small editing dialogs. */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  /** Open the mounted dialog after React has attached its DOM reference. */
  function openModal(): void {
    dialog.current?.showModal();
  }
  useEffect(openModal, []);
  /** Keep the controlled dialog state in sync when the user presses Escape. */
  function cancelModal(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    onClose();
  }
  return (
    <dialog
      ref={dialog}
      className="pb-modal"
      aria-labelledby="pb-dialog-title"
      onCancel={cancelModal}
    >
      <div className="pb-modal-top">
        <h2 id="pb-dialog-title">{title}</h2>
        <button
          type="button"
          className="pb-icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

/** Edit a group's reusable context in a separate draft until the user explicitly saves it. */
export function GroupEditor({
  group,
  isNew,
  disabled,
  onSave,
  onClose,
  onDelete,
  confirm,
}: {
  group: Group;
  isNew: boolean;
  onSave: (id: string, name: string, context: string) => void;
  onClose: () => void;
  onDelete: () => void;
  disabled: boolean;
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
}): ReactNode {
  const [name, setName] = useState(group.name);
  const [context, setContext] = useState(group.context);
  const [error, setError] = useState('');
  /** Preserve edits when validation fails and close only after the group was accepted. */
  function submitGroup(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    try {
      onSave(group.id, name, context);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The group could not be saved.');
    }
  }
  /** Update the temporary group name without touching the stored library yet. */
  function changeName(event: ChangeEvent<HTMLInputElement>): void {
    setName(event.target.value);
  }
  /** Update the temporary project context without touching the stored library yet. */
  function changeContext(event: ChangeEvent<HTMLTextAreaElement>): void {
    setContext(event.target.value);
  }
  /** Ask before dismissing edited group details, including an Escape-key dismissal. */
  async function closeEditor(): Promise<void> {
    if (
      (name !== group.name || context !== group.context) &&
      !(await confirm({
        kicker: 'Unsaved group changes',
        title: 'Discard these changes?',
        description:
          'Your edits to this group’s name and project context haven’t been saved. Closing will discard them.',
        recordName: name.trim() || 'New group',
        recordMeta: 'Group details · Unsaved changes',
        confirmLabel: 'Discard changes',
        cancelLabel: 'Keep editing',
      }))
    )
      return;
    onClose();
  }
  return (
    <Modal title={isNew ? 'New group' : 'Project context'} onClose={closeEditor}>
      <form onSubmit={submitGroup}>
        <fieldset className="pb-fieldset" disabled={disabled}>
          <label className="pb-field">
            <span>Group name</span>
            <input
              className="pb-input"
              value={name}
              onChange={changeName}
              required
              maxLength={MAX_NAME_LENGTH}
              autoFocus
              placeholder="e.g. Weekend projects"
            />
          </label>
          <label className="pb-field">
            <span>Saved project context</span>
            <textarea
              className="pb-input pb-context-editor"
              value={context}
              onChange={changeContext}
              maxLength={MAX_CONTEXT_LENGTH}
              rows={8}
              placeholder="What is this project? Include useful background, preferences, constraints, or decisions to remember."
            />
          </label>
          <p className="pb-help">Reused only when “Include context” is on.</p>
          {error && (
            <p className="pb-error" role="alert">
              {error}
            </p>
          )}
          <div className="pb-modal-actions">
            {!isNew && (
              <button type="button" className="pb-text-button pb-danger" onClick={onDelete}>
                Delete group
              </button>
            )}
            <button className="pb-primary" type="submit">
              Save group
            </button>
          </div>
        </fieldset>
        {disabled && (
          <p className="pb-error" role="alert">
            Saving is paused. Close this dialog and recover or reload your library first.
          </p>
        )}
      </form>
    </Modal>
  );
}

/** Unlock paid generation with a separate workbench key kept in memory for this visit only. */
export function AccessEditor({
  unlocked,
  onUnlock,
  onLock,
  onClose,
}: {
  unlocked: boolean;
  onUnlock: (key: string) => void;
  onLock: () => void;
  onClose: () => void;
}): ReactNode {
  const [key, setKey] = useState('');
  /** Keep the key in this dialog's local state while the user enters it. */
  function changeKey(event: ChangeEvent<HTMLInputElement>): void {
    setKey(event.target.value);
  }
  /** Pass the trimmed private workbench key to the parent without writing browser storage. */
  function unlock(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onUnlock(key.trim());
    onClose();
  }
  return (
    <Modal title={unlocked ? 'Private AI access' : 'Unlock private AI'} onClose={onClose}>
      {unlocked ? (
        <>
          <p className="pb-help">AI generation is unlocked for this visit.</p>
          <button type="button" className="pb-secondary pb-wide" onClick={onLock}>
            Lock AI generation
          </button>
        </>
      ) : (
        <form onSubmit={unlock}>
          <p className="pb-help">
            The free template builder is available to everyone. Private AI is an optional feature
            for the workbench owner.
          </p>
          <label className="pb-field">
            <span>Workbench access key</span>
            <input
              className="pb-input"
              type="password"
              autoComplete="current-password"
              value={key}
              onChange={changeKey}
              minLength={24}
              maxLength={256}
              required
              autoFocus
            />
          </label>
          <p className="pb-help">
            Use your private Workbench key. This is separate from your OpenAI API key, which stays
            on the server.
          </p>
          <button className="pb-primary pb-wide" type="submit">
            Unlock for this visit
          </button>
        </form>
      )}
    </Modal>
  );
}
