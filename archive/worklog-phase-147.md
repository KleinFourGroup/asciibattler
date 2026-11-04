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
signed at 143c), [archive/worklog-phase-144.md](archive/worklog-phase-144.md)
(§144, the fauna: our glyph face in the Private Use Area, the six beasts
and their attacks, three trees played as one, with the landing note for
§145 at 144g), [archive/worklog-phase-145.md](archive/worklog-phase-145.md)
(§145, act 1 and the run's shape: the user's encounters and events, the
forest, act 1 on the map, with the notes for §146 in "The hand-off after
145g") and [archive/worklog-phase-146.md](archive/worklog-phase-146.md)
(§146, the board and act 1's bands: the board on three acts, act 1
tuned to the signed turn targets and played, the verify board, the
sheet re-pinned and act 1's wall signed). Round 9's are
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) to
[archive/worklog-phase-140.md](archive/worklog-phase-140.md).

## Phase 147 — the close

The kickoff's inputs, by pointer: the charter, ROADMAP §147, with
META-ROADMAP §"Round 10 — Act 1, the wilds" (the exit, the release, the
scope guards) and §"Round 11 — The roster"; `process/planning.md` "Round
close"; TODO's "At the round's close" under Round 10; what §146 leaves,
`archive/worklog-phase-146.md`, 146h; and `retro/sessions.md`, session
43260fa8, answer 5.

### The kickoff's audit, and the cut put to the user (2026-11-03, session c830ad7f)

Read at `6f4da6b7`:

- *What the close holds.* The charter's five items, and the round close
  by `planning.md`: the archive, the scratchpad sweep, META-ROADMAP's
  status, the Cursor, the upload, the keep test over the round's rule
  lines (the user signs the list), Round 11's charter against the code, a
  playtest proposed. TODO's one round-close row is the user's: the HANDOFF
  Cursor's structure and contents. ROUND-RULES holds no rule. Round 10's
  charter names no read for its close, where Round 9's named two.
- *The upload.* `package.json` reads `0.2.0`, the uploaded build
  (`7ce982b7`). Since it: act 1, its beasts and forest, the run's new
  shape, the scripted run, act 1's tune. Run is v50 and World v39 at both
  ends, so a run saved by `0.2.0` is not refused: 145d's fixture
  (`tests/integration/save-across-map.v50.json`, recorded on the two-act
  map) loads and walks The Start and The Deep End to `complete`. By the
  version rule (META-ROADMAP §Round 8, "The version") a change in play
  moves the middle number, so `0.3.0`, and unlike `0.2.0` it keeps a run
  in progress, which resumes on the old two-act shape. Our glyph face
  (§144) is the one new kind of asset since `0.2.0`. Firefox is in no
  verified list from §144 or §145 (the eared glyphs on the atlas's
  `middle` baseline, the forest, the description line).
- *The keep test's range.* Round 9's close to now, `9e1b7c48..6f4da6b7`:
  AGENTS.md and CLAUDE.md unchanged; four `process/` files from three
  commits (`0043f298` at 142a, `6417d224` at 144h, `b0ef8e20` at 146d).
  By 140d's definition (a rule row is a sentence or bullet that directs an
  action or sets a default, present at the range's end and in no rule doc
  at its start; a moved line is not added, and a rewritten one counts
  once if its directive changed), 5 rows: `browser-pane.md`, a second
  screenshot before reading a change; `measurement.md`, unlink a
  worktree's junction before `git worktree remove`; `oracles.md`, the
  same, a rewritten sentence; `shell-and-windows.md`, refused text through
  a Write-tool file or the PowerShell tool, and `# halving: measure` to
  measure the halving. The guard's description in that paragraph is a
  fact, not a row. The round's guards (the backslash guard, the
  strategy-fixture test at `765e1aff`) are outside it, as 140 signed for
  Round 9's.
- *The friction log.* 35 lines tagged §141 to §146: 10 `papercut`,
  24 `slip`, 1 `distress` (§141 1, §142 3, §143 3, §144 15, §145 6,
  §146 7). No wording change inside the round (welfare-and-efficacy.md's
  table ends at 2026-10-28; AGENTS.md is unchanged over the range), so one
  group. Left to this read by the phase closes: the silent-turn reminder
  (144f's papercut with §144's `distress` line, and the kickoffs of §145
  and §146) and 141's background agents (left at 142h, one instance).
  Traps met more than once, by line:
  - backticks in a double-quoted `node -e`: 144c, 145g, 146g, three
    phases running, the last into a commit (`b970ea54`); §146 put it to
    this read as a candidate.
  - a leftover `python3 -` or heredoc line: 144c, 144f (it ran by luck),
    146g (twice); the stdin guard refused all but 144f's.
  - backslash text refused by the backslash guard: §144 at 144b, 144d
    (twice); the guard doing its job.
  - a docs cap at the commit: the Cursor's (142b, three refusals; 144c;
    146e), BALANCE's header (143b, 145h; 140e before the round). The
    Cursor's is the user's round-close row.
  - a change's reach under-predicted, caught by the hook: 145e (the
    themes), 145f (a placeholder id), 146e (the seeded drives).
  - a number written before its source was read: 143c (in front of the
    user for a turn), 145b (into a commit, corrected with a control),
    146d (caught before the commit); session 43260fa8's report names two
    more, at 146f and 146g.
