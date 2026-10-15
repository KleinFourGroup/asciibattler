import type { GridCoord } from '../../core/types';
import type { Action, ActionPhaseName } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';
import { cellsOccupiedBy, claimantOf } from '../occupancy';

export const SWAP_ACTION_ID = 'swap';

export interface SwapActionData {
  from: GridCoord;
  to: GridCoord;
  otherId: number;
  durationTicks: number;
}

/**
 * A position swap between the acting unit and a friendly `other`: the partner
 * takes the actor's cell (`from`) and the actor takes the partner's (`to`), in
 * one write, so no cell ever holds two units. The healer's yield at a
 * chokepoint, the swap through a column, the flee swap and the ranged yield all
 * use it.
 *
 * Why not two `MoveAction`s: a move's flip writes `position = to` with no
 * occupancy check, trusting the proposer, so two units exchanging by separate
 * moves would share a cell between the flips. One write of both positions is
 * the only race-free way to pass in a corridor with no passing bay, and without
 * it two units deadlock there.
 *
 * The exchange is deferred, as a move's flip is: `start` only emits
 * `unit:swapped`, and the renderer begins sliding both glyphs; the exchange
 * lands in `applyEffect` at the `impact` boundary, which `swapProposal` places
 * at `SIM.moveFlipFraction` of the swap. An instant swap let a column of three
 * swap twice within one tick. No claims are needed: both cells are occupied
 * throughout, by one of the pair before the exchange and the other after.
 *
 * The partner is never seated with an action and pays no cooldown; it is moved
 * and keeps its own cadence. But it is reserved for the whole window: the
 * selector skips it and every proposer's `isSwappablePartner` refuses it. The
 * swap is the partner's action too. Before the exchange it must not start
 * anything the exchange would undo, and after it, it is still mid-slide on the
 * renderer's window; releasing it at the exchange let a second swap take a unit
 * half moved. Reserving it for the whole window also limits a column's re-sort
 * to one hop per window.
 *
 * The check is at the exchange, not at `start`: in a live tick the proposal
 * and `start` run together just after the proposer's own checks, and after a
 * snapshot is restored `start` never runs again, so the exchange is the one
 * place stale state can show. If by then the partner is gone, dead or busy, the
 * actor steps alone when `to` is free, and otherwise the swap aborts
 * (`unit:swapAborted`, which settles both glyphs; the swap's cooldown reset and
 * the lockout released). The other way a swap fails is `World.removeUnit`: an
 * actor removed before the exchange (a death mid-window) emits the same event
 * there.
 */
export class SwapAction implements Action {
  readonly id = SWAP_ACTION_ID;

  constructor(
    private readonly from: GridCoord,
    private readonly to: GridCoord,
    private readonly otherId: number,
    private readonly durationTicks: number,
  ) {}

  /** The reserved partner's id, which `scanReservedSwapPartners` reads. */
  get partnerId(): number {
    return this.otherId;
  }

  /**
   * `Action.reservedPartnerId`: while this action is seated, `otherId` is
   * reserved (skipped by the selector, refused by `isSwappablePartner`).
   * World's seat and clear keep the reserved-partner index from it.
   */
  reservedPartnerId(): number {
    return this.otherId;
  }

  start(unit: Unit, world: World): void {
    // One event with one timing: the renderer slides both glyphs over the
    // whole window, and the exchange lands at `impact`.
    world.emit('unit:swapped', {
      unitA: unit.id,
      unitB: this.otherId,
      cellA: this.from,
      cellB: this.to,
      durationTicks: this.durationTicks,
    });
  }

  /**
   * The exchange, at the `impact` boundary, checked against the world as it is
   * now. The partner's reserve makes the first branch certain in live play; the
   * others cover a partner that died mid-window and state gone stale across a
   * restore.
   *
   * 1. The partner is alive, on `to` and idle: the exchange. Both units enter
   *    their new cells here, so both get the tile's enter effects.
   * 2. The partner is gone and `to` is free (no body, no other unit's claim):
   *    the actor steps alone, silently, since `start` already showed it sliding
   *    to `to`, and a dead partner's glyph belongs to its death animation.
   * 3. `to` is still taken (a busy partner stands on it) or another unit
   *    claims it: abort. The actor stays on `from`, the lockout ends, the
   *    swap's cooldown is reset so it may try again at once, and
   *    `unit:swapAborted` lets the renderer settle both glyphs, since the
   *    partner began sliding too.
   */
  applyEffect(unit: Unit, world: World, _tickOffset: number, _phase?: ActionPhaseName): void {
    const other = world.findUnit(this.otherId);
    const present =
      other !== undefined &&
      other.currentHp > 0 &&
      other.position.x === this.to.x &&
      other.position.y === this.to.y;

    if (present && other.activeAction === null) {
      unit.position = this.to;
      other.position = this.from;
      world.applyTileEnterEffects(unit);
      world.applyTileEnterEffects(other);
      return;
    }

    if (!present && this.cellFree(this.to, unit, world)) {
      unit.position = this.to;
      world.applyTileEnterEffects(unit);
      return;
    }

    // Abort: the cooldown reset for a retry, the lockout released. Both glyphs
    // began sliding at `start`, so the two-body event settles both; a
    // `unit:moveAborted` would leave the partner's glyph where the sim never
    // put it.
    unit.actionCooldowns.set(this.id, 0);
    world.clearActiveAction(unit);
    world.emit('unit:swapAborted', {
      unitA: unit.id,
      unitB: this.otherId,
      cellA: this.from,
      cellB: this.to,
    });
  }

