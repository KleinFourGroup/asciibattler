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
rarity, its growth key, and the pools, §153) and
[archive/worklog-phase-154.md](archive/worklog-phase-154.md) (the kits,
§154). Round 10's are `archive/worklog-phase-142.md` to
`archive/worklog-phase-147.md`.

## Phase 155 — the closing board

The kickoff's inputs, by pointer: the charter, ROADMAP §155;
META-ROADMAP §"Round 11 — The roster" (the round's exit); TODO's Round
11 rows under "Before the closing board" and "Dis Pater"; what §154
hands on, its close entry (archive/worklog-phase-154.md): the prior
table v9 stands as §155's, the roster table still to rebuild, act 3
easier on v9's bank, the parity gaps to read again;
`process/planning.md` "Phase kickoff". 151f, the units' lines, lands
here when the user writes them.

§154's candidate guard (its close's friction read: a kickoff audit's
line about how the code behaves names the file and line it read) is
held. The user, 2026-11-11: "let's hold off for a bit; that extra test
was a negligible inconvenience." The pattern, a claim written ahead of
its source, stays listed for Round 11's close.

After §154's close the user cut the officer's base mobility from 6 to
3, committed as is: "we'll refine it more in round 13" (BALANCE
2026-11-11, the officer at base mobility 3). The prior table v9 was
measured before the cut. The bot fielded the officer in none of v9's
hands, so the cut reaches the bank mainly through the generalissimo,
whose band holds an officer. On the study's hand that act-2 boss went
from 64 % cleared to 45 %, so the board reads the generalissimo on the
bank as a watch.

### The kickoff's audit, and the cut put to the user (2026-11-11)

Read at `98176860`: ROADMAP §155's charter, META-ROADMAP §"Round 11 —
The roster" (the exit), TODO's Round 11 rows, §154's close
(`archive/worklog-phase-154.md`), `balance:board -- --plan` at HEAD,
the signed sheet's last two amendments, the 146f and 150h boards on
disk with their queues and drive logs, BALANCE's integrity protocol,
artifact registry, per-kind target bands and run log from 146f on,
`process/measurement.md`, and Dis Pater's config, locale line and the
code that pays his tithe.

- **The board runs as at 150h.** `--plan` prints the same 17 rows: the
  thirteen act-alone rows at `--hops=11` (act 1), the King forced at act
  1 and the Queen at `--act=3`, four walk rows, the two anchors. 150h
  ran them as 25 batches (`scratch/150/150h/150h-board.queue`, made by
  `scratch/150/150h/make-queue.mjs`): the 15 box rows at n=40, then the
  ten checked rows to n=120. Only the four walk rows carry
  `--per-encounter`.
- **What pairs with 146f's board.** The charter reads paired same-seed
  deltas against 146f's (`output/board-runs/146f/`). The seeds and
  stream keys are the same, but runs part early: the draft holds no
  bandit since 151b, and a level-up draws eight values since 153a (six
  run streams realigned, WORKLOG 153a). The paired test still holds; it
  reads looser than 150h's against 146f, where the doctrine rows were
  byte-identical. 150h's board (`output/board-runs/150h/`) holds the
  sheet's current ARM refs, so against it the ARM rows' delta is §151
  to §154's alone; its doctrine rows are 146f's.
- **Where the sheet stands.** Last amended at 150h (2026-11-06): act
  1's ARM refs re-pinned, no band moved. On 150h's walk rows (BALANCE
  2026-11-06): seam 1 over its band on both (0.621 / 0.561 of max
  against 0.475–0.55), act 1's wall under on deploy (0.042 against
  0.15–0.38), the deploy walk's terminal reach over (0.783 against
  0.40–0.50) and both terminal walls under (0.117 / 0.171 against
  0.30–0.35); the pacing bands passed. §152 to §154 moved the game
  since, so act 1's bands are put on this board's numbers.
