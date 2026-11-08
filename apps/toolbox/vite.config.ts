import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Keep the publish directory stable so the existing Render static site continues to deploy.
export default defineConfig({
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        dashboard: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
});
