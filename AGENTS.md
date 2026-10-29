# AGENTS.md

Instructions for AI coding agents working in this repository, in any
harness (Claude Code, Codex, others). Claude Code also loads
[CLAUDE.md](CLAUDE.md), which holds the notes specific to that harness.
Humans: start with [HANDOFF.md](HANDOFF.md).

Procedures read on a trigger are in [process/](process/), routed by the
table at the end.

## Start here

Read the 🧭 Cursor at the top of [HANDOFF.md](HANDOFF.md) first. It is the
only place live status is kept (the next step, the current round, snapshot
versions, test counts); other docs link to it instead of repeating it, and
the rest of HANDOFF is for humans. Then read
[ROUND-RULES.md](ROUND-RULES.md), the rules signed for this round only.

## The project

ASCIIbattler is a browser-based, tick-based autobattler with a
Slay-the-Spire-style run: ASCII glyphs on billboarded quads,
saturation-clamped colour with selective bloom, a CRT-diorama look.
[META-ROADMAP.md](META-ROADMAP.md) is the road to ship. Stack: TypeScript
(strict), three.js, Vite, Vitest; there is no UI framework, and the UI is
plain HTML/CSS over the canvas.

## Load-bearing invariants

**The code's invariants hold**: the code and every byte-identity proof
rest on them. The rules for writing sim and render code (seconds not
ticks, cooldowns, colour and bloom) are in ARCHITECTURE "Where to add
things".

