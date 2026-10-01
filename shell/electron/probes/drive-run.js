// Drive a whole run with the probe kit (§112c, §112d):
//
//   npm run probe -- shell/electron/probes/drive-run.js --seed=7
//   npm run probe -- shell/electron/probes/drive-run.js --seed=7 --dials=hops=2 --arg={"seed":2}
//   npm run probe -- shell/electron/probes/drive-run.js --seed=7 --arg={"journal":true} > report.json
//   npm run replay -- report.json
//
// The argument is `__probe.drive`'s options as JSON (seed, policy, until,
// dt; an audit function can't cross JSON, so an audit needs a script of its
// own). Each drive call returns at its time limit and the next carries on,
// so the run goes to its end within the runner's timeout. The result is the
// last drive report: the phase, battles, commands per phase, the log hash,
// the state hash. With `journal: true` it also carries the run's journal,
// which `npm run replay` replays under Node and holds against that state
// hash (§114c).
export default async function driveRun(arg = {}) {
  const { journal, ...drive } = arg;
  let report;
  do {
    report = await window.__probe.drive({ ...drive, maxMs: 60_000 });
  } while (!report.done);
  return { ok: true, ...report, ...(journal ? { journal: window.__probe.journal() } : {}) };
}
