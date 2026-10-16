# ROADMAP — Round 8.5 (Housekeeping), post-§118

The active PLAN (it stays a plan for its whole life). The macro order is
[META-ROADMAP.md](META-ROADMAP.md) (Round 8 Foundations ✅ CLOSED
2026-10-11; Round 8.5 — Housekeeping is NEXT, re-audited at that close);
findings + rationale land in [WORKLOG.md](WORKLOG.md); live status is
HANDOFF's 🧭 Cursor. Sub-steps are cut at each phase kickoff (AGENTS "The
planning stack"), never here, and each cut step declares its read (`none`
· `batch` · `stop`; AGENTS "Reads are cut, not improvised"). Prior round's
plan: [archive/post-109-roadmap.md](archive/post-109-roadmap.md) (Round 8)
with its worklog and spec beside it; before it
[archive/post-104-roadmap.md](archive/post-104-roadmap.md) (Round 7.5).

**Status: §123, run, in progress: the cut signed 2026-10-16.**
The spec holds the user's intent and four signed
decisions ([round-8.5-spec.md](round-8.5-spec.md)). The round opened with
the oracle map, ahead of the census, as the user signed at the Round 8
close. The census sized the rest of the round as nine phases, written below
(signed 2026-10-14). The
charter, the decision points, the exit and the scope guards are in
META-ROADMAP §"Round 8.5 — Housekeeping".

## Phase 119 — the oracle map ✅ (closed 2026-10-12)

For each part of the code, what proves a change there changed nothing,
each proof shown to fail on a planted break: TESTING.md "The oracle map".
The charter's five instruments, the kickoff's two more proofs, the
cold-read probe and a coverage tool, all built; each step's record, and
every call the user signed at the close, is in WORKLOG §119.

- ☑ **119a — the replay tool reaches further** (`none`). A tool-only
  option past a config mismatch, each battle's event digest with an
  optional mapping, the end snapshot handed back when its hash differs,
  and a pin that the game's entry never reaches the replay.
- ☑ **119b — the journal corpus** (`none`). 30 journals under
  `tests/fuzz/corpus/` with their digests and a census of what they
  reach; all in the smoke tier, three on every `npm test`.
- ☑ **119c — the chaos census pinned on what changes the run** (`none`).
  13 kinds change the run on the every-commit seeds and 8 are only sent;
  the test names both lists.
- ☑ **119d — parsed-config equality and the snapshot field diff**
  (`none`). One path-by-path JSON diff with two uses, `npm run oracle`.
- ☑ **119e — the comment instruments** (`none`). The compare with the
  comments out, the step-code ceiling (6,376 codes, by file and exact), a
  length reading.
- ☑ **119f — the cold-read probe, calibrated** (`batch`). 27 of 27 Haiku
  runs right on both trees; kept as a token measure with a floor, 66 runs
  at the round's close.
- ☑ **119g — the oracle map and the phase's close** (`stop`). 31 planted
  sites; what each proof reaches as `npm run oracle -- reach`; the build
  compare as `build-hash`; the charter's clause corrected. `-post`: three
  test loops bounded, so a reward command that stops taking effect fails
  `npm test` where it hung it.

## Phase 120 — the census ✅ (closed 2026-10-14)

Every candidate with its evidence, in two lists and the TODO pass's
list, each row signed by the user (2026-10-12 to 2026-10-14):
[round-8.5-census.md](round-8.5-census.md). Each step's record, and the
read of sections 4 and 5 in nine tranches, are in WORKLOG §120.

- ☑ **120a — the drawn sample** (`batch`). 200 planted sites; 27 went
  unnoticed. `npm run oracle -- plant` kept.
- ☑ **120b — who reads this** (`none`). `npm run oracle -- refs`.
- ☑ **120c — the dials** (`stop`). Section 1: nine rows and seven items
  for deletion, one trial.
- ☑ **120d — exports, files and exact duplicates** (`batch`). Section 2.
- ☑ **120e — the tests, by file** (`stop`). Section 3.
- ☑ **120f — the trials** (`batch`). Section 4: list B's seventeen rows
  (B-17 added at the read), A-38 to A-40, F-1 and F-2.
- ☑ **120g — the TODO pass's list** (`batch`). Section 5: 97 open items
  placed; TODO has one section a round since.
- ☑ **120h — the census signed and the round sized** (`stop`). The
  phases below, the trials' budget, the later rounds' lines in
  META-ROADMAP.

## The phases after the census

