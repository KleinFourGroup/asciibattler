/**
 * THE JOURNAL CORPUS: stored runs that a later tree must replay event for
 * event.
 *
 * A test that runs one seed twice on the same code shows the code agrees with
 * itself. To show that a change left behaviour alone, something has to be
 * kept from before the change. Here that is a set of run journals (the
 * commands and orders of whole runs, src/journal/journal.ts) recorded once
 * from the table below, and beside them what each one reached when it was
 * recorded: a digest of every event of every battle, the end's hash, which
 * commands changed the run and in which phases (`baseline.json`). A journal
 * holds inputs only, so replaying it feeds the new code exactly what the old
 * code was fed, whatever has happened to the drivers since.
 *
 *   npm run corpus                       replay every journal against the baseline
 *   npm run corpus -- --record           drive the table again: new journals, new baseline
 *   npm run corpus -- --rebaseline       keep the journals, take the baseline from this tree
 *   npm run corpus -- --snapshots=<dir>  write each journal's end snapshot
 *   npm run corpus -- --survey=<n>       what chaos seeds 1..n reach, to choose rows from
 *
 * WHEN THE BASELINE MAY BE RETAKEN. `--rebaseline` after a change that is
 * proven to move the stored words and not the behaviour: a slimmed snapshot
 * (the end hash moves; compare the snapshots path by path first) or a rename
 * of what events carry (the digests move; replay under a mapping back to the
 * old names first, src/journal/replayDigest.ts). `--record` after a change
 * that is meant to alter behaviour, since the old journals' commands may no
 * longer be the ones a run would take. Neither is a way to make a red corpus
 * green.
 *
 * The journals are replayed past their config stamp (`ignoreConfig`): moving
 * a key between config files changes the stamp and no behaviour, and a
 * changed number shows as a divergence, which is the point.
 *
 * TWO DRIVERS. `player` is the seeded player of tests/journalDrive.ts with
 * its planted orders and discards; `chaos` is the chaos driver, which also
 * sends random and illegal commands. No test framework is used here, so the
 * CLI runs under tsx.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RunJournal } from '../../../src/journal/journal';
import { digestReplay } from '../../../src/journal/replayDigest';
import type { RunSnapshot } from '../../../src/run/Run';
import { chaosRun } from '../../chaos/chaos';
import { asFile, driveRun, replayPlants } from '../../journalDrive';

export interface CorpusRow {
  readonly driver: 'player' | 'chaos';
  readonly seed: number;
  /** The run's dials as URL query text. */
  readonly dials: string;
  /** A short run: corpus.test.ts plants its edits in one of these. */
  readonly quick?: true;
}

