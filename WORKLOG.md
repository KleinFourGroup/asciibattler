# WORKLOG — Round 9 (The frame and the misses)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 9's earlier phases:
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) (the kickoff,
§134, with the spec's answers and the charter's premises at HEAD; and
§135, the board's instruments),
[archive/worklog-phase-136.md](archive/worklog-phase-136.md) (§136, the
trial's switch and arms; at its close the trial rolled back and the round
re-cut),
[archive/worklog-phase-137.md](archive/worklog-phase-137.md) (§137, every
strike lands, headless; at its close, the stdin guard and the pre-commit
hook checking the commit itself),
[archive/worklog-phase-138.md](archive/worklog-phase-138.md) (§138, the
screen after the misses, read in play; before its kickoff, the friction
log's third kind) and
[archive/worklog-phase-139.md](archive/worklog-phase-139.md) (§139, the
board and the user's play: seven bases a point, act 2 easier under the
conversion, a Round 11 rider; the box at an older commit and `--carry`).

## Phase 140 — the close

The kickoff's inputs, by pointer: the charter, ROADMAP §140 and
META-ROADMAP §"Round 9", "At the close" (the no-counts trial's read, R9,
and the keep test over the lines §132 added); the rules this round
signed, [ROUND-RULES.md](ROUND-RULES.md); what §139 leaves for the close,
`archive/worklog-phase-139.md`, "§139 closed"; `process/planning.md`
"Round close".

### The kickoff's audit, and the cut put to the user (2026-10-30, session a0dffe1f)

Read at `ded47a49`:

- *What the close holds.* The charter's two reads, each in TODO under
  "At the round's close" with its measure written before it started, and
  the round close by `planning.md`: the archive, the scratchpad sweep,
  META-ROADMAP's status, the Cursor, the upload, the keep test over the
  round's own lines, Round 10's charter against the code, a playtest
  proposed. ROUND-RULES holds no rule. §139's close leaves pointers only.
- *The upload.* `package.json` reads `0.1.1`, the uploaded build
  (`7baa695c`). Since it: every strike lands (§137 to §139), §129's
  dependency bumps and A-36's deletions (133f). Run is v50 against
  `0.1.1`'s v49, so the upload rejects every run saved by `0.1.1`; by the
  version rule (META-ROADMAP §Round 8, "The version") a change in play
  and a rejected save each move the middle number, so `0.2.0`. A slot
  one format old is refused as stale before `fromJSON`
  (`src/store/runSlot.test.ts`); the `itch-preview` launch config exists.
- *The deleted stats on the tree.* `precision`, `evasion` and `accuracy`
  in the tracked files under `src/`, `config/` and `locales/`: 12 files
  of GLSL `precision highp float` statements or comments on them, and
  five test comments in `src/run/Run.test.ts` naming the v50 format. The
  locale strings hold `hitsplat.miss`, the idle miss path the charter
  keeps for Round 13's dodge.
- *The keep test's two ranges.* §132's lines, `c08f4a72..f0e5f3c5`:
  11 files of AGENTS, CLAUDE.md and `process/`, 520 lines in and 779
  out, mostly moved. The round's own, `1a3882f6..HEAD` (Round 8.5's
  close to now): 51 lines in and 21 out over AGENTS (16 in, 11 out),
  `measurement.md`, `shell-and-windows.md` and
  `welfare-and-efficacy.md`, and none in CLAUDE.md, from five
  commits (the stdin guard, the hook on the commit itself, the `slip`
  kind, the box at an older commit, `--carry`).
- *The friction log.* 15 lines tagged §134 to §139: 11 `papercut`,
  3 `slip`, 1 `distress`; the wording changed once inside the round, at
  `3ef8baed` (138-pre, `slip` split from `papercut`). Six session reports
  in `retro/sessions.md`. `friction-scan` prints the `peak` column R9's
  measure names. The scratchpad holds one entry: the watch on the kinds,
  with the user's lean toward a per-phase disposition step for papercuts.

**The cut, put to the user.**

- **140a — the round's exit by clause, and Round 10's charter against
  the code** (`stop`). Round 9's exit, scope guards and release line,
  each with the record or the probe that shows it; Round 10's premises
  re-read at HEAD; the playtest and audit-round calls. WORKLOG only, no
  smoke. A decision point: Round 10's charter stands or is amended.
- **140b — `0.2.0`, the tag and the zip** (`none`). `npm version 0.2.0
  --no-git-tag-version`, the commit, an annotated tag `v0.2.0`, neither
  pushed; `itch-zip.mjs` on the clean tree and `--check`; in the pane
  (`itch-preview`): the build ID, the fonts, the dev handles undefined,
  and a planted v49 slot refused with the stale-save message. No smoke
  (no sim path staged). An itch changelog drafted.
- **140c — the smoke and the upload** (`stop`, the user's). As at 128c:
  Firefox and Edge, the build ID, the stale message on a run saved by
  `0.1.1`, a new run, a battle with sound; `main` and the tag pushed at
  their word.
- **140d — the process read** (`stop`). R9 by its measure; the keep test
  over both ranges, each rule with its evidence and a keep or delete; the
  round's 15 friction lines on either side of `3ef8baed`, slips counted
  by trap, the `distress` line quoted in full; the scratchpad sweep, with
  the backslash halving §139 left to it. A rule row is a sentence or
  bullet that directs an action or sets a default, present at the
  range's end and in no rule doc at its start; a moved line is not
  added, and a rewritten one counts once if its directive changed.
- **140e — the list built as signed** (`none`). The deletions and
  promotions, TODO rows for the triaged papercuts; the oracle is the
  diff of the rule docs against the signed list, with the docs tests
  (the caps, the filing text's hash) green. No smoke.
- **140f — the archive and the round's close** (`stop`). ROADMAP to
  `archive/post-133-roadmap.md` and a fresh one opened at §141 with
  Round 10's charter; the spec, the session reports, the rules and the
  scratchpad archived, this file to `archive/worklog-phase-140.md`;
  META-ROADMAP's CLOSED paragraph; HANDOFF's closed-rounds line and
  `archive/closed-rounds.md`; the Cursor at Round 10's kickoff; pushed.

No snapshot bump, no RNG stream, no number moved.
