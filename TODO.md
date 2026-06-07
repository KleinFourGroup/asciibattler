# TODO.md

Small follow-ups that aren't roadmap steps. Add things here when they're worth fixing but would derail the current step. Cross them off as we land them.

## Polish / pre-launch

- [ ] **`RNG` stat label vs `rng` reach are ambiguous on the recruit card.** GP3's raw-stat block labels the `ranged` damage stat `RNG` (the canonical `STAT_LABELS` in [src/ui/statLabels.ts](src/ui/statLabels.ts), shared with PromotionScreen), while each ability row shows its reach as `rng R` ([src/ui/RecruitScreen.ts](src/ui/RecruitScreen.ts) `abilityRow`) — same three letters, two different concepts (damage stat vs cells of reach). Reads fine so far but could trip a new player. Options: relabel the reach (`reach R` / `rng:R`), or rename the stat label (e.g. `RGD` for `ranged`) — note the latter touches the shared map, so it also re-labels the PromotionScreen delta row. Cosmetic; surfaced at GP3.1 playtest.
- [ ] **Favicon.** Browser logs an error on every load because there's no `/favicon.ico`. Add one — could be a tiny inline-SVG `M` or `@` glyph in `TERMINAL_GREEN` matching the aesthetic. (Quick fix: add `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,..."/>` to `index.html`.)
- [ ] **Recruit-card accent CSS for the new archetypes.** `RecruitScreen.renderCard` ([src/ui/RecruitScreen.ts](src/ui/RecruitScreen.ts)) stamps a `recruit-card--{archetype}` class per card, but `ui.css` only carries accent rules for `--melee` / `--ranged`. The rogue / healer / mage / catapult cards fall back to base styling (functional + on-aesthetic, just no per-archetype accent color). Add `recruit-card--rogue` / `--healer` / `--mage` / `--catapult` accent rules (border / glyph tint) matching the palette. Cosmetic; surfaced during F1's browser-verify pass. **Deferred to the post-H recruitment/rarity overhaul** (GP3 tee-up call — pairs with rarity tiers, NOT GP3). NB the same `--archetype` classes are stamped (unstyled) on the **promotion** cards too, so fold both screens in together.
- [ ] **Dedicated catapult SFX (+ F3 launch/impact split).** The catapult reuses the archer's `shoot` sample, played on `catapult:fired` at the *impact* tick ([BattleScene.ts](src/scenes/BattleScene.ts) ~:84). Two gaps: (1) it doesn't read as a heavy siege engine — it sounds like an arrow (the mage got its own `magicboom`; the catapult's dedicated SFX was deferred in E7.D). (2) F3 moved the projectile *launch* to the `release` phase (~12 ticks before impact), so the loose is now silent and the whoosh plays when the boulder *lands*. Proper fix with F3's phases: play a launch "creak/thunk/FWOMP" on `release` (subscribe to `action:phase` release for `catapult_shot`, mirroring `BattleRenderer.onActionPhase`) and a heavy "crash" on `impact` / `catapult:fired`. Needs 1–2 new assets in `public/audio/` + registration in [AudioPlayer.ts](src/audio/AudioPlayer.ts) (`SOUND_PATHS` + volume/pitch tables). Surfaced during F3 playtest. *(Same opportunity exists for the mage if its bolt launch wants a "fwoosh" on release — but `magicboom` at impact already reads right, so lower priority.)*
- [ ] **In-battle HUD stat line is getting crowded.** H1 added `POW` to the compact driving-stat line in [src/ui/HUD.ts](src/ui/HUD.ts) `formatStats`, taking it to four stats (`DEF · MOB · AGI · POW`). Reads fine now, but it's nearing the width where it crowds / wraps the roster panel, and `power` is a meta-stat (chips the encounter/run health pools) sitting beside three in-battle cadence/mitigation dials it has nothing to do with. Revisit the HUD stat presentation — e.g. drop `power` back off the in-battle line once its role is legible elsewhere, visually separate meta vs combat stats, or give the roster panel more room. Cosmetic; surfaced at H1. Out of scope for Phase H — circle back later.
- [ ] **`power` wants distinct visual treatment on the recruit / promotion cards.** `power` now renders as a plain stat row among the eight tactical stats ([src/ui/RecruitScreen.ts](src/ui/RecruitScreen.ts) + [src/ui/PromotionScreen.ts](src/ui/PromotionScreen.ts), both via the shared `Object.keys(STAT_LABELS)` loop in [src/ui/statLabels.ts](src/ui/statLabels.ts)), but it has a categorically different mechanical impact — the Phase-H meta-currency that chips the health pools across a whole encounter, not a per-battle combat stat. Give it visual distinction so a drafting player reads it as special: a separator / its own section, an accent color, an icon, or a clarifying label. Pairs with the recruit-card accent CSS item above (fold both screens in together). Cosmetic; surfaced at H1. Out of scope for Phase H — circle back later.

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
      highest-scoring valid proposal. See gotcha #8 in [GOTCHAS.md](GOTCHAS.md) for the model.

## Design explorations (post-Phase-G)

- [ ] **Movement abilities (dash / gap-closer) — the real rogue fix.** H7c added a
      general per-archetype **targeting strategy** field ([config/archetypes.json](config/archetypes.json) +
      [src/sim/targetingStrategies.ts](src/sim/targetingStrategies.ts): `nearest` / `weakest`). The plan was to
      make the rogue target the **weakest** (squishiest) enemy = "backline assassin." A
      forced-roster eval **disproved it for our rogue**: `weakest` *halved* the rogue's
      damage (6.1 → 3.1 dmg/dep) and the free search still never recruited it. Mechanism:
      the rogue is **range 1** with no gap-closer, so committing to the farthest squishy
      mark makes it walk *past* adjacent enemies it could strike (the strike only fires on
      the committed target), dying en route. `weakest` is left **registered but unassigned**
      (all archetypes = `nearest`) — it's the right strategy for a unit that can actually
      *reach* the backline. So the real rogue fix is **mobility**: a dash / leap / blink
      ability (a new ability + likely a small action-phase + movement-intent seam) that
      closes distance to the assassination target, at which point flipping the rogue to
      `weakest` becomes viable and measurable (re-run the same forced-roster eval). Pairs
      with the broader deferred rogue identity work (evasion / stealing — Phase I+ / shop).
      Surfaced 2026-06-07 during the H7c rogue pass; full data in [BALANCE.md](BALANCE.md).
- [ ] **Turn-limit / tick-cap resolution — a deeper system.** In the G5
      multi-turn battle model, a *turn* whose tactical battle hits the
      tick-cap resolves as a **draw**: both sides' surviving units chip the
      opposing health pool by their Σpower (the placeholder rule). Worth a
      deeper dive — e.g. scaling the chip by how decisively the cap was
      approached, a sudden-death escalation, or a smarter "who was winning"
      heuristic than raw survivor count. Must also handle the
      mutual-total-wipe edge (0 survivors on both sides → 0 damage → relies
      on the encounter max-turns safety cap so it can't loop forever). Out
      of scope for Phase G; revisit once the multi-turn loop has playtest
      data. (Flagged by the user during the Phase-G roadmap sync.)

## Bundle / perf

- [ ] Vite reports the production JS chunk is >500KB (essentially all three.js). Fine for an MVP, but worth a `build.chunkSizeWarningLimit` bump or a code-split pass if it gets noisy.

## Docs / tooling

- [x] **Catch doc-tree drift automatically.** **(Done 2026-06-07:** the three hand-maintained trees were consolidated — [ARCHITECTURE.md](ARCHITECTURE.md) "Top-level structure" is now the single canonical tree, and HANDOFF's "Project shape" + AGENTS's "Project tree" are pointers to it; then [tests/docs.test.ts](tests/docs.test.ts) was added to parse that tree on every `npm test` and fail if a listed file path no longer exists (it also caps HANDOFF + `Current state` line counts as a bloat tripwire).**)** Originally: HANDOFF.md "Project shape", AGENTS.md "Project tree (abbreviated)", and ARCHITECTURE.md "Top-level structure" each carried a hand-maintained file tree that silently rotted as `src/` changes — by GP1 all three listed retired files (`BarRenderer`, `AttackBehavior`), stale `WorldSnapshot` versions, and the pre-E7 archetype set; resynced in `3657bf6` + `037f634`. Worth a lightweight guard so drift is caught at the next change instead of accumulating: e.g. a vitest/CI check that parses the fenced tree in each doc and asserts every listed `src/**` path exists (optionally flagging real files absent from the tree), or — lower effort — a convention that these trees defer to one generated source instead of three hand-copies. Complements the AGENTS "Trim HANDOFF when it grows unwieldy" note (that targets size growth; this targets accuracy). Surfaced during the GP1 doc-hygiene pass.