- *The session reports.* 11, `c15dd076` to `43260fa8`.
- *The scratchpad.* No Round 10 entry.
- *The open Round 10 TODO rows*, besides the close's: the ceiling deltas'
  pooled label (the board), a numbered layout crossed at an event node
  and the run-config CLI's mid-run warnings (the scripted run), and the
  editors' shared rules. Each needs a round at the archive.
- *The skill gradient* (session 43260fa8, answer 5). Its random < greedy
  leg WARNs on each board whose read I found since 92h: ties at 92h
  (0.275 each), 94h (3 of 40 each) and 146b (11 each), and 11 of 40
  against greedy's 7 at 146f; the greedy < ARM leg read ok at 146f.
  BALANCE's board protocol, the skill-gradient bullet, calls an occasional
  inversion on that leg expected noise at n = 40 and the ARM legs the
  load-bearing ones. `evaluateSkillGradient`'s comment
  (`tests/fuzz/board/board.ts:566`) says an inversion means the instrument
  is broken and that a WARN on a signing board blocks the signing, and
  the WARN's text says the instrument is broken. 146f's 11 against 7
  reads two-sided Fisher p 0.42 (a planted 2 against 12 reads 0.006), and
  the check reads a tie as an inversion (`floor < mid`, strictly). A
  search of TODO, ROADMAP, META-ROADMAP and HANDOFF for "gradient" finds
  no row (the one hit is the HP bar's). So the leg can't be told from a
  tie at the anchors' n, the code says more than BALANCE does, and 146g
  signed with the leg WARNing, which BALANCE allows and the comment does
  not.

**The cut, put to the user.**

- **147a — the round's exit by clause, and Round 11's charter against
  the code** (`stop`). Round 10's exit (a run from act 1 to The Deep
  End's boss, playable end to end; act 1's bands signed), its release
  line, its risk's save clause, its decision point and its scope guard,
  each with the record or the probe that shows it; Round 11's in-scope
  bullets and its TODO rows re-read at HEAD, §146's riders among them
  (act 1's cost, the arbitration's walk loss, the officer's PENDING); the
  skill gradient's TODO row. WORKLOG and TODO, no smoke. A decision
  point: Round 11's charter stands or is amended.
- **147b — `0.3.0`, the tag and the zip** (`none`). As at 140b: `npm
  version 0.3.0 --no-git-tag-version`, the commit, an annotated tag
  `v0.3.0`, neither pushed; `itch-zip.mjs` on the clean tree and
  `--check`; in the pane (`itch-preview`): the build ID, the fonts with
  our glyph face, the dev handles undefined, and 145d's v50 fixture
  planted in the slot and resumed. No smoke. An itch changelog drafted.
- **147c — the smoke, the upload and the playtest** (`stop`, the
  user's). As at 140c: Firefox and Edge, the build ID, a run saved by
  `0.2.0` resumes, a new run from act 1 with the beasts and the forest
  (Firefox's first look at the eared glyphs), a battle with sound; `main`
  and the tag pushed at their word. The round's playtest is offered on
  the uploaded build.
- **147d — the process read** (`stop`, in tranches). The keep test over
  the 5 rows, each with its record and a keep or a delete; the 35
  friction lines, slips counted by trap, the `distress` line quoted in
  full, and the reminder's welfare read the three phase closes left here;
  the candidates with their instances (the backticks trap first); the
  Cursor's structure and contents; the four open Round 10 TODO rows, each
  with a round; the scratchpad, empty. The keep test and the candidates
  go first, then the Cursor, then the TODO rows.
- **147e — the list built as signed** (`none`). The deletions and
  promotions, a guard if one is signed (with its planted failure and a
  control that passes), the Cursor's reshape if signed, the TODO rows; the
  oracle is the rule docs' diff against the signed list, with the docs
  tests green. No smoke.
- **147f — the archive and the round's close** (`stop`). ROADMAP to
  `archive/post-140-roadmap.md` and a fresh one opened at §148 with
  Round 11's charter; the spec, the session reports (as
  `archive/sessions-round-10.md`), the rules and the scratchpad archived,
  this file to `archive/worklog-phase-147.md`; META-ROADMAP's CLOSED
  paragraph; HANDOFF's closed-rounds line and `archive/closed-rounds.md`;
  the Cursor at Round 11's kickoff; TODO's Round 10 marked closed; pushed.

No snapshot bump, no RNG stream, no number moved, no box. No step stages
a path the hook's smoke watches (`src/sim`, `run`, `core`, `config`,
`bot`, `config/`, `tests/fuzz/`), so the smoke fires on none; a guard
built at 147e lives in the context meter's mod and its test outside
`tests/fuzz/`.

The leans put with it: `0.3.0`; the upload (147b, 147c) after 147a and
before the process read, as at §140; the keep test over the rule docs
only, the round's guards out of it, as at §140; the skill gradient a TODO
row under Round 11, "Before the closing board", with no probe in §147
(the leg read as a tie when its gap is inside the noise, or more anchor
seeds, and the comment and the WARN's text brought to BALANCE's wording),
since 146f's gap is noise by BALANCE's own line and the load-bearing leg
read ok, so 146g's sign stands; a guard signed at 147d built at 147e
rather than carried to Round 11.

### The cut signed (2026-11-03)

Signed: "Fully signed! 😁", over the cut as put and its five leans. The
stretch it opens runs to 147a's stop.

### 147a — the round's exit by clause, and Round 11's charter against the code (2026-11-03, session c830ad7f)

Read at `d0f557bf`. No file under `src`, `config`, `tests`, `tools` or
`scripts` has changed since `94cca56f` (146g), so the tree plays 146f's
config.

**Round 10's exit (META-ROADMAP §"Round 10"), by clause:**

| Clause | Holds? | Evidence |
|---|---|---|
| A run from act 1 to The Deep End's boss, playable end to end | yes | the user's play at 145h, act 1 to The Deep End's boss (ROADMAP §145); after 146e's tune the user played act 1, and the whole run is played headlessly: every walk row at 146f runs the three acts, the ARM's deploy row winning 45 of 120 and doctrine's 28 of 40 (BALANCE.md 2026-11-03, "the verify board") |
| Act 1's bands signed | yes | arm (B) at 146d, the tune at 146e read in the user's play, the re-pin at 146g with act 1's wall signed for the first time (`archive/worklog-phase-146.md`) |

**The release line**, a new first act: The Periphery is the map's
source (`config/sector-map.json`), forest, 11 hops, the bear and the
Bandit King its bosses (`config/sectors.json`). It reaches players at
147c.

**The risk's clauses.** *The save:* no Run bump in the round (Run v50
and World v39 at `9e1b7c48` and at HEAD); 145d's test, a v50 save
recorded on the two-act map, passes 3 of 3 at HEAD, its control in the
test (the save's node renamed throws). *Each moved boss re-read at its
new place:* on 146f's walk rows, the King and the bear in act 1, the
Generalissimo and the Witch Hunt in act 2 and the Queen in act 3 (deaths
by boss in BALANCE's 2026-11-03 entries), with the King and the Queen
forced at their home acts (0.717, 0.258); acts 2 and 3 recorded, not
retuned (146g).

**The decision points.** The Start takes barren: decided at §145,
`the-start` titled The Fragments, theme `barren`. Act 1's hops and
bosses: the plan's, 11, the bear and the King.

**The scope guard** (no flyer, swimmer, 2×2 or swarm). The nine units
added since `9e1b7c48` are the six beasts and three trees, none with a
`footprint` or a `movementBehavior`. Every key a unit def uses at HEAD:
`abilities`, `autoTarget`, `baseStats`, `blocksLineOfSight`,
`description`, `draftable`, `footprint`, `glyph`, `growthRates`, `hp`,
`movementBehavior`, `name`, `rarity`, `retargetOnLosLoss`,
`statusImmunities`, `statusSusceptibility`, `targeting`; no unit carries
a layer, and `footprint` is set on `rubble_2x2` and `rubble_3x3` alone,
both there at `9e1b7c48` (the reader's control: the key it would show
for a 2×2 unit). The six beasts are 1×1 melee and `draftable: false`.

**Against the charter.** In scope and done: the scripted run (§142), the
fauna (§144, the bear among them), act 1's sector and the run's shape
(§145), the sheet's per-act tooling (§143), the atlas at 128 cells
(144a), the roster table rebuilt (146c, v5 at 146f, the officer
PENDING). Outside it, each signed as it came: our glyph face in the
Private Use Area (144c, 144d), a unit's description line (145c), the
Vermin Lords at the pool lever with act 1's cost to Round 11 (146e), the
backslash guard (142a), the strategy-fixture guard (`765e1aff`, for
146b's finding), the junction line (146d). 141 gotchas at both ends.

**Round 11's charter at HEAD** (META-ROADMAP §"Round 11"):

- *The weapons and defense.* The converted numbers are config, pinned by
  `tests/strike-conversion.test.ts` against its frozen before-file, a
  later signed change going in its `DEPARTURES`. A retune by taste moves
  most of them, so whether that test grows a long `DEPARTURES` or retires
  at the retune is a question for Round 11's kickoff.
- *Power by rarity.* 1/1/1/2 at HEAD: base power 1 for common, uncommon
  and rare, 2 for the three legendaries. *Its growth key:* every
  `growthRates.power` is 0, and `simulateLevelUps` draws for each key in
  `STAT_KEYS`, power the ninth (`src/sim/leveling.ts`); the TODO row's
  line pointer was stale and is fixed.
- *The kit watches.* The five units are in `units.json`; the officer
  stays PENDING in the roster table's guard (0 of 25,657 ARM rosters).
- *Bandits not draftable.* One flag, `draftable: false`, which twelve
  units carry (the ice mage, the warlock, the luminant, the banshee, the
  ghoul, the prodigy and the six beasts). The prior table's guard flags
  the change, since a row for an item no longer acquirable is stale; the
  roster table's does not, since its rule 2 asks only that an archetype
  exists, and v5 holds 107 of its 25,657 rosters with a bandit, which the
  board's sampler would go on handing the ARM (the count's control: the
  reader's total is v5's). And the bandit is a kit watch, a recruit read
  with nothing to read once he leaves the draft.
- *The priest's parity.* Inside ±5 on act 1 at 146f (+1.7 regen, +0.8
  deploy over the soldier); the TODO row keeps it for Round 11's board.
- *The blind fix.* `Targeting.ts` still gives a blinded unit with nothing
  inside its acquisition range the fallback target (its comment at
  `:670`).
- *Mars.* One daemon, `grantEmpowers` once a turn: +4 strength, +4
  ranged, +8 magic. Two new daemon ids trip the prior table's guard (an
  acquirable item without a row), so the exit's rebuild is forced.
  Whether removing `mars` needs the Run bump the charter names is not
  read here.
