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
