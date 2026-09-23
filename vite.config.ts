import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas para poder publicar en GitHub Pages o cualquier subcarpeta.
  base: './',
  // three.js ocupa la mayor parte del bundle.
  build: { chunkSizeWarningLimit: 800 },
});
