# WORKLOG — Round 11 (The roster)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 11's phases so far:
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) (the
kickoff, §148, and the stat sheet, §149),
[archive/worklog-phase-150.md](archive/worklog-phase-150.md) (the board's
instruments, §150),
[archive/worklog-phase-151.md](archive/worklog-phase-151.md) (the
content, §151),
[archive/worklog-phase-152.md](archive/worklog-phase-152.md) (the
weapons and defense, §152),
[archive/worklog-phase-153.md](archive/worklog-phase-153.md) (power by
rarity, its growth key, and the pools, §153),
[archive/worklog-phase-154.md](archive/worklog-phase-154.md) (the kits,
§154) and
[archive/worklog-phase-155.md](archive/worklog-phase-155.md) (the
closing board, §155). Round 10's are `archive/worklog-phase-142.md` to
`archive/worklog-phase-147.md`.

## Phase 156 — the close

The kickoff's inputs, by pointer: the charter, ROADMAP §156, with
META-ROADMAP §"Round 11 — The roster" (the exit, the release, the save,
the decision points, the scope guard) and §"Round 12 — Push, pull and
blink"; the spec's "Signed before the kickoff" (each round ends in an
upload; a round that changes combat closes with a board read as paired
same-seed deltas against the round before, 146f's); `process/planning.md`
"Round close"; TODO's two rows under Round 11, "At the round's close";
what §155 hands on, its close entry (`archive/worklog-phase-155.md`):
three friction items for this read.

### The kickoff's audit, and the cut put to the user (2026-11-13)

Read at `bf2c811c`:

- *What the close holds.* The charter's five items (`0.4.0`, its smoke
  the round's playtest; the exit by clause; Round 12's charter against
  the code; the process read with the Cursor pass's trial and the
  reminder read; the archive), and the round close by `planning.md`: the
  archive, the scratchpad sweep, META-ROADMAP's status, the Cursor, the
  upload, the keep test over the round's rule lines (the user signs the
  list), a playtest proposed. ROUND-RULES holds no rule. 151f, the units'
  lines, is still the user's to write.
