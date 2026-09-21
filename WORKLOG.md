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

### 105a — the headless geometry instrument (2026-09-21)

`tests/board/` — `geometry.ts` (pure; imports NOTHING from `src/render`:
three's own cameras, a re-derived basis-projection fit that covers yaw +
ortho, the billboard re-stated from the shader, the ink from a dumped
census) · `inkCensus.json` (47 glyphs off the LIVE atlas in the Chromium
pane, provenance in the file) · `geometry.test.ts` (11 known answers) ·
`cli.ts` → `npm run board-geometry` (5 760 rows in ~7 s → the gitignored
`tests/board/output/sweep.csv`; `--viewport=` / `--board=` for the
condensed read). The precedent is `tests/pathing/`.

**The known answers held, raw** (§79b measured the LIVE camera in a real
15×15 battle at 1280×720 — a surface this file shares no code with): the
0.5 world-Y skew ±9.1 / ±5.0 / ±3.2 px → **9.21 / 5.10 / 3.24**; the near-row
half-quad 26.3 px → **26.48**. A consistent ~1 % high — the live probe's
tile tops carried terrain height, this model is FLAT; the tests hold ±0.5 px.
Also pinned: the grid centre at x = 640 · a camera-up lift drifts 0 under
every view · C1's closed form `atan(x′·tan pitch)` at the look-at row ·
**ortho: world-up = screen-up at every corner of every board, yawed or not
(the future pin), with perspective as its failing control** · the restated
anchor reproduces the measured −0.4375 / −0.5 · every view × board ×
viewport FITS · overlap is 0 for distant units, > 0 for an oversized clump,
and viewport-independent under ortho.

