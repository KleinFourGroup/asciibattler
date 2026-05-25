# HANDOFF — Post-MVP pickup

A fresh-session orientation for ASCIIbattler. Read this first; then dive into the docs only where they're called out.

## Where we are

- **MVP shipped** at CHECKPOINT 7 — deployed to GitHub Pages, full loop playable.
- **Phase 0** (project setup) ✓
- **Phase 1** (core primitives — RNG, EventBus, Clock) ✓
- **Phase 2** (rendering — FontAtlas, SpriteRenderer, TerrainRenderer, PostProcess) ✓
- **Phase 3** (battle simulation, 3.1–3.9) ✓
- **Phase 4** (run structure, 4.1–4.6) ✓
- **Phase 5** (HUD, fade transitions, dev-affordance cleanup, dither + scanline polish) ✓
- **Tests:** 229 passed, 0 `it.todo()`. Run with `npm test`.
- **Dev server:** not running. Start with `npm run dev` → http://localhost:5173/ (port 5174 if 5173 is held by a stale process — check with `Get-NetTCPConnection -LocalPort 5173`; remember Vite spawns child Node processes that survive `taskkill` on the parent).
- **Build:** `npm run build`. `vite.config.ts` uses `base: './'` so the same `dist/` works at any subpath.

## What's next

Post-MVP work is now structured around [ROADMAP.md](ROADMAP.md) (Phase A foundation refactors → B style/visual → C gameplay expansion). [TODO.md](TODO.md) holds the small follow-ups that aren't roadmap steps.

**Phase A complete: A1–A5 all landed.** A1 = action selector + cooldown/duration split + multi-tick effects. A2 = command channel + JSON snapshot plumbing. A3 = headless fuzz harness. A4 = config externalization (JSON balance + .glsl shaders). A5 = scene system (Scene interface, single-active swap, BattleScene + Map/Recruit/GameOver scenes).

**B1 landed (palette direction).** Side-by-side decision-point demo of 4 variants (strict / hue-locked / sat-clamped / hue-locked+bloom). User picked: drop palette-quant entirely (palette becomes art-direction discipline, not shader enforcement), keep saturation-clamp + bloom. UnrealBloomPass's high-pass is patched to use `max(R,G,B)` instead of Rec.709 luminance so NEON_RED enemies glow on equal footing with TERMINAL_GREEN allies. Gotchas #1, #3, #4 retired as a consequence.

