/**
 * WHAT A PROOF REACHES: the coverage tool's reading of each behaviour proof.
 *
 * A proof can vouch only for code it runs. The journal corpus replays stored
 * runs, so it says nothing about the renderer; the fuzz diff plays the bot,
 * and the corpus never loads it. This module runs a proof under the coverage
 * tool (@vitest/coverage-v8), keeps which lines, functions and branch arms it
 * executed, and answers for a file or a range of lines: which proofs run
 * this? A candidate for deletion names a proof from that answer, or learns
 * that none reaches it.
 *
 *   npm run oracle -- reach-record [proof…]        run the proofs under coverage → output/reach/<proof>.json
 *   npm run oracle -- reach [folder…]              lines reached, folder by folder and proof by proof
 *   npm run oracle -- reach --at=<file>[:<a>[-<b>]]  one file or a range of its lines, proof by proof
 *   npm run oracle -- reach-diff <before> <after>  what the first reading reaches and the second does not
 *
 * REACHED IS NOT PROVEN. A proof that runs a line may still not notice a
 * change to it: the corpus compares events and the end's hash, and a value
 * that reaches neither is invisible to it. A planted break at the site is
 * what shows a proof fails there (TESTING.md, "The oracle map").
 * UNREACHED IS A FINDING: no change to that line can fail that proof.
 *
 * `reach-diff` is the proof for a deleted test: the suite's reading before
 * and after, where nothing may be lost. It shows the suite still runs every
 * line, function and branch arm it ran, and not that it still asserts on
 * them.
 *
 * A reading holds the lines of the tree it was recorded on, so it is read
 * against that tree: record again after the code moves.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export interface Proof {
  readonly id: string;
  readonly what: string;
  /** The arguments after `vitest run`. */
  readonly vitest: readonly string[];
}

/** The behaviour proofs a reading can be taken of, each as the Vitest run that executes it. */
/** The test `npm run fuzz:smoke` leaves out (package.json): `fuzz:jobs-parity` runs it. */
export const JOBS_PARITY = 'tests/fuzz/parallelRunDecisions.test.ts';

export const PROOFS: readonly Proof[] = [
  { id: 'corpus', what: 'the journal corpus, all 30 journals (the smoke tier)', vitest: ['--config', 'vitest.fuzz.config.ts', 'tests/fuzz/corpus'] },
  { id: 'corpus-quick', what: 'the corpus’s three quick rows (every npm test)', vitest: ['tests/corpus-quick.test.ts'] },
  { id: 'chaos', what: 'the chaos driver’s four every-commit seeds', vitest: ['tests/chaos'] },
  { id: 'fuzz-diff', what: 'the fuzz diff’s two shapes (scripts/perf-oracle.sh)', vitest: ['--config', 'tests/oracle/proofs.vitest.config.ts'] },
  { id: 'npm-test', what: 'every test of npm test', vitest: [] },
  { id: 'smoke', what: 'every test of npm run fuzz:smoke', vitest: ['--config', 'vitest.fuzz.config.ts', '--exclude', JOBS_PARITY] },
];

/** What the coverage tool is asked to read: the TypeScript the type checker covers, less the tests themselves. */
export const COUNTED = ['src/**/*.ts', 'tests/**/*.ts', 'tools/**/*.ts', 'scripts/**/*.ts'];
export const NOT_COUNTED = ['**/*.test.ts', '**/*.proof.ts', '**/*.d.ts', 'tests/fuzz/output/**'];

export const READING_DIR = 'output/reach';

export interface FunctionReach {
  readonly name: string;
  readonly from: number;
  readonly to: number;
  readonly calls: number;
}

export interface FileReach {
  /** Line → the most times a statement that starts on it ran. A line with no entry starts no statement. */
  readonly lines: Readonly<Record<number, number>>;
  readonly functions: readonly FunctionReach[];
  /** Each branch point: its line, and how many times each arm ran. */
  readonly branches: readonly (readonly [line: number, arms: readonly number[]])[];
}

/** One proof's reading: repo-relative path, forward slashes → what it reached there. */
export type Reading = Readonly<Record<string, FileReach>>;

