# TODO.md

Small follow-ups that aren't roadmap steps. Add things here when they're worth fixing but would derail the current step. Cross them off as we land them.

## Polish / pre-launch

- [ ] **Favicon.** Browser logs an error on every load because there's no `/favicon.ico`. Add one — could be a tiny inline-SVG `M` or `@` glyph in `TERMINAL_GREEN` matching the aesthetic. (Quick fix: add `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,..."/>` to `index.html`.)
- [ ] **Recruit-card accent CSS for the new archetypes.** `RecruitScreen.renderCard` ([src/ui/RecruitScreen.ts](src/ui/RecruitScreen.ts)) stamps a `recruit-card--{archetype}` class per card, but `ui.css` only carries accent rules for `--melee` / `--ranged`. The rogue / healer / mage / catapult cards fall back to base styling (functional + on-aesthetic, just no per-archetype accent color). Add `recruit-card--rogue` / `--healer` / `--mage` / `--catapult` accent rules (border / glyph tint) matching the palette. Cosmetic; surfaced during F1's browser-verify pass.

## Post-MVP polish

- [x] **Pathfinding directional bias.** Folded into ROADMAP E5.B
      (pathfinding refresh) — the boids-style sidestep step is going to
      overhaul neighbor iteration anyway, so the tie-break lands as part
      of that pass. Recommended fix kept: deterministic straight-line
      bias rather than RNG-shuffled iteration (RNG-shuffling shifts the
      byte stream every tick a tie fires).
- [ ] **Terrain generator: bias water placement toward unit paths.** The C1a generator scatters water uniformly across non-spawn rows, but unit paths run nearly straight between spawn bands so the shallow-water movement cost almost never gets exercised in practice — water tiles end up purely decorative. Options to make water meaningful: cluster tiles into patches (so they form actual obstacles rather than isolated singletons), bias placement toward the middle rows where unit traffic concentrates, or seed water specifically along the straight line between spawn columns + spread outward. Probably wants a small "place water in N clusters of size M" pass rather than per-cell Bernoulli. (Lower priority post-D5: spawn regions can be anywhere on the board now, not just the rows water used to dodge. Listed in ROADMAP cleanup.)
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
