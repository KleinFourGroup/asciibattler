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
 * Reward-site semantics (70c): daemon portions arbitrate with the
 * polarity FLIPPED (null = accept, challenger = decline — hysteresis
 * protects the incumbent accept-all); everything else mirrors the
 * hardwired policy — see arbitrateReward's header.
 *
 * Grant-site semantics (70d): nominator-trimmed candidates (level:1/2
 * redraws, per-position empowers) with the rollout's OWN grant policies
 * forced off so null = pass — see arbitrateGrant's header.
 *
 * Node-choice semantics (70e): the base's pick is the null arm, the
 * other frontier nodes challenge, and the DP path score re-enters as a
 * scaled TAIL at the truncation — see arbitrateNodeChoice's header.
 *
 * ALL FIVE §70 SITES ARE LIVE, plus the §74g eventChoice site (nominee
 * = the doctrine uniform-random pick; see arbitrateEventChoice's
 * header). `pickRecruit` alone still delegates to the base —
 * recruit/pass is OUT for v1 by kickoff resolution 2 (the one-battle
 * horizon censors a draw-gated permanent asset; the named
 * forced-fielding v2 contingency is in the spec).
 */

import { RNG } from '../../../src/core/RNG';
import type { PortStock, Run } from '../../../src/run/Run';
import type { RewardPortion } from '../../../src/run/rewards';
import { packetById, type UseContext } from '../../../src/config/packets';
import { DECK } from '../../../src/config/deck';
import { HEALTH } from '../../../src/config/health';
import type { FuzzStrategy, GrantAction, PacketFire, PortBuy } from '../Strategy';
import { scoredStrategy, makeBestScore, maxPowerIndex, minPowerIndex } from '../strategies/scored';
import { DEFAULT_SCORED_WEIGHTS, type ScoredWeights } from '../strategies/scoredWeights';
import { selectRedrawPositions } from '../redrawPolicy';
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
 *   reward gate: σ 1.059 / 1.734            → pooled σ 1.437 → ε 2.873
 */
export const PORT_BUY_EPSILON = 3.145;
export const FIRE_OUTOFBATTLE_EPSILON = 3.265;
export const FIRE_PRETURN_EPSILON = 1.101;
export const REWARD_DAEMON_EPSILON = 2.873;
/** 70d — the grant site shares the preTurn CLASS floor: its decisions
 *  clone at the same turn-intro states with the same current-battle
 *  horizon as preTurn fires, and the unified rule floors per CLASS
 *  (readEpsilonAA contexts 17/18 are its derivation). */
export const GRANT_EPSILON = FIRE_PRETURN_EPSILON;
/** 70e — node choice shares the MAP class floor (same clone context +
 *  next-battle horizon as outOfBattle fires; contexts 1/15/16/19). */
export const NODE_CHOICE_EPSILON = FIRE_OUTOFBATTLE_EPSILON;
/** 74g — the event-choice site shares the MAP class floor: it clones at
 *  an out-of-battle state with the same next-battle horizon as node
 *  choice / outOfBattle fires. PROVISIONAL by class argument, not
 *  derivation (the grant→preTurn / nodeChoice→map precedent) — event
 *  pages are a context class readEpsilonAA has never read; the §81
 *  board round re-reads it (user-signed at the 74g shape-lock). */
export const EVENT_CHOICE_EPSILON = FIRE_OUTOFBATTLE_EPSILON;

/**
 * 70e — the DP-tail exchange rate: pool HP per path-weight unit at the
 * truncation. CONFIG-DERIVED, not hand-tuned: one full path-weight
 * point ≈ one rest-heal of pool value — the only place the codebase
 * already prices "a better node ahead" in pool HP. The naive bootstrap
 * (kickoff resolution 1); its contribution is ALWAYS visible as the
 * breakdown's `tailBonus` column, and "the DP-tail shape if the naive
 * bootstrap misbehaves on the elite-detour cases" is the phase's
 * pre-registered decision point. NB the DEFAULT vector's path weights
 * are all ZERO, so under the doctrine arm the tail is exactly 0 and
 * node arbitration is pure rollout-vs-ε — the tail activates only for
 * searched vectors that carry real path preferences.
 */
export const DP_TAIL_SCALE = HEALTH.restHealAmount;

export function portBuyEpsilon(_run: Run): number {
  return PORT_BUY_EPSILON;
}

export function packetFireEpsilon(context: UseContext, _run: Run): number {
  return context === 'preTurn' ? FIRE_PRETURN_EPSILON : FIRE_OUTOFBATTLE_EPSILON;
}

export function rewardDaemonEpsilon(_run: Run): number {
  return REWARD_DAEMON_EPSILON;
}

