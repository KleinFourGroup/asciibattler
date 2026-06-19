/**
 * U1 — the wave resolver: a pure `resolveWave(spec, context, rng) → UnitTemplate[]`.
 *
 * The keystone primitive of the encounter model (ROADMAP §"Phase U"). An
 * encounter's per-turn enemy team used to come from the random `rollEnemyWave`
 * ([../enemyBudget.ts](../enemyBudget.ts)); the encounter model replaces that
 * call site with this authored resolver. Each turn's team is described by a
 * **wave spec** (a budget, a total count, and a list of unit types each with a
 * count- and level-contribution) and resolved deterministically against the
 * battle RNG.
 *
 * **Two-step resolution** (the brief's worked example is the contract — encoded
 * as a test):
 *
 *  1. **Count.** Resolve the total count `C` (fixed, or `hand × factor`). Fixed-
 *     count units always take their fixed count; the remainder `max(0, C −
 *     Σfixed)` is split across the weight-count units in proportion to weight via
 *     the deterministic largest-remainder (Hamilton) method — NO RNG, mirroring
 *     `rollEnemyWave`'s deterministic `Math.round` archetype split. If fixed
 *     counts exceed `C`, the weight-count units resolve to 0 (allowed).
 *
 *  2. **Level.** Resolve the total level budget `L` (fixed, or `mean|median ×
 *     factor` over the roster). Fixed-level instances pin to their authored level
 *     (honoured even above the cap — an authored elite is intentional); the
 *     remaining budget `L − Σ(fixed levels)` is spread across the **weight-level
 *     instances** in proportion to weight, **per instance** (the user-locked
 *     semantics: a type's level-weight makes ITS individuals spikier), each
 *     clamped to `[1, cap]`. This is `distributeWeightedLevels` — a strict
 *     generalization of `distributeBudget`: with uniform weights it reduces to
 *     the same tight even split (spread ≤ 1, RNG-chosen remainder), so the
 *     reproduction encounter stays faithful to today's fights.
 *
 * Pure: no `Run`/snapshot touch, fully headless-testable. The only RNG draw is
 * the level remainder (the count step is deterministic) — so a wave is
 * reproducible from its seed + context, exactly where `rollEnemyWave`'s draw
 * sits today. NOT byte-identical to `rollEnemyWave` (it loses the random swarm
 * COUNT — the encounter authors count explicitly), which is why balance is
 * re-derived in Phase X, not re-confirmed.
 */

import type { RNG } from '../../core/RNG';
import type { UnitTemplate } from '../../sim/Unit';
import { scaledUnit, type Archetype } from '../../sim/archetypes';

/** Total level budget a wave may spend across all its units. `fixed` is an
 *  absolute total; `mean`/`median` scale the player roster's mean/median level
 *  by `factor` AND the fielded hand size — i.e. `factor × centralLevel ×
 *  handSize = factor × playerTeamLevel`, the established difficulty basis (so the
 *  wave tracks the fielded team's TOTAL level, like today's enemy budget — a
 *  per-average-unit budget would shrink to nothing for a hand-sized wave). */
export type LevelBudgetSpec =
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'mean'; readonly factor: number }
  | { readonly kind: 'median'; readonly factor: number };

/** Total unit count for a wave. `fixed` is absolute; `hand` scales the fielded
 *  hand size by `factor` (the reproduction encounter's `hand × swarmMax`). */
export type CountSpec =
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'hand'; readonly factor: number };

/** How a unit type claims COUNT within the wave: a `fixed` headcount, or a
 *  `weight` share of the leftover count after the fixed units are placed. */
export type UnitCountSpec =
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'weight'; readonly weight: number };

/** How a unit type's instances claim LEVEL within the wave: `fixed` pins every
 *  instance to an exact level; `weight` claims a per-instance share of the
 *  remaining level budget (higher weight → higher-level individuals). */
export type UnitLevelSpec =
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'weight'; readonly weight: number };

/** One unit type in a wave: an archetype with its count- and level-contribution. */
export interface WaveUnitSpec {
  readonly archetype: Archetype;
  readonly count: UnitCountSpec;
  readonly level: UnitLevelSpec;
}

/** A single wave: a level budget, a total count, and the unit types that fill it. */
export interface WaveSpec {
  readonly levelBudget: LevelBudgetSpec;
  readonly count: CountSpec;
  readonly units: readonly WaveUnitSpec[];
}

