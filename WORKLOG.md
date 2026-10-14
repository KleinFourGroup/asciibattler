# WORKLOG — Round 8.5 (Housekeeping)

Per-round narrative log (AGENTS "The planning stack"): findings, decision
rationale, rejected alternatives, scope changes, playtest verdicts land
here under the matching `## Phase N`; the ROADMAP stays a plan (one-line
mutations + a pointer back here). Created 2026-10-11 at the Round 8
close. Prior round's log:
[archive/post-109-worklog.md](archive/post-109-worklog.md) (Round 8,
Foundations: the kickoff → §110 the shell spike and the spec → §111 the
background recorder → §112 the pane probe kit and the Electron runner →
§113 the store and the build ID → §114 the run journal and its export →
§115 save/load and mid-run resume → §116 the menu and settings → §117
Escalation and the unlock mechanism → §117.5 the UI sweep → §117.75 the
rest gate → §118 the public web channel → the close), with its plan
[archive/post-109-roadmap.md](archive/post-109-roadmap.md) and spec
[archive/round-8-spec.md](archive/round-8-spec.md) beside it.

**Read first:** `archive/post-109-worklog.md` "118j — the round close". C1
is this round's re-audit: which of the charter's premises moved against
the code (the journal as a deletion oracle, the chaos driver's reach, what
a save-format bump costs with the channel open, the size of the comment
rewrite), the candidates Round 8 itself left, and the user's five
answers, the third of which is the oracle map. C0 has the chaos driver's
reach by command kind. C5 is where the shell-quoting audit in the round's
exit came from, with its tripwire.

## Kickoff — Round 8.5 (Housekeeping)

_(Still to land here: the charter against the code for §119's surfaces,
then §119's cut with its reads. Charter + decision points: META-ROADMAP
§Round 8.5.)_

### The opening: the user's intent, and a proposal put to them (2026-10-11, session e1342511)

Pre-flight at `5d2cdaf`: typecheck clean, `npm test` 3678 of 3678 in 252
files (51 s). `git diff --stat 631e24d HEAD` over `src`, `config`,
`tests`, `scripts`, `shell` and `package.json` prints nothing, so the
close's re-audit (C1) was taken on this code and the kickoff's audit covers
§119's surfaces only. Nothing has come from the itch page (the user).

**The user's intent** is in [round-8.5-spec.md](round-8.5-spec.md),
verbatim: no piece of the code is suspected; the comments' verbosity is the
one thing noted; the goal is a code base "in a more approachable format
than when we began", by "cleaning up duplicates, identifying fragile code,
unifying similar constructs". Five candidates off the top of their head
(the comments, the dials, tests of basic facts, the number of config files,
the neutral team split in two), and the way they would work alone: skim,
spot, try, judge whether it simplified, repeat. They asked what better
criteria and a better process would look like.

**That intent is wider than the signed charter in one way.** The charter
says "a deletion round, not a refactor". Unifying constructs, merging
config files and splitting a team re-shape code that stays. Whether one of
those is simpler can be judged only from the result, which is the user's
step 4, and a list signed before any change cannot hold that judgement.

**Measured for the reply** (at `5d2cdaf`, by `git grep` and `wc`, with
`configHash.ts` read whole and a few lines each of `Unit.ts`, `World.ts`
and `events.ts`; no site was classified).

- *Size.* 278 non-test `.ts` files under `src`, 63,261 lines; 316 test
  files under `src` and `tests`, 69,510 lines (252 of them the main
  suite's, 64 the fuzz smoke's).
- *Config.* 34 files and 6,381 lines in `config/`. Five hold 5,214 of the
  lines (layouts, events, encounters, units, abilities). Eighteen are
  under 30 lines, five of those at 5 or fewer (economy, selection, spawn,
  objective, tiles). `configHash()` hashes each file's name with its
  content (`src/config/configHash.ts:119-127`), so a merge that moves no
  value still changes the stamp, and every journal recorded before it
  refuses without the replay flag. Its header calls the lack of one
  aggregate config object deliberate.
- *The neutral team.* `Team = 'player' | 'enemy' | 'neutral'`
  (`src/sim/Unit.ts:24`). A camp member and a wall are both `'neutral'`
  and are told apart by `campId !== null`, through `isActiveNeutral` and
  `isInertNeutral` (`Unit.ts:73`, `:84`). Outside tests, 58 lines under
  `src` call one of the two or compare a team with `'neutral'` (1 + 17 +
  27 + 13 by pattern; 43 of them in `src/sim`; at least five are comment
  lines).
  `UnitSnapshot.team` is a `Team` (`src/sim/World.ts:351`) and events
  carry one (`src/core/events.ts:358`), so a split changes the bytes of
  the snapshot and of the event log with the behaviour unchanged. The
  board already draws a camp as a third identity (the triangle mark, the
  7.5 spec's item 2).

**Put to the user (open as this is written).**

1. *Two tracks.* Track A, what a search can prove dead (comments, dials
   with no consumer, unused exports, tests of removed code, exact
   duplicates): the census lists it, the user signs the list, it is
   deleted in batches under byte identity. Track B, what has to be tried
   (unify, merge, split): the user's loop, with a profile in place of the
   skim (per file: size, churn, `fix(` commits, gotcha references,
   special-case sites), a bar written before the trial, and one re-skim of
   a subsystem after its phase. Within a subsystem, A before B, since a
   deletion can remove one half of a pair that would have been unified.
2. *The bar for a kept trial.* The same behaviour by its named oracle;
   source lines do not grow; no parameter that exists only to tell the
   former halves apart; and at least one thing a reader had to know is
   gone (a special case, counted by its sites before and after; a type, a
   file, a config key, a gotcha or a doc paragraph; or a file from the set
   one edits to add a unit, a status, a command or a knob). A trial under
   the bar is reverted and recorded as a no-op.
3. *The charter's amendment.* Re-shaping is let in, by trial only. "No
   behaviour change", "no new abstraction", "no balance number moves" and
   the gates stay. "Byte-identical" gains a second form for a change that
   renames what is stored: identical after a declared mapping back to the
   old names. §119 then builds two more proofs: that mapping, and
   parsed-config equality for a config move.
4. *The comment pass's aim:* length, with the step codes as the part that
   can be counted.

Readings: **90,772** at 13:08 after HANDOFF and `process/planning.md`;
**129,349** at 13:12 with the charter, C1 and the pre-flight read;
**154,841** at 13:47 with the candidates measured; **174,337** at 13:50
on the opening's commit, `97468f0`.

### The four calls signed, and the cold-read probe piloted (2026-10-11, session e1342511)

**The four calls, answered** (the user): "Yes to all four calls, Claude!
Fully signed!" They are D1 to D4 in the spec. With them: META-ROADMAP
§Round 8.5 is amended (a dated note, the charter's last sentences, the
oracle map's two more proofs, the census's two lists, the order within a
subsystem, the comment pass's aim, one decision point, the exit, one scope
guard); ROADMAP §119 is re-scoped by one line; TODO's tone-audit rider
carries the wider aim; the Cursor's constraints line is reworded. The spec
as rewritten has not been read by the user, which is for §119's
shape-lock.

**The cold-read probe.** The session's reply had ended on an idea it
called unsure: none of the bar's counts measures "approachable", and a
fresh agent given the same tasks on the code before and after would. The
user: "I'm very intrigued by that approachable idea at the end; let's
talk about that more!" Step zero for that talk was a pilot of the
instrument itself: what a run reads out, what it costs, and how far two
identical runs differ. The prompt, the key and the readouts are in
`scratch/119-kickoff/cold-read-pilot.md`.

The task was one question in three parts about the neutral team (what
tells a camp member from scenery, which exported functions encode it, one
place in `src/sim` that makes the distinction without them), given to two
`Explore` agents with the same prompt, plus a zero task (no tool, reply
with one word) for the cost of starting an agent.

| run | tokens | above the zero task | tool uses | seconds | answer |
|---|---|---|---|---|---|
| zero task | 34,138 | 0 | 1 (the hand-back) | 5.1 | n/a |
| A | 52,332 | 18,194 | 5 | 46.8 | right on all three |
| B | 45,481 | 11,343 | 8 | 56.5 | right on all three |

- *The readout exists,* and only for a background agent: tokens, tool
  uses and milliseconds come with its completion notice. A first zero task
  launched in the foreground returned no figures and was run again. What
  the harness counts in the token figure (the last context, or a sum over
  calls) is not known here.
- *Two thirds to three quarters of a run is the cost of starting.* Without
  the zero task the two runs look 14 % apart; above it they are 1.6 times
  apart in tokens, and 1.75 times apart in their own tool calls (4 and 7)
  in the other direction. Two runs give no spread worth computing; they do
  say it is not small, and that tokens and calls are different measures.
- *Both answers were right,* and both cited `Targeting.ts:684`, checked
  here against the file. B added `audibleDeath` in
  `src/audio/eventSounds.ts:53`, which re-encodes the test and is also
  right. An easy task cannot tell two trees apart by correctness.
- *Cost:* about 50k tokens and a minute for an easy locate task, so a set
  of six tasks at five runs on two trees is about 3M tokens, 2M of it
  starting cost. The pilot spent 131,951 over the three runs with a
  readout, and one more zero task without.

**The session's read, put to the user (open).** The probe is worth
keeping in the form where it is a proof and not a benchmark. Its strongest
use is the comment pass, the one deletion whose harm byte identity cannot
see: questions whose answer is a reason the comments hold, asked before
and after, where the rate of right answers must not fall. As a round-level
reading of cost it needs many runs to see less than a large change. Both
trees can be read at the close, side by side from git, so nothing has to
be spent now except fixing the tasks, and half of them should be written
by another agent and kept from the session that does the cleanup. It is
not a gate on single trials. For the user as a reader the instrument is
their own read of a sample at each subsystem's comment pass.

Readings: **219,036** at 18:25 before this entry's commit; **219,689**
at 18:26 on it, `1410520`.

**The user's turn on the probe** (2026-10-11; their words are in the
spec, "Open"). They asked which model the pilot's agents were, and
proposed a less powerful agent with no context as a rough measure for a
human reader and for agents at once, used sparingly and with no formal
cap.

*The model.* All four runs were `claude-opus-5-5`: no model was set, and
the `Explore` agent took the session's. The session's notes had said so
before anything showed it. The check is each agent's transcript in the
session store (`agent-<id>.jsonl` under `~/.claude/projects/`), where the
`"model"` field names only that id (8, 12, 2 and 2 times). The Agent tool
takes a model for each run, so a smaller reader can be chosen. Those
transcripts also make it checkable what a reader ran.

*The session's read, put to the user (open).* The weaker reader is the
better form, for the reason the pilot showed: two Opus readers got an
easy question right twice, and a reader that cannot fail leaves only the
token count, which was noisy. It stands in for a human reader on whether
the code's behaviour can be worked out (it holds few special cases at
once, leans on names and comments, is misled by a stale comment) and not
on whether the code is pleasant to read (finding costs it nothing and
length does not tire it). So the questions become predictions of
behaviour, "what happens when", with the key taken from running the code;
and since the round changes no behaviour, one question and one key hold
on both trees. Sparing use as three named occasions: a calibration in
§119 (which small model lands in the middle, and a planted case), the
round's close with both trees read together, and the neutral-team trial
if the user wants its claim tested. Two traps of this form: the reader
must not run the code, and questions picked by their baseline score must
be measured afresh on both trees, or the comparison regresses toward the
mean and reads as an improvement.

**The user's answer** (2026-10-11): "You read me right, Claude! I think
that this will be a very interesting trial." With one caveat and one
question, both in the spec's Open section: if calibration finds Haiku
still saturates correctness, revisit and see whether the token budget
differentiates; and whether a question is run once or averaged over N,
"based on how expensive calibration is". The session's answers are in
119f's line below.

### The §119 audit, and the cut put to the user (2026-10-11, session e1342511)

✔ = read by this session at the file and line. Nothing here was built.

**What the audit found.**

- **The determinism test compares a tree with itself.** ✔
  `tests/integration/determinism.test.ts:33-48`: two runs of one seed on
  the same code, held equal, with no hash-shaped literal in the file.
  Snapshot assertions are used nowhere: `toMatchSnapshot` and
  `toMatchInlineSnapshot` appear in no file under `src` or `tests`, and no
  `__snapshots__` file is tracked. Whether some other test pins a
  battle's bytes from an earlier commit was not searched. So the
  charter's "byte-identical under the determinism test" names no proof
  across commits. The proofs that cross a commit are the
  worktree-baseline fuzz diff (`process/oracles.md`), a stored journal
  replayed on the new tree, and the build's hash.
- **What a journal checks.** ✔ `src/journal/replayJournal.ts:199-209`,
  `:222-231`, `journal.ts:118-120`: each battle's winner and tick count,
  and at the end one 32-bit hash of the Run's snapshot text. It holds no
  snapshot and no events. So a deletion that slims the snapshot changes
  the end hash with the behaviour unchanged, and the hash cannot say which
  field moved; and nothing in a replay looks at the events a battle
  emitted.
- **The config refusal** ✔ `replayJournal.ts:118-126`, and the build
  refusals with their `--force` ✔ `replayTool.ts:46-61`, `:103-120`. A
  journal recorded headless carries a build ID that names no commit
  (`0.0.0+test`, `0.0.0+chaos`), so the tool refuses it unforced; a test
  that calls `replayJournal` itself meets only the config check.
- **The shipped game replays nothing.** ✔ The one file under `src` outside
  tests that imports `replayJournal` is `src/journal/replayTool.ts`, and
  that is imported by `scripts/replay.ts` and tests. `Game.ts` imports the
  recorder only (`:47`, `:113`). A flag on the replay is a tool's by
  construction, and a pin can keep it so.
