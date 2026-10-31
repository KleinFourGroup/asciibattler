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
play). Round 9's are
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) to
[archive/worklog-phase-140.md](archive/worklog-phase-140.md).

## Phase 143 — the board's acts

### The kickoff's audit, and the cut put to the user (2026-10-31, session 53dd47f5)

Read at `2e66560d`: `tests/fuzz/board/board.ts` whole, the signed sheet,
the board CLI's head and `board.test.ts`'s cases, `reporters.ts`'s
summary writer, `harness.ts`'s sector count, `commands/args.ts` (`--act`,
`--hops`, the sampled roster), `roster/rosterTable.ts`'s key and sampler,
`manifest.ts`'s `armSignatureOf`, the start-act walk in `Run.ts`'s
constructor, and the pre-commit hook.

**The sheet's two-act names have one reader.** A grep of `*.ts`,
`*.mjs`, `*.md` and `*.json` outside `archive/` and `node_modules` finds
`act1WinRefs`, `deepEndWallTarget`, `terminalReachTarget` and
`seamPoolFraction` in `board.ts` and `board.test.ts` only, besides the
sheet, BALANCE.md, the ROADMAP and one scratch note.

**The rows.** 13 of the board's 17 instruments run `--hops=11` (`ACT1`,
`board.ts:168`): the six win rows, the forced King and Queen, three
doctrine controls and the two anchors. Four run the walk (`WALK`,
`:169`), two of them checked: the seam, the three pacing kinds, reach,
the wall and the win derived from them.

**One seam and one terminal.** `summary.csv`'s `poolAtSectorEnd` is the
first entry of `poolAtSectorClears` (`reporters.ts:92`), though the
harness records each clear (`harness.ts:479`). `computeMetrics` finds one
terminal, the winners' furthest (sector, hop) (`board.ts:620`), so reach
and the wall are the last act's alone. In 139c's walk row at 139b's
moves (`output/board-runs/139c-D/arb-walk-deploy`), the 120 runs end: 52
won at (1, 10), 30 died at (0, 10), 13 at (1, 10), and 25 elsewhere. Both
bosses sit at hop 10, and act 1's boss wall, 30 of 110 arrivals (0.273,
by hand from that tabulation), is in the file but nothing reads it.

**A starting act's sector is counted from the act.** A local probe, 3
seeds on the greedy bot with `--per-encounter`: `--act=2 --hops=11`
played The Deep End (the Generalissimo and the plague encounters in its
log), and its `rosters.csv` labels every battle sector 0, hops 0 to 10.
That is the key a run from act 1 gives The Start, since the harness
counts sectors from 0 at the run's start (`harness.ts:467`) and stamps
the count on each battle (`:524`, `:1079`). A roster table built from an
act-alone row would file one act's rosters under another's key, gotcha
#120's class. `--act=1 --hops=11` against `--hops=11`: `summary.csv`
byte-identical (`cmp`), as `startAct ?? 1` predicts.

**The arm check reads the argv.** `armSignatureOf` is the sorted argv
less the partition flags (`manifest.ts:160`), so a row that gained
`--act=1` would fail the arm check against every stored cohort; a row at
act 1 keeps today's argv.