- **Act 1's cost.** The per-kind target (BALANCE "Per-kind target
  bands") was set from 146f's walk rows and is prose-checked. The
  board's two ARM walk rows give it in situ at n=120 each
  (`pacing.csv`, read by `scratch/153/act1-read.mjs` and
  `scratch/148/kind-cost.mjs`). 153f and 154a read act 1 on act-alone
  rows with `--per-encounter`, another shape: every turn target held,
  each kind's mean in its band, and two deploy costs under their bands,
  kept at 153f (the Vermin Lords 5.79 of 6, the rats' nest 1.73 of 2).
- **The parity gaps (C16).** The board's six act-alone ARM rows are
  154a's read at n=120 on the board's seeds. At 154a, under v8: the
  priest −4.2 regen / −8.3 deploy, the gambler −16.7 / −13.3.
- **The generalissimo.** One of act 2's two bosses with the witch hunt
  (`config/sectors.json`, the-start); each of his three stages fields
  one officer at power 3 (`config/encounters.json:719`, `:736`,
  `:751`). The walk rows meet him in situ, and the officer's base
  mobility 3 (`98176860`) is in the board's game; v9 was measured
  before it.
- **The wall watch (C17)** reads off the walk rows' terminal pair and
  act 3's wall by boss; the band's re-set is Round 22's. TODO's row
  names a cause read (a swing split by act), not in the cut.
- **Dis Pater.** His rule is a `kill` hook of `gainBits` 2
  (`config/daemons.json:209-221`). The battle tallies it raw and pays
  the turn's total as one reward portion the player may decline
  (`src/run/Run.ts:2690-2708`), through `gainBits` to `effectiveBits`,
  `Math.round(base × bitsGain × the bits lever)` (`src/run/Run.ts:2153`).
  At Escalation 0 to 2 the lever is 1 (`config/difficulty.json`,
  `config/escalation.json`), so two bits a kill is exact unless a
  bits-gain idol is held; at 3 to 5 it is 0.75. His sentence is in
  `config/daemons.json:211` and `locales/en/daemons.json:27`; a
  repo-wide grep for "tithes" finds no test that pins it. A run start
  shows it on the pre-turn panel (`src/ui/PreTurnScreen.ts:611`). A
  save holds daemon ids (`src/run/Run.ts:3757`), so the sentence is no
  snapshot field. `--grant` is run mode (`tests/fuzz/commands/args.ts:354`,
  `:861`). The protocol's recipe for a thin row (BALANCE "The rarity
  verification protocol", step 2): a paired same-seed grant arm at n=80
  on a fresh window with its own control; 88b's ran on 4001–4080
  (`output/box-batches/88b-grants.queue`). No queue under
  `output/box-batches/` or `scratch/` and no BALANCE line names a
  `--seed-offset=7000`.
- **The fresh derive.** The integrity protocol asks a re-pin board for
  a fresh `--search` derive (BALANCE "The board integrity protocol");
  150h skipped it because the game was 146f's. §152 to §154 moved the
  game, so it is due here. 146b's took 5 h 53 min
  (`scratch/146/146b-derive.queue`, the registry's line).
- **The roster table** is v7 (151b), v6's 150h rows less the bandit.
  The ARM's table (v8, v9) and the game have moved since, so it is
  stale by the registry's rule. v7 holds the officer in 24 battles; v9's
  bank fielded him in no hand, so the rebuild may need his PENDING
  acknowledgment back (`tests/roster-table-coverage.test.ts`).
- **The box.** 150h's board took 5 h 28 min on one `cpx42` at
  `--jobs=8`, 146f's 6 h 25 min; a walk ARM row about 20.5 min at n=40
  and 35 to 41 at n=80 (`output/box-batches/150h-board-drive.log`);
  154a's act-alone ARM rows ran at 150h's pace (six at n=120 in 2 h 25
  min). The price was 0.1314 an hour at §146's kickoff (2026-11-02,
  euros, inferred), not re-read.
- **TODO drift.** Three Round 11 rows were done and still open:
  BALANCE's header (150a), the arbitration's walk loss (150d to 150g),
  power by rarity (153b). Ticked in this commit with their pointers.
- **151f.** Six units carry a description, the six beasts
  (`config/units.json`); the user's 23 lines are not written, so it
  stays carried.

**The cut, put to the user** (unsigned):

- **155a — the cohorts on the box** (`none`). At the cut's HEAD,
  pushed, from a detached worktree. Box 1: the full board, 150h's
  queue line for line (25 batches), then Dis Pater's pair, a control
  and `--grant=dis-pater`, the soldier on the deploy vector with the
  ARM on the three-act walk, n=80 on seeds 7001–7080. Box 2: the fresh
  derive, its own cohort. The anchors local at the same HEAD. Step
  zero: the grant arm at one seed locally, holding Dis Pater where the
  control does not. Exit: every batch fetched with exit 0, its manifest
  at the HEAD; `--report`'s VERDICT PASS.
- **155b — the roster table rebuilt** (`none`). From the eight ARM
  rows: v8 and BALANCE's registry row. Exit: the coverage guard green,
  with the officer's PENDING line back if no ARM row drafts him; a
  sampled draw loads and plays; at most 55 buckets.
- **155c — the board read** (`stop`, the decision point). The board
  against 146f's, paired on seeds 1 to 120, and against 150h's; act 1
  by encounter (turns, pool an instance, cap share) against the turn
  targets and the cost bands, its wall by boss, seam 1; the parity
  gaps; the generalissimo in situ against 150h's and the witch hunt;
  the wall watch; acts 2 and 3 recorded; the derive's ceiling; Dis
  Pater's paired margin. Put: act 1's bands in two arms, (A) re-pinned
  at this board's values with no content moved, or (B) set as targets
  with act 1's misses tuned to them (155d, 155e); each parity gap's
  disposition; whether v9 stands after the officer's cut; Dis Pater's
  disposition and his sentence in two wordings.
- **155d — act 1 tuned** (`stop`; only under arm B). The fights that
  miss, by forced isolation at the rebuilt table's rosters, the levers
  baked, held-out seeds, the corpus re-recorded; the user plays act 1.
  Step zero decides whether TODO's `--set` path into one encounter is
  built first, as an inserted step.
- **155e — the verify board** (`none`; only after 155d). 155a's board
  at 155d's HEAD, the roster table rebuilt from it. Exit: VERDICT PASS;
  act 1 in its bands, or the miss to the user.
- **155f — Dis Pater's sentence** (`batch`). The wording signed at
  155c, in the config and the locale line. Read script: start a run
  with `?daemon=dis-pater`; the pre-turn panel's ◈ line reads the new
  sentence; wrong is the old line, a raw key, or a wrapped line.
- **155g — the sheet amended** (`stop`). Act 1's refs, seam 1, act 1's
  wall and the forced King and Queen re-pinned at the last board's
  values by 155c's arm; acts 2 and 3 in BALANCE's run log for Rounds
  21 and 22; the terminal pair and the pacing bands held. Under arm (A)
  the values are the ones 155c puts, so the user may make this read
  `none` there.

*Predictions.* No snapshot bump (World v39, Run v51) and no RNG stream.
155b, 155e's table and 155g stage `tests/fuzz/`, so the fuzz smoke and
the `--jobs` parity fire; 155d and 155f stage `config/`, so the smoke
fires; 155a and 155c write docs alone. The corpus re-records at 155d
only; 155f's line moves no run. Box: 155a, and 155e if it runs.

*Leans put with it.*

1. The box: `cpx42` at `--jobs=8`, two side by side: the board and Dis
   Pater's pair on one (7 to 8 h: the board 5.5 to 6.5, the pair about
   1.3), the derive on the other (5.5 to 7 h); 12.5 to 15 box hours,
   1.65 to 2.0 at the last price read. 155e, if it runs, about 6 h
   more, about 0.85.
