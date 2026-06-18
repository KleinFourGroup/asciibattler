# ROADMAP — Post-R: The Encounter System

> **▶ ACTIVE — the round that follows the Post-N agency/control round (Phases
> O → R, now `archive/post-n-roadmap.md`).** A **design round**: replace the
> random enemy-wave generator with an authored **Encounter** model, introduce a
> **Sector** seam as the run's container, and **RE-DERIVE** the difficulty band
> against the new content. **This round UPENDS balance** — the band is not
> re-confirmed, it is re-derived (READ [BALANCE.md](BALANCE.md) first). **First
> task of the *next* round = archive this file → `archive/post-r-roadmap.md` and
> write a fresh ROADMAP.md** synthesizing that round's brief (the same
> archive-and-replace ritual that produced this file).

Companion to [DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[BALANCE.md](BALANCE.md), [TODO.md](TODO.md), and the prior roadmaps now in the
archive: [mvp](archive/mvp-roadmap.md), [post-mvp](archive/post-mvp-roadmap.md),
[post-c1](archive/post-c1-roadmap.md), [post-d](archive/post-d-roadmap.md),
[post-e](archive/post-e-roadmap.md), [post-f](archive/post-f-roadmap.md),
[post-h](archive/post-h-roadmap.md) (Phases I → N), and
[post-n](archive/post-n-roadmap.md) (Phases O → R — the roadmap this one
supersedes).

Synthesized from [archive/phase-R-feedback.md](archive/phase-R-feedback.md) (the
user's brief, now archived). Once you've read this roadmap, that brief is fully
absorbed and lives in the archive purely as a historical artifact.

## Where this came from (read this first)

The Post-N round shipped **one** of three anti-blob strategies — the O4 ranged
**minimum-range** kiting. It over-performed on the static-blob problem but
**surfaced a tail of latent bugs** (the Qb corridor kite-pin + the billboard
depth-sort). The lesson the user drew: the combat sim now needs **far greater
coverage of varied combat scenarios** before piling on more anti-blob mechanics.
So the brief's *other two* anti-blob ideas (side-objectives, dynamic terrain) are
**deferred again** in favor of building the thing that actually generates that
coverage — **a real encounter system** to replace the single random-wave
generator that every fight currently funnels through.

The brief specifies **two interlocking subsystems** plus a balance consequence:

1. **Encounters** — an authored fight definition (name, health pool, a *list of
   waves* with a small grammar) that **replaces `rollEnemyWave`**. This is the
   keystone: it turns "every battle is the same random swarm" into "this battle
   is *this* designed sequence of waves."
2. **Sectors** — a forward seam. A *sector* is one node/encounter-DAG map (today's
   ~11-floor map). A run becomes a *series* of sectors, selected via their own DAG.
   Eventually three; **initially one** ("The Start"). Sectors scope which layouts
   and encounters appear, and carry theme/length/flavor.
3. **A balance re-derivation.** Authored waves replace the random generator, so
   the difficulty band (`budgetFactor 1.25 × swarmMax 1.5`) is **invalidated, not
   perturbed** — it must be re-derived from scratch, and the fuzz/balance
   telemetry must report **per-specific-encounter**.

## Vocabulary

The settled word-map carries over, with **two renames this round** (both
user-locked) — and both lean into the project's `daemon`-style double-coding (a
term that's *two things at once*: here, a journey word with a terminal/synthwave
second meaning):

- the user's **"battle" / "skirmish"** = our **turn** (one tactical `World`
  fight). An encounter's wave list is indexed **per turn**.
- the user's **"encounter"** = our **encounter** (the multi-turn fight at one map
  node) — used correctly in the brief, no translation. This round it stops being
  an implicit "pool + random waves" loop and becomes a **first-class authored
  object**.
- the user's **"run health pool"** = the `Run`-side player pool (unchanged,
  run-wide). The **encounter** health pool (today the global
  `HEALTH.enemyHealthMax`) becomes **per-encounter authored data**.
- **"Floor" → `Hop`** (S1). A sector is horizontal; "floor" carried a verticality
  the brief wanted gone. A **hop** reads as a journey leg *and* a network/
  `traceroute` hop. Fields `hop` / `minHop` / `currentHop`; display "Hop 3".
- **the brief's "Zone" → `Sector`** (the run container — our rename). The brief
  calls the per-run node-map a *zone*; we call it a **sector** (a disk *sector* ⊗
  a deep-space *sector*). **Anywhere the archived brief says "zone," read
  "sector."** Config `config/sectors.json` + `config/sector-map.json`; run field
  `currentSectorId`. So a run **hops through a sector**, then on to the next.

## The data model — where the interlinked data lives (the brief's open judgment call)

