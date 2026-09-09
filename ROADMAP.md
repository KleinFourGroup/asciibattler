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
sub-areas to phases to keep the numbering flat). Prior round's plan:
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

## Phase 95 — the i18n layer

**Charter:** the `t()` runtime + the sidecar locale layer for config
prose + the explicit-key string table for UI literals + the literal pin
+ provenance, English-only; the existing 13 events migrate while they
are few; the empower buff key renames under the authorized bump.
Headless-first — no UI surface is touched except the shared label
tables. **Why first:** ordering principle #1 applied to text; every
later phase extracts strings into a layer that already exists.
**Depends on:** the spec (signed). **Risk:** low-medium — the string
pin is the only new gate; the editors do not change (the sidecar's
whole point). **Decision points:** the literal pin's mechanism (lint
rule vs headless DOM scan — lint recommended) at 95d; the new empower
key name at 95f. **Exit:** the three sidecar pins green for `en` over
240 addresses; the UI helpers pinned headless; the literal pin green
with its baseline; the collision gone; **Run v45 → v46**. **Scope
guards:** no per-surface extraction here (that rides the phase that
first touches the surface); no second locale authored.

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
- [ ] **95d — the literal pin.** The guard on the forgetful path: a
  lint rule rejecting a string literal into a text sink
  (`textContent` / `innerText` / `title` / `placeholder` /
  `createTextNode`) outside the locale layer, a glyph-only allowlist,
  a per-file baseline for unmigrated surfaces, riding pre-commit. Exit:
  a literal added to a migrated file fails the tree. One commit.
- [ ] **95e — provenance.** The entry-object shape (`text` · `source`
  hash · `translator` · `reviewer`), the fuzzy pin over it, the
  `i18n:review` stamp script, the translators-credit extract. Exit: a
  hand-drifted fixture flags fuzzy. One commit.
- [ ] **95f — the empower key rename.** `"empowered"` → the new key in
  `daemons.json` + `empower.json`; **RunSnapshot v45 → v46**
  (`encounterEffects` serializes it; reject-stale); the EMPOWER_DISPLAY
  pin retargeted; the mechanic's surface strings through the table.
  Exit: the collision gone in config, snapshot and copy. One commit;
  fuzz:smoke on the hook.

## Phase 96 — the shells + the tokens

**Charter:** ONE modal shell (focus trap + restore, Esc, backdrop, ✕),
ONE chip base (the shared pulse; a flex column replacing the measured
pixel offsets), ONE button factory + one primary-action class, a
`Screen` base for show / hide / fade; the CSS tokens — `--color-*` from
the ~90 palette-annotated hexes, `--text-*` sizes in rem. **Why here:**
every later phase builds on the shells (the tooltip on the shell; the
palette and text-scale settings of Round 8 on the tokens). **Depends
on:** §95 (the strings these shells carry go through the table).
**Risk:** medium (touches every screen; eyeball-only). **Decision
points:** the chip column's ordering rule when a chip hides. **Exit:**
three modals, four chips, nine buttons on the shared idioms; zero raw
hexes in `ui.css`; every `font-size` a token. **Scope guards:** no
behavior change on any screen; no new chrome.

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
