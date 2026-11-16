import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { inkPlugin } from './scripts/inkPlugin.ts';

// The site is served from https://maher37.github.io/ember-crown/, so every asset path
// must start with /ember-crown/ (see CLAUDE.md, "Deploy").
export default defineConfig({
  base: '/ember-crown/',
  plugins: [react(), inkPlugin()],
  // All game data (spells, monsters...) loads and is validated at startup: ~500 KB, ~135 KB gzipped.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
