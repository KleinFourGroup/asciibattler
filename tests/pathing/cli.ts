/**
 * §42c — the movement-metrics report CLI (`npm run pathing`). Prints the
 * PATHING.md tables: the three §42b fixtures (seed-invariant algorithm
 * portraits) + the shipped-layout battles across seeds. This is the standing
 * re-measure tool — §43c / §45d / §46a diff their runs against the PATHING.md
 * baseline this produced.
 */

import { runMovementMetrics } from './harness';
import { openFieldScenario, corridorScenario, riverForkScenario } from './fixtures';
import {
  measureLayout,
  headlineRow,
  mixRows,
  HEADLINE_HEADER,
  MIX_HEADER,
  CAPTURE_MAX_TICKS,
} from './capture';

const LAYOUTS: (string | null)[] = ['river', 'isthmus', 'labyrinth', 'endlessCorridors', null];
const SEEDS = [100, 101, 102];

const label = (l: string | null): string => l ?? 'procedural';

console.log('## Fixtures (ability-less, seed-invariant — algorithm portraits)\n');
const fixtureRuns = [
  ['openField(4)', runMovementMetrics(openFieldScenario(4), 200)] as const,
  ['corridor(3)', runMovementMetrics(corridorScenario(3), 400)] as const,
  ['corridor(6)', runMovementMetrics(corridorScenario(6), 400)] as const,
  ['riverFork(4)', runMovementMetrics(riverForkScenario(4), 300)] as const,
];
console.log(HEADLINE_HEADER);
for (const [name, m] of fixtureRuns) console.log(headlineRow(name, '—', m));
console.log('');
console.log(MIX_HEADER);
for (const [name, m] of fixtureRuns) for (const r of mixRows(name, '—', m)) console.log(r);

console.log(`\n## Shipped layouts (real battles, 3+2 per side, cap ${CAPTURE_MAX_TICKS} ticks)\n`);
console.log(HEADLINE_HEADER);
const measured: [string, number, ReturnType<typeof measureLayout>][] = [];
for (const layoutId of LAYOUTS) {
  for (const seed of SEEDS) {
    const m = measureLayout(layoutId, seed);
    measured.push([label(layoutId), seed, m]);
    console.log(headlineRow(label(layoutId), seed, m));
  }
}
console.log('');
console.log(MIX_HEADER);
for (const [name, seed, m] of measured) for (const r of mixRows(name, seed, m)) console.log(r);