**The stored cohorts read today.** `balance:board --report
--dir=output/board-runs/94h`, the last full board (17 instruments at
`4d3fa22`): integrity PASS on all 17 with one WARN (its head against this
tree's), and drift 0 FAIL and 8 WARN, every row the same as the stored
`board-report.txt`'s. That is the stored two-act cohort the exit reads;
139c's three trees (`output/board-runs/139c-*`, two rows each) are the
current game's.

**The hook.** Every step stages `tests/fuzz/`, so each commit runs the
fuzz smoke and the `--jobs` parity test (`.githooks/pre-commit:75`,
`:87`).

**Left out, on a lean.** The searcher's `quick` and `medium` presets
(`--hops=11`), `--roster=sampled:<hop>`'s sector-0 default and the pane
recipes' `hops=` URLs keep reading act 1, whichever sector holds it,
which after §145 is the act every run starts in. `scratch/139/board.mjs`
pairs by depth, which holds for any count of acts.

**The cut, put to the user** (unsigned):

- **143a — a starting act's battles under the walk's sector** (`none`).
  The harness labels a battle, a roster row and the per-hop records with
  the sector's place in the walk, so an act-2 run's read sector 1. Exit:
  that, with its control (today's count from the act fails it); every
  file of a run from act 1 byte-identical to before.
- **143b — every seam and every act in the summary and its metrics**
  (`none`). `summary.csv` appends the starting act and each seam's pool,
  `poolAtSectorEnd` kept; the metrics read a seam per seam and reach and
  the wall per act, act k's boss read from what the run records, not from
  bare hops (gotcha #127). Exit: the stored 94h board's report the same
  row for row; the per-act values on a three-act fixture; a late act-1
  death not counted as act 2's arrival, its bare-hop control failing.
- **143c — the sheet's per-act shape** (`stop`, the decision point). The
  sheet and the report rows drawn in both arms on the 94h board: keyed
  by act or by sector; which fields go per act; where the act-alone and
  forced-boss rows point; what §145's map commit does to the sheet. No
  number moves.
- **143d — the board per act** (`none`). The signed shape built: the
  sheet's fields, the checks, the rows, the two-act names gone, the docs
  that describe the board. Exit: on today's map `--plan` prints every
  row's argv as before; the 94h board's VERDICT and DRIFT rows the same,
  with the new per-act rows beside them; on a fixture map with a sector
  in front, the rows move as signed; each new check with its planted
  failure.
- **143e — the phase's close** (`stop`): the exit by clause.

Predictions: no snapshot bump (World v39 and Run v50; nothing serialized
is touched); no RNG stream; no `src/` touch, so the corpus is not read;
every commit fires the smoke and the parity test; no box.

### The cut signed (2026-10-31)

The user, to the cut as put: "That all looks great to me, Claude! 😁"
The cut and its reads are signed. The reply did not take up the lean
given for 143c (the sheet keyed by act number, the forced-boss rows at
their boss's act, act 1's refs left to go stale at §145), so 143c stays
the stop it was cut as, with both arms drawn.

### 143a — a starting act's battles under the walk's sector (2026-10-31)

*Step zero.* A battle's `sector` feeds reports only: a grep for `.sector`
in `tests/fuzz` and `src/bot`, tests aside, finds the CSV writers, the
reporters, the roster table and `walkDepth.ts`, and no strategy or
rollout code. The run's own fallen ledger already keys on the sector
index (`Run.ts:1058`).

*Built.* The harness counts a battle's and a recruit's sector from the
starting act less one, so a run started at act 2 labels them 1.
`RunResult` gains `startAct`, and `walkDepth.ts`'s `runWalkPos` gives a
run's end position in that frame; `perHopStats` and the failure trace's
header read it. `sectorsCleared` stays the transitions the run made.

*Found on the way.* The first build changed the labels alone, and the
before/after diff caught `per-hop.csv` reading 0 runs reached on every
act-2 row. `perHopStats` compared the run's transitions with the
battle's label, two frames, which is gotcha #127's class; hence
`runWalkPos`.

*Evidence.*
- `harness.test.ts`, 39 of 39 under the fuzz config. The new test takes
  its expectation from the sector data: each battle's encounter must be
  in the pool of the sector its label names, and the run must meet a
  fight only the second sector holds. It also wants per-hop reach 1 at
  the first hop and one death bucket for a defeat. Two planted failures,
  each restored: the label counted from the act (`sectorBase = 0`) fails
  it ("expected +0 to be 1"), and so does per-hop's old frame, at
  `runsReached`.
- Before and after, 4 seeds on the greedy bot with `--per-encounter
  --per-hop`, at `723df7a4` and with the change. From act 1
  (`--hops=11`) and on a 4+4 walk (`--sector-hops=4`, one run crossing),
  every file is byte-identical but `timings.csv` and `manifest.json`,
  which hold wall time and the head. From act 2 (`--hops=11 --act=2`),
  `summary.csv`, `per-encounter.csv` and `pacing.csv` are identical, and
  `rosters.csv`, `per-hop.csv`, `alpha-strike.csv` and the four failure
  traces differ in the sector label alone, 0 to 1, each checked by
  rewriting the before file's label and comparing. The diff's control is
  the first build's per-hop difference, which it caught.
- Typecheck clean; eleven `RunResult` fixtures take `startAct: 1`.

*Left for 143b:* `summary.csv` has no starting-act column yet.

### 143b — every seam and every act in the summary and its metrics (2026-10-31)

*Step zero.* `run.nodeMap` is public, and a sector's boss stands on its
map's last hop (the 139c walk row's deaths at (0, 10) and (1, 10) on
11-hop maps), so the harness can record each act's boss hop when the map
is built rather than infer it from the hops runs died at.

*Built.*
- The harness records `sectorBossHops`, the boss hop of each sector the
  run entered, at construction and at each `sector:cleared`, whose emit
  follows the new map.
- `summary.csv` appends `startAct`, `poolAtSectorClears` and
  `sectorBossHops`, the two lists `|`-joined; `poolAtSectorEnd` stays the
  first seam's.
- The board's parse reads them where present (a batch from before reads
  act 1, no lists). `computeMetrics` adds `seams`, the mean pre-floor
  pool at each seam keyed by the act it ends, and `acts`, each entered
  act's reach and wall at its boss, both in a full walk's act numbering
  through `runWalkPos`. `bossWall`, `terminalReach` and `seamPool` are
  computed as before.
- The report prints a PER ACT table between DRIFT and HEALTH, which
  nothing checks; BALANCE's integrity protocol names it in its opening
  sentence, since its header layer sits at the 700-line cap.

*Evidence.*
- `board.test.ts`'s five new cases on a three-act fixture worked by hand
  (bosses at hops 10, 8 and 10; reach 6, 4 and 2 of 8, one death at each
  boss; seams 83/5 and 44/3), the last act's pair equal to
  `terminalReach` and `bossWall` and the first seam to `seamPool`, a run
  started at act 2, runs that disagree on a boss hop, and batches from
  before the columns. `harness.test.ts`'s new case takes the boss hops
  from the dials (`sectorHops: 3` puts each boss at 2; `hopCount: 5` at
  4) and round-trips the lists through the summary. 81 of 81 across the
  two files.
- Four planted failures, each on the live file and restored: a bare-hop
  arrival filter fails the hand-worked case (3 assertions); the frame
  without the starting act and seams keyed from act 1 each fail the act-2
  case; the harness's boss hop one too high fails its case.
- The stored 94h board's report is byte-identical outside the new table
  (head lines aside). The table's act-2 reach and wall on the two walk
  rows are the drift table's (0.183 and 0.727; 0.508 and 0.459), and its
  seams are `seamPool`'s (16.02, 16.97). Act 1's wall on those rows reads
  `—`, since the 94h batches predate `sectorBossHops`.
- Against 143a's batches (4 greedy seeds from act 1, from act 2 and on a
  4+4 walk): every file but `summary.csv` byte-identical, and the
  summary's first 22 columns too. The new columns read `startAct` 1 or 2,
  boss hop 10 on 11-hop maps and `3|3` on the walk's crossing run.

