import type { RNG } from '../core/RNG';
import type { Archetype, UnitArchetype, UnitTemplate } from './Unit';
import { UNIT_DEFS, type CombatantUnitDef } from '../config/units';
import { abilityDef } from '../config/abilities';
import { scaleStats, simulateLevelUps } from './leveling';

// E7.A — `Archetype` is now defined once in `./Unit` (the canonical closed
// set) and re-exported here so the many `import { Archetype } from
// './archetypes'` sites keep working. Adding an archetype is a one-line edit
// to the union in Unit.ts, not two definitions that can drift apart.
export type { Archetype };

/**
 * Per-archetype config, sourced from `config/units.json` and
 * validated by [src/config/units.ts](src/config/units.ts).
 * Re-exported as `ARCHETYPE_CONFIG` for tests that want to assert
 * baseStats / glyph without re-importing from config.
 *
 * §38d — the §38d neutral fold added `NEUTRAL_DEFS` (walls / half-cover / future
 * rubble) as a SIBLING record; `UNIT_DEFS` stays the COMBATANT catalog (its
 * de-facto pre-38d meaning), so every accessor here + the draft/telemetry/roster
 * consumers of `ALL_ARCHETYPES` keep their exact combatant types with no union to
 * narrow. Neutral defs are fetched off `NEUTRAL_DEFS` by the spawn + status-
 * filter paths (`World` / `environment.ts`).
 */
const CONFIGS: Record<Archetype, CombatantUnitDef> = UNIT_DEFS;

export function glyphForArchetype(archetype: Archetype): string {
  return CONFIGS[archetype].glyph;
}

/**
 * E5 — a unit's effective engagement range: the MAX attack range over
 * the archetype's abilities. Range moved off the archetype (E1's
 * `attackRange` primitive) onto each ability in `config/abilities.json`,
 * so this is now derived rather than read directly. Fed into
 * `deriveStats` as `derived.attackRange` — the value MovementBehavior's
 * in-range abstain and the HUD/audio readers consult. Per-ability gates
 * (whether a *specific* strike can reach) read the ability's own range
 * in `proposeBasicStrike`, not this max.
 */
export function rangeForArchetype(archetype: Archetype): number {
  // N1 — a pure-reposition (`self`-target) leap's `rangeCells` is a LEAP distance,
  // not engagement reach, so it's excluded from `derived.attackRange` (the
  // in-range-abstain threshold MovementBehavior reads, and the gate the dash
  // itself uses to ask "am I out of strike range?"). Without this, the rogue's
  // 2-cell dash would inflate its firing range to 2 and strand it a cell short
  // whenever the dash is on cooldown. Falls back to all abilities if a unit
  // somehow carries only `self` abilities. Today only the rogue's dash targets
  // `self`; every other archetype is unaffected (byte-identical).
  const ids = CONFIGS[archetype].abilities;
  const engaging = ids.filter((id) => abilityDef(id).target.kind !== 'self');
  const reach = engaging.length > 0 ? engaging : ids;
  return Math.max(...reach.map((id) => abilityDef(id).rangeCells));
}

/**
 * O4 — a unit's engagement FLOOR: the `minRangeCells` of the archetype's
 * longest-range engaging (non-`self`-target) ability — the same ability whose
 * `rangeCells` defines `derived.attackRange`, so `[minRange, attackRange]` is the
 * firing band `MovementBehavior` kites within. Config-READ (parallels
 * `rangeForArchetype`), deliberately NOT plumbed into `UnitDerived` — there's no
 * serialized per-unit copy, so `minRange` needs no WorldSnapshot bump (it's looked
 * up live wherever `attackRange` is, exactly like `rangeCells`/the damage profile).
 * Every archetype today carries a single attack ability, so "longest-range
 * engaging" is unambiguous; the max-by-range tie-break generalizes it to a future
 * multi-weapon unit.
 * `minRange 0` for every weapon today → byte-identical (no kiting) until the O4
 * value commit sets bow/mage/catapult floors.
 *
 * §38d — a NEUTRAL unit (walls / half-cover) never seeks a firing position and is
 * absent from the COMBATANT catalog, so the optional chain maps it to 0 (the value
 * the removed `=== 'environment'` guard produced); `MovementBehavior` needn't
 * pre-narrow `unit.archetype` (a wall has no behaviors and never reaches the band
 * logic anyway).
 */
export function minRangeForArchetype(archetype: UnitArchetype): number {
  const ids = CONFIGS[archetype]?.abilities;
  if (!ids) return 0;
  const engaging = ids.filter((id) => abilityDef(id).target.kind !== 'self');
  const reach = engaging.length > 0 ? engaging : ids;
  let best = reach[0]!;
  for (const id of reach) {
    if (abilityDef(id).rangeCells > abilityDef(best).rangeCells) best = id;
  }
  return abilityDef(best).minRangeCells;
}

