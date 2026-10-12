/**
 * `npm run oracle`: the path-by-path proofs and the comment instruments,
 * from the command line.
 *
 *   npm run oracle -- config-dump <out.json>     every config loader's exports (configDump.ts)
 *   npm run oracle -- json-diff <before> <after>  two JSON files, or two folders of them, path by path (jsonDiff.ts)
 *   npm run oracle -- comment-strip <ref> [root…] the working tree against a ref with the comments out (strippedCompare.ts)
 *   npm run oracle -- comment-codes [--record|--list]  the step codes in comments, by folder (stepCodes.ts)
 *   npm run oracle -- comment-length [root…]      how much of the code is comment, by folder (comments.ts)
 *
 * `json-diff` prints the differences counted by kind and path shape, then the
 * first of them in full, and exits 1 when there is any. For a change that is
 * meant to differ somewhere (a field dropped from the save), read the shapes:
 * the proof is that nothing else is in the list.
 *
 * `comment-strip` exits 1 when any file's code differs from the ref's, and 0
 * when the files that changed did so in their comments only. Roots default
 * to `src`.
 *
 * `comment-codes --record` writes the ceiling the count is held to
 * (tests/comment-codes-baseline.json). It refuses when the total would rise.
 * `--list` prints every code with its file and line.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isHeldComment, measure, splitSource, type Lengths } from './comments';
import { dumpConfig } from './configDump';
import { describeDifference, jsonDiff, summarize, type JsonDifference } from './jsonDiff';
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
  stepCodes,
  total,
  writeCeiling,
} from './stepCodes';
import { compareStripped, readRef, readWorkingTree } from './strippedCompare';

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((arg) => arg.startsWith('--')));
const [a, b] = rest.filter((arg) => !arg.startsWith('--'));
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
  const result = compareStripped(readRef(ref, roots), readWorkingTree(roots));
  console.log(`oracle: ${result.compared} files under ${roots.join(', ')} held against ${ref}; ${result.changed.length} differ in their text`);
  if (result.differences.length === 0) {
    if (result.changed.length > 0) console.log('oracle: comments only. The code of every changed file is piece for piece what it was.');
    return 0;
  }
  console.log(`oracle: ${result.differences.length} of them differ in more than comments:`);
  for (const d of result.differences) console.log(`  ${d.file}: ${d.what === 'code' ? '' : `${d.what}, `}${d.detail}`);
  return 1;
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
  console.log(`oracle: ${codes.length} step codes in the comments of ${Object.keys(live).length} files under ${COUNTED_ROOTS.join(', ')}`);
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
      if (!isHeldComment(piece) && /^['"`]|^\}[^]*(?:\$\{|`)$/.test(piece.text)) inStrings += stepCodes(piece.text).length;
    }
  }
  console.log(
    `oracle: not counted: ${named} rounds and clusters named in comments; ${sections} "§" before a document's section; ${inStrings} codes inside strings (a test's title is one)`,
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
  for (const file of listSources(REPO_ROOT, roots)) {
    const text = readFileSync(join(REPO_ROOT, file), 'utf8');
    const split = splitSource(file, text);
    if (split === null) continue;
    const l = measure(text, split);
    perFile.push({ file, l });
    for (const key of [folderOf(file), 'all']) add(`${isTest(file) ? 'tests' : 'source'}\t${key}`, l);
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
  if (command === 'comment-codes') return commentCodes();
  if (command === 'comment-length') return commentLength(roots.length > 0 ? roots : ['src']);
  console.error(
    'usage: npm run oracle -- config-dump <out.json> | json-diff <before> <after> | comment-strip <ref> [root…] | comment-codes [--record|--list] | comment-length [root…]',
  );
  return 2;
}

void main().then((code) => process.exit(code));
