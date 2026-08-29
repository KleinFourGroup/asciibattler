/**
 * 86d2 — the staged-n merge (`--merge-stages=<dirA>,<dirB>[,…] --out=<dir>`).
 *
 * The n=120 SAME-HEAD protocol extends a decision-feeding n=40 batch via
 * `--seed-offset=40 --count=80` — which lands a SECOND output dir, while the
 * board (and every reader) consumes exactly ONE summary.csv per instrument.
 * This mode merges completed same-arm stage dirs with adjacent seed windows
 * into the byte-identical artifact set one serial run over the union window
 * would have written: the same strategy-major regroup the `--jobs` shard
 * merge uses (mergeSummaries — stages ordered by their seed windows are
 * shards in all but name), applied to every per-run-row csv present
 * (summary / timings / decisions / tier-flips / k-flips — all share the
 * `seed,strategy,…` leading columns), plus failures/ adoption (COPIED, not
 * moved — stages are source archives, unlike the --jobs scratch shards).
 *
 * Loud guards, no silent wrongness (the 86 kickoff-audit board lesson):
 *   - identical summary headers + identical strategy sets across stages;
 *   - the same-arm check: when every stage carries a box `args` file, the
 *     flag sets must match once the partition flags (--count/--seed-offset/
 *     --out/--jobs/--emit-results) are stripped — the protocol's same-arm
 *     rule, made checkable (stages without args files skip the check: local
 *     runs don't write one);
 *   - seed windows pairwise DISJOINT and their union CONTIGUOUS (overlap =
 *     double-counted seeds; a gap = a batch someone forgot);
 *   - a sidecar present in SOME stages but not all bails (a mixed
 *     arbitrated/plain or instrumented/plain stack is a protocol error,
 *     not a merge problem);
 *   - files the merge does NOT reproduce (the aggregate CSVs — per-hop &
 *     friends are float-summed over full result sets; results.json; box
 *     bookkeeping) are LISTED on stdout, never silently dropped —
 *     re-derive aggregates from a serial run over the union window.
 *
 * 86e1 — the SAME-HEAD protocol is now checkable here: when every stage
 * carries a manifest.json, two guards upgrade the `args` proxy — the arm
 * check runs on manifest argv, and two stages whose manifests name
 * DIFFERENT heads bail loudly (the n=120 protocol's same-HEAD rule at the
 * merge seam). Stages without manifests (pre-86e1 archives) fall back to
 * the `args` proxy and produce a merged manifest with null provenance —
 * the fail-closed board (86e2) is where unmanifested reads FAIL.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { bail, type CliArgs } from './args';
import { mergeSummaries } from './parallel';
import {
  MANIFEST_FILE,
  armSignatureOf,
  readBatchManifest,
  stripPartitionFlags,
  writeBatchManifest,
  type BatchManifest,
  type GitProvenance,
} from '../manifest';

export type MergeStagesArgs = Pick<CliArgs, 'mergeStages' | 'outDir' | 'outDirExplicit' | 'raw'>;

/** The per-run-row csvs the shard regroup reproduces byte-for-byte.
 *  87a: rosters.csv joins (per-battle rows, same seed,strategy leading
 *  columns — the decisions.csv multi-row shape). */
const MERGEABLE = ['summary.csv', 'timings.csv', 'decisions.csv', 'tier-flips.csv', 'k-flips.csv', 'rosters.csv'];

interface Stage {
  readonly dir: string;
  readonly header: string;
  readonly seeds: readonly number[];
  readonly strategies: ReadonlySet<string>;
}

function readStage(dir: string): Stage {
  const path = join(dir, 'summary.csv');
  if (!existsSync(path)) bail(`--merge-stages: ${dir} has no summary.csv — not a completed run dir`);
  const lines = readFileSync(path, 'utf8').split('\n');
  const rows = lines.slice(1).filter((l) => l.length > 0);
  if (rows.length === 0) bail(`--merge-stages: ${dir}/summary.csv has no rows`);
  const seeds = [...new Set(rows.map((r) => Number(r.split(',')[0])))].sort((a, b) => a - b);
  return {
    dir,
    header: lines[0]!,
    seeds,
    strategies: new Set(rows.map((r) => r.split(',')[1]!)),
  };
}

/** A stage's arm signature from its box `args` record: the tokens minus the
 *  partition flags, or null when the stage carries no args record (local
 *  runs). The pre-86e1 proxy — manifests, when present, are authoritative. */
function armSignature(dir: string): string | null {
  const path = join(dir, 'args');
  if (!existsSync(path)) return null;
  const tokens = stripPartitionFlags(
    readFileSync(path, 'utf8')
      .split(/\s+/)
      .filter((t) => t.length > 0),
  );
  return tokens.sort().join(' ');
}