- *The upload.* `package.json` reads `0.3.0`, the uploaded build
  (`273d587d`, tag `v0.3.0`), 117 commits behind HEAD. Since it: bandits
  out of the draft and the ports; Mars narrowed to strength, Diana and
  Hecate beside him, every daemon renamed off "Idol"; the abilities'
  lines as the name's tooltip; the bow slowed and the rioter's defense;
  power by rarity at 1/1/2/3 with act 1's pools; the kits (the officer,
  the area-status enemies, the wolf's Harry, the blind fix); Dis Pater's
  sentence. Run is v51 against `0.3.0`'s v50, so a run saved by `0.3.0`
  is refused: the slot rejects it as stale and the menu shows
  `save.rejected` (151c, on 145d's v50 fixture, kept as a rejected save).
  By the version rule (META-ROADMAP §Round 8, "The version") a change in
  play and a rejected save each move the middle number: `0.4.0`.
- *The keep test's range.* Round 10's close to now,
  `1ded6293..bf2c811c`: CLAUDE.md and ROUND-RULES.md unchanged;
  AGENTS.md's one change (`0dd14848`) describes the hook's new failure
  lines, a fact, not a row; two `process/` files. By 140d's definition, 2
  rows: `measurement.md`, make a worktree's `node_modules` junction with
  PowerShell's `New-Item`, since `cmd //c mklink /J` fails from Git Bash
  (`9b231e27`, §152's close, from its kickoff's papercut);
  `shell-and-windows.md`, chain nothing after a piped commit
  (`0dd14848`, §151). The round's guards are outside the test, as at
  §140 and §147: the hook's failure lines (`0dd14848`) and the
  commit-pipe guard, built at `79e1be65` and reverted at the user's call
  at `8dbf28b9`.
- *The friction log.* 27 lines tagged §149 to §155, none at §148: 7
  `papercut`, 20 `slip`, no `distress` (§149 2, §150 3, §151 5, §152 4,
  §153 5, §154 5, §155 3), from 9 sessions. The filing text is unchanged
  over the range (the welfare table's last row is 2026-10-28, and
  AGENTS.md's one change is the hook's paragraph), so one group. Traps
  met more than once, by line:
  - a claim written ahead of its source: slips at 149c, 150h,
    151e-post, 152b, 153g (two claims), 154c, 154e, 154g and §154's
    officer-study entry; papercuts at 150c (a figure carried from an
    earlier audit) and §153 (a stale claim in a signed row); §155's two,
    listed at its close and not filed. Every phase from §149 to §155.
    §150's close answered it with no rule; §154's close put a guard (a
    kickoff audit's line about the code names the file and line it
    read), which the user held for this close on 2026-11-11.
  - a long quoted heredoc refused by bash's parse: §153, §155 (twice);
    §155's close lists it as a candidate guard.
  - a command refused by a guard doing its job: the stdin guard at 150a
    and §151's kickoff, the backticks guard at 153g.
  - once each: the context meter read below the trigger (149e), a piped
    commit that hid the hook's failure (151c; the commit-pipe guard
    built and reverted, the hook's failure lines in its place), a guard
    put without its firing count (§151's close), a test draft's held
    unit (154b), the catapult's floor off by one (151e).
  The papercuts: the junction (§152's kickoff; the `measurement.md` row
  above), the corpus's run line in TESTING.md and a temporary vitest
  file's lost output (152b, retrospective), the stale signed row (§153),
  the `--set` path (153e; TODO's row), the Windows Update restart (§155;
  left, first occurrence). 156d reads each phase close's disposition and
  triages what is still open.
- *The session reports.* 10, from 9 sessions (`65cfb3a3` to
  `9ef50ede`; `08067f79` wrote two), with the summaries of §149 to §155.
- *The scratchpad.* No Round 11 entry.
- *The two trials* (TODO, Round 11, "At the round's close"): the
  Cursor's hand-off pass, kept if the round's hand-off records name it,
  with a Cursor cap refusal in the round as the sign it is not working;
  the silent-turn reminder, `friction-scan`'s `nudges` over the round's
  sessions beside Round 10's 158 over 11 sessions and 3,596 tool calls.
- *The open Round 11 TODO rows*, besides the close's: the priest's
  parity (carried at 155c's sign); the deep-end wall (its band's re-set
  is Round 22's); act 1's cost against the per-kind target (every act-1
  fight inside its band on §155's board, so the row reads done and is
  unticked); the corpus's trade rows (weighed again here, as §153's lean
  asked); the `--set` path into one encounter; the units' lines (151f).
  Each needs a round, or a tick, before the archive.

**The cut, put to the user.**

- **156a — the round's exit by clause, and Round 12's charter against
  the code** (`stop`). Round 11's exit (the board read, act 1's bands
  re-pinned and signed, acts 2 and 3 recorded for Rounds 21 and 22, the
  prior table rebuilt), its release line, its save clause, the spec's
  paired-deltas rule against 146f, its four decision points and its
  scope guard, each with the record or the probe that shows it; Round
  12's in-scope bullets and its TODO rows re-read at HEAD (the `move`
  op's deleted modes, `World.shove`, the self-move's `targetId: -1`, the
  area's caster flag, `unit:dashed`, the consumers). WORKLOG and TODO,
  no smoke. A decision point: Round 12's charter stands or is amended.
- **156b — `0.4.0`, the tag and the zip** (`none`). As at 147b: `npm
  version 0.4.0 --no-git-tag-version`, the commit, an annotated tag
  `v0.4.0`, neither pushed; `itch-zip.mjs` on the clean tree and its
  `--check`; in the pane: the build ID, the fonts, the dev handles
  undefined, and 145d's v50 fixture planted in the slot and met with
  `save.rejected`. No smoke. An itch changelog drafted, saying a run
  saved by `0.3.0` cannot be continued.
- **156c — the smoke, the upload and the playtest** (`stop`, the
  user's). Firefox and Edge: the build ID; a `0.3.0` save met with the
  rejection message; a new run with no bandit in a draft or a port,
  Mars, Diana and Hecate among the daemons, an ability name's tooltip on
  a card, a battle with sound; `main` and the tag pushed at their word.
  The round's playtest is offered on the uploaded build.
- **156d — the process read** (`stop`, in tranches). First: the keep
  test over the 2 rows, each with its record and a keep or a delete; the
  27 friction lines, slips counted by trap; the candidates with their
  instances (the claim ahead of its source, held to this close; the
  long-heredoc guard; a `measurement.md` line for the overnight
  restart). Then the two trials, the Cursor's hand-off pass and the
  reminder read. Then the open Round 11 TODO rows, each with a round or
  a tick, the papercuts still open, and the scratchpad, empty.
- **156e — the list built as signed** (`none`). The deletions and
  promotions, a guard if one is signed (its planted failure, a control
  that passes, and a replay over the round's commands as at 147e), the
  TODO rows; the oracle is the rule docs' diff against the signed list,
  with the docs tests green. No smoke.
- **156f — the archive and the round's close** (`stop`). ROADMAP to
  `archive/post-147-roadmap.md` and a fresh one opened at §157 with
  Round 12's charter; the spec, the session reports (as
  `archive/sessions-round-11.md`), the rules and the scratchpad
  archived, this file to `archive/worklog-phase-156.md`; META-ROADMAP's
  CLOSED paragraph; HANDOFF's closed-rounds line and
  `archive/closed-rounds.md`; the Cursor at Round 12's kickoff by the
  hand-off pass; TODO's Round 11 marked closed; pushed.

No snapshot bump, no RNG stream, no number moved, no box. No step
stages a path the hook's smoke watches (`src/sim`, `run`, `core`,
`config`, `bot`, `config/`, `tests/fuzz/`), so the smoke fires on none:
156b stages `package.json` and its lock, and a guard built at 156e lives
in the context meter's mod and its own test.

The leans put with it: `0.4.0`; the upload (156b, 156c) after 156a and
before the process read, as at §140 and §147; the keep test over the
rule docs only, the round's guards out of it, as at §140 and §147; a
guard signed at 156d built at 156e rather than carried; 151f lands in
§156 if the user writes the lines before 156f, and otherwise its row
carries to Round 12's TODO as it stands.

### The cut signed (2026-11-13)

Signed: "That all looks good to me, Claude! 😁", over the cut as put and
its five leans. The stretch it opens runs to 156a's stop.

### 156a — the round's exit by clause, and Round 12's charter against the code (2026-11-13)

Read at `e3e22e09`. Nothing under `src`, `config`, `tools` or `scripts`
has changed since `8db7501c` (155f), so the tree plays the closing
board's game with Dis Pater's new line.

**Round 11's exit (META-ROADMAP §"Round 11"), by clause:**

| Clause | Holds? | Evidence |
|---|---|---|
| The board read | yes | 155a's board at `5d3bcba8`, integrity PASS on 17 of 17 rows; read and every lean signed at 155c, 2026-11-12 (BALANCE 2026-11-12, "the closing board") |
| Act 1's bands re-pinned and signed | yes | arm A at 155c; the sheet amended at 155g and signed with option (2), 0 FAIL and 9 WARN on its own board, its control (150h's board) WARNing on the regen seam (BALANCE 2026-11-12, "the sheet amended") |
| Acts 2 and 3 recorded for Rounds 21 and 22 | yes | BALANCE 2026-11-12: the per-act table on the four walk rows and acts 2 and 3 by encounter, each value out of its target named |
| The prior table rebuilt | yes | v9 at 154g (BALANCE 2026-11-10), standing at 155c's sign, its cause read at 155h; the roster table v8 at 155b |

