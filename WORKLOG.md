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
and the charge) and
[archive/worklog-phase-161.5.md](archive/worklog-phase-161.5.md) (the hex
and the ice storm as specials); Round 11's are
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) to
[archive/worklog-phase-156.md](archive/worklog-phase-156.md).

## Phase 162 — the closing board

The kickoff's inputs, by pointer: what §161 and §161.5 hand on
(`archive/worklog-phase-161.md`, "§161's close";
`archive/worklog-phase-161.5.md`, "§161.5's close"); ROADMAP §162; TODO's
Round 12 rows; `process/planning.md` "Phase kickoff", then
`process/measurement.md` and BALANCE.md for the board.

### The kickoff's audit, and the cut put to the user (2026-11-26)

Read at `0af7c357`: ROADMAP §162, META-ROADMAP's Round 12 exit, TODO's
Round 12 rows, §161's and §161.5's closes, `balance:board -- --plan` at
HEAD, §155's kickoff and board (`archive/worklog-phase-155.md`; BALANCE
2026-11-12, both entries), the signed sheet's 2026-11-12 amendment,
BALANCE's integrity protocol, artifact registry, rarity protocol and the
prior table v9's entry, `process/measurement.md`, both coverage tests, and
the drive logs of 154g and 155a.

- **The board runs as at §155.** `--plan` prints the same 17 rows. 155a
  ran them as 25 batches (`scratch/155/155a-board.queue`) on one `cpx42`:
  23:46Z to 05:05Z, 5 h 19 min for the 25 lines. The regen and
  fire-ablated doctrine rows took 5 min 22 s and 5 min 27 s at n=40,
  launch to launch. §155's pooled board is on disk at
  `output/board-runs/155a/`, with its readers (`scratch/146/merge.mjs`,
  `pair.mjs`, `walls.mjs`, `scratch/155/act1-pooled.mjs`), so §162's
  board pairs with it seed for seed.
- **What moved since §155's board** (`5d3bcba8`): 20 draftable units
  against 16 (`scratch/162/draftable.ts`, through
  `DRAFTABLE_ARCHETYPES`): the grenadier and the ninja uncommon, the
  telekinetic and the cavalier rare. The adventurer's Snag and the ronin's
  whirlwind changed two draftable kits. Enemy side, by
  `config/encounters.json` and `config/sectors.json`: the grenadier in the
  Artillery Company (a normal, acts 2 and 3); the cavalier in the warband
  vanguard (an elite, act 2); the telekinetic and the warlock in the Dark
  Magic Posse (an elite, act 3); the ninja and the warlock in the
  Miscreants (act 3, from hop 3); the ice mage in the Elemental Trio (act
  3). The warlock also keeps the `ghoul-nest` camp, and the ice mage the
  `frost-coven` camp, both placed by biome and layout. Act 1's encounter
  list names none of those five fights; act 1 moved through the player's
  draft, the two kits, the puma's pounce and the fall on its chasm and
  deep-water maps.
- **The prior table goes first.** The ARM prices an item with no row at
  0 (`tests/fuzz/rollout/evaluator.ts:164`, `prior.table[key] ?? 0`), and
  v9's 16 units average −14.6 (BALANCE 2026-11-10), so on v9 the board's
  ARM rows would price the four newcomers above most of their peers: the
  Dis Pater trap of 88d at a smaller scale. A row under the floor still
  folds at its meanDelta (`priorFoldValues`,
  `tests/fuzz/prior/priorTable.ts:223`); only a missing row reads 0. So
  the table is rebuilt, and the board runs under it. The rebuild itself
  runs under v9, where the newcomers read 0, as Diana's and Hecate's first
  rows did at v8.
- **The prior table v10** is the registry's recipe, 154g's three lines
  (`scratch/154/154g.queue`): v9 took 4 h 54 min of one `cpx42`, v8 5 h
  4 min. Its count, predicted: 40 items, v9's 36 (12 daemons, 8 packets,
  16 units) plus the four newcomers, Mars still PENDING.
  `tests/prior-table-coverage.test.ts` carries four unit PENDING lines,
  and rule 3 fails once they gain rows, so the rebuild's commit deletes
  them.
- **The rarity protocol's desk read** reads the recruit-site rows, n≥80
  signable. v9's five rares read 158 to 173 at recruit; seven rares now,
  so about 115 to 125 by the share alone, and the uncommons about 195 to
  210 from 294 to 315 (a prediction). A thin row gets the protocol's
  `--grant` pair at n=80 on a fresh window; no queue under `scratch/` or
  `output/box-batches/` and no BALANCE line names `--seed-offset=8000`.
  Dis Pater's grant line took 52 min (155a). `scratch/154/item-worth.mjs`
  reads the units' worth by `TABLE=`, with its own check.
