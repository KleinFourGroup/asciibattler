# WORKLOG — Round 9 (The frame and the damage trial)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. From this round the file
holds the phase in progress: at each phase close it moves to
`archive/worklog-phase-N.md` and a fresh one starts. Created 2026-10-26 at
the Round 8.5 close. Prior round's log:
[archive/post-118-worklog.md](archive/post-118-worklog.md) (Round 8.5,
Housekeeping: the kickoff → §119 the oracle map → §120 the census → §121
the dials → §122 sim → §123 run → §124 and §124.5 render and UI → §125 the
bot and the fuzz instruments → §126 tests → §127 tools → §128 the build →
§129 the dependency phase → §130 the instruments and the docs → §131 the
reads → §132 the process review → §133 the re-cut and the close), with
its plan [archive/post-118-roadmap.md](archive/post-118-roadmap.md), spec
[archive/round-8.5-spec.md](archive/round-8.5-spec.md) and census
[archive/round-8.5-census.md](archive/round-8.5-census.md) beside it.

**Read first:** `archive/post-118-worklog.md` §133. 133b's table and 133c's
additions hold the premise of every item of Rounds 9 to 23 against the
code, by the row ids META-ROADMAP's charters cite; the tranches hold each
round's signed shape; "133f" holds the round's exit check and what the
close left for the user's read.

## Kickoff — Round 9 (The frame and the damage trial)

### The spec drafted, tranche 1 put to the user (2026-10-27)

The user opened the kickoff: "It's time to kick off phase 9 of our game!
We've gotta write the detailed spec, right?"

[round-9-spec.md](round-9-spec.md) is drafted from the record, unsigned:
the user's words on the acts, the trial, who plays and releases, from
§133; what was signed before the kickoff; the code under the act
questions; and the Open section in three tranches. The code was read at
`8e4ef58b` for the act questions only (the sector map's schema and
shipped graph, the sectors' lengths and themes, the boss and plague
encounters' text, the win at `run:victory`, `progress`'s one field); the
trial's and the instruments' premises are tranche 3's, before the cut.

Tranche 1, the act design's eight questions with the session's leans, is
put to the user as the spec's Open lists them. Nothing else in Round 9
rests on the act design, so its answers can come at any point in the
round; Round 10 needs them first (act 1's hops and boss, the themes).
Tranche 2 is what keeping the trial would look like; tranche 3 the
premises at HEAD and the first phase's cut.

### Tranche 1 answered; the act design in plans/acts.md (2026-10-27)

The user answered in two turns; the words are the spec's "The act design,
answered". Between them the session read two premises: a wave's level
budget is a factor of the roster's mean or median level
(`src/config/encounters.ts`, `LevelBudgetSchema`; the bosses' `mean`
factors), so a longer run does not outrun the enemies, and the level cap
is 20 (`config/leveling.json`); barren's camp pool is grassland's, and its
ground swaps mud for sand with a few more hills (`config/terrain.json`).

**The change to the re-cut's shape.** The session put two readings of the
Queen's move (the finished design only, or from Round 10, the three
sectors as acts 1 to 3 at once) with the second as its lean; the user
agreed. So from Round 10 The Start is act 2 and The Deep End act 3, with
the Bandit King moved to act 1, the Generalissimo and the Witch Hunt to
The Start, and the Queen to The Deep End; Rounds 21 and 22 each rework
one shipped sector where Round 21 merged two. META-ROADMAP's Rounds 10,
21, 22 and 23 are re-pointed: Round 10's charter, its act-1 and run-shape
bullets, risk and decision points; Round 21's charter, its sector bullet
and decision point; Round 22's sector and wizard bullets; Round 23's win,
its unlock decision point and its save line. A search of the tracked
docs for "act 2's place", "shipped two" and "two shipped", outside the
archive, finds one line, Round 10's new charter (code comments that say
"shipped two-sector" describe today's map and stand).

**Unanswered leans, kept as leans in the plan:** acts 2 to 4's themes
(barren, swamp, volcanic), The Start to barren in Round 10, and act 4's
condition findable only after a first win.

**For tranche 2,** `scratch/134/spread.mjs`: the proposal's `U^k` is the
Kumaraswamy distribution with `b` 1, so a spread dial needs no second
draw a strike, which 133c had assumed a two-parameter family would. Its
controls passed (the uniform at `p` 0.5 and `b` 1, variance 0.0833; the
closed-form mean within 0.0004 of the sampled one at six settings; 0.194
at the proposal's setting, 133c's figure). The table is the spec's.
`Math.pow` with a fractional exponent is already in the sim's path
(`src/sim/xp.ts:17`), so the draw adds no new kind of float operation.