### 143c — the sheet's per-act shape, put to the user (2026-10-31)

*Step zero.* The sheet's per-act fields today: `seamPoolFraction` (the
walk's one seam), `terminalReachTarget` and `deepEndWallTarget` (the last
boss), `pacingBands` (the whole walk), `act1WinRefs` with the economy
refs and `fireChannelDelta` (the `--hops=11` rows), and the two forced
bosses' refs. The sector ids are `the-start` and `the-deep-end`, both 11
hops; the King and the Queen are in `the-start`'s boss pool, the
Generalissimo and the Witch Hunt in `the-deep-end`'s (`config/sectors.json`).

*Common to both arms (leans):*
- The forced-boss refs keyed by the boss, `forcedBossWinRefs`, each row
  run at the act whose sector's boss pool holds it: both at act 1 today,
  so the argv is today's; after §145 the King's row stays at act 1 and
  the Queen's runs at act 3.
- A seam band per seam and a wall band per act, each checked only where
  the sheet holds one; the rest print in the PER ACT table, unchecked.
- `pacingBands` stays one set over the whole walk; the win stays derived
  from the terminal's reach and wall.
- A row's `--act` is written only past act 1, so every stored cohort's
  manifest still matches its arm.

*Arm A, by act number (the lean).* `terminal: { reach, wall }` takes
`terminalReachTarget` and `deepEndWallTarget`; `seams: { "1": … }` takes
`seamPoolFraction`; `walls: {}` holds the mid-walk walls, none signed;
`acts: { "1": … }` takes `act1WinRefs`, the economy refs and the fire
channel. The 13 act-alone rows are act 1's, from a fresh roster, the one
act a fresh roster meets. At §145 nothing in the sheet moves: act 1's
refs and seam 1's band, measured on The Start, check The Periphery and
WARN until §146 re-pins them; the terminal pair follows the last act.