- **A headless recorder exists.** ✔ `tests/journalDrive.ts:83-174`
  (`driveRun`: the pane kit's rows as the player, a recorder on the bus)
  and the chaos driver, which replays its own journal at the end
  (`tests/chaos/chaos.ts:1-20`).
- **A sample of six journals** (a throwaway test over `driveRun`, seeds 1
  to 6, no dials, `replayPlants`; deleted after the run):

  | seed | end | battles | entries | journal bytes | end snapshot bytes | kinds sent | replay ms |
  |---|---|---|---|---|---|---|---|
  | 1 | defeat | 30 | 309 | 23,412 | 45,603 | 11 | 3,617 |
  | 2 | defeat | 12 | 117 | 8,594 | 21,177 | 8 | 494 |
  | 3 | defeat | 16 | 157 | 11,722 | 27,389 | 9 | 889 |
  | 4 | defeat | 9 | 76 | 5,818 | 15,940 | 6 | 1,418 |
  | 5 | defeat | 19 | 186 | 14,409 | 35,224 | 9 | 3,595 |
  | 6 | defeat | 12 | 122 | 9,582 | 23,530 | 7 | 3,277 |

  Every replay reached its journal's hash. Six journals are 73,537 bytes
  and replay in 13.3 s, so thirty would be near 0.4 MB and a minute: small
  enough to track, too slow for every `npm test`. All six runs were lost,
  none sent a port trade, `usePacket`, `redrawCards`, `empowerUnit`,
  `passGrant` or `declineReward`, and only seed 1 sent
  `dismissSectorCleared`.
- **The chaos census** already counts `applied` beside `sent` ✔
  `chaos.ts:113-114`; the test pins `sent` only ✔ `chaos.test.ts:50-66`.
- **The build's hash is a ready proof for code with no tests.** ✔
  `scripts/dist-hash.mjs:1-14`: one hash over `dist/`, with the build ID
  pinned for a compare across commits. A bundler should leave out code
  the production entry never reaches, and comments with it; that is an
  expectation here, and 119g's planted break is where it is shown.
- **No coverage tool is installed** (`package.json`: vitest, no
  `@vitest/coverage-v8`). Which lines a proof reaches can be shown today
  only by planting a break at a site.
- **The suite's config swallows `console.log`.** The first run of the
  sample printed nothing and was run again with a failing `expect`, as
  AGENTS says to.

**The cut, as put to the user** (unsigned as this is written; ROADMAP
gets it once it is signed).

- *119a, the replay tool reaches further.* A tool-only option past a
  config mismatch (`--force-config`), each battle's event digest with an
  optional mapping applied before hashing, the end snapshot handed back,
  and a pin that keeps non-test `src` outside `src/journal/` from
  importing the replay. Exit: a journal stamped with another config hash
  refuses without the flag and replays to its hash with it; the mapping
  catches a planted rename. No bump, no smoke. Read: `none`.
- *119b, the journal corpus.* About thirty journals from a table of seeds
  and dials (the seeded player and the chaos driver), tracked under
  `tests/fuzz/corpus/` with their digests and a census of what they reach;
  all replayed in the smoke tier, three on every `npm test`. Exit: all
  reach their hashes; a planted sim edit diverges, reported journal by
  journal. The smoke fires. Read: `none`, with a stop if no run ends in
  victory: the decision is to put a recorder on the fuzz bot or to leave
  the late game to the fuzz diff.
- *119c, the chaos census pinned on what changes the run.* The test names
  the kinds that change the run on the every-commit seeds and the kinds
  only sent, and fails when either list moves. A kind counts when
  `applied > 0` on any seed; 13 of 21 at the Round 8 close, re-measured
  at step zero. Read: `none`.
- *119d, parsed-config equality and the snapshot field diff.* Two tools
  with tests: every loader's exported values as one digest per export, for
  a compare across a config move; two end snapshots compared path by
  path. Each is empty HEAD against HEAD and catches its plant. Read:
  `none`.
- *119e, the comment instruments.* The count of step codes in `src`
  comments with its rule written down, pinned as a ceiling that may only
  fall; the comment-stripped compare against a ref (TypeScript's scanner),
  with a planted code edit as its failing control; a reading of comment
  length by directory. Read: `none`.
- *119f, the cold-read probe, calibrated.* Questions drawn from existing
  tests, whose setup and asserted outcome give a key the code produced;
  the reader barred from test files and from running anything, checked in
  its transcript; a zero task and three runs a question on Haiku; a
  planted case; half the questions drawn and written by another agent
  into a folder this session does not open. At most 30 small-model runs
  and one authoring agent. The user's caveat as its branches: if Haiku is
  right every time, harder questions inside the same ceiling, and if it
  still is, the token measure with its spread. N for the close is set
  from the calibration's spread and price. Read: `batch`, at 119g's stop.
- *119g, the oracle map and the phase's close.* By part of the code, the
  proofs, each with its planted break recorded site by site; into
  TESTING.md; the charter's determinism clause corrected. Read: `stop`.

**The decisions put with it:** the replay flag confirmed (it reverses
§114's choice); the corpus tracked; the chaos census's other eight kinds
left until the census wants them; a coverage tool as a new dev
dependency; a second model's review of the instruments
(`process/oracles.md` asks that the user be asked); where the stretch
runs.

Readings: **236,616** at 19:18 on the probe turn's commit, `815fdcb`;
**288,576** at 19:46 with the audit read and the sample run; **310,087**
at 19:49 on the audit's commit, `8fa37c2`.

**Signed** (the user, 2026-10-11): "Signing all of your leans, Claude!"
The six decisions are signed by their leans: the replay flag confirmed;
the corpus tracked; the other eight command kinds left to the census; a
coverage tool as a dev dependency; no second model's review for now; the
stretch starts in this session with 119a to 119c and hands off at the
line. The session takes the signature to cover the cut and its reads as
well, which were the same message's proposal and which the sixth lean
presupposes; it says so at the next stop. Not covered: the spec file as
rewritten after D1 to D4, which the shape-lock's message did not put to
the user again. The cut is in ROADMAP §119.

## Phase 119 — the oracle map

### 119a — the replay tool reaches further (2026-10-11, session e1342511)

**Step zero.** A replay that reaches its journal's hash already hands
back the Run (`SegmentReplay.run`). What was missing is the case the field
diff exists for: an end whose hash differs threw before anything was
returned. So the cut's "the end snapshot handed back" is `endHash:
'report'`. The bus has `on` and `emit` and no way to hear every event, so
the tap is a subclass inside the replay module that overrides `emit`;
`EventBus` is unchanged.

**Built.** `ReplayOptions` on `replayJournal` (`ignoreConfig`, `endHash`,
`onEvent`) and `SegmentReplay.endMatches`; `src/journal/replayDigest.ts`
(`digestReplay`: one chained hash per battle and one for the events
outside battles, the end's hash, whether it is the journal's, and the
snapshot; `mapValues` for writing a mapping); `forceConfig` on
`replayText` and `--force-config` on `npm run replay`;
`tests/replay-guard.test.ts`. The headers that said nothing forces a
config mismatch are rewritten, and ARCHITECTURE's tree has the new file
and the new test.

**Verified, and by what.**

- Typecheck clean; the three test files 31 of 31
  (`journal-replay-options`, `replay-guard`, `journal-tool`).
- Each option against its plant, on a recorded run (seed 7,
  `hops=3&character=soldier`): another config stamp refuses and replays to
  the journal's hash under `ignoreConfig`; an end hash planted wrong throws
  under `check` and comes back with `endMatches` false and the recorded
  Run's bytes under `report`; a battle's tick count planted wrong still
  throws under `report`; the tap sees one `battle:started` and one
  `battle:ended` per battle and leaves the end hash where it was.
- The digest: the same on a second replay; one event changed in the second
  battle changes that battle's digest and no other; a rename of `neutral`
  in every payload shows in the plain digests, a mapping back restores all
  of them, and a mapping to another name does not.
- The pin on the real tree: one import of `./journal/replayTool` appended
  to `src/Game.ts` fails it with the chain `src/main.ts → src/Game.ts →
  src/journal/replayTool.ts`; the file was put back from a copy taken
  before the plant, and `git diff --stat` on it is empty.

**Not verified here, and where it lands.** `npm run replay --
--force-config` from the command line, and a replay under a config whose
numbers really differ: the tests change the journal's stamp, not the
config, and no journal file exists on disk yet. Both are 119b's, on a
corpus journal; the invariant is that a real changed number diverges and
a moved key does not. The rename test stands a mapping in for a renamed
tree; a real one is the trial's.

**Two calls made here, for the stop.** The pin walks from `src/main.ts`,
so it covers DEV code the entry reaches as well as shipped code. And
`tests/replay-guard.test.ts` is listed with the permanent gates in the
Cursor, as the structural form of the scope guard "the shipped game
replays nothing past a config mismatch".

Readings: **364,280** at 20:29 on 119a's commit, `f3bc831` (the step cost
about 54k from the shape-lock's 310k).

### 119b — the journal corpus (2026-10-11, session e1342511)

**Step zero.**

- The seeded player's driver loads and runs under tsx although its file
  imports `expect` from vitest (`scratch/119b/probe-import.ts`), so one
  command line drives both drivers.
- A chaos sweep, `npm run chaos -- --seeds=8`: 32 runs, 53.8 s, no
  failure, and 17 of the 21 command kinds change a run somewhere in it.
  The four that never do are `buyPortUnit`, `buyPortDaemon`, `sellPacket`
  and `payToRemoveUnit`. The four every-commit seeds reach 13 (the Round 8
  close's C0).
- Short runs are won: the seeded player wins `hops=3` runs, which the
  six-run sample at the audit (no dials, all lost) did not show.

**Built.** `tests/fuzz/corpus/`: `corpus.ts` (the table, `recordRow`,
`replayReach`, the baseline's reader and writer, `reachDifferences`),
`cli.ts` (`npm run corpus`: the check, `--record`, `--rebaseline`,
`--snapshots=<dir>`, `--survey=<n>`), `journals/` and `baseline.json`,
`corpus.test.ts` in the smoke tier; `tests/corpus-quick.test.ts` on every
`npm test`. Beside them: `onCommand` on `ReplayOptions` (each run command
with its phase and whether it changed the Run's saved state, which is how
the chaos driver counts `applied`), `byName` on a digest, and the chaos
driver hands back its journal.

**The corpus as recorded** (this step's tree over `f3bc831`, config
`35e1ee92`): 30 journals, 506,822 bytes, with a baseline of 36,812. 17 are
the seeded player's and 13 the chaos driver's. 20 runs lost and 10 won;
347 battles; 907,453 events under 48 event names; a command changed a run
in 11 phases; 17 of the 21 command kinds change a run, the same four
missing as in the sweep. The nine chaos rows beyond the every-commit four
were chosen from `--survey=8` for a packet bought at a port, a redraw and
a packet used, and for breadth, the shorter run where two reach the same.
The check takes 17 to 21 s from the command line and 23.9 s as the
smoke-tier test.

**Verified, and by what.**

- Typecheck clean. `corpus.test.ts` 34 of 34 under the fuzz config; the
  quick rows, the store guard, the chaos tests and 119a's options 27 of 27
  in four files.
- A second `--record` writes the same bytes (`git diff --stat` empty
  against the staged first one).
- The plants (`scratch/119b/plants.sh` and `plants-2.sh`; each edit made
  at one exact anchor, the corpus checked, the file put back from a copy,
  and no file under `src/sim` or `config` left changed):

  | plant | still ok | differ |
  |---|---|---|
  | none (the control) | 30 | 0 |
  | sim, broad: every hit deals one more (`World.ts`) | 0 | 30 |
  | sim, narrow: a wandering camp member takes the mirrored step (`CampWanderBehavior.ts`) | 12 | 18 |
  | config, a changed number: a rest heals half, not a quarter | 27 | 3 (`player-1`, `chaos-31`, `chaos-1`) |
  | config, two keys of `health.json` in another order | 30 | 0 |

- 119a's two command-line checks, on corpus journals. Under the changed
  number `npm run replay -- … --force` is refused with both config hashes
  named, and `--force --force-config` prints the forced-past line and then
  DIVERGED with exit 1 on `player-1` ("the journal ends in defeat, and the
  replayed run is in phase promotion"). Under the reordered keys the stamp
  moves (`c906b73e`), `--force` is refused, and `--force --force-config`
  replays to the journal's hash.

**What the plants say about the instrument.**

- **The event digest is needed, and the journal's own check is weaker than
  the charter took it for.** Under the narrow plant, 17 of the 18 runs
  diverged at a battle's checkpoint. The eighteenth,
  `player-13-hops-3-escalation-3`, kept every battle's winner and tick
  count and its end hash, and differed only in the events of battles 5 to
  10 (34,745 events against 34,743). `npm run replay` would have reported
  that journal as replayed to its end with a matching hash.
- **A changed number shows only on the runs that meet it.** 27 of 30 runs
  cannot tell a rest that heals a quarter from one that heals half,
  `player-6-hops-2-firstNode-rest` among them, which rests at its first
  node and still replays to its hash. So a replay past a config change
  that still matches says the knob moved nothing on that run, and never
  that the knob is dead. The census's evidence for a dead knob stays the
  search for a reader.

**Not verified.** How much of the sim's and the run's code the corpus
executes: there is no coverage tool until 119g, and three plants are three
sites.

**Calls made here, for the stop.**

1. `onCommand` on the replay, beyond 119a's three options, so that what a
   journal reaches is counted from the stored journal on any tree.
2. The corpus always replays past the config stamp: a moved key changes
   the stamp and nothing else, and a changed number diverges.
3. End snapshots are not stored. `--snapshots=<dir>` writes them from
   whichever tree it runs on, for 119d's path-by-path compare.
4. The table's rows and the three quick rows.
5. **A consequence for later rounds.** A tracked corpus fails on every
   change that is meant to alter behaviour, and then has to be recorded
   again, about half a megabyte of journals rewritten each time. That
   suits this round, which changes no behaviour. At the round's close the
   question is whether it stays in the smoke tier, becomes a tool run on
   demand, or goes.

Tools kept: `scratch/119b/` (the two plant scripts and the tsx probe).

Readings: **437,770** at 20:45 with 119b built and its commit started;
**442,333** at 20:50 on it, `b176886` (the hook: 3698 of 3698 in 255
files, and the smoke tier 624 of 624 in 65). The step cost about 78k.

### 119c — the chaos census pinned on what changes the run (2026-10-11, session e1342511)

**Step zero.** The pin was written from the Round 8 close's count and
passed on its first run, so that count holds at `b176886`: on the four
every-commit seeds, 13 kinds change the run and 8 are only ever sent (the
five port trades, `usePacket`, `redrawCards`, `dismissSectorCleared`). A
kind counts when one command of it changed the run's text on any of the
seeds, which is the driver's own `applied`.

**Built.** One test in `tests/chaos/chaos.test.ts` that names both lists.
It fails when a kind stops changing the run and when one starts to.

**Verified, and by what.** `tests/chaos` 10 of 10. A pin that passes on
its first run is checked by planting (TESTING.md): with a declined reward
made a no-op in `src/run/Run.ts` (`scratch/119c/plant.sh`), the test fails
on the first list, 12 kinds against 13, the missing one `declineReward`,
and the other nine tests pass; the file was put back from a copy and
`git diff --stat` on it is empty.

**Where the eight stand now.** The journal corpus reaches four of them
(`buyPortPacket`, `dismissSectorCleared`, `redrawCards`, `usePacket`).
Nothing stored reaches `buyPortUnit`, `buyPortDaemon`, `sellPacket` or
`payToRemoveUnit`: the chaos driver sent them 244 times over the 32-run
sweep and none changed a run. That is for the census, if it wants to
delete in the port's code (the shape-lock's third decision).

Readings: **455,725** at 20:53 on 119c's commit, `3bc72a4` (3699 of 3699
in 255 files). The step cost about 13k. Under the line, with 119d looking
smaller than the room, the session went on to it.

### 119d — parsed-config equality and the snapshot field diff (2026-10-11, session e1342511)

**Step zero.** Both proofs are the same act: two JSON values compared
path by path. So the step is one differ with two uses, and not two tools.
What a config loader hands the game is its module's exports (`HEALTH`,
`SIM`, `CAMPS`), and the end snapshots come from the corpus
(`npm run corpus -- --snapshots=<dir>`, 119b).

**Built.** `tests/oracle/`: `jsonDiff.ts` (removed, added, changed, and
the same keys in another order, since code that walks an object's keys
behaves by their order; `summarize` counts differences by kind and by path
with the array indices dropped), `configDump.ts` (every export of every
module under `src/config/` that is neither a function nor a zod schema,
keyed by export name with its module beside it; the modules are found by
listing the folder), `cli.ts` (`npm run oracle -- config-dump <out>` and
`json-diff <before> <after>` over two files or two folders).

**Verified, and by what.** Typecheck clean; `tests/oracle` 10 of 10. From
the command line (`scratch/119d/plants.sh`; config edits put back from a
copy, nothing under `config` or `src` left changed):

| compared | result |
|---|---|
| two config dumps of this tree (81 exports) | no difference |
| a dump with a rest healing half | 2 differences: `HEALTH.value.restHealFraction` and the same key in `CONFIG_SOURCES`, 0.25 → 0.5 |
| a dump with two keys of `health.json` in another order | 1 difference: `reordered CONFIG_SOURCES.value.health.json` |
| the corpus's 30 end snapshots, taken twice | 30 files compared, none differ |
| the second set with one field dropped from every file and one number raised in one | `removed lastTurn ×30` and `changed schemaVersion ×1` |

**What the plants say.** The reordered keys show in `CONFIG_SOURCES`, the
raw files as `configHash()` reads them, and not in `HEALTH`: zod writes a
parsed object's keys in the schema's order, whatever the file's. So for a
config move the raw registry is expected to differ and the proof is that
no parsed export's value does. That holds for object schemas; a record
keyed by id keeps the file's order, and there the reorder would show in
the parsed export too. That last sentence is from how zod works and was
not planted here.

**Not verified.** A real move of a key between two config files, and a
real field dropped from `RunSnapshot`: both are a trial's or a deletion's
own step, and these plants stand in for them.

**A call made here, for the stop.** The tools live under `tests/oracle/`
and run as `npm run oracle`. `scripts/` is outside the type checker, and
`tools/` holds the editors.

Readings: **482,785** at 21:00 on 119d's commit, `d39db14` (3709 of 3709
in 256 files). The step cost about 27k.

### The hand-off before 119e (2026-10-11, session e1342511)

119e would start at 482,785, which is 67k under the line. The session
hands off there: 119e builds three instruments on the TypeScript scanner
and looks larger than that room, with the session's report still to
write. Eight commits, `97468f0` to `d39db14`, none pushed. The session's
report is in `retro/sessions.md`.

**Carried to the stop at 119g** (also in the Cursor): the calls listed
under 119a, 119b and 119d; the session's reading that "Signing all of
your leans" covered the cut and its reads; the spec file as rewritten
after D1 to D4, unread by the user.

**Two of those settled the same evening** (the user, on the hand-off's
report): "Yes, my signature covered the cut and its reads!", and on the
spec, "I never actually read the final spec. I have now, and it's
(retroactively) signed!" The spec's status says so, and its Open section
now marks §119's three decisions as resolved at the shape-lock. What is
left for the stop at 119g is the calls under 119a, 119b and 119d.

**For 119e's step zero.** The count's rule needs a known answer before it
reads the tree. `src/config/configHash.ts`'s header is short and holds two
bare step codes ("53b" and "95e"). The Round 8 close's rough counts (1,972
lines with `§` in 281 files; about 2,400 bare codes in 295) are the scale
to expect and not a target, since their overlap was never measured.

### 119e — the comment instruments (2026-10-12, session a2b4ebd8)

**Step zero.**

- *What `src` holds.* 477 tracked files: 460 TypeScript (181 of them
  tests), 14 GLSL, two CSS and one Markdown. Comments with `§` stand on 41
  lines of the GLSL and CSS, so the reader splits three kinds of file.
- *The scanner alone cannot split TypeScript.* It does not know a regular
  expression or a template's tail from a division or a closing brace, and
  the parser does. So the reader walks the compiler's parse and takes each
  token with the text before it. Two checks are built in and throw: every
  character between two tokens is whitespace or comment, and the tokens
  cover the file end to end. Neither tripped on the 721 TypeScript files
  under `src`, `tests` and `tools`.
- *Comments a tool reads:* `i18n-ok` 31 times and one `istanbul ignore
  next`. No `@ts-expect-error` and no `eslint-disable` in `src`, `tests`
  or `tools`.
- *The shapes a step code takes,* from a survey of the 13,479 comments
  (33,485 comment lines): `§` and a number; a bare number and a letter
  ("74b", "96.5b2-post"); the lettered phases' steps from before the
  phases were numbered ("K1", "GP5.2", "D5.C"), which neither of the Round
  8 close's rough counts names; "Phase" and a phase. And what only looks
  like one: "40px", "30s", "0x70a1", "FNV-1a", "rules 3a/3b".
- *The known answer.* `src/config/configHash.ts` was read whole by hand
  before the rule ran: "53b" on line 2 and "95e" on line 104. The rule
  returns those two.

**Built.** In `tests/oracle/`: `comments.ts` (`splitTypeScript`,
`splitCStyle` for GLSL and CSS, `TOOL_READ`, `measure`),
`strippedCompare.ts` (`readRef` through one `git cat-file`,
`readWorkingTree`, `compareStripped`), `stepCodes.ts` (the rule, written
out in its header; the per-file ceiling), three commands on `npm run
oracle` (`comment-strip <ref>`, `comment-codes [--record|--list]`,
`comment-length`), `comments.test.ts`. At `tests/`:
`comment-codes.test.ts` and `comment-codes-baseline.json`. ARCHITECTURE's
tree and TESTING.md have them. Nothing under `src` or `config` changed.

**The readings** (`src` as at `d8a6e8a`).

- *Step codes in comments:* **6,376 in 434 of the 476 files.** 1,767 with
  `§`, 2,515 bare numbered, 2,016 lettered, 78 with "Phase"; 936 of them
  in test files. The largest folders: `src/sim` 1,825, `src/run` 1,349,
  `src/ui` 948, `src/render` 664, `src/config` 658.
- *Left out by the rule:* 104 rounds and clusters named ("Round 8"), 64
  `§` before a document's section, 696 codes inside strings (a test's
  title, mostly), and 52 in other code (identifiers such as `A0` and
  `D2_BUDGET_FRACTION`).
- *Outside `src`, by the same rule:* 2,129 in 206 files under `tests` and
  368 in 45 under `tools`. The rule's look-alikes were sampled in `src`
  only.
- *Length, the files under `src` that are not tests:* 37,601 lines of
  code, 26,922 lines of comment alone and 234,621 comment words. That is
  42 % of the lines that are not blank, and 6.24 words of comment to a
  line of code. The tests: 37,666, 4,926 and 51,617 (1.37 words a line).
  `src/run/Run.ts` has more comment lines than code lines (2,393 and
  2,336; 20,301 words), as does `src/sim/World.ts` (1,572 and 1,383);
  `src/core/events.ts` has 19.75 words a line.

**Verified, and by what.**

- Typecheck clean. `tests/oracle` and the pin, 35 of 35 in three files (22
  of them new in `comments.test.ts`, three in the pin).
- *The splitter against a second parser* (`scratch/119e/crosscheck.ts`).
  esbuild has its own lexer and drops comments. For 721 of 721 TypeScript
  files, the code pieces joined back into a program compile to the same
  JavaScript as the file. Its controls: with one piece lost from the
  middle, 671 of 716 files are caught (the other 45 were not examined;
  esbuild erases types, which is the likely reason); with every line cut
  at its first `//`, 12 of the 40 files the selector picked. A first run
  without `minifyWhitespace` had 202 files differ, because esbuild keeps a
  comment that stands inside an expression.
- *The line-break flag is not covered by that cross-check.* With every
  line break dropped from the pieces, 0 of 715 files differ: the tree ends
  every statement with a semicolon, so nothing esbuild reads depends on a
  break. The flag rests on its unit test (a block comment that spans
  lines between `return` and its value).
- *The GLSL and CSS reader against a second stripper*
  (`crosscheck-cstyle.ts`): 16 of 16 files leave the same text. For CSS
  the second stripper is the repo's own, `stripCssComments` in
  `tests/cssBlocks.ts`.
- *The count against the raw text* (`reconcile.ts`). The rule run over
  each file's whole text, with no splitting, finds 7,124 matches, and in
  every file they are the comments' 6,376, the strings' 696 and the other
  code's 52. `§` occurs 2,048 times in the files read; `git grep -o` finds
  2,051 under `src`, and the Markdown file holds the other three. The
  Round 8 close's 1,972 lines in 281 files and 2,051 occurrences are
  today's `git grep` numbers as well.
- *Comment lines against grep,* on two files: `events.ts` 595 and 595,
  `movement.ts` 464 and 464.
- *The compare, on the real tree against HEAD* (`plants.ts`; every anchor
  checked before any file is written, each file put back from a copy):

  | plant | files changed | differ in code |
  |---|---|---|
  | none (the control) | 0 | 0 |
  | comments only, five edits in four files (reworded, deleted, re-wrapped, added; TypeScript, GLSL, CSS) | 4 | 0 |
  | a string in code (`configHash.ts`) | 1 | 1, named at line 124 |
  | a string that holds `//` (`MapScreen.ts:319`) | 1 | 1, named |
  | a comment a tool reads, dropped (`Game.ts:484`, `i18n-ok`) | 1 | 1, named |
  | a number in a shader | 1 | 1, named |
  | a number in the stylesheet | 1 | 1, named |
  | the Markdown file under `src` | 1 | 1, as a kind it does not read |
  | a new file | 1 | 1, as added |
  | the comment edits and one code edit together | 5 | 1, the code edit |

  From the command line, `comment-strip HEAD` exits 0 on the comment
  edits ("comments only") and 1 on the code edit.
- *The ceiling:* the pin passes with nothing planted, with look-alikes
  added to a comment, and with a code added inside a string. It fails,
  naming the file and its codes, on a code added to a comment in
  `main.ts` (13 against 12), on one rewritten out (11 against 12), and on
  a new file with one (1 against 0). `--record` with a code added exits 1,
  prints "NOT written", and leaves the baseline's bytes as they were.
- *The unit tests against a broken reader:* seven edits to the readers,
  one at a time, and `comments.test.ts` fails on each (no comment held as
  tool-read, 2 tests; the line-break flag not compared, 1; a CSS string
  not kept whole, 3; CSS reading `//` as a comment, 1; any letter as a
  step, 1; a document's section counted, 3; a code in a string counted,
  1).
- After the plants: the SHA-1 of the three readers and of the baseline is
  what it was, and `git diff --stat` and `git status --short` over `src`
  print nothing.

**What the readings say.**

- **The comment pass is larger than either rough count.** The Round 8
  close had about 2,000 `§` lines and about 2,400 bare codes, overlap
  unknown. By a written rule it is 6,376. The 2,016 lettered codes are
  the likely difference; that was not shown.
- **Length is the larger matter, as D4 took it to be.** Two fifths of
  the source's lines that are not blank are comment. A step code is one
  token; the comment around it is the length.

**Not verified.**

- Whether a rewritten comment is still true. The compare proves the code
  is untouched and does not read a comment. The cold-read probe (119f) is
  the nearest instrument, and the user's read of a sample.
- The 6,376 for look-alikes. Two are known and written into the rule's
  header and its test ("40k" for a quantity, "L9" for a level). The
  lettered class was sampled, 22 tokens with up to three lines each, and
  not read whole.
- `.mjs` files (under `scripts` and `shell`) and JSX are not read. There
  is no JSX in the tree.

**Calls made here, for the stop.**

1. **The ceiling is by file and exact,** in the form of the literal pin: a
   file over its count fails, and a file under it fails until the
   baseline is lowered in the same commit. `--record` refuses a rising
   total and prints any file that rose. That is stricter than the cut's
   words and the same intent. Its cost: every commit that takes a coded
   comment out of `src` runs `--record`, in the deletion phases too.
2. **The parser, where the cut said the scanner** (step zero's second
   item).
3. **GLSL and CSS are read too.** That puts a second CSS comment stripper
   beside `stripCssComments` (`tests/cssBlocks.ts`), which returns no
   comments and does not know a string. One for the census's list of
   duplicates.
4. **What the rule leaves out:** rounds and clusters by name, and codes
   inside strings. A test's title is code to the compare, so rewriting
   one needs another proof. Whether the pass takes them is the user's.
5. **The count covers `src`,** the charter's word. `tests` and `tools`
   hold 2,497 more by the same rule.
6. **A comment a tool reads is held as code,** by a list (`TOOL_READ`).
   `src/render/fontSubset.ts` has `i18n-ok-file` in its header, so that
   whole header is held, and rewording it will show as a difference to be
   read.
7. **The pin is not in the Cursor's permanent gates.** It is a ratchet
   for this round; whether it stays once the pass is done is the user's.
8. META-ROADMAP's figures for the rewrite (about 2,000 and about 2,400)
   are left as written, with this entry as the measured count.

**For the comment pass** (a landing note). Per commit: edit comments
only, run `npm run oracle -- comment-strip HEAD` and read "comments
only", run `npm run oracle -- comment-codes --record`, commit. A commit
that mixes a comment edit with a code edit shows the code edit as a
difference, which is why the pass is committed apart from the deletions.

**Tools kept:** `scratch/119e/` (`survey.ts` and `rule-check.ts`, the
shapes and what the rule leaves; `crosscheck.ts`, `crosscheck-one.ts`,
`crosscheck-cstyle.ts`; `reconcile.ts`; `plants.ts`; `outside-src.ts`).

Readings: **86,058** at 08:28 with the orientation read; **288,831** at
08:56 with 119e built and this entry started; **305,924** at 09:00 on its
commit, `10dd26c` (the hook: 3734 of 3734 in 258 files; the smoke did not
fire). The step cost about 220k.

**A fix the next step found** (2026-10-12, the same session). 119f
stripped every comment from a copy of `src` and held the result against
the compare. It failed on the first file: a header comment deleted whole
took the line break before the first token with it, and the compare
called that a difference. The first piece has no piece before it, so the
flag there carries nothing; it is now always unset, with a test that
failed before the change (a header deleted whole, and a tool-read comment
as the first piece). A tool-read comment that spans lines also no longer
counts its own inner break as one before it. With that, all 295 stripped
files have the code pieces of their originals and no comment left
(`scratch/119f/build-trees.ts`). The ten plants of the table above were
not run again; none deleted a header. Its commit is `632c513` (the hook:
3735 of 3735 in 258 files, on its second run; the first failed on
`tests/store-guard.test.ts` with ten agents running beside the suite,
which is the load timeout TODO lists).

### 119f — the cold-read probe, calibrated (2026-10-12, session a2b4ebd8)

**Step zero.**

- *A reader that writes its answer to a file* is a `general-purpose`
  agent; the pilot's `Explore` cannot write. Its zero task on Haiku is
  58,145 tokens, one tool use (the hand-back) and 6.3 s. The pilot's
  `Explore` on Opus was 34,138.
- *The bar on test files is made structural.* A reader is pointed at a
  copy: `scratch/119f/trees/a` is `src` without `*.test.ts` and without
  `.md`, plus `config` (295 source files, 3,003,081 characters).
  `trees/b` is the same files with every comment out (1,318,862
  characters, 43.9 % of `a`): the planted case. Each stripped file is held
  against 119e's compare, which is how the fault above was found.
- *The transcripts* are in the session store
  (`~/.claude/projects/…/<session>/subagents/agent-<id>.jsonl`). The
  `.output` file each launch names is empty on this machine.
- *What the token figure counts.* The authoring agent reported 276,394 on
  its first return and 283,604 after a second turn that read six small
  files, so the figure is the size its context reached and not a sum over
  calls. The pilot left that open.

**The questions.** Each is a behaviour prediction in two or three parts
whose key is an outcome a test asserts; a run is right when every part
is.

- *Visible, five.* V1 the pool charge (`chipRule.test.ts`), V2 the shove
  (`shove.test.ts`), V3 fatigue (`fatigue.test.ts`); then, after those
  came back right in all nine runs, the harder pair: V4 a periodic status
  across merges and expiry (`statusPeriodic.test.ts`) and V5 the deferred
  flip of a move (`moveDeferred.test.ts`). Each key was written before its
  readers ran (`scratch/119f/visible/keys.md`).
- *Hidden, six,* H1 to H6 in rising difficulty by their author's ranking.
  An Opus agent wrote them into `scratch/119f/hidden/`, which this
  session has not opened. It reports each key's test passing when run
  alone, and each key's value printed by the code. Readers were handed a
  path, wrote their answers into the same folder, and the authoring agent
  graded them and reported counts only. H5 and H6 were run.

**The runs.** 28 of the 30 allowed: the zero task, 15 on the visible
questions on tree `a`, six on V4 and V5 on tree `b`, six on H5 and H6 on
tree `a`. One authoring agent, resumed once to grade. Every reader's
transcript names `claude-haiku-5-5` and no other model.

**The table** (right out of three; tokens are each run's figure less the
zero task's, averaged; the spread is the standard deviation as a share
of that mean):

| question | tree `a` | tree `b`, comments out | tokens, `a` | spread | tokens, `b` | spread | `b` as a share of `a` |
|---|---|---|---|---|---|---|---|
| V1 the pool charge | 3/3 | | 14,365 | 3 % | | | |
| V2 the shove | 3/3 | | 48,285 | 10 % | | | |
| V3 fatigue | 3/3 | | 21,458 | 9 % | | | |
| V4 a periodic status | 3/3 | 3/3 | 55,632 | 18 % | 43,008 | 6 % | 77 % |
| V5 the deferred move | 3/3 | 3/3 | 65,703 | 7 % | 43,405 | 22 % | 66 % |
| H5 (hidden) | 3/3 | | 69,704 | 11 % | | | |
| H6 (hidden) | 3/3 | | 70,777 | 20 % | | | |

Every run, its three figures and its agent are in
`scratch/119f/runs.json`; `stats.ts` prints the table.

**What it says.**

- **Both outcomes the read's script calls wrong happened.** Every cell is
  3 of 3, and the planted tree scores the same. 27 reader runs, 27 right,
  the hidden half's two hardest among them, on every part. Haiku 5.5 does
  not fail at predicting this code's behaviour from its source, with the
  comments or without them. By the cut's branches (harder questions, then
  the token measure) the measure left is the token one.
- **The token measure sees the plant.** With every comment out, V5 costs
  66 % of what it costs with them and V4 77 %. V5's three runs on `b`
  (91,363 to 110,319 whole) all lie under its three on `a` (120,942 to
  129,092); V4's overlap by one run (99,383 to 104,070 against 102,448 to
  121,541). Tool uses and seconds are the same on both trees (V4: 20 to
  21 calls against 19 to 24; V5: 18 to 22 against 20 to 22), so the saving
  is the comment text in what was read and not less looking.
- **The spread.** The standard deviation of a cell is 3 % to 22 % of its
  mean above the zero task, 13 % pooled over the nine cells. That is
  tighter than the pilot's two Opus runs (1.6 times apart).
- **The price.** The 28 runs sum to 2,925,070 by the token figure, 55 %
  of it the cost of starting; a reader run averages 106,182 and 199 s.
  The authoring agent's context reached 283,604.
- **What N the close needs,** from that spread. With Q questions and n
  runs a tree, the mean ratio's standard error is about 13 % × √(2 / nQ).
  All eleven questions at three runs on each of two trees is 66 runs,
  about 7 million by the token figure, and resolves a change of about 7 %
  in reading cost. Seven questions is 42 runs and about 8 %. The lean is
  the first; the call is the user's at the stop.

**What the probe does and does not measure, as calibrated.**

- It measures what a reader has to take in to work out a behaviour, and
  it holds a floor: an answer that was right must stay right. It has not
  shown that it can see comprehension get worse, since nothing here made
  a reader fail.
- It will read any shortening of comments as an improvement, because
  comment text is what it counts. Whether a deleted comment held a reason
  that the code does not is a question none of these eleven asks: they
  predict behaviour, which is what the code decides.
- The reader is an agent. Length does not tire it.

**Not verified.**

- The hidden half's questions and keys, by this session. Their author
  and their grader are one agent. Its notes on H6: two runs reached part
  (c)'s value without showing the step that part was meant to test, and
  one answer lists its files without the tree's prefix. The transcripts
  show all six hidden runs reading inside tree `a`.
- H1 to H4, which were not run.

**Rules kept and broken, from the transcripts**
(`scratch/119f/transcripts.ts`). No reader ran anything, read outside
its tree, or wrote any file but its answer. One of the 27 (V2's third
run) called two tools outside the four allowed: it made a background-task
chip by mistake and withdrew it.

**A fault in a question, found by its readers.** V4 as first put gave a
status definition without saying it was registered, and the periodic
pass reads its op from the registry by the effect's key, so read to the
letter the answer was no events. Five of the six readers said so and
gave the meant answer beside it; they are graded right. The sentence was
added after the six runs.

**Calls made here, for the stop.**

1. **A copy of the tree, not a rule, keeps a reader from the tests.**
2. **`general-purpose` readers that write their answers to files,** so
   that the hidden half's answers stay out of this session's sight.
3. **H5 and H6 were chosen for the run** by their author's ranking, once
   the visible half had saturated. That choice used no hidden score.
4. **Two runs were left unspent.** Both branches of the user's caveat
   were already taken.
5. **The grader is the authoring agent.** A second model's read of the
   hidden half would be the stronger check, and is the user's to ask for.

**Tools kept:** `scratch/119f/` (`README.md` with the prompts and how a
run is launched; `build-trees.ts`; `runs.json`, `stats.ts`,
`transcripts.ts`; `visible/`; `hidden/`, unopened).

Readings: **305,924** at 09:00 at the step's start; **377,514** at 09:14
on the fix's commit, with the first nine runs back; **465,848** at 09:34
with all 28 back. A reader run costs this session about 3k of context in
launch results and notices.

**Read and signed** (the user, 2026-10-12, on the hand-off's report,
which carried the table): "Hah! I need to update my priors on Haiku's
capabilities! Or maybe I just overestimated how complex this code base
was. Probably both. Signing all of your leans, Claude!" So 119f's read is
done ahead of 119g's stop, and two calls are signed by their leans:

- **The probe stays,** as the token measure with a floor on right
  answers. **N for the close** is all eleven questions, three runs, two
  trees: 66 runs.
- **The step-code ceiling is by file and exact** (119e's first call).

The report's third item, what the comment pass covers, stated what is
built and no lean. The session takes the signature to leave it as built
(the comments under `src`; codes inside strings, rounds and clusters by
name, and `tests` and `tools` left out) and has said so to the user once.
The other calls under 119a, 119b, 119d and 119e are still for 119g's
stop.

**Confirmed** (the user, the same day): "Yes, I meant that src/ alone is
fine! I could see an argument for including tests and tools, but I think
that can wait until we see the outcome of this pass on src." The session
agrees: the rule's look-alikes were sampled in `src` only, and `tests`
holds the shapes most likely to miscount (a quartile, a hypothesis, a
percentile). The one cost is that nothing holds a new step code out of a
test's or a tool's comments meanwhile. TODO's tone-audit rider carries the
revisit.

### The hand-off before 119g (2026-10-12, session a2b4ebd8)

119g would start at 482,842 (09:37), 67k under the line. It installs the
coverage tool, runs each proof under it, writes the map into TESTING.md
and closes the phase at a stop that carries the calls of five steps; that
looks two or three times the room. So the session hands off here. Three
commits, `10dd26c` (119e), `632c513` (its fix) and this one, none pushed.
119f was ◐ at the hand-off, and the user read and signed it the same
morning (above), in a fourth commit. The session's report is in
`retro/sessions.md`.

**For 119g's step zero.** The map's rows are parts of the code, and the
proofs now in hand are: the journal corpus with its event digests; the
chaos census; the worktree-baseline fuzz diff; the build's hash; parsed
config equality and the snapshot field diff; and for comments, the
compare with the comments out, the step-code ceiling and the cold-read
probe as calibrated. Which lines each reaches is what the coverage tool
is for. The charter's "byte-identical under the determinism test" still
names a test that compares a tree with itself (the audit's first
finding).

### 119g — the oracle map (2026-10-12, session bb91da2f)

**Step zero.**

- *The coverage tool's version.* `npm install --save-dev
  @vitest/coverage-v8` at a caret range took 4.1.11 and moved Vitest from
  4.1.6 to 4.1.11 in the lockfile, because the package's peer is an exact
  Vitest version. Both files were put back from git and the exact 4.1.6
  installed; the lockfile now only gains lines. So the dependency is held
  exact, and it moves when Vitest does.
- *What the tool costs a run.* The chaos tests take 13 s under it. The
  whole suite takes 98 s against 55 s (its tests summed, 382 s against
  149 s). On the first whole run 16 tests passed their default 5 s limit
  and one its own 30 s limit, and Vitest wrote no coverage because a test
  had failed. So the recorder raises the default limit and asks for a
  reading on failure. `tests/integration/journal-replay-full.test.ts` has a
  limit of its own, which no flag raises: at 30 s it passed one whole run
  under the tool and timed out in six, four of them alone on the machine
  ("A deleted test", below, where it is raised).
- *The fuzz diff is a command line under tsx,* which leaves nothing the
  tool reads. Its shapes go through the same entry inside Vitest
  (`runRunCli(parseArgs(flags))`), with the flags read out of
  `scripts/perf-oracle.sh` so that they keep one home.
- *Where the heavy runs go.* Two detached worktrees of `a45a7af` in the
  session's scratch directory, each with a `node_modules` junction, so
  that a plant never edits the live tree under a running proof. Not every
  plant went there: "A mistake", below.

**Built.** `tests/oracle/reach.ts` (`PROOFS`: the corpus, its quick rows,
the chaos seeds, the fuzz diff, `npm test`, the smoke; `record` runs one
under the tool and writes `output/reach/<proof>.json` with the run's log
beside it; a reading is lines, functions and branch arms by file;
`countAt`, `functionsAt`, `countBy`, `union`, `lost`),
`tests/oracle/proofs/fuzzDiff.proof.ts` with `proofs.vitest.config.ts`,
`tests/oracle/buildHash.ts` (`compareBuildWith`), four commands on `npm
run oracle` (`reach-record`, `reach`, `reach-diff`, `build-hash [ref]
[--dev]`) and `reach.test.ts`. TESTING.md has "The oracle map" and the two
tools; ARCHITECTURE's tree has the files; META-ROADMAP's exit names the
corpus and the fuzz diff where it named the determinism test. Nothing
under `src` or `config` changed.

**The readings** (the share of a folder's lines that start a statement
which each proof ran, at `a45a7af`; "the two" is the corpus and the fuzz
diff between them):

| folder | lines | corpus | fuzz diff | the two | chaos | `npm test` | smoke |
|---|---|---|---|---|---|---|---|
| `src/sim` | 2,877 | 86.7 | 85.5 | 90.1 | 75.2 | 98.6 | 92.6 |
| `src/run` | 2,211 | 68.9 | 64.8 | 73.3 | 67.1 | 97.2 | 78.7 |
| `src/config` | 838 | 83.8 | 81.0 | 83.8 | 83.2 | 96.4 | 83.8 |
| `src/core` | 80 | 73.8 | 71.3 | 78.8 | 73.8 | 96.3 | 78.8 |
| `src/bot` | 648 | 0 | 86.0 | 86.0 | 0 | 99.4 | 86.1 |
| `src/journal` | 263 | 40.7 | 0 | 40.7 | 46.0 | 97.3 | 40.7 |
| `src/render` | 2,131 | 0 | 0 | 0 | 0 | 40.9 | 0 |
| `src/ui` | 3,672 | 0 | 0 | 0 | 0 | 10.0 | 0 |
| `src/scenes` | 205 | 0 | 0 | 0 | 0 | 8.8 | 0 |
| `src/store` | 337 | 0 | 0 | 0 | 0 | 100.0 | 0 |
| `src/dev` | 1,443 | 0.1 | 0 | 0.1 | 1.9 | 33.1 | 0.1 |
| `tests/fuzz` | 4,433 | 0.9 | 27.3 | 28.2 | 0 | 5.3 | 65.2 |

Under `npm test` alone: `src/audio` 96.2, `src/i18n` 97.8, `src/diagnostics`
91.3, `src/settings` 89.1, `src/failure` 70.5, and `Game.ts`, `main.ts` and
the two files beside them 3.6. All 398 files the tool read hold 28,862
such lines, and the six proofs between them run 49.7 %. Recording takes 93,
16, 18, 80, 103 and 209 s.

**The reading held against its proof.** The reader's unit tests use a
coverage file written by hand, and each of 22 rules taken out of the
reader fails them (`scratch/119g/readerPlants.ts`; the clean file passes).
The tool itself was checked from the other side
(`reachPlants.ts`): from 2,348 sites in `src/sim` and `src/run` where a
statement starts on a keyword inside a function, ten the corpus's reading
calls reached and ten it calls unreached were drawn by a seeded draw, a
`throw` was planted in front of each, and the corpus was run. All ten
reached sites failed it with the plant's own message, and all ten
unreached sites left 30 of 30 journals matching. Two known answers from
119b and 119c read the same: the damage line in `World.ts` is reached, and
`handleBuyPortUnit` is called 18 times by the corpus with three of its six
lines run, the guards and not the purchase.

**The planted breaks** (`scratch/119g/plants.ts` over `plantTable.ts`:
every anchor found once before any edit, each proof run on the clean tree
first and the two that compare against it run twice, the file put back
from the text read before the edit, `git status` equal at the end).
"Suite" is every file of `npm test`; a blank is a proof not run for that
plant.

| the break | corpus (of 30; quick rows of 3) | fuzz diff | suite | build |
|---|---|---|---|---|
| `src/sim/World.ts`: every hit deals one more | 30; 3 | both shapes | 13 files | |
| `src/sim/behaviors/CampWanderBehavior.ts`: the mirrored step | 18; 2 | both | the quick rows only | |
| `src/sim/effects/interpreter.ts`: a heal restores one more | 10; 1 | scored only | the quick rows only | |
| `src/sim/Pathfinding.ts`: the search estimates by the sum, not the larger | 8; 0 | **no** | **no** | |
| `src/run/Run.ts`: a declined reward does nothing | 8; 1 | arm only | **never returned** | |
| `src/run/Run.ts`: a unit bought at a port never joins | **0** | **no** | `Run.test.ts` | |
| `src/run/NodeMap.ts`: a three-way split half as often | 4; 0 | **no** | `journal-replay-full.test.ts`, by an assertion | |
| `config/health.json`: a rest heals half | 3; 0 | **no** | `tests/oracle/oracle.test.ts` | another hash |
| `src/config/difficulty.ts`: the wrong multiplier handed out | 30; 3 | both | 4 files | |
| `src/core/RNG.ts`: the keyed streams' derivation takes another constant | 30; 3 | both | 8 files | |
| `src/core/fnv1a.ts`: the digests' own hash | 30; 3 | no (right: no run changed) | `configHash.test.ts`, the quick rows | another hash |
| `src/bot/evaluator.ts`: a won rollout scores as a draw | 0 | arm only | `evaluator.test.ts` | the same hash |
| `tests/fuzz/strategies/scored.ts`: a level counted twice | 0 | scored only | no; the smoke: **no** | |
| `src/journal/JournalRecorder.ts`: each order a tick late | 0 | no | 8 files | another hash |
| `src/render/BattleRenderer.ts`: a shove a hundredth further | 0 | | **no** | another hash |
| `src/render/shaders/terrain.frag.glsl`: a floor on the diffuse light | | | **no** | another hash |
| `src/ui/MapScreen.ts`: hops a pixel further apart | | | **no** | another hash |
| `src/ui/ui.css`: a rule gains a declaration | | | **no** | another hash |
| `src/scenes/menuRules.ts`: the seed field keeps a digit more | | | `menuRules.test.ts` | another hash |
| `src/Game.ts`: the turn's outro a millisecond longer | | | **no** | another hash |
| `src/audio/eventSounds.ts`: a sound plays at zero | | | `eventSounds.test.ts` | another hash |
| `src/store/runSlot.ts`: a saved run comes back without its journal | | | **no** | another hash |
| `src/failure/rules.ts`: the context wait a millisecond longer | | | **no** | another hash |
| `src/diagnostics/report.ts`: a text reworded | | | **no** | another hash |
| `src/dev/devKeys.ts`: a dev key logs another word | | | no | the same hash |
| `tools/run-config/cli.ts`: a flag's value keeps its equals sign | | | **no** | the same hash |
| a comment added to `World.ts` | | | | the same hash |
| a comment added to a shader | | | | **another hash** |
| a comment added to `ui.css` | | | | the same hash |
| an exported function nothing calls, added to `fnv1a.ts` | | | | the same hash |
| `src/journal/replayJournal.ts`: the config refusal switched off | | | | the same hash |

**What the plants say.**

- **A sim or run change is proven by the whole corpus and by nothing
  smaller.** The path-search change moved 8 journals of 30 and nothing
  else: not the three quick rows, not the fuzz diff's two shapes, not one
  unit test. Of the four sim plants `npm test` saw one in its unit tests,
  two through the quick rows alone and one not at all. The fuzz diff
  missed four of the nine sim, run and config plants. Its reading says
  why for two: it never buys a unit at a port and never takes a three-way
  split (it runs that test and not its body). It does run the path
  search's line, and its CSVs came out the same, which is the fuzz diff's
  own case of reached and not proven. The rest was not looked into.
- **The corpus has a hole where no stored run goes,** and the reading
  names it before the plant does. A unit bought at a port and never added
  to the roster passes both byte proofs; one unit-test file holds it. The
  same is expected of the other three trades the corpus never completes
  (119c), and was not planted.
- **`npm test` can hang where it should fail.** Under the declined-reward
  break one worker spun for 391 CPU-seconds before it was stopped by
  hand. The loop is `while (run.phase === 'reward') run.dispatch({ kind:
  'declineReward', index: 0 })` at `src/run/Run.test.ts:5575`: with the
  plant in a second worktree and the suite stopped after 120 s, 253 of
  that file's tests had printed nothing and every other file had
  (`hangHunt.ts`). 119c ran `tests/chaos` alone under this plant, so it
  did not show then. TODO has it, with the count of `while (` lines in
  test files (55 in 24).
- **Reached is not proven, on a real case.** The suite runs every line of
  `src/store`, and a saved run that comes back without its journal fails
  no test. Eight of the ten plants in shipped code with no headless
  driver were seen by the build's hash alone.
- **The build's hash does what the audit expected of it, with one
  exception to know.** A comment in TypeScript or in the stylesheet, an
  export nothing imports, the bot, the replay tool, `src/dev` and the
  tools all leave it alone, and every edit to code the game runs moves
  it. A shader's comment moves it too: the `.glsl` files ship as text. So
  a comment pass over the shaders is proven by the comment-stripped
  compare and shows as a difference here.

**The build compare.** `build-hash` builds the ref's tree in a worktree
under `output/build-hash/`, inside the repo, so packages resolve from the
repo's own `node_modules` and there is no junction to make or to remove.
The working tree against HEAD is the same bytes (32 files, about 20 s for
the two builds), which also shows the build does not depend on the path it
is made at. On the live tree (`build-hash-plants.sh`): a render constant
differs with exit 1 and three built files named; a comment is the same
bytes with exit 0; a dev key's text is the same bytes in the production
build and differs under `--dev`. The first `--dev` came back with the
production build's own hash: `--mode development` alone leaves DEV off,
since Vite reads it from `NODE_ENV`, as the Electron runner's build
already knew. The command now sets it and checks each build for its dev
chunk, in both directions.

**The page drive, as a proof for the wiring** (`drivePlants.ts`, in a
worktree). `npm run probe -- shell/electron/probes/drive-run.js --seed=7
--dials=hops=3` takes 18 s and gives the same log hash and state hash on a
second run, on a second shape (`--seed=6 --dials=hops=2&firstNode=rest`),
and in a worktree as in the live tree. A turn that is never advanced fails
it (exit 1), and a sim change moves both hashes. It did not notice
`Game.dispatch` no longer mounting the map after a rest, nor a change that
is only drawn. So it proves the page still plays the run through `Game`,
and not that each phase shows its screen. TODO has the scene check.

**The type check** (`typecheck-plants.sh`): a used export removed fails
with 7 errors naming its importers; an unused local fails; an unused
export added passes. It proves a deletion left nothing dangling and does
not find dead exports.

**A deleted test** (`reach-diff-plants.sh`, in a worktree). The suite's
reading was taken five times. Two clean readings lose nothing to each
other, in either direction. With `src/store/backup.test.ts` deleted the
reading loses 20 lines, 4 functions and 23 branch arms, all in
`src/store/backup.ts`. With `src/run/enemyBudget.test.ts` deleted it loses
no line and no function, and two branch arms of `enemyBudget.ts`: every
line that file's own tests run, another test runs too. That is what the
check can and cannot say. The second deletion keeps the suite's reach and
may still drop the only assertion on some value.

Two things the recordings showed on the way. `journal-replay-full.test.ts`
failed its own 30 s limit in all four recordings, alone on the machine,
so the suite's reading always came from a run with one failure. Its limit
is now 120 s; a fifth recording passes 3,735 of 3,735, and its reading
loses nothing to the timed-out ones, nor they to it, so the table above
stands (re-printed from the passing run: the same shares). And with any
file under `src` deleted, the step-code ceiling fails until `comment-codes
--record` runs, since it is by file and exact: every deletion commit
under `src` will meet that.

**What the readings already show the census** (leads, each unread): of the
lines neither byte proof runs, `src/sim` has 285 and all but 32 are run by
some test; `src/run` has 591 and all but 60. Whole files the byte
proofs never load: `src/run/mapMetrics.ts` (115 lines), `src/sim/layoutConnectivity.ts`
(35), `src/run/fallenStats.ts` (27), `src/core/Clock.ts` (11), and 35 of
`src/run/enemyBudget.ts`'s 37 (`scratch/119g/unreached.ts`). Some of
these have their consumer in the UI, which no headless proof loads; the
build compare is what tells those from code nothing ships.

**Not verified.**

- That a proof which runs a line notices a change to it, beyond these
  sites. The plants are 31 sites, chosen and not drawn.
- The page drive's own reach: the tool does not read an Electron page.
- `build-hash` has no unit test (two builds take 20 s); its checks are
  the plants above.
- `src/settings` and `src/i18n` had no plant, and the smoke met one.
- The shares on any tree but `a45a7af`.

**Calls made here, for the stop.**

1. **The coverage tool is held at Vitest's exact version,** where the
   other dev dependencies carry a caret.
2. **`reach` is a kept tool with a test,** where the cut's words were
   "the proofs, each with its planted break". The census asks "which
   proof runs this line?" once per candidate, and a table in a document
   cannot answer it.
3. **`build-hash` is a kept command.** The audit called the build's hash
   a ready proof; as a recipe it was a worktree, a pinned ID, two builds
   and a compare by hand.
4. **The readings are not tracked** (`output/reach/`, about 4 MB); seven
   minutes re-derives them.
5. **The fuzz diff's flags are parsed out of its shell script** for the
   in-process run, so they have one home.
6. **The charter's clause** now names the corpus and the fuzz diff, and
   says why the determinism test and the smoke's other tests are gates.
7. **Two findings went to TODO and were not fixed here:** the test loop
   that hangs, and the page drive's blind spot for scenes.
8. **Not built:** a pixel proof for a reshaping of code that only draws,
   and corpus rows that complete the four port trades. Both are the
   user's, with the census's candidates in hand.

**A mistake.** The build compare's own six plants edited source files in
the live tree, each put back within 20 s, before the session looked at
port 5173, where the user's dev server was listening. Any tab open on it
will have reloaded up to twelve times. `process/oracles.md` warns of this
for a config dependency; a source file does the same to an open page. The
next live-tree batch (the page drive's) was stopped before its first edit
and moved to a worktree.

**Tools kept:** `scratch/119g/` (`plants.ts` with `plantTable.ts`,
`reachPlants.ts`, `readerPlants.ts`, `drivePlants.ts`, `hangHunt.ts`,
`build-hash-plants.sh`, `typecheck-plants.sh`, `reach-diff-plants.sh`,
`unreached.ts`, `unreachedAny.ts`, `shipped.ts`, `cov.sh`, and each run's
log and JSON).

Readings: **87,684** at 10:23 with the orientation under way; **396,634**
at 11:16 with the first batch of plants running; **468,992** at 12:01 with
this entry written; **476,705** at 12:04 on the instruments’ commit,
`ef06f65` (the hook: 3752 of 3752 in 259 files; the smoke did not fire).
The step cost about 390k, where
the hand-off guessed two or three times 67k: most of it is the plants'
and the readings' output read back, and four rounds of re-checking a
claim against a tool.

**Read and signed** (the user, 2026-10-12, on the stop's report). On the
report's three questions: "1. Yes, let's definitely fix that! 2.
Definitely! 3. I agree; it's not needed now." And: "This was an absolutely
massive step, much larger than I predicted, but I'd say that those
coverage numbers work out to being worth it! Signing all of those calls,
too!" So, signed by their leans:

- every call listed under 119a, 119b, 119d, 119e and 119g above;
- 119f's fifth: no second model's read of the hidden half for now;
- `reach` and `build-hash` as kept commands, built inside this step;
- 119b's fifth is decided at the round's close, with today's evidence
  leaning to the corpus staying in the smoke tier;
- the pixel proof, the port trades' corpus rows and the page drive's
  scene check wait for the census to list candidates where they apply;
- the test loop is fixed now (below).

### 119g-post — the reward loops bounded (2026-10-12, session bb91da2f)

**Built.** `src/run/Run.test.ts`: `acceptAllRewards` and
`declineAllRewards` go through one `settleRewards`, a loop of at most 64
tries with an `expect` on the count, and the one test that drained
`pendingRewards` inline is bounded the same way. No other file.

**Verified** (`scratch/119g/post-plants.sh`, in a worktree under
`output/`, which needs no `node_modules` link and which the dev server
does not watch). Nothing planted: 380 of 380 in the file. A declined
reward made a no-op: the file returns in 4 s with 29 tests failed by the
bound's own message, where it never returned before; the whole suite
returns in 55 s with 34 failed in 4 files. An accepted reward made a
no-op, which was not tried at 119g: 55 failed in 4 s.

**Not done.** The other 52 `while (` lines in test files, unread. TODO
"§119 riders" keeps them for the tests phase.

### The close of §119 (2026-10-12, session bb91da2f)

**The exit, held against the cut.** Every part of the code the census
will list candidates in has a named proof in TESTING.md "The oracle map",
each shown to fail on a planted break, with five exceptions the map names
as having none: a reshaping of code that only draws, which scene a phase
mounts, the four port trades no stored run completes, the tools and build
scripts, and the lines neither byte proof runs. The charter's five
instruments are built (119a to 119e), as are the kickoff's two (119a's
mapping, 119d's config equality), the probe (119f) and the coverage tool
(119g). Nothing was deleted, and nothing under `src` changed but one test
file's loops.

**Two decisions the user made at the close,** from two questions of
theirs ("Is there anything else that you would like to build for even
greater coverage that's not in the plan?" and "Do you think that we
should update our dependencies at some point soon? Probably a bonus phase
at round end?"). The session's answers, and "I like this plan, Claude!
Signing your recommendations!":

- **A drawn sample of planted breaks is the census's first step.** The 31
  sites were chosen. A sampler draws about 200 lines the proofs run, makes
  one mechanical edit at each, and runs the corpus, then the suite for
  what the corpus misses. It gives a rate by folder, and each survivor is
  dead code, a hole or an edit that changes nothing. It also bears on the
  user's question of which tests are necessary. In ROADMAP §120.
- **A dependency phase at the round's end, after the Round 8.5 build is
  tagged,** so that the cleanup's upload stays the same game and the new
  versions get a round of play before they reach anyone. As of today 15
  packages are behind; three touch what ships (`three` 0.184 to 0.186,
  `vite` 8.0 to 8.3, `zod` 4.4 to 4.6); TypeScript 7 and Vitest 5 are
  majors and each its own step, with the release notes read first (the
  comment and import-graph instruments walk TypeScript's parser); `npm
  audit` lists nine advisories, all in build and test tooling by package
  name, none read. Vitest and its coverage tool to 4.1.11 is the natural
  first item. In META-ROADMAP §Round 8.5.

Not built by the user's choice and the session's lean: more corpus rows
for the share's own sake, and a pixel proof before a reshaping needs one.

Readings: **482,960** at 12:07 on the record's commit, `e3f88b1`;
**517,769** at 13:05 with the close written; **522,024** at 13:10 on the
`-post`'s commit, `1798249` (the hook: 3752 of 3752 in 259 files, and the
smoke 624 of 624 in 65). The answers, the `-post` and the close cost about
40k.

## Phase 120 — the census

### The kickoff: the audit, and the cut put to the user (2026-10-12, session 79f18990)

Pre-flight at `0b41e97`: the tree clean but for one friction-log line of
session bb91da2f's, committed with this entry. `git diff --stat a45a7af
HEAD -- src config` names one file, `src/run/Run.test.ts`, so the reach
readings under `output/reach/` still describe every source line. The
user's dev server is listening on 5173, so each plant of this phase goes
in a worktree under `output/`. Nothing was built. ✔ marks a number this
session counted, by `scratch/120-kickoff/audit.mjs` over tracked files
(each section prints its rule) unless another source is named. No source
file was read whole, and no candidate was classified.

**What the census has to cover, counted** ✔.

- *Source.* 279 `.ts` files under `src` that are not tests, 63,458 lines:
  sim 15,086 in 56 files, ui 10,241 in 49, run 9,544 in 19, render 7,668
  in 23, config 5,785 in 34, dev 4,582 in 22, bot 2,121 in 11, and ten
  smaller folders under 1,500 each. Two stylesheets hold 4,875 lines and 14
  shaders 732. Half of the `.ts` lines are in the 39 longest files:
  `Run.ts` 4,888, `World.ts` 3,093, `BattleRenderer.ts` 2,122, `Game.ts`
  1,287, `PreTurnScreen.ts` 1,120.
- *Exports.* 1,521 lines open an export declaration in those files (sim
  311, config 249, ui 188, render 146, run 144, dev 125), by a pattern and
  not a parse.
- *Tests.* 324 test files, 70,436 lines: 181 beside the source (46,980)
  and 143 under `tests/` (23,456, of which the smoke's 65 files hold
  11,559). 4,071 `it(` or `test(` call sites by a pattern.
  `src/run/Run.test.ts` is 6,894 lines with 380 of them; the next longest
  is `World.test.ts` at 1,578. Thirty files have at most two sites.
  Another 84 files under `tests/` are not tests, 22,950 lines, 17,286 of
  them the fuzz instruments.
- *Tools, scripts and the shell.* 105 files and 29,709 lines, 23,221 of
  them in `tools/` (17 folders; each one's name appears in
  `tools/index.html`, and thirteen were last committed to before
  September).
  The oracle map lists no proof across a commit for any of it.
- *Config.* 34 files, 6,381 lines, 6,873 values (the scalars of each
  file's parsed JSON). Five content tables hold 5,895 of them (layouts
  3,377, encounters 843, units 675, abilities 590, events 410); the other
  29 files hold 978. So a count of dials is a count of schema keys, with a
  table's entries collapsed, and it is the reference finder's to give.
- *Run dials.* `RUN_CONFIG_PARAMS` names 13 URL parameters
  (`src/run/RunConfig.ts:306-320`, read). Others are read under `src/dev`
  (the board panel's `bp`, the failure plant's) and by `bootsToMenu`; the
  fuzz command line's flags were not counted.
- *What is already listed elsewhere.* TODO holds 91 open items. The
  step-code ceiling stands at 6,376 (119e).

**What the audit found.**

- **Nothing in the repo answers "who reads this?" with types.** The
  import graph (`tests/importGraph.ts`) follows run-time imports by file,
  and the coverage readings say which lines ran. A dial with no reader, an
  export nothing imports and an export only its own test imports are all
  questions about a name's references, which today is `git grep` and a
  read of each hit. Every config loader has one shape (a zod schema, then
  `export const X = Schema.parse(json)`; `src/config/economy.ts` read), so
  one finder over TypeScript's language service can serve the dials and
  the exports both, if it follows a key through zod's inferred type.
  Whether it does is 120b's step zero.
- **The type check does not include `scripts/`** (`tsconfig.json`'s
  `include` is `src`, `tools`, `tests` and two config files, read). Its
  five `.ts` files are checked only if something included imports them,
  which was not looked into. A reference finder has to add them or it
  will miss their reads.
- **The entry reaches 263 of 295 source files at run time**
  (`scratch/119g/shipped.ts --list`). The 32 it does not reach include the
  bot's eleven, the journal replay's three and five of `src/i18n`, which
  tools and tests load; files that by their names hold only types, which
  the graph does not follow; `ui.css`, which the page loads and no import
  does; and `src/run/mapMetrics.ts`, `src/sim/layoutConnectivity.ts`,
  `src/core/rngStreams.ts`, `src/dev/replayTrace.ts`. Leads, each unread.
- **No tool finds duplicates.** None is installed, and the comment
  instruments already walk TypeScript's scanner, which is what a
  token-run finder needs.
- **The suite's reach is known as a whole and not by test file.** "Which
  tests are truly necessary" (the user's candidate) needs each file's own
  reach, and `reach-diff` costs a whole recording per deleted file. Each
  file run alone under the coverage tool gives the lines only it runs.
- **Track B's reading has a size.** The spec's profile is read "from the
  top". The five longest files are 12,510 lines, and reading the 39 that
  hold half the code is about 31,700 lines, more than one session holds
  beside its work.
- **The sampler's population** (from 119g's table, at the same source):
  the corpus runs about 2,490 statement lines of `src/sim`, 1,520 of
  `src/run`, 700 of `src/config` and 59 of `src/core`; some test runs
  another 253 in sim and 531 in run that neither byte proof does. A corpus
  check takes 17 to 21 s (119b) and the suite 55 s.

**The cut, as put to the user** (unsigned as this is written; ROADMAP
gets it once it is signed). No step changes anything under `src` or
`config`, so none predicts a snapshot bump, a new stream or the fuzz
smoke; a step that has to touch `tests/fuzz/` fires the smoke once.

- *120a, the drawn sample* (signed ahead of the cut). 200 sites drawn by
  a seeded draw from lines a proof runs, one mechanical edit at each
  through TypeScript's parser (a condition negated, a comparison's
  boundary moved, `+` and `-` swapped, a number raised by one, a call
  statement removed). 140 from lines the corpus runs (sim 60, run 50,
  config 20, core 10): the corpus, then the suite for what it misses,
  then the fuzz diff and the smoke for what both miss. 30 from the sim
  and run lines only tests run, and 30 from shipped code no headless
  proof loads (store, journal, audio, settings, failure, diagnostics,
  i18n, scenes, render, ui): the suite. The bot is left out. Before the
  draw the runner must reproduce three known answers: the damage line (30
  of 30), the port purchase (no journal; `Run.test.ts`), and an added
  comment (nothing). Exit: a row a site; the rate by folder, by proof and
  by operator; each survivor read and classed as dead code, a hole or an
  edit that changes nothing; the tree as it was. In the background, on
  worktrees under `output/`, about two to three hours, killed at twice
  that. Read: `batch`, at 120c's stop (the rate table and the survivors;
  wrong is a folder whose named proof misses most of what it runs). It
  becomes a stop of its own if its reading changes which proof the map
  can name for a folder.
- *120b, who reads this.* A reference finder over TypeScript's language
  service: for each export under `src`, each key of each config schema
  and each `RunConfig` field, its readers by kind (shipped code, the bot
  and fuzz instruments, tests, tools, scripts). Exit: it lists a planted
  export nothing imports, a planted one only a test imports and a planted
  config key nothing reads; it does not list `ECONOMY.startingBits`; and
  it counts the string-keyed reads it cannot follow. Read: `none`.
- *120c, the dials.* Every config key by schema path, `RunConfig` field,
  URL parameter and fuzz flag: its readers, whether any value but its
  default is set anywhere (config, tests, the balance arms, scripts), its
  GOTCHAS check, a proposed fate and the proof that covers it. Content
  nothing refers to (an ability no unit has) is listed apart. The census
  file and its row format start here. Read: `stop`: each dial's fate is
  the user's, and every later list is written in this format.
- *120d, exports, files and exact duplicates.* From 120b: exports nothing
  reads, exports only tests read, files no entry loads (the game, the
  tools' pages, the scripts and the tests each as entries), with `tools/`,
  `scripts/` and `shell/` listed for deletion only. A token-run finder
  for identical runs in two places, with a planted copy it must find; the
  same runs with names and literals normalised are leads for 120f. Read:
  `batch`, at 120e's stop (each class's count and ten drawn rows of it;
  wrong is a row whose reader the user knows of).
- *120e, the tests.* By test file: its sites, lines and seconds, the
  lines only it runs (each file alone under the coverage tool, about half
  an hour by a guess), and the sampled breaks it caught. The bottom of
  that list read and classed (pins a config value, repeats another file,
  states a basic fact, holds a rule). File by file; the 380 tests of
  `Run.test.ts` one by one are the tests phase's. Read: `stop`: whether a
  test is redundant is the user's call.
- *120f, the trials.* The profile for all 279 files (lines, commits, fix
  commits, gotcha references, special-case sites); the near-duplicate
  clusters; the special cases grouped by what they test; the user's two
  named trials sized (the neutral team, the config files); `Run.ts` and
  `World.ts` read whole. Each trial with what it expects to remove,
  counted, and its proof from the map or "none today". Fragile code that
  only a behaviour change fixes is listed for TODO. Read: `batch`, at
  120h (wrong is a trial the user would not want tried).
- *120g, the TODO pass's list.* The 91 open items, each proposed as
  done, dropped or given a round. Read: `batch`, at 120h (wrong is a
  rider dropped that the user still wants).
- *120h, the census signed and the round sized.* The lists signed, Track
  B's budget set, the phases after this one written into ROADMAP, the
  phase closed. Read: `stop`.

**The calls put with it,** each with the session's lean.

1. *The census is a tracked file of its own,* `round-8.5-census.md`
   beside the spec and archived with it. A class a search settles (an
   export with no reference anywhere) is signed as a class, with ten
   drawn rows to check; a judgement (a dial, a test, a trial) is signed
   row by row.
2. *The sample's strata and operators,* as in 120a.
3. *Two tools are kept with tests,* `npm run oracle -- plant` and `refs`,
   because each deletion batch needs its failing control and a deletion
   exposes more dead exports. The duplicate finder, the profile and the
   per-file reach stay in `scratch/` until something runs them twice.
4. *The dials' scope takes in the fuzz flags and unreferenced content,*
   and `tools/`, `scripts/` and `shell/` are in the census for deletion
   only, since nothing proves a reshaping there.
5. *Tests are censused by file.* The session's doubt, said plainly: a
   search is weak evidence that a test is redundant, so this list is the
   likeliest to come back as classes with examples and not as rows ready
   to delete.
6. *Track B reads two files whole in the census* and leaves the rest of
   the profile's top to each subsystem's kickoff and to D1's re-skim. The
   other arm is small readers fanned out over the 39 longest files, about
   2M tokens by the pilot's starting cost, with every lead second-hand
   until checked.
7. *The TODO pass's list is a census step,* and doing what it marks
   "done" belongs to the phases.
8. *No second model's review of the two instruments,* as at §119: each
   carries planted known answers.
9. *Where the stretch runs.* From 192k the stretch to 120c's stop
   probably does not fit under the line. The lean is to start here with
   120a and 120b, the batch running while the finder is built, and to
   hand off before 120c.

Readings: **91,402** at 13:50 after HANDOFF and `process/planning.md`;
**125,002** at 13:51 by the tool's clock, with the spec, §119's record and
the oracle map read; **192,344** at 14:02 with the audit run and the cut
drafted; **210,866** at 14:08 on the fix's commit below, `0f61148`.

**Outside the cut, done here.** This entry's commit failed its hook twice
running on `tests/store-guard.test.ts` passing the default 5 s, with no
node process beside the suite but the user's dev server (the process
list, read after the second failure). The file takes 2 s alone and took
9 s inside the suite. Its two whole-repo walks now carry a 30 s limit
(`0f61148`; the hook then ran 3752 of 3752 in 259 files), which is the fix
TODO's Round 8 close rider names, for one of its three tests. One green
run does not show the limit is enough; the next failure there would.

**Signed** (the user, 2026-10-12): "Signing the cut, all nine leans, and
the commit hook change, Claude! 😁 This looks great to me!" So: the cut
and its reads, the nine calls by their leans, and `0f61148`. The cut is in
ROADMAP §120. The stretch starts in this session with 120a and 120b and
hands off before 120c (the ninth call). Reading: **213,308** at 14:09 on
the kickoff's commit, `770439c`.

### 120a — the drawn sample (2026-10-12, session 79f18990)

**Step zero.** The corpus check takes 21 s (26 s through npm). The reach
readings still describe the source: `git diff --name-only a45a7af -- src`
names one test file, and the sampler refuses to run otherwise.

**Built.** Kept: `tests/oracle/plant.ts` (`edits`, `editsOn`, `applyEdit`:
five kinds of edit through TypeScript's parser), `plantProofs.ts` (a
worktree under `output/plant/`; the corpus's, the suite's, the smoke's
and the fuzz diff's verdict on it; a run past its limit stopped with its
whole process tree), `npm run oracle -- plant --at=<file>:<line>`, and
`plant.test.ts`. Each of 12 rules taken out of the edit maker fails that
file (`scratch/120a/rulePlants.mjs`). In `scratch/120a/`: `sample.ts` (the
draw, seed 120, to `sites.json`), `batch.ts` (`known`, `check`, `corpus`,
`suite`, `last`, `report`; `results.json` is written after each verdict),
`survivors.ts` (each unnoticed site with the lines around it), and the
three logs.

**What the runner's own checks caught before any verdict was taken.**

- *A test that fails in every worktree.* The known answers came back with
  `tests/licences.test.ts` failing under an added comment: it reads
  `node_modules/<package>/LICENSE` beside it, and a worktree has no
  `node_modules`. So every proof now runs on the clean worktree first,
  and a test file that fails there is set aside and named. With that, all
  five known answers reproduce: every hit dealing one more moves 30 of 30
  journals; a port purchase that never joins moves none and fails
  `Run.test.ts` alone; an added comment fails nothing.
- *Line endings.* The first launch stopped at its first site, by
  `applyEdit`'s refusal, with nothing planted. 29 files under `src` are
  checked out with CRLF in the live tree (`git ls-files --eol`: `w/crlf`
  against `i/lf`; `.gitattributes` asks for LF) and a fresh worktree has
  LF, so an edit's offsets do not carry over. The batch now finds each
  edit again by its line and text; 200 of 200 are found. The command was
  not affected, since it lists its edits from the worktree's own text.
- *A backslash lost on the way to a file,* twice, in patch scripts written
  through a shell heredoc: once as a regex that still parsed and matched
  nothing (the command refused every `--at`; seen on its first run), once
  as an anchor that no longer matched, where the patch refused to write.
  Both are in the friction log for the round's shell-quoting audit.

**The population.** A site is a line that starts a statement, that a
proof ran, and that admits an edit. About half of the lines do:

| stratum | folder | lines | admit an edit | drawn |
|---|---|---|---|---|
| S1, lines the corpus runs | `src/sim` | 2,493 | 1,263 | 60 |
| | `src/run` | 1,524 | 769 | 50 |
| | `src/config` | 702 | 253 | 20 |
| | `src/core` | 59 | 38 | 10 |
| S2, lines only tests run | `src/sim` | 245 | 117 | 10 |
| | `src/run` | 531 | 270 | 20 |
| S3, shipped code no headless proof loads, lines the suite runs | ten folders | 2,047 | 1,040 | 3 each |

200 sites in 65 files: 69 conditions negated, 51 calls removed, 43
numbers raised by one, 21 signs traded, 16 boundaries moved. Lines are
drawn uniformly inside a folder, so a folder's rate weighs its lines
alike.

**The verdicts** (the corpus on four worktrees in under ten minutes; the
suite 91 times in 89 minutes; no site faulted, no run was stopped at its limit,
every worktree was left as it was):

| | sites | the corpus | then the suite | neither |
|---|---|---|---|---|
| S1 `src/sim` | 60 | 52 | 1 | 7 |
| S1 `src/run` | 50 | 39 | 3 | 8 |
| S1 `src/config` | 20 | 8 | 8 | 4 |
| S1 `src/core` | 10 | 10 | 0 | 0 |
| S1, all | 140 | 109 | 12 | 19 |
| S2 `src/sim` | 10 | | 9 | 1 |
| S2 `src/run` | 20 | | 18 | 2 |
| S3, ten folders | 30 | | 25 | 5 |

By kind of edit, over all 200: a condition negated was noticed 68 times
of 69, a call removed 49 of 51, a sign traded 18 of 21, a number raised
32 of 43, a boundary moved 6 of 16.

**The 27 sites nothing noticed, each read** (five lines either side;
four looked at further). The site and its edit are in `batch.ts report`.

- *No effect by construction, 5.* A random draw compared at its exact
  boundary (`CampWanderBehavior.ts:83`, `effects/interpreter.ts:217`,
  `NodeMap.ts:391`); a value set to what it already was
  (`render/glyphs.ts:162`); a multiplier the heal ignores, as its comment
  says (`effects/propose.ts:155`).
- *An input no run reaches, 9.* A fallback, a default, a bound or a guard
  whose case never comes up: an empty middle band
  (`proceduralMap.ts:746`), a share sum equal to its ceiling and the arm
  for no candidate fitting (`NodeMap.ts:784`, `:785`), the arrangement
  search running out of its 24 attempts (`NodeMap.ts:146`), every weight
  zero (`sequencer.ts:277`), rubble with no size (`layouts.ts:417`), a
  camp of nine (`camps.ts:49`), a range whose ends are equal
  (`terrain.ts:50`), a volume above one (`AudioPlayer.ts:277`).
- *A change no proof looks at, 7.* A tile effect listed twice in one
  layout is no longer refused (`layouts.ts:320`); the map's text
  description labels the wrong nodes elite (`NodeMap.ts:937`); the median
  of a roster's levels is taken unsorted (`wave.ts:259`); the count of
  carved cells starts at one (`proceduralMap.ts:656`); a sound starts a
  second in (`AudioPlayer.ts:267`); the diagnostics text is indented by
  two (`report.ts:125`); a sprite's size update is dropped
  (`SpriteRenderer.ts:267`).
- *Not settled by the read, 6.* `movement.ts:300` (a leap along a path of
  exactly two cells), `blockedAlly.ts:127` (every distance doubled, which
  changes nothing if distances are only compared with each other),
  `Pathfinding.ts:163`, `NodeMap.ts:199`, `Run.ts:2229` (the boss's hop
  passed two higher), `NodeMap.ts:847` (a spacing rule looking three hops
  where it looked two).

**What the sample says to the census.**

- **Where the corpus reaches sim and core, it notices.** 62 of 70 edits,
  and of the seven sim sites it and the suite both missed, the read found
  no plain hole: three of no effect, one unreached input, three unsettled.
- **Map generation is where the proofs are thinnest.** Six of the eight
  run sites nothing noticed are in `NodeMap.ts`. Thirty stored maps and a
  distribution test at n=500 do not pin a boundary, a bound or an arm that
  seldom fires. A deletion there names the corpus and plants its own
  control.
- **A config loader is mostly validation, which valid config never
  trips.** The corpus noticed 8 of 20 there and the suite 8 more. For a
  deletion in `src/config` the suite is the proof that matters, and four
  guards' numbers are pinned by nothing.
- **The suite notices nine in ten where it runs the line** (27 of 30 in
  S2, 25 of 30 in S3). That is of lines it runs: it runs 41 % of
  `src/render` and 10 % of `src/ui`, and 119g's chosen plants in those
  folders mostly sat on lines it does not.
- **The rate depends on the kind of edit.** A negated condition, a
  removed call or a traded sign went unnoticed 6 times in 141; a moved
  boundary or a raised number 21 times in 59, and most of those change
  nothing a run can see. So "14 % of edits on lines the corpus runs go
  unnoticed" overstates the holes; by the read, the sites where behaviour
  changed and nothing looked are 7 of 200, with 6 more unsettled.

**Leads for the lists** (each unread past the lines quoted):

- The `median` kind of an encounter's level budget is used by no
  encounter (`config/encounters.json` holds no `"median"`), and its sort
  is pinned by nothing. For 120c.
- `NodeMap.ts:199`'s second condition and `Run.ts:2229`'s hop may be a
  test that is always redundant and an argument its callee ignores; the
  heal's `damageMultiplier` is one by its own comment. For 120d and 120f.
- Who reads the map generator's `carved` count. For 120d.
- 29 source files with CRLF in this machine's checkout. A re-checkout
  fixes it and changes no commit.
- Which test files failed on which plants is in `results.json`: of 260
  files, 177 failed on at least one of the 91 plants run against the
  suite, led by `Run.test.ts` (8) and `mapMetrics.test.ts` (5). For 120e,
  as thin evidence: 91 plants cannot show a file is unneeded.

**Calls made here, for 120c's stop.**

1. *The draw is uniform by line inside a folder,* where 119g's check
   drew one site a file first.
2. *S3 is three sites in each of ten folders,* so its 25 of 30 is a
   reading across those folders and not of any one.
3. *The command runs every proof on the clean worktree first,* which
   costs a suite run (55 s) on each use and is what set the licences test
   aside.
4. *The last pass leaves out four sites* whose edit has no effect by the
   read (three exact boundaries of a random draw, the heal's multiplier),
   since nothing can notice those; it runs the other 18 sim and run sites.
5. *The six unsettled sites were not read further,* to keep the session
   under the line. The fuzz diff and the smoke speak to them below.
6. *The read used four classes where the cut named three* (dead code, a
   hole, an edit that changes nothing). None of the 27 is dead code by
   the read, and "an input no run reaches" is neither a proof failing to
   look nor an edit of no effect: the line runs, and its case does not.

**The last pass** (two worktrees, 16:32 to 17:12). The 18 sim and run
sites that the corpus and the suite both missed, less the four of no
effect, against the fuzz diff's two shapes and the smoke's 65 files:
neither noticed any of them, in 36 verdicts. On both clean worktrees the
fuzz diff gave the same CSVs twice and no smoke file failed. Its failing
control, through the same runner (`batch.ts known-last`): with every hit
dealing one more, the fuzz diff differs on both shapes and the smoke
fails.

- **A site the corpus and the suite miss, the whole pre-commit hook
  misses.** On this sample the fuzz diff and the smoke added nothing to
  those two. The sample does not say what they would notice of the 109
  edits the corpus caught, which were not run against them.
- **The smoke notices a sim change through the corpus it holds.** Under
  the control one file of 65 failed, `tests/fuzz/corpus/corpus.test.ts`.
  The other 64 passed with every hit in the game dealing one more, which
  is 119g's finding again, that those tests hold a tree against itself,
  seen from the other side.
- The six unsettled sites stay unsettled: two more proofs passing over
  them does not tell an edit of no effect from a hole.

Readings: **224,460** at 14:27 on the signed cut's commit, `18e001c`;
**302,552** at 14:48 on the plant tool's commit, `ee382a9` (the hook: 3758
of 3758 in 260 files); **355,936** at 15:06 with the finder built and the
suite phase running; **378,897** at 16:31 on the finder's commit,
`4dbfd60` (3764 of 3764 in 261 files); **423,708** at 17:20 with the last
pass and its control read. From the signed cut, 120a and 120b together
cost about 200k.

**Read and signed** (the user, 2026-10-12, on the hand-off's report, which
held the rate table, the four classes with their counts and five of the
six calls above): "Signing all of those calls, Claude! 😁" The second
call, S3's three sites a folder, was not in that report; the session said
so in its reply. The session takes the signature as 120a's `batch` read,
made early; each site is in this entry should the user want them at
120c's stop. Both points went back to the user and were signed in their
next reply: "Signing those last two points also, Claude! 😁" So all six
calls are signed and the read is made.

**Memory, measured after the user's report.** The user came back about
forty minutes before the hand-off to RAM at 97 %, with Firefox holding
more than usual, and asked whether a dial of the batch's was part of it.
Measured afterwards on the quiet machine (31.7 GB, 32 threads; node's
working set sampled twice a second): one `npm test` peaks at 7.4 GB
across 34 node processes, one smoke at 8.2 GB across 38, one corpus check
at 0.5 GB. The last pass ran on two worktrees, so from 16:32 to 17:12 two
smokes ran at once, about 16 GB at their peaks. By the times that is the
likeliest window for what the user saw; their return was not timed.
Earlier, the hook's suite and one whole-suite
run of the session's own each sat on top of a batch suite run for about a
minute. The dial is how many test runs go at once; `batch.ts`'s default
is one, and the session passed `--trees=2` for the last pass to halve its
wall-clock without measuring what a run holds. `plantProofs.ts`'s header
now carries the three figures. It is the second time a batch's cost to
the user's machine was learned after the launch (119g: the dev server's
reloads). Today's other launches: the corpus on four worktrees (0.5 GB
each) and the suite pass on one. Nothing of the session's was left
running (the process list, read: the user's dev server alone).
Seen in the same reading and not the batch's: `dwm.exe` holds 49.7 GB of
private memory against a working set of 0.8 GB, and the machine's commit
charge stands at 91 of 106 GB.

### 120b — who reads this (2026-10-12, session 79f18990)

Built while 120a's batch ran, and committed after it, since the hook's
suite times out beside the batch's.

**Step zero.** TypeScript's language service follows a config key from
the zod schema that declares it to the reads of the parsed value
(`scratch/120b/probe.ts`). Asked at `startingBits` in
`src/config/economy.ts` it returns `src/run/Run.ts` and
`src/run/Run.test.ts`, and not `src/run/RunConfig.ts`, where `git grep -w`
counts six lines for a field of the same name. The same held for a flat
key of `config/health.json` and a nested one of `config/prices.json`. The
repo opens as one program in 1.6 s (738 files named, 1,596 with the
libraries).

**Built.** `tests/oracle/refs.ts`: `openProject` (what `tsconfig.json`
includes and the `.ts` files under `scripts/`, which it leaves out),
`exportsOf` a file, the `schemaKeys` of its zod schemas by path
(`PricesSchema.units.rarityMultiplier.common`, with `[]` for an array's
element and `{}` for a record's value), the `membersOf` an interface. A
reference is sorted by the file that makes it (own, game, dev,
instrument, tool, script, test) and told apart as read, write or pass;
`standing` says unread, own-only, test-only or used; `computedReads`
lists each `x[key]` over a type with declared properties. `npm run oracle
-- refs <file>[:<name>] [--keys|--members=<Type>] [--list]` and `refs
--all=<out.json> [folder…]`. `refs.test.ts`, TESTING.md "Tools",
ARCHITECTURE's tree.

**Checked.** The cut's exit, item by item, in `refs.test.ts` on a program
of five files that are not on disk: an export nothing imports stands
unread (its one reference is a re-export, a pass); one only a test
imports stands test-only; a schema key nothing reads stands unread; a
field tests set and nothing reads stands unread with its one write. On
the repo, `EconomySchema.startingBits` has one game reference, a read in
`src/run/Run.ts`, and none in `RunConfig.ts`. Each of 15 rules taken out
of the finder fails that file (`scratch/120b/rulePlants.mjs`; the clean
file passes).

**A fault the planting found.** The tests passed on their first run, so
each rule was planted, and the case added for `const { key } = config`
failed on the finder as built: the language service marks an unpacked
name as a write, since it declares a local, and a key read only that way
stood unread. An unpacking is now a read. On the repo the fix moved seven
schema keys to used.

**The first scan** (`refs --all`, the source as of `ee382a9`, 61 to 74 s;
`output/refs/src.json`, not tracked):

| | names | unread | own-only | test-only | used |
|---|---|---|---|---|---|
| exports, 275 files | 1,523 | 23 | 261 | 225 | 1,014 |
| schema keys, 32 files | 614 | 165 | 95 | 23 | 331 |

and 156 reads by a computed key in 55 files. The export count agrees with
the kickoff's pattern count (1,521) to two.

**What the scan says, and what it does not.**

- **165 unread schema keys are not 165 dead keys.** 115 of them are in
  `src/config/events.ts` (62 of its 64) and `encounters.ts` (53 of 53),
  whose schemas are typed by hand-written interfaces (`z.ZodType<EventDef>`,
  read at `events.ts:79` and after, `encounters.ts:84` and after), so
  every read there is of an interface's member. The finder's header says
  so and points at `membersOf`. `rewards.ts` (15), `keybindings.ts` (11)
  and `camps.ts` (9) hold most of the rest and were not looked into; a
  read by a computed key is the likely cause for a table of bindings.
  120c's step zero sorts each file into "keys followed" or "ask the
  interface" before any key is listed.
- **23 exports have no reference at all.** Eight are values:
  `healAmountFor`, `magicBoltDamage` and `catapultShotDamage` in
  `src/sim/stats.ts`, `firstOpOf` (`src/config/abilities.ts`),
  `proseFamily` (`src/i18n/families.ts`), `WORLD_COMMAND_KINDS`
  (`src/sim/Command.ts`), `closeTooltip` and `openTooltipTrigger`
  (`src/ui/tooltip.ts`). Fifteen are types. Leads for 120d, each unread.
- **261 exports are read only in their own file,** where the `export` is
  the removable part, and **225 only by tests,** which is either a seam a
  test needs or code its test keeps alive. Telling those apart is 120d's
  and 120e's reading.
- **A health dial reads as live that may not move:**
  `HealthSchema.fatiguePerStack` has one game read and its value in
  `config/health.json` is 0. Whether any run sets it is 120c's question,
  and the finder's `writes` column is where that starts.

**Calls made here.**

1. *A reader's kind comes from its path,* not from the import graph:
   "game" is `src` outside `src/dev` and `src/bot`, whether or not the
   entry reaches the file. Which files no entry loads is 120d's question.
2. *A write is not a read.* A `RunConfig` field that tests set and
   nothing reads stands unread.
3. *The pin on the real config stays in the suite* at about 2.3 s, so
   that a zod upgrade which stops the key-following fails `npm test`.
4. *Not followed:* a default export (`src` has none, by `git grep
   "^export default"`), and `export *` (eight lines in `src`), which the
   language service follows and no test here plants.

**Not verified.** An assignment that unpacks, `({ key } = config)`, is
taken for a write. Spread and whole-object reads are invisible, and their
number was not counted. The 156 computed reads were counted and not read.

### 120c — the dials (2026-10-12, session 3b697370)

Pre-flight at `6e167c8`: the tree clean, the type check clean, the suite
3764 of 3764 in 261 files. The result is
[round-8.5-census.md](round-8.5-census.md), section 1. Nothing under
`src` or `config` changed.

**Step zero.** The hand-off's premise was two kinds of loader, "schema
keys followed" and "ask the interface". The stored scan, by file
(`scratch/120c/scanByFile.mjs`), shows three. Twelve loaders hand out the
parsed value typed by `z.infer`, and every key there has a reader. Four
cast their schema to a hand-written interface (`camps`, `encounters`,
`events`, `rewards`), with `terrain` doing so for one sub-schema. And
eight parse into a local named `parsed` and hand the value out reshaped
(`sim`, `packets`, `daemons`, `empower`, `characters`, `rewards`,
`objective`, `spawn`; `escalation` does the same inside a function), so
their keys read as "own-only" though the game uses them. A probe
(`scratch/120c/probe.ts`) then showed one thing covers all three: from the
TYPE of a parsed config, each property leads back to where it is declared,
the schema's key for `health.ts` and `sim.ts` and the interface's member
for `events.ts`. So the sort did not have to be made by hand.

**Built**, in `scratch/120c/` (not tracked; this machine only):

- `dials.ts`, the walk. For each `<Schema>.parse(<json>)` in a loader it
  walks the JSON beside the parsed value's type. At every object it
  matches the data's keys to the type's properties, narrowing a union by
  its literal-typed properties and by keys an arm lacks, and counts for
  each declaration how many entries could hold the key, how many do, and
  each distinct value. It then lists every declaration the type can hold
  that no entry reached (the keys of an unused union arm), the enum
  values no entry holds, and any JSON key the type does not declare.
  Readers come from `tests/oracle/refs.ts`. A key read only in its own
  file is followed one hop, to the property or the variable its read
  initialises. Output: `dials.json`, 28 s.
- `report.mjs` (the lists by section), `classify.mjs` (every row in
  exactly one class, by rules written in its header; a row with no class
  throws; `--draw=<class>:<n>` is a seeded draw, `--tsv` the whole table),
  `sites.ts` (the lines that read a key, with their text), `members.ts`
  (an interface's members with reads and writes by kind of code),
  `flags.mjs` (each fuzz flag and the kinds of file that write its name),
  `content.mjs` and `contentBy.mjs` (each catalog entry and which files
  name it), `rulePlants.mjs`.
- In the kept tool, `tests/oracle/refs.ts` gained two exports, `named` and
  `schemaKeyNodes`, so that a caller holding a declaration's node can ask
  for its references; `schemaKeys` is now a map over the second. Its six
  tests pass and its 15 planted rules are still each caught
  (`scratch/120b/rulePlants.mjs`).

**Checked.** The walk carries a self-check on a planted loader and
planted data that are not on disk: 15 known answers (a key read through
an export, an optional key no entry sets, a defaulted one, a union arm in
use beside its twin by keys that no entry uses, an arm ruled out only by
a key it lacks, a key behind an interface, a record's entries, a key
reshaped into a property that is read and one that is not, a key copied
into a property of its own name, a stray JSON key, an enum value no entry
holds, and which schema keys the type does not hold). Each of 12 rules
taken out of the walk fails it (`rulePlants.mjs`). `flags.mjs` and
`content.mjs` each check two known answers before they print.

**What the checks caught in the instrument.**

- *Two rules no planted case held.* The first self-check passed with
  either union rule removed, because each covered for the other on the
  planted data. Two cases were added that need one rule each.
- *Keys told apart by line.* Two keys on one line shared an id, and an
  unvisited arm's key was counted as visited. Ids are now by offset. The
  self-check's own expectation was wrong there until then.
- *A hop that missed the commonest shape.* `name: raw.name` was not
  followed, because the hop took the first identifier on the line with
  the key's name, which is the property being built. This was found by
  reading sites for the census (`CharacterSchema.name` had no hop), not
  by the self-check, whose reshaped keys all had new names. A case was
  added, and the residue of own-only keys fell from 57 to 35.
- *A clause nothing held.* After that fix, one plant passed: the clause
  it removed had become redundant, and it was taken out.
- *A backslash lost in a heredoc,* in the plant script, seen as its
  refusal on the first run. In the friction log.

**The limits the census leans on being stated.**

- **The hop stops at a union.** `normalizeRule` in `src/config/daemons.ts`
  returns `{ kind: 'modifier', stat: raw.stat, … }` typed as a union of
  two rule types, and the language service does not tie that literal's
  `stat` to `ModifierRule.stat`, which `src/run/runStats.ts:113` reads.
  So 44 keys end at "their loader reads them". Those reads were looked at
  for six loaders by their lines (`sites.ts`) and are the loaders'
  normalising steps; they were not each followed to a game line.
- **A value handed on whole is not followed.** A layout's wall coords go
  into the terrain's own coord type as arrays, and `coord.hp` is read at
  `src/sim/battleSetup.ts:350` under that other declaration. Found by a
  word search after the type search said only tools read `hp`.
- **"Own" means two things.** In a loader an own read is the loader's. In
  `src/run/encounters/wave.ts` and `sequencer.ts`, which declare the
  encounter types and resolve them, it is the game's. The classes
  "loader" and "module" keep them apart.
- **Zero unmatched JSON keys, zero ambiguous objects, zero that fit no
  arm,** across 32 files. The planted stray key is found, so the zero is
  a reading and not a blind walk.

**The numbers** are in the census, 1.1 and 1.2: 616 declarations (464
schema keys, 152 interface members), in classes of 464, 43, 45, 44, 7 and
13; 36 keys in arms no entry uses, 28 optional keys never set, 23 enums
with an unused value; 25 `RunConfig` fields; 17 URL parameters; 65 fuzz
flags, 13 of them written by nothing but the instruments; 145 content
entries, none unnamed. 150 schema keys are not held by any parsed type,
all in the interface-typed loaders; for four of those loaders the 148
keys pair with an interface member by name, with none left over on
either side.

**What the walk found, for the lists.**

- **Three dials are dead by their loaders' own accounts** and the search
  agrees: `deck.redraw`, `config/empower.json` and the two tile rates.
  Each header says the mechanism moved to the daemons or the statuses
  and the config "stays as" a type anchor or a fixture source.
- **`move.cells` is authored and unread.** The gambit's 1 and the dash's
  2 decide nothing; the distances are in the code. Either fate is the
  user's: a deletion changes no run, and wiring it is a behaviour change.
- **Vocabulary that was declared and never built:** `knockback`, `pull`
  and `re-home`, each marked reserved in its own comment, and the two
  flight keys on a unit, which META-ROADMAP's `traversal` profile
  supersedes.
- **Four switches with a position nothing selects,** each with code for
  it: the selection strategy, the focus-tile resolution, and the chip
  rule's two modes, where gotcha #129 says the survivors' numbers stay
  needed either way.
- **Fatigue is off at its shipped rate,** with a paired read on record
  that put it there.
- **Half cover changes no damage.** Its multiplier ships at 1, under a
  comment that says it halves, and each proposed strike still walks a
  line of sight over the half covers to find out whether to apply it.
- **Most of what content does not use is the authoring language,** and
  Round 10 is content: ten of twelve event conditions, three of eleven
  event effects, three level-budget and level kinds, and the unused
  values of 23 enums.
- **A count that read as a finding and was not:** 24 keys "nothing
  reads" were 23 keys of tables read by a computed key and one of a dead
  block. The class "table" is a list by name, each family checked
  against the line that reads it.

**Calls made here, for the stop** (the census's 1.9 has the five the
user is asked for).

1. *Six classes, with "dead" and "table" as lists by name.* A row lands
   in "dead" only after its site was read, and a name the walk does not
   hold throws.
2. *A tool's read does not make a key used.* Seven keys are read by
   editors alone and are rows of their own.
3. *A mention in BALANCE.md does not make a flag live,* since the file
   is a log. The 52 "live" flags include 49 it writes, and the census
   says so.
4. *The mode switches go in list A with a fate of "ask" or "trial",* not
   in list B, where a search plus one read can size them. The chip rule
   is the exception: it is entangled by gotcha #129 and was not read
   whole.
5. *Leans were given on every "ask".*

**Not verified.** No candidate's code was deleted or planted, so no proof
named in the census has been run against its row. `chipRule.ts`,
`fatigue.ts`'s callers, `focusTile.ts`'s resolvers and the selection
strategy were sized by their lines and not read. Whether the game reaches a camp's or
an encounter's description through the locale layer was not settled. The
ten fuzz flags nothing live writes were not read. The other command
lines' flags were counted by file and not listed. A spread or a
whole-object use of a config value is still invisible, and its count is
still not taken.

Readings: **86,759** at 18:16 after HANDOFF; **292,132** at 18:38 with
the walk built and first run; **340,153** at 18:50 with the lists read;
**412,746** at 19:04 with the census written. The step cost about 330k
to this point, more than the hand-off's guess allowed for; most of it is
the walk's lists printed into the session and the sites read.

**The read, begun** (the user, 2026-10-12, on the stop's report): "Before
I say anything else, A13 can definitely go. Half cover was a mechanic
from the MVP era, IIRC, and it wasn't particularly fun 😅 I think we're
going to have to go through most of these in more detail, though, about
what the candidates actually do. Signing calls 1-4 otherwise." So: the
row format, the other command lines' flags left unlisted, the table of
616 left untracked, and the authoring vocabulary kept as a class (which
is A-16's fate) are signed, and A-13 is signed for deletion. The other 18
fates are open and 120c stays ◐.

- *What A-13's signature covers, as the session takes it:* the damage
  rule, which is the key, the multiply and the per-strike walk. 148
  half-cover pieces stand on five of the eleven boards
  (`config/layouts.json`, counted), where they occupy cells and ranged
  attacks see through them (`src/sim/environment.ts:96-99`). Taking the
  pieces off changes boards a player sees, so it is outside the row and
  was put back to the user as its own question.
- *What the user asked for:* what each candidate does. The census's rows
  were written from the code's side (who reads a key), which says little
  to someone deciding whether a mechanic should exist. Each row now opens
  with an "In play" line: what it does in the game today and what a
  player would notice if it went. The format gained that field after its
  signature, at the user's ask.
- *Read for those lines:* the health loader's header (the chip rule's
  modes, the seam floor, fatigue), `focusTile.ts`'s three resolvers, the
  two selection strategies, the self-move proposal, the parser's notes on
  the ten flags, and which daemons grant what.
- *What the reading changed.* A-05: the dash's reach is the ability's own
  `rangeCells` (`propose.ts:185`), so `move.cells` is a second copy of
  a number that is already authored and used, and the lean is a plain
  delete. A-09: no encounter sets `layouts` (0 of 19), so the two
  selection strategies make the same two picks in the other order.
  A-20: five of the ten flags tune a flag that is live (`--refine`,
  `--k-telemetry`, `--shadow-horizon`) and are proposed kept with it;
  the other five are each one investigation's instrument.
- Still not read: `chipRule.ts` whole, the code behind the five
  investigation flags, what positioning does with cover.

Readings: **434,480** at 19:09 on 120c's commit, `f55932e` (the hook:
3764 of 3764 in 261 files); **470,916** at 19:41 with the rows re-read
and the "In play" lines written.

**The read, the first tranche** (the user, 2026-10-12). On A-13: "I only
meant the multiplier, Claude. 👍 Static units that do not block line of
sight are a pretty important part of the game. Having attacks that go
through them only deal fractional damage made the fights slow and kinda
boring". So the pieces stay and the row is as the session took it.

- **Signed for deletion: A-01 and A-02** ("Those definitely can go, then;
  they should be purely owned by the daemon / packet vocabulary now").
- **A-03, signed on an answer.** The user: "looks safe to purge, but a
  future idea I had was to have water extinguish burn effects. Would
  that interact with this?" It does not, and the rule exists already: a
  unit entering shallow or deep water loses `burn`
  (`src/sim/TileGrid.ts:119`, `:139`; `src/sim/World.ts:1643`), with
  no switch on it. The session recorded the row as signed and said so,
  since the approval was given before the answer.
- **A-05, not signed.** The user asked whether a teleport would be harder
  without `move.cells`. It would not: a teleport is another way of
  choosing the landing the move already goes to, at the ability's own
  range. But the user also said knockback and pull are planned, and a
  push's distance is exactly what `cells` would carry. The session had
  leaned "delete" on A-05 without that, and now puts the two rows
  together.
- **A-04, back with the user.** "Flying units are definitely planned."
  They are, in Round 9, and META-ROADMAP's Traversal entry (line 843)
  names `layer` and `ignoresTerrain` as two of "three inert fields" of
  the old seam, which a `traversal` field replaces because air "is not
  a second occupancy plane". The census had cited line 102 for this; the
  entry at 843 is the one that names the keys. The third field, a plane
  union with one member, is a lead for 120f.
- **A-07, back with the user.** "Attacks with a knock back or pull effect
  are also planned, but I admittedly may never have mentioned that." No
  plan document holds it (the "pull" in DESIGN and META-ROADMAP is the
  camp pull). The session's lean stays "delete, and write the plan
  down", with the cost of each side given in the row.
- **A-08, explained.** The user did not remember what `re-home` was
  for. `src/sim/Action.ts:40-55` says: the fourth answer to "the target
  died while the shot was in the air", never used because "it reads as
  unfair".
- **Unrecorded plans the user named:** a teleport ability, and attacks
  that knock back or pull. Proposed to the user as a line for
  META-ROADMAP; not written there without their word.

Reading: **473,247** at 19:43 on the read's first commit, `b6e3f3d`.

**A check the rows had not had, made here.** Looking for knockback in
META-ROADMAP's Round 9, the session met "Fatigue — the design round"
(line 776), which inherits the fatigue seam at rate 0. The census's A-12
had leaned "delete" and named Rounds 10 and 12, without that file having
been searched for the word. The charter asks that a candidate be checked
against GOTCHAS, and the decision point says a dial's fate must weigh
what later rounds lean on; the rows had the first check and only three
of them (flight, event art, knockback) the second. So every row's terms
were searched in META-ROADMAP from Round 8.5 on, 22 groups of words. Two
things came back. A-12 is now "keep": Round 9 names it. A-11 gains a
fact: Round 9's Retreat is "coherent ONLY under the casualty chip rule",
so a planned mechanic assumes the shipped position of that switch. The
other twenty groups found nothing that names a candidate (the selection
strategy, the focus-tile modes, power's growth, the three probe dials,
the ten flags, the level-budget kinds and the event conditions are not
in it; `redraw` and `empower` there are the daemons' vocabulary). A
word search of one file does not show that no plan exists, as the user's
knockback shows.

**The read, the second tranche** (the user, 2026-10-12): "03, 05, and 08
are cleared for deletion, then! 😁 07, also cleared, but yes, let's get
those into the plan. 04... Alright, I'm a little bit confused 😅 I had it
in my head that the layer model for flight was still in contention. Can
you find out when and why the call otherwise was made? ignoresTerrain
seems properly obsolete, though 👍"

- **Signed for deletion: A-03, A-05, A-07, A-08,** and of A-04
  `ignoresTerrain`. Eight rows are signed and twelve are open (the
  census's 1.9).
- **The plan, written.** META-ROADMAP Round 9 gains "Forced movement and
  a teleport" under combat and effects, dated, marked user-signed and
  "not audited or sized", with a row in the coverage map. The user had
  not said which round. The session put it in Round 9 because a push
  through the occupancy core is an engine seam and that round's exit
  ships each seam with a consumer, and wrote that the kickoff decides
  whether each ships there or waits for Round 10. Listed for the user as
  a placement they can move.
- **A-04's history.** Two calls, each signed by the user. On 2026-06-28
  the Cluster 2 kickoff locked flight's design and deferred its build
  (`archive/post-34-roadmap.md:1331-1364`; the section first appears in
  commit `6759956`): always fly, no sharing a cell with a ground unit,
  pass over all obstacles, mobility only. The reasons given there: with
  no direct control there is no actor to decide when a unit lands;
  flight must not break one unit to a cell; and a four-way ground and
  air attack matrix is "a trap in a no-direct-control autobattler". That
  lock kept `layer` as the field a future `targetsLayer` reads, and
  kept a `plane` argument on occupancy "so air-with-overlap is a future
  fill, not a retrofit". On 2026-08-21 the planning session behind
  META-ROADMAP v2 restated it: flight and the marine share a
  `traversal` profile, co-location for flyers and the anti-air matrix
  are "out until a consumer names them", and the lock is re-audited at
  Round 9's step zero.
- **What that corrects.** The user's memory, that the layer model was
  still in contention, matches the first lock: overlap was turned down
  for the build and left open as a later fill, and `layer` was kept on
  purpose. The census had said the road map's `traversal` field
  "replaces" both keys. That holds for `ignoresTerrain`. For `layer`
  the entry lists it as inert and does not say what `targetsLayer` will
  read, so the session's "delete" went past its source, and the lean is
  now "keep, for Round 9's step zero". This is the second lean of the
  read that a plan document overturned (A-12 was the first), and both
  times the document was one the row had cited or could have.
- The road map calls the 2026-06-28 call "the Phase-M flight lock"; why
  it carries that name was not found.

Readings: **503,443** at 20:19 on the first tranche's commit, `1629a35`.

**The hand-off, in the read** (the user, 2026-10-12): "Signing the layer
keep, and that placement works! 😁 … I'll see you in the fresh session!"
So A-04 is whole: `ignoresTerrain` goes and `layer` stays for Round
9's step zero. The Round 9 placement of "Forced movement and a teleport"
is signed. Nine rows are signed and eleven are open: A-06, A-09 to A-12,
A-14, A-15, A-17 to A-20. The next session takes them in tranches as the
user reads, and before a lean searches the plans as well as GOTCHAS.

The read cost about 105k for nine rows, most of it in the two
corrections' source reading and five hook runs. The rows still open
include the four the session read least (the chip rule, the two
switches, the investigation flags).

Readings: **527,699** at 21:00 on the second tranche's commit,
`304d615`; **539,285** at 21:02 on `c9f5b08`. The session ends under
the 550k line.

**The read goes on: the open rows held against the plans first**
(2026-10-13, session 8b3c5ad6). At `52ba3bc`, the tree clean. Before a
tranche went to the user, each of the eleven open rows had its words
searched in every `.md` of the repo, so the archived road maps, specs and
worklogs as well as META-ROADMAP, GOTCHAS, TODO and DESIGN, and the
passages that came back were read. The code the last session sized and
did not read was read: `selection.ts`, `focusTile.ts`, `chipRule.ts`
whole and `leveling.ts`. Nothing under `src` or `config` changed.

- **A-14, overturned by the code.** The row leaned "delete" and named
  one reader, `leveling.ts:104`, the enemy side's closed form. The
  player side reads the rate by a computed key on line 67, inside a loop
  that draws once for each of eleven stats, power last. Without the key
  a level draws ten, and every recruit's rolls after the first level
  land on other numbers. So the deletion is a behaviour change, and the
  lean is now "keep". This was read and not run. The intent the row
  asked about was already signed: the casualty spec fixes power per
  archetype with a growth of 0. It is the read's third overturned lean,
  and the first by code: the reference finder sees a read by name and
  not one by `growth[key]`, and the census's "table" class lists the
  base stats for that line and not the growth rates beside them.
- **A-11 gains a signed call.** The casualty spec: "Both rules stay
  alive behind `health.chipMode`", as the experiment's paired
  instrument. The experiment closed on KEEP, and DESIGN still describes
  both rules as live and the rule as an experiment. `chipRule.ts` read
  whole: one rule in place of the two switches takes out about 20 of its
  251 lines, and the survivors arithmetic stays for the capped turn. The
  fate stays "trial".
- **A-10 gains a plan.** The Round 8 charter listed the focus-tile
  switch as groundwork for difficulty levels and the Round 8 spec struck
  it (D8), leaving rule levers such as "a tool taken away" to Round 10.
  `disallow` is the position that would have served it. The lean stays
  "delete": a level that takes tile focus away is a per-run rule, and
  this key is one value for the page.
- **A-09 gains its history.** The order was built switchable at the
  user's call, to compare by a config flip. No document records the
  comparison, and with no encounter restricting its boards the two
  orders draw at the same odds.
- **A-17's open question is settled.** The locale layer carries only
  fields a schema marks as prose, and its registry says the five are
  editor metadata that is never rendered.
- **A gap in the walk, and a row for it.** The walk lists an enum with a
  value no entry holds, and a true-or-false key is not an enum. Listing
  every boolean in the single-object loaders found four switches of the
  shape of A-09 to A-11: the grant queue's `passIsFinal` (which sat
  inside A-18's "keep" as a test seam), `sim.blockCampTurnEnd`,
  `tiles.applyStatusOnEnter`, and the playback pane's enable flags. They
  are row A-21, each with a lean, and twelve rows are open.

Not verified: no plant was run for A-14. The tests' and the fuzz side's
share of the chip switch, the tests behind A-21's four and the playback
pane's code were not sized or read. The five investigation flags of A-20
are still unread. A word search of the documents does not show that no
plan exists.

Readings: **87,623** at 12:24 after HANDOFF; **217,317** at 12:32 with
the rows checked and the census updated; **220,235** at 12:34 on that
commit, `31b2baf` (the hook: 3764 of 3764 in 261 files).

**The read, the third tranche** (the user, 2026-10-13): "Signing all of
those keeps, Claude, with two to-dos for some future cleanup round: 1.
A14 definitely should be dropped at some point. 2. A19 should eventually
be reviewed; I feel like the many URL parameters need to be simplified
at some point."

- **Signed kept: A-06, A-12, A-14, A-15, A-17, A-18 and A-19.** A-18's
  signature covers five of its six fields; `passIsFinal` is open in
  A-21. The two to-dos are in TODO "§120 riders".
- **Signed for deletion: A-09** ("I don't think that comparison was ever
  run, but I'm comfortable dropping it. Enemy first is working, and I
  see no reason to change that"), the unused order, the key and the
  one-key file, **and A-10** ("Nah, we can cut both. We've gone in a
  different direction on what escalation involves"), the two modes and
  the key.
- Eighteen rows are signed and three are open: A-11, A-20 and A-21.

**A-20's five investigation flags, looked at before their tranche.**
The row had said the code behind them was not read. Read here: the
parser's note on each, and a count by word search of the lines that name
each option; no instrument was read whole.

- `--arena` is the large one, a command of 169 lines and a runner of
  301, and **it carries a signed stamp the row had not been held
  against**: BALANCE "The instrument registry" (the user, 2026-07-29)
  marks the arena's objective strategies niche, kept for their purpose
  and never a balance input. A search for the flag's name does not find
  it there: the registry names the instrument by `--objective` and the
  word "arena".
- `--bits-multiplier` is refused together with `--arbitrate`, and
  `--set=difficulty.bitsMultiplier` reaches the same lever through the
  config without being refused. Read, not run.
- `--grant-epsilon` and `--camp-raid` are about ten and fifteen lines of
  plumbing with a parse test each; `--flip-telemetry` runs through seven
  files.
- The row now gives a lean on each of the five.

Reading: **236,678** at 13:05 on the third tranche's commit, `6ff21d5`;
**267,674** at 13:10 on `7702bd2`.

**The read, the fourth tranche** (the user, 2026-10-13), on A-11, A-20
and A-21.

- **A-11, signed as a trial:** "survivors is no longer in consideration.
  Casualties is the basis going forward, and any experiments will be
  based off of it." For 120g's list: TODO's "The survivors end sequence,
  unexercised live" is conditioned on a survivors-rule playtest, which
  this rules out; the model still emits that sequence's events on a
  capped turn (`lossEventsAtEnd`), and the HUD's side was not read.
- **A-20, three of the five signed:** `--bits-multiplier` delete ("looks
  like it's been obsoleted"), `--grant-epsilon` delete, `--camp-raid`
  keep.
- **A-20, two questions asked, and answered from the code.** The user
  took the arena for the protocol's isolation testing against specific
  encounters, "most frequently elites". It is not: that is
  `--encounter=<id>` on a run, which BALANCE's protocol names throughout
  and no row touches. The arena rolls a wave at the roster's budget, has
  no `--encounter`, and exists to tune the orders the bot gives its
  team. The user took the flip-rate read for the micro round's; it is
  the rollout-arbitration round's (71c), the micro round's K-flip idea
  applied to run-layer decisions, its verdict signed 2026-08-01. Neither
  flag is named anywhere in the tracked tree outside `tests/fuzz`
  (`git grep`, all but the archive). After the answers the lean on both
  is "delete", sized at the instruments' phase; the coverage bot's test
  uses the arena's runner at three places and is kept.
- **A-21, three of the four signed:** `passIsFinal` keep "until we get
  some feedback"; `blockCampTurnEnd` delete, the shipped behaviour
  staying ("if combat with anything is ongoing, the battle continues");
  `applyStatusOnEnter` delete ("mud tiles are more generally going to
  get reworked in the future. The trial is over"). The session takes the
  last as the switch going with mud poisoning as shipped, since the
  round changes no behaviour, and said so to the user. With A-03 it
  empties `config/tiles.json`: three config files go in all.
- **An unrecorded plan the user named:** a rework of mud tiles. Offered
  to the user as a line for TODO; not written without their word.
- Open: `--arena`, `--flip-telemetry`, the keep of A-20's five tuning
  flags and of A-21's playback flags, none of which the reply named.

Reading: **294,236** at 13:38 on the fourth tranche's commit, `da64433`.

**The read closed, and 120c with it** (the user, 2026-10-13): "Delete
both, sign the two keeps." So `--arena` and `--flip-telemetry` go, the
coverage bot's test kept, and A-20's five tuning flags and A-21's
playback flags stay. On the switches: "delete the switches but keep the
shipped behavior was what I meant". All 21 rows of section 1 are signed:
nine rows for deletion whole, seven items inside three split rows (A-04,
A-20, A-21), A-11 as a trial, and the rest kept. 120c is ☑.

- **The mud rework, written down.** The user: "it's not in the plan
  document yet because I haven't actually mentioned it before! Mud isn't
  fun to play with, but I haven't taken the time to really figure out
  why. We can note in the plan that something is coming, but I still
  don't know what yet." META-ROADMAP Round 9 gains "Mud, a rework of
  unknown shape" under the spatial work, beside the ice costs, with a
  row in the coverage map. The session chose the place, because
  traversal changes which units cross mud at all, and wrote that the
  kickoff says whether it belongs there. Told to the user as a placement
  they can move.
- **What the read cost and found.** Twelve rows in one session, about
  235k from the first reading to the close's commit, five hook runs
  among it. Three leans were overturned
  across the two sessions: A-12 and A-04's `layer` by a plan, A-14 by a
  reader the type search does not see. A-20 carried a signed stamp it
  had not named, and the walk listed no true-or-false key, which is how
  A-21's four switches had no row. For the sections still to write, a
  row is held against the plans, the specs, BALANCE's registry and
  GOTCHAS, and its code is read, before it carries a lean.

Reading: **322,227** at 13:52 on the close's commit, `588eda3` (the
hook: 3764 of 3764 in 261 files).

### 120d — step zero, counted before the step is started (2026-10-13, session 8b3c5ad6)

Counted at 120c's close so that the call on where 120d runs has a
number. Nothing was built and no row was classed.

The stored scan (`output/refs/src.json`, made 2026-10-12; `src` has not
changed since) holds 2,137 names: 614 it calls keys and 1,523 exports.
Of the exports:

| standing | exports | by kind |
|---|---|---|
| used | 1,014 | 465 functions, 195 consts, 145 interfaces, 125 types, 78 classes, 5 export lists, 1 `let` |
| only its own file reads it | 261 | 134 interfaces, 62 types, 49 consts, 16 functions |
| only tests read it | 225 | 100 functions, 92 consts, 19 interfaces, 11 types, 2 export lists, 1 class |
| unread | 23 | 14 types, 7 functions, 1 interface, 1 const |

So the step's first list is about 510 rows in three classes, and for the
261 the candidate may be the word `export` and not the declaration. The
scan lists 156 computed reads apart, which is where a name the table
calls unread can still have a reader (A-14's second reader was of this
kind). The walk for files no entry loads has not been run and the
duplicate finder is not built. `tests/importGraph.ts` takes several
entries (`runtimeGraph`) and follows run-time imports only, so the
tools' pages, the scripts and the tests have to be handed to it as
entries, and a file that holds only types needs another answer. Nothing
in the repo finds a repeated run of tokens. `scratch/120d/shape.mjs` and
`count.mjs` print the table above.

**The call at the stop.** From 322k the room under the line is about
230k. 120a with 120b cost about 200k and 120c about 330k to build, and
120d is two finders and three lists, each row held against the plans and
its code before it carries a lean. The session's lean is that 120d
starts in a fresh session, and the user decides
(`process/planning.md`, "Context: the halt and the hand-off line").

**The hand-off** (the user, 2026-10-13): "A fresh session sounds good to
me, Claude!" So 120d starts in a fresh session, from the Cursor and the
step zero above. Readings: **348,715** at 13:56 on the step zero's
commit, `9dbda3c`; **350,396** at 14:00 at the hand-off. The session
ends under the line.

### 120d — exports, files and exact duplicates (2026-10-13, session 3ecdd7bf)

Pre-flight at `3daf4f2`: the tree clean, the type check clean, the suite
3764 of 3764 in 261 files. The result is
[round-8.5-census.md](round-8.5-census.md), section 2, rows A-22 to A-32.
Nothing under `src` or `config` changed. `tests/oracle/refs.ts` and its
test did, in a commit of their own (`c2bdeb9`).

**Step zero.** The premise was that the stored scan's three counts are
the step's first list. `src` had not moved since the scan
(`git diff --stat ee382a9 HEAD` over `src`, `config`, `tools`, `scripts`,
`shell` and `tests` names four files, all under `tests/oracle`). The
counts held and the list did not: the scan answers one step out, so it
calls an export used when its one reader is read by nothing. The step
was built on a walk that follows the reads to the end, which is inside
the cut's intent.

**Built**, in `scratch/120d/` (not tracked; this machine only). Each
runs a self-check on planted input first and refuses to print if a known
answer is wrong.

- `files.ts`: which entry loads each tracked file. An entry is the
  game's page, a tool's page, a file a `package.json` command names, the
  hook, a test, a build config, or a file a doc tells a person to run.
  Three strengths of edge: an import the build keeps or a string that
  names a tracked file; an import the build erases; a string that names
  a folder. 20 known answers on a planted tree. `--candidates` prints,
  for each file no import or path reaches, every tracked file that holds
  its base name. Output `files.json`.
- `graph.ts`: every top-level declaration of every `.ts` file that is
  not a test (4,658 in 403 files, about a minute), an edge for each read
  of one inside another (the reads are `refs.ts`'s), and each
  declaration live, test-kept or dead by what reaches it from the
  module-level code of files `files.json` says an entry runs. 19 known
  answers, among them an export "used" only by a dead function in
  another file, a pair that keep each other alive, and a file no entry
  loads. It holds its count of `src` exports by direct standing against
  the stored scan's. Output `graph.json`.
- `members.ts`: each member of each class and interface under `src`,
  stood as `refs.ts` stands a name. 12 known answers.
- `dupes.ts`: identical runs of tokens, by the parser's tokens for
  TypeScript and a small scanner for CSS and GLSL, with the imports left
  out; `--mode=norm` reads every name, string and number as one word
  each. Its known answers: a copy laid out otherwise is found by both
  modes, a renamed copy by the second alone, three shared imports and a
  short run by neither.
- `report.mjs` (the lists and the seeded draws) and `words.mjs` (each
  dead or test-kept name searched in the files outside the type check
  and in the docs).

**What the checks caught in the instruments.**

- *The kept finder missed two kinds of read.* The walk's first list
  called nine locals unread, seven of them under `src` (the three
  focus-tile resolvers, the two selection orders, `hasWebgl` and
  `titleSeq`) and two under `tools`. A local nothing reads
  cannot be there, since the type check refuses one (`noUnusedLocals`)
  and passes. The language service marks `{ name }` and `++seq` as
  writes, and `refs.ts` took its word. Fixed in the kept tool: `{ name }`
  is a read of the variable (and still a write of the property, when the
  property is what was asked), and a step or compound assignment whose
  result is used is a read. Two planted cases and two for their limits
  in `refs.test.ts`; each of the finder's 19 rules taken out in turn
  fails that file. On the stored scan one name of 2,137 moved
  (`setTextScale`, test-only to used), no schema key moved, and 120c's
  walk gives its six classes at the same counts (464, 43, 45, 44, 7,
  13). `graph.ts` now prints how many locals stand unread, which is the
  known answer on the repo itself: 0.
- *A class's member counts the interface's signature as a reader.* The
  member scan's first self-check failed on two members that implement an
  interface and that nothing calls: they stood "own-only". Another
  declaration of the same member is now left out. `refs --members` takes
  interfaces and type literals only, so the kept tool is not affected.
- *Probes that are not in the repo were counted.* The type check's
  program holds the `.ts` files under `tests/fuzz/output/` on this
  machine. The walk now takes tracked files only (the tests' dead count
  fell from 126 to 64).
- *A plant that did not remove its rule.* One of the two new rule
  plants read `false && A || B`, which leaves B standing. Seen on a
  re-read before the run, and replaced.
- *A backslash lost in a heredoc,* in the script that patched the test:
  a template literal inside a template lost its escapes. Seen by reading
  back what landed, as AGENTS says to. In the friction log.
- *Census numbers that were guesses.* Re-counted before the commit: the
  tools' stylesheet lines (written as 4,300, counted 6,828, of which the
  twelve `editor.css` files are 5,815), five cells of the members
  table, the entries by kind, and the test-kept exports' lines.

**What the walk says.**

- **What a search proves dead among the exports is small.** 25 exports
  nothing reaches (54 lines), 39 only tests reach (243 lines, and 14 of
  those have a reason to stay), 21 class members nothing reads (81
  lines), two files nothing imports (35 lines). Under 500 lines of the
  63,458 under `src`. The round's size is not in this list.
- **Where the lines are instead:** 22,996 lines of tools, of which the
  editors' stylesheets repeat 3,463; 2,798 repeated lines of set-up in
  the test files under `src`; 834 lines of instruments nothing starts.
- **257 exports are read only by their own file.** With the word gone
  the type check guards each of them, which is the finder's job done on
  every commit.
- **No exact duplicate read was a plain deletion.** Each of three
  whole-function copies has a comment that says why it is a copy, or a
  permanent gate that forbids the import. They are leads for list B.
- **The locale layer has no second language,** so ten of its exports
  and one file are reached by tests alone.
- **Five `dispose()` methods never run,** and nothing leaks by it:
  `Game` builds each renderer once for the life of the page.

**Calls made here, for the read at 120e's stop.**

1. *The walk's classes stand in for the scan's.* The census gives dead,
   test-kept, "the export is unneeded" and "exported for a test".
2. *Members were scanned,* beyond the cut's letter. Class members
   nothing reads are a row; the fifteen only tests call and the
   interface members are leads.
3. *Duplicates got no row in list A,* against the spec's D1, which
   lists exact duplicates under what a search can settle.
4. *The finder's fix was made in the step and committed apart,* since
   the lists rest on it.
5. *Fifteen tools carry a "keep" on what a search can show* (a catalog
   Round 10 writes, a command, a gate); two are asked about.
6. *The editors' stylesheets are raised as a possible trial,* against
   the signed "deletion only" for `tools/`: a call the census puts to
   the user and does not make.
7. *The plan search for this section* covered META-ROADMAP, `plans/`,
   DESIGN, TODO, BALANCE, PATHING and the archived specs and road maps,
   by each candidate's name. It changed one row's note (the mute, which
   two plans name) and no lean.

**Leads the census does not hold.** In the instruments: two exports
nothing reaches (`presetHarnessOptions` in `tests/fuzz/search.ts`,
`TierName` in `sweepCommand.ts`) and seven only tests reach
(`storedIds`, `serializeEmpowerPolicy`, `serializeRedrawPolicy`,
`isDecisionSite` and `epsilonAA.ts`'s three), for the instruments'
phase.

**Not verified.** No candidate was deleted or planted, so no proof named
in section 2 has been run against its row. Of A-22, the ten functions
and constants were read with their comments and the fifteen types were
not. A-25's tests were looked at by their first three lines each. A-28:
only `dispose()`'s callers were read. A-30: the headers. A-31 and A-32:
not opened. The 257, the 188 and the 99 were drawn or counted and not
read. No rule of `files.ts`, `graph.ts`, `members.ts` or `dupes.ts` was
taken out in turn, as `refs.ts`'s were, so each known answer shows its
rule works on the planted case and not that the rule is needed.
`files.ts` follows `tests/importGraph.ts` in counting a plain import
used only as a type as a run-time import, so its "types only" column is
a floor. The duplicate finder's 50 and 80 tokens were chosen and not
tuned. Whether a tooltip can outlive a scene swap (`closeTooltip`) was
not tried in the page. Whether a past row of BALANCE.md needs one of
A-31's vectors was not looked into.

Readings: **87,341** at 14:05 after HANDOFF; **197,924** at 14:11 with
the cut, 120b's and 120c's record, the spec and the oracle map read;
**312,860** at 14:30 with the four instruments built and the finder
fixed; **348,138** at 14:38 with the lists gathered; **386,560** at
14:46 on the fix's commit, `c2bdeb9` (the hook: 3765 of 3765 in 261
files); **415,792** at 14:53 with the census, this entry and the
session's report written. The step cost about 330k, as 120c's build
did.

### 120e — step zero, counted before the step is started (2026-10-13, session 3ecdd7bf)

Counted at 120d's end so that the call on where 120e runs has numbers.
Nothing of 120e was built.

- One run of `npm test` with Vitest's JSON reporter
  (`scratch/120e/suite.json`; `stepzero.mjs` prints this): 261 files and
  3,765 tests, whose own time sums to 154 s. Twelve files hold at most
  two tests and six hold one. The slowest ten files hold 56 % of the
  test time, and in 182 files the tests take under 50 ms together. The
  smoke tier's 65 files were not run.
- One file alone under the coverage tool, with the flags
  `tests/oracle/reach.ts` uses: 6 s for `src/core/RNG.test.ts` and 7 s
  for `src/sim/occupancy.test.ts`, each leaving a reading of 3.9 MB. So
  the main suite file by file is about half an hour in sequence, as the
  kickoff guessed, and 1 GB of readings unless each is cut down to its
  lines as it is made.
- Two known answers for that instrument are already in TESTING.md's
  oracle map: what the suite loses with `src/store/backup.test.ts`
  deleted (20 lines, 4 functions and 23 branch arms of `backup.ts`), and
  with `src/run/enemyBudget.test.ts` deleted (no line, two arms).
- 120d left three things 120e's list by file can carry: the twelve
  exports only their own tests call (A-25), the fifteen class methods
  only tests call, and 2,798 repeated lines of set-up in the test files
  under `src`.

**The call on where 120e runs.** From 416k the room under the line is
about 135k. 120e is a batch of half an hour, a list of 326 files to
class at its bottom, a section of the census, and a stop that reads two
sections with the user; 120c's read alone cost about 340k over two
sessions. The session's lean is that 120e starts in a fresh session
(`process/planning.md`, "Context: the halt and the hand-off line": under
the line a session may hand off when the next step looks larger than
the room), and the user can say otherwise.

**The hand-off** (the user, 2026-10-13, on 120d's report): "Just looking
ahead, that's already a lot to work through 😅 We'll sign these after e,
right? If so, I'm good for the handoff!" Yes: 120d's read is at 120e's
stop, as the cut has it, and nothing of section 2 is signed before then.
So 120e starts in a fresh session, from the Cursor and the step zero
above. The session's suggestion for that stop, from the user's first
sentence: bring the two sections in tranches, as 120c's read went, with
the rows that need a word from the user ahead of the classes that need
only a look. Readings: **421,787** at 14:55 on 120d's commit, `ca0170f`
(the hook: 3765 of 3765 in 261 files); **425,444** at 15:15 at the
hand-off. The session ends under the line.

### 120e — the tests, by file (2026-10-13, session 4052fd6f)

Pre-flight at `fde08ba`: the tree clean, the type check clean, the suite
3765 of 3765 in 261 files (51 s). The result is
[round-8.5-census.md](round-8.5-census.md), section 3, rows A-33 to A-37.
Nothing under `src`, `config` or `tests` changed; the step's instruments
are in `scratch/120e/`.

**Step zero.** The premise, that each file alone under the coverage tool
gives the lines only it runs, held, and the instrument gives back both
of the oracle map's known answers. Two of the counted figures moved. A
file alone takes 3 to 5 s and not 6 to 7, once the include globs are
left out (below). And the suite runs with `isolate: false`, so a file
run alone might have needed a workermate's state: none of the 326 does.

**Built**, in `scratch/120e/` (not tracked; this machine only).

- `perfile.ts`: one Vitest run a test file, with `reach.ts`'s flags, a
  reading cut down to the source files it reached, and a row in a
  `.jsonl` (exit code, tests, seconds). `--tier=main|smoke`, `--jobs=N`;
  it skips a file already read. The readings are `readings/<tier>/`.
- `byfile.ts`: who reaches each line, function and branch arm, and for
  each test file what it runs, what only it runs and where, the other
  file that holds the most of its functions and arms, and the planted
  breaks it failed on (120a's 91, 119g's 30). It refuses to print unless
  `backup.test.ts` alone runs 20 lines, 4 functions and 23 arms, all in
  `backup.ts`, and `enemyBudget.test.ts` no line and two arms. Output
  `byfile-<tier>.json`.
- `unionCheck.mjs`: the union of the per-file readings against the whole
  suite's stored reading. 9,338 lines under `src` in each, and none in
  one alone.
- `bottom.mjs` (each bottom file's numbers, header and tests' names),
  `classes.mjs` (the class given to each of the 64, and the sums),
  `pairs.mjs` (pairs of files by shared functions and arms),
  `summary.mjs` (the tables), `wall.mjs` (a run's length and the files
  that end last), `cmp.mjs` (two readings of one file).

**What the checks caught in the instruments.**

- *The faster form reports more files.* Without the coverage tool's
  include globs a run takes 2.7 s where it took 4.5, because the tool no
  longer reads the 400 files the test never loaded. It then also reports
  the `config/*.json` a run imports (nine more files and 123 more lines
  for `enemyBudget.test.ts`). The reader keeps to `.ts` under `src`,
  `tests`, `tools` and `scripts`, and on three files the two forms then
  give the same lines, functions and arms. The union check is the same
  comparison over all 261.
- *A backslash lost on the way to a file, twice in ten minutes:* in a
  `node -e` string, then in a script written through a quoted heredoc,
  where one of two backslashes went. Each was a syntax error on its
  first run, so nothing was read from a wrong pattern. The single
  backslashes in four other heredoc scripts survived, by their output.
  Both are in the friction log; the second file was rewritten with the
  file tool.

**The batch.** Memory was measured before the launch this time: the
largest file alone (`Run.test.ts`) peaked at 0.7 GB of node working set
across five processes, with no other node process on the machine. The
main suite ran four files at a time in the live tree (613 s) and the
smoke three at a time (539 s, peak 1.9 GB across twelve processes). No
file failed and none was stopped at its limit. Then one plain run of the
smoke with the JSON reporter for the files' own times (185 s; the main
suite's was step zero's).

**What the list says.** The census's 3.2 to 3.4 hold the numbers.

- **By file, four files and a pair.** 64 of the main suite's 261 files
  alone run nothing. Read, 18 are gates over text and assets, 32 hold
  one mechanic's rule, ten are whole battles or runs, and four are for
  the user. That is what the kickoff's fifth call expected: classes with
  examples and not rows ready to delete.
- **Reach is not what a test is for.** 44 of the 64 planted breaks the
  suite caught were caught by one file alone, and one of those files
  alone runs nothing.
- **The suite's time is loading, and the smoke's is one test.** In
  `npm test` the modules take 215 s summed over the workers against the
  tests' 154 s. In the smoke, one test that starts the fuzz command line
  ends 81 s after every other file.
- **Of the fifteen class methods only tests call,** ten are read-backs
  and five are code. One of the five is the run's trigger registry,
  which nothing has ever registered on.

**Calls made here, for the read at this stop.**

1. *The smoke tier's 65 files were read as well.* The cut says "by test
   file" and step zero had left them unrun.
2. *The faster form of the flags,* checked as above.
3. *"Alone" is against a file's own tier,* which is what `reach-diff`
   would name and what the known answers check. Both tiers together are
   one line in 3.2.
4. *The bottom was classed from each file's header and its tests'
   names.* Five files were read whole.
5. *The four per-archetype battles got a paragraph and no row,* with the
   lean to keep them.
6. *The run's trigger registry is a row,* though it is more than the
   method the lead named: the method is the registry's only way in.
7. *A-37 is not a deletion.* A test that sets the hook's length is put
   to the user as a call and left for the instruments' phase.
8. *No list by test was built.* The cut puts the tests one by one in the
   tests phase. 3.5 gives three ways to make that list and the session's
   lean.

**Not verified.** No test was deleted and no break planted, so no proof
named in section 3 has been run against its row. `phaseTimeline.test.ts`
was read by its tests' names and not its bodies. The classing of 59 of
the 64, and of the smoke's eight, rests on headers and names. The smoke's
long files were timed and not read. Whether a pane probe or a script
outside the type check reads one of the ten read-backs was searched for
three of the names (`binOf`, `remainingSeconds`, `count`) and not the
other seven. `parallelRunDecisions`'s 135 s alone was under the coverage
tool with two other files running. The hook's own length was not timed
with that test taken out.

Readings, by the tool's clock: **87,742** at 15:23 after HANDOFF;
**277,517** at 15:42 with the main suite read and its bottom printed;
**340,761** at 15:55 with both tiers read and classed; **370,066** at
15:59 with the census's section, this entry and the Cursor written;
**372,730** at 16:01 on 120e's commit, `8b37ac3` (the hook: 3765 of 3765
in 261 files). The step cost about 280k.

**The read, the first tranche** (the user, 2026-10-13, on the stop's
report, which held eleven items of section 3 and one question, each with
the session's lean): "Alright, Claude! 😁 Great work! I'm on-board with
all of those leans in this tranche; signed!" So:

- **Signed for deletion:** `tests/smoke.test.ts`,
  `tests/gauntlet/humanFixture.test.ts` (the fixture stays) and
  `src/run/encounters/levelCapMigration.test.ts`, with
  `src/config/selection.test.ts` going with A-09 (A-33); `multiTick.test.ts`
  but for its cooldown test, which moves into `phaseTimeline` (A-34);
  the run's trigger registry, `Keybindings.rebind()`,
  `PlaybackSpeed.label` and `TraceRecorder.dispose()`, each with its tests
  (A-36).
- **Signed kept:** `World.shove()`, for Round 9 (A-36).
- **A-37:** the `--jobs` parity rule stays and its test comes off every
  sim commit, by a change to the hook at the instruments' phase.
- **The tests phase starts with a list by test,** made by reading the
  coverage out after each test inside a file's run, with 120e's list by
  file as its known answer.
- *Not in that tranche, by the session's own order:* A-35 (the ten
  read-backs), the classes kept as files, and all of section 2. 120d
  and 120e stay ◐.

Reading: **393,482** at 16:21 on the first tranche's commit, `20ccf82`.

**Section 2's asks, held against their sources before their tranche**
(the same session). 120d had left four things unlooked at, and each row
the user is asked about was opened first.

- *A-25, the twelve.* Each declaration read with its comment. All are as
  the table says: a one-line wrapper over what the game calls
  (`rarityStars`, `orderRoster`, `hazardCells`), a predicate or formula
  the game does not call (`basicAttackDamage`, `footprintFits`, the two
  `…Availability`, `isActiveNeutral`), a text print "for eyeball
  verification" (`dump`), three copied glyphs. No lean moved.
- *A-30, one lean moved.* `readEpsilonAA.ts` was "ask". Its header and a
  search say it is the only derivation of the arbitrated bot's noise
  floors, which are constants in `rollout/arbitratedStrategy.ts`
  (`PORT_BUY_EPSILON` and five more), so a new decision site needs it
  run again. Now "keep", with its two files. `verifyArbitratedRuns.ts`
  is one phase's exit check over a list of sites that its own comment
  calls deliberately partial: still "delete".
- *A-31, the vectors.* BALANCE.md was searched for each of the fifteen
  files' stems and names none. Its rows for those arms (the ladder, the
  stack, the boss flip) give a result and no command, and a row measured
  on an older engine reproduces only on its commit's tree, which holds
  the file. The lean stays "delete".
- *A-32, the two tools.* Their READMEs read. `sweep-gui` builds an
  `npm run fuzz` command to paste and runs nothing; its last change of
  substance was in June. `mapgen-prototype` draws the battle map the
  production generator makes for a seed and was last touched in August
  with the generator. Whether either is still opened is the user's to
  say.
- Not looked at: the bodies of A-30's two bench files; A-24's tests.

Reading: **411,299** at 16:25 on that commit, `e42495d`.

**The read, the second tranche** (the user, 2026-10-13, on thirteen
items of section 2 and the stylesheet call): "Alright, Claude, I'm
signing off on your leans for the first twelve of those. (N.B.
Supporting a second language should probably be an explicit to do 😂)
For the mapgen prototype, while I don't use this often, I anticipate
that it'll be very helpful as we add more tile types and need to
overhaul the procedural map generation, so I think it can stay. Signing
your CSS proposal too! 😁" So:

- **Signed kept:** the locale layer's ten exports (A-24);
  `isActiveNeutral`, for the neutral-team trial (A-25); the two bench
  scripts and the three noise-floor files (A-30); `tools/mapgen-prototype`
  (A-32), for the tile types and the generator overhaul to come.
- **Signed for deletion:** eleven of A-25's twelve, their tests going or
  moving as its table says; `verifyArbitratedRuns.ts` (A-30); the fifteen
  stored vectors (A-31); `tools/sweep-gui` (A-32).
- **The editors' stylesheets are a trial.** "Deletion only" for `tools/`
  is lifted for that one case; 120f sizes it and it runs late.
- **A second language is now a TODO item** ("§120 riders"), at the
  user's word. META-ROADMAP's line was read for it (518: the locale has
  "no row in Settings; the row comes with a second locale").
- *One signature the session read into.* The lean on `sweep-gui` was
  "delete if you no longer open it", and the reply answered that
  question for the other tool only. The session took the signature of
  the first twelve as "it is no longer opened", recorded it so in the
  row, and said so in its next message for the user to correct.
- *Checked after the tranche, for the next one:* A-28's row had left
  `.stop` and `.hide` unread in the files outside the type check. Every
  `.stop(` there is the recorder's and the one `.hide(` is the probe
  kit's; no other name of A-28, and none of A-36's four deletions, is in
  a script, a probe, a page or a pane procedure.

Reading: **427,326** at 16:47 on the second tranche's commit, `1282a16`.

**The read, the third tranche** (the user, 2026-10-13, on the classes
that need a look): "Sorry, yes; sweep GUI can go 😂 I don't think I've
ever used it XD Signing all of your leans except for close tooltip.
Let's investigate if tooltips persist across a scene change, because
they definitely shouldn't. That might be a case of its not being called
being a bug. Mute just being volume zero is good. Sound reasonable?" So:

- **Signed for deletion:** 24 of A-22's 25 exports; A-28's 21 class
  members, each after its site is read in its phase, the mute among
  them; A-29's two files; the word `export` on A-26's 257, phase by
  phase. `sweep-gui` is confirmed.
- **Signed kept:** A-23's fourteen, A-27's 188, A-35's ten read-backs,
  the fifteen other tools, and the test files not signed for deletion.
- **Open: `closeTooltip`,** on the user's question.

**The question, measured.** The module answers it in its header: while a
tooltip is open a per-frame check closes it when its trigger has left
the document or lost its box (`follow()`, `src/ui/tooltip.ts:422`). A
screen leaves by `fadeOutAndRemove`, which takes it out 180 ms after its
fade starts, and a chip of the two page-lifetime columns hides by
`display: none`. A hidden pane runs no frames, so the read was made
under the probe runner in an offscreen window
(`scratch/120e/tooltip-swap.js`; the page there is a built one, so the
probe opens the tooltip through its key and reads it from the DOM, and
it fails by name if the tooltip is not open and pinned before each
case).

- *A scene swap.* A tooltip pinned on the pre-turn screen's draw chip,
  then the turn advanced. From the command, in two runs: the screen's
  fade starts at 15 and 10 ms, the chip leaves the document at 188 and
  186 ms, the tooltip loses `is-visible` at 194 and 197 ms, and the host
  is hidden at 344 and 331 ms. The run is in its battle and nothing is
  open. **A tooltip does not outlive the swap.** It does stay whole for
  about 190 ms over a screen that is fading out, and then takes its own
  fade.
- *An overlay.* Pinned on the sector-map chip, then the chip clicked:
  112 elements appear (the map), and 0.6 s later the tooltip is still
  up on the chip. The first Esc closes it. The stylesheet puts the
  tooltip above that overlay on purpose (z-index 50 over 40). **A pinned
  tooltip stays over an overlay opened from its own trigger.**
- *What that makes of the function.* The check in `follow()` does what
  `closeTooltip`'s comment says it is for at a scene swap, one fade
  late. A call where a screen's fade starts would close the tooltip with
  its screen, and that call needs to know whether the open trigger is
  inside the leaving screen, which is `openTooltipTrigger()`, the other
  dead export of that file. So the two read as wiring that was written
  and never connected, as the user guessed, and what is missing is 190 ms
  and the overlay case, not a tooltip left on the wrong scene.
- *Not seen:* Firefox. A hover-opened tooltip under a real pointer,
  where the browser decides when the pointer has left a covered control.
  The probe's finder did not name the overlay's root element; the 112 is
  a count of what appeared outside the tooltip.
- The probe's first form imported the tooltip module by URL and failed
  on the built page; its second took the tooltip's own content for the
  overlay. Both showed in the first report read.

Reading: **494,406** at 17:44 on the third tranche's commit, `99b2179`.

**The read closed** (the user, 2026-10-13, on the measurement and three
options: keep the two functions with a TODO, wire them now, or delete
both): "Signing option 1, then! 😁 Phew; glad we caught that!" So
`closeTooltip` and `openTooltipTrigger` are kept, A-22's deletions are
23, and TODO holds the wiring ("§120 riders": a tooltip leaves with its
screen). Every row of sections 2 and 3 is signed, and 120d and 120e are
☑ in ROADMAP.

- *What the row had wrong.* A-22 said of `closeTooltip` that "deleting
  the function does not change the answer", and put the question off to
  a later kickoff. The function's comment names the two places it should
  be called from. A function nothing calls whose comment names its call
  sites is a question about those sites, and it is asked before the lean
  is given; the Cursor now says so.
- *The read's cost:* about 130k for three tranches, 36 signed items and
  one measurement, against 120c's 340k for 21 rows. What differed: the
  rows carried their "In play" lines from the start, each tranche's
  leans were checked against their sources before it went out, and the
  user signed by lean.

**The hand-off before 120f.** Reading **499,574** at 17:47, about 50k
under the line. 120f reads `Run.ts` and `World.ts` whole (about 8,000
lines) beside a profile of 279 files, which is larger than the room, so
the session hands off under the line (`process/planning.md`, "Context:
the halt and the hand-off line"). It said so in its last two reports
and the user did not object; it was not put as a question of its own.
The user's dev server has been up since 12:38 by the machine's clock
(two node processes, theirs); nothing of the session's is running.

### 120f — the trials (2026-10-13, session a9f26053)

Pre-flight at `580ead7`: the tree clean, the type check clean, the suite
3765 of 3765 in 261 files. The result is
[round-8.5-census.md](round-8.5-census.md), section 4: rows B-01 to B-16,
A-38 to A-40, F-1 and F-2. Nothing under `src`, `config` or `tests`
changed. The read is `batch`, at 120h, so the step is ◐.

**Step zero.** Two premises. That the source had not moved since the
scans: `git diff --stat a45a7af HEAD -- src config` names one test file,
and 279 files hold 63,458 lines, as the kickoff counted. That `Run.ts`
and `World.ts` are what a profile would say to read: they are its first
two files. Both held.

**Built**, in `scratch/120f/` (not tracked; this machine only).

- `special.ts`: every comparison against a string literal in the
  non-test source, by the type checker's tree, filed under the declared
  type of what is compared and the literal; `case` labels, `typeof`
  tests and null tests on a property counted apart. Nine known answers
  on a planted file, three of them lines that must give nothing.
  `reconcile.mjs` holds its sites for one literal against a search of
  the lines, site by site: `'neutral'` 34 of 34, `'enemy'` 21 of 21,
  `'map'` 15 of 15.
- `profile.mjs`: the five columns and the rank. It refuses to print
  unless a planted rank and six planted subjects come back as worked by
  hand, the files are 279 and their lines 63,458, and `World.ts`'s
  commits by `git rev-list` are not more than its own (96 and 96).
- `counts.mjs`: the patterns behind the reads' leads (the shuffles, the
  stacked doc comments, the comment lines, the console lines, the
  roster's arrays).
- `queue-effects.ts` and `fromjson-keys.ts`: the two probes of 4.8, each
  with its known answer first.
- `notes.md`: what the read of `World.ts` found, written when that file
  was finished; `Run.ts`'s went straight into the census.

**What the checks caught, in the instruments and in the draft.**

- *The profile's gotcha column was a third of itself.* It first counted
  an entry that names a file by path, and gave `World.ts` 5. A search
  showed GOTCHAS says `World.tick` far more often than `World.ts`; with
  `Class.member` counted the column gives 18, and a separate count of
  the entries gives 17 with the one the file cites.
- *A line that continues a statement reads as unreached.* `reach
  --at=World.ts:2172` said no proof runs it, and a row was about to say
  the hand-mirrored rule of B-08 has no proof. Asked as a range
  (2162-2177) every proof runs all four statements. A `reach` answer for
  one line is asked again as its function's range before it is quoted.
- *The first compare of the finder against a search was the compare's
  fault,* a column cut wrong in a shell pipe; it was rewritten as a
  script that reads the finder's own output file.
- *Config files were paired with the wrong loaders twice,* by "the
  first file that names the JSON" (the stamp's registry names them all,
  and a comment names two). Paired by name, and the three one-key files
  counted that way.
- *Five weighted picks looked like one.* Read, they differ on whether a
  list of one draws (gotcha #111) and on the boundary's comparison, so
  the census lists them as not copies. The five shuffles were read the
  same way and are the same loop.
- *A comment that says "test-only" about a line the corpus runs*
  (`findUnit`'s scan).
- *Ten claims in the section's draft were wrong against their source*
  and were corrected before it was appended: where each class starts,
  13 files and not 12, 23 fields and not 22, a field that is optional
  for a reason other than tests, and six more of that size.
- *A quoted heredoc of the whole section was refused by the shell;*
  nothing landed, and it went through the file tool. In the friction
  log.

**What the step says.**

- **The round's size is the comment pass and the tests, as 120d said,
  and the trials are small.** Comments are 25,659 of the 63,458 source
  lines, and half of each of the two longest files. The trials that came
  out of 7,981 lines read whole expect to remove about a hundred lines
  between them (B-06 to B-10), apart from the editors' stylesheets.
- **The two long files are long, not tangled.** Each has two or three
  fix commits; the fixes are in drawing and movement
  (`BattleRenderer` 12, `BattleScene` 8, `MovementBehavior` 6), which
  the census did not read.
- **The neutral team is the most spread special case there is,** and a
  split is not the free rename the kickoff sized: 18 lines compare two
  units' teams, where a wall and a camp member are one team today.
- **Source code names content on one line of 619.**
- **Two things are wrong today and harmless today** (F-1, F-2).

**Calls made here, for the read at 120h.**

1. *A special case is a comparison against a string literal outside a
   `switch`.* The cut names "special-case sites" and no rule; a flag or
   a predicate's call is not seen (4.9).
2. *A fix commit is a subject that opens `fix` or names a `-post`
   step,* and the rank is the plain sum of five ranks.
3. *Three rows of list A's kind (A-38 to A-40) sit in section 4,* where
   they were found, and not in the signed sections.
4. *F-1 and F-2 were written into TODO now,* under "§120 riders"; the
   cut says "listed for TODO" and 120g is the pass that weighs them.
5. *The near-duplicate leads were not opened,* beyond the shuffles and
   the weighted picks: they are left to each phase's kickoff, as the
   kickoff's sixth call left the rest of the profile's top.
6. *B-02's lean is "after B-01".* The user named the split; the census
   proposes the cheaper step first and says why.
7. *The plan search.* B-02 was held against META-ROADMAP, DESIGN, TODO
   and `plans/` by "neutral team", "faction" and "third team" (DESIGN's
   camps section calls a camp "a THIRD, neutral faction"; no plan names
   a team split) and against GOTCHAS by `neutral` and `campId` (#32,
   #71 and #105, each read at its opening). B-03 against BALANCE by the
   knob names. The other rows were not held against the archived road
   maps or specs.

**Not verified.** No trial was tried and no plant was made: every proof
named is a `reach` answer or the map's word for the folder. The twelve
hand-written pairs of B-01 and the 17 "any neutral" sites of B-02 were
classed by their line, not their function. `Renderer.ts`, `Targeting.ts`
and every near-duplicate but ten bodies were not read. The editors'
stylesheets were sized by 120d's count and not re-counted. The rest of
the profile below its first twelve rows was printed and not looked at.
The 14 stacked doc comments were found by a pattern and six of them
seen. Whether a bot look-ahead ever copies a queue holding a buffed
template (F-1) was not run.

Readings, by the tool's clock: **89,388** at 18:03 after HANDOFF;
**193,484** at 18:12 with the cut, the spec, the census, the oracle map
and both instruments run; **277,673** at 18:15 with `World.ts` read;
**420,974** at 18:19 with `Run.ts` read and the counts taken.
Reading **487,353** at 18:33 on 120f's
commit, `e9932fe` (the hook: 3765 of 3765 in 261 files, the smoke not
run). The step cost about 390k, some 210k of it the two files read
whole. **The hand-off before 120g:** about 60k is left under the line,
and 120g weighs each open TODO item against the plans, which is larger
than that, so the session hands off under the line
(`process/planning.md`, "Context: the halt and the hand-off line"). It
is the session's own call, said in its report to the user and not put
as a question. 120g and then 120h's stop start in a fresh session, from
the Cursor. Nothing of the session's is running.

### 120g — the TODO pass's list (2026-10-13, session 462d21b3)

Started at `cdd5c81` with the tree clean. The suite and the type check
were not run at the start; the hook ran both at the step's commit. The
result is [round-8.5-census.md](round-8.5-census.md), section 5: rows
T-01 to T-97. Nothing under `src`, `config` or `tests` changed, and
TODO itself is as it was: the kickoff's seventh call leaves the doing
to the phases, and what signing writes is 5.9's ninth call. The read is
`batch`, at 120h, so the step is ◐.

**Step zero.** The cut says 91 open items. Counted by a written rule
(an item is a top-level bullet, closed if its first line holds `[x]` or
a tick): **97 open of 184.** The same rule at the kickoff's commit
gives 91 of 178. The six since are the four the census's reads added
and 120f's two, which were written with no checkbox and which a search
for `- [ ]` does not see. The premise held: the Cursor had said the
reads and 120f added to the list.

**Built**, in `scratch/120g/` (not tracked; this machine only).

- `items.mjs`: TODO's items by that rule, with each open item's id,
  line and title. It refuses to print unless a planted file of six
  bullets parses to its known answer (an indented box, a tick on a
  later line, a bullet with no box, a title that wraps), and unless its
  count agrees with a plain search of the file. `--at=<ref>` reads
  another commit's TODO.
- `tally.mjs`: reads section 5 as written and fails unless every open
  item is a row exactly once, each row's line is the item's line in
  TODO, each fate is one of the seven, each sub-section's count is its
  ids, and 5.1's table is the tally. It refuses to print unless a
  planted section with a wrong line, a repeated id, a missing id, a bad
  fate and a wrong count reports all five. The section's numbers are
  its output: 82 rows, 97 items.
- `section5.md` and `append.mjs`: the section as drafted, and the
  script that appended it after checking its anchors.

**How each row was weighed.** The item read in TODO; META-ROADMAP's
Rounds 8.5 to 12, its coverage map and its deferred list read whole,
and searched by word for the items no line seemed to name; the census
searched by twenty of the items' subjects; the code or the config
read or searched where an item states something about it today. 33
rows were settled that way (5.2 and 5.3) and 64 are proposals.

**What the checks caught.**

- *Five items are already built or answered.* The card's rarity
  accents (four rules in `ui.css`), live save and load, the tooltip
  poll's live read (taken at 120e's read), the cap's rule (the casualty
  experiment), and hop-gating as a mechanism: a sector's layout entry
  takes `minHop` and `weight`, and the config uses the first on no
  layout.
- *T-41's premise is wrong against the code.* The item says a browser
  read of the survivors end sequence needs `chipMode: survivors`. The
  shipped `capPenalty: survivors` pays that rule on every capped turn,
  and the HUD runs the sequence then, so it ships and is unread. The
  row is reworded, not dropped as 120c's read had it for this list.
- *B-14 against T-27.* The census lists the harness and the rollout
  walker as a lead for a trial; TODO records that duplication as
  deliberate, with two triggers to reopen it. 120f's seventh call said
  its rows past B-03 were not held against the plans.
- *TODO gives five items to Round 9 and META-ROADMAP's Round 9 names
  none of them* (the kit watches, the priest, the wall, power
  diversity, the AoE retune).
- *The `chebyshev` duplicate is not in the census:* four identical
  bodies in `src/sim`.
- *T-06's premise changed at 116f:* the colour tables hold palette
  names now, not hex.
- *Two claims in the draft were wrong and were corrected before the
  section was appended.* That the harness leaves the turn gates off
  came from a search of `src` alone; `tests/fuzz/harness.ts:736` turns
  them on when a strategy acts at a gate. And "16 calls" of `chebyshev`
  was 16 occurrences with the four definitions among them. A third was
  unsupported: that every dead link but the five is under `archive/`
  (a filter on the word hid links into it); counted by the file that
  holds the link, six are outside.

**Calls made here, for the read at 120h.**

1. *Four fates, not three:* done already, done in 8.5, given a round,
   dropped; and for a round, whether a plan names it or signing adds
   it.
2. *Rows merged where items are one subject* (the sheet's five
   watches, the layout's three, the failure plate's three, the
   recorder's three, the dials' four, two pairs): 82 rows for 97 items.
3. *5.2 and 5.3 are put as classes;* the rest row by row.
4. *What is left inside six ticked items is listed* (5.7), since the
   rule counts by an item's first line.
5. *No row was held against the archived road maps or specs:* a TODO
   item's fate is a schedule, and the live plans are its sources.

**Not verified.** Most rows' numbers are the items' own and were not
run again. No `--grant` read, no board and no probe was run. Whether
today's content passes the guard T-38 asks for was not tried. Whether
`phase-stats` still reads 135 for Round 8 was not run. The two smoke
lines (T-83) and the OS's reduced-motion query (5.7) are the user's to
read. "No plan names it" is a search of META-ROADMAP by the words each
row gives, not a reading of every line against every item.

Readings, by the tool's clock: **88,385** at 20:51 after HANDOFF;
**214,545** at 20:58 with the cut, `process/planning.md`, TODO read
whole, META-ROADMAP's Rounds 8.5 to 12, the spec and the first checks;
**288,064** at 21:08 with the section appended and tallied.

Reading: **294,606** at 21:10 on 120g's commit, `97f4b45` (the hook:
the type check clean, 3765 of 3765 in 261 files, the smoke not run).

### 120h — the stop: two reads handed over and the round sized, as put to the user (2026-10-13, session 462d21b3)

120h is the phase's last step and a `stop`. This entry is what the
session put to the user, unsigned as it is written; ROADMAP gets the
later phases once they are signed, and TODO is rewritten once section 5
is. Nothing under `src`, `config` or `tests` changed.

**What the stop holds.** Two reads and two calls of size.

- *Section 4, the trials* (120f): 4.10's eleven calls.
- *Section 5, the TODO pass's list* (120g): 5.9's ten calls.
- *The trials' budget,* which the spec's D1 leaves to the user "once
  the census has sizes".
- *The phases after this one.*

**Step zero for the size.** `scratch/120h/size.mjs` counts the source by
folder under 120f's rule for a comment line, and refuses to print unless
its totals are 120f's (279 files, 63,458 lines, 25,659 comment lines).
They are.

| folder | files | lines | comment lines | step codes |
|---|---|---|---|---|
| `sim` | 56 | 15,086 | 7,396 | 1,825 |
| `ui` | 49 | 10,241 | 3,064 | 948 |
| `run` | 19 | 9,544 | 4,337 | 1,349 |
| `render` | 23 | 7,668 | 3,003 | 664 |
| `config` | 34 | 5,785 | 2,502 | 658 |
| `dev` | 22 | 4,582 | 1,019 | 133 |
| `bot` | 11 | 2,121 | 878 | 217 |
| the other ten | 65 | 8,431 | 3,460 | 582 |
| all | 279 | 63,458 | 25,659 | 6,376 |

The step codes are `npm run oracle -- comment-codes`' own table, run
today; its files are 434, since it counts the test files under `src`
with the source.

**The size, said plainly.** What is signed for deletion and what list B
proposes are small against the tree: 120f's trials expect about a
hundred lines between B-06 and B-10, and the dials are a few keys with
their readers. The comment pass is the round. It has to read every file
it rewrites. 120f read 7,981 lines whole for about 210k tokens, 26 a
line, so reading the 63,458 once is about 1.7M tokens before a comment
is written: several sessions at the hand-off line, by arithmetic from
one measurement and not a forecast. The tests phase is the other large
piece, and its size waits on its own first step, the list by test.

**The phases, as put.** The charter's order (sim, run, render and UI,
the bot and the instruments, tests), with a phase for the dials ahead of
it, one for the tools after it, and the two the charter already names at
the end. Each subsystem's phase runs its signed deletions, then its
trials, then one re-skim, then its comment pass, as META-ROADMAP has it.

- **§121, the dials.** Every signed config key with its schema entry
  and its readers wherever they sit (A-01 to A-05, A-07 to A-10, A-13,
  the signed items of A-21), B-03's three one-key files, and
  `src/config`'s comment pass (34 files, 5,785 lines). First because a
  dial's readers are in sim and run, so those phases then read code
  without them. Proof: config, and sim for a reader. That comment pass
  is also the measurement the later ones are sized by.
- **§122, sim** (with `core`: 64 files, 16,389 lines). Its signed rows;
  B-01, B-07, B-08, B-09, and T-24 if it is signed; B-02 decided on
  B-01's list of which site asks what; the re-skim; the comment pass.
- **§123, run** (19 files, 9,544 lines). Its signed rows; B-04, B-06,
  B-10; F-2's test if it is signed; the comment pass, then `Run.ts`
  re-read for B-15.
- **§124, render and UI** (151 files, 29,619 lines: `render`, `scenes`,
  `ui`, `Game.ts` and the page's layers, `dev`). First T-91 and T-84 if
  they are signed, since the phase has no proof for which scene a phase
  mounts; then its signed rows; B-13's leads by eye; the comment pass.
  It is the largest phase by lines, and its kickoff may cut it in two.
- **§125, the bot and the fuzz instruments** (`src/bot`, 11 files, and
  `tests/fuzz`'s instruments). A-20, A-30, A-31; B-14's leads, less its
  first clause if 5.9's fourth call is signed; and the user's 2026-10-12
  call on whether the comment pass takes `tests` and `tools`.
- **§126, tests.** The list by test first, with 120e's list by file as
  its known answer; A-33 and A-25's tests; B-11; T-90 and T-86; T-49 and
  T-50 if they are signed.
- **§127, tools.** The sweep page deleted; B-05, with its compare built
  first and shown to fail on a planted declaration.
- **§128, the close.** The docs pass (T-62, T-89), `phase-stats`' fixes
  before the efficacy read (T-51, T-85), the cold-read probe in a
  session of its own, the shell-quoting audit, the welfare read with
  T-87 and the standing decisions, the corpus's tier, the build tagged
  and uploaded.
- **§129, the dependency phase,** after the tag (T-26).

**Calls put with the phases,** each with the session's lean.

1. *A phase for the dials, first.* META-ROADMAP's list has no config
   phase; B-03's row assumed one.
2. *A-37's hook change moves to §121's first step.* It was signed for
   the instruments' phase. Every sim and run commit before then runs the
   smoke with the 81 s test in it, and §121 to §123 are where those
   commits are.
3. *The trials' budget:* the signed rows of list B, and from each
   phase's leads and its one re-skim at most three more trials. A fourth
   is written into the census for a later round. A trial under D2's bar
   is reverted and not tried a second way.
4. *Whether the comment pass fans out to smaller readers* is not asked
   now. §121's comment pass is run in the session and its cost a line is
   recorded; the call is put at §122's kickoff with that number. The
   proof (`comment-strip`) shows the code is unchanged whoever writes;
   nothing proves a comment true, which is the case against handing sim
   and run to a reader that did not make the deletions.
5. *§124 may be cut in two at its kickoff.*

**Not verified.** No phase's contents were re-counted from the census's
rows by subsystem: which signed row lands in which phase is by the
row's file, read from the rows' headers. The 26 tokens a line is one
step's cost, for two files read whole with nothing rewritten. No trial
was tried. The reads of sections 4 and 5 are the user's and have not
begun.

Readings, by the tool's clock: **337,668** at 21:15 with section 4 read,
the size counted and this entry written. The stretch the stop opens is
the user's read of sections 4 and 5, then ROADMAP's phases and TODO's
rewrite. About 210k is left under the line: enough if the read is mostly
signatures, and not if several rows come back wanting new measurements,
in which case the session hands off between tranches.

**The stop's report was too much for one read** (the user, 2026-10-13:
"Can we walk through everything that I need to sign in smaller
tranches"). It had put both sections' findings, eight drops, three of
5.9's calls, nine phases and five calls of size in one message. The
read was cut into seven tranches, smallest decisions first: what needs
no decision; the drops; this round's proposals; Round 9's additions;
Rounds 10 to 12's; list B; the phases and the budget. Each is recorded
here as it is signed.

**The read, the first tranche** (the user, 2026-10-13): "Definitely
signing all of those, Claude! 😁"

- **5.2, signed as a class:** the five already built or answered
  (T-13, T-21, T-22, T-23, T-42), and T-22's remainder as one line for
  Round 10.
- **5.3, signed as a class, for 27 of its 28:** the fates META-ROADMAP
  already names, the two drops its deferred list holds among them (T-20,
  T-45). T-97 was held out by the session, since it rests on 4.10's
  eleventh call, and goes with list B.
- Nothing in TODO or META-ROADMAP is written yet: what signing writes
  is 5.9's ninth call, unsigned.

Reading: **353,642** at 00:19 on 2026-10-14 by the tool's clock, on the
first tranche's commit, `650653a`.

**The read, the second tranche** (the user, 2026-10-13): "I'm
comfortable dropping all of those, Claude! 👍"

- **5.6, all eight signed for the drop:** T-06, T-10, T-18, T-25, T-27,
  T-30, T-43, T-73. That answers 5.9's eighth call, and its third and
  fourth for these rows: the three watches go, and T-27's verdict goes
  to GOTCHAS with **B-14's first clause struck** in section 4. The
  GOTCHAS entry is written with TODO's rewrite, so the verdict is never
  in two places.
- **T-06,** the session's first doubt, since the hoist was the user's
  own ask: "Yes, I did ask for 1, but I'd totally forgotten about it,
  and it's not been a problem."
- **T-30, and a round the plans do not hold.** "At some point, probably
  after the content rounds, we'll probably want to add another bot round
  to see if it's still working as intended, but until we have more data,
  we don't need to speculate on potential fixes." So the redesign is
  dropped as a fix proposed ahead of its evidence, and what stands in
  its place is a check of the bot after Round 10. META-ROADMAP has no
  such round; Round 12's human gauntlet #2 is its nearest line. Where
  the user's words are written is put with 5.9's ninth call, in the
  last tranche, and not decided here.

Reading: **360,401** at 00:28 on the second tranche's commit, `c698219`.

**The read, the third tranche** (the user, 2026-10-13): "Signing all,
Claude! 😁 Definitely agree that the two that add code are worth it! 👍"

- **5.4, all eleven rows signed for this round** (twelve items): T-24,
  T-49, T-50, T-51 with T-85, T-62, T-83, T-84, T-86, T-87, T-89, T-91.
- **T-24 is row B-17 of list B,** written into section 4 after B-11,
  which answers 5.9's seventh call. The one definition it folds into
  has been in the occupancy core since §35 (`distanceBetween`, the same
  body, read), and `movement.ts` already exports it as `chebyshev`.
  Gotcha #34 names the heuristic that uses one of the four copies; the
  trial moves a definition and not a value.
- **T-91 and T-84 add dev code in a round of deletions,** which the
  session named as the tranche's one real call. The user agreed in so
  many words.
- By phase, for 120h's draft: the sim phase gains B-17; the render and
  UI phase opens with T-91 and T-84; the tests phase takes T-49, T-50
  and T-86; the close takes T-62, T-89, T-51 with T-85, and T-87's
  decision; T-83 is the user's to read.

Reading: **368,895** at 00:36 on the third tranche's commit, `65ce099`.

**The read, the fourth tranche** (the user, 2026-10-13): "Signing all
ten, Claude! 😁 I'm in full agreement on the more weighty ones you
singled out"

- **5.5's Round 9, all ten rows signed** (fifteen items): T-03 with
  T-28, T-11, T-29, the sheet's five (T-31, T-32, T-35, T-36, T-39),
  T-34, T-38, T-47, T-63, T-92, T-96. META-ROADMAP's Round 9 gains them
  when signing is written.
- **The three the session singled out, each signed with its reason:**
  the sheet's watches and the kits go to Round 9 and not Round 10's
  sheet, so that Round 10's content is authored against the corrected
  numbers; the effects' coverage guard (T-38) goes to Round 9's first
  phase and not this round's tests phase, since its first run may list
  gaps that are sound calls; and power's growth key (T-92) goes to Round
  9's bump window, with no new cleanup round for it. That is the first
  half of 5.9's second call; T-93 is the other half, in the next
  tranche.
- The fifth tranche as planned held twenty rows, twice any before it,
  so it is put as two: Rounds 10 and 12, then Round 11.

Reading: **376,010** at 00:43 on the fourth tranche's commit, `3c34ddf`.

**The read, the fifth tranche** (the user, 2026-10-13): "Signing all
except for 6, Claude."

- **Round 10's five rows signed:** T-02, T-05, T-15, T-33, T-52.
- **Four of Round 12's five signed:** the recorder's three, kept and not
  dropped (T-60, T-64, T-65); the device pixel ratio (T-76); the failure
  plate's three together (T-79, T-80, T-81); a second language as a
  decision point (T-94).
- **The dials' row is not signed, and the user reads it as another
  item** (T-93 with T-07, T-48, T-88). The session had put it to Round
  12 as a question of which dials a shipped build answers. The user:
  "So I was actually viewing that as something that would happen in
  Round 9 or 10. My thought there was that, as we massively ramp up
  content, we're probably going to need more fine-grained control of
  what types of battles and encounters load, For example, I don't think
  there's a way to test, say, an event chain from end to end in one run.
  Or to force a specific chain of encounters or layouts. Or to override
  a shop's inventory. That was more what I was thinking. Does that
  track? What's your thought?"
- **Held against the code before the answer** (`src/run/RunConfig.ts`,
  its fields and their comments, read). The user's three examples are
  right. Each forcing dial takes one value for the whole run: `layout`
  one board, `encounter` one id at every node of its kind, `event` one
  event, `firstNode` the first node's kind. None takes a list, nothing
  sets a port's stock, and a forced id is "NOT persisted": a run loaded
  from its save goes back to normal selection.
- **The session's answer, put to the user and unsigned:** it tracks, and
  it is a different item from the one the row sized: a way to script a
  run for content work, of which fewer URL names is a consequence and
  not the aim. Lean: Round 9 and not 10, early. Round 10's own guard
  sends a new mechanism back to Round 9; Round 9's exit is one consumer
  a seam, each of which wants "this encounter on this board at this
  hop" to be checked; and "Event → battle → resume" is the event chain
  the user names. The shape, for that kickoff and not decided here: one
  list of per-node entries on `RunConfig`, of which today's four
  single-valued dials are cases, so control goes up as the count of
  dials goes down. T-07, T-48 and T-88 fold into it.
- **Signed** (the user, 2026-10-13): "I said simplified, but I was
  probably thinking that in the sense of "simplified into a general
  system," maybe? Or maybe my mind just spaced out and I wrote the wrong
  word. 😂 Fully signed! 😁" So the row is **Round 9, early, a scripted
  run for content work**, with Round 12 keeping one clause (which dials
  a shipped build answers). In the census the row moved from 5.5's
  Round 12 to its Round 9, rewritten as signed, and the counts moved
  with it: Round 9 holds 20 items and Round 12 holds 13. That closes
  5.9's second call: neither of the user's two "later cleanup round"
  riders gets a new round. What the session took from it: the item's
  title in TODO was the session's paraphrase of one sentence, and the
  row was sized from the title. Asking what "simplified" was for, at
  A-19's read, would have found this a day sooner.

Reading: **386,819** at 01:13 on the fifth tranche's commit, `2818e4b`,
and **395,219** at 01:32 on the dials' row's, `3ab580d`.

**The read, the sixth tranche** (the user, 2026-10-13): "That all looks
good to me, Claude, but a caveat: 10 may be brought up and split into a
.5 round pending player feedback. Otherwise, signed! 😁"

- **5.5's Round 11, all ten rows signed** (twelve items): T-41, T-44,
  T-46, T-59, T-66, T-67, the layout's three (T-74, T-75, T-77), T-78,
  T-82, T-95.
- **T-41 is signed as reworded:** a read of one capped turn in the
  user's Firefox, with the stalled battle's draw prompt, and not a
  dropped item (5.9's sixth call).
- **The layout rework's place carries the user's caveat** (5.9's fifth
  call). It is Round 11's first phases, ahead of the tutorial, since the
  tutorial's callouts point at the screens. No round is inserted now.
  Players' reports may bring it forward as a `.5` round, and that is the
  user's to call when they come.
- **Section 5 now has no row unsigned but T-97,** which waits on 4.10's
  eleventh call. Of 5.9's ten calls, the first eight are answered; the
  ninth (what signing writes) and the tenth (5.7's two leftovers) go
  with the last tranche.
- List B is put as two tranches, as the earlier ones were sized: its
  small rows with list A's three first, then the user's three
  candidates. That makes nine tranches.

Reading: **401,536** at 01:42 on the sixth tranche's commit, `e8eab65`.

**The read, the seventh tranche** (the user, 2026-10-14, after a
night's sleep in the middle of it): "Signing all of those!"

- **Section 4, every row but the user's three candidates:** B-04 and
  B-05 as sized; B-06 to B-10 as trials, each in its phase; B-11 in the
  tests phase after its list by test; B-12 to B-14 and the leads under
  them left to each kickoff, within the budget; B-15 not a trial, with
  `Run.ts` re-read after the run phase's comment pass; B-16 kept; A-38
  and A-39 deleted; A-40 as leaned. That answers 4.10's calls 4 to 11.
- **T-97, the loaded-run test, is signed for the run phase,** which
  closes section 5's rows.
- **A-39:** the session had asked whether the board's console line is
  used in a playtest; the reply signed the lean without a word on it,
  and the row says so.

Reading: **410,390** at 12:44 on 2026-10-14 by the tool's clock, on the
seventh tranche's commit, `452a39b`.

**The read, the eighth tranche** (the user, 2026-10-14): "Signing all
three as leaned, Claude! 😁" B-01 is the sim phase's first trial; B-02
is decided after B-01; B-03 folds the three one-key files in the dials
phase, with no wider merge. Every row of the census is now signed.

**B-02, the user's pre-registration** (verbatim in the row): the user is
inclined to run the split whatever B-01 shows, and may sign it as
preferable even if it adds lines, "on the grounds that it might be more
readable (in the fuzzy, hard to define sense)", and asked for the
session's opinion now and along the way.

**The session's opinion, as given.** Agreed that lines are a proxy and
readability the aim (the spec's own word is "approachable"), and that
writing this down before the trial is the right order. Where the trial
is decided is not its line count but the 18 lines that compare two
units' teams. Nothing funnels them today: each compares the two teams
in place, and `affectsMatch` compares teams too (`effects/targeting.ts:70`,
read for this answer). Split, a camp member and a wall stop being one
team at each, and the trial can go three ways:

- *One small helper* that says in one place that a camp and the scenery
  stand together, called at the 18. The session expects this to read
  better than today even with more lines. It is a new function, which
  the round's "no new abstraction" guard would need the user to allow,
  small as it is.
- *A clause at each site:* the hidden rule spread into 18 places. The
  session would argue against it whatever the count, and D2's third
  clause already rules it out.
- *A clean form that needs camp units to treat walls differently:* a
  change of behaviour, so not this round's. Its home would be Round 9,
  beside "Camp-aware aura `affects`", which already reworks how camps
  and teams meet.

For the fuzzy part, the cold-read probe (119f) is the instrument the
round has for a reader with no context: a few questions about camps
and walls on both trees would put a number beside the user's eye, as a
second opinion and not a gate. The bar the session would propose when
B-02 is decided: the same behaviour by the corpus with the declared
mapping; D2's third clause kept; its second set aside; the one helper
allowed; the 18 sites shown before and after for the user's read.

Reading: **418,089** at 12:57 on the eighth tranche's commit, `b0df137`.

**The read, the ninth and last tranche** (the user, 2026-10-14):
"Signing all seven, Claude! 😁 I'm excited for this!" Signed as put:

1. *The nine phases,* §121 the dials to §129 the dependency phase, with
   what each holds by the signed rows.
2. *A-37's hook change* at §121's first step, not the instruments'
   phase.
3. *The trials' budget:* the signed rows of list B, and at most three
   more a phase from its leads and its re-skim; a fourth goes into the
   census for a later round; a trial under the bar is reverted and not
   tried another way; B-02 keeps its own pre-registered bar.
4. *The comment pass's fan-out* decided at §122's kickoff, with §121's
   cost a line.
5. *What signing writes,* all of it now, before §121 (5.9's ninth call).
6. *The user's later bot round* as a line in META-ROADMAP's coverage
   map, placed at Round 10's close.
7. *The two leftovers:* the OS's reduced-motion query is the user's
   one-minute check; the dependency phase looks for JetBrains Mono's
   fix once (5.9's tenth call).

**What signing wrote.**

- *TODO, one section a round* (`scratch/120h/rewrite-todo.mjs`). It
  refuses to write unless TODO is as it was at `cdd5c81`, every open item
  is placed or removed once, each placement agrees with the fate the
  census gives the item (read from the census itself), and the removed
  are exactly its done and dropped rows. 82 items in five rounds; 102
  items out (the 87 ticked before the pass and the 15 it found done or
  dropped), all in git at `cdd5c81`. T-41 and T-93 carry the wording
  signed at the read; T-96 and T-97 gained the box they lacked. The old
  rule counts the new file as 82 open of 82. The file's first draft
  refused twice on its own anchors and wrote nothing.
- *META-ROADMAP:* Round 9 opens with the scripted run and gains its
  riders; Rounds 10, 11 and 12 gain theirs; Round 8.5's deletions are
  sized and its TODO pass recorded as listed; the coverage map's
  "stay in TODO" row is placed item by item, with the scripted run and
  the bot check as rows of their own; the deferred list's translations
  point at Round 12's decision. Three references to TODO's old section
  names now name the new ones, and one in TESTING.md.
- *ROADMAP:* §120 closed and demoted; "The phases after the census" and
  §121 to §129 written.
- *The census:* its status, and 5.9's last two calls.

**One signed item not written: T-27, the harness and the rollout
walker.** It was signed into GOTCHAS, with B-14's first clause struck,
on the row's evidence that neither of the verdict's two triggers to
reopen it "is on record as fired". That was a statement about the
record, and before writing the entry the session checked the first
trigger against the code: "a third consumer of the run-walk pattern
appears (rule of three)". Five files now each build a battle through
`battleSetup` and tick it: the fuzz harness (`tests/fuzz/harness.ts`),
the rollout walker (`tests/fuzz/rollout/walker.ts`), the chaos driver
(`tests/chaos/chaos.ts`), the journal drive (`tests/journalDrive.ts`)
and the journal replay (`src/journal/replayJournal.ts`), by a search
for a `World` built and a tick loop in each. So the trigger reads as
fired since Round 8. Whether the three newer walkers copy `runOne`'s
wiring as the walker does, or share it, was not read; 2.6 measured
shared runs only between the harness and the walker. The GOTCHAS entry
is not written and B-14's clause stays struck until the user answers.
The session's lean: put the clause back, widened to the five walkers, as
a lead for §125's kickoff within the budget, under the fuzz diff and the
corpus; T-27 stays out of TODO, since the lead replaces it; no GOTCHAS
entry, since it would record a verdict whose own condition has lapsed.
The other arm is the entry as signed, with the trigger's reading in it.

### The close of §120 (2026-10-14, session 462d21b3)

Every row of the census is signed: section 1 at 120c's read, sections 2
and 3 at 120e's stop, sections 4 and 5 at 120h's read in nine tranches.
The phase is closed: 120f, 120g and 120h are ticked and the section is
demoted in ROADMAP. What the phase hands on: the census as the list the
round does; ROADMAP's nine phases with the trials' budget; TODO by
round; the instruments under `scratch/120a/` to `scratch/120h/` on this
machine, each named in its step's entry. The one question open is T-27,
above. A phase-close summary of the session reports is in
`retro/sessions.md`.

Reading: **462,004** at 13:19 by the tool's clock, with everything above
written and before the commit. §121's kickoff is a phase kickoff, with an
audit of the code it touches and a cut to shape-lock; from here that
would cross the hand-off line, so it starts in a fresh session from the
Cursor.

Reading: **477,454** at 13:22 on the close's commit, `496f240`.

**T-27, signed again** (the user, 2026-10-14): "Signing your lean on T-27, Claude! 😁" So no GOTCHAS
entry is written, T-27 stays out of TODO, and B-14's first clause is
restored, widened to the five run walkers, as a lead for §125's kickoff
within the trials' budget, proven by the fuzz diff and the corpus. The
census, META-ROADMAP's coverage map, ROADMAP §125 and the Cursor say so.
What it taught: a row's evidence that a trigger "is not on record as
fired" was a statement about the record; the trigger was a statement
about the code, and the code was the thing to search.

## Phase 121 — the dials

### The kickoff: the audit, and the cut put to the user (2026-10-14, session f8bbd64e)

Pre-flight at `972a866`, the tree clean. `git diff --stat a45a7af HEAD --
src config tests/fuzz` names one file, `src/run/Run.test.ts`, so the
reach readings under `output/reach/` still describe every source line.
Nothing was built. Each finding below is from a search or a read of the
named lines; no file was read whole.

**A-37, the hook.** `.githooks/pre-commit` runs `npm run fuzz:smoke`
when a staged path matches `src/(sim|run|core|config|bot)/`, `config/` or
`tests/fuzz/`; the smoke is `vitest.fuzz.config.ts`, which includes every
`tests/fuzz/**/*.test.ts`. A Vitest `exclude` cannot be undone by naming
the file on the command line, so taking the test out of the smoke needs
its own entry point (a script, or a config of its own). The test runs
the fuzz command line with `--flip-telemetry=traffic`, a flag A-20
deletes at §125, so §125's deletion re-points this test. Its sibling
`parallelRun.test.ts` (two tests) ended inside the smoke's first 69 s at
120e and stays. The box scripts are `box-launch.sh`, `box-drive.sh`,
`box-batch.sh` and `box-setup.sh`; which one a pre-launch check belongs
in was not read.

**The deletions, by reader** (a word search over `src`, `tools`, `tests`,
`config`, `scripts` and `shell`, corpus and output files left out).

- A-01 `deck.redraw`: 14 lines of `src/run/Run.test.ts`, nothing else.
- A-02 `config/empower.json`: imported by its loader and by
  `configHash.ts`; `EMPOWER` is read by `Run.test.ts` alone (26 uses).
  `BuffSchema`, `normalizeBuff` and `EmpowerConfig` are imported by the
  daemon and packet loaders, `run/daemon.ts` and `run/empower.ts`, so
  `src/config/empower.ts` stays as their module, without the JSON.
- A-03 the two tile rates: `config/tiles.json`, its loader, two lines of
  `statuses.test.ts`.
- A-04 `ignoresTerrain`: the units schema (which is `.strict()`) and five
  lines of `units.test.ts`; no unit sets it.
- A-05 and A-07: `move.cells` is required by the schema and written by
  two abilities and by tests; `tools/attack-editor/editor.ts` writes it
  (line 106) and shows it as a field (line 549). `knockback` and `pull`
  are named by the schema, the interpreter's throw and four test lines.
- A-08 `re-home`: `schema.ts`, `Action.ts`, and the attack editor.
- A-09 `layoutFirst`: `selection.ts` (one function of 19 lines and the
  two-entry `STRATEGIES` record), its loader, `config/selection.json`,
  and tests. With it gone `selectEncounter` calls `encounterFirst`
  directly, and the strategy type and the record go.
- A-10 `focusTileResolution`: `focusTile.ts`, its test, comments in
  `Targeting.ts` and `objective.ts`, and
  `tests/fuzz/objectiveCoverage.test.ts:119-140`, which runs the coverage
  arena once under each resolution; with one left it is one test.
  `vitest.fuzz.config.ts`'s header names that knob as the smoke's one
  module-state mutation, and goes stale with it.
- A-21 `blockCampTurnEnd`: read once (`World.ts:2264`). Tests set it at
  22 lines in three files: `camps.combat.test.ts:197` pins the off
  behaviour and goes; `camps.economy.test.ts:88` sets it off so that its
  fixture's win is not held, and needs a fixture the rule does not hold;
  two more tests there set it on, which becomes the only rule. That
  file's header still says the default is off.
- A-21 `applyStatusOnEnter`: `World.ts:1646`, `bot/sensors.ts:177`, and
  tests in `tileEnterStatus.test.ts` and `sensors.test.ts`. With A-03 it
  is the last key of `config/tiles.json`.
- A-13 `halfCoverDamageMult`: wider than the row. The key is read once
  (`propose.ts:114`), but the number rides to the damage roll as
  `damageMultiplier`, a field of `OpResolution` set by `resolveOp` at six
  call sites (five pass a literal 1) and read at `interpreter.ts:218`.
  With the key gone the field is 1 everywhere, so it goes too, which is
  the row's "the multiply". `collectHalfCoverPositions`
  (`positioning.ts:130`) has `propose.ts` as its one reader in `src` and
  a test reader in `camps.spatial.test.ts`. `OpResolution` is serialized
  in the world snapshot (an in-flight action's resolution, a chain hop's),
  so a snapshot taken mid-strike loses a field that was always 1. What
  `positioning.ts` does with cover was not read.

**B-03, the three one-key files.** `economy.startingBits` is read by
`Run.ts` alone, which loads 19 config files. `spawn.durationSeconds` is
read by `World.ts`, which loads `sim`, and `BattleRenderer.ts`, which
does not. `objective.rangedLeashCells` (its one key after A-10) is read
by `focusTile.ts`, `Targeting.ts` and `World.ts`; the last two load
`sim`. The sweep's `--set` addresses four groups, `difficulty`,
`health`, `leveling` and `sim` (`balanceSweep.ts:70`), so a fold into
`sim` or `difficulty` makes the moved number addressable there. The
"`objective.` on one line" of BALANCE that the row counted is the
`--objective` strategies' line of the instrument registry, not a knob,
so no run-log line goes stale. No fuzz output carries the config stamp
(a search of the reporters, the harness, the manifest and
`perf-oracle.sh`), so a key removed from config leaves the fuzz diff
able to read byte-identical.

**The comment pass.** `src/config` has 34 loaders of 5,785 lines (and 13
co-located tests); `npm run oracle -- comment-codes` counts 658 step codes
in the folder, 95 of them in the tests. The ceiling test asks for
`--record` in the same commit as any fall.

**The cut, as put.** In the session's final message of this turn, with
six calls; the user's answer and the cut as signed follow here.

**Signed** (the user, 2026-10-14): "Signing the cut and all six leans,
Claude! 😁" So: the cut and its reads as put; A-37's test runs in the
hook on any staged `tests/fuzz/` path, in the box launcher, and before a
local `--jobs` batch by a line in `process/measurement.md`; A-13 takes the
`damageMultiplier` field and `collectHalfCoverPositions` with the key,
with no World snapshot bump; B-03's homes are `sim.spawnDurationSeconds`,
`sim.rangedLeashCells` and `difficulty.startingBits`; the comment pass
takes the loaders only, the co-located tests waiting for §126, with a
pilot stop on `health.ts`, `daemons.ts` and `sim.ts`; a re-skim's new
trial runs within the budget with its bar written first, and a new
deletion waits for the pilot's stop. The cut is in ROADMAP §121.

### 121a — A-37: the `--jobs` parity test off the smoke (2026-10-14, session f8bbd64e)

`npm run fuzz:smoke` now passes `--exclude
tests/fuzz/parallelRunDecisions.test.ts`, and `npm run fuzz:jobs-parity`
runs that file alone, with the same config; Vitest's CLI `--exclude` adds
to the config's, so no second config file was needed. The hook runs the
parity script when a `tests/fuzz/` path is staged; `scripts/box-batch.sh
launch` runs it before a batch whose arguments hold `--jobs=`, once per
HEAD, recording the pass under `output/jobs-parity/<HEAD>` (git ignores
`output/`, so the dirty-tree guard still holds); `process/measurement.md`
says to run it before a local `--jobs` batch. AGENTS "Pre-commit",
TESTING's smoke line, the smoke config's header and the Cursor say so.
AGENTS was 37 characters over its cap with the clause, and is under it
by shortening the same paragraph's two other sentences.

Measured on this machine, one at a time:

- the smoke before: 65 files, 624 tests, 185.5 s by the reporter (3 m 10
  s by the clock);
- the smoke after: 64 files, 623 tests, 102.5 s (1 m 46 s), so 83 s off
  every commit that stages a sim, run, core, config or bot path;
- the parity test alone: 1 test, 144.0 s (2 m 28 s), passing.

Shown: `bash -n` on the hook and on `box-batch.sh`; the hook's path test
by its own `grep -qE '^tests/fuzz/'` over five paths (two under
`tests/fuzz/` select it; `src/sim`, `config/` and `tests/integration`
do not); `box-batch.sh`'s `case` over four argument lists (`--jobs=8`
and `--jobs=2` run it; no `--jobs`, and `--jobs-x=3`, do not). Not
shown yet: the hook itself on a staged sim path and on a staged
`tests/fuzz/` path. 121b stages the first and 121e the second, and their
entries record what the hook printed. The hook's "about 3 minutes with
the smoke" (AGENTS) is a prediction from the parts until 121b's commit
times it. `box-batch.sh` was not run against a box.

### 121b-pre — `reach-diff` across a deletion, and the parity test out of the oracle's smoke (2026-10-14, session f8bbd64e)

Found taking 121b's proof. `reach-diff` compares two readings line by
line and refuses any file whose statements differ between them, so it
could not compare across a deletion that touches code: the first run
stopped at `src/config/configHash.ts`. The census names it as the proof
for "a test deleted with the code" in every phase from §121 to §126, and
a file the deletion edits is where a deleted test is likeliest to have
been the only one running a surviving line. Now `reach-diff <before>
<after> --from=<ref>` reads one `git diff -U0 <ref>` and maps each
changed file's lines through it (`lineMap` in `tests/oracle/reach.ts`):
a line inside a hunk's old range counts as deleted, any other line is
compared at its new place, and functions and branch points pair by line
and by their order on it, since the coverage tool numbers anonymous
functions by position. Without the flag a changed file is still refused.
The second reading must be of the working tree: the first mapped run
named 21 lines of `reach.ts` as lost, because that file had been edited
after the reading was taken, and they went once the reading was taken
again. Known answers in `reach.test.ts`: a map over three hunks (a
removal, an insertion, a rewrite), a changed file that loses nothing,
and the planted case, a changed file whose surviving line, function and
branch arm stop running, which it must name by their new lines. TESTING
"A deleted test" says how.

The same pass found two more places that ran the smoke by its config
and so still ran the parity test 121a took out of it: the plant tool's
`smoke` proof and `reach`'s `smoke` proof, whose label is "every test of
npm run fuzz:smoke". Both now pass the same `--exclude`, named once as
`JOBS_PARITY` in `reach.ts`, and a test holds `package.json`'s two
scripts and the `smoke` proof to that name. No other runner of
`vitest.fuzz.config.ts` was found (a search of `tests`, `scripts`,
`shell` and `tools`).

### 121b — the config keys nothing reads (2026-10-14, session f8bbd64e)

A-01, A-02, A-03 and A-04's `ignoresTerrain`, as signed. Inside the
rows' intent, two more went:

- `RedrawConfig` (`src/run/redraw.ts`), the "type anchor" `deck.ts`'s
  header said the redraw block was kept for: exported and imported by
  nothing.
- `EmpowerConfig`'s `enabled` and `empowersPerTurn`. With `EMPOWER` gone
  the interface is read only as `EmpowerConfig['buff']` (nine places),
  so it keeps that one member. A `Buff` type in its place is a lead for
  121h, not done here.

`src/config/empower.ts` stays as the buff vocabulary the daemon and
packet loaders share, its header rewritten to say so; `deck.ts`'s,
`tiles.ts`'s and `daemons.ts`'s headers lost the sentences about what
went. `Run.test.ts`'s fixture daemon took its numbers from the deleted
config; they are its own literals now (`K_REDRAW`, `K_EMPOWER`), 36
reads replaced. The 27c pair in `statuses.test.ts`, which held a status's
rate against the tile's copy of it, is deleted. ARCHITECTURE's tree and
META-ROADMAP's flight seam say so. Config files 34 → 33.

Proof (config):

- `npm run oracle -- config-dump` before and after, `json-diff`: 77
  differences, every one a removal of a signed path (`ignoresTerrain` on
  23 units in `UNIT_DEFS`, `ALL_UNIT_DEFS` and `UNITS_PROSE`; `DECK.redraw`;
  `EMPOWER`; `TILES_CONFIG.fire` and `.healing`; and the same three in
  `CONFIG_SOURCES`);
- `npm run corpus`: 0 of 30 journals differ;
- typecheck clean; the suite 3,763 (3,765 less the two deleted), its one
  failure the step-code ceiling, lowered by `--record` (6,376 → 6,354:
  six files, codes in the deleted comments);
- `reach-diff --from=f5a0b68` (121b-pre) on the suite's readings: nothing
  lost across the 20 changed files.

The hook on a staged config path (the first commit of 121b-pre, which
swept in the staged deletion of `config/empower.json` and was redone
without it): the smoke ran, 64 files and 623 tests, and the parity test
did not. That is 121a's first live check.

### 121c — the values never built (2026-10-14, session f8bbd64e)

A-05 with A-07, and A-08, as signed. The `move` op is `{ kind, mode }`
with `mode` `advance` or `retreat`; `knockback`, `pull` and `cells` are
out of the schema, the interpreter's throw, the proposer's throw and the
two abilities in `config/abilities.json`. With two modes left, the
proposer's move arm returns the dash's landing as its last line, where it
threw before. `re-home` is out of `OrphanPolicy` and the schema's list.
Comments that described the reserved modes as declared went with them
(`schema.ts`'s header, `interpreter.ts`'s, `reposition.ts`'s, the
attack editor's); the ones that name a knockback as a future breach
source for the shove primitive describe the plan, not the schema, and
stay for §122's comment pass. ARCHITECTURE's event notes and DESIGN's
timing paragraph list three orphan policies. META-ROADMAP's "Forced
movement and a teleport" already said the fields were deleted.

The attack editor (`tools/attack-editor/`) lost its Cells field, its
`re-home` option, and `cells` from its JSON writer and its outline line
("move advance 2 cells" is now "move advance"). The type check found the
writer and the outline; its two `as const` lists (`ORPHAN_POLICIES`,
the move hint) are not tied to the schema's types, so those were found by
a search for the words. Nothing headless runs the editor; it was not
opened.

Tests: the interpreter's test of the two reserved throws and the
schema's test that `cells` must be positive are deleted; the schema's
"accepts the reserved move modes + applyStatus" keeps its `applyStatus`
half under a new title; ten move literals in five test files lost
`cells`.

Proof (sim):

- `npm run corpus`: 0 of 30 journals differ;
- `bash scripts/perf-oracle.sh` (baseline `6a84677`): PASS, every
  compared CSV byte-identical on both shapes, 56 s;
- typecheck clean; the suite 3,765 (3,767 less the two deleted); the
  step-code ceiling lowered, 6,354 → 6,349 (four files);
- `reach-diff --from=6a84677`: nothing lost across 15 changed files.
- a plant at the site (`npm run oracle -- plant`), on `6a84677`'s copy of
  the move executor, which 121c leaves as it was: the only edit the tool
  admits there, the gambit's `dest === null` negated
  (`interpreter.ts:261`). Corpus CAUGHT, fuzz diff CAUGHT, each by a run
  that threw, since the negation hands `null` on to the step. So both
  proofs run the retreat; whether either notices a quieter change there
  is not shown. The dash's lines admit no edit.

The hook's smoke on this commit and the next stays as 121a set it.

### 121d — A-09, `layoutFirst` (2026-10-14, session f8bbd64e)

As signed: `layoutFirst`, the strategy record and type, `getSelectionStrategy`,
the key, `src/config/selection.ts` with its test, and
`config/selection.json` (config files 33 → 32). `encounterFirst` is a plain
function `selectEncounter` calls; the forced-encounter path is untouched.
The tests that fetched `encounterFirst` through `getSelectionStrategy` call
`selectEncounter`, which is that function when no encounter is forced;
`layoutFirst`'s four tests and the loader's two are deleted. The headers of
`selection.ts` and its coverage guard lost their sentences about two
strategies; ARCHITECTURE's tree lost the loader and the file.

Proof (sim and config):

- config dump at `de59045` (taken in the worktree) and after: 3
  differences, all removals (`SELECTION`, `SELECTION_STRATEGIES`,
  `CONFIG_SOURCES.selection.json`);
- `npm run corpus`: 0 of 30 differ;
- the fuzz diff (baseline `de59045`): PASS on both shapes;
- the suite 3,759 (3,765 less the six deleted), the ceiling lowered 6,349
  → 6,344 (three files);
- `reach-diff --from=de59045`: the one loss named is the deleted loader's
  own function ("the file is not in the second reading"), since a file the
  diff deletes is not mapped. Nothing else lost. Fixed for the next steps
  in 121d-post.
- a plant: the only edit the tool admits on the draw itself is the default
  weight 1 → 2, which no draw can see (no sector entry sets a weight), so
  the plant went one call down, in `rollLayoutFor`, which the draw calls:
  the procedural-board check negated (`selection.ts:119` at `de59045`).
  Corpus CAUGHT and fuzz diff CAUGHT, each by a run that threw, as at 121c.

### 121d-post — `reach-diff` counts a file the diff deleted as deleted (2026-10-14, session f8bbd64e)

A deleted file's diff names it only on its old side (`--- a/…`, with `+++
/dev/null`), so `--from` did not map it, and `lost` named it "not in the
second reading". Now the map takes the old side's name when there is no
new one, and `lost` counts a mapped file the second reading lacks as
deleted. Known answer in `reach.test.ts`: the same absent file is nothing
lost when mapped and a loss when not.

### 121e — A-10 and A-21's two switches (2026-10-14, session f8bbd64e)

Two commits, one a row.

**A-10, the focus-tile resolutions.** `disallow`, `clearOnArrival`, the
key, `FOCUS_TILE_RESOLUTIONS` and the keyed resolver are gone;
`config/objective.json` holds `rangedLeashCells` alone. `focusTile.ts` is
the one directive, `pursue` beyond the leash and `engageLocal` within it,
and takes no `world` now. Two more went inside the row's intent, both dead
once only `leashAtNearest` is left:

- `focusTileResolvedByArrival`, which `leashAtNearest` answered `false`
  for every call, and with it the branch of
  `World.clearResolvedObjectives` that reverted a resolved focus tile. That
  branch also kept a focus tile out of the next one, the camp-anchor
  revert, which does not test the order's mode. So the next branch's
  condition is now `obj.mode === 'engage' && this.camps.size > 0`: a focus
  tile still persists, and an engage tile still reaches the camp check.
- the `atWill` directive, which only `disallow` returned, and its arm in
  `Targeting.updateFocusTarget`'s switch.

`updateTargetDefault` in `Targeting.ts` now has one caller; whether to
inline it is a lead for §122, not done here. The tests: `focusTile.test.ts`
keeps its two leash tests, calling the directive; the tests of `disallow`
(2), `clearOnArrival` (5), the leash's `resolvedByArrival` (1) and the
config wiring (1) are deleted. In the smoke tier,
`objectiveCoverage.test.ts` ran the coverage arena once under each
resolution by setting the live key; it is one test now, with the same two
seeds. The smoke config's header named that key as the fuzz suite's one
module-state mutation; it now states the contract alone, since the rest of
that audit was not re-checked. Comments in `objective.ts` (config and
sim), `Targeting.ts`, `World.ts` and `objectiveCoverage.ts`, and
ARCHITECTURE's line for `focusTile.ts`, say so.

Proof (sim and config):

- config dump at `422be14` and after: 3 differences, all removals
  (`OBJECTIVE.focusTileResolution`, its copy in `CONFIG_SOURCES`,
  `FOCUS_TILE_RESOLUTIONS`);
- typecheck clean; the ceiling lowered 6,344 → 6,336 (four files);
- `npm run corpus`: 0 of 30 differ; the fuzz diff (baseline `422be14`):
  PASS on both shapes; `reach-diff --from=422be14`: nothing lost across
  13 changed files (the suite passed under coverage, 96 s);
- a plant at the surviving leash comparison (`focusTile.ts:85` at
  `422be14`, negated): corpus CAUGHT by behaviour, 13 of 30 journals
  differ; the fuzz diff did not notice, since the bot's fuzz runs never
  give a tile-focus order. For a focus tile the corpus is the proof that
  reaches it, through the chaos driver's random orders;
- a plant at the branch the rewrite had to keep in order (`World.ts:2178`
  at `422be14`, `obj.mode === 'focus'` negated, which sends a focus tile
  into the camp-anchor check and an engage tile past it): corpus not
  caught (0 of 30), suite not caught (no file of 260 fails). No proof
  held that order. So a pin was added, `camps.economy.test.ts`, "a tile
  order parked on a camp anchor, once the camp is cleared": an engage
  tile there reverts and a focus tile persists. It passes on the new
  code; whether it catches the same plant on the new code is the first
  thing A-21's entry records. The camp-anchor branch itself is a lead for
  §122: its one producer, the enemy pull's tile order, was retired at
  §75j2 (the pull now orders an engage on a member), so only a player's
  manual engage on an anchor cell reaches it.
- `World.test.ts`'s "a focus tile objective persists" lost "under the
  shipped default (leashAtNearest …)" from its title.

The suite: 3,753 (3,760 less nine deleted, plus the pin's two); the smoke, 621 (its three resolutions are one test).

The pin, checked on the commit (`fd7d0c1`): the same negation planted on
the new condition (`World.ts:2175`, `obj.mode === 'engage' &&
this.camps.size > 0` negated). Suite CAUGHT, in
`camps.economy.test.ts`; corpus not caught. The hook on that commit, with
`tests/fuzz/` staged, ran the smoke (621) and then the parity test (1):
121a's second live check.

**A-21, the two switches.** `sim.blockCampTurnEnd` and
`tiles.applyStatusOnEnter` are gone and the shipped behaviour of each is
the code: `World.checkBattleEnd` holds a decisive end while the winner has
an uncleared hostile camp, and a step onto mud poisons, in
`World.applyTileEnterEffects` and in the bot's `isHazardKind`. With A-03,
`config/tiles.json` held only the second, so it and `src/config/tiles.ts`
are deleted (config files 32 → 31). The hold's rationale, the user's 75j
verdict, moved from the config docstring to the check in `World.ts`;
DESIGN's win condition, GOTCHAS #123's wording (a fix-up of what it
names, not of the gotcha), ARCHITECTURE's tree and `World` line, and the
comments in `TileGrid.ts`, `sensors.ts` and the camp tests say so.
`statuses.test.ts`'s header still described the tile-rate test 121b
deleted; fixed here.

Tests: `camps.combat.test.ts`'s pin of the off behaviour ("camps never
extend a battle") is deleted. `camps.economy.test.ts`'s "an un-wiped camp
contributes nothing" set the switch off so that its win was not held; it
now lets the hold happen, asserts that it does, and ends the battle by the
turn cap (`resolveAsDraw`), whose payload carries `campKills` by the same
rule, so the test still shows an un-wiped camp adds nothing. Its two tests
of the hold lost their set-and-restore. `tileEnterStatus.test.ts` and
`sensors.test.ts` expect mud to poison outright.

Proof (sim and config):

- config dump at `fd7d0c1` and after: 4 differences, all removals
  (`SIM.blockCampTurnEnd`, `TILES_CONFIG`, and their copies in
  `CONFIG_SOURCES`);
- typecheck clean; the ceiling lowered 6,336 → 6,325 (five files);
- `npm run corpus`: 0 of 30 differ; the fuzz diff (baseline `fd7d0c1`):
  PASS on both shapes; `reach-diff --from=fd7d0c1`: nothing lost across
  19 changed files;
- two plants on `fd7d0c1`'s copies of the gates, each negated whole: the
  hold (`World.ts:2255`), corpus CAUGHT by behaviour (30 of 30 differ) and
  fuzz diff CAUGHT by behaviour; mud's poison (`World.ts:1645`), both
  CAUGHT by a run that threw.

The suite: 3,752 (3,753 less the off pin).

### 121f — A-13, half cover's multiplier (2026-10-14, session f8bbd64e)

As signed, and as the kickoff's third call widened it: the key
`leveling.halfCoverDamageMult`, the per-strike walk in
`proposeSingleTargetStrike` that gathered the half covers and tested the
line through them, and the `damageMultiplier` field the number rode to
the damage roll on (`OpResolution`, `resolveOp`'s context and its six
callers, five of which passed a literal 1, and the interpreter's
multiply). `collectHalfCoverPositions` had the walk as its one reader in
`src`, so it went too, with `camps.spatial.test.ts`'s test that a camp
member never counts as half cover. The 148 pieces stand where they were:
they still occupy their cells, and `collectLosBlockers` still leaves them
out, so shots pass through them, now at full damage, as before at a
multiplier of 1. `x × 1` is exact in floating point, so the damage roll
is the same number.

The World snapshot: an action in flight carries its ops' resolutions, so
a battle snapshotted mid-strike no longer writes `damageMultiplier: 1`
(`EffectAction.test.ts`'s two round-trip literals lost it). No version
bump, as signed: nothing stores a battle across builds, and a reader of
an older snapshot that holds the field ignores it.

Tests: `propose.test.ts`'s two multiplier tests are one, "fires through
half-cover"; `interpreter.test.ts`'s crit-then-multiply test is
crit-then-round; `AbilityBehavior.test.ts`'s half-cover strike expects
full damage. ARCHITECTURE's two lines for `leveling` lost "half-cover
mult"; the loader's header lost its paragraph; `positioning.ts`'s and
`Targeting.ts`'s comments lost the function's name.

Proof (sim and config):

- config dump at `def07ff` and after: 2 differences, both removals
  (`LEVELING.halfCoverDamageMult` and its copy in `CONFIG_SOURCES`);
- typecheck clean; the ceiling lowered 6,325 → 6,320 (three files);
- `npm run corpus`: 0 of 30 differ, so no journal's end state moved with
  the snapshot's field (no field diff was needed); the fuzz diff
  (baseline `def07ff`): PASS on both shapes; `reach-diff --from=def07ff`:
  nothing lost across 15 changed files;
- a plant on `def07ff`'s damage roll (`interpreter.ts:216`, the crit
  negated): corpus CAUGHT (30 of 30 differ) and fuzz diff CAUGHT, both by
  behaviour.

Not measured: what the walk cost per strike. It gathered every unit for
the half covers and walked a Bresenham line over them on each proposed
single-target strike; its removal is a saving the fuzz diff's timing
does not compare.

### The hand-off after 121f (2026-10-14, session f8bbd64e)

121a to 121f are committed; 121g, B-03's trial, starts in a fresh
session from the Cursor. The worktree the before-readings ran in
(`output/wt-before`) is removed, its junction first. Readings by the
tool's clock: 134,404 at 13:49 (the kickoff's start); 188,752 at 13:57
on the audit's commit `a0fdbc7`; 259,713 at 14:27 on 121a (`f5a0b68`);
346,378 at 14:52 on 121b (`6a84677`); 384,390 at 15:04 on 121c
(`de59045`); 416,544 at 15:22 on 121d (`1ba3a1b`); 459,975 at 15:43 on
A-10 (`fd7d0c1`); 490,175 at 15:58 on A-21 (`def07ff`); 527,094 at 16:10
on 121f (`91b9401`); 530,791 at 16:11 at the hand-off. The steps cost
from about 30k (121d) to about 85k (121b with its tool work).

### 121g — B-03, the three one-key files folded (2026-10-14, session 07d94d5c)

**The bar,** as the kickoff put it in its final message and the user
signed with the cut. The kickoff's entry did not copy it, so it is copied
here from that session's transcript: "the config dump is identical after
mapping the three moved paths, the corpus digests and the fuzz diff don't
move, source lines don't grow, no new parameter, and three files are
gone."

Step zero at `a2572f6`: the three files and their readers as the kickoff
listed them, plus three tests that read the lockout's ticks
(`camps.test.ts`, `CampWanderBehavior.test.ts`,
`spawn-overflow.test.ts`), the leash test, the run-config tool's help
line, and `refs.test.ts`, whose known answer was
`EconomySchema.startingBits`.

What moved: `economy.startingBits` to `difficulty.startingBits`, which
`Run` reads as `DIFFICULTY.startingBits`; `spawn.durationSeconds` to
`sim.spawnDurationSeconds`, with `SIM.spawnDurationSeconds` for the
renderer's fade and `SIM.spawnDurationTicks` for World's three lockouts,
the two forms `SPAWN` held; `objective.rangedLeashCells` to
`sim.rangedLeashCells`. The three JSON files, their loaders and their
entries in the stamp's registry are deleted (config files 31 → 28). The
loaders' docstrings moved into `sim.ts`'s key list and `difficulty.ts`'s
knob list without their step history. `refs.test.ts` asks its question of
`DifficultySchema.startingBits` and still tells it from
`RunConfig.startingBits`. ARCHITECTURE's tree says so. Each moved key is
now addressable by `--set`, since `sim` and `difficulty` are sweep
groups; none was before.

Against the bar:

1. *Behaviour.* The config dump at `a2572f6` (in a worktree) and after:
   13 differences, all of them the moved paths. With the declared mapping
   applied to the before dump (a scratch script: four parsed paths, three
   raw ones, and a check that each deleted object held nothing else), no
   difference; the control, the same mapping with `SPAWN.durationTicks`
   left out, names that one path. `npm run corpus`: 0 of 30 differ (the
   journals' config stamp changed, as at 121b, and the replay goes past
   it). The fuzz diff (baseline `a2572f6`): PASS on both shapes.
   `reach-diff --from=a2572f6`: nothing lost across 27 changed files.
   Typecheck clean; the suite 3,750, unchanged, since no test was deleted;
   the step-code ceiling lowered 6,320 → 6,310 (the three loaders).
2. *Lines.* The diff adds 65 and removes 146. Source lines (`src`,
   `config`, `tests`, `tools`) fall by 76: `src` 67, `config` 6, `tests`
   3, `tools` 0; ARCHITECTURE by 5.
3. *No new parameter.*
4. *Three files gone,* with their loaders and three names in the stamp's
   registry.

Kept.

The controls. The plant tool admits no edit at the lockout's three sites,
so each moved value was changed in turn in a worktree of `a2572f6` with
the fold applied, whose corpus read 0 of 30 first, and restored from a
saved copy:

| Value changed | Corpus | Fuzz diff |
|---|---|---|
| `spawnDurationSeconds` 0.5 → 0.55 | 24 of 30 differ | FAIL, both shapes |
| `rangedLeashCells` 3 → 2 | 15 of 30 differ | FAIL, the arm shape only |
| `startingBits` 0 → 5 | 26 of 30 differ | FAIL, both shapes' summary |

So both proofs read each moved key. 121e's leash plant, at the tile
focus's comparison, went past the fuzz diff; this one reaches it through
`Targeting`'s engage radius, on the arm shape.

**A call for the user, not built.** `SIM` holds the lockout twice, as
`SPAWN` did: seconds for the renderer, ticks for the sim. Now that `sim`
is a sweep group, `--set sim.spawnDurationSeconds=…` is accepted and moves
only the renderer's fade, so a headless sweep of it would silently change
nothing; before the fold the same knob was refused, as there was no
`spawn` group. The alternative is for `SIM` to hold only
`spawnDurationTicks`, as it does for `rangedRetargetLosTicks`, and for the
renderer to fade over `ticksToSeconds(SIM.spawnDurationTicks)`. That is
0.5 exactly at the shipped value (`10 * (1/20) === 0.5` in node), and it
ties the fade to the lockout by construction. The dump would then lose
`SPAWN.durationSeconds` with no parsed counterpart, which is outside the
bar's first clause as written, so it waits for the user.

Also found: `plant --list` read the working tree's copy of the file while
a plant edits the ref's, so with the tree ahead of the ref it listed
another line's edits (121g-post).

### 121g-post — `plant --list` lists the ref's line (2026-10-14, session 07d94d5c)

`--list` now reads `git show <ref>:<file>`, the copy a plant edits, and
names the ref in its line. The known answer, run with the fold's edits in
the working tree and `--ref=a2572f6`: before the fix, `focusTile.ts:28`
listed a negation of `SIM.rangedLeashCells` (the working tree's line) and
`Targeting.ts:705` two edits of the line below it, since the tree had lost
an import line; after, the first lists `OBJECTIVE.rangedLeashCells` and
the second admits 0 edits, as `a2572f6`'s lines do. The plant itself
always read the ref's copy and prints the edit it made, so a plant's own
output names what it planted; whether an earlier record quoted a listing
instead was not checked.