### Tranche 2 answered in part; the follow-ups on defense and true misses (2026-10-27)

The user's answers and two follow-ups are in the spec's "The trial",
with `scratch/134/defense.mjs`'s numbers. Read for them at HEAD:
`World.dealDamage` deals `max(STATS.minDamage, rawDamage − defense)`, both
integers (`src/sim/World.ts:702-711`; `minDamage` 1 in
`config/stats.json`); `applyDamage` takes the crit, drawn by the op before
it, then the hit roll, so `combatRng`'s order per strike is crit, then
hit, and a miss discards the crit (`:766-768`, `:803-804`); a miss fires
`dealMiss` and `evade`, and no config entry hooks either (a search of
`config/`); raw damage is the op's `might` plus its scaling stat
(`src/sim/effects/resolveScalars.ts:41`); base defense runs 0 to 6 across
the archetypes.

**A correction to 133c:** three shipped rules hook a hit, not two. 133c
counted the daemons' (Laverna, bits on a rogue's hit; Fortuna,
`emboldened` on a crit), and the Venom packet injects one more for an
encounter, poison on every hit (`config/packets.json`).

**Put to the user:** the mixture as a third arm, since at `s` 0.5 it
matches `b` 0.25 on spread and visibility and differs in shape alone; the
session's lean is three arms, with the board run on the arm the user's
play picks, before the keep. Signed ("Let's add it! 😁"); the spec has it.

### Tranche 3: the charter's premises at HEAD (2026-10-27)

The user asked whether the ROADMAP comes before the first phase's plan;
it does (`process/planning.md` "The artifacts" and "Phase kickoff"): the
round's phases with their durable parts are signed first, then the first
phase's cut. Each Round 9 item re-read at `26d5bcea` against 133b's row:

- *C13 holds:* no coverage test for `tests/fuzz/board/roster-table.json`,
  whose readers are `tests/fuzz/roster/cli.ts` and `rosterTable.ts` (a
  search of `src`, `tests` and `tools`); the twin to copy,
  `tests/prior-table-coverage.test.ts`, is there.
- *C14:* the table is still the v3 of 94h (its `provenance`, build head
  `4d3fa22`), 4,616,750 bytes, as 133b read; its rows were not re-counted.
- *C15 holds:* one `--artifact` for the cohort (`scripts/box-drive.sh:23-29`,
  `:50`).
- *R17 holds:* `DESIGN.md:69`, `ARCHITECTURE.md:165`, and gotchas #19, #93,
  #95, #97 and #109 still name `AttackAction` or `GambitStrikeAction`;
  `src/sim/actions/` holds the move, spawn, swap and wait actions. DESIGN's
  line 69 is also the Combat paragraph the trial rewrites, since it
  describes the to-hit roll.
- *R18 holds:* `assertFxKeysResolve` and `assertStatusFxKeysResolve` check
  resolution only (`src/render/fxRegistry.ts:291`, `:309`); 4 of 24
  abilities ship no `fx` (heal_ally, dash, chain_lightning, inspire).
- *R22 holds:* the stars' route follows `defaultClickable`
  (`src/ui/UnitCard.ts:173`, `:196`); the pre-turn card
  (`PreTurnScreen.ts:972`) and the card list (`CardListModal.ts:102`) are
  built without `clickable`.
- *The trial:* an evadable strike draws once, after the op's crit draw
  (`World.ts:803-804`); `unit:missed` is heard by the battle renderer's
  splat (`BattleRenderer.ts:249`, `:1136`) and the sound map
  (`src/audio/eventSounds.ts:120`), and the journal corpus lists it; the UI
  shows a hit chance twice, the ability detail's "% hit"
  (`src/ui/abilityDetail.ts:108`) and the promotion delta's dodge share
  from evasion (`src/ui/promotionDelta.ts:74-75`).
- *The bot reads no hit chance:* a search of `src/bot`, the `.ts` files
  under `tests/fuzz` and `tools` for `hitChance`, `evasion`, `precision`
  and `accuracy` finds only the editors' authoring fields
  (`tools/archetype-editor`, `tools/attack-editor`, `tools/layout-editor`),
  so the charter's "the bot's sensors that read a hit chance" names
  nothing at HEAD.

The phases, drafted from these, are put to the user in the turn's message;
the ROADMAP takes them once signed.

