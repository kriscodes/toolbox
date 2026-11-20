import type { ReactNode, ChangeEvent } from 'react';
import { MAX_IDEA_LENGTH, MODELS, TASKS, type GenerationRequest } from '@toolbox/prompt-contracts';
import type { Draft } from './library';
import { Icon } from './icon';
import type { PromptLibrary } from './use-prompt-library';
import type { PromptGeneration } from './use-prompt-generation';

/** Render draft inputs and generation controls without owning persistence or requests. */
export function PromptEditor({
  state,
  generation,
  editCurrentGroup,
}: {
  state: PromptLibrary;
  generation: PromptGeneration;
  editCurrentGroup: () => void;
}): ReactNode {
  const { draft, group, storageBlocked, patchDraft } = state;
  const { busy, generationMode, changeGenerationMode, generate, cancelGeneration } = generation;
  const selectedModel = MODELS.find(function chosenModel(model) {
    return model.id === draft.modelId;
  })!;
  /** Select a task preset without inserting fictional input or generating a paid request. */
  function selectTask(event: React.MouseEvent<HTMLButtonElement>): void {
    patchDraft({ task: event.currentTarget.dataset.task as GenerationRequest['task'] });
  }
  /** Preserve the user's natural-language idea as they edit it. */
  function changeIdea(event: ChangeEvent<HTMLTextAreaElement>): void {
    patchDraft({ idea: event.target.value });
  }
  /** Allow context to be omitted from the next request without deleting the saved project background. */
  function toggleContext(event: ChangeEvent<HTMLInputElement>): void {
    patchDraft({ includeContext: event.target.checked });
  }
  /** Choose only model IDs rendered from the shared server allowlist. */
  function changeModel(event: ChangeEvent<HTMLSelectElement>): void {
    patchDraft({ modelId: event.target.value as Draft['modelId'] });
  }
  /** Change the tone instruction sent with the next generation request. */
  function changeTone(event: ChangeEvent<HTMLSelectElement>): void {
    patchDraft({ tone: event.target.value as Draft['tone'] });
  }
  /** Change how the prompt builder structures its generated prompt. */
  function changeFormat(event: ChangeEvent<HTMLSelectElement>): void {
    patchDraft({ format: event.target.value as Draft['format'] });
  }

  /** Render a task preset from the same allowed values used by the server. */
  function renderTask(task: GenerationRequest['task']): ReactNode {
    return (
      <button
        type="button"
        key={task}
        data-task={task}
        aria-pressed={draft.task === task}
        onClick={selectTask}
      >
        {task.charAt(0).toUpperCase() + task.slice(1)}
      </button>
    );
  }
  /** Render the small shared model catalog without exposing an arbitrary model input. */
  function renderModel(model: (typeof MODELS)[number]): ReactNode {
    return (
      <option value={model.id} key={model.id}>
        {model.name} · {model.label}
      </option>
    );
  }

  return (
    <form className="pb-editor" onSubmit={generate}>
      <fieldset disabled={busy || storageBlocked} className="pb-fieldset">
        <legend className="pb-label">What are you working on?</legend>
        <div className="pb-presets" role="group" aria-label="Task preset">
          {TASKS.map(renderTask)}
        </div>
        <label className="pb-field" htmlFor="pb-idea">
          <span>Your idea</span>
          <textarea
            id="pb-idea"
            className="pb-input pb-goal"
            rows={5}
            value={draft.idea}
            onChange={changeIdea}
            required
            maxLength={MAX_IDEA_LENGTH}
            placeholder="What do you want ChatGPT to help you do?"
          />
        </label>
        <div className="pb-context">
          <div className="pb-context-bar">
            <Icon name="folder" />
            <span>Project context</span>
            <label className="pb-context-switch">
              <span>Include context</span>
              <input type="checkbox" checked={draft.includeContext} onChange={toggleContext} />
            </label>
          </div>
          <p className="pb-context-copy">
            {group.context || 'Add the background you want every prompt to remember.'}
          </p>
          <button
            className="pb-context-edit pb-text-button"
            type="button"
            onClick={editCurrentGroup}
          >
            {group.context ? 'Edit context' : 'Add context'}
          </button>
        </div>
        <details className="pb-details">
          <summary>
            Fine-tune <span aria-hidden="true">+</span>
          </summary>
          <div className="pb-options">
            <label className="pb-field">
              <span>Tone</span>
              <select className="pb-select" value={draft.tone} onChange={changeTone}>
                <option value="clear">Clear</option>
                <option value="friendly">Friendly</option>
                <option value="direct">Direct</option>
              </select>
            </label>
            <label className="pb-field">
              <span>Prompt format</span>
              <select className="pb-select" value={draft.format} onChange={changeFormat}>
                <option value="structured">Structured</option>
                <option value="concise">Concise</option>
                <option value="checklist">Checklist</option>
              </select>
            </label>
          </div>
        </details>
        <label className="pb-field pb-model">
          <span>Build with</span>
          <select
            className="pb-select"
            value={generationMode}
            onChange={changeGenerationMode}
            aria-describedby="pb-mode-help"
          >
            <option value="free">Free template · no key needed</option>
            <option value="ai">Private AI · access key required</option>
          </select>
          <small id="pb-mode-help">
            {generationMode === 'free'
              ? 'Formats your idea and context in this browser. No AI rewrite or generation request.'
              : 'AI rewrites your idea using the selected model. Requires the owner’s workbench key.'}
          </small>
        </label>
        {generationMode === 'ai' && (
          <label className="pb-field pb-model">
            <span>Generation model</span>
            <select
              className="pb-select"
              value={draft.modelId}
              onChange={changeModel}
              aria-describedby="pb-model-help"
            >
              {MODELS.map(renderModel)}
            </select>
            <small id="pb-model-help">{selectedModel.description}</small>
          </label>
        )}
        <button className="pb-primary pb-generate" type="submit" disabled={!draft.idea.trim()}>
          <Icon name="spark" />
          {busy
            ? 'Building prompt…'
            : generationMode === 'free'
              ? 'Build free prompt'
              : 'Build with private AI'}
        </button>
      </fieldset>
      {busy ? (
        <button className="pb-secondary pb-wide pb-cancel" type="button" onClick={cancelGeneration}>
          Cancel generation
        </button>
      ) : (
        <p className="pb-generation-note">A prompt you can take to ChatGPT.</p>
      )}
    </form>
  );
}
