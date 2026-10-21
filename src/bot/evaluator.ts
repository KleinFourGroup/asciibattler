/**
 * The rollout evaluator: scores one candidate command by cloning the live
 * battle once per rollout seed, rolling each clone forward the horizon's
 * ticks under that command, and averaging the scores at the end.
 *
 * The score is the material differential in HP fractions, plus a bonus
 * for a battle's end:
 *
 *     score = (enemy material lost) − (own material lost) + endBonus
 *
 * Material is Σ currentHp/maxHp over a team's living units, so a unit at
 * half HP counts half, and a score of +2.0 reads "two full units ahead on
 * the exchange". A rollout whose battle ends inside the horizon gets
 * ±`WIN_BONUS`, larger than any material swing, so a win always outscores
 * a fat differential that leaves the battle open. The winner is read from
 * the end state, with no bus subscription: a team with living units over
 * an emptied opponent won, and any other end is a draw and adds 0. That
 * is a mutual wipe, the only other end a rollout reaches, since it ticks
 * its clone with no turn cap.
 *
 * The searcher passes the same `rolloutSeeds` for every candidate in one
 * search, so the candidates face the same luck and the seeds' noise
 * cancels out of the comparison.
 *
 * Candidate generation, ties, the hysteresis and the cadence are the
 * searcher's; the evaluator returns the averaged scores and nothing else.
 */

import type { WorldCommand } from '../sim/Command';
import type { ObjectiveTeam } from '../sim/objective';
import type { World } from '../sim/World';
import { livingUnits, opposingTeam } from './sensors';
import { cloneForRollout } from './rollout';

/**
 * Larger than any material differential a rollout produces (a team's
 * material is at most its count of living units), so winning the battle
 * outranks winning the exchange.
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

interface RolloutSpec {
  /** How far each clone rolls forward: the searcher's horizon. */
  readonly horizonTicks: number;
  /** The K rollout seeds; the same array for every candidate in one search. */
  readonly rolloutSeeds: readonly number[];
}

/**
 * The mean score of `command` (null for the null arm: no command, the
 * current trajectory) over the spec's rollouts, from `team`'s side.
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
