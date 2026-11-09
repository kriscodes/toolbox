import { mkdir, copyFile } from 'node:fs/promises';
import sharp from 'sharp';

// Historical artwork belongs only to the optional local archive, never the public build.
const publicPath = 'archive/2026-11-toolbox/web/public';
await mkdir(`${publicPath}/artwork`, { recursive: true });
await mkdir(`${publicPath}/fonts`, { recursive: true });
for (const name of ['prompt-builder', 'family-map', 'home-cameras']) {
  await sharp(`artwork/source/${name}.png`)
    .resize({ width: 960, withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(`${publicPath}/artwork/${name}.webp`);
}
await copyFile('node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2', `${publicPath}/fonts/manrope-latin.woff2`);
await copyFile('node_modules/@fontsource-variable/manrope/LICENSE', `${publicPath}/fonts/OFL.txt`);
console.log('Prepared archived sketches and the archived Manrope font.');
