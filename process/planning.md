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
- **WORKLOG.md**: the round's narrative: findings, rationale, rejected
  alternatives, playtest verdicts. One file per roadmap, sectioned
  `## Phase N`, created at the round's kickoff and archived with its
  roadmap as a pair (`archive/post-NN-roadmap.md` + `-worklog.md`).
  Sessions orient from the HANDOFF Cursor and the ROADMAP, and open the
  worklog to append or to investigate.
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
     with its derivation: which rows count, and why.
   When a risky change has a separable UI, cut it headless core first and
   render second, so the eyeball-only part is only what's actually visual.
3. **Shape-lock with the user.** This is a stop: the user signs the cut and
   its reads. The same message says what the stretch the cut opens holds,
   with the session's context reading ("Context: the halt and the hand-off
   line", below). From there the session runs to the next `stop` or
   decision point.
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
decide on its own which pauses were real. The `batch` half was thin in an
eyeball-heavy round, so the Round 8 close counts `batch` reads again.

- Reads only move up. A session may upgrade a read the moment step zero
  shows a dependency, and the user can upgrade one with a word; a downgrade
  needs the user.
- The stop report lists, per step, what was verified by which instrument
  and what was not.
- Pre-registered rollback: if a `batch` finding reopens two or more later
  commits, the rest of that phase's `batch` reads become `stop`.
- Proportion by round: an eyeball-heavy round is stop-heavy; a
  headless-heavy round is batch-heavy.
- Make each readable step reachable in play, and say how (a URL dial, a
  roster string).
- If the doctrine is ever rolled back, the fallback is the old rule: pause
  after every commit.

## Context: the halt and the hand-off line

The session reads its own context use where the harness gives it a tool
(Claude Code: CLAUDE.md "The context meter"); otherwise the user reads the
meter. An autonomous stretch is the work between two interruptions: from a
shape-lock or a stop's read to the next `stop`, decision point or phase
end. The reads doctrine exists to make those stretches long, and one can
take a few hundred thousand tokens. Two numbers manage that (both in the
HANDOFF Cursor), and neither is a hard limit.

- **The halt** (600k) is where the user wants the work in a fresh session,
  whatever is in flight. Passing it by a little is not a failure.
- **The hand-off line** (550k) is the halt less one step's cost, so that a
  step started under it ends near the halt. At the start of each step, read
  the context; the reading on the previous step's commit counts. Past the
  line, commit what is done and hand off.
- **At a stop or a shape-lock**, the report gives the session's reading
  and says whether the stretch it opens looks likely to fit under the line.
  The user decides whether the stretch starts here or in a fresh session,
  so most hand-offs fall at a stop rather than in mid-stretch, where the
  next session's orientation costs more.
- **Without the tool**, ask the user for the reading at each stop and
  shape-lock. The user may name a span of wall-clock time; once it has
  passed, pause at the next step boundary and ask again.

Write the readings into the WORKLOG with their times: each step's commit
reading, and the readings at a stretch's start and end. The hand-off line
is provisional: the round close measures what steps cost from those
readings and resets it.

## HANDOFF upkeep

- The Cursor holds live status only: the next step, what's in flight,
  snapshot versions, live test counts, and the permanent gates. Pin history
  belongs to the archived worklogs.
- `Current state` keeps only the in-progress phase in detail. Demote a
  phase to one line and an archive pointer as you close it, not later.
- Closed rounds hold one line per round in HANDOFF; the condensed paragraph
  is appended to [archive/closed-rounds.md](../archive/closed-rounds.md).
- `tests/docs.test.ts` caps HANDOFF, its `Current state`, and its Closed
  rounds. When a cap trips, demote completed material; raise a cap only
  deliberately, when the current phase needs the room.

## Phase close

- Tick the phase's cut lines and demote its ROADMAP section (above).
- The closing session adds a one-paragraph summary of that phase's session
  reports to [retro/sessions.md](../retro/sessions.md), under a
  `## Phase N — summary` heading.
- Demote the phase in HANDOFF.

## Round close

- Archive the roadmap + worklog pair and the spec; sweep the scratchpad
  (below); update META-ROADMAP's status; rewrite the HANDOFF Cursor.
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
along with [retro/sessions.md](../retro/sessions.md) and the papercut log.
Each scratchpad entry is either promoted or archived (moved to `archive/`
with the round's docs); the scratchpad keeps only the current round's
undistilled notes.

Promotion targets, in order of preference: a TODO item, a gotcha, a pattern
in TESTING.md, a line in a `process/` doc, and last of all AGENTS.md.
AGENTS.md is capped, so a lesson enters it only by merging with or
replacing a line already there. A lesson that applies only when some
trigger comes up belongs in the `process/` doc for that trigger.
