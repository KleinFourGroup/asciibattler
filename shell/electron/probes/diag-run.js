// What the store's writes cost over a whole driven run, under the Electron
// shell (116l). It needs the diagnostics in the build, so the flag goes in
// the runner's environment:
//
//   VITE_DIAG=1 npm run probe -- shell/electron/probes/diag-run.js --seed=7
//   VITE_DIAG=1 npm run probe -- shell/electron/probes/diag-run.js --seed=7 --profile=<dir>
//   ... --arg={"journal":true}     also return the run's journal
//
// The run is played to its end by the probe kit's driver, as drive-run.js
// plays it, and the result holds the diagnostics' tally (src/dev/diag): per
// section of the store, how many writes the game made, what they cost in the
// page (the serialization and the hand-over to the shell; the file itself is
// written by the main process, off the page's thread), and the size of the
// data. Under Electron every write sends the whole store, so a profile whose
// `store.json` already holds a full journals section shows the worst case:
// give one with --profile.
//
// The tally counts every load on a profile, so a fresh profile (the
// runner's default) reads this run alone.
export default async function diagRun(arg = {}) {
  if (window.__diag === undefined) {
    return { ok: false, error: 'no __diag on the page: run with VITE_DIAG=1 in the environment' };
  }
  const { journal, ...drive } = arg;
  let report;
  do {
    report = await window.__probe.drive({ ...drive, maxMs: 60_000 });
  } while (!report.done);
  // Electron's write is asynchronous; let the last one land before the read.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const diag = await window.__diag.report();
  const played = window.__probe.journal();
  return {
    ok: true,
    phase: report.phase,
    battles: report.battles,
    byPhase: report.byPhase,
    logHash: report.logHash,
    journalChars: played === null ? null : JSON.stringify(played).length,
    origin: diag.page.origin,
    store: diag.store,
    lock: diag.lock,
    writes: diag.writes,
    clockStepMs: diag.clockStepMs,
    ...(journal ? { journal: played } : {}),
  };
}
