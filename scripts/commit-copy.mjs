#!/usr/bin/env node
// The commit itself, written out beside the working tree, for the pre-commit
// hook (.githooks/pre-commit). Git runs the hook in the working tree, which
// holds whatever is unstaged and untracked as well as the commit; when the
// two differ, the hook runs its checks in this copy instead, so a commit is
// checked on what it holds.
//
//   node scripts/commit-copy.mjs make           # prints the copy's path
//   node scripts/commit-copy.mjs remove <path>
//
// `make` adds a detached linked worktree at HEAD under the OS temp directory,
// sets its own index to the entries of the index being committed (the one
// git names in GIT_INDEX_FILE during a commit, so `git commit <paths>` is
// copied as committed), writes the files, and joins the checkout's
// node_modules in by a junction. The copy is a git checkout of its own, so a
// check run there finds it by git's usual search, with no GIT_DIR exported: a
// test that builds a repository of its own must not reach this one, and an
// absolute GIT_DIR in the environment sends its `git init` and `git add` here.
// `remove` takes the junction out first, checks that the checkout's
// node_modules is still there, and only then deletes the worktree.

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, rmSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const PREFIX = 'asciibattler-commit-';
const [command, arg] = process.argv.slice(2);
// The checkout is this script's own, whatever git's environment says.
const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const modules = join(repo, 'node_modules');

// Git with none of the hook's variables: it finds the repository from cwd.
const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|PREFIX|COMMON_DIR)$/.test(k)));
const git = (cwd, args, opts = {}) => execFileSync('git', args, { cwd, env: clean, encoding: 'utf8', ...opts });

if (command === 'make') {
  const dir = mkdtempSync(join(tmpdir(), PREFIX)).replace(/\\/g, '/');
  git(repo, ['worktree', 'add', '--quiet', '--detach', '--no-checkout', dir, 'HEAD']);
  // The index being committed: GIT_INDEX_FILE as git set it, read from the
  // checkout's root, where git resolves a relative one.
  const entries = execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: repo, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  git(dir, ['read-tree', '--empty']);
  git(dir, ['update-index', '-z', '--index-info'], { input: entries });
  git(dir, ['checkout-index', '--all', '--force']);
  symlinkSync(modules, join(dir, 'node_modules'), 'junction');
  process.stdout.write(dir);
} else if (command === 'remove') {
  const dir = resolve(arg ?? '');
  if (!basename(dir).startsWith(PREFIX)) throw new Error(`commit-copy: ${dir} is not a copy this script made; nothing removed`);
  const link = join(dir, 'node_modules');
  let st;
  try {
    st = lstatSync(link);
  } catch {
    st = undefined;
  }
  if (st !== undefined) {
    if (!st.isSymbolicLink()) throw new Error(`commit-copy: ${link} is not the junction; nothing removed`);
    // A directory link goes with rmdir on Windows and unlink elsewhere;
    // neither follows it into the checkout's node_modules.
    if (process.platform === 'win32') rmdirSync(link);
    else unlinkSync(link);
  }
  if (!existsSync(join(modules, '.bin')) && !existsSync(join(modules, 'typescript'))) {
    throw new Error(`commit-copy: ${modules} looks gone after the junction came out; ${dir} left in place`);
  }
  try {
    git(repo, ['worktree', 'remove', '--force', dir.replace(/\\/g, '/')]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    git(repo, ['worktree', 'prune']);
  }
} else {
  throw new Error('commit-copy: make | remove <path>');
}
