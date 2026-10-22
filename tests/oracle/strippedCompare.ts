/**
 * Two trees compared with their comments out: the proof for a change that is
 * meant to touch comments and nothing else.
 *
 * Each file is split into comments and code pieces (comments.ts), and the
 * pieces are held equal, in order. A file whose text changed and whose
 * pieces did not has changed in its comments only. The first piece that
 * differs is reported with its line on each side. A test's title is held
 * with its words masked on both sides, so a reworded title passes with the
 * comments; its quotes, its substitutions and the call it names are held as
 * code.
 *
 * The usual run holds the working tree against a ref, before the commit:
 * `npm run oracle -- comment-strip HEAD`. A file of a kind comments.ts does
 * not read (Markdown, JSON) is held byte for byte, and a file added or
 * removed is a difference.
 *
 * Every run carries its own failing control (`controlStripped`): each file
 * that passed as a comment edit is compared again with one code edit made
 * in its text in memory, and must be named.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitSource, type CodePiece } from './comments';
import { applyEdit, describeEdit, edits } from './plant';
import { REPO_ROOT } from './stepCodes';

/** path (repo-relative, forward slashes) → the file's text. */
export type Tree = ReadonlyMap<string, string>;

const MAX_BUFFER = 1 << 30;
const git = (args: string[], repoRoot: string, input?: string): Buffer =>
  execFileSync('git', args, { cwd: repoRoot, maxBuffer: MAX_BUFFER, ...(input === undefined ? {} : { input }) });
const names = (listing: Buffer): string[] => listing.toString('utf8').split('\0').filter((name) => name !== '');

/** The files under `roots` as a commit holds them. One `git cat-file` reads them all. */
export function readRef(ref: string, roots: readonly string[], repoRoot: string = REPO_ROOT): Tree {
  const paths = names(git(['ls-tree', '-r', '-z', '--name-only', ref, '--', ...roots], repoRoot));
  const out = git(['cat-file', '--batch'], repoRoot, paths.map((path) => `${ref}:${path}\n`).join(''));
  const tree = new Map<string, string>();
  let at = 0;
  for (const path of paths) {
    const headerEnd = out.indexOf(0x0a, at);
    const header = out.subarray(at, headerEnd).toString('utf8');
    const size = Number(/^[0-9a-f]+ blob (\d+)$/.exec(header)?.[1] ?? NaN);
    if (Number.isNaN(size)) throw new Error(`readRef: ${ref}:${path} is not a file in git (${header})`);
    tree.set(path, out.subarray(headerEnd + 1, headerEnd + 1 + size).toString('utf8'));
    at = headerEnd + 1 + size + 1;
  }
  return tree;
}

/** The files under `roots` as they stand on disk: what git tracks, and what is new and not ignored. */
export function readWorkingTree(roots: readonly string[], repoRoot: string = REPO_ROOT): Tree {
  const paths = names(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...roots], repoRoot));
  const tree = new Map<string, string>();
  for (const path of [...new Set(paths)].sort()) {
    if (existsSync(join(repoRoot, path))) tree.set(path, readFileSync(join(repoRoot, path), 'utf8'));
  }
  return tree;
}

export interface StrippedDifference {
  readonly file: string;
  /** `code`: a piece differs. `unread`: a kind comments.ts does not read, and its bytes differ. */
  readonly what: 'added' | 'removed' | 'code' | 'unread';
  readonly detail: string;
}

export interface StrippedCompare {
  readonly compared: number;
  /** Files whose text differs at all, comments included. */
  readonly changed: string[];
  readonly differences: StrippedDifference[];
}

const show = (piece: CodePiece): string => `line ${piece.line} ${JSON.stringify(piece.text.length > 60 ? `${piece.text.slice(0, 57)}...` : piece.text)}`;

