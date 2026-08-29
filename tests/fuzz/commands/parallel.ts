/**
 * 57f2 — run-mode parallelism (`--jobs=N` on a plain run): split the seed
 * range into contiguous chunks, spawn one UNMODIFIED run-mode child per
 * chunk (each writing to `<out>/shards/shard-K`), and merge the shards'
 * summary.csv + failure traces into the exact bytes a serial run writes.
 *
 * 86d3 — the chunks are FINER than the worker count (`CHUNK_FACTOR` × jobs,
 * still contiguous ascending) and flow through a worker POOL: at most
 * `jobs` children run at once, each worker pulling the next chunk index as
 * it frees up. The measured case (12 real box batches, per-seed ticks):
 * per-seed cost spreads 5.7–14.7× within one arm, so N static chunks run a
 * median ~1.15× the ideal makespan — the last worker straggles on a lucky
 * seed window — while dynamic assignment sits at ~1.05×, a median ~8% of
 * batch wall. Finer-chunks-not-per-seed because every child pays the tsx
 * import tax (~2–4 s): 4× jobs keeps ~80% of the balancing win at a
 * quarter of the spawn overhead — and spawn COUNT is itself the risk
 * surface (the 0xC0000142 class is literally spawn-under-load). The merge
 * is untouched: chunks are still contiguous ascending windows read in
 * index order, so byte-identity holds by construction (the parity pins in
 * parallelRun.test.ts exercise chunks > workers for free).
 *
 * Why the merge can be textual: summary.csv is PER-RUN rows (one line per
 * strategy × seed — reporters.renderSummaryCsv), and rows are independent, so
 * the serial file is a permutation of the shard files' rows. Serial order is
 * strategy-major (run.ts iterates strategies, then seeds ascending), so the
 * merge groups rows by strategy (canonical order = first appearance, shared
 * by every shard — each child runs the same registry order) and, within a
 * strategy, concatenates shards in chunk order (chunks are contiguous
 * ascending seed windows). Byte-identity with a serial run is PINNED by
 * parallelRun.test.ts — the property that makes --jobs safe for measurement
 * batches: parallelism changes wall-clock, never results.
 *
 * Children are full CLI invocations (argv pass-through minus the partitioning
 * flags), NOT a bespoke worker protocol — run mode's `--seed-offset`/`--count`
 * already express an arbitrary seed window, so the child IS the serial CLI
 * and inherits every current and future run-mode flag for free. The spawn
 * machinery (contiguous chunker + the Windows DLL-init-flake retry) is shared
 * with the H7c sweep sharding (searchShard.ts).
 *
 * Loud bails, not silent wrongness: `--seed` (a single pinned seed — nothing
 * to split) and `--k-telemetry` (a bespoke cross-run aggregate + print; run it
 * serially). The aggregate analyses `--per-hop`/`--per-layout`/
 * `--per-encounter` DO compose with --jobs since 68e via RunResult
 * round-tripping: each shard also dumps results.json (`--emit-results`,
 * injected here), the parent re-orders the merged results exactly as
 * mergeSummaries orders rows (strategy-major, chunk order within — so
 * float-sum order matches a serial run), and then runs run.ts's OWN
 * writeAggregateAnalyses over them — parity by shared code path, pinned in
 * parallelRun.test.ts. The serial console's per-strategy stats table is NOT
 * reproduced here — only file outputs carry the byte contract; the parent
 * prints raw per-strategy outcome counts read straight from the merged CSV.
 */

import { spawn } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readdirSync,
  renameSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chunkVectors,
  retryAsync,
  ShardError,
  classifyShardExit,
  isTransientShardError,
} from '../searchShard';
import { bail, range, type CliArgs } from './args';
import { writeAggregateAnalyses, writeDecisionsSidecar, writeTierFlips } from './run';
import { PARTITION_FLAG_PREFIXES, writeBatchManifest } from '../manifest';
import type { RunResult } from '../harness';

export type ParallelRunArgs = Pick<
  CliArgs,
  | 'count'
  | 'seed'
  | 'seedOffset'
  | 'jobs'
  | 'outDir'
  | 'perHop'
  | 'perLayout'
  | 'perEncounter'
  | 'emitResults'
  | 'kTelemetry'
  | 'arbitrate'
  | 'raw'
