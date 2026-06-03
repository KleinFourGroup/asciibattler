/**
 * E1: stat-system tunables. Source of truth at `config/stats.json`.
 *
 * - `hpPerConstitution` — maxHp scales linearly with constitution.
 *   `maxHp = round(hpPerConstitution * constitution)` with a floor of 1.
 * - `baseMoveCooldownSeconds` — the universal base move cooldown a unit
 *   with mobility=0 would have. The derived cooldown is
 *   `secondsToTicks(base * cooldownScale(mobility, mobilityCdPerStat, mobilityMinCdScale))`,
 *   where `cooldownScale(s, perStat, minScale) = max(minScale, 1 - s * perStat)`.
 *   GP1 dropped the per-archetype override: slow units now come from
 *   low/negative `mobility` (the floor caps only the fast side, so the
 *   slow side is unbounded). The analogous *attack* cadence base moved out
 *   of this file in E5 pre-work — it's now per-ability in
 *   `config/abilities.json`, scaled by `agility` via the same curve. No
 *   silent global fallback: every ability must author its own
 *   `cooldownSeconds`.
 * - `critPerLuck` / `critCap` — `critChance = min(critCap, luck * critPerLuck)`.
 *   At the user's design range (0-50 base stats), a luck=50 unit lands
 *   at 50% crit and never touches the 60% cap. The cap is a defensive
 *   guard for future stat-stacking or status effects.
 * - `critMult` — damage multiplier on a successful crit roll. Damage is
 *   rounded after the multiply (`round(baseDamage * critMult)`).
 * - `minDamage` — GP2 floor for the subtractive `defense` mitigation. A
 *   confirmed combat hit lands `max(minDamage, rawDamage − defense)`, so a
 *   high-defense target never fully negates an attack (chip/AoE always pokes
 *   through). Applied in `World.applyDamage`; environmental fire/chasm damage
 *   is UNMITIGATED and never sees this floor.
 * - `mobilityCdPerStat` / `agilityCdPerStat` — per-axis cooldown slope.
 *   GP1 split the single `cdPerStat` so the two cadence stats can diverge:
 *   `mobility` swings wide (incl. negative) so it wants a steeper rate
 *   (0.15 → a heavy unit lands around mobility −7), while `agility` stays
 *   the gentler dial (0.05) on the already-authored ability cadences.
 * - `mobilityMinCdScale` / `agilityMinCdScale` — per-axis fast-side floor.
 *   Caps how short the cooldown can get at high stat; does NOT bound the
 *   slow side (negative mobility → scale > 1). GP1 split the single
 *   `minCdScale` alongside the rates so a shared fast-side cap isn't an
 *   odd half-measure once the slopes are independent.
 *
 * A4 pattern: parse at module load, throw on malformed JSON.
 */

import { z } from 'zod';
import statsJson from '../../config/stats.json';

const StatsSchema = z.object({
  hpPerConstitution: z.number().positive(),
  baseMoveCooldownSeconds: z.number().positive(),
  critPerLuck: z.number().nonnegative(),
  critCap: z.number().min(0).max(1),
  critMult: z.number().min(1),
  minDamage: z.number().int().nonnegative(),
  mobilityCdPerStat: z.number().nonnegative(),
  agilityCdPerStat: z.number().nonnegative(),
  mobilityMinCdScale: z.number().min(0).max(1),
  agilityMinCdScale: z.number().min(0).max(1),
});

export type StatsConfig = z.infer<typeof StatsSchema>;

export const STATS: StatsConfig = StatsSchema.parse(statsJson);
