/**
 * K3 commit 3 — the fuzz **redraw policy**: a serializable per-turn card-toss
 * policy the bot drives the K3 redraw mechanic with, plus the pure selector
 * that decides WHICH hand positions to toss.
 *
 * Mirrors the J4 objective-proclivity pattern (`objectiveStrategy.ts`): a small
 * discriminated union, zod validate-on-load, a `--redraw=<value>` flag with
 * cheap inline forms and a `.json` file form, default `none` = byte-identical
 * (with `none` the harness never flips the turn gates on, so the existing
 * baselines are untouched).
 *
 * The menu kinds are the interpretable baselines:
 *   - `none`      : never redraw (gates stay OFF — the byte-identical default).
 *   - `random`    : toss `cards` uniform-random hand cards (the naive yardstick).
 *   - `level`     : toss the `cards` lowest-level hand cards (the obvious
 *                   human heuristic). `cards: 0` is the GATES-ON CONTROL — it
 *                   flips the gated path on but never tosses, isolating pure
 *                   gate-alignment from redraw effect.
 *   - `scored`    : the H7a linear model on each hand card vs the EXPECTED
 *                   REPLACEMENT — the mean score of the un-drawn pool (draw +
 *                   discard piles, which the bot legitimately knows by counting
 *                   its own deck). Toss every card the pool beats by more than
 *                   `threshold` (the recruitment `passBias` analogue: lower =
 *                   toss more eagerly, higher = keep more). Which / when / how
 *                   many all fall out of the one dial.
 *
 * Dev-only fuzz tooling — never imported by `src/`.
 */

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { RNG } from '../../src/core/RNG';
import type { UnitStats, UnitTemplate } from '../../src/sim/Unit';
import type { RedrawAvailability } from '../../src/run/redraw';
import { ALL_ARCHETYPES, type Archetype } from '../../src/sim/archetypes';
import { minMax, norm, numberRecordSchema } from './scoring';
import { STAT_KEYS } from './strategies/policies';

/**
 * The weight vector of the `scored` redraw policy — one term per feature a
 * card shows the player: level + base stats (min–max normalized over
 * hand ∪ pool per decision, so weights are scale-free) + a flat per-archetype
 * affinity. Keys track `STAT_KEYS` / `ALL_ARCHETYPES` (a new stat or archetype
 * auto-extends the schema).
 */
export interface ScoredCardWeights {
  readonly level: number;
  readonly stats: Record<keyof UnitStats, number>;
  readonly archetype: Record<Archetype, number>;
}

export type RedrawPolicy =
  | { readonly kind: 'none' }
  | { readonly kind: 'random'; readonly cards: number }
  | { readonly kind: 'level'; readonly cards: number }
  | { readonly kind: 'scored'; readonly weights: ScoredCardWeights; readonly threshold: number };

/** Exported for `empowerPolicy.ts` (K4c3) — its `scored` variant takes the
 *  same card-feature weight vector. */
export const ScoredCardWeightsSchema = z.strictObject({
  level: z.number(),
  stats: numberRecordSchema(STAT_KEYS),
  archetype: numberRecordSchema(ALL_ARCHETYPES),
});

// `cards: 0` is deliberately legal — it's the gates-on control (see header).
const CARD_COUNT = z.number().int().min(0);

const RedrawPolicySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({ kind: z.literal('random'), cards: CARD_COUNT }),
  z.strictObject({ kind: z.literal('level'), cards: CARD_COUNT }),
  z.strictObject({
    kind: z.literal('scored'),
    weights: ScoredCardWeightsSchema,
    threshold: z.number(),
  }),
]);

/** Validate an arbitrary parsed-JSON value into a `RedrawPolicy`. Throws (zod)
 *  on any missing / extra / non-matching field. */
export function parseRedrawPolicy(input: unknown): RedrawPolicy {
  return RedrawPolicySchema.parse(input) as RedrawPolicy;
}

/** Read + validate a policy from a JSON file — the `--redraw=<file>.json` input
 *  (the only way to supply a `scored` policy; a weight vector has no inline
 *  form). */
export function loadRedrawPolicyFile(path: string): RedrawPolicy {
  return parseRedrawPolicy(JSON.parse(readFileSync(path, 'utf8')));
}

/** Serialize a policy to the canonical JSON (2-space indent, trailing newline)
 *  — the format `loadRedrawPolicyFile` reads back. */
export function serializeRedrawPolicy(p: RedrawPolicy): string {
  return JSON.stringify(p, null, 2) + '\n';
}

