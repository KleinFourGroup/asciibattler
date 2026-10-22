/**
 * The count of step codes in the comments and the test titles under `src`,
 * by file, and the ceiling it is held to (tests/comment-codes.test.ts).
 *
 * A step code addresses the plan and not the code: "74b", "§40b", "K1". A
 * reader of the source cannot resolve one, which is why AGENTS "Voice" asks
 * for the reason in words instead. The rule below is what the count means.
 * It reads comments and test titles (comments.ts says what a title is); a
 * code in any other string is data and is not counted.
 *
 * COUNTED, each match once:
 *
 *  - a numbered step, bare: a phase from 27 on (the first numbered phase),
 *    with or without ".5", then a step letter a to r, then at most a digit
 *    and a letter. "74b", "96.5b2", "77e2b".
 *  - a lettered phase's step, from before the phases were numbered: one
 *    capital (or "GP"), one or two digits, then at most a dotted part, a
 *    letter and a digit. "K1", "GP5.2", "D5.C", "H4b".
 *  - "§" before either of those, or before a phase alone: "§40b", "§29",
 *    "§117.5", "§Z", "§Yb".
 *  - "Phase" and a phase, spaced or hyphenated: "Phase 27", "Phase Y2",
 *    "Phase-L".
 *
 * Whatever is hyphenated onto a code is part of it, so "86c-L2b" and
 * "96.5b2-post" are one each, and "pre-F2" is one.
 *
 * NOT COUNTED:
 *
 *  - "§" before a document's section: `DESIGN §UI idioms`, `spec §5`. A
 *    reader can open the document.
 *  - "gotcha #114": GOTCHAS.md resolves it, and AGENTS asks for that form.
 *  - a round or a cluster by name ("Round 8"). `npm run oracle --
 *    comment-codes` prints how many there are.
 *  - a bare phase number with no step and no mark, which is only a number.
 *
 * KNOWN TO MISCOUNT: a quantity whose unit is one letter from a to r reads
 * as a step when the number is 27 or more ("40k"), and a capital before a
 * number reads as a lettered step ("L9" for a level). Two letters after the
 * number ("40px", "50ms") and the letters s to z ("30s") are never a step.
 * Reword such a comment ("40,000", "level 9") when the count should reach
 * zero.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSource } from './comments';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CEILING_PATH = 'tests/comment-codes-baseline.json';
/** Where the count reads. */
export const COUNTED_ROOTS = ['src'] as const;

const NUMBERED_PHASE = String.raw`(?:2[7-9]|[3-9]\d|1\d\d)(?:\.\d{1,2})?`;
const NUMBERED_STEP = String.raw`[a-r](?:\d[a-z]?)?`;
const LETTERED_PHASE = String.raw`(?:GP|[A-Z])`;
const LETTERED_STEP = String.raw`\d{1,2}(?:\.[A-Z0-9]{1,2})?(?:[a-z]\d?)?`;
/** A phase named alone, after "§" or "Phase": a number, or a letter ("Yb" and "Wb" were phases too). */
const PHASE = String.raw`(?:${NUMBERED_PHASE}(?:${NUMBERED_STEP})?|${LETTERED_PHASE}b?(?:${LETTERED_STEP})?)`;
/** The code ends here, and takes what is hyphenated onto it. */
const END = String.raw`(?![A-Za-z0-9])(?:-[A-Za-z0-9]+)*`;
/** A bare code starts a word: not inside a name, a decimal or a hex colour. */
const START = String.raw`(?<![\w.#§])`;

const STEP_CODE = new RegExp(
  [
    String.raw`(?<phase>\bPhase[ -]${PHASE}${END})`,
    String.raw`(?<mark>§${PHASE}${END})`,
    String.raw`(?<numbered>${START}${NUMBERED_PHASE}${NUMBERED_STEP}${END})`,
    String.raw`(?<lettered>${START}${LETTERED_PHASE}${LETTERED_STEP}${END})`,
  ].join('|'),
  'g',
);

export type StepCodeKind = 'phase' | 'mark' | 'numbered' | 'lettered';
export const STEP_CODE_KINDS: readonly StepCodeKind[] = ['mark', 'numbered', 'lettered', 'phase'];

export interface StepCode {
  readonly code: string;
  readonly kind: StepCodeKind;
}

/** The step codes in a piece of comment text, in order. */
export function stepCodes(text: string): StepCode[] {
  const found: StepCode[] = [];
  for (const match of text.matchAll(STEP_CODE)) {
    const kind = STEP_CODE_KINDS.find((k) => match.groups?.[k] !== undefined);
    if (kind !== undefined) found.push({ code: match[0], kind });
  }
  return found;
}

export interface FoundCode extends StepCode {
  readonly file: string;
  readonly line: number;
}

