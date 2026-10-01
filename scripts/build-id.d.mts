// Types for build-id.mjs, which stays plain JS because the Electron tools
// (shell/electron/tree.mjs) import it outside tsc. tests/build-id.test.ts
// calls every export through these, so a name that drifts fails there.
export declare const BUILD_ID_ENV: 'ASCIIBATTLER_BUILD_ID';
export declare const NO_GIT: 'nogit';
export declare const LIVE_SUFFIX: '-dev';

/** Runs `git <args>` in the tree and returns its trimmed output; throws on failure. */
export type Git = (args: readonly string[]) => string;

export declare function commitStamp(cwd: string, git?: Git): string;

export declare function buildId(options: {
  cwd: string;
  env?: Readonly<Record<string, string | undefined>>;
  git?: Git;
  live?: boolean;
}): string;
