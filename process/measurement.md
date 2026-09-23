# Measurement: batches, the box, benchmarks, balance edits

Read this before launching a fuzz or box batch, benchmarking or profiling,
or editing balance config. [BALANCE.md](../BALANCE.md) holds the balance
protocol and the numbers; [PATHING.md](../PATHING.md) holds movement
quality.

## Where a batch runs

- Any searcher batch with several arms and 40 or more seeds runs on the
  measurement box, not locally (user-signed). The trigger is the batch's
  shape, not a time estimate: per-seed cost depends on the arm, and a
  concurrent pre-commit run steals CPU, so estimates miss for reasons you
  only see mid-flight.
- A local batch that runs past twice its estimate gets killed and re-run on
  the box. Determinism makes the restart free, and killing mid-batch leaves
  nothing half-written.

## The measurement box

Boxes are created on demand and destroyed after use.

- `scripts/box-launch.sh create | destroy | list`. The location falls back
  automatically (fsn1 → nbg1 → hel1); a missing server type fails loudly
  and is never substituted, because cores, `--jobs` and price are the
  user's call.
- `scripts/box-setup.sh` provisions a box from scratch; its Node version
  must match local (AGENTS "Toolchain").
- `scripts/box-batch.sh <user@host> launch|status|fetch|kill|run …` is the
  only way to drive a batch: it enforces commit parity and runs detached,
  never over a live ssh pipe.
- `scripts/box-drive.sh` is the overnight driver: create, launch each queue
  line, poll, fetch with artifact checks (a `fetched →` line, exit code 0,
  a non-empty `--artifact`), stand down. On any anomaly it holds the box
  and exits loudly. `--artifact` takes one file name per run
  (`summary.csv` by default, `best-strategy.json` for a search), so a
  cohort holds one artifact kind; split mixed work into separate cohorts.
  Extend the script rather than writing a new driver. Scale
  `--poll` to the batch: `--poll=60` for a cohort of two-minute arms; the
  900 s default is for hour-long batches.
- Box addresses and the API token stay out of this public repo. The token
  lives in the user's `hcloud` context; agents never handle it.
- On Windows the scripts run under Git Bash (`bash` isn't on the PowerShell
  PATH).

## One HEAD per cohort

- Commit and push before launching a driver, never mid-flight. The box
  pulls to local HEAD at every launch, and the parity gate refuses a batch
  after a local HEAD change. Pushing for a box run is pre-authorized
  (AGENTS "Working with the user").
- From the first launch until the last one has fired: no commits and no doc
  edits in the tree. `box-drive.sh` refuses a dirty tree or a moved HEAD
  before each launch.
- To keep building during a cohort's launch window (it can be hours), work
  in a detached worktree: `git worktree add --detach <dir>` plus a
  `node_modules` junction. Build, typecheck, test and smoke there, then land
  the work on `main` as separate commits after the last launch. `git add -N`
  makes new files show up in `git diff`.
- Every batch directory carries a `manifest.json` (HEAD, argv, seed window),
  and the balance board refuses unmanifested input. The protocol is
  BALANCE.md "The board integrity protocol"; `--allow-unmanifested` is only
  for archives older than the manifests.

## Watching a batch

- Don't trust exit codes through a pipeline: `cmd | tail` reports tail's
  exit, and a driver log's `EXIT=$?` can record 0 on a parity refusal. The
  count of `fetched →` lines is the completion signal.
- Run a long batch in the foreground with an explicit timeout, or verify it
  by its output artifact. A background batch with no timeout makes a hang
  look like "still running".
- Background batches survive a crashed agent session as orphaned processes.
  After a crash, run `git status` first (edits live on disk, not in the
  session), then look for orphaned `node` processes (CPU time close to wall
  time since launch means still running) before relaunching anything. A
  fresh watcher polling for the output artifact can re-attach.
- After killing a driver, confirm its whole process tree is gone before
  starting a successor; the npm → tsx → worker tree keeps running and will
  write to the log path the relaunch reuses.
- `pgrep` doesn't exist in this Git Bash. Watch a driver by its log (a poll
  line at least every poll interval), not by a process grep.
- Overnight runs: a driver's queue usually drains hours before the user
  wakes, so run a stand-down watcher that destroys the box once every arm
  is fetched and holds it (loudly) if any arm is unaccounted for. Check
  whether the machine can idle-sleep (`powercfg /requests`, elevated)
  before relying on a local driver overnight; don't infer it from the power
  plan.
- For an unattended night, get the chain signed in advance, not the
  numbers: rules the session can apply, a pause clause for what it can't,
  and a written flag for every judgment call it made.

## Benchmarks and profiling

- Count the shape before timing it. A group-by over an existing
  `decisions.csv` can show a mechanism firing ten times more often than
  intended, before any timed probe runs.
- Re-profile between levers. A share estimate goes stale as soon as a bigger
  lever lands and the rest shrinks around it.
- Paired benches: warm a fresh worktree with one discarded leg first (the
  first leg pays for a cold file cache and the antivirus scan). Run each
  leg's `cd` in a subshell, `(cd <tree> && run)`, so both legs don't end up
  on the same tree. An implausible ratio means the instrument is broken: a
  speedup on a shape the lever can't touch is an alarm, and 1.00× where you
  expected 3× usually means both legs ran the same code.
- `scripts/perf-oracle.sh` checks byte-identity of outputs against a pinned
  ref (see [oracles.md](oracles.md)).

## Knobs and config edits

- A pin for a tuning knob must reach the knob through the CLI resolver, the
  way production does. A pin that hands the mechanism its weights directly
  can't catch a resolver that zeroes them.
- A mechanism designed to be inert on the arm you measure with gets its
  first live read scheduled; otherwise nobody ever sees it do anything.
- Verify config edits per ID, never per indentation or per value: an
  indent-scoped replace can hit an unrelated entry that happens to share
  the number. Print the affected IDs to check them, and sweep a field by
  its key, not by the values you already know.
- Balance-proof tests: a wiring test derives its expected number from the
  config module production reads (`LEVELING.*`, `STATS.*`); a primitive
  test uses explicit local inputs and never reads shipped balance JSON.
  Either way, tuning a number is a one-file JSON edit, not test churn.
