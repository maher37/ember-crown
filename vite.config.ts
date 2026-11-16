import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The site is served from https://maher37.github.io/ember-crown/, so every asset path
// must start with /ember-crown/ (see CLAUDE.md, "Deploy").
export default defineConfig({
  base: '/ember-crown/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
