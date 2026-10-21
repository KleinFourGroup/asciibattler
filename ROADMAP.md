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

**Status: §125 closed 2026-10-21; §126, tests, is in progress, its cut
signed 2026-10-21.**
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

## Phase 123 — run ✅ (closed 2026-10-17)

List A's run share and the re-skim's seven deletions out, the load cycle
broken on the way; B-04, B-06, three of B-10's parts and one lead (the
one-condition registry) kept as trials, B-10's heal a no-op; F-2's test;
`src/run`'s comment pass in nine batches; B-15 closed, with the split of
`Run.ts` and `World.ts` in TODO. Over the 19 files: comment lines 4,320 →
3,194, code lines 4,742 → 4,566, the step-code ceiling 4,169 → 3,135.
Each step's record and the leads it hands on are in WORKLOG §123.

- ☑ **123a — `comment-strip`'s control, built in** (`none`).
- ☑ **123b — A-36, the run's trigger registry** (`none`).
- ☑ **123c — A-39, the board's console line** (`none`).
- ☑ **123d — A-40, the leg nothing reaches** (`none`).
- ☑ **123e — A-25's run share** (`none`).
- ☑ **123f — `EncounterState.turn`** (`none`).
- ☑ **123g — A-26, the word `export`** (`none`).
- ☑ **123h — B-04, one chip rule** (`none`). Kept; `src` −72.
- ☑ **123i — B-06, one shuffle** (`none`). Kept, as `RNG.shuffle`;
  `src` −35.
- ☑ **123j — B-10, `Run.ts`'s small repeats** (`none`). Three of four
  parts kept; the heal to the cap a no-op.
