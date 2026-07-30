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

// Context 2: a mid-act map state (advanced 5 battles on the cheap tier).
const mid = cloneRunForRollout(new Run(SEED, new EventBus<GameEvents>()), 777);
walkToHorizon(mid, { horizonBattles: 5, policySeed: 424242, maxHops: 80 });
read('mid-act map (out-of-battle class, 5 battles in)', mid.run, 12);
