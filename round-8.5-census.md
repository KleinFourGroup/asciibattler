# Round 8.5 census

**Status: being built; section 1 is under its read.** Signed so far
(the user, 2026-10-12): the format, the two scope calls, the authoring
vocabulary kept as a class (A-16), and A-13. The other 18 fates are open. §120's list of what the
round may delete or try, each candidate with its evidence and the proof
that covers it ([round-8.5-spec.md](round-8.5-spec.md) D1;
[ROADMAP.md](ROADMAP.md) §120). The user signs it before anything is
deleted. Section 1, the dials, was written at 120c on 2026-10-12 and is
waiting for its read. The later steps add their sections in this format.
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
- Signed:

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
- Signed:

**A-03 · `tiles.fire.damagePerSec`, `tiles.healing.amountPerSec`** (4 keys with their two parents; `src/config/tiles.ts:27-33`)
- In play: A fire tile burns and a healing tile mends through the `burn` and `rejuvenate` statuses, whose rates are in `config/statuses.json`. These two numbers are a second copy the game does not read; one test checks that the copies agree. Removing them changes nothing in play.
- Evidence: one test reads each (`src/config/statuses.test.ts:131`,
  `:138`), and a word search finds no other. The header: "the only consumer left is
  the §27c balance-proof, which asserts `burn`'s per-second damage ==
  `fire.damagePerSec`". The damage a fire tile does is the `burn`
  status's, in `config/statuses.json`.
- Gotchas: none.
- Fate: **delete** the two rates and the test's two assertions, which
  hold one config number against another. `tiles.json` keeps
  `applyStatusOnEnter`.
- Proof: config.
- Signed:

**A-04 · `units.layer`, `units.ignoresTerrain`** (`src/config/units.ts:190`, `:193`)
- In play: Nothing. They were placeholders for flying units, which do not exist: no unit sets them and no code acts on them.
- Evidence: no unit sets either; `src/config/units.test.ts` reads them at
  four lines to show the schema parses them. The schema's comment: "Flight
  (deferred build) … Inert until flight builds." META-ROADMAP's flight is
  a per-unit `traversal` profile shared with the marine (line 102), which
  is not these two keys.
- Gotchas: none.
- Fate: **delete**.
- Proof: config.
- Signed:

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
- Fate: **ask** (lean: delete). The dash's reach is already authored
  once, as the ability's `rangeCells`, and that copy is the one in use.
- Proof: config.
- Signed:

**A-06 · `EventPage.art`** (`src/config/events.ts:175`)
- In play: Nothing yet: a slot for a picture on an event page, which no page fills.
- Evidence: none of the 51 pages sets it; only the event editor reads it.
- Gotchas: none.
- Fate: **keep.** META-ROADMAP Round 10 names "the event `art?`/fx
  seam's first consumers" (line 945).
- Signed:

**Declared and never built.**

**A-07 · `move.mode`: `knockback`, `pull`** (`src/sim/effects/schema.ts:171`)
- In play: Nothing: they would shove or drag the TARGET of an ability, and the game refuses an ability that uses either.
- Evidence: no ability uses either; `executeMove` and the proposal both
  throw on them ("reserved — deferred to Cluster 2's occupancy core").
  Cluster 2 closed without them, and META-ROADMAP, TODO and DESIGN do not
  name a knockback.
- Fate: **delete** the two values and the two throws.
- Proof: sim.
- Signed:

**A-08 · `orphanPolicy`: `re-home`** (`src/sim/effects/schema.ts:69`; `src/sim/Action.ts:59`)
- In play: Nothing: it would send a shot after a new target when its first one dies in flight. No ability asks for it and no code does it.
- Evidence: no ability uses it; `Action.ts:51` says "DECLARED ONLY in F2 —
  no action uses" it.
- Fate: **delete** the value.
- Proof: sim.
- Signed:

**A switch whose other position nothing selects.** The code for the
unselected position ships and is run by tests only.

**A-09 · `selection.strategy`: `layoutFirst`** (`config/selection.json`, one key; `src/run/encounters/selection.ts:135-153`)
- In play: When a run reaches a fight, the game picks the encounter and then a board it fits on. `layoutFirst` picks the board first and then an encounter that fits it. No encounter restricts its boards today (`layouts` is set on 0 of 19), so the two make the same two picks in the other order. A player could not tell them apart.
- Evidence: the shipped value is `encounterFirst`. `layoutFirst` is one
  function of 19 lines, named in `selection.ts`, the loader and their
  test. With it gone the key has one legal value, so the key, its loader
  and the one-key file can go too.
