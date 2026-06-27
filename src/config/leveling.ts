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
 *   per-unit XP = (xpFlatPerSurvivor if alive else xpFlatPerFallen)
 *               + xpPerDamage × HP-of-damage-dealt-to-enemies
 *
 * The flat slice keeps tanks / healers / specialists from falling behind;
 * the damage slice rewards carries. Tuned against floor-1 baselines where
 * a contributing unit should earn ~half a level per battle and a level-5
 * unit should clear a level every ~5 battles.
 *
 * `xpPerHealing` (F6) is the utility-contribution analogue of
 * `xpPerDamage`: per-unit XP also gains `xpPerHealing × effective-HP-
 * healed-by-ability-casts` (the World `utilityDone` ledger). Defaults to
 * parity with `xpPerDamage` (1 HP healed ≈ 1 damage dealt) so a pure
 * healer keeps pace with a carry instead of being starved by the
 * damage-only model. Only ability heals feed the ledger — the per-tick
 * regen-tile chip-heal is the *tile's* output, not a unit's contribution,
 * so it earns nothing (and overheal counts 0, since the ledger only sees
 * the clamped delta). A future buff/shield axis can ride the same ledger
 * without a snapshot bump.
 *
 * `xpFlatPerFallen` is the participation reward for player units that
 * died during the battle. Defaults to 0 — fallen units still earn their
 * damage share so suicide-DPS trades aren't *punished*, but they don't
 * get the survivor participation bonus by default. Bump it (or set it
 * equal to `xpFlatPerSurvivor`) if death-to-stay-on-curve feels too
 * harsh in playtest.
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
 * `restXp` (G3) is the flat XP a rest node grants to *every* roster slot.
 * It feeds the same `bankXpAwards` pipeline a battle win uses (synthesized
 * as one award per slot), so a rest can legitimately trigger level-ups +
 * PromotionScene. Lives here with the XP knobs (not in nodemap.json, which
 * owns rest *placement*) since it's a leveling reward. Lower it if rests
 * out-pace battle XP.
 *
 * `summonDamageXpShare` (§33) is the fraction of a SUMMONED unit's damage that
 * credits its SUMMONER's XP ledger (`World.recordDamage` redirects summon damage
 * to `summonedBy × share`). A summon has no roster slot, so without this its
 * damage banks to nobody — a summon-only caster (the Shaman, which never strikes
 * directly) would earn only the flat participation slice and barely level. The
 * share scales the summoner's progression with how well its minions perform: 0
 * disables the credit entirely (summons give the summoner nothing), 1 gives the
 * summoner full credit for every minion's hit. Defaults to 0.75 (the summoner
 * shares in most of its minions' work; playtested up from 0.5 — a summon-only
 * Shaman now levels at a satisfying pace) — a §33 playtest dial.
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
  xpFlatPerFallen: z.number().nonnegative(),
  xpPerDamage: z.number().nonnegative(),
  xpPerHealing: z.number().nonnegative(),
  summonDamageXpShare: z.number().min(0).max(1),
  halfCoverDamageMult: z.number().min(0).max(1),
  restXp: z.number().nonnegative(),
});

export type LevelingConfig = z.infer<typeof LevelingSchema>;

export const LEVELING: LevelingConfig = LevelingSchema.parse(levelingJson);
