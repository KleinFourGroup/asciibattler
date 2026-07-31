/**
 * 69f — the runnable ε floor read. Derives the A/A noise floor on a
 * given context via deriveEpsilonAA (methodology: epsilonAA.ts header +
 * WORKLOG §69). §70 re-runs this per SITE context as each site lands —
 * the per-site ε values are recorded in the worklog with their sites.
 *
 *   npx tsx tests/fuzz/rollout/readEpsilonAA.ts
 *
 * v1 contexts here: the out-of-battle class (map phase, horizon = end
 * of next battle — the port-buy/node-choice/outOfBattle-fire shape) at
 * two depths, K=2, traffic tier, M=20 margins (40 evaluations).
 */

import { EventBus } from '../../../src/core/EventBus';
import type { GameEvents } from '../../../src/core/events';
import { RNG } from '../../../src/core/RNG';
import { Run } from '../../../src/run/Run';
import { PRE_ROOT_NODE_ID } from '../../../src/run/NodeMap';
import { cloneRunForRollout } from '../../../src/bot/runRollout';
import { walkToHorizon } from './walker';
import { deriveEpsilonAA } from './epsilonAA';

const SEED = 20260730;
const EVALUATIONS = 40; // 20 margins

function read(label: string, live: Run, rngSeed: number): void {
  const t0 = performance.now();
  const r = deriveEpsilonAA(live, new RNG(rngSeed), { evaluations: EVALUATIONS });
  const secs = ((performance.now() - t0) / 1000).toFixed(0);
  const absMax = Math.max(...r.margins.map(Math.abs));
  console.log(
    `${label}:\n` +
      `  control |margin| max: ${r.controlMaxAbs} (must be 0)\n` +
      `  A/A margins (n=${r.margins.length}): σ=${r.sigma.toFixed(3)} · |max|=${absMax.toFixed(2)}\n` +
      `  ε = 2σ = ${r.epsilon.toFixed(3)}  (score units: pool HP)  [${secs}s]`,
  );
}

// Context 1: fresh hop-1 map (the early out-of-battle shape).
read('fresh hop-1 map (out-of-battle class)', new Run(SEED, new EventBus<GameEvents>()), 11);

// 70b — TRUE map states after N battles. A battle-count walk parks at
// 'turn-outcome' (the gate), NOT the map — the 69f "mid-act map" context
// was really that gate state (relabeled below, kept for the 69f
// cross-reference). The map-phase class (the outOfBattle fire / node
// sites' real context) needs the second stage: a fresh clone walked to
// stopAtPhase 'map'.
const gate5 = cloneRunForRollout(new Run(SEED, new EventBus<GameEvents>()), 777);
walkToHorizon(gate5, { horizonBattles: 5, policySeed: 424242, maxHops: 80 });
read('post-battle turn-outcome, 5 battles in (the 69f "mid-act map" context, relabeled)', gate5.run, 12);

function mapStateAfter(battles: number): Run {
  const s = cloneRunForRollout(new Run(SEED, new EventBus<GameEvents>()), 777 + battles);
  walkToHorizon(s, { horizonBattles: battles, policySeed: 424242 + battles, maxHops: 80 });
  const m = cloneRunForRollout(s.run, 999 + battles);
  walkToHorizon(m, { horizonBattles: 9999, policySeed: 313 + battles, maxHops: 80, stopAtPhase: 'map' });
  if (m.run.phase !== 'map') {
    throw new Error(`mapStateAfter(${battles}): expected map, got ${m.run.phase}`);
  }
  return m.run;
}
read('map after 2 battles (out-of-battle class)', mapStateAfter(2), 15);
read('map after 3 battles (out-of-battle class)', mapStateAfter(3), 16);
read('map after 5 battles (out-of-battle class)', mapStateAfter(5), 19);

