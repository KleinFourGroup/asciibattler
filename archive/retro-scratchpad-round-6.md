# Scratchpad — rolling notes on process, decisions, gotchas — Round 6 (Instruments) — ARCHIVED

> **Archived 2026-09-02 at the Round 6 close (88e), the seventh sweep.** Promoted: the macro-plan code audit, the count-the-shape-before-timing + profile-between-levers rule, the paired-bench warm-leg/subshell rule, the verify-the-tree-died-after-a-kill rule + the Git-Bash-has-no-pgrep note, the poll-scales-to-batch-size note, and the adversarial-review + read-only-peer pattern (all to AGENTS); the exact-zeros-are-an-instrument-smell caveat (to BALANCE §Caveats); the detached stand-down watcher and the box-batch poll cap were SUPERSEDED by scripts/box-drive.sh (already promoted 2026-08-26); the fail-closed-instruments and repro-first observations were already doctrine (86e / the headless-first norm); the loud-guard count needed no norm. Everything else here is archived as read. The live scratchpad is [../retro/scratchpad.md](../retro/scratchpad.md).


Running notebook of "things worth talking about" — drop short observations here
as you build. **Swept at every round/cluster boundary** by the distillation
ritual (AGENTS.md §"The planning stack"): each entry gets **promoted** (to
AGENTS / GOTCHAS / TESTING / TODO) or **archived** with the round's docs, so
this file holds only undistilled observations from the current round. Keep
entries short; link commits; group by theme.

