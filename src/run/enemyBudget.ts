/**
 * The random enemy wave: a budget of levels drawn from the player's team,
 * spread over more, weaker units. The fuzz arena (`tests/fuzz/arena.ts`) and
 * the spawn-overflow test fight it; an authored encounter resolves its own
 * waves (`encounters/wave.ts`). The run reads only `avgTeamLevel`, a
 * recruit's level basis.
 *
 * Its keys, and the reasons for the budget's shape, are in
 * `config/difficulty.ts`. They are read here rather than passed in, so the
 * tests derive their expectations from the config this code reads.
 */

import type { RNG } from '../core/RNG';
import type { UnitTemplate } from '../sim/Unit';
import { scaledUnit, type Archetype } from '../sim/archetypes';
import { DIFFICULTY } from '../config/difficulty';
import { DECK } from '../config/deck';

/** The roster's summed level. */
function rosterLevelSum(team: readonly UnitTemplate[]): number {
  return team.reduce((sum, u) => sum + u.level, 0);
}

/**
 * The player's team level, the basis of the random wave's budget: the
 * expected level of a dealt hand, `avgLevel × min(rosterSize, handSize)`,
 * since only a hand fights each turn. A recruit past the hand size raises it
 * only through the average; it dilutes the draw. An empty roster is 0. It
 * reads `DECK.handSize`, as there is no run here to fold a draw stat; an
 * authored wave's basis is the run's folded hand (`WaveContext.handSize`).
 */
export function playerTeamLevel(team: readonly UnitTemplate[]): number {
  return avgTeamLevel(team) * Math.min(team.length, DECK.handSize);
}

/**
 * The roster's mean level, the basis of a recruit's level (`Run`). An empty
 * roster is 1, so a recruit onto an empty team arrives at level 1 plus its
 * bonus.
 */
export function avgTeamLevel(team: readonly UnitTemplate[]): number {
  return team.length === 0 ? 1 : rosterLevelSum(team) / team.length;
}

/**
 * The random wave's level budget, the total levels it may spend. No draw.
 *
 *   budget = max(minBudget, round(budgetOffset + budgetFactor × playerTeamLevel))
 */
function enemyBudgetFor(team: readonly UnitTemplate[]): number {
  const { budgetFactor, budgetOffset, minBudget } = DIFFICULTY;
  return Math.max(minBudget, Math.round(budgetOffset + budgetFactor * playerTeamLevel(team)));
}

/**
 * An enemy team for this roster: the budget, then one wave at it. Its draws
 * are the count's skew, then the budget remainder's placing.
 */
export function buildEnemyTeam(rng: RNG, playerTeam: readonly UnitTemplate[]): UnitTemplate[] {
  return rollEnemyWave(rng, playerTeam, enemyBudgetFor(playerTeam));
}

/**
 * One random wave at `budget`:
 *
 *   cap      = highestPlayerUnitLevel + unitLevelDelta
 *   minCount = ceil(budget / cap)               (so cap·minCount ≥ budget)
 *   maxCount = min(swarmMaxMultiplier × size, budget)   (at least minCount)
 *   count    ∈ [minCount, maxCount], skewed toward max by swarmBias
 *   levels   = budget spread near evenly over count, each in [1, cap]
 *
 * `size` is the fielded hand, `min(roster, handSize)`, as in
 * `playerTeamLevel`: only a hand fights each turn, so a large roster must not
 * draw a swarm sized to the whole of it. `maxCount` is bounded by the budget
 * because a unit is at least level 1: more bodies than the budget would push
 * the enemy's total level past it, and at low levels make a swarm of equals
 * rather than of weaker units. The swarm grows as the player outlevels it.
 *
 * The first `round(count × (1 − enemyArcherRatio))` units are melee
 * `bandit`s, enemy fodder at about half the mercenary's growth, so a deep
 * swarm stays many weak bodies; the rest are `archer`s. Units past the spawn
 * region's tiles wait in the spawn queue, and a team with units queued counts
 * as alive (`World.checkBattleEnd`).
 */
function rollEnemyWave(
  rng: RNG,
  playerTeam: readonly UnitTemplate[],
  budget: number,
): UnitTemplate[] {
  const { unitLevelDelta, swarmBias, swarmMaxMultiplier, enemyArcherRatio } = DIFFICULTY;
  const size = Math.max(1, Math.min(playerTeam.length, DECK.handSize));
  const highest = playerTeam.reduce((m, u) => Math.max(m, u.level), 1);

  const cap = highest + unitLevelDelta;
  const minCount = Math.max(1, Math.ceil(budget / cap));
  // The outer `max` keeps the range from inverting under an extreme config.
  const maxCount = Math.max(minCount, Math.min(Math.round(swarmMaxMultiplier * size), budget));

  const count = chooseSwarmCount(rng, minCount, maxCount, swarmBias);
  const levels = distributeBudget(rng, budget, count, cap);

  const meleeCount = Math.round(count * (1 - enemyArcherRatio));
  const team: UnitTemplate[] = [];
  for (let i = 0; i < count; i++) {
    const archetype: Archetype = i < meleeCount ? 'bandit' : 'archer';
    team.push(scaledUnit(archetype, levels[i]!));
  }
  return team;
}

/**
 * Pick the enemy count in `[min, max]`, skewed toward `max` by `bias ∈ [0,1]`
 * (0 = uniform, 1 = always max). `f = next()^(1 − bias)` pushes the [0,1) draw
 * toward 1 as bias rises (bias = 1 → exponent 0 → f ≡ 1 → always max). Always
 * draws once so the stream advances regardless of the range width.
 */
export function chooseSwarmCount(rng: RNG, min: number, max: number, bias: number): number {
  const u = rng.next();
  if (max <= min) return min;
  const p = 1 - Math.min(1, Math.max(0, bias));
  const f = Math.pow(u, p);
  return min + Math.round((max - min) * f);
}

/**
 * Distribute `budget` total levels across `count` units, each held to
 * `[1, cap]`. `total` is the budget made achievable: at least `count`, so each
 * gets 1, and at most `count·cap`, so none passes the cap. Every unit gets
 * `floor(total/count)`, and the `remainder` goes as +1 to units chosen by a
 * partial Fisher–Yates over the index list, so which enemies are a level
 * stronger follows `rng` while the spread stays at most 1.
 */
export function distributeBudget(rng: RNG, budget: number, count: number, cap: number): number[] {
  const total = Math.min(count * cap, Math.max(count, Math.round(budget)));
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  const levels = new Array<number>(count).fill(base);
  const idx = Array.from({ length: count }, (_, i) => i);
  for (let i = 0; i < remainder; i++) {
    const j = rng.int(i, count - 1);
    const tmp = idx[i]!;
    idx[i] = idx[j]!;
    idx[j] = tmp;
    levels[idx[i]!] += 1;
  }
  return levels;
}
