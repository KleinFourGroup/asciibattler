# WORKLOG — Round 10 (Act 1, the wilds)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 9's phases are
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) to
[archive/worklog-phase-140.md](archive/worklog-phase-140.md) (the close,
with Round 9's exit read and Round 10's charter against the code at
140a).

## Phase 141 — the kickoff

The kickoff's inputs, by pointer: the charter, META-ROADMAP §"Round 10 —
Act 1, the wilds", with the roster table's rebuild added at Round 9's
close; its premises at HEAD, `archive/worklog-phase-140.md`, 140a; the
act design, [plans/acts.md](plans/acts.md); TODO's Round 10 section;
`process/planning.md` "Phase kickoff".

### The kickoff's audit, and the phases put to the user (2026-10-30, session c15dd076)

Read at `9e1b7c48`. The scripted run, the fauna, the content and the
shell were read in this session; three read-only subagents swept the
rest (two-sector assumptions in `src`, `tools` and `scripts`, with the
save and the UI; the board's sheet and roster table; the tests a new
first sector moves), each claim with its file and line. Spot-checked
here against the code: `board.ts:168-169`, `:344-357`, `:617-631`;
`rosterTable.ts:77-86`; `reporters.ts:44-50`; `args.ts:702-729`;
`sectorMap.test.ts:13-17`; `hopsRemaining.test.ts:51-53`;
`harness.test.ts:191-194`; `Run.ts:782-792`, `:3051-3060`,
`:3762-3766`; `wave.ts:205-210`; `GameOverScreen.ts:244`;
`config/health.json`. The draft spec is
[round-10-spec.md](round-10-spec.md).

**The engine takes a third sector with no code change.** The sector
map's schema counts no nodes (`src/config/sectorMap.ts:38-126`),
`remainingSectorHops` walks any chain, and a run ends at a sink's boss
(`Run.ts:3056`). A search of non-test `src`, `tools` and `scripts` for
the two sector ids, the two node ids, `deepEnd` and a sector index
compared to a number found no logic, only comments that say two
(`Run.ts:9-10`, `sectorMap.ts:11-12`, `RunConfig.ts:58-59`). Act 1 is
data: a sector in `config/sectors.json` whose pools pass the load-time
guards (`sectors.ts:124-184`, `selection.ts:177-199`), a new source node
with an edge to `start`, and a title key.

**Every seed re-draws.** The run's streams key on `sectorIndex`, the
count of sectors entered (`Run.ts:844-856`, `:1526`, `:1684`, `:2322`,
`:2560`, `:3070`, `:3119-3134`, `:3264`), and the event and deck streams
on run-wide counters (`:1211`, `:1289`, `:1705`). With act 1 at index 0,
The Start's draws move to today's Deep End keys, and the shipped sectors'
encounters, layouts, events, rewards, level-ups, offers, ports and
battles all re-draw. No stream key changes, so `rngStreams.test.ts`'s pins
stand. What moves with the map commit:
- *fails on the map alone:* `sectorMap.test.ts:13-17`; `Run.test.ts`
  `:3809-3829`, `:4007-4019`, `:4021-4040`;
  `rollout/hopsRemaining.test.ts:51-53` (the second sector as the sink);
  `roster/rosterTable.test.ts:37` with `:256` (a two-sector fixture
  against the live map); `roster-table-coverage.test.ts:137-139`.
- *reads The Start as the first sector:* `Run.test.ts` `:226-236`,
  `:600-653`, `:965-987`, `:6101-6116`, `:6270-6285`, and
  `harness.test.ts:194`, which wants the first sector to author exactly
  one starting event.
- *seed scans that heal or re-pick by their own rule* (TESTING.md
  448-449): the port canaries (`harnessPort.test.ts:35-47`,
  `harnessEconomy.test.ts:114-118`), the chaos driver's seeds (its header
  says how to re-pick), the resume and continuation tests' `RUNS`, which
  must meet every gate within 5000 steps.
- *the journal corpus:* all 32 rows start in sector 0 and diverge, a
  `--record` by `corpus.ts`'s own rule, a change meant to alter
  behaviour; the config hash covers both sector files, so every stored
  journal's stamp goes stale.

**Every single-sector probe changes target without failing.**
`hopCount` (`hops=N`) and `firstNodeKind` act on the first sector only
(`Run.ts:782-792`, `:3128-3131`). From the map commit they read act 1,
and nothing in the game or the tools opens The Start or The Deep End
alone:
- the board's `ACT1` rows run `--hops=11` (`board.ts:168`): the six act-1
  win rows, the forced King and Queen (`:344-357`), the doctrine
  controls, the anchors and the gradient legs, all against references
  measured in The Start;
- the searcher's `quick` and `medium` presets (`search.ts:130`, `:134`);
- `--roster=sampled:<hop>`, which defaults to sector 0 (`args.ts:702-729`);
- every `hops=` URL in the pane recipes and the user's own probes.
So the scripted run's starting act, in [plans/acts.md](plans/acts.md)
("starting at any act") but not in the charter's list, is the instrument
the board's per-act rows and the user's play of acts 2 and 3 need. The
cut puts it in §142's scope.

