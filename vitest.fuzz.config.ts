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
 *
 * `testTimeout` is raised well above the 5s default: these cases each drive
 * SEVERAL full multi-hop runs, and under the full-suite's parallel CPU
 * contention (20 files at once) a real-battle case can exceed 5s — especially
 * after §36b's deferred moves + pursuit-hold lengthened battles. A genuine sim
 * deadlock is caught by the harness tick-cap (resolve-as-draw), NOT this wall-
 * clock guard, so a generous default can't mask a hang. The heaviest corpus
 * sweeps (occupancyInvariant) still set their own higher per-test timeouts.
 */
export default defineConfig({
  test: {
    include: ['tests/fuzz/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
