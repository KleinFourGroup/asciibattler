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

## Phase 96.5 — the live pool bar + the chip rule (INSERTED 2026-09-10)

**Inserted** at the §95 playtest — the first since §94 closed without
one — from two §94 presentation findings (WORKLOG §95 playtest). Numbered
by the round-level `.5` convention applied to a phase (§96–§104 keep
their identities; step addresses read `96.5a`). **Charter:** (a) the
persistent morale chip HIDES while a battle or a turn screen is up — the
HUD and the pre/post-turn gauges are the in-encounter read (the 94e "full
gauge vs chip" residual, answered by the user); (b) **THE LIVE BAR** — the
user's 94d shape-lock idea the presentation commit never built (the HUD
gauges paint once from the encounter's pools; the only death handler
grays the card): the in-battle gauges decrement per death as a PROJECTION
off the live `World.fallenPower` (serialized since v36; the charge still
books at `resolveTurn`, untouched), and the post-turn screen's fate is
DECIDED — kept as the encounter-end summary, folded into the next
pre-turn screen, or removed (then the fallen rows' only home is §102's
run-end stats). **A small design round opens the phase** (what a death
shows on the bar; what a turn's end shows; where the "at risk this turn"
line lives). **Why here:** after §96 (the bar and the chip rule build on
the chip base + the tokens, not before them) and BEFORE §97 / §100 touch
the post-turn screen (16 un-extracted literals + its `title=` sites —
touch-once says decide its fate before anyone extracts it) and before
§103 signs the loop. **Depends on:** §96. **Risk:** low-medium — a flow
change (the pre-turn screen still gates; the post-turn gate may go),
eyeball-only; no sim, no snapshot change (the projection reads state the
snapshot already carries). **Decision points:** the post-turn screen's
fate · a death's read on the bar (a tick per death vs a re-read) · the
risk line's home. **Exit:** one morale read per screen; a death moves
the bar during the battle; the loop's screens agreed and the ledger rows
have a home. **Scope guards:** no rule/timing change (the chip books at
turn end — fuzz byte-identical); no run-end stats body here (§102); no
new screen.

**Kickoff 2026-09-12** (WORKLOG §96.5 Kickoff — the audit + the design
round, six points user-signed). **Decision points ✅ DECIDED:** a death's
read = a LOSS-EVENT stream, not a projection (a casualties event fires at
the death; a survivors event fires per surviving enemy in an
end-of-battle sequence during the outro; the cap surcharge is just more
end events; the flat-turn future rides a team-gauge cause, shape only) ·
the bar GHOSTS (the solid fill stays the booked pool; the ghost commits
at the outro's end) · the post-turn screen is REMOVED (Game auto-advances
after the outro; a one-line "last turn" strip on the pre-turn screen from
turn 2; the encounter's last rows wait for §102) · the risk line STAYS on
the pre-turn screen (re-rendered after a redraw — a latent staleness the
audit found) + a ceiling tick on the battle bar. The cut:

- [ ] **96.5a — the chip rule.** The pool chip hides while a pre-turn or
  battle scene is mounted (driven from Game's swap, not from events); the
  collapse rule moves nothing below it. Eyeball exit; no sim.
- [ ] **96.5b1 — the loss-event model + the ghost (headless-first).**
  `chipRule.ts` gains the pure derivation (the immediate events for a
  death · the end sequence from survivors + fallen + reason; a cause is a
  unit card or a team gauge; phase immediate / end); a test pins Σ events
  per side = `turnCharges` under every rule pair × reason, and a
  mid-battle restore's opening ghost = the serialized fallen power (one
  public World read); `poolGauge` gains the ghost segment, the
  `33 (−7) / 40` value and the commit; the HUD paints from events, no
  motion. Prediction: `src/sim/World.ts` + `src/run/chipRule.ts` touched
  → the hook's fuzz smoke fires once, byte-identical; no snapshot bump.
- [ ] **96.5b2 — the orb + the shake + the end sequence (eyeball).** A DOM
  orb from the paying unit's card to its side's gauge per event (a team
  cause or no card → the gauge pulses in place); the shake only for
  PLAYER-pool losses above a UI-constant fraction of the max, never under
  `prefers-reduced-motion`; the survivors sequence plays in the outro and
  the BattleScene reports done, so Game's outro = max(900 ms, the
  sequence). No skip click; no extra win beat.
- [ ] **96.5c — the risk line.** Re-render after a redraw (the latent
  staleness); the ceiling tick on the battle bar at the same number.
- [ ] **96.5d — the post-turn removal.** Game buffers the last
  `turn:resolved` (the 65f deck-cue pattern) and hands it to the pre-turn
  scene as the "last turn" strip (turn ≥ 2); Game dispatches `advanceTurn`
  itself after the outro; `PostTurnScreen` + `PostTurnScene` + the 33 CSS
  rules deleted; ARCHITECTURE's ui tree + catalog notes. Run's
  `turn-outcome` phase STAYS (the fuzz bot drives it, `harness.ts:733`) —
  fuzz byte-identical by construction.
- [ ] **96.5e — the docs + the exit.** DESIGN §UI idioms gains the
  live-bar paragraph; ROADMAP demotes; the close. Exit = the user's
  per-step playtests (the §96 rhythm).

## Phase 97 — the tooltip system

**Charter:** one component, one live element, terminal idiom; hover /
focus / tap-toggle / a keyboard key; Esc, pointer-leave, focus-out
close it; flip-positioned (never shifts layout); rich content;
`aria-describedby`. Replaces the 19 native `title=` sites; the four
sole-source sites gain persistent labels. **Depends on:** §96 (built on
the shell). **Risk:** low-medium. **Decision points:** the keyboard
trigger key and whether it joins the rebindable registry. **Exit:** every
tooltip reachable by hover, focus, tap and key; zero `title=` in
`src/ui` + `src/render`. **Scope guards:** a tooltip is never the sole
channel for actionable information.

## Phase 98 — color redundancy

**Charter:** the "never color alone" idiom applied: a rarity text
label; map node-STATE shapes + a kind legend; status-pip and empower-`▲`
shape redundancy; the burn / bleed / poison hitsplat kinds split; the
deep-water depth tell. **The audit test is a desaturated screenshot** —
every surface must survive grayscale. **Depends on:** §96 (tokens).
**Risk:** low (small changes at single choke points: `UnitCard.ts:200`,
`MapScreen.ts:265-280`, `UnitOverlayLayer.ts:358-374`,
`fxRegistry.ts:214-216`). **Decision points:** ⛔ deep-water
coplanarity was an aesthetic call (`TerrainRenderer.ts:219-222`) — a
depth tell is a design re-decision. **Exit:** the grayscale test passes
on every surface. **Scope guards:** no palette change (Round 8); no
team-identity work (Round 7.5); no atlas change.

## Phase 99 — the reduced-motion seam

**Charter:** a `prefers-reduced-motion` block in `ui.css` over the seven
keyframes and the one infinite pulse; a channel-stripping filter in
`fxDescriptor()` (`fxRegistry.ts:238-240` — the single choke point all
three dispatch sites walk) driven by the same media query. OS-driven
now; the Round 8 setting flips the same gate. **Depends on:** nothing in
this round (pure + headless). **Risk:** low. **Exit:** the filter pinned
headless; the CSS block present; a reduced-motion browser shows no
shake, burst, sparkle or infinite pulse. **Scope guards:** no bloom
dial, no scanline toggle (both are settings — Round 8).

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
