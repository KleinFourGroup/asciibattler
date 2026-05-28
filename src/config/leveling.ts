/**
 * E4 — XP + leveling tunables. Source of truth at `config/leveling.json`.
 *
 * Curve:
 *   xpToNext(L) = round(baseXp * L^exponent)
 *
 * Defaults to a classic quadratic per-level curve (`exponent = 2`). D&D
 * 3.5e / Pathfinder use a linear-per-level / quadratic-cumulative curve,
 * which is `exponent = 1`; flip the knob to match. The whole formula
 * lives in one place ([src/sim/xp.ts](src/sim/xp.ts)) so swapping the
 * shape entirely (e.g. table-driven, or a different exponent regime) is
 * a one-file edit.
 *
 * Hybrid XP source per ROADMAP E4:
 *   per-unit XP = xpFlatPerSurvivor (alive at battle end)
 *               + xpPerDamage × HP-of-damage-dealt-to-enemies
 *
 * The flat slice keeps tanks / healers / specialists from falling behind;
 * the damage slice rewards carries. Tuned against floor-1 baselines where
 * a contributing unit should earn ~half a level per battle and a level-5
 * unit should clear a level every ~5 battles.
 *
 * `levelCap` enforces the asymptote — without it stats drift past the
 * user's "~50 unlikely ceiling" on long runs. Cap of 20 lands most stats
 * in the 30s-40s at growth ~0.6 (matches archetype config) hitting the
 * intended range without exceeding it.
 *
 * `halfCoverDamageMult` is the D6 plumbing finally getting its combat
 * effect — basic strikes through a half-cover (`╥`) on the LOS line
 * deal `damage × halfCoverDamageMult` (post-crit). E2 explicitly
 * deferred the value here so it could be tuned alongside the rest of
 * the E-stat curve.
 *
 * A4 pattern: parse at module load, throw on malformed JSON.
 */

import { z } from 'zod';
import levelingJson from '../../config/leveling.json';

const LevelingSchema = z.object({
  baseXp: z.number().positive(),
  exponent: z.number().positive(),
  levelCap: z.number().int().min(1),
  xpFlatPerSurvivor: z.number().nonnegative(),
  xpPerDamage: z.number().nonnegative(),
  halfCoverDamageMult: z.number().min(0).max(1),
});

export type LevelingConfig = z.infer<typeof LevelingSchema>;

export const LEVELING: LevelingConfig = LevelingSchema.parse(levelingJson);
