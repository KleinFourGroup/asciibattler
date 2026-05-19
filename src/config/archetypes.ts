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
 * Adding a new archetype:
 *   1. Add its key + stats to `config/archetypes.json`
 *   2. Extend the `Archetype` union in `src/sim/archetypes.ts`
 *   3. Extend the `Archetypes` zod object below
 *   4. The compiler will surface remaining sites that need a case.
 */

import { z } from 'zod';
import archetypesJson from '../../config/archetypes.json';
import { RangeSchema } from './schemas';

const ArchetypeSchema = z.object({
  glyph: z.string().length(1),
  hp: RangeSchema,
  attackDamage: RangeSchema,
  attackRange: z.number().int().positive(),
  attackCooldownSeconds: RangeSchema,
  moveCooldownSeconds: RangeSchema,
});

const ArchetypesSchema = z.object({
  melee: ArchetypeSchema,
  ranged: ArchetypeSchema,
});

export type ArchetypeConfig = z.infer<typeof ArchetypeSchema>;
export type ArchetypesConfig = z.infer<typeof ArchetypesSchema>;

export const ARCHETYPES: ArchetypesConfig = ArchetypesSchema.parse(archetypesJson);