Sized and signed at 120h (2026-10-14; WORKLOG §120, 120h). Within a
subsystem the phase runs its signed deletions, then its trials, then one
re-skim, then its comment pass (the spec's D1 and D4). **The trials'
budget:** the signed rows of list B, and at most three more a phase from
its leads and its re-skim; a fourth goes into the census for a later
round, and a trial under D2's bar is reverted and not tried another way.
Every phase keeps the round's scope guards (META-ROADMAP §"Round 8.5 —
Housekeeping"). The rows are in the census; the TODO items in TODO
"Round 8.5".

## Phase 121 — the dials ✅ (closed 2026-10-14)

Every signed dial out with its readers, B-03's three one-key files
folded into `sim` and `difficulty`, and `src/config`'s comment pass in
seven rules signed as the round's style: config files 34 → 28, the
step-code ceiling 6,376 → 5,783. Each step's record, the leads it hands
to §122 and §123, and the cost a line for §122's fan-out call are in
WORKLOG §121.

- ☑ **121a — A-37: the `--jobs` parity test off the smoke** (`none`).
  Its own script, `npm run fuzz:jobs-parity`.
- ☑ **121b — the config keys nothing reads** (`none`). A-01, A-02's
  JSON, A-03, A-04's `ignoresTerrain`.
- ☑ **121c — the values never built** (`none`). A-05, A-07, A-08.
- ☑ **121d — A-09, `layoutFirst`** (`none`).
- ☑ **121e — A-10 and A-21's two switches** (`none`).
- ☑ **121f — A-13, half cover's multiplier** (`none`). No World bump.
- ☑ **121g — B-03's trial** (`none`). Kept; the lockout in ticks alone.
- ☑ **121h — the re-skim** (`none`). No trial reached the bar.
- ☑ **121i — the comment pass's pilot** (`stop`). Seven rules signed.
- ☑ **121j — the comment pass, the rest of the loaders** (`batch`).
  About 66 tokens a line; read with no finding. The co-located tests,
  with the 93 step codes left under `src/config`, wait for §126.

## Phase 122 — sim ✅ (closed 2026-10-15)

List A's sim, core and config rows deleted; B-07, B-08, B-09, B-17 and
one lead (the focus tile) kept as trials, B-01 a no-op, B-02 put to Round
9; and `src/sim` and `src/core`'s comment pass in eight batches under the
seven rules, after a pilot settled it in session. Over the 64 files, now
62: comment lines 8,099 → 5,963, code lines 7,272 → 7,182, the step-code
ceiling 5,783 → 4,169. Each step's record, the pilot's outcome and the
leads it hands on are in WORKLOG §122.

- ☑ **122a — list A's dead exports** (`none`). A-22's eighteen sim,
  core and config names, A-29's two files; the build's bytes unchanged.
- ☑ **122b — A-25's five, with their tests** (`none`). Seven tests out;
  `reach-diff`: nothing lost.
- ☑ **122c — A-28's field and A-38's option** (`none`). Proof: sim,
  0 of 30 and PASS.
- ☑ **122d — A-26, the word `export`** (`none`). 68 declarations in 40
  files; the build's bytes unchanged.
- ☑ **122e — A-34, the test pair** (`none`). The lockout test moved
  with the cooldown test (flagged); `reach-diff`: nothing lost.
- ☑ **122f — B-01, the two predicates by name** (read by the user). A
  no-op: proven the same, under the bar on lines (+7), reverted. B-02 goes
  to Round 9 (WORKLOG §122, 122f).
- ☑ **122g — B-07, a spawned unit's wiring once** (`none`). Kept:
  `World.wireSpawned`; corpus 0 of 30, fuzz diff PASS, lines −10.
- ☑ **122h — B-08, the objective rule called, not restated** (`none`).
  Kept; corpus 0 of 30, fuzz diff PASS, lines −9.
- ☑ **122i — B-09, the death trigger in `reapUnit`** (`none`). Kept;
  corpus 0 of 30, fuzz diff PASS, lines −2.
- ☑ **122j — B-17, one `chebyshev`** (`none`). Kept; corpus 0 of 30,
  fuzz diff PASS, lines −14.
- ☑ **122k — the focus-tile directive folded into `updateFocusTarget`**
  (`none`; a lead). Kept; a file and a type gone, lines −58.
- ~~**122l — B-02, the split, if signed at 122f**~~ — a trial in Round 9,
  signed at 122f (META-ROADMAP §Round 9).
- ☑ **122m — the re-skim** (`none`). No trial over the bar; four
  fix-ups; three calls for the user.
- ☑ **122n — the fan-out pilot** (read by the user). Decided: (a), fresh
  sessions on this model; the Opus arm's eight files landed as the
  example of rule 1 on code.
- ☑ **122o — the comment pass, the rest** (`batch`), in fresh sessions
  on this model, as 121j ran. Eight batches by file, each read with no
  finding; about 74 tokens a line.

## Phase 123 — run

`src/run`, 19 files: the signed rows (A-36's trigger registry, A-39's
board line, A-40, and the run's share of list A); B-04, B-06, B-10;
F-2's test (TODO T-97); the comment pass; then `Run.ts` read again for
B-15, which comes back only with a measure that could pass it. Proof:
sim; the port trades by tests alone (the oracle map). Risk: medium.

The cut, signed 2026-10-16 with the kickoff's five calls (WORKLOG §123,
"The kickoff").

- ☑ **123a — `comment-strip`'s control, built in** (`none`). A code edit
  planted in memory in each comment-only file; the run fails when the
  compare misses it.
- ☑ **123b — A-36, the run's trigger registry** (`none`). With its two
  tests and `TriggerDispatcher.size`. Proof: sim; `reach-diff`.
- ☑ **123c — A-39, the board's console line** (`none`). Proof: the
  corpus; `build-hash` moves at that file.
- ☑ **123d — A-40, the leg nothing reaches** (`none`; a stop if the
  game can reach the test's state). The test found by a plant; the leg
  goes with it.
- ☑ **123e — A-25's run share** (`none`). `NodeMap.dump`,
  `empowerAvailability`, `redrawAvailability`, with their tests. Proof:
  export; `reach-diff`.
- ☑ **123f — `EncounterState.turn`** (`none`). Proof: sim.
- ☑ **123g — A-26, the word `export`** (`none`). Proof: export.
- ☑ **123h — B-04, one chip rule** (`none`). Kept; corpus 0 of 30, fuzz
  diff PASS, the config dump's only differences the two keys; `src`
  lines −72.
- ☑ **123i — B-06, one shuffle** (`none`). Kept, as `RNG.shuffle`
  beside `pick`; corpus 0 of 30, fuzz diff PASS; `src` lines −35.
- ☑ **123j — B-10, `Run.ts`'s small repeats** (`none`). Three of four
  parts kept (one weighted draw; one index test, the swap checks
  among its sites), the heal to the cap a no-op (+2 lines); `src`
  lines −32.
- ☑ **123k — F-2's test** (`none`). It failed first on
  `pauseAtTurnGates` alone; `fromJSON` sets it; corpus 0 of 30, fuzz
  diff PASS.
- ☑ **123l — the re-skim** (read by the user). The one-condition
  registry kept as a trial (−9 lines); two fix-ups; seven rows signed
  as deletions below (WORKLOG §123, 123l).
  - ☑ **L-3 — `sidestepWhenBlocked`** (`none`). Corpus 0 of 30, fuzz
    diff PASS; `src` −7.
  - ☑ **L-6 — `GenStats.connected`**, with the mapgen tool's line
    (`none`). Proof: sim.
  - ☑ **L-7 — the `team` loss cause** (`none`). Proof: sim.
  - ☑ **L-4 — `GeneratedTerrain`'s three tile arrays** (`none`). Proof:
    sim.
  - ☑ **L-5 — the generator's three spawn checks** (`none`). Proof:
    sim.
  - ☑ **The load cycle, (b) and (c)** (`none`). `distanceBetween` to
    `src/core/grid.ts`; ability ids checked against `ABILITY_DEFS`;
    `config/units` in no import cycle (WORKLOG §123, "The load cycle").
  - ☑ **L-1 — the `weakest` strategy** (`none`). Proof: sim; `src`
    −29.
  - ☐ **L-2 — `advance`'s leap branch; `maxCells` to `leapLanding`**
    (`none`). Proof: sim; `reach-diff` over the seven.
- ☐ **123m — the comment pass** (`batch`, per batch). The 19 files as
  122o ran it; the tests wait for §126.
- ☐ **123n — `Run.ts` read again for B-15** (`stop`). A split comes back
  only with a measure that could pass it.

## Phase 124 — render and UI

`render`, `scenes`, `ui`, `Game.ts` and the page's layers, 151 files.
First the page drive's scene check and the probe runner's edges, so the
phase has a proof for which scene a phase mounts; then the signed rows
(A-39's camera line and this layer's share of list A); B-13's leads,
read by eye; the comment pass. Proof: `build-hash` for dead code, the
page drive, and the user's eye for a reshaping. Risk: medium, since
nothing headless proves drawing. Decision point: whether the kickoff
cuts it in two.

## Phase 125 — the bot and the fuzz instruments

`src/bot` and `tests/fuzz`'s instruments: A-20's flags, A-30, A-31;
B-14's leads, the five run walkers' battle wiring among them (restored
at §120's close, the user's call); `src/bot`'s comment pass. Proof:
instrument, and the corpus for the walkers. Decision point: whether the
comment pass takes `tests` and `tools` (the user's call of 2026-10-12,
once its outcome on `src` is seen).

## Phase 126 — tests

A list by test first, with 120e's list by file as its known answer;
then A-33 and A-25's tests, B-11, and TODO's loops, timeouts and two
pins. Proof: `reach-diff` for each deleted test, and the suite. Decision
point: each test's fate is the user's.

## Phase 127 — tools

The sweep page deleted (A-32); B-05, with its compare built first and
shown to fail on a planted declaration. Proof: that compare; nothing
else reaches `tools/` across a commit.

## Phase 128 — the close

The docs pass (DESIGN's out-of-scope list, five dead links);
`phase-stats`' fixes before the efficacy read; the cold-read probe, in a
session of its own; the shell-quoting audit; the welfare read, with the
friction log's spool and the standing decisions; the journal corpus's
tier; the user's two smoke lines; the build tagged and uploaded. Exit:
META-ROADMAP's exit for the round.

## Phase 129 — the dependency phase

After the tag (META-ROADMAP §"Round 8.5 — Housekeeping"): Vitest and its
coverage tool first, then what ships with the user's eye, each major its
own step with its release notes read first; the `npm audit` debt counted
again; JetBrains Mono's fix for its swapped `⊞` and `⊠` looked for once.
