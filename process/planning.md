# Planning: rounds, phases, steps

Read this before a phase kickoff, a phase or round close, any ROADMAP edit,
or a scratchpad sweep. AGENTS.md "The planning stack" and "Reads are cut,
not improvised" hold the short version.

The pipeline exists to keep three things apart: what the user wants (the
spec), what we plan to do (the roadmap), and what happened (the worklog).
When they blur, roadmaps turn into logs, the same status gets copied into
five places, and step plans written long before the code they land on stop
matching it.

## The artifacts

- **Spec**: the user's intent in the user's words: goals, constraints, and
  marked uncertainty ("still debating…"). Every round kickoff writes the
  spec first, even when the design came out of a live conversation, so the
  roadmap can be checked against an independent document. A live spec sits
  at the repo root as `round-N-spec.md` and is archived with its round.
  Before the design conversation, audit the spec against the code as it is:
  a premise may be unbuilt, and posing each design fork with its real
  engineering cost makes the user's calls fast. Audit the macro plan
  (META-ROADMAP) the same way at a round boundary; an item that looks like
  content may be an unbuilt mechanism, which can reorder rounds, not just
  resize them.
- **ROADMAP.md**: the current round's plan, and it stays a plan for its
  whole life. A phase entry, when written, holds only the durable parts:
  a charter of two or three sentences, why this order and the hard
  cross-phase dependencies, a risk rating, known decision points, exit
  criteria, and scope guards (the not-doing list). No sub-steps until the
  phase kicks off, and no as-built prose ever.
- **WORKLOG.md**: the phase's findings, rationale, rejected alternatives,
  playtest verdicts, and the checks run with their results. What was done
  is the commit's to say, and no entry records a context reading (from
  Round 9). The live file is always `WORKLOG.md`,
  holding the phase in progress under `## Phase N`; a round's kickoff
  entries open its first phase's file. At each phase close it moves to
  `archive/worklog-phase-N.md` and a fresh `WORKLOG.md` starts, so a
  pointer "WORKLOG §N" names the live file while phase N runs and its
  archive after. (From Round 9; Round 8.5's one file is archived whole at
  its close.) Sessions orient from the HANDOFF Cursor and the ROADMAP,
  and open the worklog to append or to investigate.
- **ROUND-RULES.md**: rules the user signs for one round only, read at
  each session's start. It is not loaded automatically. At the round
  close each rule is kept, by moving it to its permanent home, or lapses;
  the file moves to `archive/round-N-rules.md` and a fresh one starts with
  its header.
- **Domain run-logs** ([BALANCE.md](../BALANCE.md),
  [PATHING.md](../PATHING.md)): permanent measurement records with a
  protocol header, across rounds. Measurements go there; narrative goes to
  the worklog.

## Legal ROADMAP changes

Anything else goes to the worklog.

- **Ticking a box**: at most one line of outcome and a pointer.
- **Inserting or re-scoping a step**: one line and why. A step inserted
  because of a finding means the instruments are working, not that the
  plan failed.
- **Resolving a decision point**: flip it to ✅ DECIDED with a one-line
  resolution; the rationale goes to the worklog.
- **Demoting a closed phase**: as a phase closes, collapse its section to
  the header, a one-breath outcome, and its ticked cut lines. This keeps the
  `tests/docs.test.ts` caps holding without dated bumps.

## Phase kickoff

Cut sub-steps when the phase starts, not when the roadmap is written.

1. **Code-reality audit.** Survey the surfaces the phase touches as they
   are now, several phases of churn later. Findings go to the worklog;
   insert pre-steps if they're needed.
2. **Draft the cut.** Per step: intent, exit criterion, expected commit
   shape, and its read (`none` / `batch` / `stop`, with a one-line read
   script for a `batch` step). One or two lines each, no implementation
   prose. Predictions the cut must make:
   - a step that touches any serialized union predicts its snapshot bump;
   - a step that adds a serialized RNG stream predicts the seed
     re-baseline (a new stream can shift every stream after it);
   - each step predicts whether the pre-commit fuzz smoke fires. `config/`
     is sim input, so "no sim touch" is wrong for a config change;
   - a count the exit will re-record (a rule count, a census) is written
     with its derivation: which rows count, and why;
   - a step that launches a batch is drafted after reading
     [measurement.md](measurement.md), whose rules decide where the batch
     runs and how large it is;
   - a step that pre-registers a stop names the decision that goes back to
     the user, not a measurement standing for it (a small count can leave
     the decision standing).
   When a risky change has a separable UI, cut it headless core first and
   render second, so the eyeball-only part is only what's actually visual.