**Two blind spots in the FIRST table, both the instrument's, both fixed
before the numbers were believed** (the first run read "near-corner clump
0 %" and "flyer→neighbour 0 % under yaw"): (1) perspective's worst clump is
the FAR row — near rows see a steeper effective pitch, far rows a shallower
one — and only the centre + the near corner were measured; (2) under yaw
"straight up the screen" lands on a DIAGONAL neighbour and the fixture
checked grid-north only. Now: a far-row clump, the flyer's WORST of three
far neighbours, and the frontier judges the worst of the three clumps.

**What the numbers say (2560×1440, glyph scale 1, the ink-RECT upper
bound — they rule regions out, they do not pick a winner):**

| | today (persp50 · 45° · yaw 0) | ortho 45° | long lens (20°) 45° | ortho 45° yaw 45 |
|---|---|---|---|---|
| glyph px near / far, 15×15 | 105.9 / 63.1 | 107.7 / 107.7 | 107.1 / 85.0 | 78.8 / 78.8 |
| glyph px near / far, 24×24 | 70.5 / 40.5 | 71.8 / 71.8 | 71.3 / 55.5 | 51.9 / 51.9 |
| glyph px near / far, 12×32 | 54.3 / 30.7 | 55.4 / 55.4 | 55.0 / 42.5 | 56.2 / 56.2 |
| worst clump mean / max, 15×15 | 6 % / 23 % (the FAR row) | 1 % / 7 % | 2 % / 15 % | 0 % / 0 % |
| lean at the near corner, 15×15 | 36.0° | 0° | 11.9° | 0° |
| flyer (lift 1.0) covers its worst far neighbour | 46 % | 54 % | 50 % | **100 %** |

- **Perspective's cost is concentrated in the far row**: it is both the
  smallest glyph on the board and the most overlapped. At MATCHED worst-clump
  overlap (the frontier), ortho's smallest glyph is **~2× today's** on every
  board (1.96× / 2.04× / 2.35× at 45°), a long lens ~1.35–1.6×. The near row
  is a wash (the fit is bound by the near edge either way).
- **Shallow pitch is out by the constraint under today's camera**: persp50
  at 30° has NO swept scale (down to 0.7) matching today's overlap; 35° needs
  0.7. Every STEEPER pitch is strictly better on overlap and own-tile
  fraction (25 % → 38 % at 60°) — its costs (terrain biting glyph tops, less
  side-face, the flyer covering more of its neighbour: 67–79 %) are NOT in
  this flat model. The panel is where they show.
- **Yaw kills clump overlap (0 % everywhere) and pays in size** (−27 % glyph
  px on square boards under ortho; the 12×32 corridor is the exception — the
  diamond fits 16:9 better, +1 %) **and in the flyer**: at yaw 45 / pitch 45
  a lift of exactly 1.0 lands a flyer ON its diagonal neighbour
  (√2·sin 45° = 1.0 — geometry, not an artefact; the cover is lift-dependent,
  the panel's lift dial is where it is read).
- The lean, MEASURED: 36.0° at a 15×15's near corner, 39.9° on 24×24, 17.5°
  on 12×32 (C1 derived "≈24° at the flank, ≈40° at the screen edge").
- Own-tile fraction is LOW everywhere (25 % today): most of a glyph's ink
  already sits over the tile behind it, under every projection at 45°. The
  "which tile is it on" complaint is pitch + anchor, not projection.

No `src/` touch; no smoke (predicted). Tests 3006 → 3017.

### 105b — the panel shell + the H1 dials, under today's camera (2026-09-21) — ◐ BUILT, UNREAD

Session b1d90d3c. `src/dev/boardPanel/` (six files) + the `KeyP` case in
`devKeys.ts` + two lines in `main.ts`'s DEV block. Tests 3017 → 3028; no
smoke (predicted — nothing under the hook's paths), no bump.

**Step zero held the cut, and found the build was cheaper than its card.**
Nothing of 105b existed. Measured, not read: the anchor is stamped into a
per-instance attribute at glyph-write time from `FontAtlas.baseAnchorY`
(`SpriteRenderer.ts:450`), and all three lifts (`FontAtlas.ts:318-339`) and
the mirror pick route through that same method — so ONE override point moves
the stand line and everything stacked on it, consistently. The overlay stack
and the hitsplat share `inkTopLiftFor` (§79e's "one definition"). And Game's
frame callback (`Game.ts:185-188`) calls `sprites.sortByDepth` after the
scene settles and before the render — the exact moment a follower must sync.

**The decision: ZERO production touch.** The cut's scope guard names ONE
production seam for the whole phase (105d's fit), so 105b's three dials
reach the renderer as RUNTIME patches applied from `src/dev` (`seams.ts`):
`atlas.baseAnchorY` on the instance, `inkTopLiftFor` on the prototype (a
BattleRenderer is built per battle), `sortByDepth` on the instance as the
frame hook. Each falls through to the original at the default dial.
Rejected: DEV-gated setters inside `FontAtlas` / `BattleRenderer` — typed
and sturdier, but production edits to a render path for a spike that may be
reverted, and they would need their own unchanged-at-default oracle. The
price, accepted and guarded: the reaches are name-keyed into privates tsc
cannot check, so each is asserted at install and a renamed seam logs a loud
`[board-panel] seam moved` instead of reading as "the dial does nothing" —
which is exactly what the cut says WRONG looks like.

**What the dials are** (the table is `state.ts`; a dial is one row — the
control, the typed state and the bookmark derive from it, so 105d / 105e add
a projection or glyph-scale dial as a line):

- `anchor` today / bottom — the H1 read. `bottom` = −0.5 for every glyph
  (the floor family is already there, so only letterforms move: 4/64 of a
  cell DOWN; `g`'s tail then clears the tile by 7 rows, not 3).
- `bar` ink / uniform + `barY` — **this re-poses the USER'S OWN §79e
  reversal; it is a taste call, not a bug hunt.** The uniform line is
  defined in cell units above the QUAD BOTTOM so it is orthogonal to the
  anchor dial. Default 0.90: the first default (0.89) was caught by its own
  pin — `M`'s ink top is 57/64 = 0.890625.
- `cue` off / outline / filled + size + opacity — flat WORLD-space meshes
  (they will project correctly under whatever 105d dials in), one SHAPE per
  side: circle = yours · diamond = the enemy's · triangle = an active camp ·
  inert scenery none — DESIGN's four identities, clause 1 by construction.
  `renderOrder −1`, depth-tested, no depth write, layer 0 (never blooms).
- `row` — the posed row. RENDER-ONLY dev sprites + REAL overlay stacks
  (`UnitOverlayLayer.add` / `addDestructible` — the production bar DOM and
  CSS), on the first run of six clear, dry, passable tiles scanning from the
  middle row TOWARD the camera. No sim unit exists for them: live units walk
  through the row. 105c's parked fixtures supersede it.
- The bookmark: `?bp=anchor-bottom_bar-uniform`, non-defaults only, every
  other query pair left byte-for-byte; a `bp` param opens the panel at boot
  and the seams install at boot, so a bookmarked dial is live before the
  first battle stamps a sprite.

**Verified, by which instrument** (the pane is Chromium, hidden, 1280×720; a
parked 12×12 elite battle, `?seed=7&layout=river&firstNode=elite`):

| claim | instrument | result |
|---|---|---|
| the default state is today's board | the raw `aAnchor` GPU buffer vs the CENSUS values | 9 letterforms −0.4375, 6 blocks −0.5; restored exactly after a flip |
| `anchor=bottom` reaches every base sprite | the same buffer; `restamped` vs an independent tally | 21 of 21 at −0.5 |
| the bar line, posed row, all four anchor × bar combos | bar height above the quad bottom in cell units = three's own projection of the ground point + the bar's DOM transform + the raw anchor — NOT `barLift` | ink: .750 .578 .640 .891 .750 .750 vs the census ink tops .75 .578 .641 .891 .75 .75 · uniform: .900 ± .001 on all six, under both anchors |
| the same, LIVE units (the prototype patch, not the row's path) | as above, via `br.update(0)` | ink tops under `ink`; .900 × footprint under `uniform` (a 3×3 rubble 2.700) |
| the cue splits by side | mesh count by shape key | 6 circles, 7 diamonds, none under inert scenery |
| keys typed in the panel stay there | Space on a focused dial vs Space on `<body>` (the control) | pause untouched vs toggled; Ctrl+Alt+P closes from inside |
| nothing ships | `npm run build` + grep `dist/` for five panel-unique strings, with a positive control | 0 hits; control 3 |
| the codec · the bar rule | `state.test.ts`, 11 tests, expectations off `tests/board/inkCensus.json` | green |

**NOT verified — the user's:** every LOOK (whether 4 atlas px of stand line
is visible at all, whether `g` reads as standing or floating under `bottom`,
whether the uniform line reads calmer or wrong, whether the cue hides the
tile or carries the grey read under Ctrl+Alt+G) · **the Ctrl+Alt+P press in
Firefox** (a synthetic Chromium `KeyboardEvent` proves the wiring only —
gotcha #134) · motion (the battle was parked throughout) · 2560×1440.

**Known cosmetic limits of the mock:** a cue follows its unit's ground
anchor, so mid-step between tiles of different height its far edge can dip
into the taller tile · cues ignore spawn fade-ins · the panel covers the
top-right HUD corner.

**Three of my own defects, each caught before it was believed.** (1) The
first URL writer used `URLSearchParams.set`, which re-serialized the WHOLE
query (`roster=a,b` → `a%2Cb`) → `spliceBookmark`, pinned. (2) A quoted
heredoc still ate a regex backslash (`/^\?/` → `/^?/`, invalid) — the AGENTS
norm names this burn exactly; caught by grepping the result, fixed
regex-free (papercut filed). (3) ⚠ **A pane script that TIMES OUT is not
dead.** The first measurement awaited `requestAnimationFrame` in the hidden
pane and timed out at 45 s; it stayed suspended, and every later screenshot
forced a frame that resumed it one step — so it kept calling
`boardPanel.set()` for minutes, and two captures seconds apart showed dial
states never set together. It read exactly like a panel bug (or the user
trying the pane). The tell was that the state changed with NO `change` event
on the control; a reload killed it. Never await rAF in a pane probe — the
frame hook is reachable synchronously (`__game.sprites.sortByDepth(camera)`)
— and reload after any timed-out script (papercut filed; a HANDOFF pane tip
at the round sweep).

### 105b — the user's read (2026-09-21) ✅ + 105b-post, the `cueDepth` dial

**The verdict, the user's words:** "I had a LOT of fun playing with this!
The chord is usable, every dial is working, and the URL is updating
properly. The cues all nicely convey who a unit belongs to." So: Ctrl+Alt+P
clears Firefox (gotcha #134's third key set — the one check the pane could
not make); none of the cut's three "wrong looks like" fired. No verdict yet
on the anchor or the bar line — those are read with the cross at 105e, not
here. Two notes:

1. **Static multi-tile bodies (rubble) will need an indicator too.**
   DEFERRED to §106 at the user's call ("the location where we place glyphs
   might change") — and the audit agrees from the other side: the natural
   form is a footprint frame in world space, which sits on R11, the
   footprint anchor written against "the camera never rotates". → TODO, to
   be posed at the §106 kickoff audit (the §94d lesson: a deferred half gets
   a line somewhere, in the same commit).
2. **The cues clip through taller tiles.** The user gave the session the
   slotting call. → NOW, as `105b-post`, and as a DIAL rather than a patch.

**The mechanism, checked before the fix was designed.** Tile tops are flat
full-tile quads (`TerrainRenderer.ts:353-358`), so a cue ≤ 1 tile cannot
intersect a neighbour. The "clipping" is the DEPTH TEST: the cue lies on
the ground, so a taller tile NEARER the camera occludes it exactly as it
occludes that ground (so does a hill's pyramid, and a mid-step boundary
crossing). Physically right; reads as a defect, because the cue is UI. My
105b "known limit" had named only the mid-step case — the static one is the
larger, and it was the user's eye that found it.

**Why now, and why a dial.** (a) The artefact is PROJECTION-DEPENDENT —
shallower pitch, more near-tile occlusion — so left in, it would have
biased the cue's read across the 105e cross by pitch. (b) It is a real
design fork, not only a bug: a cue IN the world (grounded, occludable) vs ON
it (always whole, slightly x-ray), and which reads better plausibly differs
between ortho and perspective. `cueDepth: overlay | world`, default
`overlay`; one table row + one material line, the control / codec /
round-trip test derive from the table. Glyphs cover the cue under both
(renderOrder −1; sprites never write depth).

**Verified:** three's OWN offscreen render of the real scene (terrain + cues
only, cues painted magenta, 640×360, a parked 12×12 river battle, cue size
1.1) — `world` 4084 cue px · `overlay` 4145 · `world` again 4084: the test
hides 61 px (1.5 %) here, reproducibly, and the dial removes it. A flat
board; a hillier one hides more. `?bp=…cueDepth-world` parsed at boot.
Tests 3028 (the table-driven round-trip covers the new row), tsc clean.
**NOT verified:** the LOOK of `overlay` (does x-ray over a tall near tile
misplace "which tile"?) — a `batch` read, at 105e with the cross.
