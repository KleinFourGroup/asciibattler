# TODO.md

Small follow-ups that aren't roadmap steps. Add things here when they're worth fixing but would derail the current step. Cross them off as we land them.

**Completion convention (2026-07-06):** a completed item collapses to a single ✅ line + a pointer (commit hash, doc §, or "git history") *in the commit that lands it* — the full diagnosis lives in git history and the run-logs, not here.

## Phase Qb — deferred bug investigations ✅ (both fixed 2026-06-18, user-confirmed)

- [x] **#2 — Billboard sprite depth sorting.** Draw order = spawn slot, so a farther sprite could paint over a nearer one; fixed via per-frame `SpriteRenderer.sortByDepth(camera)` (`0d9413e`). Full diagnosis in git.
- [x] **#3 — Kiting archer pathed onto an enemy in a corridor.** A blocked kiter inside `minRange` fell through to the soft-excluded target-cell fallback; fix omits that fallback when kiting (`b6da01f`). Full diagnosis in git.

## Phase T — deferred bug (T3 layout-editor toggle) ✅

- [x] **"Add to sector" button did nothing.** Un-imported `LAYOUT_IDS` → runtime `ReferenceError` swallowed by a `void` handler; fixed 2026-06-19 (+ the confirmation now survives Vite's full-reload). Full diagnosis in git.
- [x] **Typecheck coverage extended to `tools/` + `tests/`.** Root tsconfig `include` widened; 49 pre-existing errors fixed type-only (2026-06-19). Detail in git.

## Micro round (53→57) — watch items

- [ ] **Gauntlet spiral cells: spawn geometry is seed-rolled, not cell-pinned.** The 53g session surfaced (user report) that the three `spiralFireLife` cells' why-labels (adjacent-alpha / edge-hold / opposite-stall) describe *tendencies* — `pickSpawnRegions` rolls the geometry per seed, so e.g. alpha-spiral seeds 201/203 spawned non-adjacent and cleared instantly while 202 produced the real alpha strike (BALANCE §53g caveats). Fine for 53g's paired read (both sides play the same roll), but **if §54's re-measure needs geometry controlled** (a script's trigger may be geometry-keyed), either classify each cell×seed's actual geometry from the committed traces (spawn regions are replayable) or add an optional spawn-region pin to the cells. Surfaced 2026-07-13.

## Polish / pre-launch

- [ ] **Stalled-battle draw prompt (live-game UX).** The only stall guard is
  the per-turn tick cap (`resolveAsDraw`, driver-owned) — a player who hits a
  genuine stall IRL is stuck watching until the cap expires, with no engine
  heuristic to offer "this looks stalled; accept a draw?" earlier. Idea
  (user): a cheap no-progress read (e.g. no damage/pool movement for N
  seconds) that surfaces an accept-a-draw prompt in the UI. Sim read +
  UI-only surface; no effect on headless (harness keeps the hard cap).
  Originally floated around the draw/timeout-counter unification but never
  noted; captured 2026-07-15.

- [ ] **Mercury coin-flip watch.** The §51 kickoff report ("always got the full redraw for a whole run") closed NOT-REPRODUCIBLE: the engine is proven on the exact live path (a kickoff probe drove 100 ROLLED-mercury runs — 826 gated turns, 44.9% granted, one ≥8-turn all-heads seed), and the user's very next native run behaved. If a future run shows the same streak, grab its seed (`?seed=`) and re-probe on the rolled path before touching the engine — the "Idol of Mercury is silent" denial line (PreTurnScreen) is the tell to watch for. Detail: WORKLOG.md §51 kickoff (2026-07-11).

- [ ] **Renderer position-reconciliation sweep (self-heal + REPORT sprite/sim
  desyncs).** The 56e labyrinth desync (a sprite resting tiles from its
  logical cell, fixed at 56e-pre2 via `unit:swapAborted`) showed the failure
  class exists: the renderer maintains derived position state via
  event-driven lerps with NO reconciliation, so any missed/unhonored slide
  desyncs a sprite until its next absolute-target move. The cheap tier:
  each frame, any sprite with NO active animator entry whose position
  disagrees with its unit's logical cell beyond an epsilon gets the §36c
  settle-lerp — plus a DEV-mode `console.warn` naming the unit and offset,
  which turns unreproducible one-glimpse sightings into logged data (the
  user's "several tiles off" report couldn't be confirmed at 1-cell-per-
  failure; a warn would have named the real offset). Guard: only reconcile
  when the animator holds nothing for the handle (never fight a lunge/
  shove/slide). The full tier — sprite pos = authoritative base derived
  from sim position + transient offset envelopes (derive-don't-cache for
  the render layer) — makes desync impossible by construction but is a
  real SpriteAnimator/BattleRenderer rework in the eyeball-only layer;
  size it only if the warn ever fires after 56e-pre2. Filed 2026-07-15
  (user question at the 56e-pre2 diagnosis).

