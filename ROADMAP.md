# ROADMAP — Round 7 (Idioms), post-§94

The active PLAN (it stays a plan for its whole life). The macro order is
[META-ROADMAP.md](META-ROADMAP.md) (Round 6 ✅ CLOSED 2026-09-02; THE
CASUALTY EXPERIMENT §89–§94 ✅ CLOSED 2026-09-08; Round 7 Idioms KICKED
OFF 2026-09-09; Round 7.5 Units follows it). The spec:
[round-7-spec.md](round-7-spec.md) (twelve resolutions, user-signed
2026-09-09). Findings + rationale land in [WORKLOG.md](WORKLOG.md)
(§Kickoff holds the code-reality audit the cut was posed against); live
status is HANDOFF's 🧭 Cursor. Sub-steps are cut at each phase kickoff
(AGENTS "The planning stack"), never here — §95's are cut because its
kickoff IS the spec session; §96–§104 get theirs at their own kickoffs
(each a minutes-long audit + cut; the user promoted the audit's seven
sub-areas to phases to keep the numbering flat). **§96.5 was inserted
2026-09-10** from the §95 playtest (the `.5` convention applied to a
phase — nothing renumbers). Prior round's plan:
[archive/post-88-roadmap.md](archive/post-88-roadmap.md) with its
worklog and spec beside it.

**Round-level rules** (from the spec's scope guards): no new screens ·
English-only · no sim change and ONE authorized snapshot bump (95f) ·
no board/balance work · no settings surface or persistence (every
toggle is Round 8; Round 7 leaves each a one-table / one-seam change) ·
the glyph rework + team identity are Round 7.5. **Touch each file once:**
whichever phase FIRST touches a UI surface extracts its strings into the
§95c table in that touch; §100 sweeps the remainder and drives the §95d
baseline to zero.

## Phase 95 — the i18n layer ✅ CLOSED 2026-09-10

**Outcome (one breath):** the locale layer exists and is pinned —
`prose()` sidecars (10 families / 255 addresses), `t()` over the 52-key
UI table, the 115-literal ratchet, provenance + `i18n:review`, the
empower key `honed` under Run v46 — and the user playtest passed
(WORKLOG §95 playtest; its two §94 findings became §96.5). The charter
is in git at `18eeddc`; the cut lines stay below.

- [x] **95a — the runtime + the events family.** ✅ 2026-09-09 (`3d8aca7`
  + the migration commit): `prose()` is a zod `.meta` marker and the
  walkers derive everything from it (zod 4 has no `ctx.path`, so the
  parse-time capture the spec sketched became a def-tree walk — WORKLOG
  §95a); 122 addresses in `locales/en/events.json`, 0 positional; 65
  choice ids stamped through the editor's formatter; the no-bump
  prediction HELD (the snapshot cursor is `{eventId, pageId}`).
- [x] **95b — the other families.** ✅ 2026-09-09: `prose()` on
  encounters · daemons · packets · characters · sectors · statuses ·
  units · abilities · layouts (camps has NO rendered prose — not a
  family); each loader exports `<FAMILY>_PROSE = loadProse(…)`; **255
  addresses across 10 files, 0 positional** — the "240" here was the
  audit's arithmetic (its "57 never-rendered" is 42; WORKLOG §95b).
- [x] **95c — the UI string table.** ✅ 2026-09-09: `t(key, params)` over
  `locales/en/ui.json` (49 keys, the English SOURCE — explicit keys, not
  a derived extract); plural entries by CLDR category via
  `Intl.PluralRules`, `{placeholder}` substitution, numbers through
  `Intl.NumberFormat`, no dependency; the four shared tables + the
  duplicated literals migrated (65 call sites); the three plural sites
  as the proof; the sim's `PROCEDURAL_MAP_NAME` DELETED (prose in sim
  code, consumed only by views) → `map.uncharted`; the key-scan pins
  (`tests/i18n-ui-keys.test.ts`: every literal key exists · every key
  is referenced · no computed keys · non-en tables match the key set).
