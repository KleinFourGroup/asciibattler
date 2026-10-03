/**
 * 115c — the chaos sweep: `npm run chaos -- --seeds=N [--dials=<query>]`.
 * Plays the chaos driver (chaos.ts) over seeds 1..N for each dial set (the
 * every-commit ones, or the one given), one line per run, and writes each
 * failing run's journal under output/chaos/ (replay it with
 * `npm run replay -- <file> --force`). Exits 1 on any failure.
 */

import { ChaosFailure, KINDS, chaosRun } from './chaos';

const arg = (name: string): string | undefined => {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  return raw === undefined ? undefined : raw.slice(name.length + 3);
};

const seeds = Number(arg('seeds') ?? 20);
const given = arg('dials');
const dialSets = given !== undefined ? [given] : ['sectorHops=2', 'hops=3&layout=procedural', 'character=gambler&bits=300', ''];

let failures = 0;
const sent = new Map<string, number>();
const applied = new Map<string, number>();
const t0 = performance.now();
for (const dials of dialSets) {
  for (let seed = 1; seed <= seeds; seed++) {
    const started = performance.now();
    try {
      const r = chaosRun({ seed, dials, journalDir: 'output/chaos' });
      for (const [kind, row] of Object.entries(r.census)) {
        sent.set(kind, (sent.get(kind) ?? 0) + row.sent);
        applied.set(kind, (applied.get(kind) ?? 0) + row.applied);
      }
      const ms = Math.round(performance.now() - started);
      console.log(`ok   seed ${seed} ${dials || '(no dials)'}: ${r.end}, ${r.battles} battles, ${r.ticks} ticks, ${r.roundTrips} round trips, ${ms} ms`);
    } catch (error) {
      failures++;
      if (error instanceof ChaosFailure) console.log(`FAIL ${error.message}`);
      else throw error;
    }
  }
}
console.log(
  `census (sent/applied): ${KINDS.map((k) => `${k} ${sent.get(k) ?? 0}/${applied.get(k) ?? 0}`).join(', ')}`,
);
console.log(`${failures} failure(s) in ${dialSets.length * seeds} runs, ${Math.round(performance.now() - t0)} ms`);
process.exit(failures > 0 ? 1 : 0);