- [ ] **Renderer "queued/waiting" stance — the §44/§46 ship-feel deferral.** Units now WAIT on purpose (§44b's first-class `WaitAction`; §45b queues) and the seam for showing it was planted deliberately: the `unit:waited` event (event-only, [WaitAction.ts](src/sim/actions/WaitAction.ts)) fires once per deliberate hold. A subtle render tell (dim pulse, stance glyph tint, whatever reads at a glance) would let a player SEE "this unit is queueing, not stuck" — the §46 decision point deferred it as pure ship-feel polish. Render-only; no sim/snapshot impact. Natural home: any Cluster-3+ polish rider or the pre-launch pass. Filed at the §46c close-out (2026-07-06).

- [x] **§40a rubble glyph — a true HALF-height look.** Done 2026-07-02, user-confirmed native: the glyph is now `▄` (U+2584 LOWER HALF BLOCK), replacing the `%` stopgap. Detail in git.

- [ ] **hcloud create/destroy automation for measurement boxes.** The 57f2 box (Hetzner CX43) stays live through the micro round and dies at round close (§60-ish). At that point, script the lifecycle via the `hcloud` CLI (`server create` → [scripts/box-setup.sh](scripts/box-setup.sh) → `server delete`) so boxes spin up on demand — the provisioning script already makes a box a pure function of commit hash; the missing piece is only the create/destroy plumbing. Needs an hcloud API token (user's Hetzner console). Day-to-day batch driving is already structured ([scripts/box-batch.sh](scripts/box-batch.sh), 57g-pre). Filed 2026-07-17, promoted from worklog §57f2's "UNSCHEDULED" note so it survives round-close archiving.

- [ ] **Auto-generate glyph ink-boxes at atlas build (retire the hand-maintained `GLYPH_INK` table).** The §40e clickbox fix ([glyphs.ts](src/render/glyphs.ts) `GLYPH_INK` / `glyphInk` / `FULL_GLYPH_INK`, consumed by [pick.ts](src/render/pick.ts) `pickInstanceAtNdc`) added a per-glyph normalized ink-rect so a click hit-box hugs the visible glyph instead of the full quad — but the table is **hand-maintained with a single MEASURED entry** (`▄`, from a one-off browser rasterization); every other glyph falls back to `FULL_GLYPH_INK` (the whole cell), so only rubble is tight. **The clean replacement:** [FontAtlas.create](src/render/FontAtlas.ts) already rasterizes EVERY glyph to a 2D canvas, so after the `fillText` pass, read the alpha channel per cell, compute each glyph's ink bounding box, normalize to the cell (+ the same canvas→GL y-up flip `getGlyphUV` does), and expose it (e.g. `FontAtlas.getGlyphInk(glyph)`, a sibling of `getGlyphUV`). The billboard builders ([BattleRenderer](src/render/BattleRenderer.ts) `enemyBillboards`/`destructibleBillboards`) then stamp `fontAtlas.getGlyphInk(glyph)` instead of the static `glyphInk(glyph)`, and `GLYPH_INK` + its one measured constant are deleted. This yields a TIGHT box for EVERY glyph for free (small sprites' corner slop too, not just `▄`) and removes the measure-and-hardcode chore whenever a glyph is authored. **Wrinkle:** `glyphInk` is currently a pure, synchronous, THREE-free function (headless-usable); the atlas builds ASYNC in the browser, so the dynamic ink lives at render time — fine, since only the render/pick path needs ink and it always has a built `FontAtlas`; keep `FULL_GLYPH_INK` as the fallback for any glyph the atlas hasn't measured. Pick an alpha threshold (the one-off used `>16`) + maybe a hair of padding for click feel. **Independent of** the heavier future pixel-perfect **alpha-mask** direction (for an irregular glyph where a rectangle over-selects the corners — e.g. a giant `G`); this is just the near-term "stop hand-computing boxes" cleanup, and the same per-glyph atlas data is where a coverage mask would later live. Surfaced 2026-07-03 (user call, at the §40e clickbox follow-up).
- [x] **Isthmus pathing/clumping probe.** Resolved by the Pathfinding Audit round: §45a vacancy costs + §45b's ETA-gated wait convert the mouth pile-up into deliberate queues (isthmus oscillation 0.000 on all six team-seeds), and §46a gated flow fields OUT on the measured residue; the 2-wide crossing stays brutal BY DESIGN (user call). See [PATHING.md](PATHING.md) §45d/§46a; original deep-water diagnosis in git history.
- [ ] **Check sprite-on-tile alignment for tiles toward the far left/right edges of the camera.** Surfaced by the user during the Z3 playtest (2026-06-24). **NOT a Z3 regression** — Z3 only re-homed the cue FX onto `action:phase` fx keys; it touched **no** billboarding/positioning code (the sprite vertex shader [billboard.vert.glsl](src/render/shaders/billboard.vert.glsl), [SpriteRenderer](src/render/SpriteRenderer.ts), and `gridToWorld`/`tileWorldPos` in [BattleRenderer](src/render/BattleRenderer.ts) are all unchanged). So whatever's visible at the screen edges is pre-existing. **What to look at:** the billboard quad is offset in **view space** about the projection of its world anchor (a unit sits at `tileWorldPos` = the tile center lifted by `SPRITE_CENTER_OFFSET`), so under the pitched perspective camera a sprite far from screen center can appear shifted relative to the flat tile beneath it. This is the same off-axis-projection family that already bit two markers and was fixed by switching a world-Y lift onto the **camera-up** axis: the **J3 objective marker** (`OBJECTIVE_MARKER_ENEMY_LIFT` / `updateObjectiveMarker` in BattleRenderer — the enemy `X` skewed sideways for off-center units until the lift moved to camera-up) and the **I2 hitsplat** (`UnitOverlayLayer.spawnHitsplat`). **Diagnose:** pick a unit on a far-edge tile, compare its rendered screen position against the tile's projected center (sample via `getImageData` / the `__game` handle, the screenshot tool smears sub-pixel detail per the HANDOFF browser-verify tips); decide whether it's (a) inherent billboard view-space offset under perspective (cosmetic, may be acceptable), (b) a camera fit/scroll centering issue ([Renderer.ts](src/render/Renderer.ts) `fit`/scroll), or (c) the `SPRITE_CENTER_OFFSET` vs per-tile-top-Y interplay (`tileWorldPos`). Cosmetic-to-correctness depending on the cause.
- [ ] **`RNG` stat label vs `rng` reach are ambiguous on the recruit card.** GP3's raw-stat block labels the `ranged` damage stat `RNG` (the canonical `STAT_LABELS` in [src/ui/statLabels.ts](src/ui/statLabels.ts), shared with PromotionScreen), while each ability row shows its reach as `rng R` ([src/ui/RecruitScreen.ts](src/ui/RecruitScreen.ts) `abilityRow`) — same three letters, two different concepts (damage stat vs cells of reach). Reads fine so far but could trip a new player. Options: relabel the reach (`reach R` / `rng:R`), or rename the stat label (e.g. `RGD` for `ranged`) — note the latter touches the shared map, so it also re-labels the PromotionScreen delta row. Cosmetic; surfaced at GP3.1 playtest.
- [x] **Favicon.** Shipped in R3: an inline-SVG roguelike `@` in terminal green ([index.html](index.html)) — no more per-load 404. *(Found already-done during the 2026-07-06 TODO demotion pass; R3 landed it without checking this off.)*
- [ ] **Card rarity-accent CSS (the rarity system).** Card accents are a **rarity** dimension, NOT per-archetype (user call at P1). P1 added the seam: every card stamps `unit-card--rarity-{rarity}` ([src/ui/UnitCard.ts](src/ui/UnitCard.ts)), but only the default `common` exists today and ships **unstyled** — every card looks as it always has. When the rarity system lands (a `rarity` field on the unit + the tier catalog), add `.unit-card--rarity-{uncommon|rare|…}` accent rules (border / glyph tint) to [ui.css](src/ui/ui.css); no structural change to the component or the screens. (Supersedes the old "per-archetype `recruit-card--{rogue|healer|…}` accent" note — that was a misframing; the `--{archetype}` classes were dead/unstyled and were dropped in P1.) Cosmetic.
- [x] **Dedicated catapult IMPACT SFX.** Done §32b (2026-06-26): the user's hand-made `thud.wav` crash on `catapult_burst`, replacing the borrowed `shoot`.
- [ ] **Catapult LAUNCH creak (the F3 launch/impact split — optional tail).** F3 moved the projectile *launch* to the `release` phase (~12 ticks before impact), so the loose is silent and only the impact crash sounds. The seam is now trivial: the `catapult_launch` fx key already exists (projectile-only) — just author a launch "creak/thunk/FWOMP" sound (a `scripts/gen-sfx.mjs` recipe would do it) + add it to that key + register the `SoundKey`. Lower priority — the impact crash carries the weight. *(Same optional opportunity for the mage bolt's `release` "fwoosh," but `magicboom` at impact already reads right.)*
- [ ] **In-battle HUD stat line is getting crowded.** H1 added `POW` to the compact driving-stat line in [src/ui/HUD.ts](src/ui/HUD.ts) `formatStats`, taking it to four stats (`DEF · MOB · SPD · POW` — I1 reverted AGI→SPD). Reads fine now, but it's nearing the width where it crowds / wraps the roster panel, and `power` is a meta-stat (chips the encounter/run health pools) sitting beside three in-battle cadence/mitigation dials it has nothing to do with. Revisit the HUD stat presentation — e.g. drop `power` back off the in-battle line once its role is legible elsewhere, visually separate meta vs combat stats, or give the roster panel more room. Cosmetic; surfaced at H1. Out of scope for Phase H — circle back later.
- [x] **`power` distinct visual treatment on the cards.** Done at the Phase P close (2026-06-17): `POW` sits in its own accented meta row on the shared `UnitCard`. Detail in git.
- [ ] **Archetype display-label layer (decouple shown name from internal key).** The recruit card + PromotionScreen show the *raw* archetype key as a unit's name (`Level N mercenary`, via the `recruit-archetype` line in [src/ui/RecruitScreen.ts](src/ui/RecruitScreen.ts); same pattern on [src/ui/PromotionScreen.ts](src/ui/PromotionScreen.ts)). I5 renamed `melee → mercenary` precisely because the key *is* the display name. A small `archetype → displayLabel` map (e.g. `mercenary → "Mercenary"`, `ranged → "Archer"`, `bandit → "Bandit"`) would let the shown name diverge from the internal key — nicer casing + room to re-title a unit in the UI without a snapshot-breaking key rename. Surfaced at I5 (user call: "a good idea in general"). Cosmetic; touches RecruitScreen + PromotionScreen (+ any HUD/screen that surfaces an archetype name).
- [ ] **Ability display-name + description system.** Abilities are surfaced by their raw registry id (`gambit_strike`, `bow`, the I6 weapon ids `sword`/`club`/`katana`/`whip`, …) on the recruit card / HUD — no human label or descriptive text. Add `displayName` + `description` to the ability config (`config/abilities.json` + the [abilities.ts](src/config/abilities.ts) schema), surfaced by [RecruitScreen.abilityRow](src/ui/RecruitScreen.ts), so a card can read "Whip — long reach, rarely misses" instead of the id. Surfaced at I6 (the per-ability might/accuracy/crit profile makes abilities first-class *weapons* worth naming + describing). **Pairs with the archetype display-label item above — fold both into one display-metadata pass.** Cosmetic.
- [ ] **Objective `X` marker is low-contrast on the Volcanic theme.** The J3 objective marker is `TERMINAL_AMBER` ([OBJECTIVE_MARKER_COLOR in src/render/BattleRenderer.ts](src/render/BattleRenderer.ts)), which reads clearly on the default green-amber and rock themes but blends into the orange Volcanic terrain (`FLOOR_PALETTE.volcanic` climbs into `DARK_TERMINAL_AMBER`). Options: a brighter/whiter marker color, a dark outline/halo (a second slightly-larger marker sprite behind it, or a glyph-outline shader tweak), or a theme-aware marker color. Cosmetic; surfaced during J3 playtest. **NB the FontAtlas is now 32/32 FULL** ([glyphs.ts](src/render/glyphs.ts)) — an outline that needs a new glyph would force an atlas grid resize first.
- [ ] **Status-tick sparkle placement / height (27e experiment).** The 27e periodic-status pulse (`spawnSparkle` in [BattleRenderer.ts](src/render/BattleRenderer.ts)) anchors at the sprite's vertical CENTER (`SPARKLE_Y_OFFSET = 0.0`), motes rising `SPARKLE_RISE = 0.35` — so the burn/poison/heal puff hugs the unit's torso, peaking around the shoulders (the `+N` number floats higher at `HITSPLAT_Y_OFFSET = 0.5`, the top edge). User wants to leave it there for now but **experiment with the height/spread later** (raise toward the head ~+0.5, or float a halo over the unit ~+0.7). Pure render consts — eyeball-tune freely. **Related:** the **apply-flash was dropped** in the 27d/27e playtest follow-up (`status:applied` fired at move-START — `MoveAction` snaps the logical position onto the tile while the sprite is still lerping in — so the puff popped mid-lerp, "burning before arrival"). If a settle-on-arrival apply cue is ever wanted, the clean hook is to delay the `status:applied`-driven sparkle by the unit's remaining move lerp (the `applied` fx slot is still in the StatusDef schema + `driveStatusFx`). Surfaced at the 27e playtest (2026-06-24).
- [ ] **Dash VFX (afterimage / trail / blink-flash).** N1's rogue dash currently reads as a fast slide (the `unit:moved` lerp over the ~5-tick motion window) + the `dash.wav` whoosh — no dedicated visual. The first-class **`unit:dashed`** event ([events.ts](src/core/events.ts), emitted by [DashAction](src/sim/actions/DashAction.ts), carries `from`/`to`/`durationTicks`) is the ready hook: a BattleScene/BattleRenderer subscriber can draw a motion trail / afterimage / blink-flash on the leap. Folds into the deferred L/M status-VFX presentation pass. Surfaced at N1.

## Post-MVP polish

- [ ] **Object pooling for the hot per-tick allocators (GC-pause reduction, not memory).** The 2026-06-15 fuzz heap probe found each sim run allocates a firehose of short-lived objects — V8 grows ~155 MB of heap *headroom* to absorb the churn though the live set is only ~16 MB (no leak; `heapUsed` flat across 600 runs). The churn costs no *memory*, but pooling the hot allocators — pathfinding scratch arrays, event objects, transient grid vectors — would cut **GC pauses**, which matter more for **rendered-game frame-time smoothness** than for fuzz throughput. **Caveat: this is a *deterministic* sim — a pooled object reused with a stale field is a determinism bug that's brutal to trace, so reset discipline must be airtight (the determinism tests are the guard).** Surfaced at the N2 dwm-leak investigation ([archive/dwm-leak-diagnosis.md](archive/dwm-leak-diagnosis.md)).
- [x] **Pathfinding directional bias.** Folded into E5.B; ultimately fully fixed by the Pathfinding Audit's §43 bias fixes (see [PATHING.md](PATHING.md) 43a–43c).
- [x] **Terrain generator: water placement biased toward unit paths.** Solved by the M6 procedural-map rework (fordable crossbar gaps + low-ground pools, [proceduralMap.ts](src/sim/proceduralMap.ts)).
- [x] **Renderer capacity audit.** Landed in D1: `SpriteRenderer` 256→1024, `BarRenderer` 256→2048; auto-grow stays deferred.
- [x] **Bake grid lines into the terrain shader.** Folded into C1 (C1c) — the grid IS the tile boundaries.
- [x] **Tighten vertical layout.** Folded into C1 (C1c), tuned with the final terrain height profile.
- [x] **Root node reads as selectable.** Landed in B7: the roguelike `@` glyph + `.root` class in [MapScreen.ts](src/ui/MapScreen.ts).
- [x] **Floating per-unit HP bars.** Landed in B3: instanced `BarRenderer` (HP + action progress, movement excluded).
- [x] **Replace behavior-order priority with a proper action selector.** Landed in A1: scored `ActionProposal`s + the `World.tick()` selector (gotcha #8).

## Design explorations (post-Phase-G)

- [ ] **Save/load interstitial round (live persistence).** Everything
      *serializes* (Run/World snapshots, reject-stale, round-trip tests) but no
      LIVE save/load exists — `Run.fromJSON` is called only from tests, and
      nothing maps a restored `run.phase` back to a scene. The §48 kickoff
      audit confirmed the gap while pinning "mid-reward save/reload" as the
      round-trip *contract*; the user is mulling a post-Cluster-3 interstitial
      round to build the real thing (a scene-for-phase resolver + a storage
      trigger + a load entry point). Surfaced at the §48 shape-lock
      (2026-07-08).

- [x] **Movement abilities (dash / gap-closer) — the real rogue fix.** Done N1 (2026-06-14): the rogue dash shipped (range 2 / 0.25s / 10s cd, `unit:dashed` event). The motivating disproof (`weakest` targeting halved a dash-less rogue's damage) + the full data live in [BALANCE.md](BALANCE.md) + git history.
- [ ] **Post-Phase-H map / difficulty gating (incl. layout-by-hop weighting).** The planned
      post-H map rework should gate content by depth — and per-layout telemetry (H7c, `npm run fuzz
      -- --per-layout`) gives it a concrete first target: layout difficulty is **pure geometry**.
      Chokepoint layouts (corridors / funnel / labyrinth) sit at ~85% player wave-win; open / multi-
      approach layouts (`junctionAmbush`, `river`, procedural-open) at ~45% — ~2× the loss rate,
      because a 5-unit hand can funnel a ~9-swarm in a corridor but gets surrounded in the open
      (enemy size is swarm-cap-bound ~9.5 regardless of layout). Today `rollLayoutId` picks
      uniformly (~75% library / ~25% procedural) at every hop, so the hardest open layouts can hit
      the weakest hop-1 roster with no warning. Lever: **hop-gate / depth-weight the layout
      roll** (don't roll the hard open layouts early; ramp them in) — and/or soften specific spawn
      geometries in the layout editor. Deferred here by the user (2026-06-07) as part of the post-H
      rework rather than a one-off junctionAmbush patch. Data: [BALANCE.md](BALANCE.md) "Layout-difficulty telemetry".
      **STATUS (M6, 2026-06-13):** still OPEN/deferred — M6 shipped the procedural rework + water mechanic but
      DEFERRED hop-gating behind the coming **encounter-system spec** (which will reshape the per-hop
      difficulty targets, so depth-weighting `rollLayoutId` now would just be redone). Revisit after the spec.
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

- [ ] **Unify the duplicated `chebyshev` helpers.** Still defined independently in five places ([Pathfinding.ts](src/sim/Pathfinding.ts), [Targeting.ts](src/sim/Targeting.ts), [targetingStrategies.ts](src/sim/targetingStrategies.ts), [focusTile.ts](src/sim/focusTile.ts), + [movement.ts](src/sim/movement.ts)'s `chebyshev = distanceBetween` alias) — rule-of-three was passed long ago (first flagged in the MVP-era scratchpad). Extract one shared geometry helper next time any of these files is open. Mechanical; zero behavior change. Promoted at the 2026-07-06 scratchpad sweep.
- [ ] **`Run.pauseAtTurnGates` two-path loop — divergence watch.** H4b's flag keeps two paths through the encounter loop (headless straight-through vs gated screens), sharing the core (`resolveTurn`/`turnResult`/`continueAfterTurn`/`beginTurn`). Stable since Phase H, but if the loop grows hairier, the cleaner end-state is "always gated + tests/fuzz dispatch `advanceTurn`" (one path, more test churn). Promoted at the 2026-07-06 scratchpad sweep.

## Bundle / perf

- [x] **Production JS chunk >500KB warning.** Resolved in R3: three.js split into its own vendor chunk + `chunkSizeWarningLimit` 1000 ([vite.config.ts](vite.config.ts)). *(Found already-done during the 2026-07-06 TODO demotion pass.)*

## Docs / tooling

- [x] **`--seed-offset` for a true config-overfit holdout.** Shipped in X2 (`--seed-offset=N` across run/sweep/search, `tests/fuzz/`) — the overnight verify can run on never-tuned seeds. *(Found already-done during the 2026-07-06 TODO demotion pass; X2 landed it without checking this off.)*
- [x] **Catch doc-tree drift automatically.** Done 2026-06-07: ARCHITECTURE.md holds the single canonical tree; [tests/docs.test.ts](tests/docs.test.ts) parses it on every `npm test` (+ caps HANDOFF line counts).
