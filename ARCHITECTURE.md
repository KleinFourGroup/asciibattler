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
  Game.ts                    # Top-level orchestrator: owns Renderer/Bus/Run; scene swapper (A5)
  config.ts                  # Engine constants: TICK_RATE=10, GRID_SIZE=12, secondsToTicks
                             # (balance lives in config/*.json — see src/config/)

  core/
    EventBus.ts              # Tiny typed pub/sub; on() returns unsub
    RNG.ts                   # Mulberry32 PRNG; .next/.int/.pick/.fork
    Clock.ts                 # Fixed-timestep tick loop separated from render loop
    events.ts                # GameEvents catalog (typed event payloads)
    types.ts                 # Shared primitives: Vec2, GridCoord

  config/                    # A4: zod-validated wrappers around config/*.json
    archetypes.ts            #   E1: melee + ranged glyph + attackRange + baseStats
    difficulty.ts            #   enemy size delta + per-floor HP scale
    recruitment.ts           #   starting team + offer size
    nodemap.ts               #   floor count + width bands + degree cap
    terrain.ts               #   C1a: wall + water density
    layouts.ts               #   C1d.A: hand-authored layout array (incl. spawns, halfCovers, chasms, fires, healings, theme)
    spawn.ts                 #   D5.C: SpawnAction lockout duration
    tiles.ts                 #   D7.B: fire/healing chip rates → tick cadences
    stats.ts                 #   E1: hpPerConstitution, crit cap + mult, base cooldowns, cdPerStat, minCdScale
    schemas.ts               #   shared zod helpers

  sim/
    World.ts                 # Battle state: grid + units + tick. tick() runs the selector,
                             # overflow scan, tile-effect pass, reapDead, checkBattleEnd.
                             # Serializable; WorldSnapshot v6 (C1a v2, D3 v3, D5.C v4, D6 v5, E1 v6)
                             # E1: added `combatRng` (forked from `rng`) for AttackAction crit rolls
    Unit.ts                  # Unit + UnitTemplate + UnitStats + UnitDerived + Team + Behavior
                             # archetype: 'melee' | 'ranged' | 'environment' (E1)
                             # actionCooldowns Map + activeAction + blocksLineOfSight (D6)
    stats.ts                 # E1: deriveStats / inertDerived / basicAttackDamage / ZERO_STATS
                             # — pure functions; crit RNG rolls happen at AttackAction.start
    TileGrid.ts              # Tile kinds: floor | shallow_water | chasm | fire | healing
                             # Per-cell movement cost; chasm = Infinity (data-driven block)
    LineOfSight.ts           # Bresenham line walk for ranged-attack LOS (C1b)
    Action.ts                # Action / ActionProposal / ActiveAction interfaces (A1)
                             # + toData()/fromData for snapshot rehydration (A2)
    Command.ts               # WorldCommand union — drained at tick boundary (A2)
    Pathfinding.ts           # A* king's-move, Chebyshev heuristic, optional CostFn (C1a)
    Targeting.ts             # findTarget — nearest enemy, ties by HP then id; skips neutrals
    archetypes.ts            # melee/ranged/rogue archetypes, rollUnit, glyphForArchetype
    environment.ts           # spawnWall + spawnHalfCover (D6) — neutral-team env factories
    terrainGen.ts            # Per-encounter procedural tile + wall generator; layout dispatch
    layouts.ts               # Thin re-export of validated config (LAYOUT_IDS for Run's roll)
    battleSetup.ts           # Shared applyTerrain/spawnTeam/spawnEncounter
    actions/
      MoveAction.ts          # Logical position update + unit:moved event
      AttackAction.ts        # E1: start-time crit roll via world.combatRng → damage + unit:attacked
                             # event (with `crit` flag)
      SpawnAction.ts         # Pure-lockout action seated on D5.C overflow-queue spawns
      GambitStrikeAction.ts  # E7.A: rogue strike — AttackAction damage + free reposition
      registry.ts            # Action factories keyed by Action.id (A2)
    behaviors/
      MovementBehavior.ts    # proposeAction → MoveAction when out of range
                             # Splits neutrals into pathBlockers + losBlockers (D6)
      AttackBehavior.ts      # proposeAction → AttackAction when in range + LOS
      registry.ts            # Behavior factories keyed by Behavior.kind (A2)

  run/
    Run.ts                   # State machine: map|battle|recruit|defeat|complete
                             # + dispatch(RunCommand) + toJSON/fromJSON (A2)
                             # RUN_SCHEMA_VERSION 2 (D8 added BattleEncounter.theme)
    Command.ts               # RunCommand union + RunDispatcher interface (A2)
    NodeMap.ts               # DAG generation + dump
    Recruitment.ts           # rollOffer with archetype-variety guarantee

  render/
    Renderer.ts              # WebGLRenderer + two EffectComposers (selective bloom, B1.1)
                             # + RAF loop + two camera modes (fit / scroll, D4)
    SpriteRenderer.ts        # InstancedBufferGeometry + dual mesh (layer 0 visible / layer 1
                             # bloom) + per-instance bloomIntensity attr (B1.1) + per-instance
                             # size attr (E6.B). Also hosts transient ranged tracer sprites (0.6×)
    UnitOverlayLayer.ts      # E3.6: DOM per-unit overlays (HP bar + action progress + level
                             # badge), positioned via projectToCss. E6.C: spawnHitsplat floats
                             # transient damage/crit/heal/burn numbers via the same projector
    TerrainRenderer.ts       # C1c: faceted low-poly prism-per-tile, heightAt is canonical
                             # for sprite Y. D7.C: per-tile flicker/pulse + chasm sink + theme
    BattleRenderer.ts        # Sim/render seam: subscribes to unit:* events
                             # tileWorldPos(coord) for per-tile sprite Y (C1c). E6: routes
                             # attacks to melee shove / ranged projectile + spawns hitsplats
    FontAtlas.ts             # canvas2d glyph atlas → THREE.CanvasTexture (E6.B: + `*` tracer)
    PostProcess.ts           # SatClamp + Bloom + BloomMix factories (B1.1)
                             # Scanlines retained as dormant code; CRT lines now run via CSS (B5)
    shaders/                 # .glsl source files loaded via Vite ?raw imports (A4)
    palette.ts               # COLORS table — TERMINAL_STONE added for neutrals (C1a)
    animation/
      SpriteAnimator.ts      # Lerps + fades (fromAlpha/toAlpha for D5.C fade-in) + E6.A shove
                             # channel (there-and-back lunge) + onComplete on lerp (E6.B)

  scenes/                    # A5: Scene system — single-active swap driven from Game
    Scene.ts                 #   Scene interface + SceneContext bundle
    BattleScene.ts           #   World + Clock + BattleRenderer + HUD + per-battle audio
    MapScene.ts              #   DOM-only, wraps MapScreen
    RecruitScene.ts          #   DOM-only, wraps RecruitScreen
    GameOverScene.ts         #   DOM-only, wraps GameOverScreen

  ui/
    ui.css
    fade.ts                  # fadeIn / fadeOutAndRemove — shared screen transitions
    HUD.ts                   # In-battle HUD: floor, rosters, banner (per-battle, A5)
    MapScreen.ts             # Node map view + frontier click → dispatch enterNode
    RecruitScreen.ts         # 3-card recruit offer → dispatch chooseRecruit
    GameOverScreen.ts        # defeat / complete variants → dispatch resetRun

  audio/
    AudioPlayer.ts           # B6: 4-deep clone ring per sound; per-key volume + pitch jitter

