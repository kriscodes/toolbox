import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement, StrictMode, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createLibrary, STORAGE_KEY } from '../src/library.ts';
import { usePromptLibrary } from '../src/use-prompt-library.ts';
import { usePromptGeneration } from '../src/use-prompt-generation.ts';
import { useLibraryActions } from '../src/use-library-actions.ts';
import { useLibraryBackups } from '../src/use-library-backups.ts';

const formEvent = { preventDefault() {} };
const confirmationOptions = {
  kicker: 'Unsaved draft',
  title: 'Replace this draft?',
  description: 'Continuing discards your draft.',
  recordName: 'Current work',
  recordMeta: 'Unsaved changes',
  confirmLabel: 'Continue',
  cancelLabel: 'Keep editing',
};

/** Control completion order without depending on elapsed time or a live service. */
function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

/** Mount the same hooks used by the view against a fresh, isolated browser store. */
async function mountWorkbench(t, { raw = null, strict = false } = {}) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://toolbox.example/',
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map();
  for (const [name, value] of Object.entries(globals)) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  if (raw !== null) localStorage.setItem(STORAGE_KEY, raw);
  const root = createRoot(document.getElementById('root'));
  let current;
  let active = true;
  function Harness() {
    const library = usePromptLibrary();
    const output = useRef(null);
    const generation = usePromptGeneration(library, output);
    const actions = useLibraryActions(library, generation.busy);
    const backups = useLibraryBackups(library);
    current = { library, generation, actions, backups };
    return null;
  }
  async function unmount() {
    if (!active) return;
    active = false;
    await act(async () => root.unmount());
  }
  t.after(async () => {
    await unmount();
    dom.window.close();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  await act(async () => {
    root.render(
      strict ? createElement(StrictMode, null, createElement(Harness)) : createElement(Harness),
    );
  });
  return {
    get current() {
      return current;
    },
    dom,
    unmount,
  };
}

/** Simulate the file picker while allowing its asynchronous text read to finish later. */
function importEvent(text) {
  return {
    target: {
      value: 'backup.json',
      files: [{ name: 'backup.json', size: 1000, text }],
    },
  };
}

test('a cross-tab conflict during AI generation preserves the previous prompt and stored library', async (t) => {
  const app = await mountWorkbench(t);
  const response = deferred();
  const fetcher = t.mock.method(globalThis, 'fetch', () => response.promise);
  await act(async () =>
    app.current.library.patchDraft({
      idea: 'Plan a release',
      name: 'Release',
      prompt: 'Original prompt',
    }),
  );
  await act(async () => app.current.actions.saveCurrentPrompt());
  await act(async () => app.current.generation.unlockAccess('test-workbench-access-key'));
  const original = app.current.library.library;
  let generation;
  await act(async () => {
    generation = app.current.generation.generate(formEvent);
  });
  assert.equal(fetcher.mock.callCount(), 1);
  assert.equal(app.current.generation.busy, true);

  const otherTab = JSON.stringify({
    ...original,
    draft: { ...original.draft, prompt: 'Other tab work' },
  });
  await act(async () => {
    localStorage.setItem(STORAGE_KEY, otherTab);
    window.dispatchEvent(
      new app.dom.window.StorageEvent('storage', { key: STORAGE_KEY, newValue: otherTab }),
    );
    response.resolve(
      new Response(JSON.stringify({ prompt: 'Late AI output', modelId: original.draft.modelId }), {
        status: 200,
      }),
    );
    await generation;
  });
  assert.equal(app.current.library.library, original);
  assert.equal(app.current.library.draft.prompt, 'Original prompt');
  assert.equal(localStorage.getItem(STORAGE_KEY), otherTab);
  assert.equal(app.current.library.storageBlocked, true);
  assert.equal(app.current.generation.busy, false);
  assert.match(app.current.library.visibleNotice, /library changed during generation/i);
});

test('an import merges against edits made during file reading and rejects a later stale approval', async (t) => {
  const app = await mountWorkbench(t);
  const backup = createLibrary();
  backup.draft.idea = 'An unfinished imported idea';
  const read = deferred();
  let importing;
  await act(async () => {
    importing = app.current.backups.importBackup(importEvent(() => read.promise));
  });
  await act(async () =>
    app.current.actions.commitGroup('toolbox', 'Toolbox', 'Latest local context'),
  );
  await act(async () => {
    read.resolve(JSON.stringify(backup));
  });
  assert.equal(app.current.library.confirmation?.options.title, 'Import this backup?');
  await act(async () => {
    app.current.library.confirmations.resolve(true);
    await importing;
  });
  assert.equal(
    app.current.library.library.groups.find((group) => group.id === 'toolbox').context,
    'Latest local context',
  );
  assert.equal(app.current.library.library.groups.length, 8);
  assert.equal(app.current.library.draft.idea, backup.draft.idea);

  await act(async () => {
    importing = app.current.backups.importBackup(importEvent(async () => JSON.stringify(backup)));
  });
  assert.ok(app.current.library.confirmation);
  await act(async () => {
    app.current.library.patchDraft({ idea: 'Newer work after the dialog opened' });
    app.current.library.confirmations.resolve(true);
    await importing;
  });
  assert.equal(app.current.library.confirmation, null);
  assert.equal(
    app.current.library.library.groups.length,
    8,
    'stale approval must not import another copy',
  );
  assert.equal(app.current.library.draft.idea, 'Newer work after the dialog opened');
});

test('StrictMode keeps confirmations usable and unmount rejects an outstanding destructive decision', async (t) => {
  const app = await mountWorkbench(t, { strict: true });
  let answer;
  await act(async () => {
    answer = app.current.library.confirmations.ask(confirmationOptions);
  });
  assert.ok(app.current.library.confirmation);
  await act(async () => app.current.library.confirmations.resolve(true));
  assert.equal(await answer, true);

  await act(async () => app.current.library.patchDraft({ idea: 'Keep this unfinished work' }));
  const stored = localStorage.getItem(STORAGE_KEY);
  let replacement;
  await act(async () => {
    replacement = app.current.actions.newPrompt();
  });
  assert.equal(app.current.library.confirmation?.options.title, 'Replace this draft?');
  await app.unmount();
  await replacement;
  assert.equal(localStorage.getItem(STORAGE_KEY), stored);
  assert.equal(app.current.library.libraryRef.current.draft.idea, 'Keep this unfinished work');
});

test('damaged storage remains untouched until a reset is explicitly confirmed', async (t) => {
  const raw = '{unreadable original data';
  const app = await mountWorkbench(t, { raw });
  assert.equal(app.current.library.recovery, raw);
  assert.equal(app.current.library.storageBlocked, true);
  await act(async () => app.current.library.patchDraft({ idea: 'Must not replace recovery' }));
  assert.equal(app.current.library.draft.idea, '');
  assert.equal(localStorage.getItem(STORAGE_KEY), raw);

  let reset;
  await act(async () => {
    reset = app.current.backups.resetLibrary();
  });
  await act(async () => {
    app.current.library.confirmations.resolve(false);
    await reset;
  });
  assert.equal(localStorage.getItem(STORAGE_KEY), raw);
  await act(async () => {
    reset = app.current.backups.resetLibrary();
  });
  await act(async () => {
    app.current.library.confirmations.resolve(true);
    await reset;
  });
  assert.equal(app.current.library.recovery, null);
  assert.equal(app.current.library.storageBlocked, false);
  assert.equal(app.current.library.savingPaused, false);
  assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_KEY)), createLibrary());
});

