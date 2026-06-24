/**
 * E1 — derive per-unit computed values from base stats + archetype
 * context. Pure functions: same inputs → same outputs, no RNG.
 *
 * I6 — crit left `deriveStats`: it is resolved PER-ABILITY at attack time via
 * `critChanceFor(ability.critBase, unit.stats.luck)` (gated on
 * `ability.critable`), so there is no per-unit `critChance` to derive. The
 * RNG crit roll still happens at action start/impact off `world.combatRng`;
 * only the probability's source moved (unit-derived → per-ability).
 *
 * Formula sources (`config/stats.json`):
 *
 *   maxHp                   = max(1, round(hpPerConstitution * constitution))
 *   moveCooldown            = max(1, secondsToTicks(baseMoveCD * cooldownScale(mobility, mobilityCdPerStat, mobilityMinCdScale)))
 *   cooldownScale(s, p, m)  = max(m, 1 - s * p)
 *   attackRange             = effective engagement range (max over the unit's
 *                             abilities, via `rangeForArchetype`), passed through verbatim
 *
 * The 1-tick cooldown floor catches future tuning where the min scale
 * or base values drop low enough to round to 0; at default config it's
 * unreachable.
 *
 * GP1: the two cadence stats drive cooldowns through SEPARATE per-axis
 * knobs so they can diverge — `mobility` (move CD) reads
 * `mobilityCdPerStat`/`mobilityMinCdScale`; `speed` (attack cadence; I1
 * reverted the GP1 `agility` name) reads `speedCdPerStat`/`speedMinCdScale`.
 * `cooldownScale` is now
 * parameterized over (perStat, minScale) and each call site threads its
 * own pair. `mobility` is signed: negative → scale > 1 → slower than the
 * baseline (the min-scale floor caps only the fast side). GP1 also
 * dropped the per-archetype `baseMoveCooldownSeconds` override — there's
 * one universal `STATS.baseMoveCooldownSeconds`, and a slow walk now
 * comes from low/negative mobility.
 *
 * E5 pre-work: attack cadence is NO LONGER derived here. It moved to
 * the Ability layer — a unit can carry several abilities with different
 * timings, so a single per-unit `attackCooldownTicks` couldn't
 * represent them. `attackCooldownTicksFor` resolves an ability's
 * `cooldownSeconds` (from `config/abilities.json`) against the unit's
 * `speed` at propose time, reusing the same `cooldownScale` curve.
 *
 * `inertDerived` is the environment-entity path (walls / half-cover) —
 * non-combatants need a maxHp anchor for HP display and the future
 * destructibility plumbing, but no cooldowns / crit / range.
 *
 * `basicAttackDamage` answers "which stat drives this unit's basic
 * strike?" — melee → strength, ranged → ranged. Lives here (not inside
 * AttackBehavior) so E2's Ability system can generalize the lookup to
 * a per-ability stat tag without duplicating the per-archetype switch.
 */

import { secondsToTicks } from '../config';
import { STATS } from '../config/stats';
import type { Unit, UnitArchetype, UnitDerived, UnitStats } from './Unit';

export function deriveStats(stats: UnitStats, attackRange: number): UnitDerived {
  return {
    maxHp: Math.max(1, Math.round(STATS.hpPerConstitution * stats.constitution)),
    moveCooldownTicks: Math.max(
      1,
      secondsToTicks(
        STATS.baseMoveCooldownSeconds *
          cooldownScale(stats.mobility, STATS.mobilityCdPerStat, STATS.mobilityMinCdScale),
      ),
    ),
    attackRange,
  };
}

/**
 * E5 pre-work — resolve an ability's attack cadence to ticks for a
 * specific unit. `cooldownSeconds` is the ability's authored base
 * interval (`config/abilities.json`); the unit's `speed` shrinks it via
 * the same `cooldownScale` curve that governs movement (GP1: through the
 * speed-axis knobs, independent of the mobility ones), so nimbler units
 * still swing/shoot more often. Floored at 1 tick (mirrors the move-CD
 * floor) so an extreme base/scale combo can't round to a 0-tick — i.e.
 * fire-every-tick — cadence.
 */
export function attackCooldownTicksFor(cooldownSeconds: number, speed: number): number {
  return Math.max(
    1,
    secondsToTicks(
      cooldownSeconds * cooldownScale(speed, STATS.speedCdPerStat, STATS.speedMinCdScale),
    ),
  );
}

