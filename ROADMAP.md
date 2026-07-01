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

> **✅ COMPLETE — 36a→36d SHIPPED.** **36a** the claim registry + the
> occupied-OR-claimed pathing rule (`WorldSnapshot` v30→v31, inert). **36b** the
> non-instant logical position flip: `MoveAction` defers `position = to` to the
> 50% mark (`SIM.moveFlipFraction`, via a `travel`→`impact`→`recovery` phase
> timeline) + the claim/release lifecycle (claim on start, release on flip + on
> reap via `removeUnit`→`releaseClaimsBy`). The claim went load-bearing: the §35d
> occupancy invariant exposed that the PLACEMENT paths (`nearestFreeCells` for
> shove/summon, `runOverflowScan` reinforcement, the gambit `retreatCell`) also
> had to exclude claimed cells, else a unit materialises where a deferred mover is
> arriving. No new serialized state / no second bump. **36c** the smooth mid-flight
> abort: a per-tick in-flight re-validation in `World.tick`'s active-action step
> re-checks a deferred move's destination while the claim is still held (the
> pre-flip signal); if `dest` went occupied/untraversable it aborts via
> `unit:moveAborted` (release claim, reset move cooldown, hold at `from`). Render
> decision LOCKED = **settle-back**: `BattleRenderer` eases the sprite from its
> live mid-slide position back to `from` over `SETTLE_BACK_SECONDS` (0.22s). INERT
> until §37/§40 supplies a trigger, so pinned by a synthetic headless test +
> functional browser proof; no snapshot bump / no fuzz shift. **36d** the fuzz
> re-baseline: §35d's occupancy invariant HOLDS across the open claim window
> (`assertOccupancy` on, 12+12 smoke + a broad 40+40 corpus), and NO detectable
> win-rate shift — greedy 7.5% (seeds 1–120) / 14.2% (held-out offset 5000)
> bracket §33c's 10.0% (n=120 seed-variance ±~3.5pt swamps it); precise
> melee/ranged characterization carried to §41 (BALANCE.md). **▶ Phase 36 CLOSED;
> §37 Terrain next.**

