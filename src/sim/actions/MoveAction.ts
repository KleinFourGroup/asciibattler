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
 * A one-cell move. `start` claims the destination and emits `unit:moved`, but
 * the unit's position stays at `from`; the flip to `to`, and the claim's
 * release, come in `applyEffect` at the `impact` boundary, which `moveProposal`
 * places at `SIM.moveFlipFraction` of the move. Before the flip the unit stands
 * on `from` and holds `to`; after it, it stands on `to`. So `to` is blocked to
 * other units' pathing throughout, claimed and then occupied, and no two units
 * converge on it. The renderer slides the glyph across the whole window from
 * `unit:moved`'s `durationTicks`, apart from the flip.
 *
 * A behaviour that steps builds one per proposal.
 */
export class MoveAction implements Action {
  readonly id = MOVE_ACTION_ID;

  constructor(
    private readonly from: GridCoord,
    private readonly to: GridCoord,
    private readonly durationTicks: number,
  ) {}

  start(unit: Unit, world: World): void {
    // Hold the destination until the flip. A one-tick move's `impact` is at
    // offset 0, so `start` and `applyEffect` run on the same tick and the claim
    // is taken and released at once.
    world.claimCell(this.to, unit.id);
    world.emit('unit:moved', {
      unitId: unit.id,
      from: this.from,
      to: this.to,
      durationTicks: this.durationTicks,
    });
  }

  /**
   * The flip, at the `impact` boundary: the unit moves onto `to` and the claim
   * is released. Before it the unit reads as on `from` to targeting, adjacency
   * and pathing, which all read `unit.position`; after it, as arrived. A unit
   * that dies before the flip never gets here, and the reap releases its claim
   * (`releaseClaimsBy`).
   *
   * The flip is when the unit enters `to`, so the tile's enter effects
   * (`applyTileEnterEffects`) run here, after `position` is set, so they read
   * the destination's tile.
   */
  applyEffect(unit: Unit, world: World, _tickOffset: number, _phase?: ActionPhaseName): void {
    unit.position = this.to;
    world.releaseClaim(this.to);
    world.applyTileEnterEffects(unit);
  }

  /**
   * The cell the move lands on, which must be free. World checks it again as
   * the move starts and aborts it (nothing changes, and `unit:moveAborted`
   * fires) if a unit that acted earlier this tick took the cell.
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
