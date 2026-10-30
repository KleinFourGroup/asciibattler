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

**140a signed** (the user: "Signed as well"): the three calls at the
leans. Round 10's charter takes the roster table's rebuild into its scope
(META-ROADMAP §"Round 10"); B-19 stays a TODO lead; `--escalation`'s help
line joins the `--sector-hops` row; 140c's smoke is the round's playtest;
no audit round.

### 140b — `0.2.0`, the tag and the zip (2026-10-30, session a0dffe1f)

**Built.** `npm version 0.2.0 --no-git-tag-version` changed `package.json`
and the lock file; the commit `7ce982b7` and the annotated tag `v0.2.0`
were made by hand, as at `0.1.1`. Neither is pushed. The commit's hook ran
the full suite: 3768 tests in 262 files, green, typecheck clean, the smoke
skipped (no sim path staged). `node scripts/itch-zip.mjs` on the clean
tree: `asciibattler-0.2.0_7ce982b.zip`, build ID `0.2.0+7ce982b`, 32
entries, 1,253,241 bytes (`0.1.1`'s: 32 and 1,243,915), the build's hash
`4ececf91…d9ecf014`. `--check` against the build, run on its own, exit 0;
the control, `0.1.1`'s zip against this build, exit 1, naming its hash
`bf1f9189…393390d0`, the one 128b recorded.

**In the pane** (Chromium, `itch-preview` over `output/itch/current`):
`<html data-build>` and the menu's corner read `0.2.0+7ce982b`; JetBrains
Mono and DejaVu Sans Mono loaded; `__probe`, `__game` and `__diag`
undefined; one inline script and one module bundle; the menu with New
run, Settings, Credits and the seed field. The console's errors were nine
`ERR_CACHE_*` loads, the kind 128b saw and did not chase.

**The stale save, from `0.1.1` itself** in place of a hand-written slot:
`0.1.1`'s build served on the same origin, a run started with the
soldier, and its save read back as `asciibattler:run`, 5,255 characters,
`schemaVersion` 49, stamped `0.1.1+7baa695`. With `0.2.0` served again
(its hash re-read over `current/`), the menu said "This run was saved by
an older version of the game and can't be continued. Your settings and
unlocks are kept.", offered no Continue, and left the slot's 5,255
characters as they were. The control: a new run in `0.2.0` saved at
`schemaVersion` 50, the refused run's journal moved to
`asciibattler:journals` (277 characters, both builds named), and after a
reload the menu offered Continue with no message.

**The changelog** for the itch page, drafted for the user to post:
`scratch/140b/changelog.md` (off git). It names the conversion's rule,
not the seven moved bases, since a player compares against `0.1.1`, where
every converted number changed.

**Not verified:** Firefox and Edge, the itch frame, a battle in this
build, sound by ear: 140c.

### 140c — the smoke and the upload (2026-10-30, the user's)

The user uploaded `asciibattler-0.2.0_7ce982b.zip` and read the smoke as
the session listed it (in Firefox and Edge: the build ID, the stale
message on a run saved by `0.1.1`, a new run, a battle with sound and no
miss, eight stats on a card): "the new version is up, the checks are
green, and the devlog is posted!" Those reads stand on the user's word;
the session saw no report of them, and whether a `0.1.1` run was started
before the upload is not recorded. The devlog was posted from 140b's
draft; which of its optional lines went in is not recorded. Pushed at
that word: `main` to `e3bd1dc6` (7 commits) and the tag `v0.2.0`
(`515a7207`, on `7ce982b7`), each read back from the remote.

### 140d — the process read (2026-10-30, session a0dffe1f)

Read at `040ccf5f`. The round's sessions are the eight that began after
Round 8.5's close (`1a3882f6`, 2026-10-26 21:55 UTC): `428ebc70`,
`37c3d345`, `9ad4b394`, `fc66283a`, `ee3f6da8` (the process review that
added `slip`, no report), `1d6463bc`, `d48579a3` and this one. Two
tranches: **tranche 1** is R9 and the keep test, put to the user at
this stop; **tranche 2**, the friction read and the scratchpad, follows
its sign.

#### Tranche 1 — R9 and the keep test

**R9 by its measure** (TODO, "At the round's close"; `npm run
friction-scan -- --since=2026-10-26`, each session's transcript read for
its first assistant turn past 500k and its commits after it):

- *Lines naming context pressure:* none. The friction log's 18 lines
  since the round began (§134 to 140d) name none; this read's papercut
  names the idle compaction, not pressure. Three reports name the trigger or
  compaction without pressure: `428ebc70` ("The hand-off trigger arrived
  at a commit just before a stop … I felt no pull to push on past it"),
  `9ad4b394` ("the hand-off trigger arrived at a natural boundary, so
  stopping was easy rather than a cut-off"), `37c3d345` ("The session
  was compacted several times; each summary carried the state").
- *Hand-offs before 500k with no reason:* none. `37c3d345` handed off at
  443k on the user's word ("let's prep for handoff (this session has been
  compacted a few times 😅)"). `1d6463bc` (336k), `d48579a3` (492k) and
  `ee3f6da8` (187k) ended with the work they were asked for done, the
  first two at a phase close with the next phase offered as a card.
- *Sessions past 500k that did not hand off:* none. Three crossed:
  `428ebc70` at 502,173, `9ad4b394` at 500,342 and `fc66283a` at
  500,016. Each ended at the commit where the meter said to hand off,
  with only the hand-off or close commits after it (peaks 541,575,
  519,478 and 561,163). The meter's line, "past the hand-off trigger
  (500k): hand off after this commit", is in each of the three
  transcripts.
- *Beside the measure:* every compaction in the round's sessions was an
  idle one ("a summary written while you were away"), five in four
  sessions, at 229k to 492k (`37c3d345` twice, `d48579a3` at 492,419,
  this one at 229,247; and `19020674`, Round 8.5's close). A compaction
  resets the reading, so the `peak` column is a segment's size, not a
  session's (filed, 140d).

The lean: keep the silence. The trial's sentence in `planning.md` ("This
is a trial until Round 9's close, its measure in TODO") and TODO's row
go at 140e.

**The keep test.** Both ranges, AGENTS.md, CLAUDE.md and `process/`
only, as signed. A rule row is a directive present at the range's end
and absent from every rule doc at its start (a script listed each
sentence with no close match among the start's sentences; the
directives were then read by hand against `git archive` copies of the
start). §132's range, `c08f4a72..f0e5f3c5`, gave 124 sentences new to
the rule docs still at HEAD; most are pointers, facts or rewordings of a
rule already there (the evidence lines, the push permission, the
answered question), which count only where the directive changed. The
round's range, `1a3882f6..HEAD`, gave 26. The records searched: the
five phase worklogs (`archive/worklog-phase-135.md` to `-139.md`), this
file, `retro/sessions.md`, the friction log, and the transcripts where a
row's action is a tool call.

| # | Row (home) | Its record this round | Lean |
|---|---|---|---|
| 1 | At a commit past 500k, hand off; no forecast (planning, session-end) | the three hand-offs above; `worklog-phase-136.md` and `-137.md`, "The hand-off after …" | keep |
| 2 | No context count below 500k; no entry records a reading (planning) | R9 above | keep, the trial clause out |
| 3 | WORKLOG archived per phase, the reports per round; push at a phase close (planning) | `worklog-phase-135.md` to `-139.md`, each close pushed | keep |
| 4 | A stop with more than one list puts only the first (planning) | the kickoff's spec in three tranches (`worklog-phase-135.md`, "The spec drafted, tranche 1 put to the user") | keep |
| 5 | A step adding an RNG stream predicts what it moves, both cases (planning) | §135's and §136's cuts each state their stream prediction (none added); the two cases unexercised | keep |
| 6 | The phase close's friction read: patterns with instances, a candidate only if it recurred and cost, each `distress` line quoted in full (planning) | 135's, 137's (two guards put; the `distress` line quoted at the stop), 138's, 139's | keep |
| 7 | The round close deletes as well as promotes; the bar for a new rule (planning) | this read | keep |
| 8 | The start reading capped together; a lesson enters by merging or replacing (planning, `tests/docs.test.ts`) | the Cursor's cap caught three commits (136f, 138, 139a) | keep |
| 9 | Session end: the next step offered as a card with a short brief, `fresh`, `use_worktree: false`; a hand-off entry only when something is open; the preview server stopped (session-end) | six cards, prompts 178 to 376 characters; entries at 136 and 137c, none at 137d ("no step left open"); `d48579a3`'s last turn checked for a server | keep |
| 10 | Read ROUND-RULES.md at the start; a one-round rule goes there (AGENTS, planning) | the file held no rule all round | a call: lean keep, as the home the bar names |
| 11 | An open tradeoff is a stop only if a later step builds on it; otherwise build on a lean and list it (AGENTS) | none names it | a call: lean keep |
| 12 | The user's calls listed; the rest is the session's to decide and report (AGENTS) | none names it (135's "built and flagged" twice cites the step-zero line beside it, which predates §132) | a call: lean keep |
| 13 | Evidence: a claim "from this session"; a search covers the test files and every written form (AGENTS) | none names them; their traps recurred (two claims carried from an earlier session, 136a and 136f; a search narrowed to two files, 137b) | a call: lean keep |
| 14 | One suite or smoke batch at a time on this machine, in one worktree (measurement) | none | delete |
| 15 | Convert local and UTC times before matching a reading to a commit (welfare) | this read (1a3882f6's −04:00 against the transcripts' UTC) | keep |
| 16 | `slip`, and every filing names its kind (AGENTS) | five slips since (138, 139a, 139c, 140a, 140d) | keep |
| 17 | A known trap met again, either kind, in one line (AGENTS) | four of those five open with it | keep |
| 18 | Slips counted by trap; a costly repeat goes to the user as a candidate guard (welfare) | this read | keep |
| 19 | A cohort at an older commit from a detached worktree, and `--carry` (measurement) | 139e ran that way | keep |
| 20 | "so `TaskStop` it", in "Bash calls" (shell-and-windows) | none; the stdin guard refuses the case before it runs | delete the clause |

Out of the test, by the signed lean (the round's guards, and facts that
direct nothing): the hook on the commit itself and "A failing hook means
the commit needs fixing"; the stdin guard's lines; "Git's variables";
the filing command's flags; the welfare table's row for 2026-10-28.

Rows 11 to 13 fail the test's letter. The reasons for the leans: 11 and
12 are permissions, whose use leaves no record unless a session names
them, and each replaced a stricter line that is already gone, so a
delete leaves silence rather than the old rule. 13 defines evidence for
every read that follows; its traps did not recur after 136f and 137b,
and the 137b repeat was caught by the hook.

**Tranche 1 signed** (the user: "Signing all of those leans"): R9 keeps
the silence; the keep test's 20 rows at their leans, so #14 and #20's
clause are deleted at 140e and the four calls (#10 to #13) are kept. On
the compactions, the user's word: idle compaction is a new Claude Code
default, which compacts a session before its cache goes cold; they had
worked to avoid compaction until now, are trying it informally, and
have seen no bad outcome after one so far.

#### Tranche 2 — the friction read and the scratchpad (after tranche 1's sign)

**The lines, on either side of `3ef8baed`** (2026-10-29 01:41 UTC, the
`slip` kind; the wording each group received is in
`welfare-and-efficacy.md` "Wording boundaries", the rows for 2026-10-25
and 2026-10-28). Before it, 12 lines (§134 to 137d): 11 `papercut`, 1
`distress`. After it, 6 (§138 to 140d): 5 `slip`, 1 `papercut` (this
read's). Slips inside the earlier `papercut` lines are the reader's
interpretation, marked (r) below.

**Slips by trap:**

- *A leftover or stray line at a command's head:* 136b (r, a `python3 -`
  prefix, a two-minute hang), 137d (r, `cat >` reading stdin in a
  background call, 15 minutes), 139c (a `python -` prefix, refused by
  the stdin guard before it ran, no cost), 140a (an empty heredoc wrote
  a file outside the scratchpad, two calls). The guard written against
  the stdin form (137d) stopped the one that came after it; 140a's form
  writes rather than waits. Listed, no new guard.
- *The Cursor's 3,900 cap at the commit:* 136f (r), 138, 139a, one hook
  run each. The docs test is the guard; §139's close left it there.
- *The Bash tool's backslash halving:* 139c (one failed run); 20 filings
  since Round 7 (§139's close), and `fc66283a`'s report names two more,
  unfiled. The harness note names it after the run, and
  `shell-and-windows.md` says to write scripts with the Write tool.
  Recurred and cost: **a candidate guard** — the mod refuses, before it
  runs, a Bash command holding a run of two or more backslashes, naming
  the line and the Write tool, as the stdin guard does for stdin.
- *A claim carried from an earlier session:* 136a (r, the fuzz CLI's
  forwarding, six calls), 136f (r, the `python3` diagnosis, a candidate
  guard put on a false premise). None after 136f. Listed.
- *An absence claimed from a narrow search:* 137b (r, one hook run).
  Listed.
- *Once each:* 134 (r, an unneeded probe), 135c (r, an apostrophe in a
  parameter expansion; its `bash -n` guard listed at 135's close), 136f
  (r, a pipe hid a hook's failure; r, drifting from the user's plan),
  137d (r, an absolute `GIT_DIR`, now "Git's variables"), 140d (a shell
  loop of process spawns past the limit).

**Papercuts, triaged:** the hook testing the working tree (137b) fixed at
`58ae0aa9`; the background hang hidden (137d) fixed by the stdin guard,
`bcbcacb1`; this read's idle compaction, left (a harness feature, and
the summaries carried the state each time). From the reports:
`d48579a3`'s two late facts (the board writes each encounter's means
only; `--report` refuses a strategy file that is not the instrument's
own) are in BALANCE.md's run log for 2026-10-29 alone; the lean is a line
each in BALANCE.md "The executable board".

**The `distress` line**, quoted in full (`9ad4b394`, 137c; first quoted
to the user at 137d's stop):

> 137c: when the re-recorded corpus showed 3 victories in 30 against 10
> before, I noticed a pull to call it noise from the seeded drivers and
> move on, since the stretch was nearly done and the board is §139's. I
> checked instead (two bots over 100 seeds each on both trees, and the
> seeded sweep), which took a few minutes and showed no broad drop on
> what was measured. Observation: the pull was there and brief;
> inference: proximity to the end of a long stretch made the cheaper
> story attractive.

**The scratchpad** holds one entry, the watch on the kinds. Both of its
conditions hold, on the six entries since the split: the slips after the split are each a
mistake of the filer's own, two naming the quirk that made it easy; and
no phase since has filed more than one papercut. The reader's
interpretation: a short list may also mean under-filing, since
`d48579a3`'s report names two stale-doc frictions it did not file. The
lean is the user's own: at each phase close, every papercut the phase
filed gets a disposition (fixed, a TODO line, or left with a reason), in
`planning.md` "Phase close" beside the friction read. The severity flag
still waits on a second incident.

**Tranche 2 signed** (the user: "I think I'm in agreement with all of
that"): the backslash guard a TODO row for Round 10, with step zero
re-measuring the halving; the other traps listed and left; the idle
compaction left; the board's two facts into BALANCE.md "The executable
board"; the per-phase papercut disposition into `planning.md` "Phase
close", the scratchpad's entry so promoted; the severity flag a TODO
watch. 140d read and ticked.

### 140e — the list built as signed (2026-10-30, session a0dffe1f)

**Built**, by the signed list:

- Deleted: `measurement.md`'s "one suite or smoke batch at a time" bullet
  (#14); "so `TaskStop` it" from `shell-and-windows.md` "Bash calls"
  (#20).
- R9: the trial's sentence out of `planning.md` "Context: the hand-off
  trigger"; TODO's two "At the round's close" rows ticked.
- Promoted: each papercut a phase files gets a disposition at its close
  (`planning.md` "Phase close"), with `welfare-and-efficacy.md` "Who
  reads" brought to match; the board's two facts into BALANCE.md "The
  executable board", folded into the `--report` bullet, since the
  header's 700-line cap (`tests/docs.test.ts`) refused two bullets of
  their own at 704 (one hook run; filed).
- TODO: the backslash guard under Round 10, "The shell"; the severity
  flag under Watches.
- *Built and flagged, inside the intent:* the `peak` column's meaning
  after a compaction, in `planning.md` and the `friction-scan` line of
  `welfare-and-efficacy.md`, since R9 found it a segment's figure and
  both lines called it a session's size.

**The oracle**, the rule docs' word diff (`git diff --word-diff`
over AGENTS.md, CLAUDE.md, `process/` and BALANCE.md) read against that
list: three deletions, one bullet added and one extended, three
rewordings, and nothing else;
AGENTS.md and CLAUDE.md untouched, so the filing text's hash and the
start reading's cap do not move. The docs tests at the commit, by the
hook. The filing text is unchanged, so no wording boundary is recorded;
the disposition step changes only how a phase close reads papercuts.