/**
 * Phase Yb — scale a timeline phase's authored duration (seconds) by the caster's
 * `speed`, through the SAME curve + knobs as the attack cadence
 * (`attackCooldownTicksFor`). Lets a FIXED phase — a charged spell's windup —
 * shrink with speed instead of staying constant, so speeding the cadence speeds
 * the whole cast (not just the elastic `recovery` tail) and the cast keeps the
 * full speed range rather than a fixed phase clamping a floor under it. Pure
 * seconds→seconds; the caller floors via `secondsToTicks`. Unscaled phases (a
 * projectile's physical travel) simply skip this. Unlike the cadence, NOT floored
 * at 1 tick — a phase may legitimately resolve to 0 (an instant boundary).
 */
export function speedScaledSeconds(seconds: number, speed: number): number {
  return seconds * cooldownScale(speed, STATS.speedCdPerStat, STATS.speedMinCdScale);
}

/**
 * Environment entity derived values. Caller passes the desired maxHp;
 * the rest are zero/no-op. Walls + half-cover go through this path.
 */
export function inertDerived(maxHp: number): UnitDerived {
  return {
    maxHp,
    moveCooldownTicks: 0,
    attackRange: 0,
  };
}

/**
 * E1 — which base stat drives a unit's basic strike, given its archetype +
 * stat block. The SINGLE source of truth for the archetype→damage-stat
 * mapping, shared by the sim (`basicAttackDamage`) and the display surfaces
 * (HUD + RecruitScreen "ATK" rows) so they can never disagree. Melee + rogue
 * strike on `strength`; ranged on `ranged`. Environment entities don't
 * strike — the 0 is type-completeness + a guard if a future path asks.
 */
export function damageStatFor(archetype: UnitArchetype, stats: UnitStats): number {
  switch (archetype) {
    // I5 — the whole melee family strikes on `strength` (mercenary = the old
    // melee baseline; adventurer/ronin/bandit diverge only in their other
    // stats, all still swinging on strength via `melee_strike`).
    case 'mercenary':
    case 'adventurer':
    case 'ronin':
    case 'bandit':
      return stats.strength;
    case 'ranged':
      return stats.ranged;
    // E7.A — rogue is a melee striker: its gambit damage scales on
    // strength, with the payoff coming from its high luck (crit) rather
    // than raw strength. Its identity is mobility + crit, not big hits.
    case 'rogue':
      return stats.strength;
    // E7.B — the healer has no basic strike at all (its only ability is
    // `heal_ally`, which restores HP via `healAmountFor`, not damage). The
    // 0 keeps the switch exhaustive; nothing calls `basicAttackDamage` on a
    // healer because it carries no strike ability.
    case 'healer':
      return 0;
    // E7.C — the mage's damage is its `magic_bolt` (resolved via
    // `magicBoltDamage` below), but the display surfaces (HUD / RecruitScreen
    // "ATK" row) read this single source of truth, so a mage's shown attack
    // stat is its `magic`. The sim never calls `basicAttackDamage` on a mage
    // (it carries no basic strike) — the case keeps the switch exhaustive AND
    // gives the display the right stat.
    case 'mage':
      return stats.magic;
    // E7.D — the catapult is a heavy RANGED unit: its `catapult_shot` damage
    // scales on `ranged` (resolved via `catapultShotDamage` below). The sim
    // never calls `basicAttackDamage` on a catapult (it carries no basic
    // strike), but the display surfaces (HUD / RecruitScreen "ATK" row) read
    // this single source of truth — so a catapult's shown attack stat is its
    // `ranged`. The case also keeps the switch exhaustive.
    case 'catapult':
      return stats.ranged;
    case 'environment':
      return 0;
  }
}

/**
 * E1 — basic-strike damage for a live unit. I6: `might` (the firing weapon's
 * flat base, from `config/abilities.json`) ADDED to the archetype's scaling
 * stat (`damageStatFor`), so a club (+2) and a sword (+5) hit differently on
 * the same strength. Pre-crit, pre-defense.
 */
export function basicAttackDamage(unit: Unit, might: number): number {
  return might + damageStatFor(unit.archetype, unit.effectiveStats);
}

