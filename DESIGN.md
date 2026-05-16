# DESIGN.md

The single source of truth for *what* we're building and *why* it feels the way it feels. Architectural and step-by-step concerns live in `ARCHITECTURE.md` and `ROADMAP.md` respectively.

## High concept

A browser-based autobattler with a Slay-the-Spire-style run structure. The player navigates a procedurally generated node graph, choosing encounters; each encounter resolves as a deterministic, tick-based battle on a square grid populated by billboarded ASCII units. The aesthetic riffs on classic roguelikes — terminal palette, monospace glyphs — but presented in 3D with heavy shader work for a "CRT-diorama" feel. Death ends the run.

## MVP scope

The MVP is **two teams of ASCII units auto-fighting on a 12×12 grid, with a minimal node-map shell wrapping the battles**. The point of including the node map at MVP is to validate the loop, not to deliver a full progression system.

Concretely, the MVP includes:

- A 12×12 grid battle arena rendered on procedurally generated terrain
- Tick-based combat at 10Hz with deterministic resolution from a seeded RNG
- Two unit archetypes — melee and ranged — with randomized stats (HP, speed, damage) drawn within archetype bounds
- Player team of 5 starting units vs. an enemy team of comparable strength
- Smooth visual lerping of units between grid cells (animation duration = move cooldown)
- Nearest-enemy targeting (Chebyshev distance, ties broken by lowest HP)
- A minimal node-map screen between battles — branching DAG of battle nodes only, no rest/shop nodes
- After each victory, the player is offered a choice of one new unit to add to their team
- Full run reset on player team defeat
- HTML/CSS UI overlay: round state, unit roster, basic node-map view

The MVP **excludes** (deferred to post-MVP): shop/economy, synergies/traits, rest nodes, elite/boss encounters, multiple unit sizes, high-level player commands, audio, persistence/save, camera rotation, line-of-sight, terrain affecting gameplay.

## The loop

1. Run starts. A node map is generated from the seed. Player has a starting team of 5 randomized units.
2. Player selects a node from the currently accessible frontier of the map.
3. Battle resolves on the 12×12 grid. Player watches; no input during battle for MVP.
4. On victory: player is offered a choice of one of N randomly generated units to recruit, then returns to the map.
5. On defeat: run ends; a new run is offered with a fresh seed.
6. Run completes when the player reaches the terminal node(s) of the map.

## Battle mechanics

**Tick rate:** 10Hz. The simulation is fully deterministic given a seed and an initial unit configuration.

**Authoring convention:** all cooldowns, durations, and timers in gameplay code are authored *in seconds* and converted to ticks via the `secondsToTicks` helper in `src/config.ts`. The simulation runs in ticks; the source of truth for balance is wall-clock seconds. Changing `TICK_RATE` re-discretizes the sim but leaves balance intact — a "0.5 s attack cooldown" stays 0.5 s in wall time regardless of tick rate.

**Grid:** 12×12, square cells, 8-directional adjacency (Chebyshev distance for range checks).

**Units:**
- Single-tile, omnidirectional (no facing).
- Block movement for both allies and enemies.
- Stats: `maxHp`, `currentHp`, `moveCooldown` (ticks between moves), `attackCooldown` (ticks between attacks), `attackDamage`, `attackRange`.
- Archetypes for MVP:
  - **Melee** (`M`): higher HP, higher damage, range 1, moderate speed.
  - **Ranged** (`a`): lower HP, moderate damage, range 3–5, moderate speed.
- Stat randomization stays within tight per-archetype bounds so battles remain readable.

**Targeting:** Nearest enemy by Chebyshev distance. Ties broken by lowest current HP. Re-evaluated each time a unit's attack cooldown elapses or its current target dies.

**Movement:** A* pathfinding to a cell within attack range of the current target. Units block pathing. If no path exists, the unit waits (1 tick) and retries. Logical move is instantaneous on the tick it occurs; the *visual* sprite lerps from the previous cell to the new cell over a duration equal to the move cooldown, snapping on arrival.

