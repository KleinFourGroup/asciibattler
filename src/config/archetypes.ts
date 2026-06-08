/**
 * Validated archetype-config accessor. The JSON source of truth lives at
 * `config/archetypes.json`; this module imports it via Vite's native
 * JSON support, validates it through zod, and re-exports the parsed
 * value with the strict TS types the rest of the codebase expects.
 *
 * Validation runs at module load (effectively boot). A malformed config
 * throws a zod error before any gameplay code runs, which is exactly
 * the failure mode we want — broken balance JSON should be loud, not
 * silently fall back to defaults.
 *
 * E1: schema flipped from the MVP `{hp, attackDamage, attackCooldown,
 * moveCooldown}` ranges to a `baseStats` block in the new stat
 * vocabulary (constitution / strength / ranged / magic / luck / defense /
 * precision / evasion / speed / mobility / power — the I1 canonical order).
 * The `STAT_CAP = 99` cap is a typo guard, not a design knob — the practical
 * range never touches it. GP1 renamed the two cadence stats
 * (`speed → agility`, `endurance → mobility`) and made `mobility` signed;
 * I1 reverted `agility → speed` (it read as "dodge chance" once the real
 * dodge stats `precision`/`evasion` arrived) and reordered to group the
 * direct-combat stats (incl. `defense`) ahead of dodge/cadence/meta.
 *
 * E2: each archetype declares an `abilities: string[]` list of registry
 * ids resolved at module load against `knownAbilityIds()`. Unknown ids
 * fail the parse loudly (A4 pattern) — keeping the JSON tunable while
 * the ability behavior itself stays type-checked in TS.
 *
 * E3: each archetype declares a `growthRates` block parallel to
 * `baseStats`. Each rate is in `[0, 1]` — the probability that the stat
 * increments by 1 on a single simulated level-up (player recruits, via
 * `simulateLevelUps`), and also the per-level deterministic increment
 * for enemies (via `scaleStats`). A rate of 0 means the stat never grows
 * (useful for archetype-orthogonal stats: melee's ranged stat stays 0
 * forever).
 *
 * GP1: the per-archetype `baseMoveCooldownSeconds` override is gone.
 * There's one universal `STATS.baseMoveCooldownSeconds`; a slow walking
 * pace now comes from low/negative `mobility` (heavy units around −7),
 * which the move-CD curve turns into a scale > 1. Attack-cooldown bases
 * live on ability definitions (a unit can carry several abilities with
 * different timings), scaled per unit by `speed`.
 *
 * E5: `attackRange` left the archetype schema for the same reason —
 * range is now a per-ability tunable in `config/abilities.json`. A
 * unit's effective engagement range is the MAX over its abilities (see
 * `rangeForArchetype` in `src/sim/archetypes.ts`).
 *
 * Adding a new archetype:
 *   1. Add its key + abilities + baseStats + growthRates to
 *      `config/archetypes.json` (use low/negative `mobility` if it needs
 *      a slow walking pace — there's no per-archetype move-CD override)
 *   2. Extend the `Archetype` union in `src/sim/archetypes.ts`
 *   3. Extend the `Archetypes` zod object below
 *   4. The compiler will surface remaining sites that need a case.
 */

import { z } from 'zod';
import archetypesJson from '../../config/archetypes.json';
import { knownAbilityIds } from '../sim/abilities/registry';
import { knownTargetingIds } from '../sim/targetingStrategies';

/** Defensive cap to catch a designer typo (e.g. 500 instead of 5). */
const STAT_CAP = 99;

const BaseStatsSchema = z.object({
  constitution: z.number().int().nonnegative().max(STAT_CAP),
  strength: z.number().int().nonnegative().max(STAT_CAP),
  ranged: z.number().int().nonnegative().max(STAT_CAP),
  magic: z.number().int().nonnegative().max(STAT_CAP),
  luck: z.number().int().nonnegative().max(STAT_CAP),
  // GP2: flat subtractive damage mitigation. Nonnegative like the offensive
  // stats (0 = no armor). I1 reordered it up next to `luck` (combat stats group).
  defense: z.number().int().nonnegative().max(STAT_CAP),
  // I1: dodge stats — `precision` (attacker) vs `evasion` (defender) feed the
  // hit/miss roll in `World.applyDamage`. Nonnegative; behavior-neutral until I2.
  precision: z.number().int().nonnegative().max(STAT_CAP),
  evasion: z.number().int().nonnegative().max(STAT_CAP),
  // I1: `speed` (attack cadence; reverts GP1's `agility` name). Nonnegative.
  speed: z.number().int().nonnegative().max(STAT_CAP),
  // GP1: `mobility` is SIGNED — 0 is the universal move-CD baseline, positive
  // is faster, negative is slower (heavy units land around −7). The other
  // stats stay nonnegative; mobility's lower bound is the typo guard mirrored.
  mobility: z.number().int().min(-STAT_CAP).max(STAT_CAP),
  // H1: Phase-H pool-chip stat — a turn's survivors chip the opposing health
  // pool by their Σ`power`. Nonnegative; behavior-neutral until H4 consumes it.
  power: z.number().int().nonnegative().max(STAT_CAP),
});

const GrowthRatesSchema = z.object({
  constitution: z.number().min(0).max(1),
  strength: z.number().min(0).max(1),
  ranged: z.number().min(0).max(1),
  magic: z.number().min(0).max(1),
  luck: z.number().min(0).max(1),
  defense: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  evasion: z.number().min(0).max(1),
  speed: z.number().min(0).max(1),
  mobility: z.number().min(0).max(1),
  power: z.number().min(0).max(1),
});

const ABILITY_IDS = knownAbilityIds();
const AbilityIdSchema = z.string().refine((id) => ABILITY_IDS.includes(id), {
  message: `unknown ability id; known: [${ABILITY_IDS.join(', ')}]`,
});

// Per-archetype target-selection policy, validated against the strategy
// registry (`src/sim/targetingStrategies.ts`) at load — same A4 pattern as
// AbilityIdSchema. A typo'd or unregistered id fails the parse loudly.
const TARGETING_IDS = knownTargetingIds();
const TargetingIdSchema = z.string().refine((id) => TARGETING_IDS.includes(id), {
  message: `unknown targeting id; known: [${TARGETING_IDS.join(', ')}]`,
});

const ArchetypeSchema = z.object({
  glyph: z.string().length(1),
  abilities: z.array(AbilityIdSchema).min(1),
  baseStats: BaseStatsSchema,
  growthRates: GrowthRatesSchema,
  // Required — every archetype declares its targeting policy explicitly
  // (default `nearest`); a future archetype that omits it fails at load.
  targeting: TargetingIdSchema,
});

const ArchetypesSchema = z.object({
  melee: ArchetypeSchema,
  ranged: ArchetypeSchema,
  rogue: ArchetypeSchema,
  healer: ArchetypeSchema,
  mage: ArchetypeSchema,
  catapult: ArchetypeSchema,
});

export type ArchetypeConfig = z.infer<typeof ArchetypeSchema>;
export type ArchetypesConfig = z.infer<typeof ArchetypesSchema>;
export type GrowthRates = z.infer<typeof GrowthRatesSchema>;

export const ARCHETYPES: ArchetypesConfig = ArchetypesSchema.parse(archetypesJson);
