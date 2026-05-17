# HANDOFF — Phase 4 pickup

A fresh-session orientation for ASCIIbattler. Read this first; then dive into the docs only where they're called out.

## Where we are

- **Phase 0** (project setup) ✓
- **Phase 1** (core primitives — RNG, EventBus, Clock) ✓
- **Phase 2** (rendering — FontAtlas, SpriteRenderer, TerrainRenderer, PostProcess) ✓
- **Phase 3** (battle simulation, 3.1–3.9) ✓
- **CHECKPOINT 5** passed; tuning landed (faster cooldowns, mixed-archetype spawn, target flash).
- **Phase 4** (run structure) — **starts now at Step 4.1**.
- **Tests:** 88 passed + 2 `it.todo()` (Phase 4 territory: run-level RNG isolation, NodeMap generation). Run with `npm test`.
- **Dev server:** not running. Start with `npm run dev` → http://localhost:5173/ (port 5174 if 5173 is held by a stale process — check with `Get-NetTCPConnection -LocalPort 5173`).

## How we collaborate

Read in order: `DESIGN.md` → `ARCHITECTURE.md` → `ROADMAP.md`. Then follow `ROADMAP.md`'s conventions strictly:

- **One step at a time.** Don't merge steps for efficiency.
- **Test before continuing.** Each step has a verify note.
- **Checkpoints are mandatory stops.** When you hit `**CHECKPOINT**`, surface the listed questions to the user — do NOT default silently.
- **Commit after each step** with a descriptive message (look at `git log` for examples).
- **Keep `DESIGN.md` / `ARCHITECTURE.md` honest.** If a step reveals a documented decision is wrong, update the doc in the same commit.
- **One step → one or a few small files.** Avoid wide refactors unless the roadmap says to.

See also: `TESTING.md` for the testing policy (`core`/`sim`/`run` get tests, `render`/`ui` get visual verify), and `RETROSPECTIVE.md` for the post-MVP discussion queue.

## Things that bit us — DON'T re-litigate

These hard-won fixes will look weird out of context. Don't "clean them up" without understanding why they exist.

