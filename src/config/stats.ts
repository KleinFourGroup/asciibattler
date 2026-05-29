/**
 * E1: stat-system tunables. Source of truth at `config/stats.json`.
 *
 * - `hpPerConstitution` — maxHp scales linearly with constitution.
 *   `maxHp = round(hpPerConstitution * constitution)` with a floor of 1.
 * - `baseMoveCooldownSeconds` — the base move cooldown a unit with
 *   endurance=0 would have. The derived cooldown is
 *   `secondsToTicks(base * cooldownScale(endurance))`, where
 *   `cooldownScale(s) = max(minCdScale, 1 - s * cdPerStat)`. The
 *   analogous *attack* cadence knob moved out of this file in E5
 *   pre-work — it's now per-ability in `config/abilities.json`
 *   (speed still drives `cooldownScale` there). No silent global
 *   fallback: every ability must author its own `cooldownSeconds`.
 * - `critPerLuck` / `critCap` — `critChance = min(critCap, luck * critPerLuck)`.
 *   At the user's design range (0-50 base stats), a luck=50 unit lands
 *   at 50% crit and never touches the 60% cap. The cap is a defensive
 *   guard for future stat-stacking or status effects.
 * - `critMult` — damage multiplier on a successful crit roll. Damage is
 *   rounded after the multiply (`round(baseDamage * critMult)`).
 * - `cdPerStat` / `minCdScale` — cooldownScale floor. At stat=50 the
 *   scale lands at 0.5; the 0.4 floor catches future buffs / stacking
 *   above stat=60. Authored as a defensive guard, not a design knob the
 *   base game hits.
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
  cdPerStat: z.number().nonnegative(),
  minCdScale: z.number().min(0).max(1),
});

export type StatsConfig = z.infer<typeof StatsSchema>;

export const STATS: StatsConfig = StatsSchema.parse(statsJson);
