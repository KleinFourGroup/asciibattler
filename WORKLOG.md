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

### 146c — the roster table rebuilt (2026-11-03)

*The control first:* on the v3 table, `--roster=sampled:2:5 --act=3`
refuses at launch ("built over sectors ["the-start","the-deep-end"],
but the map walks ["the-periphery","the-start","the-deep-end"]").
`npm run roster:table` over the eight ARM rows of
`output/board-runs/146b/` writes v4: 23,471 battles in 52 buckets
(predicted at most 55), measured at `d4b2af3a`, the three sectors in its
provenance. The same draw then loads and plays its seed (exit 0).

*Not predicted:* with the `sectors` line gone, the coverage guard
failed on the officer, a draftable rare that no roster in the table
holds. It is offered: the pure-random and greedy anchors hold it in 17
and 29 roster rows. The ARM stopped drafting it at rule C. The officer
appears in rows as follows:
- 94h: 5 to 24 per row.
- 139c, the old game: 5 per row.
- 139e, the old game under 137c's bot vector: 9.
- 139c, rule C (`ca97b9fc`): 0 on both rows.
- 139c, the moves: 0 on both rows.
- 146b, every ARM row and every doctrine row: 0.

So the game's change at rule C did it, not the vector. The cut's exit
named the guard green with no PENDING line. It is green with one:
`unit:officer`, with that reason and what clears it. That is a change
inside the step's intent (the table over the three-act walk), so it is
built and goes to 146d with the read. BALANCE's registry row is at v4.
Tests: the guard (12) and the table's and the sampled flag's (21).

### 146d — the board read, and act 1's bands put (2026-11-03)

The numbers are in BALANCE (2026-11-02, the board on three acts;
2026-11-03, act 1 read off the board). What they say:

1. **Act 1 is easier than `0.2.0`'s act 1, and the whole run is not
   told apart from `0.2.0`'s.** The ARM on the deploy vector clears The
   Periphery in 99 of 120 against The Start's 80 at `0.2.0` (p 0.007),
   and wins the three-act run in 44 against the two-act run's 52 (p
   0.356). Every act-1 ref WARNs high, the King's forced row too (0.733
   against 0.38–0.58), and the seam into act 2 reads 23.8 and 21.0
   against 16–18: runs leave act 1 with 53 to 60 % of the pool.
2. **Act 1's wall is two bosses at 0.12 to 0.29**, the King 0.125 and
   the bear 0.167 on deploy, 0.292 and 0.250 on regen; on regen the
   cats are a third wall (15 deaths in 52). The moved bosses, in situ,
   are not told apart from their `0.2.0` places at this n: the Queen
   0.377 at act 1 to 0.241 at act 3 (p 0.150), the King 0.175 to 0.125,
   the Generalissimo 0.219 to 0.250, the Witch Hunt 0.182 to 0.244. On
   regen the Witch Hunt walls act 2 (16 of 23).
3. **Act 1's pacing misses the signed turn targets in four of its own
   encounters**, all short: the rats' nest (2.00 turns, 0.1 to 0.2 pool
   an instance, a fight that costs nothing), the rat hunt (2.40 and
   2.36), the Vermin Lords (2.88, an elite that costs 0.8 to 1.5 pool
   and ends 5 to 8 % of its turns at the time cap, the act's highest
   and near act 3's stall-prone elites), and the bear (4.35 against
   5.00–6.50). The cats graze the elite floor on deploy (3.97).
4. **The arbitration costs the ARM the walk.** Doctrine and ARM differ
   in `--arbitrate --prior-lambda=0.5` alone; paired on seeds 1 to 40
   on the walk, 12 seeds won by doctrine alone and 0 by the ARM (p
   0.0005), where on act 1 alone it is 5 against 1 (p 0.219). 94h
   read the walk's ceiling at −0.200 on two acts and named the
   high-override sites as the suspect for Round 7; the walk one act
   longer makes it −0.300 paired. The refs the sheet holds are the
   ARM's, so they read the arbitration's losses with the game's.
5. **The derive** trains at 50.0 % and wins 2 of 6 held-out; its line
   runs without the board's redraw and empower levels, so it compares
   only with the earlier derives (94h 42.3 % and 1 of 6, on two acts).

*Acts 2 and 3, recorded for Rounds 21 and 22:* act 2 (The Start, the
Generalissimo and the Witch Hunt) walls 0.247 on deploy and 0.553 on
regen, act 3 (The Deep End, the Queen) 0.241 and 0.267, the seam into
act 3 17.4 and 14.5.

*Put to the user*, in the closing message of the session's turn: act
1's bands in two arms. (A) Observed: act 1's refs, wall, seam and the
two forced bosses re-pinned at 146b's values at 146g, no content moved,
146e and 146f skipped. (B) Targets: the targets are the signed turn
targets the four short encounters miss. 146e tunes those four by
isolation with the wave-size and level-budget lever, and the Vermin
Lords' cap turns are read there. The user plays act 1, 146f runs the
verify board, and the refs, wall and seam are re-pinned at 146f's
values rather than the old bands. The lean: (B), since the targets
are the user's own and two of the four are near no-fights; holding act
1 to the old act-1 win bands is not proposed. A three-act run's first
act reading easier than the old first act is the shape, and the whole
run holds at `0.2.0`'s. With it: the officer's PENDING (146c), a
fixture-loading guard for gotcha #124 met a second time (76h, then
144f), a
process line on removing a worktree with a junction, the ceiling's
label (pooled, not paired), and where the arbitration's walk loss goes.

### 146d signed (2026-11-03)

The user, to the put and every lean with it: "Fully signing your leans
on all of those calls, Claude! 😁" So:

