# ROADMAP.md

The MVP build order. Each step is small enough to test in isolation. Many steps end with an explicit **CHECKPOINT** where Claude Code should stop, summarize what's been built, and ask the user before proceeding — these are the places where design decisions tend to surface that weren't visible in advance.

## Conventions

- **One step at a time.** Don't merge steps for "efficiency." The point is frequent testable increments.
- **Test before continuing.** Each step has a "verify" note describing what the user should see/do to confirm it works. Don't move to the next step until verified.
- **Checkpoints are mandatory stops.** When you hit a `**CHECKPOINT**` marker, *stop* and surface the listed questions to the user. Do not silently default.
- **Defer over-engineering.** If a step tempts you to add structure for a future need, write it down as a comment or a `TODO.md` entry instead of building it.
- **Keep `DESIGN.md` and `ARCHITECTURE.md` honest.** If a step reveals that a documented decision is wrong, update the doc *in the same commit* as the code change.

---

## Phase 0 — Project setup

### Step 0.1 — Scaffold the project

Initialize a Vite + TypeScript project. Install `three`, `simplex-noise`, dev dependencies (`@types/three`, ESLint, Prettier). Set up `tsconfig.json` with strict mode. Create the folder structure from `ARCHITECTURE.md`, with empty placeholder files where helpful. Configure ESLint to flag direct `Math.random()` usage in `src/sim/` and `src/run/`.

**Verify:** `npm run dev` starts Vite without errors. Opening the page shows a blank canvas. ESLint runs clean.

### Step 0.2 — Bootstrap the render loop

Create `Game.ts` and `Renderer.ts`. Set up a `WebGLRenderer`, a `PerspectiveCamera` positioned at the planned fixed angle (~45° down), a `Scene`, and a `requestAnimationFrame` loop. Clear color: `TERMINAL_BLACK`. Add a single placeholder mesh (a wireframe cube at origin) just to confirm rendering works. Add `OrbitControls` *temporarily* for dev convenience — we'll remove before MVP ships.

**Verify:** A wireframe cube renders on a black background. FPS counter (browser devtools) shows steady framerate.

---

## Phase 1 — Core engine primitives

### Step 1.1 — `RNG`

Implement the seeded RNG (mulberry32 is fine — small, fast, good enough). Include `next`, `int`, `pick`, and `fork`. Write a tiny test (just a script, no test framework needed) that demonstrates: same seed → same sequence; `fork()` produces an independent stream that's also deterministic.

**Verify:** Run the test script, confirm output is identical across runs.

### Step 1.2 — `EventBus`

Implement the typed event bus. Define a `GameEvents` type with the events from `ARCHITECTURE.md` (just the type shapes; nothing emits them yet).

**Verify:** Compiles. Manual smoke test: subscribe to an event, emit it, confirm handler fires.

### Step 1.3 — `Clock` and fixed-timestep loop

Implement the accumulator-based fixed-timestep clock. Wire it into `Game`. For now, the "tick" just emits a `tick` event and logs the tick number every 10 ticks.

**Verify:** Console shows ticks accumulating at ~10/sec regardless of render framerate. Try blocking the main thread briefly — when it unblocks, the clock catches up by running multiple ticks in one frame.

**CHECKPOINT 1.** Confirm with user:
- Tick rate of 10Hz feels right? (Easy to change; surfaced now because it affects unit stat tuning later.)
- Anything to add to the event catalog before we start using it?

---

## Phase 2 — Rendering primitives

### Step 2.1 — Font atlas

Build `FontAtlas.ts`. At startup, render a fixed set of glyphs (`M`, `a`, `@`, plus digits and a few punctuation marks for HUD use later) onto a canvas2d in a monospace font, in white. Upload the canvas as a `THREE.Texture`. Expose a `getGlyphUV(glyph: string): { u0, v0, u1, v1 }` lookup.

**Verify:** Render the atlas texture to a plane in the scene temporarily. Glyphs are crisp, well-spaced, and the lookup returns sensible UVs.

### Step 2.2 — `SpriteRenderer`: static sprites

Build `SpriteRenderer.ts` with a single `InstancedMesh` of quads. Instanced attributes: `instancePosition` (vec3), `instanceGlyphUV` (vec4), `instanceColor` (vec3), `instanceAlpha` (float). Vertex shader: standard billboard math (cancel camera rotation). Fragment shader: sample the atlas with `instanceGlyphUV`, multiply by `instanceColor`, output with `instanceAlpha`. Implement `addSprite`, `removeSprite`, but **no updates yet** — keep it simple.

Add 5 sprites at random positions to confirm it works.

**Verify:** Five glyphs render in 3D space, billboarded toward the camera (try moving the OrbitControls camera; they should always face you). Colors are correct per-instance.

### Step 2.3 — `SpriteRenderer`: dynamic updates