// A title piece's opening (a quote, a backtick, or the `}` that closes a
// substitution) and its close (a quote, a backtick, or `${`), around its words.
const TITLE_WORDS = /^(['"`}])[^]*?(\$\{|['"`])$/;
const held = (piece: CodePiece): string => (piece.title === true ? piece.text.replace(TITLE_WORDS, '$1…$2') : piece.text);

/** The first place two files' code parts, or `null` when the pieces are the same. */
export function firstCodeDifference(before: readonly CodePiece[], after: readonly CodePiece[]): string | null {
  const shared = Math.min(before.length, after.length);
  for (let i = 0; i < shared; i++) {
    const [a, b] = [before[i]!, after[i]!];
    if (held(a) !== held(b)) return `${show(a)} → ${show(b)}`;
    if (a.newline !== b.newline) return `a line break before ${show(b)} ${b.newline ? 'came' : 'went'}`;
  }
  if (before.length > after.length) return `${before.length - shared} pieces gone from the end, the first at ${show(before[shared]!)}`;
  if (after.length > before.length) return `${after.length - shared} pieces more at the end, the first at ${show(after[shared]!)}`;
  return null;
}

// A checkout may hold CRLF where the commit holds LF. TypeScript reads both as one line break, in a template too.
const sameBreaks = (text: string): string => text.replace(/\r\n/g, '\n');

export function compareStripped(before: Tree, after: Tree): StrippedCompare {
  const changed: string[] = [];
  const differences: StrippedDifference[] = [];
  const files = [...new Set([...before.keys(), ...after.keys()])].sort();
  for (const file of files) {
    const [a, b] = [before.get(file), after.get(file)];
    if (a === undefined || b === undefined) {
      changed.push(file);
      differences.push({ file, what: a === undefined ? 'added' : 'removed', detail: 'the file' });
      continue;
    }
    const [textA, textB] = [sameBreaks(a), sameBreaks(b)];
    if (textA === textB) continue;
    changed.push(file);
    const [splitA, splitB] = [splitSource(file, textA), splitSource(file, textB)];
    if (splitA === null || splitB === null) {
      differences.push({ file, what: 'unread', detail: 'not TypeScript, GLSL or CSS, so held byte for byte, and its bytes differ' });
      continue;
    }
    const detail = firstCodeDifference(splitA.code, splitB.code);
    if (detail !== null) differences.push({ file, what: 'code', detail });
  }
  return { compared: files.length, changed, differences };
}

export interface StrippedControl {
  readonly file: string;
  /** The edit made, for the report. */
  readonly planted: string;
  /** Whether the compare named the file with the edit made. `false` is a
   *  compare that cannot see the file's code where the edit went. */
  readonly caught: boolean;
}

// A line every reader holds as code: a statement to TypeScript, and text
// outside a comment to the GLSL and CSS reader.
const APPENDED = '\n0;\n';

/** `text` with one code edit made: the middle one of the edits plant.ts
 *  finds through TypeScript's parser, or a line of code appended to a file
 *  it finds none in (a file of types, a shader, a stylesheet). */
export function plantedText(file: string, text: string): { readonly text: string; readonly planted: string } {
  const found = /\.(?:ts|mts|cts)$/.test(file) ? edits(file, text) : [];
  const edit = found[Math.floor(found.length / 2)];
  if (edit === undefined) return { text: text + APPENDED, planted: 'a line of code appended' };
  return { text: applyEdit(text, edit), planted: `line ${edit.line}, ${describeEdit(edit)}` };
}

/** Each file `result` passed as a comment edit, compared again with one code
 *  edit made in its text. A file the compare does not name then is one whose
 *  code it cannot see, so its pass there shows nothing. */
export function controlStripped(before: Tree, after: Tree, result: StrippedCompare): StrippedControl[] {
  const named = new Set(result.differences.map((d) => d.file));
  return result.changed
    .filter((file) => !named.has(file))
    .map((file) => {
      const planted = plantedText(file, after.get(file)!);
      const again = compareStripped(new Map([[file, before.get(file)!]]), new Map([[file, planted.text]]));
      return { file, planted: planted.planted, caught: again.differences.length > 0 };
    });
}