>;

const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.ts');

/** Flags the parent OWNS: stripped from the pass-through argv and re-issued
 *  per chunk. Everything else (arm flags, --strategy, --hops, --roster, …)
 *  flows to the children verbatim. 86e1: the ONE list lives in manifest.ts
 *  (the --merge-stages same-arm check strips the identical set). */
const PARTITION_FLAGS = PARTITION_FLAG_PREFIXES;

/** Same retry budget as searchShard: a big batch spawns many children, and
 *  Windows intermittently fails a fresh spawn under load (0xC0000142). */
const SHARD_ATTEMPTS = 3;

/** 86d3 — chunks per worker: the balancing-vs-spawn-tax dial (see header).
 *  4 keeps ~80% of the measured ~8% dynamic-queue win at a quarter of the
 *  per-seed spawn overhead. */
const CHUNK_FACTOR = 4;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function runParallelRunCli(args: ParallelRunArgs): Promise<void> {
  if (args.seed !== undefined) {
    bail('--jobs: --seed pins a SINGLE seed — nothing to split. Drop --jobs, or use --count/--seed-offset for a range.');
  }
  // 68e — the aggregate analyses ride RunResult round-tripping (see header).
  const wantsAggregates = args.perHop || args.perLayout || args.perEncounter;
  // 57g.5 — same shape: k-flips.csv + the aggregate print are cross-run
  // outputs the textual merge doesn't reproduce. The K arm runs serially
  // (detached on the box via box-batch.sh — its natural home).
  if (args.kTelemetry) {
    bail('--jobs: --k-telemetry writes a cross-run aggregate (k-flips.csv) the shard merge cannot reproduce — run it serially.');
  }

  const seeds = range(1 + (args.seedOffset ?? 0), args.count);
  const workers = Math.max(1, Math.floor(args.jobs ?? 1));
  // 86d3 — finer contiguous chunks through a bounded worker pool (see header).
  const chunks = chunkVectors(seeds, workers * CHUNK_FACTOR);
  const shardsDir = join(args.outDir, 'shards');
  const passthrough = process.argv
    .slice(2)
    .filter((a) => !PARTITION_FLAGS.some((f) => a === f || a.startsWith(f + '=')));

  process.stdout.write(
    `Parallel run: ${seeds.length} seed(s) across ${chunks.length} chunk(s) ` +
      `on ${Math.min(workers, chunks.length)} worker(s) ` +
      `[${chunks[0]![0]}..${chunks[chunks.length - 1]!.at(-1)}]…\n`,
  );

  rmSync(shardsDir, { recursive: true, force: true });
  mkdirSync(shardsDir, { recursive: true });
  // 71a — an arbitrated batch needs the round-trip too: decisions ride
  // RunResult, and the parent writes decisions.csv over the merged results
  // (the serial writer's own code path — byte parity by construction).
  const needResults = wantsAggregates || args.emitResults || args.arbitrate;
  const shardDirs = chunks.map((_, i) => join(shardsDir, `shard-${i}`));
  const runChunk = (i: number): Promise<void> =>
    retryAsync(
      () => spawnShardOnce(chunks[i]!, i, passthrough, shardDirs[i], needResults),
      SHARD_ATTEMPTS,
      async (attempt, err) => {
        process.stderr.write(
          `  chunk ${i} spawn failed (attempt ${attempt}/${SHARD_ATTEMPTS}), retrying: ` +
            `${String(err).split('\n')[0]}\n`,
        );
        await delay(1000 * attempt);
      },
      isTransientShardError,
    ).then(() => {
      process.stdout.write(`  chunk ${i} done (${chunks[i]!.length} seed(s))\n`);
    });
  // The pool: each worker pulls the next chunk INDEX as it frees up.
  // Completion order varies with wall clock; outputs are keyed by chunk
  // index (shard-i dirs) and merged in index order, so results never do.
  let nextChunk = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = nextChunk++;
      if (i >= chunks.length) return;
      await runChunk(i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(workers, chunks.length) }, worker));

  const merged = mergeSummaries(shardDirs);
  writeFileSync(join(args.outDir, 'summary.csv'), merged);

  // 86a — adopt the shards' timings.csv with the same strategy-major regroup,
  // so (seed, strategy) rows line up with summary.csv. The ms values are wall
  // clock and carry NO byte-parity contract (each shard timed its own runs) —
  // only the row keys/ordering are pinned (parallelRun.test.ts).
  if (shardDirs.every((d) => existsSync(join(d, 'timings.csv')))) {
    writeFileSync(join(args.outDir, 'timings.csv'), mergeSummaries(shardDirs, 'timings.csv'));
  }

  // 87a — the roster sidecar merges the same way; unlike timings its rows
  // are deterministic, so the merged file is byte-identical to serial
  // (pinned in parallelRun.test.ts).
  if (shardDirs.every((d) => existsSync(join(d, 'rosters.csv')))) {
    writeFileSync(join(args.outDir, 'rosters.csv'), mergeSummaries(shardDirs, 'rosters.csv'));
  }

  // 68e — the aggregate analyses over the round-tripped results (must run
  // before the shardsDir wipe below — the shard results.json files live there).
  if (needResults) {
    const mergedResults = mergeResults(shardDirs);
    if (args.emitResults) {
      writeFileSync(join(args.outDir, 'results.json'), JSON.stringify(mergedResults));
    }
    writeAggregateAnalyses(args, mergedResults);
    writeDecisionsSidecar(args.outDir, mergedResults);
    writeTierFlips(args.outDir, mergedResults);
  }

  // Mirror run.ts's failures/ semantics: wipe, then adopt every shard's traces
  // (filenames are `${slug(strategy)}-seed${seed}-${outcome}.md` — unique per
  // run, so cross-shard collisions are impossible).
  const failuresDir = join(args.outDir, 'failures');
  if (existsSync(failuresDir)) rmSync(failuresDir, { recursive: true, force: true });
  mkdirSync(failuresDir, { recursive: true });
  let failuresWritten = 0;
  for (const dir of shardDirs) {
    const shardFailures = join(dir, 'failures');
    if (!existsSync(shardFailures)) continue;
    for (const f of readdirSync(shardFailures)) {
      renameSync(join(shardFailures, f), join(failuresDir, f));
      failuresWritten++;
    }
  }
  rmSync(shardsDir, { recursive: true, force: true });

  // 86e1 — the parent owns the batch dir's manifest (each shard wrote one
  // into its scratch dir; those die with the shards wipe above).
  writeBatchManifest(args.outDir, {
    kind: 'jobs-parent',
    argv: args.raw ?? [],
    seedWindow: { firstSeed: seeds[0]!, count: seeds.length },
  });

  printOutcomeCounts(merged);
  process.stdout.write(
    `Wrote summary.csv and ${failuresWritten} failure trace(s) to ${args.outDir} ` +
      `(${chunks.length} chunk(s), jobs=${workers})\n`,
  );
}

