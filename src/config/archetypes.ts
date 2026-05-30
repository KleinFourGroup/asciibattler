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
 * vocabulary (constitution / strength / ranged / magic / luck / speed
 * / endurance). The `STAT_CAP = 99` cap is a typo guard, not a design
 * knob — the practical 0-50 range never touches it.
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
 * E3: optional `baseMoveCooldownSeconds` overrides the global default
 * from `config/stats.json` for archetypes that need a different walking
 * pace (e.g. future heavy/slow units). Attack-cooldown overrides
 * deliberately stay out — those will live on ability definitions, since
 * a single unit can carry several abilities with different timings.
 *
 * E5: `attackRange` left the archetype schema for the same reason —
 * range is now a per-ability tunable in `config/abilities.json`. A
 * unit's effective engagement range is the MAX over its abilities (see
 * `rangeForArchetype` in `src/sim/archetypes.ts`).
 *
 * Adding a new archetype:
 *   1. Add its key + abilities + baseStats + growthRates to
 *      `config/archetypes.json` (and `baseMoveCooldownSeconds` if it
 *      needs a non-default walking pace)
 *   2. Extend the `Archetype` union in `src/sim/archetypes.ts`
 *   3. Extend the `Archetypes` zod object below
 *   4. The compiler will surface remaining sites that need a case.
 */

import { z } from 'zod';
import archetypesJson from '../../config/archetypes.json';
import { knownAbilityIds } from '../sim/abilities/registry';

/** Defensive cap to catch a designer typo (e.g. 500 instead of 5). */
const STAT_CAP = 99;

const BaseStatsSchema = z.object({
  constitution: z.number().int().nonnegative().max(STAT_CAP),
  strength: z.number().int().nonnegative().max(STAT_CAP),
  ranged: z.number().int().nonnegative().max(STAT_CAP),
  magic: z.number().int().nonnegative().max(STAT_CAP),
  luck: z.number().int().nonnegative().max(STAT_CAP),
  speed: z.number().int().nonnegative().max(STAT_CAP),
  endurance: z.number().int().nonnegative().max(STAT_CAP),
});

const GrowthRatesSchema = z.object({
  constitution: z.number().min(0).max(1),
  strength: z.number().min(0).max(1),
  ranged: z.number().min(0).max(1),
  magic: z.number().min(0).max(1),
  luck: z.number().min(0).max(1),
  speed: z.number().min(0).max(1),
  endurance: z.number().min(0).max(1),
});

const ABILITY_IDS = knownAbilityIds();
const AbilityIdSchema = z.string().refine((id) => ABILITY_IDS.includes(id), {
  message: `unknown ability id; known: [${ABILITY_IDS.join(', ')}]`,
});

const ArchetypeSchema = z.object({
  glyph: z.string().length(1),
  abilities: z.array(AbilityIdSchema).min(1),
  baseStats: BaseStatsSchema,
  growthRates: GrowthRatesSchema,
  baseMoveCooldownSeconds: z.number().positive().optional(),
});

const ArchetypesSchema = z.object({
  melee: ArchetypeSchema,
  ranged: ArchetypeSchema,
  rogue: ArchetypeSchema,
  healer: ArchetypeSchema,
});

export type ArchetypeConfig = z.infer<typeof ArchetypeSchema>;
export type ArchetypesConfig = z.infer<typeof ArchetypesSchema>;
export type GrowthRates = z.infer<typeof GrowthRatesSchema>;

export const ARCHETYPES: ArchetypesConfig = ArchetypesSchema.parse(archetypesJson);