1. **`scene.background = new THREE.Color(TERMINAL_BLACK)`, not `setClearColor`.** The clear-color path through the EffectComposer's HalfFloat render targets lands at a value that makes the palette-quant pass snap to `DARK_TERMINAL_AMBER`. Lives in [src/render/Renderer.ts](src/render/Renderer.ts). Commit `8491daa`.
2. **`OutputPass` at the END of the composer chain.** Custom `ShaderPass`es don't auto-convert linear → sRGB at the canvas blit; `OutputPass` does. Without it, every color displays as its linear value re-interpreted as sRGB. Commit `fb5e878`.
3. **Palette quantization uses a color-key approach** to skip background pixels and exclude `TERMINAL_BLACK` from the snap palette — stops dark terrain from "punching a hole" by snapping to the background color. Commit `2857c91`.
4. **`Math.random()` is banned in `src/sim/` and `src/run/`** (ESLint enforced). Use `RNG` from `src/core/RNG.ts`; per-battle randomness via `parentRng.fork()`.
5. **Author durations in seconds, not ticks.** Use `secondsToTicks` / `ticksToSeconds` from `src/config.ts`. Changing `TICK_RATE` shouldn't require re-tuning balance — that's the contract.
6. **Cooldown semantics are "decrement-then-check," not "check-then-decrement."** [World.tick()](src/sim/World.ts) decrements `unit.actionCooldown` once per tick before behaviors run; behaviors set it to the *full* `moveCooldownTicks` / `attackCooldownTicks` value after acting (NOT `N-1`). The match between cooldown gap and event `durationTicks` is what keeps the sprite lerp from leaving a visible idle frame between moves. Commit `3b5083f` is where this was first found and fixed in the per-behavior form; `d67593d` refactored it into the shared cooldown.
7. **Behaviors share one `actionCooldown` on Unit.** Movement, Attack, and Death all read/write `unit.actionCooldown`. The shared cooldown is what enforces "one action per tick" — without it, a unit can move into melee range AND attack on the same tick, which made hits feel weightless. Behaviors are stateless w.r.t. cooldown; safe to share instances across units. Priority falls out of array order in `unit.behaviors` (post-MVP: replace with an action selector, see TODO.md).
8. **`World.tick()` iterates `this.units.slice()`, not `this.units`.** DeathBehavior splices the list mid-tick; without the snapshot copy the loop skips the next unit after each removal. The behaviors themselves early-return on `unit.currentHp <= 0` so dead-but-not-yet-removed units don't get posthumous swings.
9. **`checkBattleEnd` guards on an empty world.** Without the guard, `World.tick()` fires `battle:ended` the very first tick before Game spawns anything — and also breaks any low-level World test that ticks without spawning. The guard happens to also cover the (currently impossible-with-current-stats) mutual-annihilation case.
10. **`exactOptionalPropertyTypes` gotcha.** When an object literal might assign `undefined` to a callback property, declare it as `prop: (() => void) | undefined` instead of `prop?: () => void` — the latter rejects an explicit `undefined`. Bit us in [SpriteAnimator's `ActiveFade`](src/render/animation/SpriteAnimator.ts).

## Active dev affordances (all marked `TODO(roadmap-5.3)`)

These get removed at Step 5.3 — listed in `TODO.md`:

- `OrbitControls` (mouse-orbit/zoom)
- `Stats` panel top-right (FPS/MS/MB)
- `GridHelper` overlay — toggle with **`g`** (will be replaced by terrain-baked grid post-MVP, see TODO.md)
- Keypresses: **`q`** toggle palette-quantization post-process, **`g`** toggle grid overlay
- Hardcoded seed `54321` for the World (terrain still uses `12345`) — Run takes over at Step 4.3
- `[clock] tick N` console log every 10 ticks
- `[attack] #A → #B: -X HP (now Y/Z)` per attack (replaced by HUD at 5.1)
- `[battle] ended — winner: X` on battle end (replaced by Run state machine at 4.3)

## Project shape

```
src/
  main.ts              # entry; top-level await on FontAtlas.create()
  Game.ts              # top-level orchestrator (spawns units, wires battle)
  config.ts            # TICK_RATE=10, GRID_SIZE=12, secondsToTicks/ticksToSeconds
  core/
    RNG.ts             # mulberry32, fork(), pick(), int()
    EventBus.ts        # typed pub/sub
    Clock.ts           # fixed-timestep accumulator
    events.ts          # GameEvents catalog (typed event payloads)
    types.ts           # GridCoord, Vec2
  sim/
    World.ts           # tick(), spawnUnit(), removeUnit(), findUnit(), checkBattleEnd
    Unit.ts            # Unit + UnitTemplate + UnitStats + Team + Behavior + actionCooldown
    Pathfinding.ts     # A* king's-move, Chebyshev heuristic
    Targeting.ts       # findTarget — nearest enemy, ties by HP then id
    archetypes.ts      # MELEE/RANGED bounds, rollUnit, glyphForArchetype
    behaviors/
      MovementBehavior.ts    # uses Pathfinding + Targeting; sets actionCooldown
      AttackBehavior.ts      # damage + unit:attacked + sets actionCooldown
      DeathBehavior.ts       # currentHp<=0 → removeUnit + unit:died
  run/                 # STUBS — Phase 4
    Run.ts, NodeMap.ts, Recruitment.ts
  render/
    Renderer.ts        # WebGLRenderer + EffectComposer + RAF loop
    FontAtlas.ts       # canvas2d glyph atlas → THREE.CanvasTexture
    SpriteRenderer.ts  # InstancedBufferGeometry + custom shaders
    TerrainRenderer.ts # fBm-displaced plane + palette shader
    BattleRenderer.ts  # sim/render seam: subscribes to unit:* + tick, drives sprites
    PostProcess.ts     # palette-quantization ShaderPass factory
    palette.ts         # COLORS table
    animation/SpriteAnimator.ts  # startLerp (position) + startFade (alpha)
  ui/                  # STUBS — Phases 4–5

tests/
  smoke.test.ts                       # vitest + module resolution
  integration/determinism.test.ts     # 4 real + 2 todo (Phase 4)
```

Co-located `*.test.ts` next to source for unit tests. Integration tests under `tests/`.

## Next step: 4.1 — `NodeMap` generation

From `ROADMAP.md`:

> Implement DAG generation. Layered structure: N floors, each floor has 1–4 nodes, edges connect nodes between adjacent floors with some branching density. Root and terminal are single nodes. Seeded from the run RNG. All nodes are battle nodes for MVP.
>
> Write a quick text-based dump (`console.log` an ASCII representation) to verify structure.
>
> **Verify:** Generated maps look reasonable: connected, layered, branchy but not chaotic. Same seed → same map.

DESIGN.md tightened "10–15 nodes" → "7–10 nodes" at CHECKPOINT 5. Use that as the floor-count target.

Files involved:
- [src/run/NodeMap.ts](src/run/NodeMap.ts) — currently `export {};`, needs DAG generation logic.
- [src/run/NodeMap.test.ts](src/run/NodeMap.test.ts) — new; assert connectivity, layering, branching density bounds, and determinism.

`NodeMap.generate(rng)` is the natural shape. No `Run` yet — that's Step 4.3.

After 4.1 is **Step 4.2** (`MapScreen` UI in plain HTML/CSS over the canvas).

## Pre-flight (run before starting 4.1)

```bash
git log --oneline -5    # confirm latest commit is ae38993 (target flash)
npm test                # 88 passed + 2 todo
npm run dev             # opens at :5173 — verify a battle plays out
```

In the browser, you should see: dark terrain, mixed front-rank-melee + rear-rank-ranged formation on both sides, units engaging with amber attacker + cyan target flashes, dead sprites fading out, and `[battle] ended — winner: X` in the console when one side wipes.

## Toolchain versions

- Node 25.5, npm 11.8
- TypeScript 6.0.3, Vite 8.0.13
- three.js 0.184.0, simplex-noise 4.0.3, @fontsource/jetbrains-mono 5.2.8
- vitest 4.1.6, ESLint 10.4.0, typescript-eslint 8.59.3, prettier 3.8.3

## Existing memories

- `project_asciibattler.md` — points here. Update at major phase boundaries.
- `feedback_context_estimates.md` — don't fabricate context-window %s; use qualitative terms or trust the user's actual number.
