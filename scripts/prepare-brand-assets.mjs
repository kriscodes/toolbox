import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Escape checkout paths before placing them in a process-local Fontconfig document. */
function escapeXml(value) {
  return value.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

// Use the committed fonts and an ignored, writable cache instead of relying on host fonts.
const cache = fileURLToPath(new URL('../node_modules/.cache/toolbox-brand/', import.meta.url));
const fonts = fileURLToPath(new URL('../apps/toolbox/public/fonts/', import.meta.url));
const configuration = `${cache}fonts.conf`;
await mkdir(cache, { recursive: true });
await writeFile(configuration, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>${escapeXml(fonts)}</dir><cachedir>${escapeXml(cache)}</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE = configuration;
const { default: sharp } = await import('sharp');

// Keep the sharing image reproducible from a small, editable vector source.
await sharp(fileURLToPath(new URL('../artwork/brand/social-preview.svg', import.meta.url)))
  .png()
  .toFile(fileURLToPath(new URL('../apps/toolbox/public/social-preview.png', import.meta.url)));
