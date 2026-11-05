/**
 * The stat sheet's model: a unit's expected stats at a level, and its
 * maximum damage a second against a target standing in range. Range and
 * movement are ignored, so every figure is a ceiling on what play gives.
 *
 * It calls the game's own functions wherever one exists, so the sheet
 * cannot drift from the sim: `scaledUnit` for an enemy's stats,
 * `resolveDamageScalars` for a strike's base and crit chance,
 * `resolveCadenceTicks` for its period. Two steps of a strike are written
 * inline in the sim and are written again here: the crit's multiplier
 * (`interpreter.ts`, the damage op) and the defense's subtraction with its
 * floor (`World.dealDamage`). `tests/tools/stat-sheet.test.ts` pins this
 * file against the raw config, and the stop's check measures it against
 * the sim's own swings.
 */

import { TICK_RATE } from '../../src/config';
import { abilityDef, damageOpOf } from '../../src/config/abilities';
import { STATS } from '../../src/config/stats';
import { UNIT_DEFS } from '../../src/config/units';
import { scaledUnit } from '../../src/sim/archetypes';
import { resolveCadenceTicks } from '../../src/sim/effects/timeline';
import { resolveDamageScalars } from '../../src/sim/effects/resolveScalars';
import type { UnitStats } from '../../src/sim/Unit';

/** Which way a unit's level-ups are built. */
export type Side = 'player' | 'enemy';

const STAT_KEYS = [
  'constitution',
  'strength',
  'ranged',
  'magic',
  'luck',
  'defense',
  'speed',
  'mobility',
  'power',
] as const satisfies readonly (keyof UnitStats)[];

/**
 * A unit's stats at `level`. A player unit's level-up adds 1 to each stat
 * with its growth rate as the chance (`simulateLevelUps`), so its expected
 * stat is `base + growth × (level − 1)`, left unrounded. An enemy is built
 * on the rounded path the game fields it on (`scaledUnit`).
 */
export function statsAt(archetype: string, level: number, side: Side): UnitStats {
  const def = UNIT_DEFS[archetype];
  if (!def) throw new Error(`statsAt: no combatant '${archetype}'`);
  if (side === 'enemy') return { ...scaledUnit(archetype, level).stats };
  const n = Math.max(0, level - 1);
  const out = {} as Record<keyof UnitStats, number>;
  for (const key of STAT_KEYS) out[key] = def.baseStats[key] + def.growthRates[key] * n;
  return out;
}

/** Hit points: constitution times `hpPerConstitution`, at least 1. The game
 *  rounds the product (`deriveStats`); on whole stats at a rate of 1 that
 *  round changes nothing, and leaving it out keeps a player's expectation
 *  unrounded. */
export function maxHpOf(stats: UnitStats): number {
  return Math.max(1, STATS.hpPerConstitution * stats.constitution);
}

/** The unit's weapon: its one ability with a top-level damage op, or
 *  undefined for a unit whose abilities have none: a healer, a summoner, a
 *  pure status, and a chain, whose damage sits inside its `chain` op. */
export function weaponOf(archetype: string): string | undefined {
  const def = UNIT_DEFS[archetype];
  if (!def) throw new Error(`weaponOf: no combatant '${archetype}'`);
  return def.abilities.find((id) => damageOpOf(id) !== undefined);
}

/** Seconds between two strikes of `abilityId` at this speed. */
export function strikePeriodSeconds(abilityId: string, speed: number): number {
  return resolveCadenceTicks(abilityDef(abilityId), speed) / TICK_RATE;
}

/**
 * The expected damage of one strike of `abilityId` against a target with
 * `targetDefense`: `(1 − p) · hit(B) + p · hit(B × critMult)`, where B is
 * the strike's base and p its crit chance, and `hit` takes the defense off
 * with the floor of `minDamage` unless the op bypasses defense. The game
 * rounds `B × critMult`; with whole stats and a whole multiplier the round
 * changes nothing, so it is left out here too (the test guards the
 * multiplier).
 */
export function expectedStrike(attacker: UnitStats, abilityId: string, targetDefense: number): number {
  const op = damageOpOf(abilityId);
  if (!op) return 0;
  const { baseDamage, critChance } = resolveDamageScalars(op, attacker);
  const hit = (raw: number): number =>
    op.bypassDefense ? raw : Math.max(STATS.minDamage, raw - targetDefense);
  return (1 - critChance) * hit(baseDamage) + critChance * hit(baseDamage * STATS.critMult);
}

/** Damage a second at the strike's cadence, standing in range. */
export function expectedDps(attacker: UnitStats, abilityId: string, targetDefense: number): number {
  return expectedStrike(attacker, abilityId, targetDefense) / strikePeriodSeconds(abilityId, attacker.speed);
}
