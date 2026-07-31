/**
 * 69b — the rollout walker: advance a CLONED Run (69a's
 * `cloneRunForRollout`) to its horizon, playing battles on a configurable
 * inner tier and resolving intermediate run decisions via the scored
 * cheap policies. The run-layer analog of the 57e evaluator's clone-tick
 * loop — the piece that turns a clone into a sampled future.
 *
 * DELIBERATE DUPLICATION of runOne's shape (the §69 kickoff verdict —
 * WORKLOG §69 + the TODO.md divergence watch): this walker re-implements
 * the harness's battle wiring + phase walk rather than sharing code.
 * runOne's draw sequences are byte-pinned by the fuzz baselines /
 * frozen-anchor doctrine, so coupling would make every walker tweak a
 * baseline threat — and walker fidelity needn't be exact: bias shared
 * across candidates cancels under CRN. Re-open triggers are
 * pre-registered in TODO.md; don't unify ad hoc.
 *
 * Contracts:
 * - ONE WALK PER CLONE — the walker attaches bus machinery and consumes
 *   the clone; score it, then discard it.
 * - The clone must be taken at a DECISION phase (map / turn-intro /
 *   turn-outcome / port / reward / recruit / promotion / sectorCleared).
 *   Every v1 decision site sits outside battle, so a mid-'battle' clone
 *   never arises in arbitration; the walker throws loud on one (a
 *   serialized 'battle' phase has no World to resume).
 * - `policySeed` MUST be derived independently of the clone's
 *   rolloutSeed (the 69d driver draws BOTH off its own stream, one pair
 *   per CRN rollout, shared across candidates). Passing the rolloutSeed
 *   itself would collide the first policy fork with the clone's re-seeded
 *   `rng` stream (both are fork #1 of an RNG(seed)). Under the doctrine
 *   defaults every policy is draw-free (scored argmax + level
 *   redraw/empower + RNG-free traffic scripts), so the streams sit
 *   unused — the contract guards the day a drawing policy is dialed in.
 * - Turn gates are ALWAYS ON in the clone (the gated path is RNG-aligned
 *   with the headless one — H4b), which also gives clean horizon
 *   semantics: the run pauses at 'turn-outcome' after each battle
 *   instead of auto-cascading into the next turn mid-emit.
 *
 * Horizon = a count of `battle:ended` events. One TURN is one
 * battle:started/ended cycle, so the spec's "end of the next battle"
 * (out-of-battle decisions) and "end of the current battle" (preTurn
 * decisions) are BOTH `horizonBattles: 1` from their respective clone
 * points — the distinction dissolves. A multi-wave node visit spans
 * several battle:endeds; if a node-clear horizon is ever wanted (the
 * node-choice site may ask), the stop condition extends HERE, in one
 * place.
 *
 * Bus-order note: the walker's handlers attach AFTER the clone Run's own
 * (Run.fromJSON subscribed at clone time), so the walker must never
 * null `currentWorld` on battle:ended — a nested battle:started (were
 * gates ever off) would already have replaced it. Replace-on-started is
 * the only mutation.
 */

import { RNG } from '../../../src/core/RNG';
import { secondsToTicks } from '../../../src/config';
import { HEALTH } from '../../../src/config/health';
import { World } from '../../../src/sim/World';
import { spawnEncounter } from '../../../src/sim/battleSetup';
import type { Run } from '../../../src/run/Run';
import { PRE_ROOT_NODE_ID } from '../../../src/run/NodeMap';
import { TrafficScriptDriver, TRAFFIC_SCRIPTS } from '../../../src/bot/TrafficScriptDriver';
import { RolloutSearchDriver } from '../../../src/bot/RolloutSearchDriver';
import type { RunRolloutClone } from '../../../src/bot/runRollout';
import type { UseContext } from '../../../src/config/packets';
import type { FuzzStrategy } from '../Strategy';
import { scoredStrategy } from '../strategies/scored';
import { DEFAULT_SCORED_WEIGHTS } from '../strategies/scoredWeights';
import { selectRedrawPositions, type RedrawPolicy } from '../redrawPolicy';
import { selectEmpowerPosition, type EmpowerPolicy } from '../empowerPolicy';

