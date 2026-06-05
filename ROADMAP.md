# ROADMAP — Post-F

The build order after Phase F (combat polish + the Phase-E playtest
response) landed. Companion to [DESIGN.md](DESIGN.md),
[ARCHITECTURE.md](ARCHITECTURE.md), [TODO.md](TODO.md), and the prior
roadmaps now in the archive:
[archive/mvp-roadmap.md](archive/mvp-roadmap.md),
[archive/post-mvp-roadmap.md](archive/post-mvp-roadmap.md),
[archive/post-c1-roadmap.md](archive/post-c1-roadmap.md),
[archive/post-d-roadmap.md](archive/post-d-roadmap.md), and
[archive/post-e-roadmap.md](archive/post-e-roadmap.md) (the immediately
preceding roadmap this one supersedes).

Synthesized from [archive/phase-g-details.md](archive/phase-g-details.md)
(the user's Phase-G design brief), the residual Phase-G content of the
post-E roadmap, and [TODO.md](TODO.md). Once you've read this,
`phase-g-details.md` is fully absorbed and lives in the archive purely as
a historical artifact.

## Where this came from

Phase F delivered the combat-polish cluster the post-E roadmap laid out:
the draft-pool pull-forward (F1), the **action phase system** (F2) and
its first consumers — projectile/impact re-timing (F3), rogue gambit
sequencing (F4) — plus the heal-feedback VFX (F5) and the heal/utility
XP ledger (F6). All landed; see [HANDOFF.md](HANDOFF.md) for the full
per-step breakdown — treat it as the source of truth for *what shipped*,
this doc for *what's next*.

Phase G turns the lens from **individual battles to run progression.**
The user's brief lays out five threads — a sustainable **enemy-level
budget** (replacing the linear per-floor ramp), **longer maps** with a
proper full-screen map scene, **non-combat node types** (rest / boss),
a trial of **multi-turn "deckbuilder" battles** (player + encounter
health pools, a card-drawn hand, a new `power` stat), and the
**testing/tooling** to keep all of that playtestable without grinding a
15-minute run by hand. This roadmap sequences those into **Phase G**
(G1–G5 — the run-progression structure) and **Phase H** (H1–H6 — the
multi-turn trial).

### Supersession note (old Phase G → new Phases G & H)

The post-E roadmap's Phase G was a placeholder carried verbatim from the
post-D roadmap. The brief reshapes it; the mapping:

- **old G4 (split battles + meta-health)** → **new Phase H (multi-turn
  battles)**, promoted from speculative to its own phase now that the user
  has a concrete scheme to trial (it's phase-sized — see Phase H).
- **old G3 (multi-map / longer runs)** → **new G2 (longer *single*
  map)**. True multi-map / "Regions" + the D8 theme-per-map migration
  stay deferred (see *What we're NOT doing yet*).
- **old G1 (recruitment rarity + enemy diversity)** → the recruit model
  is replaced by **G4** (level = avg-team-level + exponential bonus) and
  **Phase H** (a pass / no-recruit option); **enemy-archetype diversification
  is explicitly deferred** by the brief ("keep enemies as just melee and
  archers"), and **rarity tiers** are parked until the budget + card
  systems stabilize.
- **old G2 (in-battle commands)** → parked. The Phase H card-draw *is* the new
  steering layer; revisit tactical commands only if cards prove
  insufficient.

No code or ARCHITECTURE.md text references roadmap phases by letter, so
there is nothing else to renumber.

## Sequencing rationale

The brief lists testing last; this roadmap pulls the **run-config
foundation forward to G1**. Reason: G2 makes a run ten floors deep, so
*without* a way to launch a 1–2 floor run (or a single forced layout)
headlessly and in-browser, every subsequent step's playtest becomes the
15-minute grind the brief is explicitly trying to avoid. G1 is the
F1-style unblocker. It also supplies the configurable `floorCount` that
G2 needs anyway. The run-structure *fuzz-strategy* work and the GUI
launcher stay at the back of Phase G (G5); the multi-turn-specific tooling
+ the full balance sweep land with the trial they test (Phase H, H6).

**Phase G** is the run-progression *structure*: the **run layer** (G1
config, G2 maps, G3 node types — all touching `NodeMap` + `MapScreen` +
`Run`'s node-resolution), the **enemy-balance** rebuild (G4), and the
**run-structure tooling** (G5). **Phase H** is the multi-turn battle trial
(H1–H6) — the experimental work, isolated so a reshape after Phase G
playtest doesn't renumber the structural steps. The one cross-phase seam
to hold in mind: G4 introduces a single `playerTeamLevel()` function that
**Phase H (H5)** swaps from "roster total" to "expected hand total" —
build it as a seam from day one so the swap is a one-function edit, not a
balance rewrite.

Nothing in G2–G5 is hard-gated on a strict order, but the recommended path
is G1 → G2 → G3 → G4 → G5, then the **Phase GP** playtest-response cluster
(GP1 → GP5 — the Phase-G playtest fixes, see below), then Phase H
(H1 → … → H6). GP lands *before* Phase H deliberately: defense, mobility,
and the healer/ranged AI all move per-turn survivor counts, which is exactly
what Phase H's health pools chip on — so H's balance sweep (H6) should run
against the post-GP combat model, and GP's stat + card plumbing is what H1
(`power` stat) and H6 (recruit/pass UI) build on.

## Conventions

Same shape as the prior roadmaps:

- **Commit per logical change**, not per session.
- **Pause between commits on multi-commit features** for the user's
  manual playtest run (the Phase-E/F cadence — keep it). Phase H especially.
- **Surface tradeoffs** before non-obvious calls; stop at "Decision
  points."
- **Headless-first for sim/run/core/config changes** — write a vitest
  test before reaching for the browser preview. Almost all of G1, G3
  (resolution), G4, and the Phase H sim layers are headless-testable; the
  map-scene rewrite (G2) and any new battle UI (Phase H) are the
  eyeball-verified surfaces.
- **Browser-verify render changes** and only claim "verified" with
  concrete output (the verify-before-claiming + browser-verify-render
  discipline). **Note:** the new node icons (X / Z / !) live in the
  **DOM `MapScreen`**, not the 3D `FontAtlas` — they're CSS text, so
  they need *no* `glyphs.ts` entry. Any genuinely new 3D glyph still
  does, and [FontAtlas.test.ts](src/render/FontAtlas.test.ts) guards it.
- **Hoist numbers to config from day one** (A4 pattern). Phases G + H add a
  lot of knobs — enemy-budget deltas, map dimensions, rest-XP, health
  pools, `power` growth, hand size, recruit-bonus exponent. Land them in
  `config/*.json` (or isolated render consts for pure-VFX values), never
  hardcoded.
- **Balance-proof tests derive from the config module** the production
  code reads — never hardcode the balance arithmetic (a JSON tweak should
  be a one-file edit, not test churn). Mechanic/primitive tests use
  explicit literals and never read the shipped JSON.
- **Keep DESIGN.md / ARCHITECTURE.md honest** — update docs in the same
  commit as the code that invalidates them.

"Decision points" flag user-input moments (naming, design tradeoffs,
balance knobs). Stop and ask.

---

## Phase F — Combat polish & playtest response ✅ complete

F1 (draft-pool pull-forward) → F2 (action phase system + `findUnit` Map
index) → F3 (projectile/impact re-timing) → F4 (rogue gambit
sequencing) → F5 (heal feedback VFX) → F6 (heal/utility XP ledger). All
landed; 514 tests, fuzz smoke 7/7. Full breakdown in
[HANDOFF.md](HANDOFF.md).

Two seams Phase F leaves for Phase G:
- **The phase timeline** ([Action.ts](src/sim/Action.ts)) is now the
  substrate for any multi-phase action — G3's rest "action" and any Phase H
  wave-resolution effects ride it instead of inventing new event types.
- **The recruit pool holds all six archetypes** (F1), so any change
  touching a *recruitable* archetype's XP/behavior shifts the fuzz
  baseline — expected, not a regression; verify via stash+diff.

---

## Phase G — Run progression structure

Run-level depth: a sustainable difficulty curve, longer and more legible
maps, node variety, and the tooling to playtest it all. The multi-turn
battle trial this sets up is its own **Phase H** below (it grew
phase-sized).

### G1 — Run configuration & short-run harness (foundation + unblocker)

The playtest-velocity unblocker, pulled forward (see *Sequencing
rationale*). Today a run's floor count is hardcoded in
[config/nodemap.json](config/nodemap.json) (`floorCount: 5`, read into
`FLOOR_COUNT` in [NodeMap.ts](src/run/NodeMap.ts)); there is no
`RunConfig`, and the only dev override is the `?roster=` flag parsed in
[Game.ts](src/Game.ts) (`DEV_ROSTER_ARCHETYPES`). G1 generalizes that
into a single configurable entry point for *short* runs and *specific*
layouts, headless and in-browser.

**Shape:**
- New `RunConfig` (`{ seed?, floorCount?, startingRoster?,
  forcedLayoutId?, mapMaxWidth? }`) consumed by `Run` construction and
  threaded into `NodeMap.generate(rng, config?)`. `config/nodemap.json`
  and `config/recruitment.json` stay the **defaults**; `RunConfig`
  overrides per-run. A `floorCount: 1` run is now expressible.
- One `parseRunConfigFromURL()` (extending the `?roster=` parser) used
  by **both** [Game.ts](src/Game.ts) (browser) and the headless paths —
  single source of truth, so a browser launch URL and a headless run
  describe the same run.
- CLI tool under `tools/run-config/` (dev-only, same posture as
  `tools/layout-editor/` — served by Vite, never in `dist/`): takes
  flags (`--floors`, `--seed`, `--roster`, `--layout`) and prints the
  launch URL **and** can drive a headless run to completion for a quick
  sanity pass. The **GUI wrapper** the brief wants is deferred to **G5**
  (it pairs naturally with the fuzz tooling there).
- The fuzz harness ([tests/fuzz/harness.ts](tests/fuzz/harness.ts))
  accepts a `RunConfig` so a sweep can target a 1-floor run or a forced
  layout.

**Cost / blast radius:**
- `RunConfig` threads through `Run` + `NodeMap.generate`. **Do not
  persist it in the snapshot yet** — it's a run *input*, fully
  reconstructable; persisting it is a save/load concern, deferred.
  **No snapshot bump.**
- Default behavior (no config) must be byte-identical to today — the
  RNG draw sequence cannot move for the default path. Pin this.

**Headless tests:**
- `NodeMap.generate` at `floorCount` 1, 2, default → valid DAGs
  (reachable + co-reachable, invariants hold).
- `parseRunConfigFromURL` round-trips a config string.
- A forced `RunConfig` (1 floor, fixed seed, fixed layout) drives a full
  headless run that resolves deterministically.
- **Default-path determinism:** a `Run` built with no `RunConfig`
  produces the identical nodeMap + draw sequence as pre-G1.

**Decision points G1:**
- **Config surface.** URL params + CLI flags now; a config *file* is
  unnecessary (recommend not adding one). Confirm the param names.
- **Persist `RunConfig` in the snapshot?** Recommend **no** until
  save/load is real — it's reconstructable from the seed. Revisit when
  long runs (G2) + run-loss (Phase H) make save matter.

### G2 — Longer maps & full-screen map scene

Bigger, more legible run maps, and a map-select scene that fills the
screen instead of hugging a strip.

**Shape — generator** ([NodeMap.ts](src/run/NodeMap.ts) +
[config/nodemap.json](config/nodemap.json)):
- `floorCount` 5 → **11** (spawn/root at floor 0 + ten levels — confirm
  the off-by-one against the existing root/terminal convention before
  committing). `middleWidthMax` 3 → **6**. `maxOutDegree` 2 → **3** ("no
  node has more than three successors"). `targetTotalMax` (10) was a
  *small-map* tightening — raise it to fit an 11-floor board (~40–50
  nodes) or drop the cap.
- **No crossing edges.** This is the algorithmic core. The current
  generator picks children "uniformly" with an orphan backfill and has
  **no planarity constraint**; [MapScreen.ts](src/ui/MapScreen.ts)
  already positions nodes by a fractional x-slot per floor, so the order
  exists in *rendering* but the generator doesn't respect it. Recommended
  provably-non-crossing construction: give each floor's nodes integer
  x-slots; connect floor *i* (sorted by x) to floor *i+1* (sorted by x)
  with a **monotonic, contiguous** assignment — each parent links to a
  contiguous run of children, and adjacent parents' runs may share a
  boundary child but never invert. Planar by construction. Then enforce
  connectivity (every child ≥1 parent; every node reaches the terminal)
  and `out-degree ≤ 3` as post-passes. A **crossing-checker** is the
  headless guard (see tests).

**Shape — scene** ([MapScreen.ts](src/ui/MapScreen.ts) +
[MapScene.ts](src/scenes/MapScene.ts) + `ui.css`):
- The brief reports the map screen as "a gray screen with the map on a
  thin strip on the right." `MapScreen` is *already* pure DOM/CSS (no 3D
  background) — so the gray is most likely **the cleared WebGL battle
  canvas showing through** behind a width-constrained map container.
  **First task: confirm the source** (is the `#game-canvas` still visible
  under the map phase? is the map container column-constrained?), then
  fix it: hide/clear the battle canvas on non-battle scenes and rebuild
  the map container as a **full-viewport CSS layout**. The wider/taller
  10-floor DAG needs the real estate anyway, which reinforces the
  rewrite. Scroll if the board exceeds the viewport.

**Cost / blast radius:**
- Generator changes shift the run RNG draw sequence → **fuzz +
  determinism baseline reset** (one-time, like F1). Re-run `npm run
  fuzz`. Bundle this reset with **G3** if they land close together so
  it's one reset, not two.
- `RunSnapshot` stores `nodeMap` whole — a bigger map just serializes
  bigger; the *shape* is unchanged, so **no schema bump**.
- The map scene is render — eyeball-verified per [TESTING.md](TESTING.md).

**Headless tests:**
- Generator invariants at the new dimensions: `floorCount`, width ≤ 6,
  out-degree ≤ 3, exactly one root + one terminal.
- **No-crossing checker:** for every pair of edges, assert they don't
  geometrically cross given the per-floor x-ordering. This both pins the
  property and documents it.
- Connectivity: every node reachable from root **and** co-reachable to
  the terminal, across a wide seed sample.
- Determinism per seed.

**Decision points G2:**
- **Floor semantics.** "Ten levels plus spawn" — confirm `floorCount`
  counts the root (→ 11) vs. ten *battle* floors plus an implicit root.
- **Planarity method.** Recommend the monotonic-contiguous construction
  above (planar by construction beats generate-then-reject). Flag if you
  hit a variety-vs-planarity tension (too-rigid connections make every
  map look the same).
- **Map-scene camera.** A 10-deep map likely overflows vertically —
  scroll vs. scale-to-fit. Recommend scroll with the current node
  centered.

### G3 — Node types: plumbing + rest & boss + icons

The minimal node-type system: the plumbing plus two example kinds. A
full event system is **out of scope** (brief) — this is the substrate it
will later plug into.

**Shape — node kind** ([NodeMap.ts](src/run/NodeMap.ts)):
- `MapNode.kind` is already a field (currently the lone value
  `'battle'`). Widen the union to `'battle' | 'rest' | 'boss'` (closed
  union, A4 discipline). Generator: the **terminal** node → `'boss'`;
  scatter `'rest'` **infrequently** among middle floors (config:
  rest frequency + a minimum-spacing rule so two rests don't cluster).
  The root stays the spawn `@`, not a resolvable kind.

**Shape — node resolution** ([Run.ts](src/run/Run.ts) `handleEnterNode`):
- `handleEnterNode` currently always builds a `BattleEncounter`. Dispatch
  on `kind`:
  - `battle` / `boss` → battle encounter as today. **Boss is a regular
    fight for now** (brief) — tag it so future mechanics have a hook; no
    new combat behavior in G3.
  - `rest` → a **non-combat resolution**: grant a flat `restXp` (default
    **200**, config knob) to *every* player roster slot, then advance to
    the map. **Reuse the existing XP pipeline:** synthesize `XpAward`s of
    +200 per `rosterIndex` and feed `bankXpAwards` — that already bumps
    levels, builds `PromotionInfo[]`, and routes through `PromotionScene`
    (a rest can legitimately trigger promotions). Clean reuse, no parallel
    leveling path. **Phase H forward ref:** once the player health pool
    exists, a rest *also* heals it by `restHealAmount` (default 5) — added
    in H6 (the pool isn't born until H4).

**Shape — icons** ([MapScreen.ts](src/ui/MapScreen.ts)):
- Replace the numeric node label (`isRoot ? '@' : String(node.id)`) with
  a **kind → glyph** map: combat `X`, rest `Z`, boss `!`, root `@`. DOM
  text — no `FontAtlas` / `glyphs.ts` involvement. The brief wants
  route-planning legibility; the icon *is* the affordance.

**Cost / blast radius:**
- Widening `MapNode.kind` is shape-compatible (string field already
  serialized); old saves with only `'battle'` still load.
- Adding rest nodes shifts the generator's RNG draws → baseline reset
  (bundle with G2's reset).
- Rest resolution is a small new branch in `Run`; reusing `bankXpAwards`
  keeps it tiny. No snapshot bump beyond G2's (none).

**Headless tests:**
- Generator: exactly one `boss` (the terminal); rest nodes obey the
  frequency + spacing rule; all kinds reachable.
- Rest resolution: entering a `rest` node grants `restXp × rosterSize`,
  banks it, produces the right `PromotionInfo`, and advances **without**
  a battle (derive the XP from `LEVELING`/the rest knob, never hardcode).
- Boss node builds a normal battle encounter (regression-equivalent to a
  battle node).
- Icon mapping is render — eyeball-verified.

**Decision points G3:**
- **Rest placement rule.** Frequency + min-spacing knobs — recommend
  "~1 per N floors, never adjacent, never on the first or last floor."
  Tune by feel.
- **Does a rest trigger `PromotionScene`?** Recommend **yes** (reuse the
  XP pipeline; a level-up from resting is satisfying).
- **Rest as a distinct `RunPhase`?** Recommend **no** — resolve inline
  (bank XP → existing promotion/advance path). A distinct phase only
  earns its keep once rests have an interactive screen (future event
  system).

### G4 — Enemy level-budget balance + recruit leveling

Replace the linear `enemyLevelForFloor` ramp (which assumes the player
levels linearly — they don't) with a **team-level budget**, and re-base
recruit levels on the team average. Independent of the map work; this is
where the **Phase H seam** is born.

**Shape — enemy budget** ([Run.ts](src/run/Run.ts) `rollEnemyTeam` +
[config/difficulty.json](config/difficulty.json)):
- New `playerTeamLevel(team)` **— the seam.** For now it returns the
  **sum of roster unit levels** (single-battle model). **Phase H (H5)
  swaps this** to `avgLevel × min(rosterSize, handSize)`. Document the seam
  loudly at the definition site so the H5 swap is a one-function edit.
- New knobs: `totalLevelDelta` (enemy total = `playerTeamLevel −
  totalLevelDelta`), `unitLevelDelta` (per-enemy cap above the player's
  highest unit). Re-purpose / keep `enemySizeDelta` as the **upper-bound**
  driver (count up to `2 × playerSize`).
- Algorithm (`rollEnemyTeam`, now genuinely consuming `battleRng`):
  1. `budget = max(minBudget, playerTeamLevel − totalLevelDelta)`
  2. `cap = highestPlayerUnitLevel + unitLevelDelta`
  3. `minCount = ceil(budget / cap)`, `maxCount = 2 × playerSize`
  4. choose `count ∈ [minCount, maxCount]`, **biased toward `maxCount`**
     ("on average we want to be mowing down swarms of weaker units")
  5. distribute `budget` across `count` units **roughly equally**
     (≈ `budget/count` each, jittered), each `≥ 1`, none `> cap`
  6. archetype per unit: **melee/ranged 60/40, unchanged** (brief: keep
     enemies melee + archers only)
  7. build via the existing deterministic `scaledUnit(archetype, level)`.
- **Spawn-queue transition.** Up to `2 × playerSize` enemies on a fixed
  board may exceed the spawn region → they overflow onto
  `world.spawnQueues` via the existing `spawnTeam` → `queueUnit` →
  `runOverflowScan` (D5). This is the brief's "transition us to the
  spawn queue system." Verify the queue-aware battle-end check handles a
  large queued enemy team (it already accounts for queued units).

**Shape — recruit leveling** ([Recruitment.ts](src/run/Recruitment.ts) +
`Run.advancePastBattle` + [config/recruitment.json](config/recruitment.json)):
- Today a recruit comes in at `currentFloor` simulated level-ups. Change
  to: **level = round(avgTeamLevel) + bonus**, where `bonus` is an
  **exponential draw** (50% +0, 25% +1, 12.5% +2, … ; base/decay is a
  config knob `recruitBonusExponent`). New `recruitLevelBonus(rng,
  exponent)`; feed the resulting level into the existing
  `simulateLevelUps` stat-build path.

**Cost / blast radius:**
- `rollEnemyTeam` now draws from `battleRng` (it was deterministic) and
  recruit leveling draws from `levelupRng`/`rng` → **fuzz + determinism
  baseline reset.** Expected.
- Levels/templates are existing fields → **no snapshot bump.**
- `config/difficulty.json` + `config/recruitment.json` gain knobs.

**Headless tests** (all balance-proof — derive from the config modules):
- Enemy total level ≈ `budget` (= `playerTeamLevel − totalLevelDelta`)
  within rounding; **no** enemy exceeds `cap`; `count ∈ [minCount,
  2×size]`; `count == minCount` at the high-budget edge; per-unit levels
  roughly equal (variance bound).
- **Swarm bias:** average `count` trends toward `maxCount` across seeds.
- Recruit level == `round(avgTeamLevel) + bonus`; the bonus distribution
  over a wide sample matches ≈ 50/25/12.5 within tolerance.
- Spawn-queue: a `2×`-size enemy team that exceeds the region gets
  queued and **all** units eventually spawn; the battle doesn't
  false-end while units are queued.
- Determinism per seed.

**Decision points G4:**
- **Count selection within `[minCount, maxCount]`.** Recommend a
  high-skewed draw (or `maxCount` outright) for the swarm feel, exposed
  as a knob (`swarmBias`).
- **`minBudget` floor** so the enemy total can't drop below 1 on floor 1
  (where `playerTeamLevel − totalLevelDelta` may go negative).
- **Rounding of `avgTeamLevel`** for recruits (round vs floor).
- **The `playerTeamLevel` seam** is the single most important
  extensibility point in Phase G — keep it a one-line function.

### G5 — Fuzz tooling & GUI launcher (run-structure)

The run-structure-testable slice of the original tooling step. It needs
G1 (run-config) + G3 (node kinds) but **not** the multi-turn battle model,
so it closes out Phase G; the multi-turn-specific tooling + the full
long-run balance sweep move to **Phase H (H6)**.

**Shape — fuzz strategies** ([tests/fuzz/](tests/fuzz)):
- The `FuzzStrategy` interface decides `pickNextNode` + `pickRecruit`.
  Refactor toward a **parameterized strategy factory** rather than N
  copy-pasted classes (clarity/extensibility): one recruit-priority
  strategy parameterized by archetype, one by stat; one path strategy
  parameterized by the node-kind it maximizes. The Phase-G slice of the
  brief's menu:
  - recruit-priority **per archetype** (6),
  - recruit-priority **per stat** (the 7 base stats; `power` waits for H1),
  - path strategies that **maximize each node type** (combat / rest).
- All must handle the wider recruit pool (already generic post-F1). The
  **pass-option** and **`power`-stat** strategy variants are deferred to
  **H6** (they need Phase H's pass choice + `power` stat).

**Shape — GUI launcher** (`tools/run-config/`):
- The GUI wrapper over G1's CLI the brief wants "for me": a small dev-only
  HTML page (sibling of the layout editor) to pick
  floors/roster/layout/seed and get a launch link — so an eyeball test is
  a click, not a hand-typed URL. (The health-pool knobs get added in H6.)

**Decision points G5:**
- **Strategy parameterization granularity.** Recommend factories over
  explicit subclasses (one file, data-driven), matching the config-derived
  ethos.

---

## Phase GP — Combat & stat-legibility playtest response (pre-H) ✅ complete

Synthesized from the Phase-G playtest cluster: movement / attack-speed
legibility, two healer-positioning bugs, ranged units backing off near-kills,
and the missing defense stat. Structurally the twin of Phase F (the Phase-E
playtest response) — a focused correctness/legibility pass that lands
**before Phase H** (see *Sequencing rationale*). Five commits, **playtest
pause between each** (the Phase-E/F/G cadence). **Phase H's letter is left
untouched** — the `playerTeamLevel` seam + the H1/H5/H6 references stay valid.

**User decisions locked (the design round that produced this section):**
- **Defense formula = subtractive with floor** (`max(minDamage, raw − defense)`),
  not diminishing-returns. Intuitive + reads well on a card; the floor +
  modest defense values keep chip/AoE from being fully negated (watch the
  mage ring — GP2).
- **Attack-speed stat `speed` → `agility`** (alongside `endurance → mobility`),
  so the two cadence stats don't both read as "movement."
- **Healer choke fix = a yield rule**, *not* a rear-bias anchor — healers
  frequently spawn at the **front** in labyrinth / strafing-corridor layouts,
  so there's no rear to bias toward (it's partly a maps problem too).
- **Run the full cluster before Phase H.**

### GP1 — `endurance → mobility` rename + universal move base (#1)

**Shape:**
- Rename `endurance → mobility` AND `speed → agility` across `UnitStats`,
  [archetypes.json](config/archetypes.json) (`baseStats` + `growthRates`),
  the zod schema ([archetypes.ts](src/config/archetypes.ts)),
  [leveling.ts](src/sim/leveling.ts), [stats.ts](src/sim/stats.ts)
  (`cooldownScale` callers + `ZERO_STATS`), the
  [PromotionScreen](src/ui/PromotionScreen.ts) label map (`END`→`MOB`,
  `SPD`→`AGI`), and every test fixture. `mobility` drives the move cooldown,
  `agility` the per-ability attack cadence.
- **Split the shared cooldown rate into per-axis knobs.** Today both axes go
  through one `cooldownScale(stat)` ([stats.ts:177-179](src/sim/stats.ts))
  reading the single `STATS.cdPerStat` (0.05) + `STATS.minCdScale` (0.4) — fine
  while both stats were positive-only, but wrong once `mobility` swings wide
  and negative (catapult) while `agility` stays a gentle multiplier on the
  already-authored ability cadences (1.2–3.0s). Split into
  **`mobilityCdPerStat`** + **`agilityCdPerStat`** ([stats.json](config/stats.json)),
  parameterizing `cooldownScale(stat, perStat, minScale)` and threading the
  right knob from each of the two call sites. Default both to `0.05` so the
  split itself is behaviour-preserving; the GP1 re-tune then moves them
  **independently** (mobility likely wants a steeper rate so negative values
  stay small). Likewise split **`minCdScale`** per axis (the fast-side cap) for
  full independence — see decision point.
- **Drop the per-archetype `baseMoveCooldownSeconds` override** (only the
  catapult uses it, `2.5`). One universal `STATS.baseMoveCooldownSeconds`;
  slow units now come from **low/negative mobility** — the `minCdScale` floor
  only caps the *fast* side, so `moveCooldownScale(mobility) = max(mobilityMinCdScale,
  1 − mobility×mobilityCdPerStat)` is unbounded on the slow side.
- **Re-tune the two rates + per-archetype mobility values** so the numbers
  read human — with a steeper `mobilityCdPerStat`, a heavy unit lands around
  mobility `−4…−8`, not `−20`. Keep `mobility 0 ≈ the 1.0s baseline`; `agility`
  stays the gentler dial on ability cadences.

**Cost:** WorldSnapshot bump (two stat keys renamed; old throws). Fuzz /
determinism outcome baseline shifts (re-tuned cadences) — regenerate the
untracked `tests/fuzz/output/*`. No render surface beyond GP3's card.

**Headless tests:** `deriveStats` move-CD from `mobility` (incl. negative →
scale > 1 → slower) resolves the **mobility** rate; `attackCooldownTicksFor`
reads `agility` and resolves the **agility** rate (a test pinning that the two
axes can diverge guards the split); the catapult's ~2.0s walk reproduced under
the universal base + its mobility value; balance-proof off `STATS` /
`archetypes`.

**Decision points GP1:** final per-archetype mobility/agility values + the two
`*CdPerStat` rates (by feel); **whether to split `minCdScale` per axis too**
(recommend yes — once the rates are independent, a shared fast-side cap is an
odd half-measure; cheap to split alongside); whether mobility should floor at
some max-slow scale (recommend no — leave it open, tune values instead).

### GP2 — Defense stat + damage-application consolidation (#7)

**Two commits:**
1. **Consolidate** the four combat-damage sites — [AttackAction](src/sim/actions/AttackAction.ts),
   [GambitStrikeAction](src/sim/actions/GambitStrikeAction.ts),
   [MagicBoltAction](src/sim/actions/MagicBoltAction.ts),
   [CatapultShotAction](src/sim/actions/CatapultShotAction.ts) — into one
   `world.applyDamage(attackerId, target, rawDamage, { crit })` chokepoint
   (the single home for `currentHp -=`, `recordDamage`, and the
   `unit:attacked` emit). **Pure refactor, byte-identical fuzz** (no formula
   yet).
2. **Add `defense`** to `UnitStats` (+ `growthRates`: melee tanky, archers /
   casters / rogue thin) and mitigate in that one place:
   **`final = max(minDamage, raw − defense)`** (`minDamage` knob, default 1),
   applied to the *post-crit, post-cover* number. **Environmental damage
   (fire / chasm, [World.ts](src/sim/World.ts) `applyTileEffects`) stays
   UNMITIGATED.** Card gets a `DEF` row (GP3).

**Cost:** WorldSnapshot bump (new stat key — can share GP1's bump if landed
the same session). Fuzz baseline shifts. Balance mini-sweep via G1's
short-run harness + G5's fuzz tooling.

**Watch (the subtractive caveat):** the mage AoE ring is `round(magic × 0.5)`
— keep defense values modest and the min-damage floor honest so chip/AoE
isn't gutted. Re-confirm in the H6 long-run sweep.

**Headless tests (balance-proof):** `final == max(floor, raw − def)`; floor
honored; crit/cover applied before mitigation; environmental damage
unmitigated; the consolidation is behaviour-preserving at `defense 0`;
snapshot round-trip.

**Decision points GP2:** per-archetype defense growth; `minDamage` floor;
whether near-immunity at the high defense end feels acceptable (subtractive
can hard-counter a low-damage attacker — watch in the sweep).

### GP3 — Card legibility overhaul (#2 + #3) ✅ shipped

**✅ Shipped** — recruit card → a raw **8-stat block** (CON/STR/RNG/MAG/LCK/AGI/MOB/DEF)
+ a per-ability list (name + `N dmg/heal · rng R` + AoE tag + cadence); HUD → a light
`DEF · MOB · AGI` per-row line. An independent playtester pivoted the card's top block
from the originally-planned *derived* summary (HP/DEF/CRIT + move line) to the raw stats.
Render-only, no snapshot bump. Full record in the HANDOFF GP3 entry. (The spec below is
the as-designed shape, kept for reference.)

**Shape** ([RecruitScreen](src/ui/RecruitScreen.ts) + [HUD](src/ui/HUD.ts) +
`ui.css`):
- **List the unit's abilities** — name + base cadence (s) + range + an AoE tag
  — instead of the single primary `ATK` number ([RecruitScreen.ts:100-106](src/ui/RecruitScreen.ts)
  only shows the primary today). Sourced from [abilities.json](config/abilities.json)
  via the archetype's ability ids. This self-documents *what the unit does*
  (Heal / Strike / Bolt), the real legibility win. Design the list now so a
  future multi-ability unit just renders more rows.
- **Show the driving stat directly** next to its effect: `mobility` beside
  `MOV s`, `agility` beside the per-ability cadence, plus the new `defense`,
  alongside the existing HP / DMG / RNG / CRIT / XP.
- The per-archetype **accent CSS cleanup is OUT of GP3** — deferred to the
  post-H recruitment/rarity overhaul (user call at the GP3 tee-up; it pairs
  with rarity tiers, not legibility). See *Cleanup / chores*.

**Cost:** render-only; **browser-verified**. No snapshot / fuzz impact.

**Decisions locked (GP3 tee-up):** card = **two sections** — a compact
two-column stat block (HP / DEF / CRIT / XP + `move 1.0s (mob 2)`) + an
**Abilities** list below (per ability: name + `N dmg · rng R` + `cadence s
(agi A)` + an AoE tag), built so a future multi-ability unit just renders more
rows. HUD = **light touch** (keep the `Lv · XP` rows; add DEF + the driving
stats inline; abilities stay on the card — the 240px panel stays scannable).
Ability display names = a **UI id→label map** (render-only; NOT a `name` field
in [abilities.json](config/abilities.json)). Accents deferred (above). Full
kickoff in the session memory (`project_gp3_kickoff`).

### GP4 — Ranged firing-position pathing (#6) ✅ shipped

**✅ Shipped** — generalized to **ranged + catapult** (both path to the nearest
cell they can fire from via the new `nearestActingCell` BFS in
[src/sim/actingPosition.ts](src/sim/actingPosition.ts); range-only for the
LOS-ignoring catapult). Knob `actingCellSearchSlack` in
[config/sim.json](config/sim.json). The fallback to charging the target's cell
fires both when no firing cell is reachable AND when the step toward one is
**blocked** (a contested chokepoint cell) — the load-bearing anti-freeze
guarantee (a first internal freeze, a strafing-funnel strip where N units share
one firing tile, was found + fixed this way). **Healer deferred to GP5** (its
approach is already heal-range-capped by its step-1 idle, so the acting-cell
change is a no-op there). **Residual 1/40 strafingFunnel hang** — a pre-existing
**healer-blocks-chokepoint** deadlock GP4's run trajectory exposes (baseline
40-seed = 0 hangs); it's GP5's yield-rule charter → **GP5 starts there.** Full
record in the HANDOFF GP4 entry. (The spec below is the as-designed shape, kept
for reference.)

**Shape** ([MovementBehavior](src/sim/behaviors/MovementBehavior.ts)):
- Replace "path to the target's cell" ([MovementBehavior.ts:101-108](src/sim/behaviors/MovementBehavior.ts))
  with "path to the **nearest reachable cell satisfying `chebyshev(cell,
  target) ≤ range && (ignoresLineOfSight || hasLineOfSight(cell, target))`**"
  — BFS outward from the unit over passable cells, first qualifying cell wins.
  **Fallback to the current target-cell pathing when no firing cell is
  reachable** — the fallback is load-bearing: it preserves the C1d / E5
  anti-freeze guarantee. **Do NOT reintroduce the old target-adjacent
  goal-cell** (the `pickGoalCellInRange` that froze when every range-1
  neighbor was a wall/ally — see the MovementBehavior comment block).
- Keep the in-range + LOS abstain as the fast path (already in a firing slot →
  don't move). Catapult unaffected (`ignoresLineOfSight` → abstains on range
  alone); helps archers + mage.

**Cost:** fuzz baseline shifts (paths change), **no snapshot bump.**

**Headless tests:** in-range-but-LOS-blocked → steps to a clearing cell, not
around; one-sidestep-from-a-shot → takes the sidestep; no reachable firing
cell → falls back, **no freeze** (the `layout-deadlock` fixtures still pass);
bounded BFS (cap the search radius so a hopeless target doesn't scan the whole
board); determinism per seed.

**Decision points GP4:** the BFS search-radius cap (recommend `range + a small
slack`).

### GP5 — Healer positioning: navigable-snap + yield rule (#4 + #5)

**#5 ✅ shipped (GP5.1)** — but as a **`SwapAction` pass mechanic**, not the
"step aside" vacate sketched below. Tracing the real repro showed the deadlock
layouts are 1-wide: there is no lateral cell to step to, and a forward vacate
just makes the healer lead the column into the next bottleneck. So the healer
now **swaps places** with the ally it strictly blocks (ally advances, support
retreats to the rear). Cleared the seed-30 hang; see the HANDOFF GP5.1 entry for
the full record. **#4 ✅ shipped (GP5.2)** — the centroid navigable-snap, as
specced below. **Phase GP is COMPLETE (GP1–GP5).** **Phase H IN PROGRESS — H1 ✅
+ H2 ✅ + H3 ✅ + H4 ✅ + H5 ✅ shipped (the `power` stat; spawn-tile range;
deployment counter; the health-pool encounter loop + pre/post-turn screens; the
card-drawn hand + the `playerTeamLevel` seam swap + the pre-turn hand display —
see the HANDOFF H1–H5/H5b entries).** Next is **H6 — the Phase-H gameplay
closers** (rest-pool-heal + recruit-pass option + an *inert* fatigue-debuff
hook), then the new **H7 — search-driven balance tooling** (a linear
scored-strategy DSL + a random-search harness the long-run balance sweep runs
on). **H6/H7 reshape locked with the user 2026-06-05:** the original single
"H6 = recruit pass + rest-heal + balance sweep" card split once the balance work
grew an expressive fuzz-strategy + parameter-search sub-project — the
player-facing mechanics stay in H6, the tooling + the *measured* sweep move to
H7 (see the H6 bullet + the `### H7` block below). The spec below is the
as-designed shape, kept for reference.

**START with the yield rule (#5)** — GP4 surfaced a concrete, reproducible
instance of exactly the deadlock it targets: a healer idling on the only
chokepoint cell of a strafing-funnel gap, blocking boxed-in melee from reaching
a near-dead enemy while it out-heals the enemy's chip damage (a 1/40 fuzz hang,
seed 30 greedy strafingFunnel — see the HANDOFF GP4 entry to reproduce). Landing
the yield rule first both clears that hang and validates #5 against a real
repro; then do the #4 centroid navigable-snap.

**Shape** ([SupportMovementBehavior](src/sim/behaviors/SupportMovementBehavior.ts)):
- **#4 — snap the centroid anchor to the nearest *navigable* tile** (small
  BFS/spiral) before pathing. Today `alliesCentroidCell` ([SupportMovementBehavior.ts:139-153](src/sim/behaviors/SupportMovementBehavior.ts))
  returns the raw rounded average, which can land on a wall/chasm; `stepToward`
  then `findPath`s to an impassable goal, gets `[]`, and the healer **stalls**.
- **#5 — a yield rule.** When the healer would otherwise idle/hold AND it
  occupies a chokepoint cell a living ally needs to traverse (the ally's only
  route runs through the healer's cell, no sidestep), it **vacates**: step
  laterally to a free cell if one exists, else advance along the corridor
  toward the formation anchor so the column flows. (**Rear-bias rejected** —
  healers frequently spawn at the *front* in labyrinth / strafing-corridor
  layouts, so there's no rear to retreat into.)

**Related observations (NOT GP5 code — flagged for later):**
- **Spawn placement.** Healers spawning in front is partly a
  spawn-assignment / layout issue. A cheap complementary lever would be
  biasing support spawn toward the rear of the spawn region — **but
  `spawnTeam` already randomizes spawn tiles** (D5.B Fisher–Yates shuffle;
  H2 only relaxed the per-region tile-count range), so spawn-order bias was
  never an available lever — the yield rule is the durable fix, not spawn
  ordering.
- **Map design.** Some labyrinth / corridor layouts are simply unfriendly to a
  trailing support; revisit layout tuning if the yield rule isn't enough.

**Cost:** fuzz baseline shifts, **no snapshot bump.** **Browser-verify
specifically on labyrinth / Endless Corridors layouts** (where #4 + #5
reproduce).

**Headless tests:** centroid on an impassable tile → anchor snaps to nearest
navigable, healer advances (no stall); a healer in a 1-wide corridor with an
ally blocked behind it vacates rather than idling; determinism per seed.

**Decision points GP5:** how aggressively the healer yields (only when
*strictly* blocking, vs. proactively avoiding 1-wide cells) — tune by feel in
the browser.

---

## Phase H — Multi-turn battle trial

The brief's explicit *trial* of a scheme, promoted to its own phase: it's
phase-sized (a sub-step at a time, a playtest pause between each) and the most
**experimental** work in the plan, so it lands after Phase G's structural
work has stabilized — with G1's short-run harness + G5's fuzz tooling
already in place to support it. It layers a meta-combat loop **on top of**
the existing tactical battle: an encounter is now several **turns**, each
turn a card-drawn **hand** of the roster fighting a freshly-rolled
**wave**, with two **health pools** deciding the encounter (and the run).
Locked with the user to the sub-step + decision level below.

**Hard prereqs:** **G4** (the `playerTeamLevel` seam H5 swaps), **G3**
(rest nodes H6 extends), **G1** (short-run harness). Independent of G2.

**The scheme — as locked with the user:**
- A **player health pool** persists across the whole run (default **20**,
  knob). At 0, the run is lost.
- An **encounter health pool** persists only within an encounter (default
  **8**, knob). The encounter ends when the enemy pool hits 0 (player
  wins) or the player pool hits 0 (run lost).
- An encounter is a series of **turns**. Each turn: draw a **hand** from
  the roster-deck → the hand fights a **freshly-rolled enemy wave** (the
  existing tactical battle = one turn) → **each side's survivors chip the
  *opposing* pool by their Σ`power`**.
- **No within-encounter attrition** (user call). Each turn is an
  independent skirmish: units start at **full HP**, and a unit that dies
  in a turn simply isn't a survivor that turn — it **recycles through the
  discard** (no permadeath, no carried wounds). Outcome variance comes
  instead from **(a)** the enemy rolling a *new* wave each turn and **(b)**
  randomized spawn positions — not from an HP grind.
- **`power`** is a new stat: base **1**, growth **0.20** under the existing
  *additive* model (~20% chance of +1 per level-up, so `E[power] ≈ 1 + 0.2
  × levelups` ≈ 3 at the high end — **not** exponential; the pool↔power
  balance is pure knob-tuning).
- The hand is a **draw → hand → discard** cycle (reshuffle discard into
  draw when empty); **target hand size 5** (knob `handSize`; see "the
  cliff").
- For enemy balance, **`playerTeamLevel` = `avgLevel × min(rosterSize,
  handSize)`** — the **G4 seam swap** (generalized to the `handSize` knob).
- **Recruitment** gains a **pass / no-recruit** option (see "the
  treadmill").

**Why hand size dropped 8 → 5 (the cliff).** With hand 8 and a starting
roster of 5, `min(roster, 8)` is the *whole roster* until you've recruited
past 8 — so for the first several floors there'd be no draw variance, no
deck dilution, and "pass" would never be correct (the deckbuilder asleep).
Hand **5** flips the deck "on" after the *first* recruit (roster 6 > hand
5). The lone pre-recruit encounter is still a full-roster hand, but the
fresh-wave + random-spawn variance keeps even that from being a foregone
conclusion.

**The fatigue hook (architecture now, debuff later).** With no attrition,
a winnable matchup might win *every* turn → the pools stay untouched and
the encounter is a 1–2-turn formality. Whether that actually happens is
empirical (the wave/spawn variance may already break it). So **H3 builds a
per-unit deployment counter** (increments each time a unit is deployed in
a turn, snapshotted) with a clean read-point for a future **fatigue
debuff** that scales off it — the escape hatch if H6's fuzz/playtest shows
battles are foregone conclusions. The debuff itself is **deferred**; only
the counter + plumbing land in this phase.

**The treadmill — mostly neutralized by hand size 5 (resolved).** An
earlier draft worried that recruiting toughens the enemy, since the budget
is `playerTeamLevel − delta` and `playerTeamLevel = avgLevel × min(roster,
handSize)`. But the **starting roster (5) already equals `handSize` (5)**,
so `min(roster, handSize)` is pinned at 5 and never grows — recruiting
adds **no** enemy slot. The budget therefore tracks your **average unit
level**, not roster size (the clean curve we want). The residual coupling
is small and runs through `avgLevel` only: an above-average recruit nudges
difficulty up a hair; a below-average one nudges it *down* (a minor
sandbag). So the **"pass" rationale reverts to deck dilution** — weak for
the first recruit or two (roster ≈ hand), growing as the roster outpaces
5. Keep the pass option; don't expect agonizing early recruit choices.

**Decomposition** (one commit each, pause between):
- **H1 — `power` stat. ✅ SHIPPED.** Add `power` to the stat block
  (base per archetype = 1, `growthRates` = 0.20 — note: the per-archetype
  base/growth live in [config/archetypes.json](config/archetypes.json), not
  `stats.json` as drafted) and to `UnitStats` / template / HUD + recruit
  display. Levels like any other stat (additive growth). **WorldSnapshot
  bump (v17→v18) — plus a Run snapshot bump (v5→v6), since the roster
  templates in the Run save carry the stat block too.** Behavior-neutral until
  H4 consumes it. Fully headless + a browser DOM pass on HUD/recruit/promotion.
  See the HANDOFF H1 entry for the full record.
- **H2 — Randomized spawn-tile selection. ✅ SHIPPED.** The specced
  mechanic — `spawnTeam` placing units on a random tile subset (both
  teams) when units < region tiles — turned out to be **already live since
  D5.B** (the Fisher–Yates `shuffleTilesInPlace` + first-N slice). So H2
  shipped instead as a **per-region tile-count relaxation** (hard 8 → a
  1–10 range; the "8" was an old 8-card-hand relic) that gives the existing
  random subset room to matter, plus verification tests locking the
  property in. **No fuzz baseline shift** (the shuffle's RNG was already
  consumed; no shipped layout changed) — contradicting this card's original
  prediction, which confirms the mechanic predated H2. See the HANDOFF H2
  entry for the full record.
- **H3 — Per-unit deployment counter (fatigue hook). ✅ SHIPPED.** A
  per-roster-slot counter (`Run.deploymentCounts[]`, parallel to the
  roster — user picked the parallel array over a `UnitTemplate` field)
  that increments each time a unit is deployed in a turn, **reset per
  encounter**, snapshotted (**RunSnapshot v6→v7**). Wired live at the
  deploy boundary (`handleEnterNode` resets at encounter start + records
  the full-roster deployment; pre-H4 each battle reads 1/slot). Pure
  bookkeeping now — `resetDeploymentCounts()` + `recordDeployment()` are
  the seam H4's turn loop drives, and the clean read-point for the
  *future* fatigue debuff (deferred; wired in H6 only if needed). No
  RNG/fuzz impact. See the HANDOFF H3 entry for the full record.
- **H4 — Health pools + turn/encounter loop.** `playerHealth` (on `Run`,
  persists) + per-encounter `enemyHealth`; node resolution runs an
  **encounter loop**: each turn spawn a hand (the **full roster** as the
  placeholder hand — cards arrive in H5) + a **freshly-rolled enemy wave**
  (budget constant per encounter from the *expected* hand level;
  composition re-rolled each turn) → tactical battle → survivors' Σ`power`
  chips the opposing pool → check end. **Turn resolution:** one side wiped
  → its survivors chip; a **tick-capped draw → *both* sides' survivors
  chip** their Σ`power`. **Termination safety:** cap encounter turns — a
  mutual 0-survivor wipe deals 0 to both pools, so without a cap an
  all-mutual-wipe encounter could loop forever; on the cap, resolve by
  remaining pool fraction (the sophisticated version is the post-G
  [TODO.md](TODO.md) dive). Defaults: player 20, enemy 8. Keep the tactical
  `World` layer untouched; the loop wraps it — the riskiest
  `Run`/orchestration change in the plan.
- **H5 — Card-drawn hand + seam swap.** Deck/hand/discard (deck = roster;
  hand ≤ `handSize` = 5; reshuffle on empty); only the hand fights.
  **Swap `playerTeamLevel`** (the G4 seam) → `avgLevel × min(roster,
  handSize)`. Draw variance + deck dilution activate here.
- **H6 — Phase-H gameplay closers. ✅ SHIPPED 2026-06-05 (3 commits — see
  HANDOFF.md).** H6a + H6b landed as specced below. **H6c was RE-SCOPED with
  the user:** instead of the per-unit power-**chip** site described in the H6c
  bullet, fatigue ships as a **spawn-time** debuff — `Run.beginTurn` bakes
  `fatigueFactor(priorDeploymentCount)` (`src/run/fatigue.ts`, default rate 0 →
  factor 1.0, INERT) into a fresh copy of each fielded unit's `power` at the
  spawn-prep seam, so the debuff rides the unit into battle and flows to the
  chip via the already-fatigued power (zero chip/World/event change, no
  snapshot bump). The eventual shape is a stackable "Fatigued" status owned by
  a future status-effect system. **The H6c bullet's chip-time framing below is
  SUPERSEDED — kept for the design rationale only.**
  The player-facing finish of the trial:
  three small mechanics, each its own commit + playtest pause, leaving it
  **fully playable end-to-end** (balance still rough — that's H7's job). The
  old single "H6 = recruit pass + rest-heal + fuzz + balance sweep" card was
  split here (2026-06-05): the *expressive fuzz strategy + parameter search +
  the measured sweep* grew into their own sub-project → **H7**. The
  `power`-stat fuzz-strategy thread dissolves (power is just one stat weight in
  H7's scorer); the launcher health-pool knobs move to H7d.
  - **H6a — Rest-node pool heal.** Extend G3's `Run.resolveRest` to also heal
    `playerHealth` by `restHealAmount` (default **5**, knob in
    `config/health.json`; capped at `playerHealthMax`) — deferred from G3
    because the pool isn't born until H4. A placeholder beside the +200 XP (the
    XP+heal combo is probably unbalanced — fine for now; both rework with the
    real event system).
  - **H6b — Pass / no-recruit option.** A `passRecruit` command + a
    RecruitScreen "Pass" button (trial default: **always available + free**;
    add a cost only if playtest shows passing is too obviously correct).
    `handleChooseRecruit`'s sibling — leave the roster + deck untouched, advance
    `phase='map'`. The fuzz interface widens `pickRecruit → number | null`
    (null = pass) and the harness dispatches `passRecruit` on null; a minimal
    decline-below-threshold fuzz policy proves the path (the *expressive* scorer
    is H7a).
  - **H6c — Fatigue-debuff hook (INERT by default).** Wire the
    counter→factor→apply path off H3's `deploymentCounts`, shipping it with
    **no gameplay effect**: a `fatigueFactor(deploymentCount)` driven by a
    `config/health.json` knob whose default yields **1.0** (neutral). Applied at
    exactly ONE site — the per-unit `power`-chip contribution to the opposing
    pool (cleanest Run-side hook; the exact axis the foregone-conclusion problem
    lives on). A test flips the knob and asserts the chip drops; at the default
    the chip is unchanged. **Deliberately undecided, pending H7 data:** whether
    the debuff is even *needed*, and if so its real **shape** (power-chip
    scaling vs. a stat debuff vs. deploy-eligibility), **curve**, and
    **magnitude**. H6c lands only the inert plumbing + the chosen application
    *site*; a different eventual shape (e.g. a stat debuff applied at per-turn
    spawn) is a known, localized re-wire.

**Settled with the user (across the design rounds):**
- **No attrition** — fresh-HP skirmishes; variance from fresh waves +
  random spawns; **deployment counter (H3) built as the fatigue hook**,
  reset **per encounter** (per-run judged too harsh).
- **Enemy rolls a new wave each turn** (placeholder) — no enemy deck;
  budget constant per encounter, composition re-rolled per turn.
- **Hand size 5** (knob); **unit death is per-turn** (recycles via discard
  — no permadeath, no carried wounds).
- **Random spawn-tile subset** when units < region tiles (H2).
- **In-battle agency is intentionally near-zero** — the hand is *drawn*,
  not chosen, then autobattles; the bulk of agency is out-of-battle (draft
  + path). *Future* low-level controls (unit **pathing** + **targeting
  priority**) are planned but out of scope (see *What we're NOT doing
  yet*).
- **XP / promotion cadence: per encounter** — bank the turn-by-turn XP and
  pop one `PromotionScene` at encounter end, never per turn.
- **Tick-capped turn = a draw where *both* sides' survivors chip the
  opposing pool** (not a no-damage stalemate); the deeper turn-limit
  system is a post-Phase-H exploration ([TODO.md](TODO.md)).
- **Rest nodes heal the player pool +5** (H6).

**One trial default still loose:**
- **Pass option** — assume **always available + free** for the trial; add
  a cost only if playtest shows passing is too obviously correct.

**Snapshot scope.** `Run` gains `playerHealth` + deck/hand/discard +
per-unit deployment counts; an encounter gains `enemyHealth` + turn/wave
progress → **Run + WorldSnapshot bumps.** Mid-encounter round-trip is the
key test.

**Headless tests** (per sub-step; balance-proof):
- H1: `power` levels per `growthRates`; snapshot round-trips the stat.
- H2: the random spawn-tile subset stays within the region + covers every
  tile over many seeds; deterministic per seed.
- H3: the deployment counter increments, **resets at encounter start**,
  and round-trips.
- H4: encounter loop ends on either pool reaching 0; survivor Σ`power`
  hits the correct pool; a **tick-capped turn chips *both* pools**; the
  encounter terminates within the max-turns safety even under forced
  repeated mutual wipes; run lost at `playerHealth == 0`; the wave
  re-rolls per turn (composition varies, budget constant); pools
  round-trip.
- H5: draw/hand/discard cycles correctly (reshuffle on empty, hand capped
  at `handSize`); `playerTeamLevel == avgLevel × min(roster, handSize)`.
- H6: a passed offer leaves the roster + deck unchanged + advances (H6b); a
  rest node heals the pool by `restHealAmount`, capped at max (H6a); the inert
  fatigue hook is a no-op at the default knob but reduces the per-unit
  power-chip when the knob is flipped in-test (H6c). H7's scorer + search tests
  live in the `### H7` block.
- Determinism across a whole multi-turn encounter per seed.

**Heaviest verification phase** — lean on G1's short-run harness to
iterate encounters fast, and the H7 sweep to balance + measure the
foregone-conclusion rate.

### H7 — Search-driven balance tooling

**The closer's closer.** H6 leaves every Phase-H *mechanism* in place but the
trial **balance-unmeasured** (fuzz win rate ~100% / avg floor 10 since H4 — the
no-attrition pools make encounters foregone conclusions). H7 builds the tool to
*measure and fix* that: an expressive, parameterized fuzz strategy + a random
search over its parameters, using **best-achievable win rate** as the balance
signal. Grew out of the H6 "balance sweep" thread when the user pushed for a
more expressive strategy system (2026-06-05 design round).

**Hard prereqs:** **H6b** (the `passRecruit` mechanic the scored-pass policy
needs + the `pickRecruit → number | null` interface), the existing G5 fuzz
harness + registry, **G1** (short-run RunConfig for cheap evals).

**The idea (as locked with the user):** today's fuzz menu is
*one-axis-at-a-time* (each strategy maximizes one thing, randomizes the rest —
`stat:power`, `recruit:rogue`, `path:rest`). Replace/augment it with a **linear
scored strategy** — a weighted sum of normalized features → argmax — that
expresses path + unit + pass preference **simultaneously**, then **randomly
search the weight space** to discover strong play. It's deliberately a *linear
policy optimized by derivative-free search over Monte-Carlo rollout win rate* —
ML-adjacent but NOT a neural net: the whole value is reading the winning weights
("the strongest play hoards rogues + passes below-average offers"), which a
black-box model would obscure. **Interpretability is the deliverable**; the
upgrade path (feature crosses → still linear; a hidden layer → a real tiny NN;
CMA-ES/policy-gradient over random search) exists but is explicitly out of
scope. "More expressive than before, not full expressivity."

**Measured cost basis (2026-06-05):** ~230 ms per full run today (post-H5; the
50-vs-250-run differencing that backs this out is in the scratchpad), ~13 s
one-time process startup. Runs are independent → trivially parallel. ~20 weights
total, and random-search cost is **independent of dimensionality** (you draw N
vectors regardless) — the cost driver is `vectors × seeds × run-length`, not
knob count.

**Sub-steps:**

- **H7a — the linear `ScoredStrategy` + JSON config.** Three weighted axes:
  - **Path** (homogeneous → no normalization): a weight per `NodeKind`
    (`battle`/`rest`; `boss` is the forced terminal). Pick via **full-path
    backward DP** — `bestScore(n) = kindWeight(n) + max(bestScore(child))`. All
    root→terminal paths are the same length (layered DAG, one node per floor),
    so max-total == max-average — **no long-path bias**; the frontier pick is
    the child with max `bestScore`.
  - **Unit** (heterogeneous → **normalize each term over `{offer ∪ roster}`**):
    archetype **affinity** (flat per-archetype table) + **diversity**
    (coefficient × current roster count of that archetype — "I like rogues but
    not a 4th"; generalizes today's `greedy`) + **level** + **per-stat** (incl.
    `power`) + **total stats**.
  - **Pass = a virtual candidate** scored on the **continuous terms only**
    (level + stats; archetype/diversity don't apply to a "roster-average unit",
    matching the user's design). Pass fires when
    `Σ w·(normBestCard − normRosterAvg) + passBias < 0`. **Normalize over
    `{offer ∪ roster}`, NOT min-max-within-offer** — the latter makes every best
    card score ~1.0 and silently breaks the roster comparison the pass decision
    needs.
  - **~20 weights** (2 path + 6 archetype + 1 diversity + 1 level + 8 stat + 1
    total + 1 pass-bias). **Deterministic tiebreaks (lowest index, zero RNG
    draws)** so "same weights → same decisions" is trivially true and there's no
    draw-pattern to baseline. Generalizes the existing parameterized menu
    (`stat:power` = weights all 0 but power=1). **Leave `pure-random` / `greedy`
    untouched** (the byte-for-byte baselines + default sweep — do NOT re-express
    them as scored). Config = `config/fuzz-strategies.json` (A4 zod-validated; a
    single-vector file is BOTH the CLI input format AND the search's emitted
    winner). CLI keeps a `--strategy=file.json` (one vector) alongside
    `--search` (H7b).
- **H7b — the search driver.** Factored as **propose → evaluate → keep-best** so
  the proposer is the only swappable part:
  - **random search** v1: `propose = () => uniformSample(box)` (ignores
    history); **hill-climb-ready** — a later `propose = (best) =>
    perturb(best, step)` + greedy accept is a ~15-line add reusing the same
    `evaluate`, fitness, split, and reporting.
  - **Fitness = win rate** (the foregone-conclusion axis; configurable later).
  - **Train/test seed split FROM THE START**: search/select on train seeds, then
    evaluate only the winner (+ optionally top-K) on **held-out** test seeds —
    the split is ~1 extra eval (~46 s), and without it the "best" vector
    memorizes seed luck and the balance signal inflates.
  - **Seed the sampler** → the whole experiment reproduces.
  - **Two presets** over one driver: **quick** (≈100 vectors × ~10 seeds × short
    runs → well under a minute; the "did my change actually move balance?"
    check) and **overnight/VPS** (≈500 vectors × ~200 seeds × full runs → ~6.4 h
    single-core, ~50 min on 8 cores; runs are independent so cores divide wall
    time linearly).
  - Output: best win rate **+ the winning weight vector** (itself a balance
    insight), re-runnable as a single-vector JSON.
- **H7c — the long-run sweep + foregone-conclusion fix.** Run H7b at overnight
  scale; read **best-achievable** win rate. Tune `difficulty.json` (budget
  deltas, swarm bias), `leveling.json` (XP, `xpPerHealing`), the health pools +
  `power` growth, `recruitBonusExponent`, rest XP/heal. **Decide whether the H6c
  fatigue debuff is needed** — if the *strongest discoverable* play is still
  ~100%, give the inert H6c hook a real effect **shape + curve + magnitude**
  (the deferred decision), re-search, confirm the band drops. The metric is
  whether a balance change moves the strongest discoverable strategy — not just
  one hand-authored playstyle.
- **H7d — launcher / VPS niceties.** The G5 GUI launcher gains the health-pool
  knobs (deferred from G5/H6); a thin wrapper to kick the overnight search on a
  VPS.

**Shortcomings logged in the design round (acceptable for v1):** a linear sum
expresses only *monotone* preference (the diversity term is the lone
roster-aware exception — no "exactly one healer then stop" without more such
terms); **static weights for the whole run** (can't "hoard early, pass late");
**path scoring is thin** until nodes carry more than `kind` (~1 real knob,
rest-vs-battle, today); **level / total-stats / `power` are correlated** so those
knobs aren't independent levers; **pass-on-roster-average is blind to H5 deck
dilution** (a leaner deck draws good units more often — the heuristic can't see
it); and **seed overfitting** (the train/test split is the guard).

**Headless tests (H7):** full-path DP picks the max-score path on a hand-built
map; scorer normalization is stable + tiebreaks deterministic; pass fires iff
best-card continuous-score < roster-avg (+bias); a single-vector JSON
round-trips; the search is reproducible at a fixed sampler seed; the train/test
split evaluates the winner on the held-out set. Pure logic → **headless-first**
(the only browser surface is H6b's Pass button).

---

## Cleanup / chores

Not gated; can land any time. (The post-E `world.findUnit` O(n) item
shipped in F2 — dropped.)

- **Recruit-card accent CSS for the new archetypes.** [TODO](TODO.md) —
  `recruit-card--{rogue|healer|mage|catapult}` accent rules in `ui.css`
  (the cards currently fall back to base styling; the same `--archetype`
  classes are stamped unstyled on the **promotion** cards too). Cosmetic.
  **Deferred to the post-H recruitment/rarity overhaul** (GP3 tee-up call —
  pairs with rarity tiers; explicitly NOT GP3).
- **Dedicated catapult SFX (+ the F3 launch/impact split).** [TODO](TODO.md)
  — play a launch "creak/thunk" on the `release` phase and a heavy crash
  on `impact`; needs 1–2 assets in `public/audio/`.
- **Favicon.** [TODO](TODO.md) — inline SVG `M`/`@` glyph in
  TERMINAL_GREEN; stops the per-load 404.
- **`.gitattributes`** to normalize line endings (stops CRLF warnings on
  every commit).
- **Bundle chunk-size warning.** Bump `chunkSizeWarningLimit` in
  [vite.config.ts](vite.config.ts), or code-split three.js if noisy.
- **Terrain generator: bias water toward unit paths.** [TODO](TODO.md) —
  water scatters uniformly so the cost-2 shallow-water rule rarely fires.
  Wants "N clusters of size M" rather than per-cell Bernoulli. Lower
  priority.

---

## What we're explicitly NOT doing yet

- **Enemy-archetype diversification.** The brief keeps enemies
  melee/archer-only through Phase G so the budget system (G4) + the
  multi-turn trial (Phase H) can be balanced against a simple, legible enemy
  roster. Fielding rogue/healer/mage/catapult on the enemy side is the
  first thing to revisit once those stabilize.
- **Recruit rarity tiers + floor-weighted offers** (old G1). Parked. G4's
  avg+exponential leveling + Phase H's pass option reshape recruitment first;
  layer rarity on top later.
- **In-battle controls** (old G2, reframed). The Phase H model is intentionally
  low-agency (draft + path out of battle). The planned *future* additions
  are **low-level** controls — unit **pathing** + **targeting priority** —
  not old-G2's high-level tactical commands. Out of Phase G; revisit after
  the multi-turn loop settles.
- **Multi-map / "Regions" + theme-per-map migration** (old G3 + D8). G2
  does a longer *single* map. Multiple maps per run, HP/recruit carry-over
  between maps, and moving `rollTheme` up to the map level wait until the
  single-long-map + multi-turn loop settle.
- **Generic status-effect system.** F2 formalized per-action *phase
  timing* (the timing substrate), **not** cross-unit persistent effects.
  Resist a generic status system until a consumer beyond phase timing +
  tile effects reveals its shape.
- **Dodge mechanics.** Still the dodge-less baseline; revisit only if
  playtest flags it.
- **Save/load UI.** A2 laid the plumbing. Long runs (G2) + run-loss (Phase H)
  raise the value — but the load-a-run UX still waits until the run shape
  stops moving.
- **Replay system.** Free off A2; build the UI when there's a reason.
- **Boss / elite *mechanics*.** G3 adds the boss *node* (a tagged regular
  fight); bespoke boss mechanics wait until the recruit/depth/multi-turn
  surface stabilizes.
- **Touch controls** for the camera. WASD + edge-scroll only through
  Phase G.
- **Editor "test play" button.** Carried from C1d.B; re-evaluate if a
  layout-tuning bottleneck appears (G1's run-config tooling may subsume
  it).
