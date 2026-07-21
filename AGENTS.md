# AGENTS.md

Orientation doc for AI coding assistants (Claude Code, etc.) picking up
this project cold. If you're a human, you probably want
[HANDOFF.md](HANDOFF.md) instead.

## First thing

**Read [HANDOFF.md](HANDOFF.md) before doing anything else.** It is the
authoritative session-start orientation: where the project stands, what's
next, how we collaborate, and — importantly — the hard-won fixes (now in [GOTCHAS.md](GOTCHAS.md))
that will look weird without context. Do not "clean up" anything on that
list without understanding why it exists.

After HANDOFF, the docs you'll cross-reference most often:

- [DESIGN.md](DESIGN.md) — what we're building and why it feels the way
  it feels. The aesthetic / mechanics source of truth.
- [ARCHITECTURE.md](ARCHITECTURE.md) — how the code is organized.
  Includes the event catalog, key abstractions, the sim/render seam.
- [ROADMAP.md](ROADMAP.md) — the active round's plan (phases → steps).
  Which round is active and where it stands shifts often, so this doc
  deliberately doesn't restate it (that's how it drifts — this very
  bullet once sat stale at "Phase H in progress" for a month):
  **HANDOFF's 🧭 Cursor is the single source of truth for the live
  phase cursor.** Superseded roadmaps and feedback are in
  [archive/](archive/).
- [TODO.md](TODO.md) — small follow-ups that aren't roadmap steps.
- [TESTING.md](TESTING.md) — what gets tested (`core`, `sim`, `run`),
  what doesn't (`render`, `ui`), and the determinism contract.
- [retro/](retro/) — [scratchpad.md](retro/scratchpad.md) (rolling
  process notes) and [post-mvp-review.md](retro/post-mvp-review.md)
  (CHECKPOINT 7 retrospective).

## What this project is

A browser-based tick-based autobattler with a Slay-the-Spire-style run
structure. ASCII glyphs on billboarded quads, saturation-clamped with
selective bloom (palette-quant was dropped at B1), CRT-diorama feel. MVP
shipped — playable end-to-end at [asciibattler on GitHub Pages]. Now in
post-MVP territory.

Stack: TypeScript (strict), three.js, Vite, Vitest. No frameworks; UI is
plain HTML/CSS overlaid on the canvas. See ARCHITECTURE.md for the full
shape.

## How we collaborate

The strict "one step → one commit, stop at every CHECKPOINT" rhythm was
for the MVP build. Post-MVP is freer, but the underlying habits still
apply. (The planning pipeline itself — spec / roadmap / worklog / phase
kickoff — has its own section below.)

- **Commit per logical change**, not per session-of-work. Split commits
  when a step's intent grows mid-flight.
- **Surface tradeoffs to the user** before non-obvious calls (shader
  thresholds, refactor scope, API shape, naming decisions). Don't ship
  on "looks great!" when there are open questions — the retrospective
  flagged this as something to be more deliberate about.
