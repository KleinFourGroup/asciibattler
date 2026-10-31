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
play) and [archive/worklog-phase-143.md](archive/worklog-phase-143.md)
(§143, the board's acts: the sheet by act number, its shape and leans
signed at 143c). Round 9's are
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) to
[archive/worklog-phase-140.md](archive/worklog-phase-140.md).

## Phase 144 — the fauna

### The kickoff's audit, and the cut put to the user (2026-10-31, session 900f47a9)

Read at `a98ff0d7`: `config/units.json` and `config/abilities.json`
whole, `src/render/glyphs.ts`, `FontAtlas.ts`'s grid and build,
`FontAtlas.test.ts`, `fontSubset.ts` with `tests/font-coverage.test.ts`'s
rule, the archetype editor's budget check, `src/sim/environment.ts` and
`battleSetup.ts`'s scenery spawn, `spriteColor.ts`, `UnitCard.ts`'s
ability rows, the board explorer's poses, `RunConfig.ts`'s `roster=` and
`encounter=` parses, the corpus's replay, and every reader of the whole
unit catalog.

**The catalog.** 30 ids: 23 combatants, six of them `draftable: false`
(the ice mage, warlock, luminant, banshee, ghoul and prodigy), and 7
neutrals (the walls, the half cover, the rubble). None of the six beasts
is there. An archetype is a plain string in both snapshots
(`src/sim/Unit.ts:32`), so a new id changes neither.

**The melee attacks.** Nine ship: sword, whip, katana, club, cleaver (with
bleed), the ghoul's claw, halberd (reach 2), cane, and gambit (a strike,
then a retreat). Every one plays the `melee_swing` FX, which the FX
registry's guard already covers. The unit card lists a unit's attacks by
name (`src/ui/UnitCard.ts:591-605`), so a beast on a shipped attack would
show a weapon's name.

**The atlas.** 8 × 6 cells of 64 px (`FontAtlas.ts:38-47`), 48 cells, of
which `GLYPHS` holds 31 at HEAD: 5 non-unit and 26 distinct unit glyphs,
printed by a tsx probe. Six beasts and the tree, each with its own glyph,
make 38. The grid is stated twice, as `COLS`/`ROWS` in FontAtlas and as
`ATLAS_CELL_BUDGET` in glyphs.ts, which a comment says must agree and
nothing checks. The three guards (gotcha #33) are FontAtlas.test's budget
case, `FontAtlas.create`'s throw (`:146`) and the archetype editor's Save
block (`tools/archetype-editor/editor.ts:496-523`). The build rasterizes
the glyphs, not the cells (`:188`), and the texture has no mipmaps and
linear filtering (`:231-233`). The size is written in DESIGN (`:511`),
ARCHITECTURE (`:368`), gotcha #33 and META-ROADMAP's S1 line.

**The font.** A glyph must come from a shipped face's subset
(`fontSubset.ts:37-49`, pinned by `tests/font-coverage.test.ts`). A probe
against the vendored faces' cmaps, by that test's rule: ♣ ♠ ↟ are shipped
(from DejaVu, the fallback), and so are ⇞ ¥ Ö Ü and all of ASCII. Greek
(τ, Ψ) and Latin Extended (ŕ) are in both faces but outside the kept
blocks, so a pick from them costs a block in `SUBSET_RANGES` and a
`gen:font` run. The probe's control: τ reads out of range, U in.

**Free letters.** The shipped glyphs take M A R B C G H I L O P V W and
a b c f g h m r s z. So the rat's initial collides in both cases (the
rogue, the ronin), as does the bear's (the banshee, the bandit), and the
fox's lowercase f is the rioter's.

**Who walks the whole catalog.** In `src`, the loaders' reference checks,
`Run.ts`'s grant and roster checks and `RunConfig`'s parses test
membership, and `rosterOrder.ts` ranks by key order; none draws a random
number over the catalog. The draft pool is draftable only
(`archetypes.ts:181`), and so are the prices. A beast in no pool is
therefore rolled by no shipped run, and the corpus, which replays past
its config stamp (`tests/fuzz/corpus/corpus.ts:30`, `:142`), is predicted
to hold its baseline. Appended after the officer, the beasts move no
shipped archetype's rank.

**Where an enemy-only combatant must be registered.** META-ROADMAP's
`extends` bullet lists seven places; four bind an enemy-only unit: the
two strict records in `config/fuzz-strategies.json` (`archetype` and
`composition`, every combatant at 0 today; `tests/fuzz/scoring.ts:36`),
`Recruitment.test.ts:61`'s EXCLUDED, and
`tests/strike-conversion.test.ts:147-152`, which wants the frozen
before-file's units to equal every combatant. Prices and the prior table
take draftable archetypes only, and `REQUIRED_UNIT_IDS` names two shipped
units.

