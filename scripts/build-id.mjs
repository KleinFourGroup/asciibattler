// The build's ID (Round 8 spec D2): the version and the commit a build was
// made from, as `<version>+<commit>`.
//
//   0.1.0+abc1234          a build of a clean tree at that commit
//   0.1.0+abc1234-dirty    the tree had uncommitted changes
//   0.1.0+abc1234-dev      served live (the dev server, Vitest), where the
//                          tree can change under a running server. A dev
//                          server's page carries the ID as git gave it when
//                          the page loaded (vite.config.ts stamps each load);
//                          Vitest's is the one its run started on
//   0.1.0+nogit            git couldn't answer (a tree with no repository)
//
// One function for the two places that stamp a build: vite.config.ts bakes
// the ID into the bundle (`__BUILD_ID__`, read through src/buildId.ts), and
// the recorder names a tree by its commit stamp (shell/electron/tree.mjs).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Set this to pin the ID, so two builds compare byte for byte whatever
 *  their commit or the state of the tree. */
export const BUILD_ID_ENV = 'ASCIIBATTLER_BUILD_ID';
/** The commit part when git can't answer. */
export const NO_GIT = 'nogit';
/** The suffix of an ID served live. */
export const LIVE_SUFFIX = '-dev';

function runGit(cwd) {
  return (args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    return r.stdout.trim();
  };
}

/** `abc1234`, or `abc1234-dirty` when `git status --porcelain` lists
 *  anything. Throws when git fails. */
export function commitStamp(cwd, git = runGit(cwd)) {
  const commit = git(['rev-parse', '--short=7', 'HEAD']);
  return git(['status', '--porcelain']) === '' ? commit : `${commit}-dirty`;
}

/** The ID of the tree at `cwd`. `live` marks one served from a tree that can
 *  change under it. A pin is returned as it is. */
export function buildId({ cwd, env = process.env, git = runGit(cwd), live = false }) {
  const pinned = env[BUILD_ID_ENV];
  if (pinned !== undefined && pinned !== '') return pinned;
  const { version } = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  let commit;
  try {
    commit = commitStamp(cwd, git);
  } catch {
    commit = NO_GIT;
  }
  return `${version}+${commit}${live ? LIVE_SUFFIX : ''}`;
}
