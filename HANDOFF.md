# HANDOFF — Phase 3 pickup

A fresh-session orientation for ASCIIbattler. Read this first; then dive into the docs only where they're called out.

## Where we are

- **Phase 0** (project setup) ✓
- **Phase 1** (core primitives — RNG, EventBus, Clock) ✓
- **Phase 2** (rendering — FontAtlas, SpriteRenderer, TerrainRenderer, PostProcess) ✓
- **Phase 3** (battle simulation) — **starts now at Step 3.1**.
- **Tests:** 34 passed + 6 `it.todo()` placeholders + 1 skipped file. Run with `npm test`.
- **Dev server:** not running. Start with `npm run dev` → http://localhost:5173/.

## How we collaborate

Read in order: `DESIGN.md` → `ARCHITECTURE.md` → `ROADMAP.md`. Then follow `ROADMAP.md`'s conventions strictly:

- **One step at a time.** Don't merge steps for efficiency.
- **Test before continuing.** Each step has a verify note.
- **Checkpoints are mandatory stops.** When you hit `**CHECKPOINT**`, surface the listed questions to the user — do NOT default silently.
- **Commit after each step** with a descriptive message (look at `git log` for examples).
- **Keep `DESIGN.md` / `ARCHITECTURE.md` honest.** If a step reveals a documented decision is wrong, update the doc in the same commit.
- **One step → one or a few small files.** Avoid wide refactors unless the roadmap says to.

See also: `TESTING.md` for the testing policy (`core`/`sim`/`run` get tests, `render`/`ui` get visual verify).

## Things that bit us — DON'T re-litigate

These hard-won fixes will look weird out of context. Don't "clean them up" without understanding why they exist.

1. **`scene.background = new THREE.Color(TERMINAL_BLACK)`, not `setClearColor`.** The clear-color path through the EffectComposer's HalfFloat render targets lands at a value that makes the palette-quant pass snap to `DARK_TERMINAL_AMBER`. Some color-management handoff that bypasses scene.background. Lives in [src/render/Renderer.ts](src/render/Renderer.ts). Commit `8491daa`.
2. **`OutputPass` at the END of the composer chain.** Custom `ShaderPass`es don't auto-convert linear → sRGB at the canvas blit; `OutputPass` does. Without it, every color displays as its linear value re-interpreted as sRGB (TERMINAL_GREEN `#33FF00` showed as `#08FF00`). Commit `fb5e878`.
3. **Palette quantization uses a color-key approach.** The shader detects background pixels by exact RGB match to the cleared background, passes them through, and quantizes the rest over a palette that **excludes `TERMINAL_BLACK`**. This is what stops dark terrain from snapping to the background color and "punching a hole." Commit `2857c91`.
4. **`Math.random()` is banned in `src/sim/` and `src/run/`** (ESLint enforced). Use the `RNG` from `src/core/RNG.ts`; thread instances explicitly. Per-battle randomness via `parentRng.fork()` so battle dice don't perturb the run stream.
5. **Author durations in seconds, not ticks.** Use `secondsToTicks` / `ticksToSeconds` from `src/config.ts`. Changing `TICK_RATE` shouldn't require re-tuning balance — that's the contract.

## Active dev affordances (all marked `TODO(roadmap-5.3)`)

These get removed at Step 5.3 — listed in `TODO.md`:

- `OrbitControls` (mouse-orbit/zoom)
- `Stats` panel top-right (FPS/MS/MB)
- 5 fixed test sprites + 1 orbiter — set up in `Game.ts`, deleted at Step 3.2 when real units take over
- Keypresses: `s` spawn random sprite, `d` despawn last spawned, `q` toggle post-process pipeline
- Hardcoded seed `12345` in `Game.ts` for the terrain — Run takes over the seed at Step 4.3
- `[clock] tick N` console log every 10 ticks

## Project shape

