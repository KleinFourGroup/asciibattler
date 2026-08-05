/**
 * 57f2/71a — the decisions.csv `--jobs` parity pin, split out of
 * `parallelRun.test.ts` at 73b: each parity case spawns real serial+parallel
 * CLI child processes (~65s for this one), and three together pinned one file
 * at ~129s — the suite's tail. Same test, byte-identical assertions; only the
 * file boundary moved. The runCli helper is duplicated from the sibling file
 * (12 lines — below the extraction threshold).
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
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

describe('run-mode --jobs parity — the decisions sidecar', () => {
  it('71a — the decisions.csv sidecar composes with --jobs, byte-identical to serial', () => {
    // The arbitrated arm's decision log rides RunResult through the 68e
    // round-trip; the parent writes decisions.csv via the serial writer's own
    // code path. Bare inner tier keeps the rollout cost test-sized — the
    // sidecar's shape is tier-independent — and the seed/hop overrides (arg
    // parsing is last-wins over the helper's defaults) size the batch to
    // arbitrated-run costs: 8 runs at --hops=3 sat AT the 200s child
    // timeout; 4 runs at --hops=2 measure ~19s serial.
    // 71c rides along: the traffic shadow on a bare primary keeps the dual-
    // tier cost near-bare (the 69c pricing) while making tier-flips.csv
    // non-vacuously present for the parity check below.
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-jobs-decisions-'));
    const flags = [
      '--count=2',
      '--hops=2',
      '--arbitrate',
      '--arbitrate-tier=bare',
      '--flip-telemetry=traffic',
    ];
    try {
      const serialDir = join(scratch, 'serial');
      const parallelDir = join(scratch, 'parallel');
      runCli(flags, serialDir);
      runCli([...flags, '--jobs=2'], parallelDir);

      for (const f of ['summary.csv', 'decisions.csv', 'tier-flips.csv']) {
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