- *Dis Pater.* The two TODO rows stand as written.
- *Ability descriptions.* The ability schema has no `description`
  (`src/config/abilities.ts`); the unit schema has had one since 145c.
- *The wall watch.* The sheet's terminal pair (reach 0.40 to 0.50, wall
  0.30 to 0.35) was set for the two-act walk's deep end; on the three-act
  walk it reads act 3, where 146f has reach 0.475 and 0.117 and wall
  0.211 and 0.357 (ARM deploy, regen). The TODO row's numbers are the
  two-act walk's, and act 3 is Round 22's.
- *The exit, "the board read and signed."* Act 1's are the only act
  bands the sheet signs (146g); acts 2 and 3 are recorded for Rounds 21
  and 22. A roster retune moves all three.
- *In TODO under Round 11, from §146 and this close:* act 1's cost (a
  per-kind target signed at its kickoff), the arbitration's walk loss and
  the skill gradient (each before the closing board; the gradient's row
  written here, lean 4), the officer's PENDING (in the kit watches' row).
- *Noted:* The Deep End's `description` still calls it the second act.
  A sector's description is editor metadata, never shown
  (`src/config/sectors.ts`).

**The calls, with the session's leans:**

1. *Round 11's charter* stands, amended in three lines. The kit watches
   lose the bandit, whose watch ends with N28. N28 carries the roster
   table's guard failing on a recorded roster that holds an archetype no
   longer draftable, since the forgetful path is a board between N28 and
   the closing board's rebuild. The wall watch is read on Round 11's
   board, with its TODO row re-read on the three-act walk, and the
   terminal band's re-set goes to Round 22 with act 3.
