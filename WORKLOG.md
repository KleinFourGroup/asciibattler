# WORKLOG — Round 10 (Act 1, the wilds)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 10's earlier phases:
[archive/worklog-phase-142.md](archive/worklog-phase-142.md) (the kickoff,
§141, with the audit at `9e1b7c48`, the spec's and phases' signatures and
the act titles; and §142, the scripted run, its grammar and the user's
play), [archive/worklog-phase-143.md](archive/worklog-phase-143.md)
(§143, the board's acts: the sheet by act number, its shape and leans
signed at 143c), [archive/worklog-phase-144.md](archive/worklog-phase-144.md)
(§144, the fauna: our glyph face in the Private Use Area, the six beasts
and their attacks, three trees played as one, with the landing note for
§145 at 144g) and [archive/worklog-phase-145.md](archive/worklog-phase-145.md)
(§145, act 1 and the run's shape: the user's encounters and events, the
forest, act 1 on the map, with the notes for §146 in "The hand-off after
145g"). Round 9's are
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) to
[archive/worklog-phase-140.md](archive/worklog-phase-140.md).

## Phase 146 — the board and act 1's bands

### The kickoff's audit, and the cut put to the user (2026-11-02)

Read at `259c3125`: ROADMAP §146's charter, the spec's tranche 2 line,
§145's notes for §146 ("The hand-off after 145g" and 145b's read, in
`archive/worklog-phase-145.md`), §143's sheet shape
(`archive/worklog-phase-143.md`), `board.ts`'s rows, the signed sheet,
the roster table's guard and builder, the run's stream keys and its
start at an act, BALANCE's integrity protocol and artifact registry,
`process/measurement.md`, and the stored cohorts in `output/`.

**The board on the three-act map runs as built.** `balance:board --plan`
prints the 17 rows: the 13 act-alone rows at `--hops=11` with no
`--act`, so they read The Periphery; `wall-king` at act 1 with no flag,
`wall-queen` at `--act=3`; the four walk rows with no hop dial. The
sheet's act-1 entries (`seams["1"]` 0.40–0.45 of max, `acts["1"]`'s
refs) and the forced bosses' refs (the King 0.483, the Queen 0.458) were
measured on The Start, and the terminal pair (reach 0.40–0.50, wall
0.30–0.35) on the two-act walk; `walls` is empty, so act 1's wall prints
in the PER ACT table unchecked. Two-act wording is left in `board.ts`'s
titles and comments (`:23`, `:29`, `:190`, `:270`, `:301`, `:470`,
`:471`) and the fuzz CLI's help (`tests/fuzz/cli.ts:25`); the report
still prints `signedAt` whole (`cli.ts:218`, TODO "The board").

**The pairing with `0.2.0` holds for no fight.** Every fight draws on
streams keyed by the sector's index in the walk: the encounter's
selection (`Run.ts:1787`), the battle (`:2478`), the rewards (`:2716`),
and a run started at an act enters it at that act's index (`:876`). Act
1 took index 0, so The Start's fights draw at index 1 where `0.2.0` drew
them at 0, and The Deep End's at 2 where it drew them at 1. What pairs
is the starting roster's rolls (the `team` stream takes no index). The
read against `0.2.0` is therefore two independent samples, and its
noise is wider than a paired read's.