- ☑ **123k — F-2's test** (`none`). `fromJSON` sets `pauseAtTurnGates`.
- ☑ **123l — the re-skim** (read by the user). The one-condition
  registry kept as a trial; seven deletions signed and built (L-1 to
  L-7), the load cycle broken by (b) and (c) (gotcha #114).
- ☑ **123m — the comment pass** (`batch`, per batch). Nine batches, each
  read with no finding; about 112 tokens a line.
- ☑ **123n — `Run.ts` read again for B-15** (`stop`). B-15 closed, the
  split to TODO; two fix-ups (a message, a name).
- ☑ **Beside the cut, signed 2026-10-17** (`none`): the CRLF re-checkout,
  the reach tools' two forms, and the twin rule.

## Phase 124 — render and UI: the board ✅ (closed 2026-10-18)

The page drive's scene check and the probe runner's edges first; then the
board's signed rows (A-22, A-26, A-28, A-39), the apron's dither path,
the enemy notch (a display fix), one trial kept (124h), the re-skim and
R-1; the comment pass in ten batches; the atlas's 16 unused glyphs and
the drops sweep after it. Over the 79 files: comment lines 5,429 →
4,866, code lines 8,980 → 8,879, the step-code ceiling 3,135 → 2,122
(the board's files 1,013 → 0). The screens are §124.5. Each step's
record and what it hands on are in WORKLOG §124.

- ☑ **124a — T-91, the page drive's scene check** (`none`).
- ☑ **124b — T-84, the probe runner's edges** (`none`).
- ☑ **124c — A-39, the camera line** (`none`).
- ☑ **124d — the board's A-22 and A-28** (`none`).
- ☑ **124e — the apron's dither path, whole** (`batch`, read).
- ☑ **124f — A-26, the word `export`** (`none`). `render` 22, `dev` 30.
- ☑ **124g — the enemy notch** (`batch`, read). A display change, signed
  as an exception to the scope guard.
- ☑ **124h — `Game.dispatch`'s swap to the map, once** (a trial, kept;
  `batch`, read).
- ☑ **124i — the re-skim** (`stop`). R-1 signed.
- ☑ **124i-post — R-1, the overlay handle's `level`** (`none`).
- ☑ **124j — the comment pass** (`batch`, per batch). Ten batches, each
  read with no finding; about 84 tokens a line.
- ☑ **124j-post — the atlas's 16 unused glyphs** (`none`). `@` kept, each
  glyph clipped to its cell.
- ☑ **124j-post2 — the drops sweep** (`batch`, read at 124k's stop). Ten
  claims restored, four kept ones corrected.
- ☑ **124k — the close** (`stop`). Read 2026-10-18; three calls signed.

## Phase 124.5 — render and UI: the screens ✅ (closed 2026-10-20)

`ui` with `ui.css` and `fonts.css`, `store`, `i18n`, `settings`,
`journal`, `audio`, `failure` and `diagnostics`. The signed rows (A-22,
A-25, A-26, A-28 and two members), the dev load key's lines, the ability
line (a display change signed at §124's kickoff), one trial kept
(124.5f) and finished by R-1, R-2 and R-3; the comment pass in twelve
batches, every one signed; `UnitRarity`'s re-export. Over the 88 files:
comment lines 5,595 → 5,359, code lines 12,502 → 12,443, the step-code
ceiling 2,122 → 1,084 (these files' 1,035 → 0). The cut was signed
2026-10-19; each step's record and what it hands on are in WORKLOG
§124.5 and "The close of §124.5".

- ☑ **124.5a — A-22's `proseFamily` and A-25's two** (`none`).
  `rarityStars` and `orderRoster` out, their tests onto the kept pair;
  `reach-diff`: nothing lost.
- ☑ **124.5b — A-28's share, and two members** (`none`). The mute whole,
  the three `isOpen`, `HUD.hide()`, `ModalHandle.isOpen`,
  `PoolGaugeHandle.set`; the seed-7 drive's hashes unchanged.
- ☑ **124.5c — A-26, the word `export`** (`none`). 91 by the kickoff's
  `refs`; the build's bytes move, by 124f's unminified compare: 13
  constants read by name, the same values.
- ☑ **124.5d — the dev load key's lines and `force`** (`none`).
- ☑ **124.5e — the ability line** (`batch`, read). A damage or heal
  number reads the op's own scaling, under a pin over the catalog; a
  display change signed at §124's kickoff. Read 2026-10-19: all three
  read `2 dmg`.
- ☑ **124.5f — the neutral-target lead** (a trial, `none`). Kept: the
  truth table equal on 126 rows, `src` −7, the rule at one site.
- ☑ **124.5g — the re-skim** (`stop`). R-1 to R-3 signed; 124.5f's
  count had missed the renderer's copy of the rule.
- ☑ **124.5g-post — R-1, the renderer's copy of the neutral-target rule**
  (`none`). 124.5f's finish, not a trial: the table equal on 127 rows,
  `src` −3, the rule at one site.
- ☑ **124.5g-post2 — R-2, `poolGauge`'s `mx`** (`none`). The unminified
  build: only those lines differ.
- ☑ **124.5g-post3 — R-3, `damageStatFor` and the catalog's
  `damageStat`** (`none`). The corpus 0 of 30, the fuzz diff PASS, the
  config dump the 21 keys alone.
- ☑ **124.5h — the comment pass** (`batch`, per batch), as 124j ran.
  Twelve batches built, every read signed (batches 8 to 12 on
  2026-10-20; WORKLOG §124.5).
- ☑ **124.5h-post — `UnitRarity`'s re-export** (`none`). Signed at
  124.5i's stop; `build-hash HEAD`: the same bytes.
- ☑ **124.5i — the close** (`stop`). Read 2026-10-20; three calls signed.

## Phase 125 — the bot and the fuzz instruments ✅ (closed 2026-10-21)

`src/bot` and `tests/fuzz`'s instruments. A-20's four flags, A-30,
A-31, A-25's `hazardCells` and A-26's 16 exports deleted, with the
arena's wave builder and its seven keys; B-14's three trials kept and
the fourth lead to the census as B-18; R-1 and R-2; the comment pass in
three batches, every read signed. `src/bot`: comment lines 877 → 753,
code lines 1,108 → 1,082; the step-code ceiling 1,084 → 898, every code
left under `src` in its tests. The decision point, signed: the pass
takes `src`'s co-located tests for their step codes alone, in §126, and
not `tests` or `tools`. The cut was signed 2026-10-20; each step's record
and what it hands on are in WORKLOG §125 and "The close of §125".

- ☑ **125a — A-30 and A-31** (`none`). `verifyArbitratedRuns.ts` and the
  fifteen vectors; GOTCHAS #128's sentence corrected.
- ☑ **125b — A-20's `--bits-multiplier` and `--grant-epsilon`** (`none`),
  with `grantEpsilon`'s field and override, which only the flag set.
- ☑ **125c — A-20's `--flip-telemetry`** (`none`). The shadow tier, its
  sidecar, aggregate and merge entry; the parity test keeps two files.
- ☑ **125d — A-20's `--arena`** (`none`). Its three files and flag; the
  coverage bot's test on the harness's coverage run; `objectiveMenu`,
  `MenuEntry` and `serializeProclivity` with it (call 1).
- ☑ **125e — the arena's wave builder** (`none`). `buildEnemyTeam` and its
  helpers, the seven difficulty keys that size it, the spawn-overflow test
  on a fixed team, the sweep's examples on a live knob (call 2).
- ☑ **125f — A-25's `hazardCells`, A-26's 16 words in `src/bot`** (`none`).
  Its test onto `hazardCellList`; the fuzz diff PASS.
- ☑ **125g — trial: the battle start and the turn cap** (`none`, on its
  bar). The five walkers, `BattleScene` and `replayTrace` (call 4), and
  the test copies (signed at step zero). Kept: `battleWorld` and
  `tickTurn`, one site each from 13 and 14; `src` and `tests` −87.
- ☑ **125h — trial: the harness and walker's grant walk and port loop**
  (`none`, on its bar). Kept: `tests/fuzz/gateWalks.ts`, one copy each;
  the smoke stands in for the fuzz diff's plants (signed; TODO "§126").
- ☑ **125i — trial: the two scripts' rally search** (`none`, on its bar).
  `sensors.ts`'s mask goes into the census for a later round (call 3).
  Kept: `rallyCells` in `sensors.ts`, the filter once from twice.
- ☑ **125j — the re-skim** (`stop`). R-1 to R-4 signed; R-3 is the
  census's B-18, R-4 a TODO "§126" line.
- ☑ **125j-post — R-1, `ArbitratedConfig`'s six unset ε overrides**
  (`none`). Each site reads its floor; the fuzz diff PASS.
- ☑ **125j-post2 — R-2, `avgTeamLevel` into `Recruitment.ts`** (`none`),
  125e's finish. `enemyBudget.ts` gone; the corpus 0 of 30.
- ☑ **125k — the comment pass over `src/bot`** (`batch`, per batch).
  Three batches (the drivers and the rollout, the scripts, the sensors),
  every read signed 2026-10-21; ten false claims corrected.
- ☑ **125l — the close** (`stop`). Read 2026-10-21; the decision point
  and two calls signed.

## Phase 126 — tests

A list by test first, with 120e's list by file as its known answer;
then A-33 and A-25's tests, B-11, and TODO's loops, timeouts and two
pins. After the deletions, the step codes in `src`'s co-located tests,
each replaced by its reason, and the ceiling to 0 (§125's decision
point, signed 2026-10-21; WORKLOG §125, "125l's stop"). Proof:
`reach-diff` for each deleted test, and the suite; `comment-strip` for
the codes. Decision point: each test's fate is the user's.

The cut, signed 2026-10-21 with five calls (WORKLOG §126, "The
kickoff"). A-25's tests have no step: none is left.

- ☑ **126a — A-33's three test files** (`none`). `reach-diff` on the
  suite: nothing lost; 3,704 → 3,699 tests.
- ☑ **126b — the list by test** (`none`). Both tiers, every file equal
  to the coverage tool's reading key for key; the census's section 6.
- ☑ **126c — the list's stop** (`stop`; the decision point). Signed
  2026-10-21: every class kept, A-43 and A-44 deleted.
- ☑ **126d — the tests signed at 126c** (`none`). A-43 and A-44 out;
  `reach-diff`: nothing lost; each plant caught by `layouts.test.ts`.
- ☑ **126e — T-90, the loops** (`none`). Each that waits on a command
  or a tick bounded, a planted no-op failing one of each shape. Scope
  widened at step zero to `tests`' instruments and `src`'s replay loops
  (signed); 32 + 4 + 3 bounded, three plants returned red.
- ☑ **126f — T-86, the chaos seeds' timeout** (`none`). 15 s, and on
  the four slower default-limit tests (signed at step zero).
- ☑ **126g — T-49 and T-50, the two pins** (`none`). Each fails on a
  planted mismatch: a renamed catalog row, the fallback dropped from
  `--font-mono`.
- ☐ **126h — the import-cycle guard** (`none`). Fails on a planted edge.
- ☐ **126i — the walker's port purchase** (`none`). Fails with
  `buyAtPort` planted to buy nothing.
- ☐ **126j — B-11, a trial** (`none`, on its bar). The scan and five
  optional marks; Run v50 if the fingerprint reads optionality.
- ☐ **126k — R-4, a trial** (`none`, on its bar). The ten sites onto
  `battleWorld` where the seeds agree.
- ☐ **126l — the re-skim** (`stop`).
- ☐ **126m — the step codes in comments** (`batch`, per batch). 898, by
  folder, through an anchor-checked patch file.
- ☐ **126n — the step codes in titles** (`batch`). `comment-strip`
  masks titles, the ceiling counts them; 667.
- ☐ **126o — the close** (`stop`).

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