- [x] **95d — the literal pin.** ✅ 2026-09-09: a vitest scan over the
  TypeScript AST, not a lint rule (the hook runs typecheck + `npm test`,
  never lint — the pin rides the forgetful path only as a test);
  prose-shaped literals (two words with whitespace, or one Capitalized
  word) in the presentation layer, with structural exclusions (Error /
  console / assert-fail callees · class + style plumbing · dev
  properties · types, cases, names) and a reviewable `// i18n-ok` /
  `i18n-ok-file` opt-out; `tests/i18n-literal-baseline.json` = **117
  literals in 22 files**, held EXACTLY per file (a ratchet: over fails,
  under fails until lowered — `npm run i18n:baseline`; `--list` is the
  extraction worklist).
- [x] **95e — provenance.** ✅ 2026-09-10: `{ text, source, translator,
  reviewer }` (provenance.ts; `source` = fnv1a of the English, the hash
  moved to `src/core/` and PERMANENT); the audit = missing / orphan /
  **unstamped** / **fuzzy**, one function under both disk pins + a
  hand-drifted fixture (flags fuzzy — the exit); a fuzzy entry falls back
  to English at runtime with the DEV `⚠ ` marker + a census; `npm run
  i18n:review` (translator / reviewer roles — the ONLY stamp writer);
  `localeCredits()` over the registry for Round 8. WORKLOG §95e.
