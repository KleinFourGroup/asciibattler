/**
 * 69c — the run-layer rollout micro-benchmark: prices the arbitration
 * cost model (the appetite-hatch decision point's data). The benchRollout
 * sibling, one layer up. Re-run whenever the walker or the inner tiers
 * change materially:
 *
 *   npx tsx tests/fuzz/rollout/benchRunRollout.ts
 *
 * Reports, at three run depths (fresh / mid / deep — advanced via the
 * walker itself on the cheap tier):
 *   - clone cost (ms/clone — the 69a seam)
 *   - rollout cost per inner tier (clone + walk to horizonBattles:1)
 *   - projected per-decision and per-run overhead at K=2 under LABELED
 *     assumptions (candidate counts + decisions/run are estimates until
 *     §71's decision telemetry measures them for real)
 */

import { performance } from 'node:perf_hooks';
import { EventBus } from '../../../src/core/EventBus';
import type { GameEvents } from '../../../src/core/events';
import { Run } from '../../../src/run/Run';
import { cloneRunForRollout } from '../../../src/bot/runRollout';
import { walkToHorizon, type InnerTier } from './walker';

const SEED = 20260730;

/** Advance a fresh run `target` battles deep on the cheap tier (the
 *  walker as a driver), returning a state that is still ALIVE — a dead
 *  run prices as 0 ms and poisons the spread. Backs off the target and
 *  rotates clone seeds until a surviving trajectory is found. */
function advance(target: number): { run: Run; battlesEnded: number; sectors: number } {
  for (const battles of [target, target - 4, target - 8]) {
    for (const cloneSeed of [777, 778, 779]) {
      const live = new Run(SEED, new EventBus<GameEvents>());
      const clone = cloneRunForRollout(live, cloneSeed);
      let sectors = 0;
      clone.bus.on('sector:cleared', () => sectors++);
      const r = walkToHorizon(clone, {
        horizonBattles: battles,
        policySeed: 424242,
        maxHops: 80,
        innerTier: 'traffic',
      });
      if (r.outcome === 'horizon') {
        return { run: clone.run, battlesEnded: r.battlesEnded, sectors };
      }
      console.log(
        `  (advance to ${battles}, seed ${cloneSeed}: ${r.outcome} at ${r.battlesEnded} — retrying)`,
      );
    }
  }
  throw new Error('benchRunRollout: no surviving trajectory found for the requested depth');
}

function benchState(label: string, state: Run): { cloneMs: number; tierMs: Map<InnerTier, number> } {
  console.log(`\n=== ${label} ===`);

  // --- clone cost ---
  const CLONES = 100;
  cloneRunForRollout(state, 1); // warm-up
  let t0 = performance.now();
  for (let i = 0; i < CLONES; i++) cloneRunForRollout(state, i);
  const cloneMs = (performance.now() - t0) / CLONES;
  console.log(`clone cost: ${cloneMs.toFixed(2)} ms/clone (${CLONES} clones)`);

  // --- rollout cost per inner tier ---
  const tierMs = new Map<InnerTier, number>();
  for (const tier of ['bare', 'traffic', 'searcher'] as const) {
    const M = tier === 'searcher' ? 6 : 20;
    t0 = performance.now();
    let ticks = 0;
    for (let k = 0; k < M; k++) {
      const clone = cloneRunForRollout(state, 1000 + k);
      const r = walkToHorizon(clone, {
        horizonBattles: 1,
        policySeed: 900000 + k,
        innerTier: tier,
      });
      ticks += r.totalTicks;
    }
    const ms = (performance.now() - t0) / M;
    tierMs.set(tier, ms);
    console.log(
      `rollout (${tier}): ${ms.toFixed(1)} ms/rollout avg over ${M} ` +
        `(${Math.round(ticks / M)} battle ticks avg)`,
    );
  }
  return { cloneMs, tierMs };
}

// --- the three depths ---
const fresh = new Run(SEED, new EventBus<GameEvents>());
const mid = advance(5);
const deep = advance(24);
console.log(
  `\nstates: fresh (hop 1) · mid (${mid.battlesEnded} battles, ${mid.sectors} sector(s) cleared)` +
    ` · deep (${deep.battlesEnded} battles, ${deep.sectors} sector(s) cleared)`,
);

const rFresh = benchState('fresh — hop-1 map, starting roster', fresh);
const rMid = benchState(`mid — act 1 (${mid.battlesEnded} battles in)`, mid.run);
const rDeep = benchState(
  `deep — ${deep.sectors > 0 ? 'act 2' : 'late act 1'} (${deep.battlesEnded} battles in)`,
  deep.run,
);

// --- projections (K=2, the LOCKED starting point) ---
// ASSUMPTIONS — candidate ARMS include the null arm (it rolls out too);
// decisions/act assume ~11 hops and ~2.5 turns/hop ≈ 27 turns. All of
// these are estimates until §71 telemetry measures them; the two-act walk
// roughly doubles the act-1 counts.
const K = 2;
const SITES: readonly { site: string; arms: number; perAct: number }[] = [
  { site: 'node choice', arms: 3, perAct: 11 }, // frontier 1–3 incl. null-ish (root=1)
  { site: 'preTurn fire', arms: 3, perAct: 27 }, // per turn
  { site: 'redraw', arms: 3, perAct: 27 },
  { site: 'empower', arms: 4, perAct: 27 },
  { site: 'outOfBattle fire', arms: 3, perAct: 11 }, // per hop
  { site: 'port buy (per ask)', arms: 6, perAct: 8 }, // ~3 docks × ~2.5 asks
  { site: 'reward daemon pick', arms: 2, perAct: 2 },
];

console.log('\n=== projections (K=2; assumption-labeled — see source) ===');
const rolloutsPerAct = SITES.reduce((acc, s) => acc + s.arms * K * s.perAct, 0);
console.log(`rollouts/act: ${rolloutsPerAct} (Σ arms × K × decisions)`);
for (const s of SITES) {
  console.log(
    `  ${s.site}: ${s.arms} arms × K${K} × ${s.perAct}/act = ${s.arms * K * s.perAct} rollouts/act`,
  );
}
// Per-rollout cost varies with the NEXT battle's size (each state prices
// one specific upcoming battle), so project from the min–max spread
// across the three depths, per tier.
const states = [rFresh, rMid, rDeep];
for (const tier of ['traffic', 'bare', 'searcher'] as const) {
  const ms = states.map((s) => s.tierMs.get(tier)!);
  const lo = Math.min(...ms);
  const hi = Math.max(...ms);
  const label = tier === 'traffic' ? 'traffic (the cheap default)' : tier;
  console.log(
    `arbitration overhead @ ${label}: ${((rolloutsPerAct * lo) / 1000).toFixed(0)}–` +
      `${((rolloutsPerAct * hi) / 1000).toFixed(0)} s/act · ` +
      `${((rolloutsPerAct * lo * 2.2) / 1000 / 60).toFixed(1)}–` +
      `${((rolloutsPerAct * hi * 2.2) / 1000 / 60).toFixed(1)} min two-act run`,
  );
}
console.log(
  '\nclone cost is NEGLIGIBLE at every depth (<0.1 ms vs 15–1700 ms battle sim):\n' +
    'the battle sim is ~100% of rollout cost — result-sharing across\n' +
    'non-perturbing candidates is the only cache class worth ever building.',
);
