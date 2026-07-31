/**
 * 70a — the arbitrated-arm scaffold + the PORT-BUY site (the first of
 * the five §70 decision sites; ROADMAP §70 / WORKLOG §70).
 *
 * `makeArbitratedStrategy(runSeed, config)` returns a PER-RUN
 * `FuzzStrategy` — the kickoff finding 2: `runMany` reuses one strategy
 * instance across seeds, and this arm is STATEFUL (the 69e driver
 * carries an RNG stream + the decision log), so the CLI constructs one
 * per seed and the log rides out on `.driver.decisions` for §71's csv
 * reporter.
 *
 * Port-site semantics (the kickoff's one-forced-buy design, WORKLOG
 * §70): each ask of the 59a ask-until-null loop arbitrates ONE forced
 * buy. Candidates = every affordable unsold slot (daemons → units →
 * packets, slot order — the log's stable vocabulary); the driver's
 * implicit null arm = "stop buying here". Inside the rollout the
 * walker's default strategy carries NO `pickPortBuy` (the default
 * vector has no port group), so every clone leaves the dock right
 * after the applied candidate — the null arm never re-shops the dock.
 * (If it did, the cheap policy could buy the candidate under the null
 * arm and zero the margin while the LIVE loop stopped buying — the
 * live-vs-rollout divergence the kickoff note names. A future
 * `spec.strategy` override that carries a port group would reintroduce
 * it; don't.) Multi-buy value emerges greedily: each landed buy
 * re-arbitrates against the mutated stock/bits. At λ=0 a useless buy
 * margins ~0 and FAILS the strict-ε gate; the always-on bitsDelta
 * telemetry keeps spend-happy drift visible (resolution 4).
 *
 * Fire-site semantics (70b): per-packet candidates with nominator-picked
 * targets, both 49e contexts, legality guards mirrored, the 60c heal
 * guard deliberately dropped — see arbitratePacketFire's header.
 *
 * Un-landed sites (70c–70e) DELEGATE to the base strategy — the arm is
 * exactly "the scored nominator + arbitration where landed", so its
 * behavior converges on site landings, never on refactors.
 */

import { RNG } from '../../../src/core/RNG';
import type { PortStock, Run } from '../../../src/run/Run';
import { packetById, type UseContext } from '../../../src/config/packets';
import { DECK } from '../../../src/config/deck';
import type { FuzzStrategy, PacketFire, PortBuy } from '../Strategy';
import { scoredStrategy, maxPowerIndex, minPowerIndex } from '../strategies/scored';
import { DEFAULT_SCORED_WEIGHTS } from '../strategies/scoredWeights';
import {
  RunArbitrationDriver,
  type RunArbitrationConfig,
  type RunDecisionCandidate,
} from './driver';
import type { InnerTier } from './walker';

/**
 * The driver-stream domain offset: the arm's RNG must be deterministic
 * per run seed yet must not share a root with the harness's own
 * `RNG(seed)` fork chains (strategy/redraw/empower streams all fork off
 * fresh `RNG(seed)` instances — an un-offset root here would make the
 * driver's first forks numerically identical to theirs). A different
 * seed is an independent stream; the offset just keeps the universes
 * apart.
 */
const DRIVER_SEED_OFFSET = 0x70a1;

/**
 * The per-site ε floors — THE v1 DERIVATION RULE (unified at 70b, the
 * 70a pin amended to match; WORKLOG §70): one FLAT floor per site
 * class, ε = 2σ of the POOLED A/A margins across that class's read
 * contexts (readEpsilonAA, K=2 · traffic · M=20 margins per context ·
 * 2026-07-30; every control exactly 0). The kickoff's depth-banding
 * died on the data twice — ports read single-depth (both docks hop 6),
 * and TRUE map states show NO depth trend (σ 1.1–2.0 at every depth;
 * the 69f "0.54 mid-act" low read was a turn-outcome GATE state, a
 * different class — relabeled in readEpsilonAA). Noise is
 * state-dependent, not depth-monotone: a state-conditioned ε is a §71
 * candidate once decisions.csv shows where it concentrates. Each floor
 * sits behind a function seam so that refinement never touches call
 * sites (any future hop read must pre-root-guard — gotcha #110).
 *
 *   port docks:  σ 1.923 / 1.117            → pooled σ 1.573 → ε 3.145
 *   map class:   σ 1.717 / 1.561 / 1.139 / 1.994 → pooled σ 1.632 → ε 3.265
 *   preTurn:     σ 0.779 / 0.000 (a dominated current-battle horizon
 *                has nothing left to vary)  → pooled σ 0.551 → ε 1.101
 */
