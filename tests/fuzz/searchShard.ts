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
import type { RedrawPolicy } from './redrawPolicy';
import type { EmpowerPolicy } from './empowerPolicy';
import type { DaemonSelection } from './daemonSelection';
import type { CharacterSelection } from './characterSelection';

/** The job handed to one `--eval-shard` child (written as JSON to a temp file).
 *  `knobs` are the grid point's config overrides (empty `{}` means no override);
 *  `hopCount` is the already-resolved run length (tier default or `--hops`).
 *  `objective` (J4) / `redraw` (K3c3) / `empower` (K4c3) / `daemon` (L1c3) are
 *  the fixed objective proclivity / redraw policy / empower policy / daemon
 *  arm the child's runs drive, or undefined for none — plain JSON objects, so
 *  they round-trip the temp file. */
export interface ShardJob {
  readonly knobs: Record<string, number>;
  readonly vectors: readonly ScoredWeights[];
  readonly seeds: readonly number[];
  // These optionals carry `undefined` to mean "none" (built by destructuring
  // ShardedEvalParams' own optionals), so they're declared `?: T | undefined` —
  // under exactOptionalPropertyTypes that permits both absent AND explicit
  // undefined, which is what the literal at `evaluateVectorsSharded` provides.
  readonly hopCount?: number | undefined;
  /** 68b — the 67c shortened-full-walk dial (mutually exclusive with
   *  `hopCount`; the caller resolves exclusivity before building jobs). */
  readonly sectorHops?: number | undefined;
  readonly roster?: readonly RosterEntry[] | undefined;
  /** M6/N2 — the forced layout id / `procedural` sentinel the child's runs use
   *  (plain string, round-trips the job file), or undefined for the normal roll. */
  readonly forcedLayoutId?: string | undefined;
  /** X2 — the forced encounter id the child's runs use (or undefined). */
  readonly forcedEncounterId?: string | undefined;
  readonly objective?: ObjectiveProclivity | undefined;
  readonly redraw?: RedrawPolicy | undefined;
  readonly empower?: EmpowerPolicy | undefined;
  readonly daemon?: DaemonSelection | undefined;
  /** 63d — the character arm the child's runs carry (plain JSON, round-trips
   *  the job file; absent = the harness's explicit Soldier default). */
  readonly character?: CharacterSelection | undefined;
  /** 59e — the searcher arm as FLAGS (the resolved registry isn't JSON-safe;
   *  the child re-resolves via `searcherFromArgs`, the shared resolver, so
   *  sharded runs drive the identical arm as the parent/run mode). */
  readonly searcher?: boolean | undefined;
  readonly searcherSpec?: string | undefined;
  readonly audition?: boolean | undefined;
  readonly k?: number | undefined;
  /** 85g3 — the arbitrated arm as FLAGS (the same 59e discipline as
   *  `searcher` above): the child re-resolves via `arbitratedWrapFromArgs`
   *  — the resolver run mode uses — so a sharded search drives the
   *  identical arm byte-for-byte. The prior table (λ ≠ 0) loads from the
   *  committed file in-process, deterministic across shards. */
  readonly arbitrate?: boolean | undefined;
  readonly arbitrateTier?: string | undefined;
  readonly priorLambda?: number | undefined;
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

/** How many times to (re)try spawning a shard child before giving up. A
 *  multi-point heavy/overnight sweep spawns hundreds of children, and Windows
 *  intermittently fails a fresh spawn under that load with `0xC0000142`
 *  (STATUS_DLL_INIT_FAILED) — a TRANSIENT, non-deterministic failure that a
 *  retry clears. Without this, one flaky spawn nukes the whole 40-min run. A
 *  REAL (deterministic) failure still surfaces after the attempts are spent.
 *  86d1: and now surfaces IMMEDIATELY — see `classifyShardExit`. */
const SHARD_ATTEMPTS = 3;

/**
 * 86d1 — a shard-child failure carrying its transient/deterministic class.
 * The cut falls out of determinism itself: the sim is deterministic, so any
 * failure the CHILD PROCESS reports (a non-zero exit code — its own crash
 * speaking; a missing or unparseable artifact behind an exit 0) reproduces
 * on an identical retry, while only ENVIRONMENT failures (the spawn never
 * starting, an external kill) can clear. Retrying a deterministic failure
 * re-runs a multi-minute shard twice more before the inevitable — the 86
 * kickoff-audit finding this class closes.
 */
export class ShardError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = 'ShardError';
  }
}

