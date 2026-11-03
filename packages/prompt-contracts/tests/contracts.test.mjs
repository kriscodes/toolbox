import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODEL_ID, MAX_CONTEXT_LENGTH, MAX_IDEA_LENGTH, MODELS, parseGenerationRequest, ValidationError } from '../src/index.ts';

const valid = { modelId: DEFAULT_MODEL_ID, idea: 'Build a timer', context: '', task: 'build', tone: 'clear', format: 'structured' };

// Both allowed models must accept the same shape and ignore untrusted extra settings.
test('normalizes text and projects only the allowed fields', () => {
  for (const model of MODELS) {
    assert.deepEqual(parseGenerationRequest({ ...valid, modelId: model.id, idea: '  Build a timer  ', context: '  React  ', max_output_tokens: 999999 }), { ...valid, modelId: model.id, context: 'React' });
  }
});

// A crafted client cannot choose a more expensive model or inject unsupported options.
test('rejects malformed payloads, unknown enums, and missing fields', () => {
  for (const value of [null, [], '', 10, {}, { ...valid, modelId: 'gpt-6-astra' }, { ...valid, task: 'anything' }, { ...valid, tone: 'anything' }, { ...valid, format: 'anything' }, { ...valid, context: null }, { ...valid, idea: '   ' }]) {
    assert.throws(() => parseGenerationRequest(value), ValidationError);
  }
});

// Bounds apply before trimming; otherwise whitespace could evade request limits.
test('enforces idea and context size limits at their boundaries', () => {
  assert.equal(parseGenerationRequest({ ...valid, idea: 'a'.repeat(MAX_IDEA_LENGTH), context: 'b'.repeat(MAX_CONTEXT_LENGTH) }).idea.length, MAX_IDEA_LENGTH);
  assert.throws(() => parseGenerationRequest({ ...valid, idea: 'a'.repeat(MAX_IDEA_LENGTH + 1) }), ValidationError);
  assert.throws(() => parseGenerationRequest({ ...valid, context: ' '.repeat(MAX_CONTEXT_LENGTH + 1) }), ValidationError);
});
