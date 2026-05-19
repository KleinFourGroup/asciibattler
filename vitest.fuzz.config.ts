/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

/**
 * Vitest config for the headless fuzz harness smoke test. The default
 * `vite.config.ts` excludes `tests/fuzz/**` so `npm test` stays fast;
 * `npm run fuzz:smoke` points at this config to flip the inclusion.
 *
 * Smoke-only: this isn't where balance data comes from. Real fuzz runs
 * are `npm run fuzz` (CLI in `tests/fuzz/cli.ts`) — that writes
 * artifacts; this config just asserts the harness still constructs and
 * runs without throwing.
 */
export default defineConfig({
  test: {
    include: ['tests/fuzz/**/*.test.ts'],
    environment: 'node',
  },
});
