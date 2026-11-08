import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { initializeAppearance, THEME_STORAGE_KEY } from '../src/theme.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu)]
  .filter((match) => !/\bsrc\s*=/u.test(match[1]))
  .map((match) => match[2]);
const LIBRARY_KEY = 'toolbox.prompt-builder.library.v1';
const PINNED_KEY = 'toolbox.pinned-projects.v1';

/** Models browser storage while recording every access, including unsuccessful attempts. */
function createStorage(entries = [], blocked = false) {
  const values = new Map(entries);
  const calls = [];
  return {
    values,
    calls,
    getItem(key) {
      calls.push(['get', key]);
      if (blocked) throw new Error('Browser storage is blocked.');
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      calls.push(['set', key, String(value)]);
      if (blocked) throw new Error('Browser storage is blocked.');
      values.set(key, String(value));
    },
    removeItem(key) {
      calls.push(['remove', key]);
      if (blocked) throw new Error('Browser storage is blocked.');
      values.delete(key);
    },
    clear() {
      calls.push(['clear']);
      if (blocked) throw new Error('Browser storage is blocked.');
      values.clear();
    },
  };
}

/** Creates the DOM and event boundaries used by the real bootstrap and appearance initializer. */
function createPage(storage) {
  const clickListeners = [];
  const storageListeners = [];
  const attributes = new Map([['aria-pressed', 'false']]);
  const button = {
    hidden: true,
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    addEventListener(type, listener) {
      assert.equal(type, 'click');
      clickListeners.push(listener);
    },
    click() { for (const listener of clickListeners) listener(); },
  };
  const status = { textContent: '' };
  const themeColor = { content: '#ffffff' };
  const document = {
    documentElement: { dataset: { theme: 'light' } },
    querySelector(selector) {
      if (selector === '.theme-toggle') return button;
      if (selector === '#appearance-status') return status;
      if (selector === 'meta[name="theme-color"]') return themeColor;
      throw new Error(`Unexpected DOM query: ${selector}`);
    },
  };
  const window = {
    addEventListener(type, listener) {
      assert.equal(type, 'storage');
      storageListeners.push(listener);
    },
    dispatchStorage(key, newValue) {
      // The browser dispatches these after another tab has changed storage.
      if (key === null) storage.values.clear();
      else if (newValue === null) storage.values.delete(key);
      else storage.values.set(key, newValue);
      for (const listener of storageListeners) listener({ key, newValue, storageArea: storage });
    },
  };
  return { document, window, button, status, themeColor, storage };
}