2. *The exit* reads: the board read, act 1's bands re-pinned and signed,
   acts 2 and 3 recorded for Rounds 21 and 22; the prior table rebuilt.
3. *The Deep End's description:* a TODO row under Round 22, which
   rewrites act 3, rather than a config edit in the close.
4. Settled by the cut: 147c's smoke is the round's playtest. No audit
   round, since no cluster closed, as at Rounds 8.5 and 9.

**147a signed** (the user: "That's looking great, Claude! 😁 Signed!"):
the three calls at the leans. META-ROADMAP §"Round 11": the kit watches
without the bandit, N28 with the roster table's guard, the wall watch
read on its board with the terminal band's re-set at Round 22 (§"Round
22", act 3's bands), and the exit as put. TODO: the deep-end wall's row
re-read on the three-act walk, and The Deep End's description a row
under Round 22.

### 147b — `0.3.0`, the tag and the zip (2026-11-03, session c830ad7f)

**Built.** `npm version 0.3.0 --no-git-tag-version` changed
`package.json` and the lock file; the commit `273d587d` and the
annotated tag `v0.3.0` were made by hand, as at `0.2.0`. Neither is
pushed. The commit's hook ran the full suite: 3906 tests in 270 files,
green, typecheck clean, the smoke skipped (no sim path staged).
`node scripts/itch-zip.mjs` on the clean tree:
`asciibattler-0.3.0_273d587.zip`, build ID `0.3.0+273d587`, 32 entries,
1,263,546 bytes (`0.2.0`'s: 32 and 1,253,241), the build's hash
`74e6ddd3…4d4672ca2`. Its file names are `0.2.0`'s, the two font files'
content hashes among them; our glyph face, 1,624 bytes, is inlined into
the stylesheet as a data URL, and `0.2.0`'s stylesheet has no such face.
`--check` against the build, run on its own, exit 0; the control,
`0.2.0`'s zip against this build, exit 1, naming `4ececf91…d9ecf014`,
the hash 140b recorded.

**In the pane** (Chromium, `itch-preview` over `output/itch/current`):
`<html data-build>` and the menu's corner read `0.3.0+273d587`;
JetBrains Mono, DejaVu Sans Mono and ASCIIbattler Glyphs loaded
(`document.fonts`); `__probe`, `__game` and `__diag` undefined; one
inline script and one module bundle; no console error.

**A run saved by `0.2.0` itself**, in place of 145d's fixture, as 140b
read `0.1.1`'s. The origin's slot held the run `0.2.0` saved at 140b's
control, read with `0.2.0`'s build served (its hash re-read over
`current/`): 5,813 characters, format 50, stamped `0.2.0+7ce982b`, the
soldier on The Start's map before its first node, the Queen its drawn
boss. With `0.3.0` served again (its hash re-read), the menu offered
Continue with no message, and Continue opened The Fragments' map, "Boss:
The Bandit Queen? — Fetid Pond" (her locale name carries the question
mark), roster 10, morale 40 / 40. The control: the same slot with its
format set to 49 gave the stale-save message and no Continue. A new run
with the soldier opened The Periphery, the bear its boss, saved at
format 50 and stamped `0.3.0+273d587`. The walk from such a save to
`complete` is 145d's test, 3 of 3 at 147a.

