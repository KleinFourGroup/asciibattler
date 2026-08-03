/**
 * 72e — the `--elite-chance` / `--port-chance` node-scatter probe dials:
 * parse-layer pin, mirroring drawAddArg.test.ts. Run mode's [0, 1]
 * probability guard owns rejecting explicit garbage values at dispatch.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';

describe('--elite-chance / --port-chance (72e)', () => {
  it('parses numeric values and stays unset when absent', () => {
    expect(parseArgs(['--elite-chance=1']).eliteChance).toBe(1);
    expect(parseArgs(['--elite-chance=0.6']).eliteChance).toBe(0.6);
    expect(parseArgs(['--port-chance=1']).portChance).toBe(1);
    expect(parseArgs(['--port-chance=0']).portChance).toBe(0);
    expect(parseArgs(['--count=5']).eliteChance).toBeUndefined();
    expect(parseArgs(['--count=5']).portChance).toBeUndefined();
    // Bare flags (no value) stay unset — run.ts's [0, 1] guard owns
    // rejecting explicit garbage values at dispatch.
    expect(parseArgs(['--elite-chance']).eliteChance).toBeUndefined();
    expect(parseArgs(['--port-chance']).portChance).toBeUndefined();
  });
});