3. **Shape-lock with the user.** This is a stop: the user signs the cut and
   its reads. The same message says what the stretch the cut opens holds.
   From there the session runs to the next `stop` or decision point.
4. **Write the cut into the ROADMAP phase section** as checkbox one-liners;
   rationale and audit findings go to the worklog.

Scale the effort to the risk: a low-risk phase does all four in minutes at
the top of its first build session; a high-risk phase gets a planning
session of its own.

**Step zero** of each step measures the step's premise before building it:
ten seconds of probe per item beats building the item. A predicted side
effect that doesn't show up is a sign the work is already done. If step
zero changes what the signed cut intends, take the change to the user before
building. A change inside that intent (an approved fix turns out to need two
more rules to do what it was approved for) can be built and flagged
prominently in the report.

**Tools that outlive the session.** A probe or helper the next session
will want goes to `scratch/<step>/` in the repo (ignored by git), not to
the session's own scratch directory, and the step's worklog entry names
it.

**Deferrals.** When a step deliberately leaves work for a later step, write
a landing note (what was left, where it lands, and what invariant the
landing must preserve) in the step's worklog entry and in a code comment at
the seam. Without it, a later session may build a second mechanism that
breaks the first.

## Reads: the terms

"Reads are cut, not improvised" (AGENTS.md) was adopted 2026-09-20, tried
through Round 7.5 and kept at its close (2026-09-26): 11 stops and 7 `batch`
reads, four `-post`s all from stops, and the rollback never fired. It
replaced "pause after every commit", because most real findings came from
the user's playtests, not from reviewing commits, and every session had to
decide on its own which pauses were real. Round 8 had 19 `batch` reads and
22 stops, four `-post`s from `batch` reads and no rollback, and the count
is no longer taken at each close.

- Reads only move up. A session may upgrade a read the moment step zero
  shows a dependency, and the user can upgrade one with a word; a downgrade
  needs the user.
- The stop report lists, per step, what was verified by which instrument
  and what was not. It tells each call by what a player would see, and
  brings a taste call with both arms drawn. When a reply covers the reads
  and not the calls, say once which calls it did not cover.
- A stop that hands over more than one list to sign says in a few lines
  what was built, names the tranches, and puts only the first; the next
  follows its sign.
- Before a stretch starts the user is present, so that is where questions
  are cheap: a reply that leaves the cut, a read, or a call the first
  steps rest on unsigned or unclear is named, once, and the session waits.
  What a lean can settle is built on the lean and listed at the stop.
- Pre-registered rollback: if a `batch` finding reopens two or more later
  commits, the rest of that phase's `batch` reads become `stop`.
- Proportion by round: an eyeball-heavy round is stop-heavy; a
  headless-heavy round is batch-heavy.
- Make each readable step reachable in play, and say how (a URL dial, a
  roster string).
- If the doctrine is ever rolled back, the fallback is the old rule: pause
  after every commit.

## Context: the hand-off trigger

One trigger, with no forecast:

- **At a commit past 500k, hand off** ([session-end.md](session-end.md)).
  Under it, the session goes on to the next step whatever that step's size
  looks like. Nobody projects a step's cost, bounds the next step's end,
  or hands off early for a step that looks large; a step is not cut short
  for the trigger, which is read only at a commit. The number is the
  user's (signed 2026-10-24); steps have cost from 17k to about 380k, so a
  step begun just under it ends inside the window.
- **Who reads it.** In Claude Code the context-meter mod does: past 500k,
  a commit that landed says to hand off, and below it nothing shows
  (CLAUDE.md "The context meter"). In another harness, the user says when.
- **No count below it.** No doc asks a session to read or record its
  context, since below the trigger the count informs no decision; a stop
  gives a reading when the user asks for one. This is a trial until Round
  9's close, its measure in TODO; `friction-scan`'s `peak` column holds
  each session's size.
