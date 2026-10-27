/**
 * `--strike=<arm>` exposes the RunConfig strike arm to run mode. The arm's
 * path from the run to each battle's World is pinned in
 * tests/integration/strike-dial.test.ts; here are the parse, the one thing
 * that sets this dial apart from the probe dials (it is legal with
 * --arbitrate), and the harness handing the arm to every battle it builds.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';
import { runOne } from '../harness';
import { makeStrategy } from '../strategies/registry';
import { World } from '../../../src/sim/World';
import type { StrikeArm } from '../../../src/config/stats';

describe('--strike', () => {
  it('parses the value and stays unset when absent', () => {
    expect(parseArgs(['--strike=range-1']).strike).toBe('range-1');
    expect(parseArgs(['--strike=hit']).strike).toBe('hit');
    expect(parseArgs(['--count=5']).strike).toBeUndefined();
    // A bare flag stays unset; run.ts's check owns refusing an unknown arm.
    expect(parseArgs(['--strike']).strike).toBeUndefined();
  });

  it('is legal with --arbitrate, where a probe dial beside it is still refused', () => {
    expect(parseArgs(['--arbitrate', '--strike=mix']).strike).toBe('mix');
    expect(() => parseArgs(['--arbitrate', '--strike=mix', '--draw-add=1'])).toThrow(/refused with --draw-add/);
  });
});

describe("the harness's battles", () => {
  /** Every arm the harness's Worlds were set to over one short run. */
  function armsSeen(strike: StrikeArm | undefined): StrikeArm[] {
    const seen: StrikeArm[] = [];
    const set = World.prototype.setStrike;
    World.prototype.setStrike = function (this: World, arm: StrikeArm) {
      seen.push(arm);
      set.call(this, arm);
    };
    try {
      runOne(3, makeStrategy('greedy')!, {
        runConfig: strike === undefined ? { hopCount: 2 } : { hopCount: 2, strike },
      });
    } finally {
      World.prototype.setStrike = set;
    }
    return seen;
  }

  it("hand every battle's World the run's arm, and `hit` with none", () => {
    const ranged = armsSeen('range-0.25');
    expect(ranged.length).toBeGreaterThan(0);
    expect(new Set(ranged)).toEqual(new Set(['range-0.25']));
    const plain = armsSeen(undefined);
    expect(plain.length).toBeGreaterThan(0);
    expect(new Set(plain)).toEqual(new Set(['hit']));
  });
});
