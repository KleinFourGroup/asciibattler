/**
 * H7c — `--report[=<csv>]` mode. Re-render any existing balance-sweep CSV as a
 * readable per-point report (defaults to output/balance-sweep.csv). Prints it
 * and writes a `.report.txt` sibling. Lets you read a past run's results
 * (including a heavy run you don't want to recompute) without the raw 40-column
 * CSV.
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { reportFromCsv } from '../sweepReport';
import { bail, type CliArgs } from './args';

export type ReportModeArgs = Pick<CliArgs, 'report' | 'outDir'>;

export function runReportCli(args: ReportModeArgs): void {
  const csvPath = args.report ? args.report : join(args.outDir, 'balance-sweep.csv');
  if (!existsSync(csvPath)) bail(`--report: no such file: ${csvPath}`);
  const csv = readFileSync(csvPath, 'utf8');
  const report = reportFromCsv(csv);
  process.stdout.write(report);
  const reportPath = csvPath.replace(/\.csv$/i, '') + '.report.txt';
  writeFileSync(reportPath, report);
  process.stdout.write(`\nWrote → ${reportPath}\n`);
}