/** Resolution 3's dial: what plays battles inside a rollout. Cheap by
 *  default; recursion ('searcher') is paid only where the §71 flip-rate
 *  instrument says flips concentrate. */
export type InnerTier = 'bare' | 'traffic' | 'searcher';
export const DEFAULT_INNER_TIER: InnerTier = 'traffic';

/** The doctrine-arm policy defaults (`--redraw=level:2 --empower=level:hi`). */
export const DEFAULT_ROLLOUT_REDRAW: RedrawPolicy = { kind: 'level', cards: 2 };
export const DEFAULT_ROLLOUT_EMPOWER: EmpowerPolicy = { kind: 'level', dir: 'hi' };

const DEFAULT_MAX_TICKS = secondsToTicks(HEALTH.maxTurnSeconds);
const DEFAULT_MAX_HOPS = 50;

export interface WalkOptions {
  /** Stop after this many `battle:ended` events. 1 = the spec's v1
   *  horizon from every decision context. */
  readonly horizonBattles: number;
  /** See the independence contract in the header. */
  readonly policySeed: number;
  readonly innerTier?: InnerTier;
  /** Intermediate run decisions (node picks en route, port buys, recruit,
   *  packet fires). Default: the scored strategy on the default weights. */
  readonly strategy?: FuzzStrategy;
  readonly redraw?: RedrawPolicy;
  readonly empower?: EmpowerPolicy;
  readonly maxTicksPerBattle?: number;
  /** Safety bound on node entries — a walker must never out-walk its
   *  horizon by more than the map between battles. */
  readonly maxHops?: number;
  /** 70a — stop the walk the moment the run ENTERS this phase (checked at
   *  the loop top, before the phase is acted on; returns outcome
   *  'horizon'). The ε-context prep hook: readEpsilonAA parks a run at a
   *  port dock with it (pass a large horizonBattles). This is the header's
   *  "extend the stop condition in one named place" seam. */
  readonly stopAtPhase?: 'port';
}

export interface WalkResult {
  /** 'horizon' = the requested battle count elapsed; 'complete'/'defeat'
   *  = the run ENDED inside the horizon (the evaluator's death-dominant /
   *  completion terms read this); 'stuck' = a safety bound tripped. */
  readonly outcome: 'horizon' | 'complete' | 'defeat' | 'stuck';
  readonly battlesEnded: number;
  /** Battle ticks simulated — the bench's cost read. */
  readonly totalTicks: number;
}

