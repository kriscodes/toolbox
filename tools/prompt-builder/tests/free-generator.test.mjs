import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MODEL_ID, FORMATS, MAX_CONTEXT_LENGTH, MAX_IDEA_LENGTH, MAX_PROMPT_LENGTH, TASKS, TONES } from '@toolbox/prompt-contracts';
import { buildFreePrompt } from '../src/free-generator.ts';
import { createLibrary, generationRequest } from '../src/library.ts';

const request = { modelId: DEFAULT_MODEL_ID, idea: 'Review every changed file, then report findings. Do not edit files or run tests.', context: 'This is an existing project. Future plans include adding a dashboard.', task: 'build', tone: 'clear', format: 'structured' };

test('free templates preserve explicit scope and context for every format without network access', (t) => {
  let networkCalls = 0;
  t.mock.method(globalThis, 'fetch', () => { networkCalls += 1; throw new Error('No provider access'); });
  for (const format of FORMATS) {
    const prompt = buildFreePrompt({ ...request, format });
    assert.ok(prompt.includes(request.idea));
    assert.ok(prompt.includes(request.context));
    assert.match(prompt, /do not add work they suggest/);
    assert.doesNotMatch(prompt, /gpt-|access.key|API.key/i);
  }
  assert.equal(networkCalls, 0);
});

test('the include-context choice is respected and unrelated groups never enter free output', () => {
  const library = createLibrary();
  library.draft.idea = 'Write a project introduction.';
  library.groups[0].context = 'Use our established public project name.';
  library.groups[1].context = 'Unrelated private project detail.';
  const included = buildFreePrompt(generationRequest(library));
  assert.match(included, /established public project name/);
  assert.doesNotMatch(included, /Unrelated private/);
  library.draft.includeContext = false;
  assert.doesNotMatch(buildFreePrompt(generationRequest(library)), /established public project name|Unrelated private/);
});

test('all supported task, tone, and format combinations retain maximum-size input within the output limit', () => {
  const idea = 'x'.repeat(MAX_IDEA_LENGTH);
  const context = 'y'.repeat(MAX_CONTEXT_LENGTH);
  for (const task of TASKS) for (const tone of TONES) for (const format of FORMATS) {
    const prompt = buildFreePrompt({ ...request, idea, context, task, tone, format });
    assert.ok(prompt.includes(idea));
    assert.ok(prompt.includes(context));
    assert.ok(prompt.length <= MAX_PROMPT_LENGTH);
  }
});

test('empty or oversized ideas are rejected without producing a replacement prompt', () => {
  for (const idea of [' ', 'x'.repeat(MAX_IDEA_LENGTH + 1)]) {
    assert.throws(() => buildFreePrompt({ ...request, idea }), /Your idea/);
  }
  assert.throws(() => buildFreePrompt({ ...request, context: 'x'.repeat(MAX_CONTEXT_LENGTH + 1) }), /Project context/);
});

test('tone and format choices produce distinct guidance without rewriting source text', () => {
  assert.match(buildFreePrompt({ ...request, tone: 'friendly' }), /warm, approachable/);
  assert.match(buildFreePrompt({ ...request, tone: 'direct' }), /direct and get to the point/);
  assert.match(buildFreePrompt({ ...request, format: 'structured' }), /^## Request/);
  assert.match(buildFreePrompt({ ...request, format: 'checklist' }), /- \[ \]/);
  assert.ok(buildFreePrompt({ ...request, format: 'concise' }).startsWith(request.idea));
});