- **Claim only what a tool result proves.** "Verified / works / done /
  green" must point at concrete output you actually read. An errored or
  empty tool result is "could not verify" — never fill the gap with
  plausible-sounding specifics. (E7.A produced *two* fabricated
  "browser-verified" rogue reports — "held 14 HP", "tick 71", "live
  5v5" — from `preview_*` calls that had all errored.) Note `window.__game`
  is the top-level `Game`, not the battle world: `__game.world` returns
  `"none"`, so it can't confirm live unit state — use a headless test for
  that.
- **Native Read/Grep/Glob for file inspection; Bash only for real
  commands** (`npm`, `git`, `node`). Reading files via shell
  `sed`/`grep`/`cat`/`head`/`tail` triggers permission prompts (friction
  for the user) and, when over-batched alongside edits, causes
  out-of-order results and silently no-op'd edits. Batch only genuinely
  independent calls; never read-and-edit the same file in one message,
  and confirm an edit landed before stacking the next on it. (Also: in
  the Bash tool, multi-line commit messages take multiple `-m` flags or
  `$'…'` — a PowerShell `@'…'@` here-string parses as stray `@` lines
  there; that syntax belongs to the PowerShell tool. One garbled commit
  subject proved it.)
- **Browser-verify visual work at native resolution.** The Preview MCP
  screenshots are unreliable for sub-pixel detail (JPEG compression
  smears 1–2px features). If a screenshot contradicts intuition, sample
  canvas pixels via `getImageData` first, or ask the user to check in
  their native browser.
- **Headless-first for sim/run/core/config logic.** For bug repro or
  new-behavior work in `src/sim/`, `src/run/`, `src/core/`, or
  `src/config/`, write a vitest test as the FIRST reproduction step —
  don't drive the browser. Patterns to copy:
  [tests/integration/determinism.test.ts](tests/integration/determinism.test.ts)
  (hot-loop ticks + assert state),
  [tests/integration/layout-deadlock.test.ts](tests/integration/layout-deadlock.test.ts)
  (specific encounter setup),
  [tests/fuzz/harness.ts](tests/fuzz/harness.ts) `runOne` (full-run drive).
  The C1d Labyrinth pathfinding deadlock burned ~an hour of browser
  polling before a headless test reproduced it in ~580ms and exposed
  the real failure (mutual `findPath()→[]`, not the goal-picker bug
  initially hypothesized); the test then survived as a regression.
  Don't reach for `window.__world` / `window.__game` debug hooks for the
  same purpose — a failing test surfaces the same state with a stack
  trace.
- **Behavior-equivalence refactors get a before/after fuzz-arm diff
  oracle — with the "before" pinned in a worktree.** Capture per-arm
  `summary.csv` baselines at HEAD *before* the surgery, re-run after,
  `diff`: byte-identity across arms is the cheapest strong proof a
  re-author changed nothing — it catches what live-vs-live suites
  structurally can't (they recompute both sides on the NEW code; the
  47c gates→rules and 47d single→multi-daemon oracles). Pin the
  baseline checkout with `git worktree add --detach <tmp> HEAD` + a
  `node_modules` junction — NEVER a background capture against the
  live tree: the CLI compiles imports at run time, so edits landing
  underneath crash or silently poison the capture (47e).
- **Shape-lock proposals go in a plain message; collect the approval
  next turn.** AskUserQuestion dialogs hide same-turn assistant text in
  the desktop app (bit twice at the 47 kickoff) — a proposal presented
  in the same turn as the question dialog is invisible to the user.
- **Keep DESIGN.md / ARCHITECTURE.md honest.** If a change reveals a
  documented decision is wrong, update the doc in the same commit as
  the code change.
- **Keep HANDOFF lean — a structural rule, not "trim when it feels big"**
  (the old discretionary version let it reach 600+ lines before anyone
  acted). `Current state` keeps **only the in-progress phase verbose**;
  every *completed* phase is **one terse line + a pointer to its archive
  worklog** (precedent:
  [archive/phase-a-e-worklog.md](archive/phase-a-e-worklog.md),
  [archive/phase-e-gp-worklog.md](archive/phase-e-gp-worklog.md)). Demote a
  phase to one line *as you close it* — don't append a verbose entry and
  "trim later." A guard test ([tests/docs.test.ts](tests/docs.test.ts))
  backstops this: it fails if HANDOFF or its `Current state` section blows a
  line budget — when it trips, demote completed phases (or bump the cap
  deliberately if the current phase genuinely needs the room). Everything
  non-state already has a home: gotchas in [GOTCHAS.md](GOTCHAS.md)
  ("gotcha #N" — never renumber; retired ones stay as tombstones), the
  source tree in [ARCHITECTURE.md](ARCHITECTURE.md), and the pre-flight /
  pre-commit / toolchain / collaboration norms here in AGENTS — so HANDOFF
  holds just the 🧭 Cursor (the ONE live-status home), `Current state`,
  `What's next`, the condensed Closed rounds, and the detailed
  browser-verify tips.
