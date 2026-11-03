import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODEL_ID, MAX_PROMPT_LENGTH } from '@toolbox/prompt-contracts';
import { generatePrompt, extractPrompt, GenerationError, MAX_OUTPUT_TOKENS } from '../src/generator.ts';

const input = { modelId: DEFAULT_MODEL_ID, idea: 'Build a family app', context: 'Use a calm interface.', task: 'build', tone: 'clear', format: 'structured' };

/** Produce a realistic completed Responses payload for deterministic tests. */
function completed(text = 'Create a plan for my family app.') {
  return { status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }] };
}

// Request inspection proves private server credentials, bounds, and chosen model reach the provider.
test('generation makes one bounded provider call and returns only the finished prompt', async () => {
  let calls = 0;
  const result = await generatePrompt(input, {
    apiKey: 'server-secret',
    // The fake provider inspects the actual outbound payload without using API credits.
    fetcher: async (url, options) => {
      calls += 1;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.headers.Authorization, 'Bearer server-secret');
      const payload = JSON.parse(options.body);
      assert.equal(payload.model, DEFAULT_MODEL_ID);
      assert.equal(payload.store, false);
      assert.deepEqual(payload.reasoning, { effort: 'none' });
      assert.equal(payload.max_output_tokens, MAX_OUTPUT_TOKENS);
      assert.match(payload.instructions, /do not answer or carry out/);
      assert.deepEqual(JSON.parse(payload.input), { idea: input.idea, context: input.context, task: input.task, tone: input.tone, format: input.format });
      return Response.json(completed());
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { prompt: 'Create a plan for my family app.', modelId: DEFAULT_MODEL_ID });
});

// Partial output should never silently replace a complete editable draft.
test('rejects incomplete, empty, oversized, and refusal responses', () => {
  const invalid = [null, {}, { ...completed(), status: 'incomplete' }, completed(''), completed('a'.repeat(MAX_PROMPT_LENGTH + 1)), { status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'Sensitive provider detail' }] }] }];
  for (const value of invalid) assert.throws(() => extractPrompt(value), GenerationError);
});

// Refusal text and provider error bodies must never be returned to the browser.
test('maps provider failures to curated errors without automatic retries', async () => {
  for (const [status, code] of [[401, 'provider_configuration'], [403, 'provider_configuration'], [429, 'provider_busy'], [500, 'provider_error']]) {
    let calls = 0;
    await assert.rejects(generatePrompt(input, {
      apiKey: 'secret',
      // Count calls so retry behavior cannot unexpectedly multiply spend.
      fetcher: async () => { calls += 1; return new Response('SECRET-UPSTREAM-DETAIL', { status }); },
    }), error => error.code === code && !error.message.includes('SECRET'));
    assert.equal(calls, 1);
  }
});

// Parsing and network errors get the same safe treatment as upstream HTTP failures.
test('maps broken responses and network failures without exposing details', async () => {
  for (const fetcher of [async () => new Response('invalid-json'), async () => { throw new Error('PRIVATE NETWORK DETAIL'); }]) {
    await assert.rejects(generatePrompt(input, { apiKey: 'secret', fetcher }), { code: 'provider_unavailable' });
  }
});

// Cancellation is forwarded upstream instead of leaving an unwanted request running.
test('passes cancellation to the upstream request', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(generatePrompt(input, {
    apiKey: 'secret',
    // Abort-aware provider substitute mirrors fetch behavior.
    fetcher: async (_url, options) => { options.signal.throwIfAborted(); return Response.json(completed()); },
  }, controller.signal), { code: 'generation_timeout' });
});

// A short injectable timeout proves timeout handling without slowing down the suite.
test('times out a stalled provider', async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(generatePrompt(input, {
      apiKey: 'secret', timeoutMs: 10,
      // Reject when the generated timeout signal fires, as native fetch would.
      fetcher: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })),
    }), { code: 'generation_timeout' });
  } finally { clearTimeout(keepAlive); }
});
