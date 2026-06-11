/**
 * H7c — `--balance-sweep` mode. Sweep one knob (or a 2-knob grid) and report the
 * best-achievable win rate + skill gradient + per-archetype telemetry at each
 * grid point. Times the FIRST point and projects the total before committing
 * (BALANCE.md) — `--dry-run` stops after that estimate.
 *
 *   npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.25:1.5:6 \
 *     --knob2=difficulty.swarmMaxMultiplier --range2=1.0:3.0:5 --tier=quick [--dry-run]
 *
 * Writes output/balance-sweep.csv (the full per-archetype breakdown) + a compact
 * stdout table.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PRESETS } from '../search';
import {
  runBalanceSweep,
  parseRange,
  renderSweepCsv,
  renderSweepTable,
  type SweepKnob,
} from '../balanceSweep';
import { reportFromCsv } from '../sweepReport';
import { proclivityLabel } from '../objectiveStrategy';
import { parseRunConfig } from '../../../src/run/RunConfig';
import { bail, fmtDuration, objectiveFromArgs, type CliArgs } from './args';

export type SweepModeArgs = Pick<
  CliArgs,
  | 'knob'
  | 'range'
  | 'knob2'
  | 'range2'
  | 'tier'
  | 'samplerSeed'
  | 'floors'
  | 'roster'
  | 'objective'
  | 'jobs'
  | 'dryRun'
  | 'outDir'
>;

export async function runBalanceSweepCli(args: SweepModeArgs): Promise<void> {
  if (!args.knob || !args.range) {
    bail('--balance-sweep needs --knob=group.key and --range=min:max:steps');
  }
  if ((args.knob2 && !args.range2) || (!args.knob2 && args.range2)) {
    bail('--knob2 and --range2 must be given together');
  }
  const tierName = args.tier ?? 'quick';
  const preset = PRESETS[tierName as keyof typeof PRESETS];
  if (!preset) {
    bail(`Unknown tier: ${tierName} (choices: ${Object.keys(PRESETS).join(', ')})`);
  }
  const samplerSeed = args.samplerSeed ?? 1;

  const knobs: SweepKnob[] = [{ path: args.knob, range: parseRange(args.range) }];
  if (args.knob2 && args.range2) {
    knobs.push({ path: args.knob2, range: parseRange(args.range2) });
  }

  // --roster=archetype[:level],... → a forced starting roster (reuses RunConfig's
  // validated parser: invalid tokens dropped, :level optional, clamped to cap).
  const rosterOverride = args.roster
    ? parseRunConfig(new URLSearchParams({ roster: args.roster })).startingRoster
    : undefined;
  const objective = objectiveFromArgs(args);

  const jobs = args.jobs !== undefined ? Math.max(1, Math.floor(args.jobs)) : 1;
  const gridSize = knobs.reduce((acc, k) => acc * k.range.steps, 1);
  const floorNote = args.floors !== undefined ? ` floors=${args.floors}` : '';
  const rosterNote = rosterOverride
    ? ` roster=[${rosterOverride.map((e) => (e.level > 1 ? `${e.archetype}:${e.level}` : e.archetype)).join(',')}]`
    : '';
  const jobsNote = jobs > 1 ? ` jobs=${jobs}` : '';
  const objectiveNote = objective ? ` objective=${proclivityLabel(objective)}` : '';
  process.stdout.write(
    `Balance sweep: tier=${tierName}${floorNote}${rosterNote}${objectiveNote}${jobsNote} grid=${gridSize} point(s) ` +
      `[${knobs.map((k) => `${k.path}×${k.range.steps}`).join(', ')}] samplerSeed=${samplerSeed}…\n`,
  );

  const result = await runBalanceSweep({
    knobs,
    preset,
    samplerSeed,
    floorOverride: args.floors,
    rosterOverride,
    objective,
    jobs,
    tmpDir: join(args.outDir, 'shard-tmp'),
    maxPoints: args.dryRun ? 1 : undefined,
    onProgress: (index, total, point, elapsedMs) => {
      const coord = knobs.map((k) => `${k.path}=${point.knobs[k.path]}`).join(' ');
      process.stdout.write(
        `  [${index + 1}/${total}] ${coord} → best ${(point.bestTrainWin * 100).toFixed(0)}% ` +
          `grad ${(point.gradient * 100).toFixed(0)}pt (${fmtDuration(elapsedMs)})\n`,
      );
      if (index === 0 && total > 1) {
        process.stdout.write(
          `  → projected total ≈ ${fmtDuration(elapsedMs * total)} for ${total} points\n`,
        );
      }
    },
  });

  process.stdout.write('\n' + renderSweepTable(result));

  if (args.dryRun) {
    process.stdout.write('\nDry run — estimate only, no CSV written.\n');
    return;
  }
  mkdirSync(args.outDir, { recursive: true });
  const csvPath = join(args.outDir, 'balance-sweep.csv');
  const csv = renderSweepCsv(result);
  writeFileSync(csvPath, csv);
  // The human-readable companion, generated from the just-written CSV so it can
  // never disagree with it.
  const reportPath = join(args.outDir, 'balance-sweep.report.txt');
  writeFileSync(reportPath, reportFromCsv(csv));
  process.stdout.write(`\nWrote ${result.points.length} point(s) → ${csvPath}\n`);
  process.stdout.write(`Readable report → ${reportPath}\n`);
}
