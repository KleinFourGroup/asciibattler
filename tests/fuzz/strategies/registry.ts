/**
 * G5 — the fuzz strategy menu. One table built from the factory + policies,
 * config-derived where it can be: the per-archetype set tracks `ALL_ARCHETYPES`
 * and the per-stat set tracks the base-stat vocabulary, so adding an archetype
 * or a stat auto-extends the menu with no edit here.
 *
 * Both CLIs (`tests/fuzz/cli.ts` + `tools/run-config/cli.ts`) consume this
 * single registry instead of each maintaining its own STRATEGIES record.
 *
 * The menu (Phase-G slice of the ROADMAP's strategy brief):
 *   pure-random, greedy                         — the two baselines
 *   recruit:<archetype>   (one per ALL_ARCHETYPES)  — recruit-priority per archetype
 *   stat:<stat>           (one per STAT_KEYS)        — recruit-priority per stat
 *   path:battle, path:rest                          — path maximizing a node kind
 * H1 added the `power` stat, so `stat:power` now auto-joins the per-stat set via
 * STAT_KEYS (the config-derived menu doing its job). H6b added `pass:weak` — a
 * minimal decline-below-threshold policy that exercises the new `passRecruit`
 * path; the expressive scorer is still H7a. It's kept OUT of the default sweep
 * (it returns `null`, the one policy that does) so the baselines are unchanged.
 *
 * `DEFAULT_STRATEGY_NAMES` is the set `npm run fuzz` sweeps when no `--strategy`
 * is given — kept to the two baselines so the default run stays fast; the full
 * menu is opt-in via `--strategy=NAME` or `--strategy=all`.
 */

import type { FuzzStrategy } from '../Strategy';
import { ALL_ARCHETYPES } from '../../../src/sim/archetypes';
import type { NodeKind } from '../../../src/run/NodeMap';
import { composeStrategy } from './factory';
import {
  STAT_KEYS,
  randomNode,
  maximizeKind,
  randomRecruit,
  balancedArchetype,
  preferArchetype,
  maximizeStat,
  declineBelowPower,
} from './policies';

/** Node kinds a path strategy can usefully target. `boss` is the forced
 *  terminal node (never a frontier choice), so it isn't a strategy. */
const PATH_KINDS: readonly NodeKind[] = ['battle', 'rest'];

function buildFactories(): Record<string, () => FuzzStrategy> {
  const out: Record<string, () => FuzzStrategy> = {
    'pure-random': () => composeStrategy('pure-random', randomNode, randomRecruit),
    greedy: () => composeStrategy('greedy', randomNode, balancedArchetype),
  };
  for (const archetype of ALL_ARCHETYPES) {
    const name = `recruit:${archetype}`;
    out[name] = () => composeStrategy(name, randomNode, preferArchetype(archetype));
  }
  for (const stat of STAT_KEYS) {
    const name = `stat:${stat}`;
    out[name] = () => composeStrategy(name, randomNode, maximizeStat(stat));
  }
  for (const kind of PATH_KINDS) {
    const name = `path:${kind}`;
    out[name] = () => composeStrategy(name, maximizeKind(kind), randomRecruit);
  }
  // H6b — the pass/no-recruit proof strategy. Declines offers whose power is
  // below the threshold (exercising `passRecruit`), else recruits. Opt-in only.
  out['pass:weak'] = () => composeStrategy('pass:weak', randomNode, declineBelowPower(2));
  return out;
}

/** name → factory. The single source of truth for "what strategies exist". */
export const STRATEGY_FACTORIES: Record<string, () => FuzzStrategy> = buildFactories();

/** All registered strategy names, in registration order. */
export const STRATEGY_NAMES: readonly string[] = Object.keys(STRATEGY_FACTORIES);

/** The default sweep set (no `--strategy` given): the two baselines only. */
export const DEFAULT_STRATEGY_NAMES: readonly string[] = ['pure-random', 'greedy'];

/** Build a strategy by name, or `undefined` if the name isn't registered. */
export function makeStrategy(name: string): FuzzStrategy | undefined {
  return STRATEGY_FACTORIES[name]?.();
}

/** Fresh instances of the default sweep set. */
export function makeDefaultStrategies(): FuzzStrategy[] {
  return DEFAULT_STRATEGY_NAMES.map((name) => STRATEGY_FACTORIES[name]!());
}

/** Fresh instances of every registered strategy. */
export function makeAllStrategies(): FuzzStrategy[] {
  return STRATEGY_NAMES.map((name) => STRATEGY_FACTORIES[name]!());
}
