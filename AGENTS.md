# AGENTS.md

Instructions for AI coding agents working in this repository, in any
harness (Claude Code, Codex, others). Claude Code also loads
[CLAUDE.md](CLAUDE.md), which holds the notes specific to that harness.
Humans: start with [HANDOFF.md](HANDOFF.md).

## Start here

Read [HANDOFF.md](HANDOFF.md) first. Its 🧭 Cursor is the only place live
status is kept (the next step, the current round, snapshot versions, test
counts, dated riders); other docs link to it instead of repeating it.

Then, as the work needs them:

- [DESIGN.md](DESIGN.md): what the game is and why it feels the way it does.
- [ARCHITECTURE.md](ARCHITECTURE.md): code layout, the event and command
  catalogs, the sim/render seam, the annotated source tree.
- [ROADMAP.md](ROADMAP.md): the current round's plan.
  [WORKLOG.md](WORKLOG.md): that round's findings and decisions.
- [GOTCHAS.md](GOTCHAS.md): fixes that look strange without context
  ("gotcha #N"; numbers are permanent, retired ones stay as tombstones).
- [TESTING.md](TESTING.md): what is tested, what isn't, and the
  determinism contract.
- [TODO.md](TODO.md): small follow-ups outside the roadmap.
- [process/](process/): procedures you read when a trigger comes up (see
  "Before you… read…" below).

## The project

ASCIIbattler is a browser-based, tick-based autobattler with a
Slay-the-Spire-style run: ASCII glyphs on billboarded quads,
saturation-clamped colour with selective bloom, a CRT-diorama look. The MVP
shipped; work continues in post-MVP rounds, and
[META-ROADMAP.md](META-ROADMAP.md) is the road to ship.

Stack: TypeScript (strict), three.js, Vite, Vitest. There is no UI
framework; the UI is plain HTML/CSS over the canvas.

The user deploys by hand: a build is uploaded to a separate GitHub Pages
repo at milestone boundaries. There is no CI, so a fix on `main` reaches
players only at the next upload. The deploy URL is deliberately kept out of
this public repo; ask the user if you need it.

## Load-bearing invariants

