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

**Status: §105 ✅ CLOSED 2026-09-22 (the direction named); §106 ✅ CLOSED 2026-09-23 (the spec signed); §107 ✅ CLOSED 2026-09-24 (the projection shipped); §108 ✅ CLOSED 2026-09-25 (the marks drawn by the terrain); §109 IN PROGRESS — the cut signed 2026-09-26.** This round is
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

## Phase 108 — the ground mark, drawn by the terrain ✅ CLOSED 2026-09-25

**Outcome:** the terrain draws the ground marks, as signed-distance shapes
from a per-frame, per-tile table: a side shape under each combatant, a
plate under scenery, dashed on a destructible wall or cover. They reach
tops, step faces and mounds, and fade with their glyph. The user and
playtesters read the look clear in Firefox (stop 1: square corners, the
defaults signed); the grey read passed, the elevation clauses were signed
into DESIGN, upright depth ships alone (the hop reopens in a movement
polish, TODO), and the marks cost +0.19 ms per frame in Firefox at
2560×1440, accepted (stop 2). The camp pip went to Round 8. The mock and
the hop dial are deleted, with the marks' pixels byte-identical across it.
The record: WORKLOG §108. Every step's read is done.

- [x] **108a** — the mark table, headless (`groundMarks.ts`), pinned against shapes re-derived by sampling. Read `none`. ✅ `be5f5f2`.
- [x] **108b** — the terrain draws the marks (SDF shapes, the mounds sharing the table, fading with the glyph, the dashed frame). Read `stop` — STOP 1, the look. ✅ READ CLEAR, the defaults signed, `509387b`.
- [x] **108c** — the hop as a dev dial + the `board-wade` fixture. Read `stop` → stop 2. ✅ READ: upright depth alone ships, `d045497`.
- [x] **108d** — the frame-cost bench (paired legs, an A/A control, a planted cost). Read `stop` → stop 2. ✅ READ: Firefox +0.19 ms per frame, acceptable, `1c40495`.
- [x] **108e** — DESIGN: the identity channel as built, the elevation clauses (D5, D6). Read `stop` — STOP 2. ✅ READ CLEAR (the grey read passed, the wording signed), `8f59c2e`.
- [x] **108f** — the mock seams, the look dials but `plateCorner`, and the hop dial deleted (D8); the bench's GPU name from `RENDERER`. Read `none`. ✅ the marks' pixels byte-identical, `4071397` + `03f1f7a`.

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

**The cut** (signed 2026-09-26; WORKLOG §109 Kickoff). R10 is re-grounded,
not deleted: the markers read the X's raw ink bottom (kickoff finding 1).

- [ ] **109a** — the deletion (D4): base sprites stand on the quad bottom; R5–R7 go; the lifts become ink edges; R10 re-grounded; pins re-derived from the atlas; the instrument onto the quad-bottom anchor; the rule count recorded. Read `none` — a numeric pane oracle against HEAD under `?bp=anchor-bottom`, the literal R10 deletion its planted failure.
- [ ] **109b** — the explorer trimmed to its keepers (D8): the `anchor` dial and `restampAnchors`, `bar` / `barY` / `barLift`; the bench and `marks` stay (the user's call). Read `none`.
- [ ] **109c** — the C1 doc drifts: gotcha #33 re-pointed; the font sentinel closed with no change. Read `none`.
- [ ] **C1** — the macro re-audit: Round 8's charter against the code, and what 7.5 hands to Rounds 9 and 11. Read `stop`.
- [ ] **C2–C5** — the efficacy read · the welfare read (the user's) · the trials and standing decisions · the scratchpad sweep. Read `stop`.
- [ ] **C6** — the archive (`post-104-*` + the spec) and the Cursor. Read `none`.
