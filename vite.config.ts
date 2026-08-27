import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Builds the four extension PAGES only (popup, side panel, dashboard, options). These
 * run on the extension's own origin under our own CSP, so ordinary ES modules are fine.
 *
 * The three injected scripts are deliberately NOT built here - see build.mjs. They are
 * bundled as self-contained IIFEs because anything that dynamically imports a
 * chrome-extension: URL is blocked by roblox.com's CSP.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'chrome114',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        dashboard: resolve(__dirname, 'src/dashboard/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
