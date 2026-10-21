/**
 * The rollout clone: `cloneForRollout(world, rolloutSeed)` returns an
 * independent World on a fresh EventBus with each of its RNG streams
 * re-seeded from `rolloutSeed`.
 *
 * The re-seed is the clairvoyance guard and must stay. A WorldSnapshot
 * holds its RNG streams verbatim, so that a save and a trace replay resume
 * the exact stream (`snapshot-roundtrip.test.ts` pins the identical
 * futures). A plain toJSON → fromJSON clone would then replay the live
 * battle's future rolls, and a rollout scored on it would foresee the real
 * dice. The clone diverges in the data, on the snapshot before it is read
 * back: `World` itself is untouched, and the live world is never mutated.
 *
 * The searcher derives the rollout seeds from its own stream and passes
 * the same seed for rollout k of every candidate, so the candidates face
 * the same luck. The same seed gives a byte-identical rollout.
 *
 * A clone carries no driver state: a rollout applies one candidate command
 * and ticks, with no search and no script inside the horizon, so the live
 * driver's fields never matter to it. A rollout that ran scripts would
 * need the driver's `lastCommandTick` and `standingScriptId` carried.
 */

import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { deriveSeed } from '../core/RNG';
import { World, type WorldSnapshot } from '../sim/World';

export function cloneForRollout(world: World, rolloutSeed: number): World {
  // A deep copy through the wire format, the JSON round trip the save's
  // tests hold faithful for every mid-battle shape (actions in flight,
  // claims, cooldowns, pending commands).
  const wire = JSON.parse(JSON.stringify(world.toJSON())) as WorldSnapshot;

  // The divergence: each stream re-seeded by key off the rollout seed, so
  // the streams are independent of each other and of the live world by
  // construction, with no order between them to keep. A world with no
  // camps has `campRng: null` and keeps it.
  wire.rng = { state: deriveSeed(rolloutSeed, 'rolloutRoot') };
  wire.combatRng = { state: deriveSeed(rolloutSeed, 'combat') };
  if (wire.campRng !== null) wire.campRng = { state: deriveSeed(rolloutSeed, 'campSetup') };

  // A fresh bus: a rollout's events must never reach the live world's
  // subscribers.
  return World.fromJSON(wire, new EventBus<GameEvents>());
}
