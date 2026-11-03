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
        promptBuilder: fileURLToPath(new URL('./tools/prompt-builder/index.html', import.meta.url)),
      },
    },
  },
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true } },
  },
});
