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
 * Un-landed sites (70b–70e) DELEGATE to the base strategy — the arm is
 * exactly "the scored nominator + arbitration where landed", so its
 * behavior converges on site landings, never on refactors.
 */

import { RNG } from '../../../src/core/RNG';
import type { PortStock, Run } from '../../../src/run/Run';
import type { FuzzStrategy, PortBuy } from '../Strategy';
import { scoredStrategy } from '../strategies/scored';
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
 * 70a — the port-site ε floor. The kickoff planned a two-depth band (the
 * 69f 6× σ spread), but the read came back single-depth: the map places
 * ports MID-ACT, so both derivation contexts docked at hop 6 — the port
 * site has one depth class in act 1, and act-2 docks are unreadable on
 * the cheap tier today (the 69c mortality wall; re-read at §72 when the
 * ceiling moves). Pinned to the CONSERVATIVE of the two same-depth
 * trajectory samples (readEpsilonAA, K=2 · traffic · M=20 margins ·
 * 2026-07-30: σ=1.923 → ε=3.845 fresh-trajectory dock, σ=1.117 →
 * ε=2.234 warmed-trajectory dock; both controls exactly 0). Numbers +
 * rationale: WORKLOG §70. Kept behind a function seam so a §71/72
 * depth-aware refinement never touches call sites.
 */
export const PORT_BUY_EPSILON = 3.845;

export function portBuyEpsilon(_run: Run): number {
  // Single band today; the run param is the seam for a depth-aware
  // refinement (any future hop read must pre-root-guard — gotcha #110).
  return PORT_BUY_EPSILON;
}

export interface ArbitratedConfig {
  /** The delegate/nominator for un-landed sites. Default: the scored
   *  strategy on the default vector. */
  readonly base?: FuzzStrategy;
  /** K — CRN pairs per candidate (default 2, the locked start). */
  readonly k?: number;
  /** Resolution 3's recursion dial (default 'traffic'; `--arbitrate-tier`). */
  readonly innerTier?: InnerTier;
  /** Per-site ε override; default = the depth-banded floors above. */
  readonly portBuyEpsilon?: number;
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
    // 70b will arbitrate fires; until then the base's method (when it has
    // one) passes through UNWRAPPED — presence flips the harness turn
    // gates (59a), so mirroring presence keeps the arm's gate behavior
    // identical to its base.
    ...(base.pickPacketFire !== undefined
      ? {
          pickPacketFire: base.pickPacketFire.bind(base),
        }
      : {}),
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
