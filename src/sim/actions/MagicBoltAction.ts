import type { Action, OrphanPolicy } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import { STATS } from '../../config/stats';

export const MAGIC_BOLT_ACTION_ID = 'magic_bolt';

export interface MagicBoltActionData {
  /** Ground-targeted blast center, captured at cast START (E7.C decision). */
  center: GridCoord;
  /** Center-cell damage before crit + the ring multiplier. */
  baseDamage: number;
  critChance: number;
  /** Chebyshev radius of the blast (1 = 3×3). */
  radius: number;
  /** Damage factor on ring cells (everything but the center). */
  ringMultiplier: number;
}

/**
 * E7.C — the mage's signature: a charged, ground-targeted area blast. This
 * is the FIRST multi-tick combat action in the game and the first real
 * consumer of A1's `effectTicks` / the dormant `.action-progress` bar.
 *
 * Lifecycle (see `World.tick` step 3 + the `multiTick.test.ts` contract):
 *   - `start` is a deliberate no-op — it marks the beginning of the
 *     charge. The unit is locked (`activeAction` set) for the whole
 *     `duration` window, during which the render layer fills the action
 *     progress bar.
 *   - `applyEffect` fires once, at the `effectTicks: [duration]` offset —
 *     i.e. the exact tick the charge completes — and detonates the blast.
 *
 * The blast is **ground-targeted**: `center` is the target's cell at cast
 * time, frozen on the instance. Enemies that wander out of the area during
 * the ~2s charge escape it; enemies that wander in get caught; and the area
 * still detonates if the original target dies mid-charge. (The alternative —
 * homing onto the target's live cell at impact — was considered and the
 * fixed-center "telegraph" was the chosen design.)
 *
 * Damage shape: the center cell takes full `baseDamage`; every other cell
 * within `radius` (Chebyshev) takes `round(baseDamage × ringMultiplier)`.
 * A single crit roll (off `world.combatRng`, at detonation) applies to the
 * WHOLE blast — keeping the determinism to one draw per detonation, in
 * the per-unit tick order, mirroring `AttackAction`.
 *
 * Who it hits: ENEMY combatants only — same-team units are spared
 * (`affectsFriendly` is implicitly off; there's no friendly-fire consumer
 * yet) and neutral walls / half-cover are spared (wall destructibility
 * stays deferred per the E7.C scope — the neutrals overhaul owns it). Each
 * hit reuses the existing `unit:attacked` event so E6.C hitsplats, the HP
 * bar refresh, and the E4 XP ledger all light up with no new wiring.
 *
 * Serialization stores `{ center, baseDamage, critChance, radius,
 * ringMultiplier }` — all plain data, no live unit reference, so
 * `fromData` needs no `world` lookup. The caster is the live `unit` passed
 * to `applyEffect`, so `unit.team` (the "who's an enemy" basis) is correct
 * after a mid-charge round-trip too.
 */
export class MagicBoltAction implements Action {
  readonly id = MAGIC_BOLT_ACTION_ID;
  // F2 — ground-target: the blast detonates on the fixed `center` cell and
  // hits whoever stands there at impact, so a dead original target is
  // irrelevant (no fizzle). Phase list `[{windup,D},{impact,0}]`; the
  // detonation is `applyEffect` at the impact boundary.
  readonly orphanPolicy: OrphanPolicy = 'ground-target';

  constructor(
    private readonly center: GridCoord,
    private readonly baseDamage: number,
    private readonly critChance: number,
    private readonly radius: number,
    private readonly ringMultiplier: number,
  ) {}

  start(_unit: Unit, _world: World): void {
    // No immediate effect — the bolt is charging. The blast lands in
    // `applyEffect` at the end of the charge window.
  }

  applyEffect(unit: Unit, world: World, _tickOffset: number): void {
    // Announce the detonation ONCE, regardless of how many units the blast
    // hits (zero included — a whiff). The render + audio layers play a single
    // projectile → explosion + cast sound off this, instead of the per-victim
    // `unit:attacked` stream (which would read/sound like multishot, and is
    // silent on a miss). Emitted before the damage loop so the "boom" is the
    // first signal of the cast resolving.
    world.emit('magic:detonated', { casterId: unit.id, center: { ...this.center } });

    // One crit roll for the whole blast (determinism: a single combatRng
    // draw per detonation, in tick order — same channel AttackAction uses).
    const crit = world.combatRng.next() < this.critChance;
    const critFactor = crit ? STATS.critMult : 1;

    // Iterate a snapshot so an emit-time subscriber that mutates `units`
    // can't perturb the blast's victim set mid-loop.
    for (const target of world.units.slice()) {
      if (target.currentHp <= 0) continue;
      // Enemies only: skip the caster's own team (covers self + allies) and
      // neutrals (walls / half-cover — destructibility deferred).
      if (target.team === unit.team) continue;
      if (target.team === 'neutral') continue;
      const dist = chebyshev(target.position, this.center);
      if (dist > this.radius) continue;

      const cellMult = dist === 0 ? 1 : this.ringMultiplier;
      const damage = Math.round(this.baseDamage * critFactor * cellMult);
      if (damage <= 0) continue;

      // GP2 — per-cell damage funnels through the shared `world.applyDamage`
      // chokepoint (HP mutation + XP ledger + `unit:attacked` emit + defense
      // mitigation). The `damage <= 0` / team / radius gates above stay here —
      // they decide WHICH cells are victims; applyDamage applies a confirmed hit.
      world.applyDamage(unit.id, target, damage, { crit });
    }
  }

  phaseTarget(): { targetCell?: GridCoord } {
    return { targetCell: { ...this.center } };
  }

  toData(): MagicBoltActionData {
    return {
      center: { ...this.center },
      baseDamage: this.baseDamage,
      critChance: this.critChance,
      radius: this.radius,
      ringMultiplier: this.ringMultiplier,
    };
  }

  static fromData(data: MagicBoltActionData): MagicBoltAction {
    return new MagicBoltAction(
      { ...data.center },
      data.baseDamage,
      data.critChance,
      data.radius,
      data.ringMultiplier,
    );
  }
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
