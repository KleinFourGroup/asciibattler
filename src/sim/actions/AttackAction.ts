import type { Action } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const ATTACK_ACTION_ID = 'attack';

export interface AttackActionData {
  targetId: number;
  damage: number;
}

/**
 * Single-tick melee/ranged attack. All work (damage, event) happens in
 * `start`; no `applyEffect` because there's no delay. The target ref is
 * captured at propose time; since proposal and start run in the same tick,
 * the target can't have moved or died in between.
 *
 * A defensive `currentHp <= 0` guard is still here in case future
 * behaviors interleave attacks within a tick — cheap and prevents
 * posthumous overkill events.
 *
 * Serialization stores `targetId` rather than the live Unit reference;
 * the registry factory resolves it back to a unit via `world.findUnit`.
 * If the target died between snapshot and rehydrate, `target` will be
 * undefined and `start`/`applyEffect` short-circuit safely. (For basic
 * attacks the snapshot is post-`start` so this case is academic, but the
 * pattern generalizes to charge-ups whose target may die during windup.)
 */
export class AttackAction implements Action {
  readonly id = ATTACK_ACTION_ID;

  constructor(
    private readonly target: Unit | undefined,
    private readonly damage: number,
  ) {}

  start(unit: Unit, world: World): void {
    if (!this.target || this.target.currentHp <= 0) return;
    this.target.currentHp -= this.damage;
    world.emit('unit:attacked', {
      attackerId: unit.id,
      targetId: this.target.id,
      damage: this.damage,
    });
  }

  toData(): AttackActionData {
    return { targetId: this.target?.id ?? -1, damage: this.damage };
  }

  static fromData(data: AttackActionData, world: World): AttackAction {
    return new AttackAction(world.findUnit(data.targetId), data.damage);
  }
}
