# ROADMAP — Cluster 2: Spatial & Movement

> **▶ ACTIVE — the second of the six post-X meta-roadmap clusters
> ([META-ROADMAP.md](META-ROADMAP.md)).** The second **engine round**: harden the
> movement / pathfinding / occupancy core, give it terrain depth, **unify every
> unit into one data-driven model**, and land multi-tile footprints + destructible
> terrain on top. With Cluster 1 (Combat Depth) the codebase has *interesting units*
> to test on; this round makes the *space they fight in* deep and the *unit model
> they're built from* fully data-shaped. **Get the occupancy core + the unit model
> right once** — Clusters 3–6 author against both. **First task of the *next*
> cluster's round (Cluster 3 — Economy) = archive this file →
> `archive/post-34-roadmap.md` and write a fresh ROADMAP.md** (the same
> archive-and-replace ritual that produced this one).

Companion to [DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[BALANCE.md](BALANCE.md), [TODO.md](TODO.md), [GOTCHAS.md](GOTCHAS.md), and
[META-ROADMAP.md](META-ROADMAP.md) (the meta-order across all six clusters). The
prior roadmaps live in the archive: [mvp](archive/mvp-roadmap.md),
[post-mvp](archive/post-mvp-roadmap.md), [post-c1](archive/post-c1-roadmap.md),
[post-d](archive/post-d-roadmap.md), [post-e](archive/post-e-roadmap.md),
[post-f](archive/post-f-roadmap.md), [post-h](archive/post-h-roadmap.md) (I→N),
[post-n](archive/post-n-roadmap.md) (O→R), [post-r](archive/post-r-roadmap.md)
(S→X), and [post-x](archive/post-x-roadmap.md) (Cluster 1, Y→34 — the combat-depth
round this one follows).

Synthesized from [archive/cluster-two-spec.md](archive/cluster-two-spec.md) (the
user's spec, now archived) **plus the design discussion that resolved its two open
questions** — flight and the unit-representation overhaul. Once you've read this
roadmap, that spec is fully absorbed; the locked refinements live below, not in the
spec.

## Where this came from (read this first)

Cluster 1 (Combat Depth) is **complete & user-confirmed**: every combat verb is now
a data-driven `EffectAbility`/`EffectAction`, non-stat statuses + chain/status-on-
hit/summon ship, and the band is re-derived around a caster-summoner equilibrium.
The [META-ROADMAP.md](META-ROADMAP.md) front-loaded the two **deepest engine
rounds** — Combat Depth (done) and **Spatial & Movement** (this one) — *before* the
content clusters (Economy, Drafting, Map Content, Meta) pile on top. The order is
the product: harden the core and lock the data models while the codebase is at its
most malleable, so the later rounds are content/UI on a stable foundation.

**Spatial & Movement is #2 because it touches the deepest shared core —
pathfinding / collision / `TileGrid` / the unit model — and the META principle is
to design that core *once*, with all its requirements known, not poke it four
separate times.** The kiting-class debt already bit us once (the Qb#3 corridor
archer kite-pin was a real `MovementBehavior` bug). So this round hardens occupancy
first, then builds terrain, the unit-model unification, multi-tile footprints, and
destructible terrain on the hardened core — closing with a balance pass, because
terrain and destructibles reshape the tactical layer.

The spec decomposes into six build threads + one deferral, sequenced low-risk →
high-risk so each phase hardens or de-risks the next:

1. **Harden the occupancy core** — pay down the same-tile-overlap debt; build the
   single occupancy abstraction every spatial query routes through; plant the
   footprint + plane seams.
2. **Non-instant moves** — the claim system: a unit's logical tile changes partway
   through its move, closing the collision window that opens.
3. **Terrain depth** — new palettes + tiles (deep water / hills / ice / sand / mud)
   as cost + passability + accuracy/evasion + status hooks.
4. **The unit-data keystone** — unify playable / enemy / neutral / static units into
   one data-driven `UnitDef` catalog (the third leg of the AbilityDef/StatusDef
   stool — *not* an ECS).
5. **Multi-tile footprints** — the fill: N×N bodies, authored against the keystone.
6. **Destructible terrain** — HP-bearing neutral obstacles (rubble + optional
   wall/cover destructibility) on the unified model + footprints.

**Flight is deferred** (build only — its *design* is locked and its *seams* are
planted; see *Deferred: Flight* below). This is already, by the user's own
estimate, the biggest cluster by far.

## Design targets locked (the constraints sketch the META-ROADMAP asked for)

The META-ROADMAP required a one-paragraph design-target sketch so the footprint seam
isn't shaped blind. These are **constraints, not a content round** — locked with the
user in the spec's design discussion:

- **Occupancy is one shared plane today (`ground`).** The occupancy abstraction
  carries a **`plane` seam** (`OccupancyPlane`, ground-only now) so a future air
  plane is a *fill*, not a retrofit. One unit per cell per plane — the hardening's
  whole point. (Behavior-identical today: there is exactly one plane.)
- **Footprints are axis-aligned N×N squares, N ∈ 1..4.** The unit's `position` stays
  the single canonical **corner** (one serialized cell — no schema change);
  `cellsOccupiedBy` derives the block. **Spawn anchoring is a policy:** ship
  `corner` (in-bounds-biased — the spawn tile is *a* corner, pick the diagonal that
  keeps the block on-grid); **defer `random-intersect`** (organic scatter) to its
  consumer, camps (Cluster 5). Corner reuses the single-tile spawn path — **not a
  new spawn class.**
- **Units are fully data-driven.** The closed `Archetype` TS union relaxes to a
  catalog-validated id; playable + enemy + neutral + static unify into ONE `UnitDef`
  catalog. The "components" the spec intuited (optional HP pool, size, glyph,
  pathing/LOS blocking, status susceptibility) are **optional schema fields**, not an
  entity-component system. (The architecture's reserved "no ECS" call stays reserved
  — unit counts are small, composition is stable.)
- **Flight (build deferred) is a thin modifier:** always-flying (a static property),
  shares the single occupancy plane (mobility + targeting modifier, never
  co-location — the plane seam keeps overlap a future option), passes over all ground
  obstacles (a `blocksFlight` predicate seam, always-false today), and is
  **mobility-only** to start — everyone hits everyone, including adjacent ground
  melee (the low-hover "meleeable" rule), with a per-ability `targetsLayer?` seam for
  future anti-air / ground-only content. Flyer units carry `layer` + `ignoresTerrain`
  fields (planted in the keystone, inert until flight builds).

## The two guiding goals (the user's points, made structural)

1. **Harden the core once, with every requirement known.** This is the charter. The
   same-tile-overlap bugs get attacked from *several angles at once* (proactive
   checks + claims + shove + a fuzz invariant), and the occupancy abstraction is
   built *once* as the single chokepoint every spatial query routes through — so
   footprints, claims, flight, and destructibles all extend one seam, never a dozen
   scattered `key(position)` checks.
2. **Update the editors as features land, so they're testable.** New terrain isn't
   verifiable without painting it; a new unit kind isn't authorable without the
   editor. So the **layout editor** extends with each terrain/destructible feature,
   and the **unit-data keystone reworks the archetype editor** — the closed-union
   code-edit wire-up *disappears* (creating a unit becomes pure data). Exactly the
   "dev tools ship with their feature" convention the prior clusters held.

## Vocabulary (the new types + seams — full shapes settled at each phase)

The canonical home for the occupancy abstraction will be `src/sim/occupancy.ts`
(new — the spatial sibling to the `src/sim/effects/` tree); the unit catalog mirrors
[config/abilities.ts](src/config/abilities.ts) + [config/statuses.ts](src/config/statuses.ts).
The headline shapes:

- **`OccupancyPlane`** — a closed union, `'ground'` today (`'air'` is the flight
  fill). Every occupancy query takes a plane; one unit per cell per plane.
- **`cellsOccupiedBy(unit)` / `footprintFits(cells, plane)` / `isFree(cell, plane)`
  / `distanceBetween(a, b)`** — the occupancy abstraction (§35). Single-cell today;
  `cellsOccupiedBy` returns the N×N block once §39 fills it. The footprint seam the
  Cluster-1 `unitsInCells` AoE helper already half-anticipated.
- **`Claim`** — an in-flight cell reservation (§36): a unit claims its destination on
  move-start; a cell is blocked-for-pathing if occupied **or** claimed; the claim
  releases on logical arrival. Serialized (the §36 snapshot bump).
- **`TileDef`** — the per-`TileKind` property table (§37), generalizing today's
  `TILE_COSTS`: `{ cost, passable, evasionMod?, accuracyMod?, statusOnEnter?,
  statusRemovedOnEnter? }`. Keyed by kind, not serialized (forward-compatible).
- **`UnitDef`** — the unified unit catalog entry (§38): glyph + base stats + growth +
  ability ids + targeting + movement-behavior selector + `draftable`, plus the
  optional blocks `footprint` (default 1), `layer` (default `ground`),
  `ignoresTerrain` (default false), `statusSusceptibility` (default: all), and an
  optional/flat stat block (walls + rubble = a UnitDef with no abilities + a flat HP
  pool). Resolved by archetype id at spawn — **def-resolved, not per-unit-serialized**
  (like glyph/targeting/range today).
- **`AnchorPolicy`** — footprint spawn anchoring (§39): `corner` ships;
  `random-intersect` is the reserved camps fill.
- **Flight seams (declared, inert):** `plane: 'air'` (§35 union), `layer` +
  `ignoresTerrain` (§38 fields), `blocksFlight(cell)` (§37 predicate),
  `targetsLayer?` (a future AbilityDef field).

## The phase sequence at a glance

```
35. Harden the occupancy core — abstraction + seams + shove + fuzz  ─┐ (the engine
36. Non-instant moves — the claim system                            ┤  surgery: core
                                                                    │  hardened first)
37. Terrain, palettes & new tiles — cost/passability/mods/status   ─┤ (independent
                                                                    │  content depth)
38. The unit-data keystone — the full data-driven UnitDef overhaul ─┤ (the data model,
39. Multi-tile footprints — the fill (N×N, anchoring, render)       ┤  then its spatial
40. Destructible terrain — HP-bearing neutrals + targeting hook    ─┤  consumers)
                                                                    │
41. The closing balance pass                                       ─┘ (cluster closer)

    Deferred: Flight — design LOCKED, build deferred (seams planted in 35/37/38)
```

Phase numbering continues the Cluster-1 sequence (Y, Z, 27…34 → **35, 36, …**).
Recommended path **35 → 36 → 37 → 38 → 39 → 40 → 41**, with a **playtest pause
between commits** as always.

### Sequencing rationale

- **35 first (the occupancy core).** The single dependency root — claims (§36),
  footprints (§39), shove (§40), and the flight plane all extend the one abstraction
  it builds. Pure sim, headless-first; pay down the kiting-class debt while building
  the seam. Nothing spatial can harden until occupancy is one chokepoint.
- **36 second (non-instant moves).** The feel fix the spec wants, and it *needs* §35's
  occupancy core: the claim system is exactly what closes the same-tick collision
  window that a non-instant logical-position flip opens. Riskier than §35 (a timing
  change + a snapshot bump), so it's isolated in its own phase right after the core
  it depends on.
- **37 third (terrain).** Independent of the unit model (tiles are `TileGrid` + a
  to-hit-roll fold, not units), so it slots in as a content-depth phase that also
  gives the hardened movement system varied terrain to be fuzz-tested against — a
  gentler ramp between the two heaviest engine changes (§35 core, §38 keystone).
- **38 fourth (the unit-data keystone).** The "data model before its consumers"
  move: multi-tile (§39) and destructibles (§40) author against the final unit
  model, so the overhaul precedes them. A behavior-identical migration (the Y
  pattern), so it's safe to sit mid-cluster after the de-risking phases.
- **39 fifth (multi-tile fill).** Fills §35's footprint seam against §38's `footprint`
  field. Lands right before its first consumer (§40's rubble), so the seam is proven
  by a real multi-tile entity, not left notional.
- **40 sixth (destructible terrain).** The payoff: HP-bearing neutral UnitDefs (§38)
  with footprints (§39) + susceptibility. Last of the build phases because it
  composes all the prior ones.
- **41 (balance).** The closer — terrain, multi-tile bodies, and destructibles all
  reshape board control + the to-hit layer, and §36's timing shift may move
  melee-vs-ranged. Scoped to what actually moved (per the BALANCE.md loop), not a
  full re-derivation.

### Hard ordering constraints

§35 before everything (the occupancy abstraction is the root). §35 before §36 (claims
extend the occupancy core). §38 before §39 (footprints need the `UnitDef.footprint`
field) and before §40 (destructibles are neutral UnitDefs with susceptibility). §39
before §40 (multi-tile rubble needs the footprint fill). §41 last (balance needs the
final terrain + content + timing). §37 floats after §35 (no dependency on the unit
model) — placed at #3 for the de-risking ramp.

## Conventions (unchanged — they still hold)

- **Commit per logical change**, not per session. **Pause between commits** for the
  user's manual playtest.
- **Surface tradeoffs** before non-obvious calls; stop at "Decision points." Steps
  marked **"DESIGN ROUND NEEDED"** want the shape locked with the user before
  building.
- **Headless-first** for sim/run/core/config — a vitest test before the browser. The
  occupancy abstraction, claims, the tile defs, the unit-catalog resolve, footprint
  geometry are **all pure logic**: unit-test them exhaustively before any UI.
  **Browser-verify** render-observable work (new tile meshes/palettes, scaled
  multi-tile glyphs, the non-instant-move + abort animation, rubble crumbling). A
  genuinely new **3D glyph** (rubble) needs a `glyphs.ts` entry (FontAtlas.test
  guards it; the atlas grid was resized at §30 — watch the budget).
- **Hoist every number to config** (A4): tile costs/mods, the move position-flip
  fraction, claim timing, footprint sizes, rubble HP, status-on-tile params — all in
  `config/*.json`, authored in seconds/cells, never inline.
- **Balance-proof tests derive from the config module** (never hardcode authored
  numbers — tile mods from the tile-def table, rubble HP from its UnitDef);
  mechanic/primitive tests use explicit literals and never read the shipped JSON.
- **Keep DESIGN.md / ARCHITECTURE.md honest** in the same commit as the code that
  invalidates them — this round adds `src/sim/occupancy.ts`, a tile-def table, the
  `UnitDef` catalog (a new config file + the `Archetype`-union relaxation), reworks
  the archetype editor, and extends the layout editor; the ARCHITECTURE source-tree +
  event/command catalogs update as each phase lands.
- **Schema discipline — one snapshot bump per shape-contract change.** Expected this
  round: **§36** the **`WorldSnapshot`** bump (the claim registry + the in-flight
  non-instant-move deferred-position state). **§37** may touch **`RunSnapshot`** *only*
  if a theme string is serialized (the rock→barren / default→grassland rename — audit
  first). **§38 is a byte-identical migration with NO bump expected** (the new unit
  fields are def-resolved by archetype id at spawn, like glyph/targeting/range today
  — the per-unit serialized form is unchanged; the determinism oracle proves it, the Y
  pattern). **§39/§40 no bump expected** (footprint def-resolved + position stays the
  canonical corner; destructible HP is already serialized). Reject stale, no migration
  (the established rule). The **snapshot-roundtrip + determinism tests are the guard**;
  several phases **re-baseline the fuzz win-rate** (movement/timing/terrain shift
  outcomes) — that's expected, re-derived at §41.

## Architectural decisions locked (the design-discussion outcomes)

1. **One occupancy abstraction, plane-parameterized.** Every spatial query
   (pathfinding, claims, shove, footprint-fit, targeting-adjacency, acting-position)
   routes through `src/sim/occupancy.ts`, which takes an `OccupancyPlane` (ground
   today). Centralizing now is what makes the flight fill cheap *later* — the
   expensive part of adding a plane is hunting scattered single-layer assumptions, and
   the abstraction's job is to eliminate them.
2. **Claims, not a second occupancy layer, solve the non-instant collision.** A
   unit reserves its destination; occupied-or-claimed blocks pathing; release on
   arrival. Aborts caused by *other pathers* vanish (they see the claim); only the
   rare non-pathed causes (dynamic terrain, knockback onto the destination) can abort
   — the spec's accepted residual.
3. **The unit model is a data catalog, NOT an ECS.** The third leg of the
   AbilityDef/StatusDef stool: a `UnitDef` catalog + an interpreter-free resolve at
   spawn. Optional fields (HP pool, footprint, layer, susceptibility) are *schema*,
   not components. An ECS would discard the strangler-migration + snapshot discipline
   that carried Cluster 1, for no payoff at this scale.
4. **Full unification — active archetypes become data too.** USER-LOCKED. The closed
   `Archetype` union relaxes to a catalog id; creating a unit kind = a JSON entry +
   a glyph, no code edit. (The §30 archetype-editor "create" wire-up panel exists
   *only* because of the closed union; the keystone deletes it.)
5. **Flight is a deferred fill, not a Cluster-2 build.** Its design is locked (the
   four answers) and its seams are planted (plane / layer / ignoresTerrain /
   blocksFlight / targetsLayer); the build is a later small spec, like the multi-tile
   fill was for Cluster 1.

## Cross-phase seams to hold in mind

- **`src/sim/occupancy.ts` is the chokepoint.** Today's checks are scattered —
  `World.isOccupied` (the overflow scan, [World.ts](src/sim/World.ts) ~L1246),
  `buildMovementContext`'s three sets ([movement.ts](src/sim/movement.ts)), the
  sidestep occupancy set, the §29 `nearestFreeCells` BFS
  ([effects/interpreter.ts](src/sim/effects/interpreter.ts) summon placement). §35
  routes them all through one module; everything downstream extends it, not them.
- **The Cluster-1 `unitsInCells` AoE helper is the footprint seam's other half.**
  ([effects/targeting.ts](src/sim/effects/targeting.ts) — "the Cluster-2 footprint
  seam"). AoE already resolves cells → units through it; §39's `cellsOccupiedBy`
  makes it multi-tile-correct with no AoE retrofit.
- **`MoveAction` is the non-instant seam.** ([actions/MoveAction.ts](src/sim/actions/MoveAction.ts))
  Today `start` snaps `unit.position = to` instantly + emits `unit:moved{durationTicks}`
  (the renderer lerps). §36 moves the logical flip to a mid-move tick and holds the
  claim across the window; the renderer lerp already spans it.
- **`TileGrid`'s cost table is the tile-def seam.** ([TileGrid.ts](src/sim/TileGrid.ts)
  `TILE_COSTS`) — already a per-kind lookup; §37 generalizes it to a `TileDef` table
  (cost + passability + combat mods + status hooks). New `TileKind`s are
  forward-compatible strings (the snapshot stores kind strings) — no bump.
- **`spawnEnvironment` + the `'environment'` archetype are the unit-unification
  seam.** ([environment.ts](src/sim/environment.ts) + [World.ts](src/sim/World.ts)
  `spawnEnvironment`) — walls/half-cover are *already* neutral Units with `maxHp`
  plumbed and `blocksLineOfSight` orthogonal to path-blocking. §38 folds them into the
  catalog; §40 gives them real HP + susceptibility + the targeting hook the file
  headers already predict ("future destructibility is a matter of bumping `maxHp` and
  adding a 'walls can be attacked' hook to Targeting").
- **`applyDamage`'s to-hit roll is the terrain-mod seam.** ([World.ts](src/sim/World.ts)
  `applyDamage` precision-vs-evasion) — water already pairs a precision penalty (M6);
  §37 generalizes it to fold the attacker's tile accuracyMod + the defender's tile
  evasionMod from the tile-def table.
- **The dev-save endpoint is the editors' home.** `/__save-config`
  ([vite.config.ts](vite.config.ts) `SAVABLE_CONFIG_FILES`) gains `units.json`; the
  layout + archetype editors POST the same way the existing editors do.

---

## Phase 35 — Harden the occupancy core (the abstraction + seams + shove + fuzz)

> **✅ COMPLETE (35a–35d), 2026-06-28.** `src/sim/occupancy.ts` is the chokepoint;
> 35b the proactive check + abort (`unit:moveAborted`); 35c `World.shove`
> (`unit:shoved`, the future-knockback primitive); 35d the opt-in
> `HarnessOptions.assertOccupancy` fuzz invariant (holds across the corpus). All
> byte-identical / inert on the instant model — no snapshot bump, fuzz baseline
> unchanged. As-built: git + HANDOFF.

The dependency root (the Y of this round). Build the single occupancy abstraction
every spatial query routes through, plant the **footprint** (single-cell) and
**plane** (ground-only) seams, and pay down the same-tile-overlap debt from several
angles at once. **Pure sim, headless-first. No snapshot bump** (no new serialized
state); the fuzz invariant is added here and the baseline may shift.

**Shape:**
- **`src/sim/occupancy.ts`** — the abstraction: `cellsOccupiedBy(unit)` (returns
  `[unit.position]` today), `isFree(cell, plane)`, `footprintFits(cells, plane)`,
  each taking an `OccupancyPlane` (`'ground'` only). Centralizes the scattered
  `World.isOccupied` + `buildMovementContext` checks (they call into it; behavior
  byte-identical at one plane / single-cell).
- **Proactive destination checks** — a move proposal re-validates its destination is
  free *at execution*, not just at proposal (the spec's "move proposals must all be
  proactively checked"). A stale proposal (the destination filled by an earlier-
  processed unit this tick) is caught here.
- **The abort primitive** — a move whose destination is occupied/untraversable at
  execution becomes a clean no-op (the spec's abort system). Mostly inert on the
  instant model (the spec's own note); built here so it's headless-testable before
  §36 makes it load-bearing.
- **Shove** — the backstop for units that *do* co-locate (a knockback/summon/spawn
  landing on an occupied cell, or any future invariant breach): a deterministic shove
  relocates one unit to the nearest free cell (reuse the §29 `nearestFreeCells` BFS).
  The safety net the spec wants — and the primitive a future `knockback` op would
  wrap (a knockback is a *directional* shove).
- **The fuzz occupancy invariant** — a headless assertion that no two units share a
  cell (per plane) at any tick, run across the fuzz corpus (the spec's "full occupancy
  testing during fuzz"). Generalizes the Qb#3 same-cell-overlap invariant test to the
  whole run.

**Cost:** a centralizing refactor + the shove/abort primitives + the fuzz invariant.
No new serialized state → no snapshot bump. Fuzz baseline may shift (proactive checks
+ shove change a few outcomes); re-derived at §41.

**Headless tests:** `cellsOccupiedBy`/`footprintFits` are byte-identical to the old
checks at single-cell/one-plane; a stale proposal onto a now-filled cell aborts;
shove relocates a co-located unit deterministically to the nearest free cell; the
occupancy invariant holds across a fuzz corpus; the kiting-class corridor fixtures
(Qb#3) still pass.

**Decision points 35:** where the module lives (recommend a new `src/sim/occupancy.ts`
— the spatial sibling to `src/sim/effects/`). The abort policy on a no-op move
(cooldown consumed or not — recommend **not consumed**, retry next tick). The plane
type (recommend a closed `OccupancyPlane = 'ground'` union now, `'air'` added when
flight builds). Whether `distanceBetween` lands here (single-tile = `chebyshev`) or
with §39 where multi-tile makes it non-trivial (recommend here as a behavior-identical
seam, so adjacency/acting-position route through it early).

### Sub-steps (35a–35d) — the cut (resolved with the user 2026-06-28)

**Resolved decisions:** module home **`src/sim/occupancy.ts`**; plane **closed
`OccupancyPlane = 'ground'`**; `distanceBetween` lands **here** (the chebyshev seam,
so adjacency/acting-position route through it early); abort = **cooldown not
consumed**, retry next tick; the **abort is a full `unit:moveAborted` event** (the
sibling of `unit:moved`), NOT a silent internal no-op — inert on the instant model,
load-bearing for §36's renderer settle-back (the renderer must *see* an abort to
animate it; planting the event now makes §36 a subscribe, not a retrofit); the fuzz
invariant is an **opt-in harness flag** (off by default like telemetry, so the
`--search` hot-path pays nothing; a dedicated fuzz test turns it on across the smoke
corpus). **Scope note:** 35a centralizes the **one-unit-per-cell occupancy** predicate
only — the neutral-only *path-blocker* sets (`buildMovementContext.pathBlockers`,
`nearestActingCell`'s wall set) stay put (a path-blocking concern §38 folds into the
unit catalog, orthogonal to occupancy). The **footprint seam** is planted by routing
every per-unit cell touch through `cellsOccupiedBy(unit)` + `cellKey` (→ `[position]`
today), so §39's N×N fill is automatic, not a scattered retrofit.

- **35a — the occupancy abstraction (the chokepoint + seams).** New
  `src/sim/occupancy.ts`: `cellsOccupiedBy(unit)` (→ `[unit.position]`), `isFree(world,
  cell, plane)` / `unitAt(world, cell, plane)`, `footprintFits(world, cells, plane)`,
  `distanceBetween(a, b)` (chebyshev), `cellKey(cell)` — each plane-parameterized
  (`'ground'`). Route the scattered occupancy point/set queries through it:
  `World.isOccupied` (the overflow scan), `buildMovementContext`'s `occupied` set,
  `nearestFreeCells` candidacy. Byte-identical at single-cell/one-plane. *Test:*
  equivalence vs the old checks; existing snapshot + fuzz baselines unchanged. No bump.
- **35b — proactive destination check + abort (the `unit:moveAborted` event).** A move
  re-validates its destination is free *at execution* (catching a stale proposal whose
  cell an earlier-processed unit took this tick); an occupied/untraversable destination
  becomes a clean no-op + emits `unit:moveAborted {unitId, from, to}` (cooldown not
  consumed → retry next tick). Mostly inert on the instant model; built + event-seamed
  now so §36's non-instant settle-back is a renderer subscribe. ARCHITECTURE event
  catalog updated in-commit. *Test:* a stale proposal onto a now-filled cell aborts,
  fires the event, leaves the unit at `from` with cooldown intact.
- **35c — shove (the co-location backstop).** A deterministic relocate of a co-located
  unit to the nearest free cell, wrapping the §29 `nearestFreeCells` BFS — the safety
  net for a spawn/summon/knockback landing on an occupied cell, and the primitive a
  future `knockback` op wraps (a knockback = a directional shove). *Test:* a co-located
  unit relocates deterministically to the nearest free cell.
- **35d — the fuzz occupancy invariant (opt-in).** A per-tick "no two units share a
  cell (per plane)" assertion, off by default (an opt-in harness flag, like telemetry),
  turned on by a dedicated fuzz test across the smoke corpus — generalizing the Qb#3
  same-cell fixture to the whole run. *Test:* the invariant holds across the corpus;
  the Qb#3 corridor fixtures still pass. Baseline may shift (re-derived §41).

---

## Phase 36 — Non-instant moves (the claim system)

The feel fix: a unit's logical tile changes **partway through** its move, not at
move-start — so a slow unit attacked at melee range reads as still mostly on its
prior tile (the spec's persistent quibble; the same gap tile-initiated statuses hit).
The enabling mechanism is the **claim system**, which also closes the same-tick
collision window the timing change opens. **WorldSnapshot bump** (claims + the
in-flight deferred-position state); fuzz re-baseline (timing shifts outcomes).

**Shape:**
- **Claims** — on move-start a unit claims its destination cell; the §35 occupancy
  abstraction treats a cell as blocked-for-pathing if **occupied OR claimed**; the
  claim releases on logical arrival. Two units never path to the same vacant cell —
  the second sees the claim and re-routes (the spec's design, which "neatly resolves
  aborts caused by other units' pathing").
- **Non-instant logical position** — `MoveAction`'s `unit.position = to` moves from
  `start` to a mid-move tick (default ~50%, a config dial). Before the flip the unit
  logically occupies `from` and holds the claim on `to`; after, it occupies `to` and
  releases the claim. The renderer's existing `unit:moved{durationTicks}` lerp already
  spans the window.
- **Smooth abort (the §35 path goes load-bearing)** — a move whose destination becomes
  invalid mid-flight (dynamic terrain, a non-pathed knockback onto `to`) aborts; the
  claim guarantees *other pathers* never cause this. Animate as a settle-back (a render
  design call — keep it from visually colliding with the melee hit anim, the spec's
  worry).
- **Serialize** the claim registry + the in-flight deferred-position state → the bump,
  reject-stale.

**Cost:** the claim registry + the position-flip timing + the abort animation.
WorldSnapshot bump. Fuzz re-baseline (a melee unit now connects against a still-
arriving target differently — a likely melee/ranged shift, noted for §41).

**Headless tests:** a claimed cell blocks a second pather; the claim releases on
arrival; the logical position flips at the configured fraction (the unit is at `from`
before, `to` after); two units proposing the same vacant cell → one claims, the other
re-routes (no collision); an aborted move leaves the unit at `from` with the claim
released; snapshot round-trips a mid-move claim.

**Decision points 36:** the position-flip fraction (recommend 50%, a config dial).
Whether melee/adjacency reads the *logical* position (recommend **yes** — the whole
point is the attacker sees the still-arriving target on its old tile until the flip).
The abort animation shape (a render design call — settle-back vs snap). Whether a
claim can be *stolen* by a higher-priority mover (recommend no — first-claim wins,
deterministic).

---

## Phase 37 — Terrain, palettes & new tiles

The terrain-depth content + mechanics: new palettes, five new tiles, and the tile→
status hooks. Mostly `TileGrid` + render + a to-hit-roll fold; **independent of the
unit model.** The layout editor extends to paint it. **No WorldSnapshot bump** (new
`TileKind`s are forward-compatible strings; the tile-def table is keyed by kind, not
serialized); a possible **RunSnapshot** touch from the theme rename (audit first).

**Shape:**
- **Palettes (themes):** add **tundra** (blue-white snow), **desert** (sandy),
  **swamp** (brown-greens + browns). Rename `rock` → **`barren`** and `default` →
  **`grassland`**. (LOCKED: **barren**, not "mountain" — "mountain" would collide with
  the Hills tile that renders mini-mountains.) Theme is a render + procedural-gen
  concern; the rename touches `layouts.json` themes + the theme tables.
- **New tiles** (`TileKind` + the generalized `TileDef` table):
  - **deep_water** — impassable by default (cost `Infinity`, like chasm); a future
    marine/privateer archetype passes it at water's effect **doubled** (a unit
    `traversal`/waterwalk capability seam, declared-inert).
  - **hills** — slower (high cost) + **evasion bonus**; renders 3–6 low-poly hills,
    palette-conformant.
  - **ice** — faster + a **severe accuracy penalty** (mind the A* floor: costs stay
    ≥ 1 so the Chebyshev heuristic stays admissible, GOTCHAS #34 — "faster" comes from
    cost 1, not < 1).
  - **sand** — slower + **evasion penalty**.
  - **mud** — severe **mobility + accuracy** penalty (deep-water's on-foot effect).
- **Tile combat modifiers** — extend `applyDamage`'s precision-vs-evasion roll to fold
  the attacker's tile `accuracyMod` + the defender's tile `evasionMod` from the
  `TileDef` table (generalizing M6's water precision penalty). The combat-touching
  part → balance implications (§41).
- **Tile→status hooks (one seam, both directions)** — a tile may **apply** a status on
  enter (**mud → poison**, behind a config flag) and **remove** a status on enter
  (**water + deep_water → remove burn**). This generalizes the Cluster-1 tile
  unification (fire → *apply* burn) to add the inverse (water → *remove* burn). (LOCKED:
  trial poison-on-mud via a flag; do **not** ship a near-duplicate "mire" tile unless
  playtest wants both mud-without-poison and mire-with as visibly distinct things.)
- **Layout editor** — paint the new tiles + pick the new palettes; preview the theme
  coloring.

**Cost:** the `TileDef` extension + the to-hit fold + the status hooks + render
(palettes, hill/ice/sand/mud meshes) + the editor. No WorldSnapshot bump; possible
RunSnapshot touch (theme rename). Browser-verify the palettes + tile renders + a
wade/slip read.

**Headless tests:** each tile's cost + passability (deep_water/chasm short-circuit
pathing; ice stays ≥ 1); the to-hit roll folds tile accuracy/evasion (balance-proof:
derive from the `TileDef` table); mud applies poison on enter (flag on); water removes
burn on enter; new `TileKind`s round-trip a `TileGrid` snapshot.

**Decision points 37:** is `theme` serialized anywhere the rock→barren / default→
grassland rename makes a **RunSnapshot migration** (audit sectors/encounters/run
state)? The ice cost-floor (confirm "faster" = cost 1 + speed from elsewhere, vs
relaxing the heuristic). Mud-poison flag default (recommend **on** for the trial —
easy to flip). The marine/waterwalk `traversal` capability — declare-inert (recommend,
like the knockback seam) or fully omit.

---

## Phase 38 — The unit-data keystone (the full data-driven `UnitDef` overhaul)

The cluster's keystone (the Y of this round). Unify **every** unit — playable, enemy,
neutral, static — into one data-driven `UnitDef` catalog, the third leg of the
AbilityDef/StatusDef stool. **Not an ECS.** A behavior-identical migration proven by
the determinism oracle (the Y pattern). **No WorldSnapshot bump expected** (def-
resolved by archetype id at spawn). USER-LOCKED: **in + FULL** (active archetypes
become data too, not just neutrals).

**Step 1 — the audit (gates the phase shape).** Grep sim/run/render for archetype-
*literal* branches (`switch (archetype)`, `=== 'healer'`, …) vs archetype-*config*
lookups (already data). Known data-driven: `glyphForArchetype`,
`targetingForArchetype`, `range`/`minRangeForArchetype`, growth rates, the draft
pool. Known literal: `createMovementBehavior`'s healer → `SupportMovementBehavior`
special-case. The audit sizes the migration honestly *before* the steps lock — few
literal branches (expected) → a clean 2–3 step migration; pervasive → re-scope with
the user.

**Shape:**
- **`UnitDef` catalog** (`config/units.json` + `src/config/units.ts`, zod — mirroring
  `abilities.ts`/`statuses.ts`): per-unit-kind glyph, base stats, growth, ability ids,
  targeting strategy, **movement-behavior selector** (the literal special-case becomes
  a field), `draftable`, plus the optional blocks:
  - **`footprint`** (N, default 1 — the §39 field, inert until the fill).
  - **`layer`** (default `ground` — the flight plane the unit lives on).
  - **`ignoresTerrain`** (default false — flyers skip the §37 tile cost/effect pass).
  - **`statusSusceptibility`** (default: all — an allow/deny filter the `applyStatus`
    op consults; a wall opts into burn/frozen, out of poison/bleed — the spec's
    burnable-not-poisonable wall).
  - **An optional/flat stat block** — a wall/rubble is a `UnitDef` with no abilities +
    a flat HP pool (folds `spawnEnvironment`'s `ZERO_STATS`/`inertDerived` path in).
- **Relax `Archetype`** from a closed TS union → a catalog-validated string id (the
  abilities/statuses move). A boot-assert validates every referenced id. Creating a
  unit kind = a JSON entry + a glyph, **no code edit.**
- **Fold neutrals into the catalog** — walls, half-cover, future rubble become
  `UnitDef` entries; `spawnEnvironment` becomes "spawn a neutral `UnitDef`." The
  team-based neutral filters (Targeting / HUD / `checkBattleEnd`) stay.
- **Editors reworked** — the archetype editor's "create" wire-up panel **disappears**
  (no more closed-union code edits — the keystone's whole point); it now creates/edits
  `UnitDef` entries as pure data, neutrals included. The attack editor is unaffected
  (abilities are referenced by id).

**Cost:** the keystone migration — significant, but the proven Y pattern (strangler →
determinism oracle → delete the old path). **No WorldSnapshot bump expected:** the
new fields are def-resolved by archetype id at spawn (like glyph/targeting/range),
so the per-unit serialized form is unchanged; the determinism oracle proves byte-
identical. Browser-verify a full battle across all kinds + that the editor creates a
new unit with **no** code edit.

**Headless tests:** every archetype id resolves in the catalog (boot-assert); a full
multi-kind battle is byte-identical to pre-migration (the determinism oracle); a
wall/half-cover spawned via the catalog is identical to the old `spawnEnvironment`
path; `statusSusceptibility` filters an `applyStatus` (a wall ignores poison, takes
burn); every new optional field defaults to a behavior-identical value.

**Decision points 38:** the **audit result gates everything** (see Step 1). Catalog
home (recommend `config/units.json` — the editor's target). Whether playable +
neutral share **one** catalog (recommend yes — the unification's whole point) or a
cosmetic two-file split. The `statusSusceptibility` default (recommend **allow-all**,
so existing combatants are unchanged; neutrals opt into the few they allow). Whether
the migration ports archetype-by-archetype (oracle per kind, the Y3/Y4 cadence) or
all-at-once (recommend per-kind, each a playtest-pausable commit).

---

## Phase 39 — Multi-tile footprints (the fill)

Fill §35's footprint seam against §38's `footprint` field: `cellsOccupiedBy` returns
the N×N block, rendering scales the glyph, spawning validates the block fits. The
first multi-tile consumer is §40's rubble — so this lands right before it. **No
WorldSnapshot bump expected** (footprint def-resolved; position stays the canonical
corner). Fuzz inert until §40 ships a multi-tile entity.

**Design target (LOCKED):** axis-aligned N×N, N ∈ 1..4; `position` = the single
canonical **corner**; spawn anchoring is a **policy** — ship **`corner`** (in-bounds-
biased: the spawn tile is *a* corner, pick the diagonal that keeps the block on-grid,
so an edge tile still fits); **defer `random-intersect`** (organic scatter) to camps
(Cluster 5). Corner reuses the single-tile spawn path + the overflow scan's "walk
candidate tiles, skip if it doesn't fit" loop — **not a new spawn class** (the spec's
worry, resolved).

**Shape:**
- **`cellsOccupiedBy(unit)`** returns `corner..corner+N`; **`footprintFits(cells,
  plane)`** checks all N cells; **`distanceBetween(a, b)`** becomes footprint-aware
  (min cell-to-cell Chebyshev — single-tile stays `chebyshev(pos, pos)`). The
  occupancy registry, claims (§36), shove (§35), pathfinding, targeting-adjacency, and
  acting-position all route through these — already centralized in §35, so **no
  scattered retrofit.**
- **Pathfinding** — a multi-tile unit's step validates the whole destination footprint
  is free (a wider body needs wider corridors). A* moves the canonical corner;
  passability checks the block.
- **Rendering** — scale the glyph quad to the footprint (the SpriteRenderer per-
  instance `size` attr already exists, E6.B); the sprite anchor reads the footprint
  center.
- **Spawn anchoring** — `anchorFootprint(spawnTile, size, policy, grid, occupancy) →
  cells | null`; ship `corner`; a null fit → the caller tries the next candidate tile.
- **Layout editor** — multi-tile spawn-room validation (does an N×N spawn fit?) +
  placing multi-tile entities.

**Cost:** the seam fill + footprint-passability pathfinding + render scaling + the
anchoring policy + the editor validation. No bump expected. Browser-verify a multi-
tile unit renders scaled + paths through wide gaps but not narrow ones.

**Headless tests:** `cellsOccupiedBy` returns the N×N block from the corner;
`footprintFits` rejects a block overlapping a unit/wall/edge; a 2×2 unit paths through
a 2-wide gap, not a 1-wide; `distanceBetween` is footprint-aware (a 2×2 + an adjacent
unit are at distance 1); corner anchoring keeps an edge-tile spawn on-grid; the fit-
check skips a too-tight tile.

**Decision points 39:** max N (LOCKED 4 — confirm 1..4). The passability rule (the
whole destination footprint free — recommend the conservative correct rule). Whether
a wide unit needs the A* heuristic adjusted (Chebyshev on the corner stays admissible
— confirm with a wide-unit test). Render anchor (recommend center for the glyph,
corner for the logic). Whether any §38 archetype goes multi-tile now or footprints
stay inert until §40's rubble (recommend inert until §40 — keep the fuzz baseline
stable through §39).

---

## Phase 40 — Destructible terrain

The §38 + §39 payoff: HP-bearing neutral obstacles that deny area until destroyed —
rubble/debris (1×1–3×3, configurable HP), plus finally enabling **optional**
destructibility for walls + half-cover. Authored as neutral `UnitDef`s (§38) with real
HP + footprints (§39) + susceptibility. **No WorldSnapshot bump expected** (HP already
serialized); the layout schema gains destructible HP fields (config). Balance
implications → §41.

**Shape:**
- **The rubble `UnitDef`(s)** — neutral, no abilities, a flat HP pool, a footprint
  (1..3), a glyph (e.g. `▓` — needs a `glyphs.ts` entry + the §30-resized atlas
  budget). **Burnable/freezable but not poisonable** (`statusSusceptibility`, §38) —
  the spec's note that destructibles want burn but walls aren't poisonable.
- **The targeting-neutrals hook** — Targeting filters neutrals out of the enemy pool
  today; add an **opt-in, lower-priority** path: rubble is **auto-targeted below all
  reachable hostiles** (a unit with no reachable hostile, or an explicit order, may
  chip a blocking destructible — the "deny access until destroyed" loop). Walls +
  half-cover are **not** auto-targeted (manual target or AoE only — the spec). AoE
  already hits neutral cells for free (the Cluster-1 `affects:'enemies'` = not-caster's
  -team filter + `unitsInCells`).
- **Optional wall/cover destructibility** — a per-instance HP in the layout schema
  (default today's indestructible 1-HP; a higher value = destructible). The lifecycle
  already works end-to-end (a neutral at 0 HP reaps + fires `unit:died{neutral}`;
  BattleRenderer fades, audio skips — all noted "ready" in `environment.ts`).
- **Layout editor** — paint rubble (size + HP) + toggle wall/cover destructibility.

**Cost:** content (rubble UnitDefs + glyph) + the targeting-neutrals priority hook +
the layout HP schema + the editor. No WorldSnapshot bump expected. Browser-verify
rubble renders, takes AoE + low-priority auto-fire, crumbles at 0 HP; a destructible
wall falls to focused fire.

**Headless tests:** a destructible takes AoE (affects-enemies includes neutrals) + DoT
per its susceptibility (burn yes, poison no); auto-targeting picks a reachable hostile
over a destructible (priority), a destructible only when no hostile is reachable;
walls/cover are not auto-targeted (manual/AoE only); a 0-HP destructible reaps + fires
`unit:died{neutral}`; a multi-tile rubble occupies its whole footprint until destroyed.

**Decision points 40:** the auto-target priority rule (recommend destructibles below
all reachable hostiles; an idle unit blocked from its hostile may chip the blocking
destructible). Multi-tile rubble collapse — incremental (partial damage frees cells)
or all-at-once at 0 HP (recommend **all-at-once** — one entity; partial-collapse is a
future fill). Wall/cover destructibility default (recommend **off** — today's
indestructible 1-HP, opt-in per layout). Whether rubble blocks LOS (recommend yes by
default, a per-def `blocksLineOfSight` like walls; low rubble could set false).

---

## Phase 41 — The closing balance pass

The cluster closer — terrain, multi-tile bodies, and destructibles reshape board
control + the to-hit layer, and §36's timing shift may move melee-vs-ranged (the META
"balance pass per combat-touching cluster"). **READ BALANCE.md first.** Content/config
-only, no snapshot bump.

**Shape:** re-derive the optimal strategy on the new spatial layer (terrain costs/
mods, multi-tile bodies, destructibles as board control); confirm the new tiles/
destructibles don't break the §33 caster-summoner equilibrium; re-baseline the fuzz
win-rate (§35/§36/§37/§39/§40 each may have shifted it); hold-out-verify
(`--seed-offset`). Scoped to what actually moved, per the BALANCE.md loop (pool-damage
metric, gradient over win-rate, isolation + in-situ).

**Decision points 41:** which terrain/destructible dials moved balance (tile cost/mod
magnitudes, rubble HP/placement) vs. left it; whether §36's non-instant timing
materially shifted melee-vs-ranged (the likely spot); the uniform-vs-curve terrain-
density question (a content call deferred from earlier — decide on the data).

---

## Deferred: Flight (design LOCKED, build deferred)

Per the spec + the design discussion, flight's **build** is deferred (this cluster is
already the biggest by far); its **design** is locked and its **seams** are planted,
so the future fill is small — like the multi-tile fill was for Cluster 1. The four
spec questions, resolved:

1. **Land or always-fly → ALWAYS FLY.** No direct unit control → no clean actor to
   decide *when* a unit lands; landing is a per-unit mode state machine for no current
   payoff. Flight is a static unit property.
2. **Share a tile with ground → NO.** One shared occupancy **plane** today (ground).
   Flight changes *pathing* (ignore ground blockers/water/chasm — cost-1 to route
   over) + *targeting* (who can hit you), **never co-location.** The occupancy
   abstraction carries a `plane` seam (§35, ground-only) so air-with-overlap is a
   future fill, not a retrofit — and the cross-layer interactions (melee hitting a
   flyer, AoE across layers) live in *targeting*, not occupancy, handled by
   `targetsLayer` + the unit `layer` field. Holds the META "flight doesn't break
   1-unit-1-cell."
3. **Pass over all walls or a blocks-flight prop → PASS OVER ALL** ground obstacles
   now; the flight cost-fn consults a `blocksFlight(cell)` predicate seam (always-
   false today), so tall-walls is a one-field add (mirrors `blocksLineOfSight`).
4. **The attack matrix → MOBILITY-ONLY** to start: everyone hits everyone, including
   adjacent ground melee (the low-hover "meleeable" rule), with a per-ability
   `targetsLayer?: 'ground' | 'air' | 'both'` (default `both`) seam for future anti-
   air / ground-only content. The 4-quadrant surface/air matrix is a trap in a
   no-direct-control autobattler (hard to reason about, easy to make feel arbitrary)
   — deferred to content.

**Where the seams live:** the `plane` param on the §35 occupancy abstraction; the
`layer` + `ignoresTerrain` fields on the §38 `UnitDef` (inert defaults); the
`blocksFlight` predicate (a §37 tile-def field / §35 occupancy predicate, always-
false); the `targetsLayer` ability field (a future AbilityDef addition). **When flight
builds** (a later small spec): add `'air'` to the plane union, mark flyer `UnitDef`s,
decide the overlap rule, wire `targetsLayer` — bounded, *because the seams exist.*

---

## Cleanup / chores (land any time; several pair with this round)

- **The marine/waterwalk `traversal` capability** (deep-water-passing archetypes) —
  the §37 declared-inert seam, filled when a marine archetype is authored (Cluster
  4/5 content).
- **The `knockback` / `pull` `move`-op modes** — the **Cluster-1 reserved §Y seam**,
  explicitly "deferred to Cluster 2's hardened occupancy core." §35's **shove IS the
  primitive** (a knockback = a directional shove; a pull = its inverse). Wiring the
  reserved op modes onto it is a *small* add now that the core exists — but no spec
  content asks for a knockback attack, so **decide with the user**: build a minimal
  knockback in §35/§40 if any content wants it (cheap, the dependency is now met), else
  carry the op modes reserved one more cluster. (Recommend: leave reserved unless a
  consumer appears — the primitive is built regardless, so the fill stays cheap.)
- **Object-pooling the sim's hot allocators** ([TODO.md](TODO.md)) — still parked; the
  §29 `maxLive` cap holds, and multi-tile + destructibles don't raise live counts
  unboundedly.
- **The FontAtlas budget** — §40's rubble glyph(s) draw from the §30-resized grid;
  watch the n/48 budget.

## What we're explicitly NOT doing yet (Cluster 2 scope guard)

**Deferred (per the meta-roadmap order + the design discussion):**
- **Flight (the build)** → design locked, seams planted; a later small spec.
- **`random-intersect` spawn anchoring** → deferred to **camps (Cluster 5)**; ship
  `corner` only.
- **Air/ground co-location** → the `plane` seam is planted; the fill waits for flight.
- **A separate "mire" tile** (mud + poison as a distinct tile) → trial poison-on-mud
  via a flag first; split only if playtest wants both as visibly distinct.
- **Partial / incremental rubble collapse** → all-at-once at 0 HP; partial is a future
  fill.
- **Consumables / camps / events using terrain + destructibles** → Clusters 3 + 5
  (they consume what this round builds).

**Seamed this round but deliberately NOT built (the future-proofing pass):**
- **`plane: 'air'`** (§35), **`layer` / `ignoresTerrain`** (§38), **`blocksFlight`**
  (§37), **`targetsLayer`** (a future ability field) — the flight seams.
- **`traversal` / waterwalk** (§37) — deep-water-passing archetypes.
- **`random-intersect` anchoring** (§39) — camps.
- **`knockback` / `pull`** (the Cluster-1 reserved `move` modes) — now *buildable* on
  the §35 shove primitive; filled only if a consumer appears (see Cleanup).

## Open decisions to resolve when building (the cross-cutting set)

Each is also embedded as a per-phase "Decision points." **Resolved with the user in
the design discussion (this session):**
- **Unit overhaul = in + FULL** (active archetypes become data, not just neutrals). ✅
- **Flight = deferred build, four answers locked** (always-fly · shared plane ·
  pass-over-all + `blocksFlight` seam · mobility-only + `targetsLayer` seam). ✅
- **Occupancy carries a `plane` seam** (ground-only today) so air is a cheap fill. ✅
- **Spawn anchoring = a policy** (ship in-bounds-biased `corner`; `random-intersect`
  waits for camps). ✅
- **Palette rename = `barren`** (not "mountain" — avoids the Hills-tile collision). ✅
- **mud → poison via a flag** (trial; no near-duplicate "mire" tile yet). ✅

**Still open (resolve at the relevant phase):**
- **35:** occupancy module home; abort cooldown policy; whether `distanceBetween`
  lands here or with §39.
- **36:** the position-flip fraction; the abort animation shape; claim-steal policy.
- **37:** the theme-rename migration scope (RunSnapshot?); the ice cost-floor; the
  mud-poison flag default; the waterwalk seam (declare-inert vs omit).
- **38:** **the archetype-literal audit result (gates the phase)**; catalog home; one
  vs two catalog files; the susceptibility default; per-kind vs all-at-once migration.
- **39:** max N (1..4); the passability rule; the render anchor; whether any archetype
  goes multi-tile in §39 or stays inert until §40.
- **40:** the auto-target priority rule; all-at-once vs incremental collapse; the
  wall-destructibility default; whether rubble blocks LOS.
- **41:** which dials moved balance; the non-instant melee/ranged shift; uniform vs
  hop-ramped terrain density.
- **Cross-cutting:** the `knockback`/`pull` op modes — build cheaply on the shove
  primitive, or carry reserved one more cluster?
