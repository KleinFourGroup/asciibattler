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
officer's defense 1 and mobility 3 at rare power 2, the wolf's Harry a
damage op then `move: retreat` (`config/abilities.json`,
`config/units.json`); ability descriptions on 29 of 29 abilities, held
by `src/config/abilities.test.ts` (its `withoutLine` check). The bandit
reads `draftable: false`. It reaches players at 156c.

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