function spawnShardOnce(
  chunkSeeds: readonly number[],
  index: number,
  passthrough: readonly string[],
  shardDir: string,
  emitResults: boolean,
): Promise<void> {
  const argv = [
    ...passthrough,
    `--count=${chunkSeeds.length}`,
    `--seed-offset=${chunkSeeds[0] - 1}`,
    `--out=${shardDir}`,
    ...(emitResults ? ['--emit-results'] : []),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', CLI_PATH, ...argv], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    // 86d1 — spawn `error` = environmental (transient); a non-zero exit code
    // = the CLI's own crash (deterministic, fail fast) except the win32
    // DLL-init flake; a signal kill = external (transient); missing
    // artifacts behind an exit 0 = a broken harness contract (deterministic).
    // See `classifyShardExit`.
    child.on('error', (e) => reject(new ShardError(`run shard ${index} spawn failed: ${String(e)}`, true)));
    child.on('exit', (code, signal) => {
      if (code !== 0) {
        const cls = classifyShardExit(code, signal);
        reject(new ShardError(`run shard ${index} ${cls.label}:\n${stderr}`, cls.transient));
        return;
      }
      if (!existsSync(join(shardDir, 'summary.csv'))) {
        reject(new ShardError(`run shard ${index} exited 0 but wrote no summary.csv\n${stderr}`, false));
        return;
      }
      if (emitResults && !existsSync(join(shardDir, 'results.json'))) {
        reject(new ShardError(`run shard ${index} exited 0 but wrote no results.json\n${stderr}`, false));
        return;
      }
      resolve();
    });
  });
}