Implement `updateSprite`. Confirm you can change a sprite's position, color, and alpha after creation. Confirm `removeSprite` correctly compacts the instance buffer and decrements the active count.

**Verify:** Animate one sprite in a circle via `updateSprite` calls from the render loop. Spawn and despawn sprites with a keypress; instance count is correctly maintained.

**CHECKPOINT 2.** Confirm with user:
- Glyph appearance / font choice acceptable?
- Sprite scale relative to grid (which doesn't exist yet) — eyeball check before we lock dimensions?

### Step 2.4 — `TerrainRenderer`

Generate a subdivided plane (e.g. 64×64 segments) sized to the planned grid. Displace vertices in the vertex shader (or CPU-side at generation; either is fine for static terrain) using seeded simplex noise. Fragment shader: color by height and slope, quantized to dark palette variants (`DARK_TERMINAL_GREEN`, `DARK_TERMINAL_AMBER`, `DARK_FLOURESCENT_BLUE`).

**Verify:** Terrain renders under the sprites. Same seed produces the same terrain.

### Step 2.5 — Post-process pipeline

Wire up `EffectComposer`. Add a `RenderPass` followed by a custom palette-quantization pass that snaps every output pixel to the nearest color in the palette. This is the always-on pass. Leave hooks for scanlines/dither but don't implement them yet — note as `TODO`.

**Verify:** Whole scene now visibly snaps to palette. Compare side-by-side with composer disabled to confirm the effect is doing something.

**CHECKPOINT 3.** Confirm with user:
- Overall look — does the rendering vibe match the intended aesthetic? This is the last cheap moment to course-correct before gameplay layers on top.
- Should we add scanlines / dither now, or defer until after gameplay works?

---

## Phase 3 — Simulation: the battle loop

### Step 3.1 — `World` skeleton

Define `World` with: grid dimensions (12×12), unit list (empty for now), current tick (0), and an `RNG` instance. Implement `tick()` as a no-op that increments the counter and emits the `tick` event. Wire `Game` to construct a `World` and call `tick()` from the clock.

**Verify:** `tick` events fire from the world; tick counter advances.

### Step 3.2 — `Unit` and archetypes

Define `Unit` and `Behavior` per `ARCHITECTURE.md`. Define `archetypes.ts` with melee and ranged stat bounds and a `rollUnit(archetype, rng)` function. Add a `spawnUnit(template, team, position)` method to `World`.

Spawn 5 player melees and 5 enemy melees at fixed positions on the grid. Have `World` emit a sprite for each via `unit:spawned` — but actually, this is where the simulation/render seam matters: a `BattleRenderer` class subscribes to `unit:spawned` and tells `SpriteRenderer` to create a sprite. The sim doesn't call `SpriteRenderer` directly.

**Verify:** 10 sprites appear on the grid in the correct grid-aligned world positions. Player units green, enemies red. They don't do anything yet.

**CHECKPOINT 4.** Confirm with user:
- Grid → world coordinate mapping (cell size, where origin sits, etc.) looks right?
- The `BattleRenderer`-as-translator pattern is what we want for keeping sim and render separate?

### Step 3.3 — `Pathfinding`

Implement A* on the grid as a pure function: `findPath(start, goal, blockers, gridSize): GridCoord[]`. No behaviors use it yet. Write a tiny test that pathfinds around a few blockers.

**Verify:** Test passes. Pathfinding handles "no path" gracefully (returns empty array).

### Step 3.4 — `Targeting`

Implement nearest-enemy targeting as a pure function: `findTarget(unit, world): Unit | null`. Chebyshev distance, ties broken by lowest HP, deterministic for equal HP (e.g. by unit id).

**Verify:** Test with a contrived `World` state.

### Step 3.5 — `MovementBehavior`

Implement `MovementBehavior`. On each tick where the move cooldown has elapsed: find target (if any), compute path to a cell within attack range, move one step along the path, reset cooldown. Emit `unit:moved` with `from`, `to`, and `durationTicks` (= move cooldown). The simulation updates `unit.position` *instantly* on the tick — the event tells the renderer how long to animate.

Wire this behavior onto all spawned units. For now, sprites still teleport (we haven't built the animator yet).

**Verify:** Units snap-move toward each other across the grid each tick. Two opposing teams converge.

### Step 3.6 — `SpriteAnimator`

Subscribe to `unit:moved`. Convert tick durations to seconds. Start a lerp from the old cell's world position to the new cell's world position over that duration. Each frame, update active lerps and push interpolated positions to the `SpriteRenderer`. On completion, snap to final position.

**Verify:** Units now glide smoothly between cells instead of teleporting. Movement reads as continuous even though the sim is discrete.

### Step 3.7 — `AttackBehavior`

Implement `AttackBehavior`. On each tick where the attack cooldown has elapsed and a target is within range: deal damage, emit `unit:attacked`, reset cooldown. Add a brief shader flash on the attacker (color → white for 2 ticks) so attacks are visible.

**Verify:** Units stop when adjacent to an enemy and visibly attack. HP decreases (log to console; HUD comes later).

### Step 3.8 — `DeathBehavior`

Implement death. When `currentHp <= 0`, emit `unit:died`, remove from world. Renderer subscribes and fades the sprite out (alpha lerp over ~0.3s) before removing it.

**Verify:** Units die when their HP hits zero, fade out cleanly, and are removed.

### Step 3.9 — Battle end condition

Detect when one team is fully eliminated. Emit `battle:ended` with the winner. For now, just log it and freeze the world.

**Verify:** A battle plays out to completion and `battle:ended` fires with the correct winner. Try several seeds — outcomes vary but are deterministic per seed.

**CHECKPOINT 5.** Confirm with user:
- Battle pacing — too fast, too slow, about right? This is when we tune `TICK_RATE` and the per-archetype cooldown bounds.
- Stat bounds for melee vs. ranged producing interesting fights?
- Anything visually missing from combat (clearer attack indicator, damage numbers, etc.)?

---

## Phase 4 — Run structure

### Step 4.1 — `NodeMap` generation

Implement DAG generation. Layered structure: N floors, each floor has 1–4 nodes, edges connect nodes between adjacent floors with some branching density. Root and terminal are single nodes. Seeded from the run RNG. All nodes are battle nodes for MVP.

Write a quick text-based dump (`console.log` an ASCII representation) to verify structure.

**Verify:** Generated maps look reasonable: connected, layered, branchy but not chaotic. Same seed → same map.

### Step 4.2 — `MapScreen` UI

Build the node map UI in plain HTML/CSS. Render nodes as positioned `<div>`s with SVG edges between them. Highlight the current node and the accessible frontier. Clicking an accessible node fires a `run:nodeEntered` event.

**Verify:** Map renders, you can click a frontier node, the event fires.

### Step 4.3 — `Run` state machine

Implement `Run`. Owns the current map, player team, position. Wire `Game` to switch between `MapScreen` and battle view based on run state. On entering a battle node, generate a battle (forked RNG, enemy team scaled to floor depth in a trivial way for MVP — e.g. enemy count = floor + 4).

**Verify:** Start a run → see map → click a node → battle plays out → currently freezes at end (next step handles transition).

### Step 4.4 — Victory and recruitment

On `battle:ended` with player winning: show `RecruitScreen` with 2–3 randomly rolled unit options. Player picks one; it's added to their team. Then return to `MapScreen`, with the chosen node marked completed and the new frontier updated.

**Verify:** Win a battle → see 3 unit choices → pick one → return to map with the new unit in the team. Next battle has the new unit.

### Step 4.5 — Defeat and run reset

On `battle:ended` with enemy winning: show `GameOverScreen`. Button to start a new run with a fresh seed.

**Verify:** Lose a battle → see game over → start new run → fresh map, fresh team.

### Step 4.6 — Run completion

When the player reaches the terminal node and wins: show a "run complete" version of `GameOverScreen`.

**Verify:** Play through to the terminal node, win, see the completion screen.

**CHECKPOINT 6.** Resolved:
- Map size and branching density: keep 5 floors / 8–10 nodes / 2–3 wide.
- Recruit offers: 3 cards, but each offer guarantees at least one melee + one ranged so the choice is never archetype-locked.
- Difficulty: enemy team size = `playerTeam.length - 1` (keeps the player marginally ahead, no snowball amplification); enemy `maxHp × (1 + 0.05 × floor)` so deeper battles toughen up. Stat-roll bounds otherwise shared.

---

## Phase 5 — HUD and polish

### Step 5.1 — In-battle HUD

Build the HUD: current floor, both team rosters with HP bars, current tick (optional, debug). Subscribe to relevant events to keep it live.

**Verify:** HUD updates in real time during battles.

### Step 5.2 — Map → battle transitions

Add a brief fade transition between screens so context changes don't feel abrupt. CSS animations on the UI layer are sufficient.

**Verify:** Transitions feel smooth.

### Step 5.3 — Remove dev affordances

Remove `OrbitControls`, debug logs, debug overlays. Lock the camera to the intended fixed angle.

**Verify:** Game looks like a game, not a dev build.

### Step 5.4 — Pass on post-process polish

Implement the deferred scanlines / dither passes if not already done. Tune intensity.

**Verify:** Final look matches the intended aesthetic.

**CHECKPOINT 7 — MVP REVIEW.** Stop and demo to user end-to-end. Confirm:
- Loop feels complete?
- Anything that should be in MVP that isn't?
- What's the top-priority post-MVP item to plan for next?

---

## After MVP

Refer to the "Out of scope" list in `DESIGN.md` for the post-MVP backlog. Don't start picking those up until the user explicitly chooses what's next — many of them interact (e.g. shop nodes assume an economy assumes synergies-worth-buying), so they need to be sequenced together.