export function walkToHorizon(clone: RunRolloutClone, options: WalkOptions): WalkResult {
  const { run, bus } = clone;
  const tier = options.innerTier ?? DEFAULT_INNER_TIER;
  const strategy = options.strategy ?? scoredStrategy('rollout-cheap', DEFAULT_SCORED_WEIGHTS);
  const redraw = options.redraw ?? DEFAULT_ROLLOUT_REDRAW;
  const empower = options.empower ?? DEFAULT_ROLLOUT_EMPOWER;
  const maxTicksPerBattle = options.maxTicksPerBattle ?? DEFAULT_MAX_TICKS;
  const maxHops = options.maxHops ?? DEFAULT_MAX_HOPS;

  // Three forks of one policy stream (strategy / redraw / empower) — the
  // harness's stream-isolation idiom. Draw-free under the defaults; see
  // the policySeed independence contract in the header.
  const policyStream = new RNG(options.policySeed);
  const strategyRng = policyStream.fork();
  const redrawRng = policyStream.fork();
  const empowerRng = policyStream.fork();

  run.pauseAtTurnGates = true;

  let currentWorld: World | null = null;
  let currentDriver: TrafficScriptDriver | RolloutSearchDriver | null = null;
  let battlesEnded = 0;
  let totalTicks = 0;

  bus.on('battle:started', ({ worldSeed }) => {
    const encounter = run.currentEncounter!;
    const world = new World(bus, new RNG(worldSeed), encounter.gridW, encounter.gridH);
    world.installBattleRules(encounter.battleRules ?? []);
    currentWorld = world;
    // Fresh driver per battle (the harness contract — bookkeeping never
    // leaks across battles); the searcher's CRN stream forks off the
    // worldSeed exactly as runOne wires it.
    currentDriver =
      tier === 'traffic'
        ? new TrafficScriptDriver('player', TRAFFIC_SCRIPTS)
        : tier === 'searcher'
          ? new RolloutSearchDriver('player', new RNG(worldSeed).fork(), {})
          : null;
    // spawnEncounter emits unit:spawned synchronously; currentWorld is
    // already set above (the runOne ordering note).
    spawnEncounter(world, encounter);
  });
  bus.on('battle:ended', () => {
    battlesEnded++;
  });

  // The ask-until-null fire loop at one legal site (the 59a idiom; a
  // rejected usePacket consumes nothing, so cache-didn't-shrink breaks).
  const firePackets = (context: UseContext): void => {
    if (!strategy.pickPacketFire) return;
    for (;;) {
      const fire = strategy.pickPacketFire(context, run, strategyRng);
      if (fire === null) break;
      const before = run.cache.length;
      run.dispatch({ kind: 'usePacket', ...fire });
      if (run.cache.length >= before) break;
    }
  };

  let hops = 0;
  while (battlesEnded < options.horizonBattles) {
    if (run.phase === 'defeat') return { outcome: 'defeat', battlesEnded, totalTicks };
    if (run.phase === 'complete') return { outcome: 'complete', battlesEnded, totalTicks };
    if (options.stopAtPhase !== undefined && run.phase === options.stopAtPhase) {
      return { outcome: 'horizon', battlesEnded, totalTicks };
    }
    if (hops > maxHops) return { outcome: 'stuck', battlesEnded, totalTicks };

    switch (run.phase) {
      case 'map': {
        firePackets('outOfBattle');
        const frontier = computeFrontier(run);
        if (frontier.length === 0) return { outcome: 'stuck', battlesEnded, totalTicks };
        const nodeId = strategy.pickNextNode(frontier, run, strategyRng);
        run.dispatch({ kind: 'enterNode', nodeId });
        hops++;
        break;
      }
      case 'turn-intro': {
        // The preTurn fire site BEFORE the grant walk (a fired
        // grantRedraws packet inserts its grant at the cursor — 49e).
        firePackets('preTurn');
        // The grant walk, verbatim from runOne (49d — acquisition order,
        // ask-until-null per grant, no-progress guards bound every loop).
        for (let grantIndex = 0; grantIndex < run.grantViews().length; grantIndex++) {
          const view = () => run.grantViews()[grantIndex]!;
          const kind = view().effect.kind;
          if (kind === 'redraw' && redraw.kind !== 'none') {
            for (;;) {
              const grant = view();
              if (grant.remaining <= 0) break;
              const effect = grant.effect;
              if (effect.kind !== 'redraw') break;
              const hand = run.hand.map((i) => run.team[i]!);
              const pool = [...run.drawPile, ...run.discardPile].map((i) => run.team[i]!);
              const positions = selectRedrawPositions(
                hand,
                pool,
                { redrawsRemaining: grant.remaining, cardsRemaining: effect.maxCards },
                redraw,
                redrawRng,
              );
              if (positions.length === 0) break;
              const before = grant.remaining;
              run.dispatch({ kind: 'redrawCards', handIndices: positions, grantIndex });
              if (view().remaining === before) break;
            }
          } else if (kind === 'empower' && empower.kind !== 'none') {
            for (;;) {
              const grant = view();
              if (grant.remaining <= 0) break;
              const hand = run.hand.map((i) => run.team[i]!);
              const pos = selectEmpowerPosition(
                hand,
                { empowersRemaining: grant.remaining },
                empower,
                empowerRng,
              );
              if (pos === null) break;
              const before = grant.remaining;
              run.dispatch({ kind: 'empowerUnit', handIndex: pos, grantIndex });
              if (view().remaining === before) break;
            }
          }
          if (view().active && view().remaining > 0) {
            run.dispatch({ kind: 'passGrant' });
          }
        }
        run.dispatch({ kind: 'advanceTurn' });
        break;
      }
      case 'turn-outcome': {
        run.dispatch({ kind: 'advanceTurn' });
        break;
      }
      case 'battle': {
        if (!currentWorld) {
          throw new Error(
            'walker: battle phase but no active World — clones must be taken at a decision phase, never mid-battle',
          );
        }
        // Same closure-assignment narrowing caveat as runOne: TS pins the
        // flow-type to the null initializer; the casts restore reality.
        const w = currentWorld as World;
        let battleTicks = 0;
        while (!w.ended && battleTicks < maxTicksPerBattle) {
          const driver = currentDriver as TrafficScriptDriver | RolloutSearchDriver | null;
          if (driver) {
            for (const cmd of driver.decide(w)) w.enqueueCommand(cmd);
          }
          w.tick();
          battleTicks++;
        }
        totalTicks += battleTicks;
        // Cap reached without a decisive end → force-resolve as a draw,
        // exactly like runOne/the live driver.
        if (!w.ended) w.resolveAsDraw();
        if (!w.ended) return { outcome: 'stuck', battlesEnded, totalTicks };
        break;
      }
      case 'reward': {
        // The 48b/49c headless policy: accept everything, decline a
        // packet portion against a full cache. Deterministic, zero draws.
        const portion = run.pendingRewards![0]!;
        if (portion.kind === 'packet' && !run.cacheHasRoom) {
          run.dispatch({ kind: 'declineReward', index: 0 });
        } else {
          run.dispatch({ kind: 'acceptReward', index: 0 });
        }
        break;
      }
      case 'port': {
        // The 59a strategy-driven purchase loop (ask-until-null; a
        // proposal that doesn't land breaks — never spin), then undock.
        const stock = run.portStock;
        if (stock && strategy.pickPortBuy) {
          for (;;) {
            const buy = strategy.pickPortBuy(stock, run, strategyRng);
            if (buy === null) break;
            const lane =
              buy.kind === 'daemon'
                ? stock.daemons
                : buy.kind === 'unit'
                  ? stock.units
                  : stock.packets;
            const slot = lane[buy.index];
            if (slot === undefined || slot.sold) break;
            run.dispatch(
              buy.kind === 'daemon'
                ? { kind: 'buyPortDaemon', index: buy.index }
                : buy.kind === 'unit'
                  ? { kind: 'buyPortUnit', index: buy.index }
                  : { kind: 'buyPortPacket', index: buy.index },
            );
            if (!slot.sold) break;
          }
        }
        run.dispatch({ kind: 'leavePort' });
        break;
      }
      case 'promotion': {
        run.dispatch({ kind: 'dismissPromotion' });
        break;
      }
      case 'sectorCleared': {
        run.dispatch({ kind: 'dismissSectorCleared' });
        break;
      }
      case 'recruit': {
        const offer = run.currentOffer!;
        const idx = strategy.pickRecruit(offer, run, strategyRng);
        if (idx === null) {
          run.dispatch({ kind: 'passRecruit' });
        } else {
          run.dispatch({ kind: 'chooseRecruit', unitTemplate: offer[idx]! });
        }
        break;
      }
      default:
        throw new Error(`walker: unexpected phase ${run.phase satisfies never}`);
    }
  }

  return { outcome: 'horizon', battlesEnded, totalTicks };
}

/** The S2 frontier read (runOne's computeFrontier, duplicated with it). */
function computeFrontier(run: Run): number[] {
  if (run.currentNodeId === PRE_ROOT_NODE_ID) return [run.nodeMap.rootId];
  const out: number[] = [];
  for (const e of run.nodeMap.edges) {
    if (e.from === run.currentNodeId) out.push(e.to);
  }
  return out;
}
