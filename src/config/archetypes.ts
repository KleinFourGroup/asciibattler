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
 * knob — the practical 0-50 range never touches it. E3 will add
 * `growthRates` alongside `baseStats` for per-archetype leveling.
 *
 * Adding a new archetype:
 *   1. Add its key + baseStats to `config/archetypes.json`
 *   2. Extend the `Archetype` union in `src/sim/archetypes.ts`
 *   3. Extend the `Archetypes` zod object below
 *   4. The compiler will surface remaining sites that need a case.
 */

import { z } from 'zod';
import archetypesJson from '../../config/archetypes.json';

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

const ArchetypeSchema = z.object({
  glyph: z.string().length(1),
  attackRange: z.number().int().positive(),
  baseStats: BaseStatsSchema,
});

const ArchetypesSchema = z.object({
  melee: ArchetypeSchema,
  ranged: ArchetypeSchema,
});

export type ArchetypeConfig = z.infer<typeof ArchetypeSchema>;
export type ArchetypesConfig = z.infer<typeof ArchetypesSchema>;

export const ARCHETYPES: ArchetypesConfig = ArchetypesSchema.parse(archetypesJson);