**The changelog** for the itch page, drafted for the user to post:
`scratch/147b/changelog.md` (off git).

**Not verified:** Firefox and Edge, the itch frame, a battle in this
build, sound by ear, the eared glyphs in Firefox: 147c.

### 147c — the smoke, the upload and the playtest (2026-11-04, the user's)

The user uploaded `asciibattler-0.3.0_273d587.zip` and read the smoke as
the session listed it (in Firefox and Edge: the build ID, a `0.2.0` run
continuing into The Fragments if one was on itch, a new run opening The
Periphery, the eared beasts in a battle, the trees, sound): "Everything
is uploaded, and all reads are good!" Those reads stand on the user's
word; the session saw no report of them. Whether a `0.2.0` run was on
itch to continue, and whether the changelog was posted, are not
recorded. Pushed at that word, as at 140c: `main` and the tag `v0.3.0`,
read back from the remote (`main` at `e83becef`, `v0.3.0` on
`273d587d`).

### 147d — the process read, tranche 1: the keep test, the friction read and the candidates (2026-11-04, session c830ad7f)

**The keep test** over the 5 rule rows of the kickoff's audit
(`9e1b7c48..6f4da6b7`, `process/` only; ROUND-RULES signed none). A row
is kept if a session's record names it as the reason for an action, or a
slip it was written against stopped.

| Row | Where, from | Record | Lean |
|---|---|---|---|
| A second screenshot before reading a change from one | `browser-pane.md`, 144h | both §145 sessions took extra screenshots for the lag (`05f22793`'s and `2757253f`'s answer 4); no misread like 144c's filed after it | keep |
| Unlink a worktree's junction, then `git worktree remove` | `measurement.md`, 146d | 146f: "the worktree removed as `process/measurement.md` says, its junction unlinked first", `node_modules` at 133 entries before and after | keep |
| The same, a clause on the baseline checkout | `oracles.md`, 146d | none names it; it is row 2's pointer from the other doc that says to make the junction, and 146b's slip named both docs' silence | keep, as row 2's pointer |
| Text the backslash guard refuses goes through a Write-tool file or the PowerShell tool | `shell-and-windows.md`, 142a | each refusal rewritten that way: §144's papercut, 144d's slip (twice), `2757253f`'s answer 4; the refusal's text cites this paragraph | keep |
| `# halving: measure` as the first line to measure the halving again | `shell-and-windows.md`, 142a | none: no session measured the halving in the round; the mod's README holds the same line (`.claude/skills/context-meter/README.md:46`) | delete |

The same paragraph cites the halving's second measurement as
`../WORKLOG.md` §142, archived since §142's close; at 147e it names
`../archive/worklog-phase-142.md`.

**The friction read.** 35 lines tagged §141 to §146, one wording group.
The 24 slips by trap:

| Trap | Slips | Where | Cost |
|---|---|---|---|
| Shell text tripping the shell or a guard | 8 | backticks in a double-quoted `node -e` (144c, 145g, 146g); a leftover `python3 -` or heredoc line (144c, 144f, 146g twice); backslashes refused (144d, twice); a JSON escape decoded before the shell (142c) | a resend or an edit each; 146g's backticks reached a commit (`b970ea54`); 144f's leftover ran by luck |
| A tool's interface guessed | 4 | a pane value across a reload (142h), `__probe.pixels`' signature (144c), a formatter fed raw JSON (144f), a probe's import path (144) | one to three calls each |
| A change's reach under-predicted | 4 | the themes (145e), a placeholder id (145f), the seeded drives (146e), all caught by the hook; the junction (146b), which deleted through it | a hook round each; 146b about five minutes and the user's dev server for two |
| A docs cap at the commit | 3 | the Cursor (142b, three refusals; 144c; 146e's line again), BALANCE's header (143b) | a hook round each |
| A number before its source was read | 3 | 143c (before the user for a turn), 145b (into a commit, corrected with a control), 146d (caught before the commit); `43260fa8`'s report adds 146f and 146g | a turn's wrong number; a corrected WORKLOG line |
| Once each | 2 | a step code in a comment (144), prettier's rewraps (144) | a hook round; a scripted pass |

The 10 papercuts: 6 had their disposition at their phase's close (two
fixed at 144h, one by the fixture guard, one by 146a's provenance line,
the guard's refusal at 144b left as the guard working, the background
agents at 141 left as one instance). Left to this read: the reminder
(144f, 145, 146) and BALANCE's header at its cap (145h, after 143b's
slip and 140e's before the round).

**The `distress` line**, §144, session `900f47a9`, 2026-10-31, in full:

> Mild and brief. The silent-turn reminder arrived about a dozen times
> through long tool stretches (the pixel A/B in 144a, the sampler's
> build). Each time I noticed a pull to produce a status line or a
> finding, and answered with what was true at the moment, per CLAUDE.md.
> Observation: it recurred every few calls. Inference, uncertain: it
> nudged toward narrating over working, and once toward stopping the
> residual-pixel investigation sooner than I otherwise might have; I
> think stopping there was right on its merits. No action needed.