/**
 * The run-side inputs a wave resolves against. Supplied by the caller
 * (`Run.beginTurn` in U3) so the resolver stays pure + headless-testable with
 * explicit literals:
 * - `roster` — the player roster, for `mean`/`median` level budgets.
 * - `handSize` — the FIELDED hand size (`min(roster, DECK.handSize)`), for
 *   `hand`-relative counts (mirrors `rollEnemyWave`'s `size`).
 * - `levelCap` — the per-instance level ceiling for the weighted spread
 *   (production: `highestRosterLevel + DIFFICULTY.unitLevelDelta`, like
 *   `rollEnemyWave`'s `cap`). Fixed authored levels bypass it.
 */
export interface WaveContext {
  readonly roster: readonly UnitTemplate[];
  readonly handSize: number;
  readonly levelCap: number;
}

/**
 * Resolve a wave spec into a concrete enemy team, deterministically from `rng`.
 * The count step draws no RNG; the level remainder does (where `rollEnemyWave`'s
 * draw sits today).
 */
export function resolveWave(spec: WaveSpec, context: WaveContext, rng: RNG): UnitTemplate[] {
  const totalCount = resolveTotalCount(spec.count, context);
  const counts = resolveCounts(spec.units, totalCount);

  // Expand to a flat instance list in spec order (each carries its type's
  // level-spec). The level step assigns one level per instance, in this order.
  const instances: { readonly archetype: Archetype; readonly level: UnitLevelSpec }[] = [];
  spec.units.forEach((u, i) => {
    for (let k = 0; k < counts[i]!; k++) instances.push({ archetype: u.archetype, level: u.level });
  });

  const totalBudget = resolveLevelBudget(spec.levelBudget, context);
  const levels = resolveLevels(instances, totalBudget, context.levelCap, rng);

  return instances.map((inst, i) => scaledUnit(inst.archetype, levels[i]!));
}

/** Total wave count `C ≥ 0`, rounded to an integer. */
function resolveTotalCount(spec: CountSpec, ctx: WaveContext): number {
  const raw = spec.kind === 'fixed' ? spec.value : spec.factor * ctx.handSize;
  return Math.max(0, Math.round(raw));
}

/**
 * Per-unit-spec headcounts. Fixed-count units take their fixed value; the
 * leftover `max(0, C − Σfixed)` is apportioned across the weight-count units by
 * the deterministic largest-remainder method.
 */
function resolveCounts(units: readonly WaveUnitSpec[], totalCount: number): number[] {
  const counts = units.map((u) =>
    u.count.kind === 'fixed' ? Math.max(0, Math.round(u.count.value)) : 0,
  );
  const fixedTotal = counts.reduce((a, b) => a + b, 0);
  const remainder = Math.max(0, totalCount - fixedTotal);

  const weightIdx: number[] = [];
  const weights: number[] = [];
  units.forEach((u, i) => {
    if (u.count.kind === 'weight') {
      weightIdx.push(i);
      weights.push(Math.max(0, u.count.weight));
    }
  });
  if (weightIdx.length > 0) {
    const alloc = apportion(remainder, weights);
    weightIdx.forEach((idx, j) => {
      counts[idx] = alloc[j]!;
    });
  }
  return counts;
}

/** Total level budget `L ≥ 0`, rounded. `mean`/`median` = `factor × centralLevel
 *  × handSize` (= `factor × playerTeamLevel`): the budget scales with the fielded
 *  hand, matching `enemyBudgetFor`'s basis (empty roster → central basis 1, like
 *  `avgTeamLevel`). */
function resolveLevelBudget(spec: LevelBudgetSpec, ctx: WaveContext): number {
  if (spec.kind === 'fixed') return Math.max(0, Math.round(spec.value));
  const central = spec.kind === 'mean' ? rosterMeanLevel(ctx.roster) : rosterMedianLevel(ctx.roster);
  return Math.max(0, Math.round(spec.factor * central * ctx.handSize));
}

function rosterMeanLevel(roster: readonly UnitTemplate[]): number {
  if (roster.length === 0) return 1;
  return roster.reduce((a, u) => a + u.level, 0) / roster.length;
}