interface IstanbulFile {
  readonly statementMap: Record<string, { start: { line: number } }>;
  readonly s: Record<string, number>;
  readonly fnMap: Record<string, { name: string; loc: { start: { line: number }; end: { line: number } } }>;
  readonly f: Record<string, number>;
  readonly branchMap: Record<string, { loc: { start: { line: number } } }>;
  readonly b: Record<string, number[]>;
}

const slashes = (path: string): string => path.split('\\').join('/');

/** The coverage tool's `coverage-final.json`, recorded in the tree at `root`, as a reading. */
export function fromIstanbul(json: Record<string, IstanbulFile>, root: string): Reading {
  const prefix = `${slashes(resolve(root)).toLowerCase()}/`;
  const out: Record<string, FileReach> = {};
  for (const [path, file] of Object.entries(json)) {
    const full = slashes(path);
    if (!full.toLowerCase().startsWith(prefix)) throw new Error(`reach: ${path} is not under ${root}`);
    const lines: Record<number, number> = {};
    for (const [id, at] of Object.entries(file.statementMap)) {
      lines[at.start.line] = Math.max(lines[at.start.line] ?? 0, file.s[id] ?? 0);
    }
    out[full.slice(prefix.length)] = {
      lines,
      functions: Object.entries(file.fnMap)
        .map(([id, fn]) => ({ name: fn.name, from: fn.loc.start.line, to: fn.loc.end.line, calls: file.f[id] ?? 0 }))
        .sort((x, y) => x.from - y.from),
      branches: Object.entries(file.branchMap).map(([id, branch]) => [branch.loc.start.line, file.b[id] ?? []] as const),
    };
  }
  return Object.fromEntries(Object.entries(out).sort(([x], [y]) => (x < y ? -1 : 1)));
}

export interface Count {
  /** Lines that start a statement. */
  readonly lines: number;
  readonly reached: number;
}

/** The lines of `file` from `from` to `to` (both included; the whole file when left out). */
export function countAt(reading: Reading, file: string, from = 1, to = Infinity): Count | null {
  const reach = reading[file];
  if (reach === undefined) return null;
  let lines = 0;
  let reached = 0;
  for (const [line, hits] of Object.entries(reach.lines)) {
    if (Number(line) < from || Number(line) > to) continue;
    lines++;
    if (hits > 0) reached++;
  }
  return { lines, reached };
}

/** The functions of `file` that overlap the range. */
export function functionsAt(reading: Reading, file: string, from = 1, to = Infinity): readonly FunctionReach[] {
  return (reading[file]?.functions ?? []).filter((fn) => fn.to >= from && fn.from <= to);
}

/** Lines counted and reached by group, where `groupOf` names each file's group (or null to leave it out). */
export function countBy(reading: Reading, groupOf: (file: string) => string | null): Map<string, Count & { files: number; filesReached: number }> {
  const out = new Map<string, Count & { files: number; filesReached: number }>();
  for (const file of Object.keys(reading)) {
    const group = groupOf(file);
    if (group === null) continue;
    const here = countAt(reading, file)!;
    const sum = out.get(group) ?? { lines: 0, reached: 0, files: 0, filesReached: 0 };
    out.set(group, {
      lines: sum.lines + here.lines,
      reached: sum.reached + here.reached,
      files: sum.files + 1,
      filesReached: sum.filesReached + (here.reached > 0 ? 1 : 0),
    });
  }
  return out;
}

/** A reading of everything any of `readings` reached. */
export function union(readings: readonly Reading[]): Reading {
  const out: Record<string, FileReach> = {};
  for (const reading of readings) {
    for (const [file, reach] of Object.entries(reading)) {
      const had = out[file];
      if (had === undefined) {
        out[file] = reach;
        continue;
      }
      const lines: Record<number, number> = { ...had.lines };
      for (const [line, hits] of Object.entries(reach.lines)) lines[Number(line)] = Math.max(lines[Number(line)] ?? 0, hits);
      out[file] = {
        lines,
        functions: had.functions.map((fn, i) => ({ ...fn, calls: Math.max(fn.calls, reach.functions[i]?.calls ?? 0) })),
        branches: had.branches.map(([line, arms], i) => [line, arms.map((n, arm) => Math.max(n, reach.branches[i]?.[1][arm] ?? 0))] as const),
      };
    }
  }
  return out;
}

