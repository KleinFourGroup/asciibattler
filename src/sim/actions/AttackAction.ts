import type { Action } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

/**
 * Single-tick melee/ranged attack. All work (damage, event) happens in
 * `start`; no `applyEffect` because there's no delay. The target ref is
 * captured at propose time; since proposal and start run in the same tick,
 * the target can't have moved or died in between.
 *
 * A defensive `currentHp <= 0` guard is still here in case future
 * behaviors interleave attacks within a tick — cheap and prevents
 * posthumous overkill events.
 */
export class AttackAction implements Action {
  readonly id = 'attack';

  constructor(
    private readonly target: Unit,
    private readonly damage: number,
  ) {}

  start(unit: Unit, world: World): void {
    if (this.target.currentHp <= 0) return;
    this.target.currentHp -= this.damage;
    world.emit('unit:attacked', {
      attackerId: unit.id,
      targetId: this.target.id,
      damage: this.damage,
    });
  }
}
