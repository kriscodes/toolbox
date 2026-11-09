import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// This configuration is an explicit local recovery path, separate from the public homepage.
export default defineConfig({
  root: fileURLToPath(new URL('./web', import.meta.url)),
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        dashboard: fileURLToPath(new URL('./web/index.html', import.meta.url)),
        promptBuilder: fileURLToPath(new URL('./web/tools/prompt-builder/index.html', import.meta.url)),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4175,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true } },
  },
});
