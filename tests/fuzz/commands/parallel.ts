/**
 * 57f2 — run-mode parallelism (`--jobs=N` on a plain run): split the seed
 * range into N contiguous chunks, spawn one UNMODIFIED run-mode child per
 * chunk (each writing to `<out>/shards/shard-K`), and merge the shards'
 * summary.csv + failure traces into the exact bytes a serial run writes.
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
 * to split) and the aggregate analyses `--per-hop`/`--per-layout`/
 * `--per-encounter` (their CSVs are cross-run aggregates a textual merge
 * can't reproduce; run those serially, or add RunResult round-tripping if
 * they ever need jobs). The serial console's per-strategy stats table is NOT
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
import { chunkVectors, retryAsync } from '../searchShard';
import { bail, range, type CliArgs } from './args';

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
  | 'kTelemetry'
>;

const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.ts');

/** Flags the parent OWNS: stripped from the pass-through argv and re-issued
 *  per chunk. Everything else (arm flags, --strategy, --hops, --roster, …)
 *  flows to the children verbatim. */
const PARTITION_FLAGS = ['--jobs', '--count', '--seed-offset', '--out'];

/** Same retry budget as searchShard: a big batch spawns many children, and
 *  Windows intermittently fails a fresh spawn under load (0xC0000142). */
const SHARD_ATTEMPTS = 3;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function runParallelRunCli(args: ParallelRunArgs): Promise<void> {
  if (args.seed !== undefined) {
    bail('--jobs: --seed pins a SINGLE seed — nothing to split. Drop --jobs, or use --count/--seed-offset for a range.');
  }
  if (args.perHop || args.perLayout || args.perEncounter) {
    bail('--jobs: the aggregate analyses (--per-hop / --per-layout / --per-encounter) are cross-run aggregates the shard merge cannot reproduce — run them serially.');
  }
  // 57g.5 — same shape: k-flips.csv + the aggregate print are cross-run
  // outputs the textual merge doesn't reproduce. The K arm runs serially
  // (detached on the box via box-batch.sh — its natural home).
  if (args.kTelemetry) {
    bail('--jobs: --k-telemetry writes a cross-run aggregate (k-flips.csv) the shard merge cannot reproduce — run it serially.');
  }

  const seeds = range(1 + (args.seedOffset ?? 0), args.count);
  const chunks = chunkVectors(seeds, args.jobs ?? 1);
  const shardsDir = join(args.outDir, 'shards');
  const passthrough = process.argv
    .slice(2)
    .filter((a) => !PARTITION_FLAGS.some((f) => a === f || a.startsWith(f + '=')));

  process.stdout.write(
    `Parallel run: ${seeds.length} seed(s) across ${chunks.length} job(s) ` +
      `[${chunks.map((c) => `${c[0]}..${c[c.length - 1]}`).join(', ')}]…\n`,
  );

  rmSync(shardsDir, { recursive: true, force: true });
  mkdirSync(shardsDir, { recursive: true });
  const shardDirs = chunks.map((_, i) => join(shardsDir, `shard-${i}`));
  await Promise.all(
    chunks.map((chunk, i) =>
      retryAsync(
        () => spawnShardOnce(chunk, i, passthrough, shardDirs[i]),
        SHARD_ATTEMPTS,
        async (attempt, err) => {
          process.stderr.write(
            `  shard ${i} spawn failed (attempt ${attempt}/${SHARD_ATTEMPTS}), retrying: ` +
              `${String(err).split('\n')[0]}\n`,
          );
          await delay(1000 * attempt);
        },
      ).then(() => {
        process.stdout.write(`  shard ${i} done (${chunk.length} seed(s))\n`);
      }),
    ),
  );

  const merged = mergeSummaries(shardDirs);
  writeFileSync(join(args.outDir, 'summary.csv'), merged);

  // Mirror run.ts's failures/ semantics: wipe, then adopt every shard's traces
  // (filenames are `${strategy}-seed${seed}-${outcome}.md` — unique per run,
  // so cross-shard collisions are impossible).
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

  printOutcomeCounts(merged);
  process.stdout.write(
    `Wrote summary.csv and ${failuresWritten} failure trace(s) to ${args.outDir} (jobs=${chunks.length})\n`,
  );
}

function spawnShardOnce(
  chunkSeeds: readonly number[],
  index: number,
  passthrough: readonly string[],
  shardDir: string,
): Promise<void> {
  const argv = [
    ...passthrough,
    `--count=${chunkSeeds.length}`,
    `--seed-offset=${chunkSeeds[0] - 1}`,
    `--out=${shardDir}`,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', CLI_PATH, ...argv], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`run shard ${index} exited with code ${code}:\n${stderr}`));
        return;
      }
      if (!existsSync(join(shardDir, 'summary.csv'))) {
        reject(new Error(`run shard ${index} exited 0 but wrote no summary.csv\n${stderr}`));
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
 *  identical-child-argv construction should make impossible. */
function mergeSummaries(shardDirs: readonly string[]): string {
  const perShard = shardDirs.map((d) => {
    const lines = readFileSync(join(d, 'summary.csv'), 'utf8').split('\n');
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
