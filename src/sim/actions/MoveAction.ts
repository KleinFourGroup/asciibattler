import type { GridCoord } from '../../core/types';
import type { Action } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const MOVE_ACTION_ID = 'move';

export interface MoveActionData {
  from: GridCoord;
  to: GridCoord;
  durationTicks: number;
}

/**
 * Single-step grid movement. Position update is instantaneous on `start`;
 * the renderer reads `durationTicks` from the emitted `unit:moved` event
 * and lerps the sprite from `from` to `to` over that wall-clock window.
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
    unit.position = this.to;
    world.emit('unit:moved', {
      unitId: unit.id,
      from: this.from,
      to: this.to,
      durationTicks: this.durationTicks,
    });
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