/**
 * E7.B — HP restored by a healer's `heal_ally` cast. Scales on `magic` (raw),
 * mirroring how `basicAttackDamage` reads `strength`/`ranged` for strikes. I6:
 * `might` (the ability's flat heal base) adds on top — `might + magic`.
 */
export function healAmountFor(unit: Unit, might: number): number {
  return might + unit.effectiveStats.magic;
}

/**
 * E7.C — base damage of a mage's `magic_bolt` (the center-cell hit, before
 * the crit factor and the per-cell AoE ring multiplier). Scales on `magic`
 * (raw), mirroring `basicAttackDamage`. I6: `might + magic`.
 */
export function magicBoltDamage(unit: Unit, might: number): number {
  return might + unit.effectiveStats.magic;
}

/**
 * E7.D — base damage of a catapult's `catapult_shot` (before the crit
 * factor). Scales on `ranged` (raw), mirroring `magicBoltDamage`. I6:
 * `might + ranged`.
 */
export function catapultShotDamage(unit: Unit, might: number): number {
  return might + unit.effectiveStats.ranged;
}

/**
 * I2 — to-hit probability for a single-target strike (melee/ranged basic + the
 * rogue gambit). Fire-Emblem subtractive: the attacker's `precision` raises it,
 * the target's `evasion` lowers it, clamped to the configured floor/cap. Pure
 * (no RNG) — the World rolls `combatRng` against this once at the
 * `applyDamage` chokepoint when the caller opts in via `evadable`. The mage
 * blast, the catapult shot, and environmental fire/chasm damage never call it
 * (unmissable).
 *
 * I6 — `accuracy` (the firing ability's per-weapon base hit chance, from
 * `config/abilities.json`) REPLACES the old global `STATS.hitChanceBase`, so a
 * precise bow and a wild club start from different bases before the
 * precision/evasion spread. With uniform `precision == evasion` the prc/eva
 * terms cancel and the unit sits at the ability's `accuracy`. The floor keeps a
 * low-precision attacker from being fully shut out by a high-evasion target
 * (the chip-always-pokes-through analogue of `minDamage`).
 */
export function hitChanceFor(accuracy: number, precision: number, evasion: number): number {
  const raw =
    accuracy +
    precision * STATS.hitChancePerPrecision -
    evasion * STATS.dodgeChancePerEvasion;
  return Math.min(STATS.hitChanceCap, Math.max(STATS.hitChanceFloor, raw));
}

/**
 * I6 — crit probability for an attack, resolved per-ability at attack time
 * (replaces the old per-unit `UnitDerived.critChance`). The firing ability's
 * `critBase` is the floor; the wielder's `luck` adds `luck·critPerLuck` on top,
 * capped at `critCap`: `clamp(critBase + luck·critPerLuck, 0, critCap)`. Pure
 * (no RNG) — the action rolls `combatRng` against this once. Callers pass 0
 * (skip the call) when the ability is NOT `critable`; with `critBase 0` this
 * reproduces the pre-I6 `min(critCap, luck·critPerLuck)` exactly.
 */
export function critChanceFor(critBase: number, luck: number): number {
  const raw = critBase + luck * STATS.critPerLuck;
  return Math.min(STATS.critCap, Math.max(0, raw));
}

/**
 * GP1 — the shared cooldown curve, now parameterized over its slope
 * (`perStat`) and fast-side floor (`minScale`) so the move axis (mobility)
 * and the attack axis (speed) can thread independent knobs. `max(minScale,
 * …)` caps only the FAST side: a negative `stat` makes `1 - stat*perStat`
 * exceed 1 (slower than baseline), and that larger value wins the `max`, so
 * the slow side is unbounded.
 */
function cooldownScale(stat: number, perStat: number, minScale: number): number {
  return Math.max(minScale, 1 - stat * perStat);
}

/**
 * All-zero stat block. Used for environment entities (walls,
 * half-cover) — they have no meaningful stats, but UnitStats is a
 * required init field. Kept as a single shared frozen literal so
 * spawn sites don't reconstruct it.
 */
export const ZERO_STATS: UnitStats = Object.freeze({
  constitution: 0,
  strength: 0,
  ranged: 0,
  magic: 0,
  luck: 0,
  defense: 0,
  precision: 0,
  evasion: 0,
  speed: 0,
  mobility: 0,
  power: 0,
});