**Found on the way: the redraw-fisher file is refused today.**
`config/redraw-level-fisher.json` lists 10 of the 23 archetypes, and its
schema is strict over all of them (`tests/fuzz/redrawPolicy.ts:60-64`):
`npx tsx tests/fuzz/cli.ts --count=1 --redraw=config/redraw-level-fisher.json`
throws a ZodError at `weights.archetype.reaver`. Nothing in the suite
loads the file. A TODO row, under "Not yet placed".

**Putting a beast on the board.** `roster=` takes any combatant
(`RunConfig.ts:345-356`), and earlier reads of enemy-only units used it
(`roster=banshee:2,warlock:2,mercenary:2`, `archive/post-94-worklog.md`).
A forced encounter resolves against the whole catalog, not the sector's
pool (`:373-377`), but no encounter holds a beast before §145, so in §144
a beast fights on the player's side. The board explorer poses
render-only sprites, on either team, of any glyph the atlas holds
(`src/dev/boardPanel/fixtures.ts`, `posed.ts:91`), so candidates in the
atlas can be drawn on the real board.

**The tree.** Scenery is a neutral unit spawned from its def
(`src/sim/environment.ts`), and the procedural map's walls spawn bare, so
indestructible (`battleSetup.ts:287`). A tree that blocks as a wall does
is a neutral def with no `hp` and the wall's sight block; swapping a
forest board's walls for trees is §145's. Scenery wears stone grey and
the player's team terminal green (`spriteColor.ts:30-34`), so a green
tree would wear the player's hue.

**The beasts' flavour has no surface.** `locales/en/units.json` holds a
name per combatant and nothing else, and no screen shows a unit
description.

### The cut, put to the user (unsigned)

- **144a — the atlas grown (S1)** (`none`). 8 × 6 to 16 × 8, 128 cells,
  the grid stated once so the canvas and the budget cannot disagree.
  Exit: each of the three guards fails on a planted glyph past 128; a
  board in the pane draws pixel-identical before and after, with a
  planted control; the four docs at the new size. Step zero: whether a
  glyph inking its cell's edge (`▄`, `╥`) picks up a new neighbour under
  linear filtering.
- **144b — the glyph sampler** (`none`). A board-explorer pose that draws
  glyphs named in the URL on the real board, each on the enemy's side and
  the player's beside the shipped glyphs it could be taken for, with a
  scenery row; the candidates enter the atlas in DEV only. Exit: the
  production `GLYPHS` unchanged (a pin); a candidate outside the shipped
  font refused by name; the pose drawn in the pane. Kept for the later
  rounds' new units.
- **144c — the glyphs and the attacks** (`stop`). Two to four candidates
  for each beast and for the tree, drawn in the sampler with a lean each;
  the user picks. A pick from an unshipped block names its cost. The
  attacks call, both arms drawn.
- **144d — the beasts and their attacks** (`batch`). Six enemy-only
  archetypes after the officer, with permanent ids (`wolf`, `giant_rat`,
  `fox`, `puma`, `tiger`, `bear`), the picked glyphs, a stat line each
  from a named shipped melee anchor, the attacks on the signed arm, the
  locale names, and the four registrations. Exit: each beast plays by a
  `roster=` URL; the corpus at its baseline; the suite and the smoke
  green. Read script: two `roster=` URLs, three beasts each; look at each
  beast's glyph on the board, its card (name, attack, cadence) and how it
  fights. Wrong looks like a glyph misread at board size, a card naming
  a weapon, or a beast standing idle.
- **144e — the tree** (`none`). A `tree` neutral with the picked glyph,
  no `hp`, the wall's sight block and its burn and frozen. Exit: a
  headless pin that it blocks movement and sight as the wall does, and a
  landing note for §145. No board holds it before §145, which reads it.
- **144f — the phase's close** (`stop`): the exit by clause, with 144d's
  read.

Predictions: no snapshot bump (World v39, Run v50); no RNG stream, and
no shipped run rolls a beast, so the corpus holds; the smoke fires on
144d and 144e (`config/`) and not on 144a to 144c; 38 atlas cells of 128
after 144e, counted as 31 at HEAD plus six beasts and the tree, each its
own glyph; no box.

**The leans the cut builds on.** The grid at 128 cells: the later rounds
name more new units than today's 17 free cells (META-ROADMAP S1), and the
cost is the texture alone, 1024 × 512 against 512 × 384. The attacks:
new ones as data, on ops the engine has (damage, the cleaver's bleed, the
gambit's retreat, the dash's advance) and the shipped swing, each named
for the beast (bite, snap, claw, pounce, rake, maul), since a shipped one
would put "Cleaver" on a tiger's card. The stat anchors: the giant rat on
the ghoul (fodder), the wolf on the bandit with the adventurer's mobility
(a pack runner), the fox on the rogue (hit and run), the puma on the
adventurer (the pouncer), the tiger on the reaver (the heavy hitter), the
bear on the halberdier's bulk (the boss's body); the bands are §146's,
a retune by taste Round 11's. The names are the charter's (Wolf, Giant
Rat, Fox, Puma, Tiger, Bear), and the user's flavour lands in §145's
encounter descriptions, with a unit description line a TODO row for a
later round. The tree wears stone, as the wall does.
