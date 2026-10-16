/**
 * The redraw's rule, pure so it is tested without a `Run`: at the pre-turn
 * gate the player picks drawn cards, they are discarded, and as many are
 * drawn into their places. Each source that grants a redraw this turn has its
 * own entry in the turn's grant queue, and a source that granted none has
 * none. A grant carries `budget` redraw actions, each swapping up to
 * `maxCards` cards. `Run.handleRedrawCards` is the caller.
 */

/** One redraw grant's live state, as the validator reads it: a `TurnGrant`
 *  whose effect is a redraw, flattened. */
export interface RedrawGrantState {
  /** Actions consumed from this grant (`TurnGrant.used`). */
  used: number;
  /** Actions this grant carries (`effect.budget`). */
  budget: number;
  /** Cards swappable in one action (`effect.maxCards`). */
  maxCards: number;
}

/** What the fuzz redraw policy reads of one grant: actions left on it and the
 *  cards one action may swap. The harness and the rollout build it from the
 *  grant's view. */
export interface RedrawAvailability {
  redrawsRemaining: number;
  cardsRemaining: number;
}

/**
 * Validate one redraw request against one grant: `selection` holds positions
 * in the current hand, not roster indices, since a position is the card the
 * player clicked. Returns a reject reason, or `null` when the redraw may
 * proceed; a rejected request consumes no budget. Which grant may be used
 * (strict mode allows only the active one) is the caller's check.
 */
export function redrawRejection(
  selection: readonly number[],
  handLength: number,
  grant: RedrawGrantState,
): string | null {
  if (grant.used >= grant.budget) return 'no redraws left on this grant';
  if (selection.length === 0) return 'empty selection';
  if (selection.length > grant.maxCards) return 'over the card cap';
  const seen = new Set<number>();
  for (const pos of selection) {
    if (!Number.isInteger(pos) || pos < 0 || pos >= handLength) {
      return 'hand position out of range';
    }
    if (seen.has(pos)) return 'duplicate hand position';
    seen.add(pos);
  }
  return null;
}
