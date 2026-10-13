# Round 8.5 census

**Status: being built; section 1 is read and signed, and section 2
(120d, written 2026-10-13) waits for its read at 120e's stop.** Signed (the
user, 2026-10-12 and 2026-10-13): the format, the two scope calls, the
authoring vocabulary kept as a class (A-16), nine rows for deletion
(A-01, A-02, A-03, A-05, A-07, A-08, A-09, A-10, A-13), seven kept
(A-06, A-12, A-14, A-15, A-17, A-18, A-19), A-11 as a trial, A-04 split
(`ignoresTerrain` deleted, `layer` kept for Round 9), and A-20 and A-21
item by item (A-21 was added at the read). §120's list of what the
round may delete or try, each candidate with its evidence and the proof
that covers it ([round-8.5-spec.md](round-8.5-spec.md) D1;
[ROADMAP.md](ROADMAP.md) §120). The user signs it before anything is
deleted. Section 1, the dials, was written at 120c on 2026-10-12 and its
read closed on 2026-10-13. The later steps add their sections in this
format.
How each number was counted, and what was checked and what was not, is in
[WORKLOG.md](WORKLOG.md) §120.

## The format

A candidate is one row with an id. **A-nn** is list A, what a search can
settle before the code is touched. **B-nn** will be list B, the trials
(120f). A row holds:

- **what** it is and where it is declared;
- **in play**: what it does in the game today, and what a player would
  notice if it went (added at the read, at the user's ask for what each
  candidate does);
