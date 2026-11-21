import { describe, expect, it } from 'vitest';
import { BLINK_SECONDS, blinkPose, chargeHit, chargeRush, dashTrail, trailFractions, type MoveArm } from './moveLooks';

/**
 * What every arm of the moving looks must do, and what tells each pair
 * apart. The blink never stands between its two cells; the charge's slide
 * keeps the sim's length whatever its pace.
 */

const ARMS: MoveArm[] = ['a', 'b'];
const STEPS = Array.from({ length: 101 }, (_, i) => i / 100);

describe('the blink', () => {
  for (const arm of ARMS) {
    it(`arm ${arm}: starts as the glyph stands, ends whole on its landing, and is only ever on one cell or the other`, () => {
      expect(blinkPose(arm, 0).at).toBe('from');
      const end = blinkPose(arm, 1);
      expect(end).toEqual({ at: 'to', size: 1, alpha: 1 });
      // Once on its landing it never goes back: no frame between the two.
      const firstTo = STEPS.findIndex((t) => blinkPose(arm, t).at === 'to');
      expect(firstTo).toBeGreaterThan(0);
      for (const t of STEPS.slice(firstTo)) expect(blinkPose(arm, t).at).toBe('to');
    });
  }

  it('the fold shrinks to a point and grows back; the cut hides the glyph and keeps its size', () => {
    const foldSizes = STEPS.map((t) => blinkPose('a', t).size);
    expect(Math.min(...foldSizes)).toBeLessThan(0.05);
    expect(STEPS.every((t) => blinkPose('a', t).alpha === 1)).toBe(true);
    expect(STEPS.every((t) => blinkPose('b', t).size === 1)).toBe(true);
    expect(blinkPose('b', 0.1).alpha).toBe(0);
    expect(BLINK_SECONDS.b).toBeLessThan(BLINK_SECONDS.a);
  });
});

describe('the trails and the charge', () => {
  it('the dash leaves afterimages under a, a streak of motes under b', () => {
    expect(dashTrail('a').mark).toBe('ghost');
    expect(dashTrail('b').mark).toBe('mote');
  });

  it('the gallop accelerates and kicks dust at each cell; the lance rushes evenly with afterimages', () => {
    expect(chargeRush('a', 4)).toEqual({ ease: 'in', trail: { mark: 'dust', count: 4 } });
    expect(chargeRush('b', 4)).toEqual({ ease: 'linear', trail: { mark: 'ghost', count: 3 } });
  });

  it('the hit: sparks and a small shake under a, a flash and a harder shake under b', () => {
    expect(chargeHit('a').sparks && !chargeHit('a').flash).toBe(true);
    expect(chargeHit('b').flash && !chargeHit('b').sparks).toBe(true);
    expect(chargeHit('b').shake.intensity).toBeGreaterThan(chargeHit('a').shake.intensity);
  });

  it('marks drop at even steps strictly inside the slide', () => {
    expect(trailFractions(3)).toEqual([0.25, 0.5, 0.75]);
    for (const f of trailFractions(8)) expect(f > 0 && f < 1).toBe(true);
  });
});
