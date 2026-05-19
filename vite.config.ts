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
    // Fuzz harness lives under tests/fuzz/ — opt-in via `npm run fuzz`
    // (CLI) or `npm run fuzz:smoke` (a small vitest run that asserts
    // the harness still runs). Default `npm test` skips it to keep
    // pre-commit fast.
    exclude: ['node_modules/**', 'dist/**', 'tests/fuzz/**'],
    // Sim/core/run code is pure logic — no DOM needed. Render code is not
    // tested here (visual verification handles that).
    environment: 'node',
  },
});
