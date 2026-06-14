import type { GridCoord } from '../../core/types';
import type { Action } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const DASH_ACTION_ID = 'dash';

export interface DashActionData {
  from: GridCoord;
  to: GridCoord;
  durationTicks: number;
}

/**
 * N1 — the rogue's dash LEAP. Mechanically a single-tick relocation like
 * `MoveAction` (position lands in `start` at offset 0; the unit is then locked
 * for the motion window), but it's its OWN action+event so the leap is a
 * first-class signal rather than a `MoveAction` the consumers have to guess at.
 *
 * Why dedicated, not a plain `MoveAction`: a dash that closes on an enemy two
 * cells away lands ADJACENT — a one-cell move, indistinguishable from a normal
 * step by distance — yet it spent the dash cooldown and slid at dash speed. The
 * audio (and the future dash VFX) must key off the LEAP, not the move delta, or
 * those short dashes go silent. So `start` emits both: `unit:moved` (so the
 * renderer lerps the slide via its existing one-unit path — a dash IS one unit
 * moving, unlike a `SwapAction`) and `unit:dashed` (the dash-specific cue).
 *
 * The cooldown is keyed separately (`cooldownKey: 'dash'` on the proposal), so
 * the dash never touches the normal move cadence — see `DashAbility`.
 */
export class DashAction implements Action {
  readonly id = DASH_ACTION_ID;

  constructor(
    private readonly from: GridCoord,
    private readonly to: GridCoord,
    private readonly durationTicks: number,
  ) {}

  start(unit: Unit, world: World): void {
    unit.position = this.to;
    // The slide — identical to a normal step's render path; the dash's short
    // `durationTicks` is what makes it read as a blink rather than a walk.
    world.emit('unit:moved', {
      unitId: unit.id,
      from: this.from,
      to: this.to,
      durationTicks: this.durationTicks,
    });
    // The dash cue — fires on the LEAP itself, so even a one-cell dash whooshes.
    world.emit('unit:dashed', {
      unitId: unit.id,
      from: this.from,
      to: this.to,
      durationTicks: this.durationTicks,
    });
  }

  toData(): DashActionData {
    return { from: this.from, to: this.to, durationTicks: this.durationTicks };
  }

  static fromData(data: DashActionData): DashAction {
    return new DashAction(data.from, data.to, data.durationTicks);
  }
}
