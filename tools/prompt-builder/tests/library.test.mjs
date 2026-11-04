import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MODEL_ID, MAX_CONTEXT_LENGTH } from '@toolbox/prompt-contracts';
import {
  createLibrary, createDraft, loadLibrary, parseLibrary, saveGroup, deleteGroup, saveDraft,
  deletePrompt, draftFromPrompt, isDraftDirty, generationRequest, importLibrary, serializeLibrary, serializedBytes, MAX_LIBRARY_BYTES,
} from '../src/library.ts';

/** Build a real saved entry so tests exercise the same persistence path as the editor. */
function savedLibrary() {
  const library = createLibrary();
  library.draft = { ...library.draft, name: 'A useful prompt', idea: 'Plan my app.', prompt: 'Help me plan an app.' };
  return saveDraft(library, 'prompt-one', '2026-11-02T12:00:00.000Z');
}

/** Simulate unknown JSON rather than sharing mutable objects between parsing tests. */
function copy(value) { return JSON.parse(JSON.stringify(value)); }

test('a first visit starts with familiar empty groups, no fabricated prompts, and the shared model', function firstVisit() {
  const { library, error, recovery } = loadLibrary(null);
  assert.deepEqual(library.groups.map(function groupName(group) { return group.name; }), ['Toolbox', 'Family Map', 'Home Cameras', 'Personal']);
  assert.equal(library.prompts.length, 0);
  assert.ok(library.groups.every(function emptyContext(group) { return group.context === ''; }));
  assert.equal(library.draft.modelId, DEFAULT_MODEL_ID);
  assert.equal(error, null); assert.equal(recovery, null);
});

// The default applies to new work without replacing the model chosen for a saved prompt.
test('new drafts use Luna while saved prompts retain their chosen model', function defaultAndSavedModels() {
  let library = createLibrary();
  assert.equal(generationRequest(library).modelId, 'gpt-6-luna');
  library.draft = { ...library.draft, name: 'Mini release prompt', idea: 'Deploy the existing changes.', prompt: 'Deploy the existing changes.', modelId: 'gpt-5.4-mini-2026-03-17' };
  library = saveDraft(library, 'mini-prompt', '2026-11-03T12:00:00.000Z');
  const restored = parseLibrary(JSON.parse(serializeLibrary(library)));
  assert.equal(draftFromPrompt(restored.prompts[0]).modelId, 'gpt-5.4-mini-2026-03-17');
  restored.draft = createDraft(restored.draft.groupId);
  assert.equal(generationRequest(restored).modelId, 'gpt-6-luna');
});

test('damaged or future-version storage is preserved verbatim for recovery', function recoveryData() {
  for (const raw of ['{broken json', '{"version":9000}', 'null']) {
    const loaded = loadLibrary(raw);
    assert.equal(loaded.recovery, raw);
    assert.ok(loaded.error);
    assert.equal(loaded.library.prompts.length, 0);
  }
});

test('backup validation rejects duplicate identities and broken group/draft references', function brokenReferences() {
  const valid = savedLibrary();
  const duplicate = copy(valid); duplicate.groups.push({ ...duplicate.groups[0] });
  assert.throws(function parseDuplicates() { parseLibrary(duplicate); }, /Duplicate group IDs/);
  const missingGroup = copy(valid); missingGroup.prompts[0].groupId = 'missing';
  assert.throws(function parseMissingGroup() { parseLibrary(missingGroup); }, /missing group/);
  const missingPrompt = copy(valid); missingPrompt.draft.savedId = 'missing';
  assert.throws(function parseMissingPrompt() { parseLibrary(missingPrompt); }, /missing saved prompt/);
  const wrongGroup = copy(valid); wrongGroup.draft.groupId = 'personal';
  assert.throws(function parseWrongGroup() { parseLibrary(wrongGroup); }, /missing saved prompt/);
});

