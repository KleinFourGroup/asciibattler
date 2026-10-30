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

**Signed** (the user: "Signing the cut and all of those leans"): the cut
as put, with its four calls at the leans: `0.2.0`; the upload (140b,
140c) before the process read, after 140a; the keep test over the rule
docs only, the round's guards out of it; an itch changelog drafted at
140b.

### 140a — the round's exit by clause, and Round 10's charter against the code (2026-10-30, session a0dffe1f)

Read at `3599b187`. Each search below has a control: the same pattern at
`1a3882f6`, Round 8.5's close, where the thing existed.

**Round 9's exit (META-ROADMAP §"Round 9"), by clause:**

| Clause | Holds? | Evidence |
|---|---|---|
| The spec signed | yes | 2026-10-27, the plague's cause and act 4's condition left open (`archive/worklog-phase-135.md`, "The spec and the phases signed") |
| Each guard with its planted failure | yes | the roster table's: six planted tables, run on every test (135b); `FX_REGISTRY`'s: a synthetic catalog with each gap, and a control, the sword's `fx` removed, failing (135d) |
| The two stats, `accuracy` and the terrain's modifiers gone from code, config and screen | yes | `evasionMod`, `accuracyMod`, `hitChancePerPrecision`, `dodgeChancePerEvasion`: 0 files at HEAD under `src`, `config`, `locales`, `tools` and `scripts`, 8 at `1a3882f6`; `precision`, `evasion`, `accuracy` only as GLSL statements and test comments (the kickoff's audit); the locale strings lost `stat.precision`, `stat.evasion` and `promotion.delta.dodge`; the screen read in play at 138b |
| The converted numbers pinned against a derivation the code does not consult | yes | `tests/strike-conversion.test.ts` reads `strike-conversion.before.json` (frozen at `a042bf2c`) and the measured rates, with 139b's moves in its `DEPARTURES` |
| The board as paired deltas against the round before, and the user's play | yes | three trees paired on the seed (BALANCE.md, 2026-10-29, "the board on three trees"), the old game at `a042bf2c` as the comparator; the user's play at 139d. That the old game plays as `0.1.1` does rests on the records' byte-identity proofs (133f's deletions, 136b's off arm, 137b's revert), not re-run |

**The release line:** every strike lands; eight stats on the card, POW
above them, read in play at 138b (`archive/worklog-phase-138.md`).

**The scope guards:**

- *No new unit:* the ids of `units.json` (30), `abilities.json` (24),
  `packets.json` (8) and `daemons.json` (11) are the same at
  `1a3882f6` and at HEAD.
- *No act content:* `encounters.json`, `sectors.json`,
  `sector-map.json`, `events.json`, `layouts.json` and `camps.json` are
  unchanged since `1a3882f6`.
- *No retune by taste:* the config moved twice, by 137c's conversion
  (pinned above) and 139b's seven points by the swing read under a bar
  written before it; both signed.
- *No dodge:* no file under `src/sim` or `src/run` but tests names
  `'unit:missed'`; at `1a3882f6`, `World.ts:805` emitted it.
- *No cadence change:* no changed config line names a cooldown, a
  cadence or a duration in seconds; the six sim lines that do are
  comments and #109's pin restored at 135e
  (`src/sim/effects/interpreter.test.ts:285`).

**The decision points:** "roughly equivalent" held to one Escalation step
of the old game's wins; act 1 inside it, two acts outside, signed at 139d
as the game's (139e) and left to Round 11's retune as a TODO rider. The
sheet was not re-pinned, by 139's cut; Round 11's retune re-pins it.

**Round 10's charter at HEAD** (META-ROADMAP §"Round 10"):

- *The scripted run:* `RunConfig`'s dials `layout`, `encounter`,
  `firstNode` and `event` are single ids (`src/run/RunConfig.ts:262`).
  The 17 URL parameters are the census's count over the whole game;
  `RUN_CONFIG_PARAMS` holds 13. A saved run keeps its dials as query text
  and `runSlot.ts:68` parses them back into `Run.fromJSON`. The CLI takes
  any flag named in `RUN_CONFIG_PARAMS` (`tools/run-config/cli.ts:55`),
  so `--sectorHops` parses and `--sector-hops` does not; the help lists
  neither, nor `--escalation`. No warning when a forced encounter matches
  no node.
- *The fauna:* none of wolf, rat, fox, puma, tiger or bear is a unit;
  `bandit` is.
- *The run's shape:* The Start (grassland, 11 hops) holds the Bandit King
  and the Bandit Queen as bosses, The Deep End (swamp, 11) the
  Generalissimo and the Witch Hunt, so the moves are still to make. Act 1
  is grassland in `plans/acts.md`, the reason for the lean that The Start
  takes barren; barren, tundra and volcanic are layout themes already.
- *The sheet:* `tests/fuzz/board/signed-sheet.json` holds one
  `seamPoolFraction` and a `deepEndWallTarget`, two-act shaped as
  written.
- *The atlas:* 31 glyphs against `ATLAS_CELL_BUDGET` 48.
- *Not in the charter, in TODO under Round 10:* the roster table's
  rebuild, which 135b's guard makes a precondition: from the commit that
  adds act 1, `tests/roster-table-coverage.test.ts` fails and
  `makeRosterSampler` refuses the table until a board cohort rebuilds it,
  so act 1's bands, the round's exit, wait on it. And B-19, the editors'
  repeated sheet rules, a lead with no oracle yet.

**The calls, with the session's leans:**

1. *Round 10's charter* stands, with one line added to its scope: the
   roster table rebuilt once act 1 is in the map, the guard's PENDING
   line until then. B-19 stays a TODO lead, unnamed in the charter,
   since it has no proof. `--escalation`'s help line joins R12's row.
2. *The playtest:* 140c's smoke is the round's playtest. The user played
   the converted game at 139b's numbers at 139d, and those are the
   build's.
3. *The audit round:* none, since no cluster closed; Round 8.5's close
   made the same call.
