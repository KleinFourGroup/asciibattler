# Round 8.5 census

**Status: being built; section 1 is read and signed, sections 2 and 3
(120d and 120e, written 2026-10-13) were read at 120e's stop and are
signed, row by row, and sections 4 and 5 (120f, the trials, and 120g,
the TODO pass's list, both written 2026-10-13) are being read at 120h,
in tranches; section 5's head says what of it is signed.** Signed (the
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
settle before the code is touched. **B-nn** is list B, the trials
(section 4). A row holds:

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

Written 2026-10-13 and **read** at 120e's stop (the user, 2026-10-13):
every row is signed. The calls were 2.8.

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
- `closeTooltip`, measured (2026-10-13, at the user's ask; `scratch/120e/tooltip-swap.js`
  under the probe runner, an offscreen window with real frames, twice).
  Its comment gives two occasions, "a scene swap, a modal opening", and
  neither calls it. **A tooltip does not outlive a scene swap:** while one
  is open the module checks every frame whether its trigger has left the
  document or lost its box (`follow()`, `src/ui/tooltip.ts:422`). With a
  tooltip pinned on a pre-turn control and the turn advanced, the screen's
  fade began at 10 and 15 ms, the control left the document at 186 and
  188 ms, the tooltip began to close at 197 and 194 ms and was gone at 331
  and 344 ms. So it stays whole for about 190 ms over a screen that is
  fading out, which a call at the fade's start would end. **Over an
  overlay it does stay:** pinned on the sector-map chip, it was still up
  0.6 s after the chip's click had opened the map, until Esc. Not seen:
  Firefox, and a hover-opened tooltip under a real pointer.
- Gotchas: none names any of the 25.
- Fate: **delete**, each in its subsystem's phase.
- Proof: export.
- Signed: **delete** 23 of the 25 (the user, 2026-10-13: "Signing all of your leans except for close tooltip"). **Keep** `closeTooltip` and `openTooltipTrigger`, with a TODO to wire them so that a tooltip leaves with its screen (the user, 2026-10-13, on the measurement above and its three options: "Signing option 1, then! 😁 Phew; glad we caught that!"). `openTooltipTrigger` was among the 24 signed first and comes back out with it: the wiring that calls the one reads the other.

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
- Signed: **keep** the fourteen (the user, 2026-10-13, in the same words).

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
- Signed: **keep** (the user, 2026-10-13: "I'm signing off on your leans for the first twelve of those"), with a TODO for the second language at the user's word ("§120 riders").

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
- Signed: **delete** eleven, their tests going or moving as the table says; **keep** `isActiveNeutral` for the neutral-team trial (the user, 2026-10-13, in the same words).

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
- Signed: **delete the word**, phase by phase (the user, 2026-10-13, in the same words).

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
- Signed: **keep** (the user, 2026-10-13, in the same words).

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
  Read on 2026-10-13: every `.stop(` there is the recorder's
  (`shell/electron/main.mjs:375-376`, `probes/record-page.js:368`), the
  one `.hide(` is the probe kit's (`process/browser-pane.md:60`), and no
  file outside the type check holds any other name of this row, or
  `playback.label`.
- Fate: **delete**, each in its subsystem's phase, after its site is
  read there. Only `dispose()`'s was read here.
- Proof: the type check, the suite and the page drive. The build's bytes
  move, because a method ships whether or not it is called.
- Signed: **delete**, each after its site is read in its phase (the user, 2026-10-13, in the same words); of the mute, "Mute just being volume zero is good".

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
- Signed: **delete** both (the user, 2026-10-13, in the same words).

**A-30 · six instrument files a person ran once** (834 lines, `tests/fuzz`)
- In play: nothing; no command, test or doc starts them.

  | file | lines | what its header says | lean |
  |---|---|---|---|
  | `benchRollout.ts` | 81 | times a world's copy and its ticks, to price the bot's search dials; "re-run whenever the dials are re-derived" | keep: its header names when it runs again |
  | `rollout/benchRunRollout.ts` | 151 | the same one layer up, for the arbitrated bot's cost | keep, likewise |
  | `rollout/readEpsilonAA.ts`, `epsilonAA.ts`, `epsilonAA.test.ts` | 312, 136, 62 | derives the noise floor the arbitrated bot's decisions are judged against; last run for Round 6's re-read | keep (was "ask", changed 2026-10-13 on a read of its header): the floors are constants in `rollout/arbitratedStrategy.ts` (`PORT_BUY_EPSILON` and five more), this is their only derivation, and a new decision site needs it again |
  | `rollout/verifyArbitratedRuns.ts` | 92 | one phase's exit check: full arbitrated runs, counting decisions per site | delete |

- Evidence: `scratch/120d/files.ts`; no tracked file outside `archive/`
  gives a command for any of them. GOTCHAS names the last as a past
  example of a stale private list. Their headers were read and their
  bodies were not.
- Fate: **ask**, at the instruments' phase.
- Proof: instrument.
- Signed: **keep** the two benches and the three noise-floor files; **delete** `verifyArbitratedRuns.ts` (the user, 2026-10-13, in the same words).

**A-31 · fifteen stored weight vectors nothing names** (39 KB, `tests/fuzz/fixtures`)
- In play: nothing. Each is a bot's weight vector saved from a search:
  nine from the micro round's ladder, stack and fire arms (`60-…`), two
  finalists and the winner of one later search (`85g5-…`), three
  finalists of another (`92c2-…`). The vectors the board deploys are
  other files, named by `tests/fuzz/board/board.ts`, and stay.
- Evidence: no code, test or live doc holds any of the fifteen names;
  an archived worklog names three. BALANCE.md names none of them
  (searched by each file's stem, 2026-10-13): its rows for those arms
  give a result and no command. A row measured on an older engine
  reproduces only on the tree of its commit, and that tree holds the
  file.
- Fate: **ask**. Lean: **delete**; git keeps them.
- Proof: instrument.
- Signed: **delete** the fifteen (the user, 2026-10-13, in the same words).

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
- Signed, for the two asked about: `sweep-gui`, **delete** (the user, 2026-10-13, in the same words); the lean was "if you no longer open it", the reply spoke of the other tool only, and the session took the signature as the answer and said so. Confirmed in the next reply: "Sorry, yes; sweep GUI can go 😂 I don't think I've ever used it". `mapgen-prototype`, **keep** (the user: "while I don't use this often, I anticipate that it'll be very helpful as we add more tile types and need to overhaul the procedural map generation, so I think it can stay"). The fifteen kept by a search: **keep** (the user, 2026-10-13, with the last tranche).

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
  compare of `process/oracles.md`. **Signed as a trial** (the user,
  2026-10-13: "Signing your CSS proposal too!"): "deletion only" for
  `tools/` is lifted for this one case, and the trial is sized at 120f
  and run late.
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

1. **A-22,** the 25 dead exports: delete. *Signed: 23 go, and the two tooltip exports stay for a TODO.*
2. **A-23,** the fourteen kept. *Signed.*
3. **A-24,** the locale layer's ten: keep, or cut the way in. *Signed: keep.*
4. **A-25,** the twelve only their tests call, item by item. *Signed.*
5. **A-26,** the word `export` on 257 declarations: dropped phase by
   phase, or left. *Signed: dropped.*
6. **A-27,** the 188 exported for a test: kept as a class. *Signed.*
7. **A-28,** the 21 unread class members: delete. *Signed.*
8. **A-29,** the two files nothing imports: delete. *Signed.*
9. **A-30 and A-31,** the six by-hand instrument files and the fifteen
   vectors. *Signed.*
10. **A-32,** the two tools asked about. *Signed: one goes, one stays.*
11. **Whether the editors' stylesheets open a trial** (2.6), against the
    signed "deletion only" for `tools/`. *Signed: a trial.*

## 3. The tests, by file (120e)

Written 2026-10-13 and **read** at its stop: every row and call is
signed (the user, 2026-10-13).

A fifth proof recurs in this section:

- **test**: for a test file, or a test, deleted with nothing else.
  `reach-diff` on the suite's reading before and after, where what is lost
  is nothing or is named in the row. A reading shows what runs and not
  what is asserted, so the second half is a break planted at the thing
  the test was written for (`npm run oracle -- plant`), which another
  test or the corpus must catch. Where nothing else catches it, the test
  held the only expectation and stays.

### 3.1 What was counted

| | count | how |
|---|---|---|
| test files | 326: 261 in `npm test`, 65 in the smoke | every tracked `*.test.ts` |
| tests | 4,389: 3,765 and 624 | as run, from Vitest's reporter |
| lines of test | 70,675: 59,116 and 11,559 | |
| the tests' own time | 154 s and 794 s, summed over files | one run of each tier with the JSON reporter. The runs themselves took 51 s and 185 s |
| each file alone under the coverage tool | 326 runs | `scratch/120e/perfile.ts`, with the flags `tests/oracle/reach.ts` records a proof with; 613 s for the main suite four at a time, 539 s for the smoke three at a time |
| lines some test file runs | 11,758 in the main suite's readings, 9,338 of them under `src` | a line is one that starts a statement |

"Alone runs" below means against the other test files of the same tier:
what `reach-diff` would name if the file were deleted. The instrument
gives back the oracle map's two known answers for a deleted test
(`backup.test.ts`: 20 lines, 4 functions, 23 arms; `enemyBudget.test.ts`:
no line, two arms) and refuses to print otherwise. The union of the 261
readings is the whole suite's stored reading, line for line (9,338 lines
under `src`, none on either side alone). Every one of the 326 files
passes when run alone.

### 3.2 The list, by what a file alone runs

| class | files | tests | lines of test | seconds | fate |
|---|---|---|---|---|---|
| **alone runs a line** | 173 | 2,886 | 43,381 | 86 | keep, as files |
| **alone takes a branch arm or calls a function, and no line** | 24 | 361 | 5,814 | 36 | keep, as files |
| **alone runs nothing** | 64 | 518 | 9,921 | 32 | read and classed in 3.3 |
| the smoke tier, the same three | 51 · 6 · 8 | 582 · 22 · 20 | 10,543 · 347 · 669 | 489 · 44 · 261 | 3.4 |

With both tiers held together, 89 of the 326 alone run nothing.

What the list says before any file is read:

- **A third of what the suite runs, one file runs.** 4,131 of the 11,758
  lines are run by exactly one test file, 1,313 by two and 730 by three.
  Under `src` it is 2,394 of 9,338: `src/render` 565, `src/dev` 417,
  `src/run` 319, `src/ui` 227, `src/store` 187, `src/sim` 161,
  `src/journal` 101, and under 100 in each other folder.
- **The sim is run many times over, and cheaply.** `src/sim` has 64 test
  files, 1,239 tests and 18,991 lines of test. Their tests take 2.4 s
  together, and 161 lines of the sim are run by one file alone.
- **The suite's time is not in its tests.** One run's 51 s held 215 s of
  module loading summed over the workers against 154 s of tests, and 76
  of those 154 are the 24 files of `tests/integration`. Deleting unit
  tests would not shorten `npm test` by a second anyone would notice.
- **The sampled breaks agree that reach is not the measure.** Of the 64
  planted breaks the suite caught among 120a's 91, 44 were caught by one
  file alone, 31 files between them, and one of those files is
  `tests/nodemap-metrics.test.ts`, which alone runs nothing.

### 3.3 The bottom, read

The 64 files of the main suite that alone run nothing, classed by each
one's header and the names of its tests. Four were read whole (A-33) and
one of a pair (A-34).

| class | files | tests | lines | seconds | what it is | fate |
|---|---|---|---|---|---|---|
| **a gate over text, an asset, a table or the import graph** | 18 | 125 | 2,612 | 8.3 | it reads files and by design runs none of the game: the doc caps, the stylesheet's twins, the boot order, the licences, the font's glyphs, the signed map sheet. Seven are permanent gates | keep |
| **one mechanic's rule** | 32 | 332 | 5,696 | 0.4 | a focused test of one behaviour (a wait resolves inside its tick, an aura does not stack, a move aborts onto a taken cell). A broad driver also runs its lines and asserts nothing about them | keep, as files |
| **a whole battle or a whole run** | 10 | 54 | 1,417 | 22.6 | the save-and-continue check, the page's replay driver, the encounter loop, the corridor and board-size regressions, four per-archetype battles | keep |
| **for the user's call** | 4 | 7 | 196 | 0.2 | | A-33 |

Against the four classes the cut named:

- *Pins a config value:* one whole file (in A-33). Otherwise it is single
  tests inside files that stay.
- *Repeats another file:* one pair (A-34), found by holding every file's
  functions and arms against every other's.
- *States a basic fact:* one whole file (in A-33).
- *Holds a rule:* the other 60.

So by file the answer to "which are truly necessary" is four files and a
pair. The question is one of tests, and 3.5 says how the tests phase
could ask it.

The four per-archetype battles (rogue, healer, mage, catapult; 432 lines,
half a second) are the likeliest of the kept files to be called
redundant: each plays one battle and checks that the archetype's ability
fired, and the corpus now replays 30 whole runs. The lean is still keep.
The corpus says "18 of 30 journals differ" where one of these says "the
healer never healed".

**A-33 · four test files**
- In play: nothing. None of the four runs a line that another test file
  does not.

  | file | what it holds | lean |
  |---|---|---|
  | `tests/smoke.test.ts` (13 lines, 2 tests) | that `1 + 1` is `2`, and that one palette hex can be imported from `src`. It is the suite's first file: it came with the commit that set Vitest up, 18 minutes before the first test of the game's code (2026-05-16) | delete |
  | `src/config/selection.test.ts` (16 lines, 2 tests) | that the shipped selection strategy is a valid key, and is `encounterFirst` | it goes with A-09, already signed |
  | `tests/gauntlet/humanFixture.test.ts` (33 lines, 1 test) | the shape of the stored human traces: one config era, an outcome on every trace. Its replay test was retired in July, and nothing writes the file | delete the test and keep the fixture, which BALANCE cites and `traceMine.ts` reads |
  | `src/run/encounters/levelCapMigration.test.ts` (134 lines, 2 tests) | that nine encounters from before the level cap moved onto the wave resolve as they did under the old global cap, and that each cap stamped then still binds. Its header calls it "a historical completeness check, not a forward cap-discipline rule" | delete; it would fail on the first of the nine a content round re-authors |

- Gotchas: none names any of the four.
- Fate: **ask**, item by item.
- Proof: test. For the first three there is no behaviour to plant a
  break in.
- Signed: **delete** `tests/smoke.test.ts`, the fixture's test (the fixture stays) and `levelCapMigration.test.ts`; `selection.test.ts` goes with A-09 (the user, 2026-10-13: "I'm on-board with all of those leans in this tranche; signed!").

**A-34 · two test files that drive the same code** (`src/sim/actions/multiTick.test.ts`, 204 lines; `phaseTimeline.test.ts`, 210 lines)
- In play: nothing a player meets. Both build a made-up charge attack and
  tick a world through it. Of the 591 functions and branch arms the two
  take, both take all but three, the closest pair of the 261 files.
- What each asserts: `multiTick` (the older) that the effect lands at its
  offset, that the unit is busy for the whole duration, and that a
  cooldown longer than the duration still holds. `phaseTimeline` asserts
  the first two again by its tests' names, with the phase events and the
  zero-length phases besides. The third is `multiTick`'s alone.
- Not read: `phaseTimeline`'s bodies.
- Fate: **ask**. Lean: move the cooldown test into `phaseTimeline` and
  delete the rest of `multiTick`, in the sim's phase.
- Proof: test.
- Signed: the cooldown test moves into `phaseTimeline` and the rest of `multiTick` is **deleted**, in the sim's phase (the user, 2026-10-13, in the same words). `phaseTimeline`'s bodies are read there first.

**A-35 · ten read-backs on a class that only tests call**
- In play: nothing. Each hands a test a value the game keeps to itself.
  These are ten of the fifteen leads of 2.3.

  | member | what a test reads through it |
  |---|---|
  | `World.bitsTallied()`, `damageDealtBy()`, `utilityDoneBy()`, `queueLength()` | the bits tally, the two contribution ledgers, a team's spawn queue |
  | `World.swapReservedPartnerIndex` | the swap index, for the recount that A-23's `scanReservedSwapPartners` is the other half of |
  | `Run.eventFlag()` | one flag of an event chain |
  | `PreBattleCountdown.remainingSeconds` | the countdown's seconds left |
  | `MarkTable.binOf()` | which ground marks lie in a tile's bin |
  | `SpriteRenderer.count` | how many sprites are live |
  | `Keybindings.overrides()` | what would be stored for the bindings as they are |

- Fate: **keep, as a class**: each is a test's way in, as A-27's exports
  are.
- Signed: **keep, as a class** (the user, 2026-10-13, in the same words).

**A-36 · five things on a class that only tests drive**
- In play: nothing; the game never calls any of them. These are the
  other five of 2.3's leads, and each is code and not a read-back.

  | member | what it is | lean |
  |---|---|---|
  | **the run's trigger registry**: `Run.registerTrigger()`, with the registry, its three fire sites (an encounter's start, a turn's start, a deploy), the save's guard and `RunTriggerContextMap` (`src/run/Run.ts:783-795`, `:4244-4263`, `:4388-4396`) | built as the seam daemons would hang on; daemons were then built as rules, and nothing has ever registered. Its own comments say "zero callers" twice, and the save throws if one appears, because handlers are not saved | delete, with its two tests in `Run.test.ts` |
  | `Keybindings.rebind()` (`src/ui/Keybindings.ts:236`) | rebinds a key in place. The settings screen stores what `overridesWith()` returns and loads it back through `setOverrides()` | delete; its three tests move onto the path the screen takes |
  | `PlaybackSpeed.label` (`src/ui/PlaybackSpeed.ts:156`) | the speed as text, "2×" or "Paused". The HUD writes its own | delete, with four assertions |
  | `TraceRecorder.dispose()` (`src/dev/TraceRecorder.ts:98`) | unsubscribes the dev trace recorder, which is built once for the life of the page | delete, with A-28's `dispose()` methods |
  | `World.shove()` (`src/sim/World.ts:1949`), and the `unit:shoved` event only it emits | moves a unit to the nearest free cell: "inert today", built for a knockback | **keep** for Round 9's kickoff, which plans forced movement on it |

- Plans: every `.md` in the repo was searched for the fifteen names. The
  registry's only history is Round 6's audit, which listed "zero callers"
  as a trap for the first caller; `unit:shoved` is in ARCHITECTURE's
  event table and Round 9's forced-movement item.
- Gotchas: none names any of the five.
- Fate: **ask**, item by item.
- Proof: for the registry, sim. A break planted at a fire site changes
  no run, which is the row's evidence and not its proof. For the other
  three deletions: the type check, the suite and the page drive, since a
  method ships whether or not it is called.
- Signed: **delete** the registry, `rebind()`, `label` and `TraceRecorder.dispose()`, each with its tests as the table says; **keep** `World.shove()` for Round 9 (the user, 2026-10-13, in the same words).

### 3.4 The smoke tier

65 files, 624 tests, 11,559 lines. The eight that alone run nothing each
hold a rule of the harness (a policy that must be byte-identical when
off, the fallen-power cross-check, the board's fail-closed exit). Two of
them start the fuzz command line as a child process, where the coverage
tool cannot follow, so "runs nothing" is the tool's limit for those and
not a finding.

**A-37 · one test sets the smoke's length** (`tests/fuzz/parallelRunDecisions.test.ts`, 75 lines, 1 test)
- In play: nothing a player meets. It runs four short arbitrated runs
  through the fuzz command line, once in sequence and once with
  `--jobs=2`, and holds the three CSVs byte for byte. It is the pin that
  makes `--jobs` safe for a measurement batch.
- Evidence: in one run of the smoke on a quiet machine, 185 s by the
  reporter, every other file had ended by 69 s after the first test
  began and this one ended at 150 s. Run by itself under the coverage
  tool it took 135 s. Its own comment sized it at "~19s serial".
- What it costs: about 80 s of every commit that stages a sim, run,
  core, config or bot path, where the hook runs the smoke.
- Fate: **ask**, at the instruments' phase. The rule stays. The lean is
  to run it where its mistake is made (an edit to the parallel runner or
  its merge, or before a batch launch), which is a change to the hook
  and not a deletion; the other arm is to re-size it to what it was
  written to cost.
- Proof: none is needed to move a test between tiers; the test is its
  own.
- Signed: the rule **stays**, and the test comes off every sim commit by a change to the hook, at the instruments' phase (the user, 2026-10-13, in the same words).

Behind it the smoke's long files are `rollout/arbitratedStrategy.test.ts`
(58 s, 45 tests), `mergeStages.test.ts` (56 s), `harnessDaemonStats`
(41 s, one test), the corpus (36 s) and the two occupancy sweeps (30 s
each). None was read.

### 3.5 For the tests phase and the trials

- **The list by test.** The user's question is about tests, and there
  are 3,765 in the main suite. A list by test needs each test's own
  reach. Three ways: each test run alone (about two and a half hours of
  machine at this step's rate); or each file run once with the coverage
  read out after every test through Node's inspector, which is this
  step's runs again and a new reader, with this section's list as its
  known answer; or the same in one run of the suite. The second is
  the session's lean, as the tests phase's first step, and **signed**
  (the user, 2026-10-13). By the words in
  their names, and no more than that: 476 tests name a no-op, a zero or
  an empty case, 400 a shipped or default value, 339 a rejection, 190 a
  round trip, 161 determinism or byte identity (a name can be in two),
  and 2,351 none of these.
- **Tests named for code that is gone.** `effects/timeline.test.ts`
  "reproduces the migrated verbs byte-for-byte", `WaitAction.test.ts` has
  an "exit test" against "the old abstaining unit", `environment.test.ts`
  matches "the old spawnEnvironment shape". Each still pins what the code
  does today against a formula, so the test stays and its name is the
  comment pass's.
- **Set-up.** By later copies, 5,001 lines of the test files repeat a
  run of 50 tokens or more, and 3,225 of those repeat inside one file
  (`Run.test.ts` 375, `World.test.ts` 317, `Targeting.test.ts` 203). Across
  files the copies are small: a base stat block in seven sim test files,
  `makeWorld` in eight, `setup` in five. A shared fixture module would be
  a trial, and the larger share is each file's own.
- **The loops.** 52 `while (` lines in the tests are unread for the hang
  119g found (TODO "§119 riders").

### 3.6 What this section's instruments cannot see

- **What a test asserts.** A reading is what ran. `nodemap-metrics` runs
  nothing of its own and was the only file to catch one planted break.
- **A child process.** A test that starts the command line reads as
  running nothing.
- **A module's top-level lines** run for every file that imports the
  module, so they are never one file's alone.
- **The sample is thin.** 91 plants reached the suite; 177 files failed
  on at least one, and no plant was aimed at a file's own subject.
- **The classing of 59 of the 64 rests on a header and the tests' names.**
  The smoke's eight likewise.

### 3.7 Calls for the user at this stop

1. **A-33,** four test files, item by item. *Signed.*
2. **A-34,** the pair that drives the same code. *Signed.*
3. **A-35,** the ten read-backs: kept as a class. *Signed.*
4. **A-36,** five things only tests drive, item by item. *Signed.*
5. **A-37,** the test that sets the smoke's length. *Signed.*
6. **The 60 at the bottom that hold a rule, and the 197 above them:**
   kept as files. *Signed.*
7. **Where the tests phase starts** (3.5): a list by test, and by which
   of the three ways. *Signed: a list by test, the second way.*

## 4. The trials (120f)

List B: what has to be tried before anyone can say it is simpler (the
spec's D1, Track B), each with what it expects to remove, counted, and the
proof that covers it. **Unsigned; read at 120h.** Nothing was tried: a
row's "expects to remove" is a count of sites, not a diff. Built from the
profile of all 279 source files, a reader for special cases, the
near-duplicate clusters of 2.5, and `World.ts` and `Run.ts` read whole.
The bar a kept trial has to pass is the spec's D2: the same behaviour by a
named proof, source lines that do not grow, no parameter that only tells
the former halves apart, and one thing fewer a reader has to know.

### 4.1 What was counted

| | count | how |
|---|---|---|
| source files profiled | 279, 63,458 lines | every non-test `.ts` under `src`; the kickoff's two totals reproduced |
| of those lines, comments | 25,659 (40 %) | a line that opens or continues a comment; 4,270 more are blank, 33,529 hold code |
| comparisons against a string literal | 619, and 243 `case` labels | by the type checker's tree; 108 `typeof` tests left out |
| absence tested on a property | 261 | `x.y === null` or `undefined`, a local left out |
| near-duplicate clusters inside `src` | 99 | 2.5's finder with names, strings and numbers read as one word each, 80 tokens or more, every copy in a non-test file |
| files read whole | 2 of 279, 7,981 lines | `Run.ts` 4,888 and `World.ts` 3,093, an eighth of the lines |

### 4.2 The profile

Each file by lines, commits (renames followed), fix commits (a subject
that opens `fix` or names a `-post` step), GOTCHAS entries that cite it or
that it cites, and special-case sites (4.3). The order is the sum of the
five ranks. It is a reading order for each later phase's kickoff and not
a measure: the five move together, and nothing in it says a file is bad.

| # | file | lines | commits | fixes | gotchas | special |
|---|---|---|---|---|---|---|
| 1 | `sim/World.ts` | 3,093 | 96 | 3 | 18 | 27 |
| 2 | `run/Run.ts` | 4,888 | 129 | 2 | 18 | 68 |
| 3 | `render/BattleRenderer.ts` | 2,122 | 78 | 12 | 6 | 13 |
| 4 | `Game.ts` | 1,287 | 107 | 2 | 6 | 22 |
| 5 | `sim/Targeting.ts` | 803 | 23 | 4 | 6 | 23 |
| 6 | `ui/HUD.ts` | 993 | 51 | 5 | 1 | 15 |
| 7 | `render/TerrainRenderer.ts` | 872 | 16 | 2 | 3 | 14 |
| 8 | `sim/behaviors/MovementBehavior.ts` | 336 | 39 | 6 | 2 | 8 |
| 9 | `run/NodeMap.ts` | 959 | 21 | 2 | 1 | 13 |
| 10 | `render/Renderer.ts` | 608 | 26 | 2 | 5 | 4 |
| 11 | `sim/movement.ts` | 866 | 17 | 3 | 2 | 3 |
| 12 | `scenes/BattleScene.ts` | 364 | 61 | 8 | 5 | 1 |

- The cut's two files are the profile's first two, so the whole reads
  went where the ranking points.
- **Fixes gather in drawing and movement, not in the two long files.**
  `BattleRenderer` has 12 fix commits, `BattleScene` 8, `MovementBehavior`
  6, `HUD`, `SupportMovementBehavior` and `FontAtlas` 5 each; `Run.ts` has
  2 in 129 commits and `World.ts` 3 in 96. By folder: `src/sim` 35 and
  `src/render` 33, `src/run` 5 (a commit counted once for each file it touched).
- 213 of the 279 files have no fix commit, 224 no gotcha, and 163 no
  special-case site. Half the lines are in the 39 longest files.
- **Half of each long file is comment.** `Run.ts` is 2,393 comment lines
  and 2,335 of code; `World.ts` 1,572 and 1,382. The comment pass (D4) is
  the largest single change to how either reads, ahead of any trial here.

### 4.3 The special cases, by what they test

A special case is counted as a place where code asks "is this the one
called X": a comparison against a string literal outside a `switch`. Each
is filed under what is asked about and which one.

| asked about | which | sites | files |
|---|---|---|---|
| a unit's team | `'neutral'` | 30 | 12 |
| a unit's team | `'enemy'` | 10 | 7 |
| a unit's team | `'player'` | 11 | 5 |
| the team objective's mode | `'engage'`, `'atWill'` | 5, 9 | 5, 4 |
| the run's phase | `'map'` | 13 | 3 |
| the run's phase | `'battle'`, `'turn-intro'` | 6, 8 | 3, 2 |
| a tile's kind | `'fire'` | 4 | 3 |

- **The neutral team is the most spread special case in the code,** and
  the absence test that goes with it leads its own list: `unit.campId`
  is tested for null at 14 sites in 7 files, the next property at 5 in 3.
  The user's candidate is where the counts point.
- By vocabulary: the team at 51 sites in 15 files, the run's phase at 52
  in 6 (and 13 `case` labels), tile kinds at 15 in 3.
- **Source code almost never names a piece of content.** Of 619 compared
  literals, three are ids in a config catalog, all on one line
  (`render/fxRegistry.ts:137`: `burn`, `bleed`, `poison` as kinds of
  hitsplat). No unit, ability, daemon, encounter or event is singled out
  by a comparison.
- 53 sites compare a `.kind` whose union has no name the reader can
  print, in 26 files; they are dispatches on effect, reward and target
  shapes, and were not read.

### 4.4 The two files, read whole

**`World.ts`.** 531 lines before the class, 224 of them one comment (the
snapshot's version history); then the tick, damage, statuses, spawns,
camps, objectives, the battle's end, and the snapshot. What the read
found is rows B-01, B-02, B-07 to B-09, B-11, A-38, F-1 and the comment
items of 4.7.

**`Run.ts`.** 803 lines before the class, 240 of them the snapshot's
version history; the class holds the map, ports, events, the encounter
and turn loop, rewards, the deck, packets, the roster, and the snapshot.
Every stored field is described twice, once on the snapshot's type and
once on the class. Rows B-06, B-10, B-11, B-15, B-16, A-39, A-40, F-2.

Both are long and neither read as tangled: each mutation goes through a
named single site (`dealDamage`, `reapUnit`, `setPlayerHealth`, `addBits`,
`appendRosterUnit`, `removeRosterUnit`, `seatActiveAction`), which fits
the low fix counts. What is hard about reading them is length, most of
it comment.

### 4.5 List B

**The user's two candidates.**

**B-01 · The neutral team, step one: its two questions asked by name**
- In play: A wall and a camp bandit are both on the neutral team. Code that needs to tell them apart asks whether the unit has a camp. Nothing a player sees changes in this row.
- Evidence: `isInertNeutral` (scenery) is called at 16 sites in 11
  files. Its twin `isActiveNeutral` (a camp member) is called nowhere
  (A-25 kept it for this). Twelve places write one or the other out by
  hand, a team test beside a `campId` test on the same or the next line
  (`Targeting.ts` at six, `World.ts:2174`, `effects/targeting.ts:96`,
  `spriteColor.ts:56`, `BattleRenderer.ts:742`, `ObjectiveController.ts:188`,
  `devEntry.ts:114`); each was read by its line and not its function.
- Gotchas: #32 (every team comparison has to handle the third team).
- Expects to remove: the twelve hand-written pairs, each a call instead;
  no file, type or key. What a reader stops having to know: nothing yet.
  What they gain is that every site says which question it asks, scenery,
  camp member or any neutral, which is what B-02 has to be judged on.
- Proof: sim. No stored byte changes, so no mapping.
- Fate: **trial**, in the sim phase, ahead of B-02.
- Signed:

**B-02 · The neutral team split in two** (the user's candidate)
- In play: Camp members would be a fourth team of their own, and walls and cover would keep the neutral one. A player would see no difference if the trial holds; if it does not, a camp's units would start treating walls and rubble as strangers and not as their own side.
- Evidence: 31 tests of a team against `'neutral'` in 13 files, 18
  null tests of a `campId`, the 16 predicate calls. They ask three
  different things: is it scenery, is it a camp member, is it neither
  side. A split shortens the first two and lengthens the third, which
  today is one comparison at about 17 sites and would become two.
- **The risk the counts did not show at the kickoff: 18 lines compare
  one unit's team with another's** (`Targeting.ts` at six,
  `MovementBehavior`, `SupportMovementBehavior`, `blockedAlly`,
  `movement.ts:625`, `World.ts:1029`), and `affectsMatch` decides allies
  and enemies the same way. At each, a camp member and a wall are the
  same team today. Split, they are not, and each site either changes
  what camp units do or grows a clause to keep them as they were, which
  is the parameter D2 rules out. `World.ts`'s own note on auras names the
  case: "a camp-carried `allies` aura would reach EVERY neutral".
- What changes on the wire: `team` is in every unit of a World snapshot
  and on `unit:died`, so the event log of any battle with a camp changes
  with the behaviour unchanged. No field of the run's snapshot type was
  seen to hold a team.
- Gotchas: #32, and #71, #105 for the lists of walls.
- Expects to remove, if it holds: the two predicates and their 28 call
  and hand-written sites become plain team tests, and `campId` stops
  meaning "is alive and fights" and means only "which camp". One thing a
  reader has to know goes. Lines: about even. Tests: 177 lines in 39
  test files name `'neutral'`; keeping that name for scenery leaves most
  of them alone.
- Proof: the corpus with a declared mapping of the new team back to
  `neutral` (the spec's D3, built at 119a), 18 of whose 30 journals
  noticed a camp member's step at 119g; then the fuzz diff. A changed
  digest after the mapping means behaviour changed, and the row goes
  back to the user.
- Fate: **ask.** Lean: decide after B-01, with its list of which site
  asks what. Today's read is that the split trades one hidden rule for
  18 places that need a second look, and that B-01 alone gets most of
  the plainness.
- Signed:

**B-03 · The config files** (the user's candidate)
- In play: Nothing. Which file a number is in changes nothing in the game. It changes where a person looks for it, the address a balance sweep names it by, and the stamp a recorded run carries.
- Evidence: 34 files. Five content tables hold 5,214 of the 6,381
  lines (the opening's count). Sixteen files of plain numbers hold 174
  lines of JSON behind 1,428 lines of loader. The signed rows already
  take three files (`empower`, `selection`, `tiles`: A-02, A-09, A-03
  with A-21), leaving 31. Three of those would hold one key each:
  `economy` (3 lines of JSON, a loader of 21, one reader), `spawn` (3,
  32, two readers) and `objective` (4, 47, two readers, one key after
  A-10).
- What a move costs: the config stamp hashes each file's name with its
  content, so every stored journal's stamp changes (the corpus replays
  past it); a sweep names a knob as `file.key`, and BALANCE's run log
  cites such names (`objective.` on one line, `escalation.` on three,
  none for `economy` or `spawn`).
- Expects to remove: three files of JSON, three loaders (100 lines),
  three names from the stamp's registry, three from "where do I look".
- Proof: config, with the moved paths as the only difference in the
  dump.
- Fate: **trial**, in the config phase, for the three one-key files
  folded into the file their readers already load. **Lean against a
  wider merge:** the other thirteen are a screen each, a sweep's
  addresses and BALANCE's record would go stale together, and
  `npm run oracle -- refs --keys` already answers "where is this knob".
- Signed:

**Signed as trials at the read, sized here.**

**B-04 · One chip rule in place of two switches** (A-11)
- In play: As A-11: the pool is charged by the casualty rule, with the survivors' numbers as the surcharge on a turn that runs out the clock. The other positions of the two switches are never met in play.
- Evidence, the game's side: 18 lines in four files (`chipRule.ts` 13,
  `health.ts` 2, and three tooltips that pick their words by the mode).
  The tests' and instruments' side: 77 lines in 12 files name a switch,
  among them one test file named for it
  (`tests/fuzz/harnessChipMode.test.ts`) and the sweep's list of legal
  values (`tests/fuzz/commands/run.ts:171`).
- Gotchas: #129 (the survivors' arithmetic stays, as the cap's charge).
- Expects to remove: two config keys, the either-or in `chipRule.ts`
  (about 20 of its 251 lines, A-11's count), the unshipped half of the
  tooltips' words, and the tests of the three unshipped pairs.
- Proof: sim and config; the sweep's `--set health.chipMode` stops being
  accepted, which is the intent.
- Fate: **trial** (signed 2026-10-13), in the run phase.

**B-05 · The editors' stylesheets** (2.6)
- In play: Nothing in the game. The twelve editor pages under `tools/` would look as they do.
- Evidence: twelve `editor.css` files, 5,815 lines, from 356 to 1,082
  each; 3,463 of the lines lie in a second or later copy.
- Expects to remove: about 3,400 lines, into one shared sheet that
  each page loads before its own.
- Proof: **none today as a tool.** The procedure is the
  declaration-by-declaration compare of `process/oracles.md`, page by
  page; `tests/cssBlocks.ts` parses a sheet into blocks and is the only
  piece of it found in the tree. The compare has to be built and shown
  to fail on a planted declaration first, and the pages looked at.
- Fate: **trial** (signed 2026-10-13), run late.

**From the two whole reads.**

**B-06 · One shuffle**
- In play: Nothing. The same cards, tiles, waves and maps come out in the same order.
- Evidence: five copies of the same loop: `shuffleInPlace`
  (`run/Run.ts:4761`), `shuffleTilesInPlace` (`sim/battleSetup.ts:122`),
  `shuffle` (`run/NodeMap.ts:898`, on a copy), `fisherYates`
  (`run/encounters/wave.ts:384`) and one written inline
  (`sim/proceduralMap.ts:559`). Each walks down from the end and draws
  `rng.int(0, i)`. The first one's comment says it is "kept local" until
  a third caller appears; there are five. Two more draw a partial
  shuffle and are not the same loop (`Run.ts:215`, `enemyBudget.ts:190`).
- Gotchas: #125 (the streams): no key or draw moves.
- Expects to remove: four loops, about 24 lines, and the "kept local"
  note; one function in `src/core/sampling.ts`.
- Proof: sim. The corpus runs all five lines; the fuzz diff four.
- Fate: **trial**, in the run phase (it crosses into sim).
- Signed:

**B-07 · The wiring of a spawned unit, in four bodies**
- In play: Nothing. Every unit that takes the field gets its movement, its abilities and its fade-in as now.
- Evidence: `spawnFromQueue` (`World.ts:2072`), `spawnCampUnit`
  (`:2039`), `spawnSummon` (`:2617`) and the first deployment
  (`battleSetup.ts:112`) each derive the stats, add the unit, push a
  movement behaviour and `AbilityBehavior`, push the archetype's
  abilities, and seat the spawn lockout unless the spawn is instant. Two
  of the four carry a comment saying they mirror the first.
- Expects to remove: about 15 lines and the two "mirrors" notes. The
  movement behaviour differs for a camp member, which is a real
  difference passed in and not a flag between halves.
- Proof: sim. The corpus runs all three of `World`'s.
- Fate: **trial**, in the sim phase.
- Signed:

**B-08 · A rule kept in step by hand**
- In play: An order to attack a camp or a piece of rubble stays in force while the target stands. If the two copies of the rule drift, the order is dropped on the tick it is given, which a browser read caught once.
- Evidence: `World.clearResolvedObjectives` (`World.ts:2171`) restates
  `validNeutralObjectiveTarget` (`Targeting.ts:451`), and its comment
  says it "must mirror" it. The function is private to `Targeting.ts`.
- Expects to remove: six lines for one call, and the instruction to
  keep two places the same.
- Proof: sim. The corpus runs both copies.
- Fate: **trial**, in the sim phase.
- Signed:

**B-09 · Two places a unit dies**
- In play: Nothing.
- Evidence: the tick's first step (`World.ts:1310`) and `reapDead`
  (`:1839`) each fire the `death` trigger and then call `reapUnit`,
  whose comment calls it "the ONE death-event emit for both death
  sites".
- Expects to remove: the trigger from two callers into the one
  function, four lines.
- Proof: sim.
- Fate: **trial**, in the sim phase, with B-07.
- Signed:

**B-10 · `Run.ts`'s small repeats**
- In play: Nothing.
- Evidence: the weighted draw of an event and of an event's outcome
  are the same eight lines (`Run.ts:1665`, `:1706`); "heal the pool, up
  to its cap" is written twice (`:1740`, `:2894`); the check of a swap
  slot before a packet is taken is the same six lines in the port and
  in the reward (`:2037`, `:3679`), and a number from a command is
  checked by hand on 11 lines.
- Not the same thing, and left alone: five weighted picks exist
  (`sectorWalk.pickWeighted`, `Recruitment.pickWeighted`,
  `NodeMap.weightedPick`, `core/sampling.weightedPick` and the two
  above). They differ on whether a list of one draws at all, which is
  gotcha #111's rule, and on the comparison at the boundary. One
  function for all would need a switch between them.
- Expects to remove: about 25 lines.
- Proof: sim for the event draws (the corpus runs both). The two swap
  checks are run by tests alone, the oracle map's port trades.
- Fate: **trial**, in the run phase, after B-04.
- Signed:

**B-11 · What the game's types give up for a test's convenience**
- In play: Nothing.
- Evidence: `World.findUnit` falls back to a scan of every unit "for
  test fixtures that push directly onto `units`" (77 such pushes in 25
  test and fixture files). The corpus runs the scan's line, which by
  the code is every lookup of a unit that has left the board: it misses
  the index, walks the list and finds nothing. `battle:ended`'s
  `reason`, `fallenPower` and `survivorPower` are optional so that test
  fakes can omit them, and `handleTurnEnded` fills in what
  a fake left out (`Run.ts:3161`). `BattleEncounter.battleRules` and
  `.kind` are optional "so hand-built test fixtures stay untouched".
  `World`'s constructor forks a combat stream when a test passes none.
- Expects to remove: the scan, the three optional marks and their
  defaults, two more optional marks. The fixtures change with them,
  which is 3.5's shared set-up.
- Proof: the suite; sim for the scan.
- Fate: **trial**, in the tests phase, after its list by test.
- Signed:

**B-17 · One `chebyshev`** (from the TODO pass, T-24; added at the read)
- In play: Nothing. The distance between two cells is worked out the same way wherever it is asked.
- Evidence: four private functions with the same body
  (`Pathfinding.ts:217`, `Targeting.ts:801`, `focusTile.ts:37`,
  `targetingStrategies.ts:43`), each `Math.max` of the two axis
  differences. The occupancy core has had the one definition since §35
  (`distanceBetween`, `src/sim/occupancy.ts:264`, the same body), and
  `movement.ts:866` exports it under the name `chebyshev`.
  `targetingStrategies.ts`'s copy takes any pair of `x` and `y`, which
  a `GridCoord` is (by its signature; not tried). Sections 1 to 4 did
  not name them (a search of this file before section 5 was written).
- Gotchas: #34 names the heuristic in `Pathfinding.ts`. The trial
  changes where the function is defined and not what it returns.
- Expects to remove: four functions, about twelve lines, for an import
  in each file. One thing a reader stops having to know: which of five
  names is the real one.
- Proof: sim.
- Fate: **trial**, in the sim phase.
- Signed: **trial** (the user, 2026-10-13: "Signing all, Claude! 😁").

**Leads left to each phase's kickoff, unread.** Near-duplicate runs the
finder lists, by subsystem; none was opened beyond its first line.

- **B-12 · Config loaders.** `layouts.ts` repeats one validation block
  three times (220 and 207 tokens); the tails of `camps`, `encounters`,
  `layouts`, `sectors` and `events` share runs of 80 to 198 tokens;
  `abilities` and `statuses` share 150; and four loaders type their
  schema by a hand-written interface whose 148 members each repeat a
  schema key (1.8).
- **B-13 · Drawing.** The apron and the terrain renderer share six runs
  of 80 to 167 tokens (2.6); `BattleRenderer` repeats 122 tokens of its
  own set-up; the status strip is in `UnitOverlayLayer` and `UnitCard`
  (101). Nothing headless proves a reshaping there (the oracle map), so
  each would be read by eye.
- **B-14 · The instruments and the bot.** Two bot scripts' rally
  search (202 and 87 tokens); `sensors.ts`'s two grid scans. *Struck at
  the read, 2026-10-13 (the user, with T-27):* the harness and the
  rollout walker's decision loop (2.6), a duplication that is deliberate
  by a recorded verdict and goes to GOTCHAS.
- **Screens.** The swap control in `PortScreen` and `RewardScreen`
  (115), the opening of `CharacterSelectScreen` and `MenuScreen` (112),
  of `EventScreen` and `PortScreen` (94), two blocks of
  `SettingsOverlay` (119, 82), two arms of `Game.ts`'s command switch
  (106).
- **Sim and run.** `actingPosition.ts`'s two searches (150),
  `RunConfig.ts`'s parse written two or three times (128), the stat
  fold in `runStats` and `statusEffects` (100), `terrainGen` (104).
- **Look-alikes that are not copies:** tables of keys (`AudioPlayer`
  and `palette`, 100 tokens of `name: value`), lists of schema fields,
  and the weighted picks of B-10.

**Considered, and not proposed.**

**B-15 · `Run.ts` split by phase**
- In play: Nothing.
- Evidence: 4,888 lines, the longest file by 1,800. Its work falls in
  runs of methods (ports, events, the turn loop, rewards, the deck,
  packets, the snapshot).
- Why not now: 2,393 of the lines are comment, so the file the comment
  pass leaves is about half as long. And a split takes nothing away
  that a reader had to know, so by D2's fourth clause it cannot be kept
  whatever it looks like; the methods also share the class's private
  state, so a split means wider access or a second object.
- Fate: **ask.** Lean: not a trial. Re-read the file at the run
  phase's re-skim, after the comment pass, and bring a split back only
  with a measure that could pass it (the cold-read probe's tokens).
- Signed:

**B-16 · The roster's four parallel arrays as one list of slots**
- In play: Nothing.
- Evidence: `team`, `deploymentCounts`, `encounterEffects` and
  `pendingEncounterEffects` are kept the same length by hand, and three
  deck piles hold indices into them. Two functions do all of it
  (`appendRosterUnit`, `removeRosterUnit`). The three arrays are named
  on 33 lines of code in `src` and 89 lines of tests.
- Why not: the two functions already hold the rule in one place each,
  and a slot record changes the save's shape for no behaviour.
- Fate: **keep** as it is.
- Signed:

Also considered: the camp registry as a file of its own (a move takes
nothing away), and a fire or healing tile's status read from the tile's
definition as its enter effect is (it adds a config key to remove two
constants).

### 4.6 For list A, found by reading

**A-38 · `spawnEnvironment`'s `team` option** (`src/sim/World.ts:2688`)
- In play: Nothing. A wall is always placed on the neutral team.
- Evidence: the option lets a caller put scenery on another team. Of
  the eight call sites in `src`, `tests` and `tools`, none passes it. The
  reference finder does not see a member of an inline options type.
- Fate: **delete** the option; the default becomes the value.
- Proof: sim; the type check names any caller.
- Signed:

**A-39 · Two lines the game prints to the browser's console**
- In play: With the developer console open, each battle prints its board's name and size, and a camera-mode change prints the mode. A player who never opens the console sees nothing.
- Evidence: `console.log('[layout]', …)` in `Run.beginEncounter`
  (`src/run/Run.ts:2177`), whose comment calls it a diagnostic to
  "confirm the layout picker hits the full library"; and
  `console.log('[camera] mode: …')` (`src/render/Renderer.ts:391`). Both
  are gated on a window existing, so headless runs are quiet. The other
  ten console lines outside `src/dev` are warnings and errors.
  `Renderer.ts` was read at those lines only.
- Fate: **ask.** Lean: delete both.
- Proof: the build compare moves, as it must; the corpus for the first.
- Signed:

**A-40 · A branch its own comment calls unreachable** (`src/run/Run.ts:3995-4002`)
- In play: Nothing, if the comment is right: closing a level-up screen after a battle always returns to the fight's own next step.
- Evidence: `handleDismissPromotion` ends in "the `advancePastBattle`
  leg is unreachable post-M1 …, kept as the defensive default". No
  stored run, chaos run or fuzz shape reaches line 4001; the suite
  does, by a test that was not looked for.
- Fate: **ask.** Lean: in the run phase, find the test that reaches
  it; if that test builds a state the game cannot, delete the leg with
  it and let a wrong state throw.
- Proof: sim, and `reach-diff` for the test.
- Signed:

### 4.7 For the comment pass (D4), measured

Leads for that phase's kickoff, not rows.

- Comments are 40 % of the lines under `src`, and half of the two
  longest files (4.2).
- Two version histories, 224 lines in `World.ts` and 240 in `Run.ts`,
  each entry of a version that is refused on load; `World.ts`'s last
  five are out of order.
- Every stored field of the run is described twice (4.4).
- 14 doc comments in 9 files sit directly on top of another doc
  comment, which in the six read (two in `World.ts`, four in `Run.ts`)
  is a comment whose code has moved out from under it.
- Comments name classes that are gone on 40 lines (`AttackAction` on 17
  in 8 files, `AttackBehavior` 7, `HealAction` 6, `GambitStrikeAction` 4,
  `DeathBehavior` 3, `CatapultShotAction` 2, `MagicBoltAction` 1).
  GOTCHAS #8 links to `src/sim/actions/AttackAction.ts`, which does not
  exist.
- "Inert today" or "the instant move model" is said of the cell-claim
  system on 18 lines, 13 of them in `World.ts`; GOTCHAS #113 was not
  re-read to date the change.

### 4.8 Fragile, and only a change of behaviour fixes it (for TODO)

**F-1 · A battle's snapshot drops a queued unit's seeded effects.**
`World.toJSON` copies five fields of each template waiting in the spawn
queue, and `effects` is not one of them; `spawnFromQueue` reads it, and
its comment says the template "round-trips them". Shown by
`scratch/120f/queue-effects.ts`. In play: nothing, since the game saves
the run and not the battle. It reaches the bot's look-ahead, which
copies the battle through a snapshot: a queued unit carrying a buff
would fight in the look-ahead without it (by the code; no look-ahead
was run).

**F-2 · A loaded run is built field by field, past the constructor.**
`Run.fromJSON` names 23 private fields in a type of its own and assigns
each one. A field given a default on the class and not assigned there
is `undefined` on a loaded run. One is today: `pauseAtTurnGates`, which
reads as off either way (`scratch/120f/fromjson-keys.ts`: 60 properties
constructed, 59 loaded). The guard that would catch the next one is a
test that the two have the same properties.

Both are in TODO under "§120 riders".

### 4.9 What this section's instruments cannot see

- **A special case that is not a string comparison:** a flag, a lookup
  in a table, a predicate's call, a `switch`'s default. The neutral
  team's own sites were listed by hand for B-01 and B-02.
- **A fix inside a feature commit.** 31 `feat` subjects contain the
  word; they are not counted as fixes. Commits follow a rename, and a
  file rewritten as it moved is lost to that.
- **Gotchas are a floor:** an entry that describes code without naming
  its file or class is not counted.
- **Whether a near-duplicate is one.** 99 clusters were listed and the
  bodies of about ten opened (the shuffles and the weighted picks). The
  50 and 80 tokens were chosen and not tuned.
- **The reads cover an eighth of the lines.** `BattleRenderer.ts`, third
  in the profile and first by fixes, was not read, nor `Game.ts` or
  `Targeting.ts`.
- **Reached is not noticed.** The `reach` answers above say a proof ran
  a line. A planted break at the site, before each trial, says whether
  it would notice.

### 4.10 Calls for the user at 120h

1. **B-01,** the two predicates by name, as the first trial.
2. **B-02,** the split: decided after B-01, or now.
3. **B-03,** fold the three one-key config files; no wider merge.
4. **B-04 and B-05,** as sized.
5. **B-06 to B-10,** five small unifications, each in its phase.
6. **B-11,** in the tests phase.
7. **B-12 to B-14 and the leads under them,** left to each kickoff.
8. **B-15,** no split of `Run.ts` before the comment pass.
9. **B-16,** the roster's arrays kept.
10. **A-38, A-39, A-40.**
11. **F-1 and F-2** in TODO; whether F-2's test is written in this
    round.

## 5. The TODO pass's list (120g)

Written 2026-10-13 and read at 120h, in tranches. **Signed so far: 5.2,
5.3** (T-97 held for list B's tranche)**, 5.4, 5.6, and 5.5's Rounds 9,
10 and 12 but for the dials' row** (T-93 with T-07, T-48 and T-88, which
the user reads as a different item: WORKLOG §120, 120h, the fifth
tranche); 5.5's Round 11 is unsigned. Every
open item of
[TODO.md](TODO.md), each with a proposed fate. Nothing here is done by
this step: the kickoff's seventh call left the doing to the phases. A
row is **T-nn**, numbered in the file's order, with its line in TODO as
the file stood at `cdd5c81`. How the list was counted and what was
checked is in [WORKLOG.md](WORKLOG.md) §120, 120g.

A row's **fate** is one of:

- **done**: already built or answered, with the check that showed it;
  the item is ticked when the list is signed.
- **8.5**: done in this round, with the phase named.
- **Round N**: given to that round. *Named* means META-ROADMAP already
  lists it there; *added* means signing writes it in.
- **drop**: taken out of TODO, with where the fact still lives, if
  anywhere.

"Held against" says what the row was checked against: the code, the
plans (META-ROADMAP's round sections, coverage map and deferred list),
the census, BALANCE. Where a row says a search found nothing, the search
is named.

### 5.1 What was counted

`scratch/120g/items.mjs` reads TODO by a written rule: an item is a
top-level bullet, closed if its first line holds `[x]` or a tick, open
otherwise. It gives **184 items, 97 open** (95 with an empty box and 2
with none: F-1 and F-2 were written without one) **and 87 closed.** At
the kickoff's commit the same rule gives 91 open of 178, the kickoff's
number. The six since are the four the census's reads added (T-92 to
T-95) and 120f's two (T-96, T-97).

By proposed fate (`scratch/120g/tally.mjs`, which reads this section):

| fate | rows | of them, a plan already names it |
|---|---|---|
| done | 5 | |
| 8.5 | 16 | 4 |
| Round 9 | 16 | 1 |
| Round 10 | 8 | 3 |
| Round 11 | 25 | 13 |
| Round 12 | 17 | 5 |
| drop | 10 | 2 |
| | **97** | **28** |

So 28 rows only confirm what a plan says, 5 are already done, and 64 are
proposals: 56 for a round and 8 to drop.

### 5.2 Already built or answered (5)

Signed as a class: each was settled by a check, named in its row.

**Signed, as a class** (the user, 2026-10-13: "Definitely signing all of
those, Claude! 😁"). The five are ticked when TODO is rewritten, and
T-22's remainder, whether any layout gets a `minHop`, is one line for
Round 10.

**T-13 · Card rarity-accent CSS** (L161)
- In play: a unit card's background is washed by its rarity (green,
  blue, purple, and amber with an inner glow for a legendary).
- Held against: `src/ui/ui.css:873-905` holds the four
  `.unit-card--rarity-*` rules and the corner label's follow at 939. The
  item was filed when only `common` existed.
- Fate: **done**.

**T-21 · Save/load interstitial round** (L199)
- In play: Continue on the menu loads a saved run.
- Held against: `src/Game.ts:1118` calls `Run.fromJSON`; built at §113
  and §115 (HANDOFF, Closed rounds). The item says nothing outside the
  tests calls it.
- Fate: **done**.

**T-22 · Layout-by-hop weighting** (L210)
- In play: which board a fight is on. Any of a sector's 12 layouts can
  be rolled at any hop, so an open board can meet the weakest roster.
- Held against: the lever the item asks for is built. A sector's layout
  entry takes `minHop` and `weight` (`layoutPoolAtHop`,
  `src/config/sectors.ts:282`; `rollLayoutFor`,
  `src/run/encounters/selection.ts:111`). `config/sectors.json` sets
  `minHop` on no layout and `weight` on one a sector.
- Fate: **done** as a mechanism. Whether any layout gets a `minHop` is
  a content and balance call; the lean is that Round 10's extended sheet
  asks it, as one line added there.

**T-23 · Turn-limit / tick-cap resolution, a deeper system** (L225)
- In play: a turn that runs out the clock costs each pool its own fallen
  and the other side's units still standing.
- Held against: that rule is the casualty experiment's, signed at §93
  (`health.capPenalty: survivors`, `config/health.json:8`), and it is
  the deeper look the item asked for. A mutual wipe charges both pools
  by their fallen (`src/run/chipRule.ts:189-195`, its comment; not run).
  The player's side of a stall is T-09.
- Fate: **done**.

**T-42 · The disconnected-trigger poll has no live read** (L331)
- In play: a tooltip whose trigger leaves the page.
- Held against: read live on 2026-10-13 under the probe runner
  (WORKLOG §120, "The question, measured"): the poll closes the tooltip
  a frame after its trigger has left. What the read found is T-95.
- Fate: **done**.

### 5.3 A plan already names the fate (28)

Signed as a class: the row's fate is the plan's, quoted. What a player
would notice is in the second column; "nothing" means a developer's
item.

**Signed, as a class, for 27 of the 28** (the user, 2026-10-13, in the
same words as 5.2). T-97 was held out of the tranche: whether F-2's
test is written in this round is 4.10's eleventh call, and it is read
with list B.

| id | TODO | the item, and what a player would notice | where a plan names it | fate |
|---|---|---|---|---|
| T-55 | L378 | The phase codes rewritten out of `src` comments; nothing | META-ROADMAP §Round 8.5, "The source-comment rewrite" | **8.5**, each subsystem's comment pass |
| T-26 | L246 | The `npm audit` debt; nothing shipped. Nine advisories at §119's close, all build and test tooling by package name (WORKLOG "The close of §119") | §Round 8.5, "A dependency phase"; Round 12, "The toolchain bump (the Vite major + the `npm audit` debt)" | **8.5**, the dependency phase, which counts it again; what only a major clears stays Round 12's |
| T-90 | L762 | The test loops not yet read for the hang; a hook that hangs where it should fail | the item ("For the tests phase"); census 3.5 | **8.5**, the tests phase. A search gives 51 to 53 `while (` lines by pattern, against the item's 52 |
| T-97 | L820 | A loaded run can miss a field the class defaults (F-2); nothing today | census 4.10, call 11 | **8.5**, the run phase, if call 11 is yes. Lean yes: the test, and the one assignment that turns it green, under the sim proof |
| T-57 | L411 | Flyers float; a flyer bobs | Round 9, "The flyer's presentation … the float (TODO)" | **Round 9** |
| T-70 | L580 | WATCH: Dis Pater's sentence holds at Escalation 3 by rounding; a daemon's text that could go false | Round 10's note, "the read of level 3, fewer bits, which waits on bit sinks (TODO "§117 riders")" | **Round 10** |
| T-71 | L585 | Round a tithe's bits on the award; Escalation 3 to 5 would reach the richest economy | the same note; T-72 names it | **Round 10** |
| T-72 | L591 | WATCH: Escalation 3 reads no harder on the board's arm | the same note; the coverage map's "level 3's read against bit sinks" | **Round 10** |
| T-04 | L62 | A sound for the catapult's held fire | Round 11, "The final global feel/SFX sweep" | **Round 11** |
| T-08 | L107 | A tell that a fleeing enemy cannot reach you | the same sweep | **Round 11** |
| T-09 | L116 | An offer of a draw when a battle has stalled | the same sweep | **Round 11** |
| T-12 | L148 | A stance that shows a unit is queueing, not stuck | the same sweep | **Round 11** |
| T-14 | L163 | A sound at the catapult's launch | the same sweep | **Round 11** |
| T-16 | L169 | Where a status tick's sparkle sits | the same sweep | **Round 11** |
| T-17 | L171 | A trail on the rogue's dash | the same sweep | **Round 11** |
| T-37 | L313 | More sounds, from the registry's candidate rows (not counted again here) | the same sweep, its sound half | **Round 11** |
| T-56 | L398 | Ground moves' vertical motion smoothed, then the hop reopened once | the same sweep | **Round 11** |
| T-58 | L422 | The rally X drawn as a terrain mark | the same sweep | **Round 11** |
| T-53 | L367 | Glyph scale as a player setting | Round 11, "The board's accessibility dials" | **Round 11** |
| T-54 | L368 | Yaw as a player setting, decided with a reason | the same | **Round 11** |
| T-40 | L317 | Run-end stats beyond the fallen | Round 11, "Run-summary / post-run screen (… stats …)" | **Round 11** |
| T-01 | L31 | The human gauntlet's cells open the starting event first; nothing. No `noevents` dial exists (a search of `src`, `tools`, `tests`) | Round 12, "Human gauntlet #2 … (closes the starting-event-vs-cell TODO)" | **Round 12** |
| T-19 | L178 | Object pooling; smoother frames if a measurement says so | Round 12, "object pooling if frame-time measurement says so" | **Round 12** |
| T-61 | L467 | One instance of the Electron shell per profile; two instances overwrite one store | the coverage map, "the shell's packaging, instance lock and store writes" | **Round 12** |
| T-68 | L550 | Under Electron every write sends the whole store | the same row | **Round 12** |
| T-69 | L566 | The packaged shell's notices | Round 12, "Electron packaging" | **Round 12** |
| T-20 | L190 | A learned value model in place of the prior table; nothing | "Explicitly deferred": "The ML balancer rung — CLOSED unless the tabular prior drifts" | **drop**: the deferred list holds it |
| T-45 | L338 | The map legend on a phone-width screen | "Explicitly deferred": "Mobile (… the phone-width map legend) — out until it can be playtested" | **drop**: the deferred list holds it |

### 5.4 Proposed for Round 8.5, where no plan names it (12)

Signed row by row. None changes what a player sees, and each names
where in the round it goes.

**T-24 · Unify the duplicated `chebyshev` helpers** (L237)
- In play: nothing. The same three-line distance function is written
  out in four sim files.
- Held against: four identical bodies (`Pathfinding.ts:217`,
  `Targeting.ts:801`, `focusTile.ts:37`, `targetingStrategies.ts:43`),
  16 occurrences of `chebyshev(` between them with the four definitions
  counted, beside `movement.ts:866`'s
  `chebyshev = distanceBetween`. The census does not name it (a search
  of this file before this section). The coverage map leaves it "in
  TODO; land opportunistically".
- Fate: **8.5**, the sim phase, as a seventeenth row of list B: four
  functions out for one import, about twelve lines. Proof: sim. It is
  the kind of duplicate the round is for.
- Signed: **8.5**, as row B-17 of list B (the user, 2026-10-13: "Signing all, Claude! 😁").

**T-49 · Pin ARCHITECTURE's event catalog against `events.ts`** (L361)
- In play: nothing. ARCHITECTURE's event table is prose that nothing
  checks, and it sat one event short from §29c to §104.
- Held against: `tests/docs.test.ts` names no event table (a search).
- Fate: **8.5**, the tests phase: a key-set diff on every `npm test`.
- Signed: **8.5** (the user, 2026-10-13, in the same words).

**T-50 · Pin `ui.css`'s `--font-mono` against `FONT_STACK`** (L362)
- In play: nothing while the two agree. The stylesheet's font chain is a
  hand copy of the one the font gate checks; if they part, the gate
  checks a chain the page does not use.
- Held against: no test names `--font-mono` or `FONT_STACK` (a search
  of `tests`).
- Fate: **8.5**, the tests phase.
- Signed: **8.5** (the user, 2026-10-13, in the same words).

**T-51, T-85 · `phase-stats`: a fix column by commit type, and its
count under `--since`** (L364, L725)
- In play: nothing. It is the instrument the round-close efficacy read
  uses.
- Held against: `process/welfare-and-efficacy.md:68-70` carries the
  warning about the word-matched ratio. Round 8 read 135 commits there
  against git's 196 (the item's numbers, not run again).
- Fate: **8.5**, before the close's efficacy read, with Round 8's 196
  as the known answer.
- Signed: **8.5** (the user, 2026-10-13, in the same words).

**T-62 · DESIGN's "Out of scope" list names as backlog what is built**
(L482)
- In play: nothing.
- Held against: `DESIGN.md:822`, read 2026-10-13. Four lines are
  struck; still plain are larger units, in-battle commands, audio, line
  of sight, terrain and status effects, as the item says, and "Shop and
  economy", which the item does not list and the ports built (§50).
- Fate: **8.5**, at the close's docs pass, each line struck with its
  phase after a check against ARCHITECTURE.
- Signed: **8.5** (the user, 2026-10-13, in the same words).

**T-83 · Two lines of the smoke were not read** (L703)
- In play: whether a stranger's store on itch still holds its sections
  days later, and whether other games' keys show from our frame in Edge.
- Held against: HANDOFF's Cursor carries both. The upload was three
  days ago, so the days-later line can be read now.
- Fate: **8.5**, and the user's hands: the live page's Copy diagnostics,
  and Edge's storage inspector on the frame. Nothing for a session to
  build.
- Signed: **8.5**, the user's to read (the user, 2026-10-13, in the same
  words).

**T-84 · The probe runner's edges** (L717)
- In play: nothing. Four frictions of `shell/electron/probe-cli.mjs`
  and `__probe.drive`.
- Held against: `shell/` has no proof across a commit (the oracle map),
  so each fix is shown by a run.
- Fate: **8.5**, with T-91, before the render and UI phase leans on the
  runner.
- Signed: **8.5** (the user, 2026-10-13, in the same words, and of this
  row and T-91: "Definitely agree that the two that add code are worth
  it! 👍").

**T-86 · Three tests time out at 5 s when anything runs beside the
suite** (L729)
- In play: nothing. A commit fails on a limit, and the failure does not
  name load.
- Held against: `store-guard`'s two walks have had a 30 s limit since
  `0f61148`; the chaos test's seeds are as they were (the item).
- Fate: **8.5**, the tests phase.
- Signed: **8.5** (the user, 2026-10-13, in the same words).

**T-87 · The friction log is a tracked file** (L736)
- In play: nothing. Filing a line dirties the tree, which holds a box
  and stamps a clip `-dirty`.
- Held against: no plan names it. The next launch it would get in the
  way of is Round 9's closing board.
- Fate: **8.5**, at the close's welfare read, with the standing
  decisions. Lean: build the untracked spool then.
- Signed: **8.5**, decided at the close's welfare read (the user,
  2026-10-13, in the same words).

**T-89 · Dead links in the docs** (L745)
- In play: nothing.
- Held against: run again today
  (`scratch/118j-close/c6-all-links.mjs`): the five are still dead
  (GOTCHAS to `AttackAction.ts`, PATHING to `trace-flips.ts`, TODO to
  `DashAction.ts`, two in the 2026-09-13 welfare review). Of 888 misses
  in all, six are in files outside `archive/`: the five, and one false
  hit in ARCHITECTURE.
- Fate: **8.5**, the close's docs pass: fix the five. Lean: leave the
  archives, which were moved verbatim.
- Signed: **8.5**, the five fixed and the archives left (the user,
  2026-10-13, in the same words).

**T-91 · The page drive does not notice a phase whose scene never
mounts** (L775)
- In play: nothing today. It is the missing proof for which screen a
  phase shows.
- Held against: the oracle map lists "which scene a phase mounts" among
  what has no proof (TESTING.md "The oracle map"; HANDOFF).
- Fate: **8.5**, the first step of the render and UI phase: that phase
  deletes in `Game.ts` and the scenes, and this gives it a proof it
  lacks. It adds dev code to the probe kit, as §119's instruments did.
- Signed: **8.5** (the user, 2026-10-13, in the same words; see T-84).

### 5.5 A round proposed, where no plan names one (44)

Signed row by row. "Added" on every row here: signing writes the line
into META-ROADMAP.

#### Round 9 (15)

**T-03, T-28 · A coverage guard for `roster-table.json`, and the table
compacted** (L53, L300)
- In play: nothing. A `--roster=sampled` read draws from a table of
  21,519 rows and 4.7 MB (the item's numbers), whose membership can
  drift with no test failing.
- Held against: `tests/fuzz/roster/rosterTable.test.ts`'s 14 tests pin
  the parser, the builder and the sampler; none holds the table's
  archetypes against the draftable set (its test names, read). No plan
  names either item.
- Fate: **Round 9**, before its closing board. The round adds
  archetypes, which is when membership drifts, and that board is the
  next sampled read. One step, as T-28 says.
- Signed: **Round 9**, before its closing board (the user, 2026-10-13: "Signing all
  ten, Claude! 😁").

**T-11 · Renderer position-reconciliation sweep** (L128)
- In play: a sprite left standing off its tile until its next move.
  Seen once (56e) and fixed at its cause.
- Held against: no plan names it. Round 9's flyer presentation reworks
  what the animator writes ("The animator also writes whole positions
  on every move", META-ROADMAP).
- Fate: **Round 9**, at that phase's audit: the full tier is the same
  change, and the cheap tier, a DEV warning, is small there.
- Signed: **Round 9** (the user, 2026-10-13, in the same words).

**T-29 · `box-drive.sh`: one artifact kind per cohort** (L301)
- In play: nothing. A mixed queue held its box (92g).
- Fate: **Round 9**, before its closing board, the next cohort.
- Signed: **Round 9** (the user, 2026-10-13, in the same words).

**T-31, T-32, T-35, T-36, T-39 · The sheet's watches and the kits: the
priest parity breach, the wall watch, power diversity by rarity, the
AoE-status enemies' retune, the kit watches** (L304, L305, L308, L310,
L315)
- In play: the priest out-earns the soldier by 14 on the deploy shape;
  the boss wall reads 0.459 against a signed 30 to 35; the banshee's
  kind is "really annoying"; five archetypes price negative when given
  free (the items' numbers, from BALANCE §94).
- Held against: TODO's own words give each to Round 9 ("carried to
  Round 9 with the kit watches"; "Round 9, after the §94 signing"), and
  HANDOFF's Cursor lists the watches as riding the signed sheet.
  META-ROADMAP's Round 9 names none of them (a search for "kit",
  "priest" and "diversity" finds no line); it closes with a board
  re-run.
- Fate: **Round 9**, as one line: the kit and parity watches,
  dispositioned at the closing board. T-35 moves every burn per turn,
  so it lands before that board.
- Signed: **Round 9**, as one line, and not Round 10's sheet: the session had
  singled this row out as the largest addition, with the reason that
  Round 10's content should be authored against the corrected numbers
  (the user, 2026-10-13: "I'm in full agreement on the more weighty ones
  you singled out").

**T-34 · A won-turn reward shape** (L307)
- In play: a decisive win still books your own dead.
- Held against: no plan names it. Round 9 holds the casualty rule's
  other feel items (Retreat, Optional deploy, Injuries).
- Fate: **Round 9**, read with them.
- Signed: **Round 9** (the user, 2026-10-13, in the same words as T-03).

**T-38 · `FX_REGISTRY`'s own coverage gap** (L314)
- In play: an ability with no effect drawn, or a status tick with no
  sound, ships with nothing failing.
- Held against: no plan names it. Not run against today's content, so
  its first run may list gaps that are sound calls.
- Fate: **Round 9**, its first phase: the round authors a vampire's and
  a special's abilities, and the guard should be on the path before
  them. The other arm is 8.5's tests phase.
- Signed: **Round 9**, its first phase, and not this round's tests phase: its
  first run may list gaps that are sound calls (the user, 2026-10-13,
  in the same words as T-31).

**T-47 · Pin the Reward ledger's index mapping headless** (L355)
- In play: accepting rewards out of order takes the row that was
  clicked. Proven by one pane walk.
- Held against: `RewardScreen.resolve` still maps by hand
  (`src/ui/RewardScreen.ts:235, 268`). Lifting it adds a function and a
  test, so D2's "source lines do not grow" keeps it out of 8.5's trials.
- Fate: **Round 9**, with XP rewards, which add an entry kind to the
  same screen (inferred from META-ROADMAP's "`REWARD_ENTRY_KINDS` has
  no XP").
- Signed: **Round 9** (the user, 2026-10-13, in the same words as T-03).

**T-63 · A `reward:resolved` bus event** (L490)
- In play: the reward screen asks the run every frame, and a replayed
  clip has no pickup sound.
- Fate: **Round 9**, with XP rewards: the same flow, and a new event is
  a change of behaviour.
- Signed: **Round 9** (the user, 2026-10-13, in the same words as T-03).

**T-92 · Power's level-up draw and its growth key** (L789)
- In play: nothing. A recruit's level-up draws an eleventh time for a
  stat that never grows.
- Held against: the user gave it to "a later cleanup round" (A-14's
  keep), one "that accepts the stream moving and re-runs the board".
  Round 9 is one: it adds RNG sites and closes with a board re-run.
- Fate: **Round 9**, in its bump window. Call 2 below.
- Signed: **Round 9**, in its bump window, and no new cleanup round for it
  (the user, 2026-10-13, in the same words as T-31).

**T-96 · A battle's snapshot drops a queued unit's seeded effects**
(L816)
- In play: nothing, since the game saves the run and not the battle.
  The bot's look-ahead would fight a queued, buffed unit without its
  buff (census F-1).
- Held against: Round 9's ability-grant channel adds a field to the same
  spawn template (`UnitTemplate.abilities?`, "the four sites union it").
- Fate: **Round 9**, with it; a World bump.
- Signed: **Round 9** (the user, 2026-10-13, in the same words as T-03).

#### Round 10 (5)

**T-02 · The Dis Pater `--grant` read at n=80** (L42)
- In play: whether holding the Idol of Dis Pater costs the player.
- Held against: BALANCE's last read is −11.0 at n=72, "negative again,
  thin again" (its 2026-09-05 entry, §92g); no `--grant` arm at the
  floor is on record (a search of BALANCE). T-71 changes the tithe.
- Fate: **Round 10**, after T-71: a read before it would be of an arm
  about to change (principle 5).
- Signed: **Round 10** (the user, 2026-10-13: "Signing all except for 6,
  Claude.").

**T-05 · Mapgen tool: empty-camp-pool hint** (L70)
- In play: nothing. Volcanic's camp pool is still empty
  (`config/terrain.json:55`), and the tool is kept (A-32).
- Fate: **Round 10**, with "the volcanic camp resident", which fills the
  one empty pool; dropped there if no theme is left without one.
- Signed: **Round 10** (the user, 2026-10-13, in the same words).

**T-15 · Ability description text** (L167)
- In play: an ability's row would carry a line of flavour.
- Held against: `config/abilities.json` holds no `description` (a
  search). Round 11's guard is "no new content".
- Fate: **Round 10**: prose authored with the act's new abilities,
  keyed for the string layer.
- Signed: **Round 10** (the user, 2026-10-13, in the same words).

**T-33 · The three deep-end cost residuals** (L306)
- In play: three deep-end fights cost 10.2 to 10.6 pool an instance
  against a 9.3 line (the item's numbers).
- Held against: "whenever those rows are next touched".
- Fate: **Round 10**, whose extended sheet touches them.
- Signed: **Round 10** (the user, 2026-10-13, in the same words).

**T-52 · Rounded plates for organic scenery** (L365)
- In play: a tree would stand on a round ground plate.
- Held against: it waits on organic scenery existing, and needs a field
  per mark, which Round 10's guard sends back to a Round 9 sibling
  phase.
- Fate: **Round 10**, with fauna and scenery; dropped there if none is
  authored.
- Signed: **Round 10** (the user, 2026-10-13, in the same words).

#### Round 11 (12)

**T-41 · The survivors end sequence, unexercised live** (L321)
- In play: on a turn that runs out the clock, one orb flies for each
  unit still standing.
- Held against: the item says a read needs `chipMode: survivors`. The
  code says otherwise: the shipped `capPenalty: survivors` pays that
  rule on every capped turn, and `src/ui/HUD.ts:463-472` runs the
  sequence then (`lossEventsAtEnd`, `src/run/chipRule.ts:196`). So it
  ships today, and no browser read of it is on record. The
  survivors-rule playtest it waited for is ruled out (A-11, the user).
- Fate: **Round 11**, with T-09: one capped turn read in the user's
  Firefox. Reworded, not dropped.
- Signed:

**T-44 · A hitsplat gallery dev key** (L337)
- In play: nothing; a dev chord that shows one of every hitsplat kind.
- Held against: `src/dev` has none (a search).
- Fate: **Round 11**, built first as the feel sweep's instrument.
- Signed:

**T-46 · The deep water's band constants by eye** (L340)
- In play: how strongly deep water's bands read.
- Fate: **Round 11**, the feel sweep.
- Signed:

**T-59 · The overlays trail a camera move by one frame** (L447)
- In play: nothing while the fitted view is the only one; bars would
  lag the board under a moving camera.
- Fate: **Round 11**, with the yaw decision (T-54), its first consumer.
- Signed:

**T-66 · Some text may be too small at the default size** (L520)
- In play: the events, the objective buttons and the hitsplats, by the
  user's read.
- Held against: the user wants player feedback first, and no stranger's
  finding is on record (HANDOFF).
- Fate: **Round 11**, and asked at each round's playtest until then.
- Signed:

**T-67 · A key's name is its US label** (L541)
- In play: on AZERTY the key marked A reads as Q.
- Fate: **Round 11**, with the tutorial's "registry-derived key labels".
- Signed:

**T-74, T-75, T-77 · A smaller window than 1280×720; the battle's unit
cards cover the board; at 150 % text a 720p window breaks down** (L621,
L626, L646)
- In play: at 1024×576 the enemy's cards cover half the board; at 150 %
  text a 720p window cuts a banner's name and scrolls a screen (the
  items' measurements).
- Held against: the user: "closer to a full round"; "at some point,
  we'll need to rework things". No plan names it.
- Fate: **Round 11**, the nearest charter (UI only, the accessibility
  dials), sized at its kickoff, with T-75's instrument first. Call 5
  below: it may want a round of its own.
- Signed:

**T-78 · The battle's hop chip does not fade** (L663)
- In play: one chip appears and goes at once while the panes beside it
  fade.
- Held against: `src/ui/HUD.ts:253` still gives it
  `chip hud-hop screen-fade`. A player would see the fix, so it is not
  8.5's.
- Fate: **Round 11**, the feel sweep.
- Signed:

**T-82 · Last run exports a finished run only** (L696)
- In play: a player reporting a bug mid-run has only Export everything.
- Fate: **Round 11**, with the run summary's export surfaces.
- Signed:

**T-95 · A tooltip leaves with its screen** (L804)
- In play: a tooltip stays whole for about 190 ms over a screen that is
  fading out.
- Held against: census A-22 keeps `closeTooltip` and
  `openTooltipTrigger` for it.
- Fate: **Round 11**, with a read in Firefox.
- Signed:

#### Round 12 (12)

**T-93, T-07, T-48, T-88 · The URL parameters, reviewed and simplified;
`--sector-hops` in the run-config tool; a forced encounter id that
matches no node says nothing (filed twice)** (L794, L100, L360, L741)
- In play: nothing a player meets. 17 URL parameters (census 1.5).
- Held against: the user gave T-93 to "a later cleanup round" (A-19's
  keep). Of T-07, the sweep page's half closes with its signed deletion
  (A-32), and the run-config tool still speaks `--hops` alone
  (`tools/run-config/cli.ts:79`). T-48 and T-88 are one fact filed at
  §102 and again at §117.
- Fate: **Round 12**, as one item: which dials a shipped build answers
  is a ship question, since the desktop build has no address bar. Call 2
  below.
- Signed:

**T-60, T-64, T-65 · The recorder: a clip of a continued run, a cue of
which choice was made, and its open items at the §114 close** (L460,
L497, L504)
- In play: nothing. A dev tool, with no consumer today.
- Fate: **Round 12**, with "Store-page assets", the recorder's next
  use. The other arm is to drop all three.
- Signed: **Round 12**, kept and not dropped (the user, 2026-10-13: "Signing
  all except for 6, Claude.").

**T-76 · The device pixel ratio is uncapped** (L637)
- In play: fullscreen on a 4K laptop with integrated graphics would
  draw at full device pixels.
- Held against: `src/render/Renderer.ts:168`, as the item says. Left
  for data at the user's call; none is on record.
- Fate: **Round 12**, with the browser matrix and other hardware;
  sooner if a stranger reports it.
- Signed: **Round 12** (the user, 2026-10-13, in the same words).

**T-79, T-80, T-81 · The failure plate's three: a shader that fails to
compile throws nothing; the battle plays on unseen while a lost context
is waited for; a long error can't be scrolled by keyboard** (L672,
L677, L683)
- In play: a black board under a working HUD; four seconds of a fight
  unseen; an error a keyboard player cannot read to its end.
- Held against: none measured on a second machine (the items).
- Fate: **Round 12**, with the browser matrix, where a driver that
  rejects a shader would be met. T-81 is one line and could go to
  Round 11's accessibility work.
- Signed: **Round 12**, the three together (the user, 2026-10-13, in the same
  words).

**T-94 · A second language** (L797)
- In play: the game ships English alone.
- Held against: META-ROADMAP's deferred list says "Translations beyond
  English — the layer ships; content does not"; the user asked for an
  explicit to-do (A-24).
- Fate: **Round 12**, as a decision point (which languages at the Steam
  release), after Round 10's content and Round 11's tutorial text are
  final.
- Signed: **Round 12**, as a decision point (the user, 2026-10-13, in the same
  words).

### 5.6 Proposed dropped (8)

Signed row by row. The read's test is here: wrong is a rider dropped
that the user still wants.

**T-06 · Hoist the display colour tables into config** (L81)
- In play: nothing. The status and empower colours would move from a
  source file to a JSON, for hot reload while tuning.
- Held against: the item's premise is hand-authored hex tables. Since
  116f every hue there is a palette name, picked again by the
  colourblind palette, and the tables are built when the module loads
  (`src/render/statusDisplay.ts:21-23`). A config file would hold names
  that only the palette module can resolve. The coverage map gave the
  item to Round 7, which closed without it.
- Fate: **drop**. A lean: it was the user's own ask, at 78d.
- Signed: **drop** (the user, 2026-10-13: "I'm comfortable dropping all of those, Claude! 👍"; and of this one, "Yes, I did
  ask for 1, but I'd totally forgotten about it, and it's not been a
  problem").

**T-10 · Mercury coin-flip watch** (L126)
- In play: the Idol of Mercury's coin flip, reported once as granting
  the full redraw on every turn of a run.
- Held against: closed not-reproducible on 2026-07-11, and nothing
  since is on record. The probe's recipe is in
  `archive/post-46-worklog.md` §51. The coverage map says "stay in
  TODO".
- Fate: **drop**; the archive keeps the recipe.
- Signed: **drop** (the user, 2026-10-13: "I'm comfortable dropping all of those, Claude! 👍").

**T-18 · WATCH: quantized overlay-bar lift** (L177)
- In play: HP bars would snap to two or three shared heights.
- Held against: "Don't build it speculatively" (the item). No feedback
  on a ragged row is on record since 2026-08-15.
- Fate: **drop**; `archive/post-72-worklog.md` §79e keeps the numbers.
- Signed: **drop** (the user, 2026-10-13, in the same words).

**T-25 · `Run.pauseAtTurnGates` two-path loop, a divergence watch**
(L238)
- In play: nothing. The game runs with the turn's gates on; a plain
  fuzz run goes straight through.
- Held against: the two paths are still two, and they part at two
  lines of `Run.ts` (2407, 3254). The game, the journal replay, the
  chaos driver and the rollout walker turn the gates on; the fuzz
  harness does when its strategy acts at a gate
  (`tests/fuzz/harness.ts:736`); a plain harness run and a bot's cloned
  run leave them off (a search for the assignment). 120f read `Run.ts`
  whole and proposed nothing on the loop.
- Fate: **drop**: that read was the look the watch asked for, and the
  split is two lines.
- Signed: **drop** (the user, 2026-10-13, in the same words).

**T-27 · `runOne` / rollout-walker deliberate duplication, a divergence
watch** (L268)
- In play: nothing. The fuzz harness and the rollout walker each walk a
  run with a copy of the same wiring, about a hundred lines.
- Held against: census B-14 lists this pair as a lead for a trial
  (three shared runs of 163 to 190 tokens, 2.6). The item records the
  duplication as deliberate, by a verdict with two triggers to reopen
  it, and neither is on record as fired.
- Fate: **drop** from TODO into GOTCHAS, the home for a thing that must
  not be re-litigated, and B-14's first clause is struck. Call 4 below.
- Signed: **drop** into GOTCHAS, with B-14's first clause struck (the
  user, 2026-10-13, in the same words). The entry is written when TODO is
  rewritten, so the verdict is never in two places.

**T-30 · A DP-tail redesign in one currency** (L303)
- In play: nothing directly; how the bot prices the road ahead.
- Held against: no plan names it. Its baseline is in BALANCE (§94g-3)
  and its lesson in gotcha #132. No board has asked for it.
- Fate: **drop**. A lean.
- Signed: **drop** (the user, 2026-10-13: "until we have more data, we
  don't need to speculate on potential fixes"), with a later round in
  view: "At some point, probably after the content rounds, we'll
  probably want to add another bot round to see if it's still working as
  intended". Where that round is written is put with 5.9's ninth call.

**T-43 · The pane's key tool sends no `KeyboardEvent.code`** (L333)
- In play: nothing. A limit of a session's browser tool.
- Held against: `process/browser-pane.md:323` states it.
- Fate: **drop**: the fact has its home.
- Signed: **drop** (the user, 2026-10-13, in the same words).

**T-73 · Two tabs changing two settings overwrite each other** (L596)
- In play: with the game open in two tabs, a setting changed in one can
  be put back by a change in the other.
- Held against: "Unseen so far" (the item). The user dropped its twin,
  a reward's taken rows across a reload, as rare and costing nothing.
- Fate: **drop**. A lean.
- Signed: **drop** (the user, 2026-10-13, in the same words).

### 5.7 Left inside ticked items

The count sees an item's first line. Six closed items carry a condition
or a leftover in their text; each is listed so that none is lost by the
rule.

- **The OS's reduced-motion query, never exercised live** (L322): "a
  one-minute check with Windows' "Animation effects" off". The user's
  hands; lean, at 120h's read or the round's close.
- **The JetBrains Mono `⊞` / `⊠` swap** (L356): `PRIMARY_EXCLUDES`
  stays until a release that closes the upstream issue is vendored.
  Lean: the dependency phase looks at upstream once.
- **The archetype editor still prints `rng`** (L159): a dev tool's
  preview line. Lean: leave it.
- **The shake policy's fraction against an absolute** (L323), **a
  download that stalls and never fails** (L669), **a reward's taken
  rows across a reload** (L477): each is a condition written in its
  line ("if flat ever feels dull", "still unheard", "if players report
  it"). Lean: they stay where they are.

### 5.8 What this section's list cannot see

- **Only TODO.** HANDOFF's Cursor carries items that are not in TODO
  (the 7.5 close's two watches, the round-close list). The scratchpad,
  the friction log and the session reports are the close's sweep.
- **Most rows were not run.** A row's numbers are the item's unless it
  says "read", "run" or "a search". The checks made are in WORKLOG §120,
  120g, with what each showed.
- **A search is not a negative** for the rows that say no plan names
  an item: the search was of META-ROADMAP, by the words given.
- **No row was held against the archived road maps or specs,** which
  120c's read asked of a census row. A TODO item's fate is a schedule,
  and its sources are the plans that are live.
- **Whether a named round's line means this item.** For the feel
  sweep's rows the match is by the sweep's own list of names; T-37 and
  T-40 are matched by their subject.

### 5.9 Calls for the user at 120h

1. **The two classes** (5.2 and 5.3): five ticked, 28 confirmed as the
   plans have them.
2. **"A later cleanup round."** Two of the user's riders name one and
   META-ROADMAP has none. Lean: no new round. T-92 goes to Round 9,
   which moves the streams and re-runs the board anyway, and T-93 with
   its three riders to Round 12.
3. **A watch is none of the three fates.** Lean: T-10, T-18 and T-25
   dropped, T-27 to GOTCHAS, and the sheet's watches (T-32, T-70, T-72)
   stay with their boards.
4. **B-14 against T-27.** The census proposes as a trial what a signed
   verdict calls deliberate. Lean: strike B-14's first clause.
5. **The layout rework** (T-74, T-75, T-77): in Round 11, or a round of
   its own.
6. **T-41 reworded,** as a read of one capped turn.
7. **T-24 as a row of list B.**
8. **The drops** (5.6), row by row.
9. **What signing writes.** Lean: TODO rewritten in one docs commit,
   one section a round, the ticked lines gone (git keeps them), and
   META-ROADMAP's Rounds 9 to 12 each gaining a line per added group.
10. **5.7's first two,** the user's one-minute check and the font's
    upstream.