**`0.2.0`'s board rows are on disk.** `git diff e6fdd8c2 v0.2.0`
touches nothing under `src/`, `config/` or `tests/fuzz/` (docs, the
`scripts/box-*` scripts, `package.json`'s version), so 139c's tree at
139b's moves is `0.2.0`'s game, and `output/board-runs/139c-D/` holds
its `arb-deploy` and `arb-walk-deploy` at seeds 1 to 120. No other row
of the board has run on that game.

**Act 1's content, and where the per-encounter file pools it.** The
Periphery's normals are the user's five and Brigands, its elites the
Vermin Lords and Cats!, its bosses the bear and the King
(`config/sectors.json`). Brigands is The Start's too, and the walk rows'
`pacing.csv` keys an encounter by id, so its numbers pool two acts; the
other nine are act 1's alone. That file carries pool damage per instance
(`playerCostPerInstance`), turns per won instance, and `capTurns`, which
reads the Vermin Lords' healers at the cap (145f) directly.

**Enemy strength does not grow with the run's hop.** A wave's budget
reads the roster, the hand size and the two difficulty multipliers
(`src/run/encounters/wave.ts:112-117`), so the forced Queen at act 3
meets a fresh roster as she did at act 1; only the act's boards, events
and rests differ.

**What act 1's bands rest on.** The table feeds `--roster=sampled:<hop>`
and `sampled:<sector>:<hop>` (`tests/fuzz/commands/args.ts:740-758`),
the player state for a forced encounter read in isolation; no board row
uses it. So the bands need the table only if act 1's encounters are
tuned in isolation, the 5-step loop's step 4 (BALANCE "The protocol").
The per-kind targets in BALANCE (normal ≈ 3, elite ≈ 6, boss ≈ 10 pool
damage an instance) were set at X3 at a pool of 20 and are prose-checked
only; at `0.2.0` the two-act row read normals at 0.8 to 16.3, elites at
10.6 to 16.2 and bosses at 14.2 to 22.2 (BALANCE, 2026-10-29). The
sheet's live per-kind targets are `pacingBands`, turns per won instance
over the whole walk. The casualty experiment set per-act clear targets
of 0.6, 0.5 and 0.4 (`archive/post-88-roadmap.md`).

**The fresh derive.** The integrity protocol asks a re-pin board for a
fresh `--search` derive as the ceiling read (BALANCE "The board
integrity protocol"), and this board re-pins act 1's refs. The heavy
preset plays full-length runs (`balanceSweep.test.ts:241`), so on three
acts it plays the whole walk.

**The box, sized.** Every cohort since §71 ran on `cpx42`: 8 shared
cores, 16 GB, `--jobs=8`; `hcloud server-type describe cpx42` lists it
at 0.1314 an hour gross in fsn1, nbg1 and hel1 today (euros, inferred).
118b ran the 25 board batches in 4 h 34 min (box created 00:40:59,
cohort complete 05:15:28); by the launch stamps an act-alone ARM row
took 6.9 to 10.7 min at n=40 and 13 to 19 min at n=80, a walk ARM row
12.7 to 15.0 min at n=40 and about 25 at n=80, a walk control 5, and the
walk rows about 88 of the 274 minutes. 139c's two rows took about 71 min
a tree with the box's setup, against 64 for the same four batches at
118b, so the game since rule C runs at about 118b's pace. The derive
took 2.7 h at 88d2 on two acts. *Predictions:* the board 5 to 6 h (the
walk rows' share grown by a third act, act 1's content unmeasured), the
derive 3.5 to 4.5 h.

**The checkout during a cohort.** `box-drive.sh` holds a cohort whose
tree goes dirty between launches (`:185-186`), untracked files included,
the friction log excepted; a board's queue launches line by line, so its
window is the whole cohort. A cohort driven from a detached worktree at
the pushed HEAD (`process/measurement.md`, "One HEAD per cohort") leaves
the checkout free.

**The roster table's rebuild.** `npm run roster:table -- <dirs>` pools
every `rosters.csv` under the dirs given, at one HEAD; 94h's was built
off the eight ARM rows, 21,221 battles in 41 buckets. On three acts the
six act-alone ARM rows reach sector 0 for three characters and the two
walk ARM rows sectors 0 to 2 for the soldier, so at most 3 × 11 + 2 × 11
= 55 buckets. The guard's fifth check fails once the `sectors` PENDING
line is no longer needed, so the rebuild has to take it out.

**Left out, on a lean.** The prior table stays v5 (`4d3fa22`): it has
not been re-measured since rule C either, and its rebuild is in Round
11's exit, after the Idol of Mars splits. No forced row for the bear,
the Generalissimo or the Witch Hunt: each reads in situ from the walk
rows, and act 1's wall splits by its boss.

**The cut, put to the user** (unsigned):

- **146a — the board's report and the walk's wording** (`none`). The
  report prints a short provenance line (the last amendment's date and
  phase) in place of `signedAt` whole; the titles and comments name the
  walk, not two acts. Exit: `--plan` byte-identical; the stored 94h and
  139c reports' VERDICT and DRIFT identical but the header; the line's
  test with its planted failure.
- **146b — the cohorts on the box** (`none`). At 146a's HEAD, pushed,
  from a detached worktree: the full board as 94h and 118b ran it (15
  rows at n=40, the ten checked rows to n=120: 25 batches; the anchors
  local), and beside it the fresh derive as its own cohort
  (`best-strategy.json`). Step zero: each row's argv run locally at one
  seed. Exit: every batch fetched with exit 0, its manifest at the
  cohort's HEAD; `--report`'s VERDICT PASS (predicted: DRIFT WARNs on
  act 1's refs and on the terminal pair).
- **146c — the roster table rebuilt** (`none`). From the eight ARM rows;
  the `sectors` PENDING line out; BALANCE's registry row at v4. Exit: the
  guard green with no PENDING line; a `sampled:2:<hop>` draw loads where
  the old table is refused; at most 55 buckets.
- **146d — the board read, and act 1's bands put** (`stop`, the decision
  point). The report on three acts; the read against `0.2.0` from 139c's
  rows, two-sample; act 1 by encounter (pool damage, turns, cap turns)
  and its wall by boss; each moved boss at its new place, in situ; acts
  2 and 3 recorded; the derive's ceiling against the standing vectors.
  Put: act 1's bands in two arms, set at observed reality with no
  content moved, or set as targets with act 1's encounters tuned to them
  (146e and 146f).
- **146e — act 1's encounters toward the signed bands** (`stop`; only if
  146d signs targets act 1 misses). Act 1's own encounters (the user's
  eight, the bear's fight among them, and the King's; Brigands is act
  2's too and stays),
  each by forced isolation at the rebuilt table's rosters with the
  wave-size and level-budget lever, the value baked into its wave specs,
  by measurement against the signed bands and not by taste. Exit: each
  tuned encounter in its band on held-out seeds; the corpus re-recorded.
  The user plays act 1 before the verify board, which builds on it.
- **146f — the verify board** (`none`; only after 146e). The full board
  at 146e's HEAD, and the table rebuilt from it. Exit: VERDICT PASS;
  act 1 in its bands, or the miss taken to the user.
- **146g — the sheet amended** (`stop`). Act 1's entries re-pinned at the
  last board's values: seam 1, act 1's wall, act 1's refs, the King at
  act 1 and the Queen at act 3; acts 2 and 3's numbers in BALANCE's run
  log as Rounds 21 and 22's starting points, the terminal pair as
  signed.
- **146h — the phase's close** (`stop`): the exit by clause.

*Predictions.* No snapshot bump (World v39, Run v50; nothing serialized
is touched). No RNG stream. 146a, 146c, 146f and 146g stage
`tests/fuzz/` and 146e `config/`, so the fuzz smoke fires on each, with
the `--jobs` parity test where `tests/fuzz/` is staged; 146b, 146d and
146h write docs alone. No `src/` touch; 146e's config moves act 1's
fights, so the corpus re-records there and nowhere else. Box: 146b, and
146f if it runs.

*Leans put with it.* (1) The box: `cpx42` at `--jobs=8`, the board and
the derive on two boxes side by side (about 6 h of wall; 8.5 to 10.5 box
hours, 1.10 to 1.40 for both); 146f 0.70 to 0.80 more. (2) The fresh derive in; deploying a new
vector stays its own decision. (3) The read against `0.2.0` from the
two rows on disk, with no box run at `0.2.0`. (4) No new forced-boss
rows. (5) The prior table left to Round 11. (6) The cohorts driven from
a worktree, so the checkout stays free for the user's authoring.

### The cut signed (2026-11-02)

The user, to the cut and its six leans as put: "That sounds good to me,
Claude! 😁 Signed!" The cut goes into ROADMAP §146 as checkboxes; the
stretch it opens runs 146a to 146c, to the stop at 146d.

### 146a — the board's report and the walk's wording (2026-11-02)

*Built.* `sheetProvenance` in `board.ts`: the line both report headers
print for the sheet's history, the count of its entries and the first
and last entries' titles (an entry's text up to its first `: `, the
entries joined by ` ⭑ `, a convention the field's comment now states).
All 14 entries have a title by that rule. The board's titles and
comments, the fuzz CLI's help and the sweep's and search's comments name
the walk, not two acts.

*Evidence.* Before (a worktree at `ce9cb4ff`) and after, on copies of
the stored cohorts in `scratch/146/` (since `--report` writes its
`board-report.txt` into the cohort): `--plan` byte-identical with and
without `--jobs=4`, the worktree's path normalized, and again after the
wording; the reports on 94h and 139c's three trees differ in the two
header lines alone, the first header 10,931 characters of history before
and one line after. Two cases in `board.test.ts`, the shipped sheet's
expectation read off the raw file; planted, the line returning the
history whole fails both, and `board.test.ts` is 44 of 44 restored.
Typecheck clean.

*Found.* On the three-act map the stored 94h cohort fails integrity on
both trees: `wall-queen`'s arm now carries `--act=3` and 94h's manifest
does not. That is 143d's design meeting 145g's map, not 146a; 139c's
reports, two rows each, pass.

### 146b's step zero: the strategy files refused the beasts (2026-11-02)

*Found.* Each of the 17 rows run at one seed locally from `--plan`'s
argv (`scratch/146/zero/rows.mjs`): the two anchors ran, and the 15
rows that load a scored strategy file died at parse, a `ZodError` for
`archetype` and `composition` entries of the wolf, the giant rat, the
fox, the puma, the tiger and the bear. `parseWeights` holds both
records exhaustive over `ALL_ARCHETYPES`
(`tests/fuzz/strategies/scoredWeights.ts`), and 144f joined the six into
`config/fuzz-strategies.json` but not into the five strategy files under
`tests/fuzz/fixtures/`, all of which refused
(`scratch/146/check-fixtures.ts`). This is gotcha #124 met again:
nothing per-commit loads a fixture, so the first board run after an
archetype add is where it shows. No board batch could have run since
144f.

*The join.* By gotcha #124's convention, as 74i-b joined the prodigy:
each of the five files takes the six beasts at weight 0 in both records,
appended after the existing keys (`scratch/146/pad-beasts.mjs`; each file
first checked to round-trip byte for byte through the serializer's
format, so the diff is the twelve keys alone). All five load after it,
and all 17 rows ran one seed to its end: the six act-alone arb rows and
the three act-alone controls on act 1, the forced King's 28 battles
labelled sector 0 and the forced Queen's 25 sector 2, a walk-regen seed
won through all three acts.

*Inert, by the code and an oracle.* In these files the two records are
read for a recruit offer's cards (`strategies/scored.ts:216`) and the
player's own hand (`empowerPolicy.ts:144`, `redrawPolicy.ts:189`), never
for an enemy; the objective strategy's archetype weights are its own
flag's (`--objective`), which no board row passes. The oracle: 92c2's
vector with the beasts at 0 (the joined file, byte for byte), at six
nonzero values, and two controls, run at seeds 1 to 3
(`scratch/146/inert/`). On the doctrine arm, 0 against nonzero:
`summary.csv` and `rosters.csv` byte-identical; its control, the mage,
the reaver and the healer at −10, differs (a mage becomes a bandit at
hop 3). On the arbitrated arm, 0 against nonzero: `summary.csv`,
`rosters.csv` and `decisions.csv` byte-identical; the same control
differs in all three. A first control, the
archer's weight moved by +0.6 and then to −10, was blind on both arms:
the archers came with the starting roster and none was picked from an
offer on these seeds, so it could not have shown a difference.

*For the stop.* The miss recurred (76h, now 144f) and was caught here
for about fifteen minutes and no box time; a guard on `npm test` that
loads every strategy file through `loadWeightsFile` would catch it at the
commit that adds the archetype. A new guard is the user's call, so it
goes to 146d.

### 146b — the cohorts launched (2026-11-02)

*Launched* at `d4b2af3a`, pushed, from a detached worktree at
`../asciibattler-146b` with a `node_modules` junction, so the checkout
stays free: the board's 25 batches (`scratch/146/146b-board.queue`, made
from `--plan` by `scratch/146/make-queues.mjs`; line for line 94h's
queue but the Queen's `--act=3`) on one `cpx42` from 19:29Z, and the
fresh derive (`146b-derive.queue`, the registry's line) on a second from
19:30Z, after the first launch had written the parity marker. The
anchors ran locally in the worktree at the same HEAD, clean manifests:
pure-random 11 of 40, greedy 11 of 40 (94h: 3 and 3, on The Start).
`scratch/146/merge.mjs` pools the fetched batches into a board dir by
each manifest's argv.

*A slip, and its repair.* Removing an earlier worktree (146a's
before-side) with `git worktree remove` deleted through its junction:
`.bin` and the `@`-scopes of the checkout's `node_modules` up to
`@rolldown`, where the user's running dev server held a native binding
and the removal stopped. `npm install` restored it, the lockfile
unchanged: every non-optional top-level package present, typecheck
clean, 3898 tests, 570 smoke, the build. npm left a temp folder,
`node_modules/@rolldown/.binding-win32-x64-msvc-SJR7XUiS`, which the
dev server holds. A junction comes out alone with `cmd /c rmdir
<path>\node_modules`, and only then the worktree; the process docs
that say to make the junction say nothing of removing it, which goes to
146d.

### 146b — the board and the derive back (2026-11-03)

Both cohorts completed at 01:22Z, every batch exit 0 and verified, each
box destroyed by its driver, and `hcloud server list` empty after. The
board took 5 h 54 min (predicted 5 to 6 h). The derive took 5 h 53 min,
and its prediction of 3.5 to 4.5 h missed; a likely reason, not
measured: the heavy preset plays the whole walk, and with act 1 easier
more of its runs go deep. Box time 11.8 h, about 1.55 at 0.1314 an
hour, above the lean's 1.10 to 1.40 by the derive's overrun.

`scratch/146/merge.mjs` pooled the 25 batches into 15 rows by each
manifest's argv (ten merged from two stages, five copied), beside the
two anchors, in `output/board-runs/146b/`. Its report: integrity PASS on
all 17, 0 FAIL, 25 WARN; the numbers are in BALANCE (2026-11-02, the
board on three acts), the read is 146d's. The derive's best vector
trains at 50.0 % after refinement and wins 2 of 6 held-out (94h: 42.3 %
and 1 of 6).

The worktree came out as the launch entry says: its junction unlinked
by `cmd /c rmdir`, the checkout's `node_modules` at 133 entries before
and after, then `git worktree remove --force`, and `npm ls` clean. The
batches, the board and the anchors' logs were copied into the
checkout's `output/` first, `diff -rq` identical. The user deleted
npm's temp folder once the dev server was stopped; `@rolldown` holds
the binding alone, at the lockfile's 1.2.15.

A finding for 146d: the four ceiling deltas subtract a control's 40
runs from an ARM row's 120, though their source line and the comment at
`board.ts:516` say paired seeds. On seeds 1 to 40 alone they read
−0.125, −0.100, −0.100 and −0.300 against the report's −0.117, −0.125,
−0.083 and −0.358.
