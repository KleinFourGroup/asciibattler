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
- [x] **Bake grid lines into the terrain shader.** Folded into ROADMAP C1
      (C1c visual + layout pass) — C1 replaces the terrain mesh and the grid
      IS the tile boundaries, so doing this standalone would just need
      redoing.
- [x] **Tighten vertical layout.** Folded into ROADMAP C1 (C1c) — only worth
      tuning once the terrain has its final height profile.
- [x] **Root node reads as selectable.** Landed in ROADMAP B7. Node 0 now
      renders the roguelike `@` glyph with a `.root` class hook in
      [src/ui/MapScreen.ts](src/ui/MapScreen.ts); other state classes still
      apply on top so the root reads as origin regardless of where the
      player currently is.
- [x] **Floating per-unit HP bars.** Landed in ROADMAP B3 — new
      `BarRenderer` mirrors the SpriteRenderer instancing pattern, two
      bars per unit (HP + action progress), green→amber→red gradient,
      position-follow via `SpriteRenderer.getPosition`. Action progress
      skipped for movement so it doesn't flash every step. See HANDOFF for
      the full summary.
- [x] **Replace behavior-order priority with a proper action selector.** Landed
      in ROADMAP A1 alongside the cooldown/duration split and multi-tick action
      machinery. Behaviors implement `proposeAction(unit, world)` returning a
      scored `ActionProposal`; the selector in `World.tick()` picks the
      highest-scoring valid proposal. See HANDOFF gotcha #8 for the model.

## Bundle / perf

- [ ] Vite reports the production JS chunk is >500KB (essentially all three.js). Fine for an MVP, but worth a `build.chunkSizeWarningLimit` bump or a code-split pass if it gets noisy.
