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