*Arm B, by sector id.* `sectors: { "the-start": { seam, winRefs, economy,
fire channel }, "the-deep-end": { wall } }`, with the terminal's reach
beside them. Each act-alone row names its sector and runs at that
sector's place in the live map. At §145 nothing in the sheet moves, and
The Start's 13 rows follow it to act 2 (`--act=2 --hops=11`), The Start
from a fresh roster, which no player meets; act 1 has no rows or bands
until §146. The Deep End's wall stays with it at act 3.

*On the 94h board* either arm reports the same 37 drift rows with the
same values, the labels renamed; the PER ACT table's act-1 walls stay
unchecked.

*The lean's reasons.* A fresh-roster row means something at act 1 only,
so those rows belong to the act; the 30–35 wall was signed for the
terminal (72b), so naming it as the terminal survives the map commit
without an edit. B keeps each ref beside the content it measured, which
pays once an act has several candidate sectors (plans/acts.md), but this
round has one sector an act. Under A the wall names a role, not an act;
the charter's "per act" holds for the seams and the mid-walk walls.

### 143c — arm A signed (2026-10-31)

The user: "Variant sectors per act is pretty far off in the future for
now, so it sounds to me like A is the better choice, and we'll deal with
the variants later, when/if they land. Sound reasonable?" The session
agreed, with the cost named: once an act has several candidate sectors,
its refs average over whichever sector each seed drew, and a sector key
under the act is the reshape then. The reply did not take up the four
leans common to both arms (forced-boss refs keyed by the boss at its
home act; bands checked only where signed; pacing over the whole walk;
`--act` written only past act 1), on which 143d builds, so they were put
once more before 143d starts.

### 143d — the board per act (2026-10-31)

*The leans signed.* The user, to the four leans put again: "They do,
Claude! 😁 Those all look good to me!"

*Built.*
- `signed-sheet.json` reshaped by a script that carries each number by
  reference: `terminal { reach, wall }`, `seams { "1" }`, `walls {}`,
  `acts { "1": { winRefs, bankRefs, firerFiresPerRun, the two tx refs,
  fireChannelDelta } }` and `forcedBossWinRefs { bandit-king,
  banditQueen }`; `pacingBands`, `characterParity` and `gamblerNote`
  kept, and `signedAt` gains a sentence naming the reshape, no number
  moved. 26 numbers before and after, the same multiset.
- `board.ts`: the sheet's type by act. The walk rows check a seam per
  `seams` entry and a wall per `walls` entry at the check's act
  (`checkValue`, `checkLabel`), the terminal pair as before, and the win
  derived from it. Act 1's rows read `acts["1"]`, and a sheet with
  another act's refs or none for act 1 is refused. The forced-boss rows
  run at `homeActOf` their boss, the act whose sector's boss pool holds
  it, with `--act` written only past act 1. `buildBoard` takes the walk,
  the live map's by default.
- BALANCE's primer names the seam band by its new place.

*Evidence.*
- `--plan`, with and without `--jobs=4`: byte-identical to its output at
  `477a4f6c`, all 17 rows.
