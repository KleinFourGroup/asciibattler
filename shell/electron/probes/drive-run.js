// Drive a whole run with the probe kit (§112c, §112d):
//
//   npm run probe -- shell/electron/probes/drive-run.js --seed=7
//   npm run probe -- shell/electron/probes/drive-run.js --seed=7 --dials=hops=2 --arg={"seed":2}
//
// The argument is `__probe.drive`'s options as JSON (seed, policy, until,
// dt; an audit function can't cross JSON, so an audit needs a script of its
// own). Each drive call returns at its time limit and the next carries on,
// so the run goes to its end within the runner's timeout. The result is the
// last drive report: the phase, battles, commands per phase, the log hash.
export default async function driveRun(arg = {}) {
  let report;
  do {
    report = await window.__probe.drive({ ...arg, maxMs: 60_000 });
  } while (!report.done);
  return { ok: true, ...report };
}