**The board's instruments are two-act shaped.** Only
`tests/fuzz/board/` reads the sheet.
- The seam: `summary.csv` carries one column, `poolAtSectorEnd`, the pool
  at the first clear (`reporters.ts:44-50`, `:92`), though the harness
  records every clear (`harness.ts:168-174`); `seamPoolFraction` is one
  band on the walk rows (`board.ts:281-290`).
- The wall and reach: one terminal, the winners' furthest
  (`board.ts:617-631`), so both describe the last boss only;
  `deepEndWallTarget` and `terminalReachTarget` are single bands and the
  win band is derived from the one wall (`:263-266`). `BoardCheck` has no
  act field (`:119-127`).
- Per act, the board needs each act's terminal hop, and hop numbering
  starts at 1 in sector 0 and at 0 after (`rosterTable.ts:163-170`,
  gotcha #120).
- The board's pairing is within a cohort (`ceiling-*`, `fire-channel`,
  `board.ts:400-431`); per-seed pairing against another tree is
  `scratch/139/board.mjs`, whose depth (won, sectors cleared, final hop)
  holds for any number of sectors and whose rows assume `act1` and `walk`.
- `board.test.ts` and `boardCli.test.ts` derive their numbers from the
  sheet, so they break on its schema, not on the map.

**The roster table.** Its key is `character|sector|hop`
(`rosterTable.ts:77-86`); 41 buckets (the three characters at sector 0,
hops 1 to 10; the soldier at sector 1, hops 0 to 10), 21,221 battles,
measured at `4d3fa22` (94h), before Round 9's conversion, so its rosters
are the old game's. `makeRosterSampler` refuses a table whose sectors are
not the map's walk, with no PENDING escape (`rosterTable.ts:303-322`);
the coverage test's `sectors` PENDING line suppresses its position check
only. The rebuild is the board's eight ARM rows' `rosters.csv` through
`npm run roster:table` (BALANCE.md:298), so it is box work: the 94h board
was 26 batches and 6.9 h of box time (BALANCE.md:4683-4686), and a
three-act walk row is longer (inferred, about 1.5 times; not measured).

**The save.** A RunSnapshot holds `sectorIndex`, the current sector and
node ids, the node map, the rolled boss and the cleared sector
(`Run.ts:3574-3653`), not the sector map, and a load checks neither id
(`:3762-3766`). With `start` and `deep-end` kept and the new node in
front, a `0.2.0` save loads and plays: mid-The Start it keeps its map and
the boss it rolled, walks to The Deep End and wins there, a 22-hop run
that skips act 1, its end screen calling The Start "Sector 1"
(`GameOverScreen.ts:244`), and the win counts for Escalation
(`progress.ts:95-103`). A renamed node id loads and then throws at the
sector's boss (`sectorWalk.ts:83-85`); a renamed sector id throws when
the map reads the title (`Run.ts:1776-1779`). No test loads a save
across a sector-map change: the resume test's saves come from live runs.
Nothing else in the round needs a Run field.

