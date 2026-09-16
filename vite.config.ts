/// <reference types="vitest/config" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The ONR token endpoint sends no CORS headers, so the browser blocks
      // a direct fetch from the app's origin. Vite's dev server runs in
      // Node, not the browser, so it can call it server-side and hand the
      // token back same-origin. This only covers local development — a
      // production deployment needs its own server-side proxy (a Convex
      // Action, once this feature moves into Regula; see README).
      '/api/onr-token': {
        target: 'https://mapa.onr.org.br',
        changeOrigin: true,
        rewrite: () => '/paginas/mapa/ajax-renovar-token.php',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '**/.worktrees/**'],
  },
});