- Gotchas: none.
- Fate: **ask** (lean: delete all of it; config files 33 to 32).
- Proof: sim, and config for the file.
- Signed:

**A-10 · `objective.focusTileResolution`: `disallow`, `clearOnArrival`** (`config/objective.json`; `src/sim/focusTile.ts:52-82`)
- In play: The player can order the team to focus on a tile. Shipped (`leashAtNearest`): units run to the tile, then fight what comes near it and hold there. `disallow` would refuse the order outright. `clearOnArrival` would send units to the tile past every enemy and drop the order once one of them stands on it; on a tile nobody can reach, they would run at it for the rest of the battle. The header says the three were kept switchable "so playtest can A/B". Removing the two changes nothing in play.
- Evidence: the shipped value is `leashAtNearest`. The other two are
  resolvers in `focusTile.ts`, about 30 lines, named on eight lines of
  its test; `src/sim/World.ts` and `src/sim/objective.ts` name them in
  comments only. With them gone the key has one legal value.
- Gotchas: none. TODO names `focusTile.ts` only for a shared helper.
- Fate: **ask** (lean: delete the two and the key).
- Proof: sim.
- Signed:

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
- Fate: **trial**, in the run phase: one rule in place of two switches.
  `chipRule.ts` was not read whole, so what it would remove is not
  counted yet (120f sizes it).
- Signed:

**A mechanism the shipped value turns off.**

**A-12 · `health.fatiguePerStack` = 0, with `fatigueMaxStacks`** (`src/run/fatigue.ts`, 57 lines)
- In play: Nothing today. Switched on, a unit sent out again in the same encounter would take the field with less health for each earlier turn it fought there (10 % a turn at the spec's rate, down to half). At the shipped rate of 0 no unit is ever tired.
- Evidence: at 0 `fatigueEffect` returns nothing and no unit is tired.
  One game line reads the rate; tests set it at three places. BALANCE's
  run log holds a paired read of 0.1 against 0 that ends "fatigue back
  to 0".
- Gotchas: none.
- Fate: **ask.** If fatigue is not coming back in Round 10 or 12, the
  file, the two keys and the seeding go (lean: delete; it was measured
  and turned down). It is in the sweep's registry, so a sweep can still
  move it today.
- Proof: sim and config.
- Signed:

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
  fun"). The session takes this as the damage rule. The 148 pieces are
  not in the row: taking them off the boards changes five boards a
  player sees, which is a behaviour change and a call of its own.

**A-14 · `growthRates.power` = 0 on all 23 units** (`src/config/units.ts:118`; `src/sim/leveling.ts:104`)
- In play: `power` is what a unit costs its own pool when it falls: 1 for twenty units, 2 for three, and an encounter can set it for an enemy. This key would make it rise with level. Every unit has 0, so a level-10 unit costs what a level-1 unit costs. Removing the key keeps it that way.
- Evidence: every unit sets 0, and `src/config/units.test.ts:361` asserts
  it is 0, so the key cannot move without that test changing.
- Gotchas: #96 names `growthRates` for another reason.
- Fate: **ask** (lean: delete the key from the 23 units, the schema and
  the one line, if power is meant not to grow with level).
- Proof: config.
- Signed:

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
- Signed:

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
  `tools/` reads them. Whether the game reaches any through the locale
  layer by a computed key was not settled.
- Fate: **keep**: an author's notes on the content, with no code behind
  them.
- Signed:

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
- Fate: **keep.** Each is the
seam its tests use to reach a mechanism that ships (Escalation multiplies
onto the three multipliers; a test catalog or sector map is how the event
and sector code is tested without the shipped content).
- Signed:

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
- Signed:

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
- Fate: the five that tune a live flag, **keep** with it. The five
  investigation instruments, **ask**, at the
  bot and fuzz instruments' phase: whether one is a tool the user still
  reaches for is theirs to say, and the code behind each was not read.
- Signed:

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
  `tiles` with one key, and remove a second file.
- Two config files only the fuzz instruments read are in the game's
  config stamp, by a stated choice (`src/config/configHash.ts`, header).
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
5. **The fates,** row by row: A-01 to A-20. A-13 and A-16 are signed;
   the user is reading the rest with the "in play" lines.
