# TODO.md

Small follow-ups that aren't roadmap steps. Add things here when they're worth fixing but would derail the current step. Cross them off as we land them.

## Polish / pre-launch

- [ ] **Favicon.** Browser logs an error on every load because there's no `/favicon.ico`. Add one — could be a tiny inline-SVG `M` or `@` glyph in `TERMINAL_GREEN` matching the aesthetic. (Quick fix: add `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,..."/>` to `index.html`.)

## Dev affordances to remove before MVP ships (tracked under ROADMAP Step 5.3)

These are already marked with `TODO(roadmap-5.3)` in source; listed here for visibility.

- [ ] `OrbitControls` in `src/render/Renderer.ts` — replace with a fixed camera.
- [ ] `Stats` (FPS panel) in `src/render/Renderer.ts` — remove from production build.
- [ ] Debug `GridHelper` overlay in `src/Game.ts` + the `g` keypress toggle — remove before MVP ships.

## Post-MVP polish

- [ ] **Pathfinding directional bias.** A* in `src/sim/Pathfinding.ts` iterates neighbours in fixed `(dx, dy)` order with a strict `<` for `gScore` updates, so on equal-cost ties the path consistently drifts toward lower-x / lower-y cells. Visible at Step 3.5 as units crabbing leftward while they advance. Fix is either a tiebreaker (e.g. prefer the neighbour closer to the straight line from `start` to `goal`) or randomising the neighbour iteration order from the world RNG. Not critical for MVP — battles still resolve correctly.
- [ ] **Bake grid lines into the terrain shader.** The dev `GridHelper` overlay (toggleable with `g`) reads well — keep it permanently, but as part of the terrain fragment shader (`src/render/TerrainRenderer.ts`) instead of a separate overlay mesh. Will replace the Step 5.3 removal of the dev GridHelper.
- [ ] **Tighten vertical layout.** Terrain (`PLANE_BASE_Y = -0.5`, displacement `±0.4`), grid overlay (y=0), and sprites (`SPRITE_Y = 0.5` in `BattleRenderer`) sit further apart than necessary — the diorama feels stacked rather than flush. Reduce the gaps once the terrain-baked grid lands and we can eyeball the whole stack together.
- [ ] **Replace behavior-order priority with a proper action selector.** Right now action priority falls out of the `[MovementBehavior, AttackBehavior]` array order: the first behavior whose preconditions are met (and whose `unit.actionCooldown` is 0) acts. That works for two behaviors but doesn't scale to status-effect abilities, archetype-specific behaviors, or "prefer X over Y under condition Z." Post-MVP, swap to an explicit selector — each candidate action scores itself (or vetoes itself), the unit picks the highest-scoring valid action, and the chosen action sets the shared cooldown. Decouples "what actions exist" from "what should I do now."

## Bundle / perf

- [ ] Vite reports the production JS chunk is >500KB (essentially all three.js). Fine for an MVP, but worth a `build.chunkSizeWarningLimit` bump or a code-split pass if it gets noisy.