- **Fire rate first** (the protocol's step 4): the batches' CSVs carry no
  ability casts (`summary.csv`, `pacing.csv`, `rosters.csv`,
  `decisions.csv`), and §161 found the charge rare in act 1.
  `scratch/160.5/fall-census.ts` wraps the World for falls; extended to
  count casts, it reads the newcomers' signature abilities and the falls
  by pusher on 160.5d's shape (seeds 1 to 20, the deploy vector), locally.
- **The roster table** v8 (155b) holds no newcomer;
  `tests/roster-table-coverage.test.ts` carries their four PENDING lines.
  Rebuilt from the board's eight ARM rows: 52 buckets predicted, since a
  bucket is a (character, sector, hop) and neither moved.
- **The fire channel** reads regen − fire-ablated on the same 40 seeds;
  155a read 0.275 against the signed +0.10 (band 0.05–0.15), the
  fire-ablated row 27 → 17 (p 0.021, one of 15 tests). At n=40 the two
  rows leave the read loose; extending both to n=120 costs two 80-seed
  lines, about 20 minutes of box.
- **The enemy grenadier** (TODO): the Artillery Company's grenadier is
  `count` weight 1 (`config/encounters.json`), drawn in the-start and
  the-deep-end. The walk rows give its cost and turns per instance
  (`pacing.csv`) and deaths per run (`summary.csv`); no CSV counts falls,
  which the census does.
- **The warlock and the ice mage** are priced through their fights on the
  walk rows' `pacing.csv`: the Dark Magic Posse, the Miscreants and the
  Elemental Trio, act 3, where 155a's regen walk reached 0.242 and the
  deploy walk 0.792, so their instance counts are small on regen.
- **The fresh derive** is due at a re-pin board (the integrity protocol);
  155a's took 4 h 15 min, 146b's 5 h 53 min. Its search line reads no
  prior table, and it runs beside the board at the board's HEAD.
- **The box price**, re-read today from `hcloud server-type describe
  cpx42`: 0.1314 an hour in fsn1 and nbg1, 0.1114 in hel1, net equal to
  gross. No Windows restart is pending (both registry flags false); the
  last update restart was 2026-11-25 at 08:23.
- **The friction candidate** from §161.5's close (a claim generalised past
  its measurement, twice) has no answer in the commits since
  `748a4d04`, so it goes to the user with the cut.

**The cut, put to the user** (unsigned):

- **162a — the prior table rebuilt** (`none`). Step zero: the recipe's
  line at one seed locally with `--hops=2`, its shadow rows naming a
  newcomer. Then 154g's three lines at the cut's HEAD, pushed, on one
  `cpx42` → `npm run prior:table` → v10, the four unit PENDING lines out,
  BALANCE's registry row and run-log entry. Exit: the coverage test green
  with every draftable holding a row; the count against the prediction.
- **162b — the newcomers' desk read** (`none`; dispositions at 162e).
  v10's recruit-site rows for the four newcomers, with the adventurer and
  the ronin beside them, against their tiers' peers, by
  `scratch/154/item-worth.mjs` with its check; a row under 80 named for
  the grant pair. The fire census at the board's HEAD, locally. Exit:
  each newcomer's row with its n, and the casts and falls by ability.
- **162c — the board on the box** (`none`). At v10's HEAD, pushed, from a
  detached worktree. Box 1: 155a's 25 lines line for line, then the regen
  and fire-ablated rows extended to n=120. Box 2: the fresh derive. The
  grant pair (a control and one arm per thin newcomer, n=80 on seeds 8001
  to 8080) on a third box only if 162b names a thin row. The anchors
  locally. Exit: every batch fetched with exit 0 at one HEAD; `--report`
  VERDICT PASS.
- **162d — the roster table rebuilt** (`none`). From the board's eight ARM
  rows: v9, its PENDING lines out for every newcomer an ARM row drafts.
  Exit: the coverage guard green; a sampled draw loads and plays; at most
  55 buckets.
