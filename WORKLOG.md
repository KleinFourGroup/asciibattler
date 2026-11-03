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
