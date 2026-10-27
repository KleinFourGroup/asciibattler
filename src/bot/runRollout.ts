/**
 * The run clone, the World's rollout clone one layer up:
 * `cloneRunForRollout(run, rolloutSeed)` returns an independent Run on a
 * fresh EventBus with its `streamRoot` replaced by a derivation of
 * `rolloutSeed`.
 *
 * The replacement is the clairvoyance guard, as `cloneForRollout`'s
 * re-seed is. Every stream of a Run derives per occurrence from
 * `streamRoot`, so that a load resumes the exact future, and a plain
 * toJSON → fromJSON clone would replay the live run's future rolls
 * (encounter picks, wave rolls, deck draws, port stock): a rollout scored
 * on it would foresee the real dice. Replacing the root diverges every
 * later occurrence at once. The occurrence counters ride the wire
 * unchanged, so the clone goes on from the same position with fresh dice.
 * The clone diverges in the data, on the snapshot before it is read back;
 * the live Run is never mutated.
 *
 * A clone still knows what was rolled before it, since that rides the
 * wire: the map and its node kinds, the boss forewarning, the current
 * offer, stock and prices, and the hand's and piles' contents. A roll on
 * arrival draws fresh from the new root, a sampled future, which is the
 * right meaning.
 *
 * The bus is returned with the run: a World ticks by itself, but a Run
 * advances by bus traffic, and the rollout walker
 * (`tests/fuzz/rollout/walker.ts`) wires its battles onto this bus
 * (`battle:started`, the World built and ticked, `battle:ended`). A
 * rollout's events must never reach the live run's subscribers.
 */

import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { deriveSeed } from '../core/RNG';
import { Run, type RunSnapshot } from '../run/Run';

export interface RunRolloutClone {
  readonly run: Run;
  /** The clone's own bus, where the walker attaches its battles; nothing
   *  on it reaches the live run's subscribers. */
  readonly bus: EventBus<GameEvents>;
  /** The camp-raid candidate's flag: when true, the walker orders the
   *  player team onto a camp member (`orderCampRaid`) at the walk's first
   *  battle spawn, then clears it, so the raid is one battle's, the
   *  decision's own. The walker's battle plan riding the clone handle;
   *  never serialized, never read by `Run`. */
  raidNextBattle?: boolean;
}

export function cloneRunForRollout(live: Run, rolloutSeed: number): RunRolloutClone {
  // A deep copy through the wire format, the JSON round trip a save takes,
  // faithful for every mid-run shape (the piles mid-encounter, a docked
  // port's stock, pending rewards, grant cursors).
  const wire = JSON.parse(JSON.stringify(live.toJSON())) as RunSnapshot;

  // The divergence is one field. The same rollout seed gives the same root
  // and a byte-identical clone.
  wire.streamRoot = deriveSeed(rolloutSeed, 'rolloutRoot');

  // The strike arm is a config input the snapshot does not carry, so the
  // clone takes the live run's; at `hit` it passes no config, as before the
  // dial.
  const bus = new EventBus<GameEvents>();
  const config = live.strike === 'hit' ? undefined : { strike: live.strike };
  return { run: Run.fromJSON(wire, bus, config), bus };
}