/** The files under `roots` that comments.ts can split, repo-relative with forward slashes, sorted. */
export function listSources(repoRoot: string, roots: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(join(repoRoot, dir))) {
      if (name === 'node_modules') continue;
      const path = `${dir}/${name}`;
      if (statSync(join(repoRoot, path)).isDirectory()) walk(path);
      else if (/\.(?:ts|glsl|css)$/.test(name)) out.push(path);
    }
  };
  for (const root of roots) walk(root);
  return out.sort();
}

export interface SourceAt {
  /** The name it is reported by: repo-relative inside the repo, else the root as given with the rest of the path. */
  readonly file: string;
  /** Where it is read from. */
  readonly path: string;
  /** What it is summed under: inside the repo its folder two deep, else the root as given and its first folder. */
  readonly group: string;
}

/** The files `listSources` would read under each root, where a root may also be one file, or a path outside the repo (read from `base`). */
export function sourcesAt(roots: readonly string[], repoRoot: string = REPO_ROOT, base: string = repoRoot): SourceAt[] {
  const out: SourceAt[] = [];
  const slash = (p: string): string => p.split('\\').join('/');
  for (const root of roots) {
    const abs = resolve(base, root);
    const fromRepo = relative(repoRoot, abs);
    const inRepo = fromRepo === '' || (!fromRepo.startsWith('..') && !isAbsolute(fromRepo));
    const at = (path: string): SourceAt => {
      const rel = slash(relative(abs, path));
      if (inRepo) {
        const file = slash(relative(repoRoot, path));
        return { file, path, group: file.split('/').slice(0, -1).slice(0, 2).join('/') };
      }
      const file = rel === '' ? slash(root) : `${slash(root).replace(/\/$/, '')}/${rel}`;
      return { file, path, group: rel.includes('/') ? `${slash(root).replace(/\/$/, '')}/${rel.split('/')[0]}` : slash(root) };
    };
    if (statSync(abs).isFile()) {
      if (/\.(?:ts|glsl|css)$/.test(abs)) out.push(at(abs));
    } else {
      for (const file of listSources(abs, ['.'])) out.push(at(join(abs, file)));
    }
  }
  return out;
}

/** The step codes in one file's comments and test titles, each with the line it stands on, in line order. */
export function codesInSource(file: string, text: string): FoundCode[] {
  const split = splitSource(file, text);
  if (split === null) return [];
  const found: FoundCode[] = [];
  for (const read of [...split.comments, ...split.code.filter((piece) => piece.title === true)]) {
    read.text.split('\n').forEach((lineText, k) => {
      for (const code of stepCodes(lineText)) found.push({ ...code, file, line: read.line + k });
    });
  }
  return found.sort((a, b) => a.line - b.line);
}

/** Every step code in the comments and test titles under `roots`. */
export function scanStepCodes(repoRoot: string = REPO_ROOT, roots: readonly string[] = COUNTED_ROOTS): FoundCode[] {
  return listSources(repoRoot, roots).flatMap((file) => codesInSource(file, readFileSync(join(repoRoot, file), 'utf8')));
}

/** file → its count, for the files that hold any; sorted. */
export type CodeCeiling = Readonly<Record<string, number>>;

export function ceilingOf(codes: readonly FoundCode[]): CodeCeiling {
  const counts = new Map<string, number>();
  for (const c of codes) counts.set(c.file, (counts.get(c.file) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function readCeiling(repoRoot: string = REPO_ROOT): CodeCeiling {
  return JSON.parse(readFileSync(join(repoRoot, CEILING_PATH), 'utf8')) as CodeCeiling;
}

export function writeCeiling(ceiling: CodeCeiling, repoRoot: string = REPO_ROOT): void {
  writeFileSync(join(repoRoot, CEILING_PATH), `${JSON.stringify(ceiling, null, 1)}\n`);
}

export const total = (ceiling: CodeCeiling): number => Object.values(ceiling).reduce((sum, n) => sum + n, 0);

export interface CeilingDrift {
  /** Files that hold more codes than their ceiling, with both counts. */
  readonly over: { file: string; now: number; ceiling: number }[];
  /** Files that hold fewer, so the ceiling can come down. */
  readonly under: { file: string; now: number; ceiling: number }[];
}

export function ceilingDrift(live: CodeCeiling, ceiling: CodeCeiling): CeilingDrift {
  const over: CeilingDrift['over'] = [];
  const under: CeilingDrift['under'] = [];
  for (const file of [...new Set([...Object.keys(live), ...Object.keys(ceiling)])].sort()) {
    const now = live[file] ?? 0;
    const cap = ceiling[file] ?? 0;
    if (now > cap) over.push({ file, now, ceiling: cap });
    if (now < cap) under.push({ file, now, ceiling: cap });
  }
  return { over, under };
}
