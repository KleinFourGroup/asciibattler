/**
 * 77b — the sector-map metrics corpus report (`npm run nodemap:metrics`).
 * Generates N maps off the live `NodeMap.generate` and aggregates the
 * mapMetrics reads — the baseline instrument the 77c threshold signing
 * reads from, and the re-run instrument for judging 77e's rework.
 *
 *   npx tsx tools/nodemap-viz/report.ts [--seeds=500] [--start=1]
 *     [--hops=N] [--width=N] [--elite=x] [--port=x] [--event=x]
 *
 * Dial flags mirror the visualizer (the G1/72e/74e RunConfig knobs);
 * absent flags ride the authored config — the same `??` contract as
 * `generate` itself.
 */

import { RNG } from '../../src/core/RNG';
import { generate, type NodeKind } from '../../src/run/NodeMap';
import type { RunConfig } from '../../src/run/RunConfig';
import { computeMapMetrics, SPECIAL_KINDS, type MapMetrics } from '../../src/run/mapMetrics';

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}
function numFlag(name: string): number | undefined {
  const raw = flag(name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`--${name}=${raw} is not a number`);
  return n;
}

const seeds = numFlag('seeds') ?? 500;
const start = numFlag('start') ?? 1;
const hops = numFlag('hops');
const width = numFlag('width');
const elite = numFlag('elite');
const port = numFlag('port');
const event = numFlag('event');
const config: RunConfig = {
  ...(hops !== undefined ? { hopCount: hops } : {}),
  ...(width !== undefined ? { mapMaxWidth: width } : {}),
  ...(elite !== undefined ? { eliteChance: elite } : {}),
  ...(port !== undefined ? { portChance: port } : {}),
  ...(event !== undefined ? { eventChance: event } : {}),
};

const all: MapMetrics[] = [];
let hopCountSeen = 0;
for (let s = start; s < start + seeds; s++) {
  const map = generate(new RNG(s >>> 0), config);
  hopCountSeen = map.hops.length;
  all.push(computeMapMetrics(map));
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const percentile = (xs: number[], p: number): number => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? NaN;
};

console.log(
  `nodemap metrics — ${seeds} seeds (${start}..${start + seeds - 1}), hopCount ${hopCountSeen}, ` +
    `config ${Object.keys(config).length > 0 ? JSON.stringify(config) : 'authored'}`,
);
console.log('');

console.log('EARLY AVAILABILITY + PATH-KIND COVERAGE (per kind)');
for (const kind of SPECIAL_KINDS) {
  const present = all.filter((m) => m.firstHopByKind.has(kind));
  const firsts = present.map((m) => m.firstHopByKind.get(kind)!);
  const byHop = (k: number): string =>
    pct(all.filter((m) => (m.firstHopByKind.get(kind) ?? Infinity) <= k).length / all.length);
  const fracs = present.map((m) => m.pathFractionByKind.get(kind)!);
  const cov = present.map((m) => m.choiceCoverageByKind.get(kind) ?? 1);
  console.log(
    `  ${kind.padEnd(6)} present ${pct(present.length / all.length).padStart(6)}` +
      ` · first-hop mean ${mean(firsts).toFixed(1)} P90 ${percentile(firsts, 0.9)}` +
      ` · by h3 ${byHop(3)} h4 ${byHop(4)} h5 ${byHop(5)}`,
  );
  console.log(
    `         route-fraction mean ${pct(mean(fracs))} P10 ${pct(percentile(fracs, 0.1))}` +
      ` · <50% of routes in ${pct(fracs.filter((f) => f < 0.5).length / Math.max(1, fracs.length))} of maps` +
      ` · first-choice coverage mean ${pct(mean(cov))}, some-choice-locked in ${pct(
        cov.filter((c) => c < 1).length / Math.max(1, cov.length),
      )}`,
  );
}
console.log('');

console.log('ROUTE COMPOSITION (expected nodes per uniform route)');
const kinds: NodeKind[] = ['battle', 'rest', 'elite', 'port', 'event', 'boss'];
const compLine = kinds
  .map((k) => `${k} ${mean(all.map((m) => m.expectedRouteComposition.get(k) ?? 0)).toFixed(2)}`)
  .join(' · ');
const combatShare = mean(
  all.map((m) => {
    let combat = 0;
    let total = 0;
    for (const [k, v] of m.expectedRouteComposition) {
      total += v;
      if (k === 'battle' || k === 'elite' || k === 'boss') combat += v;
    }
    return combat / total;
  }),
);
console.log(`  ${compLine}`);
console.log(`  combat share (battle+elite+boss) ${pct(combatShare)}`);
const battleless = all.map((m) => m.battlelessMiddleHops);
console.log(
  `  battle-less middle hops: ≥1 in ${pct(battleless.filter((b) => b > 0).length / all.length)} of maps` +
    ` · mean ${mean(battleless).toFixed(2)} (the 74e stacking artifact)`,
);
console.log('');

console.log('BRANCH DIVERGENCE (pooled over all child-pairs)');
const pairs = all.flatMap((m) => [...m.rejoinPairs]);
const distHist = new Map<number, number>();
for (const p of pairs) distHist.set(p.rejoinDistance, (distHist.get(p.rejoinDistance) ?? 0) + 1);
const distLine = [...distHist.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([d, c]) => `d${d} ${pct(c / pairs.length)}`)
  .join(' · ');
console.log(`  ${pairs.length} pairs across ${all.length} maps (${(pairs.length / all.length).toFixed(1)}/map)`);
console.log(`  rejoin distance: ${distLine}`);
console.log(
  `  content-divergent (kind multisets differ): ${pct(pairs.filter((p) => p.kindDivergent).length / pairs.length)}` +
    ` · mean exclusive nodes ${mean(pairs.map((p) => p.exclusiveNodes)).toFixed(2)}`,
);
const immediatePerMap = all.map((m) =>
  m.rejoinPairs.length === 0
    ? 0
    : m.rejoinPairs.filter((p) => p.rejoinDistance === 2).length / m.rejoinPairs.length,
);
console.log(
  `  distance-2 ("instant") rejoins: ${pct(pairs.filter((p) => p.rejoinDistance === 2).length / pairs.length)} of pairs` +
    ` · per-map mean ${pct(mean(immediatePerMap))}`,
);