export function runMergeStagesCli(args: MergeStagesArgs): void {
  const dirs = (args.mergeStages ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (dirs.length < 2) bail('--merge-stages: need at least two comma-separated stage dirs');
  if (!args.outDirExplicit) {
    bail('--merge-stages: pass an explicit --out=<dir> (refusing the rolling default dir)');
  }
  const outResolved = resolve(args.outDir);
  if (dirs.some((d) => resolve(d) === outResolved)) {
    bail('--merge-stages: --out must not be one of the stage dirs');
  }

  const stages = dirs.map(readStage).sort((a, b) => a.seeds[0]! - b.seeds[0]!);

  // Header + strategy-set equality.
  for (const s of stages.slice(1)) {
    if (s.header !== stages[0]!.header) {
      bail(`--merge-stages: summary.csv headers differ (${stages[0]!.dir} vs ${s.dir}) — mixed schemas/HEADs?`);
    }
    const a = [...stages[0]!.strategies].sort().join('|');
    const b = [...s.strategies].sort().join('|');
    if (a !== b) {
      bail(`--merge-stages: strategy sets differ (${stages[0]!.dir}: ${a} vs ${s.dir}: ${b})`);
    }
  }

  // The same-arm check (box `args` records, when every stage carries one).
  const signatures = stages.map((s) => armSignature(s.dir));
  if (signatures.every((s) => s !== null)) {
    for (let i = 1; i < signatures.length; i++) {
      if (signatures[i] !== signatures[0]) {
        bail(
          `--merge-stages: stage args differ beyond the partition flags — not the same arm:\n` +
            `  ${stages[0]!.dir}: ${signatures[0]}\n  ${stages[i]!.dir}: ${signatures[i]}`,
        );
      }
    }
  }

  // 86e1 — the manifest guards (when every stage carries a manifest.json;
  // readBatchManifest THROWS on a corrupt one — never quietly "no manifest").
  // Arm: the argv signature check, authoritative over the args proxy above.
  // Head: two stages from PROVEN-different heads never merge (the n=120
  // SAME-HEAD rule at the merge seam); an unknowable head (null) doesn't
  // bail here — it flows into the merged manifest for the board to judge.
  const manifests = stages.map((s) => readBatchManifest(s.dir));
  let provenance: GitProvenance = { head: null, dirty: null };
  if (manifests.every((m): m is BatchManifest => m !== null)) {
    for (let i = 1; i < manifests.length; i++) {
      if (armSignatureOf(manifests[i]!.argv) !== armSignatureOf(manifests[0]!.argv)) {
        bail(
          `--merge-stages: stage manifests name different arms:\n` +
            `  ${stages[0]!.dir}: ${armSignatureOf(manifests[0]!.argv)}\n` +
            `  ${stages[i]!.dir}: ${armSignatureOf(manifests[i]!.argv)}`,
        );
      }
    }
    const heads = new Set(manifests.map((m) => m.head).filter((h): h is string => h !== null));
    if (heads.size > 1) {
      bail(
        `--merge-stages: stages ran DIFFERENT heads (${[...heads].join(' vs ')}) — ` +
          `the n=120 protocol is same-HEAD only; re-run the divergent stage`,
      );
    }
    if (heads.size === 1 && manifests.every((m) => m.head !== null)) {
      provenance = {
        head: [...heads][0]!,
        dirty: manifests.some((m) => m.dirty === true),
      };
    }
  }

  // Seed windows: pairwise disjoint, union contiguous.
  const all = stages.flatMap((s) => s.seeds);
  const union = [...new Set(all)].sort((a, b) => a - b);
  if (union.length !== all.length) {
    bail('--merge-stages: stage seed windows OVERLAP — a merged batch would double-count seeds');
  }
  for (let i = 1; i < union.length; i++) {
    if (union[i]! !== union[i - 1]! + 1) {
      bail(
        `--merge-stages: seed gap between ${union[i - 1]} and ${union[i]} — ` +
          `the union window is not contiguous (a stage is missing?)`,
      );
    }
  }

  // Sidecar presence must be uniform across stages.
  const sortedDirs = stages.map((s) => s.dir);
  const toMerge: string[] = [];
  for (const file of MERGEABLE) {
    const present = sortedDirs.filter((d) => existsSync(join(d, file)));
    if (present.length === 0) continue;
    if (present.length !== sortedDirs.length) {
      bail(
        `--merge-stages: ${file} present in ${present.length}/${sortedDirs.length} stages — ` +
          `a mixed stack is a protocol error, not a merge problem`,
      );
    }
    toMerge.push(file);
  }

  mkdirSync(args.outDir, { recursive: true });
  for (const file of toMerge) {
    writeFileSync(join(args.outDir, file), mergeSummaries(sortedDirs, file));
  }

  // failures/ — COPY (stages are source archives; filenames are unique per
  // (strategy, seed, outcome), and the disjoint-window guard above makes
  // cross-stage collisions impossible).
  const outFailures = join(args.outDir, 'failures');
  mkdirSync(outFailures, { recursive: true });
  let failuresCopied = 0;
  for (const dir of sortedDirs) {
    const src = join(dir, 'failures');
    if (!existsSync(src)) continue;
    for (const f of readdirSync(src)) {
      copyFileSync(join(src, f), join(outFailures, f));
      failuresCopied++;
    }
  }

  // 86e1 — the merged dir gets its own manifest over the union window,
  // carrying the STAGES' provenance (never the merging machine's HEAD —
  // this process only reassembled bytes, it measured nothing).
  writeBatchManifest(args.outDir, {
    kind: 'merge-stages',
    argv: args.raw ?? [],
    seedWindow: { firstSeed: union[0]!, count: union.length },
    provenance,
  });

  // No silent caps: name everything present that the merge did not reproduce.
  const handled = new Set([...toMerge, 'failures', MANIFEST_FILE]);
  const skipped = new Set<string>();
  for (const dir of sortedDirs) {
    for (const f of readdirSync(dir)) {
      if (!handled.has(f)) skipped.add(f);
    }
  }

  process.stdout.write(
    `Merged ${stages.length} stage(s) [${stages
      .map((s) => `${s.seeds[0]}..${s.seeds[s.seeds.length - 1]}`)
      .join(' + ')}] → seeds ${union[0]}..${union[union.length - 1]} (n=${union.length})\n` +
      `  files: ${toMerge.join(', ')} + ${failuresCopied} failure trace(s)\n`,
  );
  if (skipped.size > 0) {
    process.stdout.write(
      `  NOT merged (aggregates re-derive from a serial run; box bookkeeping stays with its stage): ` +
        `${[...skipped].sort().join(', ')}\n`,
    );
  }
  process.stdout.write(`Wrote the merged artifact set to ${args.outDir}\n`);
}
