import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ORIGIN = 'https://toolbox.kristiansalmeron.com/';
const RETIRED_CONTENT = /prompt[\s_-]*builder|family[\s_-]*map|home[\s_-]*cameras|toolbox\.pinned-projects\.v1|toolbox\.prompt-builder\.library\.v1|toolbox-prompt-api|OPENAI_API_KEY|PROMPT_BUILDER_ACCESS_KEY|VITE_PROMPT_API_URL|api\.openai\.com|\/api\/(?:generate|health)/iu;
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.xml', '.txt', '.map']);

/** Decode the entities that may occur in generated metadata and resource attributes. */
function decodeEntities(value) {
  return value.replace(/&(?:#(x[\da-f]+|\d+)|(amp|quot|apos|lt|gt));/giu, (match, number, name) => {
    if (number) {
      const point = number.toLowerCase().startsWith('x') ? Number.parseInt(number.slice(1), 16) : Number(number);
      return point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[name.toLowerCase()];
  });
}

/** Read attributes independently of their order, quote style, or generated whitespace. */
function parseTags(html) {
  const tags = [];
  const markup = html.replace(/<!--[\s\S]*?-->/gu, '');
  const tagPattern = /<([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/giu;
  for (const match of markup.matchAll(tagPattern)) {
    const attributes = {};
    const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gu;
    for (const attribute of match[2].matchAll(attributePattern)) {
      attributes[attribute[1].toLowerCase()] = decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
    }
    tags.push({ name: match[1].toLowerCase(), attributes });
  }
  return tags;
}

/** List every deployable file; reject links that could publish files outside the build. */
async function collectFiles(directory, errors, root = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) errors.push(`${relative(root, path)}: symbolic links are not allowed in the public build`);
    else if (entry.isDirectory()) files.push(...await collectFiles(path, errors, root));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

/** Audit the real publish directory without contacting services or reading browser data. */
export async function auditPublicBuild({ directory, origin = DEFAULT_ORIGIN }) {
  const root = resolve(directory);
  const canonical = new URL('/', origin).href;
  const errors = [];
  let files;
  try { files = await collectFiles(root, errors); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { errors: [`${root}: build directory does not exist; build the site first`], fileCount: 0, referenceCount: 0 };
  }
  const names = new Set(files.map((path) => relative(root, path).split(sep).join('/')));
  const texts = new Map();
  const references = new Set();
  for (const path of files) {
    const name = relative(root, path).split(sep).join('/');
    if (/(?:^|\/)archive(?:\/|$)|(?:^|\/)artwork(?:\/|$)/iu.test(name) || RETIRED_CONTENT.test(name)) {
      errors.push(`${name}: archived project material must not be published`);
    }
    if (extname(name).toLowerCase() === '.html' && name !== 'index.html') {
      errors.push(`${name}: the current release must publish only the Toolbox homepage`);
    }
    if (!TEXT_EXTENSIONS.has(extname(name).toLowerCase())) continue;
    const content = await readFile(path, 'utf8');
    texts.set(name, content);
    const retired = content.match(RETIRED_CONTENT);
    if (retired) errors.push(`${name}: contains retired project or API content (${retired[0]})`);
    if (/\b(?:localStorage|sessionStorage)\s*(?:\?\.|\.)\s*clear\s*\(/u.test(content)) {
      errors.push(`${name}: clearing browser storage would destroy preserved user data`);
    }
  }

  /** Resolve local resource URLs against the document that actually loads them. */
  function verifyReference(value, source, { requiredLocal = false } = {}) {
    if (!value || value.startsWith('#') || value.startsWith('data:')) return;
    let url;
    try { url = new URL(value, new URL(source, canonical)); }
    catch { errors.push(`${source}: invalid resource URL ${value}`); return; }
    if (url.origin !== new URL(canonical).origin) {
      if (requiredLocal) errors.push(`${source}: required resource must use the canonical site origin (${value})`);
      return;
    }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { errors.push(`${source}: invalid URL encoding ${value}`); return; }
    const target = resolve(root, `.${pathname}`);
    const name = relative(root, target).split(sep).join('/');
    if (name.startsWith('../') || name === '..' || !names.has(name)) {
      errors.push(`${source}: missing public resource ${value}`);
    } else references.add(name);
  }

  const html = texts.get('index.html');
  if (!html) errors.push('index.html: homepage is missing');
  else {
    const tags = parseTags(html);
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/iu)?.[1];
    if (decodeEntities(title?.trim() ?? '') !== 'Toolbox — Kristian Salmeron') errors.push('index.html: expected a meaningful Toolbox page title');
    const language = tags.find((tag) => tag.name === 'html')?.attributes.lang;
    if (!language) errors.push('index.html: document language is missing');
    if (!tags.some((tag) => tag.name === 'main')) errors.push('index.html: readable main content must be present before JavaScript runs');
    if (!/<h1\b[^>]*>\s*\S/iu.test(html)) errors.push('index.html: a server-delivered page heading is missing');

    /** Require one unambiguous metadata value rather than accepting conflicting declarations. */
    function metadata(name) {
      const matches = tags.filter((tag) => tag.name === 'meta' && (tag.attributes.name ?? tag.attributes.property)?.toLowerCase() === name);
      if (matches.length !== 1 || !matches[0].attributes.content?.trim()) {
        errors.push(`index.html: expected one nonempty ${name} metadata value`);
        return '';
      }
      return matches[0].attributes.content;
    }

    const links = tags.filter((tag) => tag.name === 'link' && tag.attributes.rel?.toLowerCase().split(/\s+/u).includes('canonical'));
    if (links.length !== 1 || links[0].attributes.href !== canonical) errors.push(`index.html: canonical URL must be ${canonical}`);
    metadata('description');
    metadata('viewport');
    metadata('og:title');
    metadata('og:description');
    if (metadata('og:type') !== 'website') errors.push('index.html: og:type must describe a website');
    if (metadata('og:url') !== canonical) errors.push('index.html: og:url must match the canonical URL');
    const socialImage = metadata('og:image');
    if (socialImage) verifyReference(socialImage, 'index.html', { requiredLocal: true });
    if (metadata('twitter:card') !== 'summary_large_image') errors.push('index.html: Twitter sharing must use summary_large_image');
    const twitterImage = metadata('twitter:image');
    if (twitterImage) verifyReference(twitterImage, 'index.html', { requiredLocal: true });
    for (const tag of tags) {
      const attributes = tag.attributes;
      if (tag.name === 'meta' && /^(?:robots|googlebot)$/iu.test(attributes.name ?? '') && /(?:noindex|none)/iu.test(attributes.content ?? '')) {
        errors.push('index.html: public homepage must remain indexable');
      }
      if (attributes.src) verifyReference(attributes.src, 'index.html');
      if (attributes.poster) verifyReference(attributes.poster, 'index.html');
      if (tag.name === 'link' && /(?:^|\s)(?:stylesheet|icon|preload|modulepreload)(?:\s|$)/iu.test(attributes.rel ?? '')) {
        verifyReference(attributes.href, 'index.html');
      }
      if (attributes.srcset && !attributes.srcset.startsWith('data:')) {
        for (const item of attributes.srcset.split(',')) verifyReference(item.trim().split(/\s+/u)[0], 'index.html');
      }
    }
  }

  for (const [name, content] of texts) {
    if (name.endsWith('.css')) {
      for (const match of content.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/giu)) {
        verifyReference(match[1] ?? match[2] ?? match[3], name);
      }
      for (const match of content.matchAll(/@import\s+["']([^"']+)["']/giu)) verifyReference(match[1], name);
    }
    if (/\.m?js$/u.test(name)) {
      for (const match of content.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)["']((?:\.{1,2}\/|\/)[^"']+)["']/gu)) {
        verifyReference(match[1], name);
      }
    }
  }

  const sitemap = texts.get('sitemap.xml');
  if (!sitemap) errors.push('sitemap.xml: sitemap is missing');
  else {
    const locations = [...sitemap.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/giu)].map((match) => decodeEntities(match[1]));
    if (locations.length !== 1 || locations[0] !== canonical) errors.push('sitemap.xml: only the canonical Toolbox homepage should be listed');
  }
  const robots = texts.get('robots.txt');
  if (!robots) errors.push('robots.txt: crawler instructions are missing');
  else {
    if (!/^User-agent:\s*\*\s*$/imu.test(robots)) errors.push('robots.txt: expected instructions for public crawlers');
    if (/^Disallow:\s*\/\s*$/imu.test(robots)) errors.push('robots.txt: public homepage must not be blocked');
    if (![...robots.matchAll(/^Sitemap:\s*(\S+)\s*$/gimu)].some((match) => match[1] === new URL('sitemap.xml', canonical).href)) {
      errors.push('robots.txt: canonical sitemap reference is missing');
    }
  }
  return { errors, fileCount: files.length, referenceCount: references.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
  const result = await auditPublicBuild({ directory });
  if (result.errors.length) {
    console.error(`Public build audit failed:\n${result.errors.map((error) => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
  } else console.log(`Public build audit passed: ${result.fileCount} files, ${result.referenceCount} local resources, no archived projects.`);
}