```
src/
  main.ts              # entry; top-level await on FontAtlas.create()
  Game.ts              # top-level orchestrator
  config.ts            # TICK_RATE=10, GRID_SIZE=12, secondsToTicks/ticksToSeconds
  core/
    RNG.ts             # mulberry32, fork(), pick(), int(); 12 tests
    EventBus.ts        # typed pub/sub; 9 tests
    Clock.ts           # fixed-timestep accumulator; 7 tests
    events.ts          # GameEvents catalog (typed event payloads)
    types.ts           # GridCoord, Vec2
  sim/                 # STUBS — Phase 3 fills these in
    World.ts, Unit.ts, Pathfinding.ts, Targeting.ts, archetypes.ts
    behaviors/{Movement,Attack,Death}Behavior.ts
  run/                 # STUBS — Phase 4
    Run.ts, NodeMap.ts, Recruitment.ts
  render/
    Renderer.ts        # WebGLRenderer + EffectComposer + RAF loop
    FontAtlas.ts       # canvas2d glyph atlas → THREE.CanvasTexture
    SpriteRenderer.ts  # InstancedBufferGeometry + custom shaders
    TerrainRenderer.ts # fBm-displaced plane + palette shader
    PostProcess.ts     # palette-quantization ShaderPass factory
    palette.ts         # COLORS table (sRGB hex)
    animation/SpriteAnimator.ts  # stub (Step 3.6)
  ui/                  # STUBS — Phases 4–5
    HUD.ts, MapScreen.ts, RecruitScreen.ts, GameOverScreen.ts, ui.css

tests/
  smoke.test.ts                       # vitest + module resolution
  integration/determinism.test.ts     # 6 it.todo() — Phase 3 fills these in
```

Co-located `*.test.ts` next to source for unit tests. Integration tests under `tests/`.

## Next step: 3.1 — `World` skeleton

From `ROADMAP.md`:

> Define `World` with: grid dimensions (12×12), unit list (empty for now), current tick (0), and an `RNG` instance. Implement `tick()` as a no-op that increments the counter and emits the `tick` event. Wire `Game` to construct a `World` and call `tick()` from the clock.
>
> **Verify:** `tick` events fire from the world; tick counter advances.

Practically: right now `Game` increments `tickCount` inline in the Clock callback and emits `tick` directly. Step 3.1 lifts that logic into `World.tick()`.

Files involved:
- [src/sim/World.ts](src/sim/World.ts) — currently `export {};`, needs the class.
- [src/Game.ts](src/Game.ts) — construct `World`, change the Clock callback to `() => world.tick()`.
- Possibly a test for `World.tick()` advancing the counter (pure logic — fits the testing policy).

`World` needs the `EventBus` (to emit `tick`) and an `RNG` — both come in via constructor injection from `Game`. See ARCHITECTURE.md §"`World`".

After 3.1 is **Step 3.2** (`Unit` + archetypes + `BattleRenderer` translator), which culminates in **CHECKPOINT 4** about grid-to-world coordinate mapping.

## Pre-flight (run before starting 3.1)

```bash
git log --oneline -5    # confirm latest commit is 2857c91 (color-key fix)
npm test                # 34 passed + 6 todo
npm run dev             # opens at :5173 — verify scene renders correctly
```

In the browser, you should see: dark terrain plane, 5 colored sprites at the row level, 1 amber `@` orbiting above. Toggle `q` to confirm palette quantization works. Press `s` to spawn random sprites.

## Toolchain versions

- Node 25.5, npm 11.8
- TypeScript 6.0.3, Vite 8.0.13
- three.js 0.184.0, simplex-noise 4.0.3, @fontsource/jetbrains-mono 5.2.8
- vitest 4.1.6, ESLint 10.4.0, typescript-eslint 8.59.3, prettier 3.8.3

## Existing memories

- `feedback_context_estimates.md` — don't fabricate context-window %s; use qualitative terms or trust the user's actual number.
