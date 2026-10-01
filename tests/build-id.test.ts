import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILD_ID_ENV, LIVE_SUFFIX, NO_GIT, buildId, commitStamp, type Git } from '../scripts/build-id.mjs';
import { BUILD_ID, UNBAKED_BUILD_ID } from '../src/buildId';

// 113a — the build ID (Round 8 spec D2). The forms are pinned over a fake
// git, so a clean and a dirty tree are both planted; one case asks the real
// git, and one reads the constant Vite baked for this test run.

const repo = process.cwd();
const version = (JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')) as { version: string }).version;

const fakeGit =
  (commit: string, status: string): Git =>
  (args) => {
    if (args[0] === 'rev-parse') return commit;
    if (args[0] === 'status') return status;
    throw new Error(`unexpected git ${args.join(' ')}`);
  };
const noGit: Git = () => {
  throw new Error('not a git repository');
};
const none = {};

describe('113a — the build ID', () => {
  it('stamps a clean tree with its commit and a changed one with -dirty', () => {
    expect(commitStamp(repo, fakeGit('abc1234', ''))).toBe('abc1234');
    expect(commitStamp(repo, fakeGit('abc1234', '?? planted.txt'))).toBe('abc1234-dirty');
    expect(() => commitStamp(repo, noGit)).toThrow('not a git repository');
  });

  it('is the version, a plus, and the stamp', () => {
    expect(buildId({ cwd: repo, env: none, git: fakeGit('abc1234', '') })).toBe(`${version}+abc1234`);
    expect(buildId({ cwd: repo, env: none, git: fakeGit('abc1234', ' M src/main.ts') })).toBe(
      `${version}+abc1234-dirty`,
    );
  });

  it('marks an ID served live, after the dirty mark', () => {
    expect(LIVE_SUFFIX).toBe('-dev');
    expect(buildId({ cwd: repo, env: none, git: fakeGit('abc1234', ''), live: true })).toBe(`${version}+abc1234-dev`);
    expect(buildId({ cwd: repo, env: none, git: fakeGit('abc1234', '?? x'), live: true })).toBe(
      `${version}+abc1234-dirty-dev`,
    );
  });

  it('names a tree git cannot answer for', () => {
    expect(buildId({ cwd: repo, env: none, git: noGit })).toBe(`${version}+${NO_GIT}`);
  });

  it('returns a pin as it is, whatever the tree, and ignores an empty one', () => {
    const dirty = fakeGit('abc1234', '?? x');
    expect(buildId({ cwd: repo, env: { [BUILD_ID_ENV]: 'pinned-1' }, git: dirty, live: true })).toBe('pinned-1');
    expect(buildId({ cwd: repo, env: { [BUILD_ID_ENV]: 'pinned-1' }, git: noGit })).toBe('pinned-1');
    expect(buildId({ cwd: repo, env: { [BUILD_ID_ENV]: '' }, git: fakeGit('abc1234', '') })).toBe(`${version}+abc1234`);
  });

  it('asks the real git for this tree', () => {
    const head = spawnSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
    expect(head).toMatch(/^[0-9a-f]{7}$/);
    expect(buildId({ cwd: repo, env: none })).toMatch(new RegExp(`^${version.replaceAll('.', '\\.')}\\+${head}(-dirty)?$`));
  });

  it('is baked into this test run by vite.config.ts, as a live ID', () => {
    expect(BUILD_ID).not.toBe(UNBAKED_BUILD_ID);
    const pin = process.env[BUILD_ID_ENV];
    if (pin !== undefined && pin !== '') expect(BUILD_ID).toBe(pin);
    else expect(BUILD_ID).toMatch(/^\d+\.\d+\.\d+\+[0-9a-f]{7}(-dirty)?-dev$/);
  });
});