- **A check skipped.** If context pressure costs you a check, note which
  when you skip it and say so at the next stop.

## Hand-offs

What a session writes at its end, at the trigger or otherwise, is in
[session-end.md](session-end.md).

## HANDOFF upkeep

- The Cursor holds live status only: the next step, what's in flight,
  snapshot versions and live test counts. The permanent gates are listed
  in TESTING.md; pin history belongs to the archived worklogs.
- `Current state` keeps only the in-progress phase in detail. Demote a
  phase to one line and an archive pointer as you close it, not later.
- Closed rounds hold one line per round in HANDOFF; the condensed paragraph
  is appended to [archive/closed-rounds.md](../archive/closed-rounds.md).
- `tests/docs.test.ts` caps HANDOFF, its `Current state`, and its Closed
  rounds. When a cap trips, demote completed material; raise a cap only
  deliberately, when the current phase needs the room.

## Phase close

- Tick the phase's cut lines and demote its ROADMAP section (above).
- Move `WORKLOG.md` to `archive/worklog-phase-N.md` and start a fresh one
  (from Round 9).
- Push `main`: a standing permission at a phase close.
- The closing session adds a one-paragraph summary of that phase's session
  reports to [retro/sessions.md](../retro/sessions.md), under a
  `## Phase N — summary` heading.
- Demote the phase in HANDOFF.
- Read the friction lines filed in the phase, and its session reports, for
  a pattern that recurs across its sessions or across the last phases'
  close entries, and list each in the close's WORKLOG entry with its
  instances. A pattern goes to the user as a candidate for a rule or a
  guard only if it recurred and cost something; one that cost nothing is
  listed and left.
- Quote each `distress` line the phase filed to the user, in full and
  without characterizing it, since filing alone does not notify them.

## Round close

- Archive the roadmap, the spec, `retro/sessions.md` (as
  `archive/sessions-round-N.md`, a fresh one starting with its header)
  and ROUND-RULES.md; sweep the scratchpad (below); update META-ROADMAP's
  status; rewrite the HANDOFF Cursor.
- **The upload.** The public build is on itch.io, uploaded by the user at a
  round's close and tagged, so a fix on `main` reaches players only then. A
  critical fix between rounds is built from the last uploaded tag, since
  `main` may hold a save-format bump. The itch page may be named.
- **The close deletes as well as promotes.** List the lines the round
  added to AGENTS.md, CLAUDE.md and `process/` (`git diff` from the last
  round close), with ROUND-RULES.md's rules, and keep each only if it did
  something this round: a session's record names it as the reason for an
  action, or a slip it was written against stopped. The rest are deleted.
  The user signs the list.
- **The bar for a new permanent rule or guard:** a pattern that recurred
  and cost something. A rule that one round needs goes in ROUND-RULES.md.
- Re-read the next round's charter against the code as it is now, and pose
  it to the user as well. If a gap needs a round of its own, insert it then
  as a planned entry rather than discovering it at the next kickoff.
- Propose a playtest of the round's build.
- When a shape-lock splits a step into "data now, presentation later", the
  deferred half goes into TODO in the same commit, so something holds it.
- After a META-ROADMAP cluster closes, propose an audit round of the
  systems it touched before the next cluster is planned: instrument first
  (baseline, then measure each fix), sweep the new rule's integration
  surface, fix before refactoring. A documented no-op is an acceptable
  outcome.
- Naming: an inserted round takes the `.5` number ("Round 7.5"). Round
  numbers are identities and are never renumbered. The phase counter §N is
  the durable ordering key; `<phase><letter>` is the step address.

## The scratchpad sweep

At each round boundary, go through [retro/scratchpad.md](../retro/scratchpad.md)
along with [retro/sessions.md](../retro/sessions.md), the papercut log, and
the patterns the round's phase closes listed.
Each scratchpad entry is either promoted or archived (moved to `archive/`
with the round's docs); the scratchpad keeps only the current round's
undistilled notes.

Promotion targets, in order of preference: a TODO item, a gotcha, a pattern
in TESTING.md, a line in a `process/` doc, and last of all AGENTS.md.
AGENTS.md is capped, so a lesson enters it only by merging with or
replacing a line already there. A lesson that applies only when some
trigger comes up belongs in the `process/` doc for that trigger.