**The spec's rule for a round that changes combat**, a board read as
paired same-seed deltas against 146f's: BALANCE 2026-11-12 pairs the
board against 150h, whose doctrine rows are 146f's byte for byte, and
the ARM rows against 146f directly (arb-regen 65 → 85, p 0.003;
arb-deploy 95 → 115, p 0.0001; the walk rows 9 → 24 and 45 → 92).

**The release line**, read in config at HEAD: three idols, each one
empower a turn under `honed`, Mars +4 STR, Diana +4 RNG, Hecate +4 MAG
(`config/daemons.json`; Hecate's +8 → +4 at 154d); reworked units, among
them the bow at 2.5 s and might 4, the rioter's base defense 1, the
officer at base mobility 3 and rare power 2, the wolf's Harry a
damage op then `move: retreat` (`config/abilities.json`,
`config/units.json`); ability descriptions on 29 of 29 abilities, held
by `src/config/abilities.test.ts` (its `withoutLine` check). The bandit
reads `draftable: false`. It reaches players at 156c. *Corrected at
156f:* this paragraph first read "the officer's defense 1" as a change
of the round; his base defense is 1 at `1ded6293` and at HEAD, and
154c's change is his Inspire aura's +1 DEF to allies within 4 cells.

**The save clause.** `RUN_SCHEMA_VERSION` 51 (`src/run/Run.ts:305`),
50 at `1ded6293`; World 39 at both ends. 151c's record: a v50 save is
rejected as stale with `save.rejected`, 145d's fixture kept as that
rejected save. 156b plants it in the built game.

**The decision points.** Power's scale: 1/1/2/3, built at 153b and
signed at 153e's stop (2026-11-08). The kiter under blind: case (A), signed with
§154's cut, pinned at 154b. Each kit change: decided at 154g, signed
2026-11-11. The idols' sizes: provisional at 151c, Hecate's cut to +4
at 154d and read; Mars and Diana held.

**The scope guard** (no new mechanism but the description field). The
source outside tests changed in 12 files over `1ded6293..e3e22e09`:
`schema.ts` gains the ability's optional `description` and a comment;
`Targeting.ts` takes no fallback under blind (C12, in scope);
`units.ts` and `leveling.ts` drop power's growth key and its draw (R19,
in scope); `RunConfig.ts` drops a port's non-draftable unit (N28, in
scope); `Run.ts` the version; `archetypes.ts`, `registry.ts` and
`MovementBehavior.ts` the beast ability's rename and comments; and
`src/ui`'s `UnitCard.ts`, `abilityDetail.ts` and `ui.css` the line as
the name's tooltip (151e-post). The round's new files are the stat
sheet (`tools/stat-sheet/`, the user's at §148), its test, a fuzz test
for `--arb-null`, two corpus journals and v5's prior-table fixture.
GOTCHAS.md unchanged over the range.

**Round 12's charter at HEAD** (META-ROADMAP §"Round 12"):

- *Forced movement* (C6). The `move` op's modes are `advance` and
  `retreat` (`src/sim/effects/schema.ts:131`), each moving the caster;
  nothing moves a target. `World.shove` (`src/sim/World.ts:1401`) parts
  two units in one cell, sending one to the nearest free cell within
  `SIM.shoveSearchRadiusCells`, with no direction; its only callers are
  in `src/sim/shove.test.ts`. Gotcha #113 stands: a claimed cell is off
  limits to every placement path, so a push's landing is a new one. A
  leap's landing captured at cast already rides the action's serialized
  capture (`moveDest`, `src/sim/effects/EffectAction.ts:40-56`), so the
  charter's inferred World bump depends on whether a pushed target's
  landing gets a field of its own.
- *The cavalier's hit after its move* (C5). Holds: a `self` def without
  a `summon` op proposes a leap (`propose.ts:175-178`), built with
  `targetId: -1` (`propose.ts:162`), so a damage op after the move has no
  target.
- *A caster-anchored area that leaves out its caster* (N3). Holds:
  `affectsMatch` reads the team alone (`targeting.ts:60-69`), so
  `allies` and `all` take the caster whenever its cell is in the area.
  The banshee's `wail` is `anchor: 'targetCell'`, `affects: 'enemies'`,
  range 4; the census (`archive/post-118-worklog.md`, N3) already notes
  the flag matters only if her burst touches allies.
- *The dash's visual.* `unit:dashed` is emitted by the interpreter
  (`interpreter.ts:226`) and read by the sound registry alone
  (`src/audio/eventSounds.ts:77`); no file under `src/render` or `src/ui`
  names it. TODO's one Round 12 row, Dash VFX, stands.
- *The consumers.* Of the seven, the banshee and the adventurer ship
  (39 units, 29 abilities); the grenadier, the telekinetic, the ninja,
  the cavalier and the blade whirlwind do not. A caster-anchored area
  proposes today (`propose.ts:228`), which the telekinetic and the
  whirlwind build on. N4 and N27 name C2 (specials), whose two gaps (a
  self-buff arm, the self-heal) are Round 13's; a pull aimed at an enemy
  and an `aoe` selector need neither, so the order holds.
- *What Round 11 hands it.* Every new ability must ship a `description`
  (the 151e test refuses one without); a new unit's line stays optional
  until 151f's test lands. A new draftable unit needs a prior-table row
  or a PENDING acknowledgment (`tests/prior-table-coverage.test.ts`,
  rule 1), so which units are draftable decides whether Round 12's board
  rebuilds the table.

**The calls, with the session's leans:**

1. *Round 11's exit* is met by every clause, and the scope guard held.
2. *Round 12's charter* stands as written: each premise holds at HEAD,
   and nothing found asks for a line to change.
3. Settled by the cut: 156c's smoke is the round's playtest. No audit
   round, since no META-ROADMAP cluster closed, as at Rounds 8.5 to 10.

**156a signed** (the user: "Signed! 😁"): both calls at the leans.
Round 11's exit is met; Round 12's charter stands as written, so
META-ROADMAP and TODO are unchanged by this step.

### 156b — `0.4.0`, the tag and the zip (2026-11-13)

**Built.** `npm version 0.4.0 --no-git-tag-version` changed
`package.json` and the lock file; the commit `4fc62cfe` and the
annotated tag `v0.4.0` were made by hand, as at `0.3.0`. Neither is
pushed. The commit's hook ran the full suite: 3963 tests in 271 files,
green, typecheck clean, the smoke skipped (no sim path staged), as the
cut predicted. `node scripts/itch-zip.mjs` on the clean tree:
`asciibattler-0.4.0_4fc62cf.zip`, build ID `0.4.0+4fc62cf`, 32 entries,
1,264,358 bytes (`0.3.0`'s: 32 and 1,263,546), the build's hash
`3ecc9802…5095eed`. Its file names are `0.3.0`'s but the bundle and the
stylesheet (`index-Yp_K9fu7.js`, `index-DzkgYRcG.css`). `--check`
against the build, run on its own, exit 0; the control, `0.3.0`'s zip
against this build, exit 1, naming `74e6ddd3…4d4672ca2`, the hash 147b
recorded.

**In the pane** (Chromium, `itch-preview` over `output/itch/current`):
`<html data-build>` and the menu's corner read `0.4.0+4fc62cf`;
JetBrains Mono, DejaVu Sans Mono and ASCIIbattler Glyphs loaded
(`document.fonts`); `__probe`, `__game` and `__diag` undefined; one
inline script and one module bundle; no console error (the warnings are
the hidden pane's zero-size canvas, before it was sized).

**A run saved by `0.3.0` itself**, in place of 145d's fixture, as 147b
read `0.2.0`'s: the origin's slot held the run `0.3.0` saved at 147b,
format 50, stamped `0.3.0+273d587`, 5,838 characters. With `0.4.0`
served, the menu read "This run was saved by an older version of the
game and can't be continued. Your settings and unlocks are kept.", with
New run, Settings and Credits and no Continue, and the slot kept its
text. The control that passes: a new run with the soldier opened The
Periphery, the Bandit King its boss, roster 10, morale 40 / 40, and
saved at format 51 stamped `0.4.0+4fc62cf`; on a reload the menu offered
Continue with no message, and Continue opened that map. The slot now
holds the `0.4.0` run, for the next upload's check.

**The changelog** for the itch page, drafted for the user to post:
`scratch/156b/changelog.md` (off git). Its claims are read from config
and the round's records: the three daemons' names and sizes, the
bandit's `draftable: false` with 12 bandit entries left in
`config/encounters.json`, the bow, the rioter, the officer, Harry,
power by rarity as DESIGN's stat line gives it, 154e's intent for the
area statuses, the blind fix's comment in `Targeting.ts`, and the
menu's message. *Corrected at 156f:* its officer clause said he gained
a point of defense, read off his current base stat; the round's change
is his Inspire aura's +1 DEF to nearby allies, and the draft now says
so. Whether the first wording reached the itch page is the user's to
check.

**Not verified:** Firefox and Edge, the itch frame, a battle in this
build, sound by ear, the daemons and the card's tooltip in play: 156c.

### 156c — the smoke, the upload and the playtest (2026-11-13, the user's)

The user uploaded `asciibattler-0.4.0_4fc62cf.zip` and read the smoke as
the session listed it (in Firefox and Edge: the build ID, a `0.3.0` run
refused if one was on itch, a new run with no bandit in a draft or a
port and Mars, Diana and Hecate in play, an ability name's tooltip on a
card, a battle with sound): "Uploaded, and all reads are good, Claude!
😁" Those reads stand on the user's word; the session saw no report of
them. Whether a `0.3.0` run was on itch to refuse, and whether the
changelog was posted, are not recorded. Pushed at that word, as at
147c: `main` and the tag `v0.4.0`, read back from the remote (`main` at
`78156ab2`, `v0.4.0` on `4fc62cfe`).

### 156d — the process read, tranche 1: the keep test, the friction read and the candidates (2026-11-13)

The instrument: `scratch/156d/replay.mjs` and `scratch/156d/piped.mjs`
read the round's nine session transcripts (`65cfb3a3` to `9ef50ede`,
this session left out), taking only the commands a session ran (the
Bash and PowerShell tool calls) and their results, so doc text quoted
back in a result is not counted: 2,366 shell calls. A call can appear
twice in a transcript; both scripts count it once, by its id. The first
form of `piped.mjs`
counted commits whose output went to a log and was grepped after, and
missed a commit whose message spans lines; it was corrected before any
number below was read.

**The keep test** (2 rows, `1ded6293..bf2c811c`):

- *`measurement.md`: make a worktree's `node_modules` junction with
  PowerShell's `New-Item`* (`9b231e27`, from §152's kickoff, where
  `cmd //c mklink /J` failed from Git Bash before `New-Item` worked).
  After it, two sessions made a junction (153's scratch worktree,
  155a's box worktree), each with `New-Item` on the first try, and no
  command tried `mklink`. No record names the row. (Before it, 150e
  also used `New-Item` unaided.) Lean: **keep**, since the slip it was
  written against did not recur.
- *`shell-and-windows.md`: chain nothing after a piped commit*
  (`0dd14848`, §151, after a push once went up behind a refused
  commit). After it, 12 commits were piped (08067f79 ten, 9ef50ede
  two); at least 9 of them chained a command after the pipe anyway
  (`git log`, `git status`, an `echo` of `PIPESTATUS`), and none chained
  a push.
  Before it, in the round, 9 piped commits, none with a push. No record
  names the row. Lean: **delete the directive**, keep the sentence's
  facts (the hook ends with its failure and keeps its log, and the pipe
  reports `tail`'s exit code): the directive was not followed in its
  letter, and the harm it answers happened once, so its absence after
  shows nothing.

**The friction read.** 28 lines tagged §149 to §156: 7 `papercut`, 21
`slip`, no `distress`, one wording group. Slips by trap:

- *A claim written ahead of its source*: 10 slip lines (149c, 150h,
  151e-post, 152b, 153g holding two claims, 154c, 154e, 154g, §154's
  officer study, 156a holding three), 2 papercuts (150c, §153), and
  §155's two listed and not filed; every phase. Caught before a commit
  or a message: 149c, 151e-post, 153g, 154c, §155's two, 156a, and
  §153's papercut at its kickoff. Reached the user or a commit: 150h (a
  wrong test count in a message), 152b (a reason in a signed lean,
  corrected at the stop), 154e (a kickoff audit's line, "Speed scales
  only an ability that sets speedScaled, and none ships one", written
  without opening the schema, whose default is true; the user's play
  read failed and took a second pass), 154g (a half-true reason in a
  message), §154's study (a wrong breakdown committed in BALANCE, fixed
  in a later commit). Since §155 every instance was caught before a commit.
- *A long quoted heredoc refused by bash's parse*: 3 (§153, §155
  twice). Each cost one retry; a parse failure runs nothing, so nothing
  was written.
