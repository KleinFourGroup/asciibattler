/**
 * `npm run corpus`: the journal corpus from the command line (corpus.ts says
 * what it is, and when its baseline may be retaken). With no flag it replays
 * every stored journal against the baseline, one line per run, and exits 1 on
 * any difference.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JournalDivergence } from '../../../src/journal/replayJournal';
import { KINDS, chaosRun } from '../../chaos/chaos';
import {
  CORPUS,
  JOURNAL_DIR,
  loadBaseline,
  loadJournal,
  reachDifferences,
  recordRow,
  replayReach,
  rowId,
  writeBaseline,
  writeJournal,
  type Reach,
} from './corpus';

const args = process.argv.slice(2);
const has = (flag: string): boolean => args.includes(`--${flag}`);
const value = (name: string): string | undefined => {
  const raw = args.find((a) => a.startsWith(`--${name}=`));
  return raw === undefined ? undefined : raw.slice(name.length + 3);
};

/** The union over the runs: what the corpus reaches as a whole. */
function census(reaches: readonly Reach[]): string[] {
  const changed = new Map<string, number>();
  const phases = new Set<string>();
  const names = new Set<string>();
  const ends = new Map<string, number>();
  let battles = 0;
  let events = 0;
  for (const reach of reaches) {
    for (const [kind, [, n]] of Object.entries(reach.commands)) changed.set(kind, (changed.get(kind) ?? 0) + n);
    reach.phases.forEach((p) => phases.add(p));
    reach.eventNames.forEach((n) => names.add(n));
    ends.set(reach.end, (ends.get(reach.end) ?? 0) + 1);
    battles += reach.battles.length;
    events += reach.events;
  }
  const reached = KINDS.filter((k) => (changed.get(k) ?? 0) > 0);
  const never = KINDS.filter((k) => (changed.get(k) ?? 0) === 0);
  return [
    `census: ${reaches.length} runs (${[...ends].map(([end, n]) => `${n} ${end}`).join(', ')}), ${battles} battles, ${events} events`,
    `census: ${reached.length} of ${KINDS.length} command kinds change a run: ${reached.map((k) => `${k} ${changed.get(k)}`).join(', ')}`,
    `census: never changes a run: ${never.length === 0 ? 'none' : never.join(', ')}`,
    `census: phases in which a command changed a run (${phases.size}): ${[...phases].sort().join(', ')}`,
    `census: ${names.size} event names fired`,
  ];
}

function record(): number {
  rmSync(JOURNAL_DIR, { recursive: true, force: true });
  const baseline: Record<string, Reach> = {};
  let bytes = 0;
  for (const row of CORPUS) {
    const id = rowId(row);
    const started = performance.now();
    const journal = recordRow(row);
    writeJournal(id, journal);
    const { reach } = replayReach(journal);
    baseline[id] = reach;
    const size = JSON.stringify(journal).length;
    bytes += size;
    console.log(
      `recorded ${id}: ${reach.end}, ${reach.battles.length} battles, ${size} bytes, ${Math.round(performance.now() - started)} ms`,
    );
  }
  writeBaseline(baseline);
  census(Object.values(baseline)).forEach((line) => console.log(line));
  console.log(`${CORPUS.length} journals, ${bytes} bytes`);
  return 0;
}

function rebaseline(): number {
  const baseline: Record<string, Reach> = {};
  for (const row of CORPUS) {
    const id = rowId(row);
    baseline[id] = replayReach(loadJournal(id)).reach;
    console.log(`rebaselined ${id}`);
  }
  writeBaseline(baseline);
  return 0;
}

function check(snapshotDir: string | undefined): number {
  const baseline = loadBaseline();
  const reaches: Reach[] = [];
  let failures = 0;
  const t0 = performance.now();
  if (snapshotDir !== undefined) mkdirSync(snapshotDir, { recursive: true });
  for (const row of CORPUS) {
    const id = rowId(row);
    const started = performance.now();
    try {
      const { reach, snapshot } = replayReach(loadJournal(id));
      reaches.push(reach);
      if (snapshotDir !== undefined) writeFileSync(join(snapshotDir, `${id}.json`), JSON.stringify(snapshot));
      const then = baseline[id];
      const differences = then === undefined ? ['no baseline for it'] : reachDifferences(then, reach);
      const ms = Math.round(performance.now() - started);
      if (differences.length === 0) console.log(`ok   ${id}: ${reach.end}, ${reach.battles.length} battles, ${ms} ms`);
      else {
        failures++;
        console.log(`DIFF ${id}: ${differences.join('; ')}`);
      }
    } catch (error) {
      if (!(error instanceof JournalDivergence)) throw error;
      failures++;
      console.log(`DIVERGED ${id}: ${error.message}`);
    }
  }
  census(reaches).forEach((line) => console.log(line));
  console.log(`${failures} of ${CORPUS.length} journals differ, ${Math.round(performance.now() - t0)} ms`);
  return failures > 0 ? 1 : 0;
}

/** What chaos seeds 1..n reach on each dial set, one line per run. */
function survey(n: number): number {
  const dialSets = ['', 'sectorHops=2', 'hops=3&layout=procedural', 'character=gambler&bits=300'];
  for (const dials of dialSets) {
    for (let seed = 1; seed <= n; seed++) {
      const started = performance.now();
      const r = chaosRun({ seed, dials });
      const applied = Object.entries(r.census)
        .filter(([, row]) => row.applied > 0)
        .map(([kind]) => kind)
        .sort();
      console.log(
        `chaos ${seed} ${dials || '(no dials)'}: ${r.end}, ${r.battles} battles, ${JSON.stringify(r.journal).length} bytes, ` +
          `${Math.round(performance.now() - started)} ms, ${applied.length} kinds: ${applied.join(',')}`,
      );
    }
  }
  return 0;
}

const surveySeeds = value('survey');
process.exit(
  has('record')
    ? record()
    : has('rebaseline')
      ? rebaseline()
      : surveySeeds !== undefined
        ? survey(Number(surveySeeds))
        : check(value('snapshots')),
);
