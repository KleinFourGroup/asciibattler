/**
 * H7a — the linear scored strategy.
 *
 * A single `FuzzStrategy` whose decisions are a weighted sum of normalized
 * features → argmax, expressing path + unit + pass preference simultaneously
 * (vs the one-axis-at-a-time menu in `policies.ts`). The weights live in a
 * `ScoredWeights` vector (`scoredWeights.ts`, loaded from
 * `config/fuzz-strategies.json`); H7b's search ranges over that vector.
 *
 * Determinism: at the default `temperature: 0` the strategy makes ZERO RNG
 * draws (deterministic argmax, lowest-index tiebreaks via `selectByScore`), so
 * "same weights → same decisions" is trivially true and there's no draw-pattern
 * to baseline. The `rng` channel is threaded but unused — the inert seam for a
 * future softmax / random-tiebreak toggle.
 */

import type { RNG } from '../../../src/core/RNG';
import type { NodeMap, NodeKind } from '../../../src/run/NodeMap';
import type { PortStock, Run } from '../../../src/run/Run';
import type { UnitStats, UnitTemplate } from '../../../src/sim/Unit';
import { ALL_ARCHETYPES, type Archetype } from '../../../src/sim/archetypes';
import { minMax, norm, type MinMax } from '../scoring';
import { STAT_KEYS } from './policies';
import type { FuzzStrategy, PortBuy } from '../Strategy';
import type { PortWeights, ScoredWeights } from './scoredWeights';

// ---- selection seam -------------------------------------------------------

export interface SelectOptions {
  /** Softmax temperature. 0 (default) = deterministic argmax. RESERVED — values
   *  > 0 are not enabled this cycle (the H7a seam decision). */
  readonly temperature?: number;
  /** Tiebreak among equal-top scores. 'lowest' (default) = lowest index, no RNG
   *  draw. 'random' is RESERVED — not enabled this cycle. */
  readonly tiebreak?: 'lowest' | 'random';
}

/**
 * The one selection primitive both decisions route through. At the default
 * (temperature 0, tiebreak 'lowest') it's a deterministic argmax with
 * lowest-index ties and draws NOTHING from `rng`. Softmax sampling and random
 * tiebreaks are a reserved future toggle — enabling them is a localized edit
 * here plus dropping `temperature` into the search box; the `rng` is already
 * threaded from the harness. Until then they throw loudly rather than silently
 * degrading to argmax.
 */
export function selectByScore(
  scores: readonly number[],
  _rng: RNG,
  opts: SelectOptions = {},
): number {
  const temperature = opts.temperature ?? 0;
  const tiebreak = opts.tiebreak ?? 'lowest';
  if (temperature !== 0 || tiebreak !== 'lowest') {
    throw new Error(
      'selectByScore: stochastic selection (temperature > 0 / random tiebreak) ' +
        'is reserved but not enabled this cycle — see the H7a selection seam',
    );
  }
  let bestIdx = 0;
  let best = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i]! > best) {
      best = scores[i]!;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ---- path scoring (full-path backward DP) ---------------------------------

function kindWeight(kind: NodeKind, w: ScoredWeights): number {
  switch (kind) {
    case 'battle':
      return w.path.battle;
    case 'rest':
      return w.path.rest;
    case 'elite':
      return w.path.elite; // W2 — the optional harder detour's route weight
    case 'port':
      return w.path.port; // 50c — the shop dock (a real route weight once §50d sells)
    case 'boss':
      return 0; // forced terminal — no weight
  }
}

/**
 * Build a memoized `bestScore(nodeId)` = `kindWeight(node) + max over children
 * of bestScore(child)` for the given map + weights. The map is a layered DAG
 * with one node per hop on every root→terminal path, so max-total ==
 * max-average — picking the frontier child with the highest `bestScore` has no
 * long-path bias.
 */
function makeBestScore(map: NodeMap, w: ScoredWeights): (id: number) => number {
  const adj = new Map<number, number[]>();
  for (const e of map.edges) {
    const list = adj.get(e.from);
    if (list) list.push(e.to);
    else adj.set(e.from, [e.to]);
  }
  const kindOf = new Map<number, NodeKind>(map.nodes.map((n) => [n.id, n.kind]));
  const memo = new Map<number, number>();
  const best = (id: number): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const kw = kindWeight(kindOf.get(id) ?? 'battle', w);
    const children = adj.get(id);
    let value = kw;
    if (children && children.length > 0) {
      let mx = -Infinity;
      for (const c of children) mx = Math.max(mx, best(c));
      value = kw + mx;
    }
    memo.set(id, value);
    return value;
  };
  return best;
}