// 70b — the PRETURN class (turn-intro, horizon = end of the CURRENT
// battle) at two depths: gates on, enter the next frontier node from a
// TRUE map state, and the run parks at 'turn-intro' — the clone context
// of every preTurn site (fires now; redraw/empower at 70d).
function parkAtTurnIntro(battles: number): Run {
  const state =
    battles === 0
      ? cloneRunForRollout(new Run(SEED, new EventBus<GameEvents>()), 555).run
      : mapStateAfter(battles);
  state.pauseAtTurnGates = true;
  const frontier =
    state.currentNodeId === PRE_ROOT_NODE_ID
      ? [state.nodeMap.rootId]
      : state.nodeMap.edges.filter((e) => e.from === state.currentNodeId).map((e) => e.to);
  state.dispatch({ kind: 'enterNode', nodeId: frontier[0]! });
  if (state.phase !== 'turn-intro') {
    throw new Error(`parkAtTurnIntro: expected turn-intro, got ${state.phase}`);
  }
  return state;
}
read('fresh turn-intro (preTurn class, hop 1)', parkAtTurnIntro(0), 17);
read('mid-act turn-intro (preTurn class, 5 battles in)', parkAtTurnIntro(5), 18);

// 70c — the REWARD class (post-victory reward gate, horizon = end of
// the NEXT battle) at two depths: the daemon-pick site's real context.
// Same two-stage prep as the map class (a battle-count walk parks at
// turn-outcome; a fresh clone then walks to stopAtPhase 'reward' — the
// reward gate sits between turn-outcome and the map).
function rewardStateAfter(battles: number): Run {
  let from: Run;
  if (battles === 0) {
    from = new Run(SEED, new EventBus<GameEvents>());
  } else {
    const s = cloneRunForRollout(new Run(SEED, new EventBus<GameEvents>()), 777 + battles);
    walkToHorizon(s, { horizonBattles: battles, policySeed: 424242 + battles, maxHops: 80 });
    from = s.run;
  }
  const r = cloneRunForRollout(from, 1111 + battles);
  walkToHorizon(r, { horizonBattles: 9999, policySeed: 616 + battles, maxHops: 80, stopAtPhase: 'reward' });
  if (r.run.phase !== 'reward') {
    throw new Error(`rewardStateAfter(${battles}): expected reward, got ${r.run.phase}`);
  }
  return r.run;
}
read('first reward gate (reward class, 1 battle in)', rewardStateAfter(0), 20);
read('mid-act reward gate (reward class, 5+ battles in)', rewardStateAfter(5), 21);

// 70a — Contexts 3/4: the PORT-BUY site's REAL context (docked, phase
// 'port') at two depths. Prep: warm the run `warmupBattles` forward on
// the cheap tier, then walk with the stopAtPhase hook until it docks
// (one walk per clone — the warmup and the dock-hunt each get a fresh
// clone). Seeds are scanned deterministically until one docks: the
// default node policy only routes through a port when the DP favors
// one, so not every seed's walk docks inside maxHops.
function dockAtPort(runSeed: number, warmupBattles: number): Run | null {
  let state = cloneRunForRollout(new Run(runSeed, new EventBus<GameEvents>()), runSeed + 1);
  if (warmupBattles > 0) {
    const w = walkToHorizon(state, {
      horizonBattles: warmupBattles,
      policySeed: runSeed + 2,
      maxHops: 80,
    });
    if (w.outcome !== 'horizon') return null;
    state = cloneRunForRollout(state.run, runSeed + 3);
  }
  walkToHorizon(state, {
    horizonBattles: 9999,
    policySeed: runSeed + 4,
    maxHops: 80,
    stopAtPhase: 'port',
  });
  return state.run.phase === 'port' ? state.run : null;
}

function firstDock(warmupBattles: number): Run {
  for (let s = SEED; s < SEED + 20; s++) {
    const docked = dockAtPort(s, warmupBattles);
    if (docked) return docked;
  }
  throw new Error(`no seed in [${SEED}, ${SEED + 20}) docked at a port (warmup ${warmupBattles})`);
}

const early = firstDock(0);
read(`early port dock (port-buy class, hop ${early.currentHop})`, early, 13);
const midDock = firstDock(5);
read(`mid-act port dock (port-buy class, 5+ battles in, hop ${midDock.currentHop})`, midDock, 14);