The feel fix: a unit's logical tile changes **partway through** its move, not at
move-start — so a slow unit attacked at melee range reads as still mostly on its
prior tile (the spec's persistent quibble; the same gap tile-initiated statuses hit).
The enabling mechanism is the **claim system**, which also closes the same-tick
collision window the timing change opens. **WorldSnapshot bump** (the claim registry —
landed in 36a); fuzz re-baseline (timing shifts outcomes).

**Shape:**
- **Claims** — on move-start a unit claims its destination cell; the §35 occupancy
  abstraction treats a cell as blocked-for-pathing if **occupied OR claimed**; the
  claim releases on logical arrival. Two units never path to the same vacant cell —
  the second sees the claim and re-routes (the spec's design, which "neatly resolves
  aborts caused by other units' pathing").
- **Non-instant logical position** — `MoveAction`'s `unit.position = to` moves from
  `start` to a mid-move tick (**LOCKED 50%**, a config dial). Before the flip the unit
  logically occupies `from` and holds the claim on `to`; after, it occupies `to` and
  releases the claim. **Targeting / adjacency / pathing read the *logical* position**
  (LOCKED). The renderer's existing `unit:moved{durationTicks}` lerp already spans the
  window.
- **Smooth abort (the §35 path goes load-bearing)** — a move whose destination becomes
  invalid mid-flight (dynamic terrain, a non-pathed knockback onto `to`) aborts; the
  claim guarantees *other pathers* never cause this. Animate as a settle-back (a render
  design call — keep it from visually colliding with the melee hit anim, the spec's
  worry).
- **Serialize** the claim registry → the bump, reject-stale (**landed in 36a**; 36b
  adds no new serialized state — the flip tick derives from the activeAction + the 50%
  fraction, so the serialized claim is the only persistent piece).

**Cost:** the claim registry + the position-flip timing + the abort animation.
WorldSnapshot bump. Fuzz re-baseline (a melee unit now connects against a still-
arriving target differently — a likely melee/ranged shift, noted for §41).

**Headless tests:** a claimed cell blocks a second pather; the claim releases on
arrival; the logical position flips at the locked 50% fraction (the unit is at `from`
before, `to` after); targeting / adjacency resolve against the logical position; two
units proposing the same vacant cell → one claims, the other re-routes (no collision);
an aborted move leaves the unit at `from` with the claim released; snapshot round-trips
a mid-move claim.

**Decision points 36:** ✅ **LOCKED (this session):** the position-flip fraction =
**50%** (a config dial); **targeting / adjacency / pathing read the *logical* position**
(the attacker sees the still-arriving target on its old tile until the flip). **Still
open:** the abort animation shape (a render design call — settle-back vs snap; resolves
at 36c); whether a claim can be *stolen* by a higher-priority mover (recommend no —
first-claim wins, deterministic, as 36a's last-writer-wins registry already implies).

### Sub-steps (36a–36d) — the proposed cut

**Decisions LOCKED (this session):** the position-flip fraction = **50%**; **targeting /
adjacency / pathing read the *logical* position**. **Still open:** the abort-animation
shape (36c) and the claim-steal policy (see *Decision points 36*). **The phase's single
`WorldSnapshot` bump landed in 36a** (the claim registry) — **36b adds no new serialized
state**: the deferred position is `unit.position` held at `from` until the flip, and the
flip tick derives from the activeAction + the 50% fraction, so the already-serialized
claim is the only persistent piece.

- **36a — the claim registry + the occupied-OR-claimed pathing rule.** Add a `Claim`
  (an in-flight cell reservation) registry to the World and extend the §35 occupancy
  abstraction so a cell is blocked-for-pathing if **occupied OR claimed** (the one new
  predicate; `isFree`/`footprintFits` consult it). Serialized → the `WorldSnapshot`
  bump. The *mechanism* is testable on the instant model with explicit literal claims,
  independent of 36b's timing change. *Test:* a manually-claimed cell blocks a second
  pather's route; releasing it frees the cell; the registry round-trips a snapshot.
- **36b — the non-instant logical position flip.** `MoveAction` defers `unit.position =
  to` from `start` to a mid-move tick — the config fraction, **LOCKED 50%**: before the
  flip the unit logically occupies `from` and holds the claim on `to`; after, it
  occupies `to` and releases (+ release on reap, via 36a's `releaseClaimsBy`).
  **Targeting / adjacency / pathing read the *logical* position** (LOCKED — the attacker
  sees the still-arriving target on its old tile until the flip; the existing
  `unit:moved{durationTicks}` lerp already spans the window). **No new serialized state
  / no second bump** — the flip tick derives from the activeAction + the 50% fraction,
  and the claim is already serialized (36a's v31). Now claims go load-bearing: two units
  proposing the same vacant cell → one claims, the other re-routes. *Test:* the logical
  position is `from` before the 50% mark and `to` after; targeting / adjacency resolve
  against the logical position; two units → one claims, the other re-routes (no
  collision); the claim releases on arrival; a snapshot round-trips a mid-move claim.
- **36c — the smooth abort (§35b goes load-bearing) + the renderer settle-back. ✅
  SHIPPED.** A move whose destination becomes invalid mid-flight aborts via the §35b
  `unit:moveAborted` path — the claim guarantees *other pathers* never cause it (only
  dynamic terrain or a non-pathed knockback onto `to` can). Mechanism = a per-tick
  in-flight re-validation in `World.tick`'s active-action step: while the move still
  HOLDS its destination claim (the exact pre-flip signal — `applyEffect` releases it at
  the 50% flip), re-run `destinationBlocked` (which already excludes the mover's own
  claim/occupancy); on a block, release the claim, reset the move cooldown (retry next
  tick), clear `activeAction`, emit `unit:moveAborted`. Render decision LOCKED =
  **settle-back** (not snap): `BattleRenderer` subscribes and eases the sprite from its
  LIVE mid-slide position back to `from` over `SETTLE_BACK_SECONDS` (0.22s, a render
  const; overrides the in-flight slide via the single-lerp-per-handle contract), kept
  short so it clears before a concurrent melee-hit anim; a §35b selection-time abort
  settles in place (no-op). The TRIGGER is inert today (the claim blocks peer
  convergence; dynamic terrain/knockback land in §37/§40), so the mechanism is pinned
  by a SYNTHETIC headless test (`moveAbortInflight.test.ts` — force `to`→chasm or shove
  an occupant onto `to` mid-flight; covers the pre-flip tick, the flip tick, and a
  no-spurious-abort control) + a functional browser proof (a real slide→abort cycle
  driven through the bus reversed the sprite from mid-slide back EXACTLY onto `from`).
  No snapshot bump / no fuzz shift (provably inert).
- **36d — the fuzz re-baseline under claims. ✅ SHIPPED.** Re-ran the corpus with
  non-instant moves on (no config touched since §33c, so a pure ENGINE delta; strategy
  held fixed to the reproducible greedy/pure-random baselines — §33c's searched optimum
  vector wasn't saved). §35d's occupancy invariant HOLDS across the open claim window
  (`assertOccupancy` on, 12+12 smoke + a broad 40+40 temp corpus, ~80 full runs). **No
  detectable win-rate shift:** greedy 7.5% / pure-random 15.8% (seeds 1–120) vs greedy
  14.2% / pure-random 11.7% (held-out `--seed-offset=5000`), 0 hangs — the two greedy
  samples BRACKET §33c's 10.0% (n=120 seed-variance ±~3.5pt swamps the in-sample −2.5pt).
  Precise melee/ranged characterization + any rebalance carried to §41 (full `--search`
  budget). Recorded in BALANCE.md; no config change, no snapshot bump.

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

### Sub-steps (37a–37f) — the proposed cut

**Decisions still open** (see *Decision points 37*): the theme-rename migration scope
(a `RunSnapshot` touch?), the ice cost-floor, the mud-poison flag default, the
waterwalk seam (declare-inert vs omit). 37a is a byte-identical seam; 37b–37f fill it.
Independent of the unit model, so this whole phase floats free of §38.

- **✅ 37a — the `TileDef` table (the seam).** Generalized `TileGrid`'s `TILE_COSTS` into a
  per-`TileKind` `TileDef` table `{cost, passable, evasionMod?, accuracyMod?,
  statusOnEnter?, statusRemovedOnEnter?}` (keyed by kind, not serialized) +
  `tileDef(kind)` / `TileGrid.defAt(coord)` accessors; `costAt` reads `TILE_DEFS[…].cost`.
  Existing kinds carry today's cost + no mods — **byte-identical** (1462 main + 212
  fuzz:smoke green, no fuzz shift; typecheck clean). No bump. *Test:* every existing
  tile's cost + passability resolves identically via the table (`TileGrid.test.ts`
  "TileDef table" block).
- **✅ 37b — the five new tiles (cost + passability + render).** Added `deep_water`
  (impassable, cost `∞` like chasm), `hills` (cost 3), `ice` (cost-1 floor — GOTCHAS #34),
  `sand` (cost 2), `mud` (cost 4, the worst passable mobility + sunken bog mesh), each a
  `TileDef` (37a) entry + a `TerrainRenderer` `heightAt`/`topColorFor` branch (distinct
  height + fixed identity color, theme-independent like water/chasm — combat mods are
  37c, status hooks 37d). Costs are STARTING values (§41 tunes); only the relative
  ordering + the ≥1 A* floor are load-bearing. Waterwalk = NOT YET a field (declared-inert
  deferred to a real consumer). **Playtest follow-up (same commit-pair):** deep_water is
  now COPLANAR with shallow water (depth reads via the darker color, not a sunken
  surface — the recess looked wrong butted up against regular water); `hills` no longer
  just rises — the base tile is flat ground + a child `bumpsMesh` scatters 4 low-poly
  pyramid mounds/tile (deterministic from the noise field, faceted shading, raycast-off
  so picking is unaffected), the "3–6 low-poly hills" look. Verified: 1469 main + 212
  fuzz:smoke green, typecheck + lint clean; **browser readback** confirms coplanar
  water + 48 mound-verts/hills-tile rising from ground (−0.27) to varied crests (+0.24).
  *Test:* each tile's cost + passability (`TileGrid.test.ts` §37b block; deep_water
  short-circuits pathing like chasm in `Pathfinding.test.ts`; ice stays ≥1); the new
  kinds round-trip a `TileGrid` snapshot.
- **✅ 37c — tile combat modifiers (the to-hit fold).** `applyDamage`'s
  precision-vs-evasion roll now folds the ATTACKER's tile `accuracyMod` + the DEFENDER's
  tile `evasionMod`, both LIVE reads via `TileGrid.defAt` (occupant-keyed, like the
  fire/heal pass). The M6 `STATS.waterPrecisionPenalty` knob is **RETIRED** — every tile
  combat mod now lives in the `TileDef` table as the single source
  (`shallow_water.accuracyMod: -10` reproduces M6 byte-identically). Shipped magnitudes
  (USER-LOCKED starting values, §41 tunes; 1 pt = 2% to-hit): ice/mud `accuracyMod -12`
  (−24%), hills `evasionMod +8` (+16% harder to hit), sand `evasionMod -6` (−12%
  easier), deep_water none. Verified: 1476 main + 212 fuzz:smoke green (byte-identical —
  live battles only place `shallow_water`, unchanged), typecheck + lint clean. *Test
  (balance-proof, derived from the table):* `World.test.ts`'s §37c fold block flips a
  hit↔miss for an ice attacker / hills + sand defender from the table's own mod values;
  `TileGrid.test.ts` asserts the mod signs + the water fold.
- **✅ 37d — tile→status hooks (both directions).** A tile may **apply** a status on enter
  (mud → poison, gated by `tiles.json` `applyStatusOnEnter`, USER-LOCKED default ON) and
  **remove** one on enter (shallow_water + deep_water → strip `burn`, always on) —
  generalizing the Cluster-1 fire → burn to add the inverse. Wired at the §36b 50% logical
  flip (`MoveAction.applyEffect` → `World.applyTileEnterEffects`): the flip IS the "enter,"
  so it reads the destination `TileDef` after `position` is set. ONE pass — remove
  (`World.removeStatusEffect` → `Unit.removeEffect`, fires the existing `status:expired`
  so the renderer clears the burn tint) then apply (`applyStatusEffect`, environmental
  `sourceUnitId: null`). Distinct from the per-tick `applyTileStatuses` standing-on
  sustain: fires ONCE per cell entry (poison isn't re-stamped while standing; the cleanse
  only triggers on the move that lands in water). Scoped to a real `MoveAction` commit —
  spawn/shove/summon placement aren't "enters." The `statusOnEnter`/`statusRemovedOnEnter`
  ids are boot-asserted at `TileGrid.ts` module load (`assertTileStatusRefsResolve`, the
  `assertStatusRefsResolve` sibling). **No snapshot bump.** Verified: 1485 main (+9: the
  6-case `tileEnterStatus.test.ts` + 3 `TileGrid.test.ts` §37d cases, balance-proof from
  the table) + 212 fuzz:smoke green, typecheck + lint clean. **Not byte-identical** (unlike
  37c): `shallow_water` IS placed live, so water→strip-burn is a real new interaction (a
  burning unit wading loses burn) — rare, win-rate delta carried to §41. *Test:* mud
  applies poison on enter (flag on); water + deep_water strip burn on enter; the hook
  fires at the flip, not at move-start (the integration proof).
- **✅ 37e — palettes (themes) + the rename (the lone snapshot bump).** Added tundra /
  desert / swamp (`TerrainRenderer.FLOOR_PALETTE` fixed-identity low→high hex) + renamed
  `rock → barren` / `default → grassland` (barren avoids the Hills collision). **AUDIT
  CONFIRMED `theme` IS serialized** (RunSnapshot `encounterMap`), so the rename forced
  **`RUN_SCHEMA_VERSION` 23 → 24**, reject-stale (no transform — the existing relative
  `schemaVersion - 1` tests auto-track it). The closed `Theme` union made typecheck the
  exhaustive catch — every theme reference (incl. `Theme = 'default'` defaults + the
  `BattleScene` banner `=== 'grassland'`) was flagged. **Browser-verified all 6 palettes
  render** (run → encounter → `TerrainRenderer`). *Test:* `ThemeSchema` rejects the old
  names + resolves the 6 new ones; the version bump rides the reject-stale tests.
- **✅ 37f — the layout editor (schema + sim + editor).** Painting the 5 §37b tiles
  spanned three layers: **schema** — 5 optional coord arrays (`deepWater`/`hills`/`ice`/
  `sand`/`mud`) in `LayoutSchema` + `checkTileEffect` overlap validation; **sim** —
  `terrainGen` applies them via `setKind`; **editor** — the 5 tiles woven through
  `Cell`/`TerrainKind`/both paint switches/`refreshCell`/`validate`/export/load + 5 tile
  radios + legend + CSS (cell colors/glyphs, the `data-theme` floor preview rename+3-new,
  swatches) + `format.ts` emits the new arrays + the theme dropdown rename+3-new.
  **GOTCHAS — the paint path has TWO switches:** `applyStrokeTo` ROUTES a stroke to
  `applyTerrainStroke`, which then maps it to a `Cell`. A new tile must be added to BOTH;
  the router has no exhaustiveness check, so a missing case silently no-ops (this bit us:
  new tiles painted nothing while old tiles worked — chasm was in the router list, the new
  ones weren't). Browser-verified: all 5 tiles paint + export their arrays; the 6 themes
  preview. *Test:* a layout with all 5 new tiles + a new theme round-trips through the
  editor formatter → the real schema; a mutex overlap is rejected.
- **▶ 37g — editor playtest feedback + polish (OPEN; round 1 landed 2026-06-30).** A held-open
  step for whatever the user surfaces while authoring real maps with the full tile + theme
  set in the layout editor (UX, glyph/color tweaks, validation gaps, save/load edge cases,
  missing affordances). Scope is defined by the feedback, not pre-specified. Closes Phase 37;
  Phase 38 opens only after 37g lands (or the user waives it). **Watch the §37f gotcha** —
  any new paintable kind must be added to BOTH paint switches (`applyStrokeTo` router +
  `applyTerrainStroke` mapper); consider hardening the router with an exhaustiveness check
  while in here.
  - **✅ Round 1 (3 feedback items from the Isthmus/full-tile playtest):**
    - **Spawns on passable terrain (LANDED).** Relaxed the spawn rule in BOTH validators (the
      canonical `LayoutSchema.superRefine` + the editor's live `validate()`): a spawn region may
      now sit on any PASSABLE tile (water/fire/healing/hills/ice/sand/mud) — the unit stands +
      fights there with its terrain combat mods + wading cost live. Reject only cells it can't
      occupy: impassable (chasm, deep water) + neutral-occupied (wall, half-cover). +11 schema
      accept/reject tests; the shipped-layout spawn-overlap invariant updated to the new rule.
    - **Deep-water connectivity gap (LANDED, latent 37f bug).** Deep water is Infinity-cost
      (impassable) like chasm but was never in the connectivity blocker sets (`layouts.test.ts`
      + the editor's `isConnected`), so a deep-water-severed map validated as connected. Closed
      both. Validation-only, no snapshot bump.
    - **Isthmus pathing quirk (TODO'd, map left as-is per user).** Units "charge at the deep
      water and get stuck near it" — diagnosed as congestion at the Isthmus's 2-wide shallow
      neck (hourglass map; deep water nearly severs the halves), NOT a pathing bug (A* routes
      around deep water correctly; the sidestep can't escape because the flanking cells are
      deep water → abstain). Left the map; opened a TODO to probe whether the choke reveals a
      generalizable clumping/pathing quirk worth softening. See TODO.md "Polish / pre-launch".
    - **Walls/cover on non-default terrain (DEFERRED → §40).** Today's walls/half-cover are
      hard blockers nothing stands on, so terrain-under is gameplay-inert (cosmetic-only). It
      becomes load-bearing with §40 destructibles (terrain revealed when rubble/cover breaks),
      and should be built once against the final §38 `UnitDef` + §39 footprint model, not
      today's closed wall/halfCover one. Scoped into §40 (see that phase).

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

### Sub-steps (38a–38e) — the proposed cut (38a GATES the rest)

**Decisions LOCKED (38a, 2026-06-30):** catalog home = **rename `config/archetypes.json`
→ `config/units.json`** (+ `src/config/archetypes.ts` → `src/config/units.ts`; the
existing file already IS the catalog, so this evolves it rather than building a parallel
one); **one** unified catalog (neutrals fold in at 38d); `statusSusceptibility` default
= **allow-all**; migration cadence = **field-by-field, all archetypes at once** (the data
is already centralized in one config record, so a per-archetype oracle cadence would be
artificial — each commit kills one literal branch, the oracle proving it byte-identical).
**Naming scope:** rename the config-layer symbols to UnitDef vocab (`ArchetypeConfig` →
`UnitDef`, `ARCHETYPES` → `UNIT_DEFS`, `ArchetypesSchema` → `UnitDefsSchema`) but **keep
`archetype` as the per-unit-kind id field/type name** (it appears at 100+ `unit.archetype`
sites; the change is relaxing it from a closed union to a validated string id in 38c, not
a field rename). A byte-identical migration (the Y determinism-oracle pattern) → **no
`WorldSnapshot` bump expected** (the new fields are def-resolved by id at spawn). The
oracle is the equivalence proof for 38c + 38d.

- **✅ 38a — the archetype-literal audit (DESIGN ROUND, COMPLETE 2026-06-30).** Swept
  sim/run/render. **Already config-driven** (via `ARCHETYPES` + `archetypes.ts`
  accessors): glyph, targeting, range/minRange, growth, baseStats, abilities, draftable;
  the **render layer has ZERO archetype branches** (glyph from config, FX key-driven).
  **Genuine literal branches — only 3 + the `environment` sentinel:** (1) `stats.ts`
  `damageStatFor`'s 18-case `switch(archetype)` → a `damageStat?` config field
  (load-bearing for melee/ranged strikers; display-only for casters; absent ⇒
  non-striker/0); (2) `behaviors/registry.ts` `createMovementBehavior`'s `=== 'healer'`
  → a `movementBehavior` selector field; (3) `Targeting.ts:139`'s `=== 'ranged'`
  LOS-retarget → a `retargetOnLosLoss` capability flag. The `'environment'` sentinel
  (`UnitArchetype = Archetype | 'environment'`, branched in archetypes.ts ×2 / stats.ts /
  UnitCard.ts) is the §38d neutral-fold. **Literal CONSTRUCTIONS** (not branches — ids
  that just must stay valid once the union relaxes): `Run.ts` `'mercenary'` (start team),
  `enemyBudget.ts` `'bandit'`/`'ranged'` (default enemy comp). **Verdict: clean/small —
  no re-scope** (matches the "few literal branches → clean 38b–38e" expectation). Locked
  decisions ↑.
- **✅ 38b — rename `archetypes.json` → `units.json` + plant the inert UnitDef fields (COMPLETE + user-confirmed 2026-06-30).**
  Mechanical, byte-identical: `git mv config/archetypes.json config/units.json` +
  `src/config/archetypes.ts` → `src/config/units.ts` (the 3 source importers +
  `SAVABLE_CONFIG_FILES` + the archetype-editor's path strings + tests follow the
  compiler; config-layer symbols → UnitDef vocab per the naming scope above). Extend the
  zod schema with the optional blocks at **behavior-identical defaults, not yet wired**:
  `footprint` (1), `layer` (`ground`), `ignoresTerrain` (false), `statusSusceptibility`
  (all), plus the three branch-killer fields planted OPTIONAL — absent in JSON, populated +
  wired in 38c (`damageStat`, `movementBehavior`, `retargetOnLosLoss`); the flat-HP/neutral
  block lands in 38d with the fold. A
  boot-assert validates every referenced id. *Test:* every id resolves; each optional
  field defaults to a behavior-identical value.
- **✅ 38c — relax `Archetype` → a catalog id + route the data-driven lookups through the
  catalog (COMPLETE 2026-07-01; byte-identical, no snapshot bump).** Shipped as four
  field-by-field commits, each fuzz-oracle-proven (same seeds → same outcomes):
  **38c-1** killed `stats.ts` `damageStatFor`'s 18-case `switch(archetype)` → the
  `UnitDef.damageStat` catalog field (strikers only; healer/shaman absent ⇒ 0);
  **38c-2** killed `behaviors/registry.ts` `createMovementBehavior`'s `=== 'healer'` →
  the `movementBehavior` selector (`support` for the healer alone); **38c-3** killed
  `Targeting.ts`'s `=== 'ranged'` LOS-retarget → the `retargetOnLosLoss` flag (`ranged`
  alone); **38c-4** relaxed the closed `Archetype` union → `string` (`Unit.ts`) +
  `UnitDefsSchema` `z.object`→`z.record` (open catalog, structural validation) + a
  `REQUIRED_UNIT_IDS` boot-assert for the start-team/enemy-comp literals. **Each catalog
  read is CALL-time off `UNIT_DEFS` (not the `archetypes.ts` accessor) — the
  `config/units ⇄ sim` cycle makes an eval-time read a TDZ crash (GOTCHAS #114).** Final:
  1570 tests + 212 fuzz:smoke green, typecheck + lint clean. *Test:* archetypes.test /
  registry.test balance-proof each field ⇄ catalog; units.test pins the wiring cadence +
  the open-catalog (new id validates, malformed rejected, key order preserved).
- **✅ 38d — fold neutrals into the catalog (COMPLETE 2026-07-01; 3 commits).** Walls +
  half-cover are now NEUTRAL `UnitDef` entries. **Schema:** a discriminated
  `Combatant | Neutral` union (`z.union`) — a neutral is a glyph + a flat `hp` pool, no
  abilities/stat blocks, discriminated structurally on the `hp` key (`isNeutralUnitDef`);
  the 18 combatant entries stay byte-identical. **Runtime SPLIT by kind** (not one
  union-typed record): `UNIT_DEFS` stays the COMBATANT catalog (walls were the
  `environment` sentinel, never in it — so every pre-38d consumer keeps its exact types +
  behavior, no union to narrow), with `NEUTRAL_DEFS` + `ALL_UNIT_DEFS` as sibling views
  over the one `units.json` parse. **Spawn fold (38d-2):** `spawnEnvironment` takes a
  neutral archetype id and resolves glyph / flat HP / LOS-blocking from
  `NEUTRAL_DEFS[archetype]` (the old `ZERO_STATS`/`inertDerived` path made data). **The
  `'environment'` sentinel is RETIRED** — `UnitArchetype` collapses to `Archetype`, the
  four `=== 'environment'` guards + the UnitCard narrow become an optional chain on the
  combatant catalog (a neutral/unknown id → the guard's old default). A wall's `archetype`
  is now `'wall'` — **the FIRST non-byte-identical §38 step** (snapshot archetype string
  changed; NO schema bump — WorldSnapshot v31/RunSnapshot v24 hold). **Susceptibility
  (38d-3):** `applyStatusEffect` (the single apply chokepoint — covers the op AND the tile
  enter/sustain hooks) consults `UnitDef.statusSusceptibility`; absent ⇒ all (combatants
  unchanged), walls declare `['burn','frozen']` (inert until §40 lands damage on neutrals).
  The team-based neutral filters (Targeting / HUD / `checkBattleEnd`) stay. Browser-verified
  a live catalog-spawned wall/half-cover renders (sprite handles + `#`/`╥` glyphs). *Tests:*
  a catalog wall/half-cover matches the old `spawnEnvironment` shape (+ a glyph-drift guard);
  susceptibility filters an `applyStatus` (wall takes burn, ignores poison; no `status:applied`
  for a filtered apply); a combatant still takes any status.
- **✅ 38e — the editor rework + delete the old path (COMPLETE 2026-07-01; 2 commits).**
  The keystone's payoff — authoring a unit is now **pure data, no code edit**. **38e-1**
  made the font atlas **catalog-derived**: `GLYPHS` (`src/render/glyphs.ts`) derives the
  UNIT glyphs from `ALL_UNIT_DEFS` (config key order, deduped) and keeps only the NON-unit
  glyphs (root `@`, HUD digits/punctuation, projectile `*`, objective `X`) as a static
  list — so a new unit's glyph auto-registers (the LAST code-edit dependency, removed). A
  `FontAtlas` build-time guard + `atlasCellsFor`/`ATLAS_CELL_BUDGET` (48 = the 8×6 grid)
  cap the count. **38e-2** reworked the editor: `working` is the full `Combatant|Neutral`
  catalog (neutrals — walls/half-cover — now editable via a kind-scoped form: glyph, flat
  `hp`, `blocksLineOfSight`, `statusSusceptibility` behind a "Restrict statuses" toggle),
  the closed-union **"Wire-up" panel is DELETED** (its `Archetype`-union / `UnitDefsSchema`
  / `glyphs.ts` edits were dead after 38c + 38e-1), replaced by a Font-atlas budget
  indicator that **blocks Save** when over budget. `units.json` was already in
  `SAVABLE_CONFIG_FILES` (38b). The attack editor is untouched (abilities referenced by id).
  1563 main green; typecheck + lint clean. **Browser-verified end to end:** authored a
  brand-new `vanguard` (glyph `N`) in the editor with NO code edit, Saved, reloaded — the
  catalog + atlas auto-picked it up (`getGlyphUV('N')` resolves, 42/48 cells), and a spawned
  vanguard rendered its `N`, pathed to the enemy, and landed an attack.

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

### Sub-steps (39a–39e) — the proposed cut

**Decisions still open** (see *Decision points 39*): the passability rule, the render
anchor, whether the A* heuristic needs adjusting for wide bodies, and whether any §38
archetype goes multi-tile now (recommend inert until §40's rubble — keep the fuzz
baseline stable through §39). No bump expected (footprint def-resolved; `position`
stays the canonical corner).

- **✅ 39a — the footprint geometry fill.** `cellsOccupiedBy(unit)` returns
  `corner..corner+N` (reading §38's `footprint` field via a call-time `footprintOf`,
  gotcha #114); a pure `footprintCells(corner, n)` is the N×N geometry core (39c's
  `anchorFootprint` reuses it); `footprintFits(cells, plane)` already checks all N cells;
  the footprint-aware distance shipped as a NEW `unitDistance(a, b)` seam (min cell-to-
  cell Chebyshev) — `distanceBetween(coord, coord)` stayed the untouched coord PRIMITIVE
  so every existing caller (the A* heuristic, leash checks) is byte-identical. Single-cell
  units keep the reference-identical `[position]` fast path; footprints stay INERT (no
  multi-tile def ships until §40), so the N×N path is exercised by tests only. **No bump;
  fuzz 212 held (byte-identical shipped roster).** *Tests (+13, occupancy.test.ts 21→31):*
  `footprintCells` N∈1..4; `cellsOccupiedBy` returns the N×N block from the corner (via a
  temp catalog id); `footprintFits` rejects a block overlapping a combatant/wall;
  `unitDistance` footprint-aware (a 2×2 + an adjacent unit at distance 1, overlap at 0,
  single-cell reduces to `distanceBetween`).
- **✅ 39b — footprint-passability pathfinding.** `findPath` gained a trailing
  `footprint = 1` param: a candidate corner is a valid A* node iff its WHOLE N×N block is
  on-grid + unblocked + finite-cost (a `blockFits` closure; `footprint === 1` iterates
  exactly the corner cell = the pre-§39b test verbatim, which is why it's a trailing
  default — every existing caller stays byte-identical). A* still moves the single corner
  and charges the CORNER's entry cost, so Chebyshev-on-corner stays admissible (confirmed
  by a test: a fitting 2×2's path length equals the single-cell optimum). Pathfinding
  stays a pure grid algorithm (footprint is a plain number — no unit/catalog knowledge).
  Threaded the mover's `footprintOf(unit)` through `advance`/`leapLanding`→`routeToward`
  and `SupportMovementBehavior`; the step-COMMIT collision + sidestep stay single-cell (a
  multi-tile MOVER is post-§40 — §40's rubble is static). **No bump; fuzz 212 held.**
  *Tests (+6, Pathfinding.test.ts):* a 2×2 paths a 2-wide gap but NOT a 1-wide (a 1×1 does,
  proving footprint is the cause); footprint=1 byte-identical to default; admissibility
  (fitting 2×2 path is minimal); a goal block overflowing the grid edge is rejected.
- **39c — the spawn anchoring policy.** `anchorFootprint(spawnTile, size, policy, grid,
  occupancy) → cells | null`; ship `corner` (in-bounds-biased — the spawn tile is *a*
  corner, pick the diagonal keeping the block on-grid, so an edge tile still fits); a
  null fit → the caller tries the next candidate tile (reuses the overflow scan's "walk
  candidates, skip if it doesn't fit" loop — **not** a new spawn class).
  `random-intersect` deferred to camps. *Test:* corner anchoring keeps an edge-tile
  spawn on-grid; the fit-check skips a too-tight tile.
- **39d — multi-tile rendering.** Scale the glyph quad to the footprint (the
  SpriteRenderer per-instance `size` attr, E6.B); the sprite anchor reads the footprint
  center, the logic stays on the corner. Browser-verify. *Test (browser):* a 2×2 unit
  renders at footprint scale, centered.
- **39e — the layout editor (multi-tile validation + placement).** Multi-tile
  spawn-room validation (does an N×N spawn fit?) + placing multi-tile entities. *Test:*
  spawn-room fit validation rejects a too-small room; a multi-tile entity places + reads
  back.

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
- **Layout editor** — paint rubble (size + HP) + toggle wall/cover destructibility. **Also
  here (deferred from 37g): walls/cover ON non-default terrain.** Today the editor's per-cell
  model is mutex (`Cell[][]`, one kind/cell) + the schema rejects a wall/cover coord that
  overlaps a terrain tile — so a wall can't sit on sand. Gameplay-inert for indestructible
  walls (nothing stands on them), but once a destructible breaks, the unit that walks onto the
  freed cell stands on the terrain underneath, so it MATTERS here. Build it now: split the
  editor into a terrain layer + a separate neutral overlay (so a cell carries a tile kind AND
  an optional neutral), and relax the schema overlap rule so a neutral coord may coincide with
  a terrain tile. Built against the final §38 `UnitDef` + §39 footprint model (the reason it
  waited — doing it at 37g would have been against the soon-replaced closed wall/halfCover one).

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

### Sub-steps (40a–40d) — the proposed cut

**Decisions still open** (see *Decision points 40*): the auto-target priority rule,
all-at-once vs incremental collapse (recommend all-at-once), the wall-destructibility
default (recommend off), whether rubble blocks LOS. No `WorldSnapshot` bump expected
(HP already serialized; the layout schema gains destructible HP fields as config). This
phase composes §38 (neutral `UnitDef`s + susceptibility) + §39 (footprints).

- **40a — the rubble `UnitDef`(s) + glyph (the first real multi-tile entity).** A
  neutral `UnitDef`: no abilities, a flat HP pool, a footprint (1..3), a glyph (`▓` —
  needs a `glyphs.ts` entry + the §30-resized atlas budget; FontAtlas.test guards).
  Burnable/freezable but **not** poisonable (`statusSusceptibility`, §38). Proves the
  §39 fill end-to-end; the 0-HP reap → `unit:died{neutral}` lifecycle already works
  (BattleRenderer fades, audio skips). *Test:* rubble spawns + occupies its whole
  footprint until destroyed; AoE + DoT apply per susceptibility (burn yes, poison no);
  a 0-HP rubble reaps + fires `unit:died{neutral}`. Browser-verify the glyph + crumble.
- **40b — the targeting-neutrals auto-target hook (the one new mechanic).** Add an
  opt-in, lower-priority path: rubble is **auto-targeted below all reachable hostiles**
  (a unit with no reachable hostile, or an explicit order, may chip a blocking
  destructible — the "deny access until destroyed" loop). Walls + half-cover are **not**
  auto-targeted (manual/AoE only; AoE already hits neutral cells for free). *Test:*
  auto-targeting picks a reachable hostile over a destructible; a destructible only when
  no hostile is reachable; walls/cover are never auto-targeted.
- **40c — optional wall/cover destructibility.** A per-instance HP in the layout schema
  (default = today's indestructible 1-HP; a higher value = destructible) — the lifecycle
  already runs end-to-end. *Test:* a destructible wall falls to focused fire; the
  default stays indestructible.
- **40d — the layout editor.** Paint rubble (size + HP) + toggle wall/cover
  destructibility. Browser-verify. *Test (browser):* paint rubble + toggle
  destructibility; both read back.

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

### Sub-steps (41a–41c) — the proposed cut

**READ BALANCE.md first.** Content/config only, no bump. The §X harness
(`--per-encounter` / `--encounter` / `--seed-offset`) already exists — this is the
sweep + verify, scoped to what actually moved (not a full re-derivation).

- **41a — the re-measure (re-baseline the win-rate).** Re-run the fuzz win-rate across
  every shift (§35 proactive checks/shove, §36 timing, §37 terrain, §39 footprints, §40
  destructibles); diagnose what actually moved via the per-encounter / per-hop harness +
  the pool-damage metric. *Output:* the new baseline + the gradient + a flagged list of
  dials that moved balance.
- **41b — the adjustments (scoped to 41a).** Turn only the dials 41a flagged — tile
  cost/mod magnitudes, rubble HP/placement, any §36 non-instant melee-vs-ranged
  correction — per the BALANCE.md loop (isolation + in-situ, gradient over win-rate).
  Confirm the new tiles/destructibles don't break the §33 caster-summoner equilibrium.
  *Test (balance-proof, derived from config):* the re-tuned dials hold the band.
- **41c — the hold-out verify + the deferred content call.** Out-of-sample verify
  (`--seed-offset`) that the re-tune generalizes; decide the uniform-vs-curve
  terrain-density question on the data. *Output:* the out-of-sample confirmation + the
  terrain-density call.

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
- **36:** the abort animation shape; the claim-steal policy. *(LOCKED this session:
  flip fraction = 50%; targeting / adjacency / pathing read the logical position.)*
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
