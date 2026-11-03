import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MODEL_ID, MAX_PROMPT_LENGTH } from '@toolbox/prompt-contracts';
import { PromptApiError, parseGenerationResponse, requestPrompt } from '../src/client.ts';

const request = { modelId: DEFAULT_MODEL_ID, idea: 'Plan a useful tool.', context: '', task: 'plan', tone: 'clear', format: 'structured' };

test('generation sends the selected model and context only to the authenticated backend', async function generationRequest() {
  let captured;
  /** Capture a request while simulating a complete successful API response. */
  async function fakeFetch(url, options) {
    captured = { url, options };
    return new Response(JSON.stringify({ prompt: 'A real returned prompt.', modelId: DEFAULT_MODEL_ID }), { status: 200 });
  }
  const result = await requestPrompt(request, 'a-private-workbench-access-key', new AbortController().signal, 'https://api.example.test/', fakeFetch);
  assert.equal(captured.url, 'https://api.example.test/api/generate');
  assert.equal(captured.options.headers.Authorization, 'Bearer a-private-workbench-access-key');
  assert.equal(captured.options.credentials, 'omit');
  assert.deepEqual(JSON.parse(captured.options.body), request);
  assert.equal(result.prompt, 'A real returned prompt.');
});

test('unauthorized access is distinguishable without exposing an arbitrary error body', async function accessFailure() {
  /** Return the backend's safe authentication error envelope. */
  async function unauthorized() { return new Response(JSON.stringify({ error: { code: 'bad_key', message: 'Unlock AI generation with your Workbench key.' } }), { status: 401 }); }
  await assert.rejects(requestPrompt(request, 'wrong', new AbortController().signal, '', unauthorized), function expectedError(error) {
    return error instanceof PromptApiError && error.code === 'unauthorized' && error.message.includes('Workbench key');
  });
});

test('HTML cold-start or proxy failures produce a readable error', async function invalidReply() {
  /** Mimic a proxy error page rather than a JSON response. */
  async function unavailable() { return new Response('<html>Unavailable</html>', { status: 503 }); }
  await assert.rejects(requestPrompt(request, 'key', new AbortController().signal, '', unavailable), /waking up or unavailable/);
});

test('canceling preserves the abort signal instead of converting it into generated output', async function cancellation() {
  const controller = new AbortController();
  controller.abort();
  /** Behave like fetch when invoked with a canceled request. */
  async function canceledFetch(_url, options) { options.signal.throwIfAborted(); }
  await assert.rejects(requestPrompt(request, 'key', controller.signal, '', canceledFetch), { name: 'AbortError' });
});

test('malformed, empty, oversized, or unknown-model replies never enter the editor', function responseValidation() {
  const invalid = [null, {}, { prompt: '', modelId: DEFAULT_MODEL_ID }, { prompt: 'x'.repeat(MAX_PROMPT_LENGTH + 1), modelId: DEFAULT_MODEL_ID }, { prompt: 'A prompt', modelId: 'expensive-unknown-model' }];
  for (const value of invalid) assert.throws(function validateBadReply() { parseGenerationResponse(value); }, /unreadable prompt/);
});
