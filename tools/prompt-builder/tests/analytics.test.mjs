import assert from 'node:assert/strict';
import test from 'node:test';
import { trackGenerationAttempt } from '../src/analytics.ts';

/** Install only the optional measurement boundary, without exposing any editor or storage values. */
function withBrowser(t, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else delete globalThis.window;
  });
}

test('generation measurement sends a fixed attempt with no user content', (t) => {
  const sent = [];
  withBrowser(t, { StudioInsights: { track: (...args) => sent.push(args) } });
  trackGenerationAttempt();
  assert.deepEqual(sent, [['tool_action', { content: 'prompt-builder', action: 'generate' }]]);
});

test('missing or failed analytics cannot interrupt generation', (t) => {
  withBrowser(t, {});
  assert.doesNotThrow(trackGenerationAttempt);
  window.StudioInsights = {
    track() {
      throw new Error('blocked');
    },
  };
  assert.doesNotThrow(trackGenerationAttempt);
});
