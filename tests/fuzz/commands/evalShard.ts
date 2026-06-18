/**
 * H7c parallelism — the internal `--eval-shard` worker, spawned by a `--jobs`
 * sweep (searchShard.ts). Reads the job file (the grid point's config-knob
 * override + a slice of weight vectors + the seeds + resolved run length / forced
 * roster), RE-APPLIES the knobs to this process's live config (a child shares no
 * memory with the parent), evaluates each vector's win rate, and writes them to
 * `--out-file`. Not for direct human use.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { runMany } from '../harness';
import type { HarnessOptions } from '../harness';
import { scoredStrategy } from '../strategies/scored';
import { parseWeights } from '../strategies/scoredWeights';
import { resolveKnob } from '../balanceSweep';
import type { ShardJob } from '../searchShard';
import { aggregate } from '../reporters';
import type { RosterEntry } from '../../../src/run/RunConfig';
import { bail, type CliArgs } from './args';

export type EvalShardModeArgs = Pick<CliArgs, 'job' | 'outFile'>;

export function runEvalShardCli(args: EvalShardModeArgs): void {
  if (!args.job || !args.outFile) {
    bail('--eval-shard needs --job=<file> and --out-file=<file>');
  }
  const job = JSON.parse(readFileSync(args.job, 'utf8')) as ShardJob;

  for (const [path, value] of Object.entries(job.knobs)) {
    const knob = resolveKnob(path);
    knob.obj[knob.key] = value;
  }

  const runConfig: {
    hopCount?: number;
    startingRoster?: readonly RosterEntry[];
    forcedLayoutId?: string;
  } = {};
  if (job.hopCount !== undefined) runConfig.hopCount = job.hopCount;
  if (job.roster && job.roster.length > 0) runConfig.startingRoster = job.roster;
  if (job.forcedLayoutId !== undefined) runConfig.forcedLayoutId = job.forcedLayoutId;
  // J4 / K3c3 / K4c3 / L1c3 — the child re-applies the parent's fixed
  // objective proclivity + redraw policy + empower policy + daemon arm (plain
  // JSON objects that round-tripped the job file), so sharded runs drive the
  // same bots as single-process.
  let harnessOptions: HarnessOptions = Object.keys(runConfig).length > 0 ? { runConfig } : {};
  if (job.objective) harnessOptions = { ...harnessOptions, objective: job.objective };
  if (job.redraw) harnessOptions = { ...harnessOptions, redraw: job.redraw };
  if (job.empower) harnessOptions = { ...harnessOptions, empower: job.empower };
  if (job.daemon) harnessOptions = { ...harnessOptions, daemon: job.daemon };

  const winRates = job.vectors.map(
    (w) =>
      aggregate(runMany(job.seeds, scoredStrategy('eval-shard', parseWeights(w)), harnessOptions))
        .winRate,
  );
  writeFileSync(args.outFile, JSON.stringify({ winRates }));
}
