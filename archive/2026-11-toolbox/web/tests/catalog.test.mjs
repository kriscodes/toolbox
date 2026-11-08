import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, filterProjects, parsePinnedProjects, getSafeProjectUrl } from '../src/catalog.ts';

test('search combines terms, group, and pinned filters', () => {
  assert.deepEqual(filterProjects(PROJECTS, 'all', '  NAS HOME ', new Set()).map(p => p.id), ['cameras']);
  assert.equal(filterProjects(PROJECTS, 'Family', 'NAS', new Set()).length, 0);
  assert.deepEqual(filterProjects(PROJECTS, 'pinned', 'Life360', new Set(['family'])).map(p => p.id), ['family']);
  assert.equal(filterProjects(PROJECTS, 'pinned', '', new Set()).length, 0);
  assert.equal(filterProjects(PROJECTS, 'all', '   ', new Set()).length, 3);
});

test('saved pins recover from malformed data but respect intentionally empty pins', () => {
  for (const value of [null, '{broken', '{}', 'null', 'true']) assert.deepEqual([...parsePinnedProjects(value)], ['prompt']);
  assert.deepEqual([...parsePinnedProjects('[]')], []);
  assert.deepEqual([...parsePinnedProjects('["family","unknown",42,"family"]')], ['family']);
});

test('only known internal tools or real HTTPS destinations can become launch links', () => {
  for (const value of [undefined, '', '/not-published', 'javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com']) assert.equal(getSafeProjectUrl(value), null);
  assert.equal(getSafeProjectUrl('https://example.com/tool'), 'https://example.com/tool');
  assert.equal(getSafeProjectUrl('/tools/prompt-builder/'), '/tools/prompt-builder/');
  assert.equal(getSafeProjectUrl('//evil.example/tools/prompt-builder/'), null);
});