/** Windows STATUS_DLL_INIT_FAILED — the one case where the ENVIRONMENT
 *  speaks through an exit code (DLL init failing under spawn load). Node
 *  reports it unsigned (3221225794); the signed twin is accepted for
 *  robustness across runtimes. Platform-gated: on the Ubuntu box this
 *  value would be a genuine CLI exit code, so it stays deterministic there. */
const WIN_DLL_INIT_FAILED = 0xc0000142;

/**
 * 86d1 — classify a shard child's exit. Signal-based, cross-platform:
 *   - exit BY SIGNAL (`code === null`) → TRANSIENT: the child was killed
 *     from outside (OOM killer, operator) — environmental on any OS.
 *     (Pre-86d1 this case rejected as "exited with code null" and was
 *     retried by accident rather than by design.)
 *   - `0xC0000142`, on win32 only → TRANSIENT (the documented spawn-load
 *     DLL-init flake this retry machinery was built for).
 *   - any other non-zero code → DETERMINISTIC: the CLI's own crash, which
 *     determinism reproduces on retry. Fail fast.
 * The spawn `error` event (child never started — EAGAIN/EMFILE class) is
 * classified transient at the call sites; artifact failures behind an
 * exit 0 are deterministic there too.
 */
export function classifyShardExit(
  code: number | null,
  signal: NodeJS.Signals | null,
  platform: NodeJS.Platform = process.platform,
): { transient: boolean; label: string } {
  if (code === null) {
    return { transient: true, label: `killed by signal ${signal ?? '(unknown)'}` };
  }
  if (platform === 'win32' && (code === WIN_DLL_INIT_FAILED || code === WIN_DLL_INIT_FAILED - 0x100000000)) {
    return { transient: true, label: `exited 0xC0000142 (DLL init flake)` };
  }
  return { transient: false, label: `exited with code ${code}` };
}

/** 86d1 — the `retryable` predicate both shard drivers pass to `retryAsync`:
 *  a `ShardError` carries its own class; anything else (the spawn `error`
 *  event's raw Node error, unexpected throws) stays retryable — the
 *  pre-86d1 behavior, safe because a retry of a genuine transient is the
 *  point and a retry of the unknown costs at most the old behavior. */
export function isTransientShardError(err: unknown): boolean {
  return err instanceof ShardError ? err.transient : true;
}

/**
 * Run `fn` up to `attempts` times, returning the first success. `onRetry` runs
 * between a failed attempt and the next (e.g. a backoff delay + a log line); it
 * does NOT run after the final attempt. Re-throws the last error if all attempts
 * fail. Pure (no timers of its own) so it unit-tests without fake clocks — the
 * caller owns any delay via `onRetry`.
 *
 * 86d1 — `retryable`: when provided and it returns false for a failure, that
 * failure re-throws IMMEDIATELY (no further attempts, no onRetry) — the
 * deterministic-failure fast path. Absent = every failure retries (the
 * pre-86d1 behavior, kept for callers without a classification).
 */
export async function retryAsync<T>(
  fn: (attempt: number) => Promise<T>,
  attempts: number,
  onRetry?: (attempt: number, err: unknown) => void | Promise<void>,
  retryable?: (err: unknown) => boolean,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (retryable !== undefined && !retryable(err)) throw err;
      if (attempt < attempts) await onRetry?.(attempt, err);
    }
  }
  throw lastErr;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function spawnChunkOnce(
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
    // 86d1 — the spawn never started: environmental, transient on any OS.
    child.on('error', (e) => reject(new ShardError(`eval-shard ${index} spawn failed: ${String(e)}`, true)));
    child.on('exit', (code, signal) => {
      if (code !== 0) {
        const cls = classifyShardExit(code, signal);
        reject(new ShardError(`eval-shard ${index} ${cls.label}:\n${stderr}`, cls.transient));
        return;
      }
      try {
        const parsed = JSON.parse(readFileSync(outFile, 'utf8')) as { winRates: number[] };
        resolve(parsed.winRates);
      } catch (e) {
        // 86d1 — exit 0 with a broken artifact: the harness contract failed,
        // which determinism reproduces. Fail fast.
        reject(
          new ShardError(`eval-shard ${index} produced no/invalid output: ${String(e)}\n${stderr}`, false),
        );
      }
    });
  });
}

