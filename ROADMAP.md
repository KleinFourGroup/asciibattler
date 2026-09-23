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

**Status: §105 ✅ CLOSED 2026-09-22 (the direction named: ortho · p45 · yaw [30, 45]; the lens-20 fallback); §106 KICKED OFF 2026-09-22 — the cut + reads signed (below).** This round is
SPIKE-first, then spec: the projection spike (§105 pass one → §106 pass two)
informs the spec the way the Electron spike informs Round 8's store. The
spec is drafted ([round-7.5-spec.md](round-7.5-spec.md), 106e) and the build
phases §107–§109 are entered below as proposals until the user signs it. The
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

**The cut (user-signed 2026-09-22; the audit + why this order: WORKLOG §106
Kickoff).** No bump, no smoke on any step, no production touch.

- [x] **106a** — the instrument: an N×N slab's base corners inside its footprint + no footprint terrain over its quad, yaw [30, 45], today's rule the FAILING control at 45 · the flyer at lift 0.45 · the lean pinned through the production camera. Read `none`. ✅ the centre at the footprint max clears tile terrain; the slide is for hill mounds, free under ortho — 106b's shape stands (WORKLOG §106a).
- [x] **106b** — the N×N seam (dev): centre + the slide along the view ray, restamped on a view change; the cue follows. Read `batch` → 106c's stop: rubbleQuarry at 45 and 30, each slab on its plot; wrong = overhanging its diamond, or a hill biting its lower band. ✅ read CLEAR ("Center looks great!") — the `slab` dial (WORKLOG §106b).
- [x] **106c** — the `ground: cue | shadow | both | merged` dial under every combatant (the flyer's = the mark with a gap) + the footprint plate. Read `stop` — with the anchor circle-back + 106b's batch; yaw 45, 30 the check; Ctrl+Alt+G. ✅ READ: `merged` ("not even close") · the anchor rule DELETABLE · the plate `filled` · scenery grounding wanted; two flags → a -post (WORKLOG §106c THE READ).
- [x] **106c-post** — inserted from the 106c read (the user's two flags + item 5): marks + plates cut per tile onto the tile tops · the plate under ALL scenery (a dial) · the plate's own opacity. Read `stop`; refinements → the next session (user's pre-commitment). ✅ READ CLEAR ("you absolutely nailed this"); one refinement → next session: the step-face drape (WORKLOG §106c-post THE READ).
- [x] **106c-post2** — inserted 2026-09-23 (the user's call: a spike `-post`, not folded into the spec): the step-face drape — marks and plates hang down the camera-facing step faces, behind a `drape` dial. Read `stop`, in 106d's sitting. ✅ READ CLEAR ("On looks amazing"); `cueDepth` world wins; `plateAlpha` 0.6 kept (WORKLOG §106c-post2 THE READ).
- [x] **106d** — THE PLAYED READ: a few full battles under the bookmark (step zero: a whole run plays under it; `anchor-bottom` added, the user's yes 2026-09-23; `drape-1` + `cueDepth-world` from 106c-post2's read); watch the stack in clumps, the wall staircase, picks under yaw. Read `stop` — the bookmark signed in the user's words. ✅ READ CLEAR (a full run): all four watches clear; to 106e: the marks vs the hill mounds, rounded plate corners (WORKLOG §106d THE READ).
- [ ] ◐ **106e** — the spec (`round-7.5-spec.md`) + the build phases entered here + the spike code's disposition. Read `stop`. ◐ drafted: D1–D8 proposed (D3 decided: shapes in the terrain shader), §107–§109 entered below (WORKLOG §106e).

## Phase 107 — the projection, built (PROPOSED at 106e, unsigned)

Charter: the spike's projection becomes the shipped view — orthographic ·
pitch 45 · yaw 45 as `DEFAULT_CAMERA_VIEW` — and the N×N slab rule replaces
R11 (spec D1, D2, and D7's dev pan). **Why first:** every later read in the
round happens under the shipping projection, and the marks and the anchor
are judged against it. **Risk:** medium, lower than chartered — both
cameras, the fit and the apron's parallel-ray branch already exist behind
the 105d seam; what is owed is the overlay layer's camera, the resize and
shake paths, and a camera-gotcha re-audit. **Decision points:** none open
(the projection, the yaw and the slab rule are signed). **Exit:** the
default view shipped and played; `cameraFit.test.ts` re-pinned at the new
default with the lean pin permanent; the slab rule pinned against
production; gotchas #17, #51–54, #68–69 and DESIGN's Camera paragraph
re-audited; the slab seam deleted. **Scope guards:** the spec's; no
windowed view (D7).

## Phase 108 — the ground mark, drawn by the terrain (PROPOSED at 106e, unsigned)

Charter: the merged mark and the scenery plate, drawn as signed-distance
shapes in the terrain shader from a per-frame, per-tile table (spec D3);
team identity checked clause by clause, with the grey read as the
acceptance test (D5); the "Elevation on the board" requirement written into
DESIGN (D6). **Why here:** after §107 so every read is under the shipping
projection; before §109 because the anchor deletion was signed on the
strength of the grounding these marks give. **Risk:** medium-high — a new
shader path and a per-frame data path, judged by eye, with a frame-cost
measurement owed. **Decision points:** the two identity residuals (a camp
unit's hue-only status pip; the cracked-stone wall tell) · rounded plate
corners (a parameter, read at the stop) · the elevation clauses' wording.
**Exit:** the marks on tops, step faces and mounds, read by the user; the
grey read passed in a live battle; the residuals decided; the elevation
requirement signed; frame cost measured; the mock-mark seams deleted.
**Scope guards:** the spec's; no flyer mechanic.

## Phase 109 — the rule deletion + the round close (PROPOSED at 106e, unsigned)

Charter: the uniform quad-bottom anchor replaces R5–R7 + R10, with probes
re-derived from the atlas and the special-rule count recorded (spec D4);
the last spike seams go (D8); then the round close. **Why last:** the
deletion is safe only once the production marks ground the glyphs.
**Risk:** low-medium — typography and pins, no new look beyond the few
pixels the user already judged invisible. **Decision points:** none open.
**Exit:** the four rules deleted; the three C1 doc drifts fixed; the rule
count before and after in the WORKLOG; the board explorer trimmed to its
keepers (D8); the round closed per `process/planning.md`. **Scope guards:**
the spec's; §101's gates untouched.