export interface ArbitratedConfig {
  /** The delegate/nominator for un-landed sites. Default: the scored
   *  strategy on the default vector. */
  readonly base?: FuzzStrategy;
  /** K — CRN pairs per candidate (default 2, the locked start). */
  readonly k?: number;
  /** Resolution 3's recursion dial (default 'traffic'; `--arbitrate-tier`). */
  readonly innerTier?: InnerTier;
  /** 71c — the flip-rate instrument's shadow tier (`--flip-telemetry`):
   *  every decision is re-judged under this tier with the same CRN pairs,
   *  shadow-only (the live decision never reads it). */
  readonly shadowTier?: InnerTier;
  /** Per-site ε overrides; default = the pinned floors above. */
  readonly portBuyEpsilon?: number;
  readonly packetFireEpsilon?: number;
  readonly rewardDaemonEpsilon?: number;
  readonly grantEpsilon?: number;
  readonly nodeChoiceEpsilon?: number;
  readonly eventChoiceEpsilon?: number;
  /** The nominator weight vector the DP tail reads (70e). Default: the
   *  default vector. NOT auto-threaded from a `--strategy` file today —
   *  under the default vector the tail is exactly 0 (all path weights
   *  are 0), so the omission is inert for the doctrine arm. */
  readonly weights?: ScoredWeights;
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
    ...(config.shadowTier !== undefined ? { shadowTier: config.shadowTier } : {}),
  });

  return {
    name: `arbitrated:${base.name}`,
    driver,
    // 70e — the node-choice site (the base stays the NOMINATOR: its pick
    // is the null arm).
    pickNextNode: (frontier, run, rng) =>
      arbitrateNodeChoice(driver, base, frontier, run, rng, config),
    pickRecruit: (offer, run, rng) => base.pickRecruit(offer, run, rng),
    pickPortBuy: (stock, run, _rng) =>
      arbitratePortBuy(driver, stock, run, config.portBuyEpsilon),
    // 70b — the fire site is LANDED: always defined, both contexts. NB
    // presence flips the harness turn gates ON (59a) — the arbitrated arm
    // therefore always rides the gated path (RNG-aligned, H4b; the
    // doctrine arm ran gated anyway via --redraw/--empower).
    pickPacketFire: (context, run, _rng) =>
      arbitratePacketFire(driver, context, run, config.packetFireEpsilon),
    // 70c — the daemon-pick site (reward lane; the port lane rides
    // pickPortBuy above).
    pickReward: (portion, run, _rng) =>
      arbitrateReward(driver, portion, run, config.rewardDaemonEpsilon),
    // 70d — the grant site (defining this routes the harness grant walk
    // here; the --redraw/--empower policy path is superseded for the arm).
    pickGrantAction: (grantIndex, run, rng) =>
      arbitrateGrant(driver, grantIndex, run, rng, config.grantEpsilon),
    // 74g — the event-choice site (the doctrine's uniform-random pick is
    // the NOMINEE/null arm; see arbitrateEventChoice's header).
    pickEventChoice: (run, rng) => arbitrateEventChoice(driver, run, rng, config),
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

/**
 * 70c — the reward lane of the daemon-pick site. ONLY daemon portions
 * arbitrate; bits and packet portions mirror the hardwired 48b/49c
 * policy verbatim (accept, except a packet against a full cache), so
 * the arm differs from the anchor policy at daemon portions alone.
 *
 * THE POLARITY FLIPS HERE, deliberately: at every other site the null
 * arm is the abstention and the challenger acts — at this one the null
 * arm CARRIES the acquisition (the walker's reward case accepts the
 * pending daemon on every null rollout) and the single challenger is
 * `declineReward`. Hysteresis therefore protects the INCUMBENT
 * accept-all policy: a decline must prove the daemon actively HARMS
 * the run by > ε within the horizon — the correct frame for a free
 * permanent asset whose value the one-battle horizon can only
 * under-count (the recruit-censoring lesson, kickoff resolution 2;
 * accept-by-default is the bias-safe side). The decision log's margin
 * is per-daemon draft attribution either way — goal 2 rides on the
 * record, not on declines happening.
 */
function arbitrateReward(
  driver: RunArbitrationDriver,
  portion: RewardPortion,
  run: Run,
  epsilonOverride: number | undefined,
): boolean {
  if (portion.kind !== 'daemon') {
    return !(portion.kind === 'packet' && !run.cacheHasRoom);
  }
  const decline = driver.decide(
    'rewardDaemon',
    run,
    [
      {
        label: `decline daemon:${portion.daemonId}`,
        apply: ({ run: clone }) => clone.dispatch({ kind: 'declineReward', index: 0 }),
      },
    ],
    { epsilon: epsilonOverride ?? rewardDaemonEpsilon(run) },
  );
  return decline === null;
}

/**
 * 70d — one ask of the grant walk, arbitrated (sites 'grant:redraw' /
 * 'grant:empower'). Candidates are NOMINATOR-TRIMMED, not exhaustive:
 * redraw offers the level-policy picks at k∈{1,2} (position sets
 * deduped — a short hand can make them coincide; k=0 IS the null arm),
 * empower offers every hand position (hands are small; the level:hi
 * nominee is among them by construction). Grants whose effect is
 * neither kind enumerate nothing → null → the harness passes them,
 * exactly like the policy path.
 *
 * THE ROLLOUT WALKS WITH THE GRANT POLICIES OFF (the decide-time
 * rollout override): the walker's own turn-intro grant walk would
 * otherwise re-spend the very grants under decision — the doctrine
 * default (level:2/hi) would redraw under the NULL arm and collapse
 * every margin toward zero while the live loop, told "null stands",
 * passed the grant: the port-site live-vs-rollout divergence, grant
 * flavored. With the override, null = pass-everything and each
 * candidate is the lone grant spend in its rollout. No future
 * turn-intro is contaminated: the horizon ends at the CURRENT battle,
 * so the walk never reaches another grant gate.
 */
function arbitrateGrant(
  driver: RunArbitrationDriver,
  grantIndex: number,
  run: Run,
  rng: RNG,
  epsilonOverride: number | undefined,
): GrantAction | null {
  const grant = run.grantViews()[grantIndex];
  if (grant === undefined || grant.remaining <= 0) return null;
  const effect = grant.effect;
  const challengers: RunDecisionCandidate[] = [];
  const actions: GrantAction[] = [];

  if (effect.kind === 'redraw') {
    const hand = run.hand.map((i) => run.team[i]!);
    const pool = [...run.drawPile, ...run.discardPile].map((i) => run.team[i]!);
    const seen = new Set<string>();
    for (const cards of [1, 2]) {
      const positions = selectRedrawPositions(
        hand,
        pool,
        { redrawsRemaining: grant.remaining, cardsRemaining: effect.maxCards },
        { kind: 'level', cards },
        rng,
      );
      if (positions.length === 0) continue;
      const key = positions.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      challengers.push({
        label: `redraw level:${cards} [${key}]`,
        apply: ({ run: clone }) =>
          clone.dispatch({ kind: 'redrawCards', handIndices: positions, grantIndex }),
      });
      actions.push({ kind: 'redraw', handIndices: positions });
    }
  } else if (effect.kind === 'empower') {
    for (let handIndex = 0; handIndex < run.hand.length; handIndex++) {
      challengers.push({
        label: `empower hand:${handIndex}`,
        apply: ({ run: clone }) =>
          clone.dispatch({ kind: 'empowerUnit', handIndex, grantIndex }),
      });
      actions.push({ kind: 'empower', handIndex });
    }
  }

  if (challengers.length === 0) return null;
  const winner = driver.decide(`grant:${effect.kind}`, run, challengers, {
    epsilon: epsilonOverride ?? GRANT_EPSILON,
    rollout: { redraw: { kind: 'none' }, empower: { kind: 'none' } },
  });
  return winner === null ? null : actions[challengers.indexOf(winner)]!;
}

/**
 * 70e — the node-choice site. The base strategy is the NOMINATOR: its
 * pick IS the null arm (the rollout strategy override below pins the
 * walker's map pick to `base.pickNextNode`, so a live "null stands"
 * and a rollout null arm enter the SAME node — the coherence rule
 * every site obeys). Challengers = the other frontier nodes; a
 * singleton frontier is not a decision (no rollouts, no log — the
 * pre-root map and forced corridors stay free).
 *
 * Terminal score = the rollout outcome + the DP tail at the truncation
 * (resolution 1): `DP_TAIL_SCALE × max over onward children of
 * bestScore(child)` from wherever the clone stopped — the entered
 * node's own value is REALIZED by the rollout (never double-counted:
 * the tail starts at the children), and the long path stays the DP's
 * job. The rollout strategy override composes the DEFAULT cheap walk
 * with the base's node picks only — the default vector carries no
 * port/fire groups, so docks stay unshopped inside rollouts (the 70a
 * rule) regardless of what the base defines.
 */
function arbitrateNodeChoice(
  driver: RunArbitrationDriver,
  base: FuzzStrategy,
  frontier: readonly number[],
  run: Run,
  rng: RNG,
  config: ArbitratedConfig,
): number {
  const nominee = base.pickNextNode(frontier, run, rng);
  if (frontier.length <= 1) return nominee;

  const weights = config.weights ?? DEFAULT_SCORED_WEIGHTS;
  const best = makeBestScore(run.nodeMap, weights);
  const children = new Map<number, number[]>();
  for (const e of run.nodeMap.edges) {
    const list = children.get(e.from);
    if (list) list.push(e.to);
    else children.set(e.from, [e.to]);
  }
  const tailScore = (clone: Run): number => {
    const onward = children.get(clone.currentNodeId) ?? [];
    if (onward.length === 0) return 0;
    let mx = -Infinity;
    for (const c of onward) mx = Math.max(mx, best(c));
    return DP_TAIL_SCALE * mx;
  };

  const kindOf = new Map(run.nodeMap.nodes.map((n) => [n.id, n.kind]));
  const rolloutStrategy: FuzzStrategy = {
    ...scoredStrategy('rollout-node', DEFAULT_SCORED_WEIGHTS),
    pickNextNode: (f, r, g) => base.pickNextNode(f, r, g),
  };

  const challengers: RunDecisionCandidate[] = [];
  const nodes: number[] = [];
  for (const nodeId of [...frontier].sort((a, b) => a - b)) {
    if (nodeId === nominee) continue;
    challengers.push({
      label: `enterNode:${nodeId} (${kindOf.get(nodeId) ?? '?'})`,
      apply: ({ run: clone }) => clone.dispatch({ kind: 'enterNode', nodeId }),
    });
    nodes.push(nodeId);
  }
  const winner = driver.decide('nodeChoice', run, challengers, {
    epsilon: config.nodeChoiceEpsilon ?? NODE_CHOICE_EPSILON,
    rollout: { strategy: rolloutStrategy, tailScore },
  });
  return winner === null ? nominee : nodes[challengers.indexOf(winner)]!;
}

/**
 * 74g — the event-choice site. The doctrine policy's uniform-random pick
 * among the ENABLED choices is the NOMINEE: one rng draw (the same draw
 * shape as the 74b doctrine arm), and its choice IS the null arm — the
 * rollout strategy override pins the walker's event pick to the nominee
 * while the clone sits at the decision's (eventId, pageId), so a live
 * "null stands" and a rollout null arm resolve the page the SAME way
 * (the coherence rule every site obeys). Later pages inside the rollout
 * play cheap uniform-random (the walker default); an authored A→B→A
 * loop that revisits the decision page re-pins the nominee —
 * deterministic, author-bounded, capped by the walker's MAX_EVENT_STEPS.
 *
 * Challengers = the other enabled choices (a disabled choice can't be
 * dispatched and never enumerates); labels carry the authored choice
 * text — the log's per-choice vocabulary for the §81 event-era read. A
 * single enabled choice is not a decision: no draw, no rollouts, no log
 * (the singleton-frontier rule; forced pages stay free).
 *
 * ⚠ Bespoke-catalog caveat: rollout clones are wire round-trips, and a
 * mid-event snapshot referencing a BESPOKE def (the in-memory
 * `eventCatalog` dial) hard-rejects on decode — the 74b pin. The arb
 * arm therefore can't arbitrate a bespoke event; shipped-catalog runs
 * (every fuzz batch) are unaffected, and the dev-dial combination
 * throws loud in Run.fromJSON, not silently here.
 */
function arbitrateEventChoice(
  driver: RunArbitrationDriver,
  run: Run,
  rng: RNG,
  config: ArbitratedConfig,
): number {
  const enabled = run.enabledEventChoices();
  if (enabled.length === 0) {
    // The 74a termination assert makes this unreachable on a live page.
    throw new Error('arbitrateEventChoice: event page with no enabled choices');
  }
  if (enabled.length === 1) return enabled[0]!;
  const nominee = enabled[rng.int(0, enabled.length - 1)]!;

  const page = run.currentEventPage()!;
  const decisionRef = { ...run.activeEvent! };
  const rolloutStrategy: FuzzStrategy = {
    ...scoredStrategy('rollout-event', DEFAULT_SCORED_WEIGHTS),
    pickEventChoice: (clone, cloneRng) => {
      const at = clone.activeEvent;
      if (at !== null && at.eventId === decisionRef.eventId && at.pageId === decisionRef.pageId) {
        return nominee;
      }
      // The walker guarantees non-empty before consulting (its own loud guard).
      const open = clone.enabledEventChoices();
      return open[cloneRng.int(0, open.length - 1)]!;
    },
  };

  const challengers: RunDecisionCandidate[] = [];
  const choices: number[] = [];
  for (const choiceIndex of enabled) {
    if (choiceIndex === nominee) continue;
    challengers.push({
      label: `choice:${choiceIndex} "${page.choices[choiceIndex]!.label}"`,
      apply: ({ run: clone }) => clone.dispatch({ kind: 'chooseEventOption', choiceIndex }),
    });
    choices.push(choiceIndex);
  }
  const winner = driver.decide('eventChoice', run, challengers, {
    epsilon: config.eventChoiceEpsilon ?? EVENT_CHOICE_EPSILON,
    rollout: { strategy: rolloutStrategy },
  });
  return winner === null ? nominee : choices[challengers.indexOf(winner)]!;
}
