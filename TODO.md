# TODO.md

Small follow-ups that aren't roadmap steps. Add things here when they're worth fixing but would derail the current step. Cross them off as we land them.

## Polish / pre-launch

- [ ] **Favicon.** Browser logs an error on every load because there's no `/favicon.ico`. Add one — could be a tiny inline-SVG `M` or `@` glyph in `TERMINAL_GREEN` matching the aesthetic. (Quick fix: add `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,..."/>` to `index.html`.)

## Dev affordances to remove before MVP ships (tracked under ROADMAP Step 5.3)

All items previously listed here landed in Step 5.3 (`OrbitControls`, `Stats`,
`GridHelper`, `q`/`g` keypresses, `RUN_SEED`, debug logs). Camera is locked
to a fixed pitch and fits the arena AABB to the viewport on every resize.

## Post-MVP polish

- [ ] **Pathfinding directional bias.** A* in `src/sim/Pathfinding.ts` iterates neighbours in fixed `(dx, dy)` order with a strict `<` for `gScore` updates, so on equal-cost ties the path consistently drifts toward lower-x / lower-y cells. Visible at Step 3.5 as units crabbing leftward while they advance. Fix is either a tiebreaker (e.g. prefer the neighbour closer to the straight line from `start` to `goal`) or randomising the neighbour iteration order from the world RNG. Not critical for MVP — battles still resolve correctly.
- [ ] **Bake grid lines into the terrain shader.** The dev `GridHelper` overlay (toggleable with `g`) reads well — keep it permanently, but as part of the terrain fragment shader (`src/render/TerrainRenderer.ts`) instead of a separate overlay mesh. Will replace the Step 5.3 removal of the dev GridHelper.
- [ ] **Tighten vertical layout.** Terrain (`PLANE_BASE_Y = -0.5`, displacement `±0.4`), grid overlay (y=0), and sprites (`SPRITE_Y = 0.5` in `BattleRenderer`) sit further apart than necessary — the diorama feels stacked rather than flush. Reduce the gaps once the terrain-baked grid lands and we can eyeball the whole stack together.
- [ ] **Root node reads as selectable.** Node 0 is the run's starting position — shown on the map as the "current" node, never clickable — but it's drawn with the same numbered circle as battle nodes, which makes "you never pick 0" feel like a quirk instead of "0 is where you start." Either drop the number on the root (replace with a glyph like `▶` or `@`, or just an empty filled dot), or give the root a different shape so it visually reads as origin rather than skipped-option. Lives in [src/ui/MapScreen.ts](src/ui/MapScreen.ts).
- [ ] **Floating per-unit HP bars.** The Step 5.1 HUD shows full roster + HP on the left panel, which works at MVP scale (≤9 units/team) but won't scale to larger arenas. Add small bars under each unit's billboarded sprite, probably as a second `InstancedBufferGeometry` in a `HealthBarRenderer` (2 instances per unit: background + width-scaled fill), wired through `BattleRenderer` on `unit:spawned` / `:attacked` / `:died`. The fiddly part is position-following: bars need to track `SpriteAnimator` lerps every frame during movement, not just snap to grid cells. Avoid HTML overlay — would skip the palette quant and clash with the diorama. Could either replace the panel HUD or complement it; defer that call to when larger arenas land.
- [x] **Replace behavior-order priority with a proper action selector.** Landed
      in ROADMAP A1 alongside the cooldown/duration split and multi-tick action
      machinery. Behaviors implement `proposeAction(unit, world)` returning a
      scored `ActionProposal`; the selector in `World.tick()` picks the
      highest-scoring valid proposal. See HANDOFF gotcha #8 for the model.

## Bundle / perf

- [ ] Vite reports the production JS chunk is >500KB (essentially all three.js). Fine for an MVP, but worth a `build.chunkSizeWarningLimit` bump or a code-split pass if it gets noisy.
