import type { Action, ActionPhase, ActionPhaseName } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const FORCED_MOVE_ACTION_ID = 'forcedMove';

/**
 * The hold a forced move (a push or a pull) puts on its victim while its
 * glyph slides: the unit is already on its landing, and proposes nothing
 * until the slide ends. World seats it (`World.forceMove`); no behaviour
 * proposes it.
 *
 * Its timeline is `travel` for the slide, then `impact`, where the landing
 * tile's enter effects run (`applyEffect`), as a step's run at its flip,
 * then `recovery` for whatever of a spawn's lockout outlasts the slide
 * (`forcedMovePhases`).
 *
 * It has no parameters to serialize: the registry builds a fresh one, and
 * `activeAction`'s ticks and phases carry the window.
 */
export class ForcedMoveAction implements Action {
  readonly id = FORCED_MOVE_ACTION_ID;

  start(_unit: Unit, _world: World): void {}

  /** The landing's entry, as the slide ends: the unit is on its new cell. */
  applyEffect(unit: Unit, world: World, _tickOffset: number, _phase?: ActionPhaseName): void {
    world.applyTileEnterEffects(unit);
  }

  toData(): Record<string, never> {
    return {};
  }

  static fromData(): ForcedMoveAction {
    return new ForcedMoveAction();
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