/** Spawn one shard child, retrying TRANSIENT failures only (spawn errors,
 *  signal kills, the win32 DLL-init flake — `classifyShardExit`) up to
 *  `SHARD_ATTEMPTS` times with a short backoff; a DETERMINISTIC failure
 *  (the CLI's own crash / broken artifact) re-throws immediately (86d1). */
function runChunk(
  chunk: readonly ScoredWeights[],
  index: number,
  base: Omit<ShardJob, 'vectors'>,
  tmpDir: string,
): Promise<number[]> {
  return retryAsync(
    () => spawnChunkOnce(chunk, index, base, tmpDir),
    SHARD_ATTEMPTS,
    async (attempt, err) => {
      process.stderr.write(
        `  shard ${index} spawn failed (attempt ${attempt}/${SHARD_ATTEMPTS}), retrying: ` +
          `${String(err).split('\n')[0]}\n`,
      );
      await delay(1000 * attempt);
    },
    isTransientShardError,
  );
}

export interface ShardedEvalParams {
  readonly vectors: readonly ScoredWeights[];
  readonly seeds: readonly number[];
  readonly knobs: Record<string, number>;
  // `?: T | undefined` (not bare `?: T`) — these optionals are passed an explicit
  // `undefined` for "none" by the sweep/search callers, which exactOptional
  // forbids on a bare optional. Mirrors ShardJob above.
  readonly hopCount?: number | undefined;
  /** 68b — the shortened-full-walk dial (or none; excludes `hopCount`). */
  readonly sectorHops?: number | undefined;
  readonly roster?: readonly RosterEntry[] | undefined;
  /** M6/N2 — the forced layout id / `procedural` sentinel (or none). */
  readonly forcedLayoutId?: string | undefined;
  /** X2 — the forced encounter id the children's runs use (or none). */
  readonly forcedEncounterId?: string | undefined;
  /** J4 — the fixed objective proclivity the children's runs drive (or none). */
  readonly objective?: ObjectiveProclivity | undefined;
  /** K3c3 — the fixed redraw policy the children's runs drive (or none). */
  readonly redraw?: RedrawPolicy | undefined;
  /** K4c3 — the fixed empower policy the children's runs drive (or none). */
  readonly empower?: EmpowerPolicy | undefined;
  /** L1c3 — the fixed daemon arm the children's runs carry (or random). */
  readonly daemon?: DaemonSelection | undefined;
  /** 63d — the character arm the children's runs carry (or the Soldier). */
  readonly character?: CharacterSelection | undefined;
  /** 59e — the searcher arm flags (see ShardJob). */
  readonly searcher?: boolean | undefined;
  readonly searcherSpec?: string | undefined;
  readonly audition?: boolean | undefined;
  readonly k?: number | undefined;
  /** 85g3 — the arbitrated arm flags (see ShardJob). */
  readonly arbitrate?: boolean | undefined;
  readonly arbitrateTier?: string | undefined;
  readonly priorLambda?: number | undefined;
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
  const {
    vectors,
    seeds,
    knobs,
    hopCount,
    sectorHops,
    roster,
    forcedLayoutId,
    forcedEncounterId,
    objective,
    redraw,
    empower,
    daemon,
    character,
    searcher,
    searcherSpec,
    audition,
    k,
    arbitrate,
    arbitrateTier,
    priorLambda,
    jobs,
    tmpDir,
  } = params;
  const chunks = chunkVectors(vectors, jobs);
  mkdirSync(tmpDir, { recursive: true });
  try {
    const base: Omit<ShardJob, 'vectors'> = {
      knobs,
      seeds,
      hopCount,
      sectorHops,
      roster,
      forcedLayoutId,
      forcedEncounterId,
      objective,
      redraw,
      empower,
      daemon,
      character,
      searcher,
      searcherSpec,
      audition,
      k,
      arbitrate,
      arbitrateTier,
      priorLambda,
    };
    const perChunk = await Promise.all(chunks.map((chunk, i) => runChunk(chunk, i, base, tmpDir)));
    return perChunk.flat();
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
