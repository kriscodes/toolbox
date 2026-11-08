import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

// Keep the sharing image reproducible from a small, editable vector source.
await sharp(fileURLToPath(new URL('../artwork/brand/social-preview.svg', import.meta.url)))
  .png()
  .toFile(fileURLToPath(new URL('../apps/toolbox/public/social-preview.png', import.meta.url)));