/**
 * Per-archetype target-selection strategy id (resolved against the registry
 * in `src/sim/targetingStrategies.ts`). Resolved at spawn and stashed on
 * `Unit.targeting` so the leaf `Targeting.ts` needn't import the config layer.
 * §38d — a NEUTRAL unit (walls / half-cover) never seeks a target and is absent
 * from the COMBATANT catalog, so the optional chain gives it the harmless
 * `nearest` default (the value the removed `=== 'environment'` guard produced);
 * callers needn't branch on team/neutral first.
 */
export function targetingForArchetype(archetype: UnitArchetype): string {
  return CONFIGS[archetype]?.targeting ?? 'nearest';
}

/**
 * E3 — per-archetype `growthRates` block, used by `simulateLevelUps`
 * (player recruits) and `scaleStats` (enemies).
 */
export function growthRatesForArchetype(archetype: Archetype) {
  return CONFIGS[archetype].growthRates;
}

/**
 * E3 — per-archetype `baseStats` block, used as the starting point for
 * level-up math. Returned by reference (frozen-by-zod-parse JSON), so
 * callers MUST spread before mutating.
 */
export function baseStatsForArchetype(archetype: Archetype) {
  return CONFIGS[archetype].baseStats;
}

/**
 * E2 — registry ids of the abilities an archetype unit spawns with.
 * Order is significant: `AbilityBehavior` walks the list in stored
 * order and ties go to the first proposer. Spawn-site callers pass each
 * id through `createAbility` to instantiate a fresh stateless ability
 * per unit.
 */
export function abilityIdsForArchetype(archetype: Archetype): readonly string[] {
  return CONFIGS[archetype].abilities;
}

/**
 * E3 — produce a player-side template at the given level via simulated
 * level-ups. Level 1 returns baseStats verbatim (no RNG draws); higher
 * levels consume `9 × (level - 1)` RNG draws against the archetype's
 * growthRates (one per stat; H1 made it 9). Used by `rollTeam` (level 1)
 * and `rollOffer` (recruits at currentFloor — see ROADMAP E3 decision point).
 */
export function rollUnit(archetype: Archetype, rng: RNG, level: number = 1): UnitTemplate {
  const cfg = CONFIGS[archetype];
  if (level <= 1) {
    return { archetype, level: 1, stats: { ...cfg.baseStats }, xp: 0 };
  }
  return {
    archetype,
    level,
    stats: simulateLevelUps(cfg.baseStats, cfg.growthRates, level - 1, rng),
    xp: 0,
  };
}

/**
 * E3 — produce an enemy-side template at the given level via the
 * deterministic `scaleStats` path. No RNG draws; same `(archetype,
 * level)` pair always produces the same stats. Used by G4's
 * `buildEnemyTeam` to materialize each budget-allocated enemy level.
 */
export function scaledUnit(archetype: Archetype, level: number): UnitTemplate {
  const cfg = CONFIGS[archetype];
  if (level <= 1) {
    return { archetype, level: 1, stats: { ...cfg.baseStats }, xp: 0 };
  }
  return {
    archetype,
    level,
    stats: scaleStats(cfg.baseStats, cfg.growthRates, level - 1),
    xp: 0,
  };
}

// Re-exported for tests / fuzz harness diagnostic that want to peek
// at the parsed config without reaching into the config module.
export const ARCHETYPE_CONFIG: Record<Archetype, CombatantUnitDef> = CONFIGS;

/**
 * F1 — the draft / recruit pool: every defined archetype, in
 * `config/units.json` key order (melee, ranged, rogue, healer,
 * mage, catapult). Derived from the config so a newly-added archetype
 * joins the pool automatically; the stable key order keeps the byte
 * stream deterministic for whoever samples from it. `rollOffer` draws
 * DISTINCT archetypes from this at uniform weight (F1, recruit-only) —
 * rarity tiers + floor-depth weighting + enemy-side diversification
 * layer on top in Phase G (recruitment refactor).
 */
export const ALL_ARCHETYPES: readonly Archetype[] = Object.keys(CONFIGS) as Archetype[];

/**
 * §29-close — the player DRAFT pool: the subset of `ALL_ARCHETYPES` whose config
 * `draftable` flag is true. `rollOffer` samples post-victory recruit offers from
 * THIS list, not the full catalog, so the §29 enemy disruptors
 * (frozen/confusion/blind/panic afflicters) and the summon-only Ghoul — which
 * exist on the board (cast by enemies / summoned) but are never the player's to
 * draft — stay out of the offer. Derived from the per-archetype flag (default
 * true), so a new *player* archetype joins automatically and a new enemy/minion
 * archetype is excluded with one `"draftable": false` line. `ALL_ARCHETYPES`
 * remains the canonical full list everywhere else (telemetry / fuzz / roster
 * ordering — every defined archetype, draftable or not).
 */
export const DRAFTABLE_ARCHETYPES: readonly Archetype[] = ALL_ARCHETYPES.filter(
  (a) => CONFIGS[a].draftable,
);
