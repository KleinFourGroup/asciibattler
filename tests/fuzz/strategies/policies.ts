/**
 * G5 — composable decision policies for fuzz strategies.
 *
 * A `FuzzStrategy` is just a (node policy, recruit policy) pair plus a name;
 * the factory (`factory.ts`) composes these into the interface the harness
 * consumes. Splitting the two axes is what lets the parameterized menu
 * (`registry.ts`) cover "maximize node kind X" × "prefer recruit Y" as a small
 * table instead of N copy-pasted classes (ROADMAP §G5).
 *
 * Determinism contract: every policy is pure w.r.t. the supplied RNG, and the
 * two `random*` policies reproduce the pre-G5 `PureRandom`/`Greedy` draw
 * patterns byte-for-byte — one `next()` per decision (`pick`/`int` each draw
 * exactly once), and `balancedArchetype` only draws on a ≥2-way tie. So
 * routing the legacy baselines through the factory leaves their fuzz baseline
 * unchanged; only the new strategies add fresh draw sites.
 */

import type { RNG } from '../../../src/core/RNG';
import type { Run } from '../../../src/run/Run';
import type { UnitTemplate, UnitStats } from '../../../src/sim/Unit';
import type { NodeKind } from '../../../src/run/NodeMap';
import {
  ALL_ARCHETYPES,
  baseStatsForArchetype,
  type Archetype,
} from '../../../src/sim/archetypes';

/** Decides which frontier node id to enter. `frontier` is never empty (the
 *  harness aborts the run before calling a policy on an empty frontier). */
export type NodePolicy = (frontier: readonly number[], run: Run, rng: RNG) => number;

/** Decides which offer index to recruit, or `null` to PASS (H6b — decline the
 *  offer). `offer` is never empty. Existing policies always return a `number`;
 *  only the H6b pass policy returns `null`, so the legacy draw patterns (and
 *  fuzz baselines) are untouched. */
export type RecruitPolicy = (
  offer: readonly UnitTemplate[],
  run: Run,
  rng: RNG,
) => number | null;

/**
 * The base-stat keys, derived from a real archetype's `baseStats` block so the
 * per-stat strategy menu tracks the stat vocabulary automatically (add a stat
 * to `config/archetypes.json` → it gets a `stat:<name>` strategy for free).
 * Order = the config authoring order (deterministic).
 */
export const STAT_KEYS = Object.keys(baseStatsForArchetype('melee')) as (keyof UnitStats)[];

/**
 * Node kinds a path strategy can usefully target. `boss` is the forced terminal
 * (never a frontier choice), so it isn't a target. The single source of truth
 * for both the `path:<kind>` menu (`registry.ts`) and the scored strategy's path
 * weights (`scoredWeights.ts`). `as const` preserves the literal
 * `'battle' | 'rest'` element type, so a `Record` over it doesn't demand a
 * `boss` key.
 */
export const PATH_KINDS = ['battle', 'rest'] as const satisfies readonly NodeKind[];

// ---- node policies --------------------------------------------------------

/** Uniform pick over the frontier. The pre-G5 baseline node policy
 *  (`rng.pick(frontier)` — one draw, always). */
export const randomNode: NodePolicy = (frontier, _run, rng) => rng.pick(frontier);

/**
 * Prefer frontier nodes whose `MapNode.kind` is `kind`; uniform among them if
 * any exist, else uniform over the whole frontier (so the path axis only bites
 * when the run actually offers a choice — most floors are all-battle). The
 * `boss`/terminal node is forced, so only `battle`/`rest` are useful targets.
 */
export function maximizeKind(kind: NodeKind): NodePolicy {
  return (frontier, run, rng) => {
    const matches = frontier.filter((id) => nodeKind(run, id) === kind);
    return rng.pick(matches.length > 0 ? matches : frontier);
  };
}

function nodeKind(run: Run, id: number): NodeKind | undefined {
  return run.nodeMap.nodes.find((n) => n.id === id)?.kind;
}

// ---- recruit policies -----------------------------------------------------

/** Uniform pick over the offer. The pre-G5 baseline recruit policy
 *  (`rng.int(0, offer.length - 1)` — one draw, always). */
export const randomRecruit: RecruitPolicy = (offer, _run, rng) => rng.int(0, offer.length - 1);

/**
 * Greedy: prefer the offered archetype with the lowest current roster count.
 * Random tie-break ONLY when ≥2 indices tie — reproducing the pre-G5
 * `GreedyStrategy` draw pattern exactly so its fuzz baseline is unchanged.
 */
export const balancedArchetype: RecruitPolicy = (offer, run, rng) => {
  const counts = countByArchetype(run.team);
  let bestIdx = 0;
  let bestCount = Infinity;
  const ties: number[] = [];
  for (let i = 0; i < offer.length; i++) {
    const c = counts[offer[i]!.archetype];
    if (c < bestCount) {
      bestCount = c;
      bestIdx = i;
      ties.length = 0;
      ties.push(i);
    } else if (c === bestCount) {
      ties.push(i);
    }
  }
  return ties.length > 1 ? rng.pick(ties) : bestIdx;
};

/**
 * Prefer an offered card of `target` archetype; random among matches, falling
 * back to a uniform pick over the whole offer when `target` isn't offered.
 * (Post-F1 offers carry *distinct* archetypes, so there's at most one match in
 * practice — but the multi-match path is handled generically and harmlessly.)
 */
export function preferArchetype(target: Archetype): RecruitPolicy {
  return (offer, _run, rng) => {
    const matches: number[] = [];
    for (let i = 0; i < offer.length; i++) {
      if (offer[i]!.archetype === target) matches.push(i);
    }
    return matches.length > 0 ? rng.pick(matches) : rng.int(0, offer.length - 1);
  };
}

/**
 * Prefer the offered card with the highest `stat` value; random tie-break
 * among the maxima (one draw only when ≥2 tie).
 */
export function maximizeStat(stat: keyof UnitStats): RecruitPolicy {
  return (offer, _run, rng) => {
    let best = -Infinity;
    const ties: number[] = [];
    for (let i = 0; i < offer.length; i++) {
      const v = offer[i]!.stats[stat];
      if (v > best) {
        best = v;
        ties.length = 0;
        ties.push(i);
      } else if (v === best) {
        ties.push(i);
      }
    }
    return ties.length > 1 ? rng.pick(ties) : ties[0]!;
  };
}

/**
 * H6b — a minimal "decline weak offers" policy that PROVES the pass path: if no
 * offered unit has `power >= minPower`, return `null` (PASS — no RNG draw);
 * otherwise pick uniformly among the qualifying offers (one draw). The
 * expressive scorer is H7a — this only needs to exercise `passRecruit` in the
 * harness across a real run.
 */
export function declineBelowPower(minPower: number): RecruitPolicy {
  return (offer, _run, rng) => {
    const qualifying: number[] = [];
    for (let i = 0; i < offer.length; i++) {
      if (offer[i]!.stats.power >= minPower) qualifying.push(i);
    }
    return qualifying.length > 0 ? rng.pick(qualifying) : null;
  };
}

function countByArchetype(team: readonly UnitTemplate[]): Record<Archetype, number> {
  // Initialize every archetype to 0 (F1 widened the recruit pool past
  // melee/ranged) so a new-archetype offer reads a real 0, not undefined.
  const counts = Object.fromEntries(ALL_ARCHETYPES.map((a) => [a, 0])) as Record<
    Archetype,
    number
  >;
  for (const t of team) counts[t.archetype]++;
  return counts;
}
