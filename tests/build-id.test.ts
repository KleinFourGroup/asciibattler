import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILD_ID_ENV, LIVE_SUFFIX, NO_GIT, buildId, commitStamp, type Git } from '../scripts/build-id.mjs';
import { AT_LOAD_GLOBAL, BUILD_ID, UNBAKED_BUILD_ID, atLoadScript, resolveBuildId } from '../src/buildId';
import viteConfig from '../vite.config';

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

// 113f-post — a dev server bakes its constant when it starts and then outlives
// commits, so it stamps the ID into each page it serves and the page reads the
// stamp first. The stamp's script is run here against a fake window, and the
// plugin is taken from the real config and asked for a page.

/** Runs an inline script's text with `window` as its only global. */
function runOnPage(script: string): Record<string, unknown> {
  const page: Record<string, unknown> = {};
  new Function('window', script)(page);
  return page;
}

describe('113f-post — the ID stamped at each page load', () => {
  it('reads the stamp before the baked constant, and the constant when there is none', () => {
    expect(resolveBuildId('0.0.0+aaaaaaa-dirty-dev', '0.0.0+bbbbbbb-dev')).toBe('0.0.0+bbbbbbb-dev');
    expect(resolveBuildId('0.0.0+aaaaaaa-dev', undefined)).toBe('0.0.0+aaaaaaa-dev');
    expect(resolveBuildId('0.0.0+aaaaaaa-dev', '')).toBe('0.0.0+aaaaaaa-dev');
    expect(resolveBuildId('0.0.0+aaaaaaa-dev', 7)).toBe('0.0.0+aaaaaaa-dev');
    expect(resolveBuildId(undefined, undefined)).toBe(UNBAKED_BUILD_ID);
  });

  it('the stamp sets the global the module reads', () => {
    expect(AT_LOAD_GLOBAL).toBe('__BUILD_ID_AT_LOAD__');
    const page = runOnPage(atLoadScript('0.0.0+abc1234-dev'));
    expect(page).toEqual({ __BUILD_ID_AT_LOAD__: '0.0.0+abc1234-dev' });
    expect(resolveBuildId('baked', page[AT_LOAD_GLOBAL])).toBe('0.0.0+abc1234-dev');
  });

  it('a pinned ID cannot close the script element', () => {
    const hostile = 'pin</script><script>window.planted = 1;//';
    const script = atLoadScript(hostile);
    expect(script).not.toContain('<');
    expect(runOnPage(script)).toEqual({ __BUILD_ID_AT_LOAD__: hostile });
  });

  it('the dev server stamps every page with what git says now, and a build has no stamp', async () => {
    type Tag = { tag: string; children: string; injectTo: string };
    type Stamp = { name: string; apply?: unknown; transformIndexHtml?: (html: string) => { html: string; tags: Tag[] } };
    const config = typeof viteConfig === 'function' ? await viteConfig({ command: 'serve', mode: 'development' }) : viteConfig;
    const plugin = (config.plugins as unknown as Stamp[]).find((p) => p.name === 'asciibattler-build-id-at-load');
    // Serve only: Vite leaves a plugin with `apply: 'serve'` out of a build.
    expect(plugin?.apply).toBe('serve');

    const served = plugin?.transformIndexHtml?.('<html></html>');
    expect(served?.html).toBe('<html></html>');
    expect(served?.tags).toHaveLength(1);
    const tag = served?.tags[0];
    // Ahead of the page's modules: an inline script at the top of the head.
    expect(tag?.tag).toBe('script');
    expect(tag?.injectTo).toBe('head-prepend');

    const stamped = runOnPage(tag?.children ?? '')[AT_LOAD_GLOBAL];
    const pin = process.env[BUILD_ID_ENV];
    if (pin !== undefined && pin !== '') {
      expect(stamped).toBe(pin);
      return;
    }
    // The expectation comes from git itself, asked here, not from buildId().
    const head = spawnSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
    const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).stdout.trim() !== '';
    expect(head).toMatch(/^[0-9a-f]{7}$/);
    expect(stamped).toBe(`${version}+${head}${dirty ? '-dirty' : ''}-dev`);
  });
});