### The spec and the phases signed (2026-10-27)

The user: "Fully signed, Claude! 😁", covering the six phases as put and
the spec signed with the plague's cause open. ROADMAP holds §134 ticked
and §135 to §139; the spec's status line says SIGNED.

## Phase 135 — the board's instruments, and the stars' tap

### The kickoff's audit, and the cut put to the user (2026-10-27)

The premises are tranche 3's above; two more were read for the cut.

- *The roster table's size is its formatting.* Stored, it is 4,616,747
  bytes on 288,689 lines, written by `JSON.stringify(table, null, 2)`
  (`tests/fuzz/roster/cli.ts:93`); the same data minified is 1,667,215
  bytes, 36 % (a parse and re-stringify, this turn). The rows are already
  deduplicated with a count (133b), so the TODO row's per-bucket
  distributions would save little more than the formatting does, and
  would change what a sampled draw draws: a whole roster.
- *The table keys a sector by its position, not its id:* a bucket is
  `character|sector|hop` with the sector an index (`gambler|0|1`;
  `rosterTable.ts:71`, `:76`). Round 10 puts act 1 at index 0, so the
  buckets measured in The Start would be read for act 1 with nothing to
  say so. An unknown bucket throws (`rosterTable.ts:23`); a bucket that
  changed meaning does not.

**The cut** (each step's smoke, save and stream predictions in its line;
no step bumps a snapshot or adds a stream):

- **135a — the roster table written a row a line, with the sector ids it
  was built over** (C14; `none`). The builder writes one row per line; the
  table is re-serialized from its own parse, not rebuilt (the 94h CSVs are
  box output; step zero checks for them), and its provenance gains the
  sector ids of 94h's run, `the-start` and `the-deep-end`. Exit: the
  parsed table equal to today's but for that field, by `npm run oracle`'s
  parsed diff with a planted changed row failing it; the file about 38 %
  of today's bytes (predicted). The per-bucket distributions are not
  built. Smoke fires (`tests/fuzz/`).
- **135b — the roster table's coverage guard** (C13; `none`). Beside its
  twin, `tests/prior-table-coverage.test.ts`, with the twin's PENDING
  acknowledgments, so a new archetype or sector is acknowledged rather
  than blocking the hook until a box rebuilds the table: every draftable
  archetype has a row or a PENDING line; every archetype in the table
  exists; every bucket names a shipped character and a hop inside its
  sector's length; the provenance's sector ids are the shipped walk's.
  Planted failures: a missing archetype, a stale one, a changed sector
  list, each failing it. BALANCE's registry row says v3 and names the
  guard. Smoke does not fire.
- **135c — `box-drive.sh` takes mixed queues** (C15; `none`). Step zero
  reads which artifact each kind of batch writes (`summary.csv`, and
  `best-strategy.json` for `--search`). Each line's artifact is taken from
  its own arguments, `--artifact` stays as an override, and a `--plan`
  flag prints each batch with the artifact its fetch will check and exits
  before a box is made. Oracle: `--plan` on a planted mixed queue names
  both artifacts, and with `--artifact=summary.csv` names one for both;
  the outputs in this file. No box is launched. Smoke does not fire.
- **135d — `FX_REGISTRY`'s coverage guard** (R18; `none`). In
  `fxRegistry.test.ts`: every ability carries `fx` or is on an explicit
  list (heal_ally, dash, chain_lightning, inspire), and every list entry
  still lacks one; every `*_tick` key carries a `sound` or is on an
  explicit visual-only list, empty today. Planted failures: an ability
  without `fx` off the list, and a tick key without a sound. Smoke does
  not fire.
- **135e — the deleted action classes out of the docs** (R17; `none`).
  DESIGN's Combat paragraph (line 69), ARCHITECTURE's line 165, and
  gotchas #19, #93, #95, #97 and #109, each rewritten against
  `EffectAction` and the interpreter after reading them, or made a
  tombstone; #109's retreat timing read against `effects/reposition.ts`
  first. Before §136, which rewrites the Combat paragraph's to-hit roll.
  Smoke does not fire.
- **135f — the rarity stars take the long-press inside a control** (R22;
  `batch`). `clickable: true` on the pre-turn card and `clickable:
  picking` in the card list, with a headless pin that the stars take the
  long-press route in both. Read script: on a touch screen, tap a card's
  rarity stars in the pre-turn hand and in a port's crew picker; the
  tier's tooltip opens and the card is not picked; wrong looks like the
  card toggling. Reachable at any battle's pre-turn screen, and at a port
  on a seed named at the build. Smoke does not fire.
