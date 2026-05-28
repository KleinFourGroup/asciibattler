import type { Action } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';
import { STATS } from '../../config/stats';

export const ATTACK_ACTION_ID = 'attack';

export interface AttackActionData {
  targetId: number;
  baseDamage: number;
  critChance: number;
}

/**
 * Single-tick melee/ranged attack. All work happens in `start`; no
 * `applyEffect` because there's no delay. The target ref is captured at
 * propose time; since proposal and start run in the same tick, the
 * target can't have moved or died in between.
 *
 * E1: damage resolution moved from propose-time to start-time. The
 * proposal carries `baseDamage` (the attacker's basic strike stat —
 * `strength` for melee, `ranged` for archers, sourced via
 * `basicAttackDamage`) and `critChance` (the derived probability).
 * `start` draws once from `world.combatRng` and multiplies by
 * `STATS.critMult` on a crit. Keeping the RNG draw at start (not
 * propose) means the sim's tick determinism stays intact: one combatRng
 * draw per attack action, in selector order.
 *
 * A defensive `currentHp <= 0` guard is still here in case future
 * behaviors interleave attacks within a tick — cheap and prevents
 * posthumous overkill events.
 *
 * Serialization stores `targetId` rather than the live Unit reference;
 * the registry factory resolves it back via `world.findUnit`. If the
 * target died between snapshot and rehydrate, `target` is undefined
 * and `start` short-circuits safely.
 */
export class AttackAction implements Action {
  readonly id = ATTACK_ACTION_ID;

  constructor(
    private readonly target: Unit | undefined,
    private readonly baseDamage: number,
    private readonly critChance: number,
  ) {}

  start(unit: Unit, world: World): void {
    if (!this.target || this.target.currentHp <= 0) return;
    const crit = world.combatRng.next() < this.critChance;
    const damage = crit
      ? Math.round(this.baseDamage * STATS.critMult)
      : this.baseDamage;
    this.target.currentHp -= damage;
    // E4 — feed the World's XP ledger. World filters team relationship
    // (no self-damage / neutral damage), so the call is unconditional.
    world.recordDamage(unit.id, this.target, damage);
    world.emit('unit:attacked', {
      attackerId: unit.id,
      targetId: this.target.id,
      damage,
      crit,
    });
  }

  toData(): AttackActionData {
    return {
      targetId: this.target?.id ?? -1,
      baseDamage: this.baseDamage,
      critChance: this.critChance,
    };
  }

  static fromData(data: AttackActionData, world: World): AttackAction {
    return new AttackAction(
      world.findUnit(data.targetId),
      data.baseDamage,
      data.critChance,
    );
  }
}
