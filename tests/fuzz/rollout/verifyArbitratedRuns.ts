/**
 * 70f — the §70 exit-verify artifact: drive FULL arbitrated runs on both
 * canonical shapes (`--hops=11` act 1 · the sectorHops-4 two-act walk)
 * and report per-site decision counts — the "all five sites live"
 * criterion is a per-site ≥1 across the sweep, read from the decision
 * log itself (the co-equal goal-2 surface). Battle driver: the bare
 * selectors (site liveness is run-layer; the full-dress searcher check
 * runs via the CLI — WORKLOG §70). Two seeds per shape carry forced
 * janus+mars grants so the grant sites engage regardless of which
 * daemons the sweep's characters happen to hold.
 *
 *   npx tsx tests/fuzz/rollout/verifyArbitratedRuns.ts
 */

import { runOne } from '../harness';
import { makeArbitratedStrategy } from './arbitratedStrategy';

const ALL_SITES = [
  'portBuy',
  'packetFire:preTurn',
  'packetFire:outOfBattle',
  'rewardDaemon',
  'grant:redraw',
  'grant:empower',
  'nodeChoice',
] as const;

interface ShapeSpec {
  readonly label: string;
  readonly runConfig: {
    hopCount?: number;
    sectorHops?: number;
    grants?: readonly string[];
  };
  readonly seeds: readonly number[];
}

const GRANTS = ['janus', 'mars'];
const SHAPES: ShapeSpec[] = [
  { label: 'act 1 (hops=11)', runConfig: { hopCount: 11 }, seeds: [1, 2, 3, 4, 5, 6] },
  { label: 'act 1 + grants (hops=11)', runConfig: { hopCount: 11, grants: GRANTS }, seeds: [7, 8] },
  { label: 'two-act walk (sectorHops=4)', runConfig: { sectorHops: 4 }, seeds: [1, 2, 3, 4, 5, 6] },
  {
    label: 'two-act walk + grants (sectorHops=4)',
    runConfig: { sectorHops: 4, grants: GRANTS },
    seeds: [7, 8],
  },
];

const totals = new Map<string, number>();
let runs = 0;
const outcomes = new Map<string, number>();

for (const shape of SHAPES) {
  console.log(`\n### ${shape.label}`);
  for (const seed of shape.seeds) {
    const arm = makeArbitratedStrategy(seed, {});
    const t0 = performance.now();
    const r = runOne(seed, arm, { runConfig: shape.runConfig });
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    runs++;
    outcomes.set(r.outcome, (outcomes.get(r.outcome) ?? 0) + 1);
    const perSite = new Map<string, number>();
    for (const d of arm.driver.decisions) {
      perSite.set(d.site, (perSite.get(d.site) ?? 0) + 1);
      totals.set(d.site, (totals.get(d.site) ?? 0) + 1);
    }
    const siteNote =
      [...perSite.entries()].map(([s, n]) => `${s}:${n}`).join(' ') || '(no decisions)';
    console.log(
      `  seed ${seed}: ${r.outcome} (hop ${r.finalHopReached}) · ${arm.driver.decisions.length} decisions · ${siteNote} · ${secs}s`,
    );
  }
}

console.log(`\n### totals (${runs} runs)`);
console.log(`  outcomes: ${JSON.stringify(Object.fromEntries(outcomes))}`);
for (const site of ALL_SITES) {
  const n = totals.get(site) ?? 0;
  console.log(`  ${n === 0 ? '✗' : '✓'} ${site}: ${n}`);
}
const dead = ALL_SITES.filter((s) => (totals.get(s) ?? 0) === 0);
if (dead.length > 0) {
  console.log(`\nNOT LIVE across the sweep: ${dead.join(', ')} — widen the seed list.`);
  process.exitCode = 1;
} else {
  console.log('\nALL SITES LIVE across the sweep.');
}
