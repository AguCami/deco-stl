import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas para poder publicar en GitHub Pages o cualquier subcarpeta.
  base: './',
  // three.js y manifold ocupan la mayor parte del bundle.
  build: { chunkSizeWarningLimit: 1200 },
  // manifold-3d localiza su .wasm en tiempo de ejecución; no debe pre-empaquetarse.
  optimizeDeps: { exclude: ['manifold-3d'] },
});