// ---- unit scoring (normalized over {offer ∪ roster}) ----------------------

interface Features {
  readonly level: number;
  readonly stats: readonly number[]; // aligned to STAT_KEYS
  readonly total: number;
}

function featuresOf(stats: UnitStats, level: number): Features {
  const arr = STAT_KEYS.map((k) => stats[k]);
  return { level, stats: arr, total: arr.reduce((a, b) => a + b, 0) };
}

interface Normalizers {
  readonly level: MinMax;
  readonly total: MinMax;
  readonly stats: readonly MinMax[]; // aligned to STAT_KEYS
}

/** Min–max ranges for every continuous feature over `{offer ∪ roster}`. */
function makeNormalizers(units: readonly Features[]): Normalizers {
  return {
    level: minMax(units.map((f) => f.level)),
    total: minMax(units.map((f) => f.total)),
    stats: STAT_KEYS.map((_k, i) => minMax(units.map((f) => f.stats[i]!))),
  };
}

/**
 * The continuous-only weighted score (level + per-stat + total). Excludes
 * archetype/composition — the terms that don't apply to a "roster-average unit",
 * so this is exactly what the pass decision compares.
 */
function continuousScore(f: Features, n: Normalizers, w: ScoredWeights): number {
  let s = w.level * norm(f.level, n.level) + w.total * norm(f.total, n.total);
  for (let i = 0; i < STAT_KEYS.length; i++) {
    s += w.stats[STAT_KEYS[i]!] * norm(f.stats[i]!, n.stats[i]!);
  }
  return s;
}

function rosterAverageFeatures(team: readonly UnitTemplate[]): Features {
  const n = team.length;
  const stats = STAT_KEYS.map((k) => team.reduce((s, u) => s + u.stats[k], 0) / n);
  return {
    level: team.reduce((s, u) => s + u.level, 0) / n,
    stats,
    total: stats.reduce((a, b) => a + b, 0),
  };
}

function countByArchetype(team: readonly UnitTemplate[]): Record<Archetype, number> {
  const counts = Object.fromEntries(ALL_ARCHETYPES.map((a) => [a, 0])) as Record<Archetype, number>;
  for (const t of team) counts[t.archetype]++;
  return counts;
}

// ---- the shared offer scorer (recruit + port unit slots, 59b) --------------

interface OfferScoring {
  /** Full weighted score per offer card (archetype + composition +
   *  continuous), aligned to the offer. */
  readonly scores: readonly number[];
  readonly offerFeatures: readonly Features[];
  readonly normalizers: Normalizers;
}

/**
 * Score a set of candidate unit templates against the roster — THE recruit
 * scorer, factored out at 59b so port unit slots reuse it wholesale ("a port
 * unit is a priced recruit"). Normalization spans {offer ∪ roster}, exactly
 * as `pickRecruit` always did; the composition term is the H7c
 * target-fraction pull.
 */
function scoreOffer(
  offer: readonly UnitTemplate[],
  team: readonly UnitTemplate[],
  weights: ScoredWeights,
): OfferScoring {
  const offerFeatures = offer.map((u) => featuresOf(u.stats, u.level));
  const teamFeatures = team.map((u) => featuresOf(u.stats, u.level));
  const normalizers = makeNormalizers([...offerFeatures, ...teamFeatures]);
  const rosterCount = countByArchetype(team);
  const rosterFraction = (a: Archetype): number =>
    team.length === 0 ? 0 : rosterCount[a] / team.length;
  const scores = offer.map(
    (card, i) =>
      weights.archetype[card.archetype] +
      weights.compWeight * (weights.composition[card.archetype] - rosterFraction(card.archetype)) +
      continuousScore(offerFeatures[i]!, normalizers, weights),
  );
  return { scores, offerFeatures, normalizers };
}

// ---- the port-purchase scorer (59b) ----------------------------------------

/** Bits per unit of the `bankReserve` and `priceSensitivity` dims: the
 *  reserve floor spans "none" (≤0, half the [-1,1] sampling box — the 50g
 *  fixed policy's spend-freely shape) up to ~two unit prices at 1.0, and a
 *  priceSensitivity of 1.0 charges one full score-point per 50 bits (price
 *  book: units 25–35 base, daemons ≤55). A FIXED scale, deliberately not
 *  min–max over the candidates: a shrinking candidate set would zero the
 *  penalty on the last slot standing and re-rank between asks. */
export const BITS_SCALE = 50;

