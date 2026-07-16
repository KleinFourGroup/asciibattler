/**
 * 57d — the rollout clone seam (the portfolio searcher's foundation).
 *
 * `cloneForRollout(world, rolloutSeed)` returns an independent World on a
 * fresh EventBus with BOTH RNG streams re-seeded from `rolloutSeed`.
 *
 * Why the re-seed is load-bearing (the CLAIRVOYANCE GUARD, non-negotiable
 * per the round scope guards): WorldSnapshot v34 serializes both RNG
 * streams verbatim — BY DESIGN, so save/load and trace replay resume the
 * exact stream (the A2 contract; snapshot-roundtrip.test.ts asserts
 * byte-identical futures BECAUSE of it). A plain toJSON→fromJSON clone
 * therefore replays the live battle's exact future rolls, and a rollout
 * scored on one would foresee the real dice. The seam diverges at the
 * DATA level (the wire snapshot, before deserialization) — World itself
 * is untouched, and the live world is never mutated.
 *
 * Common-random-numbers contract (the §57c lock): the searcher derives
 * per-k rollout seeds from its OWN forked stream and passes the SAME
 * seed for rollout k of EVERY candidate, so candidates are compared
 * under identical luck — the round's paired same-seed methodology,
 * applied inside the search. Same seed ⇒ byte-identical rollout (the
 * determinism contract extends into the clones).
 *
 * Driver-state carry (the 57d cut card) resolved to a NO-OP for v1:
 * rollouts apply ONE candidate command and tick — no re-searching and no
 * script evaluation happens inside a horizon, so the live driver's
 * counters never matter to a clone. (H2-rule receipt: the predicted
 * side effect's absence means the work isn't needed, not that it was
 * missed. If a later design runs scripts mid-rollout, this comment is
 * the landing note: carry `lastCommandTick`/`standingScriptId` then.)
 */

import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG } from '../core/RNG';
import { World, type WorldSnapshot } from '../sim/World';

export function cloneForRollout(world: World, rolloutSeed: number): World {
  // Deep copy via the wire format — the same JSON round-trip the A2
  // save/load contract proves faithful for every mid-battle shape
  // (in-flight actions, claims, cooldowns, pending commands).
  const wire = JSON.parse(JSON.stringify(world.toJSON())) as WorldSnapshot;

  // The divergence: both streams re-seeded from the rollout seed, as two
  // independent forks of one stream (so run-level and combat rolls in the
  // clone are independent of each other, not just of the live world).
  const seedStream = new RNG(rolloutSeed);
  wire.rng = seedStream.fork().toJSON();
  wire.combatRng = seedStream.fork().toJSON();

  // Fresh bus: rollout events must never reach the live subscribers
  // (renderer, metrics collectors, the trace recorder).
  return World.fromJSON(wire, new EventBus<GameEvents>());
}
