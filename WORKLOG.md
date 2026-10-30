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
