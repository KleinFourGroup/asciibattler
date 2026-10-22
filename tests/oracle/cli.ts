/**
 * `npm run oracle`: the path-by-path proofs and the comment instruments,
 * from the command line.
 *
 *   npm run oracle -- config-dump <out.json>     every config loader's exports (configDump.ts)
 *   npm run oracle -- json-diff <before> <after>  two JSON files, or two folders of them, path by path (jsonDiff.ts)
 *   npm run oracle -- comment-strip <ref> [root…] the working tree against a ref with the comments out (strippedCompare.ts)
 *   npm run oracle -- css-compare <ref> [sheet…]  the working tree's stylesheets against a ref's, page by page, by their cascade (cssCompare.ts)
 *   npm run oracle -- comment-codes [--record|--list]  the step codes in comments and test titles, by folder (stepCodes.ts)
 *   npm run oracle -- comment-length [path…]      how much of the code is comment, by folder; a path is a file or a folder, anywhere (comments.ts)
 *   npm run oracle -- reach-record [proof…]       run the behaviour proofs under the coverage tool (reach.ts)
 *   npm run oracle -- reach [folder…]             the lines each proof reaches, by folder
 *   npm run oracle -- reach --at=<file>[:<a>[-<b>]]  one file or a range of its lines, proof by proof
 *   npm run oracle -- reach-diff <before> <after>  what the first reading reaches and the second does not, or of
 *                                  [--from=<ref>]  two folders, each proof both hold (the first of ref, the second
 *                                                  of the working tree)
 *   npm run oracle -- build-hash [ref] [--dev]    the working tree's build against the ref's, file by file (buildHash.ts)
 *   npm run oracle -- plant --at=<file>:<line>    one mechanical edit at a line, and the proofs run against it (plant.ts)
 *   npm run oracle -- refs <file>[:<name>]        who reads each export of a file, by kind of reader (refs.ts)
 *   npm run oracle -- refs --all=<out.json> [folder…]  every export and schema key under src, with where each stands
 *
 * `json-diff` prints the differences counted by kind and path shape, then the
 * first of them in full, and exits 1 when there is any. For a change that is
 * meant to differ somewhere (a field dropped from the save), read the shapes:
 * the proof is that nothing else is in the list.
 *
 * `comment-strip` exits 1 when any file's code differs from the ref's, and 0
 * when the files that changed did so in their comments, or a test title's
 * words, only. A file that changed a comment a tool reads (`TOOL_READ`) is
 * named apart, with those comments before and after, once its code with
 * every comment out is shown to be the same; the run still exits 1, since a
 * tool reads the change. Each of those is
 * compared again with one code edit made in memory, and the run exits 1 too
 * when the compare misses one, so every run carries its failing control.
 * Roots default to `src`.
 *
 * `css-compare` reads each page from its entry sheet (default: every
 * `tools/<page>/editor.css` in either tree) with the sheets it imports, and
 * exits 1 when a page's declarations in effect differ or two of them changed
 * order where order decides; `--list` prints every difference. Each page
 * that passed is compared again with one rule appended in memory, and the
 * run exits 1 too when the compare misses it.
 *
 * `comment-codes --record` writes the ceiling the count is held to
 * (tests/comment-codes-baseline.json). It refuses when the total would rise.
 * `--list` prints every code with its file and line.
 *
 * `reach-record` takes `--tree=<dir>` (a worktree to run in; default this
 * one) and `--dir=<dir>` (where the readings go; default output/reach), and
 * with no proof named it records them all. `reach` and `reach-diff` read
 * what it wrote; `reach --proofs=<id,id>` reads only those, and its last
 * column, `any`, is then what those reach between them. `reach-diff` exits
 * 1 when anything is lost. Each of these and `plant` takes the whole suite
 * as `npm-test` or `suite`.
 *
 * `build-hash` exits 1 when the two builds differ, and names the built files
 * that do. The ref defaults to HEAD. `--dev` compares the development-mode
 * builds, the only ones that hold the code under `src/dev`.
 *
 * `plant` makes one edit at the line (plant.ts lists the kinds) in a worktree
 * of `--ref=<ref>` (default HEAD) under output/plant/, runs the proofs named
 * by `--proofs=<id,id>` (corpus, suite, smoke, fuzz-diff; default
 * corpus,suite), puts the file back and removes the worktree. Each proof runs
 * on the clean worktree first. It exits 0 when every proof caught the edit
 * and 1 when one did not, so a proof's failing control is one command. `--list` prints the edits the line admits at
 * the ref and plants nothing; `--op=<kind>` and `--nth=<n>` choose among them (default
 * the first).
 *
 * `refs <file>` prints each export the file declares with its reads by kind
 * of reader and where it stands (unread, own-only, test-only, used); `--keys`
 * asks the same of the file's zod schema keys and `--members=<Type>` of an
 * interface's members. `:<name>` keeps the names that end with it, and
 * `--list` prints every reference. `--all=<out.json>` writes every export and
 * schema key of the source files under the folders (default src) with their
 * references, and prints the counts by folder; it exits 0 whatever it finds.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareBuildWith } from './buildHash';
import { isHeldComment, measure, splitSource, type Lengths } from './comments';
import { dumpConfig } from './configDump';
import { compareSheets, controlCss, describeCss } from './cssCompare';
import { describeDifference, jsonDiff, summarize, type JsonDifference } from './jsonDiff';
import { applyEdit, describeEdit, editsOn, type Edit } from './plant';
import { PLANT_PROOFS, dropTree, makeTree, recordClean, treeStatus, withPlant, type PlantProof } from './plantProofs';
import {
  CEILING_PATH,
  COUNTED_ROOTS,
  REPO_ROOT,
  STEP_CODE_KINDS,
  ceilingDrift,
  ceilingOf,
  listSources,
  readCeiling,
  scanStepCodes,
  sourcesAt,
  stepCodes,
  total,
  writeCeiling,
} from './stepCodes';
import { PROOFS, READING_DIR, countAt, countBy, functionsAt, lineMap, loadReading, loadReadings, lost, parseAt, proofId, readingPath, record, union, type LineMap, type Reading } from './reach';
import { READER_KINDS, computedReads, count, exportsOf, membersOf, openProject, schemaKeys, standing, type Named } from './refs';
import { compareStripped, controlStripped, readRef, readWorkingTree } from './strippedCompare';

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((arg) => arg.startsWith('--')));
const [a, b] = rest.filter((arg) => !arg.startsWith('--'));
const option = (name: string): string | undefined => rest.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));

/** `src/sim/actions/x.ts` → `src/sim`; a file directly under its root → the root. */
const folderOf = (file: string): string => file.split('/').slice(0, -1).slice(0, 2).join('/');
const isTest = (file: string): boolean => file.endsWith('.test.ts');