**B1.1 landed (selective bloom).** Original B1 used a single composer where `bloomIntensity` multiplied the sprite color directly — `0` zeroed the visible sprite, so suppression and darkening were the same operation. Refactored to two composers: `bloomComposer` renders an invisible layer-1 sprite mesh (color × bloomIntensity) through UnrealBloomPass into an offscreen RT; `mainComposer` renders the visible layer-0 sprite mesh at natural color, then a `MixPass` additively folds the bloom RT in. Result: `bloomIntensity = 0` kills the halo without touching visible color; lerping 0↔1 smoothly fades the glow; `>1` forces a strong halo for emphasis. Bloom threshold dropped to 0 so intensity is a true linear knob (was step-gated at 0.6 — see gotcha #30).

**B3 landed (floating HP + action progress bars).** New `BarRenderer` mirrors the SpriteRenderer instancing recipe — one `InstancedBufferGeometry` quad, per-instance position/size/fillPct/bgColor/fillColor/alpha, billboarded by `bar.vert.glsl` with a shader-cutoff fill in `bar.frag.glsl`. Single mesh on layer 0; bars don't bloom (user-picked direction). Two bars per unit driven from `BattleRenderer`: HP fill lerps green→amber→red as a universal HP-state gradient (team identity is on the sprite color), refreshed on `unit:attacked`. Progress bar hidden by default, fills smoothly between ticks for in-flight actions, but skipped for `MoveAction` to avoid flashing every step (so it'll only really pull its weight once C2's mage charge-ups land). Bars follow sprites through SpriteAnimator lerps via a new `SpriteRenderer.getPosition(handle, out)` reader. On death both bars fade alpha 1→0 in lockstep with the sprite, then get removed; `detach()` also drains in-flight bar fades so the killing-blow victim's bars don't leak onto the next scene.

**B5 landed (CRT scanlines on DOM seam).** Replaced the canvas-only scanline ShaderPass with a single `#scanlines` fixed-position `<div>` layered over canvas + UI. One source of truth, runs uniformly across the canvas/DOM seam, no possible drift between two effects. Two intentional shifts from the previous shader: CSS-pixel sizing (6px / 6px) instead of device-pixel (so high-DPI displays don't read the lines as uniform dimming), and dual-polarity intensity (dark bands subtract `rgba(0,0,0,0.15)`, light bands lift `rgba(255,255,255,0.04)`) so scanlines have visible contrast on near-black panel surfaces — the original pure-darkening was invisible on the map / recruit / HUD panel backgrounds (~0.7-0.8 black). The `createScanlinePass` factory + `scanlines.frag.glsl` stay in `PostProcess.ts` / `shaders/` as dormant code so the revert is a one-line addPass restore.

**B7 landed (root node clarity).** Node 0 now renders the roguelike `@` glyph instead of `0`, with a `.root` CSS class hook for future tuning. All other state classes (current/frontier/visited/locked) still apply on top, so the root reads as origin regardless of where the player currently is. Uses `map.rootId`, not hardcoded 0.

**B6 landed (audio).** New `AudioPlayer` ([src/audio/AudioPlayer.ts](src/audio/AudioPlayer.ts)) preloads seven placeholder wavs from `public/audio/` at boot and exposes overlap-safe `play(key)` — each sound owns a 4-deep ring of cloned `HTMLAudioElement`s with a cursor that advances on every play, so simultaneous triggers (multi-unit attacks on the same tick) don't truncate each other. Wiring split by lifetime: Game subscribes to `recruit:offered` / `run:victory` / `run:defeated` (no world needed); BattleScene subscribes to `unit:attacked` (looks up attacker via `world.findUnit` and picks `melee` vs `shoot` from `stats.attackRange`) and `unit:died` — these live with the world so they tear down with it (subscriptions array + dispose unsub, same pattern as HUD/BattleRenderer/Run). UI clicks (MapScreen frontier, RecruitScreen card pick, GameOverScreen restart) fire `click.wav` directly from existing handlers; `AudioPlayer` threaded through screens via `SceneContext`. Per-sound pitch jitter via `playbackRate` (`±10%` for melee/shoot, `±8%` for death, 0 for everything else) prevents the ear locking onto a single tone in sustained combat without needing variant samples — shifting pitch + tempo together keeps the waveform intact. Volume + variance tables sit at the top of `AudioPlayer.ts` for easy tuning. Commit `7d8f3a8`.

**B2 + B4 deferred → folded into C1.** Both were touching what the C1 refactor will rewrite (terrain mesh + grid + sprite layout). Tuning them standalone would just need redoing under C1, so they get absorbed when C1 lands.

**C1a landed (tile foundation).** Two-stage rollout: foundation commit `4572d8a` shipped pure-logic scaffolding (TileGrid + neutral Team + cost-aware Pathfinding + spawnEnvironment/spawnWall), integration commit added per-encounter terrain generation + renderer wiring. Per the user's design call, **walls are neutral-team `Unit`s** (not a tile kind), so they reuse the existing Unit pipeline — appear in pathfinding's blocker list for free, snapshot-rehydrate via the existing UnitSnapshot, and a future destructible variant just needs a "walls take damage" Targeting hook. **Tiles** are surface properties — `floor | shallow_water`, the latter doubling movement cost. New `config/terrain.json` knobs: wall density 0.06, water density 0.04, spawn rows 1/2/9/10 reserved (always clear of obstacles), connectivity guard on. Generator (`src/sim/terrainGen.ts`) is procedural with a `layoutId` hook plumbed for C1b's hand-authored set pieces (resolver throws if invoked in C1a). Water visual is a flat-colored InstancedMesh (`src/render/WaterRenderer.ts`) — deliberate stand-in, gets rewritten in C1c. WorldSnapshot bumped to schema version 2; the round-trip test was extended to cover the new tileGrid + neutral wall units. **C1a punts**: destructibility (walls have HP=1 but nothing targets them since Targeting filters neutrals), ranged LOS through walls (still allowed — C1b territory), full visual polish (C1c).

**C1b landed (obstacle polish).** Three logical commits, in order:

1. **Ranged LOS through walls** (`bc8c5d8`). New `src/sim/LineOfSight.ts` with a Bresenham `hasLineOfSight(from, to, blockers)`. `AttackBehavior` collects neutral-team units as wall blockers and abstains when the line is broken — melee (adjacent target) trivially passes since there are no intermediate cells. Endpoints excluded from the blocker check (the attacker shouldn't block themselves; the target's own cell may or may not appear in the list and shouldn't matter). Bresenham picked over supercover because it matches the existing 8-dir Chebyshev movement: a unit reachable in one orthogonal step traces the same line LOS walks.

2. **Wall destructibility plumbing** (`8f71818`). Make the wall-takes-damage path end-to-end without enabling it. `unit:died` payload gains a `team` field so subscribers can branch on combatant vs neutral death without re-querying the world (by emit time the unit is already removed from `world.units`). `spawnWall(world, position, maxHp = 1)` plumbs the maxHp arg through `spawnEnvironment`; default 1 makes walls functionally indestructible because nothing targets neutrals — `Targeting.findTarget` still filters them. BattleScene's audio handler skips neutral deaths so a future wall hit won't play the unit death cry; comment flags the C2 follow-up to add a dedicated `wall_destroyed` sample when AoE actually lands wall hits.

3. **Hand-authored layout library + 50/50 mix** (`dd1e1fa`). Two starter layouts in `src/sim/layouts.ts`: **corridor** (two horizontal wall bands at rows 4 and 7 with a 4-cell center gap, forces a chokepoint) and **diamond** (4×4 center block with corners knocked off, forces armies to flank). `generateTerrain` dispatches on `layoutId`: null → procedural; known id → library; unknown id → throws. Layout resolution validates spawn-row + bounds invariants and refuses any gridSize ≠ 12. `Run.handleEnterNode` does a third draw on `battleRng` (50% null, 50% uniform pick from `LAYOUT_IDS`) — that draw lands between `terrainSeed` and `rollEnemyTeam`, so enemy compositions shifted for existing seeds (acceptable; fuzz baselines are recomputed on balance changes).

**C1b explicit punts:** wall *visual form* (3D vs billboard) folded into C1c's visual pass — locking it now would mean retuning under C1c. Wall targeting in Targeting still skips neutrals — the destructibility plumbing exists but no behavior currently damages walls; C2's AoE archetypes will be the first consumer.

**C1c landed (visual + layout pass).** Two commits:

1. **Demo** (`f61b0f5`). 3-variant side-by-side comparison built into the live battle scene, hotkey 1 / 2 / 3 swaps the active `TerrainRenderer` in place while a battle plays. Variants: A — flat plane with shader-baked grid lines, B — faceted low-poly prism-per-tile (continuous simplex heights), C — stepped simplex (heights snapped to 4 plateaus). User picked B: stepped's terraces hinted at a mechanical elevation tier the sim doesn't (and won't) deliver, while faceted's organic variance reads as visual texture without making that gameplay promise.

2. **Lock-in** (`526520d`). Replaced the old fBm `TerrainRenderer` + C1a `WaterRenderer` stand-in with a single canonical `TerrainRenderer`: one faceted prism per tile, fixed-seed simplex heights for floor tiles in [-0.3, 0], water tiles sunk to -0.4, top color lerps `DARK_TERMINAL_GREEN → DARK_TERMINAL_AMBER` over the floor range. Hard-edged faceted shading from a baked light direction (no scene lights — sprites stay unlit by design). Non-indexed geometry so every face owns its normals; buffers pre-sized at gridSize² and rewritten in place per `setTiles`. Grid lines stamped on the top face only via a per-vertex `aTopUV` attribute + smoothstep band.

    `TerrainRenderer.heightAt(cx, cy, kind)` is the canonical height function — the same one the geometry uses, exposed so other renderers stay in sync with the surface. `BattleRenderer.tileWorldPos(coord)` threads it through: sprites (units + neutral-team walls) now stand on their actual tile top instead of floating at the pre-C1c fixed Y=0.5. Applies to spawn AND lerp endpoints, so a unit moving between tiles of different heights gets a Y-interpolated path "for free" via the existing SpriteAnimator lerp. Bars follow automatically through the existing `sprites.getPosition` read.

**C1c absorbed B2 + B4:** the low-poly direction, the grid-line bake, and the vertical-stack tightening all land here. Both originals are now retired in ROADMAP.

**C1d landed (layout authoring).** Two commits:

1. **C1d.A — JSON hoist.** The two hand-authored layouts now live in `config/layouts.json` with a zod schema at `src/config/layouts.ts` (A4 pattern — validate at module load, malformed JSON crashes at boot). `LayoutDef` gained `name` and `description` fields ready for the editor UI; the existing `walls` / optional `water` shape is unchanged. `src/sim/layouts.ts` is now a thin re-export so Run / terrainGen / the existing test suite keep working without churn. Schema is a flat array (preserves order, which drives `LAYOUT_IDS` and therefore `rng.pick` determinism — append-only). Duplicate-id detection runs after parse so the loud-failure mode covers it too.

2. **C1d.B — Editor.** Standalone Vite page at `tools/layout-editor/index.html` (HTML + `editor.ts` + `editor.css` + `README.md`). Visit `http://localhost:5173/tools/layout-editor/` after `npm run dev`. Click → wall, shift+click → water, right-click → erase. Reserved spawn rows from `config/terrain.json` shown as a diagonal-stripe overlay; painting on them is flagged as a validation error. Live JSON export panel with Copy + Download buttons; round-trip with `LAYOUTS` confirmed byte-clean. Connectivity check mirrors the BFS in `layouts.test.ts` (king's-move from topmost to bottommost reserved spawn row). Imports the schema + palette + terrain config directly from `src/`, so the editor can't drift from the game. **Dev-only**: `vite.config.ts` has no `rollupOptions.input` so the production build still emits only the root `index.html` — `tools/` is served by the dev server and never lands in `dist/`. **Punted to follow-ups**: a test-play button (would need URL-encoded handoff to the live game); pick-weight + floor-depth gating fields (the roadmap deferred those out of C1d).

3. **C1d follow-up — picker + banner + diagnostic.** Three small changes after the user authored their first new layout (Labyrinth) and noticed corridor-only variety: (a) `rollLayoutId` threshold dropped from 50% to 25% procedural, so 75% of battles now pick from `LAYOUT_IDS` (the procedural pool is now a "wildcard" variant); (b) a top-center `.battle-banner` element in the HUD shows the layout's `name` ("Corridor" / "Diamond" / "Labyrinth" / "Nowhere" for procedural), with the same `screen-fade` lifecycle as the side panel; (c) a `[layout]` console.log in `Run.handleEnterNode`, gated on `typeof window !== 'undefined'` so it logs in both dev and prod browser builds but stays silent under vitest + the tsx fuzz harness. The `rng.next()` for the threshold runs unconditionally, so changing the threshold doesn't shift downstream draws (enemy team, etc.) for existing seeds — only the resulting `layoutId` branches differently. Test threshold in `Run.test.ts` updated to the new expected split (proceduralCount in [25, 75] of 200 instead of [50, 150]).

4. **C1d follow-up — MovementBehavior pathing rewrite (Labyrinth deadlock fix).** The Labyrinth layout exposed two interlocking pathfinding bugs that froze battles when narrow corridors put units in mutual blocker positions. Rewrote [src/sim/behaviors/MovementBehavior.ts](src/sim/behaviors/MovementBehavior.ts) with four changes: (a) **path to the target's cell directly**, with target excluded from blockers — the prior `pickGoalCellInRange` heuristic returned null whenever every range-1 neighbor of target was a wall or another unit, freezing the unit even when a real path existed; (b) **soft ally blocking** — walls stay hard blockers but other units (allies + non-target enemies) become high-cost cells via the CostFn (penalty = 100 per occupied cell), so A* routes around them when possible but routes through when not, preventing mutual-block deadlocks where two units facing each other across a 1-cell corridor both `findPath()`→[] and freeze; (c) **step collision check** — if `path[1]` is currently occupied, abstain (queue behavior emerges naturally as the front-of-line unit steps clear); (d) **LOS-gated in-range abstain** — the `chebyshev ≤ attackRange → abstain` check also requires `hasLineOfSight(unit, target, walls)` to be true, so a ranged unit at geometric range with a wall between it and target keeps pathing instead of freezing alongside an abstaining AttackBehavior. Chebyshev heuristic stays admissible because all costs are >= 1 (per existing gotcha #34). New integration test [tests/integration/layout-deadlock.test.ts](tests/integration/layout-deadlock.test.ts) runs each registered layout (and the procedural path) across 3 seeds headlessly and asserts the battle resolves within 2000 ticks — caught the bug, now pins it. Fuzz harness: 0 hangs over 5-seed sample post-fix. The unit-level regression test in `MovementBehavior.test.ts` ("target whose attack-range neighbors are all walls + allies") still covers fix (a) at the unit level.

**Roadmap restructured post-C1.** After playing with the C1d editor, the user authored more layouts (Labyrinth, River) and flagged that the 12×12 arena is now the bottleneck on every interesting future combat feature. The prior post-MVP ROADMAP was archived ([archive/post-mvp-roadmap.md](archive/post-mvp-roadmap.md)); a new [ROADMAP.md](ROADMAP.md) reorganizes the unfinished tail into **Phase D — Battle-layout expansion** (variable map sizes, two camera modes, spawn regions, new neutral units, new tile kinds, tile theming, with editor scope distributed across the steps that introduce each schema). C2-C7 (combat archetypes, recruitment refactor, leveling, in-battle commands, longer runs, split battles) keep their numbering and gate behind Phase D. The c1-feedback source is at [archive/c1-feedback.md](archive/c1-feedback.md) as a historical artifact.

**D1 landed (renderer capacity bump).** `SpriteRenderer` default 256 → 1024, `BarRenderer` 256 → 2048. Headroom for D3's variable map sizes (up to 32×32) and the larger unit counts post-C6 will bring. Error paths unchanged — still throw with the live capacity in the message, just triggered far less often. Auto-grow stayed deferred per the D1 decision (fixed cap is simpler and predictable; constants are trivial to bump again if a real board needs it). TODO entry "Renderer capacity audit" closed.

**D2 landed (drag-paint groundwork in the layout editor).** Mousedown on a cell starts a stroke; mousemove over subsequent cells paints with the same kind (left = wall, shift+left = water, right = erase, where erase clears the active layer's content per the D2 decision point). Global mouseup ends the stroke and commits a single validation + JSON-export refresh — the panel no longer flickers mid-drag. **Behavior shift:** the prior "left-click on a wall toggles it back to floor" implicit-erase is gone; under the painting-tool model left always paints wall/water, right (or right-drag) is the erase path. Single-tap still paints (drag of length 1, no special case). No schema changes — D2 is pure UX groundwork so D3-D8 layer/palette additions inherit drag-paint instead of retrofitting it. Verified in the editor at `http://localhost:5173/tools/layout-editor/`.

**D4 landed (camera overhaul — fit + scroll modes).** Two camera modes on `Renderer` (D4 constants at the top of [src/render/Renderer.ts](src/render/Renderer.ts)): **Mode A `fit`** is the size-aware version of the pre-D4 framing — `fitCameraFit()` computes camera distance from the board AABB (`boardW + 2·XZ_PADDING` × `boardH + 2·XZ_PADDING` × `2·Y_HALF_EXTENT`) and looks at the world origin. **Mode B `scroll`** uses a fixed `SCROLL_WINDOW_TILES = 12` window AABB and looks at `(cameraTargetX, 0, cameraTargetZ)` so panning translates the frame; per-frame `updateScrollFromInput(dt)` sums pan keys (WASD and arrow keys both active simultaneously — see `PAN_KEY_CODES`) and edge-scroll (mouse within `EDGE_SCROLL_THRESHOLD_PX = 40` of any canvas edge) into an XZ direction and translates the target at `PAN_SPEED_TILES_PER_SEC = 12`. Pitch stays locked at `CAMERA_PITCH_RAD`; only XZ position moves. Both modes share `computeCameraDistance(hx, hy, hz)` — the per-corner FOV math that used to live inline in `fitCamera`. **Default through D4 is `fit`** (`DEV_DEFAULT_MODE` constant) — D5 will flip game default to `scroll` once spawn regions give it a sensible anchor. **Dev toggle:** the backquote key (the `` ` ``/`~` key, `e.code === 'Backquote'`) swaps modes; logs `[camera] mode: fit|scroll` so it's obvious during browser-verify. **Anchoring:** `BattleScene.mount` calls `renderer.setCameraTarget(0, world.gridH/2 - 2)` after `fitToBoard`, anchoring scroll on the player spawn area (rows 1-2 of the grid). Target is preserved across mode toggles. **Clamping:** `clampCameraTarget()` caps `cameraTargetX/Z` to `±max(0, boardDim/2 - 6)` so the visible window stays inside the board; on boards where a dim is ≤ 12 the target snaps to 0 in that dim (no pan possible — visible window already shows everything). Input listeners (`keydown`/`keyup` on window, `mousemove`/`mouseleave` on canvas) wired in the constructor and torn down in `stop()`. No new tests — render code is verified by eyeball per [TESTING.md](TESTING.md). 248 tests still pass.

**D3 landed (variable map sizes — rectangular hand-authored, square procedural).** Per the D3 decision point, hand-authored `LayoutDef` declares both `gridW` and `gridH` (each 8-32, exported as `LAYOUT_MIN_SIDE` / `LAYOUT_MAX_SIDE` from [src/config/layouts.ts](src/config/layouts.ts)); procedural encounters stay square, rolling a side length uniformly in `[TERRAIN.proceduralMinSize, TERRAIN.proceduralMaxSize]` (defaults 10-20). Each of the four existing layouts retrofit with `gridW: 12, gridH: 12`. Sim layer is rectangle-aware end-to-end: `World` exposes `gridW` + `gridH` (the pre-D3 `gridSize` is gone), `Pathfinding.findPath` takes both as separate parameters, `TileGrid` already supported the split, and `terrainGen.generateTerrain(rng, gridW, gridH, config, layoutId)` dispatches on layout dimensions for the hand-authored path. `config/terrain.json` retired `spawnRowsClear` in favor of a new `reservedSpawnRows(gridH)` helper in `terrainGen.ts` that computes `[1, 2, gridH-3, gridH-2]` — mirrors what `battleSetup.spawnTeam` actually uses (player melee/ranged at rows 2/1; enemy at rows `gridH-3`/`gridH-2`). Reserved-row logic stays this shape until D5 replaces it with explicit spawn regions. `battleSetup.distributeColumns(count, gridW)` now spreads units across cols 1..gridW-2, so recruit-grown teams don't overflow on narrow boards and don't bunch up on wide ones; the CHECKPOINT 5 anchor columns are preserved exactly for the default 3+2 team on `gridW=12`. `BattleEncounter` carries `gridW` + `gridH`; `Run.handleEnterNode` always advances the RNG via `rollProceduralSide` (even on layout encounters) so the byte continuity invariant matches the pre-existing one on `rollLayoutId`. **WorldSnapshot bumped to v3** (gridSize → gridW + gridH); v2 snapshots throw at load. Renderer: `Renderer.fitToBoard(gridW, gridH)` called from `BattleScene.mount` resizes the camera frame per-encounter; `TerrainRenderer` allocates buffers at the largest D3 grid (32×32) on construction and uses `geometry.setDrawRange` per `setTiles` so per-encounter sizes change without reallocation (~1 MB of vertex buffer reserved up front, no GPU stalls on resize); `BattleRenderer.gridToWorld` takes `(gridW, gridH)` and centers per-axis. Editor: W + H dropdowns (8-32 each), DOM rebuilds in place preserving cells that still fit, validation warns on dropped cells, reserved-row overlay tracks `reservedSpawnRows(gridH)`. Headless tests cover this end-to-end: new `tests/integration/variable-size.test.ts` runs procedural battles at 10/15/20 across two seeds each; existing `layout-deadlock.test.ts` now iterates each layout's own dimensions plus a square-procedural baseline; new `terrainGen.test.ts` case checks rectangular generation with `gridW=15, gridH=10`; new `Pathfinding.test.ts` case asserts asymmetric bounds. All 240 tests pass (was 229 pre-D3); fuzz smoke unchanged.

Next up per ROADMAP:

1. **D5 — Spawn-region system.** Replaces today's `reservedSpawnRows(gridH)` + fixed-column `distributeColumns` machinery with explicit per-layout `SpawnRegion[]` (exactly 8 tiles per region, availability `player`/`enemy`/`both`, may overlap between regions but not with walls/water). Procedural emits two `both` regions on the top/bottom edges; existing 4 layouts retrofit with two `both` bands at y=0 and y=gridH-1. `battleSetup.spawnTeam(team, region, world, rng)` shuffles region tiles deterministically; overflow units (post-C6) sit in a per-region queue and spawn as tiles vacate. **Editor scope:** layer toggles arrive in D5 (terrain / neutral units / spawn regions, only the active layer accepts edits; others render dimmed); spawn-region painting with live 8-tile constraint + per-region availability radio. **Big follow-on:** D5 anchors the D4 scroll camera better — `BattleScene.mount` should switch from the "rows 1-2 midpoint" heuristic to "centroid of the rolled player region", and the `DEV_DEFAULT_MODE` constant in `Renderer.ts` flips from `fit` to `scroll` once that's wired. Decision points: edge-tile y for retrofit (recommend y=0 / y=gridH-1), overflow-queue scope (recommend in-scope for D5), inactive-layer dimming intensity.

**Fuzz harness:** `npm run fuzz -- --count=N` runs N seeds × all strategies (currently pure-random + greedy), writes `tests/fuzz/output/summary.csv` and per-failure markdown traces. `npm run fuzz:smoke` runs vitest smoke on the harness itself (config: `vitest.fuzz.config.ts`). MVP baseline at 10 seeds: both strategies ~50% win rate, avg floor 3.6 — suggests recruit picks don't move balance much at 4-floor scope, which is data for tuning. (5-seed sample post-A4 hints at greedy edge, but N is too small to be sure — re-run at 100+ when something invalidates the cache.)

**Balance tuning:** numbers live in `config/*.json` (archetype stats, difficulty curve, recruitment composition, nodemap shape). Edit the JSON, refresh the browser — no recompile, just a Vite hot-reload. Schemas + validation in `src/config/*.ts` (zod). Malformed JSON throws at boot with a readable error trace.

Open the roadmap for the full plan and decision-point flags.

Beyond those, see [DESIGN.md](DESIGN.md) "Out of scope" for the gameplay backlog (shop, synergies, boss nodes, etc.) and [TODO.md](TODO.md) for the smaller code-level follow-ups.

## How we collaborate

The strict roadmap (one step → one commit, stop at every checkpoint) was for MVP. Post-MVP work is freer, but the underlying habits still apply:

- **Commit per logical change**, not per "session of work." Split commits when a step's intent grows.
- **Surface tradeoffs to the user** before making non-obvious calls (shader thresholds, refactor scope, API shape decisions).
- **Browser-verify visual work** — and verify at native resolution. The Preview MCP screenshots are unreliable for sub-pixel detail (see gotcha #15).
- **Keep `DESIGN.md` / `ARCHITECTURE.md` honest.** If a change reveals a documented decision is wrong, update the doc in the same commit.

See also: [TESTING.md](TESTING.md) for the testing policy (`core`/`sim`/`run` get tests, `render`/`ui` get visual verify), and [retro/](retro/) for the rolling scratchpad and the shipped-MVP review.

## Things that bit us — DON'T re-litigate

These hard-won fixes will look weird out of context. Don't "clean them up" without understanding why they exist.

1. **RETIRED at B1.** ~~`scene.background = new THREE.Color(TERMINAL_BLACK)`, not `setClearColor`.~~ Was load-bearing for the palette-quant pass (the clear-color path produced a value that snapped to DARK_TERMINAL_AMBER). Palette-quant gone → bug gone. The `scene.background` pattern still lives in [src/render/Renderer.ts](src/render/Renderer.ts) because it's a fine pattern; just no longer dangerous to "clean up." Original commit `8491daa`.
2. **`OutputPass` at the END of the composer chain.** Custom `ShaderPass`es don't auto-convert linear → sRGB at the canvas blit; `OutputPass` does. Without it, every color displays as its linear value re-interpreted as sRGB. Commit `fb5e878`.
3. **RETIRED at B1.** ~~Palette quantization uses a color-key approach~~ — the palette-quant pass was removed entirely. The color-key dance is no longer in the codebase. Original commit `2857c91`.
4. **RETIRED at B1.** ~~Any post-process pass placed BEFORE palette-quant must respect the bg color-key.~~ Same retirement as #3 — no quant pass means no color-key contract. The new chain (sat-clamp → bloom → scanlines) doesn't need the sentinel. Original commit `3334c27`.
5. **`Math.random()` is banned in `src/sim/` and `src/run/`** (ESLint enforced). Use `RNG` from `src/core/RNG.ts`; per-battle randomness via `parentRng.fork()`.
6. **Author durations in seconds, not ticks.** Use `secondsToTicks` / `ticksToSeconds` from `src/config.ts`. Changing `TICK_RATE` shouldn't require re-tuning balance — that's the contract.
7. **Cooldown semantics are "decrement-then-check," not "check-then-decrement."** [World.tick()](src/sim/World.ts) decrements every entry in `unit.actionCooldowns` once per tick before the selector runs; behaviors set the proposal's `cooldown` to the *full* `moveCooldownTicks` / `attackCooldownTicks` value (NOT `N-1`). The match between cooldown gap and event `durationTicks` is what keeps the sprite lerp from leaving a visible idle frame between moves. Lived in a shared `Unit.actionCooldown` field through MVP; refactored to per-action `Map<string, number>` plus `activeAction` duration lockout in A1.
8. **A1 model: per-action cooldown + activeAction duration lockout.** Each tick the selector polls every `Behavior.proposeAction`, filters proposals whose action is still on cooldown (`unit.actionCooldowns.get(id) > 0`), and picks the highest-scoring proposal. The chosen action sets its per-action cooldown and an `activeAction` with `startTick` / `finishTick` / `effectTicks`; while `activeAction != null`, the selector short-circuits (unit is busy). For single-tick actions like move/attack, `cooldown` and `duration` are equal — preserving the MVP "one action per tick" feel — but charge-ups and channels diverge them. Behaviors are stateless and produce per-proposal Action instances (see [src/sim/actions/MoveAction.ts](src/sim/actions/MoveAction.ts) and [src/sim/actions/AttackAction.ts](src/sim/actions/AttackAction.ts)). MovementBehavior scores 1; AttackBehavior scores 10. Score-tie handling is "first proposer wins."
9. **`World.tick()` iterates `this.units.slice()`, not `this.units`.** Inline death handling splices the list mid-tick (was DeathBehavior pre-A1); without the snapshot copy the loop skips the next unit after each removal. The death short-circuit at the top of the per-unit step also ensures dead-but-not-yet-removed units don't propose actions on the tick they die.
10. **`checkBattleEnd` guards on an empty world.** Without the guard, `World.tick()` fires `battle:ended` the very first tick before Game spawns anything — and also breaks any low-level World test that ticks without spawning. The guard happens to also cover the (currently impossible-with-current-stats) mutual-annihilation case.
11. **`exactOptionalPropertyTypes` gotcha.** When an object literal might assign `undefined` to a callback property, declare it as `prop: (() => void) | undefined` instead of `prop?: () => void` — the latter rejects an explicit `undefined`. Bit us in [SpriteAnimator's `ActiveFade`](src/render/animation/SpriteAnimator.ts).
12. **Subscription order matters between Run and Game.** Run is constructed before Game subscribes its own handlers, so on `battle:ended` Run advances `phase` *before* Game reads it. Game's `endBattle` and recruit/defeat/victory handlers all rely on this. If you ever construct Run after Game's subscriptions, the read-after-set ordering flips and things break. See [src/Game.ts](src/Game.ts) constructor.
13. **`Run.dispose()` unsubscribes on reset.** When the run resets (via the `resetRun` command), Game creates a new Run on the same bus. Without `dispose()` on the old Run, two Runs respond to every `battle:ended`. The unsubscribe pattern is captured-in-array; if you add a new `bus.on(...)` inside Run, push the unsub into `this.subscriptions`.
14. **Recruited units spawn via `distributeColumns`, not fixed-length arrays.** The original `MELEE_COLUMNS = [2, 6, 10]` blew up at index 3 once a recruit grew the team. Default 3M+2R formation is still preserved exactly by a fast-path; any other size uses an even-spread function. See [src/Game.ts](src/Game.ts) `spawnTeam`.
15. **Death fade gets cut short on `battle:ended` (acceptable).** When the killing blow is the final tick, `DeathBehavior.startFade` and `BattleRenderer.detach` happen in the same synchronous burst. The fade dies on the floor. The RecruitScreen / GameOverScreen modals come up immediately after and hide the cut-short visual, so it's invisible in practice. Note in [src/render/BattleRenderer.ts](src/render/BattleRenderer.ts).
16. **HUD `screen-fade` class instead of `hidden` attribute.** The HUD uses `is-visible` class toggling via [src/ui/fade.ts](src/ui/fade.ts) rather than the `hidden` HTML attribute, because `display: none` can't transition opacity. The persistent-element pattern (HUD) and the create-and-destroy pattern (Map/Recruit/GameOver) both opt into the same `.screen-fade` CSS rule. Commit `d4808f5`.
17. **Camera framing is aspect-aware.** [src/render/Renderer.ts](src/render/Renderer.ts) `fitCamera()` runs on every `handleResize` and computes camera distance from the arena AABB + pitch + FOV + aspect so the grid never clips off frame. If you change `FIT_HALF_EXTENTS` or `CAMERA_PITCH_RAD`, re-verify framing at multiple aspect ratios. Commit `f253ae5`.
18. **A2 inputs/outputs split: commands vs events.** Player intents (`enterNode`, `chooseRecruit`, `resetRun`) flow through `RunDispatcher` → `Run.dispatch` (synchronous), **not** the bus. Past-tense notifications (`run:started`, `battle:ended`, `recruit:offered`, `unit:*`, etc.) stay on the bus. Game implements `RunDispatcher` and is captured by every UI screen — that keeps the swap-Run-on-reset invisible to the UI. If you find yourself wanting to add an imperative to `GameEvents`, it's probably a `RunCommand` instead. See [src/run/Command.ts](src/run/Command.ts).
19. **A2 snapshot rehydration is two-phase for World.** Units are instantiated first (no `activeAction`), then `activeAction` references are resolved once every unit exists — an in-flight `AttackAction` may reference another unit by id, and that target has to be present first. `World.fromJSON` enforces this order; if you add a new Action whose `fromData` looks up world state, follow the same pattern. Same applies if multi-unit links (e.g. a "guard ally X" behavior) ever exist.
20. **Behavior/Action registry. `kind` is the contract.** New Behavior implementations declare `static readonly kind = '...'` AND `readonly kind = X.kind`, plus a factory in [src/sim/behaviors/registry.ts](src/sim/behaviors/registry.ts). New Action implementations declare an `id`, a `toData()`, a `static fromData(data, world)`, and register in [src/sim/actions/registry.ts](src/sim/actions/registry.ts). Skipping either side breaks `World.fromJSON` only for snapshots that mention the new kind — easy to miss until someone tries to save mid-battle.
21. **`Run.fromJSON` uses `Object.create` to bypass the constructor.** A fresh `new Run(seed, bus)` regenerates the NodeMap and emits `run:started`; neither is what we want when restoring a snapshot. The factory uses `Object.create(Run.prototype)` plus a mutable cast to set the readonly fields, then calls `subscribe()` to wire up `battle:ended`. Don't replace this with constructor surgery without preserving both behaviors.
22. **A3 fuzz CLI uses tsx, smoke uses a separate vitest config.** Node ESM can't resolve extensionless `.ts` imports natively, so `npm run fuzz` runs through `tsx` (added as devDep). `npm run fuzz:smoke` uses [vitest.fuzz.config.ts](vitest.fuzz.config.ts) — the default `vite.config.ts` *excludes* `tests/fuzz/**` from `npm test` to keep pre-commit fast, so the smoke needs its own config to flip the include. If you ever wire fuzz into CI, call `npm run fuzz:smoke` not `npm test`.
23. **Battle-setup logic lives in [src/sim/battleSetup.ts](src/sim/battleSetup.ts), not Game.** `Game.beginBattle` and the fuzz harness both call `spawnTeam` / `spawnEncounter` from this module. If formation columns ever change (or new behaviors are added to default-spawned units), it has to land there — both call sites pick it up automatically. Don't reintroduce a local copy in either consumer.
24. **A4 config split — JSON source of truth, TS validator.** Balance numbers live in `config/*.json`; each one has a zod schema + parsed export in `src/config/*.ts`. Validation runs at module load, so a malformed JSON crashes the app at boot with a readable zod trace — that's the intended failure mode. To add a new tunable: drop it in the JSON file, extend the schema in the matching TS module, import the parsed value at the call site. The `Archetype` TS union in [src/sim/archetypes.ts](src/sim/archetypes.ts) stays the canonical list of archetype keys; the JSON keys must match it. C2 (mage/rogue/healer) will add to both in lockstep.
25. **A4 shader split — `.glsl` files + `?raw` imports.** Shader sources live in `src/render/shaders/*.glsl`. Two post-process passes (sat-clamp, scanlines) share `fullscreen-pass.vert.glsl`. The `__PALETTE_SIZE__` / `__BLACK_INDEX__` placeholder + `substituteShaderConstants` machinery from MVP is gone — palette quant retired at B1 (gotchas #1/#3/#4) and nothing else needed the substitution.
26. **A5 Scene swap is single-active + bus-driven.** `Game.bus.on('battle:started' | 'recruit:offered' | 'run:victory' | 'run:defeated', …)` does the entire scene routing — Run emits the event from inside its own `battle:ended` handler so phase is already updated by the time the swap fires. The one transition not driven by a bus event is recruit→map (Run.handleChooseRecruit doesn't emit anything), so Game.dispatch checks `run.phase === 'map'` after `chooseRecruit` and swaps explicitly. Don't add an event for that single case; the explicit branch is cheaper than a one-consumer event.
27. **HUD has a real `dispose()` post-A5.** Pre-A5 HUD was a Game-lifetime singleton — subscriptions were never torn down because the object lived forever. A5 made it per-battle (BattleScene owns it), so HUD captures its subscriptions into `this.subscriptions[]` and `dispose()` unsubscribes them + `fadeOutAndRemove`s the root. Any new long-lived bus subscription added to HUD must be pushed onto that array, same pattern as BattleRenderer + Run.
28. **`SceneContext` is rebuilt per swap.** `Game.buildContext()` returns a fresh bundle on every `swap()` call so `ctx.run` reflects the current Run instance — important because `resetRun` replaces `this.run`, and a stale closure-captured ctx would still point at the disposed Run. Scenes that need scene-specific args (recruit offer, gameover variant) take them via constructor, not via ctx, because ctx is supposed to be stable across all scenes.
29. **B1 bloom high-pass uses `max(R,G,B)`, not Rec.709.** UnrealBloomPass ships with a perception-weighted luminance high-pass (`0.299·R + 0.587·G + 0.114·B`), which makes pure red pixels measure as dim — NEON_RED enemies wouldn't cross the bloom threshold while TERMINAL_GREEN allies would. Physically correct for HDR scenes; actively wrong for stylized glyphs. `createBloomPass` in [src/render/PostProcess.ts](src/render/PostProcess.ts) swaps in a max-channel shader (`MAX_CHANNEL_HIGH_PASS_FRAG`) so any saturated channel triggers bloom equally. Don't "fix" this by reverting to LuminosityHighPassShader.
30. **B1.1 selective bloom: two composers + per-sprite `bloomIntensity` decoupled from visible color.** SpriteRenderer owns two meshes sharing the same `InstancedBufferGeometry` (and therefore the same per-instance buffers): `mesh` on layer 0 renders the *visible* sprite at its natural color via [sprite.frag.glsl](src/render/shaders/sprite.frag.glsl) (no intensity math); `bloomMesh` on `BLOOM_LAYER` (=1) renders `color * bloomIntensity` via [sprite-bloom.frag.glsl](src/render/shaders/sprite-bloom.frag.glsl). [Renderer.ts](src/render/Renderer.ts) drives two `EffectComposer`s per frame — `bloomComposer` (camera at BLOOM_LAYER, scene.background→null, explicit (0,0,0) clear, then UnrealBloomPass) and `mainComposer` (camera at layer 0, scene.background restored, SatClamp → MixPass(adds bloomComposer's renderTarget2.texture) → Scanlines → OutputPass). `bloomIntensity` semantics: `0` = no halo (sprite visible at natural color), `1` = natural halo (blooms iff color crosses threshold), `>1` = forced strong glow. Lerping 0↔1 fades the halo while visible color is constant. Why this shape and not the simpler "additive emissive" multiplier we tried first: with one pass, "visible color" and "bloom trigger" are the same fragment; sprite intensity can only push values up, not suppress natural bloom on saturated colors (NEON_RED). Two passes decouple them. Don't try to collapse back to one composer — the suppression case (B3 dim HP bars, C2 charge-down, etc.) needs it.

    Two gotchas the selective-bloom wiring picked up that bit during implementation:

    - **bloom RenderPass clearColor must be explicit `(0,0,0,0)`.** Default GL clear color is TERMINAL_BLACK `#282828` sRGB, which lands as raw 0.157 in the HalfFloat linear target. UnrealBloomPass *additively* composites its bloom result onto its un-cleared input target, so any non-zero ground floor leaks gray across the whole bloom buffer. Pass `new RenderPass(scene, camera, null, new THREE.Color(0x000000), 0)`.
    - **UnrealBloomPass's `blendMaterial` must be patched to NormalBlending + transparent=false** (property name in three.js r184+; was `materialCopy` pre-r163). The pass's last step copies the bloom result onto its input target using AdditiveBlending by default — correct for single-composer chains where the bloom should smear glow on top of the rendered scene, wrong for selective bloom where the visible sprite already lives in mainComposer and we want bloomComposer's output to be JUST the halo. NormalBlending makes the final copy *replace* the input; transparent=false ensures dark pixels (alpha=0) write zero instead of bleeding through.
    - **Bloom threshold is 0, not the more-typical 0.6+.** A non-zero high-pass threshold turns `bloomIntensity` into a *step function* (off below ~threshold/maxChannel, full above) rather than the smooth linear knob B3 HP-bar fade and C2 charge-up ramps need. The threshold normally exists to filter out dim background pixels before bloom; in our selective-bloom setup the bloom layer renders only sprite contributions onto an explicit (0,0,0) clear, so there are no dim pixels to filter. Setting threshold=0 makes the bloom contribution scale linearly with `color × bloomIntensity` all the way down, which is what makes `bloomIntensity = 0.25` and `0.75` look visibly different.

31. **C1a: walls are neutral-team `Unit`s, not a `TileKind`.** Original design instinct was a `wall` tile variant. User flagged: making walls Units reuses the existing Unit pipeline (id allocation, snapshot rehydration, pathfinding blocker list, sprite rendering) and leaves the door open for destructible walls + healing shrines + other "static entity with optional behaviour" without a new abstraction. The split is now **TileGrid = surface properties** (movement cost, eventually combat modifier / LOS) and **neutral-team Units = solid objects sitting on top**. Don't try to collapse them — they answer different questions.

32. **C1a: `Team` extended to `'player' | 'enemy' | 'neutral'`.** Every team-comparing call site has to handle the third case. The audit at C1a landing covered: [Targeting.findTarget](src/sim/Targeting.ts) (skip neutrals as targets), [World.checkBattleEnd](src/sim/World.ts) (don't count neutrals toward either side, and *don't synthesize a winner when both player+enemy are dead but walls remain* — same "no combatants left" pattern as the pre-spawn empty-world guard), [HUD.addUnit](src/ui/HUD.ts) (skip neutrals from rosters), [BattleRenderer.colorForTeam + onUnitSpawned](src/render/BattleRenderer.ts) (TERMINAL_STONE color, suppressed bloom, no HP/progress bars for neutrals). New consumers MUST audit the same way — `team === 'player' ? a : b` is now wrong when neutrals can show up.

33. **C1a: every glyph used for a sprite needs an entry in [FontAtlas.ts](src/render/FontAtlas.ts) `GLYPHS`.** Browser-verify caught the wall `#` glyph missing — `addSprite` throws `FontAtlas: no UV for glyph "#"` deep inside the unit:spawned handler, which silently aborts BattleScene mount mid-applyTerrain. The HUD shows "Floor N" with empty rosters and there's no obvious error in the UI; the throw only surfaces via `window.onerror`. Append new glyphs to the end of the array — order is stable, existing UV lookups stay valid.

34. **C1a: `Pathfinding.findPath` accepts an optional `CostFn`; Chebyshev heuristic stays admissible only because every cost is `>= 1`.** Default unit-cost preserves pre-C1a behavior. If you ever add a tile cost `< 1` (e.g., a "speed boost" tile), the Chebyshev heuristic stops being a lower bound on min-cost and A* loses its optimality guarantee. Either keep all costs `>= 1` or swap the heuristic to `min_cost * Chebyshev`. `Infinity` cost = data-driven block (equivalent to a blocker-list entry).

35. **C1a: `World.spawnEnvironment` is the spawn path for non-combatants; UnitTemplate is combatant-only.** Walls don't fit the `archetype: 'melee' | 'ranged'` mold (no rolled stats, fixed glyph). [`spawnEnvironment`](src/sim/World.ts) takes `{ glyph, position, maxHp?, team? }` and produces a Unit with degenerate inert stats + no behaviors; [`spawnWall`](src/sim/environment.ts) is the convenience wrapper. Both reuse the same private `addUnit` helper as `spawnUnit` so id allocation + bus emission stays consistent. Don't extend UnitTemplate with `glyph` overrides to fit walls in — the split spawn paths are clearer.

36. **C1a: `WorldSnapshot` schema bumped to version 2 (added `tileGrid`).** Old version-1 snapshots throw on load — the version check guards against silent acceptance of stale data. The default constructor still produces a floor-everywhere TileGrid so existing tests (which build World without an explicit grid) keep passing; only the snapshot path enforces strict versioning.

37. **C1a: `applyTerrain` MUST run before `spawnTeam`.** The terrain generator guarantees walls + water never land on `config.spawnRowsClear`, so spawning teams after applyTerrain means units never land on a wall. Mounting in the opposite order would put units on walls (or worse, fail in pathfinding when the unit's own cell is blocked). Both call sites — `spawnEncounter` (fuzz harness) and `BattleScene.mount` — already follow this order; if you add a third, mirror it.

38. **C1b: ranged LOS uses Bresenham, NOT supercover.** [`hasLineOfSight`](src/sim/LineOfSight.ts) walks integer cells along the Bresenham line from attacker to target and rejects on any cell in `blockers`. Supercover (every cell the geometric line touches) was the alternative and would block diagonal "squeezes" between corner-touching walls — geometrically purer but tactically inconsistent with 8-dir Chebyshev movement, where a unit *can* step diagonally between such walls. The line walk skips both endpoints: the attacker's own cell isn't a self-block, and the target's cell may appear in the blocker list (typically it doesn't, but the guard is there) and shouldn't block a shot at the target itself. If a future feature needs strict diagonal-squeeze prevention, swap the loop body — not the call sites.

39. **C1b: `unit:died` carries `team`.** By the time the event fires, `World.tick` has already spliced the unit out of `world.units`, so `world.findUnit(unitId)` returns undefined. Subscribers that need to branch on combatant vs neutral death (BattleScene's audio handler, future wall-destruction VFX) read `team` from the payload. New `unit:died` subscribers MUST include `team` if they care about that distinction — there's no other source of truth post-removal.

40. **C1b: `AttackBehavior.collectWalls` filters by `team === 'neutral'`.** Today neutrals == walls, but the moment we add other neutral entities (healing shrines, hazards) the filter starts overcollecting. The right fix at that point is a per-Unit `blocksLineOfSight` flag (or similar) — not a glyph check. Don't paper over by inspecting the glyph; that ties LOS semantics to a rendering detail.

41. **C1b: hand-authored layouts assume `gridSize = 12`.** [`generateTerrain`](src/sim/terrainGen.ts)'s layout path throws on any other size rather than silently scaling. Layouts are design artifacts authored against a known canvas; resizing the arena (future C1c work or beyond) means re-authoring them. The procedural path stays grid-size-agnostic for the fuzz harness and any future scaling experiments.

42. **C1b: `Run.handleEnterNode` now does 3 RNG draws on `battleRng` before `rollEnemyTeam`.** Order is `worldSeed → terrainSeed → layoutId → rollEnemyTeam`. The third draw (introduced by `rollLayoutId`) means enemy compositions shifted for existing seeds vs. the C1a baseline. Existing tests that assert enemy stat ranges still pass (the ranges are permissive), but the byte-identical replay tests in `tests/integration/` reflect the new stream — old fuzz output CSVs are stale on this dimension and shouldn't be compared across the C1b cut.

43. **C1c: `TerrainRenderer.heightAt(cx, cy, kind)` is the canonical height function.** Both the prism geometry AND `BattleRenderer.tileWorldPos` read from it. Don't compute heights in a second place — keep `heightAt` as the single source of truth. Heights are deterministic functions of `(cx, cy, kind)` over a fixed-seed simplex; per-battle terrain seed is intentionally NOT used here so the visual character of the world stays canonical across battles. If a future feature wants per-encounter terrain variety, introduce a separate seed plumbed through `setTiles` rather than reaching into the noise instance.

44. **C1c: Sprite Y is per-tile via `BattleRenderer.tileWorldPos`, not the pre-C1c fixed `SPRITE_Y`.** `gridToWorld` still exists but only computes XZ + a default Y for callers without terrain context; `tileWorldPos(coord)` is what `onUnitSpawned` and `onUnitMoved` use. Both spawn AND lerp endpoints go through it, so a unit moving across a height seam gets a smooth Y-interpolated path via the existing SpriteAnimator lerp — no extra animation wiring. If you add a new spawn point or lerp endpoint, use `tileWorldPos`, not raw `gridToWorld`.

45. **C1c: Walls inherit per-tile Y via the unit-spawn pipeline.** Walls are neutral-team Units (see #31) and spawn through the same `onUnitSpawned` path as combatants, so `tileWorldPos` automatically places them on their tile top. If a future feature wants walls at a Y different from their tile top (e.g. ceiling-mounted hazards, floor traps that flush below tile level), the wall path needs its own branch — but for the default "obstacle on floor" case it just works.

46. **C1c: No scene lights — terrain shades from a baked light direction in `terrain.frag.glsl`.** `LIGHT_DIR` + `AMBIENT` + per-face normal go directly into a Lambert term in the shader; there is no `THREE.DirectionalLight` in the scene. This is deliberate: sprites use a custom unlit ShaderMaterial, and adding a real scene light would mean either tagging it to a layer the sprites don't read (fragile) or rewriting the sprite shader to ignore lights (pointless). If you add a new material that *does* want lighting, mirror the same baked-direction pattern rather than adding a `Light`.

47. **D3: `World.gridSize` is GONE — use `world.gridW` + `world.gridH`.** Every sim/render call that used to take a single `gridSize` now takes both dimensions independently (`Pathfinding.findPath`, `generateTerrain`, `gridToWorld`, `TerrainRenderer.setTiles`, `World` constructor). The reason is correctness: passing one value where two are wanted would silently squash one axis to match the other. WorldSnapshot bumped to v3 — v2 snapshots throw at load via the existing schema-version guard. If you add a new function that consumes board dimensions, take them as two parameters, not one.

48. **D3: reserved spawn rows are computed per-`gridH`, not configured.** `config/terrain.json` no longer has `spawnRowsClear`; the canonical formula is `reservedSpawnRows(gridH) = [1, 2, gridH-3, gridH-2]`, exported from `src/sim/terrainGen.ts`. The formula mirrors what `battleSetup.spawnTeam` actually puts there (player melee/ranged on rows 2/1; enemy on `gridH-3`/`gridH-2`). The editor's diagonal-stripe overlay, the procedural generator's reservation, and the layout validator all call this same function. D5 retires it in favor of explicit `SpawnRegion`s — until then, don't fork the formula. The function returns `[]` for `gridH < 4` (no usable arena); the procedural path treats that as "no reservation," so degenerate sizes surface as out-of-bounds spawn writes rather than silent corruption.

49. **D3: `Run.handleEnterNode` now does FOUR `battleRng` draws before `rollEnemyTeam`.** Order is `worldSeed → terrainSeed → layoutId → proceduralSide → rollEnemyTeam`. `rollProceduralSide` always runs (even when `layoutId !== null` so the resulting `proceduralSide` is discarded) — same invariant `rollLayoutId` already maintained. This is what keeps enemy-team byte continuity stable when the procedural-size band is later retuned. Note this means D2-era seeds shift enemy compositions (the new draw lands between `layoutId` and `rollEnemyTeam`); permissive range assertions in `Run.test.ts` still pass.

50. **D3: `TerrainRenderer` allocates buffers at the largest D3 grid up front.** Constructor takes no arguments; the vertex buffers are sized for `LAYOUT_MAX_SIDE × LAYOUT_MAX_SIDE` (32×32 = 1024 tiles × 30 verts × 32 bytes ≈ 1 MB). `setTiles(tileGrid, gridW, gridH)` rewrites cells in place and calls `geometry.setDrawRange(0, gridW * gridH * VERTS_PER_TILE)` so only the active region is drawn. Trade-off: a flat ~1 MB reserved at boot vs. a frame stall every time the board size changes. Don't add a per-encounter buffer realloc path — the cap was picked so the upfront cost is small enough to skip that complexity.

51. **D3: `Renderer.fitToBoard(gridW, gridH)` is the per-battle hook.** `BattleScene.mount` calls it after `applyTerrain` so the camera frame matches the rolled / declared arena. Non-battle scenes (Map / Recruit / GameOver) don't call it; they inherit whatever the last battle (or boot default of `GRID_SIZE × GRID_SIZE`) set. The fit math uses board-relative X/Z half-extents (`boardW/2 + XZ_PADDING`, same for Z) and a fixed Y headroom (`Y_HALF_EXTENT = 1.0`); pre-D3 these were a single `FIT_HALF_EXTENTS` constant.

52. **D4: `Renderer` owns two camera modes; `fitCamera()` dispatches on `this.cameraMode`.** Mode `fit` calls `fitCameraFit()` (board AABB centered at origin); mode `scroll` calls `fitCameraScroll()` (fixed 12-tile window centered at `cameraTarget`). Shared per-corner FOV math lives in `computeCameraDistance(hx, hy, hz)` so changes to fit logic land in both modes — don't duplicate it inline. The `DEV_DEFAULT_MODE` constant pins the default to `fit` through D4; D5 will flip it to `scroll` once spawn regions give a better anchor than "rows 1-2 midpoint". The backtick (`` ` `` / `~`, `e.code === 'Backquote'`) toggles for dev verification.

53. **D4: scroll-mode target is always re-clamped to the current board.** `clampCameraTarget()` runs inside both `setCameraTarget` and `fitCameraScroll`, so external code can call `setCameraTarget` with any value (e.g. the player-spawn anchor from BattleScene) and trust it'll get capped to `±max(0, boardDim/2 - 6)`. Boards where a dim is ≤ `SCROLL_WINDOW_TILES` (12) snap to 0 in that dim — there's no pan room. This is why WASD does nothing on a 12×12 board even in scroll mode; it's intentional, not a bug. The clamp also re-runs from `fitToBoard`, so per-encounter size changes never leave the target outside the new bounds.

54. **D4: pan-key + edge-scroll listeners are page-lifetime, gated by mode in the loop.** Listeners are attached once in `Renderer`'s constructor (`keydown`/`keyup` on `window` so the user doesn't need to focus the canvas; `mousemove`/`mouseleave` on the canvas so HUD hover doesn't pan) and torn down in `stop()`. The render loop calls `updateScrollFromInput(dt)` ONLY when `cameraMode === 'scroll'` — so fit mode pays nothing per frame, and a mouse parked near the edge during fit mode doesn't queue up panning that'd jump the moment you toggle. `mouseleave` clears `mouseX`/`mouseY` to `null` so edge-scroll stops when the cursor moves over the HUD or off the canvas entirely. Both WASD and arrow keys are recognized as pan keys (`PAN_KEY_CODES` set); they're OR'd per axis in `updateScrollFromInput` so holding W + ArrowUp together still only contributes -1 to dz, not -2. Uses `e.code` (layout-independent) throughout so non-QWERTY keyboards still pan with the physical W/A/S/D and arrow keys.

## Browser-verify tips (learned the hard way)

- **Preview MCP screenshots are unreliable for sub-pixel detail.** JPEG compression smears 1-2px features (scanlines, dither stipple) into uniform tints; resize timing can produce thumbnail-sized images that look like rendering bugs. **If a screenshot contradicts intuition, sample canvas pixels via `getImageData` first** — they're more reliable than the screenshot tool for detecting real issues. Even better: ask the user to look in their native browser.
- **`preview_click` selector dispatch sometimes lands outside the clickable region** in a narrow preview viewport. When click "succeeds" but no event fires, fall back to `preview_eval` with `element.click()`.
- **The preview MCP duplicates console output 6×** for reasons not yet understood. Log de-duplication is purely cosmetic; the events are still firing once per emit.
- **Force-verifying defeat/victory paths** when natural runs keep winning/losing the wrong way: temporarily add `(window as unknown as { __bus: typeof this.bus }).__bus = this.bus;` to Game constructor, then `window.__bus.emit('battle:ended', { winner: 'enemy' })` or `window.__bus.emit('run:victory', {})` from eval. Remove the hook before committing.
- **`getImageData` on a WebGL canvas can return cleared buffers** if `preserveDrawingBuffer` is false (Three.js default). Read pixels synchronously inside the same frame the render happened, or temporarily set `preserveDrawingBuffer: true` for debugging.

## Project shape

```
src/
  main.ts              # entry; top-level await on FontAtlas.create()
  Game.ts              # top-level orchestrator: owns Renderer/Bus/Run; scene swapper (A5)
  config.ts            # TICK_RATE=10, GRID_SIZE=12, secondsToTicks/ticksToSeconds
                       # (engine knobs; balance lives in config/*.json — see src/config/)
  config/
    archetypes.ts      # validated wrapper around config/archetypes.json (A4)
    difficulty.ts      # validated wrapper around config/difficulty.json (A4)
    recruitment.ts     # validated wrapper around config/recruitment.json (A4)
    nodemap.ts         # validated wrapper around config/nodemap.json (A4)
    terrain.ts         # validated wrapper around config/terrain.json (C1a)
    layouts.ts         # validated wrapper around config/layouts.json (C1d.A)
    schemas.ts         # shared zod helpers (RangeSchema) (A4)
  core/
    RNG.ts             # mulberry32, fork(), pick(), int()
    EventBus.ts        # typed pub/sub; on() returns unsub
    Clock.ts           # fixed-timestep accumulator
    events.ts          # GameEvents catalog (typed event payloads)
    types.ts           # GridCoord, Vec2
  sim/
    World.ts           # tick(), spawnUnit(), spawnEnvironment(), removeUnit(),
                       # findUnit(), checkBattleEnd
                       # selector + activeAction loop, inline death handling (A1)
                       # + command queue drain + toJSON/fromJSON (A2)
                       # + tileGrid field + WorldSnapshot v2 (C1a)
    Unit.ts            # Unit + UnitTemplate + UnitStats + Team + Behavior
                       # + actionCooldowns Map + activeAction (A1)
                       # Behavior gains `kind` for snapshot rehydration (A2)
                       # Team union grows 'neutral' for env entities (C1a)
    TileGrid.ts        # floor / shallow_water tiles + per-cell movement cost (C1a)
    LineOfSight.ts     # Bresenham line walk for ranged-attack LOS (C1b)
    Action.ts          # Action / ActionProposal / ActiveAction interfaces (A1)
                       # + toData() on Action for snapshot rehydration (A2)
    Command.ts         # WorldCommand union — drained at tick boundary (A2)
    Pathfinding.ts     # A* king's-move, Chebyshev heuristic
                       # + optional CostFn for per-cell weights (C1a)
    Targeting.ts       # findTarget — nearest enemy, ties by HP then id
                       # skips neutrals (C1a)
    archetypes.ts      # MELEE/RANGED bounds, rollUnit, glyphForArchetype
    environment.ts     # spawnWall + WALL_GLYPH — neutral-team env factory (C1a)
    terrainGen.ts      # per-encounter procedural tile + wall generator (C1a)
                       # + layout-library dispatch (C1b)
    layouts.ts         # C1b + C1d.A: thin re-export of validated config
                       # (see src/config/layouts.ts) — LAYOUT_IDS picklist
                       # for Run's 50/50 roll lives here for sim callers
    battleSetup.ts     # shared applyTerrain/spawnTeam/spawnEncounter (A3 + C1a)
    actions/
      MoveAction.ts          # logical position update + unit:moved event
      AttackAction.ts        # damage + unit:attacked event
      registry.ts            # action factories keyed by Action.id (A2)
    behaviors/
      MovementBehavior.ts    # proposeAction → MoveAction when out of range
      AttackBehavior.ts      # proposeAction → AttackAction when in range
      registry.ts            # behavior factories keyed by Behavior.kind (A2)
  run/
    Run.ts             # state machine: map|battle|recruit|defeat|complete + RNG + team + nodeMap
                       # + dispatch(RunCommand) + toJSON/fromJSON (A2)
    Command.ts         # RunCommand union + RunDispatcher interface (A2)
    NodeMap.ts         # DAG generation + dump
    Recruitment.ts     # rollOffer with archetype-variety guarantee
  render/
    Renderer.ts        # WebGLRenderer + EffectComposer + RAF loop + aspect-aware fitCamera
    FontAtlas.ts       # canvas2d glyph atlas → THREE.CanvasTexture
    SpriteRenderer.ts  # InstancedBufferGeometry + custom shaders
                       # + dual mesh (layer 0 visible / layer 1 bloom)
                       # + per-instance bloomIntensity attr (B1.1 selective bloom)
    TerrainRenderer.ts # C1c: faceted low-poly prism-per-tile (replaces the
                       # old fBm decorative plane + C1a WaterRenderer
                       # stand-in). Fixed-seed simplex heights, water tiles
                       # sunk to -0.4, heightAt(cx,cy,kind) is canonical
                       # for sprite Y too
    BattleRenderer.ts  # sim/render seam: attach/detach per battle
                       # neutral team → TERMINAL_STONE color, no bars/bloom (C1a)
                       # + tileWorldPos(coord) for per-tile sprite Y (C1c)
    PostProcess.ts     # SatClamp + Bloom + Scanlines + BloomMix factories (B1.1)
    palette.ts         # COLORS table — added TERMINAL_STONE for neutrals (C1a)
    shaders/           # .glsl source files loaded via Vite ?raw imports (A4)
                       # terrain.{vert,frag}.glsl rewritten for C1c faceted look
    animation/SpriteAnimator.ts  # startLerp + startFade + clear()
  scenes/              # A5: Scene system — single-active swap driven from Game
    Scene.ts           #   Scene interface + SceneContext bundle type
    BattleScene.ts     #   wraps World + Clock + BattleRenderer + HUD
    MapScene.ts        #   DOM-only, wraps MapScreen
    RecruitScene.ts    #   DOM-only, wraps RecruitScreen
    GameOverScene.ts   #   DOM-only, wraps GameOverScreen
  ui/
    ui.css
    fade.ts            # fadeIn / fadeOutAndRemove — shared screen transitions (Step 5.2)
    MapScreen.ts       # node map view + frontier click → dispatch enterNode
    RecruitScreen.ts   # 3-card recruit offer → dispatch chooseRecruit
    GameOverScreen.ts  # defeat / complete variants → dispatch resetRun
    HUD.ts             # in-battle HUD: floor, rosters, HP bars (Step 5.1)

tests/
  smoke.test.ts                              # vitest + module resolution
  integration/determinism.test.ts            # deterministic replay contract
  integration/snapshot-roundtrip.test.ts     # A2: World/Run JSON round-trip
  fuzz/                                      # A3: opt-in headless balance harness
    Strategy.ts                              #   pickNextNode / pickRecruit interface
    strategies/PureRandom.ts                 #   uniform-random baseline
    strategies/Greedy.ts                     #   prefer lowest-count archetype
    harness.ts                               #   runOne / runMany; RunResult shape
    reporters.ts                             #   CSV summary + markdown failure traces
    cli.ts                                   #   `npm run fuzz` entry point
    harness.test.ts                          #   smoke (run via `npm run fuzz:smoke`)
    output/                                  #   gitignored — regenerated each fuzz run

retro/
  scratchpad.md           # rolling scratchpad of process notes / gotchas
  post-mvp-review.md      # CHECKPOINT 7 retrospective written after MVP shipped

config/                              # A4: balance JSON source-of-truth
  archetypes.json                    # melee + ranged stat bands + glyphs
  difficulty.json                    # enemy size delta + per-floor HP scale
  recruitment.json                   # starting team + offer size
  nodemap.json                       # floor count + width bands + degree cap
  terrain.json                       # C1a: wall + water density + spawn rows
  layouts.json                       # C1d.A: hand-authored layout array
                                     # (id, name, description, walls, water?)

tools/                                       # dev-only, never in dist/
  layout-editor/                             # C1d.B: 12x12 grid painter
    index.html                               #   Vite entry — open at
                                             #   /tools/layout-editor/ in dev
    editor.ts                                #   paint + validate + export
    editor.css                               #   terminal-palette styling
    README.md                                #   launch + workflow notes
```

Co-located `*.test.ts` next to source for unit tests. Integration tests under `tests/`.

## Pre-flight (run when picking up a session)

```bash
git log --oneline -5    # confirm latest commit
npm test                # 211 passed, 0 todo
npm run fuzz:smoke      # 7 passed — confirms the harness still runs
npm run dev             # opens at :5173 — verify the full run flow plays
```

In the browser you should see: dark terrain (smooth blue→green→amber gradient) with 4px-thick scanlines, neon-glowing sprites (green allies + red enemies bloom equally on attack), map screen on load (right panel), click a frontier → battle plays out with in-battle HUD on the left → recruit modal (3 cards, at least one M + one a) → click a card → map screen at new node with visited trail. Win 4 in a row → green "Run Complete" screen. Lose → red "Defeat" screen. Button on either resets to a fresh map. All screen transitions fade over 180ms.

C1a adds: per-encounter terrain with gray `#` walls scattered on the arena (~9 per battle), shallow_water tiles rendered as flat blue patches (~6 per battle, units move through them at half speed). Walls + water never overlap the spawn rows; the arena always has a path between teams.

C1b adds: about half the battles use a hand-authored layout (corridor with two horizontal wall bands, or diamond with a center block) instead of scattered procedural walls; ranged units stop firing when a wall lands on the line between them and their target (you'll see them path-step around the wall rather than shoot through it).

C1c adds: the arena is now a faceted low-poly tile mesh — each cell is its own short prism with a hard-edged top facing up, height varies subtly per tile, water tiles drop into a visible sunken pool, grid lines bake into the top face of every prism. Sprites and walls stand on the actual tile they occupy (no more floating plane) and Y-lerp across height seams when they move.

## Toolchain versions

- Node 25.5, npm 11.8
- TypeScript 6.0.3, Vite 8.0.13
- three.js 0.184.0, simplex-noise 4.0.3, @fontsource/jetbrains-mono 5.2.8
- vitest 4.1.6, ESLint 10.4.0, typescript-eslint 8.59.3, prettier 3.8.3

## Existing memories

- `project_asciibattler.md` — points here. Update at major phase boundaries.
- `feedback_context_estimates.md` — don't fabricate context-window %s; use qualitative terms or trust the user's actual number.
