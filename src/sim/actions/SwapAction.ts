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
 * GP5 #5 / 56c2 — an ATOMIC position swap between the acting unit and a
 * friendly `other`: the partner advances onto the actor's cell (`from`) and
 * the actor takes the partner's cell (`to`), exchanged in one write so the
 * grid never transiently double-occupies a cell. The healer's chokepoint
 * yield, the 56b swap-through, and the 56c flee-swap all ride this one verb.
 *
 * Why a dedicated action rather than two `MoveAction`s: `MoveAction`'s flip
 * just writes `position = to` with no occupancy check (it trusts behaviors
 * never to target an occupied cell). Two units exchanging via separate moves
 * would put both on one cell between the two flips. Exchanging both positions
 * in one call is the only race-free way to express a pass in a corridor with
 * no passing bay — the genuinely missing primitive behind the GP4-exposed
 * healer deadlock.
 *
 * 56c2 — DEFERRED, the §36b twin (GP5 shipped it instant, which let an
 * `aMM` column double-swap to `MMa` within one tick — the observed bug):
 * `start` only emits `unit:swapped` (the renderer begins its dual lerp);
 * the logical exchange lands in `applyEffect` at the `impact` boundary —
 * the 50% mark, exactly like a move (see `swapProposal`'s timeline). No
 * claims are needed: from the outside both cells are occupied for the whole
 * window (each by one of the pair, before and after the flip).
 *
 * The PARTNER is never seated with an action and pays no cooldown (it is
 * merely relocated, keeping its own cadence) — but for the WHOLE swap
 * window the partner is reserved: `World.tick` skips its selector and
 * every proposer's `isSwappablePartner` gate refuses it (both via the
 * derived `isReservedSwapPartner` scan — no serialized state). The swap is
 * fundamentally the partner's action too (56e-pre): pre-flip it must not
 * start anything the flip would invalidate, and post-flip it is still
 * mid-slide on the renderer's full-window dual lerp — releasing it at the
 * flip let a second swap grab a half-displaced unit (the 56e sighting).
 * That full-window reserve is what throttles a column re-sort to ONE hop
 * per swap window, now literally.
 *
 * Validation lives at the FLIP, not at `start`: within a live tick,
 * propose→start is synchronous right after the proposer's own gates, and
 * after a snapshot rehydrate `start` never re-runs — only future
 * `applyEffect` boundaries fire — so the flip is the one place stale state
 * can appear. Partner gone/dead/busy by then → degrade to a plain step when
 * `to` is actually free, else abort (`unit:swapAborted` — the TWO-body
 * settle, 56e-pre2; swap cooldown reset, lockout released — the §36c abort
 * shape). The sibling failure site is `World.removeUnit`: an actor removed
 * pre-flip (death mid-window) emits the same event there.
 */
export class SwapAction implements Action {
  readonly id = SWAP_ACTION_ID;

  constructor(
    private readonly from: GridCoord,
    private readonly to: GridCoord,
    private readonly otherId: number,
    private readonly durationTicks: number,
  ) {}

  /** The reserved partner's id — read by the derived reserved-partner scan. */
  get partnerId(): number {
    return this.otherId;
  }

  start(unit: Unit, world: World): void {
    // One swap event with shared timing — the renderer lerps both sprites
    // over the full window; the logical exchange lands at the impact flip.
    world.emit('unit:swapped', {
      unitA: unit.id,
      unitB: this.otherId,
      cellA: this.from,
      cellB: this.to,
      durationTicks: this.durationTicks,
    });
  }

