# WORKLOG — Round 12 (Push, pull and blink)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 12's phases before this one are in
[archive/worklog-phase-158.md](archive/worklog-phase-158.md) (the kickoff,
§157, and the pre-step and the design, §158),
[archive/worklog-phase-159.md](archive/worklog-phase-159.md) (forced
movement, the seam),
[archive/worklog-phase-160.md](archive/worklog-phase-160.md) (the pushers
and the bursts),
[archive/worklog-phase-160.5.md](archive/worklog-phase-160.5.md) (the
fall),
[archive/worklog-phase-161.md](archive/worklog-phase-161.md) (the blink
and the charge),
[archive/worklog-phase-161.5.md](archive/worklog-phase-161.5.md) (the hex
and the ice storm as specials) and
[archive/worklog-phase-162.md](archive/worklog-phase-162.md) (the closing
board); Round 11's are
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) to
[archive/worklog-phase-156.md](archive/worklog-phase-156.md).

## Phase 163 — the close

The kickoff's inputs, by pointer: what §162 hands on
(`archive/worklog-phase-162.md`, "§162's close"); ROADMAP §163; TODO's
Round 12 rows; META-ROADMAP's Round 13 charter; `process/planning.md`
"Phase kickoff", then "Round close".

### The kickoff's audit, and the cut put to the user (2026-11-27)

Read at `69a40c72`:

