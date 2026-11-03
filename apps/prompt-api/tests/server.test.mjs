import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { DEFAULT_MODEL_ID } from '@toolbox/prompt-contracts';
import { createPromptServer, MAX_BODY_BYTES } from '../src/server.ts';
import { GenerationError } from '../src/generator.ts';
import { readConfig } from '../src/config.ts';

const config = { apiKey: 'fake-server-secret', accessKey: 'test-access-key-at-least-24-characters', allowedOrigins: ['https://toolbox.example'], port: 3001 };
const input = { modelId: DEFAULT_MODEL_ID, idea: 'Build a timer', context: 'A focus tool', task: 'build', tone: 'clear', format: 'structured' };

/** Bind a real local HTTP server and guarantee cleanup even when an assertion fails. */
async function fixture(t, options = {}, overrides = {}) {
  const calls = [];
  const server = createPromptServer({ ...config, ...overrides }, {
    // Capture validated requests rather than making paid external calls.
    generate: async request => { calls.push(request); return { prompt: 'Create a timer.', modelId: request.modelId }; },
    ...options,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  // Close existing fetch keep-alive sockets so the test runner can exit promptly.
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base, calls };
}

/** Send a browser-shaped generation request, with overridable headers and body. */
async function post(base, overrides = {}) {
  return fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { Origin: config.allowedOrigins[0], Authorization: `Bearer ${config.accessKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    ...overrides,
  });
}

// The normal path exercises HTTP parsing, CORS, authentication, validation, and response shape.
test('authenticated generation returns the prompt and selected model with private-cache headers', async t => {
  const { base, calls } = await fixture(t);
  const response = await post(base);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), config.allowedOrigins[0]);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { prompt: 'Create a timer.', modelId: DEFAULT_MODEL_ID });
  assert.deepEqual(calls, [input]);
});

// An unconfigured deployment stays healthy while generation remains closed.
test('missing or short server access keys fail closed', async t => {
  for (const overrides of [{ accessKey: '' }, { accessKey: 'short' }, { apiKey: '' }]) {
    const { base, calls } = await fixture(t, {}, overrides);
    const health = await fetch(`${base}/api/health`);
    assert.deepEqual(await health.json(), { status: 'ok', configured: false });
    assert.equal((await post(base)).status, 503);
    assert.equal(calls.length, 0);
  }
});

// Cross-origin browser access and secret possession are independent requirements.
test('rejects missing/wrong credentials and disallowed origins before generation', async t => {
  const { base, calls } = await fixture(t);
  for (const key of ['', 'Bearer wrong', 'Basic abc']) {
    const response = await post(base, { headers: { Authorization: key, 'Content-Type': 'application/json' } });
    assert.equal(response.status, 401);
  }
  const forbidden = await post(base, { headers: { Origin: 'https://evil.example', Authorization: `Bearer ${config.accessKey}`, 'Content-Type': 'application/json' } });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get('access-control-allow-origin'), null);
  assert.equal(calls.length, 0);
});

// The browser can preflight only the expected POST endpoint and allowed origin.
test('handles CORS preflight and rejects unsupported routes and methods', async t => {
  const { base } = await fixture(t);
  const preflight = await fetch(`${base}/api/generate`, { method: 'OPTIONS', headers: { Origin: config.allowedOrigins[0], 'Access-Control-Request-Method': 'POST' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-headers'), 'Authorization, Content-Type');
  assert.equal((await fetch(`${base}/api/generate`)).status, 405);
  assert.equal((await fetch(`${base}/missing`)).status, 404);
});

// Every invalid input is rejected before the injected paid-generation boundary.
test('rejects malformed JSON, content types, excessive bodies, and arbitrary models', async t => {
  const { base, calls } = await fixture(t);
  assert.equal((await post(base, { body: '{broken' })).status, 400);
  assert.equal((await post(base, { headers: { Authorization: `Bearer ${config.accessKey}`, 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await post(base, { body: JSON.stringify({ ...input, modelId: 'expensive-model' }) })).status, 400);
  assert.equal((await post(base, { body: JSON.stringify({ ...input, context: 'x'.repeat(MAX_BODY_BYTES) }) })).status, 413);
  assert.equal(calls.length, 0);
});

// A sliding window bounds spending and then recovers without a process restart.
test('limits successful generation attempts and expires the short-term window', async t => {
  let now = 0;
  const { base, calls } = await fixture(t, { now: () => now, limits: { perMinute: 1 } });
  assert.equal((await post(base)).status, 200);
  const blocked = await post(base);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '60');
  assert.equal(calls.length, 1);
  now += 60_001;
  assert.equal((await post(base)).status, 200);
  assert.equal(calls.length, 2);
});

// Hourly limits remain effective when the smaller minute window has expired.
test('enforces the longer hourly generation window', async t => {
  let now = 0;
  const { base } = await fixture(t, { now: () => now, limits: { perHour: 1 } });
  assert.equal((await post(base)).status, 200);
  now += 61_000;
  const blocked = await post(base);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '3600');
});

// A slow provider cannot cause the app to launch an unbounded number of paid calls.
test('limits concurrent generations and releases capacity afterward', { timeout: 3000 }, async t => {
  let release;
  let signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const { base } = await fixture(t, {
    limits: { concurrent: 1 },
    // Hold the provider response until the capacity check has been exercised.
    generate: async request => {
      signalStarted();
      await new Promise(resolve => { release = resolve; });
      return { prompt: 'A finished prompt.', modelId: request.modelId };
    },
  });
  const pending = post(base);
  await started;
  try {
    const blocked = await post(base);
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error.code, 'generation_busy');
  } finally { release(); }
  assert.equal((await pending).status, 200);
});

// Browser cancellation propagates all the way to the provider request signal.
test('disconnecting a browser aborts its in-flight generation', { timeout: 3000 }, async t => {
  let signalStarted;
  let signalCancelled;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const cancelled = new Promise(resolve => { signalCancelled = resolve; });
  const { base } = await fixture(t, {
    // The fake provider reports when cancellation arrives from the HTTP layer.
    generate: async (request, signal) => {
      signalStarted();
      await new Promise(resolve => signal.addEventListener('abort', () => { signalCancelled(); resolve(); }, { once: true }));
      return { prompt: 'Unused prompt.', modelId: request.modelId };
    },
  });
  const controller = new AbortController();
  const pending = post(base, { signal: controller.signal });
  const rejection = assert.rejects(pending, { name: 'AbortError' });
  await started;
  controller.abort();
  await rejection;
  await cancelled;
});

// Generic unexpected errors do not disclose implementation details or credentials.
test('curates provider errors and hides unexpected internal errors', async t => {
  for (const [error, status, code] of [[new GenerationError('provider_busy', 'Try later.', 503), 503, 'provider_busy'], [new Error('SECRET DETAIL'), 500, 'internal_error']]) {
    const { base } = await fixture(t, { generate: async () => { throw error; } });
    const response = await post(base);
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.ok(!body.error.message.includes('SECRET'));
  }
});

// Configuration rejects wildcard origins and weak keys before the process listens.
test('validates server-only configuration without exposing secret values', () => {
  assert.equal(readConfig({}).port, 3001);
  assert.throws(() => readConfig({ PROMPT_BUILDER_ACCESS_KEY: 'short' }), /at least 24/);
  assert.throws(() => readConfig({ PORT: 'NaN' }), /PORT/);
  assert.throws(() => readConfig({ ALLOWED_ORIGINS: 'https://example.com/path' }), /exact HTTPS/);
  assert.throws(() => readConfig({ ALLOWED_ORIGINS: 'http://example.com' }), /exact HTTPS/);
  assert.deepEqual(readConfig({ ALLOWED_ORIGINS: 'http://127.0.0.1:5173,https://example.com' }).allowedOrigins, ['http://127.0.0.1:5173', 'https://example.com']);
});
