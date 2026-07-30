/**
 * 69a — the run-clone seam (the rollout-arbitration round's foundation;
 * the 57d pattern one layer up).
 *
 * `cloneRunForRollout(run, rolloutSeed)` returns an independent Run on a
 * fresh EventBus with ALL EIGHT serialized RNG streams re-seeded from
 * `rolloutSeed`.
 *
 * Why the re-seed is load-bearing (the CLAIRVOYANCE GUARD, verbatim from
 * `cloneForRollout` in rollout.ts): RunSnapshot v40 serializes every
 * stream verbatim — BY DESIGN, so save/load resumes the exact future
 * (the A2/H5 contract). A plain toJSON→fromJSON clone therefore replays
 * the live run's exact future rolls — encounter selections, wave rolls,
 * deck draws, port stock — and a rollout scored on one would foresee the
 * real dice. The seam diverges at the DATA level (the wire snapshot,
 * before deserialization); the live Run is never mutated.
 *
 * What a clone legitimately still knows (the spec's clairvoyance
 * inventory — pre-rolled facts ride the wire untouched): the map DAG +
 * node kinds, the §66 boss forewarning pair, the current
 * offer/stock/prices, hand + piles' CONTENTS. On-arrival rolls sample
 * fresh off the re-seeded streams — sampled futures, the correct
 * semantics.
 *
 * The eight forks come off ONE seed stream so every clone stream is
 * independent of the others (not just of the live run) — the rollout.ts
 * two-stream idiom, extended. Fork ORDER is part of the determinism
 * contract (same rolloutSeed ⇒ byte-identical clone).
 *
 * The fresh bus is RETURNED alongside the run: unlike a World (which
 * ticks self-contained), a Run advances via bus traffic — the 69b
 * walker wires its battle machinery (battle:started → build World →
 * tick → battle:ended) onto exactly this bus. Rollout events must never
 * reach the live subscribers.
 */

import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG } from '../core/RNG';
import { Run, type RunSnapshot } from '../run/Run';

export interface RunRolloutClone {
  readonly run: Run;
  /** The clone's private bus — the 69b walker's battle machinery attaches
   *  here; nothing on it ever reaches the live run's subscribers. */
  readonly bus: EventBus<GameEvents>;
}

export function cloneRunForRollout(live: Run, rolloutSeed: number): RunRolloutClone {
  // Deep copy via the wire format — the same JSON round-trip the A2/H5
  // save contract proves faithful for every mid-run shape (mid-encounter
  // deck piles, docked port stock, pending rewards, grant cursors).
  const wire = JSON.parse(JSON.stringify(live.toJSON())) as RunSnapshot;

  // The divergence: all eight streams re-seeded as independent forks of
  // one seed stream. Order matters (the determinism contract) — keep it
  // in RunSnapshot field order.
  const seedStream = new RNG(rolloutSeed);
  wire.rng = seedStream.fork().toJSON();
  wire.levelupRng = seedStream.fork().toJSON();
  wire.deckRng = seedStream.fork().toJSON();
  wire.daemonRng = seedStream.fork().toJSON();
  wire.rewardRng = seedStream.fork().toJSON();
  wire.rewardBitsRng = seedStream.fork().toJSON();
  wire.portStockRng = seedStream.fork().toJSON();
  wire.portPriceRng = seedStream.fork().toJSON();

  const bus = new EventBus<GameEvents>();
  return { run: Run.fromJSON(wire, bus), bus };
}