  /** Whether no living body but `unit`'s covers `cell` and no other unit
   *  claims it. */
  private cellFree(cell: GridCoord, unit: Unit, world: World): boolean {
    const claimant = claimantOf(world, cell);
    if (claimant !== undefined && claimant !== unit.id) return false;
    for (const u of world.units) {
      if (u.id === unit.id || u.currentHp <= 0) continue;
      for (const c of cellsOccupiedBy(u)) {
        if (c.x === cell.x && c.y === cell.y) return false;
      }
    }
    return true;
  }

  toData(): SwapActionData {
    return {
      from: this.from,
      to: this.to,
      otherId: this.otherId,
      durationTicks: this.durationTicks,
    };
  }

  static fromData(data: SwapActionData): SwapAction {
    return new SwapAction(data.from, data.to, data.otherId, data.durationTicks);
  }
}

/**
 * Whether `unitId` is the reserved partner of a swap under way. The reserve
 * holds for the swap's whole window, from its seat to `finishTick`, not only
 * until the exchange: the partner must neither start anything the exchange
 * would undo nor act, or be taken by a second swap, while the renderer still
 * slides it (pinned in `movement.test.ts` and
 * `behaviors/rangedYield.test.ts`). It clears when the actor's action does, at
 * `finishTick` or early on an abort.
 *
 * Answered from World's index in O(1); a scan of the units per call was a
 * measurable share of a run. The index is kept at the seat and clear of
 * `activeAction`, so the order of changes within a tick holds: a swap seated
 * by an earlier unit reserves its partner before that partner's own turn the
 * same tick. `scanReservedSwapPartners` is the scan, kept for the tests.
 *
 * Read by the selector's skip in `World.tick` and by `isSwappablePartner`.
 */
export function isReservedSwapPartner(unitId: number, world: World): boolean {
  return world.isSwapReservedPartner(unitId);
}

/**
 * The tests' check on the index: it rebuilds partner id → actor id from the
 * live `activeAction`s, a surface the index does not consult, and the tests
 * compare it with `world.swapReservedPartnerIndex` after seats, exchanges,
 * aborts, removals and snapshot round-trips. Never call it from game code: its
 * cost per call is what the index removed.
 */
export function scanReservedSwapPartners(world: World): Map<number, number> {
  const out = new Map<number, number>();
  for (const u of world.units) {
    const aa = u.activeAction;
    if (aa === null || aa.action.id !== SWAP_ACTION_ID) continue;
    out.set((aa.action as SwapAction).partnerId, u.id);
  }
  return out;
}

/**
 * The swap seated on `aa` whose exchange has not yet happened, or null: one
 * whose offset is still below the sum of the phases before `impact`. Read by
 * `World.removeUnit`: a participant removed before the exchange (a death
 * mid-window) means the exchange will never land, and both glyphs, sliding
 * since `start`, are settled by `unit:swapAborted`. A removal after the
 * exchange needs nothing, since both glyphs are sliding to their true cells.
 */
export function preFlipSwap(
  aa: { action: Action; startTick: number; phases: readonly { phase: string; ticks: number }[] } | null,
  currentTick: number,
): SwapAction | null {
  if (aa === null || aa.action.id !== SWAP_ACTION_ID) return null;
  let impactOffset = 0;
  for (const p of aa.phases) {
    if (p.phase === 'impact') break;
    impactOffset += p.ticks;
  }
  return currentTick - aa.startTick < impactOffset ? (aa.action as SwapAction) : null;
}

/**
 * The one check every swap proposer makes of a partner: it must be between
 * actions (`activeAction` null, since nothing under way is ever moved, whatever
 * its phases) and not reserved by another swap under way.
 */
export function isSwappablePartner(u: Unit, world: World): boolean {
  return u.activeAction === null && !isReservedSwapPartner(u.id, world);
}
