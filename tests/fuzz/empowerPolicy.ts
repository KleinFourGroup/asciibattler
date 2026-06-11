/**
 * K4 commit 3 — the fuzz **empower policy**: a serializable per-turn buff
 * policy the bot drives the K4 empower mechanic with, plus the pure selector
 * that decides WHICH hand position to buff.
 *
 * Mirrors the K3c3 redraw-policy pattern (`redrawPolicy.ts`): a small
 * discriminated union, zod validate-on-load, an `--empower=<value>` flag with
 * cheap inline forms and a `.json` file form, default `none` = byte-identical
 * (with `none` the harness doesn't flip the turn gates on for empower's sake,
 * so the existing baselines are untouched).
 *
 * Unlike redraw there is NO toss-or-keep decision: empower is free and
 * strictly positive, so the bot always spends the budget — the only question
 * is WHICH card (and, across turns, whether the picks STACK on one carry or
 * spread). The menu kinds are the interpretable baselines:
 *   - `none`      : never empower (the byte-identical default).
 *   - `random`    : a uniform-random hand card each ask (the naive yardstick).
 *   - `level`     : the highest- (`hi`) or lowest- (`lo`) level hand card —
 *                   the two obvious human heuristics ("sharpen the carry" vs
 *                   "shore up the weak link"). With the stacking `add` merge,
 *                   `hi` re-picks the same carry every turn → stacks.
 *   - `scored`    : argmax of the H7a linear card score over the hand
 *                   (weights min–max normalized over the HAND per decision —
 *                   there's no replacement pool to compare against).
 *
 * Dev-only fuzz tooling — never imported by `src/`.
 */

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { RNG } from '../../src/core/RNG';
import type { UnitTemplate } from '../../src/sim/Unit';
import type { EmpowerAvailability } from '../../src/run/empower';
import { ScoredCardWeightsSchema, type ScoredCardWeights } from './redrawPolicy';
import { minMax, norm } from './scoring';
import { STAT_KEYS } from './strategies/policies';

export type EmpowerPolicy =
  | { readonly kind: 'none' }
  | { readonly kind: 'random' }
  | { readonly kind: 'level'; readonly dir: 'hi' | 'lo' }
  | { readonly kind: 'scored'; readonly weights: ScoredCardWeights };

const EmpowerPolicySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({ kind: z.literal('random') }),
  z.strictObject({ kind: z.literal('level'), dir: z.enum(['hi', 'lo']) }),
  z.strictObject({ kind: z.literal('scored'), weights: ScoredCardWeightsSchema }),
]);

/** Validate an arbitrary parsed-JSON value into an `EmpowerPolicy`. Throws
 *  (zod) on any missing / extra / non-matching field. */
export function parseEmpowerPolicy(input: unknown): EmpowerPolicy {
  return EmpowerPolicySchema.parse(input) as EmpowerPolicy;
}

/** Read + validate a policy from a JSON file — the `--empower=<file>.json`
 *  input (the only way to supply a `scored` policy; a weight vector has no
 *  inline form). */
export function loadEmpowerPolicyFile(path: string): EmpowerPolicy {
  return parseEmpowerPolicy(JSON.parse(readFileSync(path, 'utf8')));
}

/** Serialize a policy to the canonical JSON (2-space indent, trailing newline)
 *  — the format `loadEmpowerPolicyFile` reads back. */
export function serializeEmpowerPolicy(p: EmpowerPolicy): string {
  return JSON.stringify(p, null, 2) + '\n';
}

/** A short, stable label for a policy (stdout notes + reports). */
export function empowerPolicyLabel(p: EmpowerPolicy): string {
  switch (p.kind) {
    case 'none':
      return 'none';
    case 'random':
      return 'random';
    case 'level':
      return `level:${p.dir}`;
    case 'scored':
      return 'scored'; // a weight vector has no compact inline form
  }
}

/**
 * Resolve the `--empower=<value>` flag into a policy:
 *   none              → never empower (byte-identical default)
 *   random            → a uniform-random hand card each turn
 *   level:hi|lo       → the highest-/lowest-level hand card each turn
 *   <path>.json       → a saved policy (validated on load; the `scored` form)
 * An absent flag defaults to `none` — handled by the caller.
 */
export function parseEmpowerFlag(value: string): EmpowerPolicy {
  if (value === 'none') return { kind: 'none' };
  if (value === 'random') return { kind: 'random' };
  if (value.endsWith('.json')) return loadEmpowerPolicyFile(value);
  const parts = value.split(':');
  if (parts[0] === 'level' && parts.length === 2 && (parts[1] === 'hi' || parts[1] === 'lo')) {
    return { kind: 'level', dir: parts[1] };
  }
  throw new Error(
    `Unrecognized --empower value: "${value}" (expected ` +
      `none | random | level:hi | level:lo | <file>.json)`,
  );
}

/**
 * The pure per-decision selector: WHICH hand position to buff (`null` = don't
 * empower). Respects the `availability` budget — `null` with no action left —
 * so the harness's ask-until-null loop covers both the shipped 1/turn budget
 * and an L-era raised budget (where `level`/`scored` re-pick the same argmax
 * → the picks STACK, the user-locked carry-investment model).
 *
 * Determinism: only `random` draws from `rng`; `level` / `scored` tie-break
 * by ascending hand position.
 */
export function selectEmpowerPosition(
  hand: readonly UnitTemplate[],
  availability: EmpowerAvailability,
  policy: EmpowerPolicy,
  rng: RNG,
): number | null {
  if (policy.kind === 'none') return null;
  if (availability.empowersRemaining <= 0) return null;
  if (hand.length === 0) return null;

  if (policy.kind === 'random') {
    return Math.floor(rng.next() * hand.length);
  }

  if (policy.kind === 'level') {
    let best = 0;
    for (let i = 1; i < hand.length; i++) {
      const better =
        policy.dir === 'hi' ? hand[i]!.level > hand[best]!.level : hand[i]!.level < hand[best]!.level;
      if (better) best = i;
    }
    return best;
  }

  // scored — argmax of the H7a linear card score, normalized over the hand.
  const levelRange = minMax(hand.map((c) => c.level));
  const statRanges = STAT_KEYS.map((k) => minMax(hand.map((c) => c.stats[k])));
  const scoreOf = (c: UnitTemplate): number => {
    let s = policy.weights.level * norm(c.level, levelRange) + policy.weights.archetype[c.archetype];
    for (let i = 0; i < STAT_KEYS.length; i++) {
      s += policy.weights.stats[STAT_KEYS[i]!] * norm(c.stats[STAT_KEYS[i]!], statRanges[i]!);
    }
    return s;
  };
  let best = 0;
  let bestScore = scoreOf(hand[0]!);
  for (let i = 1; i < hand.length; i++) {
    const s = scoreOf(hand[i]!);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  }
  return best;
}