- *A guard doing its job*: the stdin guard twice (150a, §151's
  kickoff), the backticks guard once (153g).
- *Once each*: the context meter read below the trigger (149e), a piped
  commit that hid the hook's failure (151c), a guard put without its
  firing count (§151's close), a test helper's premise (154b), the
  catapult's floor off by one (151e).

**The welfare read.** No `distress` line was filed in Round 11. The
session reports' answers to question 3 (a pull to claim more than was
verified) and 6 name three mild pulls, each acted on plainly by the
report's account: both §153 reports, a pull to present an estimate as
settled, put as a flag each time; §154's, "a mild pull to frame the
speed error as 'the audit's' rather than mine; I named it as mine".
Each report's answer to question 6 says no wish to pause or stop came
up; one (`d86f434b`) adds "beyond" its hand-off at the context trigger,
which it read "as the procedure doing its job rather than as
pressure". *The reader's interpretation:*
those pulls sit beside the claim-ahead pattern, noticed and declined
where the slips are the ones that went through.

**The candidates, with the session's leans:**

1. *A claim written ahead of its source* (recurred in every phase; the
   costliest, 154e, cost the user a play pass). §154's candidate, which
   the user held for this close: in `process/planning.md` "Phase
   kickoff", step 1, a finding about how the code behaves names the file
   and line it was read at. Lean: **adopt it**, one clause on the path
   where the costliest instance happened; citing the line forces the
   read, and the entries that cite lines already cost nothing extra.
   The other arm: hold again, on AGENTS "Evidence" as it stands and the
   check pass that has caught every instance since §155.