- [x] **95f — the empower key rename.** ✅ 2026-09-10: `"empowered"` →
  **`"honed"`** (the user's pick from four candidates) in `daemons.json` +
  `empower.json`; **RunSnapshot v45 → v46** (reject-stale); the buff LABEL
  now rides EMPOWER_DISPLAY from the string table (`buff.<key>` ×5 — the
  capitalized key was untranslatable) under the same coverage pin; the two
  empower strings of PreTurnScreen through the table (baseline 23 → 21).
  WORKLOG §95f. **§95 exit = the user playtest.**

## Phase 96 — the shells + the tokens ✅ CLOSED 2026-09-11

**Outcome (one breath):** the four shells exist and every surface is on
them — 57 CSS tokens (`--color-*` pinned to `palette.ts`, `--text-*` in
rem; zero raw hexes or font-sizes below `:root`), the `Screen` base under
eleven screens, `button()` + `.btn--primary` under the nine walk-on
buttons, `.chip` + the chrome column under the four chips (a hidden chip
collapses — decision D), and `openModal` under the three modals with the
focus trap + restore (the phase's one new behavior — decision E); every
step proven zero-drift by a stylesheet oracle and playtested by the user
(five for five clear — the exit). `ui.json` 52 → 67; the literal baseline
115 → 99; no snapshot bump. The charter is in git at `aaf91b7` (the
kickoff, with the five signed decisions A–E); DESIGN §UI idioms holds the
reference; the cut lines stay below.

- [x] **96a — the color tokens.** ✅ 2026-09-11: 37 tokens (the palette
  thirteen by kebab + role names + the grays by level); 378 `var()` + 54
  RCS tints; the pin `tests/ui-tokens.test.ts`; the oracle read **1552
  declarations, 0 diffs** vs HEAD; RCS browser-verified. WORKLOG §96a.
- [x] **96b — the text tokens.** ✅ 2026-09-11: 20 `--text-<px>` tokens
  in rem, 109 references, exact 1:1; the oracle **1552 / 0 diffs** vs
  `6539610`; the pin's 96b block; six browser probes = HEAD's px. WORKLOG
  §96b.
- [x] **96c — the Screen base.** ✅ 2026-09-11: `src/ui/Screen.ts`
  (`present(el)` + `hide()`); the eleven screens migrate (−69 lines; seven
  keep an `override hide()`), the HUD, the scenes and every `show()`
  signature untouched; a hand-driven browser walk reached 8/11 screens,
  one root mounted per swap. WORKLOG §96c.
- [x] **96d — the button factory + `.btn--primary`.** ✅ 2026-09-11:
  `src/ui/button.ts`; nine rules → `.btn--primary` + `btn--dim` /
  `btn--exit` / `btn--corner` (the deliberate deltas; the incidental ones
  preserved inside them, listed for a later collapse); the two
  `actionButton` copies folded; the three `type="button"` fixed; eleven
  keys → `ui.json` (52 → 63), baseline 115 → 103; the cascade oracle 367
  properties / 0 diffs; six browser probes = HEAD. WORKLOG §96d.
- [x] **96e — the chip base.** ✅ 2026-09-11: `src/ui/chip.ts` (`.chip` +
  `chipPulse` + `createChromeColumn`); the four pixel pins → one flex
  column with CSS `order` (construction order untouched), `gap: 10px` →
  20 / 75 / 131 / 187 (a 1px lift on three); collapse on hide (D) live —
  the pool chip sits third on MapScene; the modal/overlay keep the page
  mount; `#ui > .chrome-column` passes clicks through (the browser caught
  the id-specificity trap); the oracle 651 properties / 0 diffs. The cache
  chip stays a `<div>` (§100). WORKLOG §96e.
- [x] **96f — the modal shell.** ✅ 2026-09-11: `src/ui/modal.ts` (two
  variants reproducing the consumers' DOM; ONE dismissable gate for Esc +
  backdrop + ✕; `onClose` once from any route; the focus trap + restore =
  the phase's one new behavior; role/aria-modal ride along); the three
  consumers migrated, one CSS rule added; four keys → `ui.json` (67), the
  baseline 103 → 99; browser-proven (focus returns to the roster button /
  the map chip). WORKLOG §96f.
- [x] **96g — the docs + the exit.** ✅ 2026-09-11: DESIGN §UI idioms
  created with the shells section (tokens · screens · buttons · chips ·
  modals · strings; §103 signs the whole); ARCHITECTURE's ui tree kept per
  step; the scratchpad's §96 entries. Predictions held: no snapshot bump,
  no fuzz trigger, ui.json +15 keys (52 → 67; the "~25" over-counted the
  non-primary buttons touch-once left for §100). **Exit = the user's
  eyeball walk — taken as five per-step playtests, every one clear.**

## Phase 96.5 — the live pool bar + the chip rule ✅ CLOSED 2026-09-13

**Inserted 2026-09-10** at the §95 playtest (two §94 presentation
findings; the `.5` convention applied to a phase). **Outcome:** morale
reads once per screen (the chip hides on the turn screen + the battle);
the battle gauges are LIVE off a loss-event stream beside the chip rule's
arithmetic (the user's model over the kickoff's projection) — an orb per
loss from the causing card to the paying gauge, the ghost growing on the
landing, the pulse, the scaled cue, the thresholded shake with the policy
seam, the breathing notch at each turn's bound, the commit at the settle;
the post-turn screen removed (Game advances the gate after the outro; the
pre-turn "last turn" strip records the turn); the risk line repaints at
the source. Run untouched; no snapshot bump; the fuzz smoke held on every
firing. The charter, the design round and the decisions live in git at
`011893e`; the narrative in WORKLOG §96.5; the idiom in DESIGN §UI idioms
"The live bar". The cut, as landed (two user-inserted steps, two playtest
redesigns):

- [x] **96.5a — the chip rule.** ✅ 2026-09-12: `PoolOverlay.setSuppressed`
  (two flags, one class) pushed from `Game.swap` for PreTurn / Battle /
  PostTurn; browser-walked, playtest clear. WORKLOG §96.5a.
- [x] **96.5b1 — the loss-event model + the ghost (headless-first).** ✅
  2026-09-12: the model in `chipRule.ts` pinned Σ stream = `turnCharges`;
  World gains TWO reads (not the one predicted); the gauge handle + the
  ghost; the HUD commits at `battle:ended` (b2 re-times it). The fuzz
  smoke fired once and held. Playtest clear. WORKLOG §96.5b1.
- [x] **96.5b2-pre — the gauge head's hysteresis.** ✅ 2026-09-12 (the
  user's b1 finding): the head never wraps, the value reserves its widest
  form, the HUD gauges widen 220 → 320 px. WORKLOG §96.5b2-pre.
- [x] **96.5b2 — the orb + the shake + the end sequence (eyeball).** ✅
  2026-09-12: `lossFx.ts` (the `●` orb card → gauge, the ghost grows on
  the landing; the thresholded shake; the SHAKE POLICY seam + Ctrl+Alt+K —
  the user's A/B; reduced motion honored; a wall-clock backstop against a
  stalled animation); the HUD's end sequence → `lossesSettled()` →
  `BattleScene.outro()` → Game's outro = max(900 ms, it). Browser-proven;
  playtest "pretty good" → 96.5b2-post ✅ 2026-09-13: the death readout
  fades, the `moraleloss` landing cue scaled per play (`lossCue`), the
  shake stays fraction-of-max. WORKLOG §96.5b2.
- [x] **96.5c — the risk line.** ✅ 2026-09-13: `poolAtRisk` rides
  `turn:handRedrawn` + `run:packetUsed` (gate-only, 0 elsewhere — the
  map-fired patch tripped seven tests first), the line repaints through
  one function via `t()`; the ceiling tick → **96.5c2 the NOTCH** (the
  user's redesign, 2026-09-13): a breathing 2 px cut in the fill on BOTH
  gauges (`enemyExposure` the mirror bound), cleared at the commit.
  WORKLOG §96.5c.
- [x] **96.5d — the post-turn removal.** ✅ 2026-09-13: Game buffers the
  last `turn:resolved` and auto-dispatches `advanceTurn` after the outro;
  the pre-turn "last turn" strip from turn 2 (nine `lastturn.*` keys);
  `PostTurnScreen` + `PostTurnScene` + 33 CSS rules + two orphaned gray
  tokens deleted; Run untouched. Browser: battle → pre-turn 2 with the
  strip, battle → reward at the encounter's end. WORKLOG §96.5d.
- [x] **96.5e — the docs + the exit.** ✅ 2026-09-13: DESIGN §UI idioms
  "The live bar"; this stub; the scratchpad + the session report; the
  §96.5 riders in TODO. **Exit met on the user's per-step playtests (all
  clear; two redesigns absorbed in-phase):** one morale read per screen ·
  a death moves the bar · the loop's screens agreed (pre-turn → battle →
  the next gate) · the ledger rows homed (the strip now, §102 for the run).
  WORKLOG §96.5e.

## Phase 97 — the tooltip system ✅ CLOSED 2026-09-15

**Outcome:** one component, ONE live element (`src/ui/tooltip.ts`), the
terminal plate, flip-positioned; hover / focus-visible / tap or
long-press / the `showTooltip` key (`Slash`, on the registry); the 20
census sites converted or deliberately deleted (the pip's dead title, the
labelled level) — ZERO native `title=` in `src/ui` + `src/render`, pinned
by `tests/ui-tooltips.test.ts`; the two real sole-source sites labelled
(`LV 5` / `1 POW`, `▲ HONED` on both cards — the user kept both); the §96.5
strip rider closed; `ui.json` 83 → 97 keys, the literal baseline 82 → 71;
Run and World untouched, no snapshot bump. The user's playtest passed
2026-09-15 with one finding absorbed in-phase (97f-post). The charter and
the five kickoff calls live in git at `2af6c70`; the narrative in WORKLOG
§97; the idiom in DESIGN §UI idioms "Tooltips (97)". The cut, as landed:

- [x] **97a — the component (headless-first).** ✅ 2026-09-14 `8942d72`:
  `src/ui/tooltip.ts` (`attachTooltip` / `installTooltipHost` /
  `toggleTooltipKey` / `refreshTooltip`), `placeTooltip` pure + nine pins,
  the plate in ui.css; browser-walked on scratch triggers — every route
  but the disconnected-trigger poll (rAF stalled in the hidden pane).
  WORKLOG §97a.
- [x] **97b — the key.** ✅ 2026-09-14 `6574f49`: `showTooltip` on the
  registry (default `Slash` → `/`), Game's page-lifetime subscription; the
  fuzz smoke fired and held; the pane's key tool sends no `code`, so the
  key's live read is the user's keyboard. WORKLOG §97b.
- [x] **97c — the controls.** ✅ 2026-09-14 `9812f6c`: ten sites (HUD
  speed / pause / objectives / the enemy cards · the sector-map chip · the
  cache chip), `keyedTooltip` for the `[key]` hints, eight `t()` keys, the
  baseline 82 → 77; browser-walked in a live battle (the pause label live
  under the hotkey). ⏳ the long-press on the user's phone. WORKLOG §97c.
- [x] **97d — the pre-turn screen + the reward button.** ✅ 2026-09-14
  `277fb10`: seven sites (draw chip · risk line · pass · packet chip ·
  hand-card `▲` chips · the strip's two) + `button({tooltip})` (the reward
  Continue); `tabindex=0` on the text sites; the §96.5 rider closed; the
  baseline 77 → 73; browser-walked to turn 2 (⏳ the packet chip, the `▲`
  chips and the reward Continue read at the next playtest). WORKLOG §97d.
- [x] **97e — the cards + the board.** ✅ 2026-09-14 `e46b5c6`: the compact
  card reads `LV 5` / `1 POW` (hints beside the number spans), the `▲`
  chips labelled on both cards (⏳ the user's eye on which stays), the
  three power tooltips, the level's title deleted, the pip's dead title
  deleted; the baseline 73 → 71; browser-walked incl. a taken grant.
  WORKLOG §97e.
- [x] **97f — the boss node + the exit.** ✅ 2026-09-14 `2c4adcc`: the
  node's tooltip (the banner carries the copy — never sole-source);
  `tests/ui-tooltips.test.ts` pins zero native `title=` in src/ui +
  src/render (its regex self-checked against the pre-97c tree); DESIGN
  §UI idioms "Tooltips (97)"; the ARCHITECTURE line. **The playtest passed
  2026-09-15** (both `▲` labels kept) → **97f-post** `59a7503`: the HUD
  cards' markers + status rows now paint DURING the countdown (the branch
  returned before `refreshStatuses`; the user's catch). WORKLOG §97f.

## Phase 98 — color redundancy ✅ CLOSED 2026-09-16

**Outcome:** "never color alone" applied at five seams, each with a
second channel beside its hue and every surface read under a
desaturated screenshot before and after (Ctrl+Alt+G, the 98a dev key):
rarity is a COUNT (the star run on every full-card header), map node
state is a RING SHAPE and node kind is NAMED (the bottom-left legend off
shared selectors), a DoT number carries its KIND (a prefix glyph + the
status-table hue, one `HitsplatKind` union), deep water is a SURFACE
PATTERN (static world-space bands in both shaders; the drift term is the
§99 seam). Two charter items were already met by §97's text channel; the
⛔ resolved to the shader at the kickoff (call E); the two team-identity
residuals → a Round 7.5 rider (TODO §98). `ui.json` 97 → 112; tests 2954
→ 2965; no sim touch, no bump, the fuzz smoke never fired. The user's
eye on every step, four in-step reads absorbed. The charter and the six
kickoff calls live in git at `58ada9c`; the narrative in WORKLOG §98;
the idiom in DESIGN §UI idioms "Color redundancy (98)". The cut, as
landed:

- [x] **98a — the instrument.** ✅ 2026-09-15: Ctrl+Alt+G toggles a root
  `filter: grayscale(1)` (DOM + canvas) in `devKeys.ts`; the BEFORE-set
  read in the pane — frontier = locked in grey, the `*` / `?` glyphs
  near-black, deep water reads thinly by luminance. WORKLOG §98a.
- [x] **98b — the rarity stars.** ✅ 2026-09-15: `rarityDisplay.ts` +
  four derived pins; every full-card header carries the fixed-width
  `★☆☆☆`…`★★★★` run (its own block line — inline it wrapped by name
  length) in the tier hue, the name on a §97 tooltip (`rarity.<tier>`
  ×4); the compact card untouched; pane-verified. WORKLOG §98b.
- [x] **98c — the map state shapes + the kind legend.** ✅ 2026-09-15:
  filled / double / dashed / dotted rings on the four state classes (no
  layout change); the bottom-left legend names the six kinds + four
  states off shared selectors (`map.legend.*` ×11), carried by the
  read-only overlay; pane-verified incl. grey. WORKLOG §98c.
- [x] **98d — the hitsplat split.** ✅ 2026-09-15: `kind` → `burn | bleed
  | poison | heal`, ONE `HitsplatKind` union, the hue from the status
  table inline + `HITSPLAT_PREFIX` (`~` / `‡` / `☠`, by eye) through
  `hitsplatText`; the config-derived pin; DOM-observed `☠3` in a forced
  plagueDoctors fight. WORKLOG §98d.
- [x] **98e — deep water.** ✅ 2026-09-16: `ANIM_DEEP_WATER` (id 3) stamps
  two static diagonal bands per tile in terrain.frag + apron.frag
  (`DEEP_DRIFT` 0.0 = the §99 seam); `animTypeFor` the one kind → branch
  map, pinned; the stale recess comment fixed; pane-verified incl. grey.
  WORKLOG §98e.
- [x] **98f — the exit.** ✅ 2026-09-16: the AFTER-set passes on every
  surface under Ctrl+Alt+G; DESIGN §UI idioms "Color redundancy (98)";
  the user's reads absorbed (98b-post the centered stars · 98c-post the
  legend at chip scale · 98e-post the apron diagonal + one band per
  tile); riders → TODO §98; the predictions held. WORKLOG §98f.

## Phase 99 — the reduced-motion seam ✅ CLOSED 2026-09-16

**Outcome:** ONE motion gate (`src/render/motion.ts`: the OS query or
the Round 8 override, stamped on the root as `data-motion="reduced"`)
that the stylesheet, the fx registry, the loss fx and the shader clock
all read — the spec's intent (Round 8 flips one gate) over its letter (a
`@media` block, which a setting could never flip). The sheet's eight
keyframes and two pulses have their reduced twins under the attribute
(fade-only where something waits on `animationend`, `none` elsewhere,
colour-only for the chip pulses); `fxDescriptor` strips shake / burst /
sparkle and keeps the informational channels; `shakeView` gates itself
(the audit's bug: the reduced branch still shook); the shader clock
holds (`BattleScene.advanceShaderTime`) so the diorama goes still; deep
water DRIFTS for motion-on players (0.6 rad/s, pinned equal in both
shaders — the user's eye, twice). Three sheet-derived / key-walking pin
files; every step read in the pane by a seam the code under test did
not own (a synthetic chord, a DOM observer, call counters, the uniforms)
and in the user's Firefox. One dev chord moved (R → A: Firefox's Reader
View, gotcha #134). Tests 2965 → 2984; no sim touch, no bump, the fuzz
smoke never fired. The charter and the five kickoff calls live in git at
`9a944d6`; the narrative in WORKLOG §99; the idiom in DESIGN §UI idioms
"Reduced motion (99)". The cut, as landed:

- [x] **99a — the gate.** ✅ 2026-09-16: `src/render/motion.ts`
  (`reducedMotion()` = override ?? the OS query; `installMotionGate()` in
  main.ts stamps `html[data-motion="reduced"]` + follows `change`;
  `setReducedMotionOverride` = the Round 8 seam) + Ctrl+Alt+A (R for one
  commit — Firefox's Reader View owns it, gotcha #134); the three
  readers moved; `shakeView` gates itself (the bug); six pins;
  pane-verified (boot · reduced · full · OS). WORKLOG §99a.
- [x] **99b — the CSS block.** ✅ 2026-09-16: ONE block keyed off
  `:root[data-motion='reduced']` — `hitsplat-still` / `preturn-card-exit-
  still` (fade-only, same duration), `none` for the pops + the two
  pulses, the chip flashes kept colour-only, the notch `@media` + the
  tooltip's `.is-still` folded in; `tests/ui-motion.test.ts` (seven pins,
  self-checked to fail); pane-verified — 86 hitsplats on the still form,
  0 leaked. WORKLOG §99b.
- [x] **99c — the filter.** ✅ 2026-09-16: `fxDescriptor(key, reduced)`
  strips `REDUCED_MOTION_STRIPS` (shake · burst · sparkle) via the pure
  `stripMotion` copy; the four sites pass `reducedMotion()`; five pins
  over every key under both readings; pane-verified by call counters at
  the effect methods (0 / 0 / 0 stripped under the gate across ~180
  hitsplats; burst + sparkle fire under full). WORKLOG §99c.
- [x] **99d — the browser decision point.** ✅ DECIDED 2026-09-16 (the
  user's Firefox eye): **E — the drift SHIPS at 0.6 rad/s** (retuned from
  the 0.4 probe) in both shaders, the drift-equality pin holds them
  together; **D — the freeze is KEPT** (`BattleScene.advanceShaderTime`,
  the one site, feeds 0 under the gate; pane-read 2.000 vs 0 over 2 s).
  WORKLOG §99d.
- [x] **99e — the exit.** ✅ 2026-09-16: DESIGN "Reduced motion (99)";
  the §96.5 rider closed (the OS-query leg noted), the §98 drift rider
  closed at 99d; this stub; the cursor → §100; the pane lessons into
  HANDOFF's browser-verify tips. WORKLOG §99e.

## Phase 100 — input accessibility + the extraction sweep

**Charter:** DESIGN §Input accessibility extended to hover and to
keyboard focus, audited on every surface: the camera bindings gated
dev-only (the Ctrl+Alt pattern); the eight clickable `<div>` controls
(map nodes · cache chip · hand / recruit / picker / enemy cards) made
focusable buttons; `type="button"`; a `:focus-visible` rule; the two
`<select>`s labelled; per-surface string extraction on every surface
not yet touched → the §95d baseline to ZERO. **Depends on:** §96 (the
shells) + §97 (tooltips replace the hover-only sites). **Risk:**
medium (wide). **Exit:** every hotkey has a click route, every click has
a keyboard route, every surface passes the checklist row; baseline
zero. **Scope guards:** no rebind UI (Round 8); the camera modes are
gated, not designed (the D4 A/B is Round 7.5).

**Kickoff 2026-09-17** (WORKLOG §100 Kickoff — the audit found the cards
cannot be `<button>`s (interactive children), the map node's ring cannot
be `outline` (98c owns it), `type="button"` already done by 96d, a latent
78b armed-pick miss on the enemy card, and a Space-vs-focused-button
collision). **Decisions (user-signed):** Ctrl+Alt+C for the camera
toggle, the user's Firefox read decides · hotkeys WIN over a focused
button in battle, Enter is the button route · the enemy card honours an
armed pick (a 78b behaviour change) · `Screen.present` focuses its
container · the c1/c2 split. No sim touch, no bump; the fuzz smoke fires
once (100e touches `src/config/events.ts`).

- [x] **100a — the camera gate:** Backquote handler removed; the pan
      listeners attach under `import.meta.env.DEV` only; the toggle → devKeys
      Ctrl+Alt+C; gotchas #52/#54 noted. Exit: no camera keydown in the shipped
      bundle; the chord toggles in the user's Firefox. ✅ `7f941b9` + `74c7204`
      (2026-09-17): the bundle's keydown attaches counted (3, none the
      Renderer's); the chord landed in Firefox; the user's scroll-mode verdict
      → a minimap rider on the Round 7.5 A/B (META-ROADMAP). WORKLOG §100a.
- [x] **100b — the focus idiom:** one global `:focus-visible` ring rule on
      controls; every `:hover` rule's `:focus-visible` twin; the map-node ring
      on box-shadow; `tests/ui-focus.test.ts` (the ui-motion shape — a hover
      rule without its twin fails). Exit: pins green; the ring on the pre-turn
      text sites in Firefox. ✅ (2026-09-17): 29 twins + the white ring + the
      node's shadow ring; five pins, self-checked; the pane computes ring +
      twin on a focused card. WORKLOG §100b.
- [ ] **100c1 — `pressable()` + the leaf buttons:** the helper (role +
      tabindex + Enter/Space → the click handler; a pure key predicate,
      pinned); map nodes + the cache chip → real `<button>`s; MapScreen +
      CacheOverlay literals extracted. Exit: Tab + Enter enters a node / opens
      the cache in Firefox.
- [ ] **100c2 — the cards:** hand / recruit / picker / enemy cards through the
      helper, `aria-pressed` mirrors `is-selected`, the enemy card honours
      `armedMode`, the hint wording; HUD + PreTurn + Recruit literals extracted.
      Exit: the §97 riders 1–3 close; arm Focus then Enter a card sets focus.
- [ ] **100d — the selects:** `aria-label` via `t()` on both; Port + Reward
      literals extracted. Exit: baseline Port 13 → 0, Reward 2 → 0.
- [ ] **100e — the extraction remainder:** `describeEventCondition` → `src/ui`
      (a `t()` per kind; `SCAN_ROOTS` drops the file), `common.lv`, the rest;
      `Screen.present` focuses its container. Exit: the baseline is `{}`.
- [ ] **100f — the close:** DESIGN §Input accessibility extended in place
      (hover + focus, the Space rule, the per-surface checklist table),
      "Focus (100)" in §UI idioms, HANDOFF tips, the stub.

## Phase 101 — layout stability

**Charter:** the "Y-coordinate hysteresis" class fixed, not the
instances: `tabular-nums` on every digit sink; the chip column
reflows (with §96's flex column); the once-measured countdown
re-measures; the conditional blocks from WORKLOG §Kickoff D reserve
their space or hide by `visibility`. **Depends on:** §96. **Risk:** low.
**Exit:** no surface shifts as its content changes (the audit's list
walked). **Scope guards:** no redesign of any surface.

## Phase 102 — the two surface riders

**Charter:** (a) `wail` / `hex` gain a `release` phase + a projectile
fx key — the presentation half of the split TODO item (the retune is
Round 9); (b) the run-end stats body on the EXISTING GameOverScreen — a
pure aggregator over `Run.fallenLedger` (per encounter / side /
archetype), both variants. **Depends on:** §96 (the screen base) +
§101. **Risk:** low (config + fxRegistry; a pure aggregator; no sim, no
bump). **Exit:** a wail visibly flies; a run ends with stats. **Scope
guards:** no range / cooldown / duration change; the stats sting is
dispositioned in §104, not here.

## Phase 103 — the idiom reference (the signing)

**Charter:** DESIGN §UI idioms written and signed: the color rule + its
grayscale test · the tooltip rule · the hysteresis class · the shells
(modal / chip / button / screen) · the input rule extended to hover and
focus · the string rule (no literal outside the table) · the
team-identity requirement Round 7.5 must satisfy. The per-surface
checklist (one row per surface) with every row ticked. **Depends on:**
§96–§102. **Risk:** low (docs). **Exit:** the reference signed; the
checklist complete; Rounds 8 and 11 have the artifact they are checked
against. **Scope guards:** no code.

## Phase 104 — the event-keyed sound registry

**Charter:** `EVENT_SOUNDS` + `SILENT_EVENTS` + the coverage pin over
all **47** events (the plan counted ~45 and predates `run:poolChanged`,
`pools:chipped`, `turn:resolved.reason`); the 7 closures retired; the
dedicated sector-win key (the sting rider — the registry's own line,
`Game.ts:347`); the run-end stats sting dispositioned; the
PromotionScreen `healtick` borrow → `stattick`. **Depends on:** §102
(the stats screen exists to disposition). **Risk:** low
(`plans/sound-registry.md` holds byte-for-byte). **Exit:** the coverage
pin green; no event ships silent by default. **Scope guards:** the FX
registry channel untouched; no volume/mute UI (Round 8).
