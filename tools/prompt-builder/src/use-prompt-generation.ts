import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from 'react';
import { PromptApiError, requestPrompt } from './client';
import { buildFreePrompt } from './free-generator';
import { trackGenerationAttempt } from './analytics';
import { generationRequest } from './library';
import type { PromptLibrary } from './use-prompt-library';

/** Keep private access and cancellable generation separate from persistent editor state. */
export function usePromptGeneration(
  state: PromptLibrary,
  output: RefObject<HTMLTextAreaElement | null>,
) {
  const {
    library,
    libraryRef,
    mounted,
    draft,
    group,
    dirty,
    storageBlockedRef,
    confirmations,
    patchDraft,
    setNotice,
    setError,
  } = state;
  const [busy, setBusy] = useState(false);
  const [generationMode, setGenerationMode] = useState<'free' | 'ai'>('free');
  const [accessKey, setAccessKey] = useState('');
  const [accessOpen, setAccessOpen] = useState(false);
  const request = useRef<AbortController | null>(null);
  /** Cancel any pending network call when this React tool is unmounted by its shell. */
  function attachRequestCleanup(): () => void {
    /** Abort the current request so it cannot update an unmounted workbench. */
    function abortOnExit(): void {
      request.current?.abort();
    }
    return abortOnExit;
  }
  useEffect(attachRequestCleanup, []);

  /** Keep local templates available independently of private AI access. */
  function changeGenerationMode(event: ChangeEvent<HTMLSelectElement>): void {
    setGenerationMode(event.target.value as 'free' | 'ai');
    setError('');
    setNotice('');
  }

  /** Build locally by default, or replace output only after a successful private AI response. */
  async function generate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (request.current || busy || storageBlockedRef.current || !draft.idea.trim()) return;
    if (generationMode === 'ai' && !accessKey) {
      setAccessOpen(true);
      return;
    }
    if (
      draft.prompt.trim() &&
      dirty &&
      !(await confirmations.ask({
        kicker: 'Unsaved prompt',
        title: 'Build a new version?',
        description:
          'A successful generation will replace your current unsaved prompt. Keep editing if you want to save it first.',
        recordName: draft.name.trim() || 'Untitled prompt',
        recordMeta: `${group.name} · Unsaved changes`,
        confirmLabel: 'Build new version',
        cancelLabel: 'Keep editing',
      }))
    )
      return;
    if (generationMode === 'free') {
      try {
        const prompt = buildFreePrompt(generationRequest(library));
        patchDraft({ prompt, generatedModelId: null });
        setError('');
        setNotice('Free template ready. Edit it, copy it, or save it to this group.');
        output.current?.focus();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'The free template could not be built.');
        setNotice('');
      }
      return;
    }
    const snapshot = libraryRef.current;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    setNotice('Building your prompt…');
    // Include time for a sleeping free backend to wake up, while still giving requests a finite lifetime.
    const timeout = window.setTimeout(function expireRequest() {
      controller.abort(new Error('timeout'));
    }, 120_000);
    try {
      const apiUrl =
        import.meta.env?.VITE_PROMPT_API_URL ||
        (import.meta.env?.PROD ? 'https://toolbox-prompt-api.onrender.com' : '');
      trackGenerationAttempt();
      const response = await requestPrompt(
        generationRequest(library),
        accessKey,
        controller.signal,
        apiUrl,
      );
      if (controller.signal.aborted || !mounted.current) return;
      if (storageBlockedRef.current || libraryRef.current !== snapshot) {
        setNotice('The library changed during generation. Your previous prompt is unchanged.');
        return;
      }
      patchDraft({ prompt: response.prompt, generatedModelId: response.modelId });
      setNotice('Prompt ready. Edit it, copy it, or save it to this group.');
      output.current?.focus();
    } catch (error) {
      if (!mounted.current) return;
      if (controller.signal.aborted)
        setNotice(
          controller.signal.reason instanceof Error &&
            controller.signal.reason.message === 'timeout'
            ? 'Generation timed out. Your previous prompt is unchanged.'
            : 'Generation canceled. Your previous prompt is unchanged.',
        );
      else {
        if (error instanceof PromptApiError && error.code === 'unauthorized') {
          setAccessKey('');
          setAccessOpen(true);
        }
        setError(
          error instanceof PromptApiError
            ? error.message
            : 'Could not reach the prompt service. Check your connection and try again.',
        );
        setNotice('');
      }
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) request.current = null;
      if (mounted.current) setBusy(false);
    }
  }

  /** Stop waiting for the current generation without clearing the existing editor. */
  function cancelGeneration(): void {
    request.current?.abort();
  }

  /** Open AI access settings without making a generation request. */
  function showAccess(): void {
    setAccessOpen(true);
  }
  /** Close the AI access dialog while retaining the current editor. */
  function closeAccess(): void {
    setAccessOpen(false);
  }
  /** Keep the separate workbench key only in this mounted page's memory. */
  function unlockAccess(key: string): void {
    setAccessKey(key);
    setGenerationMode('ai');
    setNotice('Private AI unlocked for this visit.');
  }
  /** Forget the in-memory key immediately when the user locks AI generation. */
  function lockAccess(): void {
    setAccessKey('');
    setGenerationMode('free');
    setAccessOpen(false);
    setNotice('Private AI locked. The free template builder is ready.');
  }

  return {
    busy,
    generationMode,
    accessKey,
    accessOpen,
    showAccess,
    closeAccess,
    unlockAccess,
    lockAccess,
    changeGenerationMode,
    generate,
    cancelGeneration,
  };
}
export type PromptGeneration = ReturnType<typeof usePromptGeneration>;
