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
apply:

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
  and confirm an edit landed before stacking the next on it.
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
git log --oneline -5    # confirm latest commit
npm test                # should be all green, 0 todo
npm run typecheck       # tsc --noEmit; clean (added E3.5)
npm run dev             # opens at :5173 (or :5174 if stale process held :5173)
```

## Pre-commit checklist

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
- **A process observation worth keeping:** drop a short note in
  [retro/scratchpad.md](retro/scratchpad.md). Group by theme; keep
  entries short; link commits.

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
