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

### The colliding glyphs, from first principles (2026-10-31)

The user, to the cut: "directionally I agree with all of this, Claude,
but let's talk about the colliding glyphs", recalling a standing item to
support different fonts for them. It is their Phase H feedback ("Add
support for different fonts. Add support for non-Latin scripts.", over a
sprite sheet that "clashes with the roguelike aesthetic";
`archive/phase-h-feedback.md:120-127`), deferred by the post-H roadmap
until a wave of units collides and again at §79f (2026-08-15,
`archive/post-72-worklog.md`), where the user accepted deferring the
style axis. No live TODO row holds it.

The session's first answer, Greek and Cyrillic in the kept blocks with
β for the bear and Я for the rat, the user declined: "I have very mixed
feelings about using faux-latin glyphs. I know that it's very annoying
for people who actually know how to read the scripts", noting that an
ASCII game's audience is the likelier to read them, and asked to "take a
step back and think this through anew, from first principles". The
session withdrew β and Я as the lookalike use the user means.

**The read, from first principles.**
- *The size.* The later rounds name at least 19 more combatants by name
  (the grenadier, telekinetic, ninja, cavalier, vampire, soldier,
  conscript, commissar, aura healer, eagle, falcon, falconer, dragon,
  crab, marine, giant, a swarm, the dark wizard, the demon lord;
  META-ROADMAP), before the deserters, the plague's enemies and act 4's.
  23 Latin letters are free after the beasts, so Latin runs out by about
  Round 22 with no mnemonic at all.
