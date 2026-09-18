import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // important for GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  server: {
    open: true,
    port: 5173
  }
});
