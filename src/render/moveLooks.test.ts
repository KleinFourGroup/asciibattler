import { describe, expect, it } from 'vitest';
import { blinkPose, chargeRush, DASH_TRAIL, trailFractions } from './moveLooks';

/**
 * The looks of a unit moving itself. The blink never stands between its two
 * cells and is unseen until it lands; the charge's slide keeps the sim's
 * length whatever its pace.
 */

const STEPS = Array.from({ length: 101 }, (_, i) => i / 100);

describe('the blink, the cut', () => {
  it('is gone at once where it stood, ends whole on its landing, and is only ever on one cell or the other', () => {
    expect(blinkPose(0)).toEqual({ at: 'from', alpha: 0 });
    expect(blinkPose(1)).toEqual({ at: 'to', alpha: 1 });
    // Once on its landing it never goes back: no frame between the two.
    const firstTo = STEPS.findIndex((t) => blinkPose(t).at === 'to');
    expect(firstTo).toBeGreaterThan(0);
    for (const t of STEPS.slice(firstTo)) expect(blinkPose(t).at).toBe('to');
    // Unseen on its start: the cut, not a fade out.
    for (const t of STEPS.slice(0, firstTo)) expect(blinkPose(t).alpha).toBe(0);
  });
});

describe('the trails and the charge', () => {
  it('a leap leaves three afterimages', () => {
    expect(DASH_TRAIL).toEqual({ mark: 'ghost', count: 3 });
  });

  it('the gallop accelerates and kicks a puff of dust at each cell it runs', () => {
    expect(chargeRush(4)).toEqual({ ease: 'in', trail: { mark: 'dust', count: 4 } });
    expect(chargeRush(0).trail.count).toBe(1);
  });

  it('marks drop at even steps strictly inside the slide', () => {
    expect(trailFractions(3)).toEqual([0.25, 0.5, 0.75]);
    for (const f of trailFractions(8)) expect(f > 0 && f < 1).toBe(true);
  });
});