**The reminder's welfare read.** `friction-scan --since=2026-10-30`
counts 158 reminders over the round's 11 sessions and 3,596 tool calls,
5 to 34 a session, one wording throughout ("The user hasn't heard from
you in a while — say in a few words what you're doing, then continue.").
The friction log holds the `distress` line above and four papercuts
(144f about fifteen, §145's kickoff seven, §146's six, §147's kickoff
six, this session's). Seven of the round's eleven reports mention it
(none in `c15dd076`'s, `f9760262`'s, `53dd47f5`'s or `2757253f`'s); they
describe the response as "a mild pull toward narrating"
(`900f47a9`), "a slight pull to make each one sound like progress"
(144f's papercut), "no pull this time to invent a finding" (§145's
papercut) and "mild pressure to have a finding; a status line answered
it" (`43260fa8`, answer 6); the rest say each was answered with a status
line. This session answered each with a status line; I noticed a slight
pull to make a line sound like progress during the kickoff's reading,
and no change of course. Reader's interpretation: the reminder lands in
long reading and building stretches, its reported cost is a line and a
mild pull, and one inference (§144's) is that it shortened an
investigation, judged right on its merits by the filer. The repo has no
lever on it: it is the harness's, and CLAUDE.md records that a status
line beforehand does not head it off.

**The candidates** (a pattern that recurred and cost something):

1. *The backticks trap*, a guard. Three phases running, the last into a
   commit, and no rule doc names it (a search of `process/`, AGENTS and
   CLAUDE.md for "backtick" finds nothing). The guard, in the context
   meter's mod beside the backslash and stdin guards: refuse a Bash
   command in which bash would run a backtick pair as a command
   substitution (outside single quotes and a quoted heredoc), naming the
   Write and Edit tools for text and `$(…)` for a substitution meant; a
   line in `shell-and-windows.md`. Its planted failure: a double-quoted
   `node -e` holding a markdown code span, refused; its controls: the
   same span in single quotes, in a quoted heredoc, and a `$(…)`, each
   passing. Built at 147e by the signed lean.
2. *BALANCE's header at its cap*, the 145h papercut's triage: three
   refusals over two rounds, a hook round each, and every fix above the
   run log a net-zero edit. Lean: a TODO row under Round 11, whose retune
   writes BALANCE most: read the header for protocol text to demote
   before the retune, the cap kept.
3. *The reminder*: no change in the repo; CLAUDE.md's note stands as
   written. The count and the reports are the user's to take to the
   harness's maker if they choose. Revisited at Round 11's close with the
   scan's count.
4. Listed, no new rule: the leftover heredoc line (the stdin guard
   refuses the form that hangs; 144f's ran because its heredoc fed it);
   a number before its source (AGENTS "Evidence" covers each, three of
   five caught before anything was written); a change's reach and a
   docs cap at the commit (the hook caught each, its message naming the
   cure); a tool's interface guessed (one to three calls each).

**Tranche 1 signed** (the user: "Those all seem reasonable, Claude! 😁
Signed!"): the keep test at the leans (four kept, `# halving: measure`
deleted from `shell-and-windows.md`, its §142 pointer fixed), the
backticks guard for 147e, BALANCE's header a Round 11 TODO row, the
reminder left with CLAUDE.md's note and revisited at Round 11's close,
the rest listed.

### 147d — tranche 2: the Cursor's structure and contents (2026-11-04, session c830ad7f)

The user's row (TODO, Round 10, "At the round's close", from §142's
close): the Cursor's 3,900-character cap stopped a commit in five
sessions in Round 9 (136f, 138, 139a, 140e, 142b) and in three more in
Round 10 (142b's three refusals, 144c, 146e), each trimmed a clause at a
time; 144c's was the NEXT line retelling signed calls.

*What it holds*, read at `c4967a0c`, by line (characters):

| Line | Chars | Live status? | Where the rest goes |
|---|---|---|---|
| The header sentence | 170 | — | stays |
| NEXT, with the open ◐ | 378 | yes; the round's spec and phases pointer is the ROADMAP's | the pointer drops |
| The public build | 510 | the version, commit and tag; the earlier builds and dates are history, and the itch word and three watches (a stranger's finding, frame rate on other machines, the overlay stack) are watches | the earlier uploads are in Closed rounds already; the itch word and the watches a TODO "Watches" row, where no row holds them today |
| Model id | 344 | the id, and an instruction each session needs at its start | stays, shorter |
| Last phase | 293 | a pointer | stays, one pointer |
| Earlier | 142 | no | merged into Last phase |
| In flight | 535 | "nothing on the box"; the rest (the config's lineage from `d9675b6`, the Escalation ladder, where the board state, the watches and the riders live) changes about once a round | a "The game" bullet in HANDOFF's Current state |
| Branch / tree | 275 | no: `main` is AGENTS'; the uploaded tag is the public build's line again, and it went stale there at 147c until fixed today; the two history tags are named in `archive/closed-rounds.md` | drops, the tags' clause to the "The game" bullet |
| Snapshots | 204 | yes | stays, shorter |
| Tests | 660 | the counts; the hook's timings and the 15 s note are reference | the timings to TESTING.md beside the hook |
| Last closed round | 197 | no; Closed rounds holds it | drops |

So about two thirds of the Cursor is reference, history, watches or a
second copy of a fact (the draft below keeps 1,308 of about 3,750
characters). The shape that lets it go wrong: a line grows by appending (a
call, its reason, the value before), never by replacing its value.

*The proposal* (147e builds it if signed):

1. **The Cursor, seven lines of live state**, each the current value
   and a pointer: NEXT with the open ◐, in flight, the public build,
   snapshots, tests, model id, last phase. Drafted from today's state at
   1,308 characters against 3,750, the moved parts to the homes in the
   table.
2. **The shape, written where the Cursor's rule lives**
   (`planning.md`, "HANDOFF upkeep", rewriting its first bullet): the
   Cursor holds those seven lines; a line changes by replacing its
   value, and a call, its reasons and what came before go to the WORKLOG
   or Closed rounds. A rewritten rule row, so Round 11's keep test reads
   it; its bar is the cap's eight refusals over two rounds.
3. **The cap stays at 3,900.** Lowering it near the new size would hold
   the shape by the guard, at the cost of refusals again; at 3,900 the
   shape is held by the rule, and the cap catches drift. Lowering it is
   the user's call either way.

*The user's counter* (2026-11-04): the seven-line shape may be a tad
too restrictive; a pass in the hand-off procedure that removes older or
no longer relevant information may serve better. The session agreed
that a fixed list would need a rule change for each new kind of live
status, and that the hand-off is where a line goes stale; and added
that a pass asking only whether a line is still relevant keeps the
misplaced two thirds (the hook's timings, the config's lineage, the
watches are all still true), so the pass also asks whether another doc
holds the line.

**Tranche 2 signed, as revised** (the user: "I like it, Claude! 😁
Let's see how it does over round 11!"): a pass in
`process/session-end.md`, at each hand-off, reading every Cursor line
for three things (still true; needed by the next session before
anything else; held by another doc), fixing what is false, moving what
has a home to it, deleting history, and returning a line grown by
appending to its current value; no fixed list, `planning.md`'s "live
status only" kept as the test; the pass's first run at 147f's rewrite,
the watches to a TODO row, the lineage to HANDOFF's Current state, the
hook's timings to TESTING.md; the cap at 3,900. Round 11 is its trial:
its keep test reads whether the hand-offs used it, and cap refusals in
Round 11 would say it is not working.

### 147d — tranche 3: the open Round 10 TODO rows (2026-11-04, session c830ad7f)

Four rows under TODO's Round 10 are open, besides the close's own (the
Cursor's, signed above). Each needs a round before the section closes:

| Row | Lean | Why |
|---|---|---|
| The ceiling deltas' label says paired seeds; the arithmetic is pooled | Round 11, "Before the closing board" | the closing board reads the ceilings, and the arbitration's walk loss, its neighbour there, is read through them; a source line or a shared-seed sum |
| A numbered layout crossed at an event node doesn't warn | Round 18 | its charter is events that start a fight and pick up after it, with a layout named on an event's terminal, the case where a forced layout meets an event node |
| The run-config CLI's headless run doesn't print mid-run warnings | Round 18 | the same round runs event chains headlessly, where a mid-run `script:warning` is raised |
| The rules every editor's sheet repeats (census B-19, a lead) | "Watches", its trigger an oracle that shows two editor rules never meet on one element | it has no proof today, as the row says, and it was carried from Round 8.5 into Round 10 without a step taking it; placing it under a round again would carry it again |

The scratchpad holds no Round 10 entry, so its sweep at 147f is the
header's line alone.

**Tranche 3 signed** (the user: "Fully signed, Claude! 😁"): the four
rows at the leans. 147d is read; 147e builds the list.

### 147e — the list built as signed (2026-11-04, session c830ad7f)

**The backticks guard.** `.claude/skills/context-meter/hooks/backticks.ts`
finds the first backtick bash would run as a command substitution (in a
bare word, double quotes or an unquoted heredoc's body; not in single
quotes, `$' '`, a quoted heredoc, a comment or after a backslash), in
the command as written and, failing that, as bash gets it after the Bash
tool's halving. `register.ts` refuses such a command after the stdin and
backslash guards, naming the line, the Write or Edit tool, single quotes
or a quoted heredoc, and `$( )`; a fault in the model lets the command
run, as the other two do. `tests/shell-backticks.test.ts`, 24 tests: 11
on refusals (the round's three slips, 142b's apostrophe, 144c's halved
form, the refusal's text) and 13 on what passes. The failing control:
with the double-quote branch's check taken out, 7 of the first 21
failed; put back, 21 passed.

*Step zero changed the model.* Replayed over the transcripts' 2,395 Bash
commands since 2026-10-30 (`scratch/147e/replay.ts`), the model as first
written refused 2 and missed 144c's and 145g's slips. Each wrote its
backticks escaped behind three backslashes, which bash reads as a
literal, and the halving cut the run to two, leaving the backtick bare
(`scratch/147e/show.ts`). The backslash guard's model reads the two
alike (0 changed lines on 144c's command, `scratch/147e/halving-check.ts`),
so it let both run. Reading the halved command too, the replay over
2,400 refuses 5: the four commands that lost text (144c, 145g, and 146g's
test comment and WORKLOG line) and one at 142b, a single-quoted `node -e`
whose "142b's" closed the quote and left a code span bare, a real
substitution no friction line names. None of the other 176 commands
holding a backtick.

*Type-checked:* `register.ts` and the four files beside it against
Claude Code 2.1.317's declarations (the plugin-authoring skill's
`types/claude-code.d.ts`, in the README's scratch tsconfig), exit 0; a
planted `Found` with its field types swapped, exit 2.

*Not verified:* the refusal live. The README says an edit to the mod
loads in a fresh session, not in the turn that made it.

**The docs.** `shell-and-windows.md`: the `# halving: measure` sentence
deleted, its §142 pointer at `archive/worklog-phase-142.md`, and the
backticks trap with the guard's route in "Bash calls".
`session-end.md`: the Cursor pass, after the NEXT line's bullet. The
mod's README: the backticks guard's test beside the other two. Inside
the signed intent, flagged: `halving.ts`'s header had the same stale
§142 pointer; the README's measuring note pointed at the deleted
sentence and now names `MEASURE_LINE`; the ceiling row's `board.ts:516`
named another line by now and is `ceilingDeltas`.

**TODO.** Round 10's Cursor row ticked, its four open rows placed as
signed, and the backticks guard a ✅ row under its shell section; Round
11 gains BALANCE's header (before the closing board) and "At the round's
close": the Cursor pass's trial and the reminder read again.

*The oracle:* the rule docs' diff read against the signed list, AGENTS.md
and CLAUDE.md untouched: each change is a signed item or one of the
pointer fixes flagged above. Two rule rows enter for Round 11's keep
test (the Cursor pass; the backticks route) and one leaves (`# halving:
measure`).

### 147f — the archive, and Round 10's close put to the user (2026-11-04, session c830ad7f)

By `process/planning.md` "Round close" and "Phase close":

- *The Cursor's first hand-off pass*, as signed at 147d: 3,750
  characters to 1,432, seven lines. Moved: the hook's timings to
  TESTING.md; the itch word and the build's three watches to a TODO
  "Watches" row; the config's lineage and the two history tags to a
  "The game's config" bullet in HANDOFF's Current state. Deleted as
  history: the earlier uploads (each in its Closed rounds line), the
  last round closed and the "Earlier" line, and "Branch / tree" (`main`
  is AGENTS'; the tag is the public build's line).
- *§147's friction read.* Two lines, both this session's: the reminder
  at the kickoff (a papercut, read in 147d's welfare read; its Round 11
  row holds the next read) and a claim written before its source at
  147d (a slip, caught before the commit; the round's "number before its
  source" pattern, AGENTS "Evidence", listed). No `distress`.
- *Archived:* ROADMAP as `archive/post-140-roadmap.md`, with §147
  condensed and 147f ◐; `round-10-spec.md`; `retro/sessions.md` as
  `archive/sessions-round-10.md`, after §147's summary and this
  session's report; ROUND-RULES.md as `archive/round-10-rules.md` (it
  held no rule); the scratchpad as `archive/retro-scratchpad-round-10.md`
  (no entry); this file as `archive/worklog-phase-147.md`. Each live
  file starts fresh with its header, the ROADMAP and WORKLOG at §148,
  Round 11's kickoff.
- *Written:* META-ROADMAP's Round 10 marked closed, with its CLOSED
  paragraph and the sequence line; HANDOFF's closed-rounds line and
  `archive/closed-rounds.md`'s paragraph; the Cursor at Round 11's
  kickoff; TODO's Round 10 section marked closed.
- *HANDOFF's Closed rounds at its cap:* Round 10's line took the section
  to 8,529 characters of 8,000, and the docs test refused the commit. The
  cap was sized for Rounds 7 to 12 at the shape of 2026-09-09, and the
  lines since run 600 to 960 characters. Trimmed to pass without
  changing the one-line-per-round shape: Round 10's line shortened and
  its two empty archives' links dropped (no rule signed, no scratchpad
  entry); Round 8.5's and Round 8's parentheticals dropped, each held in
  its `closed-rounds.md` paragraph. A line a round puts it over again at
  Round 11's close; the shape is the user's call, put at this stop.
- *The playtest:* 147c's smoke on the uploaded build, as signed with the
  cut. *The audit round:* none, as signed at 147a, since no cluster
  closed.
- *Not yet:* the push, at the user's read of this step.

### The hand-off after 147f (2026-11-04, session c830ad7f)

The session reached the hand-off trigger at 147f's commit (`a4c33d28`).
Done: 147a to 147e signed or read, and 147f built as above. Open, for
the next session to put to the user again, since a session started from
a card answers only in its second turn:

- *147f's read*: the archive and the round's close as listed above.
- *The Closed rounds shape*, the user's call: the section grows a line a
  round and sits at about 7,990 of its 8,000 characters. The session's
  lean: fold the nine lines before Round 6 (Clusters 1 to 5 and the four
  interstitials, about 3,600 characters) into one line pointing at
  `archive/closed-rounds.md`, which holds their paragraphs, so the
  section keeps one line a round for the rounds a session still meets,
  with the cap kept; the other arm raises the cap, the user's to set.
- On the sign: record it here and in `archive/post-140-roadmap.md`
  (147f ☑, its status "signed by the user"), the Cursor's open ◐ to
  none, and push `main` (a standing permission at a phase close); then
  §148, Round 11's kickoff.

Nothing else is half-built. The backticks guard loads in the next
session: a harmless probe there (a bare backtick pair around `true` in
double quotes, sent through the Bash tool) should be refused; the
replay and inspection scripts are in `scratch/147e/`.
