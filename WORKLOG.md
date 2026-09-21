# WORKLOG — Round 7.5 (The Board)

Per-round narrative log (AGENTS "The planning stack"): findings, decision
rationale, rejected alternatives, scope changes, playtest verdicts land
here under the matching `## Phase N`; the ROADMAP stays a plan (one-line
mutations + a pointer back here). Created 2026-09-20 at the Round 7 close.
Prior round's log: [archive/post-94-worklog.md](archive/post-94-worklog.md)
(Round 7, Idioms — §95 the i18n layer → §96 the shells → §96.5 the live
bar → §97 tooltips → §98 color redundancy → §99 reduced motion → §100
input accessibility → §101 layout stability → §102 the two riders → §103
the idiom reference, SIGNED → §104 the sound registry → the close), with
its plan [archive/post-94-roadmap.md](archive/post-94-roadmap.md) and spec
[archive/round-7-spec.md](archive/round-7-spec.md) beside it.

**Read first:** `archive/post-94-worklog.md` §"The Round 7 close" — C1 is
this round's founding argument (why the charter moved from glyph rules to
the projection, the three code sweeps with their ✔-verified claims, the
rejected alternatives, the six spike experiments); C3 is why this round's
cuts carry READS.

## Kickoff — Round 7.5 (The Board)

### The charter hardening (2026-09-21) — a conversation, every call user-signed

Session 33047fac. The user opened the round asking for a hardening pass on
the charter ("overhauled … based on some very vague notions I had"). What
moved, and why:

- **The control could not win.** The decision point listed head-on / yaw-45
  / pitch / world quads; "perspective-50 the control" had no outcome that
  kept it. AND one premise was stale: the charter's "a float drifts, a
  tether leans" describes a WORLD-Y lift, which §79 retired — ✔ the quad
  rises in VIEW space (`billboard.vert.glsl:47-48`) and ✔ `aboveAnchor`
  (`anchor.ts:25-33`) is the one camera-up lift, so a fake flyer lifted
  through it sits directly screen-above its shadow under TODAY'S camera.
  What only a projection change fixes: upright glyphs beside leaning prism
  sides · a trapezoid cue under an upright glyph at the flank · depth-varying
  glyph size · a simpler fit. → **The spike is a FULL CROSS** (every
  treatment on every projection) and perspective can win.
