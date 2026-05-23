# ROADMAP — Post-MVP

The build order after MVP shipped at CHECKPOINT 7. Companion to
[DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[TODO.md](TODO.md), and the MVP roadmap (now at
[archive/mvp-roadmap.md](archive/mvp-roadmap.md)).

Synthesized from `feedback.md`, `TODO.md`, and
[retro/post-mvp-review.md](retro/post-mvp-review.md). Once you've read this,
`feedback.md` is fully absorbed and can be deleted.

## Conventions

Less rigid than the MVP roadmap. Post-MVP habits (from
[HANDOFF.md](HANDOFF.md)):

- **Commit per logical change**, not per session.
- **Surface tradeoffs** before non-obvious calls.
- **Browser-verify visual work at native resolution.** Preview MCP
  screenshots are unreliable for sub-pixel detail.
- **Keep DESIGN.md / ARCHITECTURE.md honest.** Update docs in the same
  commit as the code that invalidates them.

"Decision points" (rather than mandatory CHECKPOINTs) flag user-input
moments — palette direction, naming, design tradeoffs. Stop and ask.

---

## Phase A — Foundation refactors

These touch load-bearing seams in sim, render, and infra. Landing them
*before* gameplay expansion (Phase C) avoids fighting array-order
behavior priority, hard-coded stats, and DOM-only screens forever after.

### A1 — Action selector + cooldown/duration split + multi-tick effects

Bundled because all three touch the same call sites
([World.tick()](src/sim/World.ts), `Behavior.update`, `Unit.actionCooldown`).
One disruptive refactor is cheaper than three.

- Replace [src/sim/Unit.ts](src/sim/Unit.ts) `behaviors` array-order
  priority with an explicit selector. Each candidate action scores or
  vetoes itself; unit picks the highest-scoring valid action.
- Split the cooldown concept:
  - **Action cooldown** — ticks before the *same* action can fire again.
  - **Action duration** — ticks before *any* action can fire next. Captures
    "this action takes time to perform" (windup + recovery). For movement
    and basic attack these are equal, hence the existing shared
    `actionCooldown`. New actions (charge, channel) will set them
    independently.
- Support multi-tick action effects: an action may schedule execution at
  ticks `start + k` for one or more k > 0, not only `start`. Charge-up
  attacks, delayed AoEs, "hits twice over 3 ticks" become expressible.

Test: extend [tests/integration/determinism.test.ts](tests/integration/determinism.test.ts)
with a fixture that includes a multi-tick action; add a cooldown-cadence
contract test (the retro flagged that idle-frame stutter went uncaught
because tests asserted ticks-in-isolation, not cadence-relative-to-lerp).

**Decision point A1:** before implementing, confirm
- naming: `cooldown` vs `duration` clear enough, or pick different words?
- whether to introduce an `Action` interface as a first-class noun, or
  keep `Behavior` and let it produce `Action` candidates internally.

### A2 — Headless input + serialization plumbing ✓ LANDED

Unlocks both in-battle commands (C5) and save/load + fuzz testing (A3).

- Typed `RunCommand` channel + `RunDispatcher` interface in
  [src/run/Command.ts](src/run/Command.ts). Synchronous dispatch.
  `enterNode` / `chooseRecruit` / `resetRun` replaced their bus-event
  imperatives; bus now carries only past-tense notifications.
- Typed `WorldCommand` channel in [src/sim/Command.ts](src/sim/Command.ts).
  Queued, drained at top of `World.tick()` (deterministic apply-point).
  Currently a placeholder — C5 fills in the actual command kinds.
- `World.toJSON` / `World.fromJSON` and `Run.toJSON` / `Run.fromJSON` —
  end-to-end JSON round-trip. RNG state, per-unit cooldowns,
  `activeAction`, NodeMap, phase, encounter, offer, visited set.
  Behaviors rehydrate via `kind` registry
  ([src/sim/behaviors/registry.ts](src/sim/behaviors/registry.ts));
  Actions via `id` registry
  ([src/sim/actions/registry.ts](src/sim/actions/registry.ts)) with
  `toData()`/`fromData()` on each Action class.
- [tests/integration/snapshot-roundtrip.test.ts](tests/integration/snapshot-roundtrip.test.ts)
  asserts mid-battle snapshot → restore continues the event trace
  byte-identically with the un-roundtripped baseline.

Save/load UI deliberately deferred until C6 (see "What we're explicitly
NOT doing yet").

### A3 — Headless fuzz harness ✓ LANDED

Phase C content needs empirical balance data; this is its substrate.

- [tests/fuzz/Strategy.ts](tests/fuzz/Strategy.ts) — `FuzzStrategy`
  interface (`pickNextNode`, `pickRecruit`). Both methods receive a
  read-only `Run` view and a strategy-scoped RNG.
- Two strategies shipped:
  - [PureRandomStrategy](tests/fuzz/strategies/PureRandom.ts) — every
    choice is a uniform draw. The no-information baseline.
  - [GreedyStrategy](tests/fuzz/strategies/Greedy.ts) — recruit prefers
    the archetype with the lowest current count, breaks ties randomly.
- [harness.ts](tests/fuzz/harness.ts) `runOne(seed, strategy)` drives a
  Run end-to-end headlessly: hot-loops `World.tick()` between phase
  transitions, captures per-battle stats + recruit history, returns a
  `RunResult`. Hangs are detected at `maxTicksPerBattle` (default 1000)
  and surfaced as `outcome: 'hang'`.
- [reporters.ts](tests/fuzz/reporters.ts) — CSV summary + per-failure
  markdown trace. Pure functions; the CLI writes to disk.
- [cli.ts](tests/fuzz/cli.ts) — `npm run fuzz` entry point. Writes
  `tests/fuzz/output/summary.csv` + `tests/fuzz/output/failures/*.md`.
  Args: `--count=N`, `--seed=N`, `--strategy=name`, `--out=path`.
- [vitest.fuzz.config.ts](vitest.fuzz.config.ts) +
  [harness.test.ts](tests/fuzz/harness.test.ts) — opt-in smoke test via
  `npm run fuzz:smoke`. Default `npm test` excludes `tests/fuzz/**` so
  pre-commit stays fast.
- Shared `spawnTeam` / `spawnEncounter` extracted into
  [src/sim/battleSetup.ts](src/sim/battleSetup.ts) so Game and the
  harness can't drift on formation rules.

MVP baseline at 10 seeds × 2 strategies: both at 50% win rate, average
floor 3.6, no hangs. Recruit picks barely move the needle at 4-floor
scope — data point for the C6 tuning conversation.

### A4 — Config externalization ✓ LANDED

Pulled tunables out of TS so balance and shader edits don't require
hunting through source.

**Balance JSON.** Four files in `config/` cover the tunables that were
spread across `src/sim/archetypes.ts`, `src/run/Run.ts`,
`src/run/Recruitment.ts`, and `src/run/NodeMap.ts`:

- [config/archetypes.json](config/archetypes.json) — per-archetype stat
  bands (hp, attackDamage, attackRange, cooldowns) + glyph.
- [config/difficulty.json](config/difficulty.json) — `enemySizeDelta`,
  `enemyHpPerFloor`.
- [config/recruitment.json](config/recruitment.json) — starting team
  composition, default offer size.
- [config/nodemap.json](config/nodemap.json) — floor count, middle-
  floor width band, total-node cap, out-degree cap.

Each JSON has a matching `src/config/*.ts` module: imports the JSON,
validates it via zod, exports the parsed value with strict TS types.
Validation runs at module load — malformed JSON crashes at boot with a
readable zod trace.

**Shader files.** Shader sources moved out of TS string literals into
`src/render/shaders/*.glsl`:

- `fullscreen-pass.vert.glsl` — shared by the three post-process passes.
- `palette.frag.glsl`, `dither.frag.glsl`, `scanlines.frag.glsl` — the
  three post-process fragment shaders.
- `billboard.vert.glsl`, `sprite.frag.glsl` — SpriteRenderer.
- `terrain.vert.glsl`, `terrain.frag.glsl` — TerrainRenderer.

Loaded via Vite's `?raw` imports. The palette fragment carries
`__PALETTE_SIZE__` / `__BLACK_INDEX__` placeholders substituted at
module load by `substituteShaderConstants` — GLSL ES 1.00 needs
integer literals for array bounds.

Browser-verified: full run flow plays, no GL errors, no console errors,
all 146 tests still pass, prod build clean.

### A5 — Scene system ✓ LANDED

Closed out Phase A. Speculative (no feature was pulling on it yet) but
landed because Phase A wanted to ship as a coherent foundation pass —
deferring further would just have meant retouching the same files when
the first 3D-outside-battle feature arrived.

- [src/scenes/Scene.ts](src/scenes/Scene.ts) — `Scene` interface
  (`mount(ctx) / tick(dt) / dispose()`) + `SceneContext` bundle (bus,
  scene3D, sprites, terrain, fontAtlas, uiMount, dispatcher, run).
- Single-active swap (not a stack — current usage doesn't need overlays,
  and HUD is naturally a child of BattleScene). Easy upgrade to a stack
  later if a real overlay use-case appears.
- Four scenes:
  [BattleScene](src/scenes/BattleScene.ts) wraps World + Clock +
  BattleRenderer + HUD;
  [MapScene](src/scenes/MapScene.ts) /
  [RecruitScene](src/scenes/RecruitScene.ts) /
  [GameOverScene](src/scenes/GameOverScene.ts) wrap the matching DOM
  screens with no 3D content. `tick(dt)` is a no-op on the DOM-only
  scenes.
- [Game.ts](src/Game.ts) became a Scene swapper: subscribes to
  `battle:started` / `recruit:offered` / `run:victory` / `run:defeated`
  and drives `swap(newScene)`. Renderer's RAF callback now goes
  `(dt) => activeScene?.tick(dt)` — so the simulation Clock lives inside
  BattleScene and ticks only during battle.
- HUD gained a `dispose()` (unsubscribes from bus + fadeOutAndRemove)
  because it's per-battle now instead of a Game-lifetime singleton.

---

## Phase B — Style and visual direction

Mostly independent of Phase A and of each other. Order by what you want
to look at first.

### B1 — Palette experiment ("Tron shift") ✓ LANDED

Decision-point demo built (4-variant side-by-side: strict / hue-locked /
sat-clamped / hue-locked+bloom). User picked: drop palette-quant
entirely. The `COLORS` table stays the canonical vocabulary in code, but
no shader enforces it post-hoc.

UnrealBloomPass's high-pass patched to `max(R,G,B)` so red glows on
equal footing with green (gotcha #29). **B1.1 follow-up** refactored
this into selective bloom: two `EffectComposer`s, a layer-0 visible
mesh and a layer-1 bloom mesh sharing the same instance buffers.
[SpriteRenderer](src/render/SpriteRenderer.ts)'s `bloomIntensity`
attribute (default 1.0) multiplies the bloom-buffer contribution only,
so 0 = no halo (sprite still visible at natural color), 1 = natural
halo, >1 = forced glow. Visible color and halo strength are independent
— B3 HP-bar fill, C2 mage charge-up, and the existing attack flash can
all ramp the attribute smoothly without ever darkening the sprite.

Gotchas #1, #3, #4 retired; #29 (max-channel bloom) and #30 (selective
bloom architecture + per-instance `bloomIntensity`) added.

### B2 — Low-poly 3D asset style → FOLDED INTO C1

Originally: more deliberate low-poly direction for 3D assets, with a
decision point on flat vs smooth shading and on wall/obstacle look.

Folded into C1 because every concrete sub-question (terrain mesh
style, wall form, sprite-stays-billboard) is something C1 will
rewrite. Tuning standalone would just need redoing. See the C1
"Visual style" subsection below.

### B3 — Floating per-unit HP bars + action progress bar ✓ LANDED

New `BarRenderer` mirrors the SpriteRenderer instancing recipe —
single `InstancedBufferGeometry` quad with per-instance position /
size / fillPct / bgColor / fillColor / alpha, billboarded by
[bar.vert.glsl](src/render/shaders/bar.vert.glsl), shader-cutoff
fill in [bar.frag.glsl](src/render/shaders/bar.frag.glsl). Single
mesh on layer 0 — bars don't participate in the selective-bloom
pass (user-picked direction; visual budget stays on the sprites).

Two bars per unit driven by [BattleRenderer](src/render/BattleRenderer.ts).
HP bar refreshes on `unit:attacked` and lerps fill color
green→amber→red as a universal HP-state gradient (team identity is
already on the sprite color). Progress bar hidden by default, fills
smoothly between sim ticks for in-flight actions; movement is
explicitly skipped via an `action.id === MOVE_ACTION_ID` short-
circuit so 1-tick move steps don't flash the bar every step (the
progress bar pulls its real weight once C2's mage charge-ups land).
Per-frame position-follow via new
`SpriteRenderer.getPosition(handle, out)`. On death both bars fade
alpha 1→0 in lockstep with the sprite over 0.3s and get removed;
`BattleRenderer.detach()` also drains in-flight bar fades so the
killing-blow victim's bars don't leak onto the next scene.

### B4 — Bake grid + tighten vertical layout → FOLDED INTO C1

Originally: bake grid lines into the terrain fragment shader; reduce
`PLANE_BASE_Y` / `SPRITE_Y` gaps so the diorama feels flush.

Folded into C1 because C1 replaces the terrain mesh wholesale (the
grid IS the tile boundaries under C1) and the vertical layout is
only worth tuning once the terrain has its final height profile.
See the C1 "Layout" subsection below.

### B5 — Scanlines extending over DOM UI ✓ LANDED

Replaced the canvas-only scanline ShaderPass with a single
`#scanlines` `<div>` (position: fixed, inset: 0, pointer-events:
none, z-index: 1000) layered over canvas + UI. One source of truth,
runs uniformly across the canvas/DOM seam, no possible drift
between parallel effects. Two intentional shifts from the previous
shader: CSS-pixel sizing (6px dark / 6px light) instead of device-
pixel (so high-DPI displays don't read the lines as uniform
dimming), and dual-polarity intensity (dark bands subtract
`rgba(0,0,0,0.15)`, light bands lift `rgba(255,255,255,0.04)`) so
scanlines have visible contrast on near-black panel surfaces — the
original pure-darkening was invisible on the map / recruit / HUD
panel backgrounds (~0.7-0.8 black). The `createScanlinePass`
factory + `scanlines.frag.glsl` stay in
[PostProcess.ts](src/render/PostProcess.ts) /
[shaders/](src/render/shaders/) as dormant code so the revert is a
one-line addPass restore.

### B6 — Audio ✓ LANDED

New [AudioPlayer](src/audio/AudioPlayer.ts) preloads seven wavs from
`public/audio/` at boot and exposes overlap-safe `play(key)` — each
sound owns a 4-deep ring of cloned `HTMLAudioElement`s with a cursor
that advances on every play, so multi-unit attacks on the same tick
don't truncate each other.

Wiring split by lifetime. **Page-lifetime** subscriptions live on
Game (recruit:offered → recruit, run:victory → win, run:defeated →
lose); **world-aware** subscriptions live on BattleScene because
unit:attacked needs `world.findUnit(attackerId).stats.attackRange`
to pick melee vs shoot, and unit:died wants to fire while the world
is still alive. BattleScene gains a subscriptions array + dispose
unsub, same pattern as HUD / BattleRenderer / Run.

UI clicks (MapScreen frontier, RecruitScreen card pick, GameOverScreen
restart) fire `click.wav` directly from the existing click handlers;
AudioPlayer threaded through each screen via SceneContext.

Per-sound pitch jitter via `playbackRate` (±10% for melee/shoot, ±8%
for death, 0 for one-shots like click/recruit/win/lose) prevents the
ear locking onto a single tone during sustained combat without needing
variant samples — shifting pitch + tempo together keeps the waveform
intact. One-shots stay flat because variance on something you only
hear once reads as inconsistency, not life.

Volume + variance tables sit at the top of AudioPlayer.ts for tuning.
HTMLAudioElement was sufficient for our scope; revisit Web Audio API
if we ever need spatialization, detune-without-tempo-shift, or precise
scheduling.

### B7 — Root node clarity ✓ LANDED

Node 0 renders the roguelike `@` glyph instead of `0`, with a
`.root` CSS class hook in [MapScreen.ts](src/ui/MapScreen.ts) for
future tuning. All other state classes (current / frontier /
visited / locked) still apply on top, so the root reads as origin
regardless of where the player currently is. Uses `map.rootId`, not
hardcoded 0.

---

## Phase C — Gameplay expansion

**Hard prerequisite:** A1 (action selector) before any of these. A4
(config externalization) before C2/C3. A3 (fuzz harness) before C6.

### C1 — Tile-based terrain with obstacles (+ B2 visual + B4 layout)

Replace "terrain is decoration" with a grid of tile types. Each tile
type has properties: passable / blocking, optional movement cost
modifier, optional combat modifier (cover, damage bonus, etc.). Walls
and obstacles populate the arena per encounter seed.

Now also absorbs the deferred B2 + B4 scope (see notes under those
headings above). Worth sub-phasing into three:

- **C1a — Tile system + flat geometry. ✓ LANDED.** Per the user's
  design call, walls are neutral-team `Unit`s (not a `TileKind`) —
  reuses the existing Unit pipeline (pathfinding blockers, snapshot
  rehydration, sprite rendering) and leaves the door open for
  destructible walls + healing shrines + hazards without a new
  abstraction. Tiles are surface properties (`floor` |
  `shallow_water`, the latter doubling movement cost). New
  `config/terrain.json` + zod schema; procedural generator with a
  `layoutId` hook plumbed for C1b's hand-authored library.
  WorldSnapshot bumped to v2 with `tileGrid`. Water visual was a
  flat-colored InstancedMesh stand-in in `src/render/WaterRenderer.ts`
  at C1a; C1c replaced it with per-tile water inside the new
  `TerrainRenderer`. Pathfinding gained an optional `CostFn`;
  Chebyshev stays admissible since cost >= 1.
  Foundation commit `4572d8a`, integration commit followed.
- **C1b — Walls and obstacles. ✓ LANDED.** Three commits:
  *ranged LOS through walls* (`bc8c5d8`) — new
  [`hasLineOfSight`](src/sim/LineOfSight.ts) (Bresenham);
  AttackBehavior collects neutral-team units as blockers and
  abstains when the line is broken (melee passes trivially);
  *destructibility plumbing* (`8f71818`) — `unit:died` gains a
  `team` field so subscribers can branch on neutral deaths;
  `spawnWall` takes optional `maxHp`; BattleScene's audio handler
  skips neutral deaths so wall destruction doesn't play the unit
  death cry. No Targeting changes — wall destructibility is
  dormant until C2's AoE archetypes land damage on neutral cells;
  *layout library + 50/50 mix* (`dd1e1fa`) — two starter
  layouts in [`src/sim/layouts.ts`](src/sim/layouts.ts) (corridor +
  diamond); `generateTerrain` dispatches on `layoutId`; `Run`
  rolls 50/50 between procedural and a uniform pick from
  `LAYOUT_IDS`. Wall *visual form* (3D vs billboard) deliberately
  punted to C1c — locking it under C1b would mean retuning under
  C1c's broader visual pass.
- **C1c — Visual style + layout pass ✓ LANDED** (folded from B2 +
  B4). Two commits: *demo* (`f61b0f5`) shipped three side-by-side
  variants (flat + grid bake, faceted low-poly, stepped simplex)
  swappable on hotkeys 1 / 2 / 3 during a live battle; *lock-in*
  (`526520d`) picked variant B (faceted low-poly) and replaced the
  old fBm `TerrainRenderer` + C1a `WaterRenderer` stand-in with a
  single canonical `TerrainRenderer`. One prism per tile, fixed-
  seed simplex heights for floor in [-0.3, 0], water tiles sunk to
  -0.4, top color lerps `DARK_TERMINAL_GREEN → DARK_TERMINAL_AMBER`
  over the floor range. Hard-edged faceted shading from a baked
  light direction in `terrain.frag.glsl` (no scene lights — sprites
  stay unlit). Grid line stamped on the top face only.

  `TerrainRenderer.heightAt(cx, cy, kind)` is the canonical height
  function and is exposed for sprite-Y alignment.
  `BattleRenderer.tileWorldPos(coord)` threads it through both spawn
  AND lerp endpoints, so sprites and walls stand on their actual
  tile top instead of floating at the pre-C1c fixed plane — and
  units moving across height seams get a smooth Y-interpolated path
  via the existing SpriteAnimator lerp.

  User picked variant B over C because stepped's terraces hinted at
  a mechanical elevation tier the sim doesn't (and won't) deliver,
  while faceted's organic variance reads as visual texture without
  making that gameplay promise.
- **C1d — Layout authoring: JSON config + editor.** C1b ships two
  hand-coded layouts in [src/sim/layouts.ts](src/sim/layouts.ts);
  growing the library past a handful means hoisting them to a
  config file and giving us a way to author new ones without
  hand-counting cell coordinates.

  Two parts that can land together or separately:

  - **C1d.A — Hoist to JSON.** Move wall + water coords out to
    `config/layouts.json` matching the A4 pattern (zod schema in
    `src/config/layouts.ts`, validation at module load,
    malformed-JSON crashes at boot). [`src/sim/layouts.ts`](src/sim/layouts.ts)
    becomes a thin wrapper exporting `LAYOUTS` / `LAYOUT_IDS` from
    the validated config. Independent of C1c; could be pulled
    forward if useful.
  - **C1d.B — Editor.** A small dev tool for painting new layouts
    on a 12×12 grid. Click toggles wall, shift-click toggles water,
    reserved spawn rows shown as a tinted overlay. Save produces a
    JSON snippet ready for `config/layouts.json`. Should include a
    connectivity warning when the layout severs the board and a
    test-play button that swaps the painted layout into a battle.

  **Decision points for C1d:**
  - Where the editor lives: separate route in the existing Vite
    app (e.g. `?editor` URL flag, swap Game for editor view),
    standalone HTML page in `tools/`, or behind a dev-only build
    flag. Tradeoff: in-app shares the 3D renderer (free preview)
    but bloats the production bundle unless gated; standalone is
    cleaner but duplicates setup.
  - Output mode: export-only (editor produces JSON, author pastes
    into the config file) vs direct-write (tiny Vite middleware
    writes the file on save). Direct-write is a tighter authoring
    loop but only works in local dev.
  - Whether layouts gain metadata fields beyond the cell grid —
    `name`, `description`, picker weight, floor-depth gating, etc.
    Easier to add the schema slot now than to rev later.
  - Whether the editor preview uses the game's 3D renderer or a
    simpler 2D CSS grid. 2D is faster to build and easier to debug;
    3D matches what the player will see. Could start 2D and add a
    preview pane.

Pathfinding ([src/sim/Pathfinding.ts](src/sim/Pathfinding.ts)) already
takes blockers; the integration cost is mostly in encounter generation
and the renderer.

**C1c decision-point resolutions:** terrain visual direction →
*faceted low-poly* (procedural-from-simplex, hard-edged faces);
wall form → *billboarded `#` glyph* (the C1a/C1b default stays);
sprites → *2D billboards* (locked, no change). Stepped simplex
was tabled because its terraces implied a mechanical elevation
tier the sim doesn't model.

### C2 — New archetypes: mage, rogue, healer

Enabled by A1 (none of these fit the move-or-attack mental model).
Sketches — refine during impl:
- **Mage** — slow charge-up attack, AoE or long range. Uses multi-tick
  action.
- **Rogue** — fast attack speed, low HP, kites between attacks. New
  action: post-attack reposition.
- **Healer** — avoids combat; heals lowest-HP ally in range each cycle.

**Decision point C2:** glyph assignments (`M`/`a`/`m`/`r`/`h`? lowercase
`m` vs uppercase `M` ambiguity?). Update the
[FontAtlas](src/render/FontAtlas.ts) glyph set.

### C3 — Recruitment refactor: draft from pool + rarity

Feedback: random stat rolls are too unconstrained. Shift to drafting
from a pool of pre-defined unit types with rarity tiers.

- Pool grows as we add archetypes (C2 unlocks the variety).
- Rarity tiers: common (base archetypes), uncommon (mage, healer), rare
  (specialist variants). Offer composition weighted by floor depth.
- Existing "guarantee at least one melee + one ranged" rule generalizes
  to "guarantee role diversity" — define carefully when C2 has landed.

### C4 — Unit upgrade / leveling system

After C3 stabilizes. Sketch: post-battle option to level an existing
unit instead of (or in addition to) recruit. Levels grant +stats and
possibly +abilities at thresholds. Needs A4 for level curves.

**Decision point C4:** level vs recruit as exclusive choice or both per
battle? Tied to how steep the difficulty curve is at C6.

### C5 — Limited in-battle commands

Enabled by A2. Targetless commands (switch to defensive AI, retreat) and
single-target commands (focus this enemy, hold this location).

**Decision point C5:** how many command uses per battle? Cost gating
(cooldown, charges, none)? Interaction with difficulty.

### C6 — Multi-map / longer runs

Expand each map to 10 floors. Multiple maps per run. Target ~1 hour per
run.

Hard prerequisite: A3 (fuzz harness) — difficulty scaling will need
empirical tuning. The current `enemy.length = playerSize - 1` and `+5%
HP per floor` formula works for 4-floor MVP runs; it won't survive
40+ floors without tuning.

**Decision point C6:** terminology for the multi-map structure. "Acts"?
"Regions"? Inter-map transitions and persistent state (HP carry-over?
recruit availability?).

### C7 — (Speculative) Split battles + meta-health

User-flagged: each combat as a series of smaller battles drawing
subsets of the team, with wins/losses depleting a meta-health pool.
Deckbuilder-roguelike inspiration.

Tabled until C6 lands and we can see whether snowballing is still a
problem at longer-run scale. Large design surface — don't build
speculatively.

---

## Cleanup / chores

Not gated; can land any time.

- **Pathfinding directional tie-break.** [TODO](TODO.md) — units crab
  leftward on equal-cost ties.
- **`world.findUnit` O(n).** Retro flagged. Add `Map<id, Unit>` alongside
  the array. Cheap when it starts to bite (probably during C6).
- **Favicon.** [TODO](TODO.md). Inline SVG glyph.
- **`.gitattributes`** to normalize line endings. Stops the CRLF warnings
  on every commit (retro item).
- **Bundle chunk-size warning.** Bump `chunkSizeWarningLimit` in
  [vite.config.ts](vite.config.ts), or code-split three.js if it gets
  noisy.

---

## What we're explicitly NOT doing yet

- **Save/load UI.** A2 lays the plumbing; the actual "load this saved
  run" UX is deferred until C6 (long enough runs that save matters).
- **Replay system.** Free once A2 lands; build the UI when there's a
  reason (shareable seeds, bug repros).
- **Generic status-effect system.** A1 will support multi-tick effects
  technically. Resist building a generic status system until C2 reveals
  what's actually needed.
- **Boss / elite encounters.** Deferred until C3 + C6 stabilize the
  recruit/depth surface.
