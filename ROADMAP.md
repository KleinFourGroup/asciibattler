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

**Status: §105 IN PROGRESS — kicked off 2026-09-21.** This round is
SPIKE-first, then spec: the projection spike (§105 pass one → §106 pass two)
informs the spec the way the Electron spike informs Round 8's store. No
phase entries beyond §106's charter exist until the spec is written. The
charter, the decision points, the exit and the scope guards are in
META-ROADMAP §"Round 7.5 — The Board" (hardened at the kickoff: WORKLOG
§Kickoff); the founding argument is
[archive/post-94-worklog.md](archive/post-94-worklog.md) §"The Round 7
close", C1; the carried items are in TODO (§"Round 7 close riders").

## Phase 105 — the projection spike, pass one

Charter: EXPLORE how the board is projected, before anything is built on
it — a dev-only, render-only explorer (live dials, state in the URL, fixed
fixtures, a fixed seed) read by the user's eye in Firefox, as a FULL CROSS:
every treatment (ground cue · anchor mode · bar line · camera-up fake flyer
· glyph scale) on every projection (perspective at 50° and long-lens ·
orthographic; pitch BOTH ways from 45°; yaw 0 / 45 on each). Taste is
explored, not pre-registered; what is pre-registered is the CONSTRAINTS
(identity clauses under Ctrl+Alt+G · 24×24 + 12×32 fit · a lifted unit
reads as above its tile · clump overlap ≤ today's at SOME legible glyph
scale · glyph px at fit ≥ today's camera per viewport) and THE TIE-BREAK: a
tie goes to perspective. Rationale + the audit: WORKLOG §Kickoff.

**Why first:** every later phase of the round is a different piece of work
under each answer. **Depends on:** Round 7 (✅). **Risk:** low to build,
high in consequence. **Decision points:** the direction pass one names (one
point, or two at the user's word) · whether the classifier / descender room
/ baseline measurement go (the H1 read, 105b) · whether the bar line can be
uniform again (the §79e reversal re-posed). **Exit:** the user names a
direction for §106, by eye, inside the constraints; the lean MEASURED.
**Scope guards:** no sim; nothing ships to players (the panel is `src/dev`,
DEV-gated; the one Renderer seam is oracle-pinned unchanged at the default);
no rule deletion yet; no lighting / decoration work; no rotatable camera
for players; §101's font gates are out of scope for the whole round.

The cut (user-signed 2026-09-21; each step declares its READ):

- [x] **105a — the headless geometry instrument.** ✅ 2026-09-21 — `npm run board-geometry`; §79b reproduced to ~1 %; WORKLOG §105a. Pure camera math + a
  dumped ink census, independent of `Renderer`: lean at the corners · glyph
  px at fit (CSS + device) · clump overlap · own-tile fraction ·
  flyer-over-north-neighbour overlap, over projection × pitch × yaw × FOV ×
  glyph scale × board × viewport. Known answers built in (the derived ≈24° /
  ≈40° lean; §79b's ±9 px at 720p). **Read: `none`** — the table arrives at
  the 105b stop.
- [x] **105b — H1 under TODAY'S camera.** ✅ 2026-09-21, READ by the user (the chord is Firefox-usable, every dial works, the cues carry "whose"); zero production touch; one `-post` — the `cueDepth` dial (the cue's "clipping" was the depth test); multi-tile indicator deferred to §106 (TODO); WORKLOG §105b. The panel shell (Ctrl+Alt+P, URL
  state) + three dials — anchor mode (today / quad-bottom) · bar line
  (ink-top / uniform) · the ground-cue mock (shape per side) — on a posed
  row `g ▄ ╥ M a r`. **Read: `stop`** — what changed: the first three
  dials · where: Ctrl+Alt+P in a battle, also under Ctrl+Alt+G · wrong
  looks like: the chord is Firefox's, a dial does nothing, the cue hides
  the tile.
- [ ] ◐ **105c — the fixtures.** BUILT 2026-09-21, UNREAD (the `batch` read lands at 105e) — `bp=board-<id>` is the one source of the board, the poses are 105a's cell for cell; main.ts's panel import went DYNAMIC (the fixture table had shipped ~200 B); WORKLOG §105c. A DEV straight-to-battle loader, countdown
  parked: the clump · screen-edge units · the fake flyer (camera-up lift +
  shadow, a north neighbour) · `rubbleQuarry` · `endlessCorridors` · a
  24×24 by seed hunt · one seeded LIVE battle. **Read: `batch`** → 105e —
  each fixture loads from the panel; wrong looks like a fixture that opens
  a different board on reload.
- [ ] ◐ **105d — the projection dials.** BUILT 2026-09-21, UNREAD (the `batch` read lands at 105e) — the pure fit `src/render/cameraFit.ts` is bit-identical to HEAD's at the default (headless + a live before/after), both controls fail; the overlay's captured camera is re-pointed from `src/dev`; WORKLOG §105d. Both cameras alive and re-pointed ·
  pitch / yaw / FOV as state · ONE generalized fit with an ortho branch ·
  the apron ortho ray. Oracle: at yaw 0 / FOV 50 / pitch 45 the new fit
  equals today's across boards × aspects, with a failing control. **Read:
  `batch`** → 105e.
- [ ] ◐ **105e — the glyph-scale dial.** BUILT 2026-09-21 (units only, user-signed; zero production touch; the bars, the click box and 38/38 bodies follow in the pane); THE STOP IS OPEN — pass one waits on the user's read; WORKLOG §105e. (threaded through the pick size + the
  lifts) + the known-cosmetic artefact list on the panel. **Read: `stop`**
  — PASS ONE: the coarse cross, on the user's monitor + a ~1280×720 window.

## Phase 106 — the projection spike, pass two + the spec

Charter: refine the direction §105 named — one point, or two at the user's
word — then write the round's spec over the result. What pass two builds
depends on where pass one points (depth-cue mocks ortho-ward · cue / bar
refinement perspective-ward · the footprint anchor + the wall staircase if
yaw survives), so its steps are cut at its own kickoff, against code
reality, with their reads.

**Why here:** the spec cannot be written honestly before it. **Depends
on:** §105's named direction. **Risk:** medium — the novelty effect cuts
both ways, so the exit is PLAYED, not looked at. **Decision points:** the
projection itself (the tie-break applies: no clear direction ⇒ perspective
holds) · the spike code's disposition (the seed of the build, or reverted)
· a third pass means re-cutting, not drifting. **Exit:** a few full battles
played in the candidate · the signed bookmark with the user's reasons in
the user's words · the lean pinned headless · the round's spec written and
the build phases entered here. **Scope guards:** §105's, unchanged.
