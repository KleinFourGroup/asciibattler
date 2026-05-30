import type { Action } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';
import { STATS } from '../../config/stats';

export const CATAPULT_SHOT_ACTION_ID = 'catapult_shot';

export interface CatapultShotActionData {
  /** The locked target's id (homing — resolved via `world.findUnit`). */
  targetId: number;
  /** Damage before the crit factor. */
  baseDamage: number;
  critChance: number;
}

/**
 * E7.D — the catapult's signature: a slow, telegraphed wind-up that lobs a
 * single heavy shot at a LOCKED target (E7.D decision: homing, not the mage's
 * ground-target). The second multi-tick combat action in the game (after
 * `MagicBoltAction`) — it charges for the whole `duration` window, filling
 * the action-progress bar, then lands the hit in `applyEffect` at the
 * `effectTicks: [duration]` offset.
 *
 * Lifecycle (mirrors `MagicBoltAction`; see `World.tick` step 3):
 *   - `start` is a no-op — the shot is winding up. The unit is locked
 *     (`activeAction` set) for the whole charge.
 *   - `applyEffect` fires once, at the tick the charge completes, and the
 *     boulder lands on the locked target.
 *
 * Homing vs. ground-target: the target is captured as a LIVE unit reference
 * (serialized as `targetId`), so the hit follows the unit wherever it moved
 * during the ~wind-up — a reliable artillery strike whose counterplay is
 * rushing/killing the slow catapult mid-charge, not dodging the shot. If the
 * target died (or vanished) during the wind-up, the shot fizzles silently —
 * no damage, no `unit:attacked`, no combatRng draw. (Contrast the mage's
 * `MagicBoltAction`, which is ground-targeted and detonates on a fixed cell
 * even on a whiff.)
 *
 * Single hard hit, ENEMY only: there is exactly one victim (the locked
 * target), so "no friendly fire" is structural — the catapult never targets
 * an ally or neutral (`currentTarget` only commits to enemies). The crit
 * roll happens at impact (one `world.combatRng` draw, in per-unit tick
 * order — same channel `AttackAction`/`MagicBoltAction` use), so determinism
 * holds.
 *
 * Damage scales on `ranged` (E7.D decision — a heavy ranged unit, distinct
 * from the magic mage and the light archer); see `catapultShotDamage`.
 *
 * VFX/audio ride the single `unit:attacked` it emits on a hit: `attackRange
 * > 1` routes it through E6.B's ranged path → one `*` tracer (caster →
 * target) + one `shoot` cue. Single-target means one event, so there's no
 * multishot problem the mage's AoE had — hence no dedicated detonation event.
 *
 * Serialization stores `{ targetId, baseDamage, critChance }`; `fromData`
 * re-resolves the live target via `world.findUnit`, exactly like
 * `AttackAction`, so a mid-charge snapshot round-trips. No WorldSnapshot
 * version bump — the action registers in the factory and the charge window
 * (`startTick`/`finishTick`/`effectTicks`) is already snapshot-carried.
 */
export class CatapultShotAction implements Action {
  readonly id = CATAPULT_SHOT_ACTION_ID;

  constructor(
    private readonly target: Unit | undefined,
    private readonly baseDamage: number,
    private readonly critChance: number,
  ) {}

  start(_unit: Unit, _world: World): void {
    // No immediate effect — the shot is winding up. The boulder lands in
    // `applyEffect` at the end of the charge window.
  }

  applyEffect(unit: Unit, world: World, _tickOffset: number): void {
    // Fizzle if the locked target died or vanished during the wind-up. No
    // combatRng draw on a fizzle so the roll only happens when damage lands.
    if (!this.target || this.target.currentHp <= 0) return;

    const crit = world.combatRng.next() < this.critChance;
    const critFactor = crit ? STATS.critMult : 1;
    const damage = Math.round(this.baseDamage * critFactor);
    if (damage <= 0) return;

    this.target.currentHp -= damage;
    world.recordDamage(unit.id, this.target, damage);
    world.emit('unit:attacked', {
      attackerId: unit.id,
      targetId: this.target.id,
      damage,
      crit,
    });
  }

  toData(): CatapultShotActionData {
    return {
      targetId: this.target?.id ?? -1,
      baseDamage: this.baseDamage,
      critChance: this.critChance,
    };
  }

  static fromData(data: CatapultShotActionData, world: World): CatapultShotAction {
    return new CatapultShotAction(
      world.findUnit(data.targetId),
      data.baseDamage,
      data.critChance,
    );
  }
}