- **135g — the phase's close** (`stop`): the report, 135f's read, the
  phase closed by `process/planning.md` "Phase close".

The stretch the cut opens: 135a to 135f are built without a stop, and the
session stops at 135g.

**Signed** (the user, 2026-10-27: "That looks great, Claude! 😁 Fully
signed!"): the cut and its reads as put.

### 135a — the roster table a row a line, with its sector ids (2026-10-27)

- *Step zero:* the 94h sources are box output and not rebuilt from; the
  sector map has no commit since the table's measurement head (`git log
  4d3fa22..HEAD -- config/sector-map.json`, empty), so the ids the 94h
  run walked are the shipped map's.
- *The proof:* `npm run oracle -- json-diff` of the table before and after
  finds one difference, `added provenance.sectors` (`["the-start",
  "the-deep-end"]`); the control, the after-table with one row's `n`
  raised by one, finds two, the added field and `changed
  rows.gambler|0|1[].n`. The file is 1,773,061 bytes on 15,138 lines,
  against 4,616,750 on 288,689: 38.4 %, the 38 % predicted.
- The builder writes the format (`serializeRosterTable`), with a test
  that it parses back to the table and holds one line a composition; the
  sector ids come from `sectorPositions`, which throws on a map where a
  position names more than one sector (tested on three such maps).
  `scratch/135a/` holds the one-off rewrite, the before-table and the
  planted copy.
- *Checks:* the roster tests 17 passed under the fuzz config (14 before);
  `npm run typecheck` clean.

### 135b — the roster table's coverage guard (2026-10-27)

- `tests/roster-table-coverage.test.ts`, the prior tripwire's twin, with
  its PENDING acknowledgments (empty today): every draftable archetype in
  a recorded roster; no archetype the catalog dropped; every bucket a
  shipped character, a sector position the map walks and a hop under that
  sector's length; the provenance's sector ids equal to the map's walk.
  Its expectations are read from `config/sector-map.json` and
  `config/sectors.json` directly, not through the builder's
  `sectorPositions`.
- *The planted failures are permanent:* the checks are one function, run
  on the committed table and on six planted tables (a missing archetype
  and its acknowledgment, a dropped one, three bad buckets, a new first
  sector with and without its acknowledgment, a table with no sector ids,
  three unneeded acknowledgments). One planted case first failed on the
  test's own helper, whose default parameter turned "no sector ids" back
  into the default list; fixed with a `null` sentinel. A control on the
  real file: the committed table with `the-deep-end` renamed in its
  provenance fails the sector test alone; restored, `git diff` empty.
- *Built and flagged, inside the cut's intent:* `makeRosterSampler` also
  refuses, at launch, a table whose sector ids differ from the map's walk,
  so a `--roster=sampled` read cannot take one sector's rows for another
  even while the guard carries an acknowledgment; tested with a map that
  adds a first sector.
- *Landing note* (TODO, Round 10, "The board"): act 1 takes position 0, so
  from the commit that adds it the guard fails and the sampler refuses
  until a board cohort rebuilds the table; the guard takes a `sectors`
  PENDING line meanwhile. BALANCE's registry row and TESTING's gate list
  name the guard.
- *Checks:* the guard 12 passed; the roster tests 18 passed under the fuzz
  config; `npm run typecheck` clean.
- *A prediction missed:* the cut said 135b's commit would not fire the
  fuzz smoke; the launch check put `tests/fuzz/roster/` in it, so it did
  (553 passed).

### 135c — `box-drive.sh` takes mixed queues (2026-10-27)

- *Step zero:* a `--search` batch writes `best-strategy.json` and
  `search-results.csv` and no `summary.csv` (`tests/fuzz/commands/search.ts:316`,
  `:322`; the CLI returns after the search, `tests/fuzz/cli.ts:196-198`);
  a run batch writes `summary.csv` (`tests/fuzz/commands/run.ts:444`,
  `parallel.ts:177`).
- Each batch's fetch now checks its own artifact (`artifact_for`: a line
  holding `--search` checks `best-strategy.json`, every other line
  `summary.csv`); `--artifact=<file>` names one file for every batch, as
  before; `--plan` prints each batch with its artifact and exits before
  the pre-flight and the box.
- *The oracle* (`scratch/135c/mixed.queue`, a shadow batch, a search with
  a trailing comment, and a priest batch): `--plan` names `summary.csv`,
  `best-strategy.json`, `summary.csv`; with `--artifact=summary.csv` it
  names `summary.csv` three times; the inline form `--plan -- --search
  --count=10` names `best-strategy.json`. No box was launched.
- *A slip caught by `bash -n`:* the cohort line first read
  `${ARTIFACT:-each batch's own}`, and the apostrophe opened a quote
  inside the expansion, so the script failed to parse below that line;
  `--plan` worked only because it exits before bash reaches it. The
  committed script at HEAD parses (`bash -n`, exit 0), and so does the
  fixed one. No test runs `bash -n` over `scripts/`; listed for the
  close, not built, since it happened once.
- BALANCE's fresh-derive recipe says the fetch checks the search line's
  own artifact.

### 135d — `FX_REGISTRY`'s coverage guard (2026-10-27)

- In `src/render/fxRegistry.test.ts`, "coverage": every ability authors an
  `fx` block or is on `ABILITIES_WITHOUT_FX` with its reason, and every
  periodic status names a `ticked` key whose descriptor has a `sound`, or
  that key is on `SILENT_TICKS`; a list entry the catalog no longer needs
  fails. The four listed, with the reasons read in the code: heal_ally
  (drawn and heard off `unit:healed`, `BattleRenderer.ts:279`,
  `eventSounds.ts:74`), dash (the move's slide and `unit:dashed`'s
  whoosh, `eventSounds.ts:77`; its VFX a Round 12 TODO row),
  chain_lightning (its arcs off the chain event as `chain_arc`), inspire
  (the aura renderer). The moment a status ticks on is `ticked`
  (`config/statuses.json`), not `tick`; the four periodic statuses' keys
  all carry a sound, so `SILENT_TICKS` is empty.
- Slightly wider than the cut's line, inside its intent: a periodic status
  with no `ticked` key at all counts as a silent tick, since it would show
  and sound nothing either.
- *Planted failures:* one synthetic catalog holds each gap (an unlisted
  ability, a stale list entry, a tick whose key has no sound, a periodic
  status with no key, a stale silent entry), and a second call shows the
  lists clear what they name. A control on the real catalog: the sword's
  `fx` removed from `config/abilities.json` fails the coverage test
  (`unlisted: ["sword"]`) and the melee-key test beside it; restored, `git
  diff` empty.
- *Checks:* the fx tests 32 passed; `npm run typecheck` clean after one
  fix (the status parameter's `fx` needed `| undefined` under
  `exactOptionalPropertyTypes`).

### 135e — the deleted action classes out of the docs (2026-10-27)

Each passage was rewritten against the code read for it; none became a
tombstone, since each one's rule still holds under the effect
interpreter.

- *DESIGN's Combat paragraph:* an ability's `EffectAction` fires its ops;
  a damage op rolls the crit from the chance taken at cast
  (`resolveDamageScalars`, `effects/resolveScalars.ts:41-42`) as it fires
  (`effects/interpreter.ts`, `executeDamage`), then calls
  `World.applyDamage`, whose to-hit roll uses the op's accuracy, the
  attacker's precision and the target's evasion. §136 rewrites the same
  paragraph's to-hit roll.
- *ARCHITECTURE's `stats.ts` line:* the crit is rolled as a damage op
  fires.
- *#19:* the two phases hold (`World.fromJSON`: bare units, then
  `createAction` per active action); no `fromData` reads the world today
  (`EffectAction.fromData` takes `_world` unused; the registry's move,
  spawn and swap builders take none), so the gotcha now says the order is
  for the action that will.
- *#93* was staler than its row said: `UnitDerived` is `maxHp`,
  `moveCooldownTicks` and `attackRange` (`deriveStats`), cadence and the
  crit chance are per ability (`attackCooldownTicksFor`, `critChanceFor`),
  and the stat block has eleven fields (`src/sim/Unit.ts:66`), not seven
  with an `endurance`. Its "two reads to fix on the day stats mutate" are
  replaced by `effectiveStats` (K1), which that day brought.
- *#95:* combatRng's consumers named as the damage op's crit roll and
  `applyDamage`'s to-hit roll; the fork is still `rng.fork()` at
  construction (`World.ts:434`).
- *#97:* the stored data is `EffectActionData.ops`' cast-time scalars;
  `unit:attacked` is emitted in `src` by `World.applyDamage` alone, with
  two test fixtures (`EventBus.test.ts:124`, `tests/pathing/metrics.test.ts:220`).
- *#109:* the rule holds in the `move` op's `retreat` mode
  (`interpreter.ts`, `durationTicks = max(1, min(moveTicks,
  ctx.remainingTicks))`), with `remainingTicks` from
  `EffectAction.fireOpsAt`. Its pin did not: the gotcha named
  `GambitStrikeAction.test`'s case, deleted with the class, and no test
  asserted the slide's length (a search of the effects and sim tests for
  `durationTicks`). **Built and flagged:** a pin in `interpreter.test.ts`
  (4 busy ticks left slide 4; more than the move's cooldown slide the
  cooldown; 0 slides 1). Its control: the interpreter planted with the
  naive `max(1, moveTicks)` fails it; restored, `git diff` empty.
