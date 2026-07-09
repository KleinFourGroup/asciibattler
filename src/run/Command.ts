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
   * 48b — accept ONE pending reward portion (`index` into
   * `Run.pendingRewards`). Bits settle through `gainBits` (the fold applies
   * at accept time); a daemon joins the ownership list immediately. Only
   * valid in the `reward` phase with a live offer — anything else (wrong
   * phase, out-of-range index) is a silent no-op. Resolving the last
   * portion re-enters the gate chain (promotion → recruit/victory).
   */
  | { readonly kind: 'acceptReward'; readonly index: number }
  /**
   * 48b — decline ONE pending reward portion (the declinable-per-portion
   * spec lock; `passRecruit`'s sibling). Same validity + no-op contract as
   * `acceptReward`.
   */
  | { readonly kind: 'declineReward'; readonly index: number }
  /**
   * H4b — advance past a turn gate (the pre-turn or post-turn screen). From
   * `turn-intro` it starts the turn's tactical battle; from `turn-outcome` it
   * continues the encounter (next turn) or ends it (recruit / promotion /
   * defeat). The pre/post-turn screens dispatch it on their Fight/Continue
   * click (the H4b auto-timers are gone — pre-turn in K3, post-turn in M3).
   * A no-op outside those two phases. Only reachable when
   * `Run.pauseAtTurnGates` is on (the headless loop has no gates to advance).
   */
  | { readonly kind: 'advanceTurn' }
  /**
   * K3 — redraw selected hand cards at the pre-turn gate: send them to the
   * discard, draw that many fresh (the deck's normal reshuffle cycle applies).
   * `handIndices` are positions into the current hand (not roster indices).
   * Only valid in `turn-intro` and within this turn's daemon-resolved budget
   * (`Run.turnGrants.redraw`: `redrawsPerTurn` actions / `maxCardsPerTurn`
   * cards; no grant → always rejected) — anything else is a silent no-op that
   * consumes no budget. The redrawn hand re-emits via `turn:handRedrawn`.
   */
  | { readonly kind: 'redrawCards'; readonly handIndices: readonly number[] }
  /**
   * K4 — empower one drawn card at the pre-turn gate: its roster slot gains
   * the active daemon's buff (`Run.turnGrants.empower.buff`; no grant →
   * always rejected) for the rest of the ENCOUNTER (the K1
   * encounter-effect store — re-seeded onto the unit each turn at deploy, so
   * it survives being redrawn away or benched). `handIndex` is a position
   * into the current hand (not a roster index), same contract as
   * `redrawCards`. Only valid in `turn-intro` within the `empowersPerTurn`
   * budget — anything else is a silent no-op that consumes no budget. Emits
   * `turn:unitEmpowered`.
   */
  | {
      readonly kind: 'empowerUnit';
      readonly handIndex: number;
      /** 47d — which granted idol's blessing (an index into this turn's
       *  `Run.empowerGrants` / `turnGrants.empowers`). Out-of-range = the
       *  usual silent no-op. */
      readonly grantIndex: number;
    }
  /**
   * 49b — discard one cache slot (`cacheIndex` into `Run.cache`): the
   * at-will discard (spec §Cache) and the instrument of the 49f forced-keep
   * shrink flow (the modal dispatches one per drop-choice). Deliberately
   * legal in ANY phase — pure run-level state with no sim seam, and the
   * cache modal opens on every screen. Out-of-range / fractional = the
   * usual silent no-op. Emits `run:cacheChanged`.
   */
  | { readonly kind: 'discardPacket'; readonly cacheIndex: number }
  | { readonly kind: 'resetRun' };

export interface RunDispatcher {
  dispatch(command: RunCommand): void;
}
