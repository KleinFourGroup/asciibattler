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