- **162e — the board read** (`stop`, the decision point). The board
  against 155a's, paired on seeds 1 to 120; act 1 by encounter against
  the turn targets and cost bands, and against 155g's sheet (the six
  refs, seam 1 and act 1's wall by vector); the fire channel; the
  newcomers' desk read; the Artillery Company against the deaths and
  falls; the warlock's and the ice mage's fights; the parity gaps; the
  terminal pair; acts 2 and 3 recorded; the derive's ceiling. Put: act
  1's sheet held, re-pinned with no content moved, or its misses tuned
  (162g, 162h); each newcomer's disposition (hold, re-tier, re-price or a
  named watch); the fire channel's (re-sign, hold the WARN, or a cause
  read placed later); the enemy grenadier's (hold, or a weight or sector
  change).
- **162f — the sheet amended** (`stop`; `none` if 162e holds the sheet,
  and the user may make it `none` under a re-pin, as at 155g). The values
  162e signs, in `signed-sheet.json`; acts 2 and 3 to BALANCE for Rounds
  21 and 22.
- **162g — the content changes** (`stop`; only if 162e signs any). The
  changes as signed, the corpus re-recorded.
- **162h — the verify board** (`none`; only after 162g). 162c's board at
  162g's HEAD, the roster table rebuilt from it. Exit: VERDICT PASS, and
  the changed reads in their bands or the miss to the user.

*Predictions.* No snapshot bump (World v42, Run v51) and no RNG stream.
162a, 162d and 162f stage `tests/fuzz/`, so the fuzz smoke and the
`--jobs` parity fire, and no smoke pin is predicted to move (none did at
154g or 155b); 162b and 162c write docs alone, the census in `scratch/`;
162g stages `config/`, so the smoke fires. The corpus re-records at 162g
only: the game reads nothing under `tests/fuzz/`.

*Leans put with it.*

1. The order: the prior table first, the board under it (above).
2. The box: one `cpx42` for 162a (5 to 6 h), then two side by side for
   162c, the board (5.5 to 6.5 h with the two extensions) and the derive
   (4.5 to 6 h); 15 to 18.5 box hours, 2.0 to 2.4 at 0.1314. A grant
   pair adds about 55 min a line on its own box.
3. The fresh derive in, since a re-pin asks for it. Without it, about 0.7
   less and the protocol's re-pin leg named unmet at 162f.
4. The regen and fire-ablated rows extended to n=120 for the fire
   channel's read.
5. The grant pair only for a newcomer row under 80.
6. The fire census, local, on 160.5d's shape.
7. 162a to 162d run unattended to the stop at 162e: at 162a's verified
   fetch the session builds v10, commits, pushes, reads 162b and launches
   162c. Pauses: a newcomer with no row in v10 (the board would price it
   0) or a failure the step's intent cannot fix stops the chain before
   162c's launch. Driver holds: one relaunch of the unfetched lines at the
   same HEAD; a second hold destroys the box after fetching what finished,
   and stops. The context meter's hand-off at a commit before a launch
   stops there with hand-off notes. Never unattended: a content change, a
   sheet amendment or a disposition. Every call the session makes written
   here for the read.
8. Left out: a second prior-table pass under v10; the per-kind cost bands
   into the sheet; acts 2 and 3 tuned (their rounds); the warlock and the
   ice mage tuned unless 162e calls it; a pair at Escalation 3.

*The stretch the cut opens:* 162a to 162d, to the stop at 162e.

### The cut signed (2026-11-26)