config/                      # A4: balance JSON source of truth (paired with src/config/*.ts)
  archetypes.json            # E1: per-archetype glyph + attackRange + baseStats
  difficulty.json
  recruitment.json
  nodemap.json
  terrain.json
  layouts.json
  spawn.json
  tiles.json
  stats.json                 # E1: hpPerConstitution, crit cap/mult, base cooldowns,
                             #     cdPerStat, minCdScale

public/
  audio/                     # B6: preloaded .wav files (click, melee, shoot, death, win, ...)

tools/                       # Dev-only; not bundled into dist/
  layout-editor/             # C1d.B → D2/D5.D/D6/D7.C/D8: layout painter
                             # at /tools/layout-editor/ via Vite dev server

tests/
  smoke.test.ts
  integration/               # determinism, snapshot-roundtrip, variable-size,
                             # layout-deadlock, spawn-overflow, etc.
  fuzz/                      # A3: headless balance harness (opt-in CLI)

retro/
  scratchpad.md              # rolling process notes
  post-mvp-review.md         # CHECKPOINT 7 retrospective

archive/                     # historical: mvp-roadmap, mvp-feedback, post-mvp-roadmap, c1-feedback

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
  readonly kind: string;     // registry key for snapshot rehydration (A2)
  proposeAction(unit: Unit, world: World): ActionProposal | null;
}