- *What the close holds.* ROADMAP §163's five items (`0.5.0` and its
  upload, the exit by clause, Round 13's charter against the code, the
  process read, the archive), and the round close by `planning.md`: the
  archive, the scratchpad sweep, META-ROADMAP's status, the Cursor, the
  upload, the keep test over the round's rule lines (the user signs the
  list), a playtest proposed. The exit to read (META-ROADMAP §"Round
  12"): each seam with a headless test and its planted failure, the
  consumers in play, the board; the release (seven units and abilities),
  the save (a World bump), the two decision points (the design stop;
  which new units are draftable), the scope guard (no 2×2 body is pushed
  until round 19); and the spec's "Signed before the kickoff" (each round
  ends in an upload; each seam ships with a headless test, its planted
  failure and a consumer in play; the board as paired same-seed deltas
  against §155's). ROUND-RULES holds no rule. No trial is read at this
  close: TODO's Round 12 section has no "At the round's close" row.
- *The upload.* `package.json` reads `0.4.0`, the uploaded build
  (`4fc62cfe`, tag `v0.4.0`), 113 commits behind HEAD, 71 files changed
  under `src` and `config`. Since it: the push and the pull, the held
  slide and the fall; four new units (the grenadier, the telekinetic, the
  ninja, the cavalier; 39 → 43 in `config/units.json`) and 13 new
  abilities (`snag`, `grenade`, `sabre`, `charge`, `repulse`,
  `whirlwind`, `punch`, `scratch`, `jinx`, `icicle`, `dagger`, `blink`,
  `swipe`); no id removed from the units, abilities, encounters or
  daemons. World v39 → v42; `RUN_SCHEMA_VERSION` is 51 at both ends
  (`src/run/Run.ts:305`), and 160.5a re-pinned the save's fingerprint
  as compatible when the boss flag reached `UnitTemplate`. The slot
  refuses a save only on another format or a load that throws
  (`src/store/runSlot.ts:5-10`), so a `0.4.0` run should continue, a
  prediction 163b checks in the built game. By the version rule
  (META-ROADMAP §Round 8, "The version") a change in play moves the
  middle number: `0.5.0`. 156b left a `0.4.0` run in the `itch-preview`
  origin's slot for this check; `output/itch/asciibattler-0.4.0_4fc62cf`
  is on disk if it is gone.
- *The keep test's range.* Round 11's close to now, `b2e9362e..69a40c72`:
  AGENTS.md, CLAUDE.md and ROUND-RULES.md unchanged; the hook and the
  context meter's mod unchanged, so no guard was added. Two `process/`
  files. By 140d's definition, 2 rows, both in `shell-and-windows.md`:
  Node's `execSync` runs `cmd.exe`, so write `<sha>~1`, not `<sha>^`
  (`b264cece`, signed at §159's close from 159d-post's slip); Python's
  text-mode `open()` writes CRLF, so open in binary or with
  `newline='\n'` (`fa2bfd61`, from 160g's slip). `browser-pane.md`'s
  "not live" bullet changed a fact, not a row: the stand-in's wait and the
  `scratch/` figures (`6994d7f7`), with a fact line added at `bfb4d921`
  and dropped at `0af7c357`, the user's calls both.
- *The friction log.* 32 lines tagged §157 to §162 from 8 sessions
  (`06280e35` to `a2884e23`): 24 `slip`, 7 `papercut`, 1 `distress`
  (§157 1, §158 1, §159 3, §160 6, §160.5 5, §161 9, §161.5 4, §162 3);
  and two §156 slips (156e, 156f) filed after 156d's read, read here.
  Traps met more than once, by the lines' text (163d counts them from the
  transcripts):
  - a premise or claim used ahead of its source: 157 and 161 (the units
    file's shape guessed), 158b, 159d, the 160.5 kickoff, 160.5a, 161a,
    161c, 161h, 161.5a, 161.5b-post. Three phase closes put a form of it
    to the user, and each time no new rule was signed: §159's (an absence
    read from a source that could not show it, at §160's cut), §161's (a
    premise used before it was read, at §161.5's cut) and §161.5's (a
    claim generalised past its measurement, at §162's kickoff). §162's
    report names numbers written before they were counted, each caught
    before its commit.
  - a Windows shell trap: 159d-post (`execSync`'s caret), 160g (three
    lines: the backslash guard twice, Python's CRLF), 161h (a heredoc's
    parse), §161.5 (the backslash guard), 162f (the stdin guard). Two
    became the rows above; the guards caught the rest before anything ran.
  - a repo guard doing its job: 160.5c (the comment-codes guard), 161f
    (the sweep report's inactive archetypes in catalog order), 161g (the
    i18n literal pin).
  - the hidden pane slow to go live: 161f-post2, 161.5b (papercuts),
    answered by the watcher's `scratch/` skip before §162.
  - a box driver killed by a PC restart: 162c, after §155's (TODO, "Not
    yet placed", the resume mode).
  - the `distress` line (159e, `06280e35`), the silent-turn reminder
    during hook waits, quoted to the user at §159's close and left.
- *The session reports.* 9 entries from 8 sessions, with the phase
  summaries of §157 and §158 to §162.
- *The scratchpad.* No Round 12 entry.
- *The open Round 12 TODO rows.* One: the units' lines (151f), the
  user's to write; 6 of 43 units carry a `description` (the six beasts).
  In "Not yet placed", this round's one row: a resume mode for
  `box-drive.sh` (162c). Round 13's exit is "as round 12's", so it closes
  with a board, and the resume mode's row is before it.
- *HANDOFF.* Closed rounds at 6,044 of 8,000 characters, the Cursor at
  1,765 of 3,900; a Round 12 line of about 600 fits with no fold
  (predicted).

**The cut, put to the user.**

- **163a — the round's exit by clause, and Round 13's charter against
  the code** (`stop`). Round 12's exit, release line, save clause, the
  spec's rules, its two decision points and its scope guard (the push's
  footprint check, `src/sim/push.ts:69`, and its test), each with the
  record or the probe that shows it; Round 13's in-scope bullets and its
  TODO rows re-read at HEAD (the idle miss path: `unit:missed`, the MISS
  splat, the `evade` and `dealMiss` triggers; `applyDamage`'s boolean and
  `FireScratch`; the specials' two gaps; global reach; `extends` and the
  places a new archetype is registered, recounted from this round's four
  newcomers against the charter's seven; `knownAbilityIds`; the 0.3 s
  release experiment, the officer, the kit watches and §162's two named
  watches). WORKLOG and TODO, no smoke. A decision point: Round 13's
  charter stands or is amended.
- **163b — `0.5.0`, the tag and the zip** (`none`). As at 156b: `npm
  version 0.5.0 --no-git-tag-version`, the commit, an annotated tag
  `v0.5.0`, neither pushed; `itch-zip.mjs` on the clean tree and its
  `--check`, with `0.4.0`'s zip as the failing control; in the pane: the
  build ID, the fonts, the dev handles undefined, and a run saved by
  `0.4.0` offered Continue, its map opening and a fight playing. If the
  `0.4.0` run is refused, that changes the release's save line and goes
  to the user before the tag. An itch changelog drafted
  (`scratch/163b/changelog.md`).
- **163c — the smoke, the upload and the playtest** (`stop`, the
  user's). Firefox and Edge: the build ID; a `0.4.0` run continued if one
  is on itch; a new run with a battle and sound, and where the run offers
  them a newcomer drafted, a push, the Snag, a blink, a charge and a fall
  seen (163b writes where each is likeliest met); `main` and the tag
  pushed at their word. The round's playtest is offered on the uploaded
  build.
- **163d — the process read** (`stop`, in two tranches). First: the keep
  test over the 2 rows, each with its record and a keep or a delete (from
  the round's transcripts, as 156d's replay read them); the 34 friction
  lines, slips counted by trap; the candidates with their instances.
  Then: the units' lines and the resume mode, each with a round; the
  papercuts still open; the scratchpad, empty.
- **163e — the list built as signed** (`none`). The deletions and
  promotions, a guard if one is signed (its planted failure, a control
  that passes), the TODO rows; the oracle is the rule docs' diff against
  the signed list, with the docs tests green. No smoke.
- **163f — the archive and the round's close** (`stop`). ROADMAP to
  `archive/post-156-roadmap.md` and a fresh one opened at §164 with Round
  13's charter; the spec, the session reports (as
  `archive/sessions-round-12.md`), the rules
  (`archive/round-12-rules.md`) and the scratchpad
  (`archive/retro-scratchpad-round-12.md`) archived, this file to
  `archive/worklog-phase-163.md`; META-ROADMAP's CLOSED paragraph;
  HANDOFF's closed-rounds line and `archive/closed-rounds.md`; the
  Cursor at Round 13's kickoff by the hand-off pass; TODO's Round 12
  marked closed; pushed.

No snapshot bump, no RNG stream, no number moved, no box. No step
stages a path the hook's smoke watches, so the smoke fires on none:
163b stages `package.json` and its lock; 163e stages docs and TODO, and a
guard signed at 163d lives in its own tool and test.

The leans put with it: `0.5.0`, with a `0.4.0` run continuing; the
upload (163b, 163c) after 163a and before the process read, as at §140,
§147 and §156; the keep test over the rule docs only, 2 rows, the pane
bullet's fact edit outside it; the claim-ahead pattern listed at 163d
with its instances and not put again as a candidate, since three of this
round's phase closes put it and no rule was signed; the resume mode
placed in Round 13's TODO ahead of its board; 151f lands in §163 if the
user writes the lines before 163f, and otherwise its row carries to
Round 13's TODO as it stands; 163c's smoke is the round's playtest, and
no audit round, since no META-ROADMAP cluster closed.

### The cut signed (2026-11-27)

Signed: "Signing all of those, Claude! 😁", over the cut as put and its
seven leans. The stretch it opens runs to 163a's stop.

### 163a — the round's exit by clause, and Round 13's charter against the code (2026-11-27)

Read at `6940a92f`. Nothing under `src`, `config`, `tools`, `scripts` or
`tests` has changed since `69a40c72`, §162's close. The consumers were
read from the raw config files, not the loaders, by a probe in the
session's scratch directory.

**Round 12's exit (META-ROADMAP §"Round 12"), by clause:**

| Clause | Holds? | Evidence |
|---|---|---|
| Each seam with a headless test and its planted failure | yes | the push's walk (159a, 10 rules planted out), the held slide (159b, 13), the op (159c, 7), the Snag and its room gate (159d, 5; 159d-post, 4); the boss flag (160.5a, 7) and the fall (160.5b, 13); the hit after a leap (161b, 8), the blink and the dash's landing as an entry (161c, 14), the charge (161d, 18); each from its phase close's exit entry |
| The consumers in play | yes | at HEAD the grenadier (uncommon), the telekinetic (rare), the ninja (uncommon) and the cavalier (rare) are draftable, and each fights as an enemy in act 2 or 3: the grenadier in the Artillery Company (acts 2 and 3), the telekinetic in the Dark Magic Posse (act 3), the ninja among the Miscreants (act 3), the cavalier in the Warband Vanguard (act 2); the adventurer carries `snag` (a damage op and a push), the ronin `whirlwind` (a caster-anchored area), the banshee `wail` on her own cell (radius 2); each consumer's test from the raw config with its plants (160c to 160f, 161e to 161g) and the play signed at 160g and 161i |
| The board | yes | §162: §155's lines line for line at `5f277acc`, read with every lean signed at 162e, act 1's refs re-pinned and signed at 162f (BALANCE 2026-11-27, "the closing board at v10" and "the sheet re-pinned at v10") |

**The spec's rules for the re-cut's rounds.** Each seam with its test,
its plant and a consumer in play: the table's first two rows. The board
as paired same-seed deltas against §155's: BALANCE 2026-11-27 pairs 15
rows against 155a, and the wall-queen row alone clears a Bonferroni line
(49 → 34 of 40, 19 : 4, p 0.0026), named in the sheet's entry with no
cause read. An upload with something a player can meet: 163c.

**The release line** ("seven units and abilities"), read in config at
HEAD: four new units and 13 new abilities. The seven consumers are the
four units, the Snag, the whirlwind and the Wail on its caster; beside
them the Punch and the Scratch (160d-post, 160e-post), the Sabre and the
Dagger, the puma's pounce with the strike it shared renamed the Swipe,
the warlock's Jinx and the ice mage's Icicle (§161.5), and the fall. No
id was removed from the units, abilities, encounters or daemons; the
`pounce` id is kept, now the puma's leap. Every ability's line is held
by `src/config/abilities.test.ts` (its `withoutLine` check), green at
§162's close.

**The save clause** (a World bump): `WORLD_SCHEMA_VERSION` 39 at
`4fc62cfe` (`src/sim/World.ts:92` there) and 42 at HEAD
(`src/sim/World.ts:93`): v40 at 159b (the held slide), v41 at 160.5a
(the boss flag), v42 at 160.5b (the fall's pusher). Run 51 at both ends;
163b checks a `0.4.0` run in the built game.

**The decision points.** The design stop: signed 2026-11-16 at 158b, in
two tranches. Which new units are draftable: all four (tranche 2B), and
all four read `draftable` at HEAD.

**The scope guard** (no 2×2 body is pushed until round 19):
`pushLanding` returns null for a body larger than one cell
(`src/sim/push.ts:69`), and every forced move asks it (the push op,
`src/sim/effects/interpreter.ts:391`; the Snag's room gate,
`src/sim/effects/propose.ts:169`). Its test is `push.test.ts:104-119`
("never moves"), and 159a's plant "a large body moves" takes out that
line, whose text its `find` still matches at HEAD
(`scratch/159/159a-plants.json`).

**Built otherwise than the charter wrote it**, each signed: the fall
(§160.5, inserted at §160's play), a push into chasm or deep water
dropping its victim where 158b signed a stop at the edge, a boss
excepted; §161.5 inserted, the hex and the ice storm made specials over a
weak shot; N3's flag carried to Round 14 (158b); the cavalier's charge a
push on itself and the pounce on the puma (158b). Gotcha #142 added at
160.5b. GOTCHAS.md has no other change over the round.

**Round 13's charter at HEAD** (META-ROADMAP §"Round 13"):

- *Dodge as a passive special.* The idle miss path stands:
  `unit:missed` (`src/core/events.ts:260`), heard by the renderer's MISS
  word (`src/render/BattleRenderer.ts:1425`) and the sound registry
  (`src/audio/eventSounds.ts:127`); `dealMiss` and `evade` declared and
  unfired (`src/sim/triggers.ts:42-47`); the landing note in
  `World.applyDamage` (`src/sim/World.ts:783-788`). `evadable` is read by
  nothing (`src/sim/effects/schema.ts:102`); 27 damage ops are authored
  `evadable: true` and 8 `false`. *Found:* two landing notes are false
  since 160f. The whirlwind, an area on its caster, is authored
  `evadable: true` ("evadable as the katana", WORKLOG 160f, in
  `archive/worklog-phase-160.md`), where `interpreter.ts:38-39` says "no
  shipped area op is `evadable`" and `schema.ts:102-105` that the flag
  marks "the single-target weapons, as against blasts, spells and
  ticks". Inert today; under a dodge it decides whether a dodger can
  slip a whirlwind's cut. The round's other new damage ops are evadable
  but the Grenade and Repulse. "Perhaps the ninja" now names a shipped
  unit.
- *The resolved-damage return and `lifesteal`.* `applyDamage` returns a
  boolean (`World.ts:774-777`); `FireScratch` holds only `missed`
  (`interpreter.ts:44-47`). Holds.
- *`healActor`.* A battle rule's effects are `gainBits` and
  `applyStatus` (`src/sim/battleRules.ts:50-56`); `dealHit` carries the
  damage (`triggers.ts:39`). Holds.
- *The specials' two gaps.* A `self` def without a `summon` op proposes
  a leap or a blink (`propose.ts:304-308`, `proposeSelfMove` at `:215`),
  so a self-buff or a self-heal on `self` has no arm. Holds.
- *Global reach.* A search of `src/sim` and `src/config` for "global"
  finds no selector or flag. Holds.
- *`extends` and the places a new archetype is registered.* `extends` is
  unbuilt. Recounted from the four newcomers' commits (`92ac5ca3`,
  `6c771bc2`, `0b466d2e`, `85ca2214`): each touched `config/units.json`,
  `config/prices.json` and `config/fuzz-strategies.json`, and each glyph
  came in its own step (160a, 161a): four of the charter's seven. Each
  also touched six places the charter does not name:
  `locales/en/units.json`, `locales/en/abilities.json`,
  `src/sim/abilities/registry.ts` (its ability ids), the five fuzz
  fixtures' per-archetype records (`tests/fuzz/fixtures/`), the prior
  and roster tables' coverage tests (PENDING) and DESIGN's roster line;
  two added an effect to `src/render/fxRegistry.ts`, and the ninja moved
  `tests/fuzz/sweepReport.test.ts`'s inactive list, which is in catalog
  order (161f's slip). None touched the charter's other three: the
  redraw-fisher's record (`config/redraw-level-fisher.json`, refused by
  its own schema and loaded by nothing; TODO, "Not yet placed"),
  `Recruitment.test`'s EXCLUDED (non-draftables only,
  `src/run/Recruitment.test.ts:62`) and `REQUIRED_UNIT_IDS` (ids that
  code names, `src/config/units.ts:26`).
- *`knownAbilityIds`.* One reader, the archetype editor
  (`tools/archetype-editor/editor.ts:82`). Holds.
- *TODO's Round 13 rows.* The 0.3 s experiment's premise holds: the
  eight ranged weapons it names recover by `fill`, and the Jinx and the
  Icicle in 0.3 s (the Grenade and the Snag too). The officer reads base
  mobility 3 and rare. The kit watches, the parity row and §162's two
  named watches each wait on the next prior table or board, as written.

**The calls, with the session's leans:**

1. *Round 12's exit* is met by every clause, and the scope guard held.
2. *Round 13's charter* stands, with one parenthetical amended: "the
   seven places a new archetype is registered (…)" becomes "the places a
   new archetype is registered (recounted at 163a, WORKLOG §163)", since
   three of the seven no newcomer met and six it did are missing. And
   one TODO row under Round 13: the whirlwind's `evadable` and the two
   false landing notes, settled with the dodge's design, the flag and
   the notes in one commit. The other arm: the charter as written, with
   both left for Round 13's kickoff audit to find again.
3. Settled by the cut: 163c's smoke is the round's playtest; no audit
   round, since no META-ROADMAP cluster closed.

**163a signed** (the user: "Signing both calls on your leans! 😁").
Round 12's exit is met. Round 13's charter stands with its `extends`
parenthetical pointing at the recount above, and TODO's Round 13 holds
the whirlwind's `evadable` row.

### 163b — `0.5.0`, the tag and the zip (2026-11-27)

**Built.** `npm version 0.5.0 --no-git-tag-version` changed
`package.json` and the lock file; the commit `f0a0438a` and the
annotated tag `v0.5.0` were made by hand, as at `0.4.0`. Neither is
pushed. The commit's hook ran the full suite: 4101 tests in 291 files,
green, typecheck clean, the smoke skipped (no sim path staged), as the
cut predicted. `node scripts/itch-zip.mjs` on the clean tree:
`asciibattler-0.5.0_f0a0438.zip`, build ID `0.5.0+f0a0438`, 37 entries,
1,458,791 bytes (`0.4.0`'s: 32 and 1,264,358), the build's hash
`031d5d53…501678c`. The five new entries are the round's cues:
`audio/blink.wav`, `charge.wav`, `fall.wav`, `shove.wav` and
`splash.wav`. `--check` against the build, run on its own, exit 0; the
control, `0.4.0`'s zip against this build, exit 1 ("the zip holds 32
files and the build 37").

**In the pane** (Chromium, `itch-preview` over `output/itch/current`,
restarted after the zip, since it had served `0.4.0`'s bundle):
`<html data-build>` and the menu's corner read `0.5.0+f0a0438`;
JetBrains Mono, DejaVu Sans Mono and ASCIIbattler Glyphs loaded
(`document.fonts`); `__probe`, `__game` and `__diag` undefined; one
inline script and one module bundle; the console tool returned no
error.

**A run saved by `0.4.0` itself.** The origin's slot held the run 156b
saved: format 51, stamped `0.4.0+4fc62cf`, 5,655 characters. Its text
was copied to a key of its own first (removed at the end). With `0.4.0`
still served, the menu offered Continue (the control). With `0.5.0`
served, the menu offered Continue with no message, the slot's text
unchanged (the same SHA-256 prefix, `4555161c8091be63`), and Continue
opened that map: The Periphery, the Bandit King its boss, roster 10,
morale 40 / 40, no failure plate. Through the first node, an event
(a pile of bits taken), the next gate saved the run at format 51
stamped `0.5.0+f0a0438`. A battle node then opened the Canids' deploy
screen; Fight played the skirmish in the hidden pane, its frames running
at about 17 a second, hitsplats drawn, to "Skirmish won" and turn 2,
morale 39 / 40 against 11 / 20, no failure plate. The slot now holds
that `0.5.0` run, for the next upload's check.

**The changelog** for the itch page, drafted for the user to post:
`scratch/163b/changelog.md` (off git). Its claims are read from config
at HEAD (the abilities' names, lines, ops and numbers, the units'
rarities, the encounters fielding them, the five new cues) and from the
round's records (a boss stopping at the edge, the storm's 5 s), and the
continued run above.

**Where each is likeliest met**, for 163c's smoke, from
`config/sectors.json` and `config/encounters.json`. Act 1, The
Periphery: the Snag and the whirlwind at the Bandit King (one of its two
bosses), the puma's pounce at Cats! (an elite) and the Divine Bear (the
other boss). Act 2, The Fragments: the enemy grenadier's push at the
Artillery Company, the cavalier's charge at the Warband Vanguard (an
elite), the Snag at the Guarded Adventurer. Act 3, The Deep End: the
ninja's blink among the Miscreants, the telekinetic's Repulse and the
warlock's Jinx at the Dark Magic Posse (an elite), the Icicle at the
Elemental Trio, the Wail at the Bandit Queen. In a draft, the grenadier
and the ninja are uncommon, the telekinetic and the cavalier rare. A
fall needs a push beside chasm or deep water: the spiral and the water
maps.

**Not verified:** Firefox and Edge, the itch frame, sound by ear, a
newcomer in a draft or a battle in this build, a push, a pull, a blink,
a charge or a fall seen in it: 163c.

### 163c — the smoke, the upload and the playtest (2026-11-27, the user's)

The user uploaded `asciibattler-0.5.0_f0a0438.zip` and read the smoke as
the session listed it (in Firefox and Edge: the build ID, a `0.4.0` run
continued if one was on itch, a new run with a battle and sound, and
the newcomers where the run met them): "Alright, it's uploaded, and the
reads are good! 😁" Those reads stand on the user's word; the session
saw no report of them. Which newcomers the run met, whether a `0.4.0`
run was on itch to continue, and whether the changelog was posted are
not recorded. By the cut's lean the smoke is the round's playtest.
Pushed at that word, as at 156c: `main` and the tag `v0.5.0`.

### 163d — the process read, tranche 1: the keep test, the friction read and the candidates (2026-11-27)

The instrument: `scratch/163d/replay.mjs` reads the round's eight
session transcripts (`06280e35` to `a2884e23`, this session left out),
taking what a session ran or wrote (the Bash and PowerShell commands,
and Write and Edit contents) with each call's result, so doc text
quoted back in a result is not counted: 2,647 calls, each tool call
counted once by its id. Its patterns pass a planted control
(`scratch/163d/control.mjs`: an unsafe and three safe Python writes, a
caret and a tilde revision, each with its known answer). Its first form
counted `newline=''` as unsafe, though it writes `\n` untranslated, and
was corrected before any number below was read. Both `python` and
`python3` here are Windows' Python 3.14, whose `os.linesep` is `\r\n`.

**The keep test** (2 rows, `b2e9362e..69a40c72`):

- *`shell-and-windows.md`: `execSync` runs `cmd.exe`, so write `<sha>~1`*
  (`b264cece`, 2026-11-17T22:42Z, from 159d-post's slip, where
  `<sha>^` read the same commit on both sides and nearly gave a clean
  negative). Before it, one call in the round passed a revision through
  `execSync` (the slip's, with its `~1` retry); after it, none of the
  calls did, so the slip had no occasion to recur. No record names the
  row after its own commit. Lean: **keep**, on the leg that kept 156d's
  junction row (the slip did not recur), with that leg weak here, since
  the occasion never came; the trap gives a wrong answer that looks like
  a clean one, and the row is three lines in a doc read on a trigger.
- *`shell-and-windows.md`: Python's text-mode `open()` writes CRLF*
  (`fa2bfd61`, 2026-11-20T14:18Z, from 160g's slip, where four repo
  files came out CRLF in the working copy). Before it, 133 Python writes
  in the round, 14 translated: three to scratch plant files (06280e35),
  seven (54b6d474) and the slip's four (652e794b); the rest already
  wrote untranslated (`newline=''`, `newline='\n'` or binary). After it,
  59, of which 5 translated: 51358a14's four at
  §161.5's close, which put CRLF into HANDOFF, ROADMAP, WORKLOG and the
  archived worklog, caught by git's warning and rewritten in binary the
  same minute, before the commit, not filed; and one scratch file
  (caa59af4). So the slip recurred once at its first size. No record
  names the row after its own commit. `* text=auto eol=lf`
  (`.gitattributes`) keeps every commit LF whatever the working copy
  holds: no tracked file holds CRLF in the index or the working tree
  today (`git ls-files --eol`). Lean: **delete**, since neither leg
  holds and git's warning is what caught the recurrence. The other arm:
  keep it as a fact line, since the trap costs a cleanup step each time.

**The friction read.** 34 lines: the round's 32 (§157 to §162) and the
two §156 slips filed after 156d's read; 26 `slip`, 7 `papercut`, 1
`distress`. §163's own two slips (163a, 163d) are this session's. Slips
by trap, by instance:

- *A premise or a claim used ahead of its source*: 14 instances in 13
  lines: 156f, 157, 158b, 159d, 160f, 160.5, 160.5a, 161, 161a, 161c
  (two), 161h, 161.5a, 161.5b-post. Reached the user or a commit: 156f
  (the itch page's line, Round 11's, fixed by the user), 158b (a lean in
  a tranche, reopened by the user's question), 160.5 (a function's name
  in WORKLOG, fixed in a second commit), 161a (a signed glyph put back),
  161h (a stop report, which a suggestion of the user's partly rested
  on; a sweep before the answer corrected it), 161.5a (a read URL,
  corrected before the user's read), 161.5b-post (a cadence claim in
  four docs and the stop report, corrected at the -post with its tests
  rewritten). Caught first: 157 and 161 (the units file's shape, by the
  error), 159d and 160.5a (predictions, marked before their runs), 160f
  and 161c (by the tests). §162's report names three more, all caught
  before a commit.
- *A Windows shell trap*: 8 instances in 7 lines: the backslash guard
  four times (160g twice, 160.5a, §161.5), a heredoc's parse (161h), the
  stdin guard (162f), `execSync`'s caret (159d-post) and Python's CRLF
  (160g). The guards refused six before anything ran; the other two are
  the keep test's rows.
- *A repo guard catching what the hand-run suite did not*: 4 (160g's
  formatter field order, 160.5c's comment codes, 161f's sweep report in
  catalog order, 161g's i18n literal pin), a hook run each.
- *A sentence the change made false, missed in its commit*: 2 filed,
  both in DESIGN at §160 (160a's roster line, 160g's grenade recharge),
  and 163a's finding of the same kind, two landing notes in code
  comments made false at 160f, unfiled.
- *Once each*: a script's edit beyond its list (156e), and a probe's
  page script whose error path put modal dialogs on the user's screen
  (160.5e, fixed in `shell/electron/main.mjs`).

The papercuts: the hook's 5 s timeouts (160g), Electron's binary
downloaded unannounced (160.5e), the chaos census's re-pick (161e), the
hidden pane slow to go live (161f-post2, 161.5b), a box driver killed by
a PC restart (162c), a stale recipe (162d). Tranche 2 reads which are
still open.

**The welfare read.** One `distress` line (159e, `06280e35`), the
silent-turn reminder during hook waits, quoted to the user at §159's
close. Two more reports (`54b6d474`, `652e794b`) name the same reminder
as a slight pull to write a status line with nothing finished, answered
with short true lines and not filed. Every report's answer to question
6 says there was room to ask or disagree, with instances; none names a
wish to pause or stop, beyond 06280e35's choice to wait. Every report's
answer to question 3 names pulls to over-claim; two got out (161h,
161.5b-post), both filed. *The reader's interpretation:* as at 156d,
the pulls the reports name were mostly noticed and declined, and the
slips are the ones that went through.

**The candidates, with the session's leans:**

1. *The claim ahead of its source*: listed above and not put again, as
   the cut's lean signed; at 156d the user dropped it, to revisit "if it
   causes a major issue". Its costliest instances this round, 161.5b-post
   and 161a, cost a corrected stop report and a sign asked twice; by the
   records none cost a play pass or a box run. No candidate.
2. *A sentence the change made false* (3 instances, all at §160). AGENTS
   "Where things go" already asks a change to grep its section for the
   sentences it affects in DESIGN and ARCHITECTURE, and 160a's line says
   the unit's name was the term to grep; the comments' instance is inert
   and now a TODO row. Lean: **no new rule**. The other arm: one clause
   in `process/planning.md` "Deferrals": a change that makes a landing
   note false fixes it in the same commit. It met once, so it is under
   the bar.
3. *The shell traps*: the guards caught six of eight before anything
   ran, and §161.5's close put the pattern to the user, who signed no new
   rule. Listed and left; no candidate.

**Tranche 1 signed** (the user: "Signing tranche 1 on all your leans!
😁"): `execSync`'s row kept; Python's CRLF row deleted (163e); no new
rule or guard.

### 163d — tranche 2: the open rows, the papercuts and the scratchpad (2026-11-27)

**The open Round 12 rows**, each with its place:

- *A line for every unit* (151f), the user's to write: 6 of 43 units
  carry a line. By the cut's signed lean it carries to Round 13's TODO
  as it stands at 163e, unless the user writes the lines before 163f.
  Round 13 adds four units, so the set grows by four.
- *A resume mode for `box-drive.sh`* ("Not yet placed", 162c): placed in
  Round 13's TODO ahead of its board, by the cut's signed lean, at 163e.

**The inbox's two older rows**, which Round 11's close left unplaced:

- *The redraw-fisher file refused by its own schema* (§144): 163a's
  recount found that no newcomer touched it, since nothing loads it. Lean:
  **place it in Round 13** beside `extends`, whose registration checklist
  decides whether the file is filled in or deleted.
- *Beyond the Roman look* (§151): Round 17's daemons are the next new
  ones, as the row says. Lean: **place it in Round 17**.

**The papercuts still open.** Of the round's seven: fixed, the hook's
timeouts (`4a94f71f`, §160) and the stale recipe (`ec0f6ffc`, 162d);
answered, the hidden pane's slow load (the watcher's `scratch/` skip,
`6994d7f7`, its TODO row ticked); placed, the driver killed by a restart
(the resume row, above). Two were left at their phase closes, and
neither recurred after (the friction log has no line on either since):

- *Electron's binary fetched unannounced* (160.5e): left at §160.5's
  close, once with no known cause. Lean: **left**.
- *The chaos census's re-pick* (161e): left at §161's close, since 161f
  and 161g passed with the census as it stood. Each draftable newcomer
  moves the walks, and Round 13 adds four units; the sweep that found
  the fifth slot is `scratch/161e/chaos-sweep.ts`, which git ignores, so
  it is on this machine only. Lean: **left**; a re-pick at Round 13 is
  that phase's step zero, and the sweep is named in §161's close.

**The scratchpad.** No Round 12 entry; 163f archives it with its sweep
line.

The list 163e builds, if tranche 2 is signed on its leans: Python's
CRLF row out of `process/shell-and-windows.md`; in TODO, 151f's row and
the resume mode under Round 13, the redraw-fisher row under Round 13
and the Roman look under Round 17; AGENTS, CLAUDE.md, ROUND-RULES and
the guards unchanged.