- The remaining mentions of the old classes in the live docs are history,
  ARCHITECTURE's `actions/` line and #8 (a search of the tracked docs
  outside the archive).
- *Checks:* the interpreter tests 35 passed.
- *A prediction missed:* the cut said 135e would not fire the fuzz smoke;
  the restored pin is a `src/sim/` test, so it did (553 passed).

### 135f — the rarity stars take the long-press inside a control (2026-10-27)

- *Step zero:* the hand's cards are controls only while a packet is armed
  or a grant is active (`PreTurnScreen.ts:702`, `selectable`), and the card
  list's only while it picks (`picking`), so the fix passes those, not
  `true`: `renderHandCard` takes `selectable` and builds with `clickable:
  selectable`, and the card list builds with `clickable: picking`. Both
  sites drop the class they added after the build, since `buildUnitCard`
  adds it for a clickable card (`UnitCard.ts:196-199`).
- *The oracle changed, and is flagged:* the cut named a headless pin, but
  no test can build a DOM (Vitest runs with `environment: 'node'`,
  `vite.config.ts:187`; no DOM library is installed, a search of
  `node_modules`; no test file sets another environment, a search for
  `vitest-environment`). Adding one is a dependency, outside the cut. The
  proof is the Browser pane's read of the star run's `data-tooltip-touch`
  (`tooltip.ts:209`), which the route sets, in four states on the dev build
  `0.1.1+0f5f3dc-dirty-dev`, seed 6, the soldier:
  - the first pre-turn screen, the empower grant active: 6 cards, all
    clickable, stars `press`;
  - the grant passed (`passGrant`): 0 clickable, stars `tap`, the control;
  - a Hype packet put in the cache and its chip clicked, armed: 6
    clickable, stars `press`;
  - the port's removal picker (the stock rolled, `port:entered` emitted,
    "Choose" clicked): 10 cards clickable, stars `press`; the same modal
    opened without a selection: 0 clickable, stars `tap`, the control.
  The console's errors were the pane's resource cache
  (`ERR_CACHE_READ_FAILURE`, `ERR_CACHE_OPERATION_NOT_SUPPORTED`), none
  from a script. What a tap does on a touch screen is the user's read.
