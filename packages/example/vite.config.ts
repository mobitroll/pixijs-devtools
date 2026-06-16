import { pixiDevtoolsSource } from '@pixi/devtools/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [pixiDevtoolsSource()],
  build: {
    sourcemap: true,
  },
  server: {
    port: 3001,
  },
});
