/**
 * Run-level command channel. Carries the three player intents that used to
 * be bus-event imperatives (`run:nodeEntered`, `recruit:chosen`,
 * `run:resetRequested`). UI components no longer call `bus.emit(...)` for
 * these — they hold a `RunDispatcher` and call `dispatcher.dispatch(cmd)`.
 *
 * Why a dispatcher object rather than a direct `Run` reference: `Run` is
 * replaced on reset (Game.resetRun), so any UI that captured the old
 * instance would dispatch to a disposed run. The dispatcher closes over
 * `() => this.run` in Game and always resolves to the live one.
 *
 * Run processes commands synchronously (unlike `World.tick`, which drains
 * its queue at a tick boundary). Run isn't tick-driven — its lifecycle is
 * event-driven, so "apply now" is the natural semantic.
 */

import type { UnitTemplate } from '../sim/Unit';

export type RunCommand =
  | { readonly kind: 'enterNode'; readonly nodeId: number }
  | { readonly kind: 'chooseRecruit'; readonly unitTemplate: UnitTemplate }
  /**
   * H6b — decline the recruit offer. `chooseRecruit`'s sibling: leaves the
   * roster + deck untouched and advances `phase='map'`. Trial default is
   * always-available + free (no cost gate). Reverts to deck dilution — weak
   * for the first recruit or two, growing as the roster outpaces the hand.
   */
  | { readonly kind: 'passRecruit' }
  /**
   * E4 — dismiss the PromotionScene. Run rolls the recruit offer (or
   * routes to run:victory at terminal) only after this command lands;
   * the pause between battle-end banking and the offer is the scene
   * the player is reading.
   */
  | { readonly kind: 'dismissPromotion' }
  /**
   * H4b — advance past a turn gate (the pre-turn or post-turn screen). From
   * `turn-intro` it starts the turn's tactical battle; from `turn-outcome` it
   * continues the encounter (next turn) or ends it (recruit / promotion /
   * defeat). The pre/post-turn screens dispatch it on their auto-advance timer
   * or a skip click. A no-op outside those two phases. Only reachable when
   * `Run.pauseAtTurnGates` is on (the headless loop has no gates to advance).
   */
  | { readonly kind: 'advanceTurn' }
  /**
   * K3 — redraw selected hand cards at the pre-turn gate: send them to the
   * discard, draw that many fresh (the deck's normal reshuffle cycle applies).
   * `handIndices` are positions into the current hand (not roster indices).
   * Only valid in `turn-intro` and within the `DECK.redraw` budget
   * (`redrawsPerTurn` actions / `maxCardsPerTurn` cards) — anything else is a
   * silent no-op that consumes no budget. The redrawn hand re-emits via
   * `turn:handRedrawn`.
   */
  | { readonly kind: 'redrawCards'; readonly handIndices: readonly number[] }
  | { readonly kind: 'resetRun' };

export interface RunDispatcher {
  dispatch(command: RunCommand): void;
}