function table(head: string[], rows: (string | number)[][]): void {
  const cells = [head, ...rows.map((row) => row.map(String))];
  const widths = head.map((_, col) => Math.max(...cells.map((row) => row[col]!.length)));
  for (const row of cells) console.log(`  ${row.map((cell, col) => (col === 0 ? cell.padEnd(widths[col]!) : cell.padStart(widths[col]!))).join('  ')}`);
}

function commentStrip(ref: string, roots: string[]): number {
  const [before, after] = [readRef(ref, roots), readWorkingTree(roots)];
  const result = compareStripped(before, after);
  const controls = controlStripped(before, after, result);
  const missed = controls.filter((c) => !c.caught);
  console.log(`oracle: ${result.compared} files under ${roots.join(', ')} held against ${ref}; ${result.changed.length} differ in their text`);
  if (controls.length > 0) {
    console.log(`oracle: the control, one code edit made in memory in each of the ${controls.length} that changed in comments only; the compare named ${controls.length - missed.length}:`);
    for (const c of controls) console.log(`  ${c.caught ? 'named ' : 'MISSED'}  ${c.file}: ${c.planted}`);
  }
  if (missed.length > 0) console.log(`oracle: the compare cannot see the code of ${missed.length}, so its pass there shows nothing`);
  if (result.differences.length === 0) {
    if (result.changed.length > 0 && missed.length === 0) console.log('oracle: comments only. The code of every changed file is piece for piece what it was.');
    return missed.length === 0 ? 0 : 1;
  }
  const held = result.differences.filter((d) => d.what === 'held');
  const other = result.differences.filter((d) => d.what !== 'held');
  if (held.length > 0) {
    console.log(`oracle: ${held.length} changed a comment a tool reads; with every comment out, those too, the code is piece for piece what it was. A tool reads each one below, so it is a change to read:`);
    for (const d of held) console.log(`  ${d.file}: ${d.detail}`);
  }
  if (other.length > 0) {
    console.log(`oracle: ${other.length} of them differ in more than comments:`);
    for (const d of other) console.log(`  ${d.file}: ${d.what === 'code' ? '' : `${d.what}, `}${d.detail}`);
  }
  return 1;
}

