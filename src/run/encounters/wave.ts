/**
 * The wave resolver: `resolveWave(spec, context, rng)` turns one turn's wave
 * spec into the enemy team. A wave spec gives a level budget, a total count,
 * an optional level cap, and the unit types that fill it, each with its
 * claim on the count and on the levels.
 *
 * Resolution runs in two steps:
 *
 * 1. Count. The total count `C` is fixed, or the fielded hand times a
 *    factor. Fixed-count types take their count; what is left, `max(0, C −
 *    Σfixed)`, is shared among the weight-count types in proportion to
 *    weight by largest remainder, with no draw. Fixed counts past `C` leave
 *    the weighted types none.
 * 2. Level. The total level budget `L` is fixed, or the roster's mean or
 *    median level times the fielded hand times a factor. Fixed-level
 *    instances take their authored level, above the cap if one is set, since
 *    an authored level is meant. The rest of the budget, `L − Σfixed`, is
 *    spread over the weight-level instances in proportion to each one's
 *    weight (a type's level-weight is per unit, not shared across its
 *    count), each held to `[1, cap]` (`distributeWeightedLevels`).
 *
 * Pure, with no `Run` or snapshot reads. The only draw is the shuffle that
 * places the level remainder, so a wave is reproducible from its stream and
 * context.
 */

import type { RNG } from '../../core/RNG';
import type { UnitTemplate } from '../../sim/Unit';
import { scaledUnit, type Archetype } from '../../sim/archetypes';

/** A wave's total level budget across its units. `fixed` is an absolute
 *  total; `mean` and `median` multiply the roster's mean or median level by
 *  `factor` and by the fielded hand size, so the budget tracks the fielded
 *  team's total level, where without the hand size a wave of several units
 *  would share one unit's worth of levels. */
export type LevelBudgetSpec =
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'mean'; readonly factor: number }
  | { readonly kind: 'median'; readonly factor: number };

/** A wave's total unit count. `fixed` is absolute; `hand` scales the fielded
 *  hand size by `factor`. */
export type CountSpec =
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'hand'; readonly factor: number };

/**
 * An optional ceiling on each weight-level instance's level; fixed-level
 * instances pass it. Absent, the wave spends its whole budget with no
 * ceiling, so what is authored is what is fielded. Set, each such instance is
 * held to `[1, cap]`, so a fight of many weak bodies keeps a ceiling while a
 * fight of a few strong casters can be authored past it.
 * - `roster` — the roster's highest level plus `delta`.
 * - `fixed` — an absolute ceiling, whatever the roster.
 */
export type LevelCapSpec =
  | { readonly kind: 'roster'; readonly delta: number }
  | { readonly kind: 'fixed'; readonly value: number };

/** How a unit type claims COUNT within the wave: a `fixed` headcount, or a
 *  `weight` share of the leftover count after the fixed units are placed. */
type UnitCountSpec =
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'weight'; readonly weight: number };

/** How a unit type's instances claim LEVEL within the wave: `fixed` pins every
 *  instance to an exact level; `weight` claims a per-instance share of the
 *  remaining level budget (higher weight → higher-level individuals). */
type UnitLevelSpec =
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'weight'; readonly weight: number };

/** One unit type in a wave: an archetype with its count- and level-contribution. */
export interface WaveUnitSpec {
  readonly archetype: Archetype;
  readonly count: UnitCountSpec;
  readonly level: UnitLevelSpec;
  /**
   * The headcount weight each unit of this entry carries under the casualty
   * rule, in place of its archetype's table power. Stamped on the resolved
   * template's `stats.power` after level scaling, so the fallen ledger books
   * it, the survivors rule counts it standing, and the pre-turn risk line
   * reads it. Either direction is legal: a boss-shaped unit worth 6, so its
   * fall moves the pool, or fodder worth 0.5, so a wipe burns half as much.
   * Absent, the archetype's power.
   */
  readonly power?: number;
}

/** One wave: a level budget, a total count, an optional level cap, and the
 *  unit types that fill it. */
export interface WaveSpec {
  readonly levelBudget: LevelBudgetSpec;
  readonly count: CountSpec;
  readonly levelCap?: LevelCapSpec;
  readonly units: readonly WaveUnitSpec[];
}

/**
 * What a wave resolves against, passed in by the caller (`Run.rollTurnWave`)
 * so the resolver stays pure:
 * - `roster` — the player's roster: the basis of `mean` and `median` budgets
 *   and of a `roster` level cap.
 * - `handSize` — the fielded hand size, for `hand` counts and the budget. The
 *   run passes `min(roster, effectiveDrawAmount)`, the folded draw stat, so a
 *   daemon's draw bonus (or `RunConfig.drawAmountAdd`) raises the opposition
 *   with the hand.
 * - `waveSizeMultiplier`, `levelBudgetMultiplier` — the run's difficulty
 *   multipliers on `C` and on `L` (`config/difficulty.ts`; Escalation's level
 *   scales them). Absent, 1.
 */
