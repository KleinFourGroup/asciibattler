# TODO.md

Small follow-ups that aren't roadmap steps. Add things here when they're worth fixing but would derail the current step. Cross them off as we land them.

## Polish / pre-launch

- [ ] **Favicon.** Browser logs an error on every load because there's no `/favicon.ico`. Add one — could be a tiny inline-SVG `M` or `@` glyph in `TERMINAL_GREEN` matching the aesthetic. (Quick fix: add `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,..."/>` to `index.html`.)

## Post-MVP polish

- [ ] **Pathfinding directional bias.** A* in `src/sim/Pathfinding.ts` iterates neighbours in fixed `(dx, dy)` order with a strict `<` for `gScore` updates, so on equal-cost ties the path consistently drifts toward lower-x / lower-y cells. Visible at Step 3.5 as units crabbing leftward while they advance. Fix is either a tiebreaker (e.g. prefer the neighbour closer to the straight line from `start` to `goal`) or randomising the neighbour iteration order from the world RNG. Not critical for MVP — battles still resolve correctly.
- [ ] **Terrain generator: bias water placement toward unit paths.** The C1a generator scatters water uniformly across non-spawn rows, but unit paths run nearly straight between spawn bands so the shallow-water movement cost almost never gets exercised in practice — water tiles end up purely decorative. Options to make water meaningful: cluster tiles into patches (so they form actual obstacles rather than isolated singletons), bias placement toward the middle rows where unit traffic concentrates, or seed water specifically along the straight line between spawn columns + spread outward. Probably wants a small "place water in N clusters of size M" pass rather than per-cell Bernoulli. Folds naturally into a broader generation pass alongside C1b's hand-authored layout library — both want the generator to think in terms of features, not independent cells.
- [x] **Renderer capacity audit.** Landed in ROADMAP D1 — `SpriteRenderer`
      default bumped 256 → 1024, `BarRenderer` 256 → 2048 (two bars per unit,
      headroom for D3's larger boards). Error paths already throw with the
      live capacity in the message; auto-grow stays deferred per D1's
      "fixed cap is simpler and predictable" call.
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
