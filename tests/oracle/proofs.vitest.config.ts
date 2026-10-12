/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

/**
 * The Vitest config for the proofs that have no test file of their own
 * (`tests/oracle/proofs/*.proof.ts`). They exist to be run under the
 * coverage tool by `npm run oracle -- reach-record` (tests/oracle/reach.ts);
 * neither `npm test` nor the fuzz smoke includes them.
 */
export default defineConfig({
  test: {
    include: ['tests/oracle/proofs/*.proof.ts'],
    environment: 'node',
    testTimeout: 900_000,
    isolate: false,
  },
});
