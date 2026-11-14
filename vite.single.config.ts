import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Single self-contained HTML file (used for sharing a playable build).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2022', outDir: 'dist-single', chunkSizeWarningLimit: 4000 },
});
