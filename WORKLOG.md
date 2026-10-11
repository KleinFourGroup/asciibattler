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

Readings: **219,036** at 18:25 before this entry's commit.