- **Roadmap "decision points" are stops.** Post-MVP doesn't have the
  rigid CHECKPOINT markers, but ROADMAP entries flagged "Decision
  point" call out moments where user input is required — stop and ask.
- **Stop preview servers (and other background processes) before
  ending the session.** If you called `preview_start`, call
  `preview_stop` before signing off. Vite spawns child Node processes
  that survive `taskkill` on the parent — letting the preview MCP
  shut down cleanly is what reaps them. Same applies to any
  long-running `run_in_background` Bash call.

## The planning stack (spec → roadmap → worklog → step)

Locked at the 2026-07-06 process-audit round (pre-Cluster-3). What each
planning artifact is, what may be written where, and when step plans get
cut. The failure modes this replaces, all observed across Phases H→46:
roadmaps silently morphing into worklogs (the verbose ✅ as-built blocks),
status facts duplicated across five docs (the "Phase H in progress" bullet
above sat stale for a month), and commit-granularity step plans authored
several phases before the code they'd land on (~70% survived contact;
the durable parts — ordering, exit criteria, decision points, scope
guards — survived essentially unchanged).

### The artifacts

- **Spec** — the user's intent in the user's voice: goals, constraints,
  *marked uncertainty* ("still debating…"). **Every cluster kickoff
  produces the spec artifact FIRST** — even when the design emerges from
  a live conversation, distill it into a doc before the roadmap is
  written, so the roadmap has an independent artifact to be audited
  against. **Audit the spec against CODE REALITY before the design
  conversation** — the Cluster-3 blind-spot pass found the draft spec's
  whole daemon⇄consumable premise unbuilt, and posing each design fork
  with its real engineering cost attached is what made the user's calls
  fast (`b966187`). Superseded specs archive with their round.
- **ROADMAP.md** — the active round's PLAN, and it stays a plan for its
  whole life. A phase entry at authoring time carries only the durable
  parts: charter (2–3 sentences), why-this-order + hard cross-phase
  dependencies ("§45 consumes first-class Wait from §44"), risk rating,
  known decision points, exit criteria, and scope guards (the
  NOT-doing list). **No sub-step lists at authoring time** (they're cut
  at phase kickoff, below) and **no as-built prose, ever**.
- **WORKLOG.md** — the per-round narrative log: one file per roadmap,
  sectioned `## Phase N`, created fresh at each round's kickoff (first
  one: Cluster 3) and archived with its roadmap as a pair
  (`archive/post-NN-roadmap.md` + `-worklog.md`). Write-mostly —
  sessions orient from the HANDOFF 🧭 Cursor + ROADMAP and open the
  worklog to APPEND or to investigate. (This revives the
  [archive/phase-a-e-worklog.md](archive/phase-a-e-worklog.md) pattern;
  the worklog function drifted into the roadmap's ✅ blocks around
  Phase H without anyone deciding it.)
- **Domain run-logs** ([BALANCE.md](BALANCE.md), [PATHING.md](PATHING.md))
  — permanent, cross-round measurement records with a protocol header.
  Not worklogs: measurements land here; narrative lands in the worklog.

### The routing table (one fact, one home)

If you're about to write the same fact in a second place, one of the two
is wrong — link instead.

| Content | Home |
|---|---|
| Live status — NEXT, in-flight round, snapshot versions, test counts, riders | HANDOFF 🧭 Cursor (everything else points at it) |
| What changed, at code level | the git commit message |
| Measurements, before/after numbers, protocol runs | the domain run-log, when one applies |
| Findings, decision rationale, rejected alternatives, scope changes, playtest verdicts | WORKLOG.md |
| Plan mutations — checkbox flips, inserted steps, resolved decision points | ROADMAP.md, one line + a worklog pointer |
| Hard-won weirdness that must not be re-litigated | [GOTCHAS.md](GOTCHAS.md) ("gotcha #N", never renumber) |
| Process lessons | [retro/scratchpad.md](retro/scratchpad.md), distilled by the ritual below |
| Source tree, event/command catalogs | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Small non-roadmap follow-ups | [TODO.md](TODO.md) — completed = one ✅ line + pointer, in the landing commit |

