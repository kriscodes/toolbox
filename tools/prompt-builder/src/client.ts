import { MAX_PROMPT_LENGTH, MODELS, type GenerationRequest, type GenerationResponse } from '@toolbox/prompt-contracts';

/** Expose a safe API error code so the UI can distinguish expired access from other failures. */
export class PromptApiError extends Error {
  code: string;

  /** Preserve the server's safe message without retaining request bodies or credentials. */
  constructor(message: string, code = 'request_failed') {
    super(message);
    this.name = 'PromptApiError';
    this.code = code;
  }
}

/** Validate a backend reply before replacing an editable draft with its generated text. */
export function parseGenerationResponse(value: unknown): GenerationResponse {
  if (value === null || typeof value !== 'object') throw new PromptApiError('The server returned an unreadable prompt. Please try again.');
  const result = value as Record<string, unknown>;
  const model = MODELS.find(function findModel(model) { return model.id === result.modelId; });
  if (!model || typeof result.prompt !== 'string' || !result.prompt.trim() || result.prompt.length > MAX_PROMPT_LENGTH) throw new PromptApiError('The server returned an unreadable prompt. Please try again.');
  return { prompt: result.prompt, modelId: model.id };
}

/** Generate once through the authenticated backend; cancellation and failed replies leave the draft untouched. */
export async function requestPrompt(
  request: GenerationRequest,
  accessKey: string,
  signal: AbortSignal,
  baseUrl = '',
  fetcher: typeof fetch = fetch,
): Promise<GenerationResponse> {
  const response = await fetcher(`${baseUrl.replace(/\/$/u, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessKey}` },
    body: JSON.stringify(request),
    signal,
    credentials: 'omit',
    cache: 'no-store',
  });
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new PromptApiError('The prompt service is waking up or unavailable. Please try again shortly.'); }
  if (!response.ok) {
    // Only read the safe error envelope, never render an upstream response body as HTML.
    const error = data !== null && typeof data === 'object' ? (data as { error?: unknown }).error : null;
    const detail = error !== null && typeof error === 'object' ? error as Record<string, unknown> : {};
    const message = typeof detail.message === 'string' ? detail.message.slice(0, 500) : 'Prompt generation failed. Please try again.';
    throw new PromptApiError(message, response.status === 401 ? 'unauthorized' : typeof detail.code === 'string' ? detail.code : 'request_failed');
  }
  return parseGenerationResponse(data);
}