The brief flags that sectors, layouts, and encounters reference each other and
asks where each relationship should live. The recommended shape, optimized for
*clean + extensible* (goal #1) — **each object owns only the relationships it is
the authority for; layouts stay relationship-free**:

| Object | Owns | Does **not** know about |
|---|---|---|
| **Layout** (`config/layouts.json`, unchanged) | geometry: grid, walls, water, spawns, theme | sectors, encounters — a layout is a *reusable* battlefield |
| **Sector** (`config/sectors.json`, new) | title, description, length, theme, **layout pool** (each with an optional hop gate) | encounters — a sector is a *container/board pool*, not a fight list |
| **Encounter** (`config/encounters.json`, new) | name, health pool, waves, **sector list**, **layout list** (optional), hop gate, boss flag | the node map — an encounter is *eligibility + content*, selected onto a node |

**Why layouts stay dumb:** a layout is geometry reused across many sectors and
encounters; folding sector/encounter refs *into* the layout would couple a
battlefield to the content that happens to use it (the wrong direction — you'd
edit `river.json` to add a new encounter). The *editor toggle* the brief asks for
("add this layout to sectors") writes to the **sector** file, not the layout file —
it's an authoring convenience over the sector↔layout edge, which the sector owns.

**The two layout references are deliberate, not redundant:**
- **Sector.layouts** answers *"which battlefields exist in this sector?"* — a
  sector-design/theming axis (and the thing that finally implements the deferred
  M6 **hop-gated layout roll**: don't roll the brutal open maps on Hop 1).
- **Encounter.layouts** (optional) answers *"which battlefields does THIS fight
  make sense on?"* — an encounter-design axis (e.g. a "corridor ambush" only on
  corridor layouts). **Empty/omitted = no constraint** (the common case), so most
  encounters don't carry a layout list at all.

**Selection at a battle node** (resolved against the current sector `S`, hop `D`,
node kind): **encounter-first, then a compatible layout** —
1. `candidates = encounters.filter(e ⇒ S ∈ e.sectors ∧ D ≥ e.minHop ∧ e.isBoss === isBossNode)`
2. pick one (weighted; see V1),
3. roll the layout from `S.layouts(hop-gated) ∩ (e.layouts ?? all)`.

This guarantees the rolled layout is always one the encounter supports (the
intersection is non-empty by editor validation). Encounter-first is the
**user-locked default** (the encounter is the headline choice, the layout is
dressing); the alternative — layout-first-then-filter-encounters — ships
**switchable** behind a keyed resolver for the playtest A/B (see V1).

## What moved (reordering callouts)

The brief is grouped by topic (Sectors, then Encounters, then Bosses, then misc).
This roadmap regroups by **build dependency, testability, and snapshot-bump
clustering**, which the user invited. The deltas from the brief's order:

- **Phase lettering continues the A→R sequence → this round is Phases S, T, U, V,
  W, X.** ("phase-R-feedback" spawns the *post-R* roadmap, exactly as
  "phase-N-feedback" spawned the post-N one.)
- **The "Floor" rename + selectable-root** (brief's Sectors *Miscellaneous*) →
  **pulled to the very front (Phase S)**, *before* any new code is written, so the
  encounter/sector schemas are born with the final vocabulary (the hop-gate field
  is `minHop` from day one, never a stale `minFloor`). It's pervasive but
  mechanical and low-coupling.
- **Sectors before Encounters** (brief's order is Sectors-first too, but for a
  different reason). Sectors are built **first as the run container** because each
  phase then swaps exactly **one** subsystem: T swaps the global node-map/layout
  roll for a per-sector one (combat still the old `rollEnemyWave`), *then* U swaps
  `rollEnemyWave` for the encounter model. Encounter *selection* (V) also needs a
  real `currentSector` to filter on, so the sector container must exist first.
- **The encounter model splits into "pure logic" (U) and "selection + authoring"
  (V).** The wave resolver + grammar sequencer are pure functions — **headless-
  first**, fully unit-tested in U against a single *reproduction* encounter (proves
  the model can re-create today's fights). V then opens it to many encounters +
  builds the **editor**. This is the clean reading of the user's point #2: the
  *logic* is headless-testable; what's *not* easily testable without the tool is
  **authoring and feeling** real wave grammars — so the editor lands with the
  content authoring (V), not the model (U).
- **Boss encounters (W)** are tiny once U+V exist — they're a regular encounter
  with the hop gate dropped and the boss flag set — so they're their own small
  phase after selection works.
- **Per-encounter telemetry + the band re-derivation (X)** close the round,
  because they can only run once real encounters exist and are selectable.

## Sequencing rationale

- **Groundwork first (S).** The rename + selectable-root are orthogonal to the
  model and pervasive; landing them first means zero vocabulary churn downstream
  and one clean early snapshot bump.
- **Sector container next (T).** Replaces the global node-map + global `rollLayoutId`
  with a per-sector, hop-gated version — still feeding the *old* `rollEnemyWave`,
  so it's an isolated, playtestable swap. Brings its editor + the layout-editor
  "add to sector" toggle.
- **Encounter model — pure (U).** The keystone, built and tested in isolation as
  pure functions, then wired into `Run` behind a single *reproduction* encounter
  that re-creates today's random swarm as closely as the new model allows. The
  round's main snapshot bump + the fuzz-baseline reset land here.
- **Encounter selection + editor (V).** Opens the model to a catalog; the editor
  makes authoring + tuning pleasant (and possible to *feel*).
- **Boss encounters (W).**
- **Balance re-derivation + per-encounter telemetry (X).** The closer.

Recommended path is **S → T → U → V → W → X**, with a **playtest pause between
commits** as usual. Hard ordering constraints: S before everything (vocabulary);
T's sector container before V's selection (selection filters on `currentSector`);
U's pure model before V's selection + editor; real encounters (U/V) before the
telemetry + re-derivation (X).

## Conventions (unchanged — they still hold)

- **Commit per logical change**, not per session. **Pause between commits** for
  the user's manual playtest.
- **Surface tradeoffs** before non-obvious calls; stop at "Decision points."
  Steps marked **"DESIGN ROUND NEEDED"** want the shape locked with the user
  before building — don't infer it.
- **Headless-first** for sim/run/core/config — a vitest test before the browser.
  The wave resolver, the grammar sequencer, the sector-DAG walk, and encounter
  selection are **all pure logic**: unit-test them exhaustively before any UI.
  **Browser-verify** render-observable changes (the HUD encounter name, the map);
  a genuinely new **3D glyph** needs a `glyphs.ts` entry (FontAtlas.test guards
  it) — DOM text (the encounter name, editor UIs) does not.
- **Hoist every number to config from day one** (A4): wave budgets/counts/weights,
  sector lengths, hop gates, selection weights, encounter health pools — all live
  in `config/*.json`, never inline.
- **Balance-proof tests derive from the config module** (never hardcode the
  authored numbers); mechanic/primitive tests use explicit literals and never
  read the shipped JSON.
- **Keep DESIGN.md / ARCHITECTURE.md honest** in the same commit as the code that
  invalidates them — this round adds two config files, two dev tools, and reshapes
  the `Run` encounter loop + the `BattleEncounter`/`EncounterMap` types, so the
  ARCHITECTURE source-tree + event/command catalogs need updating as each phase
  lands.
- **One snapshot bump per shape-contract cluster.** Expected `RunSnapshot` bumps
  this round: **S** (the `floor`→`hop` field rename + the root-as-node flow),
  **T** (the sector state: `currentSectorId` + the sector-DAG cursor + the per-sector
  node-map), **U** (the encounter state: the selected encounter + the wave-list
  cursor + the per-encounter health pool, replacing `encounterBudget`). Land
  anything sharing a cluster in the same phase. No `WorldSnapshot` bump is
  expected — encounters resolve to the same `BattleEncounter`/`UnitTemplate[]` the
  `World` already consumes (the change is *who builds the team*, not the team's
  shape). Reject stale, no migration (the established rule).

## Cross-phase seams to hold in mind

- **`rollEnemyWave` is the seam being replaced.**
  ([enemyBudget.ts](src/run/enemyBudget.ts)) Today `Run.beginEncounter` fixes one
  `encounterBudget = enemyBudgetFor(team)` and `Run.beginTurn` calls
  `rollEnemyWave(battleRng, team, encounterBudget)` *fresh each turn*. The
  encounter model keeps **exactly this call site** but swaps the body: the
  per-turn enemy `UnitTemplate[]` now comes from the encounter's wave sequencer
  instead of the random roller. The budget/count/weight primitives
  (`distributeBudget`, `chooseSwarmCount`) are **reusable building blocks** for the
  new resolver, not dead code — mine them.
- **The encounter is becoming first-class on `Run`.** Today an "encounter" is
  implicit: a fixed budget + a per-encounter `encounterMap` + a global enemy pool,
  re-rolling waves until the pool empties or the turn cap hits. The new model makes
  the encounter an **authored object selected onto the node**, carrying its own
  pool + wave list. `Run.currentEncounter` (the per-turn `BattleEncounter`) is
  unchanged in *shape*; what changes is the state that *produces* it.
- **The sector is the node-map's new owner.** Today `Run` holds one `nodeMap`
  ([NodeMap.ts](src/run/NodeMap.ts)) generated once at construction. A sector *is* a
  node-map plus its layout pool + theme + length; a run holds a **current sector**
  and advances to a successor sector when the current one's terminal is cleared. The
  `NodeMap` generator is reused per-sector (its `floorCount` becomes the sector's
  `length`).
- **The dev-save endpoint is the editors' home.** The `/__save-config` Vite
  middleware ([vite.config.ts](vite.config.ts)) writes editor output to an
  **allowlisted** set of config files (currently `archetypes.json`,
  `layouts.json`). The sector + encounter editors extend that allowlist and POST the
  same way — no new server machinery, just two entries + two `tools/` UIs modeled
  on the existing [layout-editor](tools/layout-editor/) /
  [archetype-editor](tools/archetype-editor/).
- **The fuzz harness is the balance instrument.** Per-encounter telemetry extends
  the existing `tests/fuzz/` reporters (the model that gave us `--per-layout` /
  `--per-floor`), **zero `src/` footprint**. A `--encounter=<id>` force-select
  mirror of `--layout=<id>` gives clean per-encounter samples (natural selection
  only hits a given encounter occasionally).

---

## Phase S — Groundwork: the "Floor" rename + a selectable root node

Pervasive-but-mechanical changes that everything downstream builds on. Landed
first so the new schemas are born with the final vocabulary and node model.
**One `RunSnapshot` bump** covers both.

### S1 — Rename "Floor" → **Hop**

**Shape:** a project-wide rename of the floor concept — `MapNode.floor`,
`Run.currentFloor` / `floorOf` ([Run.ts](src/run/Run.ts)), `NodeMap.floors[]` +
the `floorCount` config ([nodemap.json](config/nodemap.json)), the HUD floor chip
([HUD.ts](src/ui/HUD.ts)), the pre-turn screen's floor line, and the fuzz
`--per-floor` reporter label. Route the new term through a single vocabulary so
UI and sim can't drift. Functionally a no-op — same DAG, same hop index, new
name.

**Cost:** mostly find-and-replace + a `RunSnapshot` field rename (`floor` →
`hop` on the persisted `MapNode`) → **bump #1**, reject stale. Balance-neutral
(no sim change); the fuzz baseline is byte-identical (the rename touches labels,
not draws). Browser-verify the HUD/pre-turn labels.

**Headless tests:** the existing node-map/Run tests carry over under the new
field name; a snapshot round-trip rejects a pre-rename save.

**Decision points S1:** ✅ **RESOLVED (user) — the term is `Hop`.** A `Hop`
reads as a journey leg (horizontal, no verticality) and carries a terminal-
aesthetic double meaning — a network/`traceroute` *hop* — that rhymes with the
project's `daemon` double-coding (Unix daemon ⊗ classical daimon). Fields:
`MapNode.hop`, `Run.currentHop` / `hopOf`, `NodeMap.hops[]`, `minHop` gates,
the `--per-hop` fuzz label; display "Hop 3". *(The rename stays deliberately
low-coupling, so if it ever needs to slip, the encounter/sector phases could
proceed on the old "floor" term — but it's first precisely so the new `minHop`
gates are born correct.)*

### S2 — The root node becomes a normal, selectable node

**Shape:** the brief — "the root node of the map is not selectable; we'll want to
make it a normal node." Today floor 0 is a single non-selectable `@` the player
starts *on*, choosing a floor-1 node first ([NodeMap.ts](src/run/NodeMap.ts)
`rootId`; [MapScreen.ts](src/ui/MapScreen.ts) frontier logic). Make the root a
normal node the player **selects as their first encounter**: the run starts at a
pre-map position whose frontier *is* the root, the root carries an encounter like
any node, and the renderer's `@`-override + the "root is co-reachable" map
invariants are reconciled.

**Cost:** a run-start-flow change touching `NodeMap` (root is no longer special-
cased to inert), `MapScreen` (the initial frontier), and `Run`'s initial phase.
Rides S1's snapshot bump if it lands same-phase. **This interacts with encounter
selection** — once selectable, the root needs an encounter; until U/V exist it
just runs the old `rollEnemyWave` like any battle node, so S2 is safe to land
early. Re-baseline the fuzz (one more battle per run shifts win rates) —
**balance-neutral in intent**, measured at X.

**Headless tests:** the root is in the initial frontier; entering the root starts
a battle; the map still generates a connected DAG with the root as a normal
battle node; determinism.

**Decision points S2:** the start-position model — recommend a virtual
"pre-root" the frontier hangs off (cleanest), vs. seeding the root as visited and
making floor-1 the frontier (today's model, which is exactly what we're
removing). Does the root get the **boss**-style single-node treatment or the
normal battle kind (recommend normal battle)?

---

## Phase T — Sectors: the run container

Introduce the sector as the run's container — first as a structural wrapper around
the existing node-map, still feeding the **old** `rollEnemyWave`. This isolates
the sector swap from the encounter swap (U). **One `RunSnapshot` bump** (sector
state).

### T1 — The Sector schema + "The Start"

**Shape:** a `config/sectors.json` + `src/config/sectors.ts` (zod, mirroring
[layouts.ts](src/config/layouts.ts)). A sector has:
- `id`, `title`, `description`
- `length` (the sector's node-map hop — feeds `NodeMap.generate`'s `floorCount`)
- `theme` (the procedural-layout theme for the sector — reuses the `Theme` union)
- `layouts`: a list of `{ layoutId, minHop? }` — the sector's battlefield pool,
  each with an optional hop gate (the deferred M6 **hop-gated layout roll**).
  A reserved entry expresses "procedural" (the current `null` layout id).

Author **one** sector: **"The Start"**, `theme: default`, **all layouts** (every
`LAYOUT_ID` + procedural), ungated — reproducing today's uniform pool.

**Cost:** config + schema only; no behavior yet (T2 wires it in). Validation:
every `layoutId` exists; the hop-gated pool is non-empty at every reachable
hop (an editor + boot-time guard).

**Headless tests:** the schema parses; "The Start" round-trips; an unknown
`layoutId` or an all-gated hop is rejected.

**Decision points T1:** does the procedural "wildcard" live as a reserved
`layoutId` sentinel in the pool (recommend — uniform handling) or a separate
`proceduralWeight`? Is the layout pool **weighted** or uniform (recommend uniform
now, a `weight?` field as the seam)?

### T2 — Sector-selection DAG + the run as a sequence of sectors

**Shape:** the brief's sector-selection meta-DAG (plain JSON, per the brief).
`config/sector-map.json`: nodes, each holding a **list of sector ids**; edges; source
+ sink markers. The run:
- picks a random **source** node → a random sector from its list → generates that
  sector's node-map,
- on clearing the sector's terminal, picks a random **successor** node → its sector →
  a fresh node-map,
- **completes** at a **sink**.

Replace `Run.nodeMap` (one map at construction) with a **current-sector** model:
`currentSectorId` + the sector-DAG cursor + the active node-map, all persisted.
`Run.rollEncounterMap` ([Run.ts](src/run/Run.ts)) now rolls from the **current
sector's** hop-gated layout pool + theme instead of the global `rollLayoutId` /
`rollTheme`. **Combat is still `rollEnemyWave`** — only the board source changed.

Initial content: a **one-node, one-sector** sector-DAG (source == sink == "The
Start"), so the run is exactly one sector — today's structure, now expressed through
the general system.

**Cost:** the round's structural heart on the run side. `RunSnapshot` **bump #2**
(sector cursor + current node-map). The byte-continuity discipline of
`rollEncounterMap` (gotcha #49 — every branch draws the same RNG steps) must be
preserved as the pool source changes. Re-baseline the fuzz (the layout roll is now
sector-pool-scoped; identical for the all-layouts "The Start", so **expected
byte-identical** for the single-sector seed — a good canary).

**Headless tests:** the sector-DAG walk (source → sector → successor → sink) is
deterministic; a single-node DAG yields a one-sector run; clearing a sector's terminal
advances to a successor; a multi-node fixture DAG terminates at a sink; the
layout roll draws only from the current sector's hop-gated pool; "The Start"
reproduces the pre-T2 layout distribution byte-for-byte.

**Decision points T2:** does multi-sector progression carry the **player pool +
roster across sectors** (recommend yes — a sector is a chapter of one run, not a fresh
run)? Where does the **recruit/rest cadence** sit relative to sector boundaries
(recommend: sectors inherit the node-map's existing rest/boss kinds; a sector boundary
is just the terminal → next source, no special node)? Multi-sector is *built but not
populated* — only "The Start" ships.

### T3 — The sector editor + the layout-editor "add to sector" toggle

**Shape:** the brief's sector dev tooling.
- A **sector editor** at `tools/sector-editor/` (modeled on
  [archetype-editor](tools/archetype-editor/)): edit a sector's title / description
  / length / theme / layout-pool (with hop gates), live-validate against the
  real zod schema, Save via `/__save-config` (add `sectors.json` to the
  `SAVABLE_CONFIG_FILES` allowlist in [vite.config.ts](vite.config.ts)).
- The brief's **layout-editor toggle**: in [layout-editor](tools/layout-editor/),
  a control to **add the current layout to one or more sectors' pools** (writing the
  *sector* file, since the sector owns the edge — see *The data model*). Multi-select
  over sectors, optional hop gate per add.

**Cost:** dev-only `tools/` UIs + a one-line allowlist add; **never bundled into
`dist/`** (`apply: 'serve'`). Browser-verify the round-trip (edit → Save → reload
→ persisted). The sector-DAG selection schema stays **hand-edited JSON** for now
(brief) — no editor.

**Decision points T3:** does the layout-editor toggle also offer "create a new
sector from this layout," or only add-to-existing (recommend add-to-existing;
new-sector is the sector editor's job)?

---

## Phase U — The encounter model (pure logic) + the reproduction encounter

The keystone. Build the wave resolver + grammar sequencer as **pure functions**,
test them exhaustively headless, then wire them into `Run` behind a **single
reproduction encounter** that re-creates today's random swarm as closely as the
model allows. The round's main `RunSnapshot` bump + the **fuzz-baseline reset**
land here. **Headless-first throughout.**

### U1 — The wave resolver (budget / count / weight)

**Shape:** a pure `resolveWave(spec, context, rng) → UnitTemplate[]`
(`src/sim/encounters/wave.ts` or similar). A **wave spec**:
- `levelBudget`: `{ kind: 'fixed', value }` or `{ kind: 'mean'|'median', factor }`
  (× the player roster's mean/median level — `context` carries the roster).
- `count`: `{ kind: 'fixed', value }` or `{ kind: 'hand', factor }` (× hand size,
  `DECK.handSize`).
- `units`: a list of `{ archetype, count: fixed|weight, level: fixed|weight }`.

The resolution (the brief's worked example is the spec — encode it as a test):
1. **Count distribution.** Total count `C`. Subtract fixed counts; distribute the
   remainder across weight-count units in proportion to their weights. *Brief's
   example: `C=10`, catapult fixed 2 → remainder 8, bandit:archer = 3:1 → 6
   bandits, 2 archers.* If fixed counts exceed `C`, weight-count units resolve to
   **0** (allowed).
2. **Level distribution.** Total level budget `L`. Fixed-level types pin their
   instances; the remaining budget `L − Σ(fixed-level × count)` is spread across
   the weight-level instances in proportion to weight, each clamped to **≥ 1**
   (level must be positive — never 0). Reuse [distributeBudget](src/run/enemyBudget.ts)'s
   even-split-with-deterministic-remainder as the within-type primitive.
3. Build `scaledUnit(archetype, level)` per instance (the existing enemy
   constructor).

**Cost:** pure, no Run/snapshot touch — fully headless. Reuses
`distributeBudget` / `chooseSwarmCount` / `scaledUnit`.

**Headless tests:** the brief's exact example (2 catapults / 6 bandits / 2
archers); fixed-exceeds-budget → zeros; level budget spreads with all levels ≥ 1;
`mean`/`median`/`hand` factors read `context` correctly; a single deterministic
`rng` reproduces; weight ratios hold across budgets.

**Decision points U1:** **DESIGN ROUND NEEDED — the level-distribution
semantics.** The count rule is unambiguous (the brief's example pins it); the
*level* rule has a genuine choice: is the per-type weight applied **per instance**
or **per type-total**, and how does the remainder round? Lock the exact rule +
rounding with the user (it's pure-testable, but the *feel* — "how spiky are the
enemy levels?" — is best judged once the U3 reproduction and the V2 editor exist).
Recommend per-instance weighting with `distributeBudget`'s remainder rule, mirrored
from count for symmetry.

### U2 — The wave-list grammar + the sequencer

**Shape:** a pure `waveForTurn(waveList, turnIndex, rng) → spec` (advancing a
small cursor). The brief's grammar — each entry is one of:
- a **wave spec** (U1),
- a **weighted random-pick list** of `{ spec, weight }` (roll one when reached),
- a **loop block** `{ body: entry[], repeat: number | 'forever' }`.

Plus the finite-list terminal policy: when the list is finite (no `forever`) and
the encounter outlasts it, declare whether **the whole list loops** or **the last
wave repeats**.

Model it as a flat recursive resolver over the cursor — *not* a pre-expanded list
(a `forever` loop can't be expanded). The sequencer must always yield a wave for
any `turnIndex` (the encounter pool, not the list, decides when the fight ends).

**Cost:** pure, headless. Determinism: the per-pick roll consumes the per-turn
`battleRng` exactly where `rollEnemyWave` does today, so the draw site is
unchanged.

**Headless tests:** a flat sequence indexes per turn; a `forever` loop never
exhausts; a finite `repeat: N` runs N times then falls to the terminal policy;
whole-list-loop vs last-wave-repeat; a weighted pick is deterministic per seed and
honors weights over many seeds; nesting (a loop containing a pick) resolves.

**Decision points U2:** the cursor representation — recommend a small persisted
`{ entryPath, repeatCounts }` cursor over the literal grammar (so a mid-encounter
save resumes the same wave sequence), vs. re-deriving from `turnIndex` (simpler
but forbids non-deterministic picks resuming identically). **This is a snapshot
field** — decide before U3's bump.

### U3 — The Encounter schema + wiring + the reproduction encounter

**Shape:** a `config/encounters.json` + `src/config/encounters.ts` (zod). An
encounter:
- `id`, `name` (the brief — **replaces "Foe"** at [HUD.ts:558](src/ui/HUD.ts)),
- `healthPool` (replaces the global `HEALTH.enemyHealthMax` for this encounter),
- `sectors` (sector-id list — eligibility), `layouts?` (optional layout constraint),
  `minHop?` (the hop gate), `isBoss` (W),
- `waves` (the U2 wave list).

Wire it into `Run`: `beginEncounter` selects/holds the encounter (U3 ships a
**single** reproduction encounter — selection among many is V), seeds
`enemyHealth` from `encounter.healthPool`, and resets the wave cursor;
`beginTurn` replaces `rollEnemyWave(battleRng, team, encounterBudget)` with
`resolveWave(waveForTurn(encounter.waves, turnIndex, battleRng), context,
battleRng)`. Retire `encounterBudget` (the budget now lives in the wave spec).
Surface `encounter.name` in the HUD enemy pane.

The **reproduction encounter** ("the random one"): a `forever` loop of a single
wave whose `levelBudget = mean × DIFFICULTY.budgetFactor`, `count = hand ×
DIFFICULTY.swarmMaxMultiplier`, units `[{ bandit, weight 1−archerRatio }, {
ranged, weight archerRatio }]`, levels by the existing spread. It **will not be
byte-identical** to `rollEnemyWave` (different RNG structure) — that's expected and
*is* why balance is re-derived, not re-confirmed. Target: it should *feel* like
today's fights.

**Cost:** the main `RunSnapshot` **bump #3** (selected encounter id + wave cursor
+ per-encounter pool; `encounterBudget` removed). **No `WorldSnapshot` bump** (same
`BattleEncounter` out). **Fuzz baseline RESETS here** — flagged loudly; the band is
re-derived at X. Browser-verify the encounter name in the HUD + a faithful-feeling
reproduction fight. Keep `rollEnemyWave` only as long as S2/T still reference it,
then delete it (its primitives live on in U1).

**Headless tests:** the schema parses + round-trips; the reproduction encounter's
per-turn team matches the *intended* budget/count/archetype-split within tolerance
(a balance-proof test deriving the expectation from `DIFFICULTY` — never a
hardcoded roster); the per-encounter pool seeds `enemyHealth`; a mid-encounter
snapshot resumes the same wave sequence; determinism.

**Decision points U3:** the `context` the resolver reads (roster snapshot + hand
size — recommend the same inputs `playerTeamLevel` reads today, so the
reproduction tracks the current budget). Does `healthPool` support the `fixed | ×`
forms like budgets, or fixed-only now (recommend fixed-only — pools aren't
player-relative)?

---

## Phase V — Encounter selection + the encounter editor

Open the model to a catalog: select an encounter onto each battle node, and build
the authoring tool. No snapshot bump (selection reads existing state; the selected
id is already persisted from U3).

### V1 — Encounter selection at a battle node

**Shape:** `selectEncounter(catalog, { sectorId, hop, isBoss }, rng)` per *The
data model*. **The resolution ORDER is a deliberately pluggable strategy**
(user call — we don't yet know which feels better, and it should A/B with a config
flip): build it as **one keyed resolver**, config-selected, exactly like O3's
`focusTileResolution` switch — **NOT two hard-coded forks**. The two strategies:
- **`encounterFirst`** (the shipped default, user-chosen): filter by
  `sector ∈ e.sectors ∧ hop ≥ e.minHop ∧ e.isBoss === kind`, pick one, then
  roll the layout from `sector.layouts(hop-gated) ∩ (e.layouts ?? all)`. The
  encounter is the headline choice; the layout is guaranteed-compatible dressing.
- **`layoutFirst`** (built switchable, for the playtest A/B): roll the layout from
  `sector.layouts(hop-gated)` first, then pick an encounter additionally
  filtered by `layout ∈ (e.layouts ?? all)`. Geometry-led.

Replaces U3's hold-the-single-encounter with a real pick in `beginEncounter`. A
boot-time + editor guard ensures every (sector, reachable hop, kind) has ≥ 1
eligible encounter with a non-empty layout intersection under *either* strategy.

**The weighting seam (designed-in now, OUT OF SCOPE to populate):** the user
flagged that we'll likely want per-encounter selection **weights** later (to bias
which encounters appear, and to ramp difficulty with hop). Build the picker so
weights are a clean future addition — a `weight?` / `hopWeight?` field on the
encounter that the resolver reads, **defaulting to uniform** this round. Don't
author non-uniform weights yet; just don't design them out.

**Cost:** pure selection logic + the `beginEncounter` swap + the keyed-resolver
indirection (cheap — mirrors `focusTile.ts`). Re-baseline the fuzz (more than one
encounter now appears) — measured at X. The intersection-non-empty guard is the
new validation surface.

**Headless tests:** filtering honors sector/hop/boss; **both** resolution
strategies pick a valid (encounter, layout) pair from the same fixtures; an empty
candidate set throws loudly (caught by the guard, not at runtime); the layout
intersection is respected under each strategy; uniform selection is deterministic
per seed; a future non-uniform `weight` would be honored (a seam test).

**Decision points V1:** the **default** is `encounterFirst` (user-locked), both
strategies ship switchable for the A/B — confirm the config key + whether the
switch lives in `config/encounters.json` (a catalog-level setting) or a new
`config/selection.json`. The **weighting** shape is deferred-but-seamed (above) —
confirm the field name + that uniform ships first.

### V2 — The encounter editor

**Shape:** `tools/encounter-editor/` (modeled on the archetype editor) — author an
encounter's name / pool / sectors / layouts / hop gate / **wave list** with live
zod validation + a **resolution preview** (given a sample roster + hand size,
show the resolved teams for the first N turns, so the wave grammar is *feelable* —
the user's point #2 made concrete). Save via `/__save-config` (`encounters.json`
added to the allowlist). Ship a **small authored catalog** beyond the reproduction
encounter (a few hand-built encounters exercising sequences / picks / loops).

**Cost:** dev-only UI + a one-line allowlist add. The **resolution preview** is the
piece that makes wave grammars tunable without a full playtest — the editor *is*
the test surface for "feel." Browser-verify the round-trip + the preview against
the headless resolver (they must agree — share the pure resolver module, don't
re-implement it in the tool).

**Decision points V2:** the preview's sample roster — a fixed default, or
configurable in-tool (recommend configurable: mean/median level + hand size are
the knobs that move budgets)?

---

## Phase W — Boss encounters

**Shape:** the brief — "identical to regular encounters for now, but for the
terminal boss nodes; drop the hop gate." With U+V in place this is small:
encounters carry `isBoss`, selection already filters on node kind (V1), so W is
**authoring a boss encounter per sector** + confirming the boss node selects from the
`isBoss` pool (and that `minHop` is ignored/omitted for bosses). "The Start" gets
a boss encounter; the terminal node fights it.

**Cost:** mostly content + a small selection-filter confirmation. No new schema
(the `isBoss` flag shipped in U3). Re-baseline absorbs into X.

**Headless tests:** a boss node selects only `isBoss` encounters; a regular node
never selects a boss encounter; a boss encounter ignores `minHop`; determinism.

**Decision points W:** does every sector **require** ≥ 1 boss encounter (recommend
yes — a boot guard, since the terminal always fights)? Is the boss's
single-node/`@`-style treatment from G3 preserved (recommend yes — unchanged).

---

## Phase X — Balance re-derivation + per-encounter telemetry

The closer. The authored model replaced the random generator, so the band is
**re-derived from scratch** (not re-confirmed). **READ [BALANCE.md](BALANCE.md)
first** — the re-derivation follows the same broad→medium→heavy funnel, but the
*content itself* (the authored encounters) is now part of what's being tuned.

### X1 — Per-encounter fuzz/balance telemetry

**Shape:** extend the `tests/fuzz/` reporters (the `--per-layout` / `--per-floor`
model) with **per-encounter** rollups — win rate, turns, per-wave pool chips,
deaths, archetype mix — keyed by encounter id. Add `--encounter=<id>` (force-select
one encounter across every node, mirroring `--layout=<id>`) for clean per-encounter
samples. **Zero `src/` footprint** (all `tests/fuzz/` + `tools/`).

**Cost:** dev-only tooling, like every prior telemetry add. Extends `reporters.ts`
+ the sweep flag parsing.

**Headless tests:** the per-encounter rollup aggregates correctly; `--encounter`
forces selection; determinism unchanged (telemetry is observation-only).

### X2 — Re-derive the band + tune the launch content

**Shape:** with the reproduction encounter as the **anchor** (it should land near
today's band — a sanity check that the model is faithful), re-run the difficulty
funnel against the authored catalog. Tune via the encounter knobs the model now
exposes (per-wave budget/count, the wave sequence, the per-encounter pool) **and**
the global `difficulty.json` levers — but the encounter authoring is now the finer
instrument. Re-confirm the skill-gradient health metric (best-achievable vs
baselines). Fold in the long-open **archetype-balance** thread (the mercenary +
ranged duopoly) and the **hop-gated layout** difficulty curve, both of which the
encounter/sector model now makes tunable. Re-baseline the test + fuzz suites.

**Cost:** the heavy compute pass (`--jobs`, mind the `dwm.exe` leak — reboot before
heavy runs; `--jobs=1` immune). Decisions locked **with the user** per the BALANCE
protocol.

**Decision points X2:** the band target (re-confirm the "winnable-but-losable"
~2/3 with a steep gradient, or re-aim now that encounters can be *designed* to be
easy/hard rather than uniformly random?); how much archetype rebalancing to fold in
vs. defer; the hop-difficulty curve shape.

---

## Cleanup / chores (land any time; several pair with this round)

- **M6 hop-gated layout roll** ([TODO.md](TODO.md)) — **resolved structurally by
  this round** (Sector.layouts hop gates in T1 + encounter selection in V1); the
  *tuning* of the curve folds into X2.
- **Layout-difficulty telemetry** ([BALANCE.md](BALANCE.md)) — feeds X1/X2 as a
  prior (chokepoint ≈ 85% vs open ≈ 45% wave-win).
- **Archetype display-label + ability display-name/description pass**
  ([TODO.md](TODO.md)) — the encounter editor surfaces archetype + ability names;
  a natural moment to fold in the display-metadata layer. Optional, cosmetic.
- **Dedicated catapult SFX** ([TODO.md](TODO.md)) — still pending, unrelated; land
  whenever.
- **`RNG` stat-label vs `rng` reach ambiguity** ([TODO.md](TODO.md)) — cosmetic,
  unrelated.
- **N4 overnight out-of-sample verify** — still **deferred to a VPS** (the
  `dwm.exe` leak); the X2 re-derivation is the natural time to finally run it (add
  `--seed-offset` for the config-overfit holdout).

---

## What we're explicitly NOT doing yet

**Carried deferrals (the brief re-confirms all of these):**
- **The other two anti-blob ideas** — **side-objectives** scattered across the map
  and **dynamic terrain** that breaks up blobs. Explicitly deferred *again* in
  favor of this round; they wait until the encounter system has given us the
  combat-scenario coverage the user wants first.
- **A full event system for non-combat nodes** + **currency / shop nodes** — the
  brief defers both again. The node map keeps battle/rest/boss.
- **Starting profiles** — deferred again.
- **The rarity system** — deferred again (the P1 `unit-card--rarity-*` seam waits).
- **Smarter enemy objective AI** — O1 left the enemy team full objective *support*
  (inert `atWill`); enemy objective *strategies* could now hang off encounters,
  but that's a future round (the encounters this round author *teams + waves*, not
  enemy steering).
- **More than one sector's worth of content** — the *system* is built for N sectors
  (the user's eventual three), but only "The Start" ships.
- **A difficulty-level system** (Q1's per-speed enable + the focus-tile switch are
  the groundwork) — still future.
- **Enemy-archetype diversification beyond bandit/ranged** — the encounter model
  *enables* any archetype in a wave (rogue/healer/mage/catapult enemies become a
  content decision), but populating a diverse roster of enemy encounters is X2/
  future content, not a Phase goal.
- **The turn-cap "deeper resolution" system** ([TODO.md](TODO.md)) — the
  draw-at-cap chip rule stands; revisit with playtest data.
- **Save/load UI, replay UI, touch controls, in-game keybinding rebind** — all
  still future niceties.
- **Object-pooling the sim's hot allocators** ([TODO.md](TODO.md)) — parked.
