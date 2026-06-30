import type { GridCoord } from '../../core/types';
import type { Action, ActionPhaseName } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const MOVE_ACTION_ID = 'move';

export interface MoveActionData {
  from: GridCoord;
  to: GridCoord;
  durationTicks: number;
}

/**
 * Single-step grid movement. §36b — NON-INSTANT: `start` CLAIMS the destination
 * (the §36 claim system) + emits `unit:moved`, but the unit's logical position
 * holds at `from`. The flip to `to` (and the claim release) lands in
 * `applyEffect`, which `World.tick` fires at the `impact` boundary — positioned
 * at the 50% mark by the proposal's phase timeline (see `moveProposal`). So for
 * the first half of the slide the unit logically occupies `from` and reserves
 * `to`; for the second it occupies `to` and the reservation is gone — `to` is
 * continuously blocked-for-pathing (claimed, then occupied) so no peer ever
 * converges on it. The renderer reads `durationTicks` from `unit:moved` and
 * lerps the sprite across the whole window independent of the logical flip.
 *
 * Per-proposal instance — MovementBehavior allocates one of these each
 * tick it wants to step. Trivial allocation overhead at expected unit
 * counts.
 */
export class MoveAction implements Action {
  readonly id = MOVE_ACTION_ID;

  constructor(
    private readonly from: GridCoord,
    private readonly to: GridCoord,
    private readonly durationTicks: number,
  ) {}

  start(unit: Unit, world: World): void {
    // §36b — reserve the destination for the move's duration; the unit stays
    // logically on `from` until `applyEffect` flips it at the 50% mark. A
    // 1-tick move's `impact` sits at offset 0, so `start` + `applyEffect` run
    // the same tick and the claim is atomically held-then-released (inert, as
    // on the pre-§36b instant model).
    world.claimCell(this.to, unit.id);
    world.emit('unit:moved', {
      unitId: unit.id,
      from: this.from,
      to: this.to,
      durationTicks: this.durationTicks,
    });
  }

  /**
   * §36b — the deferred logical flip, fired at the `impact` phase boundary
   * (the 50% mark, per `moveProposal`'s timeline). Move the unit onto `to` and
   * release the destination claim: before this the unit reads as still on
   * `from` (targeting / adjacency / pathing all read `unit.position`), after it
   * reads as arrived. A move whose unit died before the flip never reaches here
   * (the reap clears its claim via `releaseClaimsBy`).
   *
   * §37d — this flip IS the logical "enter" of `to`, so the tile→status ENTER
   * hook fires here (after `position` is set, so it reads the destination def):
   * mud → poison, water/deep_water → strip burn.
   */
  applyEffect(unit: Unit, world: World, _tickOffset: number, _phase?: ActionPhaseName): void {
    unit.position = this.to;
    world.releaseClaim(this.to);
    world.applyTileEnterEffects(unit);
  }

  /**
   * §35b — a move relocates onto `to`, which must be free. World re-validates it
   * at execution and aborts the move (clean no-op + `unit:moveAborted`) if an
   * earlier-processed unit took the cell this tick.
   */
  destinationCell(): GridCoord {
    return this.to;
  }

  toData(): MoveActionData {
    return { from: this.from, to: this.to, durationTicks: this.durationTicks };
  }

  static fromData(data: MoveActionData): MoveAction {
    return new MoveAction(data.from, data.to, data.durationTicks);
  }
}
