import type { Action, OrphanPolicy } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import { STATS } from '../../config/stats';

export const CATAPULT_SHOT_ACTION_ID = 'catapult_shot';

export interface CatapultShotActionData {
  /** The locked target's id (homing — resolved via `world.findUnit`). */
  targetId: number;
  /** Damage before the crit factor. */
  baseDamage: number;
  critChance: number;
  /**
   * The target's cell at cast START. A VFX-only fallback for the impact
   * position when the live target ref is gone (e.g. a snapshot dropped it),
   * so `catapult:fired` always carries somewhere for the lob to land. The
   * damage still homes on the live `target` ref — this is never the hit cell
   * while the target exists.
   */
  castPosition: GridCoord;
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
 * target died (or vanished) during the wind-up, the shot deals no damage and
 * skips the combatRng draw — but it is NOT silent: see the `catapult:fired`
 * note below. (Contrast the mage's `MagicBoltAction`, which is ground-targeted
 * and detonates on a fixed cell even on a whiff.)
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
 * VFX/audio ride the `catapult:fired` event it emits ONCE per shot, ALWAYS
 * (hit or abort) — the render layer flies one arcing projectile to `impact`
 * and shows a dud puff when `hit` is false, so an aborted shot reads as a
 * lobbed-but-fizzled boulder instead of nothing. (The per-hit `unit:attacked`
 * still floats the damage hitsplat + refreshes the HP bar; the catapult is
 * skipped in `BattleRenderer.triggerAttackVisual` so it doesn't ALSO spawn a
 * straight tracer — mirrors the mage's `magic:detonated` split.)
 *
 * Serialization stores `{ targetId, baseDamage, critChance }`; `fromData`
 * re-resolves the live target via `world.findUnit`, exactly like
 * `AttackAction`, so a mid-charge snapshot round-trips. No WorldSnapshot
 * version bump — the action registers in the factory and the charge window
 * (`startTick`/`finishTick`/`effectTicks`) is already snapshot-carried.
 */
export class CatapultShotAction implements Action {
  readonly id = CATAPULT_SHOT_ACTION_ID;
  // F2 — fizzle: the shot homes on the LOCKED target; if it died during the
  // wind-up OR the F3 travel window the boulder lands with no damage + no
  // combatRng draw (still emits `catapult:fired{hit:false}`). The death is
  // observed by the impact-time `hit` guard in `applyEffect`, which sits at
  // the same impact offset regardless of how the wind-up is split — so no
  // separate travel-orphan resolver is needed.
  readonly orphanPolicy: OrphanPolicy = 'fizzle';

  constructor(
    private readonly target: Unit | undefined,
    private readonly baseDamage: number,
    private readonly critChance: number,
    private readonly castPosition: GridCoord,
  ) {}

  start(_unit: Unit, _world: World): void {
    // No immediate effect — the shot is winding up. The boulder lands in
    // `applyEffect` at the end of the charge window.
  }

  applyEffect(unit: Unit, world: World, _tickOffset: number): void {
    // Did the locked target survive the wind-up? A dead-but-still-referenced
    // target (object persists after removal) reads its last cell; a target
    // dropped by a snapshot falls back to the cast cell.
    const hit = !!this.target && this.target.currentHp > 0;
    const impact = this.target ? this.target.position : this.castPosition;

    // Announce the shot ONCE, ALWAYS — hit or abort — so the render + audio
    // layers play one lobbed projectile (a dud on an abort) instead of the
    // per-hit `unit:attacked` stream, which is silent on a miss. Emitted
    // before the damage so the "loose" is the first signal of the shot.
    world.emit('catapult:fired', { casterId: unit.id, impact: { ...impact }, hit });

    // Fizzle: no damage, and no combatRng draw — the crit roll only happens
    // when damage actually lands (keeps the draw out of the abort path).
    if (!hit) return;

    const crit = world.combatRng.next() < this.critChance;
    const critFactor = crit ? STATS.critMult : 1;
    const damage = Math.round(this.baseDamage * critFactor);
    if (damage <= 0) return;

    // GP2 — the single heavy hit funnels through the shared `world.applyDamage`
    // chokepoint (HP mutation + XP ledger + `unit:attacked` emit + defense
    // mitigation). The fizzle/`damage <= 0` guards above stay here.
    // I2 — the catapult is UNMISSABLE (no `evadable`): its counterplay is
    // rushing/killing the slow caster mid-charge, not dodging the lobbed shot
    // (the homing design fiction above), so it never rolls precision-vs-evasion.
    world.applyDamage(unit.id, this.target!, damage, { crit, evadable: false });
  }

  phaseTarget(): { targetId?: number | undefined; targetCell?: GridCoord } {
    // Homing id for the live target; cast cell as the fixed VFX fallback for
    // when the target ref is gone (mirrors `catapult:fired.impact`).
    return { targetId: this.target?.id, targetCell: { ...this.castPosition } };
  }

  toData(): CatapultShotActionData {
    return {
      targetId: this.target?.id ?? -1,
      baseDamage: this.baseDamage,
      critChance: this.critChance,
      castPosition: { ...this.castPosition },
    };
  }

  static fromData(data: CatapultShotActionData, world: World): CatapultShotAction {
    return new CatapultShotAction(
      world.findUnit(data.targetId),
      data.baseDamage,
      data.critChance,
      { ...data.castPosition },
    );
  }
}
