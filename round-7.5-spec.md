# Round 7.5 Spec — The Board

This round was spike-first: the projection spike (§105 pass one, §106 pass
two) came before the spec, the way Round 8's Electron spike informs its
store. This spec is written over the spike's signed results. The charter is
[META-ROADMAP.md](META-ROADMAP.md) §"Round 7.5 — The Board" (re-chartered
2026-09-20, hardened at the kickoff 2026-09-21); the record behind every
line here is [WORKLOG.md](WORKLOG.md) (§Kickoff, §105, §106); the plan is
[ROADMAP.md](ROADMAP.md).

**Status: SIGNED 2026-09-23** ("Fully signed … I'm in complete
agreement"), written at 106e. "What the spike settled" was signed read by
read; the build decisions D1–D8 and the phases §107–§109 were signed with
this file.

## Intent (the charter, in the user's words)

The glyph-alignment stack had grown to 16 rules (20 with §101's gates):
"too many special rules to get something that only 90% works, and
brittle" (2026-09-09). The rules were a symptom. Glyph quads are
axis-aligned in screen space while the ground lives in a perspective world,
and the glyph's inked foot was the only thing saying a unit touches the
ground. So the round settles the projection first, then anchors the cell
against a separate ground mark and deletes the ink-anchoring rules that
mark makes unnecessary. It gives team identity a channel that isn't colour
(DESIGN "Team identity on the board", five clauses), writes the "Elevation
on the board" requirement Round 9's flyer must satisfy, and re-poses the D4
camera question under the chosen projection.

The spike was an exploration, not a hypothesis test: "I expect to find one
that looks directionally best, and then we'll refine" (2026-09-21). Taste
was explored; the constraints were pre-registered (the identity clauses
under Ctrl+Alt+G · 24×24 and 12×32 fit · a lifted unit reads as above its
tile · clump overlap no worse than today's · glyph px at fit no worse than
today's), with a tie going to today's perspective camera. Legibility is
overlap, not size: "the legibility concern is pure overlap".

## What the spike settled (signed at the reads)

1. **The projection: orthographic · pitch 45 · yaw 45, with 30 as the
   check** (§105 verdict; the yaw value at the §106 kickoff). On ortho:
   "shockingly good". Under ortho the yaw is part of the projection, not a
   treatment on it: at yaw 0 a pitched board projects to a rectangle and
   reads as top-down against upright glyphs ("uncanny valley"), so yaw 0 is
   out. The long lens (perspective, FOV 20) is the documented fallback,
   "95 % of the way", not built. Perspective 50 was a distant third. On the
   numbers (2560×1440): the lean 0.0°, clump overlap 0.00 (today 0.23–0.27),
   the smallest glyph at fit 51.9 px at 24×24, 1.28× today's smallest.
2. **One ground mark per combatant, `merged`** (106c: "not even close"):
   the team's shape (a circle for yours, a diamond for the enemy's, a
   triangle for an active camp) at contact size, filled dark and outlined
   in the team colour. It says whose and touching at once. The shapes are
   world shapes, so at yaw 45 the enemy's diamond draws as a screen
   rectangle while the tile is the screen diamond; the three stay distinct.
   Values as read: contact size 0.55, fill opacity 0.45, outline opacity
   0.3.
3. **A plate under every scenery body** (106c `filled`, 106c-post `all`):
   the body's footprint, filled dark at opacity 0.6 and framed in the
   body's colour, under walls, cover and rubble. A grid square, so it
   collides with no team shape.
4. **The marks lie on the terrain** (106c-post, 106c-post2): cut to each
   tile's own top, hanging down the step faces the camera sees, and hidden
   honestly by nearer terrain (`world` depth: "the flat quads were just
   slightly overwriting the edges of higher tiles in front"). The one gap
   found in play (106d): the marks glitch through the hill mounds.
5. **N×N slabs stand on the centre of their footprint** (106b: "Center
   looks great!"), at the footprint's highest tile top, slid along the view
   ray until nearer than every footprint terrain vertex (the slide clears
   the hill mounds; under ortho it moves nothing on screen).
6. **The anchor rule is deletable** (106c: "The few extra pixels that
   bottom gives just aren't that noticeable now that we have proper
   grounding"; 106d: all clear in a full run under `anchor-bottom`). A
   uniform quad-bottom anchor replaces R5–R7 + R10.
7. **The bar line stays ink-top** (§105: "the bar is just too high for the
   smaller letters"). R9 survives on typographic grounds alone; ortho
   removed its perspective motive.
8. **Glyph scale 1, yaw fixed** (§105). Both are Round 11 accessibility
   candidates (TODO), not players' settings this round.
9. **The overlay stack needs no fix** (106d): units form local frontlines,
   not the preview's clumps. If clumps become a problem, narrow the stack.
10. **The wall staircase is not a concern** (106d): with the marks, a wall
    run "very clearly reads as a straight line of units".
11. **Picks under yaw: no errors** in a played run (106d); terrain picks
    audited over two runs at step zero.
12. **The flyer: a camera-up lift of about 0.45, low confidence** (§105),
    its mark on its tile. Under ortho 0.45 is the lift that stops the flyer
    landing on its diagonal neighbour (13 % worst ink cover at yaw 45, 106a).

## Build decisions (proposed at 106e)

### D1. The projection ships as the default view

`DEFAULT_CAMERA_VIEW` becomes ortho · pitch 45 · yaw 45. Most of it exists:
both cameras, the fit's basis-projection loop, `setCameraView` and the
apron's parallel-ray branch landed at 105d behind a seam pinned
bit-identical at today's default. What is owed:

- `UnitOverlayLayer` reads `renderer.camera` per use instead of capturing
  it at construction. Production never swaps cameras, so this is harmless
  today, but the dev override has to re-point it through a seam (the
  `RenderPass`es already follow `setCameraView`);
- the resize branch and screen shake checked under ortho;
- gotchas #17, #51–54 and #68–69 re-audited against the new camera, and
  DESIGN's Camera paragraph rewritten ("fixed perspective … non-rotatable"
  is no longer true of the projection);
- `tests/board/cameraFit.test.ts` re-pinned at the new default, with the
  lean pin (world-up draws screen-up) permanent;
- the DEV-only scroll pan rotated by the yaw, so W is screen-up (D7).

### D2. The N×N slab rule replaces R11

The production `unitAnchorPos` N×N branch becomes the spike's `slabAnchor`
(centre + slide), and `tests/board/slab.test.ts` pins it through the 106a
measures (480 cases, with the unslid control). The slide, not a per-instance
depth bias in the shader, because under ortho the slide is exact and
screen-invariant; it grows a slab 3.3 % only under the lens fallback.

### D3. The marks are drawn by the terrain, as shapes in its shader (DECIDED 2026-09-23)

The session's pick; the user's lean too ("it sounds more robust"). Each
frame the board builds a small table of marks (position, shape, size, fill
and outline colour and opacity) and bins it per tile; the terrain's fragment
shader looks up its tile's few marks and evaluates each as a signed-distance
shape with derivative anti-aliasing. The hill mounds use a clone of the
terrain material, so they get the marks with it. What that buys:

- the marks appear on tile tops, step faces and mounds, and on any tile
  shape added later, because a mark is evaluated wherever terrain is drawn;
- depth is honest by construction (the mark is the terrain);
- the spike's mesh pool, per-tile cut and drape code are deleted;
- edges stay crisp at any resolution, and corner rounding and stroke width
  are parameters.

The alternative, a top-down render target sampled by world position, is the
smaller port but, by rough arithmetic, needs about a 2048² texture on a
large board to keep the thin outline crisp at 1440p. The outline takes the
team colour (`spriteColorForUnit`), which no held tint changes, and the
shape carries the identity either way. Cost is measured, not assumed: frame
time before and after at the user's resolution, with the per-tile bin size
reported.

### D4. The rule deletion

A uniform quad-bottom anchor. Deleted: R5 (the classifier and
`INK_FLOOR_EPSILON`), R6 (the descender room and barrier), R7 (the baseline
measurement), R10 (`inkBottomLift` and the marker lifts that follow R6).
The probes are re-derived from the atlas, never from the helpers being
deleted. The three doc drifts the C1 sweep found in these files (TODO
§"Round 7 close riders") are fixed on the way. R9 (the ink-top bar line)
stays. R2 and R19 keep their helpers, which are harmless; their comments are
re-grounded, since ortho removed their reason. The special-rule count
before and after is recorded.

### D5. Team identity: the ground mark is the channel

Against DESIGN "Team identity on the board":

1. *The grey read* — the acceptance test: the user, under Ctrl+Alt+G, in a
   live battle, says whose any unit is from the board alone.
2. *Per instance, all four identities* — circle, diamond, triangle, and the
   scenery plate.
3. *It survives held tints* — the shape carries it; the outline colour is
   not tinted either.
4. *Card-less units carry it* — a camp unit's triangle is on the board.
5. *No atlas cost* — the marks are shader shapes; no glyph cells are spent.

Two residuals are decided at the phase kickoff, with options posed then:
a camp unit's status pip is hue-only (it has no HUD card), and the
destructible wall's `CRACKED_STONE` tell is colour-only (a plate variant,
such as a broken frame, is one candidate; the atlas has one cell left).

### D6. Elevation on the board (DESIGN clauses, proposed wording)

1. An elevated unit's glyph rises camera-up; under the projection that is
   screen-up (the lean pin). Its ground mark stays on its tile.
2. The gap between glyph and mark is the elevation read. The lift must say
   "elevated" without landing the glyph on a neighbour's: at yaw 45, no more
   than about 15 % of any neighbour's ink covered (13 % measured at 0.45).
3. The mark alone says which tile.
4. It passes the grey read, because the mark is a shape.

The flyer mechanic stays Round 9 (it is sim); these clauses are what it
must satisfy, proven on the spike's posed flyer.

### D7. The camera question (D4), dispositioned

Proposed: **fit is the only production view this round.** Desktop fit is
legible by the user's read, and under ortho the smallest glyph at fit is
1.28× today's. Scroll mode stays DEV-only, with its pan rotated to screen
axes (D1). The windowed view (scroll, or responsive fit→window) and the
minimap and drag / wheel / touch pan it needs move to the round that builds
mobile, whose consumer they are. Nothing is foreclosed: under ortho a window
is one zoom number.

### D8. The spike code's disposition

Each build phase deletes the spike seam it replaces, in the same phase:
D1 → the projection dials drive the production view (the seam stays as the
dev override); D2 → the slab patch and `restampSlabs`; D3 → `GroundCues`,
`conform.ts` and the `ground`, `plate`, `plateScope`, `plateAlpha`,
`drape`, `cueDepth` and cue dials; D4 → the `anchor` dial and
`restampAnchors`. What stays as the dev board explorer: the panel shell, the
`bp=board-…` fixtures, the projection dials (yaw, for Round 11), glyph
scale (Round 11), the posed flyer (Round 9), and `tests/board`'s instrument,
whose lean and slab measures become the production pins.

## Scope guards

From the charter: no sim; no flyer mechanic; no walking N×N; no palette
(Round 8); no new archetypes; no player-rotatable camera. Added here: no
windowed view, minimap or touch pan (D7); no player-facing yaw or glyph
scale (Round 11); §101's font gates untouched (signed, permanent). No
snapshot bump and no fuzz-smoke trigger are predicted anywhere in the round:
nothing touches `src/sim|run|core|config|bot`, `config/` or `tests/fuzz/`.

## Exit

- The projection ships as the default view, played by the user; the lean
  and the slab rule pinned against production.
- The marks drawn by the terrain, read by the user, their frame cost
  measured.
- The identity clauses satisfied, and the grey read passed by the user in a
  live battle; the two residuals decided.
- The elevation requirement signed into DESIGN.
- R5–R7 + R10 deleted, with re-derived probes and the rule count recorded.
- The camera question dispositioned in DESIGN.
- The spike seams deleted as their replacements land.

## Marked uncertainty (open at signing)

- **Rounded plate corners** — the user, low confidence. A parameter under
  D3, read at its stop. A large radius drifts toward the circle, which is
  the player's shape.
- **The contact values** — 0.55 size and 0.45 fill are the dial defaults,
  never re-read on their own; D3's read confirms them.
- **The flyer lift** — 0.45 by eye, low confidence; Round 9 re-reads it.
- **The marks' GPU cost on weak hardware** — measured on the user's machine
  only; mobile stays untested (the user can't playtest it).
- **The overlay stack** — a watch; narrow it if clumps appear.

## The build phases

Entered in ROADMAP at 106e: **§107** the projection, built (D1, D2, and
D7's dev pan) · **§108** the ground mark drawn by the terrain, team
identity and the elevation requirement (D3, D5, D6) · **§109** the rule
deletion and the last spike seams (D4, D8), then the round close. Each is
cut at its own kickoff against the code as it is then, with its reads.