**Combat:** When a unit's attack cooldown elapses and a valid target is within range, it deals `attackDamage` instantly. No damage rolls in MVP — flat damage values. Death is immediate at HP ≤ 0; the sprite plays a brief fade-out shader effect and is removed.

**Win condition:** One team fully eliminated.

## Run structure

**Node map:** A directed acyclic graph generated from the seed. Roughly 10–15 nodes per run, arranged in layered "floors" with branching paths between them. Player starts at the single root, advances one layer at a time, and must reach the single terminal node to complete the run.

For MVP, *every node is a battle node*. Rest, shop, elite, and event nodes are deferred.

**Recruitment:** After each victory, the player is offered a choice between 2–3 randomly generated units (within the existing archetypes). They pick one to add to their team. Skipping is not an option in MVP.

**Defeat:** Full run reset. A new seed is rolled and a fresh map is generated.

## Aesthetic

**Reference palette** (from the user's previous game; serves as the starting vocabulary, not a hard constraint):

| Color | Use |
|---|---|
| `TERMINAL_BLACK` | Background, scene clear color, base terrain |
| `TERMINAL_GREEN` | Player units, friendly UI elements |
| `DARK_TERMINAL_GREEN` | Dimmed/idle player states, terrain tint |
| `TERMINAL_AMBER` | Primary UI (gold, timers, important callouts) |
| `DARK_TERMINAL_AMBER` | Secondary UI, dimmed states |
| `FLOURESCENT_BLUE` | Status effects, ability flashes, neutral highlights |
| `DARK_FLOURESCENT_BLUE` | Cooldown indicators, dimmed FX |
| `NEON_RED` | Enemy units, damage indicators |
| `DARK_NEON_RED` | Low-HP enemy states, defeated states |
| `NEON_PURPLE` | Reserved for rare/elite content post-MVP |

The fragment shader **quantizes all output to this palette** — no off-palette colors reach the screen. This is the single biggest stylistic lever and earns its keep cheaply.

**Sprites:** ASCII glyphs rendered to a monospace texture atlas at startup, then sampled per-instance on billboarded quads. The shader handles billboarding in the vertex stage. Each unit instance picks its glyph via an instanced attribute.

**Glyphs (MVP):**
- `M` — melee unit
- `a` — ranged unit (lowercase, classic roguelike convention)
- `@` — reserved for the player-protagonist concept post-MVP

Color per instance is also an instanced attribute so a single draw call covers all units of all teams.

**Terrain:** A subdivided plane with vertex displacement from seeded simplex noise. Colored in the fragment shader by height and slope, quantized to dark palette variants. Decorative only for MVP — does not affect movement or combat.

**Post-processing:** `EffectComposer` is wired up from the start with at least one pass. MVP target effects include subtle scanlines, light dithering, and palette quantization. The pipeline being in place from day one means adding more passes (bloom, chromatic aberration, CRT curvature) later is a one-line addition rather than a refactor.

**Camera:** Fixed perspective, tilted ~45° down with a slight angle so the grid reads as a grid but billboards face the camera cleanly. Non-rotatable in MVP. Camera rotation is deferred along with larger maps.

## Determinism

A single seeded RNG instance is threaded through everything that involves randomness: map generation, unit stat rolls, recruitment offers, target tie-breaking. The same seed produces the same run, byte-for-byte. This is non-negotiable from day one — it makes replays, bug reports, and shareable seeds trivial to add later, and it keeps "deterministic spectacle" actually deterministic.

The RNG is *not* shared with anything visual (post-process noise, shader randomness) — those can use whatever they want, since they don't affect simulation state.

## Out of scope (post-MVP backlog)

Captured here so we can confidently say "not now" during the jam without losing the idea:

- Shop and economy (gold, buying units, rerolls)
- Unit synergies and traits
- Rest, shop, elite, and event node types
- Boss encounters at floor ends
- Larger units (2×2 or 2×1 footprints)
- High-level player commands during battle (focus-fire, avoid area, etc.)
- Audio and SFX
- Save/load and persistence
- Camera rotation and larger maps
- Line-of-sight for ranged units
- Terrain affecting movement or combat
- Status effects and abilities beyond basic attacks
- Replay system (the determinism work makes this cheap when we want it)
