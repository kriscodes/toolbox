import { mkdir, copyFile } from 'node:fs/promises';
import sharp from 'sharp';

const publicPath = 'apps/toolbox/public';
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
console.log('Prepared three sketches and the Manrope font.');