- *The channels.* Hue is the team's, and DESIGN rules out hue alone. Size
  has two or three steps, held for 2×2 bodies and swarms. A second face
  (the style axis) fails in page text: four screens show a unit's glyph
  (the card at 48 px, the fallen strip, the reward screen and the cache
  overlay, by a search for the glyph's readers in `src/ui` and
  `src/scenes`), and the fallen strip already sets every glyph bold
  (`ui.css:3339`); it also costs §79f's plumbing. A mark beside the glyph
  is lost in page text unless each screen draws it. Families on one
  letter (NetHack's) tell members apart by hue, which this game cannot.
  So a unit's identity rides one character's shape, the one channel that
  holds at every size, on the canvas and in the DOM.
- *The supply.* Latin is honest and short. Every assigned character in
  another script or a symbol block has readers, so it is honest only for
  what it means. Unicode's Private Use Area (U+E000 to U+F8FF) assigns
  nothing: a face of our own there is unlimited, borrowed from no one,
  and, as characters in a font, taken unchanged by the atlas, the ink
  measurements, the click boxes and the four screens. JetBrains Mono's
  OFL declares no Reserved Font Name (§79g), so a face derived from its
  outlines is allowed under the OFL.
- *A radical scheme* inside it: a mark that names a family on the unit's
  initial (ears on the beasts' w, r, f, p, t and b; wings on the flyers),
  so the rat stays an r and is not the rogue's. Its weak point is page
  text, where the mark is a few pixels.
- *A glyph is not an id.* The only saved copy is a pending promotion's
  (`PromotionInfo.glyph`, `tests/run-snapshot-shape.txt:187`), so a
  re-glyph later costs no bump.

**The user's calls** (2026-10-31): "I did not know that there's a whole
unicode area for custom glyphs! That makes things easier." On colour: "I'm
not against using some color variation either. Though it would be a big
change, we could always try to make the team color cue be the glow
color, rather than the glyph color. That's very speculative, though, so
let's probably shelve that as a backup in case custom glyphs don't
work." On the scheme: "I like the radical idea also. Though we'll want
to keep anything low-res vectors, to fit with that old terminal feel."
On other scripts: "we really don't need them anymore. 😅 Maybe at some
point we want a CJK glyph for narrative reasons, but I don't have
anything specific yet."

So: custom glyphs in the Private Use Area, tried before they are built;
radicals welcome; drawn as low-res vectors. The glow as the team's cue is
the backup if custom glyphs fail, shelved and not planned. No script
block is added; a CJK glyph waits for a story that wants one (a CJK
character is double-width in a monospace cell and needs a face of its
own, or a drawn glyph in ours).

### The cut amended, put to the user (unsigned)

The change to §144's intent: a glyph face of our own enters the phase
when the trial at 144c says it belongs, which takes the risk from low to
low-medium (a new font in the pipeline and a new dev dependency to build
it, predicted opentype.js, MIT, for the trial to confirm). 144a and
144b stand; the sampler also draws in page text and can load a face in
DEV, so a trial face draws without entering the shipped stack.

- **144a — the atlas grown (S1)** (`none`), as put.
- **144b — the glyph sampler** (`none`), as put, plus a DOM row (a unit
  card's 48 px and the fallen strip's bold text) and a DEV-loaded face.
- **144c — the custom-glyph trial** (`stop`). A scratch face
  (`scratch/144c/`, not shipped) with three beasts drawn as low-res
  vectors, both ways: a radical on the initial (an eared r and an eared
  w, on JetBrains Mono's own letter and on one redrawn to the grid) and a
  whole drawn wolf. Drawn in the sampler on the board and in page text,
  beside the Latin choices (w, p, T, F, U). The decision that goes back:
  whether drawn glyphs belong, which way, and the grid.

If the trial says yes:
- **144d — our glyph face** (`none`). The glyph sources as vector paths
  on the grid in the repo, a build to a woff2 in the Private Use Area,
  the face third in the font list with its metrics inside the primary's
  line, its licence, the coverage guard reading it, and the archetype
  editor previewing it. Exit: a planted drawn glyph from our face on the
  board and in the four screens' text; a glyph missing from the face
  failing the coverage guard; every shipped glyph pixel-identical; the
  woff2's size reported.
- **144e — the beasts' and the tree's glyphs** (`stop`): all seven drawn
  in the face, in the sampler beside what each could be taken for; the
  user signs each. The attacks call, both arms drawn.
- **144f — the beasts and their attacks** (`batch`), as 144d was put.
- **144g — the tree** (`none`), as 144e was put.
- **144h — the phase's close** (`stop`).

If it says no: **144d** the Latin picks (`stop`, with the attacks call),
**144e** the beasts (`batch`), **144f** the tree (`none`), **144g** the
close (`stop`); the shortage returns by about Round 22, and the glow
backup is what is left to plan.

Predictions as put, with two more: the face changes no shipped glyph,
since it sits after the two shipped faces in the stack; and the smoke
fires on neither 144c nor the face (no sim, run, core or config path).

### The cut signed (2026-10-31)

The user, to the amended cut: "Signed! 😁" The cut and its reads are
signed, with the face of our own in §144's scope on the trial's yes.
ROADMAP §144 holds the steps, both branches after 144c. The stretch:
144a, 144b, then the trial's stop at 144c. The attacks lean (new ones as
data, named for the beast) was agreed "directionally" at the first put,
and stays a call at the glyphs' stop.

### 144a — the atlas grown (2026-10-31)

*Step zero.* The grid's only readers are `FontAtlas.ts` (`COLS`, `ROWS`,
`ATLAS_W`, `ATLAS_H`) and `ATLAS_CELL_BUDGET` in glyphs.ts, by a search
of `src`, `tests`, `tools` and `shell`. From the live atlas's ink table
in the pane, only `╥` and `▄` ink a cell edge (the bottom), and the cell
below each is empty under both grids, so no neighbour's edge was
predicted to move.

*Built.* `ATLAS_COLS` (16) and `ATLAS_ROWS` (8) in glyphs.ts, the budget
their product; FontAtlas lays its canvas out on them, and its build
throw names the grid.

*Evidence.*
- `FontAtlas.test.ts` pins the grid at 16 × 8 = 128 and the editor's
  count at 128 and 129; `FontAtlas.budget.test.ts` runs the build's
  throw on a mocked set of 129 (thrown) and of 128 (past the guard, to
  the font load). Planted in a worktree: `ATLAS_ROWS` at 6 failed both
  size pins, and the build guard at `>=` failed the full-grid case.
- The archetype editor reads "31 / 128 atlas cells used" in the pane.
- Each of the 31 glyphs' cells in the new 1024 × 512 texture is
  byte-identical to its cell in HEAD's 512 × 384 one, read from the atlas
  canvas in the pane.
- **The board is not pixel-identical, against the cut's exit.** In the
  hidden window (`npm run probe` with `scratch/144a/atlas-ab.js`,
  1280 × 720, the countdown parked, shader time held, the whole canvas
  read back), the new grid moves 39 of 921,600 pixels on `board-quarry`
  and 70 on `board-open15_pose-row`, each by one level of 255 (one pixel
  by two). HEAD read the same hash in two launches (`a524ce02`). The
  cause, by a control: HEAD's layout with only the height grown to 512
  (8 × 8) moves 74 and 70 pixels, the same size, and 8 × 8 to 16 × 8
  moves the pose row not at all and the quarry by 35 pixels in one row,
  by one level. So most of it is HEAD's 384-px height, not a power of
  two, which made the cells' V coordinates inexact; any taller grid moves
  it. The one-row residual on the quarry was not traced. In the pane the
  quarry's hash went `910e1cb6` to `d96fc831`; there HEAD read the same
  hash across a reload, and a pixel planted in the atlas moved it.
- Not verified: Firefox; the residual row's source.

`scratch/144a/` keeps the readback probe and its pixel diff
(`diff.mjs <a.json> <b.json>`).

### 144b — the glyph sampler (2026-10-31)

*Step zero.* The atlas is built once at boot from `GLYPHS`, before the
Game, and a glyph not in it throws at `addSprite` (gotcha #33), so a
candidate has to be in the atlas from the build: the dev entry, already
loaded before the atlas, is the place to read the URL. The board
explorer's poses take any glyph the atlas holds, on any team.

*Built.* sampler.ts, the `sampler` pose, the `glyphText` dial and
`FontAtlas.create`'s extras, as ARCHITECTURE's board-explorer line now
says. A use:

`?bp=board-open15_pose-sampler&glyphs=w,W;p,P;T,t;F,f;U,B,b;q,r,R;n:%23,U+2663,U+2660,U+219F`

*Found on the way.*
- `URLSearchParams` reads `+` as a space, so `U+E000` arrived as
  `U E000`; the parse test failed on it, and the sampler reads the raw
  pair.
- The first refusal check compared a glyph drawn over `serif` and over
  `sans-serif`, as the atlas's DEV assert does. It refused τ (Greek, outside
  the kept blocks), but passed U+E000 with no face loaded: a code point no
  face has draws one missing-glyph box under either fallback. The sampler
  now reads the faces' character maps, by font-coverage.test.ts's rule,
  and refuses both by name. The atlas's own assert has the same blind
  spot for a catalog glyph no face carries; font-coverage.test.ts covers
  the catalog, so it is left.

*Evidence.*
- `sampler.test.ts`, six cases: the grammar, the bad tokens, the room
  and the dedupe, the shipped `GLYPHS` equal to the catalog's glyphs and
  the five static ones by `atlasCellsFor`, and the pose's rows and its
  no-room note.
- The production path in the pane: the quarry board with no `glyphs=`
  hashes `d96fc831`, as 144a left it, and every glyph's cell is
  byte-identical to HEAD's.
- The sampler in the pane, at the URL above plus `;τ,U+E000`: 32 posed
  sprites, the strip's card glyphs at 48 px and its fallen runs bold at
  16 px, the countdown's plate hidden, and τ and U+E000 refused by name
  on the panel and out of the atlas.
- `npm run build`: dev-scan clean, and none of `glyphFace`,
  `ASCIIbattler Sampler`, `bp-sampler`, `atlasExtras` in the bundle,
  where `FontAtlas: the game` is found once.
- Not verified: a face loaded by `glyphFace=` (144c's trial is the first);
  Firefox.

### The hand-off after 144b (2026-10-31, session 900f47a9)

At the context trigger, at `b8b3a508`. **Done:** the kickoff, the glyph
discussion and the cut signed; 144a and 144b built, both `none` reads
with their evidence above. **Open:** 144c, the custom-glyph trial, not
started; its stop is the next thing the user sees.

**What 144c needs that no doc names.**
- *A font builder.* Only `subset-font` is installed. The trial face
  needs one that writes a TTF or an OTF from paths; opentype.js (MIT) is
  the prediction, installed for the trial with `npm i --no-save` and
  added for real only at 144d on a yes. Its build script and the face go
  in `scratch/144c/` (ignored by git).
- *The face.* Three beasts drawn as low-res vectors (the user's words;
  the reading put to them: straight strokes and few nodes on a coarse
  grid of the cell, at JetBrains Mono's stroke weight), both ways: a
  radical (ears) on the rat's r and the wolf's w, once on JetBrains
  Mono's own letter (its outline from the vendored TTF, so the face is a
  derivative under the OFL, which declares no Reserved Font Name) and
  once on a letter redrawn to the grid; and a whole drawn wolf. Each at a
  Private Use Area code point from U+E000.
- *The read.* The sampler takes the face by `glyphFace=` (a TTF or OTF,
  served from the repo by the dev server, e.g. `/scratch/144c/trial.otf`),
  with rows that put each drawn glyph beside its Latin choices and the
  shipped glyphs it could be taken for, e.g.
  `?bp=board-open15_pose-sampler&glyphFace=/scratch/144c/trial.otf&glyphs=r,U+E000,U+E001,R;w,U+E002,U+E003,U+E004,W;p,P;T,t;F,f;U,B,b`.
  A `glyphFace=` load is unverified (WORKLOG 144b): check the strip and
  the board draw the face, and that a code point the face lacks is still
  refused. Give the user the URL for their own dev server and a pane
  screenshot; the eye on Firefox is theirs.
- *What goes to the user at the stop:* the trial drawn, the three
  decisions (whether drawn glyphs belong, radical or silhouette, the
  grid), and, flagged, that 144a's exit did not hold as cut: the board is
  not pixel-identical (one or two levels of 255 on at most 70 pixels a
  board, most of it the old texture's non-power-of-two height, shown by
  a control), a change inside the cut's intent.

**Tools.** `scratch/144a/atlas-ab.js` (a whole-canvas readback for
`npm run probe`) and `diff.mjs`; the pane capture recipe is 144a's
evidence above.

### 144c — the custom-glyph trial (2026-10-31, session 5849d0c7)

*Step zero.* JetBrains Mono's lines, read from the vendored TTF: 1000
units to the em, a 600 advance, x-height 550, ascender and cap 730,
descender −180, the r's stem 90 (112 to 202). The builder is opentype.js
1.3.4 (MIT), installed in `scratch/144c/`'s own `package.json` rather than
with `--no-save` in the repo's `node_modules`, which other sessions share.
It reads the TTF's outlines and writes an OTF whose character map the
repo's `ttfCmapLookup` reads: U+E000 to U+E008 present, U+E009 and `r`
absent, and JetBrains Mono as the control reads the reverse. The
sampler's `glyphFace=` load, unverified at 144b, holds in the pane: the
face registers, `--font-mono` takes it after the shipped faces, the atlas
and the strip draw from it, and U+E009, which the face lacks, is refused
by name.

*Built*, in `scratch/144c/` (ignored by git): `build.mjs` writes
`trial.otf`, `sheet.mjs` a construction sheet (`/scratch/144c/sheet.html`
on the dev server: each glyph large on its lattice beside the shipped
letters, then at the page's text sizes), `control.mjs` a planted face. The
face, "ASCIIbattler Trial", holds nine glyphs (4.4 KB):

| Code point | Beast | Drawn as |
|---|---|---|
| U+E000 | rat | ears on JetBrains Mono's r |
| U+E001 | rat | ears on an r drawn on the lattice |
| U+E002 | wolf | ears on JetBrains Mono's w |
| U+E003 | wolf | ears on a lattice w |
| U+E004 | wolf | the whole animal |
| U+E005 | bear | one ear on JetBrains Mono's b |
| U+E006 | bear | one ear on a lattice b |
| U+E007 | rat | the whole animal |
| U+E008 | bear | the whole animal |

The third beast is the bear, for the ROADMAP's three where the hand-off
named two: its b is the banshee's and its B the bandit's, and it carries
the ascender case. Each beast is drawn whole, not the wolf alone, since
the silhouette's question is whether three animals tell apart.

The lattice is the old terminals' 5 × 7 dot matrix with two descender
rows, scaled to JetBrains Mono's lines: columns at x = 90 + 105 i (ink
45 to 555), rows at y = 45 + 110 j (row 4 inks to 530, row 6 to 750, row
−2 to −220). A stroke is a polyline through lattice nodes swept by an
octagonal nib 90 across its flats, the stem's weight, so a diagonal is
within 8 % of it; a mass is a lattice polygon filled and swept the same
way.

*Found on the way*, over three drafts on the sheet and the board:
- On whole nodes, five columns can't hold two ears with a gap between
  them: they touch, an M across the top, or stand as ticks. The first
  draft's ears made an M crown over r and w.
- An ear swept by the nib comes out a blunt bullet. The ear that reads is
  a sharp filled triangle, the cat face's "/\_/\", its apex leaning out at
  the ascender line, so it is the one shape not built from nib strokes.
- An ear can't share a side with an ascender: a b with an ear on each
  side became a cat's head and stopped being a b. The ascender stands in
  for the ear on its side.
- A profile animal in a cell 0.6 as wide as it is tall stands tall: the
  first wolf read as a llama and the bear as a temple. Lower, longer,
  filled bodies read as animals on the sheet.

*Evidence.*
- The weight: a row through r at 200 units inks 112 to 202 in JetBrains
  Mono and 45 to 135 in the lattice r, both 90, measured in the pane.
- The board, at 1280 × 720 on `board-open15_pose-sampler`, the canvas
  copied at 3× with hard pixels, both teams: the eared r and w read as a
  letter with ears and apart from r, R, w and W; the lattice w with ears
  reads as a fanged face. The b with one ear is the weakest, a small horn
  on a b. The silhouettes come out about half a letter's ink and alike:
  the wolf reads as a quadruped, the rat as a small critter, the bear as
  a Space Invader. At board size an ear on JetBrains Mono's letter and an
  ear on a lattice letter look the same.
- Page text, the sampler's strip at 1:1 (800 × 560): at 48 and 34 px every
  glyph reads; at 16 px bold, the fallen strip's size, the eared r and b
  still read and the eared w passes for W. The lattice letters are
  blockier than JetBrains Mono's (the octagonal b), a second typeface
  beside the shipped letters.
- The line box: spans of `r×1`, of U+E000 with `×1` and of a mix read 48 px in
  the card's class and 21 px in the fallen strip's and in body text, the
  face carrying JetBrains Mono's 1020 / −300. The planted control, the
  same face with a 1400 ascender, grows the 21 px lines to 27 px; the
  card's line-height is fixed at 48 px, which no face grows.
- No console error on the sampler page.
- Nothing in `src`, `config` or `tests` changed.
- Not verified: Firefox, and window sizes other than those two (the board
  glyph scales with the window).

### The trial put to the user (unsigned)

The three decisions, with the session's leans:
1. **Whether drawn glyphs belong: yes.** A face in the Private Use Area
   drew on the board, at the strip's three text sizes and on both teams
   with no plumbing past the sampler's, kept the line box, and the eared
   letters read apart from the shipped ones on the board.
2. **Radical or silhouette: the radical.** On the board the silhouettes
   are half a letter's ink and alike, and the cell's shape works against
   a profile; the radical keeps the initial, a letter a player can name
   (the fallen strip writes `r×2`), and adds the family. A whole drawn
   glyph stays the tool for a unit with no letter (the tree, a swarm).
3. **The grid: JetBrains Mono's own letter carries the mark**, since at
   board size it looks the same as a lattice letter and in page text it
   keeps one typeface; the face is then a derivative under the OFL and
   ships under it with JetBrains Mono's copyright line. The lattice
   (5 × 7, two descender rows, the stem's nib, a half step allowed) draws
   the marks and any wholly drawn glyph; the ear is a sharp triangle.

To carry to the seven glyphs' stop on a yes: ears suit a letter with a
round top (r, b, p) and not one with points (w, v, y), where they read as
a taller letter; the wolf's w is free in the shipped set, so the wolf may
stay a plain w or take a mark of its own.

Flagged from 144a, a change inside the cut's intent: its exit asked for a
board pixel-identical before and after the atlas grew, and it isn't. The
board moves by one or two levels of 255 on at most 70 pixels of 921,600,
most of it from the old texture's 384-px height, not a power of two, as a
control at HEAD's layout shows (WORKLOG 144a).
