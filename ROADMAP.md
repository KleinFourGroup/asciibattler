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

**Status: §120 ✅ CLOSED 2026-10-14, the census signed; §121, the dials,
is next.** The spec holds the user's intent and four signed
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

## Phase 121 — the dials

Every signed config key and `RunConfig` item out with its readers
(A-01 to A-05, A-07 to A-10, A-13, A-21's items), B-03's three one-key
files folded, then `src/config`'s comment pass. Its first step is A-37's
hook change, which takes the 81 s smoke test off every sim commit.
First because a dial's readers sit in sim and run, so those phases read
the code without them. Proof: config, and sim for a reader. Risk:
low-medium. Decision point: the comment pass's cost a line, recorded
here, decides at §122's kickoff whether the later passes fan out to
smaller readers.

The cut, signed 2026-10-14 with its six calls (WORKLOG §121, the
kickoff):

- ☑ **121a — A-37: the `--jobs` parity test off the smoke** (`none`).
  Its own script; run by the hook when `tests/fuzz/` is staged, by the
  box launcher, and before a local `--jobs` batch.
- ☑ **121b — the config keys nothing reads** (`none`). A-01, A-02 (the
  JSON; the buff module stays), A-03, A-04's `ignoresTerrain`. Proof:
  config.
- ☑ **121c — the values never built** (`none`). A-05 with A-07, A-08;
  the attack editor's Cells field goes. Proof: sim.
- ☑ **121d — A-09, `layoutFirst`** (`none`), with its key, loader and
  file. Proof: sim and config.
- ☑ **121e — A-10 and A-21's two switches** (`none`); `tiles.json` and
  its loader go. Proof: sim and config.
- ☑ **121f — A-13, half cover's multiplier** (`none`), with the
  `damageMultiplier` field and `collectHalfCoverPositions`; no World
  bump. Proof: sim and config.
- ☑ **121g — B-03's trial** (`none`): `sim.spawnDurationSeconds`,
  `sim.rangedLeashCells`, `difficulty.startingBits`, under the bar
  written at the kickoff. Kept; config files 31 → 28. The lockout kept in
  ticks alone at the user's call (WORKLOG §121, 121g and 121g-post2).
- ☑ **121h — the re-skim** of the phase's diff; a new deletion waits for
  121i's stop. No trial reached the bar; two stale mentions fixed; leads
  for §122 and §123 (WORKLOG §121, 121h).
- ☑ **121i — the comment pass's pilot** (`stop`): `health.ts`,
  `daemons.ts`, `sim.ts`. Its seven rules signed as the round's style;
  121j in one fresh session, no fan-out (WORKLOG §121, 121i).
- ◐ **121j — the comment pass, the rest of the loaders** (`batch`: two
  loaders' diffs read against the pilot's style), with the cost a line.
  The co-located tests wait for §126. Built in five commits, `e457c93` to
  `d91c2a6`, at about 66 tokens a line (WORKLOG §121, 121j). Read
  `git show b8d8bba -- src/config/difficulty.ts` and
  `git show c784720 -- src/config/sectors.ts` against the seven rules;
  wrong looks like a step code left, history kept, a shipped number with a
  stale or missing reason, a fact said twice, or a claim the code
  contradicts.

## Phase 122 — sim

`src/sim` and `src/core`, 64 files: the signed rows (A-34, A-38, and the
sim's share of A-22, A-25, A-26, A-28); B-01 first, then B-07, B-08,
B-09 and B-17; B-02 decided on B-01's list, under the bar the user
pre-registered in its row; one re-skim; the comment pass. Proof: sim.
Risk: medium, the core. Decision points: B-02; the comment pass's
fan-out.

## Phase 123 — run

`src/run`, 19 files: the signed rows (A-36's trigger registry, A-39's
board line, A-40, and the run's share of list A); B-04, B-06, B-10;
F-2's test (TODO T-97); the comment pass; then `Run.ts` read again for
B-15, which comes back only with a measure that could pass it. Proof:
sim; the port trades by tests alone (the oracle map). Risk: medium.

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
