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

**Status: §105 ✅ CLOSED 2026-09-22 (the direction named); §106 ✅ CLOSED 2026-09-23 (the spec signed); §107 ✅ CLOSED 2026-09-24 (the projection shipped); §108 IN PROGRESS — its cut signed 2026-09-24.** This round is
SPIKE-first, then spec: the projection spike (§105 pass one → §106 pass two)
informs the spec the way the Electron spike informs Round 8's store. The
spec is signed ([round-7.5-spec.md](round-7.5-spec.md), 2026-09-23) and the
build phases §107–§109 are entered below. The
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

## Phase 106 — the projection spike, pass two + the spec ✅ CLOSED 2026-09-23

**Outcome:** the candidate refined and played — one merged ground mark per
combatant (the team shape, dark-filled, colour-outlined), a filled plate
under every scenery body, the marks cut to each tile and draped down the
step faces, N×N slabs centred on their footprint, the anchor rule R5–R7 +
R10 deletable; the bookmark signed after a full run; the spec written and
signed ([round-7.5-spec.md](round-7.5-spec.md)), with §107–§109 entered.
The record: WORKLOG §106. Every step's read is done.

- [x] **106a** — the instrument: an N×N slab's base corners inside its footprint + no footprint terrain over its quad, yaw [30, 45], today's rule the FAILING control at 45 · the flyer at lift 0.45 · the lean pinned through the production camera. Read `none`. ✅ the centre at the footprint max clears tile terrain; the slide is for hill mounds, free under ortho — 106b's shape stands (WORKLOG §106a).
- [x] **106b** — the N×N seam (dev): centre + the slide along the view ray, restamped on a view change; the cue follows. Read `batch` → 106c's stop: rubbleQuarry at 45 and 30, each slab on its plot; wrong = overhanging its diamond, or a hill biting its lower band. ✅ read CLEAR ("Center looks great!") — the `slab` dial (WORKLOG §106b).
- [x] **106c** — the `ground: cue | shadow | both | merged` dial under every combatant (the flyer's = the mark with a gap) + the footprint plate. Read `stop` — with the anchor circle-back + 106b's batch; yaw 45, 30 the check; Ctrl+Alt+G. ✅ READ: `merged` ("not even close") · the anchor rule DELETABLE · the plate `filled` · scenery grounding wanted; two flags → a -post (WORKLOG §106c THE READ).
- [x] **106c-post** — inserted from the 106c read (the user's two flags + item 5): marks + plates cut per tile onto the tile tops · the plate under ALL scenery (a dial) · the plate's own opacity. Read `stop`; refinements → the next session (user's pre-commitment). ✅ READ CLEAR ("you absolutely nailed this"); one refinement → next session: the step-face drape (WORKLOG §106c-post THE READ).
- [x] **106c-post2** — inserted 2026-09-23 (the user's call: a spike `-post`, not folded into the spec): the step-face drape — marks and plates hang down the camera-facing step faces, behind a `drape` dial. Read `stop`, in 106d's sitting. ✅ READ CLEAR ("On looks amazing"); `cueDepth` world wins; `plateAlpha` 0.6 kept (WORKLOG §106c-post2 THE READ).
- [x] **106d** — THE PLAYED READ: a few full battles under the bookmark (step zero: a whole run plays under it; `anchor-bottom` added, the user's yes 2026-09-23; `drape-1` + `cueDepth-world` from 106c-post2's read); watch the stack in clumps, the wall staircase, picks under yaw. Read `stop` — the bookmark signed in the user's words. ✅ READ CLEAR (a full run): all four watches clear; to 106e: the marks vs the hill mounds, rounded plate corners (WORKLOG §106d THE READ).
- [x] **106e** — the spec (`round-7.5-spec.md`) + the build phases entered here + the spike code's disposition. Read `stop`. ✅ SIGNED 2026-09-23 ("Fully signed … complete agreement"): D1–D8, §107–§109 (WORKLOG §106e).

## Phase 107 — the projection, built ✅ CLOSED 2026-09-24

**Outcome:** orthographic · pitch 45 · yaw 45 ships as
`DEFAULT_CAMERA_VIEW`, and the user played it over two full runs. The N×N
slab rule is production (`slabAnchor.ts`), and the dev pan follows the yaw.
The read's one finding, a diagonal move clipping into a higher far corner
(pre-existing, measured), is fixed: standing sprites are depth-tested upright
(107d-post), and the hop is re-read at §108. The record: WORKLOG §107. Every
step's read is done.

- [x] **107a** — the camera seams made production-safe (the starting camera from the view; the overlay's camera getter). Read `none`. ✅ `8fcf493`.
- [x] **107b** — the N×N slab rule into production (D2); the dev patch and `slab` dial gone, a dev re-stamp kept (the user's call). Read `batch` → 107d's stop. ✅ read CLEAR, `7843a49`.
- [x] **107c** — the dev pan turned by the yaw (D7) + gotchas #52–54, #68–69. Read `none`. ✅ `42d96ce`.
- [x] **107d** — the flip (D1): `DEFAULT_CAMERA_VIEW` = ortho · 45 · 45; pins re-anchored; DESIGN's Camera paragraph + D7. Read `stop` — THE PLAYED READ. ✅ READ CLEAR (two full runs; one finding → 107d-post), `c4ca4e6`.
- [x] **107d-post** — inserted from the 107d read: upright depth for standing sprites (the diagonal-move clip; the user's pick over the hop). Read `stop`. ✅ READ CLEAR ("this fix appears to have worked"), `99626f3`.

## Phase 108 — the ground mark, drawn by the terrain (signed 2026-09-23 with the spec)

Charter: the merged mark and the scenery plate, drawn as signed-distance
shapes in the terrain shader from a per-frame, per-tile table (spec D3);
team identity checked clause by clause, with the grey read as the
acceptance test (D5); the "Elevation on the board" requirement written into
DESIGN (D6). **Why here:** after §107 so every read is under the shipping
projection; before §109 because the anchor deletion was signed on the
strength of the grounding these marks give. **Risk:** medium-high — a new
shader path and a per-frame data path, judged by eye, with a frame-cost
measurement owed. **Decision points:** ✅ DECIDED at the kickoff: the camp
unit's hue-only status pip → Round 8 with the colourblind palette (TODO);
the cracked-stone wall tell → a dashed plate frame (108b); marks fade with
their glyph · ✅ DECIDED at stop 1: square plate corners for now (the
dashes did the walls' job; rubble a tie), the rounding kept for organic
scenery (TODO) · ✅ DECIDED at stop 2: the elevation clauses' wording signed · upright depth alone
ships (the hop reopens once in a movement polish, TODO) · the frame cost acceptable (WORKLOG §108 STOP 2).
**Exit:** the marks on tops, step faces and mounds, read by the user; the
grey read passed in a live battle; the residuals decided; the elevation
requirement signed; frame cost measured; the mock-mark seams deleted.
**Scope guards:** the spec's; no flyer mechanic.

**The cut (user-signed 2026-09-24; audit and decisions: WORKLOG §108
Kickoff).** Two stops.
- [x] **108a** — the mark table, headless (`groundMarks.ts`: per-tile bins, a fixed depth, overflow counted), pinned against shapes re-derived by sampling. Read `none`. ✅ 12 tests, two failing controls (WORKLOG §108a).
- [x] **108b** — ✅ STOP 1 READ CLEAR 2026-09-25, the defaults signed (WORKLOG §108b). The terrain draws the marks: SDF shapes after the grid line, the mounds sharing the table, marks-off = today's shader byte for byte; keyed by sprite so a mark fades with its glyph; the dashed frame; the read dials. Read `stop` — STOP 1, the look: the bookmark's marks on tops and step faces, now on mounds too; wrong = a mark missing from a mound or face, spilling onto a neighbour's face, left after a death, or off the bookmark's shape or size.
- [x] **108c** — the hop as a dev dial (a diagonal arcs over the higher corner; upright depth stays). Read `stop` → stop 2. ✅ READ at stop 2: upright alone ships. Built 2026-09-25: the `hop` dial + a `board-wade` fixture; the hop fires on a third or more of diagonals, mostly small, so a minimum height is a stop-2 question (WORKLOG §108c).
- [x] **108d** — the frame-cost bench (paired off/on legs; an A/A control and a planted cost). Read `stop` → stop 2: the user's Firefox run at 2560×1440. ✅ READ at stop 2: Firefox +0.19 ms per frame, acceptable. Built 2026-09-25: the panel's `frame-cost bench` button; in the pane (Chromium, 2560×1440) the marks read +0.17–0.20 ms per synced frame, all checks passing (WORKLOG §108d).
- [x] **108e** — DESIGN: the identity channel as built and the elevation clauses (D5, D6); ARCHITECTURE. Read `stop` — STOP 2: the grey read in a live battle, the posed flyer at lift 0.45, upright vs the hop, the bench, the wording. ✅ STOP 2 READ CLEAR 2026-09-25: the grey read passed, the wording signed (WORKLOG §108 STOP 2).
- [ ] **108f** — the mock seams deleted (D8) with the read dials, except `plateCorner` (kept for organic scenery, the user's call at stop 1); the hop dial and its code deleted (the stop-2 verdict; `board-wade` stays); the bookmark → `anchor-bottom`. Read `none` (the marks' pixels unchanged across the deletion).

## Phase 109 — the rule deletion + the round close (signed 2026-09-23 with the spec)

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
