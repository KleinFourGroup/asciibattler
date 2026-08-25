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
 * §70; the walk side re-authored at 85b): each ask of the 59a
 * ask-until-null loop arbitrates ONE forced buy. Candidates = every
 * affordable unsold slot (daemons → units → packets, slot order — the
 * log's stable vocabulary); the driver's implicit null arm = "stop
 * buying here". Inside the rollout the walker's dock policy is
 * suppressed AT THE DECISION DOCK only (arbitratePortBuy's per-call
 * walkPolicies — a null branch that bought at the very dock under
 * decision would zero the margin while the LIVE loop stopped buying,
 * the live-vs-rollout divergence the kickoff note names) and ACTIVE at
 * every later dock (the 85b future-docks rule: bits carry option
 * value; WORKLOG §85-pre finding 13). Multi-buy value emerges
 * greedily: each landed buy re-arbitrates against the mutated
 * stock/bits. At λ=0 a useless buy margins ~0 and FAILS the strict-ε
 * gate; the always-on bitsDelta telemetry keeps spend-happy drift
 * visible (resolution 4).
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
 * header) and the §85d campRaid preTurn site (the fold rider; see
 * arbitrateCampRaid's header). `pickRecruit` alone still delegates to the base —
 * recruit/pass is OUT for v1 by kickoff resolution 2 (the one-battle
 * horizon censors a draw-gated permanent asset; the named
 * forced-fielding v2 contingency is in the spec).
 */

import { RNG, deriveRng } from '../../../src/core/RNG';
import type { PortStock, Run } from '../../../src/run/Run';
import type { RewardPortion } from '../../../src/run/rewards';
import { packetById, type UseContext } from '../../../src/config/packets';
import { DECK } from '../../../src/config/deck';
import { HEALTH } from '../../../src/config/health';
import type { FuzzStrategy, GrantAction, PacketFire, PortBuy } from '../Strategy';
import type { UnitTemplate } from '../../../src/sim/Unit';
import { scoredStrategy, makeBestScore, maxPowerIndex, minPowerIndex } from '../strategies/scored';
import { DEFAULT_SCORED_WEIGHTS, type ScoredWeights } from '../strategies/scoredWeights';
import { selectRedrawPositions } from '../redrawPolicy';
import {
  RunArbitrationDriver,
  type RunArbitrationConfig,
  type RunDecisionCandidate,
} from './driver';
import type { InnerTier } from './walker';
import type { RolloutSearchConfig } from '../../../src/bot/RolloutSearchDriver';
import { campRaidEligible } from '../campRaid';
import type { DecisionSite } from './sites';

/**
 * 85b — the driver + shadow-site streams ride the KEYED derivation door
 * (`deriveRng(runSeed, 'arbDriver')` / `'arbShadowSites'`): deterministic
 * per run seed, structurally apart from the harness's own `RNG(seed)`
 * fork chains and from each other. Migrated from the pre-85b additive
 * offsets `runSeed + 0x70a1` / `+ 0x84c1` — the ad-hoc construction
 * RNG.ts names a review offense (cross-seed stream identity at seed
 * spans equal to the offset gap; WORKLOG §85-pre finding 8). A
 * deliberate arb-DECISION stream break (85b re-pins); the run/world
 * streams are untouched — keyed additions never move existing streams.
 */
/** 84d — the sites the long-horizon shadow runs on: the ACQUISITION
 *  sites (round-6-spec §"The measurement design"). Grants, fires and node
 *  picks are inside the decision horizon already and would be the whole
 *  cost (the 84d probe read 31 empower decisions × 7 candidates on one
 *  seed — more than every acquisition site combined, ×10). `recruit` is
 *  the shadow-only site. */
export const SHADOW_SITES = [
  'rewardDaemon',
  'portBuy',
  'eventChoice',
  'recruit',
] as const satisfies readonly DecisionSite[];

/** 85b — the walker's dock policy for the all-rollouts overlay: the 50g
 *  buy-all-affordable mirror (daemons → units → packets-if-room, slot
 *  order — the harness's own ABSENT-policy behavior), expressed as a
 *  pickPortBuy for the walker's ask-until-null loop. The pre-dispatch
 *  guards mirror the handlers' no-op conditions (affordability; the 49c
 *  cache-room lock on packets), so a proposal always lands — the loop
 *  never wedges. Deterministic, zero policy draws. A PROXY for the arb
 *  arm's own rollout-judged port behavior (which a walk cannot recurse
 *  into): imperfect but symmetric — both branches shop the same future
 *  docks under CRN, so what it measures is the OPTION VALUE of bits at
 *  future docks (WORKLOG §85-pre finding 13). */
export function walkPortBuy(stock: PortStock, run: Run): PortBuy | null {
  for (let index = 0; index < stock.daemons.length; index++) {
    const slot = stock.daemons[index]!;
    if (!slot.sold && run.bits >= slot.price) return { kind: 'daemon', index };
  }
  for (let index = 0; index < stock.units.length; index++) {
    const slot = stock.units[index]!;
    if (!slot.sold && run.bits >= slot.price) return { kind: 'unit', index };
  }
  for (let index = 0; index < stock.packets.length; index++) {
    const slot = stock.packets[index]!;
    if (!slot.sold && run.bits >= slot.price && run.cacheHasRoom) return { kind: 'packet', index };
  }
  return null;
}

/** 85b — the ALL-ROLLOUTS walk-policy overlay (supersedes 84f1's
 *  shadow-only `shadowWalkStrategyFor`): every rollout walk — live
 *  one-battle AND shadow long-horizon — composes the base's packet-fire
 *  policy (when it carries one) and the 50g dock policy over the walk
 *  strategy, so a walked branch that holds a packet can fire it and a
 *  walked branch that banks bits can spend them at future docks (the 84d
 *  packets-inert finding + the 85-pre future-docks finding, fixed at the
 *  same seam). Coherence is now enforced per SITE, not by leaving the
 *  policies off: the port site suppresses dock buys AT THE DECISION DOCK
 *  only, and the fire site suppresses fires of the decision's own
 *  context at the decision's node (see arbitratePortBuy /
 *  arbitratePacketFire) — everywhere else the overlay rides whole. */
export function walkPolicyOverlay(base: FuzzStrategy): Partial<FuzzStrategy> {
  const fire = base.pickPacketFire;
  return {
    pickPortBuy: (stock, run, _rng) => walkPortBuy(stock, run),
    ...(fire !== undefined
      ? {
          pickPacketFire: (context: UseContext, run: Run, rng: RNG) =>
            fire.call(base, context, run, rng),
        }
      : {}),
  };
}

/**
 * The per-site ε floors — THE v2 DERIVATION RULE (85e, user-signed
 * 2026-08-24; supersedes the 70b v1 pins; WORKLOG §85e): one FLAT floor
 * per site class, ε = 2σ of the WORST (max-σ) non-degenerate A/A read
 * context in that class (readEpsilonAA, K=2 · traffic · M=20 margins
 * per context · every control exactly 0). Two amendments over v1:
 *
 *  - E1: zero-σ (dominated) contexts are EXCLUDED, never pooled — the
 *    v1 preTurn floor RMS-pooled a σ=0.000 depth into 1.101 and
 *    under-floored the live mid-act context ~2×.
 *  - max-context replaces RMS pooling: where a class's contexts spread
 *    (event ×1.84, map ×1.91), the RMS floor under-guards the wide
 *    context and the #11 argmax bootstrap read 28–38% false-act at
 *    C=13 there; the max-context pin closes that hole while staying
 *    flat per class (state-conditioned ε remains a named candidate,
 *    round-6-spec scope guard).
 *
 * Floors are λ=0-DERIVED AND APPLY TO ALL λ_prior ARMS (signed call):
 * at λ=1 the fold injects table-scaled noise into A/A margins at
 * exactly the contexts where item acquisitions sit inside the walk
 * horizon (fresh map σ 1.43→13.6; reward 1.9→11.6; port 2.3→5.3;
 * byte-identical elsewhere — finding #12c quantified). Per-λ floors
 * would neuter the λ=1 arm (map ε≈14); instead the λ=1 false-act
 * exposure is a pre-registered WATCH on the §85f sidecar
 * (priorLambda + priorBonus columns), and the structural fix (the
 * candidate-delta de-fold) sits on the §85h amendment menu. The #11
 * argmax verdict: CONFIRMED but modest with correct floors (C=13 runs
 * 2.4–8.7% vs the 2.3% single-comparison intent — no C-correction,
 * re-read after 85f's realized-flip data). Each floor sits behind a
 * function seam so refinement never touches call sites (any future
 * hop read must pre-root-guard — gotcha #110).
 *
 *   port docks:  σ 2.323 / 2.312               → max 2.323 → ε 4.646
 *   map class:   σ 1.431 / 2.040 / 2.436 / 2.738 → max 2.738 → ε 5.476
 *   preTurn:     σ 0.000 (dominated, E1-excluded) / 1.639
 *                                              → max 1.639 → ε 3.277
 *   reward gate: σ 1.937 / 1.427               → max 1.937 → ε 3.874
 *   event page:  σ 1.551 (boon) / 2.861 (mid-act) → max 2.861 → ε 5.723
 *   campRaid:    σN 3.375/2.242 · σR(armed) 4.122/2.261 — mixed-arm,
 *                see CAMP_RAID_EPSILON.
 */
export const PORT_BUY_EPSILON = 4.646;
export const FIRE_OUTOFBATTLE_EPSILON = 5.476;
export const FIRE_PRETURN_EPSILON = 3.277;
export const REWARD_DAEMON_EPSILON = 3.874;
/** 70d — the grant site shares the preTurn CLASS floor: its decisions
 *  clone at the same turn-intro states with the same current-battle
 *  horizon as preTurn fires, and the unified rule floors per CLASS
 *  (readEpsilonAA contexts 17/18 are its derivation). */
export const GRANT_EPSILON = FIRE_PRETURN_EPSILON;
/** 70e — node choice shares the MAP class floor (same clone context +
 *  next-battle horizon as outOfBattle fires; contexts 1/15/16/19). */
export const NODE_CHOICE_EPSILON = FIRE_OUTOFBATTLE_EPSILON;
/** 85e — the event-choice site's OWN derived floor (the 74g provisional
 *  class-share retired; the §81 re-read owed since then landed here).
 *  Event pages read WIDER than the map class they borrowed from (mid-act
 *  page σ 2.861 vs map max 2.738) — a page's choice grants items inside
 *  the horizon, so its walk variance carries the acquisition spread. */
export const EVENT_CHOICE_EPSILON = 5.723;
/** 84c — the shadow-only recruit site judges its long-horizon record
 *  under the REWARD class floor (the same post-victory clone context as
 *  the daemon pick). Telemetry-only: the live recruit pick is the base's,
 *  never arbitrated; the ε only shapes the record's `chosenIndex`. */
export const RECRUIT_EPSILON = REWARD_DAEMON_EPSILON;
/** 85e — the campRaid site's OWN derived floor (the 85d provisional
 *  preTurn share retired — the weaker-class-argument flag was RIGHT:
 *  the provisional 1.101 under-floored ~5.6×). MIXED-ARM derivation,
 *  the class's one methodology extension: the raid arm samples a
 *  DIFFERENT outcome distribution than the null walk (a whole
 *  side-battle), and the armed A/A read confirms σR > σN at both
 *  depths, so the pairing-broken raid-vs-null margin noise is
 *  ε = 2·√((σN² + σR²)/2) over the pooled camp-carrying turn-intro
 *  contexts (σN 2.865 · σR 3.324 — epsilonAA.ts `arm`, readEpsilonAA
 *  campRaid contexts; armed controls exactly 0). */
export const CAMP_RAID_EPSILON = 6.206;

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
  readonly campRaidEpsilon?: number;
  /** The nominator weight vector the DP tail reads (70e). Default: the
   *  default vector. NOT auto-threaded from a `--strategy` file today —
   *  under the default vector the tail is exactly 0 (all path weights
   *  are 0), so the omission is inert for the doctrine arm. */
  readonly weights?: ScoredWeights;
  /** Resolution 4's swept exchange rate (default 0 — a board arm). */
  readonly bitsLambda?: number;
  /** 85c — λ_prior, the fold's board arm ({0, 0.5, 1}; `--prior-lambda`).
   *  0/absent = the fold path never engages (byte-identical, the λ=0
   *  board control). Long-horizon shadow records ALWAYS score at 0
   *  regardless (12c — the driver strips it; the table stays raw). */
  readonly priorLambda?: number;
  /** 85c — item key → meanDelta (`priorFoldValues(loadPriorTable())`);
   *  required by the evaluator when priorLambda ≠ 0. */
  readonly priorTable?: Readonly<Record<string, number>>;
  /** 85b (finding 6) — the LIVE arm's searcher config (audition scripts,
   *  K, cadence), threaded into every rollout spec so an innerTier
   *  'searcher' walk plays battles the way the live arm does (the walker
   *  previously passed `{}`). `kFlipTelemetry` is deliberately stripped
   *  by the caller — a rollout needs the play policy, not the
   *  instrument. Inert under the default 'traffic' tier. */
  readonly rolloutSearch?: RolloutSearchConfig;
  /** Test seam, threaded to the driver (the selectByScore precedent). */
  readonly evaluate?: RunArbitrationConfig['evaluate'];
  /** 84a/84c — the long-horizon shadow (`--shadow-horizon` /
   *  `--shadow-sample`): every sampled decision's candidates ALSO walked to
   *  this horizon as a separate record, and the shadow-only recruit site
   *  wired. The site stream is seeded here off the run seed. */
  readonly shadowHorizon?: {
    readonly horizonBattles: number | 'run';
    readonly sample?: number;
  };
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
  // 85b — the all-rollouts overlay (fires + future docks), composed into
  // EVERY spec via rollout.walkPolicies; sites override per call where a
  // coherence window demands suppression.
  const overlay = walkPolicyOverlay(base);
  const driver = new RunArbitrationDriver(deriveRng(runSeed, 'arbDriver'), {
    ...(config.k !== undefined ? { rolloutsPerCandidate: config.k } : {}),
    rollout: {
      horizonBattles: 1,
      walkPolicies: overlay,
      ...(config.innerTier !== undefined ? { innerTier: config.innerTier } : {}),
      ...(config.bitsLambda !== undefined ? { bitsLambda: config.bitsLambda } : {}),
      // 85c — the fold arm (0/absent = byte-identical pre-fold path).
      ...(config.priorLambda !== undefined ? { priorLambda: config.priorLambda } : {}),
      ...(config.priorTable !== undefined ? { priorTable: config.priorTable } : {}),
      // 85b (finding 6) — the live searcher config, so an innerTier
      // 'searcher' rollout plays battles the way the live arm does.
      ...(config.rolloutSearch !== undefined ? { rolloutSearch: config.rolloutSearch } : {}),
    },
    ...(config.evaluate !== undefined ? { evaluate: config.evaluate } : {}),
    ...(config.shadowTier !== undefined ? { shadowTier: config.shadowTier } : {}),
    ...(config.shadowHorizon !== undefined
      ? {
          shadowHorizon: {
            ...config.shadowHorizon,
            sites: SHADOW_SITES,
            siteRng: deriveRng(runSeed, 'arbShadowSites'),
          },
        }
      : {}),
  });

  return {
    name: `arbitrated:${base.name}`,
    driver,
    // 70e — the node-choice site (the base stays the NOMINATOR: its pick
    // is the null arm).
    pickNextNode: (frontier, run, rng) =>
      arbitrateNodeChoice(driver, base, frontier, run, rng, config),
    // 84c — the recruit pick stays the BASE's (never arbitrated live); under
    // the shadow the offer is ALSO recorded at the long horizon (the
    // shadow-only site — units are the §88 rarity read's item). The base
    // picks first so its rng consumption is untouched by the shadow.
    pickRecruit: (offer, run, rng) => {
      const idx = base.pickRecruit(offer, run, rng);
      if (config.shadowHorizon !== undefined) shadowRecruit(driver, offer, run);
      return idx;
    },
    pickPortBuy: (stock, run, _rng) =>
      arbitratePortBuy(driver, stock, run, config.portBuyEpsilon, overlay),
    // 70b — the fire site is LANDED: always defined, both contexts. NB
    // presence flips the harness turn gates ON (59a) — the arbitrated arm
    // therefore always rides the gated path (RNG-aligned, H4b; the
    // doctrine arm ran gated anyway via --redraw/--empower).
    pickPacketFire: (context, run, _rng) =>
      arbitratePacketFire(driver, context, run, config.packetFireEpsilon, overlay),
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
    // 85d — the campRaid RUN-LAYER preTurn site (the fold rider; see
    // arbitrateCampRaid's header). v1 candidates = {null, raid}.
    pickCampRaid: (run, _rng) => arbitrateCampRaid(driver, run, config.campRaidEpsilon),
  };
}

