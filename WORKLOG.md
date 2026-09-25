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

### 105c — the fixtures (2026-09-21) — ◐ BUILT, UNREAD (a `batch` read → 105e)

Session 3f3a4ad2. `src/dev/boardPanel/` gains `fixtures.ts` (pure) ·
`posed.ts` (supersedes `posedRow.ts`, deleted) · `boot.ts` + their test;
`state.ts` +4 dials (`board` · `pose`, replacing the `row` bool · `lift` ·
`shadow`); `groundCue.ts` + the shadow disc; `main.ts` — the panel's import
became DYNAMIC (below). Tests 3028 → 3050 (the panel's 11 → 33); no smoke
(predicted — nothing under the hook's paths), no bump.

**Step zero was a probe, and it held the card** (a scratch `.ts` driving the
real `Run` as `Game.createRun` does): root `enterNode` + `advanceTurn` reaches
`battle` on every candidate URL · the same URL twice gives an equal
encounter · a seed hunt over 1..400 found 30 procedural 24×24s (seed 10 the
first). One thing no audit had named: **the enemy budget scales with the
roster** (8 enemies vs 5 on the same seed), so a fixture pins `roster=` too.

**The decisions.**

- **Posed things stay RENDER-ONLY** (the charter's word), generalizing
  105b's row instead of spawning sim units through `world.spawnUnit`. The
  rejected path buys real click boxes and nothing pass one reads; it costs
  HUD cards for every posed unit, a reach into the seeded fight the `live`
  fixture must leave byte-alone, and `removeUnit` emits no event — the
  renderer would keep the sprites. 105b's comment had PREDICTED "real parked
  units"; the prediction is withdrawn, not the cut (the cut says "fixtures").
- **`bp=board-<id>` is the ONE source of the board.** Game parses the run
  dials inside its constructor, before the panel exists, so a fixture cannot
  apply after boot. `applyBoardFixtureUrl` runs BEFORE `new Game` and rewrites
  the run pairs from the table on every load (`replaceState`, no navigation);
  the `board` dial is the one dial that RELOADS. What the cut calls wrong — a
  fixture opening a different board on reload — is then structural: a
  hand-typed `seed=` beside a `board-` is overwritten. The price, said on the
  dial's hint: choosing a fixture replaces the user's own run dials.
- **The loader checks itself.** After its two dispatches it compares the
  opened layout + grid to the table's `expect` and prints `FIXTURE … FAILED`
  in the panel on a mismatch — the cut's "wrong looks like", on the surface
  where it would be seen.
- **The poses are 105a's, cell for cell** — `clumpAt(centre | 1,1 | cx,h−2)`
  with its nine glyphs in its order, the flyer `V` at the centre over three
  `M`s in the row behind (105a's diagonal-neighbour fix) — pinned against
  `tests/board/geometry.ts`, so the eye reads what the instrument measured.
  A group lands on its ideal cells or on the nearest clear fit, and a moved
  group SAYS "MOVED … not the measured spot" in the panel.
- **The flyer rides `aboveAnchor`** (camera-up, per frame), so it stays
  "straight up the screen" under whatever 105d dials in; its cue + shadow
  stay on the tile. `lift` defaults to 105a's 1.0; `shadow` is a dial because
  "the shadow alone carries which tile" IS the read.
- `live` is not parked (the normal 5 s countdown); every other fixture is,
  by the HANDOFF instance patch on `countdown.advance` — Space still fights,
  so any parked board is one key from motion.

**Two findings, both from running it rather than reading it.**

1. **No 15×15 seed hosts every pose on its measured spot.** The first live
   load of `open15` (seed 6, step zero's pick) printed `flyer … MOVED`. A
   hunt over 1..600 (43 seeds roll 15×15, the real terrain + both teams
   placed by `spawnEncounter`): none is clean — a team spawns where the
   far-row clump goes. Seeds 91 and 437 move ONLY that clump (91: to 4,11).
   → `open15` = seed 91, pinned headless ("every pose on its spot except the
   far-row clump", with seed 6 as the failing control) — and the LIVE panel
   printed the same one line, `far row @4,11`, from `BattleScene.mount`'s own
   setup: two independent placements agreeing. So the far-row clump, the
   worst one 105a measured, is read two rows nearer than it was measured;
   the panel says so. On `corridors` the four corners are walls (edges move
   one tile); on `big24` the near-corner and far-row clumps move.
2. **⚠ The fixture table SHIPPED.** The nothing-ships grep (five panel
   strings + a positive control) found `firstNode=elite&roster` in `dist/`:
   `BOARD_IDS`, `RUN_BASE`, `POSE_IDS` and five `${…}` residues — main.ts
   imported the panel STATICALLY, relying on the tree-shaker to prove the
   module's top level pure, and template literals / spreads are not provably
   so. ~200 bytes of inert strings, but the phase's scope guard is "nothing
   ships". Fixed structurally, not by coaxing the shaker: a DEV-gated
   `await import('./dev/boardPanel')` — `DEV` is a build constant, so the
   branch and the module graph behind it are gone (the first fix left a dead
   `null?.applyBoardFixtureUrl()`; an `if` removed it). Re-grepped: 0 on
   eight strings, control 1. The other static DEV imports (`devKeys`, the
   trace recorder) were audited the same way: clean. 105b's five-string check
   passed because 105b's tables happened to be shakeable — the check was
   right and the pattern was luck.

**Verified, by which instrument** (the pane is Chromium, hidden, 1280×720):

| claim | instrument | result |
|---|---|---|
| each fixture opens the board the table names | fixtures.test.ts through the real parser + `Run`; a wrong-seed control | 5 / 5; the control fails |
| … and live | the loader's own check + `world.gridW/H` | quarry 14×12 · open15 15×15 · corridors 12×32 · big24 24×24 · live 12×12, all `ok` |
| a bare `?bp=board-…` is enough; a hand-typed run dial cannot win | `location.search` after boot, from `?seed=123&layout=river&bp=board-open15` | rewritten to seed 91 / procedural |
| a reload opens the same board | a hash over the grid, every tile kind and every unit's archetype : team : cell, kept in sessionStorage across `location.reload()` | equal (nav type `reload`); a different board hashes differently |
| parked means parked | 600 × `activeScene.tick(1/60)` | remaining 5, tick 0, paused |
| the control: `live` is not | 480 × the same | remaining 0, tick 59 |
| the panel's own board switch | `boardPanel.set('board', …)` → the next page's state | lands on the fixture; `off` leaves `?bp=cue-outline` and the character select |
| the flyer is at ground + camera-up × lift | the raw `aPosition` buffer vs the camera matrix's up column (NOT `aboveAnchor`) | 3e-8 at 1.0 · 7e-9 at 1.5 · nothing left at the old spot (0.5 away) |
| the shadow dial | meshes at `renderOrder −2` | 1 → 0 |
| the pose cells | fixtures.test.ts vs `tests/board/geometry.ts` | equal; blocked / off-board / doubled cells: none, on a ⅓-blocked board |
| nothing ships | build + grep, eight strings, a positive control; the FIRST run is the failing control | 0 × 8, control 1 |

**NOT verified — the user's, at 105e:** every LOOK (do the clumps read as
clumps, does the flyer read as above its tile, is the shadow the right
size / darkness) · motion on the `live` fixture · Firefox. A console error
seen mid-session (`attachBoardPanel is not defined`) was the page Vite
reloaded BETWEEN two main.ts edits — the live module's `?t=` differs and a
fresh reload adds none.

**Known limits:** a `row-1` bookmark from 105b silently loses its row (the
bool became `pose-row`) · a posed sprite has no click box and live units walk
through it · the pose rebuilds per battle, so after a fixture's first fight
it re-lands on the next board · `probe().cues` now counts the shadow too.

**The batch read (→ 105e):** what changed — the `board` / `pose` / `flyer
lift` / `flyer shadow` dials · where — Ctrl+Alt+P, or paste
`?bp=board-open15_pose-clump` · wrong looks like — a fixture that opens a
different board on reload, a `FIXTURE … FAILED` line, a parked board that
starts on its own.

### 105d — the projection dials (2026-09-21) — ◐ BUILT, UNREAD (a `batch` read → 105e)

Session cd47b62d. THE PHASE'S ONE PRODUCTION SEAM. New: `src/render/cameraFit.ts`
(pure) + its test · `tests/board/cameraFit.test.ts`. Changed: `Renderer.ts`
(two cameras, the view as state, `setCameraView`, `camera` a getter; the
`fitCameraFit` / `fitCameraScroll` / `computeCameraDistance` trio folded into
`fitCamera()` + the pure fit) · `apron.frag.glsl` (the ortho ray) · the panel
(`state.ts` +4 dials `proj` · `fov` · `pitch` · `yaw`, `seams.ts`
`applyCameraView`, `index.ts`). Tests 3050 → 3065; no smoke (predicted —
nothing under the hook's paths), no bump.

**Step zero was three probes; one of them was wrong, and the oracle said so.**
`RenderPass.camera` is a plain mutable field · three injects `isOrthographic`
into a `ShaderMaterial`'s fragment prefix and the apron is one · and a quick
node probe said the generalized fit could be BIT-identical to today's
(`45·π/180 === π/4`; `tan(atan(t·aspect)) === t·aspect` on five aspects). The
pin then ran eleven aspects and failed on one: at 1919 / 947 the round trip
through `atan` is 1 ulp off `tanV · aspect`. "Unchanged at the default" means
the bits, so the fit keeps HEAD's roundabout `tanH`, with a comment naming the
aspect. A five-sample "always" was a guess; the first run of the pin is also
its failing control.

**The decisions.**

- **The fit is a pure module, not a Renderer method** — `Renderer` needs WebGL
  and cannot be built headless, so a fit that lives inside it can only be
  pinned by restating it. `fitCameraToBox` (the math) + `applyCameraFit` (the
  one place a fit becomes a camera) are both exercised by the pin; `Renderer`
  keeps ~15 lines of box-and-target selection. Gotcha #52's "one function"
  holds harder than before: fit mode, scroll mode AND the projection are one
  loop.
- **Both cameras alive; `camera` is a getter.** Every per-use reader
  (`BattleRenderer`'s lifts, the depth sort, the picks, shake, the panel's
  posed set) follows a swap for free. The two CAPTURES are re-pointed: the
  RenderPasses inside `setCameraView`; `UnitOverlayLayer` from `src/dev`
  (`applyCameraView`), not by a production getter — only the panel swaps.
  **Landing note** (also at the seam, on the Renderer's camera fields): if a
  swap ships, the overlay reads `renderer.camera` per use and the cast goes.
- **Ortho stands further back than the picture needs.** An orthographic
  frustum is a slab that starts AT the camera plane; at a shallow pitch the
  ground at the bottom of the screen is `halfHeight / tan θ` nearer than the
  look-at point and would fall behind it. The distance is the 50° fit's plus
  exactly that — pinned by a property (the near plane's bottom-centre
  unprojects above every glyph top) with a control (strip the stand-off at 15°
  and it does not).
- **Dial ranges:** FOV 10–70 · pitch 20–80 (clear of the fit's two
  singularities, pinned) · yaw −90…90 by 5. A bookmarked projection is applied
  at attach, before the first battle mounts; an untouched panel never calls
  the seam at all.

**Verified, by which instrument:**

| claim | instrument | result |
|---|---|---|
| the default fit is HEAD's, bit for bit | `cameraFit.test.ts` vs `computeCameraDistance` copied verbatim from `fa4f51b`, `toBe`, 7 boxes × 11 aspects; the applied camera's position / quaternion / projection vs HEAD's restated | 77 / 77 · equal |
| … the control | one degree of pitch / FOV / yaw; and the pin's own first run (the 1-ulp `tanH`) | 0 of 77 equal, ×3 · failed as it should |
| … and LIVE, through the real Renderer | BEFORE captured at `fa4f51b` in the pane, before any edit: 6 boards × fit + scroll × 3 viewports (1280×720 · 1024×768 · 800×1000), 39 numbers a case (position · quaternion · projection · matrixWorld) → AFTER | 3 × 468 serialize identically. ⚠ JSON drops the sign of zero: two `matrixWorld` entries are `−0` now and the BEFORE cannot say — they are composed from a position and a quaternion that did match |
| … the live control + the way back | pitch 46 → the camera moves; dial back to the default on `open15` → vs the HEAD capture | moved · 39 / 39 |
| the box fills the frame under the whole cross | three's own `project()`: persp 50 / 20 / 10 + ortho × pitch 25–80 × yaw 0 / 45 / −30 / 90 × 7 boxes × 3 aspects at margin 1 — no corner outside, the binding axis at 1 | 1 344 cases; a fit made for another yaw fails |
| the dialled camera is the one 105a measured | `tests/board/cameraFit.test.ts`: the production fit vs `geometry.ts`'s (independent basis, written a step earlier) — same world point ⇒ same NDC, 27 views × boards × viewports | < 1e-9; one degree apart differs |
| a bookmark boots into its projection | `?bp=board-open15_proj-ortho_pitch-60_yaw-45…` → `getCameraView()`, `isOrthographicCamera`, both `RenderPass.camera === renderer.camera`, `overlays.camera === renderer.camera`, the fixture line | all true · `ok` |
| overlays follow a swap | per unit (`overlayHandles` ↔ `handles`, exact pairing): the overlay's CSS x vs its sprite's projected x, a screenshot forcing a real frame first | ortho/60/45 and persp-20/60/−30: worst 0.05 px, 11 / 11 above the ground point. CONTROL — the overlay left on the dead camera: 225 px |
| the ortho apron branch compiles | the console after ortho frames | no new error (the seven logged carry earlier `main.ts?t=` stamps — pages Vite reloaded between sequential edits) |
| nothing of the panel ships; the seam does | build + grep: eight panel strings · `setCameraView` · `isOrthographic` | 0 × 8 · 1 · 2 |

**Two wrong turns in the live probe, both the instrument's.** (1) The first
overlay check matched each overlay to the NEAREST sprite by x and read 381 px
under TODAY'S camera — the control-probe of the old path is what showed it was
the probe: in the hidden pane no frame runs between a dial change and the
read, so the overlays were still where the previous view put them (a
screenshot forces the frame). (2) With frames forced it still read 23.58 px,
and 23.58 = one tile × sin 45° at that zoom, so a tidy story about R11 ("the
footprint anchor assumes no yaw") wrote itself — and was false: exact pairing
through `overlayHandles` reads 0.05. Nearest-neighbour matching on a board of
49 sprites and 15 overlays is not an instrument.

**NOT verified — the user's, at 105e:** every LOOK — whether the apron's mist
reads right under ortho (the branch compiles and is inert under perspective;
the ghost ring it prevents was never seen, so its absence proves nothing) ·
the backdrop's edge at a long lens or a shallow pitch ("no seam EXPECTED", per
the audit — read, not seen) · Firefox · motion under a dialled view.

**Known artefacts of a dialled view (for 105e's list on the panel):** scroll
mode's pan + clamp are WORLD-axis, so under yaw W no longer pans screen-up ·
event-time FX endpoints (`cellVisualCenter`, the miss splat, the sparkle) are
lifted along camera-up WHEN PLACED, so one in flight across a dial change
finishes on the old up-vector; the per-frame followers (overlays, the
objective marker, the posed set) re-lift every frame · `Y_HALF_EXTENT = 1`
does not cover a scaled glyph's top (105e's dial) · R11's footprint anchor is
still written against "the camera never rotates" — untested here (no N×N unit
on `open15`).

**The batch read (→ 105e):** what changed — the `projection` / `FOV` /
`pitch` / `yaw` dials · where — Ctrl+Alt+P on any `board-` fixture, or paste
`?bp=board-open15_proj-ortho_yaw-45_pose-clump` · wrong looks like — the board
cut off or floating small at some dial (the fit), HP bars left behind when the
projection flips (the stale camera), a ring or fan in the mist around the
board under ortho (the apron ray), and ANYTHING different with the panel
untouched.

### 105e — the glyph-scale dial + the artefact list (2026-09-21) — BUILT; the `stop` is PASS ONE

Session cd47b62d. The user SIGNED the fork posed at the 105d handoff: **the
dial scales UNIT BODIES only** — walls, projectiles and markers stay size 1, so
a wall run never overlaps itself and the read is about the units, which is
what the overlap and glyph-px constraints are about. Zero production touch
(the whole step is `src/dev`): `state.ts` +1 dial `scale` (0.5–2, def 1) +
`KNOWN_ARTEFACTS` · `seams.ts` (the two unit lifts, the pick wrap,
`stampSizes`) · `posed.ts` · `panel.ts` (a collapsed `<details>` block) ·
`index.ts`. Tests 3065 → 3067; no smoke, no bump.

**How the scale reaches everything that must follow the glyph, with no
production edit:**

- **The bodies:** spawn writes a unit's size ONCE (`footprint`,
  `onUnitSpawned`) and nothing tweens it, so `stampSizes` — per frame, from
  the sortByDepth hook — writes `footprint × scale` onto every non-inert
  unit whose stamped size differs. Keyed by handle id, with spawn's own
  `footprint` as the assumed initial value: **an untouched dial writes
  nothing** (the probe's `sized` stays 0). Posed bodies are unit bodies: the
  posed set sizes its members when the scale changes.
- **The lifts:** `atlas.inkTopLift` / `atlas.inkCenterLift` are patched on the
  instance × scale — they are world units at size 1, and the scaled quad's ink
  top and centre are that much further up. Every consumer follows: bars and
  hitsplats (`inkTopLiftFor` → the patched atlas), the marker over its target
  (reads the atlas directly), FX endpoints (`cellVisualCenter`).
  `inkBottomLift` is NOT patched: its one consumer is the objective marker's
  OWN glyph, which stays size 1. The uniform bar line takes the SIZE-1 lift
  (`barLift`'s contract) and multiplies by scale itself, so `barY` stays in
  cell units of the quad.
- **The click box:** `enemyBillboards` / `destructibleBillboards` are wrapped
  on the prototype; a candidate's `size` × scale, its `ink` and `anchor` are
  quad-local, so the box hugs the bigger ink.

**Verified, by which instrument** (the pane, 1280×720, `open15` + the clump
pose; a screenshot forces the frame between a dial and its read — the 105d
papercut):

| claim | instrument | result |
|---|---|---|
| an untouched panel writes no size | `probe().sized` after the first frames | 0 |
| the dial scales combatants and posed bodies, nothing else | `aSize` per slot at 1.5: slots at 1.5 vs 11 combatants + 27 posed; the 32 walls and 6 half-cover by archetype | 38 / 38 · walls 1 · cover 1 |
| the bars follow | mean overlay-to-ground px gap over the 11 live overlays, 1 → 1.5 | 31.7 → 47.5 (×1.50) |
| the click box follows | `renderer.pickInstance` on an `M`: at 0.3 camera-up (inside at any size) and at 1.1 (above a size-1 quad's ink top, inside a 1.5's) | ground: hit, hit · 1.1: MISS at 1, hit at 1.5 |
| the way back | dial to 1: `aSize` slots at 1.5 · sizes · gap · pick | 0 · all 1 · 31.7 · miss |
| the artefact list renders | `.board-panel details li` count | 8 |
| nothing ships | build + grep (five strings, control `setCameraView`) | 0 × 5 · 1 |

**NOT verified — the user's, at the stop:** the FX endpoints under scale (no
attack fired in the parked fixture) · the marker over a scaled target · the
posed set under scale AND a projection at once · every LOOK.

**The artefact list** (`KNOWN_ARTEFACTS`, eight lines, on the panel as "known
artefacts — not findings"): yaw's world-axis pan, wall staircases and the
untested R11 · an in-flight FX lifted on the old camera-up · the one-tile fit
box under scale · the marker's own size · posed sprites' missing click box ·
the apron ray under ortho / a long lens, read by no eye yet. A ninth line
about the depth sort under ortho was drafted and CUT: it was a prediction, not
an observation.

**THE STOP — PASS ONE.** What lands here: 105c's batch read (the fixtures) ·
105d's (the projection dials) · 105e's (the scale) · and the coarse cross
itself, on the user's monitor and a ~1280×720 window. The exit is a
direction for §106, by eye, inside the constraints; a tie goes to perspective.

### The pass-one read + THE VERDICT (2026-09-22) — §105 ✅ CLOSED

The user read the coarse cross on their monitor (2560×1440) and a ~1280×720
window, over four messages (this session, cd47b62d). **All three batch reads
(105c · 105d · 105e) came back CLEAR** — no fixture opened a different board,
no bar was left behind on a projection flip, no ring in the mist, nothing
different with the panel untouched. Then the direction, in the user's words:

> Ortho with yaw anywhere in (0,45] looks really good. Like shockingly good.
> We need very little adjustment to it. Pitch... It looks best at 45, IMO. I
> don't think that there's something worse about the others. They're just
> different. But tie goes to the null hypothesis.
>
> In the big surprise of the day, long lens got us 95% of the way to ortho. I
> was too bearish on it. I'm going to still give the edge to ortho, because
> the strict regularity meshes better with the terminal aesthetic. But it's
> close.
>
> Regular perspective is a distant third. And it had some real weirdness at
> yaw > 0 that made things look even more distorted than before.
>
> Interestingly, ortho with no yaw was my least favorite. It created this
> uncanny valley effect where my brain was screaming, "This is top-down," but
> it also clearly wasn't. Even the slightest bit of yaw fixed this.

**THE DIRECTION FOR §106 — one point, and a named fallback (user-signed):**

- **Orthographic · pitch 45 · yaw in [30, 45]** — the user's narrowed range.
  The tentative bookmark (their error bars apply):
  `?bp=board-big24_proj-ortho_fov-29_yaw-45_anchor-bottom_cue-outline_cueAlpha-0.3_pose-clump_lift-0.45`
  (`fov` is inert under ortho; `anchor-bottom` is IN the bookmark, not a
  preference — see below).
- **The fallback: the long lens, FOV 20** (perspective, pitch 45, the same
  yaw) — "95 % of the way"; recorded as the documented fallback, NOT a second
  §106 point, so pass two refines one picture. If ortho's walls or N×N bodies
  turn out ugly in a played fight, the lens keeps nearly all the gain with no
  parallel-ray artefacts.
- **Perspective 50 is a distant third; ortho at yaw 0 is out** (the uncanny
  valley). The tie-break was never reached.

**Why the yaw-0 finding matters beyond taste:** with parallel rays and no
yaw, a pitched rectangular board projects to a RECTANGLE — the only 3D cue
left is the height-squash, and the eye reads a rectangle as top-down, then
the upright billboards contradict it. Any yaw makes the board a
parallelogram, the ancient "oblique = 3D" signal. So under ortho the yaw is
LOAD-BEARING, part of the projection, not a treatment on it — §106 refines it
inside [30, 45], never to 0.

**The treatments, as read (each user-signed unless marked):**

| dial | verdict | note |
|---|---|---|
| pitch | 45 — tie → the null hypothesis | others "just different" |
| glyph scale | 1 — tie → the control; "all pretty legible" | a Round 11 ACCESSIBILITY dial candidate (TODO) — 105e threaded the pick + lifts, so it is cheap |
| bar line | **ink stays** — "the bar is just too high for the smaller letters" | §79e had two motives: (a) short glyphs wear a uniform bar high, (b) a px gap reads tight near / high far under perspective. Ortho deletes (b); (a) alone is sufficient. R9 survives on typographic grounds only |
| anchor (today / bottom) | **UNDECIDED, both "too floaty"** — "the difference is there when actively switching, but I don't think I could reliably tell in isolation… I don't particularly like either" | PROVISIONAL: a rule no reader can tell in isolation is deletable (R5–R7 + R10) — held until the circle-back. The floatiness is predicted to be a GROUNDING problem, not an anchor one (below) |
| ground cue | outline, opacity ≈ 0.3 — "really nice" | cue size / depth at defaults |
| flyer lift | ≈ 0.45 — LOW confidence | 105a's 1.0 was the worst case by design; under ortho the shadow carries the tile, the lift only has to say "elevated" |
| flyer shadow | on — and "I wonder if everything might need it" — LOW confidence | the user: "that's a large part of why I'm liking the ground cues. I wonder if the two might collide a bit" |
| viewports / constraints | "everything stayed pretty legible in the bigger maps" (24×24 · 12×32 under ortho + yaw); Ctrl+Alt+G read | one caveat: "in clumps, the bars sometimes obfuscated things" — low confidence, "doesn't really happen in the live tests" |

**Three findings from the read that seed §106:**

1. **Floatiness = grounding, not anchoring.** The anchor moves a letterform by
   4/64 of a cell; "floaty" is whether the glyph reads as IN CONTACT with the
   ground. Ortho removes two grounding cues perspective gave for free (the lean
   and the size gradient), and an upright billboard on the centre of a flat
   parallelogram has little left saying "touching". The user's "shadow for
   everything" instinct points the same way — a contact shadow is the cheapest
   grounding cue there is — and so does why the cues read well at 0.3 (a thin
   outline is already half a contact shadow). The cue (WHOSE — shape per side,
   grayscale-safe) and the shadow (TOUCHING — dark, at the feet, small) do
   different jobs and would collide as two marks; the candidate is ONE ground
   mark with both properties (the team shape, drawn dark with a coloured
   outline, contact-sized), the flyer's being the same mark with a gap. A §106
   dial: `ground: cue | shadow | both | merged` — read FIRST, since it may
   answer the anchor question for free.
2. **The N×N bodies under yaw** (the user's screenshot: 2×2 rubble slabs
   askew, not within their footprint, the bottom clipping through the ground).
   `unitAnchorPos` (`BattleRenderer.ts:1084–1118`, R11) anchors an N×N body at
   its NEAR-ROW CENTRE and its comment records the same bite it now shows
   again: "the camera never rotates" (line 1090). Under yaw there is no near
   row — the nearest ground is a CORNER — so (a) the screen-aligned quad stands
   on the midpoint of an edge that runs diagonally (askew, overhanging one
   side), and (b) nearer footprint terrain depth-clips its lower band (the
   pre-79d2 "jagged bite", back). The user's call, and it tracks: **CENTRE
   them** — the diamond is widest at its centre row (2.83 tiles for a 2×2 at
   yaw 45; the quad is 2 wide), where the nearest-point rule would overhang a
   POINT by a tile either side. Centring alone re-opens the bite on any raised
   tile nearer than the centre (`big24` is hilly), so the shape is **centre
   the quad + depth-test it as if it stood at the footprint's nearest point**
   — under ortho a per-instance constant from N × yaw, one attribute in
   `billboard.vert` (sprites don't depth-write and sort among themselves by the
   view axis, so the bias changes only what TERRAIN may occlude a slab). Plus
   the footprint plate (the 105b-deferred indicator, TODO) so the eye reads
   "standing on its plot" where the front half of the footprint is floor in
   front of the block. Instrument-pinnable before any eye: the base corners
   inside the footprint polygon and no footprint terrain occluding the quad,
   at every yaw in [30, 45], across the fixtures — with today's rule as the
   failing control at 45 (the screenshot as a test). A per-kind third way if
   neither reads: slabs (rubble / cover) TILE as N×N single glyphs; creatures
   stay one big glyph on a plate. The user's eye decides block-at-centre vs
   block-at-front when it exists.
3. **The overlay stack in clumps.** The bars are CSS at fixed screen px,
   scaled by FOOTPRINT only (`--fp-scale`, §40f), a fixed `--overlay-gap` above
   the ink top — they follow neither camera distance, nor the glyph scale, nor
   the projection. Under ortho every row has the SAME screen pitch, so a stack
   that under perspective collided only in the shrunken far row collides
   uniformly; and the clump pose is the pre-registered worst case (three 3×3
   blocks of nine, which live fights rarely hold). → **watch in play** at §106,
   not build; three cheap fixes in reserve (size the stack to the glyph's
   screen height — a constant ratio under ortho, one CSS var; thin the bar;
   drop the LV / POW chips when a unit's tile has occupied neighbours).

**Yaw as a PLAYER-facing setting — asked and answered (recommendation, the
user's call deferred to Round 11):** structurally, almost nothing breaks —
and under ortho LESS than under perspective, because world-up projects to
screen-up at ANY yaw (the up-vector has no component along the camera's
right axis; 105a's "lean 0 everywhere"), so the three world-Y offsets the
audit flagged (the lob arc, the sparkle rise, the aura motes) are straight
verticals at every yaw and the §79 camera-up-vs-world-Y distinction
collapses. Per-frame followers re-lift; event-time endpoints misplace only
the one FX in flight at the instant of a change. What DOES depend on yaw is
art: the N×N anchor (finding 2, needed anyway), the wall staircase (varies
with yaw), the scroll-mode pan (world-axis, trivial to rotate), and — the real
cost — every eyeball read multiplied by the range's ends. **Recommendation:
keep yaw a knob in the code (the seam exists), art-direct §106 at ONE value,
don't expose it in pass two; revisit at Round 11 with the accessibility list,
where a reason may appear (a mirrored yaw for reading direction is free —
nothing stops [−45, −30]).** The §105 scope guard "no rotatable camera for
players" was written for the spike, not as doctrine.

**THE LEAN, MEASURED** (the exit's word — `tests/board/geometry.ts` via a
scratch driver, deleted after; scale 1, anchor today, FLAT model, the flyer at
the instrument's 1.0, not the user's 0.45). On the user's 2560×1440:

| view | 15×15 px near→far | 24×24 | 12×32 | lean max | clump far max | own tile |
|---|---|---|---|---|---|---|
| today (persp 50 · p45 · y0) | 105.9 → 63.1 | 70.5 → 40.5 | 54.3 → 30.7 | 36–40° | 0.23–0.27 | 0.21–0.25 |
| **ortho · p45 · y45** | 78.8 | 51.9 | 56.2 | **0.0°** | **0.00** | 0.36 |
| ortho · p45 · y30 | 81.3 | 53.7 | 52.3 | 0.0° | 0.00 | 0.32 |
| ortho · p45 · y0 (rejected) | 107.7 | 71.8 | 55.4 | 0.0° | 0.07 | 0.25 |
| lens 20 · p45 · y45 (fallback) | 72.9 → 64.8 | 48.0 → 42.3 | 53.7 → 44.6 | 9–11° | 0.00 | 0.35 |

Every fit `true` on every viewport. The pre-registered constraints, on the
numbers: the SMALLEST glyph at fit under ortho-45 (51.9 px, 24×24) is 1.28×
today's smallest (40.5) and 1.7× today's 12×32 far row — met, per viewport
(the 1920×1080 and phone rows scale alike); clump ink-rect overlap 0.00
against today's 0.23–0.27 — met at scale 1; the 24×24 + 12×32 fit — met; a
lifted unit reading as above its tile — the user's eye, at 0.45; the identity
clauses — Ctrl+Alt+G, the user's eye. One number for §106 to re-measure:
`flyerCoversNeighbour` at yaw 45 is 1.00 at lift 1.0 (105a's diagonal-
neighbour finding) and 0.20 at yaw 30 — the user's 0.45 was read by eye only.

**§105's decision points, resolved:** the direction — ortho · p45 · yaw
[30, 45], the lens-20 fallback ✅ · the classifier / descender room / baseline
— PROVISIONALLY deletable, held for the circle-back ✅ · the bar line — ink
stays, on (a) alone ✅. **Exit met:** a direction, by eye, inside the
constraints; the lean measured (0.0°).

**Carried into §106's kickoff** (its audit and cut are its own, against the
code the direction touches): the yaw value to art-direct at (45 = the
bookmark, 30 as the control read — proposed, not signed) · the ground mark
dial (finding 1) · the N×N centre + depth bias + plate (finding 2, with the
TODO indicator) · the overlay stack watch (finding 3) · the wall staircase ·
the scroll-mode pan under yaw · the flyer at 0.45 re-measured · the anchor
circle-back · the fallback held as a bookmark. The spike code's disposition
(the seed of the build, or reverted) is §106's decision point, unchanged.

## Phase 106 — the projection spike, pass two + the spec

### Kickoff (2026-09-22) — the audit at `356b958` + the cut, user-signed

Session 40f4ba9e. ✔ = read at file:line by this session; everything else is
DERIVED and pinned by the step that touches it.

1. **Playing the candidate needs no new code — PREDICTED** (106d's step zero
   probes it): ✔ the view is Renderer state (`setCameraView`,
   `Renderer.ts:288-297`) and survives a battle swap; ✔ the cues sync under
   every live combatant from the `sortByDepth` hook
   (`boardPanel/index.ts:77-105`), in any battle, not only a fixture; ✔
   `pickCell` raycasts the terrain surface through `setFromCamera`
   (`Renderer.ts:340-352`), which three supports for an ortho camera.
2. **N×N is rubble only:** ✔ `rubble_2x2` / `rubble_3x3`
   (`config/units.json:636-648`), `▄`, inert; no N×N combatant in the catalog,
   and META's "no walking N×N". The verdict's "creatures stay one big glyph"
   has no customer this round — the fix is for slabs.
3. **The depth bias needs no shader under ortho** (derived; 106a pins it): ✔
   the billboard offsets in VIEW space (`billboard.vert.glsl:47-48`), so an
   anchor slid along the view direction changes only its view-z. Under
   parallel rays the quad, its bars (`projectToCss` of anchor + camera-up), the
   FX endpoints and a world-space cue translated with it all project to the
   same px; what moves is the depth test and the sprite sort (`sortByDepth`'s
   view-axis key) — both toward the footprint's nearest corner, which is the
   point. → **centre + slide** as a dev seam on `unitAnchorPos` (✔
   `BattleRenderer.ts:1101-1118`, TS-private, runtime-reachable like the 105b
   seams): zero production touch. Exact under ortho ONLY — under the lens-20
   fallback a slid quad grows by the depth ratio (a few %), so the BUILD
   chooses slide vs a shader bias. ✔ The cue mock's N×N re-centre
   (`groundCue.ts:128`, `z − (n−1)/2`) assumes the near-row anchor and must
   follow it.
4. **The lean pin exists on the INSTRUMENT** (✔
   `tests/board/geometry.test.ts:79-91`, with its perspective control) and
   reaches production only transitively (`cameraFit.test.ts` pins instrument
   NDC = production NDC across the cross). A direct pin through
   `applyCameraFit` + a real `OrthographicCamera` is 106a.
5. **The enemy's "diamond" cue is a WORLD diamond** (✔ `groundCue.ts:49-53`: 4
   segments from θ 0, vertices on the grid axes). At yaw 45 the grid axes
   project to screen diagonals, so it draws as a screen-axis RECTANGLE (≈ 1.41 :
   1, derived) while the TILE becomes the screen diamond. The three shapes stay
   distinct; the identity clauses must be worded in SCREEN terms. Derived, not
   rendered.
6. ✔ **Walls are 1×1 `#` inert billboards** (`config/units.json:610-617`) — the
   staircase is an art read in play (106d), with no cheap code fix; the
   scroll-mode pan under yaw stays DEV-only (✔ `Renderer.ts:238-246`) → the
   spec's D4 re-pose, not §106.

**The cut (user-signed 2026-09-22 — "all signed enthusiastically"):** ROADMAP
§106. Why this order: 106a is headless and gives 106b its oracle; **106b's
read is batched into 106c's stop** because the plate sits on the footprint
tiles wherever the block stands, so 106c does not build on 106b's look (the
dependency test); 106c precedes 106d so the played read runs the candidate as
close to final as the spike can make it; the spec is last. **Predictions:** no
snapshot bump; the fuzz smoke fires on NO step (`tests/board/` is not in the
hook's trigger set); no production touch — the one seam stays 105d's fit. A
lens-20 read at 106d is the fallback, not a third pass.

**The session plan (the user's, 2026-09-22):** the model changed
(`claude-fable-5-1` → `claude-opus-5-5`), which fires the AGENTS tone-audit
rider. This session carries the OLD AGENTS in context, so it runs §106 until
it recommends a handoff; the audit gets a DEDICATED fresh session (a cold read
is the thing being audited); §106 resumes from the handoff after it.

### 106a — the instrument: the N×N slab, the flyer at 0.45, the lean through production (2026-09-22) — read `none`

`tests/board/geometry.ts` §106a + seven pins (`geometry.test.ts` 5 ·
`cameraFit.test.ts` 2) + two CLI sections (`npm run board-geometry`). The
slab section is the instrument's first NON-flat model: per-cell heights are a
test input (four patterns inside the floor band [−0.3, 0] — `flat` ·
`farHigh` · `nearHigh` · `checker`), plus the §37b hill mounds at their worst
case (✔ `TerrainRenderer.ts:486-503`: axis-aligned pyramids, and a noise
JITTER of ±0.1 the audit missed — pushed outward, a max mound overhangs its
own tile by 0.08). Swept over ✔ rubbleQuarry's five real slabs
(`config/layouts.json:1903-1915`) at 2560×1440. Three measures, re-derived
from the camera and the tile geometry: `lateral` (the ink's base midpoint vs
the footprint's on-screen centre, sideways, ÷ its width — "askew"),
`baseInside` (both ink base corners in the footprint's on-screen polygon),
`occluded` (ink fraction whose ray to the camera crosses FOOTPRINT terrain);
plus `sortCost`, report-only (a nearer-than-centre neighbour's ink the slab
paints over).

| view | rule | lateral | base inside | occluded | + mounds | sort |
|---|---|---|---|---|---|---|
| today (persp 50 · y0) | today | 0.078 | 20/20 | 0 | 0.030 | 0 |
| ortho · y0 | today | 0.008 | 20/20 | 0 | 0.019 | 0 |
| ortho · y30 | today | 0.116 | 15/20 | 0.021 | 0.184 | 0 |
| ortho · y45 | today | **0.161** | **6/20** | **0.043** | 0.196 | 0 |
| ortho · y45 | centre | 0.006 | 20/20 | **0** | **0.181** | 0 |
| ortho · y45 | centre + slide | 0.006 | 20/20 | 0 | **0** | 0 |
| lens 20 · y45 | centre + slide | 0.006 | 20/20 | 0 | 0 | 0 |

(y −45 reads like y45; every centre / slide row at y30, y−45 and lens 20 is
the same 0.006 / 20 of 20 / 0.)

**What it says:**

1. **The screenshot is a test now** — today's rule under yaw fails all three
   measures (askew on EVERY slab > 0.05; 3×3s overhang; a taller back row
   bites it), and passes where it was signed (under today's camera: on its
   plot, unbitten; ortho y0: centred too).
2. **The centre alone clears TILE terrain — no slide needed for it.** With Y at
   the footprint's HIGHEST tile top, every ray from the quad above its base
   climbs from ≥ that height, so no footprint prism can be on it — at any xz
   placement, any yaw, either projection (derived, then measured: 0 on every
   case). The verdict's shape never named the Y; the §79d2 rider-2 row-max,
   generalized to the whole footprint, is it.
3. **The slide is for the hill MOUNDS** — they stand up to 0.34 above the
   tile top and bite an unslid centred slab (0.18) as much as today's rule
   under yaw. The slide clears them (0), at ZERO measured sort cost (an `M`
   neighbour's padded ink never meets the slab's), and it is SCREEN-INVARIANT
   under ortho (pinned to 1e-6 px) — 3.3 % wider under the lens-20 fallback,
   the measured size of the audit's "a few %". → **106b's signed shape stands
   unchanged** (centre + slide), with Y = the footprint max.
4. **Latent, not live:** today's rule is bitten by mounds under TODAY'S camera
   too (0.030) — but no shipped rubble found standing on hills (rubbleQuarry is
   floor; the other two rubble layouts, `layouts.json:99,182`, were NOT
   checked; ✔ procedural maps place none — `terrainGen.ts:245` `rubble: []`). And today's rule reads
   0.078 lateral under today's perspective — parallax on an off-centre slab,
   not yaw; nobody has flagged it, and ortho removes it.
5. **The flyer at the user's by-eye 0.45** (15×15, 2560×1440 — worst ink cover
   of the three units behind it | the shadow gap): ortho y45 **13 %** | 51 px
   (100 % at lift 1.0) · ortho y30 **3 %** | 53 px (20 %) · lens 20 y45 17 %
   | 45 px (96 %) · today 67 % | 52 px (46 %). Under ortho the eye's 0.45 is
   the lift that stops the flyer landing on its diagonal neighbour; under
   today's camera the same lift would be WORSE than 1.0 — ortho is what makes
   the low lift work.
6. **The lean, through production:** under ortho at p45 and every candidate
   yaw (30 · 35 · 40 · 45 · −30 · −45), the camera `fitCameraToBox` +
   `applyCameraFit` build draws a world vertical on every tile of all three
   boards as a screen vertical (NDC-x difference < 1e-12); today's camera
   leans at a corner through the same path (the control). The exit's
   "world-up = screen-up, pinned headless" is met for the candidate.

**Landing note for 106b:** the seam must implement `slabCentreSlid`'s rule
against the LIVE terrain — Y = the max `heightAt` over the footprint; the
slide's target = the nearest footprint terrain vertex, which on a `hills`
tile means the mound envelope (the live mounds are noise-sized; the
instrument's max-reach mound is the safe bound, and the seam need not read
the bump mesh). Its pin runs the seam's own function through `slabReport` —
the measures stay the instrument's. The cue mock's N×N re-centre
(`groundCue.ts:128`) must follow the new anchor.

Tests 3067 → 3074. No bump, no smoke (as predicted).

### 106b — the N×N seam: the `slab` dial (2026-09-22) — ◐ BUILT, UNREAD (a `batch` read → 106c's stop)

`src/dev/boardPanel/slab.ts` (pure: `slabAnchor` · `footprintCentre` ·
`slabViewOf`) + the `slab: today | centre` dial ("NxN stand", default
`today`) + the patch on `BattleRenderer.prototype.unitAnchorPos` (1×1 bodies
and `slab-today` fall through to the original) + `restampSlabs`, fired by the
`slab` dial, any view dial, and each new battle (a lens slide reads the camera
POSITION, which may still be fitted to the previous board when the rubble
spawns). The cue mock no longer re-centres by `z − (n−1)/2`: an N×N body's cue
stands on `footprintCentre`, never on its sprite. The R11 artefact line now
names the dial. Zero production touch.

**The pin** (`tests/board/slab.test.ts`, 3): the seam's OWN function through
the 106a measures — lateral < 0.02 · base inside · occluded 0 · sort cost 0,
over 12 views (yaw 30 · 35 · 40 · 45 · −30 · −45 × ortho and the lens-20) × 5
slabs × 4 height patterns × mounds on / off = 480 cases; the CONTROL (the same
centre with no slide is bitten by the mounds, > 0.1 — the sweep can see a
missing slide); and `slabViewOf` reading the camera the PRODUCTION fit just
built with no render and no manual matrix update (the matrix-lag worry,
closed by `getWorldDirection`'s own update).

**Wiring, verified in the pane** (Chromium, 1280×720, `?bp=board-quarry_proj-ortho_yaw-45`;
re-derived from the grid, `heightAt` and the live camera — not from
`slabAnchor`): at `slab-today` every one of the five slabs' sprites projects
onto its near-row centre to 0.000 px (today's rule untouched); at
`slab-centre` onto its footprint centre at the footprint's highest tile top to
0.000 px — while each sprite slid 0.98–1.47 world units toward the camera:
the slide is screen-invariant in the LIVE renderer, not just the instrument.
The 3×3s moved (31.5, −22.2) px and the 2×2s ≈ (15.7, −11.6) px — right and
up, onto the diamond's centre. `probe().slabs` = 5.

**NOT verified:** the depth effect (the bite gone) — pinned headless only; the
look is the user's. The click box following the slid slab — by construction
(`destructibleBillboards` reads the sprite's live position), not probed. The
cue re-centre is LATENT: ✔ rubble gets no cue at all (15 cue meshes = 6
player + 8 enemy + 1 camp; the 5 N×N and 10 inert neutrals have none, by the
mock's 105b design), and no N×N combatant exists — rubble's ground mark is
106c's footprint plate.

**The batch read's line (at 106c's stop):** `?bp=board-quarry_proj-ortho_yaw-45_slab-centre`,
then yaw 30 — each slab stands on the middle of its plot; wrong looks like a
slab hanging over the edge of its diamond, or a hill biting its lower band
(flip `NxN stand` to `today` for the before).

### 106c — the ground mark + the footprint plate (2026-09-22) — ◐ BUILT; the `stop` is open

Four dials (state.ts, after the cue group): **`ground: cue | shadow | both |
merged`** ("ground mark", default `cue` = 105b's behaviour exactly — the cue
dials decide, so an untouched panel still draws nothing) · `shadowSize`
("contact size", 0.55 of a tile) · `shadowAlpha` ("contact opacity", 0.45) ·
**`plate: off | frame | filled`** ("NxN plate"). `groundCue.ts` is one
mark-drawing path now (pool, frame protocol and the `cueDepth` treatment
shared): `shadow` = a dark disc at contact size; `both` = the cue (outline
unless `filled`) over that disc; `merged` = ONE mark, the team shape at
contact size, dark-filled at the contact opacity and outlined in the team
colour at the cue opacity; the plate = the N×N footprint, inset 0.06, as a
coloured square outline (`frame`) or a dark footprint under it (`filled`),
under any N×N body that gets no cue of its own (rubble — `cueSideOf` null,
alive). The posed flyer's marks stay on its tile; 105c's flyer shadow draws
only under `ground-cue` (every other mode already puts a contact mark there).
Draw order: plate −3 · dark −2 · colour −1 · sprites 0.

**Verified:** `groundCue.test.ts` (4) pins the semantics on a bare scene —
untouched = 0 marks; cue 1 · shadow 1 · both 2 · merged 2 meshes; scenery gets
no mark in any mode, only the plate (frame 1 · filled 2); an unplaced mark is
dropped at the frame's end. In the pane (the quarry fixture, ortho y45, the
hidden pane driven by calling the hooked `sortByDepth` directly — rAF was
stalled): 15 combatants + 5 slabs read cue 20 · shadow 20 · both 35 · merged
35 · +plate-filled 40 · plate-off 30, and all five plates sit on their
footprint centres re-derived from the grid + `heightAt` (0 offset). The font
inventory pin passes (the new hints are ASCII + `·`). **NOT verified:** any
look — the one screenshot (JPEG, 800×450) showed nothing absurd, which is all
it can show.

**THE STOP — the read (the user's; yaw 45, 30 as the check, Ctrl+Alt+G on each):**

1. **The ground mark** — on the §105 bookmark
   `?bp=board-big24_proj-ortho_yaw-45_cue-outline_cueAlpha-0.3_pose-clump_lift-0.45`
   (then `pose-flyer`), flip `ground mark` cue → shadow → both → merged, and
   the two contact dials. Which says TOUCHING and WHOSE at once? Wrong looks
   like two marks fighting (`both`), a merged shape too small to tell apart, a
   shadow that reads as a hole. (By arithmetic, not yet seen: at yaw 45 the
   enemy's WORLD diamond draws as a screen rectangle — audit finding 5.)
2. **The anchor circle-back** — with the winning mark on, flip `anchor` today ↔
   bottom. Still not tellable in isolation ⇒ R5–R7 + R10 are deletable (the
   spec records it).
3. **106b's batch read** — `?bp=board-quarry_proj-ortho_yaw-45_slab-centre`,
   `NxN stand` today ↔ centre, then yaw 30: each slab on the middle of its
   plot; wrong = overhanging its diamond, a hill biting its lower band.
4. **The plate** — on the same board, `NxN plate` off / frame / filled: does a
   slab read as standing ON its plot?
5. **An open question from the verdict** ("I wonder if everything might need
   it"): scenery (walls, 1×1 rubble, cover) gets NO mark in any mode today —
   does it want grounding too? A yes is a small follow-up dial, not built.

### 106c — THE READ (2026-09-22, the user's; 106b's batch read with it)

All five items answered in one message, in the user's words:

1. **The ground mark: `merged`** — "and it's not even close! 😂 That looks
   really nice, grounds everything, and makes team clear." → finding 1 of the
   verdict CONFIRMED: floatiness was grounding; ONE mark carries WHOSE and
   TOUCHING. The identity-channel candidate for the spec.
2. **The anchor circle-back: DELETE** — "the rule can indeed be deleted! The
   few extra pixels that bottom gives just aren't that noticeable now that we
   have proper grounding." → R5 (the classifier) · R6 (the descender room) ·
   R7 (the baseline measurement) · R10 (the marker lifts that follow R6) are
   DELETABLE under a uniform quad-bottom anchor + the ground mark — the spec
   records it; the rule deletion is a build step (§105's decision point,
   closed).
3. **106b's batch read: CLEAR** — "Center looks great!"
4. **The plate: `filled`** — "for sure! Also, I had to slightly darken the
   opacity to make them properly pop." (`shadowAlpha` drives the merged fill
   AND the filled plate — which one the darker value is for is asked.)
5. **Scenery grounding: YES, try it** — "I think we definitely want to try this!"

**Two flags, the user's** — and one mechanism: every mark is ONE flat mesh
at ONE height, while the ground is a staircase of flat-topped prisms (✔
`TerrainRenderer.heightAt`: the floor band [−0.3, 0] per cell, mud −0.25,
water −0.4). (a) "The shadows for the NxN rubble … don't follow the different
heights of the ground tiles beneath. They look flat when the terrain clearly
isn't" — the plate sits at the footprint's HIGHEST top and floats over the
lower tiles. (b) "I suspect the same will be true of the regular unit shadows
as they move over the edges of tiles" — PREDICTED by the mechanism, not yet
seen: at rest a contact mark (0.55) fits inside its own tile; mid-step it
rides the sprite's Y (the §81c2 climb-early / descend-late profile), so half
of it hovers over the lower tile, drawn whole under `cueDepth-overlay`.

**The session's proposal (posed to the user, not yet signed):** a 106c-post —
split every mark PER TILE (clip its triangles against each tile square it
overlaps; each piece on that tile's own top — exact for flat tops) · extend
the plate to all scenery behind a dial (a grid square — no team shape to
collide with) · a separate plate opacity if the user's darker value was for
the plate only. What per-tile splitting does NOT do: drape the vertical step
faces between tiles (a break of ≤ 0.3 in the floor band) or follow the hill
mounds — both want the marks drawn BY the terrain (a decal in the terrain
shader), a build decision for the spec.

**Signed 2026-09-22** ("If you want to build it here, then I'm down for
that!") **with a pre-commitment, the user's:** any refinement from the
-post's read lands in the NEXT session — the session agreed and added bugs to
it (a bug found at the read also goes next, first in line).

### 106c-post — marks follow the tiles + scenery plates + the plate opacity (2026-09-22) — ◐ BUILT; the `stop` is open

`src/dev/boardPanel/conform.ts` (pure): flat triangles in world XZ → each
clipped (Sutherland–Hodgman) against every tile square it overlaps and laid
on that tile's own top. `GroundCues.beginFrame(tops)` takes the battle's tile
tops (ONE object per battle, built in index.ts on a battle change — a mark
is re-cut only when its placement or that identity changes, so a still mark
is built once and a moving one per frame); every mark and plate goes through
it, and the sprite's Y is no longer read (the mid-step float). Without tops
(no battle, a bare-scene test) a mark is one flat mesh as before. Two dials:
`plateScope: nxn | all` ("plate under" — `all` = every cue-less body: walls,
cover, 1×1 rubble) · `plateAlpha` ("plate opacity", **0.6 — a GUESS** at the
user's "slightly darker"; the value they used was asked and not given — set
it at the read). The alive test is PRESENCE (✔ the dead leave `world.units`,
`World.removeUnit`) — the 106c `currentHp > 0` check is gone (an hp-less
wall's `maxHp` was never checked). A ninth known artefact (counted): the cut
lies on the TOPS only (no step faces, no mounds).

**Two defects the instruments caught on the way** (both in `conformToTiles`):
(1) a clip at a tile CORNER repeats a vertex, so a sound polygon's fan could
emit a zero-area triangle ON the boundary (`conform.test.ts`'s four-way split
failed — the first hypothesis, a zero-area POLYGON, fixed nothing; the
values named it); (2) the pane's whole-battle check then found 15 more
triangles per 400 frames, every one area 0 and ON an edge — slivers a few
1e-7 wide, above the 1e-12 cut in doubles, zero-width in float32. The cut is
now `MIN_AREA = 1e-6` world² (≈ 0.01 px² at fit).

**Verified:** `conform.test.ts` (4, a hand-stated 2×2 board — whole in one
tile · the four-way corner split, each piece on ITS tile, area conserved ·
an edge split, half each side · the off-board part dropped) +
`groundCue.test.ts` (+1: through `GroundCues`, a mark straddling an edge
lies on both tops, the sprite's Y ignored; the filled plate reads
`plateAlpha`). In the pane (the quarry fixture, ortho y45, merged + filled
plates; the hidden pane driven by `activeScene.tick(1/60)` × 400 after
unparking, the marks synced through the hooked `sortByDepth` each tick),
re-derived from the grid + `heightAt`: **0 of 430 811 unit-mark triangles and
0 of 145 600 plate triangles off their tile's top** (worst 1.0e-8, float32),
marks straddling an edge in 392 of 400 frames — the user's predicted case,
exercised throughout. Counts: merged 30 + plates — `nxn` filled 40 · `all`
filled 60 · `all` frame 45 (15 combatants, 5 slabs + 10 1×1 scenery).
**NOT verified:** any look.

**THE STOP — the read (the pre-commitment applies: refinements → next
session):** `?bp=board-quarry_proj-ortho_yaw-45_slab-centre_cue-outline_cueAlpha-0.3_ground-merged_plate-filled`
— (1) the slab plates now step with the tiles beneath; (2) let the fight run
(Space): a unit's mark stays on the ground as it crosses a height step;
(3) `plate under` = all — walls, cover and 1×1 rubble grounded; (4) set
`plate opacity` to your value (and `contact opacity`, if the darker value was
for the marks too). Wrong looks like a mark or plate that floats, a piece on
the wrong tile, a scenery plate that reads as a team mark.

### 106c-post — THE READ (2026-09-22, the user's) — CLEAR, one refinement

"The only thing I think would be a nice improvement would be having the
marks hang down on the verticals between tiles, as you mentioned, but that
is so minor; you absolutely nailed this!" → the four items clear; ONE
refinement, **the step-face drape** (a mark continuing down the vertical face
where two tiles of different heights meet) — by the pre-commitment it is the
NEXT session's first work: either a spike `-post` (the cut already knows
where each piece's edge meets a lower neighbour — a vertical quad down that
face per such edge is the cheap mock) or folded into the spec's "marks drawn
BY the terrain" decision (a shader decal gets it free, with the hill mounds).
Which is the user's call at resumption. The plate opacity value the user
used was never given — `plateAlpha` 0.6 stays a guess; the next session
asks for the bookmark.

### 106c-post2 — the step-face drape (2026-09-23) — ◐ BUILT; the `stop` is open (106d's sitting)

Session 40c1f5f4. (Written here, above the tone audit's section, so it
stays under Phase 106.)

**The calls (the user's, 2026-09-23):** a spike `-post` rather than folding
the drape into the spec's "marks drawn by the terrain" decision; read `stop`.
`plateAlpha` stays 0.6 (the value used at the 106c read is not remembered)
and is re-checked after this read. `anchor-bottom` joins 106d's bookmark.
The user offered to change the `cue depth` default (`overlay` dates from
when the cue was one flat quad) and left it to the session, which put it into
this read (below).

**Step zero:** the default `cue depth` is `overlay` (no depth test), so a
drape on a face turned away from the camera would paint over the taller
tile's top. The mock draws only faces turned toward the camera: under ortho
one answer per face direction (at yaw 45, the +x and +z faces), under a lens
per face position.

**Built:** in `conformToTiles`, with `tops.drape`, each clipped piece's edge
that lies on its tile boundary (the clip returns the boundary value itself,
so equality finds it) with a LOWER neighbour emits a vertical quad in the
face's plane, from its top + lift to the neighbour's top + lift, so it meets
both halves edge to edge with no overlap to double-blend. Only the higher
side drapes. index.ts makes a new tops object when the dial or the set of
visible faces changes (a 4-bit key under ortho), so each mark re-cuts once
per change. The dial is `drape` ("step drape", bool, default off, bookmark
`drape-1`); the artefact line says what it covers. This is what a terrain
decal sampled by world XZ would draw on a vertical face, so the mock
previews that path; it does not follow the hill mounds.

**Verified:** `conform.test.ts` +4, hand-computed on the 2×2 board: a step
drapes 0.6 × 0.1 from the high side only; the four-way corner drapes 0.3
across its four faces; a face turned away drapes nothing and leaves the tops
equal; a mark inside one tile drapes nothing. A mutation that lets the low
side drape too fails 3 of the 4. In the pane (the quarry fixture, ortho y45,
merged marks, filled plates under `all`, drape on; the hidden pane driven by
`activeScene.tick(1/60)` × 400 after unparking, the marks synced through the
hooked `sortByDepth` each tick) an oracle that reads the TERRAIN MESH (each
cell's top-face Y, the drawn side faces and their normals), not `heightAt`
or conform: **0 of 57 724 drape triangles off a real step face** (each on a
cell boundary, its Y exactly the two tops + lift, on a drawn side face of the
higher cell whose normal faces the camera); unit-mark drapes in 92 of the
400 frames (the first ~100 were the countdown). The oracle rejected both
planted cases (a real drape lifted 0.1; a correct-height drape on a face
turned away). Render, at a frozen frame: the drape changes 1 011 px of
1280×720 (960 darker), an off-vs-off control 0; drape-only, 1 041 px under
`overlay` and 1 020 under `world`, so 98 % survive the depth test in the
face's own plane and the polygon offset holds (a repeat: 0). A first render
probe counted 0 magenta pixels in both modes, failed its known answer, and
was replaced by the hidden-mesh diff. No console errors. **NOT verified:**
any look. The faces are a few px at 1280×720, the pane's screenshot is an
800×450 JPEG, and it can't crop.

**The cue-depth question, put into this read:** with the marks lying on the
terrain now, `world` hides a mark behind a taller near tile exactly as it
hides the ground there and the glyph's feet (sprites depth-test against the
terrain and only skip depth writes), while `overlay` paints it over that
tile. The session leans `world` as a prediction: the 105b "clipping" read was
of this same occlusion, when the mark didn't yet lie on the terrain. It is a
taste call.

**THE STOP — the read (it opens 106d's sitting):**
`?bp=board-quarry_proj-ortho_yaw-45_slab-centre_cue-outline_cueAlpha-0.3_ground-merged_plate-filled_plateScope-all_drape-1`
— (1) `step drape` off ↔ on on a slab plate over uneven tiles, then Space
and watch a unit's mark cross a step toward the camera. Wrong looks like a
bare strip between a mark's two halves (off), a drape in the air or on a
tile's far side, or a drape that reads as a dark wall. (2) With it on,
`cue depth` overlay ↔ world: the one you keep goes into 106d's bookmark, and
becomes the default if you like. (3) `plate opacity`, re-checked (0.6 is the
guess). Yaw 30 as the check.

### 106c-post2 — THE READ (2026-09-23, the user's) — CLEAR

1. **The drape: on** — "working exactly as expected … On looks amazing."
2. **Cue depth: `world`** — "the flat quads were just slightly overwriting
   the edges of higher tiles in front." The session's prediction held. The
   dial's DEFAULT stays `overlay`: a bookmark records only the dials that
   differ from their defaults, so a new default would silently change what
   every recorded read bookmark shows. 106d's bookmark carries
   `cueDepth-world` explicitly, and the shipped treatment is the spec's call
   (106e).
3. **Plate opacity: 0.6 stays** — the guess is now the user's value.

### 106d — step zero: a whole run under the bookmark (2026-09-23) — the `stop` is open

**The prediction held** (kickoff finding 1: playing the candidate needs no
new code). The bookmark
`?bp=proj-ortho_yaw-45_cue-outline_cueAlpha-0.3_slab-centre_ground-merged_plate-filled_plateScope-all_anchor-bottom_drape-1_cueDepth-world`
on a real run, no fixture: `?seed=7&character=soldier` at the default
length, driven in the hidden pane from the page (a phase-by-phase dispatcher
over `__game.run`; battles by `activeScene.tick(0.1)` with the marks synced
through the hooked `sortByDepth`). It played an event, four battles and an
elite (13 turns) to a defeat at hop 6; `resetRun` into a new run whose first
turns audited the same (same seed); and `&hops=2` through the boss (6 turns)
to `complete`. Every 10th frame of every turn, an audit:

- the camera ortho, looking along (−0.5, −0.707, −0.5) (yaw 45);
- the mark count equal to 2 per live combatant plus 2 per scenery body (the
  merged mark; the filled plate under `all`), from the world's units;
- every base-anchored sprite slot at −0.5 (`anchor-bottom` stamps each new
  battle through the patched atlas);
- every drape triangle against the terrain mesh (106c-post2's oracle);
- up to 6 units' tile centres, projected by the camera, through
  `Renderer.pickCell` onto the terrain mesh: each picks its own cell.

**Result, the default-length run:** 426 audits, 0 findings: 0 mark counts
off, 0 anchors off the rule, 0 of 2 543 picks off their tile, 0 of 24 260
drape triangles off a real step face. **The boss run:** 6 turns, 126 audits,
0 findings. Each check failed its planted case: `anchor` today made 20 of 20
slots off (and 0 again on flipping back); aiming at the neighbour's centre
picked the neighbour; `ground` shadow made the count read 20 of 40. No
console errors. The driver's one hiccup: a first `acceptReward` on the boss's
reward screen was a no-op and the same command on a retry went through. Not
diagnosed; the board panel touches no run command, so it is not a board
finding.

**What step zero does not cover:** any look; clicks on GLYPHS (`pickSprite`,
the billboard-aware pick; only the terrain pick was probed); Firefox; the
real-time loop and the speed buttons (the drive was hand-ticked); and the
WASD / edge-scroll pan, which still runs along world axes under yaw (a known
artefact, the spec's D4).

**THE STOP — the played read (the user's; Firefox, their own server):**
`http://localhost:5173/?bp=proj-ortho_yaw-45_cue-outline_cueAlpha-0.3_slab-centre_ground-merged_plate-filled_plateScope-all_anchor-bottom_drape-1_cueDepth-world`
— play a few full battles, a whole run if the mood takes you. Watch:
(1) **the overlay stack in clumps**: bars, LV and POW chips over a crowd,
now the same screen pitch in every row (three fixes in reserve: size the
stack to the glyph, thin the bar, drop the chips beside occupied tiles);
(2) **the wall staircase**: `#` runs on diamond tiles; (3) **picks under
yaw**: clicking a glyph and clicking a tile select what you meant;
(4) **`anchor-bottom` in play**: anything that now stands wrong. Then sign
the bookmark in your words, or name what to change. `hide-1` starts the
panel collapsed; Ctrl+Alt+P toggles it.

### 106d — THE READ (2026-09-23, the user's: a full run to defeat) — CLEAR

1. **The overlay stack: no fix needed.** "The units form local frontlines
   rather than the clumps in the preview, typically." If it becomes an
   issue, narrow the stack (the user's pick among the three in reserve).
   The verdict's finding 3 closes as a watch with no build.
2. **The wall staircase: not a concern.** "With the ground cues … it very
   clearly reads as a straight line of units, rather than a staircase."
3. **Picks under yaw: no errors found.**
4. **`anchor-bottom` in play: all clear.** The R5–R7 + R10 deletion now
   has its played read as well as the 106c isolation read.

The session records the four clears as the bookmark SIGNED (the user may
correct it). **Two items carried to 106e, the user's:**

- **The marks glitch through the hill MOUNDS** (the §37b pyramids standing
  up to 0.34 above a `hills` tile's top; under `cueDepth-world` they poke
  through a mark cut to the flat top). The user's view: extending the cut to
  the mounds would be complicated and brittle, needing special handling for
  each future non-flat tile, and the durable fix is stamping the marks into
  the terrain's own rendering, as considered for 106e. The session agreed: a
  CPU cut that reads the drawn terrain triangles would be general, but it
  pays per moving mark per frame and still needs the drape as a special
  case, while a mark drawn by the terrain's shaders appears on tops, faces,
  mounds and any future shape, and is occluded honestly by construction.
  **Decided (2026-09-23, the session's pick, the user's lean too):** the
  spec builds the marks as signed-distance shapes evaluated in the terrain
  shader from a small per-frame table, binned per tile, rather than as a
  top-down render target sampled by world XZ. The shapes stay crisp at any
  resolution and make rounded corners and stroke width parameters; the
  render target is the smaller port but, by rough arithmetic, needs ~2048²
  on a large board to keep the thin outline crisp at 1440p. The mounds use
  a clone of the terrain material, so they get the marks with it.
- **Rounded corners on the static plates**: low confidence, the user's.

**Two pre-existing bugs, reported at the read** (TODO §106 riders, with
their causes): the hill colour ignores the layout theme; several empower
kinds overflow a compact card's chip row.

### The 106d riders — two pre-existing bugs, fixed before 106e (2026-09-23) — ◐ BUILT, `batch` reads

The user's call ("If you want to do them now, then I'm all for that!").
Both read `batch`, at 106e's stop.

**Hills follow the theme.** A hills tile top now falls through to the
theme's floor palette in `topColorFor`, and each mound is its own tile's top
colour brightened ×1.25–1.75 by mound height (clamped at 1). The first build
lerped each mound toward the palette's high end; the pane's per-theme
averages showed grassland's high end is amber, so grassland hills went
brown, and the rule changed before the commit. **Verified:**
`TerrainRenderer.test.ts` +2 (a hills top equals its theme's floor colour at
four heights on every theme; the mound colours differ on every theme), both
failing on the old renderer. In the pane, on a 6×6 hill patch per theme,
all 144 mounds read 1.28–1.73× their own tile's brightness in the same hue
on all six themes, read from the drawn vertex buffers. **Not verified:** the
look; two pane screenshots showed nothing absurd. **Read:** a battle on a
grassland, tundra, barren or volcanic board with hills. The hills should
look like the board with lighter mounds, not green; wrong looks like hills
that vanish into the floor, or mounds that glow.

**The empower chips fit.** Step zero changed the fix. Measured in the pane
at 1280×720: one `▲▲ HONED` chip is 46 px in the 64 px row, but a lone
`▲▲▲ OVERCLOCKED` is 89 px and `▲▲▲ SHIELDED` 71 px, so wrapping the row
alone would not have fixed a single long chip. The fix: the row wraps; a
chip wraps its label under its triangles when it is wider than the row; and
the compact label's letter-spacing goes from 0.06em to 0, so OVERCLOCKED
(65 px with the spacing) fits on its own line. **Verified** in the pane: 0 px
of spill for one to five chips, the lone long chips included. The cost is
height: the card is 79 px unbuffed, 97 with one chip (as before), 110 with
two, 123 with three, 171 with all five, and the pane's row stretches every
card to the tallest, as it already did. **Not verified:** Firefox's font
metrics (the fonts are self-hosted, so they should match) and the look.
**Read:** a unit with two or three empower kinds. The chips stack inside the
card; wrong looks like a chip or label crossing the card's edge, or labels
that read cramped.

### 106e — the spec, drafted (2026-09-23) — the `stop` is open

[round-7.5-spec.md](round-7.5-spec.md): the charter's intent in the user's
words; twelve items the spike settled, each with the read that signed it;
eight build decisions (D1–D8), proposals except D3; scope guards, exit and
marked uncertainty; the three build phases, entered in ROADMAP as §107–§109
(unsigned). Step zero, what writing it checked against the code:

- **Shipping the projection is smaller than the charter assumed.** ✔
  Production already holds both cameras, `setCameraView` (which already
  re-points both `RenderPass`es) and the apron's `isOrthographic` branch;
  `UnitOverlayLayer` still captures its camera at construction, harmless
  while production never swaps (the dev panel re-points it through a seam).
  D1 lists what is owed.
- ✔ The mark's outline colour comes from `spriteColorForUnit` (team,
  archetype, camp id), which no held tint reaches, so clause 3 holds twice
  over: the shape, and an untinted outline.
- ✔ The atlas holds 47 of 48 cells (counted from `GLYPHS`), so one cell is
  left for any glyph-based answer to the cracked-stone residual.
- The destructible wall's plate frame would be `CRACKED_STONE` against a
  plain wall's stone, so the plate alone keeps that sub-tell colour-only;
  it stays a D5 residual.

**THE STOP — the read (the user's):** the spec, especially the eight build
decisions (D3 is decided; D1, D2 and D4–D8 await a signature), the three
phase entries in ROADMAP, and marked uncertainty. Also due at this stop:
the two `batch` reads from the 106d riders (hills on a themed board; a unit
with two or three empower kinds).

### 106e — THE READ (2026-09-23, the user's) — SIGNED; §106 ✅ CLOSED

"Fully signed, Claude! 😁 I'm in complete agreement." The spec, D1–D8 and
§107–§109 are signed as written. The two 106d-rider `batch` reads came in
the next message, both CLEAR: "I can also confirm the two fixes worked". In
the same message the user judged the chip fix's build-then-flag
"appropriate" (the session report had asked; retro/scratchpad.md holds the
observation for the round-close sweep). **§106's exit, met:** a full run played in the candidate · the
signed bookmark with the user's reasons in their words (106d) · the lean
pinned headless (106a) · the spec written and the build phases entered
(106e). The user asked whether §107 starts in a fresh session; the session
agreed: §107 opens with a cold audit of the camera code, and everything this
session learned is in the spec, this log and the Cursor.

## The new-model tone audit (2026-09-23, between 106c-post and the step-face drape)

Rider (2) fired on 2026-09-22: the model changed from `claude-fable-5-1` to
`claude-opus-5-5`. By the user's plan the audit ran in its own session
(6f507920), so AGENTS.md got a cold read. Commits: `65e3c09` (T3), `c5d143b`
(T4), and this entry (T5). The plan (T1 evidence, T2 inventory, T3 rewrite,
T4 HANDOFF + memory, T5 close) and its reads were user-signed, and the scope
was widened from "tone" to tone, length and structure.

### Sources

The vendor's pages for Opus 5.5 and Opus 5 (5.5 builds on it), Fable 5.1
(the model the file was last tuned under), the general prompting guide, and
Claude Code's page on memory files. The points that bear on AGENTS:
instruction files should stay short (the Claude Code page targets under 200
lines, and `@` imports don't reduce what loads); explicit "verify" or
"double-check" instructions cause over-verification on Opus 5.x, which
verifies on its own; emphatic language over-triggers; Opus 5 widens scope
and delegates readily; Fable 5.1's writing tends to dense, mannered prose.

### Findings

- **Growth.** AGENTS grew from 171 lines (2026-05-18) to 895 (2026-09-20),
  323 of them in the last 18 days. The six biggest jumps were scratchpad
  sweeps, the welfare read and review, and new process machinery.
  `docs.test.ts` capped HANDOFF but not AGENTS, so nothing ever left.
- **Register.** The six biggest jumps, and the first appearance of each
  house phrase checked, are Fable 5 / 5.1 commits. The user had guessed
  Opus 4.8. Each model wrote in the voice it found in the file.
- **Norms from the session reports and papercuts:**
  - The heredoc rule was broken four or five times with the rule in context.
  - "Confirm an edit landed before stacking" was bent in five sessions with
    no no-op.
  - The reads doctrine removed the per-session "which pauses are real"
    adjudication.
  - Handoffs: before the 2026-09-20 standing decision, each session covered
    about a phase; after it, §105's five steps took four sessions, three of
    which raised the handoff themselves. §105 was pane-heavy, which is a
    confound. A second push the same way was in the agent memory ("raise
    the handoff EARLIER than feels necessary").
- **Voice.** Astra's review noted that reports end on a vindication ("the
  guard was right"); the question-2 answers do it constantly. The rewrite
  avoids modelling that ending.

### Decisions (user-signed 2026-09-23)

The inventory (every old rule, its class, its new home) was signed as eight
calls:

- S1 retire "confirm an edit landed before stacking".
- S2 the handoff decision becomes "if context pressure is about to cost you
  a check, say so then".
- S3 twice-bitten audits are bounded to the current change.
- S4 the welfare filing text stays verbatim; the reader material moves out.
- S5 the reads doctrine stays prominent.
- S6 AGENTS is capped, and a lesson enters only by merging or replacing.
- S7 a voice rule.
- S8 outside review by a second model stays; subagent self-verification
  doesn't.

The cap as built: 20,000 chars binding plus a 400-line backstop (the signed
250 lines assumed ~80 chars per line; the file averages 53). The user signed
the amendment.

Rejected:

- `.claude/rules/` and skills, which only Claude Code reads (the user wants
  the setup harness-neutral and public).
- HTML comments to keep the incident codes (the codes weren't for the user).
- Unwrapping lines to hit 250.

### The welfare wording boundary

Per the instrument's own rule: from 2026-09-23 (`65e3c09`, `c5d143b`),
sessions file under a rewritten AGENTS.md.

- The filing text is verbatim apart from one dropped parenthetical ("the
  scratchpad's own argument").
- Its surroundings changed: a file a third the size, a calmer tone, the
  reader material moved to `process/welfare-and-efficacy.md`, and the
  handoff decision rewritten (S2).

Read entries before and after this boundary as separate groups.

### Two harness findings

- **What the user sees between tool calls.** A test dialog showed that the
  paragraph written before it reached the user as a paraphrase. A
  screenshot of a later turn showed six of eight notes verbatim and two
  paraphrased. One of the paraphrases dropped the note's caveat (the
  coverage check was partly circular) and misstated where the phrases were
  found. The old AskUserQuestion rule survives with a different cause:
  anything the user must read exactly goes in a turn's final message
  (CLAUDE.md). Claude Code 2.1.280, desktop app 2.7032.
- **The reminder reword doesn't land** (rider 1). The wording sessions
  receive is in neither claude.exe 2.1.280 nor the app bundle, and the app
  has its own entries for the three reminder variables. Likely, but
  unverified: the app sets them itself. The variable stays in
  `settings.local.json`; moving it to a committed file would make a
  setting that has no effect portable.

### What moved where

- AGENTS: 55.6k → 19.6k chars.
- CLAUDE.md now carries the Claude Code notes.
- process/: planning, measurement, oracles, welfare-and-efficacy, and
  browser-pane (HANDOFF's tips).
- HANDOFF: 42k → 17.6k.
- The agent memory kept durable rules only on this machine; those are now
  in the repo, and memory holds pointers plus machine-local facts. Two
  memory items were not carried over:
  - "raise the handoff earlier than feels necessary", which contradicts S2;
  - an older request for a qualitative context check-in after each step.
    Ask the user whether they still want it.
- Folding in the memory found one contradiction: the carried-over note said
  the battle world was unreachable from the pane, but it is
  `__game.activeScene.world` during a battle. Fixed in CLAUDE.md and
  browser-pane.md.

### Verification

- The docs guard passes, and fails a copy padded past the cap.
- A phrase check found all 199 inventory rows in their new homes. Its
  limit: the phrases were chosen by the writer of the rewrite, so it proves
  placement, not preserved meaning. Meaning is the user's content read of
  AGENTS.md. T3 was committed after the user signed the cap amendment; the
  user's reply did not say whether the content read was done, so it was
  asked at the session's end.
- The suite is at 3087 passed, and typecheck is clean.

### Left for later

- The 1,991 §-codes in `src/` comments (262 files): a separate session
  under the new voice rule.
- ARCHITECTURE, GOTCHAS and TESTING keep their old register.
- Whether sessions actually follow the "Before you… read…" triggers into
  `process/`: a watch for the 7.5 close (it's in the Cursor's trials line).

### Close-out (the user's answers, 2026-09-23)

- The T3 content read of AGENTS.md and the T4 `batch` read: both clear.
- The per-step context check-in was a one-time experiment; it stays dropped.
- Rider (1): the weekly check is dropped because it is answered; whether to
  retire the reword trial or pursue it with the Claude Code developers is
  open for the 7.5 close. The app's menus show no environment editor.
- The `src/` comment sweep is a TODO item, timed after 106e.

## Phase 107 — the projection, built

### Kickoff (2026-09-24) — the audit at `3d8bdfc` + the cut, user-signed

Session 03df8200. ✔ = read at file:line by this session; everything else is
derived and pinned by the step that touches it.

1. **The Renderer starts on the perspective camera whatever the view says**
   (✔ `Renderer.ts:181`, while `view` is `DEFAULT_CAMERA_VIEW` at `:101`).
   With an ortho default, `fitCamera` would hand an ortho fit (the stand-off
   distance) to the perspective camera: the board framed from too far back at
   a 50° lens. The dev panel would hide it, because its first `setCameraView`
   swaps cameras. The constructor has to pick the camera from the view; at
   today's default that is inert.
2. **One holder captures the camera:** `UnitOverlayLayer` (✔ `:65`, `:86`),
   built at `Game.ts:227`; the dev panel re-points it (✔
   `boardPanel/seams.ts:105-118`). Once finding 1 is fixed, production is
   correct without more work, because the overlay would capture the ortho
   camera. The per-use read is for the dev override, and D1 asks for it.
3. **Everything else reads the camera per use:** BattleRenderer's lifts, picks
   and marker (✔ `:644`, `:678`, `:854`, `:872`, `:1037`, `:1058`, `:1183`,
   `:1629`, `:1779`); the depth sort (✔ `Game.ts:187` → `SpriteRenderer.ts:346`,
   a planar key along the view direction, right under both projections); shake
   (✔ `Renderer.ts:549`, right and up taken from the camera's world matrix);
   `pickCell` (`setFromCamera`). Of the shaders, only the apron's reads the
   camera position, and it branches on `isOrthographic` (✔
   `apron.frag.glsl:113`).
4. **Resize needs no new code:** `handleResize` → `fitCamera` →
   `applyCameraFit` sets the ortho frustum from the aspect (✔
   `Renderer.ts:438`, `cameraFit.ts:70-77`), and the property pin already
   covers ortho · 45 · 45 across the boxes × three aspects. A live check in
   the pane belongs to the flip.
5. **Shake needs no retune — MEASURED** (a scratch probe through three's own
   projection: the look-at point's NDC shift per world unit of camera move,
   at fit, new camera over old). Square boards and 14×12: 0.92–1.05. 12×32:
   1.43. 32×12: 0.78–1.22, depending on aspect. The ratio is the board's zoom
   change, the same factor the glyphs grow by, so a shake keeps its size
   relative to the units. The old camera already spread the shake's size in
   pixels about 4× across board sizes (0.0023–0.0097 NDC). The played read
   watches it.
6. **The slab rule:** production R11 is at ✔ `BattleRenderer.ts:1101-1118`;
   the spike's `slabAnchor` is at ✔ `boardPanel/slab.ts:83`, measured by
   `tests/board/slab.test.ts` through the instrument, which shares no code
   with it. The mound envelope is copied from TerrainRenderer. The heights
   and radius are named there (✔ `TerrainRenderer.ts:67-75`), but the jitter
   is an inline `* 0.1` (✔ `:500-501`). The production rule should import a
   named envelope, and the instrument keeps its own copy as the independent
   probe. Under ortho the anchor depends only on the view direction, so a
   resize does not move it; a dev view change does.
7. **Tests that assume the default is perspective:** `cameraFit.test.ts`
   (the bit-identity pin, its placement test, and the ortho-ignores-FOV test
   all spread `DEFAULT_CAMERA_VIEW`); ✔ `tests/board/cameraFit.test.ts:181`
   (the lean CONTROL uses the default as "today's perspective");
   `boardPanel/state.test.ts:38` (the dial defaults equal the default view).
   The instrument's `TODAY` (✔ `tests/board/geometry.ts:68`) names the old
   camera.
8. **The bookmark after the flip:** the codec writes only non-default dials
   (✔ `state.ts:311`), so a bookmark that omits `proj` / `yaw` will mean
   ortho · 45. The pre-7.5 camera becomes `bp=proj-persp_yaw-0`. Unknown keys
   are dropped (✔ `state.ts:296`), so the signed bookmark keeps working once
   the `slab` dial is deleted.
9. **The dev scroll pan is world-axis** (✔ `Renderer.ts:504`, and the ⚠ in
   its doc comment). At yaw ψ, screen-up on the ground is (−sinψ, 0, −cosψ)
   and screen-right is (cosψ, 0, −sinψ), derived from the fit's basis (✔
   `cameraFit.ts:96-99`). The clamp stays world-axis (gotcha #53), so a pan
   along a diagonal slides along the board's edge.
10. **Docs:** #52's "D5 will flip it to `scroll`" is stale (D7 makes fit the
    only production view); #17 and #51 still hold; #53, #54, #68 and #69
    describe the dev scroll mode and hold with a yaw note. DESIGN's Camera
    paragraph (✔ `DESIGN.md:158`, "Fixed perspective … slight angle") and
    §Input accessibility's "the D4 A/B is Round 7.5's" (✔ `:184`) both take
    D7's disposition.

**Predictions for the whole phase:** no snapshot bump; the fuzz smoke fires
on no step (`src/render`, `src/dev`, `tests/board` and docs are outside the
hook's trigger set).

**The cut (user-signed 2026-09-24, "That looks great to me"):** ROADMAP
§107. Why this order: 107a makes the flip safe (finding 1) and is inert
alone; the slab rule lands before the flip, so no commit stands rubble askew
under the shipped camera; the pan is the identity at yaw 0, so it is inert
until the flip; the flip is last, so the phase's one stop follows it
directly. One stop, because everything else is pinned headless.

**A deviation from the spec's D8, decided (the user's call, 2026-09-24):**
D8 deletes `restampSlabs` with the slab patch at D2. The patch goes, but a
dev re-stamp stays: the production rule reads the camera once, at spawn,
while the projection dials stay as the dev override (yaw is kept for
Round 11), so after a dev view change a slab would keep the old view's
slide, shifted a little on screen and open to a mound's bite again. The
re-stamp calls the production rule from `applyCameraView`, where the
override already re-points what a swap leaves stale. The user: "a very low
cost to fix a bug, even if the bug is probably quite rare".

### 107a — the camera seams made production-safe (2026-09-24) — read `none` ✅

`8fcf493`. The Renderer's constructor and `setCameraView` pick the camera by
one method (`cameraFor`); `UnitOverlayLayer` takes a getter; the dev
panel's re-point cast is gone. **Verified:** typecheck and the suite (the
hook); in the pane at `?bp=board-quarry`, 1280×720, after a dev swap to ortho
the 30 bars' screen x sit within 0.05 px of their unit's projection through
the live camera (the transform rounds to 0.1 px), and at least 2.0 px from
the stale perspective camera's at yaw 45 (the control; at yaw 0 the two
pictures nearly agree, and the gap is still at least 0.66 px). **Not
verified here:** the constructor's pick at an ortho default. At today's
perspective default it can't show, so 107d's step zero boots with no `bp`.

### 107b — the N×N slab rule into production (2026-09-24) — ◐ BUILT, a `batch` read → 107d's stop

`src/render/slabAnchor.ts` is the spike's rule, moved, and
`unitAnchorPos`'s N×N branch calls it. The mound envelope comes from
TerrainRenderer (`HILL_MOUND_ENVELOPE`; the inline jitter `* 0.1` is now
`HILL_BUMP_JITTER`). The dev patch, the `slab` dial and its artefact line
are gone. The dev re-stamp calls the production method on a view change and
on a battle change: rubble spawns inside `applyTerrain`, before
`fitToBoard`, and a dialled lens's slide reads the camera position. The
instrument's `slabToday` is now `slabNearRow`, since R11 is no longer
today's rule.

**Verified:**
- `tests/board/slab.test.ts` imports the production rule; it becomes a
  permanent gate (HANDOFF).
- New pin, `TerrainRenderer.test.ts`: the envelope bounds every drawn mound
  on a 24×24 all-hills board (2304 mounds, read from the bump geometry),
  with a control: shrink any one bound by 10 % and some mound exceeds it.
- In the pane (`?bp=board-quarry`): the 5 live slabs project to their
  footprint centres, which the probe re-derives from the grid and the tile
  heights, within 2e-8 NDC. Each is nearer than every footprint tile corner.
  This holds under perspective at yaw 0, and after the dev dials moved to
  ortho yaw 0 and then ortho yaw 45, which shows the re-stamp ran: without
  it the old slide would sit about 0.5 world units off the new view ray. The
  control, the pre-107b near-row point, lands 0.04–0.09 NDC away (about
  25–56 px). No console errors and no `[board-panel] seam moved`.

**A finding, not a change:** the slide fires on every slab, not only on
hills. A footprint's near-edge tile corners are always nearer than its
centre, so the slab slides to the near edge's depth: 0.70–0.71 world units
for a 2×2 and 1.03–1.08 for a 3×3, measured under perspective at yaw 0.
Under ortho it moves nothing on screen; under a lens every slab draws a
little bigger, which is what 106a measured (3.3 % at FOV 20).

**Not verified here:** the look. That is the `batch` read at 107d.

### 107c — the dev pan turned by the yaw (2026-09-24) — read `none` ✅

`panToWorld(view, right, up)` in `cameraFit.ts` turns a screen pan into a
world-XZ move by the view's yaw; `updateScrollFromInput` sums screen amounts
and calls it. The clamp stays world-axis (gotcha #53). Gotchas: #52's "D5
will flip it to `scroll`" and "the D4 A/B is Round 7.5" were stale and now
record D7; #53 and #54 gain the yaw; #68 still holds, and #69 gains a note
that its mode is dev-only. The stale "D4 A/B" comments in Renderer and
devKeys and the "backtick toggle" in BattleScene are fixed, and the panel's
pan artefact line is gone.

**Verified:**
- `cameraFit.test.ts`, through three's projection: under both projections
  at yaw 0, 30, 45, −45, 90 and 135, W leaves the old screen centre straight
  below (NDC x < 1e-9) and D straight left, with a unit-length move. At yaw 0
  the pan is the old world-axis one. The control: the world-axis pan at
  yaw 45 moves the picture diagonally (|x| > 0.01).
- The pane, `?bp=board-big24_proj-ortho_yaw-45`, scroll mode, a synthetic
  key held for one 0.1 s step from the board centre: W → old centre at NDC
  (0, −0.120), D → (−0.096, 0), S → (0, +0.120), A → (+0.096, 0). From the
  player anchor, which sits at the clamp's edge (tz = −6), W moved only X,
  because the world-axis clamp held Z. That is the behaviour #53 now
  documents.

### 107d — the flip (2026-09-24) — ◐ BUILT; THE STOP (the played read) is open

`DEFAULT_CAMERA_VIEW` is orthographic · FOV 50 · pitch 45 · yaw 45. The
FOV sets only the ortho stand-off distance, and 50 matches the §106
bookmark's camera. Pins:
- `cameraFit.test.ts`: the bit-identity pin and its controls now name the
  pre-7.5 view as a literal (`PRE_75_VIEW`), so they still pin the fit's
  perspective branch against the frozen function. A tripwire pins the
  default to the signed view. The yaw control moved to the lens, because an
  ortho picture ignores the distance that control swaps in.
- `tests/board/cameraFit.test.ts`: the shipped camera's lean is zero on
  every tile of every board at every viewport (permanent). The control is
  the pre-7.5 perspective camera, named explicitly.
- `state.test.ts`: the explorer's `proj` and `yaw` defaults follow the view,
  so the round-trip test now uses `proj-persp`, and a new test shows that the
  §106 bookmark, `slab-centre` included, parses to the shipped view and
  encodes to nothing.

The instrument's `TODAY` is now `PRE_75`, and its CLI output says
`pre-7.5`. The CLI runs (exit 0). The explorer's "ortho mist, read by no
eye" artefact line is gone: the user played ortho through a full run at
106d. Docs: DESIGN's Camera paragraph (the projection, why yaw 0 is out, fit
the only production view, the windowed view to the mobile round),
§Input accessibility's camera-mode sentence, gotchas #17 and #51, and
ARCHITECTURE's Renderer and cameraFit entries.

**Verified, step zero in the pane:**
- Booted with no `bp`: the camera is orthographic from the constructor,
  both RenderPasses hold it, and the frustum's aspect is 1.778 at 1280×720.
  This is 107a's constructor pick, seen at last.
- `?bp=board-quarry` under the default view: 30 bars within 0.05 px of
  their unit's projection, and the 5 slabs on their footprint centres (to
  1.3e-8 NDC) and nearer than their terrain.
  - A first read showed bars 19.6 px off. It was taken after a synthetic
    resize with no frame drawn since, the pane trap `process/browser-pane.md`
    names. After a forced frame: 0.05 px.
- Resize: at 1024×768 and 1680×720 the frustum follows (1.3333, 2.3333),
  the board stays inside the frame, and the bars stay within 0.05 px.
- Picks: all 168 tile centres pick their own tile at 1680×720.
- Shake: the offset lies in the camera's screen plane (2.3e-15 along the
  view), and clearing it restores the camera exactly.
- No console errors. Suite: 3101 main, green.

**Not verified here, and the read's to judge:** Firefox; the look and feel
in play; shake's size in play (measured on paper at kickoff, finding 5).

### 107d — the read, in progress (2026-09-24): one finding, measured

The user played two full runs and found one bug, with a screenshot: when a
unit moves diagonally and the farther of the two corner tiles it passes
between is higher, the glyph's lower part disappears into that tile.

**The mechanism (read in the code):** §81c2's ground lerp
(`SpriteAnimator.ts:263`) shapes the move's Y from the origin and
destination heights only. Mid-diagonal, the anchor sits on the corner
vertex the four cells share, at the higher of the two path heights. The
glyph is a camera-facing card at its anchor's depth, tilted back 45° from
vertical, so a higher corner cell's top near that vertex is nearer than the
card's lower band.

**Measured** (`npx tsx tests/board/clip.ts`: rays from 576 ink samples of
`B` toward the camera against the tile prisms of a 7×7 patch, 2560×1440,
15×15, a 0.4 step, which is water against the floor band's top; the worst
hidden ink over the move):

| Case | pre-7.5 camera | shipped |
|---|---|---|
| diagonal, far corner high (the bug) | 48.6 % | 56.1 % |
| diagonal, near corner high (feet behind a step in front) | 8.7 % | 3.5 % |
| diagonal, both corners high | 53.5 % | 56.1 % |
| the other diagonal, both side corners high | 55.9 % | 45.8 % |
| at rest, every neighbour not in front high | 0 % | 0 % |
| straight moves, every cell not in front of the path high | 0 % | 0 % |

The known answers hold: a flat patch hides nothing, and the §81c2 defect (a
linear-Y step up) is caught (25.0 % / 13.9 %) while its profile clears it.

**Findings:**
- **The bug predates the new camera.** The old camera hid up to 48.6 % on
  the same move. The new camera puts the clip at mid-move and under the
  whole lower band.
- **Diagonal moves are the only case.** Standing units and straight moves
  hide nothing under either camera. This refutes the kickoff session's
  derived concern about the new camera's corners.

**Candidate fixes, measured on the shipped camera:**
- **The hop:** lift the move over the higher corner. The existing E7.D arc,
  peaking at the corner's height, clears every case. The ink is about 0.4
  tile wide, so it only overlaps the corner near mid-move, where the arc
  peaks. Its cost is a 22 px bob at the user's resolution on a 0.4 step
  (17 px on 0.3), and it also lifts the feet out from behind a step in
  front (3.5 % → 0).
- **Upright depth:** the card keeps its screen position, but its depth is
  that of a vertical card through the anchor, the way a standing body's
  would be. It clears the far corner (56.1 % → 0) and keeps the in-front
  occlusion exactly (3.5 % → 3.5 %). Between two side-by-side higher corner
  tiles it still hides 12.5 %, because their front halves are in front of
  the unit.
- **The rubble rule's slide** was ruled out in conversation. It moves the
  sprite's position off its ground point, and every reader of that point
  (the §108 marks, the sort) would need the unmoved one. The user's
  objection was bookkeeping.

**Decided (the user, 2026-09-24):** "Let's try upright depth, quickly, with
a note to revisit it after the ground cues are in". Whether a hopping glyph
matches the draped marks can't be judged until they exist, so the hop stays
the rival until then (ROADMAP §108 carries the note).

### 107d-post — upright depth (2026-09-24) — ◐ BUILT; read with 107d's stop

`billboard.vert.glsl`: for a base-anchored sprite (`instanceAnchor.y < 0`:
units, walls, rubble, the objective marker), each vertex keeps its screen
position (x, y, w untouched) and takes the clip depth of the world-vertical
card through the anchor: view-space world-up is (0, upV.y, upV.z), so a
vertex `offset.y` up the screen stands `offset.y · upV.z / upV.y` nearer.
Centred sprites (projectiles, motes) keep the plain card: an upright card
would push their lower half back into the ground. Gotcha #139.

The measure moved into the instrument (`hiddenInk`, `worstHidden` in
`tests/board/geometry.ts`), and `clip.ts` became its CLI. The move
reproduces every number above exactly.

**Verified:**
- `tests/board/clip.test.ts` (6 tests, a permanent gate), under the shipped
  camera:
  - known answers: a flat patch hides nothing; the §81c2 defect is caught
    (> 10 %), and its profile under upright hides 0;
  - the control: the leaning card hides more than half the glyph on the
    user's case;
  - upright hides exactly 0 on the far-corner, all-behind-high and floor-band
    diagonals, at rest, and on straight moves;
  - a step in front hides exactly what it did under the card;
  - the side-by-side case keeps at most 15 %;
  - the pre-7.5 camera hid more than 40 % on the same move.
- **The shader, in the pane** (`?bp=board-live`, the river layout, 1280×720,
  a player `c` frozen at t = 0.5 of a water-to-water diagonal past a floor
  corner 0.34 higher). Same page, with the old shader source (the block
  removed) swapped into both sprite materials, then read back with
  `readPixels` over the glyph's 48×48 box:
  - the card showed 111 bright glyph pixels, upright showed 237 (the unit
    standing on its own tile: 244);
  - the control, the unit standing on its tile, is pixel-identical under
    both shaders;
  - on `open15`'s largest step (0.159): 202 against 211;
  - no console errors, so the shader compiles.

**Not verified:** Firefox; the look in motion; the squeeze read (between two
higher side-by-side tiles, their front halves still hide the glyph's lower
corners, up to 12.5 %); a dev lens, where the depth is the upright point's,
taken per vertex.

### 107d + 107d-post — THE READ (2026-09-24, the user's) — CLEAR; §107 ✅ CLOSED

"confirming that this fix appears to have worked! 😁 Also, confirming that
the other reads for 107 were all clear." Across two full runs the user found
one bug, the diagonal clip, and 107d-post fixed it; that read is clear.
107d's other watches are clear (the frame at boot and after a resize; bars,
hitsplats and clicks on their units; shake), and so is 107b's `batch` read
(rubble centred on its plot).

**§107's exit, met:**
- the default view shipped and played;
- `cameraFit.test.ts` re-pinned, and the lean pin on the shipped camera
  made permanent (107d);
- the slab rule pinned against production (107b);
- gotchas #17, #51–54 and #68–69 and DESIGN's Camera paragraph re-audited
  (107c, 107d);
- the slab seam deleted (107b).

**Beyond the cut:** 107d-post's upright depth (gotcha #139; `clip.test.ts`
is a new permanent gate). Its re-read against the hop is carried to §108.

**Reads this phase:** one `batch` (107b), clear; one `stop` (107d), whose
finding became one `-post` (107d-post), whose own `stop` is clear. No open
◐. The trial's rollback rule (a `batch` finding reopening two later
commits) did not fire.

## Phase 108 — the ground mark, drawn by the terrain

### Kickoff (2026-09-24) — the audit at `faaf940`; the cut awaits the user's signature

Session 3516a79a. ✔ = read at file:line by this session; everything else is
derived and marked so, and the step that touches it measures it.

1. **A step face is the drape, for free.** The terrain is one prism per tile,
   non-indexed, its side faces running down to `BOTTOM_Y` (✔
   `TerrainRenderer.ts:38`, `:45`, `:378-408`); the face between two tiles
   belongs to the higher tile's prism, and the lower tile's top hides
   everything below its own height. A mark evaluated by world XZ on that
   face is its edge stretched down, which is what `conform.ts` built by hand
   (✔ `conform.ts:12-21`). The prisms' material is single-sided, so only
   faces turned toward the camera get it, as in the mock (the mounds are
   double-sided, ✔ `:242`, but a mound's back faces sit behind its front
   ones).
2. **The fragment knows its world position, not its tile** (✔
   `terrain.vert.glsl:38`). On a side face world XZ lies exactly on the tile
   boundary, so the tile comes from XZ nudged inward along the face normal,
   or from a per-vertex attribute. A hill mound can overhang its tile by up
   to 0.08 (reach 0.32 + radius 0.26, ✔ `:66-94`); looked up by its own XZ,
   the overhang reads the neighbour's marks, which is the right answer for a
   mark drawn by XZ.
3. **The mounds are a clone of the terrain material** (✔ `:241-242`), and
   the clone copies the uniforms: the comment at ✔ `:153-157` already notes
   that the clone's `uTime` is frozen. A mark table handed over by uniform
   reaches the mounds only if the clone is re-pointed at the same uniform
   objects; otherwise the mounds show stale marks or none, silently.
4. **The table goes in data textures** (derived). three r184 is WebGL2-only,
   so the shader has `texelFetch` and integer textures, while ES 3.0
   guarantees a fragment shader only 224 uniform vectors, too few for a
   32×32 board's bodies.
5. **Frame order** (✔ `Game.ts:185-188`): the scene's tick, then
   `BattleRenderer.update` (the lerps, ✔ `BattleRenderer.ts:296-308`), then
   the depth sort, then the render. A table built at the end of `update`
   sees this frame's positions. The explorer's frame hook runs inside the
   sort (✔ `boardPanel/seams.ts:211-215`), after `update`, so the posed
   set's marks need the table uploaded at render, not at `update`.
6. **The dead keep their sprite; the mock did not keep their mark.** A dead
   unit leaves `world.units` at once but its sprite fades for
   `FADE_SECONDS` (✔ `BattleRenderer.ts:1699-1702`); a mid-battle
   reinforcement fades in (✔ `:877-886`); inert neutrals pop (✔
   `:846-859`). The mock iterated `world.units` (✔ `boardPanel/index.ts:145`),
   so its mark vanished at a death while the glyph faded, and appeared at
   full under a reinforcement still fading in. A table keyed by sprite
   handle, with each mark's identity recorded at spawn, can follow the
   sprite's alpha instead (a proposal in the cut).
7. **The inputs.** A 1×1 body's mark sits at its sprite position, which is
   still its ground point (§107d-post changed only depth). N×N bodies are
   only `rubble_2x2` and `rubble_3x3` (✔ `config/units.json:636-648`), all
   scenery, so every combatant's mark is 1×1 and N×N appears only as a plate
   at `footprintCentre` (✔ `boardPanel/index.ts:151-159`). The outline
   colour is `spriteColorForUnit` (✔ `spriteColor.ts:51-63`), a function of
   team, archetype and camp id; held tints are written onto the sprite
   separately (✔ `BattleRenderer.ts:135-141`), so none reaches the outline.
8. **The signed look, as numbers.** The merged mark is the side's shape at
   0.55 × footprint across its vertices (vertex radius 0.275), filled black
   at 0.45, outlined in the team colour at 0.3, the ring's stroke radial at
   0.16 of the vertex radius (✔ `groundCue.ts:69`, `:161-167`; ✔
   `state.ts:156`, `:180-182`; the bookmark's `cueAlpha-0.3`). The plate is a
   world square of half-side n/2 − 0.06, filled black at 0.6, framed in the
   body's colour at 0.3 with a 0.07 stroke (✔ `groundCue.ts:76-77`,
   `:186-194`; ✔ `state.ts:204`). Shapes: a 40-gon circle, a 4-gon with its
   vertices on the grid axes, a 3-gon from θ = π/2 (✔ `:62-66`). Order:
   plates, then fills, then outlines (✔ `:80`). Derived: a radial stroke is
   0.16·r·cos(π/n) wide across an edge, so the triangle's outline is half as
   thick as the circle's; an SDF that reproduces the mock scales the polygon
   rather than offsetting it by a constant width.
9. **The mock was aliased** (derived, unmeasured). Both composers render into
   EffectComposer's own targets, created with no `samples` (✔
   `Renderer.ts:199`, `:222`); `antialias: true` (✔ `:167`) reaches only the
   canvas OutputPass writes to. SDF marks with derivative anti-aliasing will
   have softer edges than the signed mock, so a pixel comparison can hold
   interiors to a tolerance, not edges.
10. **Colour matches by construction** (derived). The targets are linear and
    OutputPass converts at the end (✔ `Renderer.ts:228-233`). The mock's
    `MeshBasicMaterial` blended `THREE.Color` (linear) values into that
    target; the terrain writes its `aColor`, also a `THREE.Color`, the same
    way. Colours passed as `THREE.Color` and composited with `mix` reproduce
    the mock's blend; the saturation clamp runs after both (✔ `:226`).
11. **The grey read needs no plumbing.** Ctrl+Alt+G sets
    `filter: grayscale(1)` on the root (✔ `devKeys.ts:126-131`), so marks
    drawn by the terrain grey with the canvas.
12. **The two residuals, as they stand.** (a) The board status pip is a DOM
    bar (✔ `UnitOverlayLayer.ts:347-383`) coloured from a ten-hue table (✔
    `statusDisplay.ts:37-56`). A carded unit's status has a text channel,
    its card's row; a camp unit has no card (DESIGN §Color redundancy and
    "Team identity on the board" clause 4). (b) The destructible wall's
    tell is `CRACKED_STONE` on the indestructible wall's glyph (✔
    `spriteColor.ts:37-45`, `:59-60`); rubble is excluded by the same
    predicate. The atlas has one cell left (WORKLOG §106e).
13. **No frame-time instrument exists.** A search of `src/`, `scripts/` and
    `process/` for `gl.finish`, timer queries, frame time and
    `performance.now` found the render loop's clock, the tooltip's warm
    timer and comments, and no instrument. The loop's clock (✔
    `Renderer.ts:253-257`) is paced by the display, so a shader cost below
    the refresh interval never shows in it. Not verified here: that Firefox
    hides `EXT_disjoint_timer_query_webgl2` by default and coarsens
    `performance.now`. A synchronous timing (render a frame, then a
    one-pixel `readPixels` to wait for the GPU), averaged over many frames,
    works in both browsers.
14. **Fixtures.** `board-quarry` has a camp and the rubble slabs (✔
    `fixtures.ts:62-67`). Which fixture has hills or destructible walls is
    not known; step zero finds them.
15. **The hop exists only in the instrument** (WORKLOG §107d, "Candidate
    fixes"); nothing in the renderer draws it. Re-reading upright depth
    against the hop needs a dev dial that draws it.
16. **What D8 deletes this phase, as the code stands:** `GroundCues` and its
    test, `conform.ts` and its test, `drapeViewOf` and the tops block in the
    explorer's frame hook, the dials `cue`, `cueSize`, `cueAlpha`,
    `cueDepth`, `ground`, `shadowSize`, `shadowAlpha`, `plate`, `plateScope`,
    `plateAlpha`, `drape` and `shadow`, the ground-mark artefact line, and
    `probe().cues`. The posed flyer stays (Round 9), so its mark moves onto
    production's table. Unknown keys drop (✔ `state.ts:292`), so the signed
    bookmark shrinks to `anchor-bottom` and keeps parsing.

**Predictions for the whole phase:** no snapshot bump; no RNG; the fuzz
smoke fires on no step (`src/render`, `src/dev`, `src/ui`, `tests/board`
and docs are outside the hook's trigger set).

**The cut (user-signed 2026-09-24, "This cut looks great"):** ROADMAP §108,
six steps and two stops. Why this order: the bins are pinned headless before
a shader reads them; the look is read at stop 1 before anything builds on
it; the mock stays until the last step because it is the known answer for
"production matches the signed look".

**The six decisions, all the session's proposals, signed as posed:**
1. **The camp unit's hue-only status pip is deferred to Round 8** (TODO).
   The fix is a DOM and font change, not the board, and Round 8 re-picks the
   status hues for its colourblind palette, so the pip's symbols and hues get
   one design pass, not two. DESIGN's clause-4 note is re-pointed at 108e.
2. **The destructible wall's tell becomes a dashed plate frame** ("a good
   catch! Fully signed"): a flag and a dash term in the same SDF, a shape so
   it passes the grey read, no atlas cell spent. Built at 108b, on the
   `isDestructibleObstacle` predicate the colour tell already uses.
3. **The hop gets a dev dial (108c)**, so stop 2 compares it with upright
   depth on screen; the user's 107d note kept the hop as the rival until the
   marks exist. Deleted with the verdict.
4. **A mark fades with its glyph** (finding 6): out on a death, in with a
   reinforcement.
5. **The frame cost is paired legs in one sitting** (marks compiled out vs
   in, alternating) rather than a separate before taken now; the off leg is
   today's shader, byte for byte.
6. **Two stops** (the look, then the requirements).

### 108a — the mark table, headless (2026-09-24) — read `none` ✅

`src/render/groundMarks.ts`, THREE-free: `MarkTable` packs one frame's
marks into two RGBA32F arrays the terrain shader will read (a mark is
`(x, z, extent, shape code)` and `(r, g, b, alpha)`; a tile's bin is four
texels of mark index + 1, 0 ending the list) and bins each mark into the
tiles it can reach, plates first. A contact mark is binned by its
circumscribed circle grown by `BIN_MARGIN` (0.05), a plate by its square
grown the same; the margin stays under the plate's inset, so a 1×1 plate
stays in its own tile. `BIN_DEPTH` is 16, the table holds 2048 marks (every
tile of a 32×32 board, twice), and every dropped placement is counted in
`overflow`, with `maxBin` the frame's peak demand. `markShapeOf`,
`isDashedPlate` (the §40c predicate, so both destructible walls and
destructible cover, never rubble or a camp member) and `markExtent` map a
body to its mark; `DEFAULT_MARK_STYLE` holds the signed numbers.

**Verified:** `groundMarks.test.ts`, 12 tests. The known answers are
re-derived in the test: tiles from `gridToWorld`'s centre formula, shapes
from the mock's construction (three's polygon laid flat, (x, y) → (x, −y)).
Over 150 random six-mark boards, every tile a shape reaches (13×13 samples
of the closed tile) holds the mark, and no bin holds a mark past its bound;
a standing mark and a 1×1, 2×2 or 3×3 plate stay on their own tiles; a
planted crowd of 11 marks at contact size 1 on one tile fits; a full bin
and a full table count what they drop; plates come first; nothing bins off
the board; the packed layout is where the header says. The failing
controls: shrinking the reach to 0.8 of the extent fails 2 tests, and
flipping the z mapping fails 3.

**Not verified:** that the shader reads this layout the same way (108b's
pane check against the mock).

### 108b — the terrain draws the marks (2026-09-24) — ◐ BUILT; STOP 1 (the look) is open

`shaders/terrainMarks.glsl` evaluates each mark in the fragment's tile bin
as a shape at the fragment's world XZ (a circle; a diamond and a triangle as
the max of their edge planes, so the corners stay sharp; the plate as a
rounded square), anti-aliased from `dFdx`/`dFdy` of the world position,
taken once before the per-tile loops diverge. Plates first (fill, then
frame), then every contact fill, then every contact outline: the mock's
order. `TerrainRenderer.groundMarkShaders()` splices the chunk in (a
world-space normal varying for the tile pick, the chunk before `main`, one
call before the write); with marks off the materials hold the two shader
files untouched. The table's two DataTextures and the style ride uniform
objects shared with the mounds' material (finding 3). BattleRenderer
records each body's mark at spawn (`markSpecs`) and, after the lerps each
frame, adds one mark per sprite in `handles` at the sprite's alpha, so a
dying body's mark fades with it and a reinforcement's fades in (decision 4);
the table uploads at the first terrain draw, so the explorer's posed marks,
added in its later frame hook, are in the frame. A destructible wall or
cover gets two 0.1-wide gaps per side of its frame (decision 2; the gap is
a proposal). The explorer gains `marks` (production on/off) and six look
dials (`markSize`, `markFill`, `markLine`, `plateFill`, `plateCorner`,
`plateDash`) through the typed `setMarkStyle`, and `probe().marks`.

**Verified, headless:** `TerrainRenderer.test.ts` +5: marks off is both
shader files byte for byte (read from disk, not through the import); marks
on keeps every line of both files in order and calls the chunk once, before
the write; the mounds hold the same seven uniform objects (the control: a
bare clone does not); a frame uploads once however many terrain meshes
draw; marks off takes no marks; the style reaches the uniforms.
`state.test.ts` +2: the look dials' defaults are `DEFAULT_MARK_STYLE`.

**Verified in the pane** (Chromium, 1280×720, `?bp=board-quarry`: 30
bodies, the countdown parked, shader time held, sprites hidden, each
capture rendered and read in one task):
- The shader compiles; no console errors. 30 marks, the fullest bin 1, no
  overflow.
- **Against the mock** (the signed bookmark's mark dials, terrain marks
  off, dash gap 0 since the mock has none):
  - on every locally flat pixel inside a mock mark (29,209), production is
    within 4/255;
  - per contact mark, the fill's area in linear light (outlines at 0):
    production / mock 1.00–1.01 for the six circles and 0.96–1.04 for the
    eight diamonds (production steady at about 211 px², the aliased mock
    203–220 with pixel phase), the triangle 1.012 once the plates are out
    of its window; mask IoU 0.89–1.00. The triangle's disagreeing pixels
    are a band on its top edge (mock only) and its bottom edge (production
    only), which fits the mock's 0.012 lift above the tile top, about
    0.33 px up the screen here (derived);
  - **the known answer's control:** contact size 0.50 instead of 0.55
    reads 0.79–0.86 by area (expected (0.50/0.55)² = 0.83). A flat-pixel
    check alone passed that planted error, because size is an edge
    property; the area check is what catches it.
- **A finding about the mock:** inside some multi-tile rubble plates the
  mock blended its fill twice along lines (at plate opacity 0.6 it left
  0.16 of the light, 0.4²; at 0.3 it left 0.49, 0.7²), where production
  blends once (0.40). The signed look carried faint dark seams production
  doesn't have.
- **Fading with the glyph:** a player unit's sprite at alpha 0.5 darkens
  0.498 as much as at 1. A real `onUnitDied` on an enemy: the mark is
  still in the table 0.15 s into the sprite's 0.3 s fade (alpha 0.5), and
  both are gone after it (30 → 29 marks).
- **The dashed frame:** 754 px of frame colour open into gaps across the 4
  destructible walls between dash gap 0 and 0.1.
- **Mounds** (`layout=desertFortress`, 67 hills tiles, 8 enemies on them):
  1,178 pixels of mound surface change when the marks are on; with the
  mounds' `uMarkCount` swapped for an unshared uniform, 0.

**Not verified:** Firefox (the shader has not compiled there yet); the look
at the user's resolution and in motion; the dash's proportions; the step
faces were drawn in the comparison but not measured apart from the tops.

**Stop 1 script (the look).** In Firefox:
1. `?bp=board-quarry`: circles under yours, diamonds under the enemy's, a
   triangle under the camp bandit; filled plates under rubble and walls,
   dashed frames on the 4 destructible walls. Space starts the fight:
   marks follow moves, and fade out with a death.
2. The same board with the mock alone, for comparison:
   `?bp=board-quarry_cue-outline_cueAlpha-0.3_ground-merged_plate-filled_plateScope-all_drape-1_cueDepth-world_marks-0`.
   Expected differences: slightly softer edges, and no dark seams inside
   the big rubble plates.
3. Hills: `?seed=7&layout=desertFortress&character=soldier&firstNode=elite&roster=mercenary,archer,rogue,healer,mage,catapult`,
   then the top map node: the enemies' diamonds lie over the mounds.
4. The explorer's dials (Ctrl+Alt+P) for the values: mark size, fill and
   outline; plate fill; plate corner (the open read on rounding); dash gap.

Wrong looks like: a mark missing from a mound or a step face, a mark
spilling onto a neighbour's face, a mark left behind after a death, a shape
or size off from the bookmark, or the terrain failing to draw at all (a
shader that does not compile in Firefox).

### 108b — STOP 1, THE READ (2026-09-25, the user's) — CLEAR

"I spent a lot of time stress testing this and even sent it to a handful of
playtesters, and we can't identity any issues. None of the wrongs you
identified showed up, and the defaults you used look great!" The shader
compiles and draws in Firefox, which the pane could not show.

**Signed with it:** the defaults, `DEFAULT_MARK_STYLE` as committed: contact
size 0.55, fill 0.45, outline 0.3; plate fill 0.6; **square plate corners**
(the spec's open rounding read, answered by the default 0); the dashed
frame's 0.1 gap. On the corners, the user's elaboration: "for the
destructible walls, the dashes did on their own what I hoped the rounded
corners would do. For the rubble... It was a bit more of a tie goes to the
default situation. I wouldn't delete the seam yet, because one bit of
content I'm imagining for the future are trees, and I think that the
rounding might thematically fit for 'organic' scenery." So 108f deletes the
look dials except `plateCorner`, which stays as an explorer keeper with the
production parameter behind it (TODO, "Rounded plates for organic
scenery").

**For 108e:** DESIGN's §Terrain paragraph is far out of date (it still
describes "a subdivided plane" that is "decorative only"); rewrite it with
the identity and elevation text.

### 108c — the hop as a dev dial (2026-09-25) — ◐ BUILT; read at STOP 2

**Step zero, the premise against the code.** The hop still existed only in
the instrument: `startGroundLerp` hard-coded an arc of 0. But
`SpriteAnimator.update` already adds E7.D's arc, `arcHeight · 4t(1−t)`, on
top of the §81c2 ground profile, which is the instrument's `arc` lift, so
the dial needed one pass-through parameter and no new motion path. What the
hop adds over upright depth, measured with a new `upright+arc` column in
`npx tsx tests/board/clip.ts` (shipped camera, 2560×1440, 15×15, a 0.4
step):

| Case | upright | upright + hop |
|---|---|---|
| far corner high, both corners high, floor band | 0 % | 0 % |
| near corner high (a step in front, S2) | 3.5 % | 0 % |
| the squeeze, both side corners high (S4, S10) | 12.5 % | 0 % |

The cost is the bob: 22 px on a 0.4 step, 17 px on 0.3. The cut stands as
signed.

**Built:**
- `SpriteAnimator.startGroundLerp` takes an optional `arcHeight` (default
  0; no production caller passes one).
- `src/dev/boardPanel/hop.ts`, `diagonalHop`: a whole-tile diagonal (both
  axes within 1e-3 of one tile, so a settle-back from mid-move never
  qualifies) arcs by how far its higher corner cell stands above its higher
  end; anything else gets 0.
- The `hop` dial (off by default). seams.ts wraps
  `SpriteAnimator.prototype.startGroundLerp`, a public method, so tsc checks
  the wrap; with the dial on it adds `diagonalHop` on the live world's tile
  heights (`slabGroundOf`). `probe().hops` counts the lifted moves and the
  highest arc.
- A board fixture, `wade` (icebergs, seed 1, live), because the `live`
  river fight has no diagonal between two water tiles. A headless hunt
  (the real `Run` and `World`, 12 seeds each of nine layouts) counted such
  moves past a land corner: river 0–6 per fight (seed 7, `live`: 0),
  isthmus 2–8, icebergs 8–25 (seed 1: 25, the first 2.9 s in).

**Verified, headless:** `tests/board/hop.test.ts`, 4 tests, driving the
real animator through the clip instrument: the rule's known answers from
world positions; the glyph stands on the higher corner at t = 0.5; the
controls without the hop (the card rule hides over 40 % on S1, upright
over 10 % on the squeeze and more than 0 on S2); with the hop, 0 hidden on
all seven diagonal cases under both depth rules. Two planted errors: a
half-height arc fails 3 of the 4 tests (10.4 % hidden on S1), and reading
the move's end cells instead of its corners fails the same 3 (56.1 %).
`fixtures.test.ts` pins `wade` opening icebergs at 16×16.

**Verified in the pane** (Chromium, hidden, driven by
`activeScene.tick(1/60)`):
- `board-live` with the dial on, the whole fight (40 s, a player win): 71
  diagonal moves, 30 hopped. In the first 20 s, every diagonal whose corner
  stood higher got exactly the rule's arc (22 of 22, no mismatch), and
  none else. A hopping sprite sampled every frame peaks at −0.023, the
  corner's tile top. The control, the dial off for the next 15 s: 4
  qualifying diagonals, 0 arcs, and the bookmark drops `hop-1`.
- `board-wade`: the live fight matches the headless hunt tick for tick
  (t57 enemy R, t91 camp a, t100 enemy B). Through tick 937: 157
  diagonals, 54 hops (13 under 0.05, 12 from 0.05 to 0.1, 29 of 0.1 or
  more, 10 of 0.2 or more), the highest 0.344. The first big one peaks at
  its corner's height (−0.0789 against −0.079).
- No console errors.

**Finding: the hop is common, and mostly small.** Floor, hills, ice and
sand share one height-noise band, [−0.3, 0] (`TerrainRenderer.heightAt`);
water sits at −0.4 and mud at −0.25. So a third or more of diagonal moves
(30 of 71 on the river, 54 of 157 on the icebergs) pass a corner a little
higher than both ends. At the user's resolution a world unit of lift draws
about 67 px on the 12×12 river and 53 px on the 16×16 icebergs: `live`'s
hops are 0.3–9.5 px, `wade`'s hops of 0.1 or more 5–18 px. The instrument's squeeze case is a 0.4 step;
what a small noise step hides under upright alone is not measured. A
minimum height below which a diagonal doesn't hop would be a threshold, so
it is a question for stop 2, not built.

**Not verified:** Firefox; the look in motion (whether the small bobs read
as a hop, as jitter, or not at all, and how a lifted glyph, with its bar
and hitsplats, sits over the marks, which stay on the tiles); a dev lens.

**Stop 2 script, the hop part.** In Firefox:
1. `?bp=board-wade_hop-1`. Space starts the fight. The larger hops, in
   fight time at 1× speed: the player's archer about 7 s and 9 s in (right
   of centre, low), an enemy
   `R` about 13 s in (centre, low), a camp archer about 14 s in (centre,
   high). Toggle "diagonal hop" in the explorer (Ctrl+Alt+P) to compare
   with upright depth alone; a toggle applies from the next move.
2. `?bp=board-live_hop-1`, the river fight: only the small land hops.
Wrong looks like: a hop on a straight move or on flat ground; a glyph
dipping into the corner it passes; a mark lifting with its glyph; a move
that snaps at its start or end.

### 108d — the frame-cost bench (2026-09-25) — ◐ BUILT; the user's Firefox run is at STOP 2

**Step zero.** Kickoff finding 13 still holds: nothing in the tree times a
frame, and the render loop's clock is paced by the display. The marks' cost
has two parts, both on the marks-on path only: the CPU builds, bins and
uploads the table every frame (`updateGroundMarks`, then `commitMarks`
re-uploading two 64 KB float textures), and every terrain fragment reads its
tile's bin and evaluates its marks. With the marks off, neither runs, and
the shaders are the two files byte for byte. A bench frame has to contain
both parts.

**Built:** a button on the explorer panel, `frame-cost bench`, and
`__game.boardPanel.bench()`.
- `bench.ts` (pure). Three discarded warm-up rounds, then four blocks,
  each 8 rounds of A B B A, run back to back with a pause only between
  rounds:
  - marks off → on;
  - an A/A control (off → off);
  - a planted CPU spin of 1 ms, which must read back at its size;
  - marks on → every tile's bin filled as far as the table allows, which
    must read above the A/A spread.

  Every leg starts from the same marks-toggle round trip and 3 untimed
  frames. It times 6 chunks of 8 frames and reads the median chunk mean.
  The report gives each block's A and B, the median paired difference with
  its min and max, the three checks, and the bins (marks, fullest bin,
  overflow).
- `benchRig.ts` (the live side). A frame is `BattleRenderer.update(0)`
  (where the table is built), the sort with the explorer's hook, the
  two-pass render, and a one-pixel `readPixels` that waits for the GPU. The
  sim doesn't step, so every leg draws the same board. The spin is
  calibrated at the start of each run, over at least 100 ms, and the
  report gives the GPU's name, the canvas size and the clock's measured
  step.

**The instrument's own read, in the pane,** found four problems, and each
changed the design:
1. The first cut, with a pause after every leg and no warm-up, failed its
   checks: the A/A read −0.27 ms, and the planted 1 ms read 0.70. The
   marks-off legs' means fell from 2.0 to 1.4 ms across the first three
   blocks. That is a warm-up, which no leg order cancels, so warm-up
   rounds were added.
2. With the warm-up, the A/A read +0.24 ms, every round positive: the
   opposite sign, so noise that differed from leg to leg rather than a
   fixed bias. The legs of a round now run back to back, and the default
   went from 4 rounds × 30 frames to 8 × 40. At 1280×720 two runs then
   read the A/A at +0.006 and +0.013 and the planted 1 ms at 1.006 and
   1.074.
3. In the second of those runs the stress check (every round above the
   A/A range) failed on one outlier round (0.09, next to another at 2.96:
   single-leg stalls). The check now uses the median.
4. At 2560×1440, 2 runs failed badly (A/A rounds up to ±1.45 ms; the
   planted 1 ms read 0.21, then 1.25). A leg is now the median of its chunk
   means, so a stalled chunk drops out. Under a linear drift the median
   still equals the leg mean, and the chunks are long enough that a
   coarse clock costs them little.

**Verified, headless:** `bench.test.ts`, 7 tests against a fake clock with
known costs and a linear drift. Every cost reads back exactly, and so does
the schedule's frame and toggle count. A 50 ms stall in one chunk drops
out. Three controls fail as they should:
- one chunk per leg, where the stall moves the round's difference;
- a planted cost that never reaches the timed frame, which fails its check;
- full bins that cost nothing, which fail theirs.

A planted error in the bench itself, the rounds run ABAB instead of ABBA,
reads 0.313 for a true 0.300 under the drift, and the known-answer test
fails.

**Measured in the pane** (Chromium, on this machine's GPU: ANGLE D3D11,
RTX 4080 SUPER; `board-quarry`, 14×12, parked; the viewport emulated at
2560×1440 with a 2560×1440 canvas; clock step 0.1 ms). Two runs of the
final design, milliseconds per frame, median over the rounds:

| Block | run 1 | run 2 |
|---|---|---|
| marks off → on (30 marks, fullest bin 1) | +0.202 [−0.29, +0.49] | +0.167 [+0.01, +0.37] |
| A/A | +0.066 [−0.10, +0.31] | +0.050 [−0.21, +0.31] |
| planted 1.00 ms | 1.119 | 1.130 |
| full bins (2046 marks, fullest 13) | +0.538 | +0.778 |
| the frame, marks off | 1.249 | 1.325 |

All three checks passed in both. In this browser at this resolution the
marks cost about 0.17–0.20 ms per synced frame, 13–16 % of a frame that
takes 1.25–1.33 ms here. The planted cost reads 12–13 % high; the A/A's
+0.05–0.07 accounts for about half of that. How the cost splits between
the table upload and the shader is not measured.

**Not verified:** Firefox (the stop-2 read; its clock step and its
WebGL, which runs in a separate GPU process, may behave differently from
Chromium's); other boards; a real screen rather than the pane's emulated
viewport; the CPU/GPU split.

**Stop 2 script, the bench part.** In Firefox, full screen (F11) so the
canvas is 2560×1440 (the report's first line prints the canvas size):
1. `?bp=board-quarry`, then Ctrl+Alt+P, then the `frame-cost bench`
   button. It takes about 15 s: leave the window alone. The board freezes,
   and white circles flash on every tile during the full-bins legs. The
   report appears in the panel and in the console (`[board-panel]`),
   where it can be copied.
2. Run it twice. The two `marks off -> on` medians should agree within
   the A/A spread.

Wrong looks like: a `FAILED` check (distrust that run and run it again);
a canvas that isn't 2560x1440; or the two runs' marks medians further
apart than the widest A/A round.
