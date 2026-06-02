/**
 * G5 — fuzz-strategy factory. Composes a (node policy, recruit policy) pair
 * into the `FuzzStrategy` the harness consumes. This is the whole "factory":
 * a strategy is now *data* (a name + two policies), so the parameterized menu
 * in `registry.ts` is a table, not N copy-pasted classes (ROADMAP §G5
 * decision point — factories over subclasses).
 */

import type { FuzzStrategy } from '../Strategy';
import type { NodePolicy, RecruitPolicy } from './policies';

export function composeStrategy(
  name: string,
  node: NodePolicy,
  recruit: RecruitPolicy,
): FuzzStrategy {
  return {
    name,
    pickNextNode: (frontier, run, rng) => node(frontier, run, rng),
    pickRecruit: (offer, run, rng) => recruit(offer, run, rng),
  };
}
