import type { ReactNode, ChangeEvent, RefObject } from 'react';
import { MAX_PROMPT_LENGTH } from '@toolbox/prompt-contracts';
import { MAX_NAME_LENGTH } from './library';
import { Icon } from './icon';
import type { PromptLibrary } from './use-prompt-library';
import type { PromptGeneration } from './use-prompt-generation';
import type { LibraryActions } from './use-library-actions';

/** Keep generated output editable and expose explicit copy and save actions. */
export function PromptResult({
  state,
  generation,
  actions,
  output,
}: {
  state: PromptLibrary;
  generation: PromptGeneration;
  actions: LibraryActions;
  output: RefObject<HTMLTextAreaElement | null>;
}): ReactNode {
  const { draft, dirty, storageBlocked, savingPaused, patchDraft, setNotice, setError } = state;
  const { busy, generationMode } = generation;
  const { saveCurrentPrompt, saveCopy, removeCurrentPrompt } = actions;
  /** Keep the generated prompt freely editable and mark its saved copy as changed. */
  function changePrompt(event: ChangeEvent<HTMLTextAreaElement>): void {
    patchDraft({ prompt: event.target.value });
  }
  /** Update the saved prompt's display name without changing its body. */
  function changePromptName(event: ChangeEvent<HTMLInputElement>): void {
    patchDraft({ name: event.target.value });
  }
  /** Copy exactly the edited output; select it for manual copying if clipboard access is unavailable. */
  async function copyPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(draft.prompt);
      setNotice('Prompt copied.');
      setError('');
    } catch {
      output.current?.focus();
      output.current?.select();
      setError(
        'Clipboard access is unavailable. The prompt is selected so you can copy it manually.',
      );
    }
  }

  return (
    <section className="pb-result" aria-label="Your editable prompt" aria-busy={busy}>
      <div className="pb-output">
        <div className="pb-output-header">
          <label htmlFor="pb-prompt">Your prompt</label>
          <span>
            {busy
              ? 'Building…'
              : draft.prompt && savingPaused
                ? 'Not saved to browser'
                : draft.savedId && !dirty
                  ? 'Saved'
                  : draft.prompt
                    ? 'Editable draft'
                    : 'Ready when you are'}
          </span>
        </div>
        <textarea
          ref={output}
          id="pb-prompt"
          className="pb-draft"
          value={draft.prompt}
          onChange={changePrompt}
          maxLength={MAX_PROMPT_LENGTH}
          disabled={busy}
          readOnly={storageBlocked}
          placeholder="Your prompt will take shape here. You can also write or paste one of your own."
          spellCheck={false}
        />
        <div className="pb-save-name">
          <label htmlFor="pb-prompt-name">Prompt name</label>
          <input
            id="pb-prompt-name"
            value={draft.name}
            onChange={changePromptName}
            maxLength={MAX_NAME_LENGTH}
            placeholder="e.g. Plan the first version"
            disabled={busy || storageBlocked}
          />
        </div>
        <div className="pb-output-footer">
          <button
            type="button"
            className="pb-save"
            onClick={saveCurrentPrompt}
            disabled={busy || !draft.prompt.trim() || !draft.name.trim() || storageBlocked}
          >
            <Icon name="save" />
            {draft.savedId ? 'Save changes' : 'Save to group'}
          </button>
          <button
            type="button"
            className="pb-copy"
            onClick={copyPrompt}
            disabled={!draft.prompt.trim() || busy}
          >
            <Icon name="copy" />
            Copy prompt
          </button>
        </div>
      </div>
      {draft.savedId && (
        <div className="pb-saved-actions">
          <button
            className="pb-text-button"
            type="button"
            onClick={saveCopy}
            disabled={busy || storageBlocked || !draft.prompt.trim()}
          >
            Save a copy
          </button>
          <button
            className="pb-text-button"
            type="button"
            onClick={removeCurrentPrompt}
            disabled={busy || storageBlocked}
          >
            Delete prompt
          </button>
        </div>
      )}
      <p className="pb-private-note">
        {generationMode === 'free'
          ? 'Free templates are built here. Your idea and context stay in this browser.'
          : 'Private AI sends only your idea, included context, and selected options to the generation service.'}
      </p>
    </section>
  );
}