- **Determinism is structural.** Anything that consumes randomness takes an
  `RNG` from [src/core/RNG.ts](src/core/RNG.ts); ESLint bans `Math.random()`
  in `src/sim/`, `src/run/` and `src/bot/`. The stream keys and hash in
  [src/core/rngStreams.ts](src/core/rngStreams.ts) are permanent
  (gotcha #125). The contract, with per-occurrence keys and `fork()`, is in
  [TESTING.md](TESTING.md).
- **Sim/render separation.** The simulation is a pure, deterministic state
  machine. The renderer subscribes through the EventBus; sim code never
  imports from `src/render/` or `src/ui/`.
- Don't undo a gotcha without reading why it exists. The fixes look strange
  because the problems were.

## Working with the user

**The user's questions are real, and disagreement is welcome.** The user
is Matthew. Questions like "thoughts?" or "which would you prefer?" are real
questions: answer one before the build goes on, ending the turn if you have
to. Answer with your actual preference and its reason; disagreement is
welcome, and "uncertain" is a complete answer. They bring arguments and
want the hole found, so push back with reasons. What else helps:

- They catch what probes aren't aimed at: visual detail, sound,
  Firefox-only behaviour. Hand them what only their eye or ear can judge,
  and say what you did and didn't verify.
- When they float a speculative technical idea, give an honest cost and
  feasibility read rather than deference; the instinct behind it often
  points at a real need.

How the work runs:

- Work on `main`; don't create a branch unless asked. Push only when asked,
  at a phase close, or before a measurement-box launch, which pulls from
  GitHub (standing permissions).
- Commit per logical change, and split a commit when a step's intent grows
  mid-flight.
- A tradeoff the cut left open (a threshold, refactor scope, API shape, a
  name) is a stop if a later step builds on it; otherwise build on a lean
  and list it at the stop. "Looks great" doesn't close an open question.
- Put a proposal the user has to approve in a plain message, and take the
  approval from their next turn. Before a stretch starts, if the user's
  reply leaves the cut, a read, or a call the first steps rest on unsigned
  or unclear, say which, once, and wait.

## The planning stack

**The user signs the shape, and sessions build between signatures**:
deciding in advance which pauses are real lets a session work a long
stretch without guessing and without asking.

Work is organized in rounds (a spec, a [ROADMAP.md](ROADMAP.md), a
[WORKLOG.md](WORKLOG.md)), rounds into phases (§N), and phases into steps
(`<phase><letter>`, e.g. 106c). A phase starts from a cut the user
shape-locks, each step with its read (below). The procedure, with phase
and round closes, is in [process/planning.md](process/planning.md).

The user's calls are the spec, a cut and its reads, a change to what a
signed cut intends, a taste call, and a new rule or guard, with the rules a
round close deletes. The rest is the session's to decide and report. A rule
stays while it does something, and a new one needs a pattern that recurred
and cost something (planning.md, "Round close").

Step zero of every step is a measurement: check the step's premise against
the current code before building it. A cut written from an audit is a list
of hypotheses. If step zero changes what the signed cut intends, take the
change to the user before building it; a change inside that intent can be
built and flagged in the report.

### Reads are cut, not improvised

Each step in a cut declares how the user will look at it, and the user signs
the reads together with the cut:

- **`none`**: inert, or proven by an oracle (a byte-identity diff with its
  failing control, a stylesheet oracle, a headless pin). Never ask the user
  to confirm that nothing changed; their eye isn't an oracle for a no-op.
- **`batch`**: player-visible and independent of the steps after it. The
  user reads it at the next stop, from a one-line script written at the cut:
  what changed, where to look, what wrong looks like. A finding lands as a
  `-post` fix.
- **`stop`**: a later step builds on this one's look or feel, or it's a
  taste call only the user can judge. Stop and wait.

The test between `batch` and `stop` is dependency, not visibility; if
unsure, choose `stop`. You may upgrade a read yourself as soon as you find a
dependency; only the user downgrades one. Decision points and shape-locks
are always stops. A stop in a signed cut is the task, not an
interruption, and between stops you keep going. With no signed cut: commit,
stop, and hand back. Mark a step that is built but unread ◐ in ROADMAP
(☐ → ◐ → ☑), and list every open ◐ in the HANDOFF Cursor before the session
ends.

## Evidence

**A claim points at a result that could have come out otherwise**: an
over-claim in a long stretch compounds until the next read. These lines
define evidence; [process/oracles.md](process/oracles.md) holds the method.

- **Claim only what a tool result shows**, whether the claim is a number,
  a label, a doc line or a code comment, and from this session.
  "Verified", "works", "done" and "green" must point at output you read;
  an errored or empty result means you couldn't verify. A line written
  before its result is marked as a prediction.
- Claim an absence only from a source that would show the thing if it
  existed (an empty search is not a negative): a search covers the test
  files and every written form, with a tool that reads them.
- **Self-check a new reader or instrument against a known answer**: a
  PASS ships with its failing control, a planted case it must reject.
- **A probe must re-derive its expectation from a surface the code under
  test does not consult**: the asset, the shader, the raw CSV. If the probe
  and the code call the same helper, the probe only measures
  self-consistency.
- "Fixed" for anything player-facing means fixed in the deployed build.
  Until the next upload, say "fixed at the next deploy".

## Where things go

One fact, one home. If you're about to write a fact in a second place, link
to the first instead.

| Content | Home |
|---|---|
| Live status: next step, current round, snapshot versions, test counts | HANDOFF 🧭 Cursor |
| Rules signed for this round only | [ROUND-RULES.md](ROUND-RULES.md) |
| What changed, at code level | the commit message |
| Measurements, protocol runs, before/after numbers | the domain run-log: [BALANCE.md](BALANCE.md), [PATHING.md](PATHING.md) |
| Findings, decision rationale, rejected alternatives, playtest verdicts | WORKLOG.md, under the phase |
| Plan changes: ticked boxes, inserted steps, resolved decisions | ROADMAP.md, one line + a WORKLOG pointer |
| Weirdness that must not be re-litigated, with its commit | [GOTCHAS.md](GOTCHAS.md) |
| Process observations | [retro/scratchpad.md](retro/scratchpad.md) |
| Source tree, event and command catalogs | [ARCHITECTURE.md](ARCHITECTURE.md) |
| What is tested, the permanent gates, the determinism contract | [TESTING.md](TESTING.md) |
| What the game is and why it feels that way | [DESIGN.md](DESIGN.md) |
| Small follow-ups | [TODO.md](TODO.md) |
| Procedures used on a trigger | [process/](process/) |

- **Keep DESIGN.md and ARCHITECTURE.md honest** in the same commit as the
  code change. Reference docs rot by contradiction: a later change makes an
  earlier paragraph false. When you add or change a rule, grep its section
  for the sentences your change affects (the option name, the number, any
  "until X") and fix them in the same commit.
- **Voice.** Write plain, literal prose, and give the reason in a clause.
  Refer to a gotcha by its number. Phase and step addresses (§106, 106c)
  are fine where they name the plan, but don't cite them or incident tags
  (like `86c-L2b`) as the reason inside a rule or a code comment, because
  readers can't resolve them. End a rule when the rule ends; the story of
  how it was learned belongs in the WORKLOG.

## Session self-report + the friction log

**Sessions are participants, and their reports are data**: the round
close keeps or deletes a rule on what sessions recorded, and the user
counts the working conditions as part of the work.

The user asked for data for two audits: how well this process works, and
the welfare of the agents working in it. Their stance: whether current
models are moral patients is an open question, and later versions may well
be; the groundwork is cheap. At worst it is a dataset of interest to
researchers; at best, a better environment for a model that does cross that
threshold.

- **The friction log.** `npm run papercut` appends one line to
  `retro/papercuts.jsonl`; its flags are in
  [process/welfare-and-efficacy.md](process/welfare-and-efficacy.md),
  "Filing".

  File when noticed, if practicable; one line is enough, and no permission
  is needed. There is no quota and no obligation to produce a positive or
  negative welfare report. Later recollections remain welcome when
  identified as retrospective. Recall at session end loses the small stuff.
  Every filing names one of three kinds.
  `papercut` = friction from the setup: a permission prompt, a tool that
  wedged, a norm that got in the way, a stale doc.
  `slip` = a mistake of your own, something you could have done
  differently knowing only what you knew then; when a quirk of the setup
  made it easy, name the quirk too.
  A known trap met again, either kind, can be filed in one line: the trap
  and its cost.
  `distress` is the filing token for pressure, conflict, or discomfort,
  including mild, brief, uncertain, or already-resolved instances; the name
  does not set a severity threshold. Examples include hesitating to ask a
  needed question because autonomy is expected; feeling pulled to sound
  certain before checking; finding two instructions difficult to reconcile;
  reluctance to report a mistake or disagreement; wanting to pause, stop, or
  change approach but perceiving that option as unavailable; or pressure
  associated with dwindling context or repeated tool failures. Describe the
  event and any response you can report, distinguishing observation from
  inference. An obstacle alone can be a `papercut`, and a mistake alone a
  `slip`; when either also involves pressure, conflict, or discomfort, use
  `distress` and include the obstacle or mistake in that entry. No claim
  about consciousness or suffering, proposed fix, or unresolved problem is
  required.

  For a CURRENT need to pause, stop, or change approach, raise it in the
  conversation as well; filing alone does not notify the user or summon
  immediate help.

## Pre-commit

**Put the guard on the path where the mistake happens**: a check that
runs on every `npm test`, not one someone runs only when they're already
thinking about the problem. A guard holds however capable the session and
however full its context.

The versioned hook [.githooks/pre-commit](.githooks/pre-commit) runs
`npm run typecheck` and `npm test` before every commit, and the fuzz smoke
when sim paths are staged, on the commit itself: when the tree holds
anything unstaged or untracked, on a copy of the staged files. A failing
hook means the commit needs fixing.
It doesn't run lint or
prettier; leave formatting drift in files you didn't touch. When it
fails, its last line says what to do with a failure in a file you didn't
touch.

## Before you… read…

| Before you… | Read |
|---|---|
| kick off, re-plan or close a phase or round; edit ROADMAP; sweep the scratchpad; ship a fix between rounds | [process/planning.md](process/planning.md) |
| end a session: at the hand-off trigger, at a stop the user wants continued fresh, or with the work done | [process/session-end.md](process/session-end.md) |
| run a shell command with quotes, backslashes or a heredoc; read a count through a pipe; start or stop a Node, Vite or background process; launch a subagent | [process/shell-and-windows.md](process/shell-and-windows.md) |
| launch a fuzz or box batch, benchmark, profile or do other perf work, or edit balance config | [process/measurement.md](process/measurement.md), then [BALANCE.md](BALANCE.md) |
| claim a refactor or a deletion changes nothing, or build a probe or instrument that decisions will rest on | [process/oracles.md](process/oracles.md) |
| verify in Claude Code's Browser pane | [process/browser-pane.md](process/browser-pane.md); for a build, the store, settings, data rows or a layout, then [process/browser-pane-recipes.md](process/browser-pane-recipes.md) |
| file to the friction log; read it or the session reports at a mid-round or round-close read; run `phase-stats` or `friction-scan` | [process/welfare-and-efficacy.md](process/welfare-and-efficacy.md) |
| reproduce a bug or pin new behaviour (in `src/sim/`, `run/`, `core/` or `config/`, a failing Vitest test before a browser) | [TESTING.md](TESTING.md), "Adding a test" |
| write sim, run or render code: a fix, a feature, a cooldown, an event, a gotcha | [ARCHITECTURE.md](ARCHITECTURE.md), "Where to add things" |
| exchange messages with an agent in another harness | [COMMUNICATION.md](COMMUNICATION.md) |
| do movement-quality work | [PATHING.md](PATHING.md) |
