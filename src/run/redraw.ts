/**
 * K3 — the pure redraw rules: validation + availability math for the pre-turn
 * redraw (select drawn cards → discard them → draw that many fresh).
 *
 * Pulled out of `Run` so the modes are provable in isolation. 49d re-modeled
 * the input from the old summed per-turn config + counters to ONE GRANT
 * QUEUE ENTRY (`RedrawGrantState` — a `TurnGrant` redraw effect flattened
 * with its `used` count): each granted idol prompts its own redraw now (the
 * §49 per-source shape-lock), so the budget semantics moved with it —
 * `budget` redraw ACTIONS on this grant, each swapping up to `maxCards`
 * cards PER ACTION (the old model capped cards per TURN across actions;
 * content-invisible — every shipped grant is single-action). Existence is
 * availability: a hook that didn't grant this turn simply has no queue
 * entry, so the K3-era `enabled` gate is gone. `Run.handleRedrawCards` is a
 * thin caller.
 */

import type { DeckConfig } from '../config/deck';

/** The deck-config anchor (the daemon-less baseline + the authored
 *  `grantRedraws` op shape). Grants resolve OUT of this shape into queue
 *  entries at `resolveTurnGrants`. */
export type RedrawConfig = DeckConfig['redraw'];

/** 49d — one redraw grant's live state, as the validator reads it (a
 *  `TurnGrant` with `effect.kind === 'redraw'`, flattened). */
export interface RedrawGrantState {
  /** Actions consumed from this grant (`TurnGrant.used`). */
  used: number;
  /** Actions this grant carries (`effect.budget`). */
  budget: number;
  /** Cards swappable PER ACTION (`effect.maxCards`). */
  maxCards: number;
}

/** What a redraw control renders: actions left on this grant + the per-
 *  action card cap (0/0 once the grant is spent). */
export interface RedrawAvailability {
  redrawsRemaining: number;
  cardsRemaining: number;
}

export function redrawAvailability(grant: RedrawGrantState): RedrawAvailability {
  const redrawsRemaining = Math.max(0, grant.budget - grant.used);
  return {
    redrawsRemaining,
    cardsRemaining: redrawsRemaining > 0 ? grant.maxCards : 0,
  };
}

/**
 * Validate one redraw request against ONE grant: `selection` holds positions
 * into the current hand (NOT roster indices — positions are the unambiguous
 * "which card the player clicked" contract). Returns a reject reason, or
 * `null` when the redraw may proceed. A rejected request consumes NO budget
 * (the caller returns without mutating). Queue-order legality (strict mode's
 * active-grant rule) is the CALLER's check — this validates the grant's own
 * budget only.
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
