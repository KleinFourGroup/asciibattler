/**
 * H7c parallelism — vector-level sharding for the balance sweep.
 *
 * The expensive per-grid-point work is evaluating the search's `vectors` weight
 * vectors over the train seeds at full run length. Those evaluations are
 * embarrassingly parallel and CPU-bound, so we offload them to child processes:
 * the parent generates the deterministic vector list (`generateVectors`), splits
 * it into `jobs` contiguous chunks, and spawns one `--eval-shard` child per chunk
 * (`node --import tsx cli.ts …`). Each child re-applies the grid point's config
 * (it's a fresh process — no shared memory; this is exactly why BALANCE.md picks
 * processes over worker_threads) and returns its slice's win rates. The parent
 * concatenates them back into index order.
 *
 * Determinism: the PARENT owns vector generation; children are pure evaluators of
 * an explicit (vector, seeds, config) triple. So sharded win rates are identical
 * to single-process — `--jobs` only changes wall-clock, never results.
 *
 * Concurrency is bounded by the chunk count = `min(jobs, vectors)`, so `--jobs=8`
 * runs at most 8 children at once (the rest of the machine stays free).
 */

import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScoredWeights } from './strategies/scoredWeights';
import type { RosterEntry } from '../../src/run/RunConfig';
import type { ObjectiveProclivity } from './objectiveStrategy';

/** The job handed to one `--eval-shard` child (written as JSON to a temp file).
 *  `knobs` are the grid point's config overrides (empty `{}` means no override);
 *  `floorCount` is the already-resolved run length (tier default or `--floors`).
 *  `objective` (J4) is the fixed objective proclivity the child's runs drive,
 *  or undefined for none — a plain JSON object, so it round-trips the temp file. */
export interface ShardJob {
  readonly knobs: Record<string, number>;
  readonly vectors: readonly ScoredWeights[];
  readonly seeds: readonly number[];
  readonly floorCount?: number;
  readonly roster?: readonly RosterEntry[];
  readonly objective?: ObjectiveProclivity;
}

/**
 * Split `items` into `min(jobs, items.length)` contiguous chunks, as even as
 * possible (the first `n % parts` chunks get one extra). Contiguous + in-order so
 * concatenating the chunks' results reconstructs the original index order.
 */
export function chunkVectors<T>(items: readonly T[], jobs: number): T[][] {
  const n = items.length;
  const parts = Math.max(1, Math.min(Math.floor(jobs), n || 1));
  const base = Math.floor(n / parts);
  const extra = n % parts;
  const out: T[][] = [];
  let i = 0;
  for (let p = 0; p < parts; p++) {
    const size = base + (p < extra ? 1 : 0);
    out.push(items.slice(i, i + size));
    i += size;
  }
  return out;
}

const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), 'cli.ts');

function runChunk(
  chunk: readonly ScoredWeights[],
  index: number,
  base: Omit<ShardJob, 'vectors'>,
  tmpDir: string,
): Promise<number[]> {
  const jobFile = join(tmpDir, `job-${index}.json`);
  const outFile = join(tmpDir, `out-${index}.json`);
  const job: ShardJob = { ...base, vectors: chunk };
  writeFileSync(jobFile, JSON.stringify(job));

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', CLI_PATH, '--eval-shard', `--job=${jobFile}`, `--out-file=${outFile}`],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`eval-shard ${index} exited with code ${code}:\n${stderr}`));
        return;
      }
      try {
        const parsed = JSON.parse(readFileSync(outFile, 'utf8')) as { winRates: number[] };
        resolve(parsed.winRates);
      } catch (e) {
        reject(new Error(`eval-shard ${index} produced no/invalid output: ${String(e)}\n${stderr}`));
      }
    });
  });
}

export interface ShardedEvalParams {
  readonly vectors: readonly ScoredWeights[];
  readonly seeds: readonly number[];
  readonly knobs: Record<string, number>;
  readonly floorCount?: number;
  readonly roster?: readonly RosterEntry[];
  /** J4 — the fixed objective proclivity the children's runs drive (or none). */
  readonly objective?: ObjectiveProclivity;
  readonly jobs: number;
  /** Scratch dir for the per-chunk job/result JSON; created + removed here. */
  readonly tmpDir: string;
}

/**
 * Evaluate every vector over `seeds` at the given config point, fanned out across
 * `jobs` child processes. Returns win rates aligned to `vectors` (index order).
 * Rejects if any child fails (its stderr is surfaced in the error).
 */
export async function evaluateVectorsSharded(params: ShardedEvalParams): Promise<number[]> {
  const { vectors, seeds, knobs, floorCount, roster, objective, jobs, tmpDir } = params;
  const chunks = chunkVectors(vectors, jobs);
  mkdirSync(tmpDir, { recursive: true });
  try {
    const base: Omit<ShardJob, 'vectors'> = { knobs, seeds, floorCount, roster, objective };
    const perChunk = await Promise.all(
      chunks.map((chunk, i) => runChunk(chunk, i, base, tmpDir)),
    );
    return perChunk.flat();
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