- **evidence**: who reads it, what sets it, and how that was found;
- **gotchas**: the GOTCHAS entries that name it, or none;
- **fate**, the session's proposal, one of:
  **delete** · **keep** (with the consumer named) · **ask** (a call about
  intent that a search cannot make; the session's lean is given) ·
  **trial** (goes to list B) · **TODO** (only a behaviour change fixes it);
- **proof**: what shows the deletion changed nothing, from TESTING.md "The
  oracle map";
- **signed**: empty until the user fills it.

A class that a search settles is signed as a class, with its count, its
rule and drawn rows to check. A judgement is signed row by row.

Three proofs recur, so the rows name them by a word:

- **config**: for a key taken out of a `config/*.json` and its schema.
  `npm run corpus` (30 journals, replayed past their config stamp, so a
  removed key does not refuse them) with every digest unmoved;
  `npm run oracle -- config-dump` before and after with `json-diff`, where
  the removed paths are the only difference; the type check, which names
  any reader left behind; the suite. The config stamp changes with any
  removed key.
- **sim**: for code under `src/sim` or `src/run`. The corpus and the fuzz
  diff (`bash scripts/perf-oracle.sh`) byte-identical, a planted break at
  the site that both must catch (`npm run oracle -- plant`), the suite,
  and `reach-diff` for a test deleted with the code.
- **instrument**: for `tests/fuzz`. The fuzz diff and the smoke's own
  tests, which between them run about seven lines in ten there.

## 1. The dials (120c)

### 1.1 What was counted

| | count | how |
|---|---|---|
| config keys | 616 declarations, in 32 files | every key the parsed type of a config file can hold: 464 keys of zod schemas and 152 members of hand-written interfaces |
| `RunConfig` fields | 25 | the interface's members |
| URL parameters | 17 | 13 run dials (`RUN_CONFIG_PARAMS`) and 4 others |
| `npm run fuzz` flags | 65 | the `case '--…'` labels of `parseArgs` |
| content entries | 145, in 12 catalogs | abilities 24, statuses 10, units 30, camps 5, characters 3, daemons 11, encounters 19, events 13, layouts 11, packets 8, reward tables 9, sectors 2 |

Two config files have no loader under `src/config` and are not in the 616:
`fuzz-strategies.json` and `redraw-level-fisher.json`, which only the fuzz
instruments read. The command lines other than `npm run fuzz` (the board,
the gauntlet, the corpus, the roster and prior tools, the oracle, the
run-config tool) were not listed: call 2 below.

### 1.2 The config keys, by class

Every one of the 616 is in exactly one class.

| class | keys | rule | fate |
|---|---|---|---|
| **used** | 464 | the game, the dev build, a fuzz instrument or a script reads it by type, directly or one step on from its loader | keep |
| **table** | 43 | read by a computed key or handed on whole, which a type search cannot see; each family checked against the line that reads it | keep |
| **module** | 45 | a member of an encounter type declared in `src/run/encounters/wave.ts` or `sequencer.ts` and read by the resolver in that file | keep |
| **loader** | 44 | read by its loader, which builds the run-time value from it; the search stops there, and each loader's reads were looked at | keep |
| **tools** | 7 | by type, only an editor under `tools/` reads it | rows A-05, A-06, A-17 |
| **dead** | 13 | only tests read it, and the site was read | rows A-01 to A-04 |

By the file that declares the key, under `src/` (the last three columns overlap the classes: a key of a union arm
no entry uses, an optional key no entry sets, an enum with a value no
entry holds):

| declared in | used | table | module | loader | tools | dead | all | no entry | never set | enum |
|---|---|---|---|---|---|---|---|---|---|---|
| `config/camps.ts` | 7 | | | | 2 | | 9 | | | |
| `config/characters.ts` | 7 | | | 1 | | | 8 | | | |
| `config/daemons.ts` | 21 | | | 11 | | | 32 | | 3 | 3 |
| `config/deck.ts` | 4 | | | | | 4 | 8 | | | |
| `config/difficulty.ts` | 11 | | | | | | 11 | | | |
| `config/economy.ts` | 1 | | | | | | 1 | | | |
| `config/empower.ts` | 3 | | | 2 | | 3 | 8 | | 1 | 1 |
| `config/encounters.ts` | 7 | | | | 1 | | 8 | | 1 | |
| `config/escalation.ts` | 3 | | | 1 | | | 4 | | | |
| `config/events.ts` | 66 | | | 1 | 1 | | 68 | 26 | 2 | |
| `config/health.ts` | 11 | | | | | | 11 | | | 2 |
| `config/keybindings.ts` | | 11 | | | | | 11 | | | |
| `config/layouts.ts` | 26 | 2 | | 1 | 1 | | 30 | | | |
| `config/leveling.ts` | 10 | | | | | | 10 | | | |
| `config/nodemap.ts` | 25 | | | | | | 25 | | | |
| `config/objective.ts` | 2 | | | | | | 2 | | | 1 |
| `config/packets.ts` | 13 | | | 9 | | | 22 | 2 | 2 | 3 |
| `config/playback.ts` | 5 | | | | | | 5 | | | |
| `config/prices.ts` | 7 | 4 | | 10 | | | 21 | | | |
| `config/recruitment.ts` | 8 | | | | | | 8 | | | |
| `config/rewards.ts` | 21 | | | 2 | | | 23 | | | |
| `config/sectorMap.ts` | 8 | | | | | | 8 | | | |
| `config/sectors.ts` | 12 | | | 5 | 1 | | 18 | | 4 | 1 |
| `config/selection.ts` | 1 | | | | | | 1 | | | 1 |
| `config/sim.ts` | 18 | | | | | | 18 | | | |
| `config/spawn.ts` | 1 | | | | | | 1 | | | |
| `config/stats.ts` | 14 | | | | | | 14 | | | |
| `config/terrain.ts` | 32 | 6 | | | | | 38 | | | |
| `config/tiles.ts` | 1 | | | | | 4 | 5 | | | |
| `config/units.ts` | 31 | 11 | | 1 | | 2 | 45 | | 5 | 2 |
| `run/encounters/sequencer.ts` | | | 15 | | | | 15 | | | |
| `run/encounters/wave.ts` | | | 30 | | | | 30 | 8 | | |
| `sim/effects/schema.ts` | 70 | 5 | | | 1 | | 76 | | 7 | 8 |
| `sim/effects/statusSchema.ts` | 18 | 4 | | | | | 22 | | 3 | 1 |
| **all** | **464** | **43** | **45** | **44** | **7** | **13** | **616** | **36** | **28** | **23** |

**Ten rows of "used", drawn by a seeded draw** (seed 120), for the user to
check against what they know. "set 2/24" is: two of the 24 entries that
could hold the key hold it.

| key | declared | set | values | read by |
|---|---|---|---|---|
| `AbilityDefSchema.orphanPolicy` | `sim/effects/schema.ts:462` | 24/24 | commit-at-cast ×17, ground-target ×6, fizzle ×1 | game 4, tools 3 |
| `CampDef.leashRadius` | `config/camps.ts:71` | 5/5 | 3 ×3, 2 ×2 | game 1, tools 2 |
| `PacketSchema.name` | `config/packets.ts:167` | 8/8 | eight names | its loader, then the game |
| `EventCondition.flag` (of `flagIs`) | `config/events.ts:68` | 0/0 | none: no event uses the arm | game 2, tools 2 |
| `AbilityDefSchema.priority` | `sim/effects/schema.ts:468` | 24/24 | 10 ×22, 5 ×1, 0 ×1 | game 6, tools 3 |
| `RecruitmentSchema.defaultOfferSize` | `config/recruitment.ts:45` | 1/1 | 3 | game 2 |
| `DaemonSchema.id` | `config/daemons.ts:198` | 11/11 | eleven ids | its loader, then the game |
| `NodeMapSchema.eventMinSpacing` | `config/nodemap.ts:63` | 1/1 | 1 | game 1 |
| `HealOpSchema.kind` | `sim/effects/schema.ts:155` | 2/2 | heal | game 17, instrument 1, tools 6 |
| `TimelinePhaseSchema.phase` | `sim/effects/schema.ts:380` | 65/65 | five phases | game 2, tools 6 |

**The tables, whole** (43 keys), each family with the line that reads it:

| family | keys | read at |
|---|---|---|
| `KeybindingsSchema.*` | 11 | `src/ui/Keybindings.ts:152`, by action name |
| `BaseStatsSchema.*` | 11 | `src/sim/leveling.ts:67`, by stat name |
| `FxSchema.*` | 5 | `src/render/BattleRenderer.ts:1355`, by phase |
| `StatusFxSchema.*` | 4 | `src/render/BattleRenderer.ts:1392`, by moment |
| `SymmetryWeightsSchema.*` | 3 | `src/sim/proceduralMap.ts:178`, handed whole to a weighted pick |
| `CampPlacementWeightsSchema.*` | 3 | the same pick, in `src/sim/proceduralMap.ts` (the line was not pinned) |
| `PricesSchema.units.rarityMultiplier.*` | 4 | `src/config/prices.ts:151`, by rarity |
| `NeutralCoordSchema.hp`, `RubbleCoordSchema.hp` | 2 | `src/sim/battleSetup.ts:350` and `:359`, after the layout's coords are handed on whole |

### 1.3 Rows for the user's call

**Dials only tests read** (the class "dead", 13 keys). Each loader's own
header says the same thing the search found.

**A-01 · `deck.redraw`, 4 keys** (`config/deck.json`; `src/config/deck.ts:72-75`)
- In play: A redraw lets the player send drawn cards back and draw fresh ones before a turn. Two daemons grant it today (Mercury and Janus), each with its own numbers. This block is the switch from before daemons owned it. It is off, and removing it changes nothing a player can do.
- Evidence: `enabled` is `false` and nothing reads it. The block and its
  two numbers are read by tests alone, at 12 places. The header: "L1
  flipped this OFF for good: daemons own redraw availability now". The
  daemons' `grantRedraws` rule carries its own `redrawsPerTurn` and
  `maxCardsPerTurn`, which are other declarations and are used.
- Gotchas: none names the config block (#115 and #117 are about the
  daemon grants).
- Fate: **delete** the four keys; the tests that read `DECK.redraw.*` for
  a fixture take the numbers as literals.
- Proof: config.
- Signed: **delete** (the user, 2026-10-12: "Those definitely can go, then;
  they should be purely owned by the daemon / packet vocabulary now").

**A-02 · `config/empower.json`, the whole file** (3 top-level keys; `src/config/empower.ts:73-75`, the `EMPOWER` export)
- In play: An empower lets the player buff one drawn card for the rest of the encounter. Two daemons grant it (Mars and Minerva), each carrying its own buff. This file is the global version from before daemons owned it. It is off, and removing it changes nothing in play.
- Evidence: `enabled` is `false`. `EMPOWER` is named by one file outside
  its loader, `src/run/Run.test.ts`. The header: "this config is the
  daemon-LESS baseline = disabled. The `buff` below stays as the canonical
  'K4 default empower' shape that tests/fixture daemons derive from."
  `BuffSchema`, `normalizeBuff` and the buff's type are used by the daemon
  and packet loaders and stay.
- Gotchas: none.
- Fate: **delete** the file, its schema and `EMPOWER`; the test keeps the
  buff as a fixture. Config files go from 34 to 33, and the config
  stamp's registry drops the name in the same commit.
- Proof: config.
- Signed: **delete** (the user, 2026-10-12, in the same words as A-01).

**A-03 · `tiles.fire.damagePerSec`, `tiles.healing.amountPerSec`** (4 keys with their two parents; `src/config/tiles.ts:27-33`)
- In play: A fire tile burns and a healing tile mends through the `burn` and `rejuvenate` statuses, whose rates are in `config/statuses.json`. These two numbers are a second copy the game does not read; one test checks that the copies agree. Removing them changes nothing in play.
- Evidence: one test reads each (`src/config/statuses.test.ts:131`,
  `:138`), and a word search finds no other. The header: "the only consumer left is
  the §27c balance-proof, which asserts `burn`'s per-second damage ==
  `fire.damagePerSec`". The damage a fire tile does is the `burn`
  status's, in `config/statuses.json`.
- Gotchas: none.
- Asked at the read: would a rule that water puts out a burn touch this?
  No. That rule exists: a unit entering shallow or deep water loses
  `burn` (`src/sim/TileGrid.ts:119`, `:139`; `src/sim/World.ts:1643`),
  always on, and it is written on the tile, not in these two rates.
- Fate: **delete** the two rates and the test's two assertions, which
  hold one config number against another. `tiles.json` keeps
  `applyStatusOnEnter`.
- Proof: config.
- Signed: **delete** (the user, 2026-10-12: "looks safe to purge", asking
  first about water and burn; confirmed after the answer above: "03, 05,
  and 08 are cleared for deletion").

**A-04 · `units.layer`, `units.ignoresTerrain`** (`src/config/units.ts:190`, `:193`)
- In play: Nothing. They were placeholders for flying units, which do not exist: no unit sets them and no code acts on them.
- Evidence: no unit sets either; `src/config/units.test.ts` reads them at
  four lines to show the schema parses them. The schema's comment: "Flight
  (deferred build) … Inert until flight builds." META-ROADMAP's flight is
  a per-unit `traversal` profile shared with the marine; the history is
  below.
- Gotchas: none.
- The history, asked for at the read. Two calls, each signed by the
  user. **2026-06-28**, the Cluster 2 kickoff
  (`archive/post-34-roadmap.md:1331`, commit `6759956`): flight's design
  locked with its build deferred. "Share a tile with ground → NO …
  Flight changes pathing … + targeting …, never co-location", so that
  flight does not break one unit to a cell, and because a four-way
  ground and air matrix is "a trap in a no-direct-control autobattler".
  The same lock KEPT `layer`: "the cross-layer interactions (melee
  hitting a flyer, AoE across layers) live in targeting, not occupancy,
  handled by `targetsLayer` + the unit `layer` field", with overlap
  left as "a future fill". **2026-08-21**, the planning session behind
  META-ROADMAP v2: flight and the marine share a `traversal` profile,
  co-location for flyers and the anti-air matrix are "out until a
  consumer names them", and the lock "is re-audited at that phase's step
  zero" (its signed decisions, Round 9's Traversal entry, and
  "Explicitly deferred / out").
- So `ignoresTerrain` is what a traversal profile replaces. `layer` is
  not: Round 9 ships `targetsLayer`, and the road map does not say what
  it reads. The census first said the plan replaces both keys, which
  went past what the entry says.
- Fate: `ignoresTerrain`, **delete**. `layer`, **keep** for Round 9's
  step zero, where the lock is re-audited (the session's lean, changed
  from "delete" by the history).
- Proof: config.
- Signed: `ignoresTerrain`, **delete** (the user, 2026-10-12: "seems
  properly obsolete"). `layer`, **keep** for Round 9's step zero (the
  user, 2026-10-12: "Signing the layer keep").

**Content fields nothing reads.**

**A-05 · `move.cells`** (`src/sim/effects/schema.ts:172`; set to 1 on the gambit's retreat and 2 on the dash's advance, `config/abilities.json:196`, `:216`)
- In play: The rogue's dash leaps up to 2 cells, and the gambit steps back 1 cell after its strike. The dash's distance is the ability's own `rangeCells` (2, `src/sim/effects/propose.ts:185`), and the gambit's step is always one cell. `cells` holds the same two numbers a second time. Changing it in an editor changes nothing today, and so does removing it.
- Evidence: required by the schema, and by type nothing under `src` reads
  it.
  `executeMove` (`src/sim/effects/interpreter.ts:240`) moves the caster to
  a landing captured at cast, and the retreat steps one cell by
  `retreatCell`. By type only tools read the field, at four places. So
  the two authored distances do not decide how far either move goes.
- Gotchas: none.
- Asked at the read: would a teleport be harder to build without it? No.
  The move already puts the caster on a landing chosen at cast
  (`executeMove`), and the dash's reach is the ability's `rangeCells`; a
  teleport is another way of choosing the landing, with the same range.
  What WOULD read `cells` is a knockback or a pull (A-07), whose push is
  not the ability's range.
- Fate: **delete**, with A-07. A push's distance is designed with the
  first knockback (META-ROADMAP Round 9, "Forced movement and a
  teleport").
- Proof: config.
- Signed: **delete** (the user, 2026-10-12: "03, 05, and 08 are cleared for
  deletion").

**A-06 · `EventPage.art`** (`src/config/events.ts:175`)
- In play: Nothing yet: a slot for a picture on an event page, which no page fills.
- Evidence: none of the 51 pages sets it; only the event editor reads it.
- Gotchas: none.
- Fate: **keep.** META-ROADMAP Round 10 names "the event `art?`/fx
  seam's first consumers".
- Signed: **keep** (the user, 2026-10-13, with the six other keeps of
  the read's third tranche: "Signing all of those keeps").

**Declared and never built.**

**A-07 · `move.mode`: `knockback`, `pull`** (`src/sim/effects/schema.ts:171`)
- In play: Nothing: they would shove or drag the TARGET of an ability, and the game refuses an ability that uses either.
- Evidence: no ability uses either; `executeMove` and the proposal both
  throw on them ("reserved — deferred to Cluster 2's occupancy core").
  Cluster 2 closed without them, and META-ROADMAP, TODO and DESIGN do not
  name a knockback.
- At the read (the user, 2026-10-12): "Attacks with a knock back or pull
  effect are also planned, but I admittedly may never have mentioned
  that." META-ROADMAP, TODO and DESIGN do not hold it yet. A push's
  distance is what `move.cells` (A-05) would carry, so the two rows go
  together.
- Fate: **delete** the two values and the two throws, with the plan
  written into META-ROADMAP. The reservation was made against Cluster
  2's occupancy core, which shipped without it, and Round 9's own rule is
  that a seam ships with its consumer.
- Proof: sim.
- Signed: **delete** (the user, 2026-10-12: "07, also cleared, but yes, let's
  get those into the plan"). The plan is META-ROADMAP Round 9, "Forced
  movement and a teleport".

**A-08 · `orphanPolicy`: `re-home`** (`src/sim/effects/schema.ts:69`; `src/sim/Action.ts:59`)
- In play: Nothing: it would send a shot after a new target when its first one dies in flight. No ability asks for it and no code does it.
- Evidence: no ability uses it; `Action.ts:51` says "DECLARED ONLY in F2 —
  no action uses" it.
- What it is: an ability says what happens when its target dies while
  the shot is in the air. The catapult's shot fizzles, the mage's blast
  hits the cell whoever stands there, a strike lands on the target it
  was aimed at. `re-home` would have the shot pick a new target in
  flight. `src/sim/Action.ts:51`: "no action uses it (it reads as
  unfair)".
- Fate: **delete** the value.
- Proof: sim.
- Signed: **delete** (the user, 2026-10-12).

**A switch whose other position nothing selects.** The code for the
unselected position ships and is run by tests only.

**A-09 · `selection.strategy`: `layoutFirst`** (`config/selection.json`, one key; `src/run/encounters/selection.ts:135-153`)
- In play: When a run reaches a fight, the game picks the encounter and then a board it fits on. `layoutFirst` picks the board first and then an encounter that fits it. No encounter restricts its boards today (`layouts` is set on 0 of 19), so the two make the same two picks in the other order. A player could not tell them apart.
- Evidence: the shipped value is `encounterFirst`. `layoutFirst` is one
  function of 19 lines, named in `selection.ts`, the loader and their
  test. With it gone the key has one legal value, so the key, its loader
  and the one-key file can go too.
- Gotchas: none.
- The history (`archive/post-r-roadmap.md`, V1): the order was built as
  a switch at the user's call, "we don't yet know which feels better,
  and it should A/B with a config flip", with `encounterFirst` the
  default, "user-locked". No document records that the comparison was
  run. With no encounter restricting its boards, both orders draw each
  encounter and each board at the same odds, so today a comparison has
  nothing to show. If content later sets `layouts`, the kept order still
  honours it (`compatibleLayouts`); `layoutFirst` would then favour the
  encounters that fit many boards.
- Fate: **ask** (lean: delete all of it; config files 33 to 32).
- Proof: sim, and config for the file.
- Signed: **delete** all of it (the user, 2026-10-13: "I don't think
  that comparison was ever run, but I'm comfortable dropping it. Enemy
  first is working, and I see no reason to change that").

**A-10 · `objective.focusTileResolution`: `disallow`, `clearOnArrival`** (`config/objective.json`; `src/sim/focusTile.ts:52-82`)
- In play: The player can order the team to focus on a tile. Shipped (`leashAtNearest`): units run to the tile, then fight what comes near it and hold there. `disallow` would refuse the order outright. `clearOnArrival` would send units to the tile past every enemy and drop the order once one of them stands on it; on a tile nobody can reach, they would run at it for the rest of the battle. The header says the three were kept switchable "so playtest can A/B". Removing the two changes nothing in play.
- Evidence: the shipped value is `leashAtNearest`. The other two are
  resolvers in `focusTile.ts`, about 30 lines, named on eight lines of
  its test; `src/sim/World.ts` and `src/sim/objective.ts` name them in
  comments only. With them gone the key has one legal value.
- Gotchas: none. TODO names `focusTile.ts` only for a shared helper.
- The plans. `archive/post-n-roadmap.md`, O3 (2026-06-16): the default
  is `leashAtNearest`, "user-confirmed", and "all three still ship
  switchable so playtest can A/B". No document records that comparison.
  META-ROADMAP's Round 8 charter then listed "the focus-tile switch" as
  groundwork for difficulty levels, and the Round 8 spec struck it (D8),
  leaving rule levers such as "a tool taken away" to Round 10's content.
  So `disallow` is the one position a plan once had a use for. A level
  that takes tile focus away would be a per-run rule that stops the
  order being given; this key is one value for the whole page
  (META-ROADMAP, Round 8, "page-global, not per run"), and `disallow` is
  four lines.
- Fate: **ask** (lean: delete the two and the key).
- Proof: sim.
- Signed: **delete** the two and the key (the user, 2026-10-13: "Nah, we
  can cut both. We've gone in a different direction on what escalation
  involves").

**A-11 · `health.chipMode`: `survivors`; `health.capPenalty`: `casualties`** (`config/health.json`; `src/run/chipRule.ts`, 251 lines)
- In play: After each turn both health pools are charged. Shipped: each pool loses the power of its own fallen, and a turn that runs out the clock also costs it the power of the other side's units still standing, so stalling is never cheaper than fighting. The unselected positions are the rule from before the casualty experiment (each side's survivors chip the other's pool) and a capped turn with no surcharge. A player never meets either; the balance sweep's `--set` still can.
- Evidence: the casualty experiment kept `casualties` with a `survivors`
  cap penalty (§93, frozen at `d9675b6`). The losing position of each
  switch is still code: `chipRule.ts` tests `chipMode` at five places.
  TODO: "The survivors end sequence, unexercised live." The balance
  sweep's `--set` can still select either (`health.chipMode` is in its
  registry).
- Gotchas: **#129**: the shipped pair reads both vocabularies on every
  capped turn, so the survivors' numbers stay needed whatever happens to
  the switch.
- The road map: Round 9's Retreat is "coherent ONLY under the casualty
  chip rule" (META-ROADMAP Round 9, Retreat), so a planned mechanic already
  assumes the shipped position.
- A signed call the row had not been held against
  (`archive/encounter-feel-spec.md`, the casualty chip rule): "Both
  rules stay alive behind `health.chipMode`", because "the paired
  same-seed A/B of the rule flip at any config is the experiment's
  instrument all round". The experiment closed on KEEP (§93). DESIGN
  "The encounter loop" still says "both stay live behind config" and
  calls the rule an experiment that §93 keeps or rolls back, so a trial
  here rewrites that paragraph too. BALANCE names the switch in one
  entry, the experiment's flip read (2026-09-04, §91f).
- `chipRule.ts`, read whole on 2026-10-13. The survivors arithmetic
  stays whatever is decided, since a capped turn pays it. One rule in
  place of the two switches takes out about 20 of the file's 251 lines:
  the two exposure bounds' either-or, two guards on the mode, and the
  end-of-turn block that only (survivors, casualties) reaches. The rest
  of what it removes is in the tests' matrix of four pairs and the
  sweep's registry (`tests/fuzz/commands/run.ts:171`), not counted.
- Fate: **trial**, in the run phase: one rule in place of two switches
  (120f sizes the tests and the fuzz side).
- Signed: **trial** (the user, 2026-10-13: "survivors is no longer in
  consideration. Casualties is the basis going forward, and any
  experiments will be based off of it").

**A mechanism the shipped value turns off.**

**A-12 · `health.fatiguePerStack` = 0, with `fatigueMaxStacks`** (`src/run/fatigue.ts`, 57 lines)
- In play: Nothing today. Switched on, a unit sent out again in the same encounter would take the field with less health for each earlier turn it fought there (10 % a turn at the spec's rate, down to half). At the shipped rate of 0 no unit is ever tired.
- Evidence: at 0 `fatigueEffect` returns nothing and no unit is tired.
  One game line reads the rate; tests set it at three places. BALANCE's
  run log holds a paired read of 0.1 against 0 that ends "fatigue back
  to 0".
- Gotchas: none.
- The road map names it. META-ROADMAP Round 9: "Fatigue — the
  design round (`fatiguePerStack` is 0 …) Free-form; exit = a playtest
  verdict; no pre-commitment … this round inherits whatever that
  decided." The census first leaned "delete" here without having looked
  there.
- Fate: **keep.** Round 9 is its named consumer, and what it inherits is
  this seam at rate 0.
- Proof: sim and config.
- Signed: **keep** (the user, 2026-10-13).

**A-13 · `leveling.halfCoverDamageMult` = 1** (`src/sim/effects/propose.ts:114`)
- In play: 148 half-cover pieces stand on five of the eleven boards (labyrinth, endlessCorridors, junctionAmbush, strafingFunnel, desertFortress). They occupy their cells, and ranged attacks see through them. The rule under this row is that a shot crossing one does less damage; at the shipped 1 it does the same damage. Removing the rule changes nothing in play, and the pieces stay where they are.
- Evidence: the one reader is `behindCover ? LEVELING.halfCoverDamageMult
  : 1`, which is 1 either way. The comment above it says half cover
  "halves the damage"; at the shipped 1 it changes none. To find
  `behindCover`, every proposed strike gathers the half covers and walks
  a line of sight over them (`propose.ts:111-113`), for a multiplier of
  1. `src/sim/positioning.ts:123` names the multiplier in a comment; what
  positioning does with cover was not read.
- Gotchas: #72 is about where half cover is authored, not this number.
- Fate: **delete** the key, the multiply and the per-strike walk.
- Proof: sim and config.
- Signed: **delete** (the user, 2026-10-12: "A13 can definitely go. Half
  cover was a mechanic from the MVP era, IIRC, and it wasn't particularly
  fun"). The multiplier only, confirmed the same day: "Static units that
  do not block line of sight are a pretty important part of the game.
  Having attacks that go through them only deal fractional damage made
  the fights slow and kinda boring". The 148 pieces stay.

**A-14 · `growthRates.power` = 0 on all 23 units** (`src/config/units.ts:118`; `src/sim/leveling.ts:104`)
- In play: `power` is what a unit costs its own pool when it falls: 1 for twenty units, 2 for three, and an encounter can set it for an enemy. This key would make it rise with level. Every unit has 0, so a level-10 unit costs what a level-1 unit costs. Removing the key keeps it that way.
- Evidence: every unit sets 0, and `src/config/units.test.ts:361` asserts
  it is 0, so the key cannot move without that test changing.
- Gotchas: #96 names `growthRates` for another reason.
- The intent is settled: the casualty spec signs power as a headcount
  weight, "fixed per archetype", with `growthRates.power = 0`
  (`archive/encounter-feel-spec.md`; DESIGN "The encounter loop": "no
  growth").
- A second reader the row had missed, found 2026-10-13. A player
  recruit's level-up rolls once for each of eleven stats, in a fixed
  order with power last, and reads the rate by a computed key
  (`src/sim/leveling.ts:66-67`; the file's header: "Consumes 11 RNG
  draws per level"). At a rate of 0 the roll never succeeds, and it is
  still drawn. Taking the key out takes power out of that list, so each
  level draws ten, and every roll after a recruit's first level lands on
  another number: recruits level up differently on every seed. Read from
  the code and not run. The row had named line 104 alone, the enemy
  side, which draws nothing.
- Fate: **keep** (changed from "ask, lean delete"). The deletion is a
  behaviour change. Keeping the roll and dropping the key would leave a
  draw for a stat that cannot grow, which explains itself worse than a
  rate of 0 pinned by a test. If the level-up stream is ever re-drawn
  for another reason, the eleventh draw can go with it (a TODO line, if
  the user wants one).
- Proof: none needed for a keep.
- Signed: **keep** for this round (the user, 2026-10-13), with a TODO
  for a later cleanup round: "A14 definitely should be dropped at some
  point". TODO "§120 riders".

**A-15 · three more at a neutral value, proposed kept**
- In play: `campsStartHostile` at 1 would make every neutral camp attack the player from the first tick, a probe for measuring forced camp fights. `budgetOffset` would add a flat amount to every enemy level budget. `chipMultiplier` scales every charge to the health pools. Each sits at the value that does nothing.
- `sim.campsStartHostile` = 0: one line (`src/sim/World.ts:867`); the
  loader's header calls it the forced-engagement probe dial for
  `--set sim.campsStartHostile=1`. **Keep**: a probe the sweep names.
- `difficulty.budgetOffset` = 0: one term of the enemy budget, in the
  sweep's registry. **Keep.**
- `health.chipMultiplier` = 1: read at seven places in `chipRule.ts` and
  five in the fuzz reporters; tests set it. **Keep.**
- Looked at and not candidates: `stats.hitChanceCap` = 1 is a clamp;
  `health.seamHealFloor` = 1 is "heal to full at a seam"; the four
  `difficulty.*Multiplier` keys at 1 are what Escalation's levels
  multiply onto.
- Signed: **keep**, the three (the user, 2026-10-13).

**Vocabulary no content uses yet.**

**A-16 · the authoring vocabulary, as a class**
- In play: These are the words events, encounters, abilities, daemons and packets can be written in. A player meets only what the content uses: every gated event choice today asks for "at least N bits" or "a flag is set", and none asks about health, roster size, a daemon owned or the character played.
- Evidence, three counts from the walk:
  - *36 keys in union arms no entry uses.* Event conditions: 10 of 12
    kinds (`poolHealthAtLeast`, `poolHealthAtMost`, `hasDaemon`,
    `hasPacket`, `cacheHasRoom`, `rosterSizeAtLeast`, `rosterSizeAtMost`,
    `characterIs`, `flagIs`, `not`; the events use `bitsAtLeast` and
    `flagSet`). Event effects: 3 of 11 (`removePacket`, `removeDaemon`,
    `removeUnit`). Encounters: a `fixed` and a `median` level budget
    (every wave uses `mean`), a `fixed` level cap, a `fixed` unit level.
    Packets: an injected rule's `filter`.
  - *28 optional keys no entry sets*, among them a daemon rule's `won`
    filter, a stat mod's `mul` (twice), an encounter's `layouts`, a
    sector entry's `weight` and `minHop`, a unit's `footprint` and
    `statusSusceptibility`, a chain's `hopDelaySeconds`, a summon's
    `count`, `radiusCells` and `at`, and the fx moments `travel`,
    `recovery`, `applied`, `expired`.
  - *23 enums with a value no entry holds*, among them a hook's
    `encounterStart` and `encounterEnd`, six run stats no daemon
    modifies, a packet's `tile` target, an area's `line` and `cross`
    shapes, `caster` anchor and `allies` / `all` reach, a buff's three
    other merges, a status's `instances` and `ignore` merges, a scaled
    value's `strength`, `ranged` and `level`, a timeline effect on
    `release`, `travel` or `recovery`.
- Each has an interpreter arm, tests that write it (the level budget's
  kinds are written by tests at 27 places) and editor support under
  `tools/`. None was read past its declaration, and what each would
  remove was not counted.
- Fate: **keep, as a class.** It is the language content is authored in,
  and META-ROADMAP's Round 10 is content. Lean against pruning it here:
  each cut is small, and Round 10 would re-add some. If the user wants it
  pruned, each family becomes a row with its size, starting with `median`
  (120a found its sort pinned by nothing).
- Signed: **keep, as a class** (the user, 2026-10-12, call 4).

**A-17 · text only the editors show**
- In play: The names and descriptions of camps, encounters, boards and sectors as an editor shows them to an author. By type the game shows none of them to a player.
- `CampDef.name`, `CampDef.description`, `Encounter.description`,
  `LayoutSchema.description`, `SectorSchema.description`: by type only
  `tools/` reads them. The locale layer does not reach them (settled
  2026-10-13): it carries only fields a schema marks as prose, and its
  registry's header says of these five that they are "editor metadata,
  never rendered" and "all plain strings" (`src/i18n/families.ts:11`;
  camps have no prose family, and the encounter, sector and layout
  loaders each say the same of `description` beside their prose line).
- Fate: **keep**: an author's notes on the content, with no code behind
  them.
- Signed: **keep** (the user, 2026-10-13).

**On-off switches whose other position nothing selects** (added at the
read, 2026-10-13). The walk lists an enum with a value no entry holds. A
true-or-false key is not an enum, so these were classed "used" and had
no row. Found by listing every boolean in the loaders of the
single-object configs. None was sized, and the tests behind each were
not read.

**A-21 · four on-off dials**
- `deck.grantQueue.passIsFinal` = true, with `RunConfig.passIsFinal`
  (`src/run/Run.ts:3448`, `:3522`). In play: before a turn the player
  uses or passes each granted action (a redraw, an empower) in the order
  it was earned. Off, any pending grant could be used in any order and
  Pass would do nothing. The loader's header calls off "the loosened
  mode the shape-lock reserved for 'not fun' feedback". One block of
  tests runs under off so that it can empower without passing a redraw
  first (`src/run/Run.test.ts:1750`, nine uses). Lean: **keep**. The
  feedback it was reserved for can still arrive while the public build
  circulates, and taking it out rewrites that block for two conditions.
- `sim.blockCampTurnEnd` = true (`src/sim/World.ts:2264`). In play: a
  battle does not end while the side that won still has a camp fight
  open. Off, the last enemy's death ends it with the camp half fought.
  On by the user's feel verdict of 2026-08-09 (the loader's header;
  DESIGN "Win condition"). Two test files set it off, one test to pin
  the off behaviour and one so that its fixture's win is not held. Lean:
  **ask**: the question is closed, so the key could go, at the price of
  the tests that lean on off.
- `tiles.applyStatusOnEnter` = true (`src/sim/World.ts:1646`;
  `src/bot/sensors.ts:177`). In play: a unit that steps into mud is
  poisoned. Off, mud still slows a unit and spoils its aim, and does not
  poison. The loader's header: "the mud→poison
  trial (USER-LOCKED default ON, easy to flip if a playtest dislikes
  it)". Lean: **ask**, whether that trial is over. If it is, the key
  goes, and after A-03 it is the last key of `config/tiles.json`, so the
  file and its loader go with it.
- `playback.speeds[].enabled` and `playback.pauseEnabled`, all true
  (`src/ui/PlaybackSpeed.ts:56`; `src/ui/HUD.ts:275`;
  `src/scenes/BattleScene.ts:271`). In play: each speed button and the
  pause button is shown. Off, that button is not offered. The loader's
  header calls them "difficulty-system groundwork"; the Round 8 spec
  struck "per-speed enable" (D8) and Escalation shipped without it. Lean:
  **keep**: the code is in the UI, where no proof reaches a reshaping
  (TESTING.md "The oracle map"), and "a tool taken away" is a kind of
  lever the spec leaves to Round 10.
- Gotchas: none names any of the four.
- Proof: sim and config for the first three.
- Signed (the user, 2026-10-13). `passIsFinal`, **keep** ("until we get
  some feedback"). `blockCampTurnEnd`, **delete** the switch ("if combat
  with anything is ongoing, the battle continues"). `applyStatusOnEnter`,
  **delete** the switch ("mud tiles are more generally going to get
  reworked in the future. The trial is over, so I think we might as well
  delete this"). For both, the shipped behaviour stays, confirmed: "delete
  the switches but keep the shipped behavior was what I meant". With
  A-03 the second empties `config/tiles.json`, so the file and its
  loader go: config files 34 to 31 with A-02 and A-09. The playback
  flags, **keep**. The mud rework is noted in META-ROADMAP Round 9.

### 1.4 The `RunConfig` fields

All 25 have a reader in the game. What differs is who sets them. "Tests"
alone means no script, tool, instrument or page sets the field.

| field | set from | tests apart, set by |
|---|---|---|
| `seed`, `hopCount`, `startingRoster`, `forcedLayoutId`, `forcedEncounterId`, `daemon`, `character` | a URL parameter | the fuzz harness or the gauntlet, and for some the run-config and node-map tools |
| `sectorHops`, `forcedEventId`, `startingBits`, `escalation` | a URL parameter | the page (`escalation`) and the fuzz command line (`sectorHops`, `escalation`); the other two by the URL alone |
| `firstNodeKind`, `mapMaxWidth` | a URL parameter | the node-map tool |
| `eliteChance`, `portChance`, `eventChance` | a fuzz flag | the node-map tool |
| `bitsMultiplier`, `drawAmountAdd`, `grants` | a fuzz flag | `tests/fuzz/commands/run.ts` |
| `waveSizeMultiplier`, `levelBudgetMultiplier`, `enemyMoraleMultiplier` | code only | tests alone (5, 2 and 5 places) |
| `passIsFinal`, `sectorMap`, `eventCatalog` | code only | tests alone (5, 7 and 20 places; `eventCatalog` is also named in the arbitrated strategy) |

**A-18 · the six fields only tests set**
- In play: nothing a player can reach. They are how a test sets up a
  run: a difficulty multiplier, the test's own event list or sector
  graph, the looser rule for the grant queue.
- Fate: **keep**, for five of the six. Each is the seam its tests use to
  reach a mechanism that ships: the three multipliers are a per-run
  override of the `difficulty.json` keys (`resolveDifficultyMultipliers`),
  and Escalation's levels multiply onto whichever value results
  (`withEscalation`); a test catalog or
  sector map is how the event and sector code is tested without the
  shipped content. The sixth, `passIsFinal`, selects a rule that does
  not ship, and is taken with its config key in A-21.
- Signed: **keep**, the five (the user, 2026-10-13). `passIsFinal` is
  open in A-21.

### 1.5 The URL parameters

The 13 run dials (`seed`, `hops`, `sectorHops`, `roster`, `layout`,
`encounter`, `firstNode`, `event`, `width`, `daemon`, `character`,
`bits`, `escalation`) each set a `RunConfig` field above. Four more: `bp`
(the board panel's bookmark, which the menu's boot rule also reads),
`fail` (the dev build's failure plant), `store=deny` and `store=full`
(the dev build's store modes).

**A-19 · all 17**
- In play: how the user, the tools and the probes open a run at a known
  seed, board, roster or node, and how the dev build is told to fail or
  to lose its storage.
- Fate: **keep**: each is a dev workflow or a probe's address
  (`process/browser-pane.md`).
- Signed: **keep** for this round (the user, 2026-10-13), with a TODO
  for a later cleanup round: "A19 should eventually be reviewed; I feel
  like the many URL parameters need to be simplified at some point".
  TODO "§120 riders".

### 1.6 The fuzz flags

Of the 65, 52 are written by something besides the parser and the
instruments: a script, the board, a tool, or a doc that is not archived.
49 are in BALANCE.md, which is a log, so a mention there shows a protocol
once used the flag and not that one does now. 13 are written by none of
those:

| flag | written in | what it is |
|---|---|---|
| `--eval-shard`, `--job`, `--out-file` | the parallel runner | how it starts its child processes. **Keep.** |
| `--refine-k`, `--refine-perturbs`, `--refine-radius` | `cli.ts`'s header | the three dials of `--refine` (how many of the search's best to perturb, how often, how far) |
| `--k` | `cli.ts`, `run.ts`, `search.ts` | the searcher's rollouts per candidate; its note says to run `--k-telemetry` at `--k=8` |
| `--shadow-sample` | the arbitrated strategy; 1 test | take one decision in m for `--shadow-horizon` |
| `--arena` | `cli.ts`, `commands/arena.ts`, `objectiveCoverage.ts`; 2 tests | a command of its own: one forced battle with no run around it, for tuning the objective strategies |
| `--bits-multiplier` | `commands/run.ts`; 2 tests | scales a run's bits income, for the economy sweeps; the one setter of `RunConfig.bitsMultiplier` besides tests |
| `--flip-telemetry` | the arbitrated strategy; 2 tests | judges each arbitrated decision a second time under another tier and counts the disagreements |
| `--grant-epsilon` | 2 tests | an ablation dial for when a free action is spent |
| `--camp-raid` | the arbitrated strategy; 1 test | `off` leaves the camp-raid decision out of the arbitrated bot, to read what the decision is worth |

The first five of the ten tune a flag that is live (`--refine`,
`--k-telemetry` and `--shadow-horizon` are in BALANCE.md). The other five
are each an instrument built for one investigation (the parser's notes
date them from J4 to 85g).

**A-20 · the ten that are not the runner's own**
- In play: nothing; these are the balance tools' own dials.
- The five investigation instruments, looked at on 2026-10-13 (the
  parser's notes in `tests/fuzz/commands/args.ts`, and the lines that
  name each option, counted by a word search and not read whole):
  - `--arena`: one forced battle with no run around it, to try the
    orders the bot can give its team (focus, hold and the like) and
    write the best to a file. The largest: a command file of 169 lines
    and a runner of 301 (`commands/arena.ts`, `arena.ts`), with 108
    lines of tests. `objectiveStrategy.ts` and `objectiveCoverage.ts`
    are shared with the harness and would stay, and the coverage bot's
    test drives it through the arena's runner
    (`objectiveCoverage.test.ts:24`), so that test would be re-pointed.
    **It carries a signed
    stamp**: BALANCE "The instrument registry" (the user, 2026-07-29)
    marks the arena's objective strategies **niche**, "kept and valid
    for its stated purpose, opt-in", "never a run-layer balance input".
    The measuring arm that table names does not carry `--objective`.
    Lean: **ask**; cut it if the user no longer reaches for it.
  - `--bits-multiplier`: scales a run's bits income, for economy sweeps.
    About ten lines and a parse test. It is refused together with
    `--arbitrate`, which the measuring arm carries (`args.ts:666`), and
    `--set=difficulty.bitsMultiplier=<f>` reaches the same lever through
    the config and is not among the flags that arm refuses
    (`balanceSweep.ts:71`; read, not run). Lean: **delete**
    the flag. `RunConfig.bitsMultiplier` then has tests alone as its
    setters, like the three of A-18.
  - `--flip-telemetry`: judges each of the arbitrated bot's decisions a
    second time under another inner tier and counts the disagreements,
    into a file of its own. The option runs through seven files of the
    instruments (`run.ts`, `rollout/driver.ts`, `reporters.ts`,
    `parallel.ts`, `mergeStages.ts` and two more), 28 lines that name
    it. Built
    for one question, whether the cheap tier decides as the dear one
    does. Lean: **ask**.
  - `--grant-epsilon`: overrides how sure the bot must be before it
    spends a free action, built to diagnose one gate. About ten lines
    and a parse test. Lean: **delete**, unless the user reaches for it.
  - `--camp-raid=off`: leaves the camp-raid decision out of the bot, so
    that a pair of runs reads what the decision is worth. About fifteen
    lines and a parse test. Lean: **keep**: camps are content that
    Round 10 adds to, and this is the arm that prices a change there.
- Asked at the read (the user, 2026-10-13): is the arena the isolation
  testing against specific encounters, most often elites? No. That is
  `--encounter=<id>` on a run (BALANCE "Forced isolation"; for an elite,
  `--hops=2 --first-node=elite --encounter=<id>`), and no row touches
  it. The arena never fields an authored encounter: it rolls a wave at
  the roster's budget (`tests/fuzz/arena.ts`, `buildEnemyTeam`) and
  takes no `--encounter`. What it tunes is which orders the bot gives
  its team, and the measuring arm, as BALANCE's registry lists it, does
  not carry `--objective`. Apart from its own tests its runner has one
  use, in the smoke tier: the coverage bot's test drives it at three
  places (`objectiveCoverage.test.ts`).
- Asked at the read: is the flip-rate read from teaching the bot micro,
  and is it in the balance protocol? It is from the round after, the
  rollout-arbitration round (2026-07-31): the same idea as the micro
  round's K-flip read, applied to the bot's run-layer decisions (port
  buys, daemon picks, packet fires, redraws, node choice, events). Its
  verdict was signed 2026-08-01. The flag is named nowhere in the
  tracked tree outside the instrument and its tests (a search of all of
  it but the archive), so no protocol runs it.
- Fate: the five that tune a live flag, **keep** with it. The five
  investigation instruments, **ask**, with the leans above, now or at
  the bot and fuzz instruments' phase: whether one is a tool the user
  still reaches for is theirs to say. After the two answers above the
  lean on `--arena` and on `--flip-telemetry` is **delete**, each sized
  at the instruments' phase, with the coverage bot's test kept.
- Proof: instrument.
- Signed (the user, 2026-10-13). Of the five investigation
  instruments: `--bits-multiplier` **delete** ("looks like it's been
  obsoleted"), `--grant-epsilon` **delete**, `--camp-raid` **keep**,
  and, after the two answers above, `--arena` and `--flip-telemetry`
  **delete** ("Delete both"), with the coverage bot's test kept. The
  five tuning flags, **keep**.

### 1.7 Content nothing refers to

None found. Every ability is named by `config/units.json`; every
encounter, event and layout by `sectors.json`; every camp by a layout or
`terrain.json`; every reward table by a camp, an encounter or an event;
every daemon and packet by `rewards.json`; both sectors by
`sector-map.json`. The seven scenery units and the status `rejuvenate`
are named by source files, and the three characters are taken whole by
the select screen. This is a search for the quoted id, which cannot tell
an id from the same word used for something else.

### 1.8 For the trials (120f)

- The config files by keys reached: `economy`, `selection` and `spawn`
  hold one each, `objective` two, `escalation` four, `playback` and
  `tiles` five. Rows A-02, A-03 and A-09 would remove one file, leave
  `tiles` with one key, and remove a second file; A-21, as signed,
  takes that last key and so a third file.
- Two config files only the fuzz instruments read are in the game's
  config stamp, by a stated choice (`src/config/configHash.ts`, header).
- META-ROADMAP's third inert field of the flight seam, "the one-member
  plane union", is not a config key: a plane argument with one value,
  passed through the occupancy calls. It was signed as a seam on
  2026-06-28 and Round 9's step zero re-audits it (A-04). Lean: leave it
  for that step.
- Four loaders type their schema by a hand-written interface (`camps`,
  `encounters`, `events`, `rewards`): their 148 schema keys each repeat
  an interface member by name.

### 1.9 Calls for the user at this stop

1. **The row format above,** which every later list is written in.
   *Signed 2026-10-12.*
2. **Scope: the other command lines' flags are counted and not listed**
   (the board's, the gauntlet's, the corpus's, the tools'). Lean: leave
   them to the instruments' phase. *Signed 2026-10-12.*
3. **The full table of 616 is not tracked.** It is one command away on
   this machine (`scratch/120c/`, in WORKLOG §120). Lean: leave it
   untracked, since each deletion would stale a tracked copy.
   *Signed 2026-10-12.*
4. **The authoring vocabulary is kept as a class** (A-16) and not pruned.
   *Signed 2026-10-12.*
5. **The fates,** row by row: A-01 to A-21 (A-21 added at the read,
   2026-10-13). Signed for deletion: A-01, A-02, A-03, A-05, A-07, A-08,
   A-09, A-10, A-13. Signed kept: A-06, A-12, A-14, A-15, A-17, A-18
   (five of its six fields) and A-19, and A-16 as a class. Split: A-04
   (`ignoresTerrain` delete, `layer` keep). Signed as a trial: A-11.
   Signed item by item: A-20 (four of the investigation flags delete,
   `--camp-raid` and the five tuning flags keep) and A-21 (two switches
   delete, `passIsFinal` and the playback flags keep). None is open:
   the read of section 1 closed on 2026-10-13.

## 2. Exports, files and exact duplicates (120d)

Written 2026-10-13 and **not yet read**: the read is at 120e's stop.
Rows A-22 to A-33 are open. What the user is asked is in 2.8.

A fourth proof recurs in this section:

- **export**: for an export or a file that nothing reaches. Delete it,
  then the type check, which names any reader left behind;
  `npm run oracle -- build-hash` equal to the ref (`--dev` for `src/dev`),
  since the bundler already drops an export nothing imports; the suite;
  and `reach-diff` when a test goes with the code. In `src/sim`,
  `src/run` and `src/config` the corpus and the fuzz diff as well. A
  class's method is not dropped by the bundler, so deleting one moves the
  build's bytes: there the proof is the type check, the suite and the
  page drive.

### 2.1 What was counted

| | count | how |
|---|---|---|
| exported names under `src` | 1,523, in 275 files | `npm run oracle -- refs --all`, after the fix in 2.7. Five hand on a name another file declares and are counted there, so 1,518 declarations |
| top-level declarations | 4,658, in 403 files | every one in a `.ts` file that is not a test, under `src`, `tests`, `tools` and `scripts`, exported or not |
| members under `src` | 2,055, in 279 files | each method, accessor and field of a class that is not `private`, and each member of an interface |
| tracked files that are not docs | 974, with 394 entries | an entry is what a person or a tool starts: the game's page, 17 tool pages, the 28 files that `package.json`'s commands start, the hook, 329 test files and test configs, seven build and editor configs, and 11 files a doc tells a person to run |
| token runs | 762 files | every `.ts`, `.css` and `.glsl` file under `src`, `tests`, `tools` and `scripts` |

### 2.2 The exports, by class

`refs` says who reads a name one step out. This section's walk follows the
reads to the end: a declaration is **live** when the module-level code of
a file some entry runs reaches it through any chain of reads, **test-kept**
when only a test does, and **dead** when nothing does. So an export whose
one reader is itself read by nothing is dead here, where `refs` calls it
used.

| class | exports | lines | rule | fate |
|---|---|---|---|---|
| **dead** | 25 | 54 | nothing that runs reaches it, and no test | A-22 |
| **test-kept** | 39 | 243 | only tests reach it | A-23, A-24, A-25 |
| **the `export` is unneeded** | 257 | | live, and nothing outside its file reads it | A-26 |
| **exported for a test** | 188 | | live, and outside its file only tests read it | A-27 |
| **used** | 1,009 | | live, and another file that runs reads it | keep |

Of the live exports, 99 in 35 files are reached by a tool, an
instrument, a script or a build config and not by the game's page (938
lines; `src/config` 12 files, `src/sim` 7, `src/i18n` 7). The two files
looked at are how the editors read the ability catalog and how the build
stamps its ID. The 99 were not read one by one, and none is a row.

**A-22 · the 25 exports nothing reaches**
- In play: nothing. No code that runs and no test calls any of them.
- What they are: seven functions, three constants and fifteen types.

  | name | declared | what it was |
  |---|---|---|
  | `healAmountFor`, `magicBoltDamage`, `catapultShotDamage` | `sim/stats.ts:155`, `:164`, `:173` | the heal and damage formulas of three abilities from before abilities were data; each is `might` plus one stat |
  | `firstOpOf` | `config/abilities.ts:84` | the first effect of a kind on an ability; its comment says the unit card and the editor read through it, and neither does |
  | `proseFamily` | `i18n/families.ts:47` | a lookup of one prose family by name |
  | `closeTooltip`, `openTooltipTrigger` | `ui/tooltip.ts:347`, `:352` | close whatever tooltip is open; the open tooltip's element "for probes and tests" |
  | `WORLD_COMMAND_KINDS` | `sim/Command.ts:23` | a list of the three battle command kinds |
  | `EFFECT_DURATIONS`, `EffectDuration` | `config/packets.ts:86`, `:87` | the four duration words, read only by the type beside them |
  | `RangeSchema`, `Range` | `config/schemas.ts:11`, `:17` | a low-and-high pair; the file is A-29 |
  | `Vec2` | `core/types.ts:13` | a 2D vector type |
  | 12 one-line types | `SectorMapNode`, `SectorEncounterPools`, `ProceduralCampsConfig`, `FxKey`, `RedrawConfig`, `ScalingStat`, `ScalarOrScaled`, `PeriodicOp`, `MoveOp`, `ApplyStatusOp`, `StatusPeriodic`, `StatusBehavior` | names for types nothing names |

- Evidence: the walk, and for each name a word search of every tracked
  file outside the type check (the `.mjs` and `.js` scripts, the shell's
  probes, the pages), which found none. ARCHITECTURE.md names `Vec2`,
  `FxKey` and `PeriodicOp`, and `plans/sound-registry.md` names `FxKey`;
  each deletion's commit fixes the sentence.
- Not settled: `closeTooltip`'s comment gives two occasions, "a scene
  swap, a modal opening", and neither calls it. Whether a tooltip can
  outlive a scene swap was not tried in the page. It is a question for
  the render and UI phase's kickoff, and deleting the function does not
  change the answer.
- Gotchas: none names any of the 25.
- Fate: **delete**, each in its subsystem's phase.
- Proof: export.
- Signed:

**A-23 · seventeen that only tests reach, each with a reason to stay**
- In play: nothing a player meets. Each is how a test, a gate or a
  build script reaches code that ships.

  | names | why it stays |
  |---|---|
  | `EMPOWER` · `getSelectionStrategy` · `getFocusTileResolution` | they do not stay: each is the code of a row already signed for deletion (A-02, A-09, A-10) |
  | `SUBSET_RANGES`, `SubsetRange`, `PRIMARY_EXCLUDES` (`render/fontSubset.ts`) | `scripts/build-font.mjs` imports them, outside the type check, so the walk cannot see their reader. Found by the word search |
  | `subsetCovers` · `SILENT_EVENTS`, `SilentReason` | read by two permanent gates: the font coverage and "every bus event has a sound or a silent reason" |
  | `scanReservedSwapPartners` (`sim/actions/SwapAction.ts:222`) | a test-side recount of the swap index from scratch, kept on purpose so the check does not consult the cache it checks |
  | `mapValues` (`journal/replayDigest.ts:63`) | what a declared mapping is written with, for the second form of byte identity (the spec's D3) |
  | `sumLossEvents` (`run/chipRule.ts:243`) | one side of the chip rule's pin |
  | `parseAbilityDef`, `parseStatusDef` | how 41 and 24 test sites build a fixture through the real schema |
  | `isClaimed` (`sim/occupancy.ts:379`) | how four test files ask whether a cell is claimed, at 17 places |
  | `getReducedMotionOverride`, `getShakePolicy` | how the settings tests read back what a setting set |

- Fate: **keep** the fourteen. Whether a test earns the seam it uses is
  120e's question.
- Signed:

**A-24 · the locale layer's way in, ten exports** (`src/i18n/locale.ts`, `ui.ts`, `provenance.ts`, `credits.ts`)
- In play: nothing today. The game ships one language. These register a
  second one (`registerLocale`, `registerUiLocale`), reset the registry
  between tests, mark and list translations that have gone stale
  (`setFuzzyMarker`, `fuzzyEntries`, `isAuditClean`), and list a
  language's translators for the credits (`localeCredits`, with
  `registeredLocaleFiles` and `registeredUiTables`). No screen shows
  those credits: `src/i18n/credits.ts` is a file only a test loads.
- Evidence: the walk. 25 test reads, and no reader that runs.
- Plans: META-ROADMAP's Round 7 put the layer in with "no translation
  work", and its Round 8 notes say the locale has "no row in Settings;
  the row comes with a second locale". A search of that file for
  "locale" and "translat" found no round that schedules one.
- Fate: **ask**. Lean: **keep**. The fallback and stale-marker code
  paths are the layer's point, they run only when a second language is
  registered, and these ten are how the tests register one. Cutting them
  leaves the layer untested.
- Signed:

**A-25 · twelve that only their own tests call**
- In play: nothing. Each has a test that calls it and checks its answer,
  and nothing else reads it, so the test holds up code the game does not
  run.

  | name | declared | what it is | lean |
  |---|---|---|---|
  | `basicAttackDamage` | `sim/stats.ts:146` | the fourth of A-22's old formulas; 5 test reads | delete |
  | `WALL_GLYPH`, `HALF_COVER_GLYPH`, `RUBBLE_GLYPH` | `sim/environment.ts:27`, `:35`, `:130` | each a copy of a glyph that the unit catalog holds; 9 test lines check the two copies agree | delete, as A-03 |
  | `rarityStars` | `ui/rarityDisplay.ts:53` | the star run as one string; the game calls `rarityStarParts` | delete; its 4 tests call the other |
  | `orderRoster` | `ui/rosterOrder.ts:55` | the roster in display order; the game calls `orderRosterWithIndices` | delete; its 12 tests call the other |
  | `dump` | `run/NodeMap.ts:928` | a text print of a node map, 32 lines; 3 test reads | delete |
  | `hazardCells` | `bot/sensors.ts:224` | the set form of `hazardCellList`; 1 test read | delete |
  | `footprintFits` | `sim/occupancy.ts:168` | whether every cell of a footprint is free; 7 reads, all in its own test | delete |
  | `empowerAvailability`, `redrawAvailability` | `run/empower.ts:48`, `run/redraw.ts:43` | how many empowers and redraws a grant has left; the game asks `empowerRejection` and `redrawRejection` | delete |
  | `isActiveNeutral` | `sim/Unit.ts:73` | whether a neutral unit is a camp member and not scenery. Its comment calls it "THE active-neutral predicate"; the game does not call it | **keep for the neutral-team trial** (120f), which sizes how the game makes that test today |

- Gotchas: #94 names `basicAttackDamage` as what reads a unit's
  archetype tag. The reader today is `damageStatFor`, and the deletion's
  commit corrects the sentence.
- Fate: **ask**, item by item, with the leans above: whether a test is
  redundant is the user's call.
- Proof: export, with `reach-diff` for each test that goes.
- Signed:

**A-26 · the word `export` on 257 declarations**
- In play: nothing. Each is used, inside the file that declares it.
- What they are: 134 interfaces, 61 types, 46 constants and 16
  functions, most in `src/ui` (48), `src/sim` (40), `src/config` (31),
  `src/dev` (29) and `src/run` (29).
- Ten drawn by a seeded draw (seed 120), for the user to check against
  what they know:

  | name | declared | kind | read by |
  |---|---|---|---|
  | `ModalOptions` | `ui/modal.ts:41` | interface | its file, 1 |
  | `ROLLOUTS_PER_CANDIDATE` | `bot/RolloutSearchDriver.ts:48` | const | its file, 1 |
  | `ShippedFace` | `render/fontSubset.ts:81` | interface | its file, 1 |
  | `StatsConfig` | `config/stats.ts:82` | type | its file, 1 |
  | `PoolSide` | `ui/poolGauge.ts:21` | type | its file, 2 |
  | `EmpowerDisplay` | `render/statusDisplay.ts:53` | interface | its file, 1 |
  | `assertProceduralCampRefs` | `config/camps.ts:174` | function | its file, 1 |
  | `JournalStamp` | `journal/JournalRecorder.ts:43` | interface | its file, 1 |
  | `RunEscalation` | `ui/GameOverScreen.ts:51` | interface | its file, 2 |
  | `CopySteps` | `ui/copyText.ts:13` | interface | its file, 1 |

- Fate: **delete the word**, in each subsystem's phase and not as one
  sweep. What it buys is a guard: the type check refuses a local that
  nothing reads and says nothing of an export, so once the word is gone
  a later deletion that orphans one of these fails the hook. What it
  costs is a one-word edit at 257 places in 132 files.
- Proof: export. The build's bytes do not move.
- Signed:

**A-27 · 188 exported for a test**
- In play: each is used by the game inside its own file, and a test
  reads it from outside: 87 constants (a tuning number a test pins), 69
  functions, 31 types and one class.
- Ten drawn (seed 120): `STAR_FILLED` and `STAR_HOLLOW`
  (`ui/rarityDisplay.ts`), `SOUND_SOURCES` (`audio/AudioPlayer.ts:50`),
  `stripMotion` (`render/fxRegistry.ts:305`), `parseEscalation`
  (`config/escalation.ts:73`), `Palette` (`render/palette.ts:91`),
  `CHOKE_MAX_CUT` (`bot/scripts/chokeHold.ts:35`), `ANIM_HEALING`
  (`render/TerrainRenderer.ts:141`), `WEB_PROBE_KEY` (`store/web.ts:10`),
  `SHAKE_MAX_PX` (`ui/lossFx.ts:42`).
- Fate: **keep**. The export is the test's way in, and which of those
  tests are needed is 120e's list.
- Signed:

### 2.3 Members nothing reads

Beyond the cut's letter, and built because a class is one node to the
walk: `Run.ts` and `World.ts` hold about a third of the sim and run code
in two classes.

| | nothing reads | only its own file | only tests, and not its file | used |
|---|---|---|---|---|
| class methods and accessors, 402 | 17 | 12 | 15 | 336 |
| class fields, 111 | 4 | 5 | 0 | 93 |
| interface members, 1,542 | 136 | 593 | 57 | 643 |

(31 class members and 113 interface members that their own file reads
and tests also read are left out of the four columns.)

**A-28 · 21 class members nothing reads** (81 lines)
- In play: nothing; no code and no test calls them.

  | members | where | note |
  |---|---|---|
  | `dispose()` on five renderers, and `Renderer.stop()` | `ApronRenderer`, `BackdropRenderer`, `SpriteRenderer`, `TerrainRenderer`, `UnitOverlayLayer`, `Renderer.ts:447` | teardown that never runs. `Game.ts:313-344` builds each renderer once, for the life of the page, so nothing leaks by its absence |
  | `getCameraView()`, `getCameraMode()` | `render/Renderer.ts:279`, `:395` | |
  | `count()`, `updateLevel()` | `render/UnitOverlayLayer.ts:218`, `:342` | |
  | `setDither()` | `render/ApronRenderer.ts:274` | |
  | `cellSizePx`, `atlasWidthPx`, `atlasHeightPx` | `render/FontAtlas.ts:139-141` | three fields |
  | `setMuted()`, `isMuted` | `audio/AudioPlayer.ts:287`, `:291` | `plans/sound-registry.md` said the options menu "will finally call" the mute; by that plan's own later note the settings call `setVolume(master, sfx)`, and nothing sets the mute |
  | `isOpen()` on three overlays | `CardListModal`, `CreditsOverlay`, `SettingsOverlay` | |
  | `HUD.hide()` | `ui/HUD.ts:600` | 11 lines |
  | `EffectAction.orphanPolicy` | `sim/effects/EffectAction.ts:76` | a field set at one place and read nowhere; the ability's own key of that name is read at four places |

- Plans: the names of this row, of A-22 and of A-25 were searched in
  META-ROADMAP, `plans/`, DESIGN, TODO, BALANCE, PATHING and the
  archived specs and road maps. Apart from the mute, every hit is the
  archived road map of the phase that built the name.
- Evidence: `scratch/120d/members.ts`, and a search for `.name` in the
  60 scripts, probes, pages and pane procedures, which reach the game by
  name through `window.__game`. It found three words too common to
  settle: `.stop` and `.hide` here, and `.label` among the leads below.
  Those sites were not read.
- Fate: **delete**, each in its subsystem's phase, after its site is
  read there. Only `dispose()`'s was read here.
- Proof: the type check, the suite and the page drive. The build's bytes
  move, because a method ships whether or not it is called.
- Signed:

**Leads, not rows.** Fifteen class methods that only tests call (66
lines): on `World`, `shove()`, `bitsTallied()`, `queueLength()`,
`damageDealtBy()`, `utilityDoneBy()` and `swapReservedPartnerIndex()`;
on `Run`, `eventFlag()` and `registerTrigger()`; `Keybindings.rebind()`
and `overrides()`; and five more. None was read. `World.shove()` is a push, and
Round 9 plans forced movement, so it is not to be cut before that
kickoff reads it. They become rows at 120e, where the tests that call
them are classed. Of the 136 interface members nothing reads, 126 are
written somewhere and 92 are in the probe kit and the diagnostics report
(`src/dev/probe`, `src/dev/diag`, `src/diagnostics`), whose objects are
read as JSON by scripts outside the type check; the rest are leads for
each subsystem's kickoff.

### 2.4 The files, by what runs them

| | files | an entry that is not a test runs it | only tests load it | reached as types only | no import or path reaches it |
|---|---|---|---|---|---|
| `src`, code | 279 | 270 (the game's page 248; a tool, an instrument or a script 22) | 3 | 4 | 2 |
| `tests`, code that is not a test | 86 | 74 | 7 | 1 | 4 |
| `tools` | 66 | 65 | 1 | | |
| `scripts` | 21 | 19 | | 2 | |
| `shell` | 23 | 14 | 1 | 1 | 7 |
| `config`, `public`, `locales`, `assets` | 79 | 63 | | | 16 (loaded by folder: ten locale files, six fonts) |

The seven `src` files reached as types only or by a test alone hold the
event catalog, the command types and the stream keys, and are used. The
tests' own helpers account for six of the seven under `tests`. Every
script is started by a command, the hook or a doc. Of the seven shell
files no path reaches, two are started by the shell's own code through
a path built from pieces (`analyze-recording.mjs`, `frame-rate.js`; the
name search found them), and five by hand from the command in their
header: two probes of Round 8's and the three files of the display
test. ARCHITECTURE's tree lists all seven, and they are kept.

**A-29 · two source files nothing imports**
- `src/config/schemas.ts` (17 lines): `RangeSchema`, a low-and-high pair
  "kept here rather than inlined per loader" as "one import surface for
  future extensions". No loader imports it; last committed 2026-05-18.
- `src/sim/effects/index.ts` (18 lines): eight `export * from` lines, a
  single door to the effects folder that every importer walks past.
- In play: nothing.
- Fate: **delete** both.
- Proof: export.
- Signed:

**A-30 · six instrument files a person ran once** (834 lines, `tests/fuzz`)
- In play: nothing; no command, test or doc starts them.

  | file | lines | what its header says | lean |
  |---|---|---|---|
  | `benchRollout.ts` | 81 | times a world's copy and its ticks, to price the bot's search dials; "re-run whenever the dials are re-derived" | keep: its header names when it runs again |
  | `rollout/benchRunRollout.ts` | 151 | the same one layer up, for the arbitrated bot's cost | keep, likewise |
  | `rollout/readEpsilonAA.ts`, `epsilonAA.ts`, `epsilonAA.test.ts` | 312, 136, 62 | derives the noise floor the arbitrated bot's decisions are judged against; last run for Round 6's re-read | ask |
  | `rollout/verifyArbitratedRuns.ts` | 92 | one phase's exit check: full arbitrated runs, counting decisions per site | delete |

- Evidence: `scratch/120d/files.ts`; no tracked file outside `archive/`
  gives a command for any of them. GOTCHAS names the last as a past
  example of a stale private list. Their headers were read and their
  bodies were not.
- Fate: **ask**, at the instruments' phase.
- Proof: instrument.
- Signed:

**A-31 · fifteen stored weight vectors nothing names** (39 KB, `tests/fuzz/fixtures`)
- In play: nothing. Each is a bot's weight vector saved from a search:
  nine from the micro round's ladder, stack and fire arms (`60-…`), two
  finalists and the winner of one later search (`85g5-…`), three
  finalists of another (`92c2-…`). The vectors the board deploys are
  other files, named by `tests/fuzz/board/board.ts`, and stay.
- Evidence: no code, test or live doc holds any of the fifteen names;
  an archived worklog names three. Whether a past row of BALANCE.md
  needs one to be reproduced was not looked into.
- Fate: **ask**. Lean: **delete**; git keeps them.
- Proof: instrument.
- Signed:

**A-32 · the seventeen tools** (22,996 lines, `tools/`; deletion only)

| tool | lines | last commit | what it does | lean |
|---|---|---|---|---|
| the eleven catalog editors (archetype, attack, camp, character, encounter, event, layout, packet, price, reward, sector) | 19,240 | 07-22 to 09-17 | each authors one `config/*.json` and saves it through the dev server | keep: Round 10 is content |
| `blacklist-editor` | 817 | 07-24 | toggles which units the draft pool holds | keep, likewise |
| `run-config` | 716 | 10-09 | launches a run at a given seed, board, roster or daemon | keep: HANDOFF and TODO name it |
| `nodemap-viz` | 734 | 08-13 | draws the node map a seed makes; `npm run nodemap:metrics` is its report | keep: a command runs it |
| `font` | 139 | 09-18 | reads a font file's tables | keep: the font-coverage gate imports it |
| `sweep-gui` | 635 | 07-21 | a page in front of the fuzz harness's sweeps | ask; TODO carries an item to teach it the sector walk, which a deletion would close |
| `mapgen-prototype` | 715 | 08-17 | a sandbox that draws the terrain a seed generates | ask; lean delete if it is no longer opened |

- In play: nothing a player meets. Every page is linked from
  `tools/index.html`, so the walk calls every tool's files reached;
  whether a tool is still opened is the user's to say.
- Fate: **ask**, for the last two.
- Proof: none across a commit (the oracle map); the type check and the
  suite, which loads the editors' logic for 4 % to 20 % of their lines.
- Signed:

### 2.5 The same run of tokens in two places

Runs of 50 tokens or more that are identical once comments and layout
are taken out, grown as far as they stay identical. "Repeated lines" is
the count of distinct lines that lie in a second or later copy: what
would go if every cluster kept one copy.

| where the copies are | clusters | repeated lines |
|---|---|---|
| the tools' stylesheets | 69 | 3,463 |
| test files under `src` | 394 | 2,798 |
| the tools' code | 100 | 1,473 |
| test files under `tests` | 73 | 770 |
| `src`, code | 43 | 471 |
| the instruments | 29 | 345 |
| across two of those | 40 | 362 |
| the shaders and the game's stylesheet | 6 | 59 |
| all | 754 | 9,651 (a line can lie in two rows) |

No two tracked files hold the same bytes. With every name, string and
number read as one word each (runs of 80 or more), the count is 955
clusters and 13,242 lines, 1,109 of them in `src`.

**No row.** The spec's D1 lists exact duplicates under what a search can
settle. Read, each copy has a reason written beside it or a gate behind
it, and removing one means a new import, which is a reshaping:

- `shuffleInPlace` (`run/Run.ts:4761`) and `shuffleTilesInPlace`
  (`sim/battleSetup.ts:122`) are the same six lines, and the first one's
  comment says it is "kept local rather than shared" until a third
  caller appears. None has.
- `isJournal` is in `store/journals.ts:34` and again in
  `journal/replayTool.ts:75`. A permanent gate keeps headless code from
  reaching `src/store`, so the tool cannot import the store's copy.
- `isNavigable` (`sim/blockedAlly.ts:154`) repeats `passable`
  (`sim/positioning.ts:306`), which its own comment calls "THE shared
  copy of the leaf passability test".

So the duplicates go to list B, as leads (2.6).

### 2.6 For the trials (120f)

- **The editors' stylesheets.** Twelve `editor.css` files (5,815 lines)
  repeat one another: 3,463 of the tools' stylesheet lines lie in a
  second or later copy, with one run of 1,276 tokens in three files and
  another of 363 in seven. One shared sheet is the
  largest single removal this section found. The census holds `tools/`
  to deletion only, because nothing proves a reshaping there; a
  stylesheet merge does have a proof, the declaration-by-declaration
  compare of `process/oracles.md`. It is the user's call whether that
  opens a trial.
- **The apron and the terrain renderer** share five runs (112, 107, 82,
  75 and 69 tokens): the vertex writer and the colour buffers.
- **The harness and the rollout walker** (`tests/fuzz/harness.ts`,
  `rollout/walker.ts`) share three runs of 163 to 190 tokens in one
  decision loop, its redraw and empower arms among them.
- **Smaller, in `src`:** the three whole functions of 2.5; the stat fold
  in `run/runStats.ts:120` and `sim/statusEffects.ts:129`; two bot
  scripts' rally-point search; `bot/sensors.ts`'s two grid scans; the
  swap select in `PortScreen` and `RewardScreen`; `effects/propose.ts`'s
  three target preambles.
- **Test set-up.** 2,798 repeated lines in the test files under `src` is
  120e's to weigh.
- **`isActiveNeutral`** (A-25), for the neutral-team trial.

### 2.7 What this section's instruments cannot see

- A read by a computed key, a spread, or from outside the type check.
  The word search covers the last for a name's own word, and found one
  such reader in 66 names (`scripts/build-font.mjs`).
- A path built from pieces. "No import or path reaches it" is followed
  by a search for the file's base name, and the six files of A-30 and
  the fifteen of A-31 are what that search also came back empty for.
- **A fault in the reference finder, found and fixed here.** It took
  `{ name }` for a write of the variable `name`, and `id = ++seq` for a
  write alone. Nine live locals read as dead, which the type check says
  cannot be: it refuses a local nothing reads, and it passes. With both
  fixed, one export of the 1,523 moved (`setTextScale`, to used), no
  config key moved, and section 1's six classes come back at the same
  counts. The walk now carries that check: no local may stand unread.

### 2.8 Calls for the user at the read (120e's stop)

1. **A-22,** the 25 dead exports: delete.
2. **A-23,** the fourteen kept.
3. **A-24,** the locale layer's ten: keep, or cut the way in.
4. **A-25,** the twelve only their tests call, item by item.
5. **A-26,** the word `export` on 257 declarations: dropped phase by
   phase, or left.
6. **A-27,** the 188 exported for a test: kept as a class.
7. **A-28,** the 21 unread class members: delete.
8. **A-29,** the two files nothing imports: delete.
9. **A-30 and A-31,** the six by-hand instrument files and the fifteen
   vectors.
10. **A-32,** the two tools asked about.
11. **Whether the editors' stylesheets open a trial** (2.6), against the
    signed "deletion only" for `tools/`.
