import { describe, expect, it } from 'vitest';
import { FALL_SECONDS, fallPose, type FallInto } from './fallMotion';

/**
 * A fall leaves the board: it starts as the standing glyph, only ever goes
 * down, quicker as it goes (a weight dropping, under a chasm's floor or a
 * splash under water), and ends unseen.
 */

const TILES: readonly FallInto[] = ['chasm', 'deep_water'];
const steps = (n: number): number[] => Array.from({ length: n + 1 }, (_, i) => i / n);

describe('a fall', () => {
  it.each(TILES)('into %s: starts as the glyph stands, goes only down, and ends unseen', (into) => {
    expect(fallPose(into, 0)).toEqual({ dy: -0, size: 1, alpha: 1 });
    let lastDy = 0;
    for (const t of steps(40)) {
      const p = fallPose(into, t);
      expect(p.dy).toBeLessThanOrEqual(lastDy + 1e-12);
      lastDy = p.dy;
    }
    expect(fallPose(into, 1).alpha).toBe(0);
    expect(FALL_SECONDS[into]).toBeGreaterThan(0);
  });

  it.each(TILES)('into %s: quickens, its second half falling farther than its first', (into) => {
    const half = fallPose(into, 0.5).dy;
    expect(fallPose(into, 1).dy - half).toBeLessThan(half);
  });

  it("a chasm's plunge falls deeper than a splash, which is over sooner", () => {
    expect(fallPose('chasm', 1).dy).toBeLessThan(fallPose('deep_water', 1).dy);
    expect(FALL_SECONDS.deep_water).toBeLessThan(FALL_SECONDS.chasm);
  });

  it('holds still past its end and before its start', () => {
    for (const into of TILES) {
      expect(fallPose(into, 2)).toEqual(fallPose(into, 1));
      expect(fallPose(into, -1)).toEqual(fallPose(into, 0));
    }
  });
});
