import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROOFS, countAt, countBy, fromIstanbul, functionsAt, fuzzDiffShapes, lost, parseAt, union, type Reading } from './reach';

// The reader of the coverage tool's output (reach.ts), held against a
// coverage file written by hand, so the known answer does not come from the
// tool. What the tool itself reads off a real proof is checked from outside,
// by planting a throw on lines it calls reached and on lines it calls
// unreached (TESTING.md, "The oracle map").

const at = (line: number): { start: { line: number } } => ({ start: { line } });
const span = (from: number, to: number): { start: { line: number }; end: { line: number } } => ({
  start: { line: from },
  end: { line: to },
});

type CoverageFile = Parameters<typeof fromIstanbul>[0][string];

/** `a.ts`: five statements on four lines, two functions, one branch of two arms. */
const A = (hits: { s: number[]; f: number[]; b: number[] }): CoverageFile => ({
  // Two statements start on line 3: the line counts the larger.
  statementMap: { 0: at(1), 1: at(3), 2: at(3), 3: at(7), 4: at(9) },
  s: Object.fromEntries(hits.s.map((n, i) => [i, n])),
  fnMap: { 0: { name: 'first', loc: span(2, 4) }, 1: { name: 'second', loc: span(6, 10) } },
  f: Object.fromEntries(hits.f.map((n, i) => [i, n])),
  branchMap: { 0: { loc: at(7) } },
  b: { 0: hits.b },
});

// The coverage tool writes absolute paths in the platform's own form.
const ROOT = resolve('a-tree');
const under = (path: string): string => join(ROOT, ...path.split('/'));
const reading = (a: Parameters<typeof A>[0], more: Record<string, CoverageFile> = {}): Reading =>
  fromIstanbul({ [under('src/sim/a.ts')]: A(a), ...more }, ROOT);

const ALL = { s: [1, 0, 4, 2, 0], f: [4, 2], b: [2, 0] };
const NONE = { s: [0, 0, 0, 0, 0], f: [0, 0], b: [0, 0] };

describe('a reading of what a proof reaches', () => {
  it('keys files by their path under the tree, with forward slashes', () => {
    expect(Object.keys(reading(ALL))).toEqual(['src/sim/a.ts']);
    // Windows reports a drive letter in either case.
    const path = under('src/sim/a.ts');
    expect(Object.keys(fromIstanbul({ [path[0]!.toLowerCase() + path.slice(1)]: A(ALL) }, ROOT))).toEqual(['src/sim/a.ts']);
  });

  it('refuses a file that is not under the tree it was told', () => {
    expect(() => fromIstanbul({ [join(resolve('elsewhere'), 'a.ts')]: A(ALL) }, ROOT)).toThrow(/not under/);
  });

  it('counts a line by the statement on it that ran most', () => {
    expect(reading(ALL)['src/sim/a.ts']!.lines).toEqual({ 1: 1, 3: 4, 7: 2, 9: 0 });
  });

  it('counts the lines that start a statement, and those reached, in a file or a range', () => {
    const r = reading(ALL);
    expect(countAt(r, 'src/sim/a.ts')).toEqual({ lines: 4, reached: 3 });
    expect(countAt(r, 'src/sim/a.ts', 8, 10)).toEqual({ lines: 1, reached: 0 });
    expect(countAt(r, 'src/sim/a.ts', 3, 3)).toEqual({ lines: 1, reached: 1 });
    // A range that starts no statement is empty, which is not the same as unreached.
    expect(countAt(r, 'src/sim/a.ts', 4, 6)).toEqual({ lines: 0, reached: 0 });
    expect(countAt(r, 'src/sim/missing.ts')).toBeNull();
  });

  it('lists the functions that overlap a range, with their calls', () => {
    const r = reading(ALL);
    expect(functionsAt(r, 'src/sim/a.ts').map((fn) => [fn.name, fn.from, fn.to, fn.calls])).toEqual([
      ['first', 2, 4, 4],
      ['second', 6, 10, 2],
    ]);
    expect(functionsAt(r, 'src/sim/a.ts', 5, 6).map((fn) => fn.name)).toEqual(['second']);
  });

  it('sums by group, leaving out what the grouping leaves out', () => {
    const r = reading(ALL, { [under('src/sim/b.ts')]: A(NONE), [under('tools/x/c.ts')]: A(ALL) });
    const by = countBy(r, (file) => (file.startsWith('src/') ? 'src' : null));
    expect([...by]).toEqual([['src', { lines: 8, reached: 3, files: 2, filesReached: 1 }]]);
  });

  it('takes the union of two readings line by line, function by function and arm by arm', () => {
    const one = reading({ s: [1, 0, 0, 0, 0], f: [1, 0], b: [0, 0] });
    const other = reading({ s: [0, 0, 0, 0, 3], f: [0, 2], b: [0, 5] });
    const both = union([one, other])['src/sim/a.ts']!;
    expect(both.lines).toEqual({ 1: 1, 3: 0, 7: 0, 9: 3 });
    expect(both.functions.map((fn) => fn.calls)).toEqual([1, 2]);
    expect(both.branches).toEqual([[7, [0, 5]]]);
  });
});

