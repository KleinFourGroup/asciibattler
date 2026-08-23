# Scratchpad — rolling notes on process, decisions, gotchas

Running notebook of "things worth talking about" — drop short observations here
as you build. **Swept at every round/cluster boundary** by the distillation
ritual (AGENTS.md §"The planning stack"): each entry gets **promoted** (to
AGENTS / GOTCHAS / TESTING / TODO) or **archived** with the round's docs, so
this file holds only undistilled observations from the current round. Keep
entries short; link commits; group by theme.

Prior eras: the MVP→H7 backlog was swept 2026-07-06 (the ritual's first run) →
[archive/retro-scratchpad-mvp-to-h7.md](../archive/retro-scratchpad-mvp-to-h7.md);
the process-audit + Cluster-3 backlog was swept 2026-07-11 (the second run, at
the micro-round kickoff) →
[archive/retro-scratchpad-cluster-3.md](../archive/retro-scratchpad-cluster-3.md);
the micro-round backlog was swept 2026-07-21 (the third run, at the Cluster-4
kickoff) →
[archive/retro-scratchpad-micro-round.md](../archive/retro-scratchpad-micro-round.md);
the Cluster-4 backlog was swept 2026-07-29 (the fourth run, at the 68h round
close) →
[archive/retro-scratchpad-cluster-4.md](../archive/retro-scratchpad-cluster-4.md);
the rollout-arbitration-interstitial backlog was swept 2026-08-04 (the fifth
run, at the 72f round close — promoted: the confirm-the-deficit and
twice-bitten-class-audit norms + the tsx-wedge note to AGENTS; the
baseline-batch, horizon-blindness, probe-shape, human-overperformance, and
dose-bracket rules to BALANCE §Caveats; the box-batch poll ceiling to TODO) →
[archive/retro-scratchpad-rollout-arbitration.md](../archive/retro-scratchpad-rollout-arbitration.md);
the Cluster-5 backlog was swept 2026-08-21 (the sixth run, at the §83g
cluster close — promoted: seven norms to AGENTS [circular verification ·
distribution surface · forgetful-path guards · add-a-consumer sweeps ·
per-ID config surgery · the queue-file driver + one HEAD per cohort ·
typechecked probes], three browser-verify tips to HANDOFF, four caveats
to BALANCE, three test patterns to TESTING) →
[archive/retro-scratchpad-cluster-5.md](../archive/retro-scratchpad-cluster-5.md);
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

_(The post-C5 rounds start here.)_

## Planning

- **Audit the feature wishlist against code BEFORE ordering it — the
  "seam already exists" belief rate was poor.** At the 2026-08-21 planning
  session, five parallel read-only sweeps over a 19-item list (~6 min
  wall) found: the exhaustion seam never existed (the memory was H7's
  inert `fatiguePerStack` placeholder), ice was never faster (cost 1 +
  an accuracy tax), the flight seam is three inert fields with a
  `planeOf` that ignores the unit, and `deck:*` events have zero hook
  consumers — while the 2×2 walk turned out to be CLOSER than assumed
  (A* + renderer already footprint-correct). Nine of nineteen were
  mechanisms, which is what inserted Round 9 ahead of the content round.
  Same shape as the C3 spec-vs-code audit (`b966187`), applied to the
  macro plan: the audit changes the ORDER, not just the sizes.
  (`daff9a0`)

## Instruments (Round 6)

- **Count the decisions before timing them.** The 84d cost probe's
  first act was a per-site DECISION count off the baseline's
  decisions.csv (one PowerShell group-by) — and it caught a spec
  deviation the 84a/84c tests had passed straight through: the shadow
  fired on every site, and the empower site alone was ~10× every
  acquisition site combined. A cheap shape read off existing data
  beats a timed probe of the wrong shape; the §57g CPU-vs-wall check
  then confirmed the mis-shaped probe was merely slow, not wedged.
  (84d)
- **Stopping a background task orphans its worker.** `TaskStop`
  killed the shell; the tsx/node tree (npm-cli → tsx → worker) kept
  running at CPU ≈ wall, still writing to the log path the relaunch
  reused — so the "alive" log was the dead probe's. `Get-Process node`
  (full command lines via `Get-CimInstance Win32_Process`) after ANY
  stop, kill by PID. And the detach that works on this box is the Bash
  tool's `run_in_background` (the one-battle smoke ran 12 min past the
  10-min tool cap and completed); a `Start-Process pwsh -File` detach
  returned in 0 s without launching npm (the PowerShell shim) — verify
  a detached launch by its first log line AND a busy PID, never by the
  wrapper's exit. (84d)
- **Nine exact zeros are an instrument smell, not a finding.** The
  prior table's packet rows read 0.000 at n=47–67 each; the raw rows
  showed candidates scoring byte-identically to the null while the
  spend column proved the candidate applied. The generic tripwire —
  per site × candidate class, the fraction of decisions where a
  candidate's score differs from the null; a class at 0% is
  structurally inert — is a one-column lint that catches the whole
  "clone can't use what it was given" class. Lands as 84f2. (84d)
- **A detached stand-down watcher beside any overnight box driver.**
  The queue drains hours before anyone is awake; `destroy` on the
  `fetched →` count, HOLD loudly on a shortfall, take the queue over
  if the driver dies. Dry-run both exit paths on synthetic logs before
  the real launch. And don't claim the PC sleeps without
  `powercfg /requests` evidence — Tobii held a SYSTEM request all
  along. (84d)