- *The read* (`batch`, at 135g): on a touch screen, `?seed=6&character=soldier`;
  on the first pre-turn screen, while the soldier's empower grant is up,
  tap a card's rarity stars: the tier's tooltip opens and the card is not
  picked. Then at the port at hop 3, "Strike a unit", Choose, and tap the
  stars in the picker: the same. Wrong looks like the card toggling or
  the tooltip never opening.
- `npm run typecheck` clean.

### 135g — the phase's close, put to the user (2026-10-27)

- *Built:* 135a to 135f, each committed with the hook green; the suite
  3,757 in 260 files and the fuzz smoke 553 in 58, by hand at `63aaf3a4`.
- *Put to the user:* 135f's touch read; four calls built inside the cut's
  intent and flagged (135b's launch refusal in `makeRosterSampler`, 135d's
  count of a periodic status with no tick key as silent, 135e's restored
  pin for #109, 135f's proof in the pane in place of a headless pin); two
  missed predictions (the fuzz smoke fired at 135b and 135e, each by a
  test path the step added).
- *Friction in the phase:* two papercuts, both this session's (the hung
  probe at 134, the apostrophe at 135c), no distress line. No pattern
  recurs across them. The apostrophe's candidate guard, a `bash -n` test
  over `scripts/`, is listed and not proposed as a rule, since the slip
  happened once.
- *After the read:* the phase close by `process/planning.md` "Phase
  close": the cut lines ticked and the section demoted, this file to
  `archive/worklog-phase-135.md` with a fresh one, the sessions summary,
  HANDOFF, and the push.
