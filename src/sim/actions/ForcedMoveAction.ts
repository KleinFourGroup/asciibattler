import type { Action, ActionPhase, ActionPhaseName } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const FORCED_MOVE_ACTION_ID = 'forcedMove';

/** A forced move's serialized parameters. */
export interface ForcedMoveData {
  readonly pusherId: number | null;
}

/**
 * The hold a forced move (a push or a pull) puts on its victim while its
 * glyph slides: the unit is already on its landing, and proposes nothing
 * until the slide ends. World seats it (`World.forceMove`); no behaviour
 * proposes it.
 *
 * Its timeline is `travel` for the slide, then `impact`, where the unit
 * lands (`applyEffect`, `World.landForcedMove`): the landing tile's enter
 * effects run, as a step's run at its flip, or on a tile that drops the
 * unit falls; then `recovery` for whatever of a spawn's lockout outlasts the
 * slide (`forcedMovePhases`).
 *
 * Its one parameter is `pusherId`, the unit whose push or pull this is,
 * credited if the victim falls; `activeAction`'s ticks and phases carry the
 * window.
 */
export class ForcedMoveAction implements Action {
  readonly id = FORCED_MOVE_ACTION_ID;

  /** `pusherId`: null for a forced move nobody made (a test's bare move). */
  constructor(readonly pusherId: number | null = null) {}

  start(_unit: Unit, _world: World): void {}

  /** The landing, as the slide ends: the unit is on its new cell. */
  applyEffect(unit: Unit, world: World, _tickOffset: number, _phase?: ActionPhaseName): void {
    world.landForcedMove(unit, this.pusherId);
  }

  toData(): ForcedMoveData {
    return { pusherId: this.pusherId };
  }

  static fromData(data: ForcedMoveData): ForcedMoveAction {
    return new ForcedMoveAction(data.pusherId);
  }
}

/**
 * The hold's timeline: the slide's `slideTicks` of `travel`, the `impact`
 * that lands it, and a `recovery` tail when the unit must stay held to
 * `holdTicks` (a spawn's lockout that outlasts the slide).
 */
export function forcedMovePhases(slideTicks: number, holdTicks: number): ActionPhase[] {
  const phases: ActionPhase[] = [
    { phase: 'travel', ticks: slideTicks },
    { phase: 'impact', ticks: 0 },
  ];
  if (holdTicks > slideTicks) phases.push({ phase: 'recovery', ticks: holdTicks - slideTicks });
  return phases;
}
