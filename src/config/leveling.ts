/**
 * Experience and levels. Source of truth at `config/leveling.json`; the
 * formulas are in `src/sim/xp.ts`.
 *
 * - `baseXp`, `exponent` — the XP from level L to the next is
 *   `round(baseXp × L^exponent)`. At 1 each level costs linearly more; at 2,
 *   quadratically.
 * - `levelCap` — the highest level, which bounds how far stats grow on a
 *   long run.
 *
 * A unit's XP from a battle is a flat share for taking part, plus shares for
 * the damage and healing it did. The flat share keeps tanks, healers and
 * specialists from falling behind; the damage share rewards carries.
 * - `xpFlatPerSurvivor` — the flat share of a unit alive at the end.
 * - `xpFlatPerFallen` — the flat share of a unit that fell. It still earns
 *   its damage and healing shares, so trading a unit for damage is not
 *   punished.
 * - `xpPerDamage` — XP per point of damage dealt to enemies.
 * - `xpPerHealing` — XP per point healed by an ability, from World's
 *   `utilityDone` ledger; at parity with `xpPerDamage` a healer keeps pace
 *   with a carry. A regen tile's heal is the tile's and earns nothing, and
 *   overheal counts 0, since the ledger sees the clamped change.
 * - `summonDamageXpShare` — the share of a summon's damage credited to its
 *   summoner (`World.recordDamage`), 0 to 1. A summon has no roster slot,
 *   so without it a summon-only caster such as the Shaman earns only the
 *   flat share. Shipped 0.75; at 0.5 a summon-only Shaman levelled too
 *   slowly.
 *
 * - `restXp` — the XP a rest node gives every roster slot, through the same
 *   `bankXpAwards` path a battle uses, so a rest can level a unit up. It is
 *   here and not in `nodemap.json`, which places rests, because it is a
 *   levelling reward.
 */

import { z } from 'zod';
import levelingJson from '../../config/leveling.json';

const LevelingSchema = z.object({
  baseXp: z.number().positive(),
  exponent: z.number().positive(),
  levelCap: z.number().int().min(1),
  xpFlatPerSurvivor: z.number().nonnegative(),
  xpFlatPerFallen: z.number().nonnegative(),
  xpPerDamage: z.number().nonnegative(),
  xpPerHealing: z.number().nonnegative(),
  summonDamageXpShare: z.number().min(0).max(1),
  restXp: z.number().nonnegative(),
});

export type LevelingConfig = z.infer<typeof LevelingSchema>;

export const LEVELING: LevelingConfig = LevelingSchema.parse(levelingJson);
