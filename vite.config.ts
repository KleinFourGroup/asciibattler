/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths in the built index.html / CSS so the same dist/
  // works under any subpath (GitHub Pages project sites, file://, etc.)
  // without needing a per-deploy `base` value.
  base: './',
  server: {
    open: false,
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Sim/core/run code is pure logic — no DOM needed. Render code is not
    // tested here (visual verification handles that).
    environment: 'node',
  },
});
