# ROADMAP — Round 7.5 (The Board), post-§104

The active PLAN (it stays a plan for its whole life). The macro order is
[META-ROADMAP.md](META-ROADMAP.md) (Round 7 Idioms ✅ CLOSED 2026-09-20;
Round 7.5 — The Board is NEXT, re-chartered at that close); findings +
rationale land in [WORKLOG.md](WORKLOG.md); live status is HANDOFF's 🧭
Cursor. Sub-steps are cut at each phase kickoff (AGENTS "The planning
stack"), never here — **and from this round each cut step declares its
READ** (`none` · `batch` · `stop`; AGENTS "Reads are cut, not improvised",
on trial through this round). Prior round's plan:
[archive/post-94-roadmap.md](archive/post-94-roadmap.md) (Round 7) with its
worklog and spec beside it; before it
[archive/post-88-roadmap.md](archive/post-88-roadmap.md) (the casualty
experiment).

**Status: §105 ✅ CLOSED 2026-09-22 (the direction named: ortho · p45 · yaw [30, 45]; the lens-20 fallback); §106 is NEXT — its kickoff audit + cut are not yet written.** This round is
SPIKE-first, then spec: the projection spike (§105 pass one → §106 pass two)
informs the spec the way the Electron spike informs Round 8's store. No
phase entries beyond §106's charter exist until the spec is written. The
charter, the decision points, the exit and the scope guards are in
META-ROADMAP §"Round 7.5 — The Board" (hardened at the kickoff: WORKLOG
§Kickoff); the founding argument is
[archive/post-94-worklog.md](archive/post-94-worklog.md) §"The Round 7
close", C1; the carried items are in TODO (§"Round 7 close riders").

## Phase 105 — the projection spike, pass one ✅ CLOSED 2026-09-22

**Outcome:** the user named the direction by eye, inside the constraints —
**orthographic · pitch 45 · yaw in [30, 45]** ("shockingly good"; ortho at
yaw 0 is out — the uncanny valley; perspective 50 a distant third), with
**the long lens (FOV 20) as the named fallback**, not a second point; the lean
measured 0.0°, clump overlap 0.00, the smallest glyph 1.28× today's. Ink bar
line stays; scale 1 (an accessibility-dial candidate); the anchor pair
undecided — both "floaty", predicted a GROUNDING question; N×N bodies askew
under yaw → centre + depth bias + the plate. Verdict, in the user's words +
the numbers: WORKLOG §"The pass-one read + THE VERDICT". Charter, audit and
the cut's rationale: WORKLOG §Kickoff / §105a–e. Every step's read is done.

- [x] **105a** — the headless geometry instrument (`npm run board-geometry`; §79b reproduced to ~1 %). Read `none`.
- [x] **105b** — H1 under today's camera: the panel + anchor / bar / cue dials; one `-post` (`cueDepth`). Read `stop` ✅.
- [x] **105c** — the fixtures (`bp=board-<id>`, the poses cell for cell, the DEV-gated dynamic import). Read `batch` ✅ clear.
- [x] **105d** — the projection dials through the ONE production seam (`cameraFit.ts`, bit-identical at the default). Read `batch` ✅ clear.
- [x] **105e** — the glyph-scale dial (unit bodies only) + the artefact list; THE STOP = pass one. Read `stop` ✅ — the verdict above.

## Phase 106 — the projection spike, pass two + the spec

Charter: refine the direction §105 named — one point, or two at the user's
word — then write the round's spec over the result. What pass two builds
depends on where pass one points (depth-cue mocks ortho-ward · cue / bar
refinement perspective-ward · the footprint anchor + the wall staircase if
yaw survives), so its steps are cut at its own kickoff, against code
reality, with their reads.

**Why here:** the spec cannot be written honestly before it. **Depends
on:** §105's named direction — **NAMED 2026-09-22: ortho · pitch 45 · yaw
[30, 45], the lens-20 fallback** (so pass two is ortho-ward: the ground mark
· the N×N centre + depth bias + plate · the wall staircase · the overlay
stack in clumps · the flyer at 0.45 — the seeds are listed at the end of
WORKLOG §"THE VERDICT"; the kickoff audit turns them into a cut). **Risk:**
medium — the novelty effect cuts both ways, so the exit is PLAYED, not
looked at. **Decision points:** the projection itself (the tie-break applies:
no clear direction ⇒ perspective holds — NOT reached; ortho was clear) · the
yaw value to art-direct at — ✅ DECIDED 2026-09-22 (user-signed): **45** (the
bookmark), **30 as the check** · the anchor pair's circle-back (provisionally
deletable) — ✅ DECIDED to ride the ground-mark dial: re-read only once
`ground` exists ·
the spike code's disposition (the seed of the build, or reverted) · a third
pass means re-cutting, not drifting. **Exit:** a few full battles
played in the candidate · the signed bookmark with the user's reasons in
the user's words · the lean pinned headless · the round's spec written and
the build phases entered here. **Scope guards:** §105's, unchanged.
