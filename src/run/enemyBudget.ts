/**
 * G4 — enemy level-budget team construction + the player-team-level SEAM.
 *
 * Replaces the old linear `enemyLevelForFloor` ramp (which assumed the player
 * levels linearly — they don't, so deep floors were unwinnable: post-G2 the
 * fuzz bots won 0% of full runs). The enemy team is now built from a *budget*
 * of total levels derived from the player's roster, spread across MORE, weaker
 * units (up to `swarmMaxMultiplier × playerSize`) so late battles read as
 * "outnumbered but individually stronger" rather than "outclassed."
 *
 * Knobs live in `config/difficulty.json` (read here so balance-proof tests
 * derive their expectations from the same config the production path reads).
 */

import type { RNG } from '../core/RNG';
import type { UnitTemplate } from '../sim/Unit';
import { scaledUnit, type Archetype } from '../sim/archetypes';
import { DIFFICULTY } from '../config/difficulty';
import { DECK } from '../config/deck';

/** Σ of every roster unit's level — the raw total. Private: it was the G4
 *  `playerTeamLevel`, but H5 turned the public seam into a non-sum product, so
 *  the two readers that still want the plain sum (`avgTeamLevel` + the seam
 *  itself) share this instead of recursing through `playerTeamLevel`. */
function rosterLevelSum(team: readonly UnitTemplate[]): number {
  return team.reduce((sum, u) => sum + u.level, 0);
}

/**
 * THE G4 SEAM — the single most important extensibility point in Phase G/H.
 *
 * Returns the player's effective "team level," the basis for the enemy budget.
 * **H5 model (the deckbuilder swap):** the EXPECTED hand level —
 * `avgLevel × min(rosterSize, handSize)` — because only a `handSize` hand
 * fights each turn, not the whole roster. So the budget tracks your average
 * unit level (recruiting past `handSize` no longer inflates the enemy; it just
 * dilutes your draw). Pre-H5 this was the plain Σ of roster levels (the
 * single-battle model); for a roster ≤ `handSize` the two are identical
 * (`avg × size == sum`), so the swap only diverges once the roster outgrows the
 * hand. Empty roster → 0 (avg 1 × min(0, handSize) = 0), as before.
 */
export function playerTeamLevel(team: readonly UnitTemplate[]): number {
  return avgTeamLevel(team) * Math.min(team.length, DECK.handSize);
}

/**
 * Average roster level — the basis for *recruit* leveling (G4). Deliberately
 * NOT routed through `playerTeamLevel`: that seam is a non-average product
 * (H5), so recruits read the plain mean off `rosterLevelSum` here. Empty
 * roster → 1 (a recruit onto an empty team comes in at level 1 + bonus).
 */
export function avgTeamLevel(team: readonly UnitTemplate[]): number {
  return team.length === 0 ? 1 : rosterLevelSum(team) / team.length;
}

/**
 * The enemy level BUDGET — total levels the wave is allowed to spend. Computed
 * once per *encounter* (H4) and held fixed while the wave composition re-rolls
 * each turn; pre-H4 it's an inline step of `buildEnemyTeam`. Consumes no `rng`.
 *
 *   budget = max(minBudget, round(budgetOffset + budgetFactor × playerTeamLevel))
 *
 * Affine handicap: a proportional `factor` scales with the player's level, so
 * the enemy total stays a fixed fraction of the roster at any depth (a flat
 * subtraction got swamped late). `round` keeps the budget an integer.
 */
export function enemyBudgetFor(team: readonly UnitTemplate[]): number {
  const { budgetFactor, budgetOffset, minBudget } = DIFFICULTY;
  return Math.max(minBudget, Math.round(budgetOffset + budgetFactor * playerTeamLevel(team)));
}

/**
 * Build a full enemy team in one shot: budget from the roster, then a wave at
 * that budget. The single-battle entry point (any caller that just wants "an
 * enemy team for this roster"). H4's encounter loop instead computes the budget
 * once via `enemyBudgetFor` and re-rolls `rollEnemyWave` per turn.
 *
 * Byte-identical to the pre-split version: `enemyBudgetFor` draws no `rng`, so
 * the `rng` draw order (count skew, then budget remainder) is unchanged.
 */
