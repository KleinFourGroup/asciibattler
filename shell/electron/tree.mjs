// A tree to build, and its development-mode build: shared by the recorder's
// front door (record-cli.mjs, §111) and the probe runner's (probe-cli.mjs,
// §112d). Only a development-mode build carries the dev handles (`__game`,
// the board explorer, the probe kit `__probe`).
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commitStamp } from '../../scripts/build-id.mjs';

export const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A failure the front door reports as one line, without a stack. */
export class Stop extends Error {}
export const stop = (message) => {
  throw new Stop(message);
};

export function git(args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) stop(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

/** The tree for `ref` (undefined = the working tree), with its stamp and how
 *  to take it down. A worktree borrows the main tree's node_modules through a
 *  junction, which is unlinked before the worktree is removed, so the removal
 *  can never reach the real one. */
export function openTree(ref, work, label) {
  if (ref === undefined) {
    // The stamp the build bakes as its ID's commit part (scripts/build-id.mjs).
    return { root: repo, stamp: commitStamp(repo, git), ref: 'working tree', close: () => {} };
  }
  const stamp = git(['rev-parse', '--short=7', `${ref}^{commit}`]);
  const root = join(work, `tree-${label}`);
  git(['worktree', 'add', '--detach', root, stamp]);
  const link = join(root, 'node_modules');
  symlinkSync(join(repo, 'node_modules'), link, 'junction');
  return {
    root,
    stamp,
    ref,
    close: () => {
      if (existsSync(link)) {
        if (!lstatSync(link).isSymbolicLink()) stop(`${link} is not the junction this script made; not removing ${root}`);
        unlinkSync(link);
      }
      git(['worktree', 'remove', '--force', root]);
    },
  };
}

/** Build `tree` in development mode into `dist`. `log` takes the progress
 *  line (the runner keeps stdout for its JSON). */
export function build(tree, dist, log = console.log) {
  log(`building ${tree.stamp} (${tree.ref}, development mode)`);
  const built = spawnSync(
    process.execPath,
    [join(tree.root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--mode', 'development', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'],
    { cwd: tree.root, env: { ...process.env, NODE_ENV: 'development' }, encoding: 'utf8' },
  );
  if (built.status !== 0) stop(`the build of ${tree.stamp} failed:\n${built.stderr || built.stdout}`);
  // Only a development-mode build carries the dev code (the board explorer,
  // __game, the probe kit), so its chunk is the proof that NODE_ENV reached
  // Vite. The chunk is the dev entry's (src/dev/devEntry.ts) since 117.5j; a
  // tree from before that has the board explorer's own.
  if (!readdirSync(join(dist, 'assets')).some((f) => f.startsWith('devEntry-') || f.startsWith('boardPanel-'))) {
    stop(`the build of ${tree.stamp} has no dev chunk (devEntry-* or boardPanel-*): DEV was off, and the dev handles are missing`);
  }
}