- **Act 1's bands, arm (B).** The targets are the signed turn targets
  (normal 2.50–3.25, elite 4.00–5.00, boss 5.00–6.50). 146e tunes the
  four short encounters (the rats' nest, the rat hunt, the Vermin Lords,
  the bear) toward them by isolation, the Vermin Lords' cap turns read
  there. The user plays act 1, 146f runs the verify board, and 146g
  re-pins act 1's refs, wall and seam and the two forced bosses at
  146f's values, not the old bands.
- **The officer's PENDING** (146c) stands; his row is the Round 11 kit
  watch in TODO.
- **The fixture guard:** a test on `npm test` that loads every strategy
  fixture through the real loader, with its failing control.
- **The process line:** `process/measurement.md` says to unlink a
  worktree's junction before removing it; `oracles.md` points there.
- **The arbitration's loss on the walk** goes to TODO under Round 11,
  before the closing board; the ceiling's label to TODO under Round 10's
  board.

### 146e — act 1's four short encounters toward the turn targets (2026-11-03)

*Step zero.* The signed lever is the protocol's step 4,
`difficulty.waveSizeMultiplier` under `--encounter`, baked into the wave
spec. A wave's level budget is the total across its bodies
(`src/run/encounters/wave.ts`), so a smaller count with the same budget
fields fewer, stronger enemies, fewer bodies fall each turn, and the same
enemy pool lasts more turns: the lever moves turns, as the cut assumes.
The isolation shapes, each one fight a run on a v4 roster, reproduce the
board's in-situ turns within 0.25, and the doctrine player's turns
match the ARM's within 0.15, so doctrine is the isolation player. The
sweep, the bake and the held-out verify are in BALANCE (2026-11-03, act
1's four short encounters tuned in isolation).

*Chosen:* the smallest change that lands in the target on the tuning
seeds: the rats' nest ×0.7, the rat hunt ×0.85, the Vermin Lords ×0.55,
the bear ×0.7. All four are in their targets on held-out seeds 5001 to
5040 (3.00, 3.00, 4.73, 5.26). The baked config equals the multiplier on
each encounter's own row, byte for byte.

*The Vermin Lords' cap turns, read.* Their turns step with their bodies,
and only 7 (four healers and three rats, at a hand of six) reach the
elite target. Their stall share rose on the tuning seeds (6.9 % at the
old wave, 10.5 % at the new) and less on the held-out ones (4.2 % and
6.9 %); pooled, not told apart (p 0.159). The pool lever, the full wave
at morale 60, gives 4.90 turns at 6.6 %. Put to the user at the stop as
an alternative, with the signed lever's version baked.

*Not in the targets:* the rats' nest still costs nothing (0.03 pool an
instance held out), whatever its size. Turns were the signed target;
cost is reported.

*The corpus:* 24 of 33 journals diverged and were re-recorded; the
re-recording left three trades (a packet and a daemon bought, a unit
paid off) in no row, so chaos 15 and 26 replace chaos 7 and the
Gambler's 37 from a survey of 40, as at 145g: 20 of 21 kinds, 0 of 33
differing on replay, `corpus.test.ts` 37 green.

*The seeded drives that moved* (the hook's first run failed 6, which
the cut's prediction missed; a slip filed), each re-picked by its own
rule, as at 137c and 145g: seed 9's two-hop soldier run now dies in its
first fight, act 1's boss, so the journal across a load and the resume
gates' strip move to seed 8, the quicker of the two of 1 to 20 whose
run completes (3 and 8; `scratch/146/146e/scans/resume-scan.ts`). The
chaos census lost three kinds: its procedural slot 32 → 3, the shortest
of 40 that declines a reward and empowers a unit; the Gambler's 3 → 12,
the shortest of 40 that redraws, docks at a port and recruits, which
brings `usePacket` back. The census pin is unchanged
(`scratch/146/146e/scans/chaos-scan.ts`). The smoke then failed the
`hopsRemaining` pin, which set its pin at every sector clear: its seed's
walk now clears the second sector too, so the pin read the remainder
after the second (11, not 22). It now pins the first clear, in a commit
of its own (`3566cece`), passing on both configs. The Cursor trimmed
under its cap.

*The stop:* the user plays act 1 before 146f's verify board. The read
script: the rats' nest fields about 8 bigger rats and lasts three turns;
the rat hunt three turns; the Vermin Lords four clerics and three rats,
four to five turns; the bear with six, then five, then five beside it,
about five turns. Wrong looks like a fight that drags with nothing
happening (a stall), a Vermin Lords fight that reads as a heal-lock, or
the bear's stages feeling empty.

*The stop, read (2026-11-03).* The user played act 1: "All of those
are playing decently. I think we do want to go with the change you
mentioned to vermin lords. That'll play better when we get the aura
healer, too." So the Vermin Lords take the pool lever in place of the
wave-size one: the full wave again (hand factor 1.24 → 2.25, fourteen
bodies at a hand of six) with its pool doubled (`healthPool` 30 → 60),
the sweep's morale ×2.0 arm baked. Its rows equal that arm's on the
tuning seeds; held out, 4.95 turns, a cap share of 3.0 % and 1.75 pool
an instance (BALANCE, 2026-11-03, the Vermin Lords at the pool lever).
The corpus diverged on 7 of 33 and was re-recorded, 20 of 21 kinds; no
seeded drive moved (3906 main, 570 smoke, the corpus's 37).

*Asked at the stop:* when the rats' nest and the Vermin Lords get their
cost. Nothing schedules it: §146's targets are turns, and BALANCE's
per-kind cost guide (normal ≈ 3, elite ≈ 6, boss ≈ 10 pool an
instance) was set at a pool of 20 and is checked in prose only. Put to
the user with a lean toward Round 11, whose retune moves every fight's
cost.