/** The file name a row's journal is stored under, without `.json`. */
export function rowId(row: CorpusRow): string {
  const slug = row.dials.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${row.driver}-${row.seed}${slug === '' ? '' : `-${slug}`}`;
}

const player = (seed: number, dials = '', quick?: true): CorpusRow =>
  quick === undefined ? { driver: 'player', seed, dials } : { driver: 'player', seed, dials, quick };
const chaos = (seed: number, dials = '', quick?: true): CorpusRow =>
  quick === undefined ? { driver: 'chaos', seed, dials } : { driver: 'chaos', seed, dials, quick };

export const CORPUS: readonly CorpusRow[] = [
  // The seeded player at the shipped length.
  player(1),
  player(3),
  player(5),
  // Short runs: each character, each Escalation level.
  player(7, 'hops=3&character=soldier', true),
  player(2, 'hops=3&character=priest'),
  player(3, 'hops=3&character=gambler'),
  player(11, 'hops=3&escalation=1'),
  player(12, 'hops=3&escalation=2'),
  player(13, 'hops=3&escalation=3'),
  player(14, 'hops=3&escalation=4'),
  player(15, 'hops=3&escalation=5'),
  // Sectors, the procedural layout, and the three first-node dials.
  player(1, 'sectorHops=2'),
  player(2, 'sectorHops=2&character=priest'),
  player(4, 'hops=3&layout=procedural', true),
  player(5, 'hops=2&firstNode=event'),
  player(6, 'hops=2&firstNode=rest'),
  player(8, 'hops=1&firstNode=elite'),
  // The chaos driver's every-commit seeds (tests/chaos/chaos.test.ts).
  chaos(3, 'hops=3&layout=procedural', true),
  chaos(31),
  chaos(6, 'sectorHops=2'),
  chaos(4, 'character=gambler&bits=300'),
  // More of its runs, chosen from `--survey=8` for the command kinds the
  // rows above never apply (a packet bought at a port, a redraw, a packet
  // used) and for breadth, the shorter run where two reach the same.
  chaos(1),
  chaos(3),
  chaos(6),
  chaos(1, 'sectorHops=2'),
  chaos(8, 'sectorHops=2'),
  chaos(2, 'hops=3&layout=procedural'),
  chaos(1, 'character=gambler&bits=300'),
  chaos(2, 'character=gambler&bits=300'),
  chaos(5, 'character=gambler&bits=300'),
  // Chosen from `--survey=12` when the strikes moved (2026-10-29) and the
  // rows above stopped buying at a port: a packet bought, and a unit bought
  // and one paid off.
  chaos(12),
  chaos(8, 'character=gambler&bits=300'),
];

const HERE = dirname(fileURLToPath(import.meta.url));
export const JOURNAL_DIR = join(HERE, 'journals');
export const BASELINE_PATH = join(HERE, 'baseline.json');

/** What one journal reached when it was replayed. */
export interface Reach {
  /** How the run ended: `defeat`, `victory`, `abandoned`. */
  readonly end: string;
  /** One digest per battle: every event from its start to its end. */
  readonly battles: readonly string[];
  /** The digest of every event outside a battle. */
  readonly outside: string;
  readonly events: number;
  /** The names of the events that fired, sorted. */
  readonly eventNames: readonly string[];
  /** `snapshotHash` of the Run at the end. */
  readonly endHash: string;
  /** Per command kind: how many were sent, and how many changed the run. */
  readonly commands: Readonly<Record<string, readonly [sent: number, changed: number]>>;
  /** The phases in which a command changed the run, sorted. */
  readonly phases: readonly string[];
}

/** Replay `journal` on this tree and say what it reached, with its end snapshot. */
export function replayReach(journal: RunJournal): { reach: Reach; snapshot: RunSnapshot } {
  const commands: Record<string, [number, number]> = {};
  const phases = new Set<string>();
  const digest = digestReplay(journal, {
    ignoreConfig: true,
    onCommand: (_segment, command, phase, changed) => {
      const row = (commands[command.kind] ??= [0, 0]);
      row[0]++;
      if (changed) {
        row[1]++;
        phases.add(phase);
      }
    },
  })[0]!;
  const sorted = Object.fromEntries(Object.entries(commands).sort(([a], [b]) => a.localeCompare(b)));
  return {
    reach: {
      end: journal.segments[0]!.end?.reason ?? 'open',
      battles: digest.battles,
      outside: digest.outside,
      events: digest.events,
      eventNames: Object.keys(digest.byName).sort(),
      endHash: digest.endHash,
      commands: sorted,
      phases: [...phases].sort(),
    },
    snapshot: digest.snapshot,
  };
}

/** Drive a row on this tree and return its closed journal. */
export function recordRow(row: CorpusRow): RunJournal {
  if (row.driver === 'chaos') return chaosRun({ seed: row.seed, dials: row.dials }).journal;
  const recorded = driveRun({
    start: { kind: 'seed', seed: row.seed, dials: row.dials },
    choiceSeed: row.seed,
    plants: replayPlants(),
  });
  return asFile(recorded.journal);
}

export const journalPath = (id: string): string => join(JOURNAL_DIR, `${id}.json`);

export function loadJournal(id: string): RunJournal {
  return JSON.parse(readFileSync(journalPath(id), 'utf8')) as RunJournal;
}

/** The ids of the journals on disk, sorted. */
export function storedIds(): string[] {
  if (!existsSync(JOURNAL_DIR)) return [];
  return readdirSync(JOURNAL_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
}

export function loadBaseline(): Record<string, Reach> {
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, Reach>;
}

/** One journal to a line, so a retaken baseline diffs run by run. */
export function writeBaseline(baseline: Readonly<Record<string, Reach>>): void {
  const lines = Object.keys(baseline)
    .sort()
    .map((id) => `${JSON.stringify(id)}: ${JSON.stringify(baseline[id])}`);
  writeFileSync(BASELINE_PATH, `{\n${lines.join(',\n')}\n}\n`);
}

export function writeJournal(id: string, journal: RunJournal): void {
  mkdirSync(JOURNAL_DIR, { recursive: true });
  writeFileSync(journalPath(id), `${JSON.stringify(journal)}\n`);
}

/** Where `now` differs from `then`, in words; empty when it reached the same. */
export function reachDifferences(then: Reach, now: Reach): string[] {
  const out: string[] = [];
  if (now.end !== then.end) out.push(`ended ${now.end}, was ${then.end}`);
  if (now.battles.length !== then.battles.length) {
    out.push(`${now.battles.length} battles, was ${then.battles.length}`);
  } else {
    const differing = then.battles.flatMap((digest, i) => (digest === now.battles[i] ? [] : [i + 1]));
    if (differing.length > 0) out.push(`the events of battle ${differing.join(', ')} differ`);
  }
  if (now.outside !== then.outside) out.push('the events outside battles differ');
  if (now.events !== then.events) out.push(`${now.events} events, was ${then.events}`);
  if (now.endHash !== then.endHash) out.push(`end hash ${now.endHash}, was ${then.endHash}`);
  if (JSON.stringify(now.commands) !== JSON.stringify(then.commands)) out.push('which commands changed the run differs');
  if (JSON.stringify(now.phases) !== JSON.stringify(then.phases)) out.push('the phases reached differ');
  if (JSON.stringify(now.eventNames) !== JSON.stringify(then.eventNames)) out.push('the event names fired differ');
  return out;
}
