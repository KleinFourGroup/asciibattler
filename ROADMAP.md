# ROADMAP — Post-C1

The build order after Phase C1 (terrain + tile foundation) landed. Companion
to [DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[TODO.md](TODO.md), and the prior roadmaps now at
[archive/mvp-roadmap.md](archive/mvp-roadmap.md) and
[archive/post-mvp-roadmap.md](archive/post-mvp-roadmap.md).

Synthesized from [archive/c1-feedback.md](archive/c1-feedback.md), the
unfinished tail of the prior post-MVP roadmap, and [TODO.md](TODO.md). Once
you've read this, `c1-feedback.md` is fully absorbed and lives in the
archive purely as a historical artifact.

## Where this came from

Phase C1 shipped the tile foundation, walls, ranged LOS, faceted-low-poly
terrain, and a hand-authored layout library with a 2D editor. Playing
with the editor surfaced that the 12×12 arena is the bottleneck on
*everything that's interesting* about future combat: archetype variety
(C2), recruitment depth (C3), unit upgrades (C4), and in-battle commands
(C5) all want more spatial room and richer board state than the current
fixed grid allows. The c1-feedback pass is therefore prioritized ahead of
the C2-C7 work that was previously next in line — Phase D (this
document's first phase) expands the battle-layout substrate; C2 and
beyond resume after.

## Conventions

Same shape as the post-MVP roadmap (less rigid than the MVP one):

- **Commit per logical change**, not per session.
- **Surface tradeoffs** before non-obvious calls.
- **Browser-verify visual work at native resolution.** Preview MCP
  screenshots are unreliable for sub-pixel detail (see
  [HANDOFF.md](HANDOFF.md) tips).
- **Keep DESIGN.md / ARCHITECTURE.md honest.** Update docs in the same
  commit as the code that invalidates them.
- **Headless-first for sim/run/core changes** — write a vitest test
  before reaching for the browser preview.

"Decision points" flag user-input moments (naming, design tradeoffs,
shader thresholds). Stop and ask.

---

## Phase D — Battle-layout expansion

The c1-feedback synthesis. Each step is sized to one or a small handful
of commits. Order is chosen to minimize rewrites: foundational data-
model changes land first, and **each step grows the editor with whatever
new schema it introduces** — so the editor's always usable for
authoring test maps as features land, not stuck at C1d.B's shape until a
late "editor overhaul" arrives.

The drag-paint and multi-layer UX bits with no schema prereq land at
the front of the phase (D2) so subsequent feature steps inherit them
rather than retrofit them.

### D1 — Renderer capacity bump

Quick, forward-compatible, unblocks everything else. The current
SpriteRenderer + BarRenderer caps (256 instances each) start to bite at
larger map sizes — a 32×32 board with 25% walls already crosses 256
sprites, and BarRenderer needs 2× the sprite count for HP + progress
bars.

- Bump SpriteRenderer to 1024 instances (per the c1-feedback ask).
- Bump BarRenderer to 2048 (two bars per unit, headroom for D3's larger
  boards).
- Audit `addSprite` / `addBar` error paths — the current "capacity
  exhausted" throw is correct, just needs to be triggered far less
  often.

**Decision point D1:** fixed cap vs. auto-grow. Auto-grow (allocate a
bigger `Float32Array`, copy, re-upload) is ~30 lines per renderer and
permanently retires the cap conversation, but every grow stalls a frame.
Fixed cap is simpler and predictable. Recommend fixed 1024/2048 now;
auto-grow if a real board needs it.

### D2 — Editor groundwork: drag-paint

Pure interaction-model change to the existing C1d.B editor, no schema
prereq. Lands early so every subsequent D-step's editor scope inherits
the drag-paint affordance and doesn't have to retrofit it across newly-
added tools.

- **Drag-paint primary tool.** Mousedown anywhere → mousemove paints
  every cell the cursor crosses with the current tool. Mouseup ends
  the stroke.
- **Drag-erase.** Right-click + drag erases (currently right-click is
  per-cell erase only).
- **Shift modifier stays.** Shift+click → water remains for one-off
  taps; drag with Shift held paints water continuously.
- **Stroke determinism.** Each stroke produces a single coalesced
  update to the JSON export panel + validation pass (not per-cell), so
  the export panel doesn't flicker during a drag.

Scope is intentionally tight: this step does not add layers, tile
kinds, gridSize selection, or anything schema-touching — those land
with the steps that introduce them.

**Decision point D2:** drag-erase vs. drag-paint-floor as the right-
click drag behavior. Equivalent today (only "floor" exists as a non-
content tile), but once D7's tile kinds and D5's spawn regions exist
the question is "does right-drag clear *everything* on the active layer
or just paint floor?" Recommend: clear the active layer's content for
each cell (matches the current click-to-erase semantics).

### D3 — Variable map sizes ✅ LANDED

User picked rectangular for hand-authored (`gridW`/`gridH`, 8-32),
square for procedural (10-20). Sim layer rewritten to take both
dimensions independently; `World.gridSize` gone; WorldSnapshot v3.
`reservedSpawnRows(gridH)` replaces the retired `terrain.json
spawnRowsClear` array. Renderer pre-allocates terrain buffers at the
32×32 cap and uses `setDrawRange`; `Renderer.fitToBoard(w, h)` is the
per-battle camera-fit hook. Editor: W/H dropdowns (8-32), in-place
rebuild, clip warning. Headless tests cover 10/15/20 procedural +
per-layout deadlock. See HANDOFF.md for the full diff. Next up: D4.

### D4 — Camera overhaul (dev fit + game scroll) ✅ LANDED

Two camera modes on `Renderer` (constants at the top of
[src/render/Renderer.ts](src/render/Renderer.ts)):

- **Mode A `fit`** — size-aware version of the pre-D4 framing.
  `fitCameraFit()` computes camera distance from the board AABB
  (`boardW + 2·XZ_PADDING` × `boardH + 2·XZ_PADDING` × `2·Y_HALF_EXTENT`)
  and looks at world origin. Default through D4 (`DEV_DEFAULT_MODE`).
- **Mode B `scroll`** — fixed `SCROLL_WINDOW_TILES = 12` window AABB,
  looks at `(cameraTargetX, 0, cameraTargetZ)`. Per-frame
  `updateScrollFromInput(dt)` sums pan keys (WASD + arrow keys both
  active, `PAN_KEY_CODES`) + edge-scroll (mouse within
  `EDGE_SCROLL_THRESHOLD_PX = 40` of any canvas edge) into XZ
  direction; pans at `PAN_SPEED_TILES_PER_SEC = 12`. Pitch stays locked; only XZ position moves. `clampCameraTarget`
  caps target to `±max(0, boardDim/2 - 6)` so the visible window stays
  inside the board (boards ≤ 12 in a dim → target snaps to 0 in that
  dim, no pan possible).
- **Toggle:** `e.code === 'Backquote'` (the `` ` ``/`~` key) swaps
  modes; logs `[camera] mode: fit|scroll`. Defaults to `fit` through
  D4 — D5 flips to `scroll` once spawn regions land.
- **Initial anchor:** `BattleScene.mount` calls
  `renderer.setCameraTarget(0, world.gridH/2 - 2)` after `fitToBoard`,
  anchoring on the player spawn rows (1-2). Preserved across mode
  toggles. D5 will switch this to the centroid of the rolled player
  region.
- **Listeners:** `keydown`/`keyup` on window (no canvas focus needed),
  `mousemove`/`mouseleave` on canvas (so HUD hover doesn't pan). Torn
  down in `Renderer.stop()`.
- Math factored — `computeCameraDistance(hx, hy, hz)` is the shared
  per-corner FOV math both modes call.

No new tests (render code is verified by eyeball per
[TESTING.md](TESTING.md)); 248 tests still pass. Next up: D5.

### D5 — Spawn-region system ✅ LANDED (A through E)

D5.A: schema + retrofit. D5.B: sim consumes regions. D5.C: overflow
queue + SpawnAction + WorldSnapshot v4. D5.D: editor layer system +
spawn-region painting. **D5.E (newest): `BattleScene.mount` anchors
the scroll-mode camera on the player region's centroid via
`gridToWorld({x:meanX,y:meanY},gridW,gridH)`, replacing D4's
`(0, gridH/2 - 2)` legacy heuristic.** `DEV_DEFAULT_MODE` stays `fit`
through D5 — the default flip is deferred. See HANDOFF.md for the
full per-step breakdown and gotchas #55-#69.

### D6 — New neutral unit: half-cover ✅ LANDED

Per-Unit `blocksLineOfSight` (default true), `spawnHalfCover` factory,
AttackBehavior's `collectWalls` → `collectLosBlockers` filtered by the
flag (retires gotcha #40). MovementBehavior splits its neutral-collector
into `pathBlockers` + `losBlockers` to keep the LOS-gated in-range
abstain consistent with the AttackBehavior view (new gotcha #71). Snapshot
schema 4 → 5. Glyph `╥` (U+2565) — JetBrains Mono renders a top rail
with two posts, reads as a low fence (user pick). Editor neutral-units
layer gains a wall/half-cover sub-tool radio in a new `#neutral-row`;
schema `LayoutDef.halfCovers?: Coord[]` with zod validation against
walls/water/spawn-region overlap; export JSON emits `halfCovers` after
`water`. Hand-authored only — procedural emits `[]` (gotcha #72). 284
tests pass. See HANDOFF.md for the full per-step breakdown and gotchas
#70-#72.

### D7 — New tile kinds: chasm, fire, healing

Three new entries in the `TileKind` union — `chasm | fire | healing` —
each with distinct movement and per-tick effects. Lands together
because they share the same World-tick hook and the same TerrainRenderer
visual path.

**TileGrid:**

- `chasm`: `Infinity` movement cost (data-driven block; equivalent to a
  blocker entry — gotcha #34 still holds for the heuristic).
  `blocksLineOfSight = false` (LOS crosses it freely).
- `fire`: normal cost 1; chip damage to occupants per tick. Open
  question on rate — see decision point.
- `healing`: normal cost 1; chip heal to occupants per tick. Same open
  question.

**Per-tick effects (new World.tick hook):**

After the selector + death splice, iterate units (id-sorted for
determinism) and:

- For each unit on a `fire` tile, deal `fireDamagePerTick` and emit
  `unit:attacked` (with `reason: 'fire'`) so HUD/BarRenderer pick up
  the HP change.
- For each unit on a `healing` tile, heal `healingPerTick` and emit
  `unit:healed` (new event, payload `{ unitId, amount, fromTile: true }`).
- Death handling reuses the existing splice path (no separate
  "killed-by-fire" branch).

**Events:**

- Add `unit:healed` to `core/events.ts`.
- Extend `unit:attacked` payload with an optional `reason` field (`'attack' | 'fire'`,
  default `'attack'`) so subscribers can branch.

**Snapshot/determinism:**

- TileGrid serialization already covers new tile kinds (the union is
  closed in zod and the snapshot path just stores the kind name).
- The tick hook's iteration order is fixed (`units.slice().sort(byId)`)
  so seed → outcome stays byte-stable.

**Renderer:**

- `TerrainRenderer.heightAt` extended for new kinds:
  - chasm: deep negative Y (sunken pit, e.g. -0.8 vs water's -0.4)
  - fire: floor height; visual is a hot-red emissive flicker (decision
    point on how to drive without scene lights)
  - healing: floor height; visual is a cool-cyan/blue glow
- Top-face color in `terrain.frag.glsl` branches on tile kind — extend
  the existing floor→water lerp to a full per-kind palette table.

**Editor scope (lands in this step):**

- Chasm, fire, and healing-pool entries in the terrain-layer palette
  (alongside floor and water).
- Drag-paint works for each via D2's groundwork.
- Validation rejects spawn-region tiles that land on chasm (cosmetic
  shape; spawning a unit into a pit is nonsense).

**Decision points D7:**

- **Chip rates.** Authored in seconds, converted via `secondsToTicks`
  (gotcha #6). Sensible defaults: fire 2 HP/sec, healing 1 HP/sec
  (fire more punishing than healing to keep healing pools from being
  free-camp spots). Tune during browser-verify.
- **"Pool" topology for healing.** c1-feedback flagged uncertainty.
  Don't enforce a topology — let the editor place healing as any
  shape, contiguous or scattered. The "pool" reading is purely
  visual.
- **Fire visual without scene lights.** Sprites are unlit by design
  (gotcha #46). Drive fire emissive via a baked color + a per-tile
  shader uniform with a sine flicker (analogous to the bloom max-
  channel pattern from gotcha #29). Don't add a `THREE.PointLight`.

### D8 — Tile theming ✅ LANDED

Closed-union `Theme = 'default' | 'rock' | 'volcanic'` on `LayoutDef`
(required, all 6 existing layouts retrofit with `default` per user
direction). `Run.handleEnterNode` adds a `rollTheme` draw on
`battleRng` between `rollProceduralSide` and `rollEnemyTeam` —
always advances (byte-continuity invariant, gotcha #89). Hand-authored
encounters use `layout.theme`; procedural uses the rolled value.
`TerrainRenderer.setTiles(tileGrid, gridW, gridH, theme)` consumes a
theme; `topColorFor` branches the FLOOR palette only — water / chasm /
fire / healing keep their fixed D7 colors per the D8 scope decision
(gotcha #88). Palettes: `default` = green→amber (unchanged); `rock` =
stone-dark→TERMINAL_STONE; `volcanic` = dark-red→amber (shares high
endpoint with default so fire tiles blend organically into volcanic
floors). HUD banner suffix: `"<name> — <Theme>"` for non-default themes
("Endless Corridors — Volcanic"); naked name for default
(gotcha #92). Editor: theme `<select>` in the Metadata card +
CSS-variable-driven live floor preview (gotcha #91); JSON export emits
`"theme"` immediately after `gridH`; round-trip byte-clean. Snapshot
`RUN_SCHEMA_VERSION` 1 → 2 (gotcha #90; TileGrid + Unit unchanged).
312 tests pass (was 303 pre-D8; +9 new). Browser-verified all three
themes in both editor and live battle. See HANDOFF.md for the full
per-step breakdown.

**Phase D is now COMPLETE.** Resume Phase C.

**Future work flagged for C6**: when multi-map runs land, theme moves
up a level — each node map carries a theme, procedural battles inherit
from the map's. `rollTheme` exits `Run.handleEnterNode` at that point.

### C2 — New archetypes: mage, rogue, healer

Enabled by A1 (done — action selector + multi-tick effects). Sketches —
refine during impl:

- **Mage** — slow charge-up attack, AoE or long range. Uses multi-tick
  action; also the first consumer of B3's currently-dormant action
  progress bar (gotcha #30 designed for this) and of C1b's wall
  destructibility plumbing (AoE damage lands on neutral cells
  regardless of Targeting's enemy-only filter).
- **Rogue** — fast attack speed, low HP, kites between attacks. New
  action: post-attack reposition.
- **Healer** — avoids combat; heals lowest-HP ally in range each cycle.
  Distinct from D7's healing-tile chip-heal (the tile is environmental,
  the healer unit is targeted).

**Decision point C2:** glyph assignments (`M`/`a`/`m`/`r`/`h`?
lowercase `m` vs uppercase `M` ambiguity?). Update the
[FontAtlas](src/render/FontAtlas.ts) glyph set. Also pick glyphs that
don't collide with D6's half-cover (whatever that ends up being) and
D7's tile-effect visuals.

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

Enabled by A2 (done). Targetless commands (switch to defensive AI,
retreat) and single-target commands (focus this enemy, hold this
location).

**Decision point C5:** how many command uses per battle? Cost gating
(cooldown, charges, none)? Interaction with difficulty.

### C6 — Multi-map / longer runs

Expand each map to 10 floors. Multiple maps per run. Target ~1 hour per
run.

Hard prerequisite: A3 (done — fuzz harness) — difficulty scaling will
need empirical tuning. The current `enemy.length = playerSize - 1` and
`+5% HP per floor` formula works for 4-floor MVP runs; it won't survive
40+ floors without tuning.

Also a natural consumer of D5's overflow-queue spawn (team sizes grow
past 8 over a long run) and D3's larger boards (more units want more
room).

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
  the array. Didn't bite in Phase D; re-evaluate during C6 (multi-map
  runs) when team sizes grow past the current ~8-unit band.
- **Favicon.** [TODO](TODO.md). Inline SVG glyph.
- **`.gitattributes`** to normalize line endings. Stops the CRLF warnings
  on every commit (retro item).
- **Bundle chunk-size warning.** Bump `chunkSizeWarningLimit` in
  [vite.config.ts](vite.config.ts), or code-split three.js if it gets
  noisy.
- **Terrain generator: bias water placement toward unit paths.**
  [TODO](TODO.md) — the generator scatters water uniformly, so the
  shallow-water cost-2 rule rarely gets exercised in practice. D5's
  spawn-region rewrite shipped without absorbing this; standalone
  follow-up now. Probably wants "place water in N clusters of size M"
  rather than per-cell Bernoulli.

---

## What we're explicitly NOT doing yet

- **Save/load UI.** A2 (done) laid the plumbing; the actual "load this
  saved run" UX is deferred until C6 (long enough runs that save
  matters).
- **Replay system.** Free once A2 (done) lands; build the UI when
  there's a reason (shareable seeds, bug repros).
- **Generic status-effect system.** A1 supports multi-tick effects
  technically. D7 adds per-tick tile effects with a targeted hook
  (fire damage, healing). Resist building a generic status system
  until C2 reveals what's actually needed beyond these.
- **Boss / elite encounters.** Deferred until C3 + C6 stabilize the
  recruit/depth surface.
- **Touch controls** for the camera. Deferred per c1-feedback; D4
  ships WASD + edge-scroll only.
- **Half-cover combat modifier.** D6 ships the unit type with an LOS
  flag only; any ranged-defense / accuracy bonus from being behind
  half-cover is a C2-era addition (the modifier is more interesting
  once mage AoE and rogue burst exist).
- **Editor "test play" button.** Carried over from the C1d.B punt.
  Would need URL-encoded handoff to the live game or a Vite middleware
  bridge. Re-evaluate after Phase D ships in full — the editor's other
  affordances may make this unnecessary, or the manual paste-into-JSON
  loop may finally hurt enough to justify the plumbing.