export function buildEnemyTeam(rng: RNG, playerTeam: readonly UnitTemplate[]): UnitTemplate[] {
  return rollEnemyWave(rng, playerTeam, enemyBudgetFor(playerTeam));
}

/**
 * Roll one enemy wave at a GIVEN budget. Genuinely consumes `rng` (count skew +
 * which units carry the budget remainder), unlike the old deterministic
 * `rollEnemyTeam`.
 *
 *   cap      = highestPlayerUnitLevel + unitLevelDelta
 *   minCount = ceil(budget / cap)               (so cap·minCount ≥ budget)
 *   maxCount = min(swarmMaxMultiplier × size, budget)   (guarded ≥ minCount)
 *   count    ∈ [minCount, maxCount], skewed toward max by swarmBias
 *   levels   = budget distributed roughly equally across count, each ∈ [1, cap]
 *
 * **Why maxCount is bounded by the budget** (a refinement over a raw 2×size):
 * a unit can't go below level 1, so fielding more bodies than the budget would
 * just inflate the enemy total past it — at floor 1 (everyone level 1, budget
 * tiny) a 2×size swarm becomes "10 equal-level bodies vs the player's 5,"
 * which is *harder*, not the intended "swarm of weaker units." Capping count at
 * the budget keeps the enemy TOTAL level ≈ budget and lets the swarm grow
 * naturally as the player out-levels it (full 2×size swarms appear once the
 * budget can afford them).
 *
 * Archetype split stays 60/40 melee/ranged by index. **I5: the melee slot is
 * now `bandit`** (the default melee ENEMY — see the brief's "one melee class
 * forced player/enemy symmetry"), NOT the player's `mercenary`. Bandit shares
 * Mercenary's level-1 base but scales at ~half growth, so floor-1 enemies are
 * byte-identical to the pre-I5 melee enemy while deep-floor swarms stay "many
 * weak bodies" — which EASES late floors vs the old full-growth melee enemy.
 * That shift is intentional and recalibrated in Phase N's band re-sweep (the
 * roadmap sequences the sweep after all combat-structural changes). The ranged
 * slot stays generic `ranged`; the rest of the enemy diversification (rogue/
 * healer/mage/catapult enemies) is still deferred to "a proper encounter
 * system." Count past the spawn region's tiles overflows onto the D5 spawn
 * queue (verified — `checkBattleEnd` treats a queued team as alive).
 */
export function rollEnemyWave(
  rng: RNG,
  playerTeam: readonly UnitTemplate[],
  budget: number,
): UnitTemplate[] {
  const { unitLevelDelta, swarmBias, swarmMaxMultiplier } = DIFFICULTY;
  const size = Math.max(1, playerTeam.length);
  const highest = playerTeam.reduce((m, u) => Math.max(m, u.level), 1);

  const cap = highest + unitLevelDelta;
  const minCount = Math.max(1, Math.ceil(budget / cap));
  // Bounded by the budget so the enemy total stays ≈ budget (see above). The
  // outer `max(minCount, …)` only guards against an inverted range under
  // pathological config.
  const maxCount = Math.max(minCount, Math.min(Math.round(swarmMaxMultiplier * size), budget));

  const count = chooseSwarmCount(rng, minCount, maxCount, swarmBias);
  const levels = distributeBudget(rng, budget, count, cap);

  const meleeCount = Math.round(count * 0.6);
  const team: UnitTemplate[] = [];
  for (let i = 0; i < count; i++) {
    // I5: the melee slot fields `bandit` (low-growth enemy fodder), not the
    // player-grade `mercenary`. See the function comment for the difficulty note.
    const archetype: Archetype = i < meleeCount ? 'bandit' : 'ranged';
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
 * Distribute `budget` total levels across `count` units, each clamped to
 * `[1, cap]`. `total` is the achievable budget (≥ count so each gets ≥ 1,
 * ≤ count·cap so none exceeds the cap). The equal split gives every unit
 * `floor(total/count)` and hands the `remainder` as +1 to units chosen by a
 * partial Fisher–Yates over the index list — so *which* enemies are a level
 * stronger varies deterministically with `rng`, while the spread stays tight
 * (max − min ≤ 1).
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
