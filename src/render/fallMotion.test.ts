import { describe, expect, it } from 'vitest';
import { FALL_SECONDS, fallPose, type FallArm, type FallInto } from './fallMotion';

/**
 * Each arm of a fall leaves the board: it starts as the standing glyph,
 * only ever goes down, and ends unseen. The arms' own shapes are a taste
 * call; these pin what every arm must do and what tells each pair apart.
 */

const ARMS: readonly [FallInto, FallArm][] = [
  ['chasm', 'a'],
  ['chasm', 'b'],
  ['deep_water', 'a'],
  ['deep_water', 'b'],
];
const steps = (n: number): number[] => Array.from({ length: n + 1 }, (_, i) => i / n);

describe('a fall', () => {
  it.each(ARMS)('%s, arm %s: starts as the glyph stands, goes only down, and ends unseen', (into, arm) => {
    expect(fallPose(into, arm, 0)).toEqual({ dy: -0, size: 1, alpha: 1 });
    let lastDy = 0;
    for (const t of steps(40)) {
      const p = fallPose(into, arm, t);
      expect(p.dy).toBeLessThanOrEqual(lastDy + 1e-12);
      lastDy = p.dy;
    }
    const end = fallPose(into, arm, 1);
    expect(end.alpha === 0 || end.size === 0).toBe(true);
    expect(FALL_SECONDS[into][arm]).toBeGreaterThan(0);
  });

  it('the plunge falls farther than the fall away, which shrinks to a point instead', () => {
    expect(fallPose('chasm', 'a', 1).dy).toBeLessThan(fallPose('chasm', 'b', 1).dy);
    expect(fallPose('chasm', 'b', 1).size).toBe(0);
    expect(fallPose('chasm', 'a', 1).size).toBeGreaterThan(0);
  });

  it('the plunge quickens: its second half falls farther than its first', () => {
    const half = fallPose('chasm', 'a', 0.5).dy;
    expect(fallPose('chasm', 'a', 1).dy - half).toBeLessThan(half);
  });

  it('the sink settles slowly and the splash is over sooner', () => {
    expect(FALL_SECONDS.deep_water.a).toBeGreaterThan(FALL_SECONDS.deep_water.b);
    // The sink is quickest at the start and settles; the splash quickens.
    const sinkHalf = fallPose('deep_water', 'a', 0.5).dy;
    expect(sinkHalf).toBeLessThan(fallPose('deep_water', 'a', 1).dy - sinkHalf);
    const splashHalf = fallPose('deep_water', 'b', 0.5).dy;
    expect(fallPose('deep_water', 'b', 1).dy - splashHalf).toBeLessThan(splashHalf);
  });

  it('holds still past its end and before its start', () => {
    for (const [into, arm] of ARMS) {
      expect(fallPose(into, arm, 2)).toEqual(fallPose(into, arm, 1));
      expect(fallPose(into, arm, -1)).toEqual(fallPose(into, arm, 0));
    }
  });
});