  /**
   * 56c2 — the deferred exchange, fired at the `impact` boundary. Three
   * branches, validated against LIVE state (the partner reserve makes the
   * happy path a guarantee in live play; the others cover a partner that
   * died mid-window or post-rehydrate staleness):
   *
   *   1. Partner alive, on `to`, idle → the atomic exchange. Both units
   *      logically ENTER their new cells here, so both get the §37d
   *      tile-enter hook (mud → poison…) — which the instant GP5 model
   *      never fired for either party: a latent rules hole this rework
   *      closes for free.
   *   2. Partner gone and `to` genuinely free (no body, no foreign claim)
   *      → degrade to a plain step (silent: the start event already showed
   *      the actor sliding to `to`; a dead partner's sprite belongs to the
   *      death anim).
   *   3. `to` still occupied (a busy partner is its own occupant) or
   *      claimed by a third → abort: stay on `from`, release the lockout,
   *      reset the swap cooldown for an immediate retry, and emit
   *      `unit:swapAborted` so the renderer settles BOTH sprites (§36c
   *      shape, two-body since 56e-pre2 — the partner began the dual lerp
   *      too, and settling only the actor left it desynced).
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

    // Abort: the §36c shape — cooldown reset for the retry, lockout released.
    // 56e-pre2: the failure is a TWO-body fact (both sprites began the dual
    // lerp at `start`), so the dedicated event settles both — emitting the
    // one-body `unit:moveAborted` here left the partner's sprite resting on
    // a slide the sim never honored (the 56e labyrinth desync).
    unit.actionCooldowns.set(this.id, 0);
    unit.activeAction = null;
    world.emit('unit:swapAborted', {
      unitA: unit.id,
      unitB: this.otherId,
      cellA: this.from,
      cellB: this.to,
    });
  }

  /** No living body (other than `unit`) covers `cell` and no other unit
   *  holds a claim on it. */
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
 * 56c2/56e-pre — is `unitId` the reserved partner of someone's IN-FLIGHT
 * SwapAction? Derived from live `activeAction`s (never serialized, so it
 * survives snapshot resume by construction). The reserve holds for the
 * WHOLE window — seat through finishTick — not just pre-flip: the swap is
 * fundamentally the partner's action too, so it neither starts anything
 * the coming flip would invalidate (pre-flip) nor acts or gets grabbed by
 * a second swap while the renderer's dual lerp is still sliding it
 * (post-flip — the flip-anchored release shipped at 56c2 allowed exactly
 * that mid-window re-grab, the 56e sighting; regression pins in
 * movement.test.ts + rangedYield.test.ts). The reserve clears when the
 * actor's action does: finishTick, or the abort branch clearing early.
 *
 * Consumed by `World.tick`'s selector skip and by `isSwappablePartner`
 * (the one-hop-per-window chain throttle — window-true since 56e-pre).
 */
export function isReservedSwapPartner(unitId: number, world: World): boolean {
  for (const u of world.units) {
    const aa = u.activeAction;
    if (aa === null || aa.action.id !== SWAP_ACTION_ID) continue;
    if ((aa.action as SwapAction).partnerId === unitId) return true;
  }
  return false;
}

/**
 * 56e-pre2 — the seated swap on `aa` whose flip has NOT yet fired, else null.
 * Pre-flip = offset < the tick-sum of the phases before `impact` (the check
 * the 56e-pre reserve dropped, resurrected for a narrower question).
 * Consumer: `World.removeUnit` — a participant removed pre-flip (death
 * mid-window) means the exchange will never land, and the dual lerp both
 * sprites started at `start` must be settled via `unit:swapAborted`.
 * Post-flip removal needs nothing: the exchange already landed and both
 * sprites are lerping toward their true cells.
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
 * 56c2 — the ONE partner-eligibility gate every swap proposer shares (the
 * mover-side probe, the ranged yield, the flee-swap, the healer's GP5
 * yield): the partner must be genuinely between actions (`activeAction`
 * null — never relocate anything in flight, whatever its phase shape; the
 * fill-windup lesson) and not already reserved by another in-flight swap
 * (for that swap's whole window, 56e-pre).
 */
export function isSwappablePartner(u: Unit, world: World): boolean {
  return u.activeAction === null && !isReservedSwapPartner(u.id, world);
}