function cssCompare(ref: string, sheets: string[]): number {
  const roots = sheets.length > 0 ? [...new Set(sheets.map((sheet) => sheet.split('/')[0]!))] : ['tools'];
  const [before, after] = [readRef(ref, roots), readWorkingTree(roots)];
  const editorSheet = /^tools\/[^/]+\/editor\.css$/;
  const pages = sheets.length > 0 ? sheets : [...new Set([...before.keys(), ...after.keys()])].filter((path) => editorSheet.test(path)).sort();
  const result = compareSheets(before, after, pages);
  const controls = controlCss(before, after, result);
  const missed = controls.filter((c) => !c.caught);
  const shown = flags.has('--list') ? Infinity : 40;
  console.log(`oracle: ${pages.length} pages held against ${ref} by their cascade; ${new Set(result.differences.map((d) => d.page)).size} differ`);
  for (const page of pages) {
    const found = result.differences.filter((d) => d.page === page);
    if (found.length === 0) continue;
    console.log(`  ${page}: ${found.length}`);
    for (const d of found.slice(0, shown)) console.log(`    ${describeCss(d)}`);
    if (found.length > shown) console.log(`    and ${found.length - shown} more (--list prints them all)`);
  }
  console.log(`oracle: the control, one rule appended in memory to each of the ${controls.length} that passed; the compare named ${controls.length - missed.length}`);
  for (const c of missed) console.log(`  MISSED  ${c.page}`);
  return result.differences.length === 0 && missed.length === 0 ? 0 : 1;
}