export interface WaveContext {
  readonly roster: readonly UnitTemplate[];
  readonly handSize: number;
  readonly waveSizeMultiplier?: number;
  readonly levelBudgetMultiplier?: number;
}

/**
 * Resolve a wave spec into an enemy team. The count step draws nothing; the
 * level remainder draws from `rng`.
 */
export function resolveWave(spec: WaveSpec, context: WaveContext, rng: RNG): UnitTemplate[] {
  const totalCount = resolveTotalCount(spec.count, context);
  const counts = resolveCounts(spec.units, totalCount);

  // Expand to a flat instance list in spec order (each carries its type's
  // level-spec). The level step assigns one level per instance, in this order.
  const instances: { readonly archetype: Archetype; readonly level: UnitLevelSpec; readonly power?: number }[] = [];
  spec.units.forEach((u, i) => {
    for (let k = 0; k < counts[i]!; k++) {
      instances.push(u.power === undefined ? { archetype: u.archetype, level: u.level } : { archetype: u.archetype, level: u.level, power: u.power });
    }
  });

  const totalBudget = resolveLevelBudget(spec.levelBudget, context);
  const cap = resolveLevelCap(spec.levelCap, context.roster);
  const levels = resolveLevels(instances, totalBudget, cap, rng);

  return instances.map((inst, i) => {
    const t = scaledUnit(inst.archetype, levels[i]!);
    // The power override is stamped after scaling; every other stat stays as
    // scaled.
    return inst.power === undefined ? t : { ...t, stats: { ...t.stats, power: inst.power } };
  });
}

/**
 * The per-instance ceiling for this wave's weighted spread. Absent,
 * `Infinity`, so the spread spends the full budget unclamped; `roster`, the
 * roster's highest level (1 for an empty roster) plus `delta`; `fixed`, the
 * authored ceiling, at least 1.
 */
function resolveLevelCap(spec: LevelCapSpec | undefined, roster: readonly UnitTemplate[]): number {
  if (spec === undefined) return Infinity;
  if (spec.kind === 'fixed') return Math.max(1, Math.round(spec.value));
  const highest = roster.reduce((m, u) => Math.max(m, u.level), 1);
  return highest + Math.round(spec.delta);
}

/** The total count `C ≥ 0`, scaled by `waveSizeMultiplier` (absent, 1) and
 *  then rounded. */
function resolveTotalCount(spec: CountSpec, ctx: WaveContext): number {
  const raw = spec.kind === 'fixed' ? spec.value : spec.factor * ctx.handSize;
  return Math.max(0, Math.round(raw * (ctx.waveSizeMultiplier ?? 1)));
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

/**
 * The total level budget `L ≥ 0`: `fixed` as authored; `mean` and `median` as
 * `factor × central level × handSize`, an empty roster's central level 1.
 * `levelBudgetMultiplier` (absent, 1) scales either kind before the round. A
 * capped wave's weighted levels sum to at most `n × cap`
 * (`distributeWeightedLevels`), so the multiplier raises them only until they
 * reach it.
 */
function resolveLevelBudget(spec: LevelBudgetSpec, ctx: WaveContext): number {
  const mult = ctx.levelBudgetMultiplier ?? 1;
  if (spec.kind === 'fixed') return Math.max(0, Math.round(spec.value * mult));
  const central = spec.kind === 'mean' ? rosterMeanLevel(ctx.roster) : rosterMedianLevel(ctx.roster);
  return Math.max(0, Math.round(spec.factor * central * ctx.handSize * mult));
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
 * Assign a level to every expanded instance. Fixed-level instances take their
 * authored value (at least 1, above the cap if one is set); the rest of the
 * budget is spread over the weight-level instances by
 * `distributeWeightedLevels`.
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
 * Spread `budget` levels over `weights.length` instances in proportion to
 * `weights`, each held to `[1, cap]`:
 *
 * - `total = clamp(round(budget), n, n·cap)`, so every instance can take at
 *   least 1 and at most `cap`; a budget too small for 1 each is overspent up
 *   to `n`, since a level is at least 1.
 * - Each starts at 1; the surplus `total − n` is handed out in proportion to
 *   weight, floored and capped at `cap − 1` each, and the integer remainder
 *   goes by largest fractional share, ties in shuffled order, past any
 *   instance at its cap.
 *
 * Equal weights give every share the same fraction, so the shuffle picks a
 * uniformly random subset for the `+1`: an even split with a spread of at
 * most 1. A total weight of 0 falls back to equal weights.
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
    // Largest fractional share first; shuffling before the stable sort breaks
    // the ties at random.
    const order = Array.from({ length: n }, (_, i) => i);
    rng.shuffle(order);
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
