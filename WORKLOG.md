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
not run again; none deleted a header.