export const PORT_BUY_EPSILON = 3.145;
export const FIRE_OUTOFBATTLE_EPSILON = 3.265;
export const FIRE_PRETURN_EPSILON = 1.101;

export function portBuyEpsilon(_run: Run): number {
  return PORT_BUY_EPSILON;
}

export function packetFireEpsilon(context: UseContext, _run: Run): number {
  return context === 'preTurn' ? FIRE_PRETURN_EPSILON : FIRE_OUTOFBATTLE_EPSILON;
}

export interface ArbitratedConfig {
  /** The delegate/nominator for un-landed sites. Default: the scored
   *  strategy on the default vector. */
  readonly base?: FuzzStrategy;
  /** K — CRN pairs per candidate (default 2, the locked start). */
  readonly k?: number;
  /** Resolution 3's recursion dial (default 'traffic'; `--arbitrate-tier`). */
  readonly innerTier?: InnerTier;
  /** Per-site ε overrides; default = the pinned floors above. */
  readonly portBuyEpsilon?: number;
  readonly packetFireEpsilon?: number;
  /** Resolution 4's swept exchange rate (default 0 — a board arm). */
  readonly bitsLambda?: number;
  /** Test seam, threaded to the driver (the selectByScore precedent). */
  readonly evaluate?: RunArbitrationConfig['evaluate'];
}

export interface ArbitratedRunStrategy extends FuzzStrategy {
  /** The §71 log surface: `driver.decisions`, append-only in decide order. */
  readonly driver: RunArbitrationDriver;
}

export function makeArbitratedStrategy(
  runSeed: number,
  config: ArbitratedConfig = {},
): ArbitratedRunStrategy {
  const base = config.base ?? scoredStrategy('arb-base', DEFAULT_SCORED_WEIGHTS);
  const driver = new RunArbitrationDriver(new RNG(runSeed + DRIVER_SEED_OFFSET), {
    ...(config.k !== undefined ? { rolloutsPerCandidate: config.k } : {}),
    rollout: {
      horizonBattles: 1,
      ...(config.innerTier !== undefined ? { innerTier: config.innerTier } : {}),
      ...(config.bitsLambda !== undefined ? { bitsLambda: config.bitsLambda } : {}),
    },
    ...(config.evaluate !== undefined ? { evaluate: config.evaluate } : {}),
  });

  return {
    name: `arbitrated:${base.name}`,
    driver,
    pickNextNode: (frontier, run, rng) => base.pickNextNode(frontier, run, rng),
    pickRecruit: (offer, run, rng) => base.pickRecruit(offer, run, rng),
    pickPortBuy: (stock, run, _rng) =>
      arbitratePortBuy(driver, stock, run, config.portBuyEpsilon),
    // 70b — the fire site is LANDED: always defined, both contexts. NB
    // presence flips the harness turn gates ON (59a) — the arbitrated arm
    // therefore always rides the gated path (RNG-aligned, H4b; the
    // doctrine arm ran gated anyway via --redraw/--empower).
    pickPacketFire: (context, run, _rng) =>
      arbitratePacketFire(driver, context, run, config.packetFireEpsilon),
  };
}

/**
 * One ask of the port loop, arbitrated. Candidate enumeration mirrors the
 * scored policy's lane order (daemons → units → packets, slot order) so
 * the decision log's label sequence is stable; affordability is the raw
 * `bits >= price` (no reserve — judgment is the rollout's job now), and
 * packet slots respect the cache-room guard `Run.buyPortPacket` enforces.
 */
function arbitratePortBuy(
  driver: RunArbitrationDriver,
  stock: PortStock,
  run: Run,
  epsilonOverride: number | undefined,
): PortBuy | null {
  const challengers: RunDecisionCandidate[] = [];
  const buys: PortBuy[] = [];

  stock.daemons.forEach((slot, index) => {
    if (slot.sold || run.bits < slot.price) return;
    challengers.push({
      label: `buy daemon:${slot.daemonId} @${slot.price}`,
      apply: ({ run: clone }) => clone.dispatch({ kind: 'buyPortDaemon', index }),
    });
    buys.push({ kind: 'daemon', index });
  });
  stock.units.forEach((slot, index) => {
    if (slot.sold || run.bits < slot.price) return;
    challengers.push({
      label: `buy unit:${slot.template.archetype}:L${slot.template.level} @${slot.price}`,
      apply: ({ run: clone }) => clone.dispatch({ kind: 'buyPortUnit', index }),
    });
    buys.push({ kind: 'unit', index });
  });
  stock.packets.forEach((slot, index) => {
    if (slot.sold || run.bits < slot.price || !run.cacheHasRoom) return;
    challengers.push({
      label: `buy packet:${slot.packetId} @${slot.price}`,
      apply: ({ run: clone }) => clone.dispatch({ kind: 'buyPortPacket', index }),
    });
    buys.push({ kind: 'packet', index });
  });

  if (challengers.length === 0) return null;
  const winner = driver.decide('portBuy', run, challengers, {
    epsilon: epsilonOverride ?? portBuyEpsilon(run),
  });
  return winner === null ? null : buys[challengers.indexOf(winner)]!;
}

