/**
 * K3 — the pure redraw rules: validation + availability math for the pre-turn
 * redraw (select drawn cards → discard them → draw that many fresh).
 *
 * Pulled out of `Run` so both config MODES are provable in isolation (the
 * config is a parameter, not the `DECK` singleton): the shipped "one batch per
 * turn" default (`redrawsPerTurn 1`, `maxCardsPerTurn` = hand size) and the
 * "N cards per turn" alternative (`redrawsPerTurn` raised, `maxCardsPerTurn`
 * lowered) that Phase L's daemons will switch between. `Run.handleRedrawCards`
 * is a thin caller at the `DECK.redraw` defaults.
 */

import type { DeckConfig } from '../config/deck';

export type RedrawConfig = DeckConfig['redraw'];

/** Per-turn redraw bookkeeping, reset at every turn start (`startNextTurn`).
 *  Both counters round-trip in the Run save (v13) — a save taken at the
 *  pre-turn gate after a redraw must not refresh the budget on load. */
export interface RedrawTurnState {
  /** Redraw ACTIONS taken this turn (vs `cfg.redrawsPerTurn`). */
  redrawsUsed: number;
  /** Total CARDS redrawn this turn (vs `cfg.maxCardsPerTurn`). */
  cardsRedrawn: number;
}

/** What the pre-turn screen needs to render the control: actions + cards
 *  still available this turn. Disabled config reads as 0/0. */
export interface RedrawAvailability {
  redrawsRemaining: number;
  cardsRemaining: number;
}

export function redrawAvailability(
  state: RedrawTurnState,
  cfg: RedrawConfig,
): RedrawAvailability {
  if (!cfg.enabled) return { redrawsRemaining: 0, cardsRemaining: 0 };
  return {
    redrawsRemaining: Math.max(0, cfg.redrawsPerTurn - state.redrawsUsed),
    cardsRemaining: Math.max(0, cfg.maxCardsPerTurn - state.cardsRedrawn),
  };
}

/**
 * Validate one redraw request: `selection` holds positions into the current
 * hand (NOT roster indices — positions are the unambiguous "which card the
 * player clicked" contract). Returns a reject reason, or `null` when the
 * redraw may proceed. A rejected request consumes NO budget (the caller
 * returns without mutating).
 */
export function redrawRejection(
  selection: readonly number[],
  handLength: number,
  state: RedrawTurnState,
  cfg: RedrawConfig,
): string | null {
  if (!cfg.enabled) return 'redraw disabled';
  if (selection.length === 0) return 'empty selection';
  const { redrawsRemaining, cardsRemaining } = redrawAvailability(state, cfg);
  if (redrawsRemaining <= 0) return 'no redraws left this turn';
  if (selection.length > cardsRemaining) return 'over the card budget';
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
