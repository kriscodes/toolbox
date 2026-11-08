import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { auditPublicBuild } from './verify-public-build.mjs';

const ORIGIN = 'https://toolbox.kristiansalmeron.com/';
const HTML = `<!doctype html><html lang="en"><head>
<title>Toolbox — Kristian Salmeron</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Practical engineering utilities.">
<meta property="og:title" content="Toolbox — Kristian Salmeron">
<meta property="og:description" content="Practical engineering utilities.">
<meta property="og:type" content="website"><meta property="og:url" content="${ORIGIN}">
<meta property="og:image" content="${ORIGIN}social-preview.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${ORIGIN}social-preview.png">
<link rel="canonical" href="${ORIGIN}"><link rel="stylesheet" href="/assets/home.css">
<link rel="icon" href="/favicon.svg"><script type="module" src="/assets/home.js"></script>
</head><body><main><h1>Toolbox</h1><p>Useful software, carefully made.</p></main></body></html>`;

/** Create a disposable production-shaped output, independent of the site's implementation. */
async function fixture(t, changes = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'toolbox-public-audit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = {
    'index.html': HTML,
    'assets/home.css': '@font-face{font-family:Test;src:url("../fonts/test.woff2")}body{color:#222}',
    'assets/home.js': 'import"./theme.js";',
    'assets/theme.js': 'localStorage.setItem("toolbox.theme.v1","light");',
    'fonts/test.woff2': 'fixture font',
    'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    'social-preview.png': 'fixture image',
    'robots.txt': `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}sitemap.xml\n`,
    'sitemap.xml': `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${ORIGIN}</loc></url></urlset>`,
    ...changes,
  };
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    const path = join(directory, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  return directory;
}

test('accepts a complete public homepage and follows CSS font URLs relative to the stylesheet', async (t) => {
  const result = await auditPublicBuild({ directory: await fixture(t) });
  assert.deepEqual(result.errors, []);
  assert.equal(result.referenceCount, 6);
});

test('detects missing nested resources and social preview files', async (t) => {
  const result = await auditPublicBuild({ directory: await fixture(t, { 'fonts/test.woff2': null, 'social-preview.png': null, 'assets/theme.js': null }) });
  assert.ok(result.errors.some((error) => error.includes('../fonts/test.woff2')));
  assert.ok(result.errors.some((error) => error.includes('social-preview.png')));
  assert.ok(result.errors.some((error) => error.includes('./theme.js')));
});

test('rejects retired output even when it is unlinked or bundled under an opaque filename', async (t) => {
  const result = await auditPublicBuild({ directory: await fixture(t, {
    'tools/retired/index.html': '<h1>Old entry point</h1>',
    'assets/opaque.js': 'const key="toolbox.prompt-builder.library.v1";',
    'artwork/old.webp': 'old image',
    'archive/source.txt': 'source snapshot',
  }) });
  assert.ok(result.errors.some((error) => error.includes('tools/retired/index.html')));
  assert.ok(result.errors.some((error) => error.includes('assets/opaque.js')));
  assert.ok(result.errors.some((error) => error.includes('artwork/old.webp')));
  assert.ok(result.errors.some((error) => error.includes('archive/source.txt')));
});

test('rejects conflicting metadata, blocked indexing and storage deletion', async (t) => {
  const result = await auditPublicBuild({ directory: await fixture(t, {
    'index.html': HTML.replace('</head>', '<link rel="canonical" href="https://example.com/"><meta name="robots" content="noindex"></head>'),
    'robots.txt': `User-agent: *\nDisallow: /\nSitemap: ${ORIGIN}sitemap.xml\n`,
    'assets/home.js': 'localStorage.clear();',
  }) });
  assert.ok(result.errors.some((error) => error.includes('canonical URL')));
  assert.ok(result.errors.some((error) => error.includes('indexable')));
  assert.ok(result.errors.some((error) => error.includes('must not be blocked')));
  assert.ok(result.errors.some((error) => error.includes('destroy preserved user data')));
});

test('rejects a sitemap that publishes removed routes and a homepage requiring JavaScript for content', async (t) => {
  const result = await auditPublicBuild({ directory: await fixture(t, {
    'index.html': HTML.replace(/<main>[\s\S]*?<\/main>/u, '<div id="app"></div>'),
    'sitemap.xml': `<urlset><url><loc>${ORIGIN}</loc></url><url><loc>${ORIGIN}tools/retired/</loc></url></urlset>`,
  }) });
  assert.ok(result.errors.some((error) => error.includes('readable main content')));
  assert.ok(result.errors.some((error) => error.includes('page heading')));
  assert.ok(result.errors.some((error) => error.includes('only the canonical Toolbox homepage')));
});
