/**
 * 87c — `--roster=sampled:<hop>` / `sampled:<sector>:<hop>` (the per-seed
 * roster-sampling spec). The sampler's behavior is pinned in
 * roster/rosterTable.test.ts — the surface here is the spec parse: the
 * sampled form resolves to a (sector, hop) pair (act-1 sector 0 default),
 * a literal roster stays on the parseRunConfig path, and the malformed /
 * wrong-mode forms ride `bail` (exit-1 at dispatch, like layoutFromArgs —
 * exercised manually, not under vitest).
 */

import { describe, it, expect } from 'vitest';
import { parseArgs, sampledRosterFromArgs } from './args';

describe('--roster=sampled (87c)', () => {
  it('parses sampled:<hop> with the act-1 sector-0 default', () => {
    expect(sampledRosterFromArgs(parseArgs(['--roster=sampled:5']))).toEqual({
      sector: 0,
      hop: 5,
    });
  });

  it('parses sampled:<sector>:<hop> for act-2 reads', () => {
    expect(sampledRosterFromArgs(parseArgs(['--roster=sampled:1:3']))).toEqual({
      sector: 1,
      hop: 3,
    });
  });

  it('leaves literal rosters (and no flag) on the parseRunConfig path', () => {
    expect(sampledRosterFromArgs(parseArgs(['--roster=rogue:3,healer']))).toBeUndefined();
    expect(sampledRosterFromArgs(parseArgs([]))).toBeUndefined();
  });
});
