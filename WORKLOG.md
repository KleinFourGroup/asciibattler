# WORKLOG — Round 10 (Act 1, the wilds)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 10's earlier phases:
[archive/worklog-phase-142.md](archive/worklog-phase-142.md) (the kickoff,
§141, with the audit at `9e1b7c48`, the spec's and phases' signatures and
the act titles; and §142, the scripted run, its grammar and the user's
play), [archive/worklog-phase-143.md](archive/worklog-phase-143.md)
(§143, the board's acts: the sheet by act number, its shape and leans
signed at 143c) and [archive/worklog-phase-144.md](archive/worklog-phase-144.md)
(§144, the fauna: our glyph face in the Private Use Area, the six beasts
and their attacks, three trees played as one, with the landing note for
§145 at 144g). Round 9's are
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) to
[archive/worklog-phase-140.md](archive/worklog-phase-140.md).

## Phase 145 — act 1 and the run's shape

### The kickoff's audit, and the cut put to the user (2026-11-01, session 05f22793)

Read at `2ea060b9`: `config/sectors.json`, `sector-map.json`,
`terrain.json`, `camps.json`, the encounters and the boon whole, with
their locales; `src/config/sectors.ts`'s and `sectorMap.ts`'s guards;
`layouts.ts`'s themes; `proceduralMap.ts`'s walls and `battleSetup.ts`'s
scenery spawn; `Run.buildEncounterMap`; `RunConfig.ts` and
`RunScript.ts`; the save's fingerprint; and where an encounter's, a
camp's and a unit's text reaches a screen. One measurement: the map
commit on a placeholder act 1.

