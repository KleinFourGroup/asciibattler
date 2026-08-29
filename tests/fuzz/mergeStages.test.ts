/**
 * 86d2 — the staged-n merge pins. Two layers:
 *
 *  1. THE ORACLE (real spawns, the parallelRun.test.ts idiom): a serial
 *     n=12 run vs an n=4 + n=8 staged pair merged — summary.csv must be
 *     BYTE-IDENTICAL, timings.csv must carry the serial keys/ordering,
 *     failures/ must match. This is the whole contract: a merged staged
 *     batch is indistinguishable from the serial run the board thinks it
 *     is reading.
 *
 *  2. The guard pins (synthetic dirs, no spawns): overlap, gap, mixed
 *     sidecars, arm mismatch, missing --out — each bails loudly.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { readBatchManifest, writeBatchManifest } from './manifest';

const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), 'cli.ts');

function runCli(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, ['--import', 'tsx', CLI_PATH, ...args], {
    encoding: 'utf8',
    timeout: 200_000,
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('--merge-stages: the serial-equivalence oracle', () => {
  it('an n=4 + n=8 staged pair merges byte-identical to a serial n=12', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-merge-stages-'));
    try {
      const serialDir = join(scratch, 'serial');
      const stageA = join(scratch, 'stageA');
      const stageB = join(scratch, 'stageB');
      const mergedDir = join(scratch, 'merged');
      for (const [dir, extra] of [
        [serialDir, ['--count=12']],
        [stageA, ['--count=4']],
        [stageB, ['--count=8', '--seed-offset=4']],
      ] as const) {
        const r = runCli(['--hops=3', `--out=${dir}`, ...extra]);
        expect(r.status, `run failed:\n${r.stderr}`).toBe(0);
      }

      const merge = runCli([`--merge-stages=${stageA},${stageB}`, `--out=${mergedDir}`]);
      expect(merge.status, `merge failed:\n${merge.stderr}`).toBe(0);

      // summary.csv: the byte contract.
      expect(readFileSync(join(mergedDir, 'summary.csv'), 'utf8')).toBe(
        readFileSync(join(serialDir, 'summary.csv'), 'utf8'),
      );
      // timings.csv: serial keys + ordering (ms values are wall clock).
      const keyCols = (csv: string): string[] =>
        csv.trim().split('\n').slice(1).map((l) => l.split(',').slice(0, 2).join(','));
      expect(keyCols(readFileSync(join(mergedDir, 'timings.csv'), 'utf8'))).toEqual(
        keyCols(readFileSync(join(serialDir, 'summary.csv'), 'utf8')),
      );
      // failures/: same trace set, same bytes.
      const traces = (dir: string): string[] =>
        existsSync(join(dir, 'failures')) ? readdirSync(join(dir, 'failures')).sort() : [];
      const serialTraces = traces(serialDir);
      expect(traces(mergedDir)).toEqual(serialTraces);
      for (const f of serialTraces) {
        expect(readFileSync(join(mergedDir, 'failures', f), 'utf8')).toBe(
          readFileSync(join(serialDir, 'failures', f), 'utf8'),
        );
      }
      // The stage dirs are archives — untouched by the merge.
      expect(existsSync(join(stageA, 'summary.csv'))).toBe(true);
      expect(traces(stageA).length + traces(stageB).length).toBe(serialTraces.length);
      // 86e1 — real CLI runs write manifests, and the merge derives its own:
      // the stages' common head (this repo's), over the union window.
      const merged = readBatchManifest(mergedDir);
      expect(merged?.kind).toBe('merge-stages');
      expect(merged?.seedWindow).toEqual({ firstSeed: 1, count: 12 });
      expect(merged?.head).toMatch(/^[0-9a-f]{40}$/);
      expect(merged?.head).toBe(readBatchManifest(stageA)?.head);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 420_000);
});

describe('--merge-stages: the guards (synthetic dirs)', () => {
  const HEADER = 'seed,strategy,daemon,outcome';
  /** A minimal fake stage dir: summary.csv over `seeds`, optional extras. */
  function fakeStage(
    root: string,
    name: string,
    seeds: readonly number[],
    opts: {
      args?: string;
      decisions?: boolean;
      strategy?: string;
      manifest?: { head: string | null; argv: readonly string[] };
    } = {},
  ): string {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    const strat = opts.strategy ?? 'scored';
    writeFileSync(
      join(dir, 'summary.csv'),
      [HEADER, ...seeds.map((s) => `${s},${strat},mars,complete`)].join('\n') + '\n',
    );
    if (opts.args !== undefined) writeFileSync(join(dir, 'args'), opts.args);
    if (opts.manifest !== undefined) {
      writeBatchManifest(dir, {
        kind: 'run',
        argv: opts.manifest.argv,
        seedWindow: { firstSeed: seeds[0]!, count: seeds.length },
        provenance: {
          head: opts.manifest.head,
          dirty: opts.manifest.head === null ? null : false,
        },
      });
    }
    if (opts.decisions) {
      writeFileSync(
        join(dir, 'decisions.csv'),
        ['seed,strategy,decision,site', ...seeds.map((s) => `${s},${strat},0,portBuy`)].join('\n') + '\n',
      );
    }
    return dir;
  }

  function mergeExpectFail(stages: readonly string[], out: string, needle: string): void {
    const r = runCli([`--merge-stages=${stages.join(',')}`, `--out=${out}`]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain(needle);
  }

  it('merges disjoint contiguous windows and regroups per-run-row sidecars', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-merge-guards-'));
    try {
      // Deliberately pass the LATER window first — the merge must order by seed.
      const b = fakeStage(scratch, 'b', [3, 4, 5], { decisions: true });
      const a = fakeStage(scratch, 'a', [1, 2], { decisions: true });
      writeFileSync(join(a, 'batch.log'), 'box bookkeeping\n'); // must be LISTED, not silently dropped
      const out = join(scratch, 'out');
      const r = runCli([`--merge-stages=${b},${a}`, `--out=${out}`]);
      expect(r.status, r.stderr).toBe(0);
      expect(readFileSync(join(out, 'summary.csv'), 'utf8')).toBe(
        [HEADER, '1,scored,mars,complete', '2,scored,mars,complete', '3,scored,mars,complete', '4,scored,mars,complete', '5,scored,mars,complete'].join('\n') + '\n',
      );
      expect(readFileSync(join(out, 'decisions.csv'), 'utf8').trim().split('\n')).toHaveLength(6);
      // Bookkeeping files are listed as not-merged, never silently dropped.
      expect(r.stdout).toContain('NOT merged');
      expect(r.stdout).toContain('batch.log');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);

  it('bails on overlapping windows', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-merge-guards-'));
    try {
      const a = fakeStage(scratch, 'a', [1, 2, 3]);
      const b = fakeStage(scratch, 'b', [3, 4]);
      mergeExpectFail([a, b], join(scratch, 'out'), 'OVERLAP');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);

  it('bails on a seed gap', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-merge-guards-'));
    try {
      const a = fakeStage(scratch, 'a', [1, 2]);
      const b = fakeStage(scratch, 'b', [5, 6]);
      mergeExpectFail([a, b], join(scratch, 'out'), 'gap');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);

  it('bails on a sidecar present in only some stages', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-merge-guards-'));
    try {
      const a = fakeStage(scratch, 'a', [1, 2], { decisions: true });
      const b = fakeStage(scratch, 'b', [3, 4]);
      mergeExpectFail([a, b], join(scratch, 'out'), 'decisions.csv present in 1/2');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);

  it('bails when box args records differ beyond the partition flags', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-merge-guards-'));
    try {
      const a = fakeStage(scratch, 'a', [1, 2], { args: '--count=2 --searcher --jobs=8' });
      const b = fakeStage(scratch, 'b', [3, 4], {
        args: '--count=2 --seed-offset=2 --searcher --arbitrate --jobs=8',
      });
      mergeExpectFail([a, b], join(scratch, 'out'), 'not the same arm');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);

  it('86e1 — bails when stage manifests name DIFFERENT heads (the same-HEAD rule)', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-merge-guards-'));
    try {
      const a = fakeStage(scratch, 'a', [1, 2], { manifest: { head: 'a'.repeat(40), argv: ['--searcher'] } });
      const b = fakeStage(scratch, 'b', [3, 4], { manifest: { head: 'b'.repeat(40), argv: ['--searcher'] } });
      mergeExpectFail([a, b], join(scratch, 'out'), 'DIFFERENT heads');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);

  it('86e1 — bails when stage manifests name different arms (partition flags stripped)', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-merge-guards-'));
    try {
      const head = 'c'.repeat(40);
      const a = fakeStage(scratch, 'a', [1, 2], { manifest: { head, argv: ['--count=2', '--searcher'] } });
      const b = fakeStage(scratch, 'b', [3, 4], {
        manifest: { head, argv: ['--count=2', '--seed-offset=2', '--searcher', '--arbitrate'] },
      });
      mergeExpectFail([a, b], join(scratch, 'out'), 'different arms');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);

  it('86e1 — a stage WITHOUT a manifest merges (pre-86e1 archives) but the merged provenance is null', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-merge-guards-'));
    try {
      const a = fakeStage(scratch, 'a', [1, 2], { manifest: { head: 'd'.repeat(40), argv: ['--searcher'] } });
      const b = fakeStage(scratch, 'b', [3, 4]); // no manifest
      const out = join(scratch, 'out');
      const r = runCli([`--merge-stages=${a},${b}`, `--out=${out}`]);
      expect(r.status, r.stderr).toBe(0);
      const merged = readBatchManifest(out);
      expect(merged?.kind).toBe('merge-stages');
      expect(merged?.head).toBeNull();
      expect(merged?.dirty).toBeNull();
      expect(merged?.seedWindow).toEqual({ firstSeed: 1, count: 4 });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);

  it('bails without an explicit --out', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'fuzz-merge-guards-'));
    try {
      const a = fakeStage(scratch, 'a', [1, 2]);
      const b = fakeStage(scratch, 'b', [3, 4]);
      const r = runCli([`--merge-stages=${a},${b}`]);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('explicit --out');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);
});