2. The fresh derive in; deploying a new vector stays its own decision.
   Without it: one box, about 1.0, the protocol's re-pin leg unmet and
   named at 155g.
3. Dis Pater read at Escalation 0 only, the board's level, where his
   tithe is two bits a kill exactly; the lever at 3 to 5 is the
   sentence's matter. A pair at Escalation 3 would add about 1.3 h.
4. v9 stands into 155c; whether it still stands after the officer's
   cut is put there with the generalissimo's read, and a rebuild (v9
   took 4 h 54 min of box) only then.
5. The cohorts driven from a detached worktree, so the checkout stays
   free.
6. The unattended calls, as at 150h: a driver hold gets one relaunch of
   the unfetched lines at the same HEAD; a second hold destroys the box
   after fetching what finished, and stops.
7. Left out: the per-kind cost bands as a sheet check (prose-checked,
   as now); the wall's cause read; the `--set` path unless 155d needs
   it.

*The stretch the cut opens:* 155a and 155b, to the stop at 155c.

### The cut signed, with an overnight chain (2026-11-11)

The user, before the sign, proposed a gamble on a box run: the two
boxes finish at about 2 a.m. their time, so if the board read leans to
a retune, the session tunes act 1 as best it can and launches the
verify board, and the morning holds the tunes to sign with a board
about to land. The session's answer, put before the sign: on board,
under rules signed in advance (`process/measurement.md`, "Watching a
batch"); the user plays act 1 after the verify board launches, and a
finding in play reopens it, which is the gamble. Its best guess from
153f's and 154a's act-alone rows: seam 1 and act 1's wall are likely
band calls, since the two vectors straddled the seam band at 153f
(0.598 deploy, 0.439 regen, against 0.475–0.55; 1.1 points apart at
146f, 6.3 at 153f) and a content tune moves both one way; the wolf's
Harry is the one §154 change in act 1's fights (the wolfpack, the
canids, the bear's fight), so the canids (2.02 deploy against 2–6) and
the wolfpack (2.21) are the likeliest per-fight tunes; the rats' nest
and the Vermin Lords, kept at 153f, kept again under rule 1. Zero to
two fights.

**Signed** (the user: "I'm quite happy with all of those, Claude! 😁
Signing all of these!"): the cut, its seven leans, and the chain:

1. *Which fight is tuned:* only one whose value pooled over the two ARM
   walk rows (weighted by instances) is outside its turn target or cost
   band. A one-row miss in band pooled is kept and listed, as at 153f.
2. *How:* the fight's own levers (wave size, level budget, pool), baked
   as at 146e and 153e: an isolation sweep, then a held-out check, on
   the box. A fight not landed after two sweep rounds stays untuned and
   listed.
3. *Never overnight:* seam 1, act 1's wall, a lever outside one fight;
   acts 2 and 3 recorded only.
4. *Pauses:* a lean to rebuild v9 after the generalissimo's read stops
   the chain before any launch, since the verify board would run under
   a table about to change. Driver holds as lean 6. The context meter's
   hand-off at a commit before the launch stops it there with hand-off
   notes, since a turn a finished box wakes cannot start a session.
   No fight qualifying launches nothing; the morning is 155c's stop.
5. *Flags:* every call the session makes is written here for the
   morning read.

### 155a's step zero (2026-11-11)

The grant arm's argv at one seed, locally at `d99fc976` with the cut's
docs uncommitted, `--hops=2` to keep it short: seed 7001 with and
without `--grant=dis-pater`, the same 5 battles and 34 kills on both,
the grant's bits 105 against the control's 37, 68 more, two a kill. So
the grant holds him and pays two bits a kill at Escalation 0.
`scratch/155/make-queue.mjs` made the queues from `--plan`: the board's
25 lines equal `scratch/150/150h/150h-board.queue`'s but the header,
and the pair appended (`scratch/155/155a-board.queue`); the derive's
line is 146b's (`scratch/155/155a-derive.queue`).

### 155a — the cohorts launched (2026-11-11)

*Launched* at `5d3bcba8`, pushed, from a detached worktree at
`../asciibattler-155a` with a `node_modules` junction: the board's 25
lines and Dis Pater's pair (`scratch/155/155a-board.queue`, 27 lines) on
one `cpx42` from 23:46Z, after the driver's parity test, and the fresh
derive on a second from 23:50Z. Drive logs in the worktree's
`output/box-batches/155a-board-drive.log` and `155a-derive-drive.log`.
The anchors ran locally in the worktree at the same HEAD, clean
manifests: pure-random 6 of 40, greedy 7 of 40 (150h: 11 and 7).

### 155a — the cohorts back (2026-11-12)

*The derive* drained at 04:06Z: one batch, exit 0, `best-strategy.json`
present, the box destroyed by its driver; 4 h 15 min of play against a
prediction of 5.5 to 7 h (146b's took 5 h 53 min).

*The board's driver died with the PC.* Batches 1 to 25 were fetched and
verified by 05:05Z, and batch 26, Dis Pater's control, launched then. At
05:29Z Windows restarted the PC to finish an update: System event 1074
from the update orchestrator, "Operating System: Service pack (Planned)",
for KB5132061, then a second servicing restart at 05:32Z. The System log
holds no Kernel-Power 41, no 6008, no bugcheck and no WHEA event that
night, so it was no crash. The driver's log ends at 05:25:21Z, before
any stand-down, so the box idled with batch 26 finished on it.

*Recovered* at 13:20Z, as measurement.md's crash steps say: both trees
clean, no driver left running. The box still held batch 26, exit 0, and
`scripts/box-batch.sh <box> status|fetch` brought it back: 80 rows, the
manifest at `5d3bcba8`, seeds 7001 to 7080. Line 27, the grant arm, then
ran on the same box by `box-batch.sh run` from the worktree, 13:21Z to
14:13Z, fetched with exit 0, and the box was destroyed on that verified
fetch (`scratch/155/155a-recover.log`); `hcloud server list` was empty
after. *Flag:* that is lean 6's one relaunch of the unfetched lines at
the same HEAD, applied to a dead driver rather than a hold, with the
user's go-ahead to recover.

*Box time:* the board's box 14 h 28 min, about 7.5 h of it idle after
batch 26; the derive's 4 h 17 min; 18.75 h, about 2.45 at 0.1314 an hour
(the price not re-read), against the lean's 12.5 to 15 h and 1.65 to
2.0. The overrun is the idle box.

*Merged:* `scratch/146/merge.mjs` pooled the 25 board batches into 15
rows by each manifest's argv (ten merged from two stages, five copied),
with the two anchors beside them, in `output/board-runs/155a/`. The
merged rows' wins equal a second count, taken off the two stages'
`summary.csv` by hand, on all eight act-alone ARM and wall rows.
`--report`: integrity PASS on all 17 rows, 0 WARN; DRIFT 0 FAIL, 16
WARN, read at 155c. So 155a's exit holds.

The 28 batch dirs, the board and the anchors are copied into the
checkout's `output/` (`diff -rq` identical), the three logs into
`scratch/155/`. The worktree came out with its junction unlinked first:
the checkout's `node_modules` at 133 entries before and after, `npm ls`
clean. The restart went to the friction log. `process/measurement.md`'s
overnight checks cover idle-sleep and not a pending update restart; a
line there is the user's call, and this is its first occurrence.

### 155b — the roster table rebuilt (2026-11-12)

`npm run roster:table` over the eight ARM rows of
`output/board-runs/155a/` writes v8: 27,485 battles in 52 buckets (the
cut's ceiling 55), measured at `5d3bcba8`. The officer is in 856
battles, the soldier's 585, the priest's 153 and the gambler's 118 (v7:
24, all the soldier's), so his PENDING line is not needed; the kickoff
named it as possible because v9's bank fielded him in no hand. The
coverage guard passes (14 tests), and the table's and the sampled flag's
tests too (22, under `vitest.fuzz.config.ts`); `--roster=sampled:2:5
--act=3` loads and plays a seed (exit 0). BALANCE's registry row is at
v8.

### 155c — the board read, and the calls put (2026-11-12)

The numbers are in BALANCE (2026-11-12, the closing board). What they
say:

1. **Act 1's fights sit where the user put them; its seam and wall do
   not.** Pooled over the two ARM walk rows at n=120 each, every act-1
   fight is inside its turn target and its cost band. The canids (2.25)
   and the wolfpack (2.61), the likeliest tunes at the sign, are in.
   Seam 1 straddles its band by 7.7 points (regen 16.73, deploy 24.46
   of 40, band 19–22), and act 1's wall is under on deploy (0.034, band
   0.15–0.38; regen 0.227, in). The regen seam's whole drop since 150h
   is at 153f, the act-1 tune to the cost bands (−6.38 ± 1.23), and flat
   after. So on the regen vector two signed targets disagree: fights at
   their cost bands leave the seam under its band, and a tune to the
   seam would move fights out of theirs.
2. **The overnight chain launched nothing.** Rule 1's test, on the full
   rows, finds no act-1 fight outside its target or band pooled.
3. **The priest's regen row fell, alone.** 80 → 63 against 154a on the
   same seeds (21 : 4, p 0.0009), the extra defeats at the King (15 →
   21) and the bear (14 → 22). The soldier's rows, the gambler's and
   the priest's deploy row did not move. Between 154a and this board
   ride §154's kits, v9 and the officer's base mobility, none isolated.
   Against the soldier: the priest −18.3 / −9.2, the gambler −18.3 /
   −11.7, each outside ±5 and told apart.
4. **The generalissimo is no harder in situ.** Deaths 14 of 34 → 15 of
   32 on regen and 3 of 48 → 3 of 52 on deploy; his won fights end in
   4.3 turns against 5.0, under the boss target, on both rows. The
   officer's cut reaches v9 through the bank's generalissimo fights, and
   in situ that fight has not moved.
5. **Act 3's boss is easier, and the wall watch wider.** On deploy the
   Queen kills 3 of 95 against 11 of 94, and her forced row clears 49 of
   120 against 31 (p 0.0014). The terminal walls are 0.172 and 0.032
   against 0.30–0.35. Recorded for Round 22 (C17), with acts 2 and 3 by
   encounter (BALANCE) for Round 21.
6. **The derive finds nothing above the deployed vector:** 57.7 % on
   training, 1 of 6 held-out, against the deployed vector's 60 % on the
   doctrine walk row. The searched-upper leg is met, and there is no
   vector to deploy.
7. **Dis Pater held free is net-positive.** +0.087 (11 : 4, z 1.81),
   +2.23 pool, and v9's +22.9 at n=88, signable, agree in sign. TODO's
   question, whether holding him is net-negative, reads no: he funds
   more shopping (5.30 buys a run against 4.42) and still nets positive.
8. Two doctrine readings moved and are recorded, not called: the
   fire-ablated row 27 → 17 of 40 (p 0.021, one of 15 tests), so the
   fire channel reads 0.275 against 0.05–0.15; and the deploy vector
   shops in 73 % of act-alone runs against 0.80–1.00.

**The calls put to the user:**

1. *Act 1's bands*, (A) re-pinned at this board's values with no
   content moved, or (B) set as targets with act 1's misses tuned to
   them. **Lean A.** Every fight is at its turn target and cost band.
   The misses are seam 1 and the deploy wall, which follow from the
   fights and from each vector's play, and a tune to them would move
   fights out of the per-kind bands. Under A, 155d and 155e drop, and
   155g re-pins seam 1 and act 1's wall at these values; whether as one
   band over both rows or one a vector is 155g's to put.
2. *The parity gaps.* The gambler's two and the priest's deploy row are
   unchanged since 154a: **lean carry**, held as TODO's row has them.
   The priest's regen drop is new: **lean a cause read**, an inserted
   step, the priest's regen row at this HEAD with the ARM on v8
   (`--prior-table=` the v8 file from `07ce8ed5`), n=120, about 40 min
   of box. Back near 80, the drop is the table's; still near 63, it is
   the kits' or the officer's. The alternative is to carry it as a
   watch.
3. *v9.* **Lean: it stands**, since the generalissimo did not move in
   situ; the priest's cause read could reopen it for the priest alone.
4. *Dis Pater.* **Lean hold**, no price or kit change, and TODO's grant
   row closes. His sentence, for 155f, in two wordings that name the
   base rate and leave the scaling to Escalation's own line ("You earn
   fewer bits"): (a) "Each kill tithes 2 bits from below, paid at the
   turn's end." (b) "Kills tithe bits from below: 2 apiece, paid as one
   sum at the turn's end." **Lean (b)**: "one sum" is what makes the
   rounding at Escalation 3 to 5 read true (one kill pays 2, two pay 3).
5. *Tunes to sign:* none.

*Flags.* Rule 1's test ran at 13:30Z on the full rows, after the
recovery, not overnight; the n=40 stages read the same at 04:10Z. The
doctrine rows' identity with 146f's is 150h's finding, not re-checked
today.

### The calls signed (2026-11-12)

The user: "Signing all of your leans, Claude! 😁" So: act 1's bands in
arm A, re-pinned at the board's values with no content moved, and 155d
and 155e not run; the gambler's two gaps and the priest's deploy gap
carried as TODO's row holds them; the priest's regen drop gets a cause
read, inserted as 155h (`none`); v9 stands, the cause read able to
reopen it for the priest alone; Dis Pater held with no change, TODO's
grant row closed; his sentence in wording (b), "Kills tithe bits from
below: 2 apiece, paid as one sum at the turn's end." 155g stays a stop,
since only the user downgrades a read.

### 155h's step zero (2026-11-12)

v8 comes out of git at `07ce8ed5` (`scratch/155/prior-table-v8.json`),
its provenance `3f051b43`, 36 items, the registry's account of it.
`--prior-table=<path>` is a run-mode dial that needs `--arbitrate` and a
non-zero λ (`tests/fuzz/commands/args.ts:451`, `:583`), as the board's
rows have. The priest's regen row's argv at seeds 1 and 2, locally:
under v9 it reproduces the board's two runs (117 bits, pool 31; a defeat
at hop 9, 77 bits); under v8 the same 568 decisions carry a prior bonus
summing to 84.4 against 62.2, and both seeds end as under v9. So the
flag reads the table, and the manifest's argv holds it. The box takes
the table by `--carry`, as measurement.md says for an input the commit
does not hold.