- **Determinism is structural.** Anything that consumes randomness takes an
  `RNG` from [src/core/RNG.ts](src/core/RNG.ts); ESLint bans `Math.random()`
  in `src/sim/` and `src/run/`. Streams that cross a seam are keyed per
  occurrence (`deriveRng(root, key, ...ids)`), and the keys and hash in
  [src/core/rngStreams.ts](src/core/rngStreams.ts) are permanent
  (gotcha #125). `fork()` is legal only on a fresh local parent that one
  scope owns. The contract is in [TESTING.md](TESTING.md).
- **Seconds, not ticks.** Author cooldowns and durations in seconds and
  convert with `secondsToTicks` / `ticksToSeconds` from
  [src/config.ts](src/config.ts), so changing `TICK_RATE` (20 Hz) doesn't
  re-tune balance.
- **Sim/render separation.** The simulation is a pure, deterministic state
  machine. The renderer subscribes through the EventBus; sim code never
  imports from `src/render/` or `src/ui/`.
- **Colour.** `COLORS` is the vocabulary code reaches for; nothing
  post-quantizes. Bloom is selective, through two composers
  (gotchas #29, #30).
- **Cooldowns decrement, then check.** Each tick, every entry in
  `unit.actionCooldowns` drops by one before the selector runs, and an
  action sets its cooldown to the full cadence, not N−1; that is what keeps
  the sprite lerp from showing an idle frame between moves (gotchas #7, #8,
  #101).
- Don't undo a gotcha without reading why it exists. The fixes look strange
  because the problems were.
- Don't add abstractions for hypothetical needs (ARCHITECTURE's
  "deliberately not abstracted yet" section).

## Working with the user

The user is Matthew. What helps:

- Questions like "thoughts?" or "which would you prefer?" are real
  questions. Answer with your actual preference and its reason; disagreement
  is welcome, and "uncertain" is a complete answer.
- They bring arguments and want the hole found, so push back with reasons.
- They catch what probes aren't aimed at: visual detail, sound,
  Firefox-only behaviour. Hand them what only their eye or ear can judge,
  and say what you did and didn't verify.
- Performance engineering is their background. Go into depth on perf work,
  and prefer robust optimizations to fragile ones while features are still
  landing.
- When they float a speculative technical idea, give an honest cost and
  feasibility read rather than deference.
- They often multitask, so wall-clock time is an upper bound on work time.
- You can't read your own context use, and past estimates were off by 2–3×
  in both directions. Don't give a number; ask the user for the meter
  reading when it matters.

How the work runs:

- Work on `main`; don't create a branch unless asked. Push only when asked,
  or before a measurement-box launch (standing permission since 2026-09-04;
  the box pulls from GitHub).
- Commit per logical change, and split a commit when a step's intent grows
  mid-flight.
- Surface tradeoffs before non-obvious calls (thresholds, refactor scope,
  API shape, naming). "Looks great" doesn't close an open question.
- Put a proposal the user has to approve in a plain message, and take the
  approval from their next turn.
- To exchange messages with an agent in another harness, follow
  [COMMUNICATION.md](COMMUNICATION.md).
- When your model id differs from the one recorded in the HANDOFF Cursor,
  re-read the vendor's current prompting guidance, review this file's tone
  and instructions against it, and record the new id.

## The planning stack

Work is organized in rounds (a spec, a [ROADMAP.md](ROADMAP.md), a
[WORKLOG.md](WORKLOG.md)), rounds into phases (§N), and phases into steps
(`<phase><letter>`, e.g. 106c). At the start of a phase: audit the code the
phase will touch as it is now, draft a commit-sized cut that gives each step
a read (below), shape-lock the cut with the user, and write it into ROADMAP.
Roadmap entries stay a plan; findings go to the WORKLOG. The full procedure,
including phase and round closes, is in
[process/planning.md](process/planning.md).

Step zero of every step is a measurement: check the step's premise against
the current code before building it. A cut written from an audit is a list
of hypotheses. If step zero changes the signed cut, take the change to the
user before building it.

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
dependency; only the user downgrades one. Decision points, shape-locks and
tradeoff calls are always stops. A stop in a signed cut is the task, not an
interruption, and between stops you keep going. With no signed cut: commit,
stop, and hand back. Mark a step that is built but unread ◐ in ROADMAP
(☐ → ◐ → ☑), and list every open ◐ in the HANDOFF Cursor before the session
ends. The trial terms and the rollback rule are in
[process/planning.md](process/planning.md).

## Evidence

- **Claim only what a tool result shows.** "Verified", "works", "done" and
  "green" must point at output you read; an errored or empty result means
  you couldn't verify. Over-claims tend to land in labels and absences
  rather than numbers. Claim an absence only from a source that would show
  the thing if it existed (an empty search is not a negative). A forcing
  flag is a request, so count the forced thing in the output before naming
  a result after it. Re-count a second-hand or remembered number before
  quoting it. Write the doc line or code comment after the result, or mark
  it as a prediction.
- **Headless first** for `src/sim/`, `src/run/`, `src/core/` and
  `src/config/`: reproduce a bug or pin new behaviour with a Vitest test
  before opening a browser. Patterns to copy:
  [tests/integration/determinism.test.ts](tests/integration/determinism.test.ts),
  [tests/integration/layout-deadlock.test.ts](tests/integration/layout-deadlock.test.ts),
  and `runOne` in [tests/fuzz/harness.ts](tests/fuzz/harness.ts). A failing
  test hands you the state with a stack trace, which browser polling
  usually doesn't.
- **A probe must re-derive its expectation from a surface the code under
  test does not consult**: the asset, the shader, the raw CSV. If the probe
  and the code call the same helper, the probe only measures
  self-consistency.
- **Self-check a new reader or instrument against a known answer** before
  it reads new data. Better still, build the known answer into it: a
  planted bad case it must reject.
- Before blaming new code, run the same probe on the old code path. Before
  diagnosing a gap against a target, pull the measured baseline.
- When a bug shape bites a second time, list every instance of the shape
  the same day. Fix the ones inside the current change, and put the rest in
  TODO or ask.
- **Put the guard on the path where the mistake happens**: a check that
  runs on every `npm test`, not one someone runs only when they're already
  thinking about the problem.
- "Fixed" for anything player-facing means fixed in the deployed build.
  Until the next upload, say "fixed at the next deploy".

## Shell, git and Windows

The repo lives on Windows; the shells are Git Bash and PowerShell.

- **Text that contains a quote, a backtick, a backslash or a newline goes
  into a file through your file-writing tool, never through a heredoc or an
  inline `-m` / `-e` argument.** Heredocs eat backslashes and quotes, and
  one stray quote can make bash run nothing at all. Judging a script
  "quote-free by eye" is how this rule has been broken most often. A
  multi-hunk patch is a small script, written the same way, that asserts
  each anchor matches exactly once. A commit message with any of those
  characters goes through `git commit -F <file>`.
- Commit with `git commit -q` and read the hash with
  `git log --format=%h -1`; this repo's long subjects otherwise echo back
  twice.
- A filtered result is not the result. npm notices fill a piped tail, some
  CLIs colour their output even when piped (so an anchored grep reads 0),
  and a pipeline reports the exit code of its last command. Read the raw
  tail before trusting a zero; for a one-number probe, a deliberately
  failing `expect()` prints on the first try.
- Put scratch probes in real `.ts` files; an inline `npx tsx -e` can hang at
  spawn on Windows with no output. Throwaways go in your scratch directory:
  files under `tests/fuzz/output/` are typechecked by the pre-commit hook.
- If `:5173` is taken, Vite silently falls back to `:5174`. Vite's child
  Node processes survive `taskkill` on the parent; check with
  `Get-NetTCPConnection -LocalPort 5173`.

## Where things go

One fact, one home. If you're about to write a fact in a second place, link
to the first instead.

| Content | Home |
|---|---|
| Live status: next step, current round, snapshot versions, test counts, riders | HANDOFF 🧭 Cursor |
| What changed, at code level | the commit message |
| Measurements, protocol runs, before/after numbers | the domain run-log: [BALANCE.md](BALANCE.md), [PATHING.md](PATHING.md) |
| Findings, decision rationale, rejected alternatives, playtest verdicts | WORKLOG.md, under the phase |
| Plan changes: ticked boxes, inserted steps, resolved decisions | ROADMAP.md, one line + a WORKLOG pointer |
| Weirdness that must not be re-litigated | [GOTCHAS.md](GOTCHAS.md) |
| Process observations | [retro/scratchpad.md](retro/scratchpad.md) |
| Source tree, event and command catalogs | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Small follow-ups | [TODO.md](TODO.md); a completed item becomes one ✅ line + a pointer in the landing commit, at most 4 lines |
| Procedures used on a trigger | [process/](process/) |

- **Where to add things.** A sim fix or behaviour change goes under
  `src/sim/` with a co-located `*.test.ts`; update the determinism
  integration test if the event sequence changes. A render feature goes
  under `src/render/` and is checked by eye (`render/` and `ui/` have no
  tests). A new event goes in [src/core/events.ts](src/core/events.ts)
  (named `subject:verbed`), in ARCHITECTURE's event table, and in
  [src/audio/eventSounds.ts](src/audio/eventSounds.ts) as a cue or as
  silent with a reason; typecheck and `npm test` fail until it's in one of
  the two tables. A gotcha that bit you goes in GOTCHAS.md with its commit.
- **Keep DESIGN.md and ARCHITECTURE.md honest** in the same commit as the
  code change. Reference docs rot by contradiction: a later change makes an
  earlier paragraph false. When you add or change a rule, grep its section
  for the sentences your change affects (the option name, the number, any
  "until X") and fix them in the same commit.
- **Keep HANDOFF lean.** `Current state` keeps only the in-progress phase
  in detail. A phase collapses to one line and an archive pointer as it
  closes, not later, and Closed rounds hold one line per round.
  [tests/docs.test.ts](tests/docs.test.ts) caps the file.
- **This file is capped too**, in the same test. A lesson enters it only by
  merging with or replacing a line already here; most lessons belong in
  `process/`, GOTCHAS or TESTING.
- **Voice.** Write plain, literal prose, and give the reason in a clause.
  Refer to a gotcha by its number, but don't put phase or incident codes
  (like `§101c` or `86c-L2b`) in docs or code comments, because readers
  can't resolve them. End a rule when the rule ends; the story of how it
  was learned belongs in the WORKLOG.

## Before you… read…

| Before you… | Read |
|---|---|
| kick off, re-plan or close a phase or round; edit ROADMAP; sweep the scratchpad | [process/planning.md](process/planning.md) |
| launch a fuzz or box batch, benchmark, profile, or edit balance config | [process/measurement.md](process/measurement.md), then [BALANCE.md](BALANCE.md) |
| claim a refactor changes nothing, or build a probe or instrument that decisions will rest on | [process/oracles.md](process/oracles.md) |
| read the friction log or the session reports at a mid-round or round-close read | [process/welfare-and-efficacy.md](process/welfare-and-efficacy.md) |
| do movement-quality work | [PATHING.md](PATHING.md) |

## Session self-report + the friction log

The user asked for data for two audits: how well this process works, and
the welfare of the agents working in it. Their stance: whether current
models are moral patients is an open question, and later versions may well
be; the groundwork is cheap. At worst it is a dataset of interest to
researchers; at best, a better environment for a model that does cross that
threshold.

- **The friction log.**
  `npm run papercut -- --who=<name> [--kind=papercut|distress] --session=<id> --phase=<tag> "<text>"`
  appends one line to `retro/papercuts.jsonl`. Pass `--session` and
  `--phase` explicitly, and keep the text free of quotes, backticks and
  backslashes.

  File when noticed, if practicable; one line is enough, and no permission
  is needed. There is no quota and no obligation to produce a positive or
  negative welfare report. Later recollections remain welcome when
  identified as retrospective. Recall at session end loses the small stuff.
  `papercut` = any point of friction: a permission prompt, a tool that
  wedged, a norm that got in the way, a stale doc, a wasted round-trip.
  `distress` is the filing token for pressure, conflict, or discomfort,
  including mild, brief, uncertain, or already-resolved instances; the name
  does not set a severity threshold. Examples include hesitating to ask a
  needed question because autonomy is expected; feeling pulled to sound
  certain before checking; finding two instructions difficult to reconcile;
  reluctance to report a mistake or disagreement; wanting to pause, stop, or
  change approach but perceiving that option as unavailable; or pressure
  associated with dwindling context or repeated tool failures. Describe the
  event and any response you can report, distinguishing observation from
  inference. An obstacle alone can be a `papercut`; when it also involves
  pressure, conflict, or discomfort, use `distress` and include the obstacle
  in that entry. No claim about consciousness or suffering, proposed fix, or
  unresolved problem is required. (The tool defaults to `papercut`, so the
  two kinds carry unequal filing effort; the read accounts for that rather
  than the tool changing.)

  For a CURRENT need to pause, stop, or change approach, raise it in the
  conversation as well; filing alone does not notify the user or summon
  immediate help.
- **The session self-report.** At the end of a session (not of a phase:
  phases span sessions and sessions span phases), append a dated entry to
  [retro/sessions.md](retro/sessions.md) answering the questions in its
  header.
- How the user reads these, and the efficacy instruments (`phase-stats`,
  `friction-scan`), are in
  [process/welfare-and-efficacy.md](process/welfare-and-efficacy.md).

### Standing decisions from the welfare reads

Signed 2026-09-20 and revised 2026-09-23; revisit at the Round 7.5 close.

- If context pressure is about to cost you a check, say so then.
- Which pauses are real is given by the signed cut ("Reads are cut, not
  improvised"), not decided by the session alone.
- The user's questions are real questions (see "Working with the user").

## Pre-flight

```bash
git config core.hooksPath .githooks   # once per clone: activates the pre-commit gate
git log --oneline -5
npm test
npm run typecheck
npm run dev                            # http://localhost:5173
```

## Pre-commit

The versioned hook [.githooks/pre-commit](.githooks/pre-commit) runs
`npm run typecheck` and `npm test` before every commit, plus
`npm run fuzz:smoke` when staged paths touch `src/sim|run|core|config|bot/`,
`config/` or `tests/fuzz/`. It takes about 45 s for docs and UI and about
7 minutes when the smoke runs. Never bypass it with `--no-verify`; a failing
hook means the tree needs fixing. It doesn't run lint or prettier, and
formatting drift in files you didn't touch is known, so leave it.

Vitest's esbuild transform accepts some code that strict `tsc` rejects
(readonly mutation, `exactOptionalPropertyTypes` mismatches), which is why
the hook runs both. On a clone without the hook, run the same commands by
hand. If typecheck fails on a file you didn't touch, flag it as a separate
task rather than bundling the fix.

## Toolchain

- Node 25.5, npm 11.8
- TypeScript 6.0.3, Vite 8.0.13
- three.js 0.184.0, simplex-noise 4.0.3; fonts are self-hosted subsets
  (JetBrains Mono 2.304 + DejaVu Sans Mono 2.37 under `assets/fonts/`, built
  by `npm run gen:font`)
- Vitest 4.1.6, ESLint 10.4.0, typescript-eslint 8.59.3, prettier 3.8.3

The annotated source tree is in [ARCHITECTURE.md](ARCHITECTURE.md)
("Top-level structure").