**Signed** (the user: "Signing the cut and all leans, including no new
rule. Thank you so much! 😁"): the cut as put, its reads, its eight
leans with the unattended run from 162a to the stop at 162e, and §161.5's
friction candidate closed with no new rule, since AGENTS' Evidence already
covers a claim of an absence.

### 162a's step zero (2026-11-26)

The cut put step zero at one seed with `--hops=2`, as at 155a; the CLI
refuses `--shadow-horizon` with `--hops`, since a rollout clone drops the
run-shape dials and its walk would be unbounded (WORKLOG §84b). So the
recipe's first line ran whole, at four seeds (1001 to 1004, `--jobs=4`)
locally at `c339879d`: all four runs complete, 27 min, exit 0. Its
`decisions.csv` holds 4,981 rows, 815 of them at the `run` horizon, and
names every newcomer as a recruit candidate at the `run` horizon: the
grenadier in 8 rows, the ninja in 7, the cavalier in 5, the telekinetic
in 3 (the grenadier and the ninja at the port too). So the line runs on
today's catalog and the shadow prices the newcomers. Four seeds' recruit
rows scale to about 240, 210, 150 and 90 in 120, so the telekinetic's may
come in near 80, against the cut's prediction; 162b reads it
(`scratch/162/step0/`).

### 162a — the cohort launched (2026-11-26)

*Launched* at `c339879d`, pushed, from a detached worktree at
`../asciibattler-162a` with a `node_modules` junction (138 entries on both
sides): the three lines of `scratch/162/162a.queue`, 154g's lines byte for
byte, on one `cpx42` from 19:31Z. The driver's `--jobs` parity test passed
in the worktree, and batch 1 launched at 19:32Z. The drive log is the
worktree's `scratch/162/162a-drive.log`.

### 162a — the prior table v10 (2026-11-26)

The three lines fetched with exit 0 and the driver destroyed the box at
00:05Z, 4 h 34 min after it made it. v10 holds 40 items, the count the
cut predicted, with every newcomer in it and 38 over the floor. Its
numbers are BALANCE's run log, "the prior table v10". The four unit
PENDING lines are out: the coverage test failed on them first (its rule
3, the control) and passed after. v9 is in git at `5ca1b705` and beside
the step's readers at `scratch/162/prior-table-v9.json`. The bank
completed 84 of 120 runs against v9's 97 (p 0.029), with more defeats
in acts 1 and 3; the content since `07ce8ed5` and each bank's prior ride
together there, and the board reads the acts.

### 162b — the newcomers' desk read and the fire census (2026-11-26)

Every newcomer's recruit row is over 80 (the grenadier 219, the ninja
190, the cavalier 120, the telekinetic 114), so 162c runs no grant pair.
Taken free, the grenadier and the ninja sit inside the uncommons'
spread; the telekinetic and the cavalier are the rares' two lowest, the
halberdier within an error of both. The fire census fires every
newcomer's abilities on the player's side, the telekinetic's in one
battle of 432; its runs never reach act 3, so the enemy ninja's,
telekinetic's, warlock's and ice mage's fights are the board's to read.
The numbers are in the same BALANCE entry. The dispositions are 162e's.

*The session's calls* (lean 7): the census ran on the working tree
before v10's commit, since it plays the deploy strategy, which reads no
prior table, so the code is the board's; the BALANCE entry adds the
idols' moves and the bought-row watch's numbers, which TODO's Round 17
watches read.

### 162c — the cohorts launched (2026-11-27)

*Launched* at `5f277acc`, v10's commit, pushed, from a detached worktree
at `../asciibattler-162c` with a `node_modules` junction (138 entries on
both sides). `balance:board -- --plan` printed 155a's 17 rows unchanged,
and `scratch/162/make-queue.mjs` wrote the queues: the board's 25 lines
byte for byte as 155a's, then the regen and fire-ablated rows to n=120
in place of 155a's Dis Pater pair (27 lines, `162c-board.queue`), on one
`cpx42` from 00:17Z, batch 1 at 00:18Z after the driver's parity test;
the fresh derive (`162c-derive.queue`, the registry's line as 155a ran
it) on a second from 00:19Z, launched at 00:20Z. No grant queue, since
162b named no thin row. Drive logs in the worktree's
`scratch/162/162c-board-drive.log` and `162c-derive-drive.log`.
The anchors ran locally in the worktree at the same HEAD, clean
manifests: pure-random 4 of 40, greedy 6 of 40 (155a: 6 and 7), in the
worktree's `output/162c-anchors/`.

### 162c — the drivers died with the PC, and the recovery (2026-11-27)

The PC restarted at 02:12Z: System event 1074 from Explorer on the
user's behalf, "Other (Unplanned)", and Kernel-Power 109; no
Kernel-Power 41. The user reported a crash. Both drivers died with it.
The board's log ends at 02:02Z with batches 1 to 9 launched and 1 to 8
fetched; the derive's at 02:10Z, its one batch running.

*Recovered* at the user's word ("can you recover?"), by
`process/measurement.md`'s crash steps: the trees clean, no driver left
running, both boxes up. The board's box held batch 9, done with exit 0;
`scripts/box-batch.sh <box> fetch` brought it back (summary.csv
`cefb1df4`, the manifest at `5f277acc`), and the nine fetched manifests'
argv equal queue lines 1 to 9. That box was destroyed, and lines 10 to
27, verbatim, went to a fresh `cpx42` under the unchanged driver
(`scratch/162/162c-board-resume.queue`) from 02:37Z, its first batch at
02:38Z (the `--jobs` parity pass held from 00:18Z at the same HEAD). The
derive, still running, is watched by `scratch/162/162c-derive-watch.sh`:
it polls `box-batch.sh status`, fetches on done, checks the fetch as the
driver does (the `fetched →` line, exit 0, a non-empty
`best-strategy.json`), destroys the box, and holds it on any anomaly;
its status loop read the derive as running before it was armed. Logs in
the worktree's `scratch/162/`: `162c-board-resume-drive.log`,
`162c-derive-watch.log`.

