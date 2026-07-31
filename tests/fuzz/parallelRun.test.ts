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

  it('68e — the aggregate analyses compose with --jobs, CSVs byte-identical to serial', () => {
    // The RunResult round-trip contract: shards dump results.json, the parent
    // regroups strategy-major (mergeSummaries order — serial float summation)
    // and runs run.ts's own writeAggregateAnalyses. Every analysis CSV must
    // match a serial run of the same flags byte for byte.
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-jobs-aggregates-'));
    const flags = ['--per-hop', '--per-layout', '--per-encounter'];
    try {
      const serialDir = join(scratch, 'serial');
      const parallelDir = join(scratch, 'parallel');
      runCli(flags, serialDir);
      runCli([...flags, '--jobs=2'], parallelDir);

      for (const f of [
        'summary.csv',
        'per-hop.csv',
        'per-layout.csv',
        'per-layout-hop.csv',
        'per-encounter.csv',
      ]) {
        expect(
          readFileSync(join(parallelDir, f), 'utf8'),
          `${f} diverged from serial`,
        ).toBe(readFileSync(join(serialDir, f), 'utf8'));
      }
      // The round-trip is internal: no results.json lands in the out dir
      // unless --emit-results was asked for, and the shard scratch is gone.
      expect(existsSync(join(parallelDir, 'results.json'))).toBe(false);
      expect(existsSync(join(parallelDir, 'shards'))).toBe(false);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 420_000);

  it('71a — the decisions.csv sidecar composes with --jobs, byte-identical to serial', () => {
    // The arbitrated arm's decision log rides RunResult through the 68e
    // round-trip; the parent writes decisions.csv via the serial writer's own
    // code path. Bare inner tier keeps the rollout cost test-sized — the
    // sidecar's shape is tier-independent — and the seed/hop overrides (arg
    // parsing is last-wins over the helper's defaults) size the batch to
    // arbitrated-run costs: 8 runs at --hops=3 sat AT the 200s child
    // timeout; 4 runs at --hops=2 measure ~19s serial.
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-jobs-decisions-'));
    const flags = ['--count=2', '--hops=2', '--arbitrate', '--arbitrate-tier=bare'];
    try {
      const serialDir = join(scratch, 'serial');
      const parallelDir = join(scratch, 'parallel');
      runCli(flags, serialDir);
      runCli([...flags, '--jobs=2'], parallelDir);

      for (const f of ['summary.csv', 'decisions.csv']) {
        expect(
          readFileSync(join(parallelDir, f), 'utf8'),
          `${f} diverged from serial`,
        ).toBe(readFileSync(join(serialDir, f), 'utf8'));
      }
      // Non-vacuous: the arm actually logged decisions (a header-only sidecar
      // would make the byte-identity above prove nothing).
      const lines = readFileSync(join(serialDir, 'decisions.csv'), 'utf8').trim().split('\n');
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]!.startsWith('seed,strategy,decision,site')).toBe(true);
      // The round-trip stays internal here too.
      expect(existsSync(join(parallelDir, 'results.json'))).toBe(false);
      expect(existsSync(join(parallelDir, 'shards'))).toBe(false);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 420_000);
});
