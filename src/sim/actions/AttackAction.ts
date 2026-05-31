import type { Action, OrphanPolicy } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';
import { STATS } from '../../config/stats';

export const ATTACK_ACTION_ID = 'attack';

export interface AttackActionData {
  targetId: number;
  baseDamage: number;
  critChance: number;
  /**
   * E4: pre-crit multiplier applied to `baseDamage` at start. Defaults
   * to 1; basic strikes set < 1 when the shot crosses a half-cover
   * unit on the LOS line (see `proposeBasicStrike`). Round happens
   * after both crit + cover multiply, so a 50% half-cover crit reads
   * `round(base × critMult × 0.5)`.
   */
  damageMultiplier: number;
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
  // F2 — single-tick: the damage resolves against the ref captured at cast
  // (in `start`), guarded if the target died earlier this tick. Phase list
  // is `[{impact,0},{recovery,D}]`; the effect stays in `start`.
  readonly orphanPolicy: OrphanPolicy = 'commit-at-cast';

  constructor(
    private readonly target: Unit | undefined,
    private readonly baseDamage: number,
    private readonly critChance: number,
    private readonly damageMultiplier: number = 1,
  ) {}

  start(unit: Unit, world: World): void {
    if (!this.target || this.target.currentHp <= 0) return;
    const crit = world.combatRng.next() < this.critChance;
    const critFactor = crit ? STATS.critMult : 1;
    const damage = Math.round(this.baseDamage * critFactor * this.damageMultiplier);
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

  phaseTarget(): { targetId?: number | undefined } {
    return { targetId: this.target?.id };
  }

  toData(): AttackActionData {
    return {
      targetId: this.target?.id ?? -1,
      baseDamage: this.baseDamage,
      critChance: this.critChance,
      damageMultiplier: this.damageMultiplier,
    };
  }

  static fromData(data: AttackActionData, world: World): AttackAction {
    return new AttackAction(
      world.findUnit(data.targetId),
      data.baseDamage,
      data.critChance,
      // Default to 1 when an older snapshot omits the field; AttackAction
      // is the only loaded place that reads it.
      data.damageMultiplier ?? 1,
    );
  }
}