**The bosses keep their formulas, and only the Queen moves in the run.**
A wave's level budget is the factor times the roster's mean or median
level times the hand (`wave.ts:205-210`); no hop or sector index enters
it, and `minHop` counts within the sector. A boss's `healthPool` is
absolute (King 36, Queen 44, Generalissimo 36, Witch Hunt 39). By run hop
the King stays at 11 (act 1's end) and the Generalissimo and the Witch
Hunt stay at 22 (The Start's end, now act 2); the Queen goes from 11 to
33, alone in The Deep End's pool, at a factor of 1.25 against the Witch
Hunt's 1.34 an act earlier. Hops 23 to 33 are new ground: no encounter
has been tuned there, and rosters reach the level cap of 20 more often
(plans/acts.md). `seamHealFloor` is 1.0 of a 40 pool
(`config/health.json`), so a third sector adds a second refill to full
(`Run.ts:3104-3111`).

**The fauna and the atlas.** None of the wolf, giant rat, fox, puma,
tiger or bear is in `config/units.json`'s 30 ids; enemy-only is
`draftable: false`, as for six shipped units, and the prior table and its
coverage test take draftable archetypes only. The atlas holds 26 unit
glyphs and 5 others, 31 of 48 cells (`src/render/glyphs.ts:28`, `:36`);
the six beasts take 37, so act 1 does not need the resize, which the
charter keeps for the rounds after. Two guards meet the first beast:
`tests/strike-conversion.test.ts:147-151` wants the frozen before-file's
units to equal every combatant in the catalog, so a unit born after the
conversion fails it until the test names such units; and a beast's
attack needs an `fx` under `FX_REGISTRY`'s coverage guard (135d).
`src/config/encounters.test.ts:83-126` pins the exact encounter id list.

**The content's surfaces.**
- A boss is an encounter of existing archetypes in stages (the King's
  eight); the bear is a new archetype in a new boss encounter.
- Camp pools are keyed by theme, not sector (`config/terrain.json`,
  `procedural.camps.pools`), and grassland's and barren's are the same
  two bandit camps. Fauna camps in grassland's pool reach The Start too
  while it is grassland; under the barren lean The Start keeps the bandit
  camps it has.
- Both shipped sectors list the same 12 layouts and the same 12 events.
  The run-opening boon, `sector-1-start` ("The Beginning", "This sector
  is rife with bandits"), is The Start's `startingEvents`, so without a
  move it opens act 2 and act 1 opens on an ordinary root.
- The player-facing sector name is the title alone (`locales/en/sectors.json`);
  the description is editor text. The map banner and the sector-cleared
  screen show the title ("Next: The Start" after act 1); no screen says
  "act N of M". The sector map stays hand-edited JSON (the sector
  editor owns `sectors.json` only, and `tests/tools/sector-editor.test.ts`
  wants that file byte-identical to its formatter).
- Escalation is five levels of three levers with nothing per sector;
  progress holds `creditsSeen` and `bestWin` per character, keyed to no
  sector or boss.

**The scripted run, at HEAD.** `RunConfig`'s four forcing dials hold one
id each (`src/run/RunConfig.ts`); `RUN_CONFIG_PARAMS` holds 13; the parse
and its inverse are written field by field (`:365-400`, `:418-460`).
`firstNodeKind` stamps the root after generation and draws nothing
(`NodeMap.ts:483-503`, `stampRootKind` at `:879-890`), and a sector
advance regenerates without it (`Run.ts:3119-3131`). A walk enters one
node a hop, so an entry keyed by hop is keyed by the walk's step. A
port's stock is rolled on two streams keyed by sector and node
(`Run.ts:1525-1527`) and nothing overrides it. The run starts at
`pickStartSector` (`:844`); only the code-only `sectorMap` changes where.
The CLI's help lists neither `--sectorHops` nor `--escalation`
(`tools/run-config/cli.ts:72-96`).

**The text that says two acts:** DESIGN.md:93 and :126, ARCHITECTURE.md:506,
BALANCE.md's primer and Protocol v2 run shape (`:21-41`, `:142-146`), the
board's titles and comments (`board.ts:27-30`, `:169`, `:273`), the fuzz
CLI's (`tests/fuzz/cli.ts:25-28`), `benchRunRollout.ts`'s "act 2" label
and ×2.2 two-act factor (`:101-111`, `:144`), and the comments above.

**The shell.** The Bash tool still halves a backslash run on Claude Code
2.1.309: `printf '%s\n' 'two:\\ four:\\\\ end'` printed `two:\ four:\\ end`,
and the mod's note came after the run. The guard's premise holds.

**What the audit changes in the plan.**
1. The scripted run takes the starting act (above), and so it comes
   before the board's tooling as well as before the content.
2. Act 1's content can be authored off the map and played by the
   forcing dials (`encounter=` works past a sector's pool), so no shipped
   run moves until one commit puts act 1 in the map; that commit carries
   the re-baseline, the camps and The Start's theme together, since camps
   follow the theme.
3. The board's tooling re-points the act rows through the starting act,
   besides the seam per seam and the wall per act, and is best built
   while today's `--hops=11` rows still read The Start, since they are the
   twin a re-pointed row must reproduce.
4. No Run bump is needed if the node ids stay; the call is the user's.

**The phases, put to the user (unsigned).** The ROADMAP takes them once
signed; each phase's steps are cut at its own kickoff.

- **§142 — The scripted run.** *Charter:* one list of per-hop entries on
  `RunConfig` with a URL form, of which `layout`, `encounter`, `event` and
  `firstNode` become cases, with entries for a port's stock and for the
  act a run starts at; `--sector-hops` and `--escalation` in the
  run-config CLI and its help; a warning when a forced encounter matches
  no node. Its first step is the backslash guard (TODO, signed at 140d).
  *Why here:* act 1 is authored and read through it, and the board's
  per-act rows start at an act through it. *Risk:* low-medium: the parse
  is rewritten, and every URL in use keeps its meaning. *Decision
  points:* the entry grammar and its URL form (a stop). *Exit:* the
  user's three cases (an event chain end to end, a chain of encounters
  and layouts, a port's stock) and a start at act 2 each in one URL, each
  with a headless test and its planted failure; the old dials' tests
  green unchanged; a run with no script unchanged (the corpus at its
  baseline). *Scope guards:* no content; no Run field, since the script
  rides the saved query text; no board row changed.
- **§143 — The board's acts.** *Charter:* the sheet's multi-act tooling
  (A23's tooling half): a seam per seam in `summary.csv`, the wall and
  reach per act, the act rows reading one act alone through the starting
  act, and the sheet's two-act names (`deepEndWallTarget`, `act1WinRefs`)
  per act. *Why here:* before act 1 enters the map, today's `--hops=11`
  rows are the twin a re-pointed row must reproduce; after it no twin is
  left. *Risk:* low-medium. *Decision points:* the sheet's per-act shape.
  *Exit:* on today's map the re-pointed act-1 rows reproduce the
  `--hops=11` rows, and a stored two-act cohort reports the same numbers
  under the new parse; each new check with its planted failure. *Scope
  guards:* no band moved; no board cohort.
- **§144 — The fauna.** *Charter:* the wolf, the giant rat, the fox, the
  puma, the tiger and the placeholder 1×1 bear, enemy-only 1×1 melee
  archetypes with their attacks, glyphs, stats and locale; the atlas
  grown (S1). *Why here:* the units before the encounters that hold
  them, and a unit in no pool moves no shipped run. *Risk:* low.
  *Decision points:* the glyphs (a taste stop); new attacks or the
  shipped melee ones. *Exit:* each beast in play by URL, its glyph read
  by the user; the atlas's three guards at the new size; the corpus at
  its baseline. *Scope guards:* no new mechanism, no pool entry; no
  flyer, swimmer, 2×2 or swarm.
- **§145 — Act 1 and the run's shape.** *Charter:* act 1's sector off
  the map (normal, elite and boss encounters with the bear's, layouts,
  events, fauna camps, locale), each read through the forcing dials;
  then one commit puts it in the map before The Start, moves the King to
  act 1, the Generalissimo and the Witch Hunt to The Start and the Queen
  to The Deep End, moves the boon, sets The Start's theme, re-derives or
  re-picks every seeded pin by its own rule, re-records the corpus, and
  gives the roster table's guard its PENDING line. *Why here:* on the
  scripted run, the board's acts and the fauna. *Risk:* medium: every
  seed re-draws, and the run goes to 33 hops. *Decision points:* the
  save; The Start's theme; the titles; the boon's place and line; act
  1's size and who writes its text. *Exit:* a run from act 1 to The Deep
  End's boss, playable end to end, read in the user's play; DESIGN,
  ARCHITECTURE and BALANCE's primer honest. *Scope guards:* no change to
  the shipped sectors' content beyond the moves; no new mechanism.
- **§146 — The board and act 1's bands.** *Charter:* the roster table
  rebuilt on the three-act map from a box cohort, the board on three
  acts, act 1's bands set and signed, each moved boss read at its new
  place, and acts 2 and 3 recorded as Rounds 21 and 22's starting points.
  *Why here:* the bands rest on the table and the tooling. *Risk:*
  medium: box time (the 94h board was 6.9 h on two acts). *Decision
  points:* act 1's bands; the box's size and cost. *Exit:* the coverage
  guard with no PENDING line; act 1's bands signed; the board read
  against `0.2.0`, paired on the seed where the pairing holds. *Scope
  guards:* no retune by taste (Round 11's); acts 2 and 3 not re-anchored
  (Rounds 21 and 22).
- **§147 — The close.** Round 10's exit by clause; `0.3.0` by the
  version rule; the process read; the archive; Round 11's charter
  against the code.

**Tranche 1, put to the user:** the spec as drafted and the six phases
in this order; and the starting act in the scripted run's scope, lean
yes. **Tranche 2**, each at its phase's kickoff: the glyphs and the
attacks (§144); the save, The Start's theme, the titles, the boon, and
act 1's size and authorship (§145); the box (§146).

### The spec and the phases signed (2026-10-30)

The user: "That looks great to me, Claude! Signed!", covering tranche 1:
the spec, §142 to §147 in the order put, and the starting act in §142's
scope. ROADMAP holds §141 ticked and §142 to §147; META-ROADMAP's
scripted-run bullet names the starting act; the spec's status line says
SIGNED. The user asked what else to firm up before the build; the
answer lists tranche 2's calls with their leans, none of which §142 or
§143 rests on.

### Tranche 2 answered in part; the titles and a forest theme (2026-10-30)

The words are the spec's "Tranche 2, answered in part". Settled: the
user writes act 1's events, the beasts' flavour and a starting event for
each of acts 2 and 3; the boon moves to act 1 as "beasts and bandits";
RunSnapshot v50 and the node ids stay; act 1 takes the shipped sectors'
shape; the script is inline in the URL. The encounters' text was not
covered, so the lean stands: the session drafts it and the user edits.
Since the user's writing runs beside the build, §145 can put act 1 in the
map on the shared events and the boon, with each of the user's events
joining the pool as it is written, before `0.3.0`; §142's script is the
user's tool for playing an event chain end to end.

**The titles, the session's ideas** (the user asked for names with the
game's computing double meaning). A title is display text; the ids stay,
since a renamed id breaks a saved run (§141's audit). The screens read
"{title} is behind you" and "Next: {title}", and "sector" is already a
player-facing word ("Sector Cleared", "Sector map").
- Act 1: *The Root*, the session's pick: a file system's root, where
  every path begins and the run does too, and the wild's roots, which a
  forest makes literal. "root" is also the code's word for a sector
  map's first node, a clash in the docs only, since no screen says it.
  *The Boot Sector*: a disk's first sector, read as a machine starts,
  the cleanest pun and the weakest wild. *The Sticks*: the back country
  and a memory stick.
- Act 2, The Start's title: *The Bad Sectors*, the session's pick: a
  disk's damaged, unreadable sectors and the badlands, a lawless barren
  country, for a realm coming apart. *The Fragments*: a fragmented disk
  and the warlord era's fragmented realm. *The Partition* was dropped for
  its history.

**A forest theme, measured at HEAD.** A theme is an enum value with a
palette, a `themeTiles` entry the parse requires, and a camp pool
(`src/config/layouts.ts:107-130`, `TerrainRenderer.topColorFor`,
`config/terrain.json`); `theme` is in the RunSnapshot, where adding a
value breaks no save and renaming one does. Nothing draws a tree today:
a theme changes tile colours and tile kinds (hills, mud, sand, ice,
water, fire), and the procedural map's solid cover comes out as wall and
half-cover cells (`proceduralMap.ts:417-426`) spawned as `#` and `╥`. So
a forest that reads as one needs a tree: a plain scenery body that
blocks movement and sight as a wall does, drawn where a forest board's
cover would put a wall. Swapping the body leaves the draws alone
(predicted, not measured). The charter already allows a tree as plain
scenery; a flyer over it is Round 20's. The cost: the tree, one atlas
cell (38 of 48 with the beasts), in §144 with its glyph in the same
taste stop; the theme, its palette, its tiles and a camp pool for the
fauna camps in §145. Authored layouts keep their own themes, so act 1
looks like a forest on its procedural boards and on any layout authored
as forest. Trees with rules of their own (half cover, slowing, sight
only) would be a new mechanism, outside the round. *The session's
preference:* forest for act 1, the beasts' home, which changes
plans/acts.md's grassland for act 1 (the user's call); The Start to
barren still, for act 2's register, though with act 1 a forest a run no
longer opens grassland twice either way.

## Phase 142 — the scripted run

### The kickoff's audit, and the cut put to the user (2026-10-30, session c15dd076)

§141's audit read the dials, the port's stock, the start and the CLI's
help at `9e1b7c48`; read here as well, at `c172ea33`:

- *`--arbitrate` refuses the probe dials.* The fuzz CLI refuses it with
  `--encounter`, `--layout` and `--draw-add`, and with the scatter
  chances on a multi-sector shape, since a rollout clone loads with no
  config and drops every probe dial (`tests/fuzz/commands/args.ts:571-598`);
  `--hops` stays legal. A script entry that shapes the run after
  construction is such a dial. The starting act is spent at construction
  and its result is in the snapshot (the sector index and the sector and
  node ids), so a clone keeps it, as it keeps the Escalation level. The
  board's arbitrated act rows (§143) need only the starting act.
- *The fuzz CLI has flags of its own* for these dials, checked loudly
  (`layoutFromArgs`, `encounterFromArgs`, `args.ts:749-775`), where the
  URL parse drops an unknown id; the run-config CLI forwards any
  `RUN_CONFIG_PARAMS` name (`tools/run-config/cli.ts:55`).
- *The guard's seam.* The mod's Bash hook runs the stdin refusal before
  the command (`.claude/skills/context-meter/hooks/register.ts:44-48`) and
  the halving note after it (`:95-108`), on `halving.ts`'s model of
  bash's reading; the twins are `tests/shell-stdin.test.ts` and
  `tests/shell-halving.test.ts`.

**The cut.** No snapshot bump (the scope guard); no new stream key; a
stocked port skips its two stock streams, which are keyed per port, so
it moves no other draw (predicted); the fuzz smoke fires at 142c to
142g, and the parity test at 142g, which stages `tests/fuzz/`; no batch;
no count re-recorded.

- **142a — the backslash guard** (`none`). The mod refuses, before it
  runs, a Bash command that the halving makes bash read differently,
  naming the line and the Write tool, as the stdin guard does. *Exit:* a
  planted halved command refused; a run before a double quote, a single
  backslash and a PowerShell call pass; `process/shell-and-windows.md`
  and the mod's README say so. One commit; no smoke.
- **142b — the grammar** (`stop`). The entry list's shape and its inline
  URL form, with the user's three cases and a start at act 2 as worked
  URLs, each old dial written as a case, and which entries `--arbitrate`
  refuses. *Exit:* signed. Docs only.
- **142c — the list, with the old dials as cases** (`none`). `RunConfig`
  holds the list; `layout`, `encounter`, `event` and `firstNode` parse
  into it and mean what they meant. *Exit:* the old dials' tests
  unchanged and green; every old URL form round-trips through the parse
  and its inverse; the corpus at its baseline, 32 of 32, with a planted
  misparse caught.
- **142d — the per-hop entries** (`none`): a hop's kind, encounter,
  layout and event, with the zero-match warning (R13). *Exit:* each with
  a headless test and its planted failure; an entry past its sector's end
  refused at construction; an entry that never applies warns.
- **142e — a port's stock** (`none`). *Exit:* a stocked port offers
  exactly its entry at the price book's prices, with its planted failure;
  an unstocked port's draws unchanged.
- **142f — the starting act** (`none`). A run opens at the walk's Nth
  sector, at the sector index a full walk has there, and with `hops`
  plays that act alone. *Exit:* on today's map, act 2 alone is The Deep
  End; an act past the map's end refused; a clone from its snapshot stays
  in that act.
- **142g — the CLIs** (`none`). *Exit:* the run-config help lists every
  URL parameter, by a test derived from `RUN_CONFIG_PARAMS` with a planted
  omission failing; `--sector-hops` parses; the fuzz CLI takes the
  script and refuses with `--arbitrate` the entries a clone drops.
- **142h — the phase's close** (`stop`). The user plays four URLs: an
  event chain end to end, a chain of encounters and layouts, a stocked
  port, a start at act 2. Wrong looks like a node that ignores its entry,
  or a run that opens in the wrong act or with the wrong sector's pools.

The stretch the cut opens: 142a, then the stop at 142b.

### The cut signed, the forest signed, act 2's title (2026-10-30)

The user: "I also like that cut for 142." ROADMAP §142 holds the steps.

- **The forest:** "we're on the same page completely!😁 Signed!", on the
  read in §141: act 1 is a forest, a new theme with a tree as plain
  scenery, and The Start takes barren. The tree enters in §144, its glyph
  in the beasts' taste stop; the theme, its palette, its tiles and the
  fauna camps' pool in §145. plans/acts.md's theme row says so.
- **Act 2's title:** The Fragments ("I really like the fragments,
  actually! Let's do it!"). Display text only; the id `start` stays.
- **Act 1's title, open.** The Root is taken: it is the user's title for
  act 4 ("Root cause of the plague + root account"), now in
  plans/acts.md. The Sticks reads American to the user. The user's lean
  is *The Periphery*, asking for a pun on it. The session's read: the
  word carries one as it stands, since peripherals are the devices at a
  computer's edge, outside its core, as the wild is the realm's edge;
  the one alternative offered is *The Outer Ring*, x86's ring 3, the
  least-trusted, so that with act 4 The Root and the difficulty ladder
  named Escalation a run reads as a privilege escalation. The title is
  needed by §145.

### 142a — the backslash guard (2026-10-30)

*Step zero, the halving on Claude Code 2.1.309.* Four commands through
the Bash tool, read back with `od -c` and `wc -c`: a single-quoted run of
four reached bash as two, a run of three as two (rounding up), a quoted
heredoc's run of four as two, and a run of four a double quote follows
stayed whole. Each of the four rules 130e measured on 2.1.308 holds, and
the mod's note fired on each halved line with what bash got. The guard's
premise stands.

*Built.* `halving.ts` gives `halvingRefusal`, which refuses where
`changedLines` finds a line bash would read differently, so a run a
double quote follows and a double-quoted pair that reads the same (`"\\."`)
pass, as the cut's exit has it, where the TODO's first wording (any run
of two) would have refused them. The hook refuses in the Bash handler
after the stdin guard; the PowerShell handler is untouched. A fault in
the model, or in reading the version, lets the command run.

*A lean, for the stop:* a command whose first line is `# halving:
measure` runs with the note. With every halved command refused, the
halving could no longer be seen, and a harness fix (the user reported the
halving on 2026-10-23) would leave the guard refusing correct commands
with no way to tell. The refusal doesn't mention the measure line, so it
isn't a reflex way around the guard; the README and
`process/shell-and-windows.md` do.

*Evidence.* `tests/shell-halving.test.ts`, 13 of 13: four shapes refused
(a single-quoted pair, a run of three, a quoted heredoc, a pair in a bare
word), four passed (a run a double quote follows, a double-quoted pair
that reads the same, one backslash, none), the refusal's text, and the
measure line, which counts only as the first line. Two failing controls,
each on a copy: a guard that refuses nothing fails 6 of 13, and one that
refuses any run of two (the TODO's wording) fails the two cases that read
the same. `register.ts` type-checks against the engine's declarations
(2.1.309, the scratch tsconfig the README names), with a planted
`deny: 42` caught. *Not verified:* the refusal live in the harness, since
an edit to the mod loads in a fresh session (the README, "Loading"); the
PowerShell clause rests on reading the handler, which calls only the
hand-off check.

### 142b — the grammar, put to the user (2026-10-30)

*Step zero.* Read at `fe20cac4`:
- Today's four dials are run-wide filters. `layout=` forces every
  fight's board, the boss's included (`Run.buildEncounterMap`,
  `rollBossForSector`). `encounter=` forces every node of the
  encounter's kind. `event=` replaces every event node's pick, after the
  roll that can make the node a fight (`Run.enterEventNode`).
  `firstNode=` stamps the first sector's root. A load passes the saved
  query's config to `fromJSON` (`resolveRunInputs`), and a clone passes
  none.
- The fight roll is on the `'event'` stream at the run-wide `eventStep`,
  which moves whether a page opens or not, and a forced event's pick
  draws nothing. So a named event can skip the fight with no other draw
  moved.
- A port rolls its stock on the `'portStock'` and `'portPrice'` streams,
  both keyed to the node. The shipped slots are 5 units, 5 packets and
  2 daemons (`config/prices.json`).
- Every catalog id is letters, digits and hyphens. In a query,
  `URLSearchParams` reads `+` as a space; `; : , = * . /` survive, and a
  value carrying them round-trips through `set` and `toString`
  (percent-encoded, as `roster=`'s `:` and `,` already are).
- `cadre-1` sets `cadre:read`, which `cadre-2` needs, and `cadre-2` sets
  `cadre:arson`, which `cadre-3` needs: a three-event chain in the
  shipped catalog.

*The draft.* One new parameter, `script=`, a list of entries, and one
for the starting act, `act=`. The old dial names stay and parse into the
same list.

```
script  = entry *(";" entry)
entry   = address ":" item *("," item)
address = hop | act "." hop | "*" | act ".*"
item    = kind | "encounter=" id | "layout=" (id | "procedural")
        | "event=" id | "port=" good *("/" good)
kind    = "battle" | "elite" | "event" | "rest" | "port"
good    = daemon-id | packet-id | archetype [":" level]
```

- **Addresses.** Hops count from 1, the act's first node, to its last,
  the boss. A bare hop is in the act the run starts in, so
  `firstNode=`'s "the first sector's root" stays `1`; `2.5` is act 2's
  fifth hop; `*` is every hop of every act; `2.*` is every hop of act 2.
  A numbered address past its act's end is refused at construction.
- **A numbered hop's entry is a script; a starred one is a filter**, as
  the old dials are.
  - A kind stamps every node on the hop, after the map is drawn, so the
    stamp draws nothing. On an act's last hop it is ignored and warns,
    the boss winning as it wins over `firstNode=` on a one-hop run today.
  - `encounter=` stamps the hop with the encounter's kind and fights it
    there. A boss encounter goes only on an act's last hop, and there it
    is the act's boss.
  - `event=` stamps the hop `event` and opens that event, with no fight
    (the roll is drawn and set aside), past its eligibility as `event=`
    is today.
  - `port=` stamps the hop `port` and stocks it with exactly the goods
    named.
  - `layout=` stamps nothing: it is the board of whatever fight the hop
    holds.
  - A starred entry stamps nothing and applies where the kind fits, so
    `*:encounter=X` is today's `encounter=X`; a kind needs a numbered hop.
  - A numbered entry beats a starred one for the same item. Two entries
    on one hop merge, and a conflict (`3:rest,encounter=brigands`, or
    one item twice) is refused.
- **A port's goods.** Each id resolves as a daemon, a packet or an
  archetype, in that order, as `grants` does. A unit with no `:level`
  takes the port's base level (the team's average, with no bonus roll).
  Prices are the price book's, with no jitter. More goods of a kind than
  the shipped slots are refused, and an owned daemon is left out at
  docking, as a rolled stock leaves it out.
- **`act=N`** opens the run at the walk's Nth act, at the sector index a
  full walk has there. With `hops=` that act is played alone; without,
  the run walks on to the map's end.
- **Dropped and warned.** The parse drops what it can check (an unknown
  id, an act past the shipped map's end) and names each drop in a
  warning, as `layout=` drops an unknown id, but out loud. An entry that
  never applies warns when that is known: at its act's entry, where the
  map has no node it fits (the R13 warning), or at its hop, where the
  route held no fight for a `layout=`. Warnings go to the browser's
  console and the CLIs' output.
- **Writing back.** `runConfigToQueryString` writes an old dial's case in
  its old form and the rest as `script=`, so every save and journal
  reads back byte-identical.

*The old dials as cases.*

| Today | As a script |
|---|---|
| `layout=river` | `script=*:layout=river` |
| `encounter=artillery` | `script=*:encounter=artillery` |
| `event=mines` | `script=*:event=mines` (the fight roll stands) |
| `firstNode=elite` (or `event`, `rest`) | `script=1:elite` |
| `firstNode=event&event=mines` | `script=1:event;*:event=mines` |

*The worked URLs* (today's map; act 2 is The Deep End until §145):
- An event chain end to end:
  `?seed=7&script=3:event=cadre-1;6:event=cadre-2;9:event=cadre-3`.
- A chain of encounters and layouts:
  `?seed=7&script=2:encounter=brigands,layout=river;4:encounter=brigand-champions,layout=labyrinth;7:encounter=deserters,layout=procedural;11:encounter=bandit-king,layout=isthmus`.
  Hop 4 becomes an elite hop, since `brigand-champions` is an elite.
- A stocked port:
  `?seed=7&script=2:port=rogue:3/healer/overclock/venom/mars`.
- A start at act 2: `?seed=7&act=2`, which walks on to the run's end;
  `?seed=7&act=2&hops=11` plays act 2 alone, and
  `?act=2&script=1:elite,encounter=plagueSpreaders` puts an elite on act
  2's root.

*`--arbitrate`* refuses every entry but `act=` and the kinds stamped in
the act the run starts in. That act's map is drawn at construction and
rides the snapshot, so a clone keeps its stamps, as it keeps
`--first-node`'s today. Every other entry is applied at a node or at a
later act's entry, which a clone, loading with no config, does without
the script. So `--first-node` stays legal, and `--encounter` and
`--layout` stay refused.

*Leans, the user's to change:* the separators; a bare hop in the
starting act; a named event that always opens, past its eligibility,
where respecting eligibility would show a chain only as far as the picks
take it; a port's unit at the port's base level rather than `roster=`'s
level 1; the warnings in the console, since a line on screen would be UI
work beyond the cut.

### 142b signed, and act 1's title (2026-10-30)

The user: "Signing everything, Claude! 😁 The grammar looks great!", over
the draft above with its leans as drafted, and 142a's measure line.
Act 1's title is The Periphery ("I agree that periphery is still
better"); The Outer Ring is kept in plans/acts.md for an alternate act
("let's keep that idea in mind for when we add alternate acts!").

### 142c — the list, with the old dials as cases (2026-10-30)

*Step zero.* The old dials' tests assert the fields themselves
(`parseRunConfig('layout=river').forcedLayoutId`, and `new Run(..., {
forcedEncounterId })` in `Run.test.ts`), so the four fields stay on
`RunConfig` as the code's names for their cases. The list is what the
Run reads: `src/run/RunScript.ts`'s entries, the four fields folded in
by `dialEntries`, with every forced item read through `scriptItem` and
the root's kind through `scriptKind`. `RunConfig.script` and the
`script=` URL form come with the per-hop entries in 142d, where the parse
changes, so the URL parse is untouched here. A deviation in order from
the cut's wording ("RunConfig holds the list"), not in intent.

*Built.* `Run.forcedLayoutId`, `forcedEncounterId` and `forcedEventId`
are gone for `Run.script`; `scriptAt(item, hop)` reads an item at a hop
of the active act (the count of sectors entered, from 1), and
`stampRoot` kinds each act's root at both sector entries, the first-node
dial's stamp included, so the generator takes the config without
`firstNodeKind` (`withoutFirstNode`). The checks of the three ids throw
the messages they threw. One test names the Run's private inputs
(`resume-gates.test.ts`, 115a) and takes `script` for the three names.

*Evidence.* The suite green (`src/run`, `tests/integration`: 932, before
the hook's full run). The corpus: 0 of 32 differ. Its control, the
first-node entry planted at hop 2: 2 of 32 differ, `player-5` (hops 2,
`firstNode=event`) and `player-6` (hops 2, `firstNode=rest`), as
predicted before the run, and `player-8` (hops 1, `firstNode=elite`)
not, since its one hop is the boss and the boss wins either way.
`RunScript.test.ts`, 5 of 5: the dials as entries, and the most specific
entry winning in either order. The corpus carries no `encounter=` or
`event=` journal; those two cases rest on their unchanged tests in
`Run.test.ts`.

### 142d — the per-hop entries (2026-10-30)

*Step zero.* `GameEvents` takes any key (an index signature), and the
sound table's coverage pin (`eventSounds.test.ts`) holds every declared
event to a cue or a silent reason, so a new event costs a line in each.
The parse went into `RunConfig.ts` beside its id checks, since
`RunScript.ts` importing `FORCE_PROCEDURAL` from it would be a cycle.

*Built.* `RunConfig.script` and `script=`, parsed by `parseScript` and
written back by `scriptToString`, with the old dials writing back their
own names. A numbered hop's kind, named or implied by its encounter or
event, is stamped on every node of the hop at its act's entry
(`stampScript`, `NodeMap.stampHopKind`); on the boss's hop it is ignored
and warns. A numbered hop's event always opens, its fight roll drawn and
set aside. Construction refuses a contradiction, a numbered hop past
every length its act can have (`sectorsAtAct`), a boss encounter away
from its act's last hop, and an unknown id (with the dials' messages).
The warnings: the parse's drops, an entry for an act the run doesn't
play, a starred encounter or event the act's map has no node for (R13),
and a numbered layout on a hop the route crossed at a rest or a port.
They are `Run.scriptWarnings`, and each one raised after construction is
also a `script:warning` event, which `Game` prints to the console.

*Not done:* a numbered layout on a hop crossed at an event node doesn't
warn, since the event can still start a fight there.

*Evidence.* `RunScript.test.ts` and `scriptedRun.test.ts`, 36 of 36:
- the list, the parse (the worked URLs, every drop named), its inverse,
  and every old URL form round-tripping with no `script=` written back;
- in a live run, each entry against a control on the same seed without
  it: a kind, an encounter, a layout, an event that opens where the
  starred one fights, the refusals and the warnings.

`RunConfig.test.ts` is unchanged and green. Four planted failures, each
applied to the live file and restored byte for byte:
- `stampHopKind` stamping nothing fails 5 of 13;
- a scripted event still fighting fails the event test;
- `scriptAt` reading one hop short fails 3;
- the past-the-end refusal disabled fails its test.

The corpus: 0 of 32 differ. *Not verified in a browser* until 142h's
URLs.

*A slip on the way:* a regex written through a Bash heredoc reached the
file halved, the case 142a's guard refuses once it loads; the edit went
through the Edit tool instead, and nothing ran on the halved text.

The hook's full suite found three censuses of the URL dials, each built
to fail until a new dial is named in it: the menu's boot rule
(`menuRules.test.ts`), the win record's refusals (`progress.test.ts`,
where `runCounts` already refuses any dial but the character and the
level, so a scripted win is not recorded), and the board panel's
restated keys (`boardPanel/fixtures.ts`). Each takes `script`.

### 142e — a port's stock (2026-10-30)

*Built.* `port=` takes goods `/` apart, each id resolved as a daemon, a
packet or an archetype (as `grants` resolves), a unit's `:level` clamped
as `roster=`'s is. Up to the shipped slots of each kind (5, 5, 2); a
good past them, a level on a daemon or a packet, and an unknown id are
dropped and named by the parse, and thrown at construction for a
code-built script. A numbered `port=` stamps its hop `port`. At docking,
`Run.stockPort` replaces the roll: exactly the goods, at the price
book's prices with no jitter, a unit with no level at the port's base
level (the team's average, no bonus roll). Only the units draw, their
level-ups on the port's own `'portStock'` stream. An owned daemon is
left out with a warning, and a starred stock with no port on the act's
map warns.

*Evidence.* The corpus: 0 of 32 differ. The scripted-run tests, 17 of 17,
and the list's, 24 of 24:
- the exact stock and prices, against the same port unstocked;
- a later unstocked port's roll equal with and without the stock before
  it;
- the owned daemon left out, the slot and id refusals, and the parse and
  its inverse with goods.

Planted failures, each on the live file and restored:
- the stock ignored fails the two tests that read it;
- a unit priced one bit off fails the price test;
- an owned daemon kept fails its test;
- a stocked port handing the run its daemon fails "leaves another port's
  roll".

A first try at that last control, the stocked rogue joining the team,
passed. One level-3 unit doesn't move the team's rounded average, which
is all the later roll reads of the team, so that leak was invisible to
the test, not caught by it.
