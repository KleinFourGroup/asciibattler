/**
 * 57f2 — the run-mode `--jobs` parity pin: a parallel run's file outputs must
 * be BYTE-IDENTICAL to a serial run of the same seed range. This is the whole
 * contract that makes --jobs safe for measurement batches (and the on-box
 * batch runner rests on it), so it's pinned against real child-process spawns
 * of the real CLI — not a mocked merge.
 *
 * Kept cheap: a small seed range at --hops=3 (X2d — short runs), default
 * baseline strategies. Still real end-to-end runs, so the per-test timeout is
 * generous (the occupancyInvariant precedent for self-owned timeouts).
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), 'cli.ts');

function runCli(extraArgs: readonly string[], outDir: string): void {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', CLI_PATH, '--count=4', '--hops=3', `--out=${outDir}`, ...extraArgs],
    { encoding: 'utf8', timeout: 200_000 },
  );
  expect(
    result.status,
    `cli exited ${result.status}:\n${result.stderr ?? ''}\n${result.stdout ?? ''}`,
  ).toBe(0);
}

describe('run-mode --jobs parity', () => {
  it('parallel summary.csv + failure traces are byte-identical to serial', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-jobs-parity-'));
    try {
      const serialDir = join(scratch, 'serial');
      const parallelDir = join(scratch, 'parallel');
      runCli([], serialDir);
      runCli(['--jobs=2'], parallelDir);

      const serialCsv = readFileSync(join(serialDir, 'summary.csv'), 'utf8');
      const parallelCsv = readFileSync(join(parallelDir, 'summary.csv'), 'utf8');
      expect(parallelCsv).toBe(serialCsv);

      const traces = (dir: string): string[] =>
        existsSync(join(dir, 'failures')) ? readdirSync(join(dir, 'failures')).sort() : [];
      const serialTraces = traces(serialDir);
      expect(traces(parallelDir)).toEqual(serialTraces);
      for (const f of serialTraces) {
        expect(readFileSync(join(parallelDir, 'failures', f), 'utf8')).toBe(
          readFileSync(join(serialDir, 'failures', f), 'utf8'),
        );
      }
      // The shard scratch dir is cleaned up on success.
      expect(existsSync(join(parallelDir, 'shards'))).toBe(false);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 420_000);
});
