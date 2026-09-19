import { describe, expect, it } from 'vitest';
import { tallyRate } from './promotionTally';

describe('tallyRate (104d2 — the rising tally)', () => {
  const semitones = (rate: number): number => 12 * Math.log2(rate);

  it('beat 0 is the sample as recorded', () => {
    expect(tallyRate(0, true)).toBe(1);
  });

  it('climbs a major scale and lands exactly one octave up', () => {
    const steps = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => Math.round(semitones(tallyRate(b, true))));
    // whole whole half whole whole whole half
    expect(steps.slice(1).map((s, i) => s - steps[i]!)).toEqual([2, 2, 1, 2, 2, 2, 1]);
    expect(tallyRate(7, true)).toBeCloseTo(2, 10);
  });

  it('never falls, and tops out at the octave however long the card', () => {
    for (let b = 1; b < 20; b++) {
      expect(tallyRate(b, true)).toBeGreaterThanOrEqual(tallyRate(b - 1, true));
      expect(tallyRate(b, true)).toBeLessThanOrEqual(2 + 1e-9);
    }
    expect(tallyRate(-3, true)).toBe(1);
  });

  it('the flat reading is rate 1 on every beat', () => {
    for (let b = 0; b < 10; b++) expect(tallyRate(b, false)).toBe(1);
  });
});