Prior eras: the MVP→H7 backlog was swept 2026-07-06 (the ritual's first run) →
[archive/retro-scratchpad-mvp-to-h7.md](retro-scratchpad-mvp-to-h7.md);
the process-audit + Cluster-3 backlog was swept 2026-07-11 (the second run, at
the micro-round kickoff) →
[archive/retro-scratchpad-cluster-3.md](retro-scratchpad-cluster-3.md);
the micro-round backlog was swept 2026-07-21 (the third run, at the Cluster-4
kickoff) →
[archive/retro-scratchpad-micro-round.md](retro-scratchpad-micro-round.md);
the Cluster-4 backlog was swept 2026-07-29 (the fourth run, at the 68h round
close) →
[archive/retro-scratchpad-cluster-4.md](retro-scratchpad-cluster-4.md);
the rollout-arbitration-interstitial backlog was swept 2026-08-04 (the fifth
run, at the 72f round close — promoted: the confirm-the-deficit and
twice-bitten-class-audit norms + the tsx-wedge note to AGENTS; the
baseline-batch, horizon-blindness, probe-shape, human-overperformance, and
dose-bracket rules to BALANCE §Caveats; the box-batch poll ceiling to TODO) →
[archive/retro-scratchpad-rollout-arbitration.md](retro-scratchpad-rollout-arbitration.md);
the Cluster-5 backlog was swept 2026-08-21 (the sixth run, at the §83g
cluster close — promoted: seven norms to AGENTS [circular verification ·
distribution surface · forgetful-path guards · add-a-consumer sweeps ·
per-ID config surgery · the queue-file driver + one HEAD per cohort ·
typechecked probes], three browser-verify tips to HANDOFF, four caveats
to BALANCE, three test patterns to TESTING) →
[archive/retro-scratchpad-cluster-5.md](retro-scratchpad-cluster-5.md);
the MVP-era entries had earlier fed [post-mvp-review.md](../retro/post-mvp-review.md).

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

## §85f (2026-08-24/25) — cohort-ops + external-review lessons

- **TaskStop'd a bash driver, verified nothing, the ghost ran 21 arms
  overnight** (gotcha #126 carries the mechanics). The §57g orphan
  check existed and wasn't applied to my own kill. Candidate AGENTS
  promotion at the sweep: "after killing ANY background driver, verify
  the tree died before launching a successor."
- **box-batch `run`-mode has a ~1h poll cap** — fine for act-1 arms,
  mislabels n=120 walks FAILED while they keep running. The v2 driver
  shape (launch → status-poll unbounded-to-ceiling → fetch → next, one
  batch at a time, artifact-verified stand-down + HOLD) worked
  end-to-end and should be promoted to scripts/ or AGENTS.
- **Fail-closed instruments caught what ops signals missed twice in one
  night**: the per-logical-arm duplicate-seed guard (tiger-team repair)
  caught the ghost's duplicates; the walker's 500-step guard turned an
  infinite loop into a loud crash. The board's inability to FAIL is the
  same lesson inverted (the 85h board-split item).
- **The external adversarial review + parallel-session verification
  pattern worked**: GPT 5.6 Sol found real defects (6 in a fresh
  instrument, plus the train/select leak that re-graded the whole λ
  read); a read-only peer session verified file:line before anything
  was believed; ownership of the shared gitignored instrument was
  handed back and forth explicitly (no clobbers). The one rough edge:
  the peer's interim guard version false-positived on the deliberate
  cross-vector pool — caught because the cohort driver re-ran the
  instrument against fresher data than the repairer had.
- **Three static content scans read clean before the deterministic
  repro named the true mechanism** (repeatable-event + pin, not the
  hypothesized page-cycle). Repro-first remains cheaper than
  mechanism-story-first even when the story sounds airtight.

## §86c (2026-08-28) — perf-lever lessons

- **The paired bench's first fresh-worktree leg eats a ~10–15% cold
  tax (file cache + AV scan), and it always landed on the BASELINE
  side of the first shape.** It inflated L2b's scored read to ~1.2×
  and minted a wrong mechanism story ("inclusive tax 3× the self
  line") before L3's null shape (a lever that provably can't touch
  scored still "read" 1.10×) exposed it; a discarded warmup leg
  collapsed the ratio to 1.00, and the warmed re-measure put L2b's
  true scored effect at ~1.09× — ON its pre-registered ~7%
  expectation. Rule: warm a fresh worktree with one discarded leg
  before the first measured one, and treat a speedup on a shape the
  lever can't mechanically touch as an instrument alarm, never a
  bonus. (86c-L3; the WORKLOG L2b correction note)
- **Post-lever re-profiles keep re-ranking the levers: a fixed share
  estimate goes stale the moment a bigger lever lands.** The 86a
  memo estimate ("caps at ~5–7%") was written when sensors were 7.9%
  of the ARM; by L3's build they were 16.1% (A* shrank around them),
  and the landed memo took ~10%. The signed profile-between-levers
  ordering is what caught it — keep it for any future perf phase.
  (86c-L3)

- **Paired-bench legs must subshell their `cd`** (86f, 2026-08-29): a
  persisted `cd` into the baseline worktree ran BOTH legs of the first
  scored pair on the baseline tree — ratio read exactly 1.00×, which
  WAS the tell (a ~3.4× expectation reading 1.00 means the instrument,
  not the code). Fixed by `(cd <tree> && run)` per leg. Same family as
  the L2b cold-worktree bias: when a bench number is implausible,
  suspect the bench first; the absurd-ratio smell test is free.

- **Scale box-drive poll to batch size** (87d2, 2026-08-30): the
  driver's default `--poll=900` was sized for hour-scale batches; a
  41-arm cohort of ~1–2 min isolation batches at that poll would have
  added ~10 h of pure poll latency to an ~80 min cohort. `--poll=60`
  fit the batch scale and the driver handled 41 serial
  launch→poll→fetch cycles flawlessly (zero holds, destroy on drain).
  If many-small-batch cohorts recur, consider a poll default derived
  from `--est-hours` (or per-line estimates) instead of a constant.
- **Loud guards are doing reality-discovery work, twice in one phase**
  (87c/87d1): the roster-table parser's malformed-row throw surfaced
  the act-2-hop-0 walk shape, and the 84b `--arbitrate ⊥ --encounter`
  refusal corrected the 87d shape-lock's arm at first smoke contact —
  both would have been silent data poison under a drop-and-continue
  parser. Confirmation the loud-throw doctrine pays for itself; no new
  norm needed, but worth counting at the sweep.