test('backup validation bounds text and strips unrelated imported properties', function inputBoundaries() {
  const input = savedLibrary(); input.groups[0].context = 'x'.repeat(MAX_CONTEXT_LENGTH + 1);
  assert.throws(function parseOversizedContext() { parseLibrary(input); }, /oversized text/);
  const clean = savedLibrary(); clean.secret = 'not part of a library'; clean.groups[0].secret = 'not part of a group';
  const parsed = parseLibrary(clean);
  assert.equal(parsed.secret, undefined); assert.equal(parsed.groups[0].secret, undefined);
});

test('removed generation models fall back without altering saved prompt text or provenance', function retiredModels() {
  const old = savedLibrary(); old.prompts[0].modelId = 'retired-model'; old.prompts[0].generatedModelId = 'retired-model';
  old.draft.modelId = 'retired-model'; old.draft.generatedModelId = 'retired-model';
  const parsed = parseLibrary(old);
  assert.equal(parsed.prompts[0].modelId, DEFAULT_MODEL_ID);
  assert.equal(parsed.prompts[0].generatedModelId, 'retired-model');
  assert.equal(parsed.prompts[0].prompt, old.prompts[0].prompt);
});

test('saving, editing, reopening, and refreshing preserve prompt content and dirty state', function promptLifecycle() {
  let library = savedLibrary();
  assert.equal(isDraftDirty(library), false);
  library = parseLibrary(JSON.parse(serializeLibrary(library)));
  assert.equal(isDraftDirty(library), false, 'JSON field order must not make a saved prompt dirty');
  library = { ...library, draft: { ...library.draft, prompt: 'An edited prompt.' } };
  assert.equal(isDraftDirty(library), true);
  library = saveDraft(library, 'unused-id', '2026-11-02T13:00:00.000Z');
  assert.equal(library.prompts.length, 1); assert.equal(library.prompts[0].id, 'prompt-one');
  assert.equal(library.prompts[0].createdAt, '2026-11-02T12:00:00.000Z');
  assert.equal(library.prompts[0].updatedAt, '2026-11-02T13:00:00.000Z');
  assert.equal(draftFromPrompt(library.prompts[0]).prompt, 'An edited prompt.');
  assert.equal(isDraftDirty(library), false);
});

test('saving requires a name and body and never silently replaces a missing saved record', function saveRequirements() {
  const blank = createLibrary();
  assert.throws(function saveBlank() { saveDraft(blank, 'id', '2026-11-02'); }, /name/);
  blank.draft.name = 'Named';
  assert.throws(function saveEmptyBody() { saveDraft(blank, 'id', '2026-11-02'); }, /prompt text/);
  blank.draft.prompt = 'Text'; blank.draft.savedId = 'missing';
  assert.throws(function updateMissing() { saveDraft(blank, 'id', '2026-11-02'); }, /could not be found/);
});

test('group edits retain identity and reject duplicate names', function groupEditing() {
  let library = savedLibrary();
  library = saveGroup(library, 'toolbox', 'My toolbox', 'A private project context.');
  assert.equal(library.groups[0].id, 'toolbox');
  assert.equal(library.groups[0].name, 'My toolbox');
  assert.equal(library.prompts[0].groupId, 'toolbox');
  assert.throws(function duplicateGroupName() { saveGroup(library, 'new-id', 'MY TOOLBOX', ''); }, /already exists/);
  assert.throws(function emptyGroupName() { saveGroup(library, 'new-id', '   ', ''); }, /Invalid/);
});

test('confirmed group deletion cascades only within that group and prevents deleting the last group', function groupDeletion() {
  const original = savedLibrary();
  const removed = deleteGroup(original, 'toolbox');
  assert.equal(removed.groups.length, 3); assert.equal(removed.prompts.length, 0);
  assert.equal(removed.draft.groupId, 'family-map'); assert.equal(removed.draft.prompt, '');
  assert.equal(original.prompts.length, 1, 'domain mutations leave the previous snapshot intact');
  const single = { ...createLibrary(), groups: [{ id: 'toolbox', name: 'Toolbox', context: '' }] };
  assert.throws(function removeLastGroup() { deleteGroup(single, 'toolbox'); }, /at least one/);
});

