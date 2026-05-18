# ARCHITECTURE.md

How the code is organized and why. The companion to `DESIGN.md` (what we're building) and `ROADMAP.md` (in what order).

## Tech stack

- **Language:** TypeScript (strict mode)
- **Renderer:** three.js
- **Build/dev server:** Vite
- **Lint/format:** ESLint + Prettier
- **Tests:** Vitest (shares Vite config; covers `core`, `sim`, `run` only — render/UI are eyeball-verified). See `TESTING.md` for conventions and the determinism contract.
- **Dependencies (runtime):** `three`, `simplex-noise` (for terrain + map gen)
- **Dependencies (dev):** `vite`, `vitest`, `typescript`, `@types/three`, `eslint`, `prettier`

No frameworks beyond that. UI is plain HTML/CSS overlaid on the canvas via absolutely positioned DOM. No React, no state-management library.

## Guiding principles

1. **Simulation and rendering are separate.** The simulation is a pure, deterministic state machine driven by ticks. The renderer reads from simulation state and animates. The simulation never imports from the renderer; the renderer subscribes via the event bus and reads from world snapshots.

2. **Determinism is structural.** Anything that consumes randomness takes an `RNG` instance as an argument. There is no global `Math.random()` in simulation code. This is enforced by lint where practical and by review otherwise.

3. **Composition over inheritance for units.** A `Unit` has a `behaviors: Behavior[]` array. Each `Behavior` implements `update(dt, unit, world)`. New unit kinds are new behavior combinations, not new subclasses. Keeps unit definitions data-shaped and trivial to serialize later.

4. **The renderer hides three.js details from gameplay.** Gameplay code calls `spriteRenderer.addSprite(...)` and gets back an opaque handle. It never touches `InstancedMesh`, `BufferAttribute`, or shader uniforms directly. This is the contract that lets us swap the renderer implementation (e.g. to WebGPU) without touching simulation.

5. **Loose coupling via events for outputs; a command channel for inputs.** Notifications of what *happened* (`unit:died`, `battle:started`, `battle:ended`, `tick`) flow through the typed `EventBus`. Player intent — entering a node, picking a recruit, resetting the run, future in-battle commands — flows through a separate typed `Command` channel (`RunCommand` on `Run`, `WorldCommand` on `World`). The bus is fire-and-forget pub/sub; the channel is a deterministic apply-point. Mixing the two breaks both replay-trace stability and the past-tense reading of bus events.

6. **Serializable world state.** The `World` (battle state) and `Run` (meta state) are JSON-serializable end-to-end. `World.toJSON` / `World.fromJSON` and `Run.toJSON` / `Run.fromJSON` capture every field that affects determinism (RNG state, tick count, per-unit HP/cooldowns/activeAction, pending command queue, NodeMap, team, phase, encounter, offer, visited set). The snapshot-roundtrip test in `tests/integration/snapshot-roundtrip.test.ts` asserts that a deserialized World continues to produce a byte-identical event trace compared to the un-roundtripped baseline.

## Top-level structure

```
src/
  main.ts                    # Entry point: bootstraps Game, mounts canvas, kicks off run
  Game.ts                    # Owns renderer, scene, camera, clock, current screen
  
  core/
    EventBus.ts              # Tiny pub/sub; ~20 LOC
    RNG.ts                   # Seeded PRNG (mulberry32 or similar); takes a seed, returns deterministic stream
    Clock.ts                 # Fixed-timestep tick loop separated from render loop
    types.ts                 # Shared primitives: Vec2, GridCoord, Handle, etc.
  
  sim/
    World.ts                 # Battle state: grid, units, current tick. Serializable.
    Unit.ts                  # Unit class + behavior composition machinery
    behaviors/
      MovementBehavior.ts    # Pathfinding + move cooldown
      AttackBehavior.ts      # Targeting + attack cooldown + damage
      DeathBehavior.ts       # HP <= 0 handling
    Pathfinding.ts           # A* on the grid; pure function of (start, goal, blockers)
    Targeting.ts             # Nearest-enemy resolution; pure function
    archetypes.ts            # MVP unit archetypes (melee, ranged) and stat-roll functions
  
  run/
    Run.ts                   # Meta state: current map, player team, position on map
    NodeMap.ts               # DAG generation + traversal
    Recruitment.ts           # Post-battle unit-offer generation
  
  render/
    Renderer.ts              # Wraps WebGLRenderer + EffectComposer; owns the render loop
    SpriteRenderer.ts        # InstancedMesh of billboarded ASCII quads; addSprite/updateSprite/removeSprite
    TerrainRenderer.ts       # Procedural plane with displaced verts and palette shader
    BattleRenderer.ts        # Sim/render seam: subscribes to unit:* events, drives SpriteRenderer
    FontAtlas.ts             # Generates the monospace glyph atlas via canvas2d at startup
    PostProcess.ts           # EffectComposer setup; palette quantization, scanlines, dither
    shaders/
      billboard.vert.glsl
      sprite.frag.glsl
      terrain.vert.glsl
      terrain.frag.glsl
      palette.frag.glsl      # Post-process palette quantization
    palette.ts               # The COLORS enum; single source of truth for the palette
    animation/
      SpriteAnimator.ts      # Lerps sprite positions between grid cells; reads sim state
  
  ui/
    ui.css
    HUD.ts                   # In-battle HUD: round state, team rosters
    MapScreen.ts             # Node map view + node selection
    RecruitScreen.ts         # Post-battle unit choice
    GameOverScreen.ts        # Defeat / run complete
  
  config.ts                  # Tunable constants: TICK_RATE, GRID_SIZE, archetype stat bounds, etc.

index.html                   # Mounts <canvas> + <div id="ui">
vite.config.ts
tsconfig.json
eslint.config.js             # Flat config (ESLint 9+); bans Math.random() in src/sim and src/run
.prettierrc
```

## Key abstractions

### `RNG`

```ts
class RNG {
  constructor(seed: number);
  next(): number;           // [0, 1)
  int(min: number, max: number): number;  // inclusive
  pick<T>(arr: T[]): T;
  fork(): RNG;              // returns a new RNG seeded deterministically from this one
}
```

`fork()` is the key method. When we generate a battle, we fork an RNG for that battle from the run's RNG. That way the battle's randomness doesn't perturb later run-level randomness, and we can re-run a single battle without re-running the whole sequence.

### `EventBus`

```ts
class EventBus<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void;
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;
}
```

Typed events keyed by name. Returns an unsubscribe function. We define a single `GameEvents` type that enumerates every event in the system — keeps the catalog discoverable.

### `Clock`

Drives the simulation at a fixed tick rate (10Hz) decoupled from render framerate. Standard fixed-timestep accumulator pattern: render loop runs at requestAnimationFrame, accumulates real time, and calls `world.tick()` zero or more times per frame to catch up.

Gameplay code never hardcodes tick counts. Cooldowns, durations, and timers are authored *in seconds* and converted through `secondsToTicks(s)` / `ticksToSeconds(t)` in `src/config.ts`. Changing `TICK_RATE` is a one-line change that re-discretizes the sim without re-tuning balance.

### `Unit` and `Behavior`

```ts
interface Behavior {
  update(unit: Unit, world: World): void;
}

class Unit {
  id: number;
  team: 'player' | 'enemy';
  glyph: string;
  stats: UnitStats;
  position: GridCoord;       // current cell
  behaviors: Behavior[];
  currentHp: number;
  // ... more runtime state as behaviors land: cooldowns, current target, etc.
}
```

Color is *not* on `Unit` — that's a renderer-side concern. `BattleRenderer` maps `team` → palette color so the simulation has no opinions about visuals.

Behaviors run on each `World.tick()` (the sim is fully discrete; behaviors don't take real-time `dt`). For MVP, every unit has `[MovementBehavior, AttackBehavior, DeathBehavior]`. New unit kinds post-MVP add or swap behaviors rather than subclassing.

### `World`

The battle state. Owns the grid, the unit list, the current tick, and the RNG for this battle. Exposes `tick()` which advances simulation by one tick and emits events. Serializable to JSON.

### `SpriteRenderer`

```ts
class SpriteRenderer {
  addSprite(glyph: string, color: Color, position: Vec3): SpriteHandle;
  updateSprite(handle: SpriteHandle, opts: { position?: Vec3; color?: Color; glyph?: string; alpha?: number }): void;
  removeSprite(handle: SpriteHandle): void;
}
```

Internally manages a single `InstancedMesh` with instanced attributes for `position`, `glyphIndex`, `color`, `alpha`. Adding/removing sprites updates the instance buffers and the active count. The shader handles billboarding and atlas sampling.

### `SpriteAnimator`

Bridges simulation and rendering. Subscribes to `unit:moved` events and starts a lerp from the old cell to the new cell over the move-cooldown duration. Per frame, it interpolates every active lerp and pushes positions to the `SpriteRenderer`. Owns visual transient state (in-flight lerps, fade-outs) that has no place in the simulation.

## Event catalog (outputs)

```
tick                    { tick: number }
battle:started          { worldSeed: number }
battle:ended            { winner: 'player' | 'enemy' }
unit:spawned            { unitId: number }
unit:moved              { unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }
unit:attacked           { attackerId: number; targetId: number; damage: number }
unit:died               { unitId: number }
run:started             { seed: number }
run:victory             { }
run:defeated            { }
recruit:offered         { units: UnitTemplate[] }
```

This list will grow; events are cheap to add. The naming convention is `subject:verbed`. Bus events are past-tense notifications only — anything imperative goes through the command channel below.

## Command catalog (inputs)

Two channels, both typed unions defined in their respective `Command.ts`:

```
RunCommand (synchronous; Run.dispatch / RunDispatcher)
  enterNode               { nodeId: number }
  chooseRecruit           { unitTemplate: UnitTemplate }
  resetRun                { }

WorldCommand (queued; drained at top of tick)
  noop                    { }     # C5 fills this in
```

UI screens hold a `RunDispatcher` (Game implements it) and call `dispatcher.dispatch(cmd)`. The headless harness (A3) and any future replay system call the same entry points, so a saved input stream replays identically. Pending `WorldCommand`s are part of the `WorldSnapshot` — a save mid-battle preserves intent.

## Rendering pipeline

1. `Renderer` drives `requestAnimationFrame`. Each frame:
   - Compute real `dt` since last frame
   - Pass `dt` to `Clock`, which calls `world.tick()` zero or more times to keep sim time aligned with real time
   - Call `SpriteAnimator.update(dt)` to advance in-flight visual lerps
   - Render scene through `EffectComposer`
2. The scene contains:
   - One terrain mesh (`TerrainRenderer`)
   - One `InstancedMesh` for all sprites (`SpriteRenderer`)
   - No per-unit `Object3D`s. Ever. This is the performance contract.
3. Post-process passes apply palette quantization (always on) and configurable extras (scanlines, dither).

## What's deliberately not abstracted yet

A few things would be over-engineering at MVP scope; flagging them so we know what we're choosing not to build:

- **No ECS library.** Behaviors-on-units is enough structure for the foreseeable game. If the unit count explodes or behaviors get genuinely many-to-many, we revisit.
- **No scene/screen manager class.** `Game.ts` switches between `BattleScreen`, `MapScreen`, etc. with simple if/else for MVP. If we add more screens, we extract a state machine.
- **No asset loader.** No assets to load. The font atlas is generated at startup synchronously.
- **No save/load UI yet.** A2 lays the JSON serialization plumbing (`World.toJSON` / `Run.toJSON`); UI for choosing a save slot and resuming a run waits until C6 makes runs long enough that save matters.