- The stored reports, at `477a4f6c` and now, on 94h (17 instruments) and
  139c's three trees (`--only=arb-deploy,arb-walk-deploy`): VERDICT and
  DRIFT identical line for line once the before file's `seamPool` reads
  `seam (act 1)`. 61 lines and 32 drift rows on 94h, 24 and 11 on each
  139c tree; the tallies 0 FAIL with 8, 4, 5 and 2 WARN as before. The
  comparison's control: a planted 16.020 → 16.021 in a copy is caught.
- `board.test.ts`, 45 of 45. 143d's four cases: each forced boss's act
  from the boss pools (the King and the Queen 1, the Generalissimo 2, the
  Queen 2 on a walk with a sector in front; a boss in no pool or in two
  refused); on that walk only the two forced-boss rows change, by
  `--act=2`, and on the live walk no row carries the flag; another act's
  refs refused; a wall and a second seam checked at their act's entry
  (`wall (act 2)` read at 0.25 where act 1's is 0.9), and N/A without it.
- Four planted failures on the live file, each restored: `--act` never
  written; every boss at act 1; an act's wall read off the first entry;
  another act's refs let through. Each fails its case.
- Typecheck clean.

*A correction.* 143c's stop message said the 94h board reports "the same
37 drift rows"; it has 32.

### 143e — §143's close, put to the user (2026-10-31)

*The exit, by clause.*
- *On today's map the re-pointed act-1 rows reproduce the `--hops=11`
  rows.* Under the signed shape the act-alone rows are act 1's and keep
  their argv: `--plan` prints all 17 rows byte-identical to its output
  before 143d, with and without `--jobs`, and at the kickoff
  `--act=1 --hops=11` wrote the same `summary.csv` as `--hops=11` (3
  greedy seeds). The rows that move with the map are the forced bosses';
  on a planted walk with a sector in front they alone take `--act=2`
  (143d). No batch of the board's own arm ran, by the scope guard.
- *A stored two-act cohort reports the same numbers under the new
  parse.* The 94h board and 139c's three trees: VERDICT and DRIFT
  identical line for line but the seam's label, the tallies as before,
  a planted value caught (143d); the PER ACT table's act-2 reach and
  wall and its first seam equal the drift table's (143b).
- *Each new check with its planted failure.* Ten plants, each failing
  its test and restored (143a two, 143b four, 143d four), and the report
  comparison's own control.
- *The scope guards.* No band moved: the sheet's 26 numbers carried as
  one multiset. No board cohort: the only batches were local greedy
  probes of 3 and 4 seeds.

*Not verified in §143:*
- The new columns from the board's own arm: every batch read here ran
  the greedy bot. The columns are written by the harness, which every
  arm shares (inferred, not run).
- Act 1's wall on a full walk: no batch written since 143b walks two
  11-hop acts, so the PER ACT table has shown it only by hand (0.273 on
  139c's moves, the kickoff). A 4+4 greedy walk's crossing run carried
  `3|3`.
- Covered after all: the stage merge. `mergeStages.test.ts`, the byte
  contract between a staged merge and a serial run, passed in the smoke
  at `141818f8` and `9ea7f658` with the new columns.

*The friction read.* §143 filed one papercut and one slip, and no
`distress`. Patterns with the last closes:
- *A docs cap at the commit:* BALANCE's 700-line header at 143b, beside
  the Cursor's 3,900 cap (142b, and five sessions before it). Recurred
  and cost, one hook run here; the docs test caught it before it landed.
  The round close's TODO row reads the Cursor's shape; the lean is to
  leave BALANCE's cap, since the fit was one sentence folded in.
- *The Bash tool's backslash halving:* the guard refused one command at
  143d before it ran (a regex in an inline script). Listed; the guard
  doing its work.
- *Once:* the board report's `signedAt` header, 10,931 characters
  printed in two headers (the papercut).

*Dispositions, leans for the sign.* The `signedAt` papercut: a TODO row
under Round 10's board, since §146 reads many reports: the report prints
a short provenance line and leaves the history in the sheet.
