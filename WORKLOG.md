# WORKLOG — Round 11 (The roster)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 11's phases so far:
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) (the
kickoff, §148, and the stat sheet, §149). Round 10's are
`archive/worklog-phase-142.md` to `archive/worklog-phase-147.md`.

## Phase 150 — the board's instruments

The kickoff's inputs, by pointer: the charter, ROADMAP §150; TODO's
Round 11 rows "Before the closing board" (BALANCE's header at its
700-line cap, the ceiling deltas' label, the arbitration's walk loss,
the skill gradient's leg); `process/planning.md` "Phase kickoff", and
`process/measurement.md` before a box is sized.

### The kickoff's audit, and the cut put to the user (2026-11-05, session 65cfb3a3)

Read at `a7ca0baf`.

- *BALANCE's header* is 700 lines of its 700 (`## Run log` at line 701).
  By section: the primer 88, Protocol v2 (§68) 115, Caveats 111, the
  lever 59, the board integrity protocol 45, the 5-step loop 36, Commands
  31, the rarity protocol 29, the funnel and tiers 28, the metric 25, the
  derived-artifact registry 22, "What changed" 21, Mechanics 19, the
  economy metrics 19, the signal 17, the per-kind bands 13, the dwm leak
  11. The candidates to demote are the sections a session no longer
  works from; the step reads each.
- *The ceiling deltas* (`tests/fuzz/board/board.ts:521-540`): each
  subtracts the doctrine control's win rate from the ARM row's, both
  whole rows (120 runs against 40), under a `source` line that says
  "paired same-seed".
- *The skill gradient* (`board.ts:572-600`): `floor < mid` strictly, so a
  tie WARNs, and the WARN calls the instrument broken; BALANCE's board
  protocol calls a flip on that leg expected noise.
- *The arbitration's walk loss*, re-read on 146f's rows
  (`output/board-runs/146f/`, this machine; `scratch/149/pair-peek.mjs`):
  on the 40 shared seeds of the walk on deploy, doctrine won 15 the ARM
  lost and the ARM 1 doctrine lost (146b: 12 and 0), an exact sign test
  p ≈ 0.0005. The ARM row's `decisions.csv` holds 94,735 candidate rows
  (22,006 chosen) with each candidate's score, its margin over the null
  arm, the horizon and the hops remaining; the doctrine rows log no
  decisions. Raw override counts a seed are lower in the lost seeds
  (packet fires before a turn 4.27, port buys 3.27, against 7.15 and 6.77
  in the seeds both won), but those runs are shorter, so the read must be
  a rate by hop.

**The cut** (no snapshot bump, no RNG stream, no config change; no box
unless 150d's stop sizes one):

- **150a — BALANCE's header** (`none`). Sections no longer worked from
  move to an archive file with a pointer each, the cap kept at 700. Exit:
  the header with room under its cap; each moved section findable from a
  pointer; the docs test green. No fuzz smoke.
- **150b — the ceiling deltas** (`none`). Exit: the label true to its
  arithmetic, pinned on a fixture where paired and pooled differ, the old
  arithmetic failing it. Fuzz smoke fires (`tests/fuzz/`).
- **150c — the skill gradient's leg** (`none`). Exit: the leg read
  against its noise, a tie no longer a WARN, the comment and WARN text
  in BALANCE's words, pinned on planted cases. Fuzz smoke fires.
- **150d — the arbitration's walk loss** (`stop`). From the decision
  log, the ARM's choices by site and by hops remaining in the seeds it
  lost and doctrine won, against those both won, as rates by hop; the
  rollout's horizon against the hops a three-act walk leaves. The stop
  brings where the loss sits and a fix's scope, or what the log cannot
  tell and the box run that would.

*Why this order:* the header before the retune writes BALANCE most; the
two small instruments next; the investigation last, since its stop may
change the ARM, which moves every ARM row and must come before §152's box
reads.

**The calls, with the session's leans:**

1. *The cut and its reads* as above.
2. *The ceiling deltas:* computed on the shared seeds, as the label and
   the protocol mean them (146b's two readings differed by up to 0.058),
   rather than relabelled as pooled.
3. *The gradient's leg:* a one-sided Fisher test, WARN only when greedy
   sits below random at p < 0.05, a tie fine; rather than running the
   anchors at more seeds on every board.
4. *150d's reach:* the log first, on this machine; a box ablation only
   if the log names a site, sized at that stop.

### The hand-off after §150's kickoff (2026-11-05, session 65cfb3a3)

The session reached the hand-off trigger at the kickoff's commit
(`1912235b`). Done: 147f signed and §148 and §149 closed and pushed
(`a7ca0baf`); §150's audit and cut written above. Open, for the next
session to put to the user again, since a session started from a card
answers only in its second turn:

- *§150's cut and its four calls* (the entry above), unsigned: the cut
  150a to 150d with its reads; the ceiling deltas on the shared seeds;
  the gradient's leg by a one-sided Fisher test with ties fine; 150d's
  reach, the decision log first on this machine.

Tools no doc names: `scratch/149/pair-peek.mjs` pairs 146f's walk rows on
the shared seeds and counts the ARM's overrides by site from
`output/board-runs/146f/arb-walk-deploy/decisions.csv` (its CSV holds
quoted fields, which the peek's parser handles); it is 150d's starting
point. `scratch/149/swing.ts` and `report.mjs` re-run the strike check
after §152. Nothing is half-built; the commits since `a7ca0baf` are
unpushed docs.

### The cut signed (2026-11-05, session d36a1828)

Put again at the session's first turn, with two premises checked in
146f's manifests: the doctrine rows and both anchors run seeds 1 to 40,
the ARM rows 1 to 120, and every `summary.csv` row carries its seed. The
session agreed with calls 1, 2 and 4 and differed on call 3: the anchors
share their seeds, so the exact sign test on the seeds where they
disagree (the walk-loss read's test, on 150b's per-seed join), one-sided
at p < 0.05, a tie fine. The user signed "fully"; the session reads that
as the cut as put, call 3 by the sign test, and names the reading at
150d's stop.

### 150a — BALANCE's header (2026-11-05)

*Step zero:* no doc or code links into a header section by anchor;
the sections named elsewhere by title (Protocol v2, the consumption
table, the shipping checklist, the pool-ratio confound, the dwm leak)
stay. Moved, verbatim, to `archive/balance-header.md` with a pointer
where each stood: What changed (21 lines, the Phase X turn to authored
encounters), the funnel + tiers (28, the X sweep's funnel and the
`--preset` table, whose live sizes are `PRESETS` in
`tests/fuzz/search.ts`) and Mechanics (19, the X sweep's internals,
its overfitting rules restated by the 5-step loop's step 5). The header
went from 700 lines to 642, 58 under the cap.

Kept, though weighed: the consumption contract's table (the instrument
registry, user-signed, names it the authoritative list, so moving it
would edit a signed row); the dwm leak (a live caution for a local
`--jobs` run with no other home); Caveats (the enforceable list, worked
from). *Oracle:* every line of the old header is in the new header or
the archive, the two repointed links and the heading levels aside; a
planted control (one moved line dropped) reads one line lost. The docs
test is green (20). `scratch/150/move-header.mjs` did the move.

### 150b — the ceiling deltas (2026-11-05)

*Step zero:* `evaluateBoard` and the verdict read a delta off two
`InstrumentMetrics`, which held no per-seed outcome, and the summary rows
carry their seed. Built: `InstrumentMetrics.winsBySeed` (filled by
`computeMetrics`), `BoardDelta.paired`, and `deltaValue`, which both
readers call; a paired delta is each row's win rate on the seeds both
ran, its report row naming the count of shared seeds, and a pair of found
rows with no shared seed FAILs the verdict as unmeasurable. The four
ceiling deltas are paired, their title and source line saying so; the
fire channel, two doctrine rows on the same 40 seeds, stays a whole-row
delta. The hand-built metrics in the verdict tests gained `winsBySeed`,
since without it the paired deltas fail closed (the first run: three
tests red, as predicted).

*Pins:* a fixture where the sign flips (an ARM row at 120 seeds,
pooled +0.25; on seeds 1 to 40, −0.25) and a verdict with no shared seed.
*Control:* with the pooled arithmetic planted back, both pins fail.
*The re-read:* 146f's four, by the board code and by a second reader on
the raw CSVs, agree (BALANCE.md 2026-11-05); 146b's rows reproduce the
figures 146b recorded both ways.

**For 150d:** the seeds one arm won and the other lost at 146f, ARM
against doctrine: act 1 on regen 0 to 8, act 1 on deploy 0 to 6, the
walk on regen 2 to 5, the walk on deploy 1 to 15. The act-1 rows are the
11-hop shape, so the ARM loses there too (exact sign tests, one-sided:
p 0.004 and 0.016), not on the long walk alone; TODO's row had act 1 at
146b at 5 against 1. The rollout's horizon against a three-act walk's
hops may not be where the loss sits.

### 150c — the skill gradient's leg (2026-11-05)

*Step zero:* both anchors run seeds 1 to 40 (146f's manifests), and
150b's `winsBySeed` gives the per-seed join. The docstring's "a WARN on
a signing board blocks the signing" is in no signed decision: 86e3's
landing (`archive/post-83-worklog.md`) has the check "never gates", and
BALANCE has HEALTH never gating, so the docstring drops it.

Built: `signTestUpper` (the one-sided exact binomial tail) and
`GRADIENT_FLOOR_P` (0.05); the random < greedy leg pairs the anchors'
seeds, counts the seeds each won alone, and WARNs only when random's
count is the larger at p < 0.05; it reads N/A without per-seed outcomes
or a shared seed. The report row names the rates, the split and p. The
docstring and BALANCE's board-protocol bullet say the same thing; the
greedy < ARM leg is unchanged. *Pins:* the tail against five hand-worked
binomial sums; a tie on the same seeds and on different seeds, a 4-to-0
split ok, a 5-to-0 split WARN, a 12-to-2 split WARN at p 0.006.
*Controls:* the old strict rule planted back fails the tie pin; the tail
off by one (`i > k`) fails three pins. *The re-read* on four recorded
boards (BALANCE.md 2026-11-05): all ok, where the old rule WARNed on
three. `scratch/150/gradient-boards.ts` reads a board dir's gradient.

One figure differs from TODO's record: TODO (and 147's audit) had 92h's
anchors tied at 0.275 each; `output/board-runs/92h/` reads 0.100 and
0.125 (4 and 5 of 40), and 92h's own report
(`output/board-runs/92h-report.txt`) printed the same, ok. So 92h did not
tie, and the leg had WARNed on 94h, 146b and 146f, not on every board
since 92h.

### 150d — the arbitration's loss, located (2026-11-05, at its stop)

Read from 146f's rows on this machine (`output/board-runs/146f/`), the
four ARM rows against their doctrine controls on seeds 1 to 40. The
scripts: `scratch/150/walk-loss.mjs` (classes, summaries side by side,
the decision log by site, rollout margins, where the runs part) and
`scratch/150/by-act.mjs` (the walk rows by act); their output is in
`scratch/150/out/` (ignored, this machine).

*The premise, corrected by 150b:* the ARM loses act 1 as well (seeds
doctrine alone won against the ARM alone: 8 to 0 on regen, 6 to 0 on
deploy, 5 to 2 and 15 to 1 on the walks). Every live decision's rollout
is one battle long (`horizonBattles: 1`, K = 2) on every shape, so the
walk's extra hops do not change the horizon a decision sees; the walk
only has more turns over which a per-turn deficit adds up.

*Where the lost runs end:* at a boss. Act 1 on regen, all 8 at hop 10;
on deploy 5 of 6; the walk on deploy at act 1's boss 5, act 2's 4 and
act 3's 3, and three short of a boss (act 1 hop 3, act 2 hop 9, act 3
hop 8).

*What the ARM does differently, a battle:*

- **Four sites have "pass" as the null arm**: `grant:empower`,
  `grant:redraw`, `packetFire:preTurn` and `packetFire:outOfBattle`.
  The ε gate (2σ of the A/A noise, 3.277 and 5.476, signed at 85e) lets
  through 1.6 to 2.4 % of empower asks, 2.7 to 5.4 % of redraws, 9 to
  13 % of pre-turn fire asks and at most 1 % of out-of-battle ones. The
  rollouts read the average challenger above pass at all four, by many
  standard errors: an empower +0.13 to +0.16 pool a battle (se 0.005 to
  0.008), a pre-turn fire +0.33 to +0.53 (se 0.014 to 0.024), an
  out-of-battle fire +0.39 to +0.67; a redraw +0.02 to +0.11, past two
  standard errors on two rows of four. On 23 to 48 % of these asks the
  best challenger is positive and under ε. Doctrine, at the same asks, empowers every time (`level:hi` returns
  a position whenever a grant and a hand exist, `selectEmpowerPosition`),
  redraws by `level:2` and fires by the base vector.
- **The rollouts assume doctrine's play.** Every rollout walks the
  future with the doctrine defaults (`DEFAULT_ROLLOUT_REDRAW` /
  `_EMPOWER`, `walker.ts`), the base's fires and buy-all at later docks
  (`walkPolicyOverlay`). The grant site turns the grant walk off for its
  own decision only. So the ARM judges every node, buy and event against
  a future where it empowers each turn and fires like doctrine, and then
  passes those actions live.
- **The summaries agree.** On the walk on deploy the ARM fires 0.117
  packets a battle against doctrine's 0.293 and buys at ports 0.10 a
  battle against 0.21; it ends with 262 bits against 425. On act 1 it
  buys more than doctrine (1.52 against 0.75 on deploy) and fires less
  (0.155 against 0.198 a battle), ending with fewer bits (78 against
  108): packets bought and held.
- **By class,** the lost seeds sit at the low end on every acting site
  (empower overrides 0.008 to 0.016 a battle against 0.019 to 0.022 in
  seeds both won; port buys lower), and on the walk on deploy the lost
  seeds' pre-turn fire overrides fall in acts 2 and 3 (0.059 and 0.057 a
  battle against 0.148 and 0.070). These are small counts and can be
  effect as well as cause.
- **Where the runs part:** within the first five battles of act 1 in
  every seed, lost or won alike (`rosters.csv`, the first battle whose
  fielded hand differs), so the parting point does not tell the lost
  seeds from the rest.

*What the log cannot tell:* that the pass-null sites cause the loss. The
lost seeds are where the ARM acted least, which is consistent with a
per-turn deficit tipping a boss fight, but no per-seed reading separates
cause from effect once the runs part in the first battles. A paired run
of the ARM with the change would tell.

*A fix's scope, for the user's call:* the coherence rule the node and
event sites already follow (the base's pick is the null arm), extended
to the four pass-null sites: null = doctrine's nominee (`level:hi`'s
empower, `level:2`'s redraw, the base's fire), challengers = the other
candidates and pass. The ARM would then act as doctrine does unless a
challenger beats it by ε. The port site's "stop buying" null is a
fifth, separate case (its own 85b design), left out of the first cut.
A change to the ARM moves every ARM row, so taking it as the default
means a full board, the sheet's ARM refs re-pinned, and the prior table
and the roster table re-derived (BALANCE's derived-artifact registry);
all before §152's box reads.

*The box run that would tell:* the nominee null behind a flag (default
off, the ARM rows byte-identical), on the four ceiling shapes at seeds 1
to 40, with the four doctrine controls at the same HEAD. At 146f's
per-run times that is about 6.8 CPU-hours for the four ARM rows and 1.6
for the controls. Pre-registered read: the four paired ceiling deltas,
now −0.200, −0.150, −0.075 and −0.350, and the sign counts beside them.

### 150d signed; 150e and 150f inserted (2026-11-05)

The user signed the lean ("Signing your lean"; "Box use is approved"):
the base's pick as the null arm at the four pass-null sites, behind a
flag off by default; the port site out of this cut; the four ceiling
shapes at seeds 1 to 40 on the box with the four doctrine controls at
the same HEAD. ROADMAP gains 150e (the flag, `none`, its byte-identity
with the flag off the oracle) and 150f (the cohort, `stop`: the paired
deltas, and whether the flag becomes the default, which moves every ARM
row).

### 150e — the nominee null behind a flag (2026-11-05)

*Step zero:* the driver evaluated the null arm as "apply nothing" with no
hook for another; the base's fire (`pickPacketFireScored`) and both level
grant policies draw no RNG, so naming the nominee costs the run's streams
nothing; the doctrine policies the rollouts walk with are
`DEFAULT_ROLLOUT_REDRAW` (`level:2`) and `DEFAULT_ROLLOUT_EMPOWER`
(`level:hi`), the same as the doctrine rows' flags; both board vectors
(92c2 and 59-regen) carry a fire group. `--jobs` children take the
parent's argv, so a run-mode dial reaches them unchanged.

Built: `decide` takes an optional `nullApply` and `nullLabel` (the log's
readers key the null arm on index 0, not its label); `ArbitratedConfig`
gains `nullArm: 'pass' | 'nominee'` (default pass); under `nominee` the
grant site's null arm is the doctrine policy's pick and `pass` a
challenger, the fire site's null arm is the base's fire and `hold` a
challenger, each nominee taken out of the challenger list it is part of
(a throw if it is not, which no run hit). A base that holds, or a policy
that passes, leaves the pass null. The CLI dial is `--arb-null=pass|nominee`
(requires `--arbitrate`, refused with `--search`, the launch line naming
it). The port site keeps its null.

*Pins:* the empower and redraw nominees against the doctrine selectors
(level:hi restated in the test), a tie keeping the nominee, pass and hold
winning past ε, a holding base and the default leaving the logs as
shipped; the dial's parse and guards. *Control:* with the dial planted
off, the three nominee pins fail. *The oracle:* the ARM on act 1 deploy
(3 seeds), act 1 regen (2) and the walk on deploy (2), captured at
`64fed7f8` from a detached worktree and again on the new code with the
dial off: summary, decisions, rosters and pacing byte-identical, 10 of
10. Its control, the same shapes with `--arb-null=nominee`: 10 of 10
differ, the empower nominee standing on 187 of 195 asks and the redraw's
on 56 of 59. `scratch/150/oracle.sh` and `compare.sh` ran it.

### 150f — the cohort (2026-11-05, at its stop)

The box ran `output/box-batches/150f-nominee.queue` at `66e221f1` (clean
tree, every batch seeds 1 to 40; cpx42, `--jobs=8`; 19:47 to 21:03 UTC,
the box destroyed): the four ARM rows with `--arb-null=nominee` and the
four doctrine controls, each with the board's own argv. Batches
`20261105-194749` (arb-deploy), `-195455` (arb-regen), `-200324`
(arb-walk-deploy), `-202613` (arb-walk-regen), `-204503` (deploy),
`-204721` (regen), `-204943` (walk-deploy), `-205611` (walk-regen), all
`-66e221f1`. Read by `scratch/150/cohort-read.ts` (the board's own
`deltaValue`, the reader first checked against 146f's known figures) and
`scratch/150/walk-loss.mjs`; the output is in `scratch/150/out/`.

*The doctrine controls* match 146f's on every seed (0 of 160 outcomes
differ), so the stretch from 146f's commit to this one did not move the
doctrine arm, and the cohort's rows compare with 146f's on the seed.

*The ceiling deltas on the shared seeds, nominee ARM minus doctrine at
the same HEAD,* against 146f's pass ARM:

| shape | now | split (ARM alone : doctrine alone) | 146f |
|---|---|---|---|
| act 1, regen | 0.000 | 1 : 1 | −0.200 (0 : 8) |
| act 1, deploy | +0.025 | 2 : 1 | −0.150 (0 : 6) |
| walk, regen | +0.225 | 12 : 3 (p 0.018) | −0.075 (2 : 5) |
| walk, deploy | −0.025 | 8 : 9 | −0.350 (1 : 15) |

*The dial's own effect,* the nominee ARM against 146f's pass ARM on
seeds 1 to 40 (a cross-HEAD pairing, sound here because the doctrine
controls are identical and the dial off is byte-identical, 150e): act 1
regen 31 wins against 23 (8 seeds to 0), act 1 deploy 39 against 32 (7
to 0), the walk on regen 14 against 2 (13 to 1), the walk on deploy 27
against 14 (14 to 1); every split one-sided p < 0.01.

*What the ARM now does:* it fires at least as often as doctrine (a
battle: 0.213 against 0.127, 0.314 against 0.198, 0.197 against 0.150,
0.286 against 0.293), takes the empower nominee on 98.6 to 99.5 % of asks
(the average challenger to it now scores below it, −0.04 to −0.09), and
on the walk on deploy still buys less at ports (8.15 a run against
11.65), the port site's own null untouched. The lost seeds that remain
end at a boss, as before.

So 150d's location holds: the four pass-null sites were the loss, and
with doctrine's pick as their null the ARM matches doctrine on three
shapes and beats it on the fourth. The walk on regen's +0.225 sits above
the ceiling band (±0.08), a real ceiling move in the ARM's favour.

*The decision at the stop:* whether the nominee becomes the ARM's
default. That moves every ARM row: the sheet's ARM refs re-pin at a
board, and the prior table and the roster table re-derive under the new
ARM (BALANCE's derived-artifact registry). 146f's full board cost 34.8
CPU-hours (4.4 hours at 8 jobs); the prior table's recipe is about 1.5
hours of box.

### 150f signed; 150g and 150h inserted (2026-11-05)

The user approved the lean ("Approving your lean!"): the nominee null
becomes the ARM's default in §150, before §152's box reads. ROADMAP gains
150g (the default flipped, `none`: the default byte-identical to the
cohort's `--arb-null=nominee` output and `--arb-null=pass` to the old
ARM's) and 150h (`stop`): the prior table re-derived under the new ARM
by its v5 recipe and committed, then the full board at that HEAD under
it, 146f's shape, and the roster table rebuilt from its ARM rows; the
stop brings the sheet's ARM refs re-pinned for the user's signature, no
band moved. One sizing note for the stop: the registry's "~1.5 h box"
for the table is two-act era; v5's own batch cost 13.7 CPU-hours, and on
three acts with the longer nominee runs it will cost more.

### 150g — the nominee the default (2026-11-05)

Built: `ArbitratedConfig.nullArm` defaults to the nominee
(`config.nullArm !== 'pass'`); the CLI passes only `--arb-null=pass`
through, the launch line naming `arb-null=PASS`; the board's ARM argv is
unchanged, so its arm check holds. BALANCE's arbitration section names
the null arm per site and the pass arm. Four pins of the pass default now
name `nullArm: 'pass'` (their first run red, as predicted: the redraw and
empower enumeration pins and two 150e pins); the redraw pin adds the
default's action and log equal to the nominee's.

*The oracle,* the three shapes of 150e (`scratch/150/oracle.sh`): the
default on the new code against the 150e `--arb-null=nominee` capture,
and `--arb-null=pass` against the baseline at `64fed7f8`, each 10 of 10
artifacts byte-identical; the two arms differ from each other on 10 of 10
(150e's control), so each comparison could have failed.

### The hand-off after 150g (2026-11-05, session d36a1828)

The session reached the hand-off trigger at 150g's commit (`7a4591f5`).
Done: §150's cut signed; 150a to 150c, 150e and 150g built; 150d and
150f signed. Open: 150h (`stop`), the ARM's board.

- *The prior-table cohort.* The last act of the session, after the
  commit that holds this entry, is to push and launch
  `output/box-batches/150h-prior.queue` (three 40-seed batches, seeds
  1001 to 1120, v5's recipe, `--shadow-horizon=run`) with
  `scripts/box-drive.sh`, its log `output/box-batches/150h-prior-drive.log`
  (a prediction as written; the log says whether it fired). Until the
  log shows batch 3/3's `launched` line, no commit and no doc edit in
  the tree (process/measurement.md, "One HEAD per cohort"). The driver
  stands the box down itself.
- *Then:* `npm run prior:table -- <the three batch dirs> --note=…` writes
  the table (v6) over `tests/fuzz/board/prior-table.json`; the coverage
  test (`tests/prior-table-coverage.test.ts`) may name acquirables with no
  row; the registry row in BALANCE gains v6; a run-log entry; commit and
  push.
- *Then the board,* 146f's shape at the new HEAD: the 15 box rows at
  n = 40 and the ten checked rows extended to n = 120
  (`scratch/146/146f/146f-board.queue` is the model, made from
  `balance:board -- --plan`); the two anchors locally; `--merge-stages`
  into `output/board-runs/150h/`; `balance:board -- --report`; the roster
  table from the board's ARM rows (`npm run roster:table`). 146f's board
  cost 34.8 CPU-hours.
- *The stop:* the sheet's ARM refs re-pinned at the board's values for
  the user's signature, no band moved; the ceiling deltas (now paired)
  and the gradient (now the sign test) read on it.

Tools no doc names: `scratch/150/cohort-read.ts` (paired ceiling deltas
for any id=dir set, with 146f beside them and the doctrine controls
checked seed by seed), `scratch/150/walk-loss.mjs` (a board dir's ARM
against doctrine by site), `scratch/150/oracle.sh` and `compare.sh` (the
byte-identity captures), `scratch/150/cohort/` (the 150f cohort's files
under instrument names).

### 150h — the prior table v6, then the board (2026-11-06, session 3bc7ecb1)

*The overnight calls,* asked for and pre-approved by the user before the
night ("Those all sound reasonable; approved!", 2026-11-05): the box a
`cpx42` at `--jobs=8`, as 146f; no fresh `--search` derive at this
board, as at 146f, since the ARM change does not reach a `--search` run
(it has no `--arbitrate`) and the game is 146f's (150f's doctrine
controls identical on every seed), 146b's derive having cost 5 h 52 min;
a gap in the v6 table stops before the board with the box down; a failing
test at the table's commit gets its pin updated if the pin restates the
table, and stops otherwise; a driver hold gets one relaunch of the
unfetched lines at the same HEAD, and a second hold destroys the box
after fetching what finished, and stops. Past twice its estimate the
board keeps running.

*The table.* The cohort the last session launched completed at
`4c4fecec`, three of three batches verified; v6 is built from the three
and committed here, its numbers in the BALANCE run log (2026-11-06).
No gap: the same 35 items as v5, and two batches had already given all
35. One figure checked before the commit: hype's meanΔ is exactly 0.000
over 524 rows, which could have meant a degenerate pairing under the new
null; it is not, 188 of the deltas are non-zero and sum to 0 on the
half-point scores. v5 is kept as a fixture (the registry row), the table
146f's board ran under.

*The board,* 146f's shape at this commit: `balance:board -- --plan`
gives 146f's argv on all 17 rows, and the queue
(`output/box-batches/150h-board.queue`, made by
`scratch/150/150h/make-queue.mjs`) equals 146f's line for line, 25
batches, the anchors run here. As written it is a prediction: the board
is launched after this commit with `scripts/box-drive.sh`, its log
`output/box-batches/150h-board-drive.log`; until that log shows batch
25/25's `launched` line, no commit and no doc edit in the tree. Then the
merge into `output/board-runs/150h/` (`scratch/146/merge.mjs`), the
report, the roster table from the eight ARM rows, and the stop with the
sheet's ARM refs re-pinned for the user's signature.

*The board, back.* It drained at 08:42Z: 25 of 25 batches verified at
`8a63a20e` with no hold, so none of the overnight calls came up. Its
numbers are in the BALANCE run log (2026-11-06, "the ARM's board"):
integrity PASS on all 17 rows, 0 FAIL, 16 WARN, the seven doctrine rows
and both anchors 146f's byte for byte. What it shows:

- The ARM plays at doctrine's level on all four ceiling shapes, +0.025,
  +0.025, +0.125 and −0.025 (146f −0.200, −0.150, −0.075, −0.350), and
  every ARM row rose against 146f's, told apart on six of eight. Under
  the same ARM, v6 against v5 (150f's cohort, seeds 1 to 40) is not
  told apart on any shape.
- The characters came apart on act 1. The soldier's two rows gained the
  most, so the priest now reads −10.8 and −8.3 and the gambler −16.7 and
  −13.3 against him, each told apart on the shared seeds; at 146f all
  four were inside ±5. Why is not read. The round's parity item is
  §154's (the priest's parity, C16), and the gambler is not in its
  charter.
- The walk against its signed bands. Under the pass null the ARM's walk
  rows read well under doctrine's, and seam 1 (re-signed at 146g) and act
  1's wall (first signed at 146g) were set over those rows. The ARM's
  walk now reads like doctrine's: on deploy, seam 1 at 0.621 of max (the
  band 0.475–0.55), act 1's wall 0.042 (0.15–0.38), the terminal reach
  0.783 (0.40–0.50) and win 0.692 (derived 0.26–0.35), where doctrine's
  walk on deploy has read 0.775 and 0.700 since 146f. On regen the
  terminal pair sits under its bands (0.342, 0.171). §155 re-pins and
  signs act 1's bands; the terminal band's re-set is Round 22's.
- The officer: the ARM drafted him in 24 battles, all the soldier's, the
  first ARM rows to draft him since rule C. The roster table's coverage guard
  failed on his PENDING acknowledgment, which it refuses once the table
  no longer needs it, and the acknowledgment is removed.
- The skill gradient reads ok under 150c's leg (random 0.275, greedy
  0.175, 6 : 2, p 0.145), on the same anchors as 146f's.

*The decision at the stop:* the sheet's ARM refs re-pinned at this
board's n = 120 values, no band moved, held where the row is
doctrine's:

| ref | 146g | 150h |
|---|---|---|
| act-1 win, soldier regen / deploy | 0.542 / 0.792 | 0.775 / 0.942 |
| act-1 win, priest regen / deploy | 0.558 / 0.800 | 0.667 / 0.858 |
| act-1 win, gambler regen / deploy | 0.517 / 0.775 | 0.608 / 0.808 |
| banks, firer / shopper | 114.9 / 80.0 | 130.0 / 83.3 |
| the firer's fires a run | 2.50 | 4.69 |
| transaction rates, firer / shopper | 0.308 / 0.875 | 0.292 / 0.900 |
| the fire channel (doctrine pair) | 0.100 | held, 0.100 |
| forced King / Queen (doctrine) | 0.717 / 0.258 | held, identical |

With it, two calls. The deploy row's fires ref is a 2.0 in `board.ts`,
held since 85g6d and not on the sheet; it reads 5.44 (146f 2.61), and the
lean is to re-pin it with the firer's. And where the parity breach goes:
the lean is §154 beside the priest's parity, the gambler added to its
charter. After the re-pin the board would carry 9 WARN, all on the walk's
signed bands and the regen walk's ceiling (a prediction, read when the
report runs again on the re-pinned sheet).

### 150h signed (2026-11-06)

The user signed the re-pin and both leans ("signing the re-pin and your
leans!"): the deploy row's fires literal re-pinned with the firer's, at
5.44, and the gambler added to §154's parity item beside the priest
(ROADMAP §154 and META-ROADMAP's Round 11 line). The sheet's 2026-11-06
entry holds the values; read on its own board, every act-1 entry passes
and the nine WARNs are the ones predicted at the stop, and on 146f's
board the same sheet WARNs on seven of the twelve act-1 entries (BALANCE
2026-11-06, "the sheet amended at the ARM's board").

The user's lead on the parity, for §154: act 1's encounters "look to be
a bit bimodal in their difficulty: healing on the easy ones just doesn't
actually help, and on the hard ones it's not enough." It fits the
priest. It does not by itself cover the gambler, whose kit does not
heal and whose gap is the larger (−16.7 and −13.3 to the priest's −10.8
and −8.3); a per-encounter read of the three characters' act-1 rows
would test both.
