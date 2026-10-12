/**
 * THE BUILD AGAINST A REF: is the game a player would get the same bytes?
 *
 *   npm run oracle -- build-hash [ref]         the working tree's build against the ref's (default HEAD)
 *   npm run oracle -- build-hash [ref] --dev   the same for the development-mode builds
 *
 * It builds the working tree and the tree at `ref` with the build's ID
 * pinned (the ID is part of a build's bytes, scripts/build-id.mjs), hashes
 * every file of each (scripts/dist-hash.mjs) and names the files that
 * differ. Equal totals mean the two trees ship the same game, byte for byte.
 *
 * WHAT IT PROVES. That a change left every shipped byte alone: a deletion
 * of code the game never runs, an export nothing imports, a comment in a
 * TypeScript file or the stylesheet. It is the one proof that reaches the
 * renderer, the UI, the scenes and `Game`, which no headless run loads.
 * WHAT IT CANNOT SEE. Code the game's entry never reaches: the bot, the
 * journal's replay, everything under `src/dev` (a production build drops
 * it; `--dev` compares the builds that keep it), the tests, the tools. A
 * change there leaves the hash alone whatever it does. A change to code the game does run always moves the hash, so it
 * says "changed" for a careful reshaping and a break alike: for those the
 * proof is the corpus, the fuzz diff or the user's eye.
 * A SHADER'S COMMENT IS SHIPPED. The `.glsl` files are bundled as text, so
 * a comment edit there moves the hash; the comment-stripped compare
 * (strippedCompare.ts) is the proof for those.
 *
 * The ref's tree is a detached worktree under `output/build-hash/`, inside
 * the repo, so that it resolves packages from the repo's own `node_modules`
 * with no link to make or to clean up. `output/` is ignored by git, by the
 * dev server's watcher and by the test runs.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WORK = 'output/build-hash';
/** Any fixed text: both builds carry it in place of their commit. */
const PINNED_ID = '0.0.0+build-hash';

export interface BuildComparison {
  /** The ref's build and the working tree's: each one hash over every file. */
  readonly before: string;
  readonly after: string;
  /** The built files whose bytes differ, or that only one build has. */
  readonly changed: readonly string[];
  readonly files: number;
}

/** Build the tree at `root` into `outDir`; each built file's hash by its path, and the total. */
function build(repo: string, root: string, outDir: string, dev: boolean): { total: string; files: Map<string, string> } {
  rmSync(outDir, { recursive: true, force: true });
  const made = spawnSync(process.execPath, [join(repo, 'node_modules/vite/bin/vite.js'), 'build', ...(dev ? ['--mode', 'development'] : []), '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], {
    cwd: root,
    encoding: 'utf8',
    // `--mode` alone leaves DEV off: Vite reads it from NODE_ENV.
    env: { ...process.env, ASCIIBATTLER_BUILD_ID: PINNED_ID, ...(dev ? { NODE_ENV: 'development' } : {}) },
  });
  if (made.status !== 0) throw new Error(`build-hash: the build of ${root} failed:\n${made.stdout}${made.stderr}`);
  const lines = execFileSync(process.execPath, [join(repo, 'scripts/dist-hash.mjs'), outDir, '--files'], { encoding: 'utf8' }).trim().split(/\r?\n/);
  const total = lines.pop()!.split(' ')[0]!;
  const files = new Map(lines.map((line) => line.split(' ') as [string, string]));
  // The dev entry's chunk is what shows which build this is: asking for a
  // mode is not the same as getting it.
  const hasDevChunk = [...files.keys()].some((name) => name.startsWith('assets/devEntry-'));
  if (hasDevChunk !== dev) throw new Error(`build-hash: the build of ${root} ${dev ? 'has no dev chunk, so it is not a development-mode build' : 'has a dev chunk, so it is not a production build'}`);
  return { total, files };
}

/**
 * Build the working tree at `repo` and the tree at `ref`, and compare them
 * file by file. `dev` makes both the development-mode build, which keeps the
 * code under `src/dev` that a production build drops.
 */
export function compareBuildWith(ref: string, dev = false, repo = '.'): BuildComparison {
  const here = resolve(repo);
  const work = join(here, WORK);
  const base = join(work, 'base');
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: here, encoding: 'utf8' });
  const dropBase = (): void => {
    if (existsSync(base)) spawnSync('git', ['worktree', 'remove', '--force', base], { cwd: here });
    git('worktree', 'prune');
  };
  mkdirSync(work, { recursive: true });
  dropBase();
  git('worktree', 'add', '--detach', base, ref);
  try {
    const before = build(here, base, join(work, 'dist-before'), dev);
    const after = build(here, here, join(work, 'dist-after'), dev);
    const names = [...new Set([...before.files.keys(), ...after.files.keys()])].sort();
    return {
      before: before.total,
      after: after.total,
      changed: names.filter((name) => before.files.get(name) !== after.files.get(name)),
      files: names.length,
    };
  } finally {
    dropBase();
  }
}
