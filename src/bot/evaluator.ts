/**
 * 57e — the rollout evaluator: score ONE candidate command by cloning the
 * live battle once per CRN seed, rolling each clone forward H ticks under
 * that command, and averaging the terminal scores.
 *
 * The score is the §57c v2 lock — TERMINAL MATERIAL DIFFERENTIAL in
 * HP-fraction units, plus a dominant battle-end bonus:
 *
 *     score = (enemy material lost) − (own material lost) + endBonus
 *
 * Material = Σ currentHp/maxHp over a team's living units, so a unit at
 * half HP counts half and "score +2.0" reads "two full units ahead on
 * the exchange". A rollout whose battle ENDS inside the horizon gets
 * ±WIN_BONUS — deliberately dominant over any achievable material swing,
 * so a win is never out-scored by a fat differential that leaves the
 * battle open; draws add 0. The winner is INFERRED from terminal state
 * (derived reads only — no bus subscription): living units standing
 * over an emptied opponent won; any other ended state is a draw (the
 * turn-cap `resolveAsDraw` shape, and the double-KO edge).
 *
 * CRN contract (the §57c lock): the searcher passes the SAME
 * `rolloutSeeds` array for every candidate in one search, so candidates
 * are compared under identical luck and seed noise cancels out of the
 * comparison (the round's paired same-seed methodology, applied inside
 * the search).
 *
 * Deliberately NOT here (57f's domain): candidate generation, the
 * ties→NULL tie-break, hysteresis, and cadence. The evaluator returns
 * exact averaged numbers, nothing else.
 */

import type { WorldCommand } from '../sim/Command';
import type { ObjectiveTeam } from '../sim/objective';
import type { World } from '../sim/World';
import { livingUnits, opposingTeam } from './sensors';
import { cloneForRollout } from './rollout';

/**
 * Dominant over any material differential a rollout can produce (team
 * sizes cap out far below this in HP-fraction units) — the ordinal that
 * makes "won the battle" outrank "won the exchange".
 */
export const WIN_BONUS = 100;

/** Σ currentHp/maxHp over a team's living units. */
export function materialOf(world: World, team: ObjectiveTeam): number {
  let material = 0;
  for (const u of livingUnits(world, team)) {
    material += u.currentHp / u.derived.maxHp;
  }
  return material;
}

export interface RolloutSpec {
  /** H — how far each clone rolls forward (the §57c v2 local dial: 8s). */
  readonly horizonTicks: number;
  /** The K CRN seeds. SAME array for every candidate in one search. */
  readonly rolloutSeeds: readonly number[];
}

/**
 * Average terminal score of `command` (null = the null arm: no command,
 * current trajectory) over the spec's rollouts, from `team`'s viewpoint.
 */
export function evaluateCandidate(
  live: World,
  team: ObjectiveTeam,
  command: WorldCommand | null,
  spec: RolloutSpec,
): number {
  if (spec.rolloutSeeds.length === 0) {
    throw new Error('evaluateCandidate: rolloutSeeds must be non-empty');
  }
  const opponent = opposingTeam(team);
  const ownBefore = materialOf(live, team);
  const enemyBefore = materialOf(live, opponent);

  let total = 0;
  for (const seed of spec.rolloutSeeds) {
    const clone = cloneForRollout(live, seed);
    if (command !== null) clone.enqueueCommand(command);
    for (let i = 0; i < spec.horizonTicks && !clone.ended; i++) clone.tick();

    const ownLost = ownBefore - materialOf(clone, team);
    const enemyLost = enemyBefore - materialOf(clone, opponent);
    total += enemyLost - ownLost + endBonus(clone, team, opponent);
  }
  return total / spec.rolloutSeeds.length;
}

function endBonus(clone: World, team: ObjectiveTeam, opponent: ObjectiveTeam): number {
  if (!clone.ended) return 0;
  const ownAlive = livingUnits(clone, team).length > 0;
  const oppAlive = livingUnits(clone, opponent).length > 0;
  if (ownAlive && !oppAlive) return WIN_BONUS;
  if (!ownAlive && oppAlive) return -WIN_BONUS;
  return 0;
}
