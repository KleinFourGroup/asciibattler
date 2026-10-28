/**
 * The stat system's dials. Source of truth at `config/stats.json`; the
 * formulas are in `src/sim/stats.ts`.
 *
 * - `hpPerConstitution` — max HP is `round(hpPerConstitution ×
 *   constitution)`, at least 1.
 * - `baseMoveCooldownSeconds` — the move cooldown of a unit at mobility 0;
 *   a unit's own is `secondsToTicks(base × cooldownScale(mobility))`. An
 *   attack's base cadence is its ability's own `cooldownSeconds`
 *   (`config/abilities.json`), scaled by speed on the same curve, with no
 *   global fallback.
 *
 * Cadence, per axis (mobility for moves, speed for attacks), is scaled by
 * `cooldownScale(s) = max(minScale, 1 − s × perStat)`. The floor bounds the
 * fast side only: a negative stat gives a scale above 1, so slow units come
 * from low or negative mobility.
 * - `mobilityCdPerStat`, `speedCdPerStat` — the slopes. Mobility swings
 *   wider, negative included, and takes the steeper one.
 * - `mobilityMinCdScale`, `speedMinCdScale` — the fast-side floors.
 *
 * Crits:
 * - `critPerLuck`, `critCap` — `critChance = min(critCap, luck ×
 *   critPerLuck)`. A luck of 50, the top of the base stat range, gives 50%
 *   at the shipped 0.01, so the 0.6 cap binds only when buffs carry luck
 *   past 60.
 * - `critMult` — a crit's damage multiplier, rounded after
 *   (`round(baseDamage × critMult)`).
 *
 * Mitigation:
 * - `minDamage` — the floor under defense: a strike lands
 *   `max(minDamage, rawDamage − defense)` (`World.applyDamage`), so high
 *   defense never fully negates an attack. Environmental damage (fire,
 *   chasm) is not mitigated and never sees it.
 *
 * Every strike lands: there is no to-hit roll.
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
  speedCdPerStat: z.number().nonnegative(),
  mobilityMinCdScale: z.number().min(0).max(1),
  speedMinCdScale: z.number().min(0).max(1),
});

type StatsConfig = z.infer<typeof StatsSchema>;

export const STATS: StatsConfig = StatsSchema.parse(statsJson);