/** Runs delivered inline scripts before initializing the module, as a real page load would. */
function createSession(t) {
  const names = ['document', 'window', 'localStorage'];
  const originals = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  t.after(() => {
    for (const name of names) {
      const descriptor = originals.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return {
    open(storage, initialize = true) {
      const page = createPage(storage);
      for (const [name, value] of [['document', page.document], ['window', page.window], ['localStorage', storage]]) {
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
      }
      assert.ok(inlineScripts.length > 0, 'The delivered page must have its pre-paint appearance bootstrap.');
      for (const source of inlineScripts) {
        runInNewContext(source, { document: page.document, window: page.window, localStorage: storage }, {
          filename: 'toolbox-inline-bootstrap.js', timeout: 1000,
        });
      }
      if (initialize) initializeAppearance();
      return page;
    },
  };
}

/** Checks user-visible appearance together with the toggle's accessible state and browser chrome. */
function assertAppearance(page, theme) {
  assert.equal(page.document.documentElement.dataset.theme, theme);
  assert.equal(page.button.getAttribute('aria-pressed'), String(theme === 'dark'));
  assert.equal(page.themeColor.content, theme === 'dark' ? '#101113' : '#ffffff');
  assert.equal(page.button.hidden, false);
}

test('first visit defaults to light; toggles persist both choices across real bootstrap reloads', (t) => {
  const session = createSession(t);
  const storage = createStorage();
  const first = session.open(storage);
  assertAppearance(first, 'light');
  assert.equal(first.status.textContent, '');
  assert.deepEqual(storage.calls, [['get', THEME_STORAGE_KEY]], 'A first visit does not write a preference.');

  first.button.click();
  assertAppearance(first, 'dark');
  assert.equal(first.status.textContent, 'Dark appearance.');
  assert.equal(storage.values.get(THEME_STORAGE_KEY), 'dark');

  const reload = session.open(storage);
  assertAppearance(reload, 'dark');
  reload.button.click();
  assertAppearance(reload, 'light');
  assert.equal(reload.status.textContent, 'Light appearance.');
  assert.equal(storage.values.get(THEME_STORAGE_KEY), 'light');
  assertAppearance(session.open(storage), 'light');
});

test('saved dark appearance is applied by the delivered head script before controls initialize', (t) => {
  const session = createSession(t);
  const storage = createStorage([[THEME_STORAGE_KEY, 'dark']]);
  const page = session.open(storage, false);
  assert.equal(page.document.documentElement.dataset.theme, 'dark');
  assert.equal(page.themeColor.content, '#101113');
  assert.equal(page.button.hidden, true, 'The head script does not pretend that the controls are initialized.');
  assert.equal(page.status.textContent, '');
  initializeAppearance();
  assertAppearance(page, 'dark');
  assert.deepEqual(storage.calls, [['get', THEME_STORAGE_KEY]]);
});

test('cross-tab theme changes and preference removal synchronize without writing back', (t) => {
  const storage = createStorage();
  const page = createSession(t).open(storage);
  const callsAfterLoad = [...storage.calls];
  page.window.dispatchStorage(THEME_STORAGE_KEY, 'dark');
  assertAppearance(page, 'dark');
  page.window.dispatchStorage('unrelated.preference', 'light');
  assertAppearance(page, 'dark');
  page.window.dispatchStorage(THEME_STORAGE_KEY, null);
  assertAppearance(page, 'light');
  page.window.dispatchStorage(THEME_STORAGE_KEY, 'dark');
  assertAppearance(page, 'dark');
  page.window.dispatchStorage(null, null);
  assertAppearance(page, 'light');
  assert.deepEqual(storage.calls, callsAfterLoad, 'Receiving browser events does not read or rewrite storage.');
});

test('blocked browser storage keeps appearance usable and announces that changes last for this visit', (t) => {
  const originalLibrary = ' {broken library; preserve exactly} ';
  const storage = createStorage([[LIBRARY_KEY, originalLibrary]], true);
  const page = createSession(t).open(storage);
  assertAppearance(page, 'light');
  page.button.click();
  assertAppearance(page, 'dark');
  assert.equal(page.status.textContent, 'Dark appearance. Saved for this visit only.');
  page.button.click();
  assertAppearance(page, 'light');
  assert.equal(page.status.textContent, 'Light appearance. Saved for this visit only.');
  assert.equal(storage.values.get(LIBRARY_KEY), originalLibrary);
  assert.deepEqual(storage.calls, [
    ['get', THEME_STORAGE_KEY], ['set', THEME_STORAGE_KEY, 'dark'], ['set', THEME_STORAGE_KEY, 'light'],
  ]);
});

const validLibrary = ` \n${JSON.stringify({
  version: 1,
  groups: [{ id: 'existing', name: 'Existing personal context', context: 'Keep every character.\n' }],
  prompts: [],
  draft: {
    groupId: 'existing', savedId: null, name: '', idea: '', prompt: '', includeContext: true,
    modelId: 'gpt-6-luna', generatedModelId: null, task: 'plan', tone: 'clear', format: 'structured',
  },
})}\n`;

for (const fixture of [
  { name: 'valid library and malformed pins', library: validLibrary, pins: ' ["prompt", broken ' },
  { name: 'malformed library and valid pins', library: ' { "draft": }\u0000 recover-me ', pins: ' [ "prompt", "family", "cameras" ] \n' },
]) {
  test(`appearance never reads, overwrites, or removes archived data with ${fixture.name}`, (t) => {
    const session = createSession(t);
    const entries = [[LIBRARY_KEY, fixture.library], [PINNED_KEY, fixture.pins]];
    const storage = createStorage(entries);
    const page = session.open(storage);
    page.button.click();
    page.button.click();
    page.button.click();
    const reloaded = session.open(storage);
    assertAppearance(reloaded, 'dark');
    // Notifications about legacy data must not affect appearance or trigger a read of those keys.
    for (const listenerKey of [LIBRARY_KEY, PINNED_KEY]) {
      reloaded.window.dispatchStorage(listenerKey, storage.values.get(listenerKey));
    }
    assertAppearance(reloaded, 'dark');
    assert.deepEqual([...storage.values].filter(([key]) => key !== THEME_STORAGE_KEY), entries);
    assert.ok(storage.calls.every(([, key]) => key === THEME_STORAGE_KEY), 'Only the appearance preference may be accessed.');
    assert.ok(storage.calls.every(([operation]) => operation === 'get' || operation === 'set'), 'No browser data may be removed or cleared.');
  });
}
