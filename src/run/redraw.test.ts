import { describe, it, expect } from 'vitest';
import { redrawAvailability, redrawRejection, type RedrawGrantState } from './redraw';

/**
 * K3→49d — the pure redraw rules against ONE grant queue entry (the §49
 * per-source re-model), exercised in both budget modes: the shipped
 * single-action grant and a raised-budget alternative. The grants here are
 * deliberately explicit literals, NOT derived from the catalog — the mode
 * contract must hold whatever the shipped knobs say (the Run.test.ts
 * integration block covers the live config).
 */

/** One action, arbitrary selection (Mercury's full-hand shape). */
const BATCH: RedrawGrantState = { used: 0, budget: 1, maxCards: 6 };
/** Many actions, small per-action cap (the raised-budget alternative). */
const N_ACTIONS: RedrawGrantState = { used: 0, budget: 99, maxCards: 3 };

const HAND = 6;

describe('redrawAvailability', () => {
  it('reads the full budget on a fresh grant', () => {
    expect(redrawAvailability(BATCH)).toEqual({
      redrawsRemaining: BATCH.budget,
      cardsRemaining: BATCH.maxCards,
    });
  });

  it('decrements per action; a spent grant reads 0/0 (the card cap is per action)', () => {
    expect(redrawAvailability({ ...N_ACTIONS, used: 1 })).toEqual({
      redrawsRemaining: 98,
      cardsRemaining: 3,
    });
    expect(redrawAvailability({ ...BATCH, used: 1 })).toEqual({
      redrawsRemaining: 0,
      cardsRemaining: 0,
    });
    // Over-counted state (can't happen via the handler, but the math clamps).
    expect(redrawAvailability({ ...BATCH, used: 5 })).toEqual({
      redrawsRemaining: 0,
      cardsRemaining: 0,
    });
  });
});

describe('redrawRejection — single-action grant', () => {
  it('accepts any subset of the hand up to the cap, including the whole hand', () => {
    expect(redrawRejection([2], HAND, BATCH)).toBeNull();
    expect(redrawRejection([0, 1, 2, 3, 4, 5], HAND, BATCH)).toBeNull();
  });

  it('rejects a second action on the same grant', () => {
    expect(redrawRejection([3], HAND, { ...BATCH, used: 1 })).toMatch(/no redraws left/);
  });

  it('rejects an empty selection (and it must not consume the budget)', () => {
    expect(redrawRejection([], HAND, BATCH)).toMatch(/empty/);
  });

  it('rejects duplicate and out-of-range hand positions', () => {
    expect(redrawRejection([1, 1], HAND, BATCH)).toMatch(/duplicate/);
    expect(redrawRejection([-1], HAND, BATCH)).toMatch(/out of range/);
    expect(redrawRejection([HAND], HAND, BATCH)).toMatch(/out of range/);
    expect(redrawRejection([1.5], HAND, BATCH)).toMatch(/out of range/);
  });
});

describe('redrawRejection — raised-budget grant (per-action card cap)', () => {
  it('allows repeat actions, each capped at maxCards (49d: per ACTION, not per turn)', () => {
    expect(redrawRejection([0, 4], HAND, N_ACTIONS)).toBeNull();
    // The second action gets a FRESH 3-card cap (the 49d semantic shift —
    // the old model tracked cards-per-turn across actions).
    expect(redrawRejection([0, 1, 2], HAND, { ...N_ACTIONS, used: 1 })).toBeNull();
  });

  it('rejects a single selection bigger than the per-action cap outright', () => {
    // 3-card cap, 4-card ask: rejected as a whole (no partial redraw).
    expect(redrawRejection([0, 1, 2, 3], HAND, N_ACTIONS)).toMatch(/card cap/);
  });
});
