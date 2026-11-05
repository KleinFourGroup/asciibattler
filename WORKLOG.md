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
