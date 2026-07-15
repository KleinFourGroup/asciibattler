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
 * merely relocated, keeping its own cadence) — but while the swap is
 * PRE-FLIP the partner is reserved: `World.tick` skips its selector and
 * every proposer's `isSwappablePartner` gate refuses it (both via the
 * derived `isPreFlipSwapPartner` scan — no serialized state). That reserve
 * is what throttles a column re-sort to ONE hop per swap window.
 *
 * Validation lives at the FLIP, not at `start`: within a live tick,
 * propose→start is synchronous right after the proposer's own gates, and
 * after a snapshot rehydrate `start` never re-runs — only future
 * `applyEffect` boundaries fire — so the flip is the one place stale state
 * can appear. Partner gone/dead/busy by then → degrade to a plain step when
 * `to` is actually free, else abort (`unit:moveAborted`, swap cooldown
 * reset, lockout released — the §36c abort shape).
 */
export class SwapAction implements Action {
  readonly id = SWAP_ACTION_ID;

  constructor(
    private readonly from: GridCoord,
    private readonly to: GridCoord,
    private readonly otherId: number,
    private readonly durationTicks: number,
  ) {}

  /** The reserved partner's id — read by the derived pre-flip-partner scan. */
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
   * branches, validated against LIVE state (the pre-flip reserve makes the
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
   *      `unit:moveAborted` so the renderer settles the actor back (§36c).
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
    unit.actionCooldowns.set(this.id, 0);
    unit.activeAction = null;
    world.emit('unit:moveAborted', { unitId: unit.id, from: this.from, to: this.to });
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
 * 56c2 — is `unitId` the reserved partner of someone's IN-FLIGHT, PRE-FLIP
 * swap? Derived from live `activeAction`s (never serialized, so it survives
 * snapshot resume by construction). Pre-flip = the `impact` boundary hasn't
 * fired yet: offset < the tick-sum of the phases before `impact`. Post-flip
 * the exchange already happened and the partner is free again — GP5's "acts
 * normally next tick" contract, now anchored to the flip.
 *
 * Consumed by `World.tick`'s selector skip (the partner must not start an
 * action the flip would invalidate) and by `isSwappablePartner` (the
 * one-hop-per-window chain throttle).
 */
export function isPreFlipSwapPartner(unitId: number, world: World): boolean {
  for (const u of world.units) {
    const aa = u.activeAction;
    if (aa === null || aa.action.id !== SWAP_ACTION_ID) continue;
    if ((aa.action as SwapAction).partnerId !== unitId) continue;
    let impactOffset = 0;
    for (const p of aa.phases) {
      if (p.phase === 'impact') break;
      impactOffset += p.ticks;
    }
    if (world.currentTick - aa.startTick < impactOffset) return true;
  }
  return false;
}

/**
 * 56c2 — the ONE partner-eligibility gate every swap proposer shares (the
 * mover-side probe, the ranged yield, the flee-swap, the healer's GP5
 * yield): the partner must be genuinely between actions (`activeAction`
 * null — never relocate anything in flight, whatever its phase shape; the
 * fill-windup lesson) and not already reserved by another in-flight swap.
 */
export function isSwappablePartner(u: Unit, world: World): boolean {
  return u.activeAction === null && !isPreFlipSwapPartner(u.id, world);
}