test('quota failure retains editable work and suppresses a misleading saved notice', async (t) => {
  const app = await mountWorkbench(t);
  const persisted = localStorage.getItem(STORAGE_KEY);
  const write = t.mock.method(app.dom.window.Storage.prototype, 'setItem', () => {
    throw new app.dom.window.DOMException('Storage full', 'QuotaExceededError');
  });
  await act(async () =>
    app.current.library.patchDraft({
      idea: 'Plan a release',
      name: 'Release',
      prompt: 'Unsynced prompt',
    }),
  );
  await act(async () => app.current.actions.saveCurrentPrompt());
  assert.equal(app.current.library.draft.prompt, 'Unsynced prompt');
  assert.equal(app.current.library.library.prompts[0].prompt, 'Unsynced prompt');
  assert.equal(app.current.library.savingPaused, true);
  assert.match(app.current.library.storageError, /could not be saved/i);
  assert.equal(app.current.library.visibleNotice, '');
  assert.equal(localStorage.getItem(STORAGE_KEY), persisted);

  write.mock.restore();
  await act(async () => app.current.library.patchDraft({ prompt: 'Retry after freeing storage' }));
  assert.equal(app.current.library.savingPaused, false);
  assert.equal(
    JSON.parse(localStorage.getItem(STORAGE_KEY)).draft.prompt,
    'Retry after freeing storage',
  );
});

test('free generation stays offline and its edited result survives save and reopen', async (t) => {
  const app = await mountWorkbench(t);
  const fetcher = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Unexpected network request');
  });
  await act(async () =>
    app.current.library.patchDraft({
      idea: 'Plan a release with a rollback checklist',
      name: 'Release plan',
    }),
  );
  await act(async () => app.current.generation.generate(formEvent));
  assert.match(app.current.library.draft.prompt, /rollback checklist/);
  assert.equal(app.current.library.draft.generatedModelId, null);
  await act(async () =>
    app.current.library.patchDraft({
      prompt: `${app.current.library.draft.prompt}\nMy final edit.`,
    }),
  );
  await act(async () => app.current.actions.saveCurrentPrompt());
  const saved = app.current.library.library.prompts[0];
  assert.equal(app.current.library.dirty, false);
  await act(async () => app.current.actions.newPrompt());
  assert.equal(app.current.library.draft.prompt, '');
  await act(async () =>
    app.current.actions.openSaved({ currentTarget: { dataset: { promptId: saved.id } } }),
  );
  assert.equal(app.current.library.draft.prompt, saved.prompt);
  assert.match(app.current.library.draft.prompt, /My final edit\.$/);
  assert.equal(app.current.library.dirty, false);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).draft.savedId, saved.id);
  assert.equal(fetcher.mock.callCount(), 0);
});

test('unmount aborts a pending AI request and ignores even a late successful response', async (t) => {
  const app = await mountWorkbench(t);
  const response = deferred();
  let signal;
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    signal = options.signal;
    return response.promise;
  });
  await act(async () => app.current.library.patchDraft({ idea: 'Plan a release' }));
  await act(async () => app.current.generation.unlockAccess('test-workbench-access-key'));
  const stored = localStorage.getItem(STORAGE_KEY);
  let generation;
  await act(async () => {
    generation = app.current.generation.generate(formEvent);
  });
  assert.equal(signal.aborted, false);
  await app.unmount();
  assert.equal(signal.aborted, true);
  response.resolve(
    new Response(
      JSON.stringify({ prompt: 'Late result', modelId: app.current.library.draft.modelId }),
      { status: 200 },
    ),
  );
  await generation;
  assert.equal(app.current.library.libraryRef.current.draft.prompt, '');
  assert.equal(localStorage.getItem(STORAGE_KEY), stored);
  assert.equal(stored.includes('test-workbench-access-key'), false);
});