export interface Lost {
  readonly file: string;
  /** Lines `before` reached and `after` did not. */
  readonly lines: readonly number[];
  /** Functions called before and not after, as `name:line`. */
  readonly functions: readonly string[];
  /** Branch arms taken before and not after, as `line/arm`. */
  readonly arms: readonly string[];
}

/** A changed file's lines, before → after: `null` for a line its diff removed or rewrote. */
export type LineMap = (line: number) => number | null;

/**
 * The line map of one file's `git diff -U0` (hunks with no context lines). A
 * line in a hunk's old range is `null`; any other line moves by what the
 * hunks above it added and removed. A hunk that removes nothing inserts after
 * the old line it names.
 */
export function lineMap(diff: string): LineMap {
  const hunks = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+\d+(?:,(\d+))? @@/gm)].map((m) => {
    const removed = m[2] === undefined ? 1 : Number(m[2]);
    return { first: Number(m[1]) + (removed === 0 ? 1 : 0), removed, added: m[3] === undefined ? 1 : Number(m[3]) };
  });
  return (line) => {
    let shift = 0;
    for (const hunk of hunks) {
      if (line < hunk.first) break;
      if (line < hunk.first + hunk.removed) return null;
      shift += hunk.added - hunk.removed;
    }
    return line + shift;
  };
}

/** Items in order, grouped by a line: the k-th on a line pairs with the k-th on its mapped line. */
function byLine<T>(items: readonly T[], lineOf: (item: T) => number): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const item of items) out.set(lineOf(item), [...(out.get(lineOf(item)) ?? []), item]);
  return out;
}

/**
 * What `before` reached and `after` does not, file by file. A file named in
 * `maps` changed between the readings: its lines are compared through its
 * map, a line the change removed counts as deleted rather than lost, and
 * what is lost is named by its line in `after`. Any other file is the same
 * source in both readings, and a file whose statements differ is an error,
 * since its lines would not line up.
 */
export function lost(before: Reading, after: Reading, maps: ReadonlyMap<string, LineMap> = new Map()): Lost[] {
  const out: Lost[] = [];
  for (const [file, was] of Object.entries(before)) {
    const now = after[file];
    if (now === undefined) {
      // A changed file the second reading does not hold was deleted with its code.
      if (!maps.has(file) && countAt(before, file)!.reached > 0) {
        out.push({ file, lines: [], functions: ['(the file is not in the second reading)'], arms: [] });
      }
      continue;
    }
    const map = maps.get(file);
    if (map === undefined) {
      const sameShape =
        Object.keys(was.lines).join() === Object.keys(now.lines).join() &&
        was.functions.length === now.functions.length &&
        was.branches.length === now.branches.length;
      if (!sameShape) throw new Error(`reach: ${file} differs between the two readings, so their lines cannot be compared`);
    }
    const to: LineMap = map ?? ((line) => line);
    const lines = Object.entries(was.lines).flatMap(([line, hits]) => {
      const moved = hits > 0 ? to(Number(line)) : null;
      return moved !== null && (now.lines[moved] ?? 0) === 0 ? [moved] : [];
    });
    // Functions and branch points pair by their line and their order on it,
    // since the coverage tool numbers anonymous functions by position.
    const fnsNow = byLine(now.functions, (fn) => fn.from);
    const fnsWas = byLine(was.functions, (fn) => fn.from);
    const functions = [...fnsWas].flatMap(([line, fns]) => {
      const moved = to(line);
      if (moved === null) return [];
      return fns.flatMap((fn, k) => (fn.calls > 0 && (fnsNow.get(moved)?.[k]?.calls ?? 0) === 0 ? [`${fn.name}:${moved}`] : []));
    });
    const branchesNow = byLine(now.branches, ([line]) => line);
    const arms = [...byLine(was.branches, ([line]) => line)].flatMap(([line, points]) => {
      const moved = to(line);
      if (moved === null) return [];
      return points.flatMap(([, hits], k) => {
        const armsNow = branchesNow.get(moved)?.[k]?.[1] ?? [];
        return hits.flatMap((n, arm) => (n > 0 && (armsNow[arm] ?? 0) === 0 ? [`${moved}/${arm}`] : []));
      });
    });
    if (lines.length + functions.length + arms.length > 0) out.push({ file, lines, functions, arms });
  }
  return out;
}

