import type { GridCoord } from '../../core/types';
import type { Action } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const SWAP_ACTION_ID = 'swap';

export interface SwapActionData {
  from: GridCoord;
  to: GridCoord;
  otherId: number;
  durationTicks: number;
}

/**
 * GP5 #5 — an ATOMIC position swap between the acting unit and a friendly
 * `other`. The healer uses it to let a boxed ally pass in a 1-wide corridor
 * where there's no cell to step aside to: the ally advances onto the healer's
 * cell (`from`) and the healer retreats onto the ally's cell (`to`), in a
 * single `start()` so the grid never transiently double-occupies a cell.
 *
 * Why a dedicated action rather than two `MoveAction`s: `MoveAction.start`
 * just writes `position = to` with no occupancy check (it trusts behaviors
 * never to target an occupied cell). Two units exchanging via separate moves
 * would put both on one cell between the two `start()` calls. Swapping both
 * positions in one `start()` is the only race-free way to express a pass in a
 * corridor with no passing bay — the genuinely missing primitive behind the
 * GP4-exposed healer deadlock (a support body-blocking the only route to the
 * last enemy, which no single-cell move can resolve).
 *
 * Single-tick, like `MoveAction`: all work lands in `start`, the unit is then
 * locked for the move-cooldown window (`impact` phase = the lockout). Only the
 * acting unit pays a cooldown; `other` is merely relocated (it keeps its own
 * cadence and acts normally next tick). If `other` has moved off `to` or died
 * by the time `start` runs (only possible after a snapshot rehydrate — within
 * a live tick `start` fires synchronously right after propose), the swap
 * degrades to a plain step onto the now-free `to`.
 *
 * 56a — a partner that is still ON `to` but has an IN-FLIGHT action is
 * unswappable, and the whole action no-ops (positions untouched,
 * `unit:moveAborted` for the renderer's settle-in-place path). Relocating a
 * mid-MOVE partner is corruption: its logical position holds at `to` until
 * the §36b flip, so the position check passes, the swap teleports it, and
 * then its own move-impact overwrites `position` — with an outstanding claim
 * and a `unit:swapped` event the sim immediately contradicts. Neither degrade
 * branch is safe here (`to` is still occupied, so the plain step would
 * double-occupy). Proposers gate on `activeAction === null` too (synchronous
 * propose→start makes that race-free); this branch is the backstop for the
 * post-rehydrate path where `start` runs a tick after the proposal was cut.
 */
export class SwapAction implements Action {
  readonly id = SWAP_ACTION_ID;

  constructor(
    private readonly from: GridCoord,
    private readonly to: GridCoord,
    private readonly otherId: number,
    private readonly durationTicks: number,
  ) {}

  start(unit: Unit, world: World): void {
    const other = world.findUnit(this.otherId);
    const present =
      other !== undefined &&
      other.currentHp > 0 &&
      other.position.x === this.to.x &&
      other.position.y === this.to.y;

    // 56a — present but mid-action → the no-op branch (see the class doc):
    // swapping corrupts a mid-mover, and `to` is still occupied so the plain-
    // step degrade would double-occupy. Abort cleanly; the sprite settles in
    // place (§35b's selection-time-abort render path).
    if (present && other.activeAction !== null) {
      world.emit('unit:moveAborted', { unitId: unit.id, from: this.from, to: this.to });
      return;
    }

    unit.position = this.to;

    if (present) {
      other.position = this.from;
      // One swap event with shared timing — the renderer lerps both sprites
      // from their live positions (so a partner caught mid-step stays smooth).
      world.emit('unit:swapped', {
        unitA: unit.id,
        unitB: other.id,
        cellA: this.from,
        cellB: this.to,
        durationTicks: this.durationTicks,
      });
    } else {
      // Partner gone (only reachable after a snapshot rehydrate) → it's just a
      // plain step onto the now-free cell.
      world.emit('unit:moved', {
        unitId: unit.id,
        from: this.from,
        to: this.to,
        durationTicks: this.durationTicks,
      });
    }
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
