import { isAbsolute, resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        // The Vite plugin for the "Open in editor" feature, exposed as `@pixi/devtools/vite`.
        vite: resolve(__dirname, 'src/vite/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      // Externalize every bare/absolute import (pixi.js, vite, @babel/*, magic-string, node:*),
      // bundling only this package's own relative sources.
      external: (id) => !id.startsWith('.') && !isAbsolute(id),
    },
  },
});