class Unit {
  readonly id: number;
  readonly team: 'player' | 'enemy' | 'neutral';   // 'neutral' for env entities (C1a)
  readonly glyph: string;
  readonly stats: UnitStats;
  position: GridCoord;
  currentHp: number;
  readonly behaviors: Behavior[];
  readonly blocksLineOfSight: boolean;             // D6 — true for combatants/walls; false for half-cover
  readonly actionCooldowns: Map<string, number>;   // A1 — per-action, keyed by Action.id
  activeAction: ActiveAction | null;               // A1 — set while an action is in flight
}
```

Color is *not* on `Unit` — that's a renderer-side concern. `BattleRenderer` maps `team` → palette color so the simulation has no opinions about visuals.

Each `World.tick()` runs an **action selector** (A1): polls every behavior's `proposeAction`, filters proposals whose action is still on cooldown (`unit.actionCooldowns.get(id) > 0`), and picks the highest-scoring valid proposal. The chosen `Action` runs its lifecycle (`start` → effect ticks → finish), and while `unit.activeAction != null` the selector short-circuits. For single-tick actions (move, attack) the cooldown and duration coincide — preserving the MVP feel — but charge-ups and channels diverge them. Behaviors are stateless across ticks. New unit kinds add or swap behaviors rather than subclassing.

Death is handled inline at the top of `World.tick`'s per-unit loop (no `DeathBehavior` — folded into the tick itself at A1). A separate `reapDead()` pass runs after the D7.B tile-effect pass so fire-kills end the battle on the same tick.

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
unit:spawned            { unitId: number; instant: boolean }                       # instant=false → D5.C overflow-queue spawn (fade-in)
unit:moved              { unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }
unit:attacked           { attackerId: number; targetId: number; damage: number }
unit:burned             { unitId: number; damage: number }                         # D7.B: per-tick chip from fire tile (no attacker)
unit:healed             { unitId: number; amount: number }                         # D7.B: per-tick chip from healing tile (emits amount=0 at maxHp)
unit:died               { unitId: number; team: Team }                             # team carried because the unit is already spliced out (C1b)
run:started             { seed: number }
run:victory             { }
run:defeated            { }
recruit:offered         { units: UnitTemplate[] }
```

`src/core/events.ts` is the authoritative type definition — when these drift, the source file wins. Naming convention: `subject:verbed`, past-tense. Bus events are past-tense notifications only; anything imperative goes through the command channel below.

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
   - Call `SpriteAnimator.update(dt)` to advance in-flight visual lerps + fades
   - Render scene through two `EffectComposer`s (selective bloom, B1.1)
2. The scene contains:
   - One faceted-prism terrain mesh (`TerrainRenderer`, C1c) — also the canonical source of per-tile Y via `heightAt`
   - One `InstancedMesh` for all sprites (`SpriteRenderer`) — actually two meshes sharing one geometry: layer 0 visible, layer 1 bloom (B1.1)
   - One `InstancedMesh` for HP + action progress bars (`BarRenderer`, B3)
   - No per-unit `Object3D`s. Ever. This is the performance contract.
3. **Bloom** is selective via two composers (B1.1): `bloomComposer` renders the layer-1 bloom mesh through `UnrealBloomPass` (max-channel high-pass, not Rec.709 — gotcha #29) into an offscreen RT; `mainComposer` renders the layer-0 visible mesh, then folds the bloom RT in additively via `MixPass`. Sat-clamp + `OutputPass` finish the chain. Per-instance `bloomIntensity` decouples halo strength from visible color: 0 suppresses, 1 is natural, >1 forces.
4. **CRT scanlines** are a CSS `<div>` overlay (`#scanlines`), not a post-process pass (B5). One source of truth across the canvas/DOM seam.
5. **Palette quantization is GONE** (retired at B1). The `COLORS` table is art-direction discipline now, not shader enforcement. Gotchas #1/#3/#4 retired as a consequence.

## What's deliberately not abstracted yet

A few things would be over-engineering at the current scope; flagging them so we know what we're choosing not to build:

- **No ECS library.** Behaviors-on-units is enough structure for the foreseeable game. If the unit count explodes or behaviors get genuinely many-to-many, we revisit.
- **No asset loader.** The font atlas is generated at startup synchronously; audio preloads from `public/audio/` via `AudioPlayer`'s constructor.
- **No save/load UI yet.** A2 lays the JSON serialization plumbing (`World.toJSON` / `Run.toJSON`); UI for choosing a save slot and resuming a run waits until C6 makes runs long enough that save matters.
- **No generic status-effect system.** A1's multi-tick effects can carry one, and D7.B added per-tick tile effects with a targeted hook (fire damage, healing). Resist building a generic status system until C2 reveals what's actually needed beyond these.