/** Reassemble the serial summary.csv byte-for-byte from the shard files:
 *  header + rows regrouped strategy-major (shard order preserves ascending
 *  seeds within a strategy). Bails loudly if the regroup loses a row — that
 *  would mean a shard ran a strategy set the others didn't, which the
 *  identical-child-argv construction should make impossible.
 *  86d2 — exported: the staged-n merge (mergeStages.ts) is the same regroup
 *  over STAGE dirs (adjacent seed windows), and every per-run-row csv this
 *  harness writes shares the `seed,strategy,…` leading columns, so one
 *  regroup serves summary/timings/decisions/tier-flips/k-flips alike. */
export function mergeSummaries(shardDirs: readonly string[], file = 'summary.csv'): string {
  const perShard = shardDirs.map((d) => {
    const lines = readFileSync(join(d, file), 'utf8').split('\n');
    return { header: lines[0], rows: lines.slice(1).filter((l) => l.length > 0) };
  });
  const strategyOf = (row: string): string => row.split(',')[1];
  const order: string[] = [];
  for (const r of perShard[0].rows) {
    const s = strategyOf(r);
    if (!order.includes(s)) order.push(s);
  }
  const mergedRows: string[] = [];
  for (const s of order) {
    for (const shard of perShard) {
      for (const r of shard.rows) if (strategyOf(r) === s) mergedRows.push(r);
    }
  }
  const totalRows = perShard.reduce((acc, s) => acc + s.rows.length, 0);
  if (mergedRows.length !== totalRows) {
    bail(
      `--jobs merge lost rows (${mergedRows.length}/${totalRows}) — shard strategy sets diverged; shards left in place for inspection.`,
    );
  }
  return [perShard[0].header, ...mergedRows].join('\n') + '\n';
}

/** 68e — reassemble the serial `allResults` array from the shard results.json
 *  dumps: the SAME regroup as `mergeSummaries` (strategy-major by first
 *  appearance, chunk order within a strategy), so aggregate float summation
 *  runs in serial order and the analysis CSVs come out byte-identical. */
function mergeResults(shardDirs: readonly string[]): RunResult[] {
  const perShard = shardDirs.map(
    (d) => JSON.parse(readFileSync(join(d, 'results.json'), 'utf8')) as RunResult[],
  );
  const order: string[] = [];
  for (const r of perShard[0]) {
    if (!order.includes(r.strategyName)) order.push(r.strategyName);
  }
  const merged: RunResult[] = [];
  for (const s of order) {
    for (const shard of perShard) {
      for (const r of shard) if (r.strategyName === s) merged.push(r);
    }
  }
  const total = perShard.reduce((acc, s) => acc + s.length, 0);
  if (merged.length !== total) {
    bail(
      `--jobs results merge lost runs (${merged.length}/${total}) — shard strategy sets diverged; shards left in place for inspection.`,
    );
  }
  return merged;
}

/** Raw per-strategy outcome counts from the merged CSV (columns: seed,
 *  strategy, daemon, outcome, …) — informational only; the serial console's
 *  aggregate table stays serial-mode-only. */
function printOutcomeCounts(mergedCsv: string): void {
  const rows = mergedCsv.split('\n').slice(1).filter((l) => l.length > 0);
  const byStrategy = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const cols = r.split(',');
    const counts = byStrategy.get(cols[1]) ?? {};
    counts[cols[3]] = (counts[cols[3]] ?? 0) + 1;
    byStrategy.set(cols[1], counts);
  }
  process.stdout.write('\n');
  for (const [strategy, counts] of byStrategy) {
    const runs = Object.values(counts).reduce((a, b) => a + b, 0);
    process.stdout.write(`### ${strategy}\n  runs: ${runs}\n  by outcome: ${JSON.stringify(counts)}\n\n`);
  }
}
