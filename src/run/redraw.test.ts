import { describe, it, expect } from 'vitest';
import {
  redrawAvailability,
  redrawRejection,
  type RedrawConfig,
  type RedrawTurnState,
} from './redraw';

/**
 * K3 — the pure redraw rules, exercised in BOTH config modes (the reason this
 * module exists outside `Run`): the shipped "one batch per turn" default and
 * the "N cards per turn" alternative Phase L's daemons will switch between.
 * The configs here are deliberately explicit literals, NOT `DECK.redraw` —
 * the mode contract must hold whatever the shipped knobs say (the Run.test.ts
 * integration block covers the live config).
 */

/** One batch per turn, arbitrary selection (the shipped default's shape). */
const BATCH: RedrawConfig = { enabled: true, redrawsPerTurn: 1, maxCardsPerTurn: 6 };
/** N cards per turn across any number of actions (the L-daemon alternative). */
const N_CARDS: RedrawConfig = { enabled: true, redrawsPerTurn: 99, maxCardsPerTurn: 3 };
const DISABLED: RedrawConfig = { enabled: false, redrawsPerTurn: 1, maxCardsPerTurn: 6 };

const HAND = 6;
const fresh = (): RedrawTurnState => ({ redrawsUsed: 0, cardsRedrawn: 0 });

describe('redrawAvailability', () => {
  it('reads the full budget on a fresh turn', () => {
    expect(redrawAvailability(fresh(), BATCH)).toEqual({
      redrawsRemaining: BATCH.redrawsPerTurn,
      cardsRemaining: BATCH.maxCardsPerTurn,
    });
  });

  it('decrements per use and clamps at zero', () => {
    expect(redrawAvailability({ redrawsUsed: 1, cardsRedrawn: 4 }, BATCH)).toEqual({
      redrawsRemaining: 0,
      cardsRemaining: 2,
    });
    // Over-counted state (can't happen via the handler, but the math clamps).
    expect(redrawAvailability({ redrawsUsed: 5, cardsRedrawn: 99 }, BATCH)).toEqual({
      redrawsRemaining: 0,
      cardsRemaining: 0,
    });
  });

  it('disabled config reads as 0/0 regardless of the dials', () => {
    expect(redrawAvailability(fresh(), DISABLED)).toEqual({
      redrawsRemaining: 0,
      cardsRemaining: 0,
    });
  });
});

describe('redrawRejection — one-batch-per-turn mode', () => {
  it('accepts any subset of the hand on the first action, including the whole hand', () => {
    expect(redrawRejection([2], HAND, fresh(), BATCH)).toBeNull();
    expect(redrawRejection([0, 1, 2, 3, 4, 5], HAND, fresh(), BATCH)).toBeNull();
  });

  it('rejects a second action the same turn', () => {
    const used: RedrawTurnState = { redrawsUsed: 1, cardsRedrawn: 2 };
    expect(redrawRejection([3], HAND, used, BATCH)).toMatch(/no redraws left/);
  });

  it('rejects an empty selection (and it must not consume the budget)', () => {
    expect(redrawRejection([], HAND, fresh(), BATCH)).toMatch(/empty/);
  });

  it('rejects duplicate and out-of-range hand positions', () => {
    expect(redrawRejection([1, 1], HAND, fresh(), BATCH)).toMatch(/duplicate/);
    expect(redrawRejection([-1], HAND, fresh(), BATCH)).toMatch(/out of range/);
    expect(redrawRejection([HAND], HAND, fresh(), BATCH)).toMatch(/out of range/);
    expect(redrawRejection([1.5], HAND, fresh(), BATCH)).toMatch(/out of range/);
  });

  it('rejects everything when disabled', () => {
    expect(redrawRejection([0], HAND, fresh(), DISABLED)).toMatch(/disabled/);
  });
});

describe('redrawRejection — N-cards-per-turn mode', () => {
  it('allows multiple actions until the card budget runs out', () => {
    // 3-card budget: a 2-card action, then a 1-card action — both fine...
    expect(redrawRejection([0, 4], HAND, fresh(), N_CARDS)).toBeNull();
    const afterTwo: RedrawTurnState = { redrawsUsed: 1, cardsRedrawn: 2 };
    expect(redrawRejection([1], HAND, afterTwo, N_CARDS)).toBeNull();
    // ...but a third card past the budget is rejected, whole-selection.
    const afterThree: RedrawTurnState = { redrawsUsed: 2, cardsRedrawn: 3 };
    expect(redrawRejection([2], HAND, afterThree, N_CARDS)).toMatch(/card budget/);
  });

  it('rejects a single selection bigger than the remaining card budget outright', () => {
    // 3-card budget, 4-card ask: rejected as a whole (no partial redraw).
    expect(redrawRejection([0, 1, 2, 3], HAND, fresh(), N_CARDS)).toMatch(/card budget/);
  });
});
