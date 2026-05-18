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

### A2 — Headless input + serialization plumbing

Why now: unlocks both in-battle commands (C5) and save/load + fuzz
testing. Each becomes a thin layer rather than a wrapper-and-rewrite.

- Define a typed `Command` channel on [World](src/sim/World.ts) and
  [Run](src/run/Run.ts). Same channel used by the in-browser UI and by a
  headless test harness.
- Make `World` and `Run` JSON-round-trippable end-to-end. The contract
  was always implicit ([ARCHITECTURE.md](ARCHITECTURE.md) principle #6);
  tighten it. Behavior class instances rehydrate via a registry keyed by
  `kind`.
- Snapshot test: serialize → deserialize → simulate N ticks → identical
  event sequence to the no-roundtrip baseline.

Save/load UI is *not* part of this; just the plumbing.

### A3 — Headless fuzz harness

Why now: Phase C content (longer runs, new archetypes, leveling) needs
empirical balance data. Also: catches determinism violations the eyeball
will miss.

- Entry point that runs N full runs headless from a seed list, with a
  pluggable "strategy" interface for recruit and (later) in-battle
  command decisions.
- Modes to start:
  - **Pure random** — recruit picks chosen uniformly.
  - **Greedy** — recruit prefers the archetype with lowest current count.
- Output: aggregated CSV (run length, deaths per floor, win rate by team
  composition) plus a per-run markdown trace for the failures.
- Lands as `tests/fuzz/`, opt-in (skipped by default in `npm test`).

### A4 — Config externalization

Why now: before stat-roll tables grow with new archetypes (C2/C3), pull
them out of TypeScript so balance edits don't require recompiling.

- Move archetype stat bounds, recruitment composition rules, difficulty
  curve, etc., into `config/*.json` files. Validate against TS interfaces
  at boot.
- Hoist the shader source out of the `const` literals in
  [src/render/PostProcess.ts](src/render/PostProcess.ts) and friends into
  the existing-but-empty `*.glsl` stub files. Vite has `?raw` imports.

### A5 — Scene system

Why deferred (but not skipped): every non-battle "screen" today is a DOM
modal toggled by [Game.ts](src/Game.ts). The first feature requiring
engine rendering outside battle (a 3D map view, a minigame, an animated
recruit screen) forces this refactor. Flagging here so it lands *before*
that feature, not during.

- `Scene` interface: `mount(canvas)`, `tick(dt)`, `dispose()`. `Game`
  becomes a scene-stack manager.
- Migration: wrap the current `BattleRenderer + World` pair into a
  `BattleScene`. DOM-only screens stay DOM-only for now; they just become
  `Scene` instances that mount no 3D content.

---

## Phase B — Style and visual direction

Mostly independent of Phase A and of each other. Order by what you want
to look at first.

### B1 — Palette experiment ("Tron shift")

Per feedback: the strict palette quant is too restrictive for glow
effects. Move toward terminal greens + ambers + neons + any darker/lighter
shades up to black/white. Vibe shifts from "old terminal" toward "Tron."

**Approach:** build a side-by-side demo page rendering the same battle
frame under several variants:
- (a) current strict palette
- (b) hue-locked, free luminance (palette controls hue families, allows
  any brightness)
- (c) full-RGB but saturation-clamped
- (d) a user-proposed alternative

**Decision point B1:** user picks; update DESIGN.md aesthetic section
and the palette-quant pass in [PostProcess.ts](src/render/PostProcess.ts).

Touches the load-bearing palette-quant gotchas (HANDOFF #2–#4). Re-read
those before designing the new pass.

### B2 — Low-poly 3D asset style

Feedback: more deliberate low-poly style for 3D assets.

**Decision point B2:** flat-shaded or smooth-shaded? Hand-authored
meshes or procedural-from-simplex? Wall/obstacle look (couples to C1).

### B3 — Floating per-unit HP bars + action progress bar

[TODO](TODO.md) item, expanded. Two `InstancedBufferGeometry` quads per
unit (background + width-scaled fill) tracked through `SpriteAnimator`'s
lerp pipeline. Plus a thinner second bar showing action progress (the
"duration" portion of A1 — useful only after A1 lands).

Avoid HTML overlay — palette quant doesn't apply to DOM, would clash.

### B4 — Bake grid + tighten vertical layout

[TODO](TODO.md) items: bake grid lines into the terrain fragment shader
([TerrainRenderer.ts](src/render/TerrainRenderer.ts)) instead of a
dev-only `GridHelper` overlay; reduce the `PLANE_BASE_Y / SPRITE_Y` gaps
so the diorama feels flush rather than stacked.

### B5 — Scanlines extending over DOM UI

Feedback: dither staying canvas-only is fine, but scanlines breaking at
the canvas/DOM seam reads as incongruous.

Options:
- CSS `repeating-linear-gradient` overlay on the UI layer, synced to the
  canvas scanline pass parameters.
- A second full-screen canvas above the DOM with `mix-blend-mode`.

**Decision point B5:** which approach. Depends on whether DOM scanlines
need to exactly track the canvas pass (frequency, intensity, alignment).

### B6 — Audio

Big perceptual win for contained scope. Retro flagged this; autobattlers
live or die on attack/death sound feedback.

Scope: attack-impact, death, recruit-card-flip, UI clicks, run-complete
fanfare. HTMLAudioElement to start; revisit Web Audio API if we need
spatialization or precise scheduling.

### B7 — Root node clarity

[TODO](TODO.md) item. Node 0 reads as a skipped option because it uses
the same numbered-circle visual as battle nodes. Swap the glyph (`▶` or
`@`) or change the shape so it visually reads as origin.

---

## Phase C — Gameplay expansion

**Hard prerequisite:** A1 (action selector) before any of these. A4
(config externalization) before C2/C3. A3 (fuzz harness) before C6.

### C1 — Tile-based terrain with obstacles

Replace "terrain is decoration" with a grid of tile types. Each tile
type has properties: passable / blocking, optional movement cost
modifier, optional combat modifier (cover, damage bonus, etc.). Walls
and obstacles populate the arena per encounter seed.

**Decision point C1:** walls as rendered 3D blocks or roguelike
billboarded `#`? Likely couples to B2 (low-poly direction).

Pathfinding ([src/sim/Pathfinding.ts](src/sim/Pathfinding.ts)) already
takes blockers; the integration cost is mostly in encounter generation
and the renderer.

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