- **From hypothesis test to exploration** (the user's reframe, accepted):
  "I don't expect any one position in the cross to win; rather I expect to
  find one that looks directionally best, and then we'll refine." Taste
  cannot be pre-registered honestly, so C1's "pose what makes each option
  LOSE" is REPLACED by: **constraints are pre-registered, preferences are
  explored.** The constraints (a candidate that breaks one is out): the
  identity clauses hold under Ctrl+Alt+G · 24×24 and 12×32 fit · a lifted
  unit reads as above ITS tile · clump overlap no worse than today's — as a
  FRONTIER (a projection fails only if NO glyph scale gives overlap ≤
  today's at a size the user still finds legible; the user's worry was a
  draft failing on something a glyph-size tweak remedies) · glyph px at fit
  no worse than today's camera at the same viewport. **The tie-break: a tie
  goes to perspective** — a projection change costs a build, so it must be
  clearly better, not different-and-fine (the guard against drifting toward
  whatever was looked at longest).
- **Legibility is overlap, not size** (the user: large boards at fit "remain
  pretty legible … the legibility concern is pure overlap"). ✔ Glyph size is
  world units (`billboard.vert.glsl:48`), so overlap is VIEWPORT-INDEPENDENT
  and measurable headless; the viewport moves only absolute glyph px.
- **"Diorama feel", decomposed** (the session's candidates, the user's
  read): convergence (the board as a receding slab — lost under ortho,
  cannot be faked) is what the user expects to miss; the size gradient and
  parallax are "definitely not a major issue"; terrain thickness, occlusion
  and the CRT chain survive any projection. Ortho + yaw gives the isometric
  "object" read, NOT convergence back — eyes decide whether it scratches
  the same itch. **Perspective + yaw JOINS the cross** (two-point
  perspective, arguably the strongest diorama read).
- **The long lens is RE-ADMITTED** (C1 excluded it because "it deletes no
  rule" — which assumed the camera-up rules were a burden; they are one
  pinned function and a shader line). The user: "not exactly optimistic,
  but … let's not limit ourselves prematurely."
- **The pitch dial goes BOTH ways.** C1's 45 / 35 / 30 only went shallower
  (✔ pitch is from horizontal, `Renderer.ts:15-16`): a tile's projected
  depth shrinks (sin θ 0.71 → 0.57 → 0.50) under a constant glyph — more row
  occlusion, the "which tile" complaint made worse. Steeper (~55–60°) is the
  classic ¾ top-down. The audit then found steep has its own cost (below).
- **The budget: two passes** — coarse (the cross; the user names a
  direction), then refine ONE point, or TWO at the user's word; a third
  pass means re-cutting. Lighting / decorations are pass-two territory at
  the earliest, never pass one.
- **Judge it in motion, and PLAY it before signing** — every C1 fixture was
  a posed still; the fixed seed gives the same live battle under every
  bookmark; the novelty effect cuts both ways, so pass two ends with played
  battles, not looked-at fixtures.
- **The hard flyer fixture** is a ground unit in the row BEHIND the flyer
  (✔ no co-location, META-ROADMAP §Round 9 "No-co-location is expected to
  survive") — the lifted sprite lands over its north neighbour and the
  shadow alone carries "which tile".
- **Viewports, disentangled** (the user: desktop is primary, this monitor
  is the test bench — 2560×1440 at 100 %; rudimentary mobile is wanted but
  the user cannot playtest it, an accessibility limit; the browser build
  stays because the first outside playtesters come through itch): (1) TASTE
  is read on the user's monitor, plus a ~1280×720 window as the itch-embed
  stand-in; (2) everything else is NUMBERS — the sweep's viewport axis
  (1920×1080 · 1366×768 · 1280×720 · 960×540 · 1024×768 · 844×390 ·
  390×844 · 2560×1440; the list is from general knowledge, unverified
  against any survey; ✔ `Renderer.ts:148` honours `devicePixelRatio`, so
  CSS and device px both print), constraint RELATIVE to today's camera;
  (3) MOBILE is deferred with one sentence owed — the projection must not
  foreclose it. Recommendations for its round: landscape-only on phones ·
  pane emulation covers layout only · ergonomics needs a borrowed pair of
  hands + a checklist · builds stamp viewport / DPR / pointer type (Round
  8's telemetry). The itch "mobile friendly" flag is believed opt-in —
  UNVERIFIED, check at page setup.
- **The camera question gains a third candidate: RESPONSIVE fit→window**
  (fit until glyph px falls under a floor, then window; under ortho the
  transition is one zoom number) — desktop fit is legible by the user's own
  read, so the A/B's real consumer is the small screen, and the minimap +
  touch-pan work may belong where mobile is built, not in 7.5.
- **The session's limits, said up front:** the pane is Chromium, often
  hidden, JPEG-smeared — this phase the session proves wiring and numbers;
  every LOOK is the user's. Expect stop-heavy reads.

### The code-reality audit (2026-09-21, three parallel read-only sweeps at `e722863`)

~9 min wall. ✔ = re-verified by the session at file:line; the rest is
second-hand and re-verified by the step that touches it.

**⭐ The finding that corrects the charter: the ANCHOR is already per-CLASS,
not per-glyph.** ✔ `baseAnchorYFor` (`glyphs.ts:238-240`) returns one of
TWO values. ✔ MEASURED on the live atlas (the Chromium pane, 2026-09-21 —
the user's Firefox may rasterize a row differently; the structure cannot):
`M g a r @ / X #` all −0.4375, `╥ ▄` −0.5 — 4/64 of a cell apart. So C1's
"uniform-anchor flag — the direct test of what the rule deletion rests on"
is a **4-atlas-pixel shift of the letterforms** (under a plain quad-bottom
anchor `g`'s tail clears the tile by 7 rows, not the barrier's 3): the
classifier, the descender room and the baseline measurement are PREDICTED
deletable nearly for free (the user's eye confirms at 105b). The per-glyph
behaviour is in the LIFTS (✔ ink-top measured 0.58 → 0.92 across the ten
glyphs; `a` 0.69 vs `M` 0.83), and the one that matters — the HP-bar line —
is the USER'S OWN §79e reversal of a uniform line (✔
`BattleRenderer.ts:1062-1081`), for two reasons: (a) short glyphs wore
their bar high; (b) a px gap read tight near and high far AT ONCE — pure
perspective, which ortho deletes. **So the projection bears on the rule
count through the BARS, not the anchor**, and (a) is a taste call the round
re-poses.

**The rule table** (sweep 1; the old "13" was never recorded —
`archive/post-94-worklog.md:4950` has the count only). 16 rules, 20 with
the §101 gates. Class · pinned? · deletable under (a) uniform cell + ground
cue / (b) ortho / (c) neither:

| # | rule | where | class | pin | dies under |
|---|---|---|---|---|---|
| R1 | `instanceAnchor`, the view-space anchor ✔ | `billboard.vert.glsl:37,48` | projection | yes (stub atlas) | (a) partly — y becomes a constant |
| R2 | `aboveAnchor` ✔ | `anchor.ts:25-33` | projection | yes + control | (b) its REASON goes; the helper is harmless |
| R3 | the world-anchor convention, `GLYPH_HALF_HEIGHT` ✔ | `BattleRenderer.ts:1022-1028, 2042` | projection | no | (c) |
| R4 | raw ink measurement | `glyphs.ts:122,148-175` | typography | yes | (c) — click boxes need it |
| R5 | the classifier + `INK_FLOOR_EPSILON` ✔ | `glyphs.ts:209,238-240` | typography | yes | **(a)** |
| R6 | the descender room + barrier ✔ | `glyphs.ts:247,259-266` | typography | fn only | **(a)** |
| R7 | the baseline measurement | `FontAtlas.ts:252-256` | typography | **no** | **(a)** |
| R8 | lift 1 `inkCenterLift` (FX endpoints) | `FontAtlas.ts:318-321` | typography | **no** | (a) mostly |
| R9 | lift 2 `inkTopLift` (bars, hitsplats) ✔ | `BattleRenderer.ts:1079-1081` | typography + a perspective motive | **no** | (a) at the §79e cost; (b) removes half the motive |
| R10 | lift 3 `inkBottomLift` + the marker lifts | `BattleRenderer.ts:640-646,673-680` | typography (a knock-on of R6) | **no** | **(a)** |
| R11 | the footprint anchor (near row, row-max Y) ✔ | `BattleRenderer.ts:1084-1118` | depth | no | (c) — and it ASSUMES no yaw |
| R12 | the ground-step Y profile | `SpriteAnimator.ts:128-150` | depth | no | (c) |
| R13 | click boxes: `padInk`, `INK_PAD_PX`, the mirror pick | `pick.ts:46-93` | typography + projection | yes | (c) — stays, as chartered |
| R14 | the explicit `fonts.load` | `FontAtlas.ts:194-195` | provenance | no | (c) |
| R15 | the fallback probe | `FontAtlas.ts:101-137` | provenance | no | (c) |
| R16–16c | subset + coverage · the line-box pin · the UI glyph inventory | `tests/font-coverage.test.ts` | provenance | yes | (c) — §101, OUT of scope |
| R17 | atlas registration + the 48-cell budget | `glyphs.ts:34-82` | provenance | yes | (c) |
| R18 | the overlay stack CSS (`--overlay-gap`, `--fp-scale`) | `ui.css:149-177` | stacking | no | (c) |
| R19 | hitsplat anchoring, one projection | `UnitOverlayLayer.ts:267-283` | projection (history) | no | (b) the reason only |
| R20 | the sparkle body nudge | `BattleRenderer.ts:1627-1634` | stacking | no | (c) |

World-Y (not camera-up) offsets still live: the catapult lob arc
(`SpriteAnimator.ts:271`, ✔ `CATAPULT_ARC_HEIGHT = 2.0`
`BattleRenderer.ts:2023` — leans at the flanks under perspective, no
comment justifies it) · the sparkle rise (one effect mixes both frames) ·
the aura motes (justified as floor decoration). No unit hop arcs exist —
every move is a ground lerp. More drift found beside the three TODO
entries: the marker-lift doc block (`BattleRenderer.ts:2055-2056`) says
"visual CENTER", the code uses the ink top.

**The projection swap is cheaper than chartered** (sweep 2). Already
camera-generic: `pickCell` (`Raycaster.setFromCamera`) · `pickInstanceAtNdc`
(typed `THREE.Camera`; its ortho test is unpitched, arithmetic convenience
only) · the ONE DOM projector `projectToCss` · ✔ `sortByDepth`
(`SpriteRenderer.ts:335`, a planar view-axis key) · shake (matrix columns) ·
the post chain. The real work: ✔ the fit (`Renderer.ts:401-477` — the
derivation hard-codes right = (1,0,0) and reads `camera.fov`; ONE
basis-projection loop over the 8 corners covers yaw AND ortho, and gotcha
#52 says keep it one function) · the resize branch (`camera.aspect` means
nothing on ortho) · ✔ `CAMERA_PITCH_RAD` a module const · ✔ `camera` typed
`readonly PerspectiveCamera` (`Renderer.ts:82,158`) · TWO STALE-REFERENCE
hazards on a camera swap (both `RenderPass`es `Renderer.ts:177,193`;
`UnitOverlayLayer` captures at construction, `Game.ts:227`) · one shader
line (`apron.frag.glsl:109-111` builds its ray from `cameraPosition` —
parallel rays under ortho ⇒ a ghost ring; three injects `isOrthographic`) ·
`Y_HALF_EXTENT = 1` does not cover a scaled glyph's top. **The glyph-scale
dial** desyncs ~ten world-unit constants that assume size 1 — ✔
`UNIT_PICK_SIZE` (`:2067`), ✔ `GLYPH_HALF_HEIGHT` (`:2042`), the three
atlas lifts' call sites, the marker gaps, the CSS bar width; ✔
`uSpriteSize` has no setter and lives on two materials
(`SpriteRenderer.ts:134,183,198`). **Pitch has a cost at BOTH ends:** steep
→ a quad leans back over the row behind and tall terrain bites its top
(depth-tested, `depthWrite: false`); shallow → row occlusion + the board's
outer side walls loom. Scenery: all four prism sides are built, the
backdrop is ±300 into a matching flat colour — no seam EXPECTED at any
dial; read, not seen.

**Yaw breaks less than feared** (sweep 3): nothing on the board is
screen-aligned — no deploy / sector highlights, no hover, no path or range
previews; the objective marker is a camera-up billboard; no locale string
names a board direction; several layouts ALREADY spawn in diagonal corners
(`labyrinth`, `icebergs`) and the player's side is rng-picked on 8 of 11.
The real costs: wall runs (`#` billboards) overlap and staircase on diamond
tiles · an N×N rubble slab is a screen rectangle over a footprint 1.41×
wider · ✔ R11 is written against "the camera never rotates"
(`BattleRenderer.ts:1090`) · the pan mapping + the scroll clamp are
world-axis. **Fixtures:** no authored 24×24 (`endlessCorridors` 12×32 is
the largest; procedural rolls `rng.int(12, 24)` square — a seed hunt finds
one); no straight-to-battle path, no posed-unit fixture; the 5 s battle
countdown already parks a fully placed board. **Gating:** URL run-dials
SHIP (`Game.ts:169` parses unconditionally) and live in `src/run` (the fuzz
hook) — the explorer's dials go in a `src/dev` module referenced only from
the `main.ts` DEV block (the pattern verified absent from a built bundle),
never `RunConfig`. ✔ Dev chords taken: S L D K G A C (`devKeys.ts:72-100`);
the keybinding registry blocks E F H T M + digits + Space + Slash (and
`devKeys`' header is stale on M and Slash); Firefox owns R (gotcha #134).
**Ctrl+Alt+P** is free of all three sets as read — one press in the user's
Firefox at 105b before it counts. A new direct child of `#ui` must respect
gotcha #137.

### The cut (2026-09-21, user-signed — "Fully signed!")

The user asked whether one phase held all of it. It did not: the draft's
105f ("its sub-cut is written after pass one") was a phase hiding inside a
step — what pass two builds depends on where pass one points, and the
planning stack cuts sub-steps at a phase's kickoff against code reality. →
**§105 = the spike, pass one; §106 = pass two + the spec** (its own kickoff
audit, cut and reads; the tie-break's natural home — no clear direction ⇒
perspective holds, refine that). The round's build phases follow the spec.
No snapshot bump predicted; the fuzz-smoke fires on NO §105 step (nothing
under `src/sim|run|core|config|bot`, `config/`, `tests/fuzz/` — which is
why the fixture loader stays out of `RunConfig`). The Renderer seam in 105d
is the one production touch: pinned unchanged at the default by an oracle,
the build's seed if a non-control wins, reverted if perspective does.
The cut lines + reads: ROADMAP §105.

## Phase 105 — the projection spike, pass one
