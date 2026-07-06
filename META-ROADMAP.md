# META-ROADMAP — The road to feature-complete (Post-X)

The single source of truth for the **order in which the remaining game systems get
built**, and why that order minimizes future rewrites. This is the index above
`ROADMAP.md`: each **cluster** here becomes its own full roadmap spec when its turn
comes. `DESIGN.md` says *what* we're building; `ARCHITECTURE.md` says *how the code
is shaped*; `ROADMAP.md` is the *current* in-flight roadmap; this file is the
*meta-order* across the roadmaps still to come.

**Status:** Locked 2026-06-22, off the source brief now archived at
[archive/Post-X-Outstanding-Features.md](archive/Post-X-Outstanding-Features.md).
The encounter-system round (Phases S→X) is content-complete; this plans everything
between here and feature-complete.

> **Cluster 1 — Combat Depth is COMPLETE** (Phases **Y → 34**, archived at
> [archive/post-x-roadmap.md](archive/post-x-roadmap.md)). **Cluster 2 — Spatial &
> Movement is now EXPANDED into [ROADMAP.md](ROADMAP.md)** (Phases **35 → 41**),
> synthesized 2026-06-28 from [archive/cluster-two-spec.md](archive/cluster-two-spec.md)
> + the design discussion that locked flight (deferred build) and the full
> data-driven unit overhaul. The remaining clusters (3–6) below stay as the
> meta-order until their turn comes.

---

## How to read this

- The six clusters are **ordered**. The order is the product, not the list — it's
  built so that every system is authored against a data model that is already
  final by the time content references it.
- Each cluster will be expanded into its own `ROADMAP.md` (continuing the phase
  cadence). When you start a cluster, lift its **"Lays these seams / decisions
  locked"** and **"Depends on / must not precede"** notes into the spec.
- Nothing in the source list was dropped. The **Coverage map** at the bottom shows
  where every original bullet landed; a handful of items I added are flagged
  **(added)**.

## The ordering principles

1. **Define a data model before the content that consumes it.** The expensive
   rewrites in this list aren't engine bugs — they're *re-authoring passes* when a
   schema shifts under content that already shipped. The most-referenced models go
   first.
2. **Cluster work that touches the same core.** Anything that touches
   pathfinding / collision / `TileGrid` is designed **once**, with all its
   requirements known — not poked four separate times.
3. **Seam now, fill later.** When a system is genuinely uncertain because it has no
   consumers yet (multi-tile units), introduce the *seam* it will fill — a
   behavior-identical indirection — so that later content is authored against the
   seam, and the eventual implementation is an *extension*, not a *rewrite*. (We do
   this routinely: the `rewards?` field, the `unit-card--rarity-*` hook, the
   difficulty-multiplier seam.)
4. **Polish rides its feature.** Status-effect visualization, combat SFX, and
   camera shake are *part of* the cluster that motivates them, not a terminal
   cleanup round. An effect you can't see is an unverifiable effect. A final
   global feel/settings sweep is the only polish that waits for ship.

**Cross-cutting:** every cluster that touches combat **closes with a balance pass**
(the `BALANCE.md` loop). That's a convention, not a cluster.

## The sequence at a glance

```
1. Combat Depth ─┐
2. Spatial & Movement ─┤ (the two "scary" engine rounds — done first, deliberately)
                       │
3. Economy ────────────┤
4. Drafting & Identity ─┤ (content-model rounds on a now-stable engine)
5. Map Content ─────────┤
                        │
6. Meta & Ship ─────────┘ (the capstone — unlocks/gates everything above)
```

Dependency edges the order satisfies:

- Consumables → effects/attacks  ⇒ Combat before Economy
- Shop / camps / events / elite payoff / meta → rewards+currency  ⇒ Economy before its consumers
- Starting characters → draft pools + rarity  ⇒ Drafting internally ordered
- Meta unlocks → starting characters + difficulty + persistence  ⇒ Meta last
- Map content → economy + combat + drafting + spatial  ⇒ Map Content after all four
- Spatial → (soft) combat only; otherwise standalone  ⇒ free to go at #2

**Rationale for the two engine rounds first:** Combat Depth and Spatial &
Movement are the deepest core surgery in the whole plan. Doing them while the
codebase is at its current maturity — before clusters 3–6 pile content on top —
means the later rounds are content/UI on a stable, hardened core. Getting them
right once beats retrofitting later.