/**
 * 84c — the shadow-only recruit site. Null arm = PASS (the true "don't
 * acquire" baseline — an empty apply would let the walker's own policy
 * recruit at the cloned phase); challengers = every offer slot, in offer
 * order, labeled `recruit unit:<archetype>:L<n>` (the aggregate keys the
 * archetype, level = instance noise — the prior and the rarity read are
 * per archetype). Each candidate reads the CLONE's offer (a value-equal
 * deep copy; `chooseRecruit` appends by value). Nothing is decided live.
 */
function shadowRecruit(
  driver: RunArbitrationDriver,
  offer: readonly UnitTemplate[],
  run: Run,
): void {
  if (run.phase !== 'recruit' || offer.length === 0) return;
  const challengers: RunDecisionCandidate[] = offer.map((t, i) => ({
    label: `recruit unit:${t.archetype}:L${t.level}`,
    apply: ({ run: clone }) =>
      clone.dispatch({ kind: 'chooseRecruit', unitTemplate: clone.currentOffer![i]! }),
  }));
  driver.shadowDecide(
    'recruit',
    run,
    ({ run: clone }) => clone.dispatch({ kind: 'passRecruit' }),
    challengers,
    { epsilon: RECRUIT_EPSILON },
  );
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
  overlay: Partial<FuzzStrategy>,
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
  // 85b — the decision-dock exclusion (the future-docks rule, WORKLOG
  // §85-pre finding 13): the walker's dock policy is suppressed AT THIS
  // dock only — the null branch must never buy at the very port being
  // arbitrated (the one-forced-buy coherence rule) — and active at every
  // later dock the walk reaches, so bits carry their option value. Keyed
  // on (sector, node): a forward-DAG walk never revisits a node, and the
  // long-horizon shadow walk inherits the same gating through the
  // per-call spec.
  const dockSector = run.currentSectorId;
  const dockNode = run.currentNodeId;
  const walkPolicies: Partial<FuzzStrategy> = {
    ...overlay,
    pickPortBuy: (s, r, _g) =>
      r.currentSectorId === dockSector && r.currentNodeId === dockNode ? null : walkPortBuy(s, r),
  };
  const winner = driver.decide('portBuy', run, challengers, {
    epsilon: epsilonOverride ?? portBuyEpsilon(run),
    rollout: { walkPolicies },
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
 * order matches the cheap policy's scan). The null arm = bank PAST THIS
 * GATE: since 85b the walker's fire policy is suppressed only for this
 * decision's context at this node (the port site's dock rule, fire
 * flavored) — a later gate inside the horizon can fire what this ask
 * banked, so the margin reads fire-now vs fire-later, not fire-now vs
 * never (the 84d packets-inert mechanism). The fold's fired-counts-as-
 * held rule (§85 shape-lock) keeps the prior term neutral across the
 * comparison either way.
 */
function arbitratePacketFire(
  driver: RunArbitrationDriver,
  context: UseContext,
  run: Run,
  epsilonOverride: number | undefined,
  overlay: Partial<FuzzStrategy>,
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
  // 85b — the own-gate exclusion (the port site's dock rule, fire
  // flavored): the walker's fire policy is suppressed for THIS decision's
  // context at THIS node — the null arm must mean "bank past this gate",
  // not "fire it via the walker" (same-gate firing would zero every
  // margin and kill the live fire channel) — and active everywhere else:
  // a later preTurn gate inside an outOfBattle decision's horizon can
  // fire what this ask banked (the timing-value read the 84d
  // packets-inert finding was missing). At a preTurn decision the only
  // in-horizon preTurn gate is its own (horizon 1 stops at battle end),
  // so the suppression is exact there by construction.
  const gateSector = run.currentSectorId;
  const gateNode = run.currentNodeId;
  const baseFire = overlay.pickPacketFire;
  const walkPolicies: Partial<FuzzStrategy> = {
    ...overlay,
    ...(baseFire !== undefined
      ? {
          pickPacketFire: (ctx: UseContext, r: Run, g: RNG) =>
            ctx === context && r.currentSectorId === gateSector && r.currentNodeId === gateNode
              ? null
              : baseFire(ctx, r, g),
        }
      : {}),
  };
  const winner = driver.decide(`packetFire:${context}`, run, challengers, {
    epsilon: epsilonOverride ?? packetFireEpsilon(context, run),
    rollout: { walkPolicies },
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
 * with the base's node picks only; the config-level 85b walkPolicies
 * overlay (fires + the dock policy) rides on top through the evaluator
 * compose — a candidate that enters a port node now realizes shopping
 * value inside its rollout instead of reading the dock as inert.
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
 * 85d — the campRaid site (the fold rider, round-6-spec §"The ε re-read
 * + the two riders"): a RUN-LAYER preTurn decision, v1 candidates =
 * {null, raid} (the 2026-08-24 shape-lock — one selective per-battle
 * choice; per-camp enumeration deferred until a layout carries >1 camp
 * and the read demands it). The raid apply sets the CLONE's
 * `raidNextBattle` flag; the walker consumes it at the walk's first
 * battle spawn via the shared `orderCampRaid` — the identical order the
 * live harness places when the site returns true. The null arm walks
 * the battle unordered (the walker never raids on its own), so the
 * margin reads "raid this battle vs fight it straight" under paired
 * luck — and the raid's PAYOUT (camp bits/packets at turn end, the
 * packet prior once held) is visible to the run-layer score where the
 * battle evaluator is structurally blind to it (neutrals count in
 * neither team's material — the spec's two-evaluators-one-fold note).
 *
 * Eligibility gates the rollout SPEND, not correctness: an authored
 * campless layout enumerates nothing (no decision, no log); the
 * procedural sentinel stays eligible and a campless roll makes the raid
 * arm ≡ null (ties→NULL). The 83e forced-engagement probe (decisively
 * net-negative, indiscriminate) is the baseline this selectivity must
 * beat — the §85f cohort's read. Re-evaluate the run-layer placement
 * only if the site literally never gets picked (the spec's named
 * decision point).
 */
function arbitrateCampRaid(
  driver: RunArbitrationDriver,
  run: Run,
  epsilonOverride: number | undefined,
): boolean {
  // The pre-battle layout read: `encounterMap` is rolled at encounter start
  // and lives through every turn of it (K3.5); `currentEncounter` doesn't
  // exist until the battle starts. layoutId null = procedural → eligible.
  if (!campRaidEligible(run.encounterMap?.layoutId ?? undefined)) return false;
  const winner = driver.decide(
    'campRaid',
    run,
    [
      {
        label: 'raid',
        apply: (clone) => {
          clone.raidNextBattle = true;
        },
      },
    ],
    { epsilon: epsilonOverride ?? CAMP_RAID_EPSILON },
  );
  return winner !== null;
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
/** 85f — the 74g nominee pin, enablement-guarded. The pin means "play
 *  the decision page as the nominee WHERE LEGAL": a repeatable event can
 *  re-roll the decision page mid-walk with the nominee's condition now
 *  false (cheese-tax's bitsAtLeast after the pin itself paid the bits —
 *  the 85f crash, seed 42), and an unguarded pin then feeds
 *  handleChooseEventOption a silent no-op forever until the walker's
 *  500-step guard throws ("walker: 500 event choices in one walk").
 *  Guarded: nominee-if-enabled, else the walk's uniform-random-among-
 *  enabled. Byte-identical to the unguarded pin on every walk that
 *  didn't crash (the guard reads, it never draws). Exported for the
 *  regression test. */
export function pinnedEventPick(
  decisionRef: { readonly eventId: string; readonly pageId: string },
  nominee: number,
  clone: Run,
  cloneRng: RNG,
): number {
  // The walker guarantees non-empty before consulting (its own loud guard).
  const open = clone.enabledEventChoices();
  const at = clone.activeEvent;
  if (
    at !== null &&
    at.eventId === decisionRef.eventId &&
    at.pageId === decisionRef.pageId &&
    open.includes(nominee)
  ) {
    return nominee;
  }
  return open[cloneRng.int(0, open.length - 1)]!;
}

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
    pickEventChoice: (clone, cloneRng) => pinnedEventPick(decisionRef, nominee, clone, cloneRng),
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