function commentCodes(): number {
  const codes = scanStepCodes();
  const live = ceilingOf(codes);
  if (flags.has('--list')) {
    for (const c of codes) console.log(`${c.file}:${c.line}  ${c.kind}  ${c.code}`);
  }

  const folders = [...new Set(codes.map((c) => folderOf(c.file)))].sort();
  const row = (name: string, of: typeof codes): (string | number)[] => [
    name,
    new Set(of.map((c) => c.file)).size,
    of.length,
    ...STEP_CODE_KINDS.map((kind) => of.filter((c) => c.kind === kind).length),
    of.filter((c) => isTest(c.file)).length,
  ];
  console.log(`oracle: ${codes.length} step codes in the comments and test titles of ${Object.keys(live).length} files under ${COUNTED_ROOTS.join(', ')}`);
  table(
    ['folder', 'files', 'codes', ...STEP_CODE_KINDS, 'in tests'],
    [...folders.map((folder) => row(folder, codes.filter((c) => folderOf(c.file) === folder))), row('all', codes)],
  );

  // What the rule leaves out on purpose, so that its size is known.
  let named = 0;
  let sections = 0;
  let inStrings = 0;
  for (const file of listSources(REPO_ROOT, COUNTED_ROOTS)) {
    const split = splitSource(file, readFileSync(join(REPO_ROOT, file), 'utf8'));
    if (split === null) continue;
    for (const comment of split.comments) {
      named += comment.text.match(/\b(?:Round|Cluster)[ -]\d/g)?.length ?? 0;
      sections += (comment.text.match(/§/g)?.length ?? 0) - stepCodes(comment.text).filter((c) => c.kind === 'mark').length;
    }
    for (const piece of split.code) {
      if (!isHeldComment(piece) && piece.title !== true && /^['"`]|^\}[^]*(?:\$\{|`)$/.test(piece.text)) inStrings += stepCodes(piece.text).length;
    }
  }
  console.log(
    `oracle: not counted: ${named} rounds and clusters named in comments; ${sections} "§" before a document's section; ${inStrings} codes inside strings that are not a test's title`,
  );

  if (!existsSync(join(REPO_ROOT, CEILING_PATH))) {
    if (!flags.has('--record')) {
      console.log(`oracle: no ceiling yet. Write it with --record.`);
      return 1;
    }
    writeCeiling(live);
    console.log(`oracle: ${CEILING_PATH} written: ${total(live)} codes in ${Object.keys(live).length} files`);
    return 0;
  }
  const ceiling = readCeiling();
  const drift = ceilingDrift(live, ceiling);
  for (const f of drift.over) console.log(`  OVER  ${f.file}: ${f.now}, ceiling ${f.ceiling}`);
  for (const f of drift.under) console.log(`  under ${f.file}: ${f.now}, ceiling ${f.ceiling}`);
  console.log(`oracle: the ceiling is ${total(ceiling)}; ${drift.over.length} files over it, ${drift.under.length} under`);
  if (!flags.has('--record')) return drift.over.length + drift.under.length === 0 ? 0 : 1;
  if (total(live) > total(ceiling)) {
    console.log(`oracle: NOT written. The total would rise from ${total(ceiling)} to ${total(live)}, and the count may only fall.`);
    return 1;
  }
  if (drift.over.length > 0) {
    console.log('oracle: the files marked OVER rose while the total did not. A comment moved between files is the one good reason; say so in the commit.');
  }
  writeCeiling(live);
  console.log(`oracle: ${CEILING_PATH} written: ${total(live)} codes in ${Object.keys(live).length} files (was ${total(ceiling)})`);
  return 0;
}

function commentLength(roots: string[]): number {
  const sums = new Map<string, Lengths & { files: number }>();
  const add = (key: string, l: Lengths): void => {
    const s = sums.get(key) ?? { files: 0, code: 0, comment: 0, blank: 0, words: 0 };
    sums.set(key, { files: s.files + 1, code: s.code + l.code, comment: s.comment + l.comment, blank: s.blank + l.blank, words: s.words + l.words });
  };
  const perFile: { file: string; l: Lengths }[] = [];
  for (const { file, path, group } of sourcesAt(roots)) {
    const text = readFileSync(path, 'utf8');
    const split = splitSource(file, text);
    if (split === null) continue;
    const l = measure(text, split);
    perFile.push({ file, l });
    for (const key of [group, 'all']) add(`${isTest(file) ? 'tests' : 'source'}\t${key}`, l);
  }
  const head = ['folder', 'files', 'code lines', 'comment lines', 'comment words', 'words per code line'];
  for (const part of ['source', 'tests']) {
    console.log(`oracle: comment length under ${roots.join(', ')}, ${part === 'tests' ? 'the *.test.ts files' : 'everything but the tests'}:`);
    const keys = [...sums.keys()].filter((key) => key.startsWith(`${part}\t`)).sort((x, y) => Number(x.endsWith('\tall')) - Number(y.endsWith('\tall')) || (x < y ? -1 : 1));
    table(
      head,
      keys.map((key) => {
        const s = sums.get(key)!;
        return [key.split('\t')[1]!, s.files, s.code, s.comment, s.words, s.code === 0 ? '-' : (s.words / s.code).toFixed(2)];
      }),
    );
  }
  console.log('oracle: the ten files with the most comment words:');
  table(
    ['file', 'code lines', 'comment lines', 'comment words', 'words per code line'],
    perFile
      .sort((x, y) => y.l.words - x.l.words)
      .slice(0, 10)
      .map(({ file, l }) => [file, l.code, l.comment, l.words, l.code === 0 ? '-' : (l.words / l.code).toFixed(2)]),
  );
  return 0;
}

const percent = (part: number, whole: number): string => (whole === 0 ? '-' : `${((100 * part) / whole).toFixed(1)}%`);
const PROOF_IDS = PROOFS.map((proof) => proof.id);

function reachRecord(names: string[]): number {
  const ids = names.map((name) => proofId(name, PROOF_IDS) ?? name);
  const proofs = ids.length === 0 ? PROOFS : PROOFS.filter((proof) => ids.includes(proof.id));
  const unknown = ids.filter((id) => !PROOF_IDS.includes(id));
  if (unknown.length > 0) {
    console.error(`oracle: no proof named ${unknown.join(', ')}. The proofs: ${PROOFS.map((proof) => proof.id).join(', ')}`);
    return 2;
  }
  const dir = option('dir') ?? READING_DIR;
  let failed = 0;
  for (const proof of proofs) {
    const start = Date.now();
    const code = record(proof, option('tree') ?? '.', dir);
    if (code !== 0) failed++;
    const how = code === 0 ? 'passed' : `FAILED (exit ${code})`;
    console.log(`oracle: ${proof.id} ${how} in ${Math.round((Date.now() - start) / 1000)} s → ${readingPath(proof.id, dir)}`);
  }
  return failed === 0 ? 0 : 1;
}

function reach(folders: string[]): number {
  const only = option('proofs')?.split(',').map((name) => proofId(name, PROOF_IDS) ?? name);
  const readings = new Map([...loadReadings(option('dir') ?? READING_DIR)].filter(([id]) => only === undefined || only.includes(id)));
  if (readings.size === 0) {
    console.error('oracle: no reading on disk. Take them with: npm run oracle -- reach-record');
    return 2;
  }
  const columns = [...readings, ['any', union([...readings.values()])] as const];

  const at = option('at');
  if (at !== undefined) {
    const { file, from, to } = parseAt(at);
    const range = to === Infinity ? (from === 1 ? '' : ` from line ${from}`) : from === to ? ` line ${from}` : ` lines ${from} to ${to}`;
    if (columns.every(([, reading]) => reading[file] === undefined)) {
      console.error(`oracle: no reading holds ${file}. A reading holds the TypeScript under src, tests, tools and scripts, less the tests.`);
      return 2;
    }
    console.log(`oracle: ${file}${range}, the lines that start a statement and how many each proof ran:`);
    table(
      ['proof', 'lines', 'reached', ''],
      columns.map(([id, reading]) => {
        const count = countAt(reading, file, from, to) ?? { lines: 0, reached: 0 };
        return [id, count.lines, count.reached, percent(count.reached, count.lines)];
      }),
    );
    const functions = functionsAt(columns.at(-1)![1], file, from, to);
    console.log(`oracle: ${functions.length} functions overlap it; calls by proof${functions.length > 30 ? ' (the first 30)' : ''}:`);
    table(
      ['function', 'lines', ...readings.keys()],
      functions.slice(0, 30).map((fn, i) => [
        fn.name,
        `${fn.from}-${fn.to}`,
        ...[...readings.values()].map((reading) => functionsAt(reading, file, from, to)[i]?.calls ?? '-'),
      ]),
    );
    return 0;
  }

  const wanted = (file: string): string | null => {
    const folder = folderOf(file);
    return folders.length === 0 || folders.some((f) => folder === f || file.startsWith(`${f}/`)) ? folder : null;
  };
  const totals = countBy(columns.at(-1)![1], wanted);
  const perProof = columns.map(([, reading]) => countBy(reading, wanted));
  console.log('oracle: the share of each folder’s lines (those that start a statement) that each proof ran:');
  const row = (name: string, files: number, lines: number, reached: number[]): (string | number)[] => [
    name,
    files,
    lines,
    ...reached.map((n) => percent(n, lines)),
  ];
  const sum = (counts: Iterable<{ lines: number; reached: number; files: number }>, pick: 'lines' | 'reached' | 'files'): number =>
    [...counts].reduce((n, c) => n + c[pick], 0);
  table(
    ['folder', 'files', 'lines', ...columns.map(([id]) => id)],
    [
      ...[...totals.keys()].sort().map((folder) =>
        row(
          folder,
          totals.get(folder)!.files,
          totals.get(folder)!.lines,
          perProof.map((by) => by.get(folder)?.reached ?? 0),
        ),
      ),
      row(
        'all',
        sum(totals.values(), 'files'),
        sum(totals.values(), 'lines'),
        perProof.map((by) => sum(by.values(), 'reached')),
      ),
    ],
  );
  return 0;
}

/** Each file the working tree changed since `ref`, with its line map (one `git diff -U0`). */
function lineMapsSince(ref: string): Map<string, LineMap> {
  const diff = execFileSync('git', ['diff', '-U0', '--no-renames', '--no-color', '--no-ext-diff', ref, '--'], {
    encoding: 'utf8',
    maxBuffer: 1 << 30,
  });
  const maps = new Map<string, LineMap>();
  for (const part of diff.split(/^diff --git /m).slice(1)) {
    // A deleted file's new side is /dev/null, so its name is on the old side.
    const file = /^\+\+\+ b\/(.+)$/m.exec(part)?.[1] ?? /^--- a\/(.+)$/m.exec(part)?.[1];
    if (file !== undefined) maps.set(file, lineMap(part));
  }
  return maps;
}

function reachDiff(before: string, after: string): number {
  // `--from=<ref>`: the first reading is of `ref` and the second of the working
  // tree, so a file changed between them is compared through its diff.
  const from = option('from');
  const maps = from === undefined ? new Map<string, LineMap>() : lineMapsSince(from);
  if (from !== undefined) console.log(`oracle: ${maps.size} files changed since ${from}, compared through their diffs`);
  const folders = [before, after].map((path) => existsSync(path) && statSync(path).isDirectory());
  if (folders[0] !== folders[1]) {
    console.error('oracle: reach-diff takes two readings, or two folders of them, not one of each');
    return 2;
  }
  if (!folders[0]) return reportLost(loadReading(before), loadReading(after), maps);

  // Two folders: each proof whose reading both hold, one by one.
  const shared = PROOF_IDS.filter((id) => existsSync(readingPath(id, before)) && existsSync(readingPath(id, after)));
  for (const id of PROOF_IDS) {
    const [inBefore, inAfter] = [before, after].map((dir) => existsSync(readingPath(id, dir)));
    if (inBefore !== inAfter) console.log(`oracle: only ${inBefore ? before : after} holds a reading of ${id}, so it is not compared`);
  }
  if (shared.length === 0) {
    console.error(`oracle: ${before} and ${after} hold no reading of the same proof`);
    return 2;
  }
  let failed = 0;
  for (const id of shared) {
    console.log(`oracle: ${id}, ${readingPath(id, before)} against ${readingPath(id, after)}`);
    failed += reportLost(loadReading(readingPath(id, before)), loadReading(readingPath(id, after)), maps);
  }
  return failed === 0 ? 0 : 1;
}

function reportLost(before: Reading, after: Reading, maps: Map<string, LineMap>): number {
  const found = lost(before, after, maps);
  if (found.length === 0) {
    console.log('oracle: nothing lost. The second reading runs every line, function and branch arm the first ran.');
    return 0;
  }
  const sum = (pick: (l: (typeof found)[number]) => number): number => found.reduce((n, l) => n + pick(l), 0);
  console.log(
    `oracle: the second reading no longer reaches ${sum((l) => l.lines.length)} lines, ${sum((l) => l.functions.length)} functions and ${sum((l) => l.arms.length)} branch arms in ${found.length} files:`,
  );
  const some = (items: readonly (string | number)[], most: number): string =>
    items.slice(0, most).join(', ') + (items.length > most ? `, … (${items.length})` : '');
  for (const l of found.slice(0, 40)) {
    const parts = [
      l.lines.length > 0 ? `lines ${some(l.lines, 12)}` : '',
      l.functions.length > 0 ? `functions ${some(l.functions, 6)}` : '',
      l.arms.length > 0 ? `branch arms (line/arm) ${some(l.arms, 6)}` : '',
    ].filter((part) => part !== '');
    console.log(`  ${l.file}: ${parts.join('; ')}`);
  }
  if (found.length > 40) console.log(`  … and ${found.length - 40} more files`);
  return 1;
}

function buildHash(ref: string): number {
  const dev = flags.has('--dev');
  const result = compareBuildWith(ref, dev);
  console.log(`oracle: the working tree's ${dev ? 'development-mode ' : ''}build against ${ref}'s, ${result.files} files, the build's ID pinned`);
  console.log(`  ${ref}: ${result.before}`);
  console.log(`  here: ${result.after}`);
  if (result.changed.length === 0) {
    console.log(`oracle: the same bytes. ${dev ? 'The two development-mode builds are one build.' : 'The two trees ship the same game.'}`);
    return 0;
  }
  console.log(`oracle: ${result.changed.length} built files differ:`);
  for (const name of result.changed) console.log(`  ${name}`);
  return 1;
}

async function plant(): Promise<number> {
  const at = option('at');
  if (at === undefined || !/:\d+$/.test(at)) {
    console.error('oracle: plant needs --at=<file>:<line>');
    return 2;
  }
  const { file, from: line } = parseAt(at);
  const kind = option('op');
  const choose = (source: string): Edit[] => editsOn(file, source, line).filter((edit) => kind === undefined || edit.operator === kind);
  const ref = option('ref') ?? 'HEAD';
  if (flags.has('--list')) {
    // The ref's copy, which is what a plant edits; the working tree's lines may differ.
    const found = choose(execFileSync('git', ['show', `${ref}:${file}`], { cwd: REPO_ROOT, encoding: 'utf8' }));
    console.log(`oracle: ${file}:${line} at ${ref} admits ${found.length} edits${kind === undefined ? '' : ` of kind ${kind}`}`);
    found.forEach((edit, i) => console.log(`  ${i}  ${describeEdit(edit)}`));
    return found.length > 0 ? 0 : 1;
  }
  const proofs = (option('proofs') ?? 'corpus,suite').split(',').map((name) => proofId(name, PLANT_PROOFS) ?? name) as PlantProof[];
  const unknown = proofs.filter((proof) => !PLANT_PROOFS.includes(proof));
  if (unknown.length > 0) {
    console.error(`oracle: no proof named ${unknown.join(', ')}. A plant's proofs: ${PLANT_PROOFS.join(', ')}`);
    return 2;
  }
  const tree = makeTree('tree', ref);
  try {
    const before = treeStatus(tree);
    const source = readFileSync(join(tree, file), 'utf8');
    const edit = choose(source)[Number(option('nth') ?? 0)];
    if (edit === undefined) {
      console.error(`oracle: ${file}:${line} at ${ref} admits no such edit (--list prints them)`);
      return 2;
    }
    for (const clean of await recordClean(tree, proofs)) console.log(`oracle: nothing planted, ${clean}`);
    console.log(`oracle: planted in a worktree of ${ref}: ${file}:${line}  ${describeEdit(edit)}`);
    const verdicts = await withPlant(tree, file, applyEdit(source, edit), proofs);
    let missed = 0;
    for (const proof of proofs) {
      const verdict = verdicts[proof]!;
      if (!verdict.caught) missed++;
      console.log(`  ${proof.padEnd(9)}  ${verdict.caught ? 'CAUGHT    ' : 'not caught'}  ${verdict.detail} (${verdict.seconds} s)`);
      for (const name of verdict.failed.slice(0, 8)) console.log(`             ${name}`);
      if (verdict.failed.length > 8) console.log(`             … and ${verdict.failed.length - 8} more`);
    }
    if (treeStatus(tree) !== before) throw new Error('plant: the worktree was not left as it was');
    console.log(
      missed === 0
        ? 'oracle: every proof named caught the edit.'
        : `oracle: ${missed} of ${proofs.length} proofs did not notice the edit. Read the line: dead code, a hole in the proof, or an edit of no effect.`,
    );
    return missed === 0 ? 0 : 1;
  } finally {
    dropTree('tree');
  }
}

const STANDINGS = ['unread', 'own-only', 'test-only', 'used'] as const;

function refs(): number {
  const started = Date.now();
  const all = option('all');
  if (all !== undefined) {
    const roots = rest.filter((arg) => !arg.startsWith('--'));
    const files = listSources(REPO_ROOT, roots.length > 0 ? roots : ['src']).filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts') && !isTest(file));
    const project = openProject();
    const rows: (Named & { standing: string })[] = [];
    for (const file of files) for (const item of [...exportsOf(project, file), ...schemaKeys(project, file)]) rows.push({ ...item, standing: standing(item) });
    const computed = computedReads(project, files);
    writeFileSync(all, `${JSON.stringify({ names: rows, computedReads: computed }, null, 1)}\n`);
    for (const [title, pick] of [['exports', (r: Named) => r.what !== 'key'], ['schema keys', (r: Named) => r.what === 'key']] as const) {
      const of = rows.filter(pick);
      console.log(`oracle: ${of.length} ${title} in ${new Set(of.map((r) => r.file)).size} files, by where each stands:`);
      const folders = [...new Set(of.map((r) => folderOf(r.file)))].sort();
      const line = (name: string, list: typeof of): (string | number)[] => [name, list.length, ...STANDINGS.map((s) => list.filter((r) => r.standing === s).length)];
      table(['folder', 'names', ...STANDINGS], [...folders.map((folder) => line(folder, of.filter((r) => folderOf(r.file) === folder))), line('all', of)]);
    }
    console.log(`oracle: ${computed.length} reads by a computed key in ${new Set(computed.map((c) => c.file)).size} files, which no name above is credited with`);
    console.log(`oracle: ${files.length} files in ${Math.round((Date.now() - started) / 1000)} s → ${all}`);
    return 0;
  }
  if (a === undefined) {
    console.error('oracle: refs needs a file, or --all=<out.json>');
    return 2;
  }
  const cut = a.lastIndexOf(':');
  const [file, wanted] = cut > 0 ? [a.slice(0, cut), a.slice(cut + 1)] : [a, undefined];
  const project = openProject();
  const members = option('members');
  const found = (members !== undefined ? membersOf(project, file, members) : flags.has('--keys') ? schemaKeys(project, file) : exportsOf(project, file)).filter(
    (item) => wanted === undefined || item.name === wanted || item.name.endsWith(`.${wanted}`),
  );
  if (found.length === 0) {
    console.error(`oracle: ${file} declares no such name${wanted === undefined ? '' : ` ending in ${wanted}`}`);
    return 2;
  }
  console.log(`oracle: ${found.length} names in ${file}, their reads by kind of reader:`);
  table(
    ['name', 'line', 'stands', ...READER_KINDS, 'writes', 'passes'],
    found.map((item) => [item.name, item.line, standing(item), ...READER_KINDS.map((kind) => count(item, kind, 'read')), count(item, 'any', 'write'), count(item, 'any', 'pass')]),
  );
  if (flags.has('--list')) {
    for (const item of found) {
      console.log(`oracle: ${item.name} (${item.file}:${item.line}), ${item.references.length} references:`);
      for (const ref of item.references) console.log(`  ${ref.file}:${ref.line}  ${ref.kind} ${ref.use}`);
    }
  }
  return 0;
}

async function main(): Promise<number> {
  if (command === 'config-dump' && a !== undefined) {
    const dump = await dumpConfig();
    writeFileSync(a, `${JSON.stringify(dump, null, 1)}\n`);
    console.log(`oracle: ${Object.keys(dump).length} exports from the modules under src/config → ${a}`);
    return 0;
  }
  if (command === 'json-diff' && a !== undefined && b !== undefined) {
    // Paths are kept relative to each file, so one field dropped from thirty
    // snapshots is one shape; `file` says where each difference was found.
    const found: { file: string; d: JsonDifference }[] = [];
    if (statSync(a).isDirectory()) {
      const names = new Set([...readdirSync(a), ...readdirSync(b)].filter((name) => name.endsWith('.json')));
      for (const name of [...names].sort()) {
        const [inA, inB] = [existsSync(join(a, name)), existsSync(join(b, name))];
        if (!inA) found.push({ file: name, d: { kind: 'added', path: '', after: '(the file)' } });
        else if (!inB) found.push({ file: name, d: { kind: 'removed', path: '', before: '(the file)' } });
        else for (const d of jsonDiff(read(join(a, name)), read(join(b, name)))) found.push({ file: name, d });
      }
      const differing = new Set(found.map((f) => f.file)).size;
      console.log(`oracle: ${names.size} files compared, ${differing} of them differ`);
    } else {
      for (const d of jsonDiff(read(a), read(b))) found.push({ file: '', d });
    }
    if (found.length === 0) {
      console.log('oracle: no difference');
      return 0;
    }
    console.log(`oracle: ${found.length} differences, by kind and path shape:`);
    for (const line of summarize(found.map((f) => f.d))) console.log(`  ${line}`);
    console.log('oracle: the first of them:');
    for (const { file, d } of found.slice(0, 12)) console.log(`  ${file === '' ? '' : `${file}: `}${describeDifference(d)}`);
    return 1;
  }
  const roots = rest.filter((arg) => !arg.startsWith('--'));
  if (command === 'comment-strip' && a !== undefined) return commentStrip(a, roots.length > 1 ? roots.slice(1) : ['src']);
  if (command === 'css-compare' && a !== undefined) return cssCompare(a, roots.slice(1));
  if (command === 'comment-codes') return commentCodes();
  if (command === 'comment-length') return commentLength(roots.length > 0 ? roots : ['src']);
  if (command === 'build-hash') return buildHash(a ?? 'HEAD');
  if (command === 'plant') return plant();
  if (command === 'refs') return refs();
  if (command === 'reach-record') return reachRecord(roots);
  if (command === 'reach') return reach(roots);
  if (command === 'reach-diff' && a !== undefined && b !== undefined) return reachDiff(a, b);
  console.error(
    'usage: npm run oracle -- config-dump <out.json> | json-diff <before> <after> | comment-strip <ref> [root…] | css-compare <ref> [sheet…] [--list] | comment-codes [--record|--list] | comment-length [path…] | reach-record [proof…] | reach [folder…] [--at=<file>[:<a>[-<b>]]] | reach-diff <before> <after> [--from=<ref>] | build-hash [ref] [--dev] | plant --at=<file>:<line> [--op=<kind>] [--nth=<n>] [--proofs=<id,id>] [--ref=<ref>] [--list] | refs <file>[:<name>] [--keys|--members=<Type>] [--list] | refs --all=<out.json> [folder…]',
  );
  return 2;
}

void main().then((code) => process.exit(code));