/**
 * 70b — one ask of the fire loop, arbitrated (both 49e contexts; site
 * strings 'packetFire:preTurn' / 'packetFire:outOfBattle' — the two
 * classes carry different ε floors and §71 reads them separately).
 *
 * Candidates are per-PACKET, not per-target: unit-target packets aim at
 * the scored heuristic's pick (max-power hand card / roster unit;
 * discardCards sheds min-power — the 68a polarity), keeping candidate
 * sets small (the nominator role). Guards mirrored from the scored
 * policy are LEGALITY only — context usability, tile targets (no launch
 * context out of battle), the 68a drawCards/discardCards firability
 * pair (a rejected dispatch consumes nothing and the harness loop reads
 * "cache didn't shrink" as stop-asking, so proposing one would wedge
 * the whole turn's fires). The 60c heal guard is deliberately DROPPED:
 * whether a partially-clamped patch is worth firing is now the
 * rollout's question — a wasted fire margins ~0 and fails the strict-ε
 * gate, which is the fire-channel repair working by construction
 * instead of by hand-authored timing rules.
 *
 * Duplicate packet ids collapse to their lowest cache index (identical
 * candidates would burn rollouts to measure an exact tie; acquisition
 * order matches the cheap policy's scan). The null arm = bank
 * everything this ask; inside the rollout the walker's default strategy
 * never fires, so null banks the cache through the horizon — the same
 * live-vs-rollout coherence as the port site's one-forced-buy rule.
 */
function arbitratePacketFire(
  driver: RunArbitrationDriver,
  context: UseContext,
  run: Run,
  epsilonOverride: number | undefined,
): PacketFire | null {
  const challengers: RunDecisionCandidate[] = [];
  const fires: PacketFire[] = [];
  const seen = new Set<string>();

  for (let cacheIndex = 0; cacheIndex < run.cache.length; cacheIndex++) {
    const packet = packetById(run.cache[cacheIndex]!);
    if (packet === undefined || !packet.usableIn.includes(context)) continue;
    if (packet.target === 'tile') continue;
    if (packet.effect.op === 'drawCards' && run.hand.length >= DECK.maxHandSize) continue;
    if (packet.effect.op === 'discardCards' && run.hand.length <= 1) continue;
    if (seen.has(packet.id)) continue;
    seen.add(packet.id);

    if (packet.target === 'unit') {
      if (context === 'preTurn') {
        const pick = packet.effect.op === 'discardCards' ? minPowerIndex : maxPowerIndex;
        const handIndex = pick(run.hand.map((slot) => run.team[slot]!));
        if (handIndex === null) continue;
        challengers.push({
          label: `fire ${packet.id}@hand:${handIndex}`,
          apply: ({ run: clone }) => clone.dispatch({ kind: 'usePacket', cacheIndex, handIndex }),
        });
        fires.push({ cacheIndex, handIndex });
      } else {
        const rosterIndex = maxPowerIndex(run.team);
        if (rosterIndex === null) continue;
        challengers.push({
          label: `fire ${packet.id}@roster:${rosterIndex}`,
          apply: ({ run: clone }) =>
            clone.dispatch({ kind: 'usePacket', cacheIndex, rosterIndex }),
        });
        fires.push({ cacheIndex, rosterIndex });
      }
    } else {
      challengers.push({
        label: `fire ${packet.id}`,
        apply: ({ run: clone }) => clone.dispatch({ kind: 'usePacket', cacheIndex }),
      });
      fires.push({ cacheIndex });
    }
  }

  if (challengers.length === 0) return null;
  const winner = driver.decide(`packetFire:${context}`, run, challengers, {
    epsilon: epsilonOverride ?? packetFireEpsilon(context, run),
  });
  return winner === null ? null : fires[challengers.indexOf(winner)]!;
}