### Legal ROADMAP mutations (everything else → the worklog)

- **Checking a box** — at most one line of outcome + a pointer.
- **Inserting or re-scoping a step** — one line + why. (The
  43-pre/44-pre/43b2 precedent: findings-driven insertions are the
  instruments WORKING, not a planning failure — don't fight them.)
- **Resolving a decision point** — flip to ✅ DECIDED with the one-line
  resolution; rationale goes to the worklog.
- **Demoting a CLOSED phase to a stub** (adopted 2026-07-21 at the §60f
  close — user-signed) — as a phase closes, collapse its ROADMAP section
  to the header + a one-breath outcome + the checked cut lines; the
  worklog/BALANCE/git already carry the rest. This is HANDOFF's
  demote-as-you-close rule imported to ROADMAP: it makes the
  docs.test.ts line caps hold structurally instead of by dated bump
  (the micro round needed four). Caps re-size to fit when each new
  round's roadmap is authored.

### Phase kickoff (just-in-time step planning)

Sub-steps are cut when the PHASE starts, not when the roadmap is
authored. At phase start:

1. **Code-reality audit** — survey the surfaces the phase touches *as
   they exist now*, several phases of churn later (the H2/H4 rule
   generalized from step to phase; it's what caught 44-pre). Findings →
   worklog; pre-steps inserted if warranted.
2. **Draft the commit-granularity cut** — per step: intent, exit
   criterion, expected commit shape. One or two lines each; no
   implementation prose (or the old over-investment just relocates to
   phase start). When a step touches ANY serialized union, the cut
   line predicts the snapshot bump (the 48b/49c twice-taught rule — a
   "sim untouched" risk note is a prediction too). When a risky
   change has a separable UI, cut it
   headless-core-first, render-second (the H4a/H4b precedent) — it
   shrinks the eyeball-only surface to what's actually visual.
3. **Shape-lock with the user** — a pause point, same rhythm as
   pause-between-commits.
4. **Write the cut into the ROADMAP phase section** as checkbox
   one-liners; rationale + audit findings into the worklog.

Proportionality: a low-risk phase does all four in minutes at the top of
its first build session; a high-risk phase (a §45-alike) gets a
dedicated planning session.

**Step zero of any step: re-verify the card's premise against the
current code before building.** H2's specced mechanic had been live
since D5.B; H4's predicted snapshot bump didn't exist. When a card
predicts a side effect, the *absence* of that side effect is a tell the
work is already done.

**When a step deliberately defers work to a later step, write the
landing note** — what was left, where it lands, and what invariant the
landing must preserve — in the deferring step's worklog entry AND a
code comment at the seam. The 47c note ("non-grant turnStart ops are
deliberately NOT resolved in the grant fold — they execute at the fire
site, bits 47e") is what kept a fresh session from designing a second
hook walk that double-draws the chance flip and breaks byte-parity.

### The scratchpad distillation ritual

At each round/cluster boundary, sweep [retro/scratchpad.md](retro/scratchpad.md):
every entry is either **promoted** (to a norm here in AGENTS, a gotcha
in GOTCHAS.md, or a TODO item) or **archived** (moved to `archive/` with
the round's docs). The scratchpad holds only undistilled observations
from the current round. First sweep: done 2026-07-06 — the MVP→H7
backlog moved to
[archive/retro-scratchpad-mvp-to-h7.md](archive/retro-scratchpad-mvp-to-h7.md),
with the still-live lessons promoted (here, TESTING.md, HANDOFF
browser-verify tips, two TODO watch items). Second: 2026-07-11 at the
micro-round kickoff — the process-audit + Cluster-3 backlog moved to
[archive/retro-scratchpad-cluster-3.md](archive/retro-scratchpad-cluster-3.md);
promoted: the worktree-pinned diff oracle, the AskUserQuestion note, the
spec-vs-code audit, the union-bump prediction, the deferral landing note
(all here), the Game-layer wiring note (TESTING.md), and the fuzz-trigger
`src/config/` fix (the hook itself).

## Load-bearing invariants

These are documented in detail in [GOTCHAS.md](GOTCHAS.md),
but the headline rules:

- **Determinism is structural.** Anything consuming randomness takes an
  `RNG` from [src/core/RNG.ts](src/core/RNG.ts). `Math.random()` is
  ESLint-banned in `src/sim/` and `src/run/`. Per-battle randomness via
  `parentRng.fork()`. See [TESTING.md](TESTING.md) for the contract.
- **Cooldowns/durations authored in seconds, not ticks.** Use
  `secondsToTicks` / `ticksToSeconds` from [src/config.ts](src/config.ts).
  Changing `TICK_RATE` (currently 20Hz) must not re-tune balance.
- **Sim/render separation.** Simulation is a pure, deterministic state
  machine. The renderer subscribes via the EventBus. Sim code never
  imports from `src/render/` or `src/ui/`.
- **Palette is art-direction discipline, not shader enforcement (B1).**
  The `COLORS` table is the canonical color vocabulary code reaches for,
  but the rendering chain doesn't post-quantize. B1.1 selective bloom
  uses two composers: a `bloomComposer` (layer-1
  sprite bloom mesh → UnrealBloomPass) feeds its result into a
  `mainComposer` (`RenderPass → SatClamped → MixPass → Scanlines →
  OutputPass`). UnrealBloomPass's high-pass uses max-channel (not
  Rec.709) so red and green glow equally — see gotcha #29 in [GOTCHAS.md](GOTCHAS.md).
  SpriteRenderer's per-instance `bloomIntensity` controls halo strength
  independently of visible color: 0 = no halo, 1 = natural, >1 = forced
  (gotcha #30).
- **Cooldown semantics are "decrement-then-check."** Each tick, every
  entry in the per-action `unit.actionCooldowns` Map is decremented
  before the selector runs; a behavior sets its proposal's cooldown to
  the *full* cadence after acting (move cadence from `UnitDerived`,
  attack cadence from `attackCooldownTicksFor`), not N-1. This is what
  keeps the sprite lerp from leaving a visible idle frame between moves.
  The MVP's single `unit.actionCooldown` field became the per-action
  Map + `activeAction` lockout in Phase A1 (gotchas #7, #8, #101).

## Pre-flight when picking up a session

```bash
git config core.hooksPath .githooks   # once per clone — activates the pre-commit gate
git log --oneline -5    # confirm latest commit
npm test                # should be all green, 0 todo
npm run typecheck       # tsc --noEmit; clean (added E3.5)
npm run dev             # opens at :5173 (or :5174 if stale process held :5173)
```

## Pre-commit checklist

**Mechanized (2026-07-06):** the checklist below runs automatically via the
versioned hook [.githooks/pre-commit](.githooks/pre-commit) once
`git config core.hooksPath .githooks` is set (see Pre-flight) — including
the conditional fuzz:smoke, which triggers on staged `src/sim|src/run|
src/core|src/config|config/` paths instead of memory (`src/config/` added
at the 2026-07-11 sweep — the zod loaders carry behavior; the 50f gap). **Never bypass it with
`--no-verify`** — a failing hook means fix the tree, not skip the check.
The list stays here as documentation of what runs (and as the manual
fallback on a clone that hasn't activated the hook).

Run before every commit. Vitest and tsc are non-overlapping —
vitest's esbuild transformer accepts some strict-tsc rejections
(readonly mutation, `exactOptionalPropertyTypes` mismatches, etc.),
so a green `npm test` is not sufficient for type safety.

```bash
npm test                # 0 failures
npm run typecheck       # tsc --noEmit clean
# only if changes touch sim/run/core behavior:
npm run fuzz:smoke      # 22 passed
```

Run this **before** `git commit`, not after — and first confirm your
edits actually landed (`Edit` can silently no-op on a bad anchor or a
leading-space mismatch, and a flaky harness may report "updated
successfully" for a write that never persisted). E7.A committed a
broken build (`TS2304: Cannot find name 'damageStatFor'`) because an
import edit no-op'd and the commit happened before re-checking. Green
tree + landed edits, then commit.

If `typecheck` fails on a file you didn't touch, that's a pre-existing
issue — flag it as a side task rather than bundling the fix into the
current change.

In the browser: dark terrain (smooth blue/green/amber gradient) with 4px
scanlines, glowing neon sprites (green allies + red enemies bloom on
attack), full-viewport node map on load. Click a frontier node → battle
→ promotion (if a unit leveled) → recruit modal → back to map; a rest
node (`Z`) banks XP and the boss (`!`) is the final floor. Clear the
boss → green "Run Complete." Lose → red "Defeat." Screen transitions
fade over 180ms.

If `:5173` is held by a stale process, Vite silently falls back to
`:5174`. Vite spawns child Node processes that survive `taskkill` on
the parent — check with `Get-NetTCPConnection -LocalPort 5173` on
Windows.

## Toolchain

- Node 25.5, npm 11.8
- TypeScript 6.0.3, Vite 8.0.13
- three.js 0.184.0, simplex-noise 4.0.3, @fontsource/jetbrains-mono 5.2.8
- Vitest 4.1.6, ESLint 10.4.0, typescript-eslint 8.59.3, prettier 3.8.3

## Project tree (abbreviated)

The annotated source tree lives in **[ARCHITECTURE.md](ARCHITECTURE.md)**
("Top-level structure") — the single canonical copy. Keeping it in one
place (rather than mirrored here and in HANDOFF) is what stops the drift that left
all three trees listing retired files and stale snapshot versions by GP1.

## Where to add things

- **A bug fix or behavior change in sim:** edit under `src/sim/`,
  co-locate a `*.test.ts`. Update the determinism integration test
  if the event sequence changes.
- **A new render feature:** edit under `src/render/`, visual-verify in
  the browser. No tests; the `render`/`ui` policy is eyeball-only.
- **A new event:** add to the catalog in [src/core/events.ts](src/core/events.ts).
  Naming: `subject:verbed`. Document it in ARCHITECTURE.md's event
  catalog table.
- **A new gotcha that bit you:** add to [GOTCHAS.md](GOTCHAS.md) with a
  commit reference (permanent "gotcha #N" numbering — never renumber).
  Future-you will thank you.
- **A finding / decision rationale / session-level story:** append to
  WORKLOG.md under the phase's `## Phase N` section (see "The planning
  stack" — the roadmap gets one line + a pointer, never the narrative).
- **A process observation worth keeping:** drop a short note in
  [retro/scratchpad.md](retro/scratchpad.md). Group by theme; keep
  entries short; link commits. Swept at every round boundary by the
  distillation ritual (promoted or archived).

## Things to avoid

- **Don't re-litigate the [GOTCHAS.md](GOTCHAS.md) gotchas list** without understanding
  why each item exists. The fixes look weird because the problems were
  weird.
- **Don't claim a visual change works based on Preview MCP screenshots
  alone.** Sample pixels or ask the user to verify natively.
- **Don't introduce abstractions for hypothetical future needs.** The
  MVP held the line on this; keep it. ARCHITECTURE.md's "deliberately
  not abstracted yet" section is the receipt.
- **Don't use `Math.random()` in `src/sim/` or `src/run/`.** ESLint will
  catch the direct call; if you find a non-obvious source of
  non-determinism, the determinism integration test will catch it
  eventually but at much higher cost.