**Interstitial rounds** (user-feedback rounds slotted between clusters — the
Post-N O→R precedent) don't break the cluster order; they're recorded here as
they happen: **2026-07-04 → 2026-07-06 — the Pathfinding Audit (Phases 42→46):
✅ COMPLETE & user-confirmed**, between Clusters 2 and 3: the movement-
intelligence audit (bias fixes · first-class waiting · corridor cooperation ·
a measured WHCA\*/flow-field gate — **decided NO on data**; run-log =
[PATHING.md](PATHING.md), balance close = BALANCE.md §46b "accept +
re-baseline"). Its round doc archives → `archive/post-41-roadmap.md` at the
Cluster-3 kickoff. Cluster 3 inherits one ⚠ watch item: boss wall held-out
59% vs the 43–55% target (see BALANCE.md §46b).

---

## Cluster 1 — Combat Depth  ✅ EXPANDED → [ROADMAP.md](ROADMAP.md) (Phases Y→33)

**Charter:** make attacks and effects **composed data**, not hand-coded classes,
and build the depth (status effects, richer attack mechanics) on top of that model.

**In scope**

- **Non-stat status effects:** burn, bleed, poison, blind, confusion, panic,
  frozen. These extend the existing K1 status system (today stat-mod-only) along
  two new axes: *periodic* effects (DoT — burn/bleed/poison, kin to the existing
  `unit:burned` tile chip) and *behavior/AI overrides* (blind = hit penalty,
  confusion/panic = altered targeting/movement, frozen = skipped actions).
- **Additional attack mechanics:** chain attacks, attacks that inflict status
  effects (the literal join of the above with the attack model), summoning.
- **The data-driven attack/effect model** — the keystone. Today each attack is a
  code class (`MeleeStrike`, `MagicBolt`, `CatapultShot`, …). The attack editor
  (below) requires attacks to become *composed effects over the F2 action-phase
  timeline*. **This schema is the single most-referenced thing in the whole
  meta-roadmap.**

**Dev tools (built alongside)**

- **Attack editor** — visual/JSON authoring of the new data-driven attacks
  (modeled on the encounter editor; writes via `/__save-config`).
- **Archetype-editor expansion** — extend the existing tool to *create* new
  archetypes, not just edit them (you'll need new units to carry the new attacks).

**Polish that rides it**

- In-battle **status-effect visualization** (reclassified from "polish" — it's part
  of the feature).
- Combat **SFX** for the new effects/mechanics; **camera shake** on heavy hits.

**Lays these seams / decisions locked**

- Build on K1 (`src/sim/statusEffects.ts`) + F2 (`action:phase` timeline +
  `OrphanPolicy`) — extend, don't replace.
- The attack/effect schema is the foundation everything downstream authors against.
  Spend the time here; get it wrong and every later enemy/camp/consumable
  re-authors.

**Depends on:** nothing new.
**Must precede:** Economy (consumables grant effects), Map Content (camp units use
attacks/effects). **Closes with a balance pass.**

**Flag — enemy/encounter AI:** O1 left enemy steering inert (`atWill`). Summoning
and richer attacks will feel dumb without *some* encounter-attached enemy steering.
Decide at spec time whether a modest "encounter AI" sub-thread lives here or in
Map Content.

---

## Cluster 2 — Spatial & Movement  ✅ EXPANDED → [ROADMAP.md](ROADMAP.md) (Phases 35→41)

**Charter:** harden the movement/pathfinding/occupancy core (it bit us once with
the kiting bug), extend it with terrain depth and flight, and **lay the footprint
seam** so multi-tile units become a later extension instead of a rewrite.

**In scope (sequenced low-risk → high-risk, hardening as it goes)**

1. **Harden the core** — pay down the kiting-class debt (the corridor archer
   kite-pin was a real `MovementBehavior` bug); build the test scaffolding:
   occupancy invariants, a pathfinding fuzz.
2. **Tile mechanics** — deep water, mountains/uneven, mud, ice, sand as cost +
   passability rules (`TileGrid` already has per-cell movement cost). *Authoring*
   placements into layouts is ongoing content; the *mechanics* land here.
3. **Dynamic terrain** — destructible terrain (HP-bearing neutral-team entities,
   kin to today's walls/half-cover) + tiles with dynamic effects.
4. **Flight** — a pathing/targeting modifier (ignore ground blockers + water/chasm,
   meleeable by adjacent ground units). Does **not** break the 1-unit-1-cell
   invariant.
5. **The footprint seam** — route every spatial query through an occupancy
   abstraction (`cellsOccupiedBy(unit)`, `footprintFits(cells, at)`,
   `distanceBetween(unitA, unitB)`) that currently always returns a single cell.
   Behavior-identical, snapshot-stable refactor.

**Deferred to a later, small spec — the multi-tile *fill*:** N-cell footprints +
rendering + spawn-room validation. Once the seam exists, this is a bounded
extension you slot in when a concrete consumer appears (a 2×2 boss, a siege
engine) — **not** part of this round.

**Dev tools (built alongside)**

- **Layout-editor extensions** — paint the new tiles, author dynamic terrain,
  and (when the fill lands) validate multi-tile spawn room.

**Lays these seams / decisions locked**

- **Open the round with a one-paragraph design-target sketch** so the footprint
  seam isn't shaped blind — e.g. "footprints are axis-aligned rectangles up to
  3×3; flyers ignore ground blockers + water but are meleeable; ice slides, mud
  halves move." Constraints, not a content round.
- Single-tile stops being a hard-coded assumption and becomes "a footprint of
  size 1." Clusters 3–6 then author against the seam, never against single-tile.

**Depends on:** (soft) Combat Depth — interesting units to test on, satisfiable
with fixtures. **Must precede:** Map Content (camps want flyers/terrain).
**Closes with a balance pass** (terrain/flight reshape the tactical layer).

---

## Cluster 3 — Economy

**Charter:** define the reward / currency / item model **once**, then build the
sinks that spend it.

**In scope**

- **Reward system** — fills the reserved `rewards?` seam on `Encounter`; makes
  elite nodes (and later camps/events) reward-bearing instead of XP-only.
- **Currency.**
- **Shop nodes** — the deferred shop node type on the run map.
- **Consumable items** — can now grant Cluster-1 effects (poison flask, etc.).

**Dev tools (built alongside)**

- **Reward / item / shop-inventory editor** **(added)** — you'll want authored loot
  tables and shop inventories the same way encounters needed the encounter editor.

**Polish that rides it:** SFX for pickups/purchases.

**Lays these seams / decisions locked**

- The reward/currency/item shape is the most-depended-on *meta* model — camps,
  events, elite payoffs, and meta-progression all consume it. Lock it before they
  reference it.

**Depends on:** Combat Depth (consumables grant effects).
**Must precede:** Drafting (shop can offer rarity-weighted units), Map Content,
Meta.

---

## Cluster 4 — Drafting & Identity

**Charter:** rarity → draft pools → starting characters, a self-contained chain.

**In scope**

- **Unit rarity system** — fills the `unit-card--rarity-*` UI seam.
- **Drafting system + draft pools** — the much-deferred draft model.
- **Starting characters** — bundles { starting roster, daemon, draft pool }.
  Daemons already exist (Phase L); `recruitment.json` already holds the starting
  team.

**Dev tools (built alongside)**

- **Draft-pool editor.**
- **Starting-character editor** (or plain JSON if the schema stays simple).
- Archetype editor already extended in Cluster 1.

**Depends on:** Economy (shop offers rarity-weighted units — soft).
**Must precede:** Meta (unlocks gate starting characters).

**Flag — synergies / traits (added, decision needed):** a draft/rarity system tends
to feel thin without a team-building payoff (tribal/class bonuses). `DESIGN.md`
lists synergies as out-of-scope; make it a *conscious* call at spec time. If in,
they belong here.

---

## Cluster 5 — Map Content

**Charter:** rich, reward-bearing non-standard nodes — now that rewards, effects,
terrain, and drafting all exist to draw on.

**In scope**

- **Neutral encampments** — WC3-style creep camps: optional combat fought for
  loot. Uses the neutral-team substrate + Cluster-1 attacks/effects +
  Cluster-3 rewards + (optionally) Cluster-2 terrain/flyers.
- **Event system** — the much-deferred non-combat node type, with a choice/outcome
  grammar (kin in spirit to the wave grammar). Grants currency/items/units from
  the systems above.

**Dev tools (built alongside)**

- **Event editor.**

**Depends on:** Economy + Combat Depth + Drafting + Spatial.
**Closes with a balance pass** (camps add fightable content).

**Note:** these are separable — camps could fold into Economy as "the first
reward-bearing content," and Events could stand fully alone. Kept bundled here;
split when you expand the spec if it reads cleaner.

---

## Cluster 6 — Meta & Ship

**Charter:** the capstone — progression that unlocks/gates everything above, then
ship.

**In scope**

- **Persistence / save-load** **(added — the hidden prerequisite)**. The
  `toJSON`/`fromJSON` plumbing exists; there's no save/load UI. Cross-run unlocks
  are impossible without it. *(Mid-run save/resume is cheap QoL the plumbing
  already supports — it can be pulled forward standalone any time.)*
- **Difficulty levels** — ascension-style; groundwork exists (per-speed enable,
  the focus-tile switch, the X1 difficulty multipliers).
- **Meta / unlock progression** — cross-run unlocks (archetypes, starting
  characters, …). References Cluster 4.
- **Onboarding + options/settings menu** **(added)** — tutorial, volume, the
  deferred in-game keybinding rebind, default speed, colorblind-safe palette.
- **Shipping** — build/deploy/packaging; the actual "a way to ship the game."

**Polish that rides it:** the final global feel/SFX sweep.

**Depends on:** everything. **Last by definition.**

---

## Cross-cutting conventions

- **Balance pass per combat-touching cluster** (1, 2, 5) via the `BALANCE.md`
  loop. Pool-damage metric, gradient over win-rate, isolation + in-situ.
- **Dev tools ship with their feature** (every cluster names its tool above),
  extending the `/__save-config` allowlist + `/tools/` index the same way the
  encounter/sector/layout/archetype editors already do.
- **Headless-first** for sim/run/core logic; **browser-verify** render-observable
  work (new glyphs need a `glyphs.ts` GLYPHS entry).
- **Schema discipline** — every change that touches `World`/`Run` serialized state
  bumps the snapshot version and stays reject-stale; the roundtrip test is the
  guard.

## Coverage map — every source bullet → cluster

| Source item (`Post-X-Outstanding-Features.md`)            | Cluster |
|-----------------------------------------------------------|---------|
| Currency and shop system                                  | 3 Economy |
| Reward system                                             | 3 Economy |
| Consumable items                                          | 3 Economy |
| Unit rarity and drafting system                           | 4 Drafting & Identity |
| Starting character system (rosters / daemons / draft pools) | 4 Drafting & Identity |
| Event system                                              | 5 Map Content |
| Neutral units (encampments)                               | 5 Map Content |
| Dynamic terrain (destructible + effect tiles)             | 2 Spatial & Movement |
| Additional terrain tile types (deep water/mountains/mud/ice/sand) | 2 Spatial & Movement |
| Flight                                                    | 2 Spatial & Movement |
| Multi-tile units                                          | 2 Spatial (seam) + **deferred fill** |
| Non-stat unit effects (burn/bleed/poison/blind/confusion/panic/frozen) | 1 Combat Depth |
| Additional attack mechanics (chain / status-on-hit / summoning) | 1 Combat Depth |
| Difficulty and meta progression                          | 6 Meta & Ship |
| Dev: archetype editor — create new archetypes            | 1 Combat Depth |
| Dev: attack editor                                        | 1 Combat Depth |
| Dev: draft pool editor                                    | 4 Drafting & Identity |
| Dev: event editor                                         | 5 Map Content |
| Dev: starting character editor                            | 4 Drafting & Identity |
| Polish: additional SFX                                    | distributed + 6 final sweep |
| Polish: represent status effects in-battle               | 1 Combat Depth (feature) |
| Polish: camera shake                                      | 1 Combat Depth |
| Polish: a way to ship the game                            | 6 Meta & Ship |
| **(added)** reward / item / shop-inventory editor        | 3 Economy |
| **(added)** persistence / save-load                      | 6 Meta & Ship |
| **(added)** onboarding + options/settings menu           | 6 Meta & Ship |
| **(added)** enemy / encounter AI                         | 1 or 5 (decide at spec) |
| **(added)** synergies / traits                           | 4 (decide at spec — in/out) |

## Open decisions to resolve when expanding each spec

- **C1:** where enemy/encounter AI lives (here vs Map Content).
- **C2:** the footprint design-target sketch (sizes, flight rules) — lock before
  shaping the seam.
- **C4:** synergies/traits in or out.
- **C5:** keep camps + events bundled, or split.

## Explicitly deferred (beyond this meta-roadmap)

- **Multi-tile *fill*** — the N-cell implementation (the seam lands in C2; the fill
  waits for a concrete consumer).
- Anything not on the source list or added above — revisit when content authoring
  (the coming bottleneck) surfaces a concrete need.
