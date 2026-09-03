/**
 * §91a2 — THE CHIP RULE: what one turn's outcome charges each side's health
 * pool (the casualty experiment, encounter-feel-spec §The casualty chip rule).
 *
 * Two rules, both alive behind `health.chipMode`:
 * - `survivors` — the pre-§91 rule: each side's pool loses the OPPOSING
 *   side's standing Σ`power` (the loser pays the winner's survivors; a won
 *   turn costs 0; a lost turn costs most of the wave).
 * - `casualties` — each side's pool loses the power of ITS OWN fallen
 *   (a Pyrrhic victory costs; the enemy pool reads "their strength — every
 *   kill removes some"; a player's per-turn exposure is the power they
 *   fielded, so the risk line is a number they can add up).
 *
 * The CAP PENALTY (`health.capPenalty`) is the rule a turn that the driver's
 * tick budget force-resolved (`reason === 'cap'`, `World.resolveAsDraw`)
 * ALSO pays: the turn charges by every rule named in {chipMode, capPenalty}.
 * Under (casualties, survivors) a stall pays its own fallen PLUS the enemy's
 * standing power — a surcharge, never a replacement, so kiting to the cap is
 * never cheaper than fighting. Under (survivors, survivors) — the shipped
 * pair until 91e — a cap turn charges exactly what it did before §91
 * (byte-identical). A MUTUAL WIPE is a `'draw'` too, but it is the largest
 * casualty turn there is, never a stall: it never reads `capPenalty` (the
 * §91 kickoff review's finding 3 — `checkBattleEnd` emits 'draw' for it).
 *
 * Every charge is UNCAPPED pool-HP (× `chipMultiplier`): the caller clamps
 * at 0 when it applies, and reports both (the applied delta AND the charge —
 * the 89d rider: the overkill read needs the pre-clamp number). Pure —
 * `health` is injectable so the matrix pins never mutate the live config.
 */

import { HEALTH, type HealthConfig } from '../config/health';

export type ChipRule = HealthConfig['chipMode'];
/** Why a battle ended (`battle:ended.reason`, §91a1). */
export type TurnEndReason = 'decisive' | 'mutualWipe' | 'cap';

export interface SidePower {
  readonly player: number;
  readonly enemy: number;
}

/** The uncapped pool-HP charge TO each side's pool this turn. */
export interface TurnCharges {
  readonly player: number;
  readonly enemy: number;
}

/** The rules a turn ending for `reason` charges by (the set, so a cap turn
 *  under (survivors, survivors) is ONE rule, not the same rule twice). */
export function rulesForTurn(
  reason: TurnEndReason,
  health: Pick<HealthConfig, 'chipMode' | 'capPenalty'> = HEALTH,
): ReadonlySet<ChipRule> {
  const rules = new Set<ChipRule>([health.chipMode]);
  if (reason === 'cap') rules.add(health.capPenalty);
  return rules;
}

/**
 * The turn's charges. `survivors` = each side's STANDING Σpower at battle
 * end (`battle:ended.survivorPower`); `fallen` = each side's REAPED Σpower
 * (`battle:ended.fallenPower`). Under `survivors` the player's pool pays the
 * enemy's standing power (and vice versa); under `casualties` each pool pays
 * its own fallen. A cap turn adds the cap penalty's rule.
 */
export function turnCharges(
  reason: TurnEndReason,
  survivors: SidePower,
  fallen: SidePower,
  health: Pick<HealthConfig, 'chipMode' | 'capPenalty' | 'chipMultiplier'> = HEALTH,
): TurnCharges {
  const rules = rulesForTurn(reason, health);
  const mult = health.chipMultiplier;
  let player = 0;
  let enemy = 0;
  if (rules.has('survivors')) {
    player += survivors.enemy * mult;
    enemy += survivors.player * mult;
  }
  if (rules.has('casualties')) {
    player += fallen.player * mult;
    enemy += fallen.enemy * mult;
  }
  return { player, enemy };
}