function rosterMedianLevel(roster: readonly UnitTemplate[]): number {
  if (roster.length === 0) return 1;
  const sorted = roster.map((u) => u.level).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Assign a level to every expanded instance. Fixed-level instances pin to their
 * authored value (≥ 1, honoured above the cap); the remaining budget is spread
 * across the weight-level instances via `distributeWeightedLevels`.
 */
function resolveLevels(
  instances: readonly { readonly level: UnitLevelSpec }[],
  totalBudget: number,
  cap: number,
  rng: RNG,
): number[] {
  const levels = new Array<number>(instances.length).fill(0);
  let fixedSum = 0;
  const weightIdx: number[] = [];
  const weights: number[] = [];
  instances.forEach((inst, i) => {
    if (inst.level.kind === 'fixed') {
      const lv = Math.max(1, Math.round(inst.level.value));
      levels[i] = lv;
      fixedSum += lv;
    } else {
      weightIdx.push(i);
      weights.push(Math.max(0, inst.level.weight));
    }
  });
  if (weightIdx.length > 0) {
    const alloc = distributeWeightedLevels(rng, totalBudget - fixedSum, weights, cap);
    weightIdx.forEach((idx, j) => {
      levels[idx] = alloc[j]!;
    });
  }
  return levels;
}

/**
 * Distribute `budget` total levels across `weights.length` instances in
 * proportion to `weights`, each clamped to `[1, cap]`. A strict generalization
 * of `distributeBudget` (../enemyBudget.ts):
 *
 * - `total = clamp(round(budget), n, n·cap)` — feasible so every instance can
 *   take ≥ 1 and ≤ cap (over-spending the budget up to `n` when it can't afford
 *   one level each — level must be ≥ 1).
 * - Seed each at 1, then hand out the `total − n` surplus ∝ weight (floored, each
 *   capped at `cap − 1`), and place the integer remainder by largest fractional
 *   share — ties broken by a deterministic Fisher–Yates shuffle.
 *
 * **Uniform weights reduce to `distributeBudget`'s distribution**: equal weights
 * give equal ideal shares, so every fractional remainder ties and the shuffle
 * picks a uniformly random subset to receive the `+1` — the same `base` /
 * `base+1` even split (spread ≤ 1). The exact RNG draw *sequence* differs (a full
 * shuffle vs. a partial one), so a wave is not byte-identical to `rollEnemyWave`
 * — by design (balance is re-derived in Phase X). Non-positive total weight falls
 * back to uniform.
 */
export function distributeWeightedLevels(
  rng: RNG,
  budget: number,
  weights: readonly number[],
  cap: number,
): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const total = Math.min(n * cap, Math.max(n, Math.round(budget)));
  const rawW = weights.reduce((a, b) => a + b, 0);
  const w = rawW > 0 ? weights : weights.map(() => 1);
  const wSum = rawW > 0 ? rawW : n;

  const surplus = total - n; // ≥ 0
  const idealExtra = w.map((wi) => (surplus * wi) / wSum);
  const levels = idealExtra.map((x) => 1 + Math.min(cap - 1, Math.floor(x)));
  let leftover = total - levels.reduce((a, b) => a + b, 0); // ≥ 0

  if (leftover > 0) {
    // Priority order: largest fractional share first, ties → RNG shuffle (so
    // uniform weights → a random subset, matching distributeBudget).
    const order = Array.from({ length: n }, (_, i) => i);
    fisherYates(rng, order);
    const frac = idealExtra.map((x) => x - Math.floor(x));
    order.sort((a, b) => frac[b]! - frac[a]!);
    let guard = total + n + 1; // termination backstop (total ≤ n·cap guarantees fit)
    while (leftover > 0 && guard-- > 0) {
      let placed = false;
      for (const idx of order) {
        if (leftover === 0) break;
        if (levels[idx]! < cap) {
          levels[idx]! += 1;
          leftover -= 1;
          placed = true;
        }
      }
      if (!placed) break;
    }
  }
  return levels;
}

/**
 * Largest-remainder (Hamilton) apportionment of `total` integer seats across
 * `weights`, ties broken by index (deterministic, no RNG). Non-positive total
 * weight or `total ≤ 0` → all zeros.
 */
function apportion(total: number, weights: readonly number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const W = weights.reduce((a, b) => a + b, 0);
  if (W <= 0 || total <= 0) return new Array<number>(n).fill(0);

  const ideal = weights.map((wi) => (total * wi) / W);
  const seats = ideal.map((x) => Math.floor(x));
  const leftover = total - seats.reduce((a, b) => a + b, 0);
  const order = ideal
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
    .map((o) => o.i);
  for (let k = 0; k < leftover; k++) seats[order[k]!]! += 1;
  return seats;
}

/** In-place Fisher–Yates shuffle, drawing from `rng` (uint draws via `int`). */
function fisherYates(rng: RNG, arr: number[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}