**The map commit, measured.** In a worktree of HEAD, a placeholder act 1
(The Start's pools copied under `the-periphery`, the King its one boss)
in a node before `start`, with the Generalissimo and the Witch Hunt
moved to The Start, the Queen alone in The Deep End, the boon on act 1
and The Start barren (`scratch/145/place-act1.mjs`). The suite: 19 of
3887 failed, in 10 files; the smoke: 5 of 568, in 2 files
(`scratch/145/probe-fails.txt`). By cause:
- *The map's shape*, as §141 found: `sectorMap.test.ts` (1),
  `sectors.test.ts` (2), `Run.test.ts` (7: the sectors block, a
  procedural board's theme, the shipped run's starting event),
  `scriptedRun.test.ts`'s starting act (3, written at §142: "act 2 alone,
  on today's map, is The Deep End", the act past the end, the clone),
  `board.test.ts`'s forced bosses by act (2, written at 143d), and the
  stored roster table against the live map (`roster-table-coverage.test.ts`,
  1; `rosterTable.test.ts`, 3).
- *Seed scans that re-pick by their own rule*: the chaos driver's census;
  the continuation check and `resume-gates.test.ts`, whose runs no longer
  include one that completes; `journal-replay-options.test.ts`'s rename
  digest.
- *Formatting*: `sector-editor.test.ts`, since the probe wrote plain JSON
  and not the editor's format.
- *Not run*: the corpus, outside both; all 32 journals start in sector 0.
The port canaries and `harness.test.ts`'s starting event passed, since
the boon moved with the map. The real act 1's pools will move the seed
scans again (inferred), so the map commit re-picks them on it.

**Reading act 1 before the map: one gap.** The script puts an encounter,
a layout or an event at any hop, past the sector's pool, so act 1's
fights, its bosses and its events read on The Start's hops. The forest
does not: a procedural board takes the sector's theme
(`Run.ts:2017-2033`), and its camps come from the theme's pool
(`terrain.json`), so no URL shows a forest board, its trees or its camps
until act 1 is in the map, and a finding there after the map commit
re-draws act 1 a second time. The same holds for The Start's barren
boards. A fixture map (`RunConfig.sectorMap`) reaches a sector off the
map headlessly, never in the browser.

**The forest's pieces.** A theme is the enum and `THEMES`, a palette in
`TerrainRenderer.topColorFor`, a `themeTiles` entry and a camp pool
(`layouts.ts:95-110`). The cover density is global (`terrain.json`);
`themeTiles` overrides the pool density alone among the board's own
knobs, and an override draws only where a theme declares it
(`proceduralMap.ts:156-159`, `:182`), so a forest override moves no
shipped board. A procedural board's walls are its crossbars, its
dividers and its noise cover, its windows half cover
(`proceduralMap.ts:1-24`), every one spawned bare by
`spawnLayoutNeutrals` (`battleSetup.ts:271-300`). A tree in a wall's
place keeps the spawn order and draws nothing (inferred; the step's pin
measures it). The battle banner adds "— Forest" to the board's name, as
for every theme but grassland (`BattleScene.ts:136-147`). `theme` is in
the RunSnapshot as a union of the six names
(`tests/run-snapshot-shape.txt:64`, `:96`), so `forest` changes the
save's fingerprint; a v50 save names no forest and parses, which is the
case for a `--compatible` re-pin (`tests/saveShape.ts:248-255`), with no
bump. The World snapshot holds no theme.

**Text that reaches no screen.** An encounter's `description` is editor
metadata, never shown (`src/config/encounters.ts:184`), as is a sector's
(`sectors.ts:6-7`); a camp's name and description have no locale and no
reader in `src`. A player reads an encounter's name (the HUD, the boss
banner), a sector's title and the events. A unit has a name and nothing
more (`locales/en/units.json`), though its card shows on both sides
(`UnitCard.ts:229-244`). So 144's lean, that the user's flavour for the
beasts lands in the encounters' descriptions, puts it where no player
reads it, and the TODO row it named for a unit description line was not
filed (TODO.md searched for "flavour", "flavor" and "unit
description").

**The pools.** The Start holds 6 normal, 2 elite and 2 boss encounters;
The Deep End 7, 2 and 2; both the same 12 layouts with procedural at
weight 2, and the same 12 events. After the moves The Start's bosses are
the Generalissimo and the Witch Hunt, and The Deep End's the Queen
alone. A sector may sit in `sectors.json` off the map: the map's guard
checks that a node's sectors exist, not that every sector is on the map
(`sectorMap.ts:59-70`). An encounter, a camp or a sector in no pool is
rolled by no shipped run, so the corpus is predicted to hold until the
map commit.

**The save.** As §141 found, a v50 save loads onto the three-act map
with the node ids kept, and finishes as the old two-act run. No test
loads a save taken on another map. With RunSnapshot v50 kept (signed at
§141), the proof is a save taken on today's map, kept as a fixture
before the map commit, that loads and plays to its end after it.

### The cut, put to the user (unsigned)

- **145a — the theme in the script** (`none`). `theme` as a fourth item
  of a script entry: a procedural board there takes the named theme's
  tiles, camps and palette in place of the sector's, and a layout keeps
  its own (`script=*:layout=procedural,theme=barren`). Exit: a headless
  test that the item sets a procedural board's theme and camp pool and
  leaves a layout's, with a planted failure; the corpus at its baseline;
  the URL opening a barren board in the pane.
- **145b — act 1's encounters** (`batch`, read at 145e). Five new normal
  encounters (four of beasts, one of bandits with beasts), two elites,
  and the bear's boss fight in stages with the bear in its last; each
  wave's numbers anchored on a named shipped encounter, the bands
  §146's; names drafted for the user to edit, in the locale; the id pin.
  In no pool. Exit: each fought to its end by an `encounter=` URL; the
  corpus at its baseline. Read script: the URLs listed at the stop; watch
  who comes in which wave; wrong looks like a fight with no beast in it,
  a wave that never ends, or a name that reads off.
- **145c — a unit's description line** (`batch`, read at 145e). A
  `units.<id>.description` locale key, shown on the unit card on either
  side where a unit has one; a line drafted for each beast for the user
  to rewrite. Exit: a card without a line unchanged (a pin), one with a
  line drawn in the pane. Read script: a `roster=` URL with beasts and an
  enemy pane with beasts; wrong looks like a line cut off, a card grown
  past its slot, or a line on a unit that has none.
- **145d — the save across the map** (`none`). A save taken mid-The
  Start on today's map, kept as a fixture, and a test that it loads and
  plays to the end of its run. Exit: green at HEAD; a planted renamed
  node id fails it. It holds the map commit to the v50 promise.
- **145e — the forest and its camps** (`stop`). The `forest` theme: a
  palette; `themeTiles` with grassland's hills and mud and a cover
  density of its own (an override that draws only on a forest board);
  a camp pool of three fauna camps and the bandit squatters; and on a
  procedural forest board a tree in each wall's place, one of the three
  by a hash of the cell, so a board's trees stay put whatever else
  changes. The fingerprint re-pinned as compatible. Exit: pins that the
  trees draw nothing (a forest board's units and stream state equal the
  same board's with walls) and that the pick is stable, each with a
  planted failure; the corpus at its baseline. The stop: the forest drawn
  with its arms (the palette, the cover density at the global centre and
  at the forest's, the windows kept as half cover), with 145b's and
  145c's reads.
- **145f — act 1's sector, off the map** (`none`). `the-periphery` in
  `sectors.json`: 11 hops, the forest, 145b's encounters with Brigands
  shared from The Start, the shared layouts and events, the bear's fight
  and the King as its bosses, the boon as its starting event; its title
  in the locale; on no map node. Exit: the load-time guards pass; a
  headless batch on a fixture map of act 1 alone plays its seeds to an
  end with no throw or hang; the corpus at its baseline.
- **145g — act 1 in the map** (`batch`, read at 145h). One commit: the
  node `periphery` before `start`; the King off The Start, the
  Generalissimo and the Witch Hunt to it, the Queen to The Deep End
  alone; the boon off The Start, its line "beasts and bandits"; The
  Start barren and titled The Fragments; the board's forced bosses at
  their new acts; every failing pin re-derived or re-picked by its own
  rule; the corpus re-recorded; the roster table's guard with its
  `sectors` PENDING line; DESIGN, ARCHITECTURE, BALANCE's primer and
  `plans/acts.md` honest. Exit: the suite and the smoke green; 145d's
  save finishing; a run from act 1's root to The Deep End's boss in the
  pane.
- **145h — the phase's close** (`stop`): the user's play from act 1 to
  The Deep End's boss, and the exit by clause.

Predictions: no snapshot bump (World v39; Run v50, the fingerprint
re-pinned as compatible at 145e); no new stream key, and the trees drawn
by a hash, not a draw; the corpus at its baseline through 145f and its 32
journals re-recorded at 145g, each starting in sector 0; the smoke fires
on 145a, 145b, 145e, 145f and 145g, not on 145c (UI and locale) or 145d
(an integration test); the atlas unchanged at 40 of 128; no box.

**The leans the cut builds on**, each the user's to change:
1. *The instrument:* the theme as a script item, the grammar §142 signed
   growing by one item. The other arm, a dial that plays a sector by id
   off the map, reads act 1's own pools and boss roll too, but it
   touches the walk's start and the saved node ids, and the forcing
   dials already reach every fight and event.
2. *The ids:* sector `the-periphery`, node `periphery`, permanent once a
   save holds them; the title can change under them, as The Start's
   does.
3. *Act 1's pools*, the shipped shape: 6 normal (the five new and
   Brigands), 2 elite, 2 boss (the bear's and the King's); the 12 shared
   layouts and procedural at weight 2; the 12 shared events.
4. *The trees:* every wall of a procedural forest board is a tree
   (crossbars, dividers and cover), the windows stay half cover, and the
   forest is denser than the global centre.
5. *The camps:* three of beasts (a wolf den, a rat nest, a puma's lair)
   and the bandit squatters.
6. *The beasts' flavour* on a description line on the unit card (145c).
   The other arm: it waits for a later round, with a TODO row, and only
   the names and the user's events carry act 1's text.
7. *The user's events* (act 1's, and a starting event each for The
   Start and The Deep End) join as each is written, a commit each before
   `0.3.0`, without holding §145's close; each one that enters act 1's
   pool re-records the corpus, since it moves act 1's event draws.

### The cut signed in part; the encounters the user's (2026-11-01)

The user, to the cut: "I had ideas for the encounters and am authoring
them as we speak 😅 Which calls are independent of that?" The answer
named 145a, 145c, 145d and 145e with their reads and leans 1, 2 and 4 to
7 as independent, and 145b, 145f to 145h and lean 3 as resting on the
encounters. The user: "Signing all of those, Claude! 😁 I think I have
at least a rough first pass on the encounters done. No events yet,
though 😅"

So 145b becomes the user's encounters, taken in: locale names, the id
pin, each fought to its end by an `encounter=` URL, guard failures
reported back. The first pass sits in the working tree, uncommitted, and
the session's commits leave it unstaged: `wolfpack`, `rats-nest`,
`rat-hunt`, `poachers` and `canids` (normal, pool 20 each),
`vermin-lords` and `cats` (elite, 30), and `bear`, "The Divine Bear"
(boss, 40), read from `config/encounters.json` against HEAD. Five
normals, two elites and one boss are lean 3's shape, with Brigands and
the King beside them.

### 145a — the theme in the script (2026-11-01, session 05f22793)

*Step zero.* The script's items are read in one place for a board
(`Run.buildEncounterMap`, through `scriptAt`), checked at construction
(`checkScript`), parsed in `parseScript`, and listed for the clone
refusal in the fuzz CLI (`tests/fuzz/commands/args.ts`), since a rollout
clone loads with no config. The camps follow the encounter's theme in
`applyTerrain`, so the theme needs no second reader.

*Built.* `theme` is a fourth item (`ScriptEntry.theme`, a `Theme`):
on a procedural board the script's theme at the hop, else the sector's;
a layout keeps its own. The parse drops an unknown or miscased theme
with a warning that names the six, and the Run refuses one a caller
built. The `--arbitrate` refusal names a theme entry, as it does a layout.

*Evidence.* `scriptedRun.test.ts`, "a theme": on seed 6, hop 2, under
`*:layout=procedural,theme=swamp` the board is swamp and its camp
members are swamp camps' archetypes, read from the raw `terrain.json`
and `camps.json`; the same seed without the item is grassland with
grassland's camps (the seed picked by `scratch/145/theme-seeds.ts`, where
both boards have a camp site). A layout keeps its own theme; an unknown
theme throws. Planted: the Run reading the sector's theme alone failed
the first case ("expected 'grassland' to be 'swamp'"); restored, green.
`RunScript.test.ts`: the parse, the drops and the round trip. In the
pane, `seed=6&hops=11&character=soldier&script=1:battle;*:layout=procedural,theme=barren`
opened a barren 15 × 15 procedural board, its banner "Uncharted Ground —
Barren", with no script warning.

### 145c's step zero: the line has no room on an enemy's card (2026-11-01)

The beasts are enemy-only, and an enemy shows only as the battle HUD's
compact card (`HUD.addCard`, `buildCompactCard`): the glyph, the level,
the power and an HP bar, no name and no room for a line. Its one text is
a hover and focus tooltip with the engage and focus hint, with no touch
route, since a long press there is the focus objective (`HUD.ts`,
`addCard`). The full card, where a line fits, shows the player's units
only (the roster, the pre-turn hand, a recruit offer), so a beast reaches
it only by a dev `roster=`. Nothing else names an enemy on screen: no
board hover, and `nameForArchetype` is read by the cards, the reward,
cache and character screens only. So "on the unit card on either side",
as signed, does not reach the player who meets a beast. The change goes
to the user at 145e's stop, before 145c is built.

### 145d — the save across the map (2026-11-01, session 05f22793)

*Step zero.* A save is the RunSnapshot as text with the dials as query
text beside it (`RunConfig`'s header); `Run.fromJSON` checks the schema
version and no sector id. The continuation check's harness
(`continuation.test.ts`) plays a loaded run by the probe kit's rows.

*Built.* `tests/integration/save-across-map.v50.json`, recorded on the
two-act map by `scratch/145/record-save.ts` (seed 3, no dials, every
fight won outright, saved at the map gate before The Start's fifth hop:
5,568 bytes, schema 50), and `save-across-map.test.ts`: the fixture is
v50 and mid-The Start at node `start`; loaded, with every fight won, it
walks `the-start` then `the-deep-end` and ends `complete`. The fights are
won outright because the question is the walk; the outcome of a real
fight would move with The Start's barren boards at 145g.

*Evidence.* Green at HEAD; the control in the test, the save's node
renamed `nowhere`, throws "node "nowhere" has no successor" at The
Start's end. TESTING lists it among the integration tests.

### 145e — the forest and its camps (2026-11-01, session 05f22793)

*Step zero.* Nothing in `src` or the fuzz code singles out the plain
wall by id (a search for `WALL_ARCHETYPE` and `'wall'`), and the renderer
draws scenery in stone by team (`spriteColor.ts`), so a tree in a wall's
place plays and draws as 144g pinned. The camp loader checks the
terrain pools against `camps.json` at import, so the camps entered with
the forest's pool empty and the pool after.

*Built.* `forest` in `ThemeSchema` and `THEMES`; its palette, deep shade
to moss; its `themeTiles`, grassland's hills and mud and a
`coverDensity` of its own (a new optional knob, drawn after the pool
override and only where a theme declares it); its camp pool, three
beast camps written through the camp editor's formatter (`wolf-den`, two
wolves, leash 3; `rat-burrow`, three giant rats, leash 2; `puma-lair`, a
level-2 puma, leash 2; each the bandit squatters' rewards) and the
bandit squatters. On a procedural forest board each bare wall is a tree
(`spawnLayoutNeutrals`'s `treeSeed`, given by `applyTerrain`), picked by
`treeAt`: FNV-1a of the terrain seed and the cell. The fingerprint
re-pinned as compatible at v50, as predicted.

*The cover density, measured.* The cut's override (centre 0.18 against
the global 0.12) left the forest as it was: over the same 40 first-fight
boards, 13,343 cells, 1,966 trees with it and 1,940 without, 0.147 and
0.145 a cell, since most trees are the crossbars and dividers and the
noise cover is a thin slice. At centre 0.35 (0.25 to 0.5): 2,521, 0.189
a cell, 30 % more. Lean 4 as signed says the forest is denser, so the
step ships 0.35, a change inside the signed intent, put at the stop with
the global density drawn beside it. Forty first turns on forest boards at
0.35 ended inside `MAX_TURN_TICKS`, the user's Wolfpack's and Brigands'
alike (`scratch/145/forest-turns.ts`).

*Evidence.* `battleSetup.test.ts`, "a procedural forest board": the
trees spawn with every unit's id, cell and order and every stream as the
walled board's, the snapshots equal but for the archetype and glyph
(planted, a draw in `spawnTree` failed it); the game's setup puts trees
and no wall on a forest board, all three kinds, and walls on a swamp
board; a board's trees hold when the teams and the world seed change,
and the same cells take other trees under another terrain seed (planted,
the seed out of the hash failed it). The corpus: 0 of 32 journals differ.
In the pane, `seed=30&hops=11&character=soldier&encounter=wolfpack&script=1:battle;*:layout=procedural,theme=forest`
opened a 19 × 19 forest board, banner "Uncharted Ground — Forest", with
a puma's lair and a rat burrow among the trees. The arms drawn in
`scratch/145e/`: the palette with the cut's cover, the leaf-litter
palette, the global cover, and the dense cover. Not verified: Firefox.