/**
 * One ask of the 59a ask-until-null loop: the best affordable slot by net
 * score, or `null` to stop buying. Candidates are ordered daemons → units →
 * packets (slot order within each lane) so the lowest-index tiebreak matches
 * the 50g fixed policy's lane order at all-zero weights — a zero `port`
 * group IS the fixed policy, transaction for transaction (pinned in
 * scored.test.ts). Net score: flat per-kind value (daemon/packet) or the
 * shared recruit score + `unitBias` (units), minus `priceSensitivity ×
 * price / BITS_SCALE`. A negative best net score means nothing on offer is
 * worth its price — stop.
 */
function pickPortBuyScored(
  stock: PortStock,
  run: Run,
  rng: RNG,
  weights: ScoredWeights,
  port: PortWeights,
  temperature: number,
): PortBuy | null {
  const reserve = Math.max(0, port.bankReserve) * BITS_SCALE;
  const affordable = (price: number): boolean => run.bits >= price && run.bits - price >= reserve;

  const candidates: PortBuy[] = [];
  const prices: number[] = [];
  // value() is computed lazily per lane below; unit slots share ONE
  // scoreOffer pass over every unsold unit template (the normalizers must
  // span the full unit offer, affordable or not — same set a recruit offer
  // would present).
  const unitTemplates = stock.units.filter((s) => !s.sold).map((s) => s.template);
  const unitScores = scoreOffer(unitTemplates, run.team, weights).scores;
  const values: number[] = [];

  stock.daemons.forEach((slot, index) => {
    if (slot.sold || !affordable(slot.price)) return;
    candidates.push({ kind: 'daemon', index });
    prices.push(slot.price);
    values.push(port.daemonValue);
  });
  let unsoldUnitIdx = 0;
  stock.units.forEach((slot, index) => {
    if (slot.sold) return;
    const score = unitScores[unsoldUnitIdx++]!;
    if (!affordable(slot.price)) return;
    candidates.push({ kind: 'unit', index });
    prices.push(slot.price);
    values.push(score + port.unitBias);
  });
  stock.packets.forEach((slot, index) => {
    if (slot.sold || !affordable(slot.price) || !run.cacheHasRoom) return;
    candidates.push({ kind: 'packet', index });
    prices.push(slot.price);
    values.push(port.packetValue);
  });
  if (candidates.length === 0) return null;

  const net = values.map((v, i) => v - port.priceSensitivity * (prices[i]! / BITS_SCALE));
  const best = selectByScore(net, rng, { temperature });
  if (net[best]! < 0) return null;
  return candidates[best]!;
}

// ---- the strategy ---------------------------------------------------------

export function scoredStrategy(name: string, weights: ScoredWeights): FuzzStrategy {
  const temperature = weights.temperature ?? 0;
  const port = weights.port;
  return {
    name,
    pickNextNode: (frontier, run, rng) => {
      const best = makeBestScore(run.nodeMap, weights);
      // Sort by id so equal-bestScore ties resolve to the lowest node id
      // (selectByScore breaks ties to the lowest index).
      const ordered = [...frontier].sort((a, b) => a - b);
      const scores = ordered.map((id) => best(id));
      return ordered[selectByScore(scores, rng, { temperature })]!;
    },
    pickRecruit: (offer, run, rng) => {
      const team = run.team;
      // The composition term inside scoreOffer pulls toward the per-archetype
      // target *fraction* of the roster: positive while under target (a
      // count-0 archetype still gets a foothold), saturating / negative as it
      // fills — so the search can seed AND stack a comp instead of only
      // rich-get-richer-ing the incumbents.
      const { scores, offerFeatures, normalizers } = scoreOffer(offer, team, weights);
      const bestIdx = selectByScore([...scores], rng, { temperature });

      // Pass = a virtual "roster-average unit" candidate, compared on the
      // continuous terms only. An empty roster has no average → never pass.
      if (team.length === 0) return bestIdx;
      const bestContinuous = continuousScore(offerFeatures[bestIdx]!, normalizers, weights);
      const avgContinuous = continuousScore(rosterAverageFeatures(team), normalizers, weights);
      if (bestContinuous - avgContinuous + weights.passBias < 0) return null;
      return bestIdx;
    },
    // 59b — present ONLY when the vector carries the optional `port` group:
    // an old vector = no method = the harness's hardwired 50g branch, byte
    // for byte (the kickoff's fixed-policy-defaults lock).
    ...(port !== undefined
      ? {
          pickPortBuy: (stock: PortStock, run: Run, rng: RNG) =>
            pickPortBuyScored(stock, run, rng, weights, port, temperature),
        }
      : {}),
  };
}