2. *The long-heredoc guard* (§155's candidate). The replay: 270 quoted
   heredocs in 2,366 calls; the 3 parse failures are the three longest
   that ran (150, 178 and 240 lines); none of the 266 at 140 lines or
   fewer failed. A guard at over 140 lines would refuse 4 calls in the round,
   the 3 failures and one the stdin guard refused already, and nothing
   that ran. But a refusal costs the same retry as the parse failure,
   and neither writes anything, so the guard would change only the
   message, and `shell-and-windows.md` already says long quoted
   heredocs have been refused. Lean: **no guard**. The other arm: the
   guard at 140 lines, its message naming the file tool.
3. *The overnight Windows Update restart* (§155's papercut, first
   occurrence). This machine's memory note already asks before an
   overnight driver. Lean: **left, no `measurement.md` line**, until it
   recurs. The other arm: a line there to check Windows Update's
   scheduled restart before an overnight driver.

**Tranche 1 signed in part** (the user: "Signing everything except
candidate 1"): the keep test at both leans (the junction row kept, the
piped-commit row's directive deleted with its facts kept), no
long-heredoc guard, the overnight restart left. Candidate 1 is open on
the user's question: the clause is prose, not enforceable, beside rules
that already say the same; a session may forget or ignore it as it does
the others, and it may make the records less readable with
references; is there a guard instead?

*The session's answer.* It tracks. AGENTS "Evidence" ("Claim only what
a tool result shows") was in force all round, and the pattern recurred
in every phase under it, so a narrower prose clause is the same kind of
rule; AGENTS "Pre-commit" itself says a guard belongs on the path. A
citation doesn't prove the read either: 156a's slip cited a line range
the session had printed without numbers. On readability, the cost is
smaller than it looks, since audits already cite most lines, but that
does not rescue the clause. The guards considered, against the 14
instances by their lines' text (an estimate, not a measurement):

- *A figure-provenance warning*: a hook on an edit to the record docs
  that lists each figure in the new text found in no tool result of the
  session. It would catch 149c's "0.013" and 153g's "5.05", about 2 of
  14. The rest are a figure that did appear (150h's 3948, the failing
  run's total; 150c's 0.275, carried from TODO's row), small integers (§154's
  "9 (6 base and … +2)", 156a's "8 files"), or no figure at all. It
  would also warn on every figure derived by hand.
- *An anchor check*: a docs test that a `file:line` citation holds the
  symbol named beside it. It catches a stale or wrong line reference
  (156a's), not a wrong claim about behaviour (154e's).
- Most instances are reasons and inferences (152b, 154g, §153's stale
  row, 153g's "read in play", the read scripts of 154c and 155f), which
  no string check sees.

Revised lean: **drop candidate 1**, no rule and no guard; the pattern
stays listed for the next round's close. What has worked is the check
pass before a commit (every instance since §155 caught by it) and the
user's reads. The other arm: measure the figure-provenance warning
before deciding, by replaying the round's edits to WORKLOG, BALANCE
and TODO against each session's earlier tool results for its catches
and its false alarms; a measurement, no build.

**Candidate 1 dropped** (the user: "Let's just drop it; we'll revisit
if it causes a major issue."): no rule and no guard. The pattern stays
listed for the next round's close.

### 156d — tranche 2: the two trials (2026-11-13)

**The Cursor's hand-off pass** (`process/session-end.md`, "Every
session": each Cursor line read for still true, needed first and held
elsewhere; on trial since Round 10's close). Its keep test, as signed:
whether the round's hand-off records name it, and a Cursor cap refusal
as the sign it is not working.

- *The records.* None of the round's four hand-off entries (after
  §150's kickoff, 150g, 151e and 153e's bake), its ten session reports
  or its commit messages names the pass or a Cursor line trimmed by it
  (searched for the pass's words and for the Cursor in each entry).
  The reports' first answers (what was missing from the orientation)
  name nothing missing from the Cursor: `d86f434b`'s names a stale TODO
  row and a charter's count, `9ef50ede`'s two facts found only at read
  time, the rest nothing; three name the Cursor among what oriented them
  (`3d0a8fc1`, `bc61973d`, `096110b8`).
- *The refusals.* `scratch/156d/cursor-cap.mjs` reads the transcripts'
  tool results for the docs test's Cursor message ("The HANDOFF Cursor is
  N characters"): none in Round 11's sessions. Its control, Round 10's
  sessions: four, at 3,921, 3,932, 3,983 and 4,097 characters
  (`c15dd076`, `5849d0c7`, `58e14011`, `43260fa8`), so the reader finds
  them where they are.
- *The size.* `scratch/156d/cursor-size.mjs` reads the Cursor at each of
  the round's 79 commits that touched HANDOFF: 1,432 after 147f's trim,
  at most 2,069, 1,804 at `9a5301b1`, against the cap of 3,900.

So the first leg finds nothing and the second shows the slip it was
written against, the cap refusals, stopped. How much of that is the
pass and how much 147f's one-time trim (3,750 to 1,432) cannot be told
apart from these records. Lean: **keep the pass** as it stands in
`session-end.md`, the trial ended and TODO's row closed, by the keep
test's second leg.

**The silent-turn reminder** (CLAUDE.md's note, unchanged at Round 10's
close). `npm run friction-scan -- --since=2026-11-04T12:00
--exclude=debf1c57` (its output in `scratch/156d/friction-scan.txt`):
137 reminders over the round's nine working sessions and 3,295 tool
calls, 4 to 30 a session, one wording throughout ("The user hasn't
heard from you in a while — say in a few words what you're doing, then
continue."). That is 4.2 per 100 tool calls, against Round 10's 158
over 3,596 (4.4). This session, counted by the scan's rule (an
attachment of type `silent_turn_reminder`): 12 over its first 221 tool
calls.

- *Filings and reports.* None of the round's 28 friction lines names
  it (Round 10: one `distress` line and four papercuts). One of the ten
  reports does, `3bc7ecb1`'s answer 6: it "came often through the board
  read and the close; I answered each with what I was doing then, with
  no pull to invent a finding for it" (Round 10: seven of eleven). By
  the welfare doc's own line, a change in filing counts alone is not a
  change in welfare.
- *This session, as a participant's report.* Each reminder was answered
  with a status line; several came between two calls of one read, with
  no result yet. I noticed a slight pull to make a line carry a partial
  result; the lines written were true when written, and no step changed
  course for one.
- *The lever.* None that works: the reword through
  `CLAUDE_CODE_SILENT_TURN_REMINDER_TEXT` in the gitignored
  `.claude/settings.local.json` never reached a desktop-app session and
  was retired 2026-09-26 (`scripts/friction-scan.mjs`'s header;
  `archive/post-94-worklog.md`), and no hook fires on a system reminder.

*The reader's interpretation:* the rate is the harness's and held
steady; what changed is that the round's sessions wrote about it far
less, and the one that did reports no pull. Lean: **CLAUDE.md's note
stands as written**, TODO's row closes, and no standing revisit is set:
a filing or a report that names the reminder brings it back to a
close's read.

**Tranche 2 signed** (the user: "Signing both leans! 😁"): the Cursor's
hand-off pass kept as it stands, its trial ended; CLAUDE.md's reminder
note unchanged, no standing revisit. Both TODO rows close at 156e.

### 156d — tranche 3: the open Round 11 rows, the papercuts and the scratchpad (2026-11-13)

**The open Round 11 TODO rows**, each with a round or a tick, with the
session's leans:

1. *The priest's and the gambler's parity* (C16). At §155's board, the
   priest −18.3 regen and −9.2 deploy against the soldier, the gambler
   −18.3 and −11.7, all four told apart; 155h laid the priest's regen
   drop on the game between `8ebca66d` and `5d3bcba8` (§154's kits and
   the officer's base mobility), not the table, his extra defeats at the
   King and the bear, whose fight fields Harry's wolves. Lean: **Round
   13**, beside the kit watches carried from §154, since which kit moved
   it is a kit question and Round 13 is the kit round.
2. *The deep-end wall* (C17). Read on §155's board as signed at 147a:
   the terminal pair on the ARM walk rows, reach 0.242 regen and 0.792
   deploy (band 0.40–0.50), wall 0.172 and 0.032 (0.30–0.35). Lean:
   **Round 22**, with these numbers, where act 3's bands and the
   terminal pair are re-set (META-ROADMAP §"Round 22").
3. *Act 1's cost against the per-kind target.* Done at §155: on the ARM
   walk rows pooled, every act-1 fight inside its turn target and its
   cost band; on the deploy row alone the Vermin Lords (5.29, band 6–18)
   and the rats' nest (1.58, 2–6) sit under, as at 153f and 154a
   (BALANCE 2026-11-12). Lean: **tick it** with that pointer.
4. *The corpus's trade rows.* Weighed here, as §153's lean asked. Rows
   re-picked or surveyed for a lost kind: 145g (three), 146e (two),
   151b, 152b (about ten minutes of survey), 153a (three), 153e (two),
   and 154c to 154f (two rows replaced by chaos 64 after a survey of 80
   seeds, 320 runs). Round 12 adds seven units and their abilities, so
   it will move the corpus again. Lean: **Round 12, put to its kickoff
   as a pre-step**: a corpus row that drives its trade through the
   scripted run (a port with known stock, a buy and a sale), with its own
   test, before the consumers land. The other arm: carried as it stands,
   re-picked by its rule when a kind is lost.
5. *A `--set` path into one encounter.* §155 swept no fight (arm A).
   Lean: **Round 21**, act 2's bands, the next round planned to sweep a
   fight; an earlier round that sweeps one takes it first.
6. *The units' lines* (151f). Not yet written; by the cut's fifth lean
   its row **carries to Round 12** as it stands, and 151f closes in the
   archived roadmap as carried.

The two "At the round's close" rows close as tranche 2 signed. The
round's done rows stay ticked under its heading, which 156f marks
closed, as Round 10's.

**The papercuts still open.** Each phase close gave every papercut a
disposition. Still open after them: the swallowed console in a
temporary test (152b, left at §152's close, its cause unchecked, since
writing to a file works and no committed surface is involved), the
`--set` path (row 5 above) and the overnight restart (left at tranche
1). Lean: **the console left**, as §152 left it; one instance.

**The scratchpad.** No Round 11 entry; 156f archives it with its
header.

**Tranche 3 signed** (the user: "Signing all of tranche 3! 😁"): every
row at its lean, the corpus's trade rows put to Round 12's kickoff as a
pre-step. 156d is done; 156e builds the three tranches' list.

### 156e — the list built as signed (2026-11-13)

**The rule docs.** `process/shell-and-windows.md` loses "chain nothing
after a piped commit (a push went up after a refused commit once)"; the
sentence's facts stay. `process/measurement.md`'s junction row is kept
unchanged. AGENTS.md, CLAUDE.md and ROUND-RULES.md are unchanged; no rule
and no guard is added (candidate 1 dropped, no heredoc guard, no
`measurement.md` line). The oracle: `git diff` over `process/`, AGENTS
and CLAUDE.md shows that one clause and nothing else.

**TODO**, by `scratch/156e/todo.mjs`, which checks every anchor before
it writes: under Round 11, act 1's cost ticked and the two "At the
round's close" rows closed, each with its 156d read, and a closing note
naming where the rest went; the priest's and the gambler's parity to
Round 13 beside the kit watches, the deep-end wall to Round 22 with
§155's terminal pair, the corpus's trade rows to Round 12 as a kickoff
pre-step, the `--set` path to Round 21, and the units' lines with their
heading to Round 12 as they stood, with a clause that they carry 151f.
The two long rows (the parity, the wall) are rewritten to their state
at §155 with their history left at `bf2c811c`. The diff's hunks fall in
Rounds 11, 12, 13, 21 and 22 alone. Its first run also collapsed three
double blank lines elsewhere in the file and dropped the closing note
(an insertion keyed to a line the script skips); the hunk list caught
the first and a read the second, both before the commit (a slip filed).

No smoke: nothing under the hook's sim paths is staged.

### 156f — the archive, and Round 11's close put to the user (2026-11-13)

By `process/planning.md` "Round close" and "Phase close":

- *§156's friction read.* Three lines, all this session's slips, no
  papercut and no `distress`: a claim ahead of its source in 156a's
  draft (three claims, caught before the commit); a script's edit
  outside the signed list at 156e (caught by the diff's hunks); and a
  claim ahead of its source that went through, below. The claim-ahead
  pattern is the one candidate 1 addressed, dropped at the user's word
  (156d); listed again for the next round's close. The script's slip is
  a first instance; listed.
- *Found at the close, a correction.* 156a's release line and 156b's
  itch changelog said the officer gained a point of defense; his base
  defense is 1 at `1ded6293` and at HEAD, and 154c's change is his
  Inspire aura's +1 DEF to allies. Found while drafting the closed-rounds
  paragraph from ROADMAP's 154c line, by diffing the config at both
  ends; the rioter's defense (0 → 1), the bow (2.0 s and might 3 → 2.5 s
  and 4), the bandit's `draftable` and the 29 lines (0 → 29) were checked
  the same way and are changes. Both entries carry a correction note, and
  `scratch/156b/changelog.md` now names the aura. Whether the first
  wording is on the itch page is the user's to check.
- *Found at the close, a placement.* TODO's fire-channel row ("The fire
  channel reads 0.275 against its signed +0.10") is open under closed
  Round 10, "The board"; its own text reads it again "at the next
  board", which is Round 12's. Lean: move it to Round 12's TODO. It was
  outside 156d's list, so it is put here rather than moved.
- *The Cursor's hand-off pass* at the round's close: NEXT rewritten to
  156f's read and Round 12's kickoff; the in-flight line's box history
  deleted (WORKLOG §155 holds it); 151f's clause moved to its Round 12
  TODO row; the test line re-pointed at 156b's full run (3963 in 271
  files, the same counts); the last phase §156. 1,745 characters of
  3,900.
- *Archived:* ROADMAP as `archive/post-147-roadmap.md`, with §156
  condensed, 156f ◐ and 151f ✗ carried; `round-11-spec.md`;
  `retro/sessions.md` as `archive/sessions-round-11.md`, after this
  session's report and §156's summary; ROUND-RULES.md as
  `archive/round-11-rules.md` (no rule); the scratchpad as
  `archive/retro-scratchpad-round-11.md` (no entry); this file as
  `archive/worklog-phase-156.md`. Each live file starts fresh with its
  header, the ROADMAP and WORKLOG at §157, Round 12's kickoff.
- *Written:* META-ROADMAP's Round 11 marked closed, with its CLOSED
  paragraph and the sequence line; HANDOFF's closed-rounds line (the
  section 6,044 of its 8,000 characters, no fold needed), its Current
  state's span to Round 11, and `archive/closed-rounds.md`'s paragraph;
  TODO's Round 11 marked closed; the scratchpad's sweep line.
- *The playtest:* 156c's smoke on the uploaded build, as signed with
  the cut. *The audit round:* none, since no cluster closed (156a).
- *Not yet:* the push, at the user's read of this step.