/** `src/x.ts:10-20` → the file and the range; `src/x.ts:10` is one line, `src/x.ts` the file. */
export function parseAt(at: string): { file: string; from: number; to: number } {
  const match = /^(.*?)(?::(\d+)(?:-(\d+))?)?$/.exec(slashes(at))!;
  const from = match[2] === undefined ? 1 : Number(match[2]);
  const to = match[3] !== undefined ? Number(match[3]) : match[2] !== undefined ? from : Infinity;
  return { file: match[1]!, from, to };
}

export const readingPath = (proof: string, dir = READING_DIR): string => join(dir, `${proof}.json`);

export function loadReading(path: string): Reading {
  return JSON.parse(readFileSync(path, 'utf8')) as Reading;
}

/** The readings on disk, by proof, in `PROOFS`' order. */
export function loadReadings(dir = READING_DIR): Map<string, Reading> {
  const out = new Map<string, Reading>();
  for (const proof of PROOFS) if (existsSync(readingPath(proof.id, dir))) out.set(proof.id, loadReading(readingPath(proof.id, dir)));
  return out;
}

/**
 * Run `proof` under the coverage tool in the tree at `root` and write its
 * reading, with the run's output beside it (`<proof>.log`). Returns Vitest's
 * exit code; a proof that fails still leaves a reading, of what it ran.
 */
export function record(proof: Proof, root = '.', dir = READING_DIR): number {
  const reports = mkdtempSync(join(tmpdir(), 'reach-'));
  try {
    const run = spawnSync(
      process.execPath,
      [
        'node_modules/vitest/vitest.mjs',
        'run',
        ...proof.vitest,
        '--coverage.enabled',
        '--coverage.provider=v8',
        '--coverage.reporter=json',
        '--coverage.reportOnFailure',
        // The tool slows a run some two and a half times, and a test's default
        // five seconds is not meant to measure that.
        '--testTimeout=600000',
        `--coverage.reportsDirectory=${reports}`,
        ...COUNTED.map((glob) => `--coverage.include=${glob}`),
        ...NOT_COUNTED.map((glob) => `--coverage.exclude=${glob}`),
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 },
    );
    // The run's own output is kept beside the reading: a proof that failed
    // under the tool says why there.
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${proof.id}.log`), `${run.stdout}${run.stderr}`);
    const final = join(reports, 'coverage-final.json');
    if (!existsSync(final)) throw new Error(`reach: ${proof.id} left no coverage (vitest exited ${run.status}); see ${join(dir, `${proof.id}.log`)}`);
    writeFileSync(readingPath(proof.id, dir), JSON.stringify(fromIstanbul(JSON.parse(readFileSync(final, 'utf8')) as Record<string, IstanbulFile>, root)));
    return run.status ?? 1;
  } finally {
    rmSync(reports, { recursive: true, force: true });
  }
}

/**
 * The fuzz diff's shapes, read out of scripts/perf-oracle.sh so that the
 * flags have one home: each `SHAPE_<NAME>="…"` line with `$VECTOR` filled in.
 * The shape that script takes from the environment is left out.
 */
export function fuzzDiffShapes(script: string): { name: string; flags: string[] }[] {
  const value = (name: string): string | undefined => new RegExp(`^${name}="([^"]*)"$`, 'm').exec(script)?.[1];
  const vector = value('VECTOR');
  if (vector === undefined) throw new Error('reach: scripts/perf-oracle.sh has no VECTOR="…" line');
  const shapes = [...script.matchAll(/^SHAPE_([A-Z]+)="([^"]*)"$/gm)]
    .filter(([, , flags]) => !flags!.startsWith('${'))
    .map(([, name, flags]) => ({ name: name!.toLowerCase(), flags: flags!.replace('$VECTOR', vector).split(/\s+/) }));
  if (shapes.length === 0) throw new Error('reach: scripts/perf-oracle.sh has no SHAPE_<NAME>="…" line');
  return shapes;
}