describe('what one reading reaches and another does not', () => {
  it('is nothing for a reading against itself', () => {
    expect(lost(reading(ALL), reading(ALL))).toEqual([]);
  });

  it('is nothing when the second reading only runs things more or fewer times', () => {
    expect(lost(reading(ALL), reading({ s: [9, 0, 1, 1, 0], f: [1, 9], b: [1, 0] }))).toEqual([]);
  });

  it('names a line, a function and a branch arm that stopped being run', () => {
    // Line 7 with its arm, and the function around it, are no longer run.
    const after = reading({ s: [1, 0, 4, 0, 0], f: [4, 0], b: [0, 0] });
    expect(lost(reading(ALL), after)).toEqual([{ file: 'src/sim/a.ts', lines: [7], functions: ['second:6'], arms: ['7/0'] }]);
  });

  it('does not report what the second reading gains', () => {
    expect(lost(reading({ s: [1, 0, 0, 0, 0], f: [1, 0], b: [0, 0] }), reading(ALL))).toEqual([]);
  });

  it('names a reached file the second reading does not hold', () => {
    const before = reading(ALL, { [under('src/sim/b.ts')]: A(ALL), [under('src/sim/c.ts')]: A(NONE) });
    // c.ts was never reached, so its absence loses nothing.
    expect(lost(before, reading(ALL)).map((l) => l.file)).toEqual(['src/sim/b.ts']);
  });

  it('refuses two readings of a file whose statements differ, since their lines would not line up', () => {
    const moved = fromIstanbul(
      { [under('src/sim/a.ts')]: { ...A(ALL), statementMap: { 0: at(1), 1: at(3), 2: at(3), 3: at(8), 4: at(9) } } },
      ROOT,
    );
    expect(() => lost(reading(ALL), moved)).toThrow(/differs between the two readings/);
  });
});

describe('the file or range a reading is asked about', () => {
  it('reads a file, a line and a range', () => {
    expect(parseAt('src/run/Run.ts')).toEqual({ file: 'src/run/Run.ts', from: 1, to: Infinity });
    expect(parseAt('src/run/Run.ts:120')).toEqual({ file: 'src/run/Run.ts', from: 120, to: 120 });
    expect(parseAt('src/run/Run.ts:120-140')).toEqual({ file: 'src/run/Run.ts', from: 120, to: 140 });
  });
});

describe('the proofs a reading can be taken of', () => {
  it('reads the fuzz diff’s shapes out of its script, with the vector filled in', () => {
    const shapes = fuzzDiffShapes(readFileSync('scripts/perf-oracle.sh', 'utf8'));
    expect(shapes.map((shape) => shape.name)).toEqual(['scored', 'arm']);
    for (const shape of shapes) {
      expect(shape.flags.some((flag) => flag.startsWith('--count='))).toBe(true);
      expect(shape.flags.some((flag) => /^--strategy=tests\/fuzz\/fixtures\/.+\.json$/.test(flag))).toBe(true);
      expect(shape.flags.join(' ')).not.toContain('$');
    }
  });

  it('fails by name on a script with no vector or no shapes', () => {
    expect(() => fuzzDiffShapes('SHAPE_SCORED="--count=4 $VECTOR"\n')).toThrow(/no VECTOR/);
    expect(() => fuzzDiffShapes('VECTOR="--strategy=x.json"\nSHAPE_EXTRA="${ORACLE_EXTRA_SHAPE:-}"\n')).toThrow(/no SHAPE_/);
  });

  it('names each proof once, and the fuzz diff by the config that holds its file', () => {
    expect(new Set(PROOFS.map((proof) => proof.id)).size).toBe(PROOFS.length);
    expect(PROOFS.find((proof) => proof.id === 'fuzz-diff')!.vitest).toContain('tests/oracle/proofs.vitest.config.ts');
  });
});