test('prompt deletion resets its open draft and leaves unrelated groups untouched', function promptDeletion() {
  const library = savedLibrary();
  const removed = deletePrompt(library, 'prompt-one');
  assert.equal(removed.prompts.length, 0); assert.equal(removed.draft.savedId, null);
  assert.equal(removed.groups.length, 4); assert.equal(removed.draft.groupId, 'toolbox');
});

test('generation includes only the active group context when explicitly enabled', function includedContext() {
  let library = createLibrary();
  library = saveGroup(library, 'toolbox', 'Toolbox', 'Relevant context');
  library = saveGroup(library, 'personal', 'Personal', 'Unrelated private context');
  library.draft.idea = '  Plan a useful tool.  ';
  assert.deepEqual(generationRequest(library), { modelId: DEFAULT_MODEL_ID, idea: 'Plan a useful tool.', context: 'Relevant context', task: 'plan', tone: 'clear', format: 'structured' });
  library.draft.includeContext = false;
  assert.equal(generationRequest(library).context, '');
  assert.equal(library.groups[0].context, 'Relevant context', 'omitting context does not delete it');
});

test('backup import creates independent copies and restores the backed-up draft after confirmation', function backupMerge() {
  const original = savedLibrary();
  original.draft.idea = 'My current unsaved idea';
  const imported = savedLibrary();
  imported.draft.idea = 'An unfinished idea from the backup';
  imported.draft.prompt = 'An unfinished prompt edit from the backup';
  let nextId = 0;
  /** Supply stable unique IDs so reference remapping can be asserted. */
  function makeTestId() { nextId += 1; return `import-${nextId}`; }
  const merged = importLibrary(original, imported, makeTestId);
  assert.equal(merged.groups.length, 8); assert.equal(merged.prompts.length, 2);
  assert.equal(merged.groups[0].name, 'Toolbox'); assert.equal(merged.groups[4].name, 'Toolbox (imported)');
  assert.equal(merged.prompts[0].groupId, merged.groups[4].id);
  assert.notEqual(merged.prompts[0].id, original.prompts[0].id);
  assert.equal(merged.draft.idea, imported.draft.idea);
  assert.equal(merged.draft.prompt, imported.draft.prompt);
  assert.equal(merged.draft.savedId, merged.prompts[0].id);
  assert.equal(merged.draft.groupId, merged.groups[4].id);
  assert.equal(isDraftDirty(merged), true);
  assert.equal(original.draft.idea, 'My current unsaved idea');
  assert.equal(parseLibrary(merged).prompts.length, 2);
});

test('backup import restores an idea-only unsaved draft instead of silently dropping it', function restoreUnfinishedIdea() {
  const imported = createLibrary(); imported.draft.idea = 'An idea I have not generated yet';
  let id = 0;
  /** Produce deterministic IDs for the copied groups. */
  function makeTestId() { id += 1; return `idea-${id}`; }
  const restored = importLibrary(createLibrary(), imported, makeTestId);
  assert.equal(restored.draft.idea, imported.draft.idea);
  assert.equal(restored.draft.prompt, ''); assert.equal(restored.draft.savedId, null);
  assert.equal(restored.draft.groupId, restored.groups[4].id);
});

test('library capacity counts UTF-8 bytes consistently with imported files', function nonAsciiCapacity() {
  const library = createLibrary();
  for (let index = 0; index < 60; index += 1) library.groups.push({ id: `large-${index}`, name: `Large ${index}`, context: '界'.repeat(12_000) });
  const serialized = JSON.stringify(library);
  assert.ok(serialized.length < MAX_LIBRARY_BYTES, 'UTF-16 character count alone would incorrectly allow this library');
  assert.ok(serializedBytes(serialized) > MAX_LIBRARY_BYTES);
  assert.throws(function serializeOversized() { serializeLibrary(library); }, /library is full/);
  assert.equal(loadLibrary(serialized).recovery, serialized);
});

test('empty and selected new drafts are not dirty until actual content is entered', function draftProtection() {
  const library = createLibrary();
  library.draft = createDraft('personal');
  assert.equal(isDraftDirty(library), false);
  library.draft.idea = 'A new idea';
  assert.equal(isDraftDirty(library), true);
});