/** A short, stable label for a policy (stdout notes + reports). */
export function redrawPolicyLabel(p: RedrawPolicy): string {
  switch (p.kind) {
    case 'none':
      return 'none';
    case 'random':
      return `random:${p.cards}`;
    case 'level':
      return `level:${p.cards}`;
    case 'scored':
      return 'scored'; // a weight vector has no compact inline form
  }
}

/**
 * Resolve the `--redraw=<value>` flag into a policy:
 *   none              → never redraw (byte-identical default)
 *   random:<k>        → toss k random cards each turn
 *   level:<k>         → toss the k lowest-level cards each turn (k=0 = the
 *                       gates-on control)
 *   <path>.json       → a saved policy (validated on load; the `scored` form)
 * An absent flag defaults to `none` — handled by the caller.
 */
export function parseRedrawFlag(value: string): RedrawPolicy {
  if (value === 'none') return { kind: 'none' };
  if (value.endsWith('.json')) return loadRedrawPolicyFile(value);
  const parts = value.split(':');
  if ((parts[0] === 'random' || parts[0] === 'level') && parts.length === 2) {
    return parseRedrawPolicy({ kind: parts[0], cards: Number(parts[1]) });
  }
  throw new Error(
    `Unrecognized --redraw value: "${value}" (expected ` +
      `none | random:<k> | level:<k> | <file>.json)`,
  );
}

/**
 * The pure per-decision selector: WHICH hand positions to toss (ascending;
 * `[]` = don't redraw). `hand` / `pool` are the resolved card templates — the
 * pool is the un-drawn remainder (draw + discard piles), i.e. what a redraw
 * could actually pull. Respects the `availability` budget: returns `[]` with
 * no action left, and clamps the selection to `cardsRemaining` keeping the
 * WORST cards. An empty pool always returns `[]` — the only replacements
 * would be the just-tossed cards themselves (the H5 recycle).
 *
 * Determinism: only `random` draws from `rng`; `level` / `scored` tie-break by
 * ascending hand position.
 */
export function selectRedrawPositions(
  hand: readonly UnitTemplate[],
  pool: readonly UnitTemplate[],
  availability: RedrawAvailability,
  policy: RedrawPolicy,
  rng: RNG,
): number[] {
  if (policy.kind === 'none') return [];
  if (availability.redrawsRemaining <= 0) return [];
  const budget = Math.min(availability.cardsRemaining, hand.length);
  if (budget <= 0 || pool.length === 0) return [];

  if (policy.kind === 'random') {
    const k = Math.min(policy.cards, budget);
    if (k <= 0) return [];
    // Partial Fisher–Yates over the positions: k distinct uniform picks.
    const positions = hand.map((_c, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rng.next() * (positions.length - i));
      [positions[i], positions[j]] = [positions[j]!, positions[i]!];
    }
    return positions.slice(0, k).sort((a, b) => a - b);
  }

  if (policy.kind === 'level') {
    const k = Math.min(policy.cards, budget);
    if (k <= 0) return [];
    const byLevel = hand
      .map((card, i) => ({ level: card.level, i }))
      .sort((a, b) => a.level - b.level || a.i - b.i);
    return byLevel
      .slice(0, k)
      .map((e) => e.i)
      .sort((a, b) => a - b);
  }

  // scored — normalize level + stats over hand ∪ pool, score everything, and
  // toss each hand card the pool's MEAN beats by more than the threshold.
  const all = [...hand, ...pool];
  const levelRange = minMax(all.map((c) => c.level));
  const statRanges = STAT_KEYS.map((k) => minMax(all.map((c) => c.stats[k])));
  const scoreOf = (c: UnitTemplate): number => {
    let s = policy.weights.level * norm(c.level, levelRange) + policy.weights.archetype[c.archetype];
    for (let i = 0; i < STAT_KEYS.length; i++) {
      s += policy.weights.stats[STAT_KEYS[i]!] * norm(c.stats[STAT_KEYS[i]!], statRanges[i]!);
    }
    return s;
  };
  const poolMean = pool.reduce((acc, c) => acc + scoreOf(c), 0) / pool.length;
  const candidates = hand
    .map((card, i) => ({ score: scoreOf(card), i }))
    .filter((e) => poolMean - e.score > policy.threshold)
    .sort((a, b) => a.score - b.score || a.i - b.i); // worst first — what the clamp keeps
  return candidates
    .slice(0, budget)
    .map((e) => e.i)
    .sort((a, b) => a - b);
}