*Flag:* this is lean 7's one relaunch of the unfetched lines at the
same HEAD, applied to a dead driver rather than a hold, as at 155a; a
second failure fetches what finished and stops. The board's box idled
about 25 min with batch 9 done. The restart went to the friction log
with a candidate fix, a resume mode for `box-drive.sh`.

### 162c — the cohorts fetched (2026-11-27)

The derive's watcher read it done at 05:39Z, fetched it with exit 0 and
a non-empty `best-strategy.json`, and destroyed its box at 05:40Z. The
resume driver drained its 18 lines, each fetched with exit 0 and a
`summary.csv`, and destroyed its box at 08:18Z; `box-launch.sh list`
then read no box. The three board logs (the first driver's, batch 9's
fetch by hand, the resume driver's) name 27 distinct fetched batches,
each with exit 0 and a non-empty `summary.csv`. Box time: the board 8 h
1 min over two boxes (00:17 to 02:37Z, 02:37 to 08:18Z), the derive 5 h
21 min. No second failure, so lean 7's pause never came into play.

### 162d — the board merged and the roster table v9 (2026-11-27)

`scratch/146/merge.mjs`, run from the worktree on the three logs
joined, matched every batch to its plan row by argv: 12 rows pooled
from two stages (1+40, 41+80), the regen and fire-ablated doctrine rows
among them now, and 3 copied; the anchors beside them, in
`output/board-runs/162c/`. `--report` from the worktree: integrity PASS
on all 17 rows, 0 WARN, the measurement HEAD matching the tree; DRIFT 0
FAIL, 12 WARN. Its numbers are read at 162e (BALANCE, "the closing
board at v10").

*The roster table v9*, from the eight ARM rows: 26,985 battles in 52
buckets, the raw sidecars' row count the same. The registry's recipe,
`npm run roster:table -- <board-dir>`, was run first as written and
swept all 17 sidecars (43,444 battles), since every board row carries
`rosters.csv`; v8's provenance names the eight ARM rows, so the table
was rebuilt from those eight named, and the registry's recipe now names
them. Each newcomer is drafted by all three characters, counted in the
raw sidecars: the grenadier in 1,973 battles, the ninja 1,508, the
telekinetic 784, the cavalier 386. The coverage test failed on the four
PENDING lines with the new table (rule 5, the control) and passed, 14 of
14, once they were dropped.

### Between §161.5 and §162: the watcher skips scratch/ (2026-11-26)

**Asked.** The user's own `npm run dev` loads almost at once, where the
hidden pane twice took about 90 s to go live (161f-post2, 161.5b), and
`scratch/` need not be watched; signed: "Yes, ignore it".

**Measured** in the hidden Browser pane (0×0, `visibilityState`
visible), three cold `dev-preview` starts each way, from the resource
timings. With `scratch/` watched (9,208 files): the first stylesheet
held 3.6, 8.8 and 11.1 s after it was asked for, which the page did
1.2 and 2.3 s into the first two loads (the third was a reload by the
pane, its start unknown). A reload on the warm server: the stylesheet
in 13 ms and all 250 modules in 0.5 s, which matches what the user
sees from a server left running. With `**/scratch/**` added to
`server.watch.ignored`: 0.8, 1.5 and 0.7 s, the stylesheet asked for
2.0 to 2.8 s and every module in 3.6 to 3.7 s after the server process
started (its start read from `Win32_Process`, the page's from
`performance.timeOrigin`). The pre-commit hook's copy of the staged
files is under the OS temp folder, outside the watched tree, and no
stale Vite process was running.

**Not explained.** The two 90 s loads: no cold start today came near
the 30 s timeout, and the hidden pane at 0×0 loaded every time without
a resize. The scan's cost varied 3× across three starts minutes apart,
so a busier moment could stretch it, which would make the resize and
reload in the "not live" bullet's 2026-11-22 fact line a coincidence;
that is an inference, and the fact line is the user's.

**The fact line dropped**, the user's call ("You can go ahead and drop
it!"): the "not live" bullet no longer says a resize and a reload
brought the hidden pane live, and its stand-in wait reads "about a
second", as measured above.
