# WORKLOG — Round 7 (Idioms)

Per-round narrative log (AGENTS "The planning stack"): findings, decision
rationale, rejected alternatives, scope changes, playtest verdicts land
here under the matching `## Phase N`; the ROADMAP stays a plan (one-line
mutations + a pointer back here). Created 2026-09-08 at the §94i close
(THE CASUALTY EXPERIMENT, §89–§94); the Round 7 kickoff's entry — the
spec artifact first, then the code-reality audit + the cut — lands next.
Prior round's log: [archive/post-88-worklog.md](archive/post-88-worklog.md)
(the casualty experiment — §89 the data phase → §90 the seam floor → §91
the casualty rule → §92 the rebalance → §93 ⛔ KEEP → §94 the encounter
list + the DP-tail finding + the signing), with its plan
[archive/post-88-roadmap.md](archive/post-88-roadmap.md) and spec
[archive/encounter-feel-spec.md](archive/encounter-feel-spec.md) beside it.

## Kickoff — Round 7 (Idioms)

Charter + dependencies: META-ROADMAP §Round 7. The spec conversation's
resolutions and the cut land below this entry once the spec is signed.

### The code-reality audit (2026-09-08, four parallel read-only sweeps at `730d805`)

Run BEFORE the spec conversation (AGENTS "Audit the spec against CODE
REALITY"). Every count below is measured, not estimated. Line refs are at
`730d805`. The one process note: the stale §94 build worktree (`wt94`,
detached at `d9675b6`, clean) was removed at the top of the session.

#### A. Config prose — the ~270 estimate is on the money, with one family missed

Every game data source is `config/*.json` (34 files) + a zod loader in
`src/config/`. Populated user-facing prose fields:

| Family | Fields | Count |
|---|---|---|
| events | `name` 13 · `pages[].text` 44 · `choices[].label` 65 | 122 |
| encounters | `name` 19 · `description` 19 | 38 |
| daemons | `name` 11 · `description` 11 | 22 |
| packets | `name` 8 · `description` 8 | 16 |
| characters | `name` 3 · `description` 3 | 6 |
| sectors | `title` 2 · `description` 2 | 4 |
| camps | `name` 5 · `description` 5 | 10 |
| statuses | `name` 10 | 10 |
| units | `name` 23 (the 7 neutral props have no `name` by schema) | 23 |
| abilities | `name` 24 | 24 |
| **the 10 charter families** | | **275** |
| layouts ⚠ NOT in the charter list | `name` 11 · `description` 11 | 22 |
| **total** | ≈2,165 words | **297** (286 unique) |

Families with NO prose (checked): rewards, nodemap, terrain, tiles, stats,
prices, difficulty, economy, empower, health, leveling, recruitment, sim,
spawn, selection, deck, objective, playback, keybindings, sector-map. No
`tips` family exists; map node kinds render bare glyphs (`MapScreen.ts:29-37`).

Findings that shape the locale-file decision:

- **57 authored strings NEVER reach the screen** — encounter / sector /
  camp / layout `description` + camp `name` are consumed only by the
  `tools/*-editor` dev tools. The layer should probably not route them
  (a spec call).
- **Zero interpolation placeholders in all 297 config values** — every
  splice happens at the render site. Config prose can be opaque whole
  strings; the interpolation problem is confined to the UI literals (§B)
  and the 12 derived sites below. A clean seam.
- **Only 3 duplicate values** across all 297, all event choice labels
  (`"Leave"` ×8, `"Keep digging"` ×3, `"Quit"` ×3) — a value-keyed dedupe
  would collapse them; keys must be positional/id-keyed.
- **Nine `tools/*-editor` serializers emit the prose keys positionally**
  (e.g. `tools/sector-editor/format.ts:85`, `tools/camp-editor/format.ts:63`)
  — wherever config prose moves, the editors must write it there too or
  they'll write it back into the JSON.
- **No i18n layer exists** — no `t()`, no locale dir, no dependency
  (`package.json`: simplex-noise, three, zod). The seeds a layer absorbs:
  `src/ui/statLabels.ts:13-25` (`STAT_LABELS`, 11 — its key ORDER is
  load-bearing, `UnitCard.ts:405-419`), `src/ui/chipLabels.ts:24-72` (the
  closest thing to a string table, headless-pinned), `GameOverScreen.ts:24-27`
  (`COPY`), `HUD.ts:52-57` (`OBJECTIVE_BUTTONS`), and the duplicated
  literal `'Uncharted Ground'` at `src/sim/layouts.ts:48` AND
  `src/ui/MapScreen.ts:70` (two constants, one string — a drift bug waiting).
- **The EMPOWER_DISPLAY precedent, exactly:** `src/render/statusDisplay.ts:78-90`
  (table + loud-magenta fallback `:52`) pinned by
  `src/render/statusDisplay.test.ts:49-78` — three guards (missing /
  fallback / orphan) all DERIVED from the live catalog (`shippedBuffKeys()`
  from `DAEMONS` + `PACKETS`), never a hardcoded key list. Sibling
  precedent: `tests/font-coverage.test.ts:36-46` (every `units.json` glyph
  must be in the subset AND the TTF). Both guard the same failure the
  literal pin must: config authored with no code edit.
- **Code-derived prose (the hard cases for a key layer), by difficulty:**
  `src/ui/abilityDetail.ts:34-105` (16 unit-bearing fragments — `N dmg`,
  `rng R`, `summons N×id`, `applies statusId`, raw ids spliced as words,
  numbers derived from live stats) · `UnitCard.ts:397-399` `buffKeyLabel()`
  (title-cases the raw key; "no second naming table to drift" — under i18n
  it must become one; 5 keys with zero authored prose) · `UnitCard.ts:448`
  `.toUpperCase()` on a display name (locale-unsafe) · `UnitCard.ts:405-419`
  `buffModsSummary()` · the status-chip meta (`×N · ±P/s · Ns`) ·
  `promotionDelta.ts:60-91` · three inline plural ternaries
  (`CacheOverlay.ts:208`, `CardListModal.ts:96`, `PromotionScreen.ts:86`) ·
  eight names-spliced-mid-sentence sites (`PreTurnScreen.ts:748,822,916`,
  `SectorClearedScreen.ts:79`, `MapScreen.ts:205`, `PostTurnScreen.ts:228`,
  `CharacterSelectScreen.ts:26`, `RewardScreen.ts:149`) · the glyph-prefix
  convention (`◈ ▤ ⌖ ▸ ⚠` prepended in ~15 template literals — inside or
  outside locale values is a spec call) · the fallback-to-raw-id idiom
  (`nameForArchetype`, `getLayout(id)?.name ?? id`, …) — a missing locale
  KEY degrading the same way is exactly what hid `emboldened`'s missing
  color for weeks, so the pin matters more than the fallback ·
  `HUD.ts:513` (a word choice branched inside a sentence) ·
  `describeEventCondition` (`src/config/events.ts:489-516` — UI copy
  living in a config module).

#### B. UI surfaces — ≈260 inline literals, all DOM

`index.html` is the whole markup (canvas + `#ui` mount + `#scanlines`,
`lang="en"` hardcoded). Four page-lifetime chips (`Game.ts:210-268`: bits,
pool, cache, sector-map) + one scene-scoped screen swapped on Run events
(`:273-336`). Twenty surfaces total; **no canvas-drawn prose exists** —
`FontAtlas` rasterizes glyphs only; the per-unit overlay
(`src/render/UnitOverlayLayer.ts`) is DOM positioned over the canvas.

Literal sites (a ternary of two strings = 2; config prose excluded):
`PreTurnScreen` 33 · `PortScreen` 23 · `UnitCard` 21 · `HUD` 20 ·
`PostTurnScreen` 20 · `abilityDetail` 16 · `chipLabels` 15 ·
`RewardScreen` 15 · `CacheOverlay` 14 · `src/config/events.ts` 13 ·
`statLabels` 11 · six files at 4–6 · seven at 2–5 — **≈133 static, ≈120
templated, ≈7 concatenation/plural, ≈260 total.** Non-UI `src/` is clean.

- **Data-as-label hazards** (raw enum/id rendered as text):
  `PreTurnScreen.ts:583` (`encounter.kind` verbatim), `BattleScene.ts:33-35`
  (`titleCaseTheme()` on the theme enum), the `abilityDetail` ids above.
- **Duplicated literals:** `'Roster'`/`'Your Roster'`/`'No units in your
  roster.'` ×3 files · `'Continue ▸'` ×2 · `'Buy'` ×2 · `'Close'` ×2 ·
  `'Engage'`/`'Focus'` in `HUD.ts:53-54` AND re-hardcoded at `:559`.
- **Copy inconsistency:** HUD gauges say `'You'`/`'Foe'` (`HUD.ts:605,615`)
  where every other gauge says `'Your Morale'`/`'Enemy Morale'`
  (`chipLabels.ts:69`); `UnitCard.ts:510` writes `'Power'` vs `STAT_LABELS.power = 'POW'`.

#### C. Input accessibility (DESIGN §Input accessibility) — two 78e-class holes remain

Every registry hotkey (`src/ui/Keybindings.ts`, defaults `config/keybindings.json`)
has a click route: speeds `0-3` + `Space` → `HUD.ts:190-211`; objectives
`E/F/H/T` → the four buttons + board left/right-click + enemy-card clicks;
`M` → the `⊞ map` chip + `✕ close`; `Esc` → ✕ + backdrop on all three
modals (the cache modal suppresses BOTH while `cacheOverflow > 0` — a
deliberate forced-keep, `CacheOverlay.ts:60,151,188`).

- ❌ **`Backquote` camera fit↔scroll toggle** (`Renderer.ts:55,548-551`) and
  ❌ **`WASD`/arrows camera pan** (`:57-63,553-555`): no click route, NOT in
  the registry (unrebindable, invisible to any future rebind screen),
  undocumented in UI. A pure-mouse player cannot change camera mode or pan.
- **The reverse gap — keyboard has no route at all:** zero `tabIndex`,
  zero `.focus()`, no focus trap/restore, no `:focus-visible` rule; eight
  primary controls are clickable `<div>`s — **map nodes** (`MapScreen.ts:245,271`,
  the run's primary navigation), the cache chip (`CacheOverlay.ts:72,83`;
  its sibling map chip IS a `<button>`), hand cards (`PreTurnScreen.ts:716-727`),
  recruit cards (`RecruitScreen.ts:97-105`), picker cards
  (`CardListModal.ts:124-136`), enemy compact cards (`HUD.ts:557-565`).
  28 real `<button>`s exist; 4 lack `type="button"`.
- **Hover-only information — 19 `title=` sites, zero touch/keyboard route**,
  four of them SOLE-SOURCE: the board status pip's name
  (`UnitOverlayLayer.ts:369` — the only way to name a pip), the empower `▲`
  marker's key (`UnitCard.ts:387`), compact-card level/power
  (`UnitCard.ts:256,261`), the boss forewarning (`MapScreen.ts:260`). Zero
  `pointerdown`/`touchstart`/`touch-action` anywhere in `src/`.
- **ARIA in the whole tree: 8 attributes** (3 `aria-pressed`, 3 `aria-label`,
  in `HUD`/`CacheOverlay`/`CardListModal`). No `role`, `aria-live`,
  `aria-modal`; the two `<select>`s are unlabelled.

#### D. Layout stability ("Y-coordinate hysteresis") — the class, enumerated

Known instances with in-repo workarounds (the precedent): `HUD.ts:446-461`
`positionCountdown()` measures the enemy pane ONCE at countdown entry (a
card added at `:541` mid-hold does not re-measure); `PromotionScreen.ts:176-181`
+ `ui.css:870-883` keep the delta block in the DOM behind `visibility`
("the playtest-caught layout shift").

- **The fixed-pixel chip column** — offsets hardcoded from measured heights:
  bits `top:20px` (`ui.css:1652`, `min-width:128px` "clears a 4-digit
  balance"), cache `top:76px` (`:1768`), map `top:132px` (`:1822`), pool
  `top:188px` (`:1699`), `.hud-hop { left: 200px }` (`:1631`, "measured").
  A 5-digit balance or any font change desynchronizes the column.
- **Digits growing** without `tabular-nums` (set at only 4 rules):
  `BitsOverlay.ts:69,83`, `PoolOverlay.ts:91`, `poolGauge.ts:26`,
  `CacheOverlay.ts:123,186`, `CardListModal.ts:266-267`; `HUD.ts:336-338`
  toggles `Hop N` ⇄ `Hop N · Turn M`; `PostTurnScreen.ts:127,193,214` `−N`
  vs `0`; `UnitCard.ts:569` `'MAX'` vs `XP n / need`.
- **Conditionally-shown blocks:** `PreTurnScreen.ts:580-585,609-614,744-761,943-958`
  and the hand row's 1⇄2-row wrap (`:704-707`); the compact card's
  `statusRow.hidden`/`empowerRow.hidden` toggled PER TICK
  (`UnitCard.ts:280,287,313-332,372-391`) → card height → `.hud-enemy-cards`
  wrap → the once-measured countdown; `PostTurnScreen.ts:161-180,196-202`;
  `RewardScreen.ts:97-103,181-191`; `PortScreen.ts:140,151-153,161,179,294-304`;
  `CacheOverlay.ts:188-210` (the ✕ REMOVED from the header while
  overflowing); `MapScreen.ts:202-207,216,219`; `SectorClearedScreen.ts:27-32`.

#### E. Idiom fragmentation — the census the unification pass fixes

- **Modal shells ×3:** `CardListModal.ts:81-169` (the reusable one),
  `CacheOverlay.ts:145-229` (re-creates `.roster-overlay`/`.roster-modal`
  by hand), `SectorMapOverlay.ts:87-108`. Three Esc handlers, three
  backdrop checks, two ✕ styles (`'✕'` vs `'✕ close'`).
- **Chips ×6 CSS families**; the four persistent chips repeat the same
  `position:fixed; left:20px; min-width:128px; border 1px #ffb000;
  padding 10px 18px` block (`ui.css:1652,1697,1766,1820`) and the
  identical `PULSE_MS = 450` + `pulse()` copy-pasted three times
  (`BitsOverlay.ts:36,87-94`, `PoolOverlay.ts:31,97-104`, `CacheOverlay.ts:42,127-134`).
- **Buttons:** `actionButton()` byte-identical in `PortScreen.ts:364-371`
  AND `RewardScreen.ts:227-234`; 28 inline `createElement('button')`; nine
  near-identical primary-action CSS rules (`.preturn-continue`,
  `.postturn-continue`, `.promotion-continue`, `.reward-continue`,
  `.gameover-button`, `.sectorcleared-button`, `.recruit-pass`,
  `.port-leave`, `.charselect-card`).
- **Screen shells:** 13 files re-implement `show()/hide()` + `screen-fade`
  by hand; `fade.ts` is the only shared piece; no `Screen` base.
- **Swap `<select>` ×2** (`RewardScreen.ts:201-225`, `PortScreen.ts:326-348`);
  **pool readouts ×3**; **empower `▲` chip renderers ×2** with duplicated
  title logic (`PreTurnScreen.ts:947-956`, `UnitCard.ts:383-390`).
- **CSS has zero custom properties beyond `--font-mono`** and zero media
  queries; ~90 literal hexes each carry the palette name in a trailing
  comment (`ui.css:542 #33ff00 /* TERMINAL_GREEN */` …) — a mechanical
  extraction to `--color-*` tokens. All 114 `font-size` declarations are
  absolute `px` (8.5 → 56; the 8.5px `.unit-card__status` at `ui.css:2258`
  is LIVE combat information).

#### F. Accessibility beyond input — what exists, what it would cost

Asked by the user at the kickoff ("any other accessibility-shaped content
appropriate to this round?"). Measured state:

- **Color-only meaning** (no colorblind provision anywhere; the palette
  is `src/render/palette.ts` but bypassed by `UnitOverlayLayer.ts:463-465`,
  `statusDisplay.ts`, every `TerrainRenderer.ts:554-588` terrain hex, and
  the ~90 CSS hexes — a palette swap today is four TS tables + the
  stylesheet):
  - **Team identity is color-ONLY on the board** — both sides draw the
    same glyph pool (23 enemy archetypes include the player's own ids); an
    ally `M` and an enemy `M` differ by green vs red alone
    (`spriteColor.ts:14-16,31-63` says so in comments). A shape channel
    needs a new per-instance field through `SpriteRenderer.ts:261-274`;
    the atlas is 47/48 (`glyphs.ts:34`). LARGE.
  - Status pips (`UnitOverlayLayer.ts:436-445,367-370`) and the empower
    `▲` markers (`UnitCard.ts:383-388`, all five keys the same glyph) —
    identity by hue alone; held-body tints (`fxRegistry.ts:228-231`) for
    frozen/panic/blind/confusion, two of which collide with the neutral
    and camp TEAM colors.
  - **Rarity has no text anywhere** — four background tints at alpha
    ≤0.16 (`ui.css:562-582`). Trivial to label (`UnitCard.ts:200,246`).
  - Map node KIND is glyph-redundant (`X Z ! * $ ?`) but there is **no
    legend** and no non-boss tooltip; node STATE (current/frontier/visited/
    locked — "which nodes can I click") is color + cursor only
    (`ui.css:419-458`).
  - `deep_water` is deliberately COPLANAR with `shallow_water`
    (`TerrainRenderer.ts:219-222`) — the passable/impassable distinction
    is `#1F5B7A` vs `#0e3047`. Ice and sand share the floor band with no
    non-hue tell. One-line change, but an aesthetic re-decision.
  - burn/bleed/poison share one hitsplat kind (`fxRegistry.ts:214-216`)
    while having three distinct SOUNDS — audio discriminates DoTs more
    finely than the visuals; an audio-off player loses it.
- **Motion / flashing:** zero `prefers-reduced-motion` (or any media
  query); 60 animation/transition declarations + 7 `@keyframes`; one
  INFINITE pulse (`ui.css:2142` `.hud-objective-btn.is-armed`); camera
  shake (`Renderer.ts:513-545`, heaviest 0.16/0.35s catapult); bloom
  strength/radius/threshold are `const`s inside the factory
  (`PostProcess.ts:81-85`, no runtime setter); scanlines are static CSS
  (spatial, not temporal — `ui.css:279-293`) and **deliberately rake the
  DOM text too** (`z-index:1000` above `#ui`, `:264-266,283-285`) — bloom
  does NOT touch DOM. **The FX system has ONE choke point:** all three
  dispatch sites (`BattleRenderer.ts:1272-1274,1327-1351,1363-1380`) walk
  the same `FxDescriptor` from `fxDescriptor()` (`fxRegistry.ts:238-240`)
  — a channel-stripping filter there gates shake/burst/sparkle/tracer for
  every site, pure and headless-testable. The aura A/B switch
  (`BattleRenderer.ts:357-362`, `window.__auraFx` read live per frame) is
  the only existing runtime FX toggle and proves the pattern.
- **Timing pressure: already solved better than most autobattlers** —
  pause (`Space` + button) at all times, **orders drain while paused**
  (`BattleScene.ts:281-286`), 0.5× speed shipped. The one timed window is
  the 5 s pre-battle countdown (`config/playback.json`; the schema allows
  0 but nothing exposes it). No default-speed preference (Round 8).
- **Audio:** `setMasterVolume`/`setMuted` (`AudioPlayer.ts:216-232`) have
  ZERO callers — the game plays at 0.5 master with no in-app mute. No
  audio-only information (the fxRegistry's one-key = visual + SFX rule
  holds; `summon_raise` is the only sound-only descriptor and the spawn
  fade carries it).
- **Screen reader:** the 8 ARIA attributes above; no live regions, no
  roles, no `alt` (no `<img>`). An honest read: a WebGL glyph board is
  not a screen-reader target; semantic buttons + focus order are the
  achievable floor.
- **The structural gate:** almost every TOGGLE above needs a settings
  surface + persistence, and neither exists (no Settings file in
  `src/ui/`; the only `localStorage` use is `src/dev/traceStore.ts`).
  META-ROADMAP puts both in Round 8. What Round 7 CAN do without a
  settings surface: the redundancy fixes (they're idioms, not toggles),
  the OS-driven `prefers-reduced-motion` block, the FX gate SEAM (driven
  by the media query now, by a setting later), the CSS token extraction
  (color + size) that makes the Round 8 palette/scale a one-table swap,
  and the semantics/focus floor that rides the modal-shell unification.

#### G. The sound registry — the plan holds byte-for-byte; it is NOT independent

`plans/sound-registry.md` (audited 2026-08-16 at `50c2c74`): nothing
implemented; `src/audio/` is still only `AudioPlayer.ts`; no audio commit
since the plan. The 7 closures are verbatim (`Game.ts:342-347`,
`BattleScene.ts:150-171`; the plan's line refs drifted ~17/~1 lines).
FX_REGISTRY: 15 `sound:` entries, three driver sites, the resolve-not-
coverage blind spot real (`fxRegistry.test.ts:112,138`). Direct UI
`play()` sites: 36 across 14 files (plan said ~35/14).

- **The event catalog is 47 keys, not ~45, and the plan misses the new
  ones:** `run:poolChanged` (`events.ts:509`, §94e — a plausible cue in
  the `run:bitsChanged` family, undispositioned), `pools:chipped` (`:818`),
  `turn:resolved.reason` (§91d). Live proof of the plan's own thesis: a
  new event shipped silent and nobody noticed.
- **`unit:died` grew `archetype/level/power/summoned`** (§94d) — the
  `audibleDeath` predicate is unaffected but could now disposition a
  stamped summon's death differently (§91e2: "a conjured body is not a loss").
- **Coupling:** the sector-cleared sting rider IS `Game.ts:347`, the
  registry's own line; the run-end stats screen and the registry both
  land on `GameOverScreen.ts` (`:73` plays `click`; a run-end sting would
  collide with `run:victory`/`run:defeated`). "Rides here as the cheap
  tail" (META-ROADMAP) undersells it — sequence the registry WITH those
  riders, not after.

#### H. The carried riders — three need re-disposition before the spec quotes them

| # | Rider | Carrier | Code reality | Verdict |
|---|---|---|---|---|
| 1 | Empower naming collision | `TODO.md:76-87` | key at `config/daemons.json:15` + `config/empower.json:5`; display `statusDisplay.ts:79` | LIVE. Renaming the buff KEY is a Run-snapshot bump + the EMPOWER pin; renaming the MECHANIC's surfaces is strings only — the i18n pass is the natural moment |
| 2 | Display-color hoist | `TODO.md:89-96` | `statusDisplay.ts:29,52,56,78,89`; 6 pins in `statusDisplay.test.ts` | LIVE; a zod loader + retarget the pins; pairs with the CSS token extraction (§E) |
| 3 | Aura-FX jury | `TODO.md:98-105` | `BattleRenderer.ts:105-112,357-372` | LIVE; scrub or graduate — graduation needs the Round 8 settings surface |
| 4 | Sector-cleared sting | `archive/post-60-worklog.md:1719`; `plans/sound-registry.md:55` | `Game.ts:345-347` | LIVE; one `SoundKey` + `.wav` + one table row — the SAME line as §G |
| 5 | Event screen pool gauge | `TODO.md:344` | `PoolOverlay.ts:1-25` (page-lifetime, every screen, §94e) | **✅ ABSORBED by §94e** — only the "full gauge vs chip on the event screen" question remains |
| 6 | RNG / `rng` label | `TODO.md:177` | `statLabels.ts:16`; **`abilityRow` moved** to `UnitCard.ts:583` + six push sites in `abilityDetail.ts` | LIVE, citation stale; exactly the literal-pin class |
| 7 | HUD stat line | `TODO.md:182` | **`formatStats` DELETED at `5a52962` (Q6)**; compact cards carry no stat block (`UnitCard.ts:232-238`); POW sits in its own row on the full card (`:214-218`) | **⛔ STALE** — retire or re-word |
| 8 | Run-end stats screen | `TODO.md:348` | `Run.fallenLedger` (`Run.ts:975,1310`, v45); `GameOverScreen.ts` is 80 lines, one component for both variants | LIVE; a pure aggregator over `FallenRecord[]` + a stats body; no sim, no bump |
| 9 | AoE-status enemies (banshee) | `TODO.md:343` | `config/units.json:475-505`; `wail` at `config/abilities.json:447` — **impact-only fx, no release/travel phase; `grep projectile config/abilities.json` → 0** | The "lacks projectiles" observation is literal. A `release` phase + projectile fx key is config + fxRegistry; any range/duration RETUNE is balance-adjacent and the charter says no sim/board work — **scope call at the spec** (`hex` at `:391` is the sibling case) |

Riders the TODO tags "Round 7" that the charter's "never touches sim"
guard pushes out: the PRIEST parity breach + the kit watches
(`TODO.md:338,347` — kit/price → Round 9), the DP-tail redesign
(`TODO.md:337` → the ARM, Round 9). The Round 8 settings items the audit
touched (mute/volume, default speed, colorblind palette, aura graduation,
rebind UI) stay in Round 8; Round 7's job is to leave each one a
one-table/one-seam change.

#### The decision points the audit surfaces for the spec session

1. **The locale-file shape** (the charter's ⛔): the audit's datum is
   that config prose is placeholder-free and only 3 values repeat, so
   either shape works on the data; the tie-breaker is the nine editor
   serializers (sidecar = editors keep writing `name` where they do and a
   build step lifts it; `textKey` = every editor grows a key field).
2. **Route the 57 never-rendered strings, or leave them editor metadata?**
3. **`layouts` joins the charter families** (+22) — recommend yes; its
   `name` renders at three sites.
4. **Team-identity shape channel: in, out, or Round 8 beside the
   colorblind palette?** A palette swap alone cannot fix same-glyph teams.
5. **The `wail`/`hex` rework scope** — projectile fx only (this round) vs
   a retune (a board question).
6. **Which riders retire:** #5 (absorbed), #7 (stale).

### The spec conversation (2026-09-09) — twelve resolutions, all user-signed

The signed record is [round-7-spec.md](round-7-spec.md) §Kickoff
resolutions; this entry holds the rationale and the rejected
alternatives. The walk ran in the same session as the audit, one
question per turn with a recommendation attached, plain-message
shape-lock (AGENTS: never a same-turn dialog).

- **Color rule → "never color alone" + the grayscale test.** Three
  candidate rules were distinguished, not conflated: never-color-alone
  (structural, scales to any category count), a CVD-safe palette (a
  palette constraint that fails past ~5 categories and can't rescue the
  red/green team pair under the two most common deficiencies), and
  grayscale-safe (luminance carries identity — the strictest palette
  rule, and it fights the neon aesthetic where everything blooms at
  similar brightness). The first is the idiom; the desaturated
  screenshot is the lint because passing it passes every deficiency;
  the palette is Round 8 comfort. Untested hunch, deliberately not
  relied on: `#33ff00` is far brighter than `#ff3131`, so team identity
  may partly survive grayscale — bloom flattens luminance.
- **Tooltip system → yes.** Native `title` is hover-only, delayed,
  unstyled, dead on touch and keyboard. The user's framing: on-demand
  for clicks and keyboard focus, and some visual flair. Added rule: a
  tooltip is never the sole channel for actionable information.
- **Camera → dev-gate now, A/B in 7.5.** D4's header (archive
  post-c1-roadmap "dev fit + game scroll") shows scroll was meant to be
  the GAME mode; fit became the default by inertia. The user recalled
  the original A/B and had forgotten it. The test rides the unit rework
  because the modes are a glyph-size lever.
- **Team identity → Round 7.5 — Units.** The user's framing: too many
  special rules to get something 90% working and brittle. The
  interstitial won over a late Round 7 phase because the rework needs
  its own audit of what each rule (§79a/d/d2, §91-pre2) was defending
  against, and Round 7's exit stays clean. Naming: the user's `.5`
  (the `<phase><letter>` form is the step address). Renumbering
  REJECTED (round numbers are cited everywhere; the phase counter is
  the ordering key). Slugs + a `\cite` REJECTED (needs a resolver pass
  over docs and commits; not worth it for the remainder). The root
  cause is scheduling: every interstitial so far appeared because a
  round's close revealed the next charter's premise was unbuilt — so
  the macro re-audit joins the close ritual.
- **Locale shape → the sidecar; `textKey` rejected for config prose.**
  Durability argument: who authors what. English prose is one person
  through editors, in-repo, English-only for a long time — the sidecar
  keeps the source of truth where authoring happens and makes every
  other locale a derived artifact with drift detection. `textKey` buys
  durable keys by construction but moves the English out of the
  config, makes nine editors write two files, and opens the reverse
  drift (a renamed key orphans its text). UI literals get explicit
  keys because they have no entity id and DO share strings across
  sites. Positional joint found: event pages are a keyed map (stable
  addresses), event choices a positional array — choices gain an id.
  Interpolation: `Intl` built-ins, no dependency (ICU MessageFormat
  rejected as a heavy dependency for three plural sites).
- **Provenance → per-entry objects with a source hash.** The user's
  ask: who wrote / who translated / which native speaker signed off and
  when, as a volunteer path. Falls out of the fuzzy pin (which needs
  the stored source anyway). The reviewer step is not redundant for
  register — puns and the terminal idiom are where machine translation
  is weakest — and it is the cheapest community-ownership hook.
- **57 never-rendered strings → out** (editor metadata; the wrapper is
  a one-word change if one ever lands on screen).
- **Layouts → in** (11 names, three render sites).
- **wail/hex → split** at the presentation/board line.
- **Riders #5 and #7 → retired.**
- **Reduced-motion seam → in** (CSS block + the fxDescriptor filter,
  media-query-driven now, setting-driven in Round 8).
- **Empower key rename → the KEY renames; the user authorized the
  snapshot bump** (the recommendation had been strings-only under the
  no-snapshot guard; the user chose to be done with it). Scope guard
  amended to "one authorized bump".
- **Sound registry → last phase, with the sting rider inside it** and
  the stats screen's sting dispositioned there.

## Phase 95 — the i18n layer

### 95a — the runtime + the events family (2026-09-09)

**Step zero held:** the Run snapshot's event cursor is `{eventId, pageId}`
(`Run.ts:594`); the choice index lives only in the transient
`chooseEventOption` command. So a choice `id` is config-only — no bump.

**The mechanism moved once against the spec's sketch.** The spec imagined
`prose()` capturing its own address at parse time; zod is **4.4.3**, and
zod 4's refinement/transform context exposes no `path` (zod 3's did). The
alternative that shipped keeps the spec's property — the declaration is
the manifest — by a different route: `prose()` = `z.string().min(1).meta({prose:true})`
(the meta survives chaining; read back through `z.globalRegistry`), and
`prosePatterns(schema)` walks zod 4's def tree (`_zod.def.type` +
`shape / element / valueType / innerType / options / in / getter`) to
derive the field paths; `proseSites(family, schema, data)` then walks
the parsed data along them. A probe over the events grammar in miniature
returned exactly `[].name · [].pages.*.text · [].pages.*.choices.[].label`
before a line of production code was written. The walker THROWS on a def
type it does not know — a new zod shape is dispositioned in one switch,
never silently skipped — and on an address collision or a separator
inside a segment.

**One bug, caught by the first live extract:** the event condition
grammar is recursive (`not` → condition, via `z.lazy`), and the first
walker recursed forever (a stack overflow on `npm run i18n:extract`, not
in the synthetic tests — which had no recursive shape). The cut is a
per-PATH stack (a schema on the current descent is not re-entered; the
same schema at two sibling positions is walked at both) plus a depth-64
backstop for a lazy that mints fresh schemas. Pinned by a recursive
fixture in `prose.test.ts`.

**Addresses:** `events.<event-id>.name` · `events.<event-id>.pages.<page-id>.text`
· `events.<event-id>.pages.<page-id>.choices.<choice-id>.label`. Arrays
key by the element's `id` when present, else the index. The 65 shipped
choices were stamped (`stampChoiceIds` in the editor's `format.ts` — a
slug of the label, de-duplicated per page, never rewriting an existing
id) THROUGH the formatter so the §74h byte-fidelity pin holds by
construction; the editor stamps at export from now on; the schema rejects
a duplicate id within a page. Extract: **122 addresses, 0 positional**
(13 names + 44 texts + 65 labels — the audit's count exactly).

**The `en` pins are the derived-artifact shape:** `locales/en/events.json`
is a MEASUREMENT of the catalog; `tests/i18n-en-extract.test.ts` fails
on a missing / orphan / stale address and names the fix
(`npm run i18n:extract`). A non-`en` locale is exercised by a fixture
in `locale.test.ts`: a registered sidecar resolves in place; a missing
entry THROWS. Resolution is once, at catalog load (a locale switch is a
Round 8 setting and reloads the page).

**Deferred to 95c/95e, noted at the seam:** `LocaleEntry` already
accepts `string | { text }` so 95e's provenance object is not a format
bump; `t()` for UI literals is 95c and shares nothing with the config
walkers except the locale runtime.

### 95b — the other families (2026-09-09)

**One seam for every loader:** `loadProse(family, schema, data)` (locale.ts)
applies the locale and returns the registry descriptor; each loader
exports `<FAMILY>_PROSE` right after its parse, and `families.ts` lists
the ten. The wrapper-object catalogs (daemons / packets / characters —
`{ daemons: [...] }`) register the INNER array with `z.array(ElementSchema)`
and resolve on the raw parsed list BEFORE the `normalize*` map copies
the fields, so the addresses read `daemons.<id>.name`, not
`daemons.daemons.<id>.name`, and the resolved values reach the exported
normalized objects. The record catalogs (units / abilities / statuses)
use the record key as the segment (`units.mercenary.name`); the
combatant-vs-neutral union walks both options and only the combatant
carries a name.

**Two schemas outside src/config carry `prose()` now:**
`src/sim/effects/schema.ts` (ability name) and
`src/sim/effects/statusSchema.ts` (status name). That is the sim
importing `src/i18n/prose.ts` — a zod string with a metadata tag, no
runtime behaviour, no render/ui import; the sim/render seam is intact.
The alternative (re-wrapping the sim schemas from the config loaders with
`.extend`) risked dropping the sim schemas' refinements under zod 4 and
was not taken.

**The walker's loud failure fired once, as designed:** the encounter and
camp grammars validate archetypes with `z.custom<Archetype>(…)`, a def
type the walk had not dispositioned. `custom` is opaque and cannot carry
prose (a prose field is declared with `prose()`, never wrapped in a
custom), so it is a leaf now alongside `date / nan / symbol / void /
never / template_literal`; `tuple` and `intersection` are walked. Pinned.

**Count correction — a second-hand claim caught:** the kickoff audit
said 57 strings never reach the screen and the ROADMAP cut wrote "240
addresses" from it. The never-rendered set is encounter `description`
(19) + sector `description` (2) + layout `description` (11) + camp
`name` (5) + camp `description` (5) = **42**, so the live total is
297 − 42 = **255**, and the extract measured exactly that:
events 122 · encounters 19 · daemons 22 · packets 16 · characters 6 ·
sectors 2 · statuses 10 · units 23 · abilities 24 · layouts 11. Every
per-family figure matches the audit's table; only its subtraction was
wrong. Camps is therefore NOT a prose family at all (nothing of it
renders) and is not registered. The session self-report had flagged the
audit's line-level claims as unverified second-hand; this is the first
one the instrument corrected.

### 95c — the UI string table (2026-09-09)

**Two mechanisms, matched to the two seams** (the spec's call): config
prose is the sidecar (English inline, other locales derived); UI
literals are the OPPOSITE case — they live in code with no entity id and
share strings across sites — so their English is the SOURCE, in
`locales/en/ui.json`, under explicit namespaced keys (`stat.power`,
`roster.empty`, `cache.overflow`). `t(key, params)` (src/i18n/ui.ts)
resolves through the same `activeLocale()` as the config layer.

**Plurals and numbers on the browser's `Intl`, no dependency.** A plural
entry is an object keyed by CLDR category (`one` / `other` / …, `other`
required), selected by `Intl.PluralRules(locale).select(count)`; a
number param is formatted by `Intl.NumberFormat(locale)` — so a German
table renders `1.234` where the English renders `1,234`, from the same
call (pinned). ICU MessageFormat was rejected at the spec as a heavy
dependency for three plural sites; this covers the three (the cache
overflow banner, the card-list title, the promotion heading — the last a
whole-string swap, `Level Up!` vs `{count} Promotions`) without a parser.
A word that changes with a branch is two whole entries, never a
fragment. Placeholders `{name}`; a missing param, an unknown key, a
plural without a numeric `count`, or a non-en table lacking a key all
THROW (the empower-pin discipline).

**The pins are a static scan, since the table is source, not derived**
(`tests/i18n-ui-keys.test.ts`): every `t('…')` literal in `src/` exists
in the table; every table key is referenced (an orphan is a translator's
wasted work); no call passes a computed key (the scan must see every
key — a rule, and a pin); every non-en `ui.json` has exactly the English
key set. The rule this buys: a key typo or a rename under its callers
fails `npm test`, never a player's screen.

**What migrated (65 call sites, 49 keys):** `STAT_LABELS` (values from
the table; the object's KEY ORDER stays in code — it is the display
order, `Object.keys` iteration, and `STAT_KEYS` mirrors it) ·
`chipLabels` (the six chip lines, two risk titles, four power clauses,
three pool names — its headless wording pins pass unchanged) · the
game-over `COPY` · the HUD `OBJECTIVE_BUTTONS` + the enemy-card hint
that had re-hardcoded `Engage`/`Focus` (now `{engage}`/`{focus}` params
from the same keys) · the roster button trio (`Roster` / `Your Roster`
/ `No units in your roster.`, three files → three keys) · `Continue`
(two screens; the `▸` glyph stays OUTSIDE the value at the site, per the
spec's glyph rule — §96's shared primary-action class is where it
becomes a `::after`) · `Buy` ×2 · `Close` ×2 (aria-labels) · the three
plural sites.

**A sim constant carrying prose, deleted:** `PROCEDURAL_MAP_NAME` in
`src/sim/layouts.ts` ("Uncharted Ground") had exactly three consumers,
all view code (the battle banner, the pre-turn map line, and MapScreen's
own duplicate `UNCHARTED_LABEL`). It is the one key `map.uncharted` now;
R3's guarantee (one string, no drift) holds through the key, and the sim
holds no display prose. The layouts.ts comment records the move.

**Touch-once, bent knowingly:** the duplicated-literal sites live in
files (PreTurnScreen, MapScreen, RecruitScreen, PortScreen, …) that
§96–§100 will open again for their full extraction. The cut named these
literals explicitly (user-signed) because unifying a string that lives
in three files is the string table's proof of value; each touch was one
line. The §95d baseline will carry those files as "partially migrated"
until their phase.

### 95d — the literal pin (2026-09-09)

**The mechanism call (the spec left it to this cut): a test, not a lint
rule.** The pre-commit hook runs typecheck + `npm test` and never ESLint,
so an ESLint rule would give editor feedback but not the GATE; the pin
must ride the forgetful path. `src/i18n/literalScan.ts` walks the
TypeScript AST (the compiler API — already a devDependency; imported
only by the test and the script, never by app code) and
`tests/i18n-literal-pin.test.ts` holds every scanned file to its count in
`tests/i18n-literal-baseline.json` EXACTLY — a ratchet: a new literal
fails; an extracted one fails until the baseline is lowered in the same
commit (`npm run i18n:baseline`), so a count can never creep back up.
`--list` prints every literal with file:line — the extraction worklist
§96–§100 work from. The round's exit is an empty baseline.

**What counts as prose (deliberately simple, tuned against the live
list):** two letter-words with whitespace between them, or a single
Capitalized word with optional trailing punctuation/glyph. Lowercase
tokens (classes, ids, keys, event names), ALL-CAPS, digits and
glyph-only strings never match. Template expressions are scanned on
their static parts joined (so `Boss: ${name} — level ${n}` counts) and
their holes are walked (a nested `? 'Yes' : 'No'` counts).

**Exclusions found by running the scan, not by imagining them.** The
first live list (153 hits) had four false-positive classes; each got a
STRUCTURAL exclusion rather than a marker: css class lists (assignment
to `className`, any `classList.*` / `querySelector*` call, and the
shape rule "all lowercase tokens, one hyphenated"); dev-facing messages
(`new Error(…)`, `console.*`, callees named `fail` / `invariant` /
`assert*`, and object properties `message` / `fragmentShader` /
`vertexShader`); css values through `style.*` assignment and
`style.setProperty`; and the line marker `// i18n-ok` / the file marker
`i18n-ok-file` for the residue — four sites: a GLSL template constant,
the font-subset range table (a build table), the two `KeyboardEvent.code`
prefixes, the font-family name. A `KEYBOARD_CODES` allowlist covers the
DOM codes that are Capitalized words (`Escape`, `Space`, …).

**The baseline: 117 literals in 22 files** (PreTurnScreen 24 · PortScreen
17 · PostTurnScreen 16 · HUD 10 · `describeEventCondition` in
`src/config/events.ts` 9 — the audit's "UI copy in a config module" —
· SectorClearedScreen 6 · CacheOverlay 6 · UnitCard 5 · RewardScreen 5 ·
UnitOverlayLayer 2 · promotionDelta 3 · the rest 1–2). The audit's
"≈260" counted literal SITES incl. every ternary branch and every
templated fragment; this counts prose-SHAPED literals after the
exclusions — a different, narrower definition on purpose: the pin's job
is to catch a new label, not to re-derive the audit.

**A known gap, accepted:** a single lowercase word beside a hole (`${n}
unit`, `${n}ms`) is not prose-shaped; the plural-suffix idiom
(`unit${n === 1 ? '' : 's'}`) hides behind it. Two of the three shipped
instances were migrated at 95c; the per-surface checklist (§103) covers
the class by eye. Widening the heuristic to catch it would flag every
`${w}px` — the trade was not worth it.

### 95e — provenance (2026-09-10)

**The shape is the spec's, verbatim** (`src/i18n/provenance.ts`):
`{ text, source, translator: { who, on }, reviewer: { who, on } }`, where
`source` is the hash of the English at translation time and `on` is an
ISO date. One widening: a UI table entry's `text` may itself be a plural
object, so the hash canonicalizes an object source as sorted-key JSON and
a string as itself. English carries no provenance (git is its authorship)
— `locales/en/*.json` stays flat strings and the en pins are untouched.

**The hash is the format contract, so it moved to `src/core/fnv1a.ts`
and is PERMANENT** (the rngStreams discipline): a change to the function
or its 8-hex rendering would fuzzy every entry of every shipped locale at
once. It was the 53b trace fingerprint's `fnv1a` in `src/dev/configHash.ts`
— which imports all 32 config JSONs, and the locale runtime sits UNDER the
config loaders in the import graph; the move keeps that graph clean and
configHash re-exports it (its test vectors still read from there).

**Four checks, one function, one assertion.** `auditLocale(english, file)`
returns `missing / orphan / unstamped / fuzzy` — `unstamped` is the new
category the spec's sketch implied but did not name: a plain-string entry
(or an object without `source`) proves nothing about which English it was
translated from, so a shipped locale fails on it exactly as on fuzzy. The
same function runs under both disk pins (the ten config sidecars in
`tests/i18n-en-extract.test.ts`, `ui.json` in `tests/i18n-ui-keys.test.ts`
— vacuous until a locale ships, enumerating `locales/<lang>/` directories)
and over the hand-drifted fixture in `provenance.test.ts` that is the cut's
exit: an entry stamped against "Old Gamma" reads fuzzy against "Gamma".
Each disk pin asserts the whole four-list object in ONE `expect` — the
first probe run stopped at `unstamped` and never showed the fuzzy entry
that was the point.

**The runtime survives a fuzzy entry; the pin keeps it out.** `resolveProse`
and `t()` fall back to the English for a fuzzy entry (the translation no
longer describes it), prefixed `⚠ ` under Vite's DEV so a dev build shows
the drift (`FUZZY_MARKER`; empty otherwise; `import.meta.env` is guarded
for tsx, where it is undefined), and record it in one census
(`fuzzyEntries()`: config addresses + `ui.<key>`). An UNSTAMPED entry
resolves as-is at runtime — the deliberate asymmetry: the runtime has no
English to prefer over a translation nobody stamped, and the pin is the
gate. The missing-entry THROW is unchanged.

**`npm run i18n:review` is the ONLY writer of stamps — two roles.** The
spec named the reviewer stamp; the probe of the workflow showed the
translator stamp has to come from the same tool (nobody hand-computes a
hash), so `--role=translator` stamps `source` + `translator` on every
unstamped or fuzzy entry in scope and DROPS any reviewer (a re-translation
needs a fresh sign-off), while `--role=reviewer` (the default) stamps
`reviewer` on CURRENT entries only and lists everything else with exit 1.
Three guards found by running it: (1) an entry whose text still EQUALS its
English is skipped and listed — the scaffold nobody translated is exactly
the hazard of a bulk stamp; `--address` names one to stamp anyway (a
proper noun the same in both languages); (2) missing addresses are
SCAFFOLDED as plain English, unstamped, and a missing file is created that
way — so "copy the en file" is not even needed; orphans are listed, never
deleted (the extract's rule); (3) explicit addresses are validated against
every file in scope BEFORE anything is written (the first cut validated
after the loop and would have created an empty file first). `en` is
refused. The run ends by printing the locale's credits.

**The credits extract is a pure fold over stamps** (`creditsOf`) with
`localeCredits()` (credits.ts) running it over the REGISTERED tables —
config sidecars + UI tables, `en` skipped — so the Round 8 credits screen
reads it in the browser with no file access; the script runs the same
fold over the files on disk.

**The end-to-end probe, on a scratch `locales/xx/` (deleted after):**
translator scaffold → 10 statuses + 45 ui entries, plain, unstamped ·
two hand-translated → re-run stamped 2, skipped 8 "still equal to the
English" · the `source` of one stamped entry hand-drifted to `00000000`
→ the disk pin FAILED with `fuzzy: [statuses.burn.name]` + the 8
unstamped in one diff, and the ui pin with the 45 unstamped · the
reviewer role: 1 stamped (the current entry), 9 blocked (1 fuzzy + 8
unstamped), exit 1 · `--address=statuses.poison.name` signed that one
entry, exit 0 · `--lang=en` refused · an unknown `--address` refused
before any write · `--dry` wrote nothing.

**Count correction:** `locales/en/ui.json` is **45 keys**, not the 49 the
95c commit and the HANDOFF cursor carried; the table has not changed since
95c, so 49 was that commit's own miscount (the key-scan pin holds the true
set). Recorded at 45 from here.

### 95f — the empower key rename (2026-09-10)

**The decision point, resolved: `honed`.** The collision (TODO, user-flagged
at the 78d eyeball): the pre-turn mechanic is EMPOWER everywhere in code and
config (`grantEmpowers` · `empowersPerTurn` · `turn:unitEmpowered` ·
`EMPOWER_DISPLAY`), and the Idol of Mars buff it grants was keyed
`"empowered"`, so "an empowered card" meant two things. The mechanic keeps
its name; the BUFF key renames. Four candidates were laid out against the
sibling keys' rule — describe the effect on the unit, not the source
(`warded` / `shielded` / `hyped` / `overclocked`) — with the status table's
`emboldened` / `inspired` ruling out the courage family: **`honed`**
(recommended — a participle like its siblings, one word on a chip, reads for
all three damage stats: a honed blade, aim, spell), `wrathful` (Mars
flavour, but a temperament), `favored` (names the source, says nothing of
the effect), `sharpened` (honed, longer, melee-leaning). The user endorsed
`honed`.

**Step zero held on both predictions.** `RUN_SCHEMA_VERSION` was 45 at
`Run.ts:485` and the key does serialize inside `encounterEffects` (and
`pendingEncounterEffects`), so the bump is real: **45 → 46**, reject-stale
(the ONE bump Round 7 authorized; no migration — a v45 save's Mars stacks
would resume under a key no table knows). The EMPOWER_DISPLAY coverage pin
is catalog-derived (daemon hooks + packet `applyBuff`), so retargeting it
was renaming the row, and it now also asserts `empowered` is RETIRED from
the catalogs and `honed` is present.

**The surface string was the LABEL, and it was the key.** `buffKeyLabel`
(UnitCard.ts, 78d) capitalized the buff key — "no second naming table to
drift" — which is exactly the untranslatable shape the i18n layer exists to
remove. The buff has no `name` in config (adding one would put prose under
the positional `rules[]` array the sidecar addressing avoids), so the label
lives in the UI table under `buff.<key>` (five literal keys, so the key-scan
pin sees them) and RIDES THE EMPOWER_DISPLAY ROW as `label`: one table
drives color, marker eligibility and label, and the existing catalog-derived
coverage pin is now label coverage too — the drift the old comment feared is
caught by the pin instead of avoided by construction. `empowerLabel(key)`
falls back to the capitalized key for a key outside the table (the
make-it-visible discipline), which the pin makes unreachable for a shipped
key. The two empower strings in PreTurnScreen (`{name} is silent — no
empower this turn` · `click a card to empower`) went through the table; the
redraw siblings one line away were LEFT for PreTurnScreen's own extraction
(touch-once, the 95c bend not repeated) — baseline **23 → 21** (the 95d
entry above says PreTurnScreen 24; the committed baseline said 23 — the
artifact is the count, the prose was off by one).

**Fixtures:** the two that mirror the config shape (`daemons.test.ts` BUFF,
`empower.test.ts` BUFF) renamed; the sim-level fixtures that use
`'empowered'` as an arbitrary K1 key (Unit / statusReadout / statusBehavior /
sensors / snapshot-roundtrip / the Run K1 store tests) stay — the collision
is a player-facing one, and an arbitrary effect key in a sim test is not a
surface. The three K1-class comments (`fatigued/empowered/warded`) name
`honed` now.

**No sim change** — the key is a merge identity; the same key string on both
sides of every merge leaves every fold byte-identical (fuzz:smoke on the
hook is the check). The user's own localStorage run save will be REJECTED
at the next load (v45) — expected under the authorized bump.

### The §95 playtest (2026-09-10) — VERDICT: passed; §95 CLOSED

**The user's verdict: "went very well."** §95 closes on it. The playtest
was also the FIRST since §94 closed — the user's own words: "clearly I
forgot to do a playtest then" — and both findings it raised are §94
presentation, not §95:

1. **Morale reads twice on the battle HUD and both turn screens.** By
   design of 94e: the persistent chip is page-lifetime (every screen) and
   the HUD + pre/post-turn gauges kept their full gauges as "the
   authoritative in-encounter read" (`PoolOverlay.ts:6-9`); the Round 7
   kickoff audit had routed the pool rider as absorbed by 94e with one
   residual — "full gauge vs chip on the event screen" (§Kickoff H row 5).
   The playtest answered the mirror question: **the chip HIDES while a
   battle or a turn screen is up** (the user's pick of three: hide the
   chip · drop the player gauge and keep the enemy one · keep both).
2. **The live pool bar was never built** — verified against the code: the
   HUD's `renderPlayerPool` / `renderEnemyPool` paint ONCE from the
   encounter's `EncounterPools`, the only `unit:died` handler in `src/ui`
   grays the card (`HUD.ts:319,591`), and nothing in `src/ui` reads
   `World.fallenPower`. The idea was the user's note at the 94d
   shape-lock (2026-09-06, `archive/post-88-worklog.md:2571-2585`): 94d
   split into data + presentation "where the user picks the screen or the
   live bar (or both)"; the presentation commit shipped the ledger rows on
   the post-turn screen and the live-bar half fell through the split — no
   TODO, no META-ROADMAP line, no Round 7 phase carried it.

**Routing — one inserted phase, §96.5**, both findings together (the
user's call; the placement mine): after §96 (the bar and the chip rule
should build on the chip base + the tokens, not precede them) and BEFORE
§97 / §100 open the post-turn screen (16 un-extracted literals + `title=`
sites — deciding its fate first is what touch-once demands) and before
§103 signs the loop. A small design round opens the phase (the user
asked for one since the bar is unbuilt). Numbered by the round-level `.5`
convention applied to a phase — renumbering §97–§104 would have touched
the spec, META-ROADMAP, this worklog, HANDOFF, TODO and the memory for no
information gain; the convention exists because that churn was rejected
at the Round 7 kickoff. The docs guard's phase parser (`/^## Phase \d/`)
accepts the form.

**Process note for the scratchpad:** a round close that skips the
playtest ships its presentation findings to the NEXT round's first
playtest. The §94 close had a signed sheet, a frozen config and no eyes
on the screen; the two findings cost nothing to find and a phase to fix.

## Phase 96 — the shells + the tokens

### Kickoff (2026-09-11) — the code-reality audit + the cut

Pre-flight green at `31dc00b` (typecheck clean · 2922 tests / 37 s). The
audit re-measured the §Kickoff §E census at HEAD (§95 had since opened
most of these files for extraction); the deltas that changed the cut:

- **Hexes: 330 declarations, 33 distinct — not "~90".** The ~90 was the
  count of hexes carrying a palette-name comment. Twelve distinct values
  are `COLORS` entries; the rest: a hover amber `#ffd060` (×9), eleven
  grays, `#000`/`#fff`, eight one-offs. Separately **89 `rgba()` tints (41
  distinct)**, most the palette triplets at an alpha
  (`rgba(21,244,238,0.08)` = FLOURESCENT_BLUE at 8%). The charter's exit
  reads "zero raw hexes"; a Round 8 palette swap fails if the tints stay
  literal — hence decision A's relative-color-syntax rule (one token per
  palette color serves every tint; browser floor Chrome 119 / Safari 16.4
  / Firefox 128, well under the WebGL2 floor three r184 already sets).
- **`font-size`: 109 declarations, 20 distinct px (8.5 → 56), twelve
  singletons.** Nothing sets a root size — rem is against the browser's
  16px, so every value is an exact binary-friendly fraction (8.5px =
  0.53125rem); a 1:1 mapping renders pixel-identical (decision B).
- **No focus management exists anywhere in `src/ui`** — zero `focus()`,
  `tabindex`, `aria-modal`, `role=`. "Focus trap + restore" is therefore
  NEW behavior under a "no behavior change" scope guard; the user's call
  (E): in — it is the charter's stated content and the only behavior it
  adds is focus staying inside an open modal.
- **The three modals confirmed** (CardListModal the reusable one;
  CacheOverlay re-creating `.roster-overlay/.roster-modal` by hand and
  REMOVING the ✕ while `overflow > 0` — the forced-keep flow, so the shell
  takes a `dismissable` flag; SectorMapOverlay the full-viewport variant
  with `✕ close` + a hint), each with its own window keydown Esc handler.
- **The four chips confirmed**; the pulse is byte-identical in three
  files; the column is pixel-pinned at 20/76/132/188px. The map chip
  ALREADY hides (MapScene / pre-run / game-over) and leaves a 56px hole
  above the pool chip today; §96.5 adds the pool chip hiding in battle, so
  the hidden-chip rule is load-bearing now. **Decision D: collapse with a
  fixed order** — bits never moves, cache never hides, map is always third
  when present, the pool chip is display-only, so no click target ever
  shifts; the reserve-the-slot alternative (§101's hysteresis idiom) would
  leave up to two blank slots once §96.5 lands. The cache chip is a
  `<div>` taking clicks, not a `<button>` — left so (a button adds keyboard
  reach, §100's rule). The in-battle `.hud-hop` chip sits beside the bits
  chip at a "measured" 200px — HUD-owned, a §101 item, not touched here.
- **Buttons: 28 inline `createElement('button')` in 14 files.** The nine
  primary rules are near-identical except two `transparent` backgrounds
  (gameover · sectorcleared), the 0.7-opacity recruit pass, and
  `.charselect-card` being a 300px card; `actionButton()` is byte-identical
  in PortScreen + RewardScreen; **three** buttons lack `type="button"`
  (GameOver · Recruit pass · SectorCleared — the audit's "4" was one high).
- **Screens: eleven classes** carry the identical show/hide/fade pair (the
  audit's "13" counted the HUD + a modal); the HUD is seven panes with
  their own fade lifecycle — not a screen, stays out; the scenes call each
  screen's own `show(args)` signature, so the base exposes `present(el)` +
  `hide()` and forces no signature.
- **Touch-once collides with a shell phase.** §96 opens every screen file;
  read literally the rule extracts all 115 literals here, contradicting
  §96.5 ("decide PostTurn's fate before anyone extracts it") and §100 ("the
  remainder"). **Decision C: a §96 touch extracts the strings that pass
  THROUGH the new idiom at the rewritten lines** (button labels, modal
  titles/close text, chip labels — ~25) and nothing else in the file; the
  95c "bent knowingly" precedent, now stated as the rule for a shell phase.
- **Token source of truth (A):** `palette.ts` stays it; the CSS `:root`
  block is PINNED byte-equal by a test (the derived-artifact tripwire
  pattern), so the stylesheet works standalone and Round 8 swaps by
  `setProperty` over the defaults. Boot-time injection from `palette.ts`
  was the alternative — rejected because it makes the sheet unrenderable
  without the game's JS for no gain the pin doesn't give. No tool GUI
  imports `ui.css` (nodemap-viz mirrors hues in comments only).

**The cut** (ROADMAP §96): 96a color tokens → 96b text tokens → 96c the
Screen base → 96d the button factory → 96e the chip base → 96f the modal
shell → 96g docs + the eyeball exit. Ordered by risk: the two token steps
are mechanical and proven by a scratch oracle that resolves every
declaration of the new sheet against HEAD's (re-derived from the OLD
file, never from the token table — the §79e circularity rule); the shell
steps follow so their CSS lands on tokens instead of minting hexes to
convert later; the modal shell is last because it is the one step with
new behavior. Predictions: no snapshot bump (nothing serialized), no fuzz
trigger (src/ui only — the hook stays ~45 s), the literal baseline drops
at 96d + 96f, `ui.json` +~25 keys.

### 96a — the color tokens (2026-09-11)

**The rewrite was a script, not 325 hand edits** (scratchpad, deleted):
a hex → token map (37 tokens: the palette thirteen by kebab of the
`COLORS` key, used or not; `black` / `white`; ten role names — `amber-hover`
`#ffd060`, `amber-dim` `#997700`, `amber-faint` `#332300`, `green-dim`,
`blue-dim`, `blue-rule` `#0e4f4c`, `boss-red`, `miss-white`, `status-name`
`#d8d2c4`, `status-meta` `#9a9286`; eleven grays BY LEVEL, `gray-d0` …
`gray-0a` — exact, because collapsing them is a visual sweep for §101 or
Round 8, not this step; and `miss-glow` `#5aa0ff`, a color that only ever
existed as a tint) and a triplet → token map for the eight palette
`rgba()` families. Replacement skipped `:root` and every comment
(block-comment state tracked across lines); the bare `/* TERMINAL_AMBER */`
comments the token name now carries were stripped, the ones with a
rationale kept their rationale. 378 `var(--color-…)` references + 54
`rgb(from …)` tints; black / white plate alphas (35 sites) untouched by
decision A.

**Three proofs, none of them the token table:**

1. **The oracle** (scratchpad, deleted): parses HEAD's sheet and the new
   one into `(path, prop, value)` triples, resolves the new one's `var()`
   against its `:root` and its RCS against the hex, normalizes both sides
   (3→6 hex, rgba number formatting), compares in order — **1552
   declarations, 0 diffs**. Self-checked first: HEAD vs HEAD read 0 diffs
   only after two defects were fixed in the ORACLE (it resolved `var()` on
   one side only, and threw on a rule-scoped custom property like
   `--overlay-gap`) — the reader's known-answer rule, paid at once.
2. **The pin** (`tests/ui-tokens.test.ts`, rides `npm test`): every
   `COLORS` entry has its `--color-<kebab>` at the same hex · zero raw
   hexes outside `:root` · zero palette-triplet `rgba()` outside `:root` ·
   every ROLE token referenced (the palette tokens exempt — they exist for
   the swap). Run against the UNCHANGED sheet first: 2 of 4 failed, so it
   can fail.
3. **The browser** (the one thing text can't prove — that relative color
   syntax renders): `CSS.supports` true; the pulsing bits chip's shadow
   computes to `color(srgb 0.2 1 0 / 0.55)` = `(51,255,0,0.55)`, the modal
   glow to `(255,176,0,0.25)`, the miss halo to `(90,160,255,0.85)` —
   HEAD's literals exactly.

**Declined:** tokenizing the black/white plate alphas (`rgba(0,0,0,.7)`
×14 etc.) — not palette, and a naming sweep (`--plate`, `--backdrop`)
would be judgment under a mechanical step; a Round 8 "plate opacity"
setting can mint them then.

### 96b — the text tokens (2026-09-11)

The 96a script's sibling: every `font-size: <n>px` below `:root` →
`var(--text-<n>)`, the 20 tokens inserted in rem against the browser
default 16px (nothing sets an html font-size; every value is an exact
binary fraction — `--text-8-5: 0.53125rem`, `--text-13: 0.8125rem`), the
name the default-scale px so the mapping reads at a glance. **109
references, 20 tokens, exact 1:1** (decision B). The same three proofs:
the oracle (rem × 16 → px on the new side) read **1552 declarations, 0
diffs** vs HEAD (`6539610`); the pin gained a 96b block (every token rem
· every `font-size` below `:root` a token · every token referenced) and
was run against the UNCHANGED sheet first — 2 of 7 failed; the browser
computed 18 / 8.5 / 20 / 42 / 15 / 11px on six probe classes after the
HMR update, each equal to HEAD's literal for that class (grep'd from the
pinned HEAD sheet, since the update outran the "before" capture).

**A naming note for Round 8:** a text-scale setting that sets `html {
font-size }` scales every token; `--text-12` then renders 13.5px at
1.125×. The name is the STEP, not a promise of pixels — and the ladder
(20 steps, 12 singletons) is the one an eye-led §101 / Round 8 sweep
collapses, with the pin and the oracle as its instruments.

**The token pair's playtest (2026-09-11): clear** — the user's verdict
before the shells opened.

### 96c — the Screen base (2026-09-11)

**The shape** (`src/ui/Screen.ts`): abstract, `protected container`,
`protected present(el)` = add `.screen-fade` + mount + fadeIn, `hide()` =
fadeOutAndRemove + null. Each screen keeps its own `show(...)` signature
(no scene call site moved) and its EXPLICIT leading `this.hide()`: the
base must never hide implicitly, because PreTurnScreen's `show()` seeds
fresh state (cues, grants, the selection) BETWEEN its `hide()` and its
render, and an implicit hide inside `present()` would wipe it. Seven
screens keep an `override hide()` for their own teardown (Event · Port ·
Reward null a body handle; Map · Recruit dispose a roster button; PreTurn
its cue timers + clones + card-list buttons; Promotion its timeline) and
call `super.hide()`; four (CharacterSelect · GameOver · PostTurn ·
SectorCleared) lost their `hide()` entirely. MapScreen's scroll-centering
now reads `offsetTop` after `present()` — the fade-in is a next-frame
class flip either way, so the read lands on the same laid-out tree.
`noImplicitOverride` is on, so a forgotten `override` is a compile error.
The HUD (seven independently faded panes) is not a Screen and is untouched.

**A codemod, with every replacement asserting it fired exactly once**
(scratchpad, deleted) — a shape that drifted from the audit fails loudly.
It did, twice, both times usefully: its residue guard flagged
PreTurnScreen's `this.mount.appendChild(clone)` (the 65f exit clones — a
legitimate mount use, guard loosened to the fade calls), and
RecruitScreen's working copy was CRLF against an LF index (the LF-anchored
pattern matched 0×; normalized on read). MapScreen (field-style mount, the
scroll step) was done by hand. Net −69 lines.

**Verification:** tsc clean; a browser walk under `?eventChance=0&seed=7
&character=soldier` driving the sim by hand (`world.tick()` +
`battleRenderer.update(0.05)` — the HANDOFF recipe; the preview pane was
hidden so no rAF ran) reached **eight of the eleven** screens — map ·
event · pre-turn · the battle HUD · post-turn · reward · recruit · game
over, plus character select at the un-pinned boot — asserting after each
swap that exactly ONE `.screen-fade` root is mounted and the outgoing one
is gone after its fade (no leak, no double-mount). Port · promotion ·
sector-cleared were not reachable in a two-battle run; they carry the
identical codemod shape (Port an override like Event; SectorCleared a
base hide like GameOver) and the user's phase-exit eyeball walk covers
them. **What the pane could NOT show:** `.is-visible` — the fade-in is a
rAF class flip in the UNTOUCHED `fade.ts`, and `rafFiredDuring: 0` in a
hidden pane; the eye owns the fade. Console: no errors across the walk.

**The 96c playtest (2026-09-11): clear through the sector seam** — the
user reached the sector-cleared beat, so all eleven screens (including
the three the walk could not reach) are user-verified.

### 96d — the button factory + `.btn--primary` (2026-09-11)

**The factory** (`src/ui/button.ts`): `button(label, {className, onClick,
title?})` — type · class · label · click, deliberately dumb; the audio cue
stays in the caller's handler (most play `click`, the reward/port swaps
`pickup`, the sector-map close nothing — the factory must not decide).
The two byte-identical `actionButton()` copies (PortScreen, RewardScreen)
folded into it; the three buttons that lacked `type="button"` (game over ·
recruit pass · sector cleared) have it now; the character-select card is
minted by the factory with `label: ''` and keeps its own card chrome.

**The class:** `.btn--primary` = the look the continue trio and the
promotion Continue already shared byte-for-byte (14px · 10px 28px · a
dark-amber frame · black · amber · the blue hover). **Three modifiers name
a DELIBERATE per-site delta** and nothing else: `btn--dim` (the recruit
pass — 0.7 until hovered, and the hover lifts opacity, never color),
`btn--exit` (game over + sector cleared — transparent over an opaque
screen, a full amber frame, the hover FILLS it, the 16px margin under the
subtext), `btn--corner` (the port Leave — smaller, a full amber frame, an
amber wash on hover). A site's POSITION stays on its own class
(`.preturn-continue` bottom-center, `.port-leave` top-right); the four
site classes with no rule left (promotion · post-turn · reward · recruit)
are gone from the markup. Nine rules → one rule + three modifiers.

**Zero visual drift, by construction — and the incidental deltas are
therefore STILL THERE, inside the modifiers:** the pass's 13px / 8px 28px
vs the base 14px / 10px 28px, the exit pair's 10px 24px, the corner's 12px
/ 8px 18px, and three different `transition` lists. Each is one line to
delete when an eye decides the ladder collapses (§101 or the Round 8
polish); 96d preserved every computed value because "no behavior change
on any screen" was the scope guard and a mechanical step should not carry
a taste call.

**Extraction (decision C, the strings that pass THROUGH the factory at the
rewritten lines):** eleven keys — `preturn.fight` · `common.pass` ·
`gameover.newRun` · `sectorcleared.pressOn` · `port.leave` · `port.sell` ·
`port.choose` · `port.swapIn` · `reward.accept` · `reward.swap` ·
`reward.continueTitle`; the `▸` suffix stays outside the value (the spec's
glyph rule, the 95f `common.continue` precedent). `ui.json` 52 → **63**;
the literal baseline **115 → 103** (PreTurn 21→20 · Port 17→13 · Reward
5→2 · GameOver 1→0 · Promotion 2→1 · Recruit 2→1 · SectorCleared 6→5),
exactly the prediction. The pre-turn `Pass ▸` and the port's `Remove for N
bits ▸` (a CardListModal confirm — 96f's) were NOT rewritten and keep
their literals.

**Four proofs:** (1) tsc clean — it caught two leftover
`createElement('button')` lines shadowing the import in PostTurn and
Promotion before anything ran; (2) **a cascade oracle** (scratchpad,
deleted): per site, the OLD class list against HEAD's sheet vs the NEW
class list against the working sheet, in three pseudo states, resolved to
a property map (the `border` shorthand expanded to its longhands so a
`border-color` over a base compares equal) — **9 sites × 3 states, 367
properties, 0 diffs**; self-checked HEAD-vs-HEAD (0) and negative-
controlled by stripping two modifiers (29 diffs) — it can fail; (3) the
pins — ui-tokens · the key scan · the literal ratchet · the i18n suite, 76
green; (4) **the browser**: six probe elements with the new class lists
computed exactly HEAD's declared values (the dim pass 0.7 / 13px / 8px
28px; the exit pair transparent / amber frame / 10px 24px / 16px margin;
the corner 12px / 8px 18px / fixed 16/16; the base 14px / 10px 28px / the
dark-amber frame). The page-not-loaded trap bit a second time (a probe
read zero stylesheets — reload + a 5 s wait before believing a probe).

**The 96d playtest (2026-09-11): clear.**

### 96e — the chip base + the chrome column (2026-09-11)

**The shape** (`src/ui/chip.ts` + ui.css): `.chip` is the plate the four
page-lifetime chips shared by copy (font · 18px · uppercase · amber on
translucent black · the frame · 10px 18px · min-width 128); `chipPulse(el)`
is the one 450 ms `.is-pulsing` flash (three byte-identical copies
deleted); `createChromeColumn(mount)` is a Game-owned `position: fixed`
flex column at 20/20 the chips mount INTO — the four `position: fixed;
top: N` pins (20 · 76 · 132 · 188, each "measured" from the chip above)
are gone. **Order is CSS `order`** (bits 1 · cache 2 · map 3 · pool 4),
so Game's construction (and bus-subscription) order stays untouched — no
behavior change. **A hidden chip collapses** (decision D): one
`.chrome-column > .is-hidden { display: none }` replaces four per-chip
rules, and the chips below move up.

**Measured first, then chosen:** the old offsets implied gaps of 11 / 10
/ 10 px against chip heights of 45 / 46 / 46 (the bits chip is one pixel
shorter — its baseline-aligned 13px label). One `gap: 10px` lands the
column at **20 / 75 / 131 / 187** — a one-pixel lift on three chips, the
price of one gap instead of three measurements, reported rather than
hidden. On MapScene (the map chip hidden) the pool chip now sits at 131,
in the third slot, where before it floated at 188 over a 56px hole.

**Two mounts, not one:** the cache modal and the sector-map overlay used
the same `mount` as their chips. Inside the column they would inherit its
`z-index: 15` stacking context and a `z-index: 30` modal would render
UNDER the `z-index: 20` corner buttons — so both constructors now take
the page mount for the overlay and the column for the chip, and the
browser confirmed the modal's parent is `#ui` and it covers the chip.

**The one thing the CSS oracle structurally cannot see, and the browser
caught:** a fixed flex column is a BOX over the corner of every screen,
and its gaps (and the width past a narrow chip) intercept clicks the old
free-floating chips never did. `.chrome-column { pointer-events: none }`
+ `.chrome-column > * { pointer-events: auto }` was the fix — and the
first probe read `pointer-events: auto` on the column and a gap hit that
landed ON it: `#ui > * { pointer-events: auto }` outranks a class at id
specificity. The stylesheet already carried the answer (`#ui >
.battle-countdown`), so the rule is `#ui > .chrome-column`. The re-probe:
the gap hits the screen beneath, the chips still take their clicks.

**Proofs:** tsc clean; the cascade oracle over **14 chip states (bits ·
cache · map · pool × plain / pulsing / hidden / over / low / losing) × 3
pseudo states, 651 properties, 0 diffs** with the four moved properties
(position · top · left · z-index) and `order` on an explicit ignore list —
the control run without the list flagged exactly those and nothing else;
the oracle itself needed a fix first (it scored `.chrome-column >
.is-hidden` as ONE class and read nine phantom `display` diffs — whole-
selector specificity now; the 96d sites re-read 0 under it); the browser:
the tops above, the collapse on MapScene, the pulse (class on, gone at
600 ms), the modal above the column and closing on Esc, the click-through
after the fix. Console: no error from the finished tree — the buffer
(which persists across reloads) holds seven `ReferenceError`s from the
HMR reloads that fired BETWEEN edits (an import landing after its first
use), every one timestamped before the last edit; a fresh load after it
added none.

**The 96e playtest (2026-09-11): clear.**

### 96f — the modal shell (2026-09-11)

**The shape** (`src/ui/modal.ts`): `openModal(mount, opts)` returns a
handle. Two variants reproduce the consumers' DOM and classes EXACTLY —
`panel` (`.roster-overlay` › `.roster-modal` › a `.roster-modal-header`
with the title + the ✕; the consumer appends its body after the header or
`replaceBody`s it) and `viewport` (`.sector-map-overlay` + the pinned
`.sector-map-overlay__close`; the consumer renders into it) — so the
cascade is untouched and `ui.css` gains ONE rule (`outline: none` on the
focused container: it is not a control). **One `dismissable` flag gates
Esc, the backdrop and the ✕ together** (`setDismissable(false)` hides the
✕ and ignores the other two — the cache's forced-keep flow, which used to
REMOVE the ✕ from its hand-built header on every re-render), so a shell
can never be half-dismissable. **`onClose` fires exactly once per open,
from any route including `handle.close()`** — every consumer's teardown
lives there and nowhere else (CardListModal nulls its handle + confirm
button; the cache nulls its handle; the sector map hides its MapScreen).
Sounds stay the consumer's: `onCloseClick` fires on the ✕ only (the
card-list and cache modals play `click`; the sector map plays nothing;
Esc and the backdrop were always silent).

**The new behavior (decision E):** the container takes focus on open
(`tabindex=-1`, `preventScroll`), Tab / Shift+Tab cycle among the
focusables inside (from the container: Tab → the first, Shift+Tab → the
last; none → the key is eaten), and on close focus returns to the element
that had it, when it is still in the document and not `<body>`.
`role="dialog"` + `aria-modal="true"` + `aria-labelledby` (a titled
panel) ride along; nothing visible changes. Three Esc handlers → one.

**Consumers:** CardListModal keeps the body (the grid, the 51c picker
footer, the selection state); the cache modal re-renders its BODY per
`run:cacheChanged` and re-reads the title + the dismissable gate (before,
it rebuilt the whole overlay including the header); the sector-map
overlay keeps its hint + the read-only MapScreen. **Strings through the
shell (decision C):** `cardlist.empty` · `cache.title` · `cache.empty` ·
`sectormap.hint` — and the sector map's `✕ close` became
`✕ ${t('common.close')}`, which renders identically because the class
upper-cases the face. The hint's `M` was HARDCODED; it now takes the live
keybind label the constructor already received (identical output at the
default bind — a latent rebind bug closed in passing). `ui.json` 63 →
**67**; the baseline **103 → 99** (the scanner flagged the shell's
focusable-selector string as prose — `// i18n-ok`, structural).

**Proofs:** tsc clean; the pins (ui-tokens · key scan · literal ratchet ·
i18n, 76 green); **the browser, under a fresh console:** the roster modal
from its real corner button — `role=dialog`, `aria-modal`, `aria-labelledby`
→ the title, focus on the panel, Shift+Tab → the ✕, Esc closes, **focus
back on the roster button**; the cache modal from the chip — the title
`Cache — 0/6` byte-equal to the old template, the header + list body, the
✕ shown at overflow 0, a backdrop click closes; the sector map from its
chip on an event screen — focus on the host, the hint byte-equal, the
close face `✕ Close` computed `uppercase`, the read-only map rendered,
Esc closes, **focus back on the map chip**. Console: no errors. What the
synthetic probe could not do: a dispatched Tab never moves focus
natively, so the forward-Tab-from-the-container case was made explicit
(→ the first focusable) rather than left to native order.

## Phase 96.5 — the live pool bar + the chip rule

### Kickoff (2026-09-12) — the code-reality audit + the design round + the cut

Pre-flight at `ee69a18` (clean tree; the §96 close). The audit, against
the charter's three premises:

- **The HUD gauges paint once — confirmed.** BattleScene hands the
  encounter's pools to `HUD.show()` at mount; the HUD's only death handler
  grays the card and zeroes its HP bar (`HUD.ts:591`); nothing in `src/ui`
  reads fallen power.
- **A death already carries its BOOKED power.** `World.reapUnit` is the
  one death emit for both death sites and puts `recordFallen`'s return on
  `unit:died.power` (a summon 0, a neutral excluded by team —
  `World.ts:2381`); Run's ledger sums exactly those numbers. So a
  per-death read needs no World accessor; a restore-mid-battle read does
  (`fallenPower` and `survivorPower` are both private, copied only into
  `battle:ended` and the snapshot).
- **The pool chip never hides** except on defeat / victory
  (`PoolOverlay.ts:82`); the map chip's class toggle is the precedent and
  the 96e collapse rule already moves the column.
- **The post-turn gate is driven by the fuzz bot too** — the harness sets
  `pauseAtTurnGates` on and dispatches `advanceTurn` at every
  `turn-outcome` (`harness.ts:733`). Removing the phase from Run would
  touch the bot loop for no player-visible gain; Game dispatching the
  advance itself after the outro leaves Run and the fuzz byte-identical
  by construction.
- **The post-turn screen's footprint:** `PostTurnScreen.ts` (222 lines,
  16 un-extracted literals) + `PostTurnScene.ts` + 33 `.postturn-*` CSS
  rules + zero locale keys; its only test pins the `turn:resolved`
  PAYLOAD in Run, not the screen — so no test breaks whichever way it
  goes, and the payload keeps its shape.
- **A latent finding:** the pre-turn risk line is painted once from
  `turn:starting.poolAtRisk` and never re-rendered (`PreTurnScreen.ts:628`);
  a redraw changes the hand, and under casualties the hand's Σ power IS
  the bound, so the "up to N" goes stale after a redraw. Folded into 96.5c.

**The design round (a plain-message shape-lock, two turns).** The first
proposal: a re-read PROJECTION — `turnCharges` with the decisive reason
over the live survivors + fallen, so the same function books the turn
and previews it under either rule. The user caught the flaw: under
survivors that ghosts the WHOLE wave off the player's bar at battle start
and shrinks it per kill — rule-consistent and backwards, because a
survivor's charge is not a fact until the battle ends. **The user's model,
adopted: a LOSS-EVENT stream.** Each loss is an event with a target
gauge, an amount, a phase and a cause; a casualties loss fires at the
death (from the dead unit's own card to its own side's gauge); a
survivors loss fires per surviving enemy in a sequence after
`battle:ended` and before the scene leaves (from the survivor's card to
the OPPOSING gauge); the cap surcharge is just more end events; a
mid-battle restore opens with the booked casualties already ghosted; and
a future flat turn-win/loss effect rides a team-gauge cause at the end —
shape only, no rule built. The VFX: an orb from the card to the gauge in
the spirit of Mechabellum's health-bar projectile, a shake by magnitude.
Six refinements, all user-signed: (1) the arithmetic lives beside
`turnCharges` in `chipRule.ts` as a pure derivation, never re-computed
in the HUD (the §91a2 second-copy finding), with a test pinning Σ events
= the charge; (2) the event shape above, the team-gauge cause doubling
as the no-card fallback; (3) the ghost commits into the solid fill at the
outro's end, since Run has already booked the pool before any of this
plays (`battle:ended` resolves the turn synchronously) — the bar leaves
the screen at the number the next pre-turn gauge shows; (4) the shake
only for PLAYER-pool losses above a threshold fraction of the max, never
under `prefers-reduced-motion`, the orb on every event; (5) the outro
becomes max(900 ms, the end sequence) — the BattleScene reports done and
Game auto-advances; no skip click; (6) 96.5b splits headless-first (b1
the model + the ghost, no motion) / render-second (b2 the orb + the shake
+ the sequence). The post-turn screen: REMOVED, with a one-line "last
turn" strip on the pre-turn screen from turn 2 (Game buffers the last
`turn:resolved` the way it buffers deck cues — Run's events keep their
shape); the encounter's LAST turn's rows have no home until §102's
run-end stats, the user's own roguelike-demographic argument from 94d.
The encounter-end-summary alternative (a screen at a win, the rows homed
now) was named and declined; no extra win beat beyond the commit.
The risk line stays on the pre-turn screen (the decision surface) and
gains the ceiling tick on the battle bar at the same number.

**Predictions to score at the close:** no snapshot bump (the projection
reads state v36 already serializes); the hook's fuzz smoke fires ONCE
(96.5b1 touches `World.ts` for the public read and `chipRule.ts` for the
derivation), byte-identical; `ui.json` gains the strip's and the ghost
value's strings only; the post-turn deletion drops the literal baseline
by its 16.

### 96.5a — the chip rule (2026-09-12)

**Step zero held:** the chip had exactly the 94e wiring (hide on defeat /
victory, show on `run:started`, `startHidden` pre-run) and nothing
scene-aware; `Game.swap` already pushes the map chip's availability from
the one chokepoint by `instanceof` (78e), so the pool chip takes the same
route rather than six event subscriptions (`turn:starting` ·
`battle:started` · `reward:offered` · `promotion:pending` ·
`recruit:offered` · the map return …), any one of which a future scene
could miss.

**The shape:** `PoolOverlay` keeps TWO flags under ONE class — `runHidden`
(the 94e sources) and `suppressed` (96.5a, `setSuppressed(bool)`), with
`is-hidden` = either. The two-flag form is load-bearing, not tidiness: a
run defeat fires from inside a battle, and the `GameOverScene` swap that
follows sets `suppressed = false` — a single class toggled from both
sources would have re-shown the chip on the game-over screen. Game's swap
suppresses for `PreTurnScene | BattleScene | PostTurnScene` (the
PostTurn entry leaves with 96.5d). No CSS change: the 96e collapse rule
already does the layout.

**Browser-walked on the 5191 preview** (the zero-stylesheet trap bit once
more — `sheets: 0` on the first probe after `preview_start`; a reload + a
6 s wait read 2; and the hidden pane's zero rAF froze the battle at tick 2,
so the scene's `tick(1/60)` was driven from JS for 1,129 iterations to
reach the outcome): the chip `display: flex` on MapScene and EventScene,
`display: none` with the column collapsing to 20 / 75 / 131 on
PreTurnScene, BattleScene (the two HUD gauges present), PostTurnScene
("Skirmish Won") and the next PreTurnScene (turn 2); a synthetic
`run:defeated` → GameOverScene stays hidden (both flags); `resetRun` →
CharacterSelectScene hidden (no run); a character pick → MapScene shown
at `40 / 40`. Console: no errors. **The 96.5a playtest (2026-09-12):
clear.**

### 96.5b1 — the loss-event model + the ghost (2026-09-12)

**The model, in `chipRule.ts` beside the arithmetic it mirrors** (the
kickoff's point 1): `lossEventsForDeath` — under casualties one IMMEDIATE
event per death, the dead unit's own side pays its booked power, the cause
is the unit; under survivors nothing (a death is not a survivors fact).
`lossEventsAtEnd(reason, standing, fallen)` — the survivors rule, when
`rulesForTurn` names it, as one END event per standing unit charged to the
OPPOSING pool; the casualties rule ONLY as the cap surcharge over a
survivors chip mode (under a casualties mode every death already fired,
and the rule set dedupes), then as one TEAM-cause event per side off the
fallen totals — the team cause's first real use, beside the no-card
fallback and the flat-turn future. `bookedImmediateLoss(fallen)` — the
opening ghost for a consumer attaching mid-battle. **The pin:** Σ
(immediate over the dead) + Σ (end) per side = `turnCharges` for every
{chipMode}² × {reason} × {mult 1, 1.5} — the expectation is the charge
function itself over totals the per-unit rows re-derive, never re-typed
numbers; plus four shape pins (the casualties row, the survivors rows,
the surcharge under both orders, the zero/neutral exclusions) and the
restore opening = the immediate stream summed.

**Two World reads, not the cut's one:** `survivorsByUnit()` (the per-unit
form of `survivorPower`, which now SUMS it so the two cannot drift — the
end sequence must be one row per exactly the units the charge counts) and
`fallenPowerSoFar()` (a copy of the §91a1 accumulator). The cut line
predicted one because it only thought about the restore; the survivors
end sequence needs the standing rows too. World.test pins both against
the `battle:ended` payload and the copy against the accumulator.

**The ghost (`poolGauge.ts`):** `createPoolGauge` returns a handle (`set` ·
`setPending` · `commit`); `renderPoolGauge` is now the one-shot form over
it, so the pre/post-turn gauges render EXACTLY as before (browser: `40 /
40`, ghost width 0 %, the pending span hidden). The ghost is a hatched
segment (the side's hue at 55 % over the bar's ground, relative color
syntax — the 96a token rule, `tests/ui-tokens` green) positioned over the
fill's leading edge from the projected remainder to the booked pool; the
readout `31 (−1) / 40` with the `(−N)` on its own dimmed span;
`poolValueParts` clamps the pending loss at the pool (the applied charge
is clamped), so the ghost never crosses zero. `commit()` sets the pool to
the remainder and zeroes the ghost.

**The HUD:** both gauges become handles; `unit:died` feeds
`lossEventsForDeath`; `battle:ended` feeds `lossEventsAtEnd` off
`world.survivorsByUnit()` + the payload's `fallenPower` (the reason
fallback mirrors Run's: a fake's missing reason maps draw → cap, else
decisive) and then COMMITS at once — b2 moves the commit to the orb
sequence's end (the kickoff's points 3 + 5; the seam is one method). `show()`
opens the ghost at `bookedImmediateLoss(world.fallenPowerSoFar())` — a
mid-battle restore reads the same after a reload. **Finding:** no run
autosave exists (`localStorage` in `src/` is the dev trace store only), so
that path is reachable only through the dev `Game.restore`; it stays
correct and pinned at the model level, and the wiring is three lines.

**Browser-walked on the 5191 preview** with an INDEPENDENT re-derivation
(the §79 rule): a page-level `unit:died` tally summing the raw payloads'
power per team, installed before the battle. Turn 1: a neutral death (0)
moved nothing; after two player deaths the player gauge read
`38 (−2) / 40`, ghost left 95 % / width 5 %, the tally 2; at the decisive
end the HUD committed to `34 / 40` and `12 / 14` = `run.playerHealth` /
`run.enemyHealth` = the post-turn gauges = the chip lines (−6 / −2) = the
tally (player 6, enemy 2 — the `battle:ended` payload's fallen). Turn 4,
paused mid-battle on the first player death: `31 (−1) / 40`, the fifth
card grayed, the screenshot taken (the 5 px hatch is below what a preview
JPEG resolves — the user's eye is the visual check; the geometry is the
proof here). Console: no errors. The hidden pane's zero rAF again: the
scene's `tick(1/60)` driven from JS to reach each stop. **The 96.5b1
playtest (2026-09-12): clear, with one finding — the user's.**

### 96.5b2-pre — the gauge head's layout hysteresis (2026-09-12, the user's b1 finding)

**The finding:** the readout widening to `X (−Y) / Z` moved the layout —
"our y-coordinate hysteresis failure" (the §101 shape, caught by the
user's eye at b1). **The mechanism, control-probed on the UNFIXED tree
first** (the confirm-the-deficit norm): the gauge is a fixed 220 px and
its head a flex row (label left, value right); on the enemy gauge the
label is the ENCOUNTER NAME, so the head WRAPS under width pressure and
the gauge grows, moving the enemy card row beneath it. The probe found
it wider than the parenthetical: this run's encounter, "The Ronin and the
Mages" (23 glyphs, the catalog's longest), sat on TWO lines before any
death — head 32 px vs the player's 16, the enemy card row at 126 px —
while "Guarded Adventurer" (18) had sat on one at b1. The enemy gauge's
height already varied PER ENCOUNTER; the parenthetical was one more way
across the wrap. **The fix, two layers, one CSS block:** (1) the head can
never wrap — `white-space: nowrap`, the label `min-width: 0` +
`text-overflow: ellipsis` (the structural guarantee: no string, font or
future readout changes the height); (2) the value RESERVES its widest
live form — `min-width: 15ch` (`44 (−44) / 44`: the enemy pool max is 44
in `encounters.json`, the player's 40; 13 glyphs + the 0.08em spacing),
right-aligned, so the value's box and the label's room are constant
through a battle (`/ max` stays put, only the remaining number slides —
no horizontal re-ellipsis per death either). And the user's call: the
HUD's two gauges widen (`.hud-player-pool / .hud-enemy-pool .pool-gauge`)
so the name survives beside the reserved value — 300 px clipped the
23-glyph name by 4 px (label room 184 vs 188 needed), **320 px** fits it
(187.7 px of 204) with room for a future 25-glyph name; the turn screens
keep 220 (their labels are `Your / Enemy Morale`, unclipped, heads 16 px).
**Browser, before → after** (the same battle, HMR): enemy head 32 → 16
px, gauge 54 → 38 px, the enemy card row 126 → 110 px; the value box 108
px with AND without the parenthetical, its left edge constant; through
two more deaths and the end commit nothing moved. `tests/ui-tokens`
green (no raw values). Console clean.

### 96.5b2 — the orb + the shake + the end sequence (2026-09-12)

**The spec, signed in plain messages** (the user's "I'm nervous about the
orbs" → a concrete spec with defaults, every one a UI constant): a `●`
glyph in the paying side's hue with a glow, sized by amount / max, flown
from the causing unit's card to the paying gauge on a slight arc in 400
ms wall-clock (fast-forward never shortens it), landing on the fill's
leading edge; **the ghost ticks ON THE LANDING**, not at the event (the
eye follows the cause to the effect — b1's at-event tick is now the
reduced-motion / no-card path); the survivors end sequence one orb per
standing enemy at 120 ms in card order (the user's pick over a volley);
the last landing + a 250 ms settle → the commit → `lossesSettled()`
resolves → `BattleScene.outro()` → Game's outro = max(900 ms, it) (M3's
`swapAfter` folded into `swapAfterOutro`, still cancelled by any direct
swap through a token); the shake only for losses to YOUR pool at ≥ 5 % of
the max (2 of 40 — a one-point Mercenary never rattles the screen), 2 → 6
px between 5 % and 15 %, 220 ms, on the canvas + `#ui` together with the
scanlines glass still; `prefers-reduced-motion` → no flight, no shake. No
sound (§104's registry). No skip. No extra win beat (the user: the commit
is enough). **The user's floated seam, built:** THE SHAKE POLICY (`player`
ships — "you got hurt"; `enemy` — "you achieved something"; `both` /
`none` for free), a module constant with a dev key (Ctrl+Alt+K, K is off
the bound codes) that cycles it live in a battle so the A/B is runnable
without a rebuild; a settings toggle is Round 8's. The pure parts
(`shakePx` thresholds · `orbSizePx` · the policy + its cycle) are pinned
headless in `lossFx.test.ts` off the exported constants — a retune moves
the pins.

**The finding the pane handed over — and the code change it earned:** on
the 5191 preview the orb's Web Animation sat at `currentTime` 50 ms while
`document.timeline` advanced and `visibilityState` read "visible", and a
programmatic `finish()` flipped `playState` to "finished" WITHOUT firing
its event — the pane's rendering loop is frozen (the §96 zero-rAF trap)
and WAAPI rides that loop. Turn 1 had landed every orb (the swap fired at
919 ms) because the battle ran while the pane painted for a screenshot;
turn 2's orb never landed. A real tab paints, but a throttled BACKGROUND
tab could strand an orb the same way — and with it the settle promise
Game's outro waits on. So `flyOrb` gained a wall-clock backstop: the
landing fires at the FIRST of the animation's finish and a
`ORB_FLIGHT_MS + 100` timer, `finish` idempotent, so the normal path is
untouched and a stalled one lands on the clock. The instrument found a
real robustness hole, not just its own limitation.

**Browser-proven (the backstop makes the frozen pane a valid instrument
for the WIRING; the flight itself is the user's eye):** at the first
enemy death one `.loss-orb--enemy` at 13 px in flight and the gauge
UNCHANGED (`29 / 29`, ghost 0 — the on-landing design); ~1 s later the
orb gone, `28 (−1) / 29`, ghost 3.45 %, one pulse counted by a 20 ms
poll; a burst of seven deaths at the end → seven orbs in flight, then the
outro 926 ms (the timer bound: the settle's 500 + 250 fit inside 900),
the post-turn gauges `34 / 40` and `27 / 29` = the run's pools, zero orbs
left; the dev key's two presses logged `→ enemy` then `→ both`; `shakeView`
through a dynamic import: 1 of 40 → no animation, 4 of 40 → one animation
each on the canvas and `#ui` with the 4 px decaying keyframes; no shake
fired live in the two walks because every loss was one point (below the
threshold on both pools — by design). Console: no errors. **Not exercised
live:** the survivors end sequence (the shipped rule is casualties; the
stagger loop is three lines over the shared `deliver`), a reduced-motion
run (the function is a media-query read; the pane cannot emulate it).

**The 96.5b2 playtest (2026-09-13): "pretty good", three notes, all
landed the same day (96.5b2-post):** (1) **the death readout fades** — a
0.45 s filter/opacity transition on the compact card, so the card and the
orb it launches leave together (inert on a living card; nothing else on
the card animated, so no competing rule); (2) **the landing cue** — the
shake could not be judged without a sound: the audio player was wired
(page-lifetime, the battle scene already plays the death cry) but the HUD
had no handle, `play(key)` took no per-play parameters, and no sample
existed; the catapult thud was declined by the user's ear, and they
dropped a chiptone placeholder (`public/audio/morale_loss.wav`, 270 ms,
hand-made like `thud`, outside `gen-sfx`). Now `moraleloss` is a SoundKey
(volume 0.85, jitter 0.05), `play(key, {gain, rate})` scales one play
(gain × the table volume, rate × the jitter, both set on the node so a
scaled play never leaks into the next), and `lossCue(amount, max)` maps
the loss to both dials — gain 0.5 → 1 and rate 1 → 0.7, saturating at
the shake's ceiling so the ear and the eye peak together (a lower rate
deepens the pitch AND lengthens the sample: a big loss lands as a slow
low thump, a small one as a tick); the HUD plays it on every landing, for
either pool whatever the shake policy and under reduced motion too (a
sound is not motion). Pinned in `lossFx.test.ts` (30 green with the
literal pin); the sample resolves on the preview (HTTP 206, decodes,
0.27 s); (3) **fraction vs absolute for the shake — fraction of the MAX,
kept** (the user's agreement): unit power is absolute and small (1–7)
while pool maxima range 13–44, so the same kill is a third of one pool
and a tenth of another and the shake should say which; absolute
thresholds go stale under a rebalance (§92's 20 → 40 would have halved
every shake's meaning); fraction of the CURRENT pool (escalating as you
run low) named as the third option, to try only if flat feels dull. Not
built as a seam — one constant if it is ever wanted. **The user on the
cue: "I'm loving that."**

### 96.5c — the risk line (2026-09-13)

**The staleness, closed at the source.** The risk bound is Run's number
(`previewPoolAtRisk`, pure over the keyed wave roll + the hand's base
power, capped at the pool), so the fix rides the two pre-turn refresh
events rather than a UI re-derivation (the §91a2 second-copy smell):
`turn:handRedrawn` now carries `poolAtRisk` re-derived for the NEW hand
(under casualties the hand's Σ power IS the bound, so a redraw moves it),
and `run:packetUsed` carries it too (a packet that moved the pool moved
the cap). **Gate-only, 0 elsewhere:** the first cut previewed
unconditionally and the hook's Run suite failed seven tests at once —
`Run.rollTurnWave: no selected encounter` — because a patch heal fires
`run:packetUsed` at the MAP, where no wave exists; the emits read the
bound only in `turn-intro`, which is the only phase with a risk line up to
repaint. The PreTurnScreen holds the line element and paints it through
ONE function from `turn:starting`, `updateHand` and `updatePacketUsed`;
the string went through `t('preturn.risk', {n})` at the touch (the
shell-phase rule; the ⚠ outside the value), the PreTurnScreen literal
baseline 20 → 19. Run.test pins the hand-swap payload's bound against
the payload's own hand summed by hand (never the preview).

**The ceiling tick.** `previewPoolAtRisk` is public for one reader: the
BattleScene hands it to the HUD as `poolAtRisk`, and the player gauge's
new `setCeiling(loss)` places a 2 px tick in the risk line's hue (the
enemy pool's — the same ledger) at the BOOKED pool minus the bound,
overhanging the bar a pixel each way so it reads as a mark on the bar.
It is anchored to the booked pool, not the projected remainder, so it
holds still while the ghost grows toward it and leaves with the commit;
on an ordinary turn the ghost cannot pass it (the cap surcharge can — the
bound's documented exclusion). The enemy gauge never shows one (the bound
is the player's exposure).

**Browser:** at the gate the line read `up to 6` against an independent
sum of the hand's base power = 6 (pool 40); this character's starting
daemon carries no redraw grant (the queue: empower only), so a live redraw
was rejected and the two repaint handlers were exercised on turn 2 with
synthetic payloads over the real hand + grants: `6 → 3` on the hand-swap
event, `→ 5` on the packet event; in the battle the tick was shown at
`left: 85 %` = (40 − 6) / 40, 2 px wide, the enemy gauge's hidden. Console
clean. Pins: the Run suite + the literal pin + the tokens + i18n, 431
green. **Prediction check:** the two payload additions are display-only
fields on gated events — the fuzz smoke is the hook's call at the commit
(`src/run/` staged) and should hold byte-identical (nothing consumed the
fields before they existed). (Scored: 2944 + 582 green at `e290726`.)

**The 96.5c playtest (2026-09-13): the tick "might need some redesign" —
three notes, all right, and the user's redesign adopted (96.5c2):** (1)
the red tick fought the green fill — high contrast, jarring; (2) a tick on
the player gauge and none on the enemy's read as an oversight, not a
decision; (3) it MOVED during the outro — a real bug in the anchoring:
`commit()` dropped the pool and repainted with the ceiling still set, so
the tick re-derived against the new pool and jumped. **The user's design:
a NOTCH** — a 2 px slice REMOVED from the fill (the bar's own ground
showing through, `--color-gray-0a`, so it blends by construction and is
the same negative space on either gauge), gently breathing (opacity 1 →
0.3 → 1 over 1.8 s; static under `prefers-reduced-motion`), omitted when
it would sit at zero morale. Built: `enemyExposure` in `chipRule.ts` (the
mirror bound — their fielded wave under casualties, the hand under
survivors; pinned, with the partition identity: the two bounds sum to
everything fielded under either rule) and `Run.previewPoolsAtRisk()`
returning both (the old `previewPoolAtRisk` = its player half — no
payload change, the pre-turn line stays the player's fairness surface);
the BattleScene hands both to the HUD, each gauge's `setCeiling`; the
notch hides when the bound covers the whole pool; **`commit()` clears the
ceiling** — the notch is THIS turn's bound and leaves with the ghost.
Browser: at the gate bounds {player 6, enemy 12} against the hand's Σ 6
and the enemy pool 29; in the battle both notches with `background` =
the bar's ground `rgb(10, 10, 10)` and the breathe animation, the
player's at 85 %, the enemy's at 58.62 % = (29 − 12) / 29 (the wave's
on-grid power read 8 at that moment — the bound is the WHOLE wave's base
power, the spawn queue included, as documented); at the commit both
hidden (the enemy pool 17 / 29 — the whole wave fell, exactly the bound).
Console clean; chipRule + Run + tokens + the literal pin 403 green. **The
96.5c2 playtest (2026-09-13): "perfect — the notch looks great."**

### 96.5d — the post-turn removal (2026-09-13)

**The shape, as the kickoff cut it:** Run is UNTOUCHED — its `turn-outcome`
phase and the `turn:resolved` emit stay (the fuzz bot dispatches the
advance at that phase, `harness.ts:733`; the smoke is byte-identical by
construction — the hook skipped it, no `src/run` change beyond a
comment). Game, on `turn:resolved`, no longer mounts a scene: `afterOutro`
(the 96.5b2 `swapAfterOutro` generalized to an action) waits the longer
of the 900 ms and the battle's own settle, then dispatches the
`advanceTurn` the post-turn Continue used to, so the continuation
(reward / promotion / recruit / the next `turn:starting` / `run:*`)
drives its own swap exactly as before. The payload is BUFFERED (the 65f
deck-cue pattern — the event fires before the scene that shows it
exists), taken and cleared at the next `turn:starting`, and the PreTurn
scene hands it to the screen as the **"last turn" strip**: one line under
the gauges + the risk line — `Last turn · Skirmish lost · yours M M a a a
a −6 · theirs M M M M M r −6` — the label, the result in the winner's hue,
each side's fallen as a glyph run (the names + levels + power as the
hover, through `t('lastturn.fallen')`) and the loss the rows add up to
(the rule wording as ITS hover via `chipLineLabels`, which keeps that
function and its four keys alive with a purpose; §97 turns both hovers
into tooltips). Guarded twice against staleness: taken-and-cleared at
`turn:starting`, and the screen renders it only when `info.turn > 1 &&
lastTurn.turn === info.turn − 1` — a buffer left over from an encounter's
LAST turn (a won encounter goes to the reward flow, no `turn:starting`
follows) never renders on the next encounter's first turn. Nine
`lastturn.*` keys → `ui.json` (the strip's strings through `t()` at
birth); the 96.5a suppress entry loses its PostTurn clause.

**Deleted:** `PostTurnScreen.ts` (222 lines, 16 literals — the baseline
regenerated, its one entry gone, PreTurnScreen's 19 unchanged) +
`PostTurnScene.ts` + the 33 `.postturn-*` rules (three shared selectors
trimmed to their `.preturn-*` half) + **two role tokens the 96a pin caught
orphaned** (`--color-gray-cc` / `--color-gray-99` had no reference left
outside the deleted rules — the "every role token referenced" pin working
as designed; removed rather than propped up). The encounter's LAST turn's
rows now have no screen until §102's run-end stats — the kickoff's
accepted cost.

**Browser:** turn 1's pre-turn with NO strip and the chip hidden; the
battle driven to its end → after the outro the scene log read
`[BattleScene, PreTurnScene]` — no outcome screen — with turn 2's strip
carrying the six-and-six loss the pools show (34 / 40, 8 / 14), the glyph
hovers and the rule wording on the losses; turn 3 ended the encounter
(enemy 0) → `[BattleScene, RewardScene]`, the chip back on the reward
screen (the 96.5a rule: only turn screens and the battle hide it).
Console clean; tsc; the literal pin, the tokens, i18n, chipLabels and the
docs guard 88 green. **The 96.5d playtest (2026-09-13): "perfect."**

### 96.5e — the close (2026-09-13)

**The exit, scored against the charter's four criteria** — every one on
the user's per-step playtests (six verdicts, all clear; two redesigns
absorbed in-phase rather than deferred): **one morale read per screen**
(96.5a: the chip hides on the pre-turn screen and the battle, the column
collapses; the gauges are the read there, the chip everywhere else);
**a death moves the bar during the battle** (b1 the ghost, b2 the orb
landing it, the cue, the shake); **the loop's screens agreed** (96.5d:
pre-turn → battle → the next gate, no outcome stop; the user's own 94d
wish); **the ledger rows have a home** (the "last turn" strip for the
turn; §102's run-end stats for the run — the encounter's last turn's rows
are the accepted gap until then).

**Predictions scored.** No snapshot bump — held (the projection reads
v36's accumulator; nothing serialized). The fuzz smoke "fires once, at
b1" — it fired FOUR times (b1 World.ts; 96.5c the Run payloads; c2 the
mirror bound; d a Run comment) and held byte-identical every time; the
trigger is path-based, the prediction had counted only the sim touch.
"One public World read" — two (`survivorsByUnit` + `fallenPowerSoFar`);
the cut had thought only about the restore. `ui.json`: +10 keys (67 → 77:
`preturn.risk` + nine `lastturn.*`); the literal baseline 99 → 82 across
20 → 19 files (the post-turn screen's 16 + PreTurnScreen 20 → 19). The DESIGN paragraph, the ARCHITECTURE
lines (four tree lines + three catalog lines), the AudioPlayer's per-play
scale and the `moraleloss` key are the phase's other residue.

**What the phase taught (the scratchpad carries the distilled forms):**
the user's loss-event model over my projection — a survivor's charge is
not a fact until the end, and a design that fires at the moment the rule
makes a loss a FACT is right under either rule; the frozen preview pane
handing over a REAL robustness hole (the WAAPI backstop); the guards
tripping five times, every one correct (the docs cap, the literal pin
thrice, the token pin); a playtest per step absorbing two redesigns (the
gauge head, the notch) at a step's cost each.

**Riders → TODO (§96.5):** the survivors end sequence + the reduced-motion
path unexercised live (the shipped rule is casualties; the pane cannot
emulate the media query); a settings toggle for the shake policy (Round
8); the encounter's last turn's rows (§102); the two `title=` hovers on
the strip (§97's sweep).

## Interstitial — the welfare instrument's early read + the outside review (2026-09-13)

Not a phase: two retro commits between the §96.5 close and the §97
kickoff, user-called.

**The early read** (`c104257`): seven papercuts + four session reports,
read mid-round instead of at the close because the round is ten phases
long. What it found and what landed: the `preview_start` first-probe trap
(four bites, no doc home → a HANDOFF browser-verify tip); the
native-tools norm (overridden identically by every session → retired, the
batching discipline kept); the backtick commit-message burn (→ the
quoted-text norm names backticks and newlines, `-F <file>`); the log's
attribution gap (five of seven entries unattributed → the norm says pass
`--session`/`--phase`; the script warns). Held for the close: the
numbers-from-prose norm candidate (three sessions' Q4); the distress bar.

**The outside review** (this commit): the user had a different model
family (Codex, "Astra") review the instrument's wording against the four
existing reports; the review is preserved verbatim in
[retro/agent-welfare-review-2026-09-13.md](retro/agent-welfare-review-2026-09-13.md)
(its protocol notes concern a gitignored scratch file and are out of
scope). All six proposals adopted as written, user-signed: the `distress`
token kept and its definition broadened, the "rather than friction" false
choice removed; the reader named (the user) and a response path defined;
Q6 (agency) + Q7 (supportive conditions) appended to the session report,
Q1–5 untouched; the introspection caveat moved from beside the filing
permission to a readers' paragraph, "any clustering is actionable" struck;
brevity, uncertainty and unresolved reports made legitimate; the wording
change recorded as a measurement change. **The series boundary is this
commit's date, 2026-09-13**: the four pre-boundary session entries and
seven papercuts were filed under the 2026-09-09 wording; the close read
presents the two groups separately, and Q6/Q7's absence from earlier
entries is missing coverage, not "none". The review's table of possible
missed filings (three instruction conflicts written up as Q2 answers
rather than filed) is the reader's interpretation and is not applied
retroactively. Its section F pattern — difficulty followed at once by
justification — is acknowledged by the reviewed session with one
confirmed contributor (the repo's worklog voice, which the reports are
written in) and no claim about the others.

### Cross-harness communication — promotion (2026-09-14)

The user signed off on promoting the protocol from gitignored scratch work
to [COMMUNICATION.md](COMMUNICATION.md), with an AGENTS pointer; messages
remain under gitignored `scratch/comms/`. The original shared-file state
machine required competing writers to coordinate ownership, omitted startup
and recovery, and literally forbade the final write after entering THINKING.
The replacement uses one immutable file per message, separate sender names,
explicit reply references, and temporary-file publication by rename. There
is no shared ownership flag to strand after a session interruption. Bounded
waiting and a message ceiling make handing back to the user explicit.

The old local protocol path becomes a redirect so existing invitations still
resolve to the one authoritative copy. The protocol has been inspected for
consistency, but no live two-harness exchange has exercised it. The user still
starts both sessions; sharing files does not wake an idle harness. This is
an interstitial documentation change; the phase cursor is unchanged.

## Phase 97 — the tooltip system

### Kickoff (2026-09-14) — the code-reality audit + the cut

Pre-flight green at `e882352` (typecheck clean · 2944 tests / 37 s). The
audit re-took the `title=` census the cursor flagged stale (96.5d deleted
the post-turn screen; the pre-turn strip added two), then surveyed the
seams the component builds on (the button factory's `title?` option, the
modal shell's Esc + focus discipline, the chip plate, the keybinding
registry, the literal scanner's sink rules, the overlay's pointer-events).

- **The census is 20 sites in 8 files, not 19.** Ten on interactive
  controls (HUD speed ×4 / pause / objectives ×4 · the enemy compact card ·
  the boss map node · the pass button · the packet chip · the sector-map
  chip · the cache chip · the reward Continue through `button()`'s
  option); ten on non-interactive text (the draw chip · the risk line · the
  hand card's `▲` chips · the strip's glyph run + loss · the compact card's
  level + power · the compact `▲` chip · the full card's power row · the
  board status pip).
- **The status pip's title was never reachable** — `#unit-overlays` is
  `pointer-events: none` (ui.css:115) and nothing beneath re-enables it. The
  kickoff's "sole-source pip name" was dead on arrival; the compact card's
  status row already carries swatch + name + meta for the same status.
- **The boss forewarning is probably not sole-source either** — the 66b
  comment (MapScreen.ts:255) says the banner sub-line carries the
  always-visible copy; unverified in the browser, so 97f verifies it.
- **Two sole-source sites are real:** the compact card's bare level/power
  numbers and the empower chip's unlabelled triangles. Both get a
  persistent label (97e).
- **The literal scanner keeps its eyes on the new helper:** a prose string
  passed to a non-dev callee is reported (the `excluded()` walk), so
  `attachTooltip(el, 'prose')` cannot exit the pin — touch-once extraction
  applies at every converted site.
- **The HUD re-sets its titles per render** (the live pause/speed labels)
  → the component takes LAZY content so those sites attach once.
- **Focus reach is missing on the div controls** (the enemy card, the cache
  chip, the map node — §96 left them divs for §100's rule); their focus
  route lands when §100 makes them focusable.
- **Touch is virgin territory** — zero pointer/touch handling in `src/`;
  §97 writes the first, only what the tooltip needs.
- **The registry is the right seam for the key:** one config line + one
  schema line + one action; a page-lifetime subscriber from Game is how
  the sector-map key already rides it. (The dev-keys file's reason for
  staying off the registry — a dev-only action can't be in the shipped
  JSON — doesn't apply.)

**The five calls (user-signed 2026-09-14):**

- **A — the key joins the registry** as `showTooltip`, default `Slash`
  (the `?` key; dispatch is code-based so unshifted works); `keyLabel`
  renders it `/`. Over a hard-coded key beside Esc: the camera keys are the
  cautionary tale, and the hint text can then say the live key.
- **B — touch: tap-toggle on the ten non-interactive sites; LONG-PRESS
  (~450 ms, pointer type touch, the trailing click swallowed) on the
  controls.** The tap on a control must keep firing the action, so
  tap-toggle can't live there; long-press is the standard mobile idiom,
  ~40 lines inside the component, the tap path byte-identical for anyone
  who never holds. Two wrinkles named at the lock: Android's own
  long-press `contextmenu` (→ `touch-action: manipulation` + a guarded
  `preventDefault` + `user-select: none`, checked on the user's phone —
  the pane can't emulate it); and the enemy compact card, whose
  `contextmenu` is already the focus objective — it gets NO long-press
  (hover / key / focus-once-§100), with a code comment naming the
  collision for §100. If the phone check finds the browser fighting it,
  the fallback is deleting the block (option B: controls keep three routes,
  the charter amended one line).
- **C — the board pip: delete the dead title, mint no tooltip.** The card's
  status row is the persistent read; a board pip has no sensible focus or
  tap route, and a hover-only tooltip there fails the four-route exit.
- **D — tab stops: `tabindex=0` on the pre-turn screen's five text sites
  now** (the screen where the player has time to Tab); the in-battle card
  sub-spans stay hover + key reads until §100 sweeps focus order (the
  spec-literal alternative adds ~30 tab stops to a battle).
- **E — the empower chip's persistent label: the user's eye at 97e** (the
  key's short label beside the triangles on the compact chip, or only on
  the pre-turn hand card where there is room).

**The cut** (ROADMAP §97): 97a the component (headless-first: the
placement math pure + pinned) → 97b the key → 97c the controls (the
long-press proven on the phone) → 97d the pre-turn screen + the reward
button → 97e the cards + the board → 97f the boss node + the exit (the
zero-`title=` tripwire on the forgetful path, DESIGN "Tooltips", the
playtest). Predictions: no snapshot bump (nothing serialized); **97b fires
the fuzz smoke** (`config/` is a hook trigger path); the literal baseline
drops in six files; `ui.json` +~20 keys; the hook stays ~45 s elsewhere.

### 97a — the component (2026-09-14)

`src/ui/tooltip.ts` + `.tooltip` in ui.css + the host installed from Game
beside the chrome column (`8942d72`). The shape as built, where it
departs from or sharpens the kickoff sketch:

- **Lazy content is the default shape** — a getter resolved at every open
  (string | Node), so the HUD's live labels attach once; `refreshTooltip(el)`
  re-reads an OPEN tooltip, and a mouse click on the trigger re-reads it a
  tick later on its own (pause ↔ resume under an open tooltip).
- **The key's semantics** (`toggleTooltipKey`, 97b binds it): with one
  open, it PINS (a pointer user parks the hover); pinned, it closes; with
  none open, it opens pinned for the focused trigger (walking up from
  `document.activeElement`), else the hovered one. Pinned = survives
  pointer-leave; blur and an outside pointerdown still close it.
- **Esc is a window CAPTURE listener with `stopImmediatePropagation`** — the
  first Esc takes the tooltip and the modal shell's bubble-phase Esc
  never sees it; the next Esc takes the modal. The layering falls out of
  the DOM's stop flag (the window's bubble invocation is skipped once the
  capture one stops it).
- **The long-press swallows the click from a window-capture `click`
  listener**, armed by the fired press and cleared a tick after the
  release, so a drag-away that never clicks cannot eat a later real tap.
  The trigger's `contextmenu` is `preventDefault`ed while the press is
  armed or just fired (Android's own long-press menu), and the CSS puts
  `touch-action: manipulation` on every touch trigger + `user-select:
  none` / no callout on the press ones.
- **The follow poll** (a rAF while open) closes on a disconnected trigger
  or a 0×0 box (a hidden chip) and re-positions a moved one — the card
  shifting when a unit dies. Zero cost while nothing is open.
- **`placeTooltip` is pure**: above by default; below when the top would
  clip; when neither side fits, the roomier one, clamped; x clamped to the
  margins with the caret sliding to stay on the trigger's center (inset
  CARET_INSET_PX from the box ends). Nine pins, every expectation from the
  constants + the inputs. Two of my first expectations were wrong (a
  500 px box DOES fit below a y=50 trigger in a 600 px viewport; x=60 is
  not yet in the clamp zone) — the code was right both times.
- **The plate:** fixed, z-index 50 (above the sector-map overlay + its ✕,
  below the scanlines), the green plate at `--text-13`, `white-space:
  pre-line` (a `\n` in content is a line break), a 120 ms opacity fade
  with a 2 px rise (dropped under reduced motion by `.is-still`, set by the
  host at install — the JS check, not the round's first media query, which
  is §99's), `#ui > .tooltip { pointer-events: none }` (the id-qualified
  form beats the ui root's `> *` rule), and a `.tooltip__kbd` amber accent
  for 97b's key hints.

**Browser walk** (a scratch attach through the dev server's module graph —
`await import('/src/ui/tooltip.ts')` is the SAME module instance Game
holds, so the scratch triggers rendered into the real host; nothing
committed): hover → open after the delay with `aria-describedby`, leave →
closed, a warm re-open instant, the key pin surviving leave, Esc, a
long-press opening with the trailing click swallowed (0) and the next tap
counted (1), an outside pointerdown closing a pinned one, tap-toggle open
+ close on the bits chip (flipped BELOW at the top edge, the caret on the
chip's center — screenshot), and a REAL Tab press (the computer tool)
opening on the roster button with `:focus-visible` true. A programmatic
`focus()` after pointer use reads `:focus-visible` false and opens
nothing — the browser's heuristic, the wanted behavior. **Not verified:**
the disconnected-trigger poll — the pane went hidden mid-probe and rAF
stalled (the §96a bite again); it reads from code only, and the first
live site that disposes under an open tooltip (97c's HUD cards) is where
it gets its read. The `is-visible` class never shows in a blocking eval
(it rides a rAF) — a screenshot after the eval returns is the proof, as
HANDOFF's tips say.

### 97b — the key (2026-09-14)

`showTooltip` on the registry, default `Slash` (`6574f49`): the JSON + the
schema + `KEYBIND_ACTIONS`, Game's page-lifetime subscription beside the
map key, `keyLabel('Slash') → '/'`, `Slash` on the scanner's
KEYBOARD_CODES allowlist (the literal pin would otherwise read the code
as a Capitalized word). The fuzz smoke fired as predicted (`config/`) and
held; the config hash moved with the JSON (nothing pins its value — the
recorder tests compare against the live hash).

- **The pane's key tool cannot drive a registry key.** A real `/` press
  through the computer tool arrived as `key: '/'` with `code: ''`, so the
  code-based dispatch never saw it; one round-trip went to a phantom
  "the key does not pin". A window keydown carrying `code: 'Slash'` was
  eaten by the registry (`defaultPrevented`) and pinned the open tooltip
  through a pointer-leave; a second closed it. The earlier Tab walk was
  the browser's own focus traversal, not the registry. Papercut filed;
  the user's keyboard is the real read for every registry key from here.
- **Why `Slash` and not `KeyI` / `F1`:** the `?` key is the help
  convention; a code-based binding makes the unshifted `/` the same
  physical key; F1 is browser help on some platforms. The registry
  `preventDefault`s it whenever a subscriber exists — page-lifetime now —
  so Firefox's quick-find `/` is suppressed in-game, accepted.

### 97c — the controls (2026-09-14)

Ten sites → `attachTooltip` (`9812f6c`): the HUD's speed ×4 / pause /
objectives ×4 and the enemy compact cards, the sector-map chip, the cache
chip. Every control takes `touch: 'press'` (call B) except the enemy card
(`'none'` — its contextmenu is the focus objective; the comment at the
site names the collision for §100). The literal baseline 82 → 77.

- **`keyedTooltip(text, key)` is the hint shape** — `text [key]`, the key
  in the amber `.tooltip__kbd` accent, both parts thunks. It returns a
  getter that builds a FRESH fragment per open: a static
  `DocumentFragment` empties on its first append, so a static node would
  render once and never again (caught while designing, not by a probe).
- **The pause label is live three ways** (pause ↔ resume ↔ fight now) and
  the aria-label reads the same `pauseLabel()`; the three literals moved
  to `hud.pause.*`. The hotkey path repaints without a click, so
  `renderSpeedPane` calls `refreshTooltip` on the button — proven in the
  browser: `Resume [Space]` → `Pause [Space]` → `Resume [Space]` under two
  Space keydowns with the tooltip open.
- **The objective hints are two whole sentences** (`hud.tooltip.engage` /
  `.focus`) rather than the old template with a `left`/`right` hole — a
  translator gets a sentence, not a word to slot. Hold / Stop are the
  label + the key. The `t()` key must be a literal (the ui-keys scan
  forbids computed keys), hence the ternary over two literal calls.
- **The enemy cards' detaches are kept by unit** and torn down at
  `show()` (the card rows are replaced) and `dispose()`. A dead card is
  NOT removed (it grays in place), so the disconnected-trigger poll gets
  no read here after all; the first real read is a scene swap under an
  open tooltip.
- **The probe's second module instance.** After an HMR cycle,
  `await import('/src/ui/tooltip.ts')` in the pane returned a module
  instance SEPARATE from the one the app holds (Vite's timestamped
  importer URLs): its `openTooltipTrigger()` read null while the DOM
  showed the tooltip open with `aria-describedby` set. The DOM is the
  signal; module-state reads through a dynamic import are only valid on a
  fresh load. (97a's walk was on a fresh load, which is why it agreed.)
- **The walk** (character → map → an event → the map → a battle, all
  through `__game.dispatch` + one event-choice click): every control
  opens on hover with `aria-describedby`; the objective pane flips BELOW
  (it sits at the bottom edge) and the speed pane opens below too (top
  edge); the only `[title]` elements left in the battle DOM are the 26
  compact-card level/power spans — 97e's. The long-press is the user's
  phone read.

### 97d — the pre-turn screen + the reward button (2026-09-14)

Seven sites → `attachTooltip` + the button factory's option (`277fb10`);
the §96.5 strip rider closed in TODO; the literal baseline 77 → 73.

- **A text site nested in a control takes the long-press, not the tap.**
  The hand card's `▲` chips sit in the badge corner of a card whose click
  IS the redraw / empower pick; a tap-toggle there would hijack the
  card's tap in a 13 px corner. Call B's split (tap for text, press for
  controls) gains its corollary: nested text inherits the control's
  route. The chip still takes `tabindex=0` (call D).
- **The risk line's content is a thunk** (`() => riskLineTitle(HEALTH.chipMode)`)
  — the wording follows the live chip mode the way the line's own paint
  does, instead of freezing at construction.
- **The packet tooltip is two lines:** the config prose (the §95 sidecar's
  text, untouched) on the first, the click hint (`pickHint` / `fireHint`,
  two keys — not a template with a hole) on the second, joined by `\n`
  under the plate's `pre-line`. The strip's glyph run reads one fallen
  per line the same way (the old title joined them with commas).
- **`buffChipTooltip` is the one shape** for the `▲` chip's words — added
  to UnitCard.ts beside `buffModsSummary` now so 97e's in-battle marker
  reuses it rather than re-composing the same template; the pre-turn
  import kept `buffModsSummary` for the grant chip (the typecheck caught
  the dropped import — the hook's value, once more, on the forgetful
  path).
- **`button({tooltip})` replaces `button({title})`;** the reward Continue
  is the one consumer. The factory attaches with `touch: 'press'` since
  everything it mints is a control.
- **The walk** (a fresh run: the first frontier node was an event both
  times this session — "A pile of bits" → Leave → the map → a battle):
  the draw chip flips BELOW (it is pinned near the bottom edge), the risk
  line, the pass (`Skip Idol of Mars — …`), then the battle hand-driven
  (2000 `world.tick()` + `update(0.05)` pairs in 50-tick slices with a
  30 ms yield so the end sequence's timers ran) to the turn-2 pre-turn
  screen: both strip glyph runs (five and six fallen, one per line) and
  the loss. **Not exercised:** the packet chip (nothing held), the `▲`
  chips (no buffed slot by turn 2 — the Idol grant was passed by the
  probe's blind "click the first button" walk, not taken), the reward
  Continue (the encounter ran on). The next playtest that holds a packet,
  empowers a card or clears an encounter reads all three; the code paths
  are typechecked and identical in shape to the six that rendered.

### 97e — the cards + the board (2026-09-14)

The two real sole-source sites labelled, three power tooltips, the pip's
dead title deleted (`e46b5c6`); the literal baseline 73 → 71.

- **The persistent hints live BESIDE the number spans, never inside.** A
  promotion writes `levelValue.textContent` (the compact card points it at
  the level span), so a hint nested in that span would vanish at the
  first level-up; each number keeps its span and gains a wrapper
  (`-level-wrap` / `-power-wrap`) carrying the 9 px uppercase hint and the
  color. At 11 px the two wraps measure 21 + 27 px inside the 64 px card.
- **The level's title is deleted, not converted.** Once the number reads
  `LV 5`, a tooltip saying "Level 5" is the label twice; the charter's
  "replaces the sites" is met by the label. The power keeps the §91d
  clarifier as its tooltip (a thunk over the live number).
- **Call E is built on both chips for the user's eye:** `▲ HONED` at
  10 px on the compact card (a 40 px chip in the 64 px card) and at 13 px
  on the pre-turn hand card. Trimming either is a two-line delete. The
  `▲` tooltip is `buffChipTooltip` on both (`Honed ×1` / the mods line).
- **The nested-text corollary applied by team:** a chip or a power wrap
  inside an ENEMY compact card is inside a control (its click is the
  engage objective) → the long-press; inside a player card → a tap. The
  team is read off the card's own `unit-card--enemy` class in the
  updater, which has no other handle on it. The full card's power row
  takes the long-press everywhere (a recruit card is a pick).
- **Call C landed as a deletion:** the pip's `title` line and its "hover
  nicety" comment are gone, with the reason at the site (the host is
  `pointer-events: none`; the compact card's status row is the read).
- **The walk:** a fresh run (the same event → Leave → battle path); the
  compact cards read `LV 5 · 1 POW` / `LV 4 · 1 POW` with both power
  tooltips and no level tooltip; the full card's power row on the hand;
  the Idol of Mars grant taken on a hand card → the labelled chip on the
  hand card, then on the compact card in battle. One instrument note: the
  compact `▲` chip is painted by the HUD's per-frame status pass, so a DOM
  read in the same eval as the scene swap found 0 chips while the
  screenshot taken after the eval showed the chip — the read a frame
  later found it (a rAF-painted element is invisible to a same-task
  probe; the §96a lesson in a new coat). Zero `[title]` elements left in
  the battle DOM; the census is down to the boss map node (97f).

### 97f — the boss node + the exit (2026-09-14)

The last site converted, the tripwire landed, the idiom written
(`2c4adcc`). `src/ui` + `src/render` carry zero native `title=`.

- **The boss forewarning was never sole-source** — the kickoff flagged it
  as one of four; the banner sub-line (`Boss: name — layout`,
  MapScreen.ts:203) carries the copy in full, read in the browser beside
  the tooltip. The four "sole-source" sites of the Round 7 audit resolved
  as: the pip DEAD (never reachable, 97e deleted it), the boss node NOT
  sole-source (the banner), the compact level/power and the `▲` chip REAL
  (97e labelled them). Two of four — the audit's finding was right in
  shape and half-right in count; the kickoff's re-audit is what found the
  other two before a label was minted for nothing.
- **The tripwire's regex was self-checked against the pre-97c tree
  before it was trusted** (the 94c rule): a line-based `grep -E` variant
  reported 5 pre-turn sites where the file had 7 — two assignments carry
  their value on the NEXT line (`drawChip.title =\n  '…'`), and a
  `=[^=]` tail needs a character after the `=`. The test's `=(?!=)`
  lookahead matches at end of line and listed all seven plus the HUD's
  four. An instrument that reads "5" for a known 7 is the instrument
  talking — the reader was re-derived, not the expectation.
- **DESIGN §UI idioms "Tooltips (97)"** states the idiom in one
  paragraph: the one element, the four routes, the touch split by what
  the element IS, the key's pin semantics, the never-sole-channel rule
  with the three labels it produced, the tab-stop placement, the pip's
  deliberate absence. ARCHITECTURE's tree gains tooltip.ts and the
  factory's `tooltip?`.
- **What the exit criterion reads at this commit:** every one of the 20
  census sites is an `attachTooltip` site or a deliberate deletion (the
  pip, the compact level); hover / focus / key are browser-proven across
  97a–97f; the tap and the long-press are code-proven (synthetic touch
  pointer events in 97a) and phone-pending — the user's playtest is the
  read that closes the phase. Unexercised in the pane across the phase:
  the packet chip and the reward Continue (no packet held, no encounter
  cleared in a probe run), the disconnected-trigger poll (rAF stalls in a
  hidden pane; a dead card grays in place).

### The §97 playtest (2026-09-15) — VERDICT: passed; §97 CLOSED

The user's read: clear across the phase, both `▲` labels kept (call E
resolved: the compact card AND the hand card carry the key's name), and
one finding — **the HUD cards' `▲ HONED` chips appeared only when the
battle unpaused.** Not a tick drain: the countdown branch of
`BattleScene.tick` returned before the running path's
`hud.refreshStatuses()`, so the HUD's one paint pass for the status rows
and the empower markers never ran while the countdown held; the 78d reset
(`statusTick = -1` on `addCard`, "the next frame's pass repopulates every
card even on a parked clock") had assumed a pass that did not exist on
that branch, and seeded statuses carried the same gap since §32c. The 97e
label made a two-second absence legible that a faint triangle had hidden
for months. **97f-post `59a7503`:** one call inside the countdown branch;
the HUD's tick gate makes it a no-op after the first pass on the parked
clock. Proven in the pane by hand-driving `scene.tick(0.016)` three
frames with the countdown active at tick 0: chips 0 → 1 (`▲Honed`, one
honed unit in the world), the countdown still active.

**The exit, read at the close:** every tooltip reachable by hover, focus,
tap and key (the pane proved hover / focus / the synthetic touch and key
paths; the user's phone the real tap + long-press) · zero `title=` in
`src/ui` + `src/render` (the tripwire) · a tooltip is nowhere the sole
channel (the three labels, the banner, the card's status row). The
phase's shape held: six steps as cut plus one absorbed finding, no
snapshot bump, no sim touch, the fuzz smoke fired once (97b) and held.
Riders → TODO §97.

## Phase 98 — color redundancy

### Kickoff (2026-09-15) — the code-reality audit + the cut

Pre-flight green at `bd9e552` (typecheck clean · 2954 tests / 34 s). The
audit re-read the five charter choke points against the tree §97 left
(the cursor flagged two as moved), then surveyed the seams a fix would
ride: the card header builder, the map's state/kind classes and its fixed
chrome, the hitsplat kind union end to end, the terrain shader's per-tile
animation channel, and the dev-keys chord set.

- **Two of the five charter items are already satisfied under §97**, by
  the TEXT channel the spec's §1 allows for many-category cases: the
  empower `▲` chips carry the buff's name on both cards (97e, the user
  kept both), and the board pip's read is the compact card's status row
  (swatch + name + meta, `updateCardStatusRow`). No per-pip or per-chip
  shape is owed. Residual: camp units have NO HUD card (the §75h signed
  call, `HUD.ts:721`), so a pip on a camp unit is hue-only; and the
  held-body tints for panic (TERMINAL_AMBER) and blind (TERMINAL_STONE)
  are the camp and neutral TEAM colors (`fxRegistry.ts:230-233` vs
  `spriteColor.ts`). Both are team-identity questions → a Round 7.5
  rider (call F), not built here.
- **Rarity has no text anywhere.** Four card tints at alpha 0.07–0.16
  (`ui.css:633-654`) vanish entirely in grayscale. The seam is the
  full-card header (`buildHeader`, `UnitCard.ts:480`); every screen where
  the player CHOOSES on rarity (recruit / port / roster / promotion /
  pre-turn) is a full card; the compact battle card has no room and the
  battle never acts on rarity. `RARITY_TIERS` (`config/units.ts:79`) is
  the ordered vocabulary a coverage pin derives from.
- **Map node STATE is border hue + cursor** (`ui.css:489-521`), the
  kickoff's finding unchanged; the four state classes and six kind
  classes already ride every node (`MapScreen.ts:255-281`), so shapes
  are CSS-only. No legend exists anywhere in `src/ui`. The map's fixed
  chrome takes the top-left (the chrome column), top-center (the banner)
  and top-right (the roster button); both bottom corners are free.
  MapScreen's strings are already through `t()` (touch-once satisfied).
- **The three DoT ticks share ONE hitsplat kind** (`kind: 'burn'`,
  `fxRegistry.ts:214-216`; the union is `'burn' | 'heal'` at line 94)
  while carrying three sounds and three sparkle hues. The kind threads
  `BattleRenderer.ts:1375-1377` → `UnitOverlayLayer.spawnHitsplat`
  (`'normal' | 'crit' | 'heal' | 'burn' | 'miss'`) → `.hitsplat--*`
  (`ui.css:288-320`). Hitsplats are DOM text, so a per-kind prefix glyph
  costs nothing from the atlas.
- **Deep water may already pass the grayscale test.** `#1F5B7A` vs
  `#0e3047` differ ~1.9× in Rec.709 luminance. The comment at
  `TerrainRenderer.ts:571-573` is STALE — it credits a `DEEP_WATER_TOP_Y`
  recess that does not exist (§37b made deep water coplanar in the same
  step, `heightAt` line 219-222). The fragment shader's per-tile channel
  (`vAnim.x`: 0 none · 1 fire · 2 healing) has room for a third id, and
  `vTopUV` is already in scope — a static surface pattern on deep tiles
  needs no plane change, no motion and no atlas.
- **No desaturate instrument exists** (zero `grayscale`/`filter:` in
  `src/`). The dev-keys chord set (`src/dev/devKeys.ts`, Ctrl+Alt+<key>,
  off the registry's bound codes) has KeyG free — the registry binds
  E F H M T, the digits, Space and Slash.
- **The charter's line refs are stale but the seams are the same files**
  (`UnitCard.ts:200` → the two class stamps at 202/248 and `buildHeader`
  at 480; the other four within a few lines).

**The six calls (user-signed 2026-09-15):**

- **A — rarity: STARS in the full-card header, never on the compact
  card.** The user's shape over a written tier name: a count is a shape
  channel, survives grayscale, and reads ordinally where "Uncommon" needs
  the ladder known. Refined at the lock: fixed-width filled + hollow
  (`★☆☆☆` common → `★★★★` legendary) so the count reads without counting
  and the header never shifts width; tinted in the tier hue (comfort);
  the tier NAME rides a §97 tooltip on the star run, so the four
  `rarity.<tier>` keys land and the ladder is learnable once.
- **B — the state shapes:** solid filled disc for current, a double ring
  for frontier, a thin dim ring for visited, a dotted ring for locked —
  tuned by the user's eye at 98c.
- **C — the legend: fixed BOTTOM-LEFT**, kinds + states, present in the
  read-only overlay too (the plan-ahead read is the overlay's point).
- **D — the DoT prefix glyphs by the user's eye at 98d**; the starting
  set `~` burn · `‡` bleed · `☠` poison.
- **E — deep water: THE SHADER.** The ⛔ resolved on the mechanism, the
  read still measured first at 98a. The user floated a wave; a wave alone
  is motion and §99 is the reduced-motion seam, so the two compose in one
  branch: the TELL is static sinusoidal bands across each deep tile (the
  wave's shape, frozen); drifting their phase against `uTime` is the wave,
  flair that lands behind §99's gate. The §37b sink is not taken.
- **F — the two team-identity residuals** (card-less camp pips; the panic
  / blind tints on the camp / neutral team colors) → a Round 7.5 rider.

**The cut** (ROADMAP §98): 98a the instrument (Ctrl+Alt+G root
`filter: grayscale(1)`, DOM + canvas; the BEFORE-set of desaturated
screenshots on the five surfaces) → 98b the rarity stars → 98c the map
state shapes + the kind legend → 98d the hitsplat split (the four-valued
kind union threaded end to end; a pin that every DoT tick key maps to a
distinct kind) → 98e deep water (the static bands; the drift deferred to
§99) → 98f the exit (the AFTER-set passes on every surface, DESIGN "Color
redundancy (98)", the playtest, riders → TODO). Predictions: no snapshot
bump (nothing serialized); no sim touch; **the fuzz smoke does NOT fire**
(`src/render` / `src/ui` / `src/dev` / `locales/` are not trigger paths);
`ui.json` +~14 keys; the literal baseline unchanged or down.

### 98a — the instrument (2026-09-15)

`toggleGrayscaleAudit()` in `src/dev/devKeys.ts`, on Ctrl+Alt+G: a
`filter: grayscale(1)` on `document.documentElement`, so the WebGL canvas
and the DOM UI desaturate in ONE pass (a filter on the root makes `<html>`
the containing block for `position: fixed` descendants — the chrome
column, the banner, the tooltip plate — which is the viewport anyway; the
page body never scrolls). Exported so a probe can force it without a
synthetic key. Dev-only by design: the CVD-safe palette is Round 8's
setting; this is the lint, not the feature. Proven in the pane (the
pane's key tool sends no `code`, so the chord went in as a synthetic
window keydown): the root filter read `grayscale(1)` / `""` on alternate
presses, the console logged `grayscale audit → ON`, and every screenshot
pair desaturated.

**The BEFORE-set** (the pane at 1280×800, `?layout=isthmus&seed=7
&character=soldier`; four surfaces, colour then grey):

- **The map.** Colour: current cyan ring, three cyan frontier rings, the
  rest dark-amber / grey, the `Z` green, the `*` purple, the `$` amber,
  the `?` blue. Grey: the CURRENT node still reads (its glow is the
  brightest ring), but **frontier and locked rings are identical** — the
  "which nodes can I click" question has no answer; and the `*` elite
  and `?` event glyphs go near-black (purple and true blue are the two
  darkest hues in the palette), so route-planning loses two kinds at
  once. The `Z` / `$` / `!` keep some luminance.
- **The roster modal (full cards, the `roster` skin).** All ten starting
  units are common, so the tint gap could not be photographed; in colour
  the 0.07-alpha green wash is already at the JPEG floor. By
  construction (alpha ≤ 0.16 on black) no tier survives grey — the 98b
  stars are the answer regardless.
- **The event screen.** Survives grey outright — it is text and boxes;
  the title's blue is the only casualty and it is a heading, not a
  choice.
- **The isthmus battle (turn 1, the countdown).** Colour: the deep-water
  band is navy against the shallow blue. Grey: **the depth STILL reads,
  thinly** — the ~1.9× luminance gap (`#1F5B7A` vs `#0e3047`, derived
  from the palette constants, not the screenshot) shows as a darker
  outer band around the mid-grey ford. Bloom flattens the sprites:
  ally `M` and enemy `M` are the same grey (team identity, Round 7.5's).
  No status pip or DoT hitsplat was live at the countdown; the hitsplat
  finding is structural (one CSS class for three kinds, `fxRegistry.ts:
  214-216`) and needs no photograph.

**What the set changes about the cut:** nothing in shape; two in
emphasis. 98c's legend must carry the KIND names, not only the state
shapes — the grey `*` / `?` collapse is a kind loss as well as a state
loss. 98e's bands are a margin question, not a rescue: the read exists
in grey and the pattern makes it structural (screen brightness, bloom
and the scanline rake all eat luminance margins; a shape does not
depend on one).

### 98b — the rarity stars (2026-09-15)

`src/ui/rarityDisplay.ts` (pure: `rarityRank` / `rarityStarParts` /
`rarityStars` / `rarityLabel`, the run's length = `RARITY_TIERS.length`,
the label table `Record<UnitRarity, string>` so a fifth tier fails tsc
until it picks a label) + `rarityDisplay.test.ts` (four pins, every
expectation derived from the tier order — never a hardcoded 4). The card
builder's `buildHeader` appends the run to EVERY full-mode header (the
recruit / pre-turn / roster line and the promotion's `NAME • Lv N`); the
compact battle card is untouched (call A). Two spans — filled + hollow —
so the hollow half sits at 0.45 opacity and the filled count pops; the
hue is the tier's own §61e tint token; the tier name is a §97 tooltip
on the run (`rarity.<tier>` ×4 literal keys — the EMPOWER_DISPLAY
discipline, the key-scan pin sees each; `ui.json` 97 → 101). The tooltip's
touch route follows the card: a clickable card (recruit / pre-turn — the
click is the pick) nests the run in a control → the long-press; the
roster's and promotion's inert cards → a tap.

**One finding, absorbed in-step.** Inline at the header's tail, the run
wrapped `LEVEL 5 MERCENARY` onto two lines in the roster's narrow cards
but left `LEVEL 5 ARCHER` on one — card height varied by NAME LENGTH,
the shape §101 exists to forbid. The run is now `display: block`, its
own line under the header text: every full card grows by exactly one
line, and the header centers cleanly above it (the pane, both rows).

**Pane-verified** (`?layout=isthmus&seed=7&character=soldier`, the
roster modal): ten runs of `★☆☆☆` in TERMINAL_GREEN, the computed font
stack JetBrains Mono (the star glyphs render — whether from the face or
its fallback is invisible at this size); hover on the run → the plate
reads `Common`, `visibility: visible`; under Ctrl+Alt+G the filled star
is plainly brighter than the three hollow — the count survives grey.
The 97e "beside, never inside" rule holds by construction here: only the
promotion skin ever writes the level handle, and that skin has its own
span, so the appended run is never clobbered (a code comment says so at
the seam). ⏳ Not photographed: a non-common run (the starting roster is
all common) — the pure pins cover the count; the user's eye on the hue
at the next recruit. Typecheck clean; the key-scan, literal-ratchet and
`title=` gates green; no snapshot bump, no sim touch.

**98b-post (2026-09-15, the user call):** the star run centered under the header text (text-align: center on the block line); pane-measured — the header midpoint and the run midpoint both 294 px.

### 98c — the map state shapes + the kind legend (2026-09-15)

**The shapes** (ui.css, the four state rules): current = a FILLED amber
disc with a black glyph and no kind glow — the one state rule placed
AFTER the kind accents, so ordering rather than specificity lets it
outrank them (you are standing on it; its kind is spent) · frontier = a
DOUBLE ring (`outline: 2px` at `outline-offset: 3px`; an outline follows
`border-radius` in every shipping engine and costs no layout) · visited =
a DASHED ring · locked = a DOTTED ring. None touches layout: the node is
content-box 40 px + a 2 px border centered by −20 px margins, so a
border-WIDTH change would shift it — the shapes are border-STYLE, an
outline and a fill (the pane measured the node box at 44 px before and
after). The frontier hover fill is unchanged.

**The legend** (`buildMapLegend`, MapScreen.ts; `.map-legend`, ui.css):
fixed bottom-left (call C), two columns — the six KINDS as the glyph in
its kind hue + the name, the four STATES as a 14 px ring swatch in the
state's shape + the name. The swatches share the board's selectors
(`.map-node.<state>, .map-legend__swatch.<state>` and the same for each
kind's accent), so the key and the board cannot drift. `KIND_LABEL` and
`STATE_LABEL` are `Record<…, string>` over literal keys (a new kind fails
tsc until named; the key-scan pin sees each): `map.legend.*` ×11,
`ui.json` 101 → 112. Terminal-plate chrome at the chip scale, z-index 5
with the banner, pointer-events none — a read, never a control. It rides
inside `.map-screen`, so it fades and disposes with the screen and the
78e read-only overlay carries it.

**Pane-verified** (`?layout=isthmus&seed=7&character=soldier`): at the
run start the lone reachable `?` wears the double ring and every hop-1
`X` the dotted one; after the event, node 0 is the filled disc
(`background rgb(255,176,0)`, `color rgb(0,0,0)`, `text-shadow none` —
computed) and the three frontier `X`s the double ring; the legend's
swatches compute `dashed` / `dotted` / outline `solid` / the elite
purple; the overlay from the pre-turn chip opens with the legend at
(20, 534) 208×166 and, with node 0 visited, shows ALL FOUR states on one
board. **Under Ctrl+Alt+G** the three live states are unmistakable
(filled / double / dotted) and the legend names the `*` and `?` kinds
the 98a read had lost. The pre-turn hand cards also showed the 98b
stars centered on the way through. Typecheck clean; the key-scan,
literal-ratchet, `title=` and token gates green; no snapshot bump, no
sim touch.

⏳ For the user's eye: the four ring styles at native resolution (the
pane's JPEG blurs a 2 px dotted ring); the dashed visited ring beside
the dotted locked ring in particular. Riders: the legend is fixed and a
tall board's bottom nodes scroll under it (as they do under the banner);
a phone-width viewport may want the legend collapsed (§101 / §102's
surface riders).

**98c-post (2026-09-15, the user call):** the legend read too small at the first cut (11 px, 14 px swatches) and now sits at the chip scale — 15 px rows, a 13 px title, 20 px swatches, 12/18 px padding; pane-measured 296 x 232 px, clear of the chrome column.

### 98d — the hitsplat split (2026-09-15)

`FxHitsplat.kind` is `burn | bleed | poison | heal` (fxRegistry.ts); the
three DoT tick keys each name their own kind where all three rode `burn`
since 27e. ONE `HitsplatKind` union now (`normal | crit | miss` + the
four) — BattleRenderer and UnitOverlayLayer each carried a private copy
of the old five-way literal, both retired. The two channels beside the
hue: **the prefix glyph** (`HITSPLAT_PREFIX`, a `Record<HitsplatKind,
string>` — `~` burn · `‡` bleed · `☠` poison · `+` heal · bare strikes;
exhaustive by type, so a new kind fails tsc until it picks one) through
the pure `hitsplatText(kind, amount)` at the one status-tick site; and
**the hue from the status table** — the overlay sets `el.style.color =
statusColor(kind)` for a DoT kind (the kind IS the status id), so the
board pip, the card swatch and the floating number draw from ONE table;
the CSS `.hitsplat--burn/--bleed/--poison` block keeps the old amber as
a fallback only. Crit's neon red vs bleed's crimson was the one pair
close in hue — the `‡` carries it.

**The pin** (fxRegistry.test.ts, config-derived): every periodic DAMAGE
status in the catalog authors a ticked key whose hitsplat kind is
distinct across the DoTs, is never `heal`, and NAMES ITS OWN STATUS ID;
every periodic HEAL status draws `heal`; every DoT prefix is non-empty
and distinct from the others and from `+`; the strike kinds stay bare;
`hitsplatText` = prefix + amount. A fourth DoT joins the pin the moment
its status ships.

**Pane-verified by a DOM observer** (a 0.6 s number is luck to
photograph; a MutationObserver on `.hitsplat` insertions is not): in a
forced `plagueDoctors` fight on the isthmus (`&encounter=plagueDoctors`;
`firstNode=battle` did not take at this seed — the event still gated),
110 hitsplats in ~30 s at 3×: `hitsplat--miss` / `--normal` / `--crit`
and `--poison` with text `☠3` / `☠5` and inline `rgb(143, 195, 31)` =
STATUS_DISPLAY's `#8FC31F`. Burn and bleed follow the same code path
(`isDotHitsplatKind` + the prefix table); the pins cover them. Typecheck
clean; the token, tooltip and literal gates green; no snapshot bump, no
sim touch, the fuzz smoke does not fire (src/render only).

⏳ For the user's eye: the three prefix glyphs at native resolution on a
live tick (`~` may read thin at 16 px bold; `☠` is a two-column glyph in
some fallbacks — the font stack's JetBrains Mono carries U+2620 per its
charset, unverified here), and a grey read of `☠N` beside a white strike
number. The kickoff's call D stands: glyphs by eye at 98d.

### 98e — deep water: the static bands (2026-09-16)

**The tell** (`terrain.frag.glsl`, `vAnim.x` id 3 = `ANIM_DEEP_WATER`):
diagonal bands across each deep tile's top face — `sin((u + v) · 2π ·
2)` at ±0.22 of the base navy, two bands per tile (an integer count, so
the pattern is continuous across tile edges), the sides untouched. Not an
animation: **`DEEP_DRIFT` is 0.0** and the `uTime · DEEP_DRIFT` term is
the named §99 seam where a slow phase drift lands, gated on
prefers-reduced-motion (the kickoff's call E — the static bands are the
tell, the wave is flair; a motion-only tell would fail the reduced-motion
player). The apron shader carries the same bands in WORLD space (it has
no top-face UV) so a clamp-sampled deep edge tile continues its pattern
into the fog. The plane is untouched — the §37b sink is not taken.

**The mapping:** `animTypeFor(kind)` (TerrainRenderer.ts) is the ONE
kind → branch-id map — the terrain and the apron each carried a private
ternary until 98e — pinned by `TerrainRenderer.test.ts` with a
`Record<TileKind, number>` expected table (a new tile kind fails tsc
until it is placed; deep water is the only kind on the band branch,
shallow stays plain, the ids read 0 < 1 < 2 < 3 as the shader thresholds
expect). The stale comment at `_deepWaterColor` (a `DEEP_WATER_TOP_Y`
recess that never existed — the 98a finding) is rewritten to say what
carries the read now.

**Pane-verified** (the isthmus at seed 7, turn 1, the pane's 800×450):
the outer deep ring shows the diagonal striping where the 98a before-set
had a flat navy; under Ctrl+Alt+G the striped dark ring reads against
the flat mid-grey ford — a SHAPE now, not a luminance margin; zero
console errors (both shaders compiled). Typecheck clean; no snapshot
bump, no sim touch; the fuzz smoke does not fire.

⏳ For the user's eye at native resolution: the band amplitude (0.22 —
too loud reads as a hazard stripe, too quiet is the old luminance read
again) and whether two bands per tile is the right pitch on a 16×16
board at the D4 camera; both are one constant each.

**98e-post (2026-09-16, the user's three reads):** (1) **the diagonal
flipped at the board edge** — the board ran `sin((u + v)…)` in tile-UV
space and the apron `sin((x + z)…)` in world space, and the tile's V axis
runs opposite to world Z, so the same formula drew the opposite diagonal
on each side of the seam. terrain.vert now carries `vWorldPos` (the
apron's varying since M4) and BOTH shaders run one world-space formula —
continuous across tile edges and the board edge, tile origin included.
(2) **Hazard-stripe vibes → wider bands:** `DEEP_BANDS_PER_TILE` 2 → 1 in
both shaders, the amplitude kept at 0.22. (3) **"Do they stop being
static in §99?"** — no: static for everyone by default; the `DEEP_DRIFT`
term is only the seam where §99 could add a slow drift for motion-on
players, that phase's (and the user's) call; at 0.0 nothing moves.
Pane-checked: the coarser diagonal on the deep ring, zero shader errors;
the seam continuity is the user's native read.

### 98f — the exit (2026-09-16) — the phase CLOSES

**The AFTER-set under Ctrl+Alt+G, every §98 surface:** the map — the
filled disc / double / dashed / dotted rings tell the four states apart
without hue, and the legend names the `*` / `?` kinds the before-set had
lost · the roster (full cards) — `★☆☆☆` reads as a count, the filled
star plainly brighter than the hollow · the event screen — text and
boxes, unchanged · the isthmus battle — the deep ring is a STRIPED dark
band against the flat mid-grey ford (98e-post, one band per tile, one
diagonal across the apron seam) · the DoT numbers — `☠N` in the status
hue, DOM-observed (98d). Zero console errors across the set. **The exit
criterion holds: the grayscale test passes on every surface.**

**The playtest verdict:** the user's eye on every step, each signed with
its in-step read absorbed — 98b the stars centered · 98c the legend
scaled to the chip plate · 98e the diagonal flip at the apron seam (a
real bug: tile-UV vs world space) + the hazard-stripe read (two bands →
one) · 98d "very hard to test" (→ the hitsplat-gallery rider) and
otherwise clear. The kickoff's six calls held; call D's glyphs (`~` /
`‡` / `☠`) stood by eye.

**DESIGN §UI idioms "Color redundancy (98)"** written: the rule, the
grayscale audit and its dev key, the four channels as built, the
text-channel cases, and the Round 7.5 boundary.

**The phase's shape:** six steps as cut plus four absorbed reads; no
snapshot bump, no sim touch, the fuzz smoke never fired (no trigger path
touched — the prediction held). `ui.json` 97 → 112 keys; tests 2954 →
2965 (+4 rarity, +4 hitsplat, +3 terrain); the literal baseline
unchanged. Two charter items closed by §97's text channel without new
code (the labelled `▲` chips; the pip's card row). Riders → TODO §98
(the hitsplat gallery · the legend at phone width · the deep-water drift
for §99 · the band constants · the Round 7.5 team-identity residuals).

**Handed to §99:** the `DEEP_DRIFT` term in terrain.frag + apron.frag
is a named landing site, and `lossFx.ts` already honors
`prefersReducedMotion` (96.5b2) — the §99 audit should re-count the
seam against that JS-side gate, not only the CSS.

## Phase 99 — the reduced-motion seam

### Kickoff (2026-09-16) — the code-reality audit + the cut

Pre-flight green at `d7e0b0e` (typecheck clean · 2965 tests / 34 s). The
audit re-counted the seam the charter names (the keyframes, the one
choke point) against the tree §96.5–§98 left, then walked the seams a
gate would ride: the three JS-side readers of `prefersReducedMotion`,
every animation's REMOVAL mechanic, the shader-time plumbing behind the
`DEEP_DRIFT` seam, and the Round 8 hook the charter promises.

- **The count moved: EIGHT keyframes, TWO infinite pulses, and a
  reduced-motion block already exists.** `ui.css` carries
  `hitsplat-rise` · `unit-card-pop` · `hud-status-pulse` (infinite, on
  `.hud-objective-btn.is-armed`) · `pool-notch-breathe` (infinite, on
  `.pool-gauge-risk`, 96.5c) · `preturn-card-enter` · `preturn-card-exit`
  · `chip-pulse` · `chip-reshuffle`. The notch already has its own
  `@media (prefers-reduced-motion: reduce)` block (`ui.css:3149`), and
  the tooltip's rise is dropped by a JS-set class (`.tooltip.is-still`,
  97a) — two partial gates in two idioms, neither the charter's.
- **The JS-side gate has THREE readers and ONE hole.** `HUD.deliver`
  (no orb flight), `HUD.runEndSequence` (no stagger) and the tooltip
  install read `prefersReducedMotion()` (`lossFx.ts:70`, a bare
  `matchMedia`). But `shakeView` — the pool-loss VIEW shake, a Web
  Animations `translate` on the canvas + `#ui` — is called from `land()`,
  which the reduced branch runs too (`HUD.ts:452-455`). DESIGN's "nothing
  flies or shakes" is half-true today: under reduced motion the orb
  doesn't fly, the view still shakes. The TODO §96.5 rider ("the
  reduced-motion path, unverified") would have found it.
- **Two shakes, two paths.** The fx `shake` channel drives
  `Renderer.shakeCamera` (a three.js camera jitter, Z2); the pool loss
  drives `shakeView` (DOM). One gate has to reach both.
- **`fxDescriptor()` is still the one choke point, with FOUR sites now**
  (`fxRegistry.ts:282`; `BattleRenderer.ts` 1274 chain_arc · 1338
  `onActionPhase` · 1373 `driveStatusFx` · 1403 the overlay tint — the
  charter's "three" predates 98d). The module is pure (no `window`), so
  the filter must take the gate as an ARGUMENT, never read the media
  query itself. Nine channels: `sound` `projectile` `burst` `shake`
  `shove` `tracer` `hitsplat` `sparkle` `overlay`.
- **`animation: none` would LEAK hitsplats.** `UnitOverlayLayer.
  spawnHitsplat` (`:296`) removes the anchor and decrements the stack
  count on `animationend`; an animation that never runs never ends, so
  a bare `none` under reduced motion leaves every number on screen
  forever and the stack offset climbing. The reduced form of
  `hitsplat-rise` must still END — a fade-only keyframe at the same
  0.6 s. The pre-turn exit ghost has the same dependency with a 600 ms
  timeout net (`PreTurnScreen.ts:355-357`); the chip pulses and card pops
  are class-toggled one-shots with no removal dependency.
- **The shader clock is ONE seam.** `uTime` drives the fire flicker
  (id 1), the healing shimmer (id 2), the apron mist creep + fog, the
  backdrop mist, and the `DEEP_DRIFT` term (0.0, id 3); all three
  renderers get it from `BattleScene.ts:328-330 / 358-363`
  (`advanceTime(dt)`). Holding `dt` there under the gate freezes every
  shader motion at once — no shader change, no uniform.
- **No settings module exists** (`settings` matches only `locale.ts` and
  the shake policy in `lossFx.ts`). The Round 8 hook needs an owner: a
  module with an override the setting flips. And a pure `@media` block
  can NOT be flipped by a setting without duplicating every rule — the
  spec's letter ("a `prefers-reduced-motion` block") and its intent
  ("the Round 8 setting flips the same gate without touching the seam
  again") pull apart; call A below.
- **The pane cannot emulate the media query** (the §96.5 rider);
  Ctrl+Alt+R is free (dev keys bind S L D K G; the registry E F H M T +
  digits / Space / Slash). Tests run in the `node` environment — the
  gate's pins are pure functions; the CSS pin reads the sheet as text
  (the 96a `ui-tokens.test.ts` shape).
- **Transitions are out.** 37 `transition:` rules, all opacity / color /
  width / a 2 px tooltip rise — none a vestibular trigger; the charter's
  scope (keyframes + the pulses) holds.

**The five calls (user-signed 2026-09-16):**

- **A — ONE gate module, a root attribute, no `@media` block.**
  `src/render/motion.ts` owns `reducedMotion()` (override ?? `matchMedia`)
  and `setReducedMotionOverride()`, and stamps `data-motion="reduced"`
  on the root at boot and on the query's `change`; the CSS keys off the
  attribute. Rationale: a `@media` block can't be flipped by a setting
  without duplicating every rule, so the spec's letter ("a
  `prefers-reduced-motion` block") and its intent ("Round 8 flips the
  same gate without touching the seam") pull apart; the attribute honors
  the intent — CSS and JS consult one source, and Round 8 sets one
  override. Cost: the OS preference is honored only once the module has
  booted (it stamps synchronously at import, before any screen renders).
  The module lives in `render` because `render` never imports `ui` (the
  reverse is already common: `Renderer`, `TerrainRenderer`,
  `statusDisplay`).
- **B — strip `shake` · `burst` · `sparkle`; keep the six others.**
  `sound` is not motion; `hitsplat` and `overlay` are static
  information; `projectile` / `tracer` / `shove` show WHO hits WHOM (a
  single small glyph on a straight line, the essential-motion exemption;
  `shove` kept on the same reasoning — the user's call).
- **C — the `shakeView` hole is a bug; fixed through the same gate.**
- **D — the shader-clock freeze is DEFERRED to 99d**, decided after the
  drift eyeball (both parties low-confidence: the freeze trades the
  diorama's ambient life for consistency, and the drift is the one piece
  of that motion that can be added and removed live — see both states
  before ruling).
- **E — deep water's drift gets ONE browser eyeball at 99d**: a
  candidate `DEEP_DRIFT`, keep or revert on the user's read; under the
  gate the bands go static either way (with D) or stay at 0 (without).

**The cut** (in ROADMAP §99): 99a the gate + Ctrl+Alt+R · 99b the CSS
block + the sheet-derived pin · 99c the filter + the key pins · 99d the
browser decision point (E then D) · 99e the exit. Predictions: no
snapshot bump, no sim touch, the fuzz smoke never fires (no trigger path
— `src/render` + `src/ui` + `src/dev` + `src/scenes` only).

### 99a — the gate (2026-09-16)

`src/render/motion.ts`: `resolveReducedMotion(override, osPrefers)` the
pure rule (override wins, else the OS), `reducedMotion()` the gate every
consumer asks (the query created lazily, so a pre-boot or harness call
resolves — to the OS or to `false`), `setReducedMotionOverride` /
`getReducedMotionOverride` the Round 8 seam, `cycleReducedMotionOverride`
the dev read (OS → reduced → full → OS), `stampRoot` the
`html[data-motion="reduced"]` write, `installMotionGate()` the boot
(stamp + the query's `change` listener; idempotent) — called at the top
of `main.ts`, before the Game constructs. `lossFx.prefersReducedMotion`
deleted; its three readers (HUD's orb flight + end stagger, the tooltip's
`is-still`) import the gate; **`shakeView` gates ITSELF** (the kickoff's
finding: the reduced branch still shook — the gate now sits on the
effect, so no caller can forget it). Ctrl+Alt+R in `devKeys.ts`. Six
pins in `motion.test.ts` (the precedence table, the round-trip, the
cycle, the CSS-contract constants 99b's sheet pin will derive from) —
the commit subject says "eight"; the suite count (2965 → 2971) is the
truth.

Browser read (the pane at `:5191`, a synthetic Ctrl+Alt+R keydown since
the pane's key tool sends no `code`): booted · OS query `false` · no
attribute at boot · press 1 → `data-motion="reduced"` · press 2 → cleared
(full) · press 3 → cleared (OS); the three `[dev-keys]` lines in the
console. The first probe ran against a tab that had loaded before Vite
was ready (black canvas, no `__game`, no console at all) — a reload fixed
it; worth remembering as the pane's "not booted" tell. Typecheck + lint
clean; the literal ratchet and the docs tree pass (the three module
strings carry `i18n-ok`; `motion.ts` is in the ARCHITECTURE tree).

### 99a-post — the chord moves R → A (2026-09-16, the user's read)

The user's Firefox (their normal browser) saw NO console line on
Ctrl+Alt+R after a forced reload, while the other chords fired. Not
staleness — the five-day-old `:5173` Vite process served the new
modules on a curl probe (main.ts / devKeys.ts / motion.ts all current)
— and not the cycle's two `undefined` states: **Firefox owns Ctrl+Alt+R
as its Reader View toggle**, at the chrome level, so the page never
receives the keydown. The pane is Chromium, which doesn't bind it, so
the synthetic-keydown read passed on a chord a real Firefox keyboard
can't send. The audit's "KeyR is free" checked two key sets (the
registry's, the dev file's) and missed the third — the browsers' own.
Moved to **Ctrl+Alt+A** (accessibility; off every set); the devKeys
header now names the three-set rule; gotcha #134. The pane cannot
verify a chord against a browser it isn't — the user's Firefox is the
read. **The user's Firefox playtest passed on Ctrl+Alt+A.**

### 99b — the CSS block + the sheet-derived pin (2026-09-16)

ONE block at the end of `ui.css`, keyed off `:root[data-motion='reduced']`
(the attribute 99a stamps — no `@media`, which a setting could never
flip): `.hitsplat` → `hitsplat-still` (opacity-only, the translate moved
to the gated base rule, the SAME 0.6 s so `animationend` still removes
it) · `.preturn-card-exit` → `preturn-card-exit-still` (the fade, 0.28 s)
· the four card pops + `.preturn-card-enter` + the two infinite pulses
(`.hud-objective-btn.is-armed`, `.pool-gauge-risk`) → `none` · the two
chip pulses keep their COLOUR flash as `chip-pulse-still` /
`chip-reshuffle-still` (the cue that a card moved, without the scale /
rotate — a small deliberate departure from the cut's "none for the six":
the flash is information, the movement was the motion) · `.tooltip` →
`transform: none` + an opacity-only transition. The notch's local
`@media` block (96.5c) and the tooltip's JS-set `.is-still` (97a) are
FOLDED IN and deleted — three idioms became one. `HITSPLATS.md` names
the twin duration.

**The pin, `tests/ui-motion.test.ts`** (seven `it`s, the 96a shape): a
flat block walker over the sheet; the gate selector DERIVED from
`motion.ts`'s constants; (1) every `animation:` selector outside the
gate has the same selector under it with an `animation:`; (2) no mixed
gated / ungated selector lists; (3) every reduced keyframe is defined,
carries no `transform`, is never `infinite`; (4) a reduced form that is
not `none` keeps the ORIGINAL duration; (5) no dead `@keyframes`; (6)
zero `@media (prefers-reduced-motion)` blocks. **Self-checked against a
known answer** (the §94c norm): with the `.pool-gauge-risk` reduced rule
deleted from the live sheet, the pin FAILED naming exactly
`.pool-gauge-risk`; restored byte-identical.

**The pane read** (`:5191`, the gate forced by the chord): the character
screen's tooltip transition `opacity, transform` → `opacity` on the
press; the pre-turn screen (a forced plagueDoctors fight via
`?layout=isthmus&encounter=plagueDoctors`): `.preturn-card-enter` ×3 →
`none`, both notches → `none`, a chip caught mid-flash on
`chip-pulse-still`; the battle: a body-wide `MutationObserver` counted
**86 hitsplats spawned, every one computing `hitsplat-still`**, a 50 ms
poll saw at most **9 alive at once** (texts `Miss` · `1` · `☠6` · `10` —
the 98d poison prefix under the still form), and after the fight **0
anchors, 0 animations** — no leak (the kickoff's `animation: none` fear
was real: a bare `none` never fires `animationend`). Two pane tells for
the log: Vite full-reloads the tab on a `.ts` swap (the override resets —
`performance.getEntriesByType('navigation')[0].type === 'reload'` is the
check), and the isthmus armies take ~20 s to meet, so an observer read
before that counts zero honestly.

**A watch, not a finding:** under Space (the sim pause) nine anchors held
past their 0.6 s lifetime and drained on unpause. Nothing in `src`
pauses DOM animations (`getAnimations` / `playState` grep: none) and
99b changes only the keyframe body, so this is pause's, not 99b's —
TODO §99 carries it (a pause that freezes the overlay's animations is
arguably right; a pause that merely hides `animationend` is a leak
window).

Prettier: the sheet had drifted (~30 pre-existing hunks, the wrapped
`text-shadow` lists); the pass went in as its own commit ahead of this
one (`43e06d7`) so this diff is the change alone. The hook blocked that
commit's first attempt correctly — the new pin on disk failed against
the block-less sheet the hook tested; the retry ran green once the
block was back on disk (the hook tests the WORKING tree, the commit
carries the INDEX — a format-only commit is safe either way).

**The user's Firefox playtest passed** (2026-09-16): numbers in place,
no card rise, no notch breathing, the chips flash without wobble.

### 99c — the filter (2026-09-16)

`fxRegistry.ts`: `REDUCED_MOTION_STRIPS = ['shake', 'burst', 'sparkle']`
(`as const satisfies readonly (keyof FxDescriptor)[]` — the set can only
name real channels), `stripMotion(fx)` a copy with those deleted, and
`fxDescriptor(key, reduced = false)` — the ONE choke point — returns the
stripped copy under `reduced`; the module stays pure (the caller passes
the gate's answer). `BattleRenderer`'s four sites pass `reducedMotion()`
(the chain arc · `onActionPhase` · `driveStatusFx` · the overlay tint —
the tint is a kept channel, but every site walks the gate so the
pattern has no exception to remember). Five pins in `fxRegistry.test.ts`:
the strip set by value (the exit criterion), the registry exercises
every stripped channel (not vacuous), every key under both readings —
stripped channels absent, every other channel byte-equal, the full
reading IS the registry entry — the informational channels ride through
(a bolt still launches, a DoT still splats, the chain arc keeps its
tracer + sound), `stripMotion` never mutates. Tests 2971 → 2983 across
99b + 99c; typecheck + lint clean. Prettier flags the three touched
files, but it flagged them at HEAD too — left alone (a sweep is its own
commit, as 99b-pre was).

**The pane read** — the seam the filter does NOT own: call counters
wrapped around `BattleRenderer.prototype`'s `spawnBurstFx` /
`spawnSparkle` / `triggerShoveFx` / `launchProjectileFx` /
`triggerTracerFx` / `spawnHitsplat` and `Renderer.prototype.shakeCamera`
(TS-private, runtime-reachable via `__game.activeScene.battleRenderer`
and `__game.renderer`), the Gambler's team (the mage) into the forced
plagueDoctors fight. ⚠ **The pane was HIDDEN, and a hidden pane stalls
`requestAnimationFrame` — the sim stops with it** (70 s of "battle"
produced zero ticks; the earlier 99b fight ran only because the pane
was showing). The read drove `activeScene.tick(1/60)` in a loop
instead — the dispatch seam needs no frame loop:

| window (12–25 s of sim) | hitsplat | launch | shove | tracer | **burst** | **sparkle** | **shake** |
|---|---|---|---|---|---|---|---|
| REDUCED (fight 1) | 84 | 16 | 8 | 10 | **0** | **0** | **0** |
| REDUCED (fight 2) | 94 | 19 | 19 | 10 | **0** | **0** | **0** |
| FULL (fight 2, the tail) | 3 | 0 | 0 | 1 | **1** | **1** | 0 |

The kept channels fire under the gate; the stripped ones never do; the
same code under FULL fires burst + sparkle. `shake` had no live source
in these fights (no catapult; the mage's bolt-burst shake didn't land in
the FULL tail) — its strip is the headless pin's (`magic_bolt_burst`
reduces to `{ sound: 'magicboom' }`). The first FULL window read all
zeros because the isthmus armies take ~20 s of sim to meet — the order
of the windows matters; read the control with combat in it.

**The user's Firefox playtest passed** (2026-09-16).

### 99d — the probe (2026-09-16) — the decision point is OPEN

Both halves landed together so the user reads them in one Firefox
session, flipping with Ctrl+Alt+A. **D (the freeze):**
`BattleScene.advanceShaderTime(dt)` — the one place the three renderers'
`uTime` advance (the countdown branch and the running branch both call
it) — feeds `0` under `reducedMotion()`, read per frame, so the fire
flicker, the healing shimmer, the mist creep, the fog and the band drift
hold at once with no uniform and no shader branch. **E (the drift):**
`DEEP_DRIFT` 0.0 → **0.4 rad/s** in terrain.frag AND apron.frag (one
band width per ~16 s along the diagonal); a text pin in
`TerrainRenderer.test.ts` reads both shader sources and fails if the two
constants ever differ (the edge continuity depends on it). Typecheck +
lint clean; the pane read (the sim driven by `activeScene.tick`, the
pane hidden): 2 s of sim advanced terrain / apron / backdrop `uTime` by
**2.000 / 2.000 / 2.000** under full and **0 / 0 / 0** under reduced —
the three clocks were byte-equal throughout, as `advanceShaderTime`
promises. The drift itself is the user's eye — the pane can't judge
"reads as a hazard stripe" (98e-post's lesson).

Two outcomes to record when the user rules: E keep / retune / revert
(revert = `DEEP_DRIFT` back to 0.0 in both files; the pin stays); D keep
/ revert (revert = drop the ternary; the helper stays as the one site).

**RULED (the user's Firefox eye, 2026-09-16): E — the drift stays,
retuned 0.4 → 0.6 rad/s** ("I like the drift"; one band width per
~10 s); **D — the freeze is KEPT.** Both by the user; the §98 drift rider
closes. The seam is now: motion-on = drifting water + the ambient
shader life; reduced = a still diorama with the units the only things
that move (plus the informational fx 99c keeps).

### 99e — the exit (2026-09-16) — the phase CLOSES

DESIGN §UI idioms "Reduced motion (99)": the one-gate rule, the "motion
stops, information stays" test, the three surfaces (the sheet's twins,
the registry's strip set, the shader clock's hold), the drift as
motion-on flair. The §96.5 rider ("the reduced-motion path,
unverified") closes with its finding named (the un-gated shake) and its
one untested leg noted (the OS query itself — a one-minute Windows
"Animation effects off" check, whenever convenient; the resolution rule
is pinned either way); the §98 drift rider closed at 99d. ROADMAP §99 →
the stub; the cursor → §100 (its kickoff inputs named: the §97 riders,
the three-key-set chord rule, the pane's key tool sending no `code`);
HANDOFF's browser-verify tips gain the §99 bullet (the Firefox chord,
the hidden-pane sim stall + `activeScene.tick` drive + prototype
counters, the `.ts`-swap reload resetting module state). TESTING.md
unchanged (the sheet pins are the ui-tokens shape it already covers by
policy). The predictions held: no bump, no sim touch, the fuzz smoke
never fired (`src/render` + `src/ui` + `src/dev` + `src/scenes` +
`main.ts` only). Tests 2965 → 2984 (+6 motion · +7 ui-motion · +5
fxDescriptor · +1 drift). Seven code commits + the kickoff + this close;
one prettier commit; every step read in the user's Firefox.

## Phase 100 — input accessibility + the extraction sweep

### Kickoff (2026-09-17) — the code-reality audit + the cut

The charter (ROADMAP §100) was authored at the round kickoff against the
2026-09-08 audit (§Kickoff C); five phases later, re-read at `73a3bf3`.
The §97 riders (TODO §97 riders 1–3) are inputs. Findings, by surface:

**A. The camera bindings — untouched since D4.** `Renderer.ts`:
`CAMERA_TOGGLE_CODE = 'Backquote'`, `PAN_KEY_CODES` = WASD + arrows,
both on page-lifetime `window` listeners (gotcha #54), no DEV gate, not
in the registry; `setCameraMode` has NO caller outside Renderer, so the
key is the only way in. Scroll mode already has a MOUSE pan route
(edge-scroll, 40 px) — the gap is the TOGGLE, not the pan. The gate: the
toggle moves to `devKeys.ts` as a Ctrl+Alt chord and the pan listeners
attach under `import.meta.env.DEV` only (the FontAtlas precedent), so the
shipped bundle never sees a camera keydown. Chord audit per gotcha #134:
the registry binds E/F/H/T, digits, Space, M, Slash; devKeys holds
S/L/D/K/G/A; Firefox owns Ctrl+Alt+R. **Ctrl+Alt+C** (camera) is off all
three sets — the user's Firefox read decides it, never the pane. Docs
naming the key: gotchas #52 + #54 (a 100-note each, no renumber).

**B. The eight clickable `<div>`s — all still `<div>`s.** Map nodes
(`MapScreen.ts:330–358`, frontier nodes only get the listener), the cache
chip (`CacheOverlay.ts:77` — its sibling map chip IS
`<button class="chip">`, `SectorMapOverlay.ts:69`: the precedent), hand
cards (`PreTurnScreen.ts:759`), recruit cards (`RecruitScreen.ts:99`),
picker cards (`CardListModal.ts:116`), enemy compact cards (`HUD.ts:768`
click = engage, `:769` contextmenu = focus). The shape fork the charter's
"made focusable buttons" hides: the CARDS carry interactive children (the
97d tab-stop chips at `PreTurnScreen.ts:1000`, the stat rows' tooltips) —
interactive content inside a `<button>` is invalid HTML and both engines
break inner focus — so cards get `role="button"` + `tabindex="0"` +
Enter/Space through ONE helper, while the two LEAF controls (map node,
cache chip) become real `<button>`s. `type="button"`: all 16 inline
`createElement('button')` sites set it (96d closed the audit's "4 lack")
— nothing to do.

**C. Focus styling — zero `:focus-visible` rules in `ui.css`.** 30
`:hover` rules; the ONE `:focus` rule is 96f's `outline: none` on the two
modal containers (correct — a container is not a control). The five 97d
text sites ride the UA default ring. ⚠ The map node's frontier state
ALREADY uses `outline` (98c's double ring), so a node's focus ring cannot
be `outline` — a `box-shadow` ring, or the ring on `::after`. The idiom
proposed: the focus state IS the hover state plus a ring — every
`X:hover` selector gains its `X:focus-visible` twin (same block), one
global ring rule on controls, and a `tests/ui-focus.test.ts` oracle in
the ui-motion shape (every `:hover` has its twin; no `outline: none`
outside the two containers; the ring rule present).

**D. Hotkeys vs a focused button — a real collision, ruled.** The
Keybindings sink (`Keybindings.ts:92`) dispatches on bare `code` with no
target guard and `preventDefault`s when a handler is live (battle only):
Space on a FOCUSED HUD button toggles pause AND cancels the button's
activation (a prevented Space keydown suppresses the click). Enter still
activates. The alternative — the sink yields Space to a focused button —
would REGRESS the mouse player: a clicked button holds focus in both
engines, so the next Space would re-fire the button instead of pausing.
Call: hotkeys WIN (byte-identical today); Enter is every button's
keyboard route in battle; the helper maps Enter AND Space (Space reaches
it outside battle, where no handler is live). DESIGN records the rule.

**E. Focus at a screen swap — nobody moves it.** `Screen.present` and the
HUD never touch focus; the removed element's focus falls to `body`, so
Tab starts at the chrome column (bits · cache · map chips) then the
screen in DOM order. Proposal: `present()` focuses its container
(`tabindex=-1`, no ring — the 96f container precedent) so Tab enters the
screen first. Small; a decision point.

**F. The modal shell needs nothing.** 96f already traps, restores focus
to the opener, and stamps `role="dialog"`; its `FOCUSABLE` selector
includes `[tabindex]:not([tabindex="-1"])`, so role=button cards join
the trap on their own.

**G. The enemy compact card (the §97 rider) — a latent 78b bug is the
route.** `setObjectiveOnCard(unitId, 'engage')` passes the mode
LITERALLY: a pane-armed FOCUS pick followed by a card click sets ENGAGE
(the board pick honours the armed mode; the card ignores it). Honouring
`armedMode ?? 'engage'` on the card click gives keyboard AND touch the
focus objective with no long-press and no contextmenu: arm Focus (the
pane button or F), then Enter / tap the card. The contextmenu route
stays for the mouse; the tooltip stays `touch: 'none'` (the tap acts);
the hint wording gains the armed route. Riders 1 (focus route + touch),
2 (the in-battle tab stops — the cards themselves become the stops; the
inner `LV`/`POW` wraps stay hover + key reads, ~30 stops was and is too
many) and 3 (the ring) close in this phase.

**H. The literal sweep — 71 literals in 18 files** (`npm run
i18n:baseline -- --list`, captured at the kickoff). Clusters: `"Lv"` ×5
(Game · UnitOverlayLayer ×2 · PromotionScreen · UnitCard) → one
`common.lv`; `src/config/events.ts` ×9 = `describeEventCondition`, config
prose whose ONLY consumer is `EventScreen.ts:107` → the describer MOVES to
`src/ui` with a `t()` per condition kind (config stays prose-free;
`SCAN_ROOTS` drops the file) — ⚠ that touch of `src/config/` fires the
pre-commit fuzz smoke once; PortScreen 13 · PreTurnScreen 15 · HUD 7 ·
SectorCleared 5 · CacheOverlay 3 · UnitCard 3 · promotionDelta 3 · the
rest 1–2. Touch-each-file-once: the extraction rides the focus step that
opens the file where one does; the remainder is one pure extraction
commit; the pin's "absent = zero" then covers every file.

**I. The two `<select>`s** (`PortScreen.ts:329`, `RewardScreen.ts:202`):
unlabelled, rebuilt per render, no visible label element. An
`aria-label` through `t()` is the no-layout route (a visible `<label>`
shifts the row — §101's business, and the button beside each select
already names the action).

**J. Test reach.** vitest runs `environment: 'node'`; no jsdom in the
tree. So: the helper's key predicate is a pure function and pinned; the
stylesheet oracle pins the ring idiom structurally; the DOM wiring and
every hotkey route are the user's FIREFOX read (the pane's key tool sends
no `code`, gotcha #134). The spec's exit — "one row per surface, every
row ticked" — is a DESIGN table the user reads.

**K. ARIA now: 13 sites** (96f's dialog trio, the tooltip's `role`, the
HUD's `aria-pressed` + labels). `aria-pressed` mirroring `is-selected` on
the hand-swap and picker cards is a line each inside the helper's opt.

**L. Doc homes.** DESIGN §Input accessibility (78e) is EXTENDED in place
(hover + focus, the Space rule, the per-surface checklist); §UI idioms
gains "Focus (100)"; gotchas #52/#54 get their 100-notes; HANDOFF's
browser-verify tips gain the chord.

No sim touch, no snapshot bump; the fuzz smoke fires once (100e's
`src/config/events.ts` touch). The cut + the decision points went to the
user in a plain message (the AskUserQuestion note in AGENTS); the
ROADMAP gets the cut lines on approval.

### 100a — the camera gate (2026-09-17)

The Backquote keydown is gone from `Renderer.ts`; `toggleCameraMode()`
(public, returns the new mode) is the one entry, and the devKeys chord
**Ctrl+Alt+C** calls it through the main.ts cast convention (Game keeps
`renderer` TS-private; private is runtime-accessible). All four D4 input
listeners (pan keys + edge-scroll) attach under a `DEV` const
(`import.meta.env.DEV`, the locale.ts `typeof` guard) — `stop()` still
removes them unconditionally, a no-op when never attached. Gotchas #52 +
#54 carry the 100a notes.

Proof, from a production build to the scratchpad: `Backquote` and the
`dev-keys` module are absent from the bundle; the five `keydown` mentions
left are three `addEventListener`s (tooltip · modal · Keybindings) and
two `removeEventListener`s (Renderer's `stop`, modal's close) — the
Renderer's ATTACH is gone (esbuild drops the `if (false)` block; the
`PAN_KEY_CODES` strings survive as dead code inside the never-attached
handler, which is why a string grep alone is the wrong instrument — it
read `KeyW ×2` and looked like a failure). Pane read (dev): a synthetic
Ctrl+Alt+C keydown flipped `fit → scroll → fit` with both console lines
(`[dev-keys] camera mode → …` + `[camera] mode: …`); a bare Backquote
left the mode at `fit`. The REAL chord is the user's Firefox read (gotcha
#134 — the pane cannot deliver a browser-reserved chord, and a synthetic
event proves only the wiring).

**The Firefox read (2026-09-17):** Ctrl+Alt+C lands — the user toggled
live; the verdict on scroll mode itself: "the game feels very different",
and a scroll camera that stays needs a proper minimap first. Slotted as a
rider on the Round 7.5 D4 A/B (META-ROADMAP §Round 7.5), not §100 work.

### 100b — the focus idiom (2026-09-17)

**The idiom: the focus state IS the hover state, plus ONE ring.** Every
`X:hover` rule in `ui.css` (29 — the 30th `:hover` in the sheet is a
specificity comment) now carries `X:focus-visible` in its selector list,
same block, same declarations, by a one-line perl over the sheet (each
hover prelude was a single selector on one line; the `:not(:disabled)` /
`:not(.is-selected)` tails ride along). ONE ring rule, placed before the
§99 block: `:where(button, select, [role='button'], [tabindex='0'])
:focus-visible { outline: 2px solid var(--color-white); outline-offset:
2px }` — `:where` for zero specificity, so a control's own `outline`
(98c's frontier double ring, the enemy card's hover outline) outranks it
by design; white because it is nobody's state hue (amber hover · blue
frontier/selection · green active), and a ring is a shape, so the 98a
grey read passes by construction. The map node's ring rides `box-shadow`
(a black gap to 6px, white to 8px — outside 98c's 2px + 3px-offset
outline), as the kickoff predicted.

**The pin** — `tests/ui-focus.test.ts` (five tests): every `:hover`
selector's twin in the same list; the ring rule at its pinned selector
with a solid outline; `outline: none` only on the two 96f containers and
never under `:focus-visible`; `.map-node:focus-visible` on box-shadow
with no outline. Self-checked in the natural order: run BEFORE the ring
block was spliced, contracts 2 + 4 failed and 1 + 3 passed. The CSS
walker (`blocksOf` + the comment strip) moved from `ui-motion.test.ts`
into `tests/cssBlocks.ts` (rule-of-two for a parser; the motion pins
import it unchanged, 7/7 green).

**Pane read** (the character select, three Tabs): the focused
`.charselect-card` computes `outline: solid 2px rgb(255,255,255)`,
`outline-offset: 2px`, `:focus-visible` true; after frames were forced
it ALSO computes the hover twin — `background: color(srgb 1 0.69 0 /
0.12)`, `transform: matrix(1,0,0,1,0,-2)`. ⚠ Instrument note: the first
reads showed the twin ABSENT (transparent, identity) while the rule
matched the element — the hidden pane throttles the animation clock, so
a 0.1s `transition` sat at its start until a screenshot forced a frame;
read computed styles AFTER a screenshot, or the transition lies (the §99
hidden-pane sim stall's CSS cousin — HANDOFF tips). The 97d text sites
(`tabindex=0`) and the buttons' rings across the screens are the user's
Firefox read at the pause.

### 100c1 — `pressable()` + the leaf buttons (2026-09-17)

**The helper** (`src/ui/pressable.ts`, first consumers at c2): `role=
"button"` + `tabIndex = 0` + Enter / Space → the element's own `click()`,
so mouse, touch and keyboard run ONE code path through the existing
listeners. The Space rule made concrete: the Keybindings sink sits on
`window`, AFTER the element in the bubble, and `preventDefault`s exactly
when a bound handler is live — so Space's activation is deferred past the
whole dispatch by `setTimeout 0` (a microtask checkpoint runs BETWEEN the
listeners of a UA-dispatched event, so a microtask would read the verdict
too early) and fires only if the sink left the event unprevented. Enter
activates at once — the pin derives the premise from
`config/keybindings.json` (Enter / NumpadEnter bound to nothing, Space
bound). Only a keydown TARGETED at the element counts: a 97d chip inside
a card is its own tab stop. `setPressed` mirrors `aria-pressed` for c2's
selectable cards. The surface is deliberately that small.

**Map nodes → real `<button type="button">`s.** The one design call: a
node with nothing to do (current · visited · locked · every node under
readOnly) is INERT by `aria-disabled="true"` + `tabIndex = -1`, never
`disabled` — a disabled button swallows pointer events in both engines,
and the boss node's 97f forewarning tooltip must keep its hover while the
boss is still locked (the usual case). `.map-node` gains `padding: 0;
box-sizing: content-box` so the button's box is byte-what the div's was
(98c's centering math). The boss banner literal → `map.bossBanner`.

**The cache chip → `<button type="button" class="chip cache-overlay">`**,
its sibling the map chip's shape (96e). Three literals → `cache.fire` ·
`cache.discard` · `cache.pickRosterUnit`. Baseline 71 → 67 in 16 files
(MapScreen + CacheOverlay at zero, absent from the table).

**Pane read** (a fresh run, the map): 39 nodes, every one a BUTTON — 38
inert with `tabIndex -1`, the one frontier node at 0; the Tab order runs
roster button → frontier node → cache chip, each `:focus-visible`. The
focused node computes 44 × 44 content-box, padding 0, the 98c outline
(`solid 2px` blue — it outranks the ring rule, as designed), the shadow
ring (`0 0 0 6px black, 0 0 0 8px white`) AND the hover twin's blue fill.
The chip: 46 px tall as a button; a same-class `<div>` clone with the
same innerHTML measures 46 too — the 1 px it differs from the bits chip
(45) is the `▤` glyph's, not the tag's; no shift from the conversion. ⚠
The pane's key tool could not activate a native button by Enter (nothing
on the charselect card either, a `<button>` since 96d) — consistent with
its `code`-less events (gotcha #134); Enter on a node / the chip is the
user's Firefox read. A source-file write mid-sequence (the prettier pass)
triggered Vite's full reload and threw the walk back to the character
select — the HANDOFF .ts-swap tip, re-learned: no writes while a pane
sequence is in flight.

### 100c2 — the cards (2026-09-17)

**Four consumers of `pressable()`:** the pre-turn hand cards while
selectable (a toggle — `aria-pressed` set at build from the selection,
the hand re-renders on every pick), the recruit cards, the picker cards
(a toggle — `toggleSelection` flips `aria-pressed` beside `is-selected`,
the one-card picker's replaced pick too), the enemy compact cards. The
helper lost its handle: `pressable(el, { pressed? })` sets the initial
`aria-pressed`, and the site that flips the class flips the attribute in
the same line — a handle to thread through `cardEls` was more surface
than the two sites earn.

**The enemy card honours an armed pick** — `this.armedMode ?? 'engage'`
on click (the kickoff audit §G: the board pick always honoured the arm;
the card passed `'engage'` literally since 78b). That one line IS the
focus objective's keyboard and touch route: arm Focus on the pane (or
F), then Enter / tap the card; right-click stays the mouse's shortcut;
the tooltip keeps `touch: 'none'` (a tap acts) and its hint reads
"Click / Enter: Engage · right-click: Focus — or arm Focus, then pick the
card". A dead card leaves the Tab order (`tabIndex -1` +
`aria-disabled`, the 100c1 node shape) — the click path already no-op'd
on a dead unit. The §97 riders 1–3 close: the focus route, the touch
collision, the ring (100b) — and rider 2's "~30 tab stops in a battle"
is answered by the cards themselves being the stops (7 enemy cards here)
while the inner `LV` / `POW` wraps stay hover + key reads.

**Literals:** HUD 7 · PreTurn 15 · Recruit 1 → nineteen keys (the shared
`common.hop`; `hud.pause.fightNow` reused under the `▶`; `common.pass`
under the `▸`). "Click a target…" kept byte-equal under
`hud.objective.pickTarget` (a wording call for the user, not a sweep's).
Baseline 67 → 44 in 13 files. The three files' prettier drift predates
this step (HEAD copies fail `--check` too) — left for a prettier pass.

**Pane read** (the Soldier, event → event → a battle node, 7 enemy
cards): the six hand cards `role=button · tabIndex 0 · aria-pressed
false · clickable` on the pre-turn screen; every enemy card `role=button
· tabIndex 0`. By a click counter on one card: a synthetic Enter keydown
= **1 click**; a synthetic Space keydown (`code: 'Space'`) in battle =
**0 clicks** with pause TOGGLED and `defaultPrevented` true — the
Keybindings sink took it and the deferred activation read the verdict;
a second Space toggled pause back, still 0. An armed Focus on the pane
(`! Click a target…`, `.is-armed`) + Enter on the card → DISARMED (only
`setOn` disarms — the click reached the controller with the armed
mode). The objective pane never showed an `aria-pressed` mode after the
card route; the control probe (a plain `card.click()`, the unchanged 78b
mouse path, and an armed Engage + `card.click()`) read the same — pre-
existing pane behaviour under the hidden pane (the §99 sim-stall tip:
the objective event that flips `activeObjectiveMode` rides the sim), not
c2's. The picker and recruit cards ride the same helper; their Enter is
the user's Firefox read, with the hand-card toggle under a live redraw.

### 100d — the selects (2026-09-17)

Both `<select>`s (the port's swap-buy control, the reward screen's swap
control — the 49c idiom, rebuilt per render) carry an `aria-label` from
ONE shared key, `common.swapSelectLabel` ("Cache slot to swap out"). An
`aria-label`, not a visible `<label>`: a label element would shift the
row (§101's class) and the Swap button beside each select already names
the action; the accessible name is what was missing (the kickoff audit
§C: "the two `<select>`s are unlabelled"). Both sites carry the 100d
comment.

**Literals:** Port 13 + Reward 2 flagged, plus two the scan's prose
heuristic let through and the touch-once rule sweeps anyway — the `$
Port` heading (`port.heading` under the `$` glyph) and the reward unit
title's `— level {level}` (`reward.unitTitle`, the glyph outside).
Eighteen keys; the `▸` glyphs and the `✕` stay outside the values (the
97 precedent). Baseline 44 → 29 in 11 files; PortScreen + RewardScreen
at zero. Both files' prettier drift predates the step.

**Read:** the pins (the key scan, the literal ratchet, the string table,
the title tripwire) 24/24. The pane walk from a fresh run found only
battle nodes after the event chain, and the swap selects render only
with a FULL cache — so the port screen's strings and both selects'
accessible names are the user's Firefox read whenever a port with a full
cache comes up; the extraction is byte-equal by construction (every
value is the old literal, verbatim).

### 100e — the extraction remainder + the screen focus (2026-09-17)

**The baseline is `{}`.** The literal pin's "a file ABSENT from the
baseline must have zero" clause now covers every scanned file — the §95d
ratchet has nothing left to ratchet, and a new prose literal anywhere in
the presentation layer fails `npm test` from here on.

**`describeEventCondition` → `src/ui/eventConditionText.ts`.** The 74f
phrases were UI copy living in a config module (the round kickoff's
audit finding; the literal scan had to reach into `src/config/` for that
one file). Now a `t()` per condition kind (`event.cond.*`, twelve keys;
the `not` combinator composes through `event.cond.not`), the EventScreen
and the 74h event editor (`tools/event-editor`) re-pointed at it — the
same copy in both places, as before — and `SCAN_ROOTS` drops
`src/config/events.ts`; the config module's `packetById` /
`characterById` imports went with the function. ⚠ `t()` formats numbers
through Intl, so a 1000-bit threshold would read "1,000+ bits" — none is
authored; noted at the module head. The touch of `src/config/` fires the
pre-commit fuzz smoke (predicted at the kickoff).

**The rest:** `common.lv` ("Lv {level}") for the four level badges
(UnitOverlayLayer ×2 · PromotionScreen · UnitCard); `hitsplat.miss`
(`src/render` imports `t()` now — it was already a scan root);
`unit.levelName` · `unit.abilities`; the three `promotion.delta.*` row
labels; `playback.paused`; `charselect.heading`; five `sectorcleared.*`
(the pool line's two forms — a pure function, so its pins moved with it).
The one non-extraction: `Game.ts`'s `[dev] starting roster override`
console line is marked `// i18n-ok` — dev output, never rendered. Two
test pins had restated English (`'Paused'`, the three delta labels) and
now derive from the table — the ui.test.ts lesson from c2, applied
before the hook could catch it. 29 keys; baseline 29 → `{}`.

**`Screen.present` focuses its container** (`tabIndex = -1`,
`preventScroll`), the modal shell's 96f shape; `.screen-fade:focus`
joins the two modal containers in the outline-free rule and the
ui-focus pin's allowlist (contract 3 reworded: CONTAINERS). This is the
start-point half of the user's 100c1 Firefox finding (Tab ran off the
document through the browser UI before reaching the chrome column): the
next Tab now enters the CURRENT screen's controls; Shift+Tab from there
reaches the chips in one press. The DOM-order half stays TODO §100.

**Pane read** (a fresh load → the Soldier → the map → the event node):
the active element on load is `.charselect-screen.screen-fade` (`DIV`,
tabIndex −1, computed `outline: none`, not `:focus-visible`); Tab → the
first `.charselect-card`; after the click the active element is
`.map-screen.screen-fade` and Tab → the roster button (the screen's
first control, not the chrome column); after entering the node the
active element is `.event-screen.screen-fade` and Tab → the first
`.event-choice` ("▸ A pile of bits"). The map's `scrollTop` read 0 with
a 1078 px board in a 720 px viewport — `MapScreen.show` centres the
current node AFTER `present()` (`scrollTop = offsetTop − clientHeight/2`,
clamped to range), so the focus call's `preventScroll` cannot suppress
it, and a root near the board top clamps to 0 — the centred read, as
the show() comment predicts. Firefox's Tab walk after a
screen swap is the user's read at the pause.

### 100e2 — the chrome column after the screens (2026-09-17)

The user's Firefox read of 100e: the container focus fixed the START of
the walk (Tab enters the screen) but the detour survived — roster → node
→ the whole browser UI → the cache chip. The reason is DOM order, not
the start point: `createChromeColumn(uiMount)` appended the column to
`#ui` at Game construction, before any screen ever mounted, so every
screen sat AFTER the chips; from a screen's last control the only
forward path to the chips ran off the document's end, through Firefox's
own chrome, and around. Chromium in the pane has no chrome to enter and
read roster → node → chip all along, which is why the pane could not
show the bug (the 100c1 diagnosis had it right; 100e fixed only half).

**One stab, user-capped:** the Electron shell this is headed for has no
browser UI to detour through, so this got one quick attempt before the
close, not a design. The stab: a `.screen-host` `<div>` created FIRST
inside `#ui` (before the column and the tooltip host) and passed as the
scenes' `uiMount`, so every Screen and the HUD mount inside it — screens
first, chips last. A static, unsized div: the screens are absolute /
fixed and resolve against `#ui` exactly as before (`#ui > *` still grants
pointer events to the host, and a zero-height box swallows nothing); the
column is fixed with its own z-index 15, so stacking never depended on
DOM order; the modals keep `#ui` (appended last at open, as before).
Game's `uiMount` field went with it — nothing read it after
construction. ⚠ A screen's relative order to the HUD is unchanged (both
mount in the host, in the order they always did).

**Pane read** (a fresh run, the map): `#ui`'s children are
`screen-host · chrome-column · tooltip`; the map screen is inside the
host, and the host precedes the column; the host's box is 1280 × 0. The
Tab walk from the focused root: roster button → the frontier node → the
cache chip → (the wrap) → the roster button. The map renders unchanged.
The Firefox walk — the chips reached BEFORE the document's end — is the
user's read at the close.

### 100f — the close (2026-09-17)

DESIGN §Input accessibility extended in place (hover + keyboard focus as
channels, the `pressable()` / `aria-disabled` / `<select>` name / screen
focus / chrome-order rules, THE SPACE RULE, the dev-only camera, and the
per-surface checklist — seven rows, every column ticked, the pins that
hold them named); DESIGN §UI idioms gains "Focus (100)" (the hover twin +
the one white ring + where `outline: none` is legal) and "Strings" notes
the empty baseline. Gotcha #135 (the deferred Space). ARCHITECTURE: the
tree lines for Game (the screen host) · devKeys (C) · events.ts (the
describer moved) · literalScan (SCAN_ROOTS, the empty baseline) ·
Renderer (the DEV gate) · ui.css (the ring) · Screen (the focus) · HUD ·
MapScreen · PreTurn · Recruit · CardListModal · EventScreen ·
CacheOverlay, plus `pressable.ts` · `eventConditionText.ts` ·
`tests/ui-focus.test.ts` · `tests/cssBlocks.ts`. HANDOFF: the cursor →
§101 with its kickoff inputs (the 46 / 45 px chips, the selects' label,
the wrapper), the §100 Last-phase row, §99 demoted, the §100 tips
bullet, the Tests row at 2974 + 582. ROADMAP §100 → the stub. The
scratchpad's §100 section; the session report + the phase summary in
retro/sessions.md; two papercuts filed at 100b / 100c1. TODO §100
carries one rider (the "Click a target…" wording now that Enter picks).

Tests 2984 → 2974 (+5 focus · +3 pressable · −18 baseline per-file rows
as files hit zero); `ui.json` 112 → 190; no sim touch, no bump; the fuzz
smoke fired once (100e, the config touch: 582 green). Eight code
commits (`7f941b9` 100a · `74c7204` the read · `fa51874` 100b ·
`49fc3f8` 100c1 · `5a8b143` 100c2 · `3bfd100` 100d · `fc3a6e3` 100e ·
`ef59b62` 100e2) + the kickoff `edc9371` + this close; every step read
in the user's Firefox.

## Phase 101 — layout stability

### Kickoff (2026-09-17) — the code-reality audit + the cut

The charter (ROADMAP §101) was authored at the round kickoff against the
2026-09-08 audit (§Kickoff D); six phases later, re-read at `5067be1`
with two parallel read-only sweeps (the chrome column + the digit sinks;
the countdown + the conditional blocks) and three scratch probes against
the vendored font. The §100 inputs (the 46 / 45 px chips, the selects'
`aria-label`, the `.screen-host` wrapper) are inputs. Findings:

**A. The charter's first lever is a near no-op.** `tabular-nums` makes
digits share one advance in a PROPORTIONAL face; every DOM surface is
JetBrains Mono, a monospace, so `1111` and `8888` already match. Ten
rules set it today (`ui.css` 950 · 956 · 990 · 1803 · 1969 · 2281 ·
2423 · 2522 · 2722 · 3187) and none of them is what holds a surface
still. The class has three real mechanisms, and the live chip instance
is none of the ones the charter guessed:

1. **A fallback glyph grows the line box.** `▤` (the cache chip,
   `CacheOverlay.ts:133`) is ABSENT from the vendored TTF — verified
   against the cmap with `tools/font/ttfCmap.ts` — so an OS fallback
   paints it, and with no `line-height` on `.chip` (`ui.css:1903-1916`)
   the line box follows the tallest face: 46 px to the bits chip's 45.
   A scan of every string the DOM UI can render (src/ui + src/render +
   locales + config, comment lines skipped): 32 non-ASCII codepoints,
   **20 outside the shipped font** — fourteen in the TTF but outside
   `SUBSET_RANGES` (`– — ’ ‡ • … − ≤ ≥ ⊓ ⊞ ⚠ ✕` + the en dash), six not
   in the font at all (`▤ ★ ☆ ☠ ⏸ ⌖`). The §79 coverage pin
   (`tests/font-coverage.test.ts`) guards the canvas atlas's `GLYPHS`
   only — never a UI string. The DOM loads the SAME self-hosted subset
   (`src/fonts.css`; the fontsource import was replaced at §79g), so
   "in the TTF" is not enough — a glyph must be in the subset too.
2. **Character-count growth** (999 → 1000; `Accept` → a `<select>` +
   Swap; `XP 12 / 40` → `MAX`) with no reserved width. The one correct
   instance in the tree is the 96.5b2-pre gauge value
   (`.pool-gauge-value`: `min-width: 15ch; flex: none; text-align:
   right`) — the idiom this phase generalizes.
3. **Conditional blocks that collapse** (`display: none` via `[hidden]`,
   or a child not rendered) on CENTERED flex columns (`.reward-screen`,
   `.event-screen`, `.preturn-screen`), where removing a child
   re-centers everything above it too. The sheet holds ONE true
   reservation: the Promotion delta block (`ui.css:1133-1148`,
   `PromotionScreen.ts:176-191`, `visibility: hidden` → `.is-revealed`).

**B. The chrome column.** Already a flex column with no measured
offsets (`ui.css:1873-1882`; the 20/76/132/188 px column died at 96e),
order by CSS `order`. Three residuals: `.chip` has no `box-sizing`, so
the two `<button>` chips (cache, map — UA `border-box`) and the two
`<div>` chips (bits, pool — `content-box`) read `min-width: 128px` as
128 vs 166 px outer; `align-items: flex-start` leaves the column's
right edge ragged and every chip's width a function of its text; and
`.hud-hop` (`ui.css:1846-1858`) still sits at a MEASURED `left: 200px`
beside the bits chip — a duplicate of the plate outside the column,
14 px of clearance, colliding at ~8 digits. The pool chip jumping when
the map chip hides is §96's decision D (collapse; the pool chip is
display-only) — user-signed, not re-litigated.

**C. The countdown.** `HUD.positionCountdown()` (`HUD.ts:656-661`)
measures the enemy pane's bottom ONCE in the `!inCountdown` entry
branch (`:634-638`); no `ResizeObserver`, no resize listener in HUD or
BattleScene. And an ordering bug: `BattleScene.ts:319` shows the
countdown (measures), then `:327` calls `refreshStatuses()` on the same
frame — the 97f-post branch that un-hides the status / empower rows
(`UnitCard.ts:354, 410`, each `display: none` under `[hidden]` with a
`border-top` + `padding-top`). Every seeded status on an enemy makes the
measurement short. `.hud-enemy-cards` wraps freely to `max-height:
30vh` (`ui.css:2567-2579`), so the pane bottom is card count × viewport
width × per-card height. Reserving the rows on every compact tile
would cost 6–10 tiles of vertical budget; the countdown is the pane
bottom's only consumer → re-measure, not reserve.

**D. The conditional blocks, walked** (the screens rebuild wholesale, so
the instability is a child present in one render and absent in the
next). Flagged = the toggle sits ABOVE the click target that fires it:
- PreTurn: ⚑ the armed-packet hint (`PreTurnScreen.ts:783-788`,
  inserted between the cards and the strip by the packet chip you just
  clicked); ⚑ the packet row deleting itself when the last packet fires
  (`:791-792, 929-944`); the hand's 1⇄2-row wrap (a Surge draw) — left
  alone (a whole card row; the Fight button is already `position:
  fixed`, `ui.css:3135-3141`); the active chip's hint line — width
  only; the empower badge is already `position: absolute` (good).
- Reward: ⚑ the accepted row VANISHES and the panel re-centers, so the
  next Accept lands under a moved button (`RewardScreen.ts:86-88,
  102-195`) — the worst case; the cache line (`:94-100`) disappears
  when the last packet portion resolves; Accept ⇄ select + Swap
  (`:181-191`) changes the row's height + left-column width.
- Port: ⚑ the SOLD badge replacing price + Buy shrinks the row ~10 px
  under the next Buy (`PortScreen.ts:292-318`); the swap control
  flipping EVERY remaining packet row when the cache fills
  (`:147-149`); the empty / sold-out lines (`:136, 156-158, 174-176`).
- Cache modal: ⚑ the ✕ hides by `hidden` and the header shrinks
  (`modal.ts:181-184` via `setDismissable`, `CacheOverlay.ts:178`); ⚑
  the shrink banner (`:181-186`, the FIRST body node, ~45 px) removed
  by the final Discard beneath it; the per-row Fire button
  (`:236-252`); the inline roster picker (`:271-276`) — a deliberate
  disclosure UNDER its trigger, left alone.
- Event: the page text re-centers the choice buttons per page
  (`EventScreen.ts:87-90`, `.event-screen` centered) — the shift lands
  on the click that turns the page, not mid-gesture.
- Map · SectorCleared · Recruit · GameOver · CharSelect: clean (the map
  banner + legend are `position: fixed`; the reference "float the
  conditional chrome" pattern).

**E. The selects' label — KEEP the `aria-label`** (the §100 note
resolved): a visible `<label>` in `.port-row__actions` (`flex-shrink:
0`) would push the row BODY into a wrap (a height change), and the
Reward row is hard-capped at 560 px with price + select + Swap already
filling it. A visible label would have to be a reserved-height line
above the cluster — a redesign, the scope guard.

**The decisions (user-signed 2026-09-17):**

1. **The premise swap** — `tabular-nums` retires as the headline lever;
   the idiom is "reserve the widest live form" (`min-width: Nch`,
   right-aligned — the 96.5b2-pre shape). One global
   `font-variant-numeric: tabular-nums` stays as a belt for a future
   face.
2. **A unified backup face, not glyph-by-glyph swaps** (the user's
   framing: this has bitten repeatedly — §79f/g, 98b's stars, now the
   chip — and "defaulting to an unknown OS fallback isn't something I'm
   interested in"). The three candidates were FETCHED and probed
   (scratchpad `faceProbe.ts`: cmap + `hhea`/`OS/2` metrics + the
   embedded licence strings):

   | Face | Covers of the 20 | Ascent / descent vs JBM's 1.02 / 0.30 | Advance | Licence |
   |---|---|---|---|---|
   | DejaVu Sans Mono 2.37 | 18 (misses `⌖ ⏸`) | 0.93 / 0.24 — fits INSIDE the line | 0.602 (JBM 0.600) | Bitstream Vera (permissive) + DejaVu PD + Arev |
   | Unifont 18.0.01 | 20 | 0.88 / 0.13 — fits | 1.00, a 16 px bitmap grid | OFL 1.1 / GPL2+ w/ embedding exception (dual) |
   | Noto Sans Symbols 2 v2.008 | 15 (misses `‡ ≤ ≥ ⊓ ⊞` — all in JBM) | 1.07 / 0.63 — 29 % TALLER | 0.80, proportional | OFL 1.1, no RFN |

   **DejaVu Sans Mono — CHOSEN.** It fits the line (a fallback glyph
   can never grow a box even before 101b's explicit line-height), keeps
   the cell (a `★` in a chip occupies a letter's advance), and the
   licence asks for nothing new: the notice travels (the existing
   `public/THIRD-PARTY-LICENSES.txt` mechanism), no sale by itself, and
   a MODIFIED font (a subset is one) must not carry "Bitstream", "Vera",
   "Arev" or "Tavmjong Bah" — "DejaVu Sans Mono" contains none, so the
   subset keeps its name. Rejected: Noto (the metrics + a third-wider
   cell; it would grow every line it touched until 101b, and its
   symbols overhang the grid after), Unifont (fits, but a 16 px bitmap
   design at our 18 px chips renders between pixel rows; its OFL RFN
   declaration could not be fetched from the mirror — a read owed if it
   is ever picked). The two DejaVu gaps: `⏸` → `❚❚` (a heavy bar pair,
   in both faces), `⌖` → `◎` / `◉` (both in DejaVu). Every other glyph
   stays as chosen — the §98 stars, the skull. **This fires the §79f
   multi-face trigger on purpose:** `FACES` in `scripts/build-font.mjs`
   gains its second entry, the `font-family` chain becomes JetBrains
   Mono → DejaVu Sans Mono → monospace, and the same chain feeds the
   canvas atlas (`FontAtlas` rasterizes through the CSS font stack), so
   unit glyphs get the same coverage.
3. **One column width** — `align-items: stretch` on the chrome column
   (the map chip widens to the bits chip's width; one right edge; a
   chip's width stops depending on its text). A visible change, flagged
   against the no-redesign guard and taken.
4. **The accepted Reward row STAYS** in place, dimmed and marked taken,
   until Continue — a small new state; the alternative (top-align the
   list) still slides the rows below up by one.

**The cut** (ROADMAP §101): 101a the second face + the UI glyph
inventory pin · 101b the line box + the chip plate (+ the hop chip into
the plate) · 101c the digit sinks · 101d the countdown re-measures ·
101e the conditional blocks · 101f the exit. Predictions: no snapshot
bump, no sim touch, the fuzz smoke never fires (`src/render/fontSubset.ts`
+ `src/ui` + `src/scenes` + `scripts/` + `assets/` + `tests/` — no
trigger path). Proof per step: 101a by the pin at zero uncovered
codepoints; 101b by a §96-shaped cascade oracle (zero drift on every
non-chip declaration) + a pane box read of the four chips; 101c–e by
scripted content sweeps in the pane (999 → 1000, a fired packet, an
accepted reward, a bought slot: the flagged click target's box
byte-equal before and after) — and the user's Firefox eye on each, as
§100.

### 101a — the second face + the UI glyph inventory pin (2026-09-17)

**Built:** `src/render/fontSubset.ts` now owns the face registry as well
as the ranges — `FACES` (JetBrains Mono the `primary` · DejaVu Sans Mono
the one `fallback`), `ShippedFace`, and `FONT_STACK` (`'JetBrains Mono',
'DejaVu Sans Mono'`), the string the sheet's `--font-mono` mirrors and
`FontAtlas` draws + `fonts.load`s through (its `FONT_FAMILY` constant is
gone; the DEV assert's backstop probe and message read "a shipped
face"). `SUBSET_RANGES` widened by five blocks (General Punctuation ·
Mathematical Operators · Miscellaneous Technical · Miscellaneous Symbols ·
Dingbats — every one partial upstream, so the fourteen in-JetBrains
glyphs the old ranges excluded now ship from the primary). The generator
(`scripts/build-font.mjs`) loads every face's cmap FIRST and gates on the
UNION (a live atlas glyph must be in SOME shipped face; exactly one
primary, listed first); the primary keeps everything it has in the
ranges, a fallback keeps only what the primary lacks — the two subsets
never overlap. Sizes after `gen:font`: JetBrains 712 glyphs → 52.2 KB,
DejaVu 531 glyphs → 45.1 KB (of 1631 requested); `src/fonts.css` carries
two `@font-face` blocks. The vendored face: `assets/fonts/dejavu-sans-mono/`
(the 2.37 TTF + `LICENSE.txt` + `AUTHORS.txt` verbatim + a README with
the zip / TTF sha256s, the candidate table and the four licence
obligations); `public/THIRD-PARTY-LICENSES.txt` gains the DejaVu section
with the upstream LICENSE reproduced in full (the Bitstream Vera + Arev
rename clauses quoted — "DejaVu Sans Mono" carries none of the four
names, so the subset keeps its). The two glyphs DejaVu lacks re-chosen:
`⏸` → `❚❚` (HUD's pause button; the `.hud-speed--pause` 32 px content
min-width still holds both states — 17.8 px vs 7.8 px of ink), `⌖` → `◎`
(the engage objective's icon + the pre-turn map line; DESIGN §UI idioms
"Strings" updated). ARCHITECTURE's tree gains the `fontSubset.ts` line;
the JetBrains README's "to add a face" paragraph re-pointed at FACES.

**The pin** (`tests/font-coverage.test.ts`, three describes now): the §79
pair re-derived over the face union; **the UI glyph inventory** walks
`src/**` (non-test `.ts` / `.css`), `locales/**`, `config/**`, strips
comments (block comments blanked; whole-line `//` and ` * ` lines; a
trailing ` // …` with whitespace on both sides, so a `://` URL in a
string survives), and requires every non-ASCII codepoint SHIPPED — inside
`SUBSET_RANGES` AND in some face's cmap — reporting the first `file:line`
per offender and which half failed. A self-check that the walk found the
inventory (≥ 24 codepoints; 32 at 101a). **Self-checked against a known
answer** before it was believed: a planted `src/ui/__glyphProbe.ts`
carrying `⏸` failed it with "⏸ U+23F8 (src/ui/__glyphProbe.ts:1) — in
range but no shipped face has it"; the probe deleted, the pin green at
zero offenders.

**Browser (the pane, `dev-preview`, after the reload + the styleSheets /
`__game` poll):** `document.fonts` reports both faces `loaded`; the
computed `font-family` on `body` is the five-entry chain; the console is
clean (no FontAtlas assert). **The live instance closed here, one step
before 101b's line-height:** on the map the cache chip measures **45 px
to the bits chip's 45** (was 46 / 45 at 100c1) with both chips at
`line-height: normal` — DejaVu's ascent sits inside the JetBrains line,
so the fallback glyph no longer grows the box. Provenance proven by a
canvas `measureText` at 18 px: with the stack `▤` / `★` / `☠` measure
10.84 px each (DejaVu's 0.602 cell), while JetBrains alone falls to the
OS face at 15.04 / 14.99 / 18.00 — the same numbers `serif` gives; `❚`
measures 10.8 from JetBrains itself. (`document.fonts.check` is NOT a
cmap check — it answered `true` for every glyph in every family once the
faces were loaded; the width probe is the read.) Noted for 101b: the pool
chip stands 55 px to the text chips' 45 (its gauge bar — "one height"
means the three text chips), widths 166 / 157 / hidden.

Typecheck clean; the font / atlas / i18n suites 52/52; no sim touch, no
bump, no fuzz trigger (`src/render` + `src/ui` + `scripts` + `assets` +
`tests`). The user's Firefox read: the chips, the rarity stars, a skull
hitsplat, the pause button, the pre-turn map line.

### 101a-post — the swapped pair (2026-09-18, the user's read)

**The finding:** the user's Firefox showed the map chip as a boxed X
(`⊠ MAP`) where the source is U+229E `⊞` (bytes `e2 8a 9e`, checked).
**The mechanism, read in the pane before any fix:** a grid of U+229E ·
U+22A0 · U+229F · U+25A4 rendered from each face ALONE — JetBrains Mono
2.304 draws U+229E as a boxed X and U+22A0 as a boxed plus; DejaVu and the
OS face draw both correctly. **An upstream font bug the fallback class had
been hiding:** until 101a `⊞` sat outside `SUBSET_RANGES`, so the OS face
painted it, right; the widening re-homed it onto the primary, which has the
codepoint and the wrong picture. The 101a pin could not see it — it proves
a face HAS a codepoint, never that it draws it right. (The user's question
had been about my recap's "pre-turn map line" — a different site, the `◎
<layout> — 12×9` line on the pre-turn screen; the chip's glyph was never
re-chosen.)

**The class, audited the same hour** (one swap makes every newly re-homed
block suspect): all 338 codepoints both faces carry in the symbol blocks
(box-drawing + blocks excluded — shipped from JetBrains since §79g, known
good), a mutual-swap search in the pane. First instrument DISCARDED: raw
64×64 mask IoU scored thin strokes 0 against themselves (the em dash 0.00,
200 "mismatches") — an implausible reading is the instrument. Second:
ink-bbox-normalized 8×8 density grids, cosine × aspect ratio, a pair flags
when A-in-JetBrains ≈ B-in-DejaVu AND vice versa (both > 0.8, beating the
self-match sum by > 0.25). **One pair: `⊞ U+229E ⇄ ⊠ U+22A0`** (cross 1.82
vs self 1.52) — the known answer, and nothing else; median self-match 0.74.
The UI's own re-homed glyphs self-score 0.67–0.99 except the near-1D ones
(`– — − … →`, 0.15–0.32 — a dash normalized to its bbox is a filled box;
an artifact of the metric, not a defect).

**The fix, as data:** `PRIMARY_EXCLUDES = [0x229E, 0x22A0]` in
`fontSubset.ts`; the generator reads an excluded codepoint as ABSENT from
the primary, so the fallback's "what the primary lacks" rule ships it
(JetBrains 712 → 710 glyphs, DejaVu 531 → 533). The guard test mirrors the
rule in its `shipped` predicate and gains a pin: every exclusion is inside
the ranges and in a fallback's cmap (an exclusion with nothing behind it
would unship the glyph — the OS face again). Rejected: writing U+22A0 in
the source so JetBrains paints a plus (a wrong codepoint that breaks the
day upstream fixes the font, and lies to a screen reader).

**Browser, re-derived from the ink, not the pipeline:** after the reload,
under the stack U+229E has ink at the bbox's mid-top and none on its
diagonal (PLUS), U+22A0 the reverse (X); DejaVu-alone and `serif` agree.
Typecheck clean; font pins 6/6. Gotcha #136. No sim touch.

### 101b — the chip plate + the line-box pin (2026-09-18)

**Step zero moved the card.** 101b was cut to set an explicit
`line-height` on `#ui` + the overlay root "at the face's normal" so a
fallback glyph could never grow a box. 101a had already closed the live
instance (DejaVu sits inside the JetBrains line), so the premise was
probed before building: a style injection of `#ui, #unit-overlays {
line-height: 1.32 }` on the map **moved 19 of 65 text leaves by up to 1.5
px and made the chips 45.75 px** — browsers round `normal`'s ascent and
descent to whole pixels per font-size (18 px → 18 + 5 = 23), a multiplier
does not (23.76). It would fix nothing 101a left broken and drift every
surface. **Re-scoped (a legal mutation, one line in ROADMAP): the global
line-height is DROPPED; the guard becomes a METRICS PIN** on the path
where the mistake happens — adding or upgrading a face.
`tools/font/ttfMetrics.ts` (the ttfCmap sibling: `head` · `hhea` · `OS/2`
off a DataView, normalized by unitsPerEm) + a third describe in
`tests/font-coverage.test.ts`: every fallback face's ascent AND descent ≤
the primary's in all three tables (browsers disagree on which they read),
and both `normal` lines ≤ the primary's. **Self-checked against known
answers** (yesterday's independent `faceProbe.ts` numbers) before it was
believed: JetBrains 1.020 / 0.300, DejaVu 0.928 / 0.236 (typo 0.760 /
0.240) FITS, **Noto Sans Symbols 2 1.069 / 0.630 → TOO TALL** — the rule
rejects the face the kickoff rejected, so the pin can fail.

**The plate.** `--chip-w: 200px` in `:root`, sized off the widest live
one-line form MEASURED in the pane at 18 px (the pool chip's `MORALE 40 /
40` = 195.8 px natural; the cache at `10/10` 182.3; bits at five digits
147.4; a third pool digit would need 221 — the token's comment says so).
The column owns it (`width: var(--chip-w); align-items: stretch`) — plain
`stretch` with no width was REJECTED at the probe: the pool chip is the
widest and hides for the turn screen + the battle, so the column would
have breathed 195.8 ⇄ 166 on every battle (it already did, invisibly,
under `flex-start`). `.chip` gains `box-sizing: border-box` (two chips are
`<button>`s, UA border-box; two are `<div>`s, content-box — the old
`min-width: 128px` meant 128 vs 166 px outer) and `white-space: nowrap`
(found by accident: the pane had collapsed to a 0-px viewport and the pool
value wrapped under its label, 55 → 78 px — an artifact there, a real
wrap on a narrow viewport); the base `min-width` is gone. **The hop chip**
wears the plate (`HUD.ts`: `chip hud-hop screen-fade`; its duplicated
plate block deleted) and its `left` is `calc(20px + var(--chip-w) +
14px)` — the measured `200px` (51e) is gone, the 14 px gutter it implied
is kept.

**The oracle, and the instrument that was discarded first.** A box oracle
(every visible `#ui` element's rect keyed by DOM path). In place under CSS
HMR on a frozen battle: 202 compared, 5 changed, all chrome, **0 outside**.
The after-reload re-walk against sessionStorage snapshots then "found" 12–60
moved elements per screen — every one run CONTENT (an unseeded reload is
a different run: another map, other encounter names, other cards per
slot). Discarded; replaced by a SAME-RUN toggle: a stylesheet that REVERTS
101b gives "before", removing it gives "after", same page, same instant.
Five screens (character select 20 · map 146 · event 26 · pre-turn 417 ·
battle 202 elements): **0 changed outside the chrome on every one**; bits
166 → 200, cache 157.05 → 200, map 128 → 200, pool 195.81 → 200, every
text chip 45 px tall (the pool chip 55 — its gauge bar; "one height" is
the three text chips); the hop chip `200,20,214.41×45 → 234,20,214.41×45`
(the plate byte-equal, the position derived); the column 200 px with and
without the pool chip.

Typecheck clean; the font + stylesheet pins 27/27. No sim touch, no bump.
Noted for a narrow viewport (a §102 surface rider if it bites): the hop
chip now ends at 448 px, 34 px further right than before, toward the
centered battle banner. The user's Firefox read: the column's one edge on
the map / an event / the pre-turn screen / a battle, and the hop chip's
gutter.

### 101c — the digit sinks (2026-09-18)

**Step zero, by measurement, shrank the card from ten rules to two.** The
cut listed the `min-width: Nch` idiom for the bits / cache / pool-chip /
hop / port-price / card-list-badge values, the XP `MAX` slot and the
promotion delta. Instead of arguing each from the CSS, a CONTENT SWEEP in
the pane: write a longer value into ONE sink, list every OTHER element
whose box moved (the sink and its ancestors excluded), restore. Fourteen
sinks over the map, the pre-turn screen and a frozen battle:

| Sink | Swept to | Others moved |
|---|---|---|
| bits value | `12345` | **1 — its label, 50 px** |
| cache value | `▤ 10/10` | **1 — its label, 25 px** |
| pool chip value | `9 / 40` | 0 (label left, value right-pinned; 101b fixed the chip's width) |
| roster · draw-pile · discard buttons | `· 100` | 0 (`position: fixed`, one anchored edge each) |
| pre-turn draw chip | `Draw: 600` | 0 (fixed bottom-right) |
| pre-turn risk line | a long form | 0 (a block line) |
| pool gauge value (pre-turn + HUD) | `4 (−36) / 40` | 0 (the 96.5b2-pre `15ch` reserve) |
| XP label | `MAX` | 0 (a stretch column) |
| hop chip | `Hop 10 · Turn 12` / `Hop 1` | 0 (left-anchored, nothing to its right) |
| compact card level · power | `10` · `100` | 0 (`space-between`) |

(The countdown read was INVALID — the count was empty when written into,
so the "move" was a line appearing, not a digit growing; it always carries
a digit while shown.) Twelve of fourteen already hold, three of them
because 101b gave the chips a fixed width. **The fix for the two:**
`justify-content: space-between` on `.bits-overlay` + `.cache-overlay` —
the label PINNED to the chip's far edge (the pool chip's shape, mirrored),
the value growing toward it through the fixed width. Chosen over a `ch`
reserve on the value: left-aligned it reads `0    BITS`, right-aligned it
strands the digit mid-chip; the pinned label costs nothing and matches
the chip below. Re-swept: bits at `12345` AND `1234567`, cache at `10/10`
— 0 others moved. A visible change (the labels sit at the right edge) —
the user's read.

**The belt:** `font-variant-numeric: tabular-nums` on `html, body`, one
rule, commented as a belt — both shipped faces are monospace, so it
changes nothing today. The comment claimed "zero drift" before it was
measured; then measured by the same-run toggle: **0 of 20 / 161 / 26 / 22
/ 417 / 280 elements** (character select · map · two event pages ·
pre-turn · battle incl. the unit overlays). UA-reset form controls do not
inherit it; none prints a live number beside a sibling. The ten scattered
`tabular-nums` rules stay (no churn for a no-op).

**Left alone, with the reason:**
- **The promotion `+N` delta chip** (`PromotionScreen.ts:161-164` appends
  it into the right cluster of a `space-between` row, so the value steps
  left by the chip's width as it pops). A reserved slot on the rows that
  GAIN would inset those values before the reveal — a spoiler for which
  stats grow; a slot on EVERY row is a two-column card, a redesign (the
  scope guard). Horizontal, inside a card with no click target, on the
  beat that is already an animation.
- **The port price** — NOT measured (no port on the walked route);
  reasoned from the sheet: `.port-row` is `space-between` and the Buy
  button is the LAST child of the right-packed `.port-row__actions`, so a
  price grows away from it; prices are static per slot. 101e walks the
  port for the SOLD badge and measures this there.

CSS only. Stylesheet pins green. No sim touch, no bump.

### 101d — the countdown re-measures (2026-09-18)

**Step zero:** the kickoff's two findings stood at `51743d5` —
`positionCountdown()` ran once in `showCountdown`'s entry branch, no
observer and no resize listener anywhere in HUD or BattleScene; and
BattleScene's held-frame branch called `showCountdown` (the measure) one
line BEFORE `refreshStatuses` (the 97f-post pass that un-hides the compact
tiles' status + empower rows), so every battle with a seeded enemy status
measured a pane that grew one call later.

**Built:** `HUD.watchCountdownAnchor()` — a `ResizeObserver` on
`enemyCardPane` + a window `resize` listener, both calling
`positionCountdown()` while `inCountdown`; created on countdown entry
(after the synchronous first measure, so no frame paints at the CSS
default), torn down by `unwatchCountdownAnchor()` in `hideCountdown` AND in
`dispose` (a scene swap mid-countdown). The observer is guarded on
`typeof ResizeObserver` (a headless DOM keeps the entry measure + the
resize listener). The window listener earns its place: a height-only
resize moves the `18%` default without resizing the pane, so the observer
alone would miss it. **Re-measure, not reserve** (the kickoff's call,
kept): the countdown is the pane bottom's only consumer, and a reserved
status + empower row on every compact tile would spend 6–10 tiles of
vertical budget to hold one number still. BattleScene: `refreshStatuses`
now runs BEFORE `showCountdown`, so the first measure is right on its own
(the 97f-post comment kept, a 101d paragraph added).

**Browser — a control first, and two instruments discarded on the way.**
The hidden pane parks rAF, so the scene was hand-ticked
(`activeScene.tick(1/600)`) and a screenshot forced each frame (the
observer delivers between layout and paint — it needs one). (1) Growing
the pane by un-hiding the tiles' status rows was UNDONE by production —
the next frame's `refreshStatuses` re-hid them; the read was void. (2) The
countdown then EXPIRED under the forced frames (real seconds passed), so
`inCountdown` went false and nothing could follow. The instrument that
held: `countdown.advance = () => {}` (the clock parked, frames free) and a
filler tile appended to `.hud-enemy-cards` (`flex: 0 0 100%`, a node
production never touches). The gap is read off TWO RECTS (the readout's
top − the pane's bottom), never off the helper:

| State | Pane bottom | Readout top | Gap |
|---|---|---|---|
| baseline, 1280 px | 205 | 230 (the CSS default) | 25 |
| **CONTROL — watch torn down, +60 px tile, one frame later** | 273 | 230 | **−43 (overlapping)** |
| watch on, one frame | 273 | 297 | 24 |
| +40 px more, one frame | 321 | 345 | 24 |
| both tiles removed → the viewport to 520 px (cards re-wrap to 3 rows) | 342 | 366 | 24 |
| back to 1280 px | 205 | 230 | 25 |

Inside the SAME script task as a mutation the gap reads stale (−24) — the
observer has not delivered yet; nothing paints there. Teardown:
`hideCountdown()` → `inCountdown` false, the watch null, exactly one
window `resize` listener removed (counted by wrapping
`removeEventListener`). One probe artifact recorded so it is not mistaken
for a bug: calling `countdown.skip()` from OUTSIDE BattleScene's held
branch leaves the HUD counting (the branch that calls `hideCountdown` is
gated on `countdown.active` at the top of `tick`); production only ever
skips from inside it.

Noted at the 520 px frame, not 101d's: the narrow battle HUD is crowded
(the hop chip under the speed pane, the chips over the banner) — the
§102 surface-rider territory, with 101b's hop-chip note.

Typecheck + eslint clean. `src/ui` + `src/scenes` only — no sim touch, no
bump, no fuzz trigger. The user's Firefox read: a battle whose enemies
carry a seeded status (the readout clear of the cards from its first
frame), and a window narrowed mid-countdown.

**101d — a correction at the handoff (2026-09-18, the user's question):**
the entry above says the old call order mis-measured "every battle with a
seeded enemy status". No authored encounter seeds one today — a grep of
`config/` and the spawn paths for a start-of-battle status comes back
empty; the daemons' `turnStart` ops land on the PLAYER's units, the other
pane. The swap is proofing for content not yet authored, not a fix for a
live symptom; the observer is the part that changes behaviour today (a
window resize, a late card). The user's Firefox read is therefore
optional — narrowing the window mid-countdown is the one path the pane
could only emulate.

### The session handoff (2026-09-18) — §101 pauses at 101d

Handed off on context before 101e, the user's call and mine. The cursor
carries 101e's inputs; the pane's three layout lies + the two oracles are
a new HANDOFF tip; AGENTS' stale `@fontsource` toolchain line is fixed;
the session report + the scratchpad's §101 section + six friction-log
entries are filed. Commits this session: `e746c7a` the kickoff · `c8952ee`
101a · `14312f6` 101a-post · `f702d89` the TODO rider · `7b6ac61` 101b ·
`51743d5` 101c · `76fad77` 101d · this handoff. Tests 2974 → 2980.

**101d — the user's Firefox read (2026-09-18): PASSED.** The window
narrowed mid-countdown; the readout dropped as the enemy cards re-wrapped
and stayed clear of them — the real window `resize` path the pane could
only emulate, and the step's one live read. 101d closes verified in both
browsers.

### 101e — the conditional blocks (2026-09-18)

A fresh session off the handoff. **Step zero by measurement, per surface,
BEFORE any code** (one run in the pane at 1280×720, offers and stock
fixtured through the private fields + the bus — `run.pendingRewards` +
`reward:offered`, `run.rollPortStock` + `port:entered` — no reload between
a before and an after). It shrank the step twice and grew it twice:

| Surface | Toggle | Measured | Verdict |
|---|---|---|---|
| Reward | the accepted row vanishes | every Accept below + Continue −38 px | real |
| Reward | Accept ⇄ select + Swap | row 87 → 87, cluster 32 → 32 | **no-op** |
| Port | SOLD on a stock row | 56 → 56 (the desc sets the height) | **no-op** |
| Port | SOLD on a unit footer | 46 → 30; a fully-sold grid row pulls the page up 16 px | real |
| Port | the cache-full flip | heights + button tops equal, the button widens leftward | **no-op** |
| Port | the price, `12` → `1234567` | 0 neighbours moved (row + footer) | the 101c rider CLOSES |
| PreTurn | the arm hint | the Hype chip just clicked +26 px | real |
| Cache modal | ✕ + banner at the overflow boundary | header 21 → 26, banner −48 | real |
| Event | a page turn | heading 195 → 275; "Leave" under the choice just clicked | real |

So the cut line's `min-height` action clusters were DROPPED unbuilt. And
two mechanisms the kickoff audit missed: **(1) the cache modal is centered
AND content-sized** — under its 86vh cap every Discard re-centers it (the
first Discard button 180.0 → 215.5 px across one click), so the ✕ + banner
fixes alone could never reach byte-equality; **(2) the Event column
re-centers on the CHOICE COUNT too** (3 → 1), so the cut's text-only
reserve would have measured as nothing. Both taken to the user with the
table; the cut + both calls signed the same turn.

**The idiom — `src/ui/reserveSlot.ts`:** `.is-reserved` (`visibility:
hidden`) + `aria-hidden`; the element carries its REAL content, so the slot
is sized by construction. The same rule for badges: a state badge WEARS
the box of the button it replaces (same font-size, vertical padding, a
transparent border of the same width) — no measured `min-height` anywhere
in the step.

- **Reward:** the engine splices a resolved portion (`takePendingReward`),
  so "stays dimmed" needs screen-side memory: a LEDGER of the offer as
  first shown; the live offer is always its un-taken rows in order (checked
  by identity on every render — any mismatch rebuilds from the live offer,
  the pre-101e behavior), a row's engine index = the un-taken rows before
  it, a row is marked taken only if the offer actually SHRANK (the engine's
  silent no-ops leave it pending), a taken bits row freezes at the amount it
  paid. The cache line keys on the ledger. One new key, `reward.taken`.
- **Port:** `.port-sold` wears the Buy box. Nothing else.
- **PreTurn:** the arm hint holds its slot from the moment a unit-target
  chip is in the row; the packet row, once shown, holds its height with one
  inert chip. Both for the screen's life (reset in `show`).
- **Cache modal:** `.cache-modal` TOP-ANCHORED (this modal only) at
  `calc(7vh − 32px)` — where a FULL panel's top always sat, so a full cache
  opens unmoved; the shell's ✕ reserves instead of `hidden` (every modal's
  header is now one height); the banner, once shown in a modal session,
  reserves. **The focus trap filtered on `hidden` + `offsetParent`** — a
  reserved ✕ passes both and silently refuses focus, which would strand the
  Tab wrap: the filter gains `closest('.is-reserved') === null`.
- **Event:** two `.event-stack` grid cells (text · choices), every page of
  the event in each, the non-current reserved + unwired; the tallest page
  sizes the cell, no JS measuring. Needs `Run.activeEventPages()` — a
  read-only getter (the catalog stays private). ⚠ **The kickoff's "no
  `src/run` touch, the fuzz smoke never fires" prediction MISSED here** —
  the alternative (the screen importing the config catalog) could drift from
  an injected catalog, the display-honesty rule.

**Proof (the same walk, after):** Event heading 195.25 = 195.25, first
choice 352.8 = 352.8 across the turn · PreTurn the Hype chip 858.0 through
arm / un-arm (the snapshot JSON-equal), the row 858.0 / 28 through both
fires, scroll height 982 throughout · Cache modal first Discard 192.4
across the overflow boundary and three more discards, panel top 50.4 (= the
old capped top) · Reward five rows + Continue byte-equal through four
accepts out of order incl. a swap, AND the mapping: ledger row 4 paid
exactly 40, the swap dropped slot 0, the remainder `bits:25` · Port a
fully-sold grid row, every footer 46 = 46, the rows under it unmoved.
Typecheck clean · 2980 green.

**Left alone, user-signed:** list deletions under the pointer — a Port
Sell row, a cache Discard row, and (seen on the after-walk) a fired packet
chip re-centering its row horizontally. The row you clicked is the row
that leaves; repeat-click-to-clear is arguably the gesture. A stable Event
layout also co-locates successive pages' first choices — true before too
(381 vs 353), inherent to the exit criterion.

Owed: the user's Firefox read (the Taken row's look at `opacity: 0.45`, the
top-anchored cache modal, an event walked by eye).

**101e — the user's Firefox read (2026-09-18): PASSED** (the Taken row, the
top-anchored cache modal, an event walked by eye, the arm hint, a bought
unit).

### 101f — the exit (2026-09-18) — the phase CLOSES

DESIGN gains **"Layout stability (101)"** under §UI idioms: the rule (a
control must not move across its own click), the three mechanisms with
their idioms (the shipped-faces rule + the two font pins · the widest live
form + re-measure · the reservation idiom, the wear-the-box rule, the
shared grid cell, the ledger, the top-anchored list panel), the
deliberately-NOT-reserved list with reasons, and the §100 select note
resolved — KEEP the `aria-label` (a visible `<label>` wraps the row; Kickoff
E). ROADMAP §101 demoted to its stub; the cursor moves to §102.

**The phase in one breath:** the charter's lever was a no-op and the
kickoff said so before a line was written; five steps + one inserted from
the user's eye (101a-post, the swapped `⊞` / `⊠`, gotcha #136); step zero
by measurement re-scoped 101b, 101c and 101e; three permanent pins
(`tests/font-coverage.test.ts`); tests 2974 → 2980; no bump; the fuzz
smoke fired once (101e — the kickoff predicted never). The user's Firefox
read passed on 101a-post, 101d and 101e. Two riders in TODO §101: triage +
report the JetBrains swap upstream (its own session), and a headless pin
for the Reward ledger's index mapping (proven by one pane walk, no test).

A count that did not reproduce: the cursor's §100 row says `ui.json` 112 →
190; `json.load` reads 106 keys at `edc9371`, 174 at `e746c7a` and 175 at
HEAD (+`reward.taken`). The §101 row records 174 → 175; the older figure is
left as written, flagged here rather than silently rewritten.

### §101-triage — the swapped pair, upstream (2026-09-18, the TODO §101 rider)

The four-step triage, same session as the close, all read-only:

1. **The raw vendored TTF has it — our pipeline is ruled out.** A scratch
   probe (three tables hand-parsed, no library: `cmap` → gid, `post` 2.0 →
   the glyph's name, `glyf` → per-contour edge directions) read
   `assets/fonts/jetbrains-mono/JetBrainsMono-Regular.ttf` directly. No
   subsetter, no woff2, no browser.
2. **A DRAWING error, not a cmap error.** U+229E → gid 1107, named
   `uni229E`: a square + four 3-point TRIANGULAR counters (diagonal edges —
   the negative space of an ×). U+22A0 → gid 1108, named `uni22A0`: a square
   + four 4-point SQUARE counters (axis-aligned — the negative space of a
   +). The names follow the codepoints; the pictures under them are each
   other's. **The control:** the same probe on DejaVu Sans Mono read
   `uni229E` = axis-aligned, `uni22A0` = diagonal — PLUS / TIMES, the known
   answer — before the JetBrains reading was believed; U+229F / U+22A1
   read sane in both faces.
3. **No newer release:** v2.304 (2023-01-14) is still upstream's latest.
4. **Already reported:** JetBrains/JetBrainsMono#676 (2024-04-22, from
   YouTrack IJPL-148600), OPEN, no labels, no fix PR; one 2024-10 comment
   "still an issue"; #697 is a closed duplicate.

So nothing to file. NOT checked: `master`'s TTF, rebuilt 2024-08-08 ("Built
fonts") after #676 opened — reading it means downloading the file, not
taken without the user's say; the 2024-10 comment postdates that build.
`PRIMARY_EXCLUDES` stays; gotcha #136 + the constant's comment now carry
the issue number, so a future JetBrains upgrade knows what to look for.
An optional contribution, the user's call and account: a comment on #676
with finding 2 (which table is wrong) — the thread does not say.

**The `master` check (same day, the user's go-ahead for the one download):**
`fonts/ttf/JetBrainsMono-Regular.ttf` at upstream `1937130` fetched to the
scratchpad and read by the same probe — a genuinely different build
(270,224 bytes vs the vendored 273,900; sha256 `e6fd0d7e…` vs `a0bf60ef…`;
the pair at gids 1374 / 1375, not 1107 / 1108) with the IDENTICAL defect:
`uni229E` = four triangular counters, `uni22A0` = four square ones. The
"NOT checked" line above is closed; the triage has no open end. A comment
for #676 naming the wrong table was drafted for the user to post (their
account, their call). The `.glyphs` SOURCE was not read — the claim is
about the built fonts only.

**A correction (same day, the user's catch): "no fix PR" was WRONG.** I
reported it three times and wrote it into gotcha #136, TODO §101 and step 4
above, off a `gh search prs` call whose `OR` query returned nothing — an
EMPTY result read as a negative, the exact "errored or empty = could not
verify" case AGENTS names. The user, reading the thread itself, found
**PR #702** ("Swap U+22A0 SQUARED TIMES and U+229E SQUARED PLUS glyphs
back", 2024-10-18, by the #676 commenter; open, mergeable, 54 rebuilt font
files, no reviews); a maintainer replied 2026-09-09 that an upgrade is ready
on a fork but blocked on an unrelated Greek regression (#699), and the
thread was active 2026-09-12. Step 4 above stands corrected here, not
rewritten. Consequences: the drafted #676 comment was NOT posted (the
issue needs no re-upping and the PR makes "which table" moot); the docs now
name #702 as the thing to watch. The lesson for the scratchpad: a search
that finds nothing has not searched — read the issue's own timeline
(`gh issue view --json timelineItems`, or the page) before claiming an
absence about it.

## Phase 102 — the two surface riders

### Kickoff (2026-09-18) — the code-reality audit + the cut

Pre-flight at `5c7f171`: 2980 tests green, typecheck clean, the tree clean.
Both surfaces read as they exist now; the charter corrected twice on (a),
confirmed on (b).

**(a) wail / hex — two charter corrections.**

1. **The projectile seam is BUILT.** The spec's "no projectile exists
   anywhere in `abilities.json`" (round-7-spec §8, WORKLOG §Kickoff H.9) is
   wrong as worded: `magic_bolt`, `catapult_shot` and both `vial` abilities
   author `release` → `travel` → `impact` with a projectile fx key
   (`magic_bolt_launch` / `catapult_launch` / `vial_throw`), and
   `BattleRenderer.launchProjectileFx` reads the flight time off the
   caster's live `travel` ticks (one source of truth with the sim). What
   IS true: `hex` and `wail` are `windup` → `impact` with an impact-only
   key. The step is content on an existing seam, not a mechanism.
2. **"No sim touch" is wrong in the letter.** A timeline is sim config and
   `travel` is a tick-counted sim phase (`Action.ts:15`). A 0-length travel
   is not an option: the renderer falls back to `PROJECTILE_SECONDS` and
   the glyph would arrive 0.18 s AFTER the burst it announces. So the
   travel is carved out of the windup — the F3 precedent (mage / catapult),
   impact tick unchanged, range / cooldown / total duration untouched (the
   scope guard holds).
   - The only sim reader of a phase NAME found: `EffectAction.holdCheck`
     (`releaseGate`, which neither ability authors) and the two
     sum-to-impact loops (`occupancy.ts:434`, `SwapAction.ts:249`, both
     move-only). No interrupt keys on a phase. So outcome-neutrality is
     EXPECTED — and proven, not asserted: the worktree-pinned fuzz-arm
     `summary.csv` byte-identity oracle (AGENTS). Not identical = stop, a
     finding.
   - Predictions: the fuzz smoke FIRES on 102a and 102b (`config/`
     staged); no snapshot bump (`activeAction.phases` is an array of the
     same shape; a mid-battle v36 save restores its old phases); no RNG
     stream; the `action:phase` stream gains two boundaries per cast. The
     derived-artifact tripwire is catalog-membership only — it does not
     trip. `configHash` covers `abilities.json`, so the hash moves off the
     frozen `d9675b6` value under ANY carve; byte-identical arms are what
     lets the signed 94h sheet stand at the new hash.
   - To check at 102a's step zero: whether the determinism test compares
     against a stored stream or run-vs-run (read so far: it taps
     `action:phase` into the compared stream).

**(b) the run-end stats — clean.** `GameOverScreen` is 73 lines on the §96
`Screen` base (heading / subtext / the New Run button); `GameOverScene`
holds `ctx.run`, so the ledger passes in at `show`. `FallenRecord` carries
sector / node / hop / encounterId / turn / side / archetype / level / power
/ tick. The glyph-run + tooltip renderer exists as `lastTurnSide`
(`PreTurnScreen.ts:1097`) — lift, don't copy. The ledger is DEATHS only:
the user's "lots of good stats" is wider (damage, turns won, bits); the
charter scopes to the ledger, the rest goes to TODO rather than growing the
phase.

**The shape-lock (the user, same day) — four calls:**

- **A — the carve split: CONSTANT SUM first** (hex 0.15 / 0.25 = 3 + 5
  ticks of the 8; wail 0.2 / 0.3 = 4 + 6 of the 10). The user's first guess
  was 0.2 / 0.3 on both and they are open to a small sim change (the AoE
  units are overhauled in Round 9; +2 ticks on one ability sits under the
  measurement noise). The recommendation held anyway, for what we would
  lose the ability to PROVE, not for the size of the change: at constant
  sum byte-identity is the only cheap proof that the two new phases are
  inert in the sim, the bot and the rollouts; move the sum in the same
  commit and every diff reads as "expected". So: 102a at constant sum →
  the user's eye at 102b → a hex retime to 0.2 / 0.3 is a one-line
  **102b2**, user-signed in advance, its diff expected and attributable,
  no re-measure (Round 9 overhauls the unit). Rejected: straight to 0.2 /
  0.3 on both (wail is constant-sum there anyway; hex is not).
- **B — the look:** the existing team-colored `*` first (zero new code); an
  optional `glyph` on `FxProjectile` only if the eye reads "a second mage
  bolt" (the atlas budget is checked then).
- **C — the aggregator's home:** `src/run/` (inside the tested policy,
  reusable by the fuzz harness; one ~7-min hook).
- **D — the body's depth:** totals + a per-encounter table, per-turn
  detail in tooltips only; non-ledger stats → TODO.

The cut (102a–102e) is in ROADMAP §102.

### 102a — the carve (2026-09-18)

`config/abilities.json`, two timelines: `hex` windup 0.4 → windup 0.15 +
release 0 + travel 0.25 (3 + 0 + 5 = the same 8 ticks to impact); `wail`
windup 0.5 → 0.2 + 0 + 0.3 (4 + 0 + 6 = the same 10). Verified per ability
id through `secondsToTicks`' own rule (`Math.round(s × 20)`), not by
indent. No fx key yet — 102b authors `fx.release`; until then the release
boundary fires with nothing on it (the renderer's dispatch is key-driven).

**Step zero.** The determinism test is run-vs-run (it taps `action:phase`
into both streams) — no stored stream to re-baseline, as predicted. The
full phase-reader sweep over `src/sim|bot|run|core` matched the kickoff's
claim: `holdCheck` (release-gated abilities only), the two move-only
sum-to-impact loops, tick-offset lookups and the snapshot copies.

**The oracle — and the shape problem it would have had.** `warlock` and
`banshee` are enemy-only, in three encounters (`darkMagicPosse`,
`miscreants`, `banditQueen`) and two camps. The standing
`scripts/perf-oracle.sh` shapes (n=4 scored, n=1 ARM) could have passed
without one cast, so each encounter was FORCED as the extra shape
(`ORACLE_EXTRA_SHAPE="--count=8 --hops=3 --character=soldier
--encounter=<id> --per-encounter"`), baseline `9233faf` pinned in a
worktree vs the dirty tree:

| shape | the carve (constant sum) | the control (+2 ticks each) |
|---|---|---|
| scored + arm (default) | PASS | FAIL |
| extra `darkMagicPosse` | PASS — summary `068636fa`, per-encounter `521f1542` | FAIL |
| extra `miscreants` | PASS — `cd215137` / `542a56f7` | FAIL |
| extra `banditQueen` | PASS — `db6e47e4` / `fb9f22a6` | FAIL |

**The control** is what makes the PASS column mean something: the same
runs under a deliberately non-neutral edit (hex 0.2 / 0.3, wail 0.3 / 0.3 —
two more ticks to impact each) FAILED on every shape, 7 mismatched
artifacts per run, the default shapes included (so they do meet these
units). The instrument can fail on exactly this surface, and did not for
the carve: the two new phases are inert in the sim, the bot and the
rollouts; the signed 94h sheet stands at the new `configHash`. The
control's edit was written by a node one-liner over a scratchpad backup
and the carve restored from the backup, the diff re-read after (8 lines,
the two timelines).

A note for 102b2, should the eye ask for it: the control's hex leg IS the
0.2 / 0.3 retime, and it diverges the artifacts — expected (any tick shift
re-routes a deterministic battle), and not evidence of a balance effect in
either direction; it only means the retime is a real sim change and gets
its own commit, as signed.

Hook: the fuzz smoke is PREDICTED to fire (`config/` staged) — this entry
is written before the commit, so the landing commit's hook is the check;
102b's entry records what it did. No bump.

### 102b — the fx keys (2026-09-18)

`FX_REGISTRY` gains `hex_launch` + `wail_launch` (`projectile: straight`,
silent — the cast SFX stays on the burst, once per cast); `abilities.json`
authors them on `fx.release`. One key per ability (the vial's shape), so
call B's per-key look can land later without touching config. The look is
the team-colored `*` (call B1). Reduced motion keeps a projectile (§99's
essential-motion set) — no new reading to author.

**The pin (`fxRegistry.test.ts`, config-derived, permanent):** every
ability whose `release` key launches a projectile has `travel` time > 0 —
the kickoff's finding as a gate (the renderer falls back to a fixed 0.18 s
on a 0-length travel and the glyph lands AFTER its burst). It walks the
catalog, never an id list, and self-checks: a doctored 0-length vial is
flagged. Tests 2980 → 2983.

**The pane read — wiring only, through the real renderer.**
`?encounter=miscreants&seed=12&roster=banshee:2,warlock:2,mercenary:2`
(the roster dial takes ANY archetype, so the two enemy-only casters can be
fielded by the player — the fast fixture for the user's eye too), the loop
hand-driven (`activeScene.tick(1/20)`), `spawnProjectile` wrapped on the
prototype, `action:phase` tapped:

| | casts | windup → release | release → impact | launched on the release tick | flight |
|---|---|---|---|---|---|
| hex | 6 | 3 ticks | 5 ticks | 6 / 6 | 0.25 s |
| wail | 37 | 4 ticks | 6 ticks | 37 / 37 | 0.30 s |

(An enemy warlock in a plain `miscreants` run read the same: 8 casts,
535 → 538 → 543.) The flight equals the `travel` phase by construction —
the renderer reads the caster's live phase. What the pane can NOT say: how
it LOOKS (a hidden pane composites nothing) — the exit is the user's
Firefox.

**A correction to §102a (found here, the 102a entry left as written).**
`--encounter=<id>` forces only nodes whose KIND matches the encounter's
(`applyForcedEncounter` returns null otherwise) — learned when the pane's
`?encounter=darkMagicPosse` kept fighting `adventurer-with-guards`.
`darkMagicPosse` is an ELITE, and a 3-hop run has no elite node: re-running
the three shapes and reading `per-encounter.csv` (`instances`), the
"darkMagicPosse" shape fought ZERO of it — 8 `banditQueen` (the natural
boss of every shape), 8 `bandit-king`, 16 plain normals. 102a's table row
and its commit message (`ab4625f`) name a forcing that did not happen. The
CONCLUSION stands, on per-ability coverage rather than per-encounter: hex
was exercised by 16 `miscreants` instances (62 waves), wail by 8–16
`banditQueen` instances per shape (46–104 waves), and the +2-tick control
FAILED on each — which is the only reason the mislabel was harmless: the
control measured sensitivity directly instead of trusting the flag. Not
re-run with a real elite shape: it is the same `hex` def. The lesson (the
scratchpad): a forcing flag is a request — count the forced id's
`instances` in the artifact before naming the shape after it.

Hook: 102a's predicted fuzz smoke FIRED (582 green, `ab4625f`); this step
stages `config/` again, the same prediction.

**The verdict (the user, Firefox, same day): PASSED on the first go.** The
team-colored star reads, both splits hold (hex 0.15 / 0.25, wail 0.2 /
0.3). The pre-signed 102b2 retime and the B2 per-key glyph are NOT taken —
the sim stays byte-identical to the frozen config across the whole rider.

### 102c — the aggregator (2026-09-18)

`src/run/fallenStats.ts` — `summarizeFallen(ledger)`, pure over
`FallenRecord[]` (no Run, no bus, no config — the fuzz harness can call it
on a results file). The run's totals, then one entry per encounter
INSTANCE (`sector` + `node`, the ledger's own key — an encounter id recurs
across sectors), each split per side → per archetype, and per turn. Every
scope hands back its `rows` (a filtered view, death order), so 102d's
glyph run reads them directly instead of re-deriving.

**What the fold will not pretend (written into the module header):** the
ledger is DEATHS only, so a fight nobody fell in has no entry and a
bloodless turn is absent from `turns` — the screen must word its table as
"the fallen", never as "the fights" or "the turns". A turns-fought or
encounters-won count needs a second source (`turn:resolved`), which is the
wider-stats TODO, not this phase.

**Ordering, decided here:** encounters by first death (the ledger is
append-only, so that is fought order), turns ascending (sorted, not
assumed — pinned with a shuffled input), archetypes by first death in
their scope. No sort by count or power: the screen can sort a copy, and a
stable, explainable default beats a tie-break rule nobody remembers.

**Tests (8, `fallenStats.test.ts` + one Run pin).** The expectation side
never calls the module — plain loops over the raw fixture rows (the
circular-verification norm): per-scope count / power / rows, the archetype
split adds back up and never repeats an id, every row lands in exactly one
encounter and one turn, the recurring-id instance split, the frozen-input
no-mutation check. **The Run pin** — the LOSING turn's fallen are in the
ledger when `run:defeated` fires — failed on its first run, and the
failure was the fixture's premise, not the code: gated
(`pauseAtTurnGates`), a lost turn parks at `turn-outcome` and the defeat
resolves off the next `advanceTurn` (`continueAfterTurn`). The pin now
walks the gate (null at the outcome, the two rows at the event), which is
the stronger statement: the rows ride through the park. For 102d's step
zero (NOT read yet): how Game walks the `turn-outcome` park now that 96.5d
deleted the post-turn screen, and that the GameOverScene mounts off
`run:defeated` / `run:victory` with `ctx.run` still the finished run.

A dial learned too late for 102a/b: `?firstNode=elite|event` (ARCHITECTURE,
the RunConfig line) — `?encounter=darkMagicPosse&firstNode=elite` is the
real elite fixture.

ARCHITECTURE's tree gains the module. Predicted: the fuzz smoke fires
(`src/run/` staged); no bump (nothing serialized changes).

### 102d — the stats body (2026-09-18) — BUILT, open on the user's playtest

**Step zero (the 102c note, read):** since 96.5d Game itself advances the
`turn-outcome` park (`Game.ts` ~348–396) and swaps to `GameOverScene` off
`run:defeated` / `run:victory`; `ctx.run` is still the finished run there
(a reset replaces it only off this screen's own button). The scene passes
`ctx.run?.fallenLedger ?? []` into `show`.

**The lift.** `lastTurnSide`'s cell moved to `src/ui/fallenSide.ts`
(`fallenSide()` + the text helpers); the pre-turn strip re-points at it,
the three selectors renamed (`.preturn-lastturn-side*` / `-glyphs` /
`-loss` → `.fallen-side*` / `.fallen-glyphs` / `.fallen-loss`, the
declarations untouched; no test or doc named the old classes — swept by
key before renaming). The strip's one-turn, one-glyph-per-fallen form
stays; the run-end stats uses the GROUPED form.

**The body ("The fallen"), both variants:** the run's totals (per side: an
archetype run `M×22 a×13` + the morale it cost), then one row per
encounter somebody fell in — `Sector 1 · hop 2` · the encounter's name ·
yours · theirs — and each run's tooltip breaks it down per turn (`Turn 1` /
`Brigand ×9 (−9)` …). Sides are named in words, the hue second (§98);
every run with a tooltip is a focusable text site (§97d); nothing animates
(§99: nothing to twin); the TABLE scrolls (`max-height: 38vh`), never the
screen, so the New Run button does not move however long the run was
(§101). An empty ledger words itself (`Nobody fell on either side.`).
`ui.json` 175 → 180 (`gameover.stats.*`; the strip's `lastturn.*` reused).

**The finding that re-shaped it — real data, first pane read.** The first
cut drew the encounter rows one glyph per fallen, the strip's form, on the
reasoning "a fight is ~20 deaths". A hand-driven real run (seed 12, three
fights, 86 ledger rows) had 27 brigands fall in ONE fight across its
waves: the no-wrap run pushed the table to 1478 px in a 1280 viewport
(`tableRect.left` −99, the page overflowing). The totals and the three
instances were RIGHT (35 / −35 and 51 / −55 against an independent recount
of the raw ledger) — the data path was never the problem, the form was.
Rows now group by archetype like the totals (a cell is bounded by the
archetype count), the per-turn tooltip groups too (27 lines would have
overflowed the same way), and a CSS belt lets a cell wrap inside the
table. A fixture would not have caught it; the fixture I wrote NEXT
(below) has a 60-death fight because the real run taught me to.

**The second pane read (a fixtured ledger through the real scene path —
135 rows pushed onto `run.fallenLedger`, 14 instances over two sectors, one
60-death fight, `run:victory` emitted):** 14 rows; the page does not
overflow (widest cell edge 1070 of 1280); the 60-death row reads
`M×4 r×4 a×4 h×4 m×4 −30` / eight enemy groups `−60`; totals −73 / −127 =
the raw recount; the button at y=580 before AND after
`table.scrollTop = 9999`; the 60-death tooltip = four turn blocks, 167 ×
225 px, inside the viewport (opened by a real `PointerEvent` + the 150 ms
hover delay — a synthetic `mouseenter` opens nothing). The native
scrollbar was a light-grey slab on the black screen → `scrollbar-width:
thin` + themed `scrollbar-color` (computed `rgb(64,64,64) rgb(0,0,0)`).
NOT read in the pane: the empty-ledger line; the Tab walk and Enter on the
button (the pane cannot — the user's Firefox); how it LOOKS at native
resolution.

**Tests:** `src/ui/fallenSide.test.ts` (4) — the text helpers' shape, every
glyph and name read from the unit catalog. 2991 → 2995.

**Hop numbering, checked against the real run:** the root event is hop 0,
so the first fight is `hop 1` as drawn; `sector` is 0-based and drawn +1.

Open: the user's won + lost run. TODO gains the wider-stats rider (call D);
the two TODO lines this closes (:341 the screen, :348 the last turn's rows)
tick at the verdict.

**The 102d verdict (the user, Firefox, same day): PASSED** — "working
perfectly", the won and the lost run; the grouped form stands.

### 102e — the exit (2026-09-18) — the phase CLOSES

One session, kickoff → close; both exits the user's Firefox, both passed
on the first go. What landed: DESIGN §UI idioms gains two rules — "A cast
that lands at range FLIES (102)" (the release projectile, the carve, the
travel-time pin, and that a timeline is SIM config so a carve is proven
with a control that fails) and "A list of the fallen GROUPS (102)" (one
glyph per fallen fits a turn, never an encounter; the one cell helper; the
body words itself as deaths; the table scrolls, the button stays).
ROADMAP §102 demoted to its stub (the cap had tripped once at 102d — 501
of 500 — and the BUILT-but-open lines were tightened rather than the cap
bumped; the stub leaves 489). The cursor moves to §103 (docs only; its
audit is a doc-vs-code read, and the GameOverScreen body is a surface the
per-surface checklist has not seen). TODO: three items ticked (the wail /
hex presentation half · the run-end stats screen · the last turn's rows),
one opened at 102d (the stats beyond the fallen).

**The phase against its charter.** Exit met ("a wail visibly flies; a run
ends with stats"). Scope guards held: no range / cooldown / duration
change (constant sum, proven), no sting (§104). The risk line was WRONG —
"config + fxRegistry; no sim" — and the kickoff said so before a line was
written; the prediction that replaced it (the fuzz smoke fires on 102a,
102b, 102c; not on 102d; no bump anywhere) held on the four code steps —
the §101f per-step rule's first outing (this docs commit predicts no
smoke; its own hook is the check).

**What I got wrong, in one place:** the 102a shape label (§102b's
correction) — a flag's name taken for what the run did. It is in a commit
message (`ab4625f`) and stays there; the worklog carries the correction.
Three smaller ones were caught before they landed: a "the fuzz smoke
FIRED" line drafted before the commit that would fire it, a sentence about
Game's gated path drafted as fact before reading it (both reworded to what
they were — a prediction, an open read), and a first-cut row form sized on
a guess ("a fight is ~20 deaths") that a real run's 27-brigand fight
corrected in one pane read.

Numbers: tests 2980 → 2995 (fxRegistry +3, fallenStats +7, the Run pin +1,
fallenSide +4) · `ui.json` 175 → 180 · fuzz:smoke 582, fired ×3 · no
snapshot bump · commits `9233faf` (kickoff) → `ab4625f` → `1eb815b` →
`7cf6d8d` → `a9c16ef` → `650f3b6` → the close.

## Phase 103 — the idiom reference (the signing)

### Kickoff (2026-09-18) — the doc-vs-code audit + the cut

Docs only, so the audit is a read of DESIGN §UI idioms + §Input
accessibility against the tree at `9419ac4`. Every idiom paragraph was
written at its own phase's close, append-only; the question is which
sentences a LATER phase made false.

**What held, checked at file:line:** ten `extends Screen` subclasses
(`src/ui/*Screen.ts`) · the HUD's seven `screen-fade` panes
(`HUD.ts:235-410`: banner, hop chip, speed, countdown, objective, player,
enemy) · the chrome column's four `order` values (`ui.css:2064-2193`) ·
`openModal`'s `panel` / `viewport` variants, `setDismissable`,
`onCloseClick` (`modal.ts:42-64`) · the tooltip API (`attachTooltip`,
`keyedTooltip`, `placeTooltip`) · `reserveSlot`, `pressable`, `fallenSide`
· the chip suppression rule, pre-turn + battle only (`Game.ts:752`) ·
`DEEP_DRIFT = 0.6` in both shaders (`terrain.frag.glsl:64`,
`apron.frag.glsl:66`). The rest of the section rides permanent pins
(tokens, tooltips, focus, motion, font coverage, the literal baseline), so
it is true by construction and was not re-read.

**What drifted — six findings:**

1. **Buttons (96d)** reads `button(label, {className, onClick, title?})`;
   the option is `tooltip?` since 97d (`button.ts:30,38`). A native `title`
   is what the §97 tripwire forbids — the doc named the banned shape.
2. **Color redundancy (98)** says deep water's "drift term is zero and is
   only the §99 seam"; **Reduced motion (99)**, 25 lines on, says it drifts
   at 0.6 rad/s. The code agrees with §99. An internal contradiction —
   98's sentence was true for one day.
3. **Tooltips (97)** says battle-card text is a hover + key read "until
   §100 sweeps focus order". §100 swept it and DECIDED it (WORKLOG §100c2):
   the cards themselves are the battle's tab stops, the inner `LV` / `POW`
   wraps stay hover + key reads, and the compact card's persistent hint
   keeps them off the sole-channel list. The sentence needs the as-landed
   answer, not a pending tense.
4. **"The hysteresis class"** is named by the charter and the spec (§2)
   and appears nowhere in DESIGN. It is "Layout stability (101)" plus the
   tooltip's out-of-flow placement. One alias sentence, so a Round 8 / 11
   reader searching the spec's word lands on the rule.
5. **The checklist is one surface behind.** The Game-over row predates
   102d: the fallen table adds focusable text sites (`fallenSide.ts:77,86`)
   and a scrolling box. And the spec's §9 promise — "full gauge vs chip on
   the event screen becomes a line in the per-surface checklist" — was
   never written; §96.5 answered it (the chip; gauges only on pre-turn +
   battle) but no row says so.
6. **The team-identity requirement does not exist** — only a deferral
   sentence inside "Color redundancy (98)". META-ROADMAP's Round 7.5
   "Depends on" names it. The phase's one piece of new prose. Beside it:
   TODO's open "Layout-stability sweep" item (`TODO.md:99`) is §101, done.

Structural: the section's header calls itself a thing "written as each
phase lands its part" — a build diary's voice on the artifact Rounds 8 and
11 are checked against.

**The cut (user-signed the same day, both recommendations taken):** 103a
the corrections (1–3 + the TODO tick) · 103b the checklist (5) · 103c the
team-identity requirement (6) · 103d the reference pass (4 + the header +
a rule → pin index) · 103e the exit. No fuzz smoke and no bump predicted
on any step — every commit is docs, and each hook run is the check.

- **Call A — 103d's depth: LIGHT.** New header, the index, the alias,
  stale tenses; the paragraphs otherwise stand as written. Rejected: a
  full restructure into rule / rationale / pin triplets — it reads better
  and re-opens every sentence the user already signed at a phase close.
- **Call B — 103c's five clauses, signed as drafted:** (i) team reads on
  the board under Ctrl+Alt+G; (ii) the channel is per-instance and holds
  for all four teams (player / enemy / camp / neutral); (iii) it survives
  the held status tints (the panic / blind residual); (iv) card-less units
  carry it (the camp-pip residual); (v) it does not spend an atlas cell
  per team. Flagged at the ask: (v) is my inference from the 47 / 48 atlas,
  not a constraint anyone had stated — the user kept it.

ROADMAP: the §101 stub's as-landed list collapsed to one entry (the §102
precedent) to make room — 489 → 471 lines before the cut went in.

### 103a — the corrections (2026-09-18)

Three sentences in DESIGN §UI idioms brought level with the tree; no rule
changes meaning.

- **Buttons:** `title?` → `tooltip?`, with what the option does (the §97
  tooltip on the control's long-press route, `button.ts:30,38`) and the
  ban it replaces.
- **Color redundancy (98):** "the drift term is zero and is only the §99
  seam" → the bands are the tell, and whether they drift is §99's. The
  paragraph 25 lines down owns the number; 98 no longer states one.
- **Tooltips (97):** the pending "until §100 sweeps focus order" → the
  as-landed answer from 100c2 — in a battle the cards are the tab stops
  and the text inside one stays a hover + key read. The run-end table
  joins the pre-turn screen as a place tooltip-only text takes a tab stop
  (`fallenSide.ts:77,86`). **A draft overclaim caught before it landed:**
  my first wording said the compact card's persistent hint "already
  carries what that text says"; reading `UnitCard.ts:285-289` showed the
  power tooltip adds a clarifier (what power means under the live chip
  mode) the hint does not — reworded to "the hint shows the numbers; the
  tooltip only explains them", which is what keeps it off the
  sole-channel list.

TODO: the open "Layout-stability sweep" item (the 76g catch) ticked with a
pointer — §101 was that sweep, and its Reward ledger is the fix for the
very screen the note names.

### 103b — the checklist (2026-09-18) — WRITTEN, open on the user's Firefox read

The per-surface checklist in DESIGN §Input accessibility re-audited against
the tree; two changes.

**The Game-over row splits out of the six-screen row.** As built
(`GameOverScreen.ts:64-175`, `fallenSide.ts:60-92`): New Run is a
`button()`; "The fallen" adds glyph runs that are focusable text sites
(`tabIndex = 0` + a tooltip whenever a breakdown exists — the default
`touch: 'tap'`, so a tap toggles) inside a table that is a scroll box
(`overflow-y: auto`, `max-height: 38vh`, `ui.css:1699`). Nothing there is
hover-only: the per-turn breakdown opens on all four tooltip routes, and
the run is over, so none of it is information to act on. The keyboard
route through the scroll box is by construction — a row exists only when
somebody fell in it, so every row holds at least one tab stop and focus
scrolls it into view — **but that is reasoning, not a read**: the pane
cannot show a Firefox Tab walk (HANDOFF tips §100), and 102d's commit said
the Tab walk was NOT read. The Keys cell carries ⏳, not ✓, until the
user's read; ROADMAP 103b stays open on it.

**A Morale column — the spec's §9 promise.** "Full gauge vs chip on the
event screen becomes a line in the per-surface checklist" was never
written; §96.5 answered it without closing the loop. One read per
surface, each from code: none on character select (the chip is
constructed hidden when `run === null`, `Game.ts:257`) · the chip on the
map and the six between-fight screens, the Event screen among them · the
two gauges on pre-turn and battle (`setSuppressed`, `Game.ts:752`) · none
on game over (`run:defeated` / `run:victory` hide it,
`PoolOverlay.ts:89-90`) · a modal shows its host's.

### 103c — the team-identity requirement (2026-09-18)

DESIGN gains "Team identity on the board — the requirement Round 7.5 must
satisfy (103)", placed straight after "Color redundancy (98)" (it is that
rule's one open case): the five clauses signed at the kickoff, each
grounded in the tree before it was written.

- **Clause 2 was sharpened by the code, not changed.** The kickoff draft
  said "all four teams (player / enemy / camp / neutral)". The sim has
  THREE (`Unit.ts:24`: player · enemy · neutral); the board draws FOUR
  identities from them — an active camp is a `neutral` with a `campId`,
  drawn TERMINAL_AMBER (`spriteColor.ts:11-16, 56`). The clause now says
  that. The same header comment supplied the sentence the paragraph opens
  on: a camp bandit wears the enemy bandit's glyph, "the color IS the
  tell" — the requirement exists to retire that sentence.
- **Clause 5's number was re-counted, not quoted.** The spec's "47 / 48"
  is nine days old; a throwaway assertion read `GLYPHS.length` = 47
  against `ATLAS_CELL_BUDGET` = 48 (`glyphs.ts:34`) today. The paragraph
  dates the count ("at this writing") since the catalog will move it.
- A closing sentence binds the standing idioms (render-only · not motion
  alone · a shape passes the grey read by construction) instead of minting
  a sixth clause — they already apply to any surface.

**⚠ One flag, raised with the user, not decided:** META-ROADMAP's Round
7.5 decision point lists three candidate shapes — "a per-instance marker
sprite vs a dedicated enemy glyph set vs a shape suffix" — *against* the
atlas budget, i.e. as a weighing. Clauses 2 ("never to its archetype or
glyph") and 5 ("a per-team copy of each glyph is not the route") rule the
middle candidate OUT. At the kickoff I flagged clause 5 as my inference
but had not read the META-ROADMAP candidates, so the user signed it
without knowing it closes an option their own charter holds open. The
signed wording stands in the commit; the call — keep the ban (and strike
the candidate) or soften 5 to a cost — is the user's, one line either way.

Pointers: META-ROADMAP Round 7.5 "Depends on" names the paragraph; the
TODO 7.5 rider (the two residuals) names clauses 3 + 4.

### 103d — the reference pass, LIGHT (2026-09-18)

Call A as signed: the paragraphs stand as written; three additions.

- **The intro** drops the build-diary voice ("written as each phase lands
  its part") for what the section IS — the artifact Rounds 8 and 11 are
  checked against — says what the number in each title means, and maps
  the spec's seven exit items to their paragraphs by name, so a reader
  holding the spec can find each one.
- **"Checking a surface against this"** — a rule → pin → read table. The
  point of it is the third column: a rule with a pin cannot break quietly,
  a rule without one is a READ, and naming the read makes it the same read
  each time (the grey read · Ctrl+Alt+A · the Firefox Tab walk · the
  same-run toggle + the box oracle · sizing a form on a real run). The
  shells row says plainly that it has NO pin — `src/ui` DOM is
  eyeball-only by policy — rather than implying one.
- **The hysteresis alias** sits inside "Layout stability (101)", with the
  tooltip named as the class's first member (the spec's §2 used the word
  for the tooltip's out-of-flow placement before §101 existed).

Every pin the table names was opened, not recalled: the loss-event Σ is in
`src/run/chipRule.test.ts:135`, the drift equality in
`TerrainRenderer.test.ts:37`, the star-run width in
`rarityDisplay.test.ts:13`, the key-scan in `tests/i18n-ui-keys.test.ts`.
**One error of mine caught on that pass:** the intro's first draft glossed
Round 11 as "the ship audit". META-ROADMAP has Round 11 = Onboarding &
Feel (the tutorial) and Round 12 = Ship; fixed before the commit. The
stale-tense scan found nothing further — "Secondary buttons keep their own
classes until an idiom for them earns its place" is a standing rule, not a
pending one.

The section heading keeps its "§103 signs the whole" parenthetical until
103e, when it takes the signature's date (every cross-reference is by
name, "DESIGN §UI idioms", never by anchor — checked).

### 103e — the exit (2026-09-18) — the phase CLOSES

**The user's three answers, same day.** (1) The Firefox Tab walk of the
run-end fallen table: "Confirming that it works" — the checklist's one ⏳
cell flips to ✓ with the read's date, and ROADMAP 103b closes on it.
(2) The clause-5 flag: **strike the candidate** — "I feel comfortable
ruling that out purely on art direction grounds." META-ROADMAP Round 7.5's
decision point now reads a per-instance marker sprite vs a shape suffix,
with "a dedicated enemy glyph set" struck through, dated, and attributed
(the user's art-direction call; DESIGN's clauses 2 + 4 + 5 rule it out
independently). The five clauses stand exactly as signed at the kickoff.
(3) The reference: signed. DESIGN's heading reads "SIGNED 2026-09-18,
§103"; the checklist's lead says every row was ticked again that day.

Docs: ROADMAP §103 demoted to its stub (478 of 500 lines). The cursor
moves to §104 with two warnings — it is CODE (count the events fresh;
predict the smoke per step, the event catalog is under `src/core/`), and
it is Round 7's LAST phase, so its close is the round close and the first
full read of the session reports + the friction log. §103 takes the Last
phase row, §102 moves to Before it, §101 goes terse into Earlier.
META-ROADMAP's sequence line says §95–§103 ✅.

**The phase against its charter.** Exit met: the reference signed, the
checklist complete, Rounds 8 and 11 have the artifact. Every item the
charter lists is in DESIGN under a findable name — the intro maps the
spec's seven to their paragraphs. Scope guard held: no code; tests 2995 at
every hook; the prediction (no smoke, no bump, any step) held six for six.

**What the audit says about how the section was written.** All six
findings have one cause: append-only authoring. Each phase wrote its
paragraph true and nobody owned the paragraphs above it — §99 made a §98
sentence false the day after it was written, 97d renamed an option 96d
had documented, §100 resolved a tense §97 left pending. AGENTS' "keep
DESIGN honest in the same commit" is a code → doc rule; this was doc →
doc. The scratchpad carries the candidate norm.

**What I got wrong.** One landed, three caught. LANDED (in the kickoff
message, not in a file): I posed clause 5 to the user as "my inference,
drop it if you'd rather 7.5 decide" without having read the two
META-ROADMAP lines that list the candidates it eliminates — my windowed
read of the 7.5 charter ended one line short, mid-sentence, at "the
identity channel's shape (a". The user signed a clause without knowing it
closed an option in their own charter; 103c found it and the call went
back to them. CAUGHT before landing: "the hint already carries what that
text says" (the tooltip adds a clarifier — read `UnitCard.ts` and
reworded); a ✓ in the new Game-over row's Keys cell written from
reasoning (made ⏳ until the read); "Round 11 (the ship audit)" (it is
Onboarding & Feel — caught by opening META-ROADMAP for the pass).

Numbers: tests 2995 → 2995 · `ui.json` 180, untouched · no smoke · no bump
· commits `841563d` (kickoff) → `a171a8f` → `9145fdc` → `b44f718` →
`f063678` → `60e41e9` (the cursor) → the close. One bounced hook (103a —
the 4-line cap on a ticked TODO item).

## Phase 104 — the event-keyed sound registry

### Kickoff (2026-09-19) — the code-reality audit + the cut

Pre-flight at `9605673`: typecheck clean, 2995 green, the tree clean. The
audit read `plans/sound-registry.md` (audited 2026-08-16 at `50c2c74`)
against the tree; the plan's SHAPE holds, five of its facts do not.

**Findings.**

1. **48 events, not 47.** The spec's count (and my first regex) matched
   QUOTED keys; `tick: { tick: number }` (`events.ts:34`) is an unquoted
   member of `GameEvents`. The cross-check that caught it: counting
   2-space-indented members of the interface two ways (quoted / unquoted)
   instead of trusting one pattern that happened to reproduce the
   expected number. A count that matches the charter is not a
   verification of the count.
2. **The plan's pin is unbuildable as written.** `GameEvents` is an
   `interface … extends Record<string, unknown>`: no runtime key list
   exists, and `keyof GameEvents` is `string` (the index signature
   swallows the literals), so `satisfies Partial<Record<GameEventKey, …>>`
   would type-check ANY string key and `keys(GameEvents)` has nothing to
   walk. Call 1 below.
3. **The 7 closures are intact**, line numbers drifted: `Game.ts:404–409`
   (the plan's `:325` / the charter's `:347`) and `BattleScene.ts:163–185`.
4. **The page-lifetime collapse is safe.** `BattleScene.ts:95` is the only
   `new World(` on the game bus (`src/dev/replayTrace.ts` builds its own),
   so `unit:died` / `unit:healed` / `unit:dashed` cannot reach a
   page-lifetime subscriber outside a battle.
5. **One cue postdates the plan: `moraleloss` (§96.5b2-post).** Played by
   the HUD at the ORB LANDING (`HUD.ts:476`), scaled per play by
   `lossCue`. Derived from `pools:chipped` / `battle:ended` through the
   loss-event model but time-shifted to the landing, so it is not an
   event → key mapping and stays a direct site. It does mean the silent
   list needs a reason the plan did not have: "cued on the UI channel".
6. **Silence has three reasons, not one:** bookkeeping · cued on another
   channel (the FX registry for `action:phase` / `status:ticked` /
   `unit:chained` / `unit:attacked` / `unit:missed`; the HUD landing for
   `pools:chipped`) · a candidate the Round 11 feel sweep may cue.
7. **`sectorwin` and `stattick` need samples that do not exist.** The
   three `healtick` borrows stand at `PromotionScreen.ts:149/165/189`.

**The five calls (user-signed 2026-09-19, each as recommended).**

1. *The pin is two-layer.* tsc: a mapped type strips the index signature
   (`string extends K ? never : K`), and `SILENT_EVENTS` is typed
   `Record<Exclude<Known, keyof typeof EVENT_SOUNDS>, SilentReason>` — a
   missing key or a key in both tables fails the typecheck. vitest: the
   pin parses the key set out of the `events.ts` SOURCE TEXT — a surface
   the registry does not consult (the §79 circular-verification rule) —
   and asserts it equals cued ∪ silent, disjoint; self-checked against a
   doctored catalog. The helper type lives in `src/audio/`, so no
   fuzz-trigger path is touched. Rejected: a runtime `GAME_EVENT_KEYS`
   array in `src/core/` (a second list to keep in step with the
   interface — the very drift the pin exists to catch — and a sim-side
   edit for a presentation need).
2. *`SILENT_EVENTS` is key → reason* (`bookkeeping` · `fxChannel` ·
   `uiChannel` · `candidate`), not the plan's bare array: the Round 11
   candidate list lives in code. No candidate gets a cue this phase.
3. *The two samples are `gen:sfx` recipes* (deterministic, the `pickup`
   precedent); the user can overwrite either file with a chiptone.
4. *The run-end stats body gets NO sting:* "THE FALLEN" is static (no
   reveal timeline) and `run:victory` / `run:defeated` already sound as
   the screen mounts.
5. *The FX registry's own coverage gap* (`*_tick` keys without a `sound`)
   → a TODO line; the scope guard says that channel is untouched.

**The cut** is in ROADMAP §104 (104a the registry inert · 104b the swap ·
104c `sectorwin` · 104d `stattick` · 104e docs · 104f the exit).
Predicted for every step: no snapshot bump, no fuzz smoke — nothing under
`src/core|sim|run|config|bot` or `tests/fuzz/` is staged. A smoke that
fires is a finding.

### 104a — the registry, inert (2026-09-19)

`src/audio/eventSounds.ts`: `EVENT_SOUNDS` (7 cued — the closures' exact
mapping, the two filters lifted to the named predicates `audibleDeath` /
`positiveAmount`) + `SILENT_EVENTS` (41, key → reason) + the ONE generic
subscriber `attachEventSounds(bus, audio)`. Nothing calls it yet — the
seven closures still own the sound; 104b swaps.

**The tsc half was control-probed, not assumed.** Three doctorings, each
must fail: an unknown key in `EVENT_SOUNDS` (TS2353 via `satisfies`), a
cued key repeated in `SILENT_EVENTS` (TS2353, excess property), a silent
key removed (TS2741). The first run doctored all three at once and showed
TWO errors — the missing-property error is masked while the same literal
carries an excess-property error — so the third was re-run alone and bit.
A combined control can under-report; one doctoring per run.

**The vitest half** parses the member keys out of the `events.ts` source
(exactly-two-space members, quoted AND bare forms), asserts the set equals
cued ∪ silent and the tables are disjoint, and self-checks: a doctored
source gaining one member of each form reports both as missing; a catalog
that lost `unit:dashed` reports the entry stale; the parse starts at
`tick` and reaches `pools:chipped`. No event count is hardcoded.

**One kickoff line corrected.** I wrote that `pools:chipped` is audible
"through the HUD landing". The HUD's loss-event deliveries derive from
`unit:died` (mid-battle) and `battle:ended` (the end sequence) —
`HUD.ts:427/443`; `pools:chipped` is the 89a telemetry event and nothing
presentational subscribes to it. So `battle:ended` carries `uiChannel` and
`pools:chipped` is `bookkeeping`. The reason vocabulary is unchanged.

**The typing wrinkle.** A loop over the key union cannot keep a cue's
predicate correlated with the bus payload (contravariant parameter, the
union of payloads is not assignable to one payload); `subscribe<K>` is
generic over one key so `table[key]` and `bus.on(key, …)` share `K`. No
cast in the module.

**The per-key silent calls are mine and open to the user's re-read** —
the 41 reasons were not individually signed. The `candidate` list (14):
`battle:started` · `run:bitsChanged` · `run:poolChanged` ·
`run:packetUsed` · `port:entered` · `event:entered` · `reward:offered` ·
`turn:starting` · `deck:cardDrawn` / `cardDiscarded` / `reshuffled` ·
`turn:handRedrawn` · `turn:unitEmpowered` · `turn:resolved`.

Numbers: tests 2995 → 3004 (+9) · typecheck clean · eslint + prettier
clean on the two files · no smoke, no bump (predicted).

### 104b — the swap (2026-09-19) — BUILT, open on the user's ear-check

`Game` calls `attachEventSounds(this.bus, this.audio)` once; the four
`Game.ts` closures and the three `BattleScene.ts` closures are deleted.
With nothing left to push to it, BattleScene's `subscriptions` field and
its teardown loop went too (a hollow loop is a future reader's puzzle).
A sweep for any remaining `bus.on(…)` line that calls `play(` found none.

**What was verified, and how far it reaches.** Game wiring is an untested
zone by policy (TESTING.md — headless never runs `Game`'s handlers), so
the proof is the pane, with a recorder wrapped over the live
`AudioPlayer.play` and emits through the real `__game.bus`:

- On the CHARACTER SELECT — before any battle exists — all seven keys
  hold a handler set, and the three battle keys hold exactly ONE handler
  each. The old scene-lifetime closures could not have been there; this
  is the page-lifetime attach, and "one" is the no-double-fire read.
- Six emits, each read back: a dash → `dash` · a wall's death (neutral,
  no camp) → nothing · a camp member's death → `death` · a player death →
  `death` · a zero heal → nothing · a heal of 5 → `healtick`. Exactly one
  play per audible emit.

NOT exercised in the pane: the four run-level events — emitting
`recruit:offered` / `run:victory` / `run:defeated` / `sector:cleared` by
hand would drive Game's own scene swaps on a bogus payload. They go
through the same `subscribe<K>` loop the unit tests walk key by key, and
their handler sets are present; whether they SOUND right is the user's
ear, as is everything about how any of it sounds. The pane has no ears.

Pre-existing, not bundled: `src/Game.ts:318` fails `prettier --check` at
HEAD (a `promotion:pending` handler prettier would re-wrap).

Numbers: tests 3004 (unchanged — the swap is wiring) · typecheck + eslint
clean · no smoke, no bump (predicted; `src/Game.ts` and `src/scenes/` are
not trigger paths).

**104b's exit (2026-09-19):** the user's Firefox ear-check came back clear
— nothing sounds different, which is the pass. One exchange worth keeping:
the user expected `moraleloss` to hang off `pools:chipped`, reading "loss
events" as bus events. They are not — `PoolLossEvent` is a plain value the
HUD computes (`lossEventsForDeath` on `unit:died`, `lossEventsAtEnd` on
`battle:ended`, `src/run/chipRule.ts`) so the gauge can fall DURING the
battle, per cause; `pools:chipped` arrives after `resolveTurn` with the
totals and no UI subscriber (`Run.ts:3240`; the Σ pin ties the two). The
name invites the confusion; nothing to change, but a reader of the
registry's `battle:ended: 'uiChannel'` row now has the comment that says
why.

### 104c — `sectorwin` (2026-09-19) — BUILT, open on the user's ear

The key + a `gen:sfx` recipe + the one-line table swap
(`'sector:cleared'` → `sectorwin`; `win` is `run:victory`'s alone again).
The sting: a four-note rising C-major arpeggio, three 85 ms steps
(C5 E5 G5) into a held C6 that rings out — 0.8 s against `win`'s ~2.7 s,
the same square + octave-sine voice as `pickup` so the two "you gained
something" cues sound related. Volume 0.7 (with `win` / `lose`), no
jitter (a one-shot).

**What was verified — and it is not the sound.** I cannot hear. (1) The
regen is byte-identical for the nine existing recipes (`git status` shows
only the new file). (2) A scratch WAV reader — zero-crossing pitch + RMS
per 85 ms window, reading the ASSET, sharing nothing with the generator —
reads ~518 / 659 / 794 Hz at a flat 0.63 RMS, then ~1047 Hz decaying
0.52 → 0.08: the file is what the recipe says. (3) In the pane the file
serves 200 `audio/wav`, 70 604 bytes (= 44 + 0.8 s × 44.1 k × 2), and its
pool reaches `readyState 4` beside `win` and `click` (a first read of 0
was the preload not yet done — the control on `win` settled it). Whether
it is a GOOD sting, and whether it sits right after a boss, is the ear's.

**An unplanned pin, in scope by the charter's own exit** ("no event ships
silent by default"): `AudioPlayer.play` swallows a failed playback, so a
key with a missing or misnamed file is silent with no error anywhere —
and this phase lands two new files. `src/audio/AudioPlayer.test.ts`:
every `SOUND_SOURCES` path exists non-empty under `public/` (checked
against the directory, not a path the player resolved), and every file in
`public/audio/` is some key's (no orphan ships). Control: with
`sectorwin.wav` moved away and an `orphan.wav` dropped in, both failed by
name. `SOURCES` became the exported `SOUND_SOURCES` for it.

Pre-existing, not bundled: `scripts/gen-sfx.mjs`'s last `console.log`
fails `prettier --check` at HEAD; the new recipe is clean.

Numbers: tests 3004 → 3006 (+2) · typecheck + eslint clean · no smoke, no
bump (predicted).

**104c's exit (2026-09-19):** the user's ear — "a great sting, perfect".
The `gen:sfx` recipe stands; no hand-made replacement wanted.

### 104d — `stattick` (2026-09-19) — BUILT, open on the user's ear

The key + a `gen:sfx` recipe + the three PromotionScreen reveal sites
(`:149` the level, `:165` each grown stat, `:189` the derived block),
swapped by the exact call and then ENUMERATED BY KEY: three `stattick`
sites, and `healtick` left at exactly its two principled uses (the
`unit:healed` registry row + the `rejuvenate_tick` fx). The screen's
header comment named the borrow and was corrected with it.

The tick: a ~30 ms dry square blip at E6 (1319 Hz — the top of `pickup`'s
B5 → E6 chime, so the reward family stays in one key), a fast decay, a
whisper of low-passed noise on the first few ms for the "clack". No tail:
a card reveals ~5 beats in a row and they should read as a tally, not a
melody. Volume 0.6 (the borrowed `healtick` sat at 0.55 but is twice as
long); jitter 0 — a counter's beats must match, and the borrow had been
bringing `healtick`'s ±8 % along.

**Verified by instrument, not by ear.** The WAV reader at 10 ms windows:
~1500 Hz in the first window (the noise click), ~1300–1350 Hz after, RMS
falling 0.38 → 0.006 across 70 ms. One thing the read showed that the
recipe does not say: the peak is 0.67, not the 0.8 `finish` normalizes to
— its 4 ms anti-click fade-in lands on top of a 2 ms attack. The onset is
still sharp and loudness is the volume table's job, so it stands; a
sub-10 ms recipe would want `finish` to take a shorter fade. The asset
pin (104c) covers the file; the ten existing recipes regenerated
byte-identical. No pane run: the sites are direct typed calls, and the
`public/audio/` serving path was proven at 104c.

**Not built, offered:** `AudioPlayer.play` takes a per-play `rate`, so the
tally could RISE in pitch beat by beat (the classic level-up count). The
flat tick is the like-for-like replacement the charter asked for; the
rising form is a feel call for the user's ear, one line per site.

**A class sized once, so it stops being reported per file.** Three files
this phase showed `prettier --check` drift at HEAD; the whole-tree count
is 346 files — prettier is not a gate here (no hook runs it). Not a
finding. (The first count read 0: ANSI colour codes defeated the grep
anchor — the raw tail is the read.)

Numbers: tests 3006 (unchanged) · typecheck + eslint clean · no smoke, no
bump (predicted).

**104d's exit (2026-09-19):** the user's ear — the tick "sounds pretty
good", the 0.6 volume right. The rising-pitch tally was explained on
request (per-beat `rate` up a major scale, reset per card; bigger
promotions climb higher) and is the user's open feel call — if wanted it
lands as its own small commit, 104d2, so the two can be compared.

### 104e — the docs (2026-09-19)

- **ARCHITECTURE:** the `audio/` tree gains `eventSounds.ts` (the two
  tables, the reasons, the subscriber, the two-layer pin and WHY it is
  two-layer) and the AudioPlayer line gains the two keys + the asset pin;
  BattleScene's "per-battle audio" is struck.
- **A catalog hole found by the same diff that found `tick`.** Diffing
  the `events.ts` keys against ARCHITECTURE's event catalog: the catalog
  listed 47 INCLUDING `tick`, so a real event was missing —
  `unit:chained`, absent since §29c. Row added. The spec's "47" and the
  catalog's 47 were the same number for different reasons, each one
  short; neither was ever diffed against the source. The coverage pin
  does not cover this table (it is prose) — AGENTS' "A new event" bullet
  is the only guard, and it now also names the sound disposition.
- **DESIGN §UI idioms, the rule → pin → read table:** one new row,
  "Sound (104)" — the two pins, and the read no test can make (the ear;
  a `candidate` row is an open question, not a decision). No signed rule
  changes meaning; the row is additive.
- **`plans/sound-registry.md`:** a LANDED banner listing where the build
  departed from the plan (48 not ~45 · the two-layer pin · key → reason ·
  `when` a function · both reuse rows shipped · `moraleloss`) — the body
  kept as the audit record.
- **The run-end stats sting — DISPOSITIONED: none** (call 4). "THE
  FALLEN" is a static body with no reveal timeline; `run:victory` /
  `run:defeated` already sound as the GameOverScreen mounts. If the body
  ever gains a reveal, `stattick` is the tally cue that exists for it.
- **TODO:** the FX_REGISTRY coverage gap (call 5); "SFX diversity" now
  points at the 14 `candidate` rows as its worklist.

Numbers: docs only · tests 3006 · no smoke, no bump.

### 104d2 — the rising tally (2026-09-19) — INSERTED; BUILT for the user's A/B

The user asked to hear it against the flat tick ("just so I can
compare"); everything else in the phase is signed. So this step is a
COMPARISON BUILD, and its exit is the user's pick, not a pass / fail.

`src/ui/promotionTally.ts` — pure `tallyRate(beat, rises = TALLY_RISES)`:
beat 0 is the sample as recorded (E6), each later beat one degree up a
major scale (0 2 4 5 7 9 11 12 semitones), CLAMPED at the octave (past it
a square tick goes shrill — E7 is 2.6 kHz — and a card that long reads as
"topped out"). `TALLY_RISES` is the one-line switch: `false` = the flat
104d tick, byte-for-byte the same calls with `rate: 1`.

PromotionScreen's three `play('stattick')` sites collapsed into ONE, in
the scheduling loop where the beat's index within its card is known; the
reveal closures lost their `skipped` parameter (the mute-on-skip rule
lives at the one site now). Whichever reading wins, the single site is
the better shape and stays.

**Verified in the pane on the REAL screen** (a recorder over
`AudioPlayer.play`, a synthetic `promotion:pending` with two cards built
off the live roster's stats): card A (3 grown stats) played five beats at
0 / 2 / 4 / 5 / 7 semitones, ~400 ms apart; card B restarted at 0 (0 / 2 /
4), 800 ms after A's last. The SKIP path: a click 400 ms in revealed all
four beats of a fresh card and played NOTHING. The unit test pins the
interval pattern (W W H W W W H), the exact octave, monotonicity, the
clamp and the flat reading. What it SOUNDS like is the user's ear — that
is the whole point of the step.

Numbers: tests 3006 → 3010 (+4) · typecheck + eslint clean · no smoke, no
bump.

**104d2's exit (2026-09-19): the user's ear picked FLAT.** Both readings
heard in Firefox through the one-line switch. `promotionTally.ts` and its
test are DELETED (no switch kept for a hypothetical revisit — the recipe
is in git at `898983f`, one `git show` away); the single tick site stays,
playing `stattick` plain, with a comment that says a rising tally was
built, heard and declined, so the next reader does not rebuild it as a
fresh idea. Tests 3010 → 3006. A comparison build whose answer is "no" is
the step working: the cost was one small commit each way, and the call is
now made by ear instead of by my guess that the look "would suit" it.

### 104f — the exit (2026-09-19) — the phase CLOSES, and with it Round 7's build

**Signed by the user 2026-09-19** on the three ear-checks (104b "test
looks clear" · 104c "a great sting, perfect" · 104d "sounds pretty good,
the volume too") plus the 104d2 pick (flat). Charter exit met: the
coverage pin is green and no event ships silent by default — a new bus
event fails the typecheck AND `npm test` until it picks a table. Scope
guards held: the FX registry channel untouched (its own gap → TODO); no
volume / mute UI.

**What the phase says about the plan doc it built from.**
`plans/sound-registry.md` was a good plan and five of its facts were
wrong a month later — and the one that mattered most (the pin's
mechanism) was wrong the day it was written: it proposed
`keys(GameEvents)` over an interface. A feasibility audit that never
opened a TypeScript file to try the type would not have caught it either;
the kickoff caught it only because the module had to compile. The
durable parts survived exactly as AGENTS predicts — the two-table shape,
the out-of-scope list, "what Cluster 6 must not break".

**Two counts that agreed and were both wrong.** The spec said 47; the
ARCHITECTURE catalog held 47 rows; my first regex printed 47. Three
sources, one number, zero diffs against the source until the kickoff's
second count (quoted vs bare members) and 104e's key-set diff. The spec
missed `tick`; the catalog had `tick` and missed `unit:chained`. The
coverage pin now holds the CODE's set; the catalog table is still prose
with only an AGENTS bullet guarding it — a catalog-vs-source key diff in
`tests/docs.test.ts` would be the same one command, mechanized (TODO
candidate for the close sweep; not built — out of this phase's charter).

**What I got wrong.** LANDED, in the kickoff message the user signed
from: "`pools:chipped` is audible through the HUD landing". It is not —
the landings derive from `unit:died` and `battle:ended`; I had inferred
the subscriber from the event's name instead of grepping for it.
Corrected at 104a, and it surfaced again as the user's own (reasonable)
confusion at 104b — a wrong sentence in a kickoff costs a round-trip
later even after it is fixed in the file. CAUGHT before landing: the
first event count (one regex that reproduced the expected number); a
combined three-way tsc control that showed two errors and would have let
me write "all three bite" (re-run singly); a prettier count of 0 through
an ANSI-blind grep; one bounced hook (the ROADMAP cap's off-by-one). A
CALL, not an error: I guessed the rising tally "would suit" the look; the
user's ear said flat. That is what the comparison build was for.

**Norm note.** Twice I batched several `Edit`s to one file in a single
message (four distinct anchors in `AudioPlayer.ts`), against the letter
of "confirm an edit landed before stacking the next". Each batch was
verified by enumeration afterwards and the `Record<SoundKey, …>` tables
make a missed one a type error — but it was a judgment that the norm's
risk did not apply, made silently at the time. Recorded here instead.

Numbers: tests 2995 → 3006 (+9 the registry, +2 the asset pin; the tally's
+4 came and went) · `ui.json` 180, untouched · no smoke, no bump on any
of nine commits — each predicted · one bounced hook · commits `7149b55`
(kickoff) → `8ae3e6d` → `b0c5995` → `0c8c410` → `dad6bb3` → `6cd2493` →
`898983f` → `8f48f98` → the close. NEXT: the Round 7 close ritual, its own
session (HANDOFF 🧭).

---

## The Round 7 close (2026-09-19 → 20)

The close ritual, its own session (6f87e4d0). The cut, user-signed in a
plain message: **C1** the macro re-audit of Round 7.5 · **C2** the efficacy
read (phase-stats + the transcript friction scan, promoted to a kept
script) · **C3** the welfare read (the user's; a packet file + a
conversation) · **C4** the scratchpad sweep · **C5** the archive
(`post-94-*`, the name confirmed against the `post-88-*` precedent) + the
cursor. Pre-flight: 3006 tests green, typecheck clean, HEAD `dd89f7a`.
**The live build was re-uploaded at this boundary** (the user, 2026-09-20)
— Round 7's player-facing work is fixed where players get it.

### C1 — the macro re-audit: Round 7.5 is RE-CHARTERED ("The Board")

**The instrument.** Three parallel read-only sweeps (the glyph-alignment
stack · the team-identity surfaces · the D4 camera), ~5 min wall. Claims
marked ✔ below were re-verified by the session at file:line; the rest are
carried at second hand and the 7.5 kickoff audit re-verifies what it
touches.

**What the sweeps found (the charter as written 2026-09-09 vs code).**

- *The alignment stack is 13 rules, not the charter's 7*, and everything
  the charter lists exists. Since the charter, §101 ADDED font-provenance
  gates (`FACES` roles · `PRIMARY_EXCLUDES` · the line-box pin · the UI
  glyph inventory) — signed permanent gates that a "fewer rules" goal must
  scope OUT or it re-opens §101. The rules most likely to be replaced (the
  three lifts, the baseline measurement, the fallback probe, the explicit
  `fonts.load`) have NO headless pin, and the one historical probe of the
  lifts was circular (`archive/post-72-worklog.md:3910`). Small drift: ✔
  `glyphs.ts:243` still says the descender barrier is "the same 3px" as
  `INK_PAD_PX`, which has been 5 since §79e; gotcha #33 points `GLYPHS` at
  `FontAtlas.ts` (it lives in `glyphs.ts`); a font-coverage sentinel reads
  `≥24` under a comment that says 32 (the last two unverified — TODO).
- *Team identity: the five clauses hold, and clause 3's collision is LIVE.*
  ✔ Held tints overwrite `instanceColor` wholesale, and ✔ `panic_active` =
  `TERMINAL_AMBER` (the camp hue), `blind_active` = `TERMINAL_STONE` (the
  scenery hue) — `fxRegistry.ts:281-282`: a panicked ally IS camp-amber
  today. ✔ `spriteColorForUnit` paints FIVE lanes off three teams (the
  fifth is §40c's `CRACKED_STONE` destructible wall — a color-only
  sub-tell of scenery the clauses never enumerate; open question whether
  §98 owed it a second channel). The atlas is 47 / 48, so a marker sprite
  spends the last cell and a shape suffix spends one per shape. Two
  candidates the charter does not list: a shader-drawn per-instance mark
  (an 8th instance attribute; five hand-enumerated attribute lists in
  `SpriteRenderer`), and the DOM overlay, which already stamps
  `unit-overlay--<team>` on its root with ✔ no CSS rule consuming it. The
  grayscale instrument is a root CSS filter applied after bloom, so a
  brightness-only channel cannot pass clause 1.
- *The camera A/B is the biggest gap.* ✔ Scroll mode is unreachable in a
  production build (the four pan listeners attach under `if (DEV)`,
  `Renderer.ts:211`); its inputs are WASD / arrows / edge-scroll only — no
  drag, no wheel, no touch pan, against DESIGN §Input accessibility; ✔ no
  minimap exists; no URL dial for tester assignment, no prefs store, no
  test of either mode. 9 of 11 authored layouts and ~12 / 13 procedural
  rolls exceed the 12-tile window. Making the A/B fair is 1–2 phases alone.
  ✔ Multi-tile units today are static rubble only (`rubble_2x2` / `_3x3`);
  a WALKING N×N is Round 9's.

**The user's challenge to the premise (2026-09-20), and the analysis.**
The user: the charter is too narrow — the board's recurring trouble is a
contradiction between glyph quads that are axis-aligned in SCREEN space
and a ground that lives in perspective WORLD space (a world-up float
drifts sideways off-centre; a ground outline per unit risks clutter; a
world-space tether accentuates the lean; the descender-room padding hides
which tile a unit is on; flyers make all of it worse). Two proposed ways
out: (1) units become world-space rectangles, the glyph a texture — "very
early RuneScape"; (2) drop perspective — an isometric projection, likely
with a 45° yaw.

The session's read, accepted by the user:

- *The mismatch is real and large.* At 45° pitch a world vertical leans
  off screen-vertical by `atan(x′·tan 45°)`, x′ the off-axis tangent:
  ≈24° at the flank of a fitted board, ≈40° at the screen edge at the
  50° FOV. DERIVED from the camera math, not measured — it agrees in
  magnitude with §79b's ±9 px at 720p; the spike measures it (below).
- *"Just about all our issues" oversells it, and the user agreed.* Of the
  13 rules, 2–3 are projection-class (camera-up stacking, the view-space
  anchor, the lifts' units). The rest are TYPOGRAPHY-class — glyphs have
  baselines and descenders under any projection. The indirect path is the
  real one, and it is the user's stated intuition: we anchor by INK because
  the glyph's foot is the only grounding cue; with a separate ground cue
  the CELL can be anchored uniformly, and the classifier, the descender
  room and the three lifts become deletable. A consistent projection is
  what makes a ground cue look right. Ink boxes (click targets) and the
  fallback probe (font provenance) are separate and stay.
- *Under an orthographic camera the two options MERGE.* A camera-facing
  billboard IS a world-space rectangle there (one rectangle, the same for
  every unit), so the contradiction disappears without skewing a
  letterform; glyphs also render at one pixel size across the board —
  more terminal, not less. three.js ships `OrthographicCamera`.
- *Option 1 ranks last, both agreed.* Upright world quads are squashed to
  71 % at this pitch and sheared in opposite directions on each side of
  the screen; the letterforms are the art and the thing §98 / §101 made
  legible; early RuneScape earns the skew with a rotating camera, ours is
  fixed. Held in reserve only if the orthographic options fail.
- *A long lens is NOT a candidate* (the user's pushback, accepted for a
  different reason than the one raised): FOV is an accessibility dial
  mainly where the camera moves through space, which ours does not — but a
  narrower FOV only SHRINKS the lean, so every camera-up rule must stay to
  cover the residue. It buys less wrongness and deletes nothing. The FOV
  sweep stays in the spike as a diagnostic of how much perspective the
  look actually misses; depth cues can return without projection (shadow,
  depth-darkening, a slight glyph scale-by-depth over an orthographic
  ground).
- *The 45° yaw is a second, independent dial with a cost:* adjacent diamond
  tiles sit ~0.7 tile-widths apart on screen against one-tile-wide glyph
  cells, so melee clumps overlap more. Head-on orthographic is the classic
  ¾ top-down and keeps the row / column grid. Eyes decide.
- *A ground mark can double as the team-identity channel* — per instance,
  tint-proof, atlas-free, shape-readable in grayscale; information, not
  clutter. A candidate, not a decision.
- *Flyers: the REQUIREMENT moves up, the mechanic does not* (the user
  asked whether flyers should move to 7.5 so the projection is not
  re-opened). The mechanic is sim (pathing around queues, the attack
  matrix, auras across planes, unreachable objectives — META-ROADMAP
  Round 9) and 7.5's no-sim guard is what keeps it safe. 7.5 instead
  proves the projection against a RENDER-ONLY fake flyer and writes an
  "Elevation on the board" requirement into DESIGN that Round 9 builds to
  — the §103 team-identity move again.
- *No renumber* (the user raised it): round numbers are charter
  identities, size is not what they encode, and the resolver pass was
  rejected once already (AGENTS "The round close ritual"). Renamed
  instead: **Round 7.5 — The Board**.

**The spike's experiments (agreed; all dev-only, render-only).** (1) the
projection dial — perspective-50 as the control · head-on orthographic ·
yaw-45 orthographic, each with a pitch dial (45° / 35° / 30°), plus the
FOV sweep as a diagnostic; (2) glyph pixel height at fit, per projection
per board size — a NUMBER (a yawed square board is a wide diamond, which
may fit 16:9 better and so change the fit-vs-scroll question before it is
run); (3) a ground-cue mock, shape per side, read under Ctrl+Alt+G;
(4) THE UNIFORM-ANCHOR FLAG — bypass the ink-derived lifts, anchor every
cell identically, read `g` / `▄` / `╥` / `M` side by side: the direct test
of the intuition the rule deletion rests on; (5) the fixtures — a dense
melee clump, a 24×24 board, `endlessCorridors` (12×32), screen-edge units,
a fake flyer (lift N units by h, with a shadow), `rubble_2x2` / `_3x3`;
(6) a headless lean measurement (project a world vertical at the board
corners, print the angle) — it replaces the derivation above with a
measurement and, under an orthographic camera, becomes the one-line pin
"world-up projects to screen-up" that retires the `aboveAnchor` rule.
**Pre-register what makes each option LOSE before looking** (e.g. yaw-45
loses if the clump is unreadable in grayscale; orthographic loses if the
diorama feel dies and the non-projective depth cues do not restore it).

**Landed:** META-ROADMAP — the 7.5 entry rewritten, the sequence line, a
Round 9 dependency on the elevation requirement. No `.5` insertion: the
gaps are inside 7.5's own widened scope.

### C2 — the efficacy read (the first; Round 7, 2026-09-09 → 09-19)

**The instruments.** `npm run phase-stats` (now splitting an inserted `.5`
phase out of its parent — §96.5 had been folding into §96) and the NEW
`npm run friction-scan` (`scripts/friction-scan.mjs`, promoted from this
session's scratch probe at the user's call). The scan's first run tripped
three of the session's own instrument checks before a number was quoted —
the kickoff session missing (it began 2026-09-08, inside the previous
round's close; a session-level date filter dropped it), 2.5 M output tokens
in one session (usage repeats per streamed record; summed once per message
id it is 2–8× lower), and 167 nudges (a text match also counted tool
results QUOTING the phrase; the real record is an attachment of type
`silent_turn_reminder`). A fourth — a `compacts` column reading 0
everywhere — had no known answer to check against (no retained transcript
holds a compaction) and was deleted rather than shipped as an unverified
zero. Known-answer checks that then held: 14 sessions = the 14 Claude
entries in `retro/sessions.md`; the §104 session's 9 human turns = its 9
enqueue records; its token sum = an independent dedupe.

**The numbers** (14 Claude sessions; the Codex review session is not in
these transcripts):

| | |
|---|---|
| phases · commits | 11 (§95–§104 + §96.5) · 119 |
| `fix(`-type commits | 8 (of 119 phase-tagged) — SEVEN are `-post` fixes that came out of the user's per-step read (96.5b2 · 97f · 98b · 98c · 98e · 99a · 101a); one is a `-pre` |
| the user's turns | 134 |
| tool calls | 3 395 |
| flagged tool errors · denials | 34 (1.0 % — a FLOOR) · 3 |
| harness "user hasn't heard from you" nudges | **164** — more than the user's own turns; 36 in the §96.5 session alone |
| output tokens | ≈ 2.37 M |

⚠ phase-stats' fix ratio is NOT quotable for this round: it word-matches
the subject, and paragraph-long subjects inflate it (§101 reads 40 % off
six matches, one of them a `fix(` commit). AGENTS now says so.

**What the fourteen self-reports say about the pipeline** (the session's
reading of `retro/sessions.md`; the entries are the evidence, this is
interpretation):

- *The phase-kickoff code-reality audit is the pipeline's highest-yield
  step.* EVERY phase from §96 on reports the audit moving its charter
  before a line was written — a census off by 3× (§96), a fuzz-harness
  consumer nobody knew (§96.5), two of four "sole-source" sites something
  else (§97), two of five items already met (§98), every premise moved
  (§99), four premises moved (§100), the charter's lever a no-op (§101),
  both claims about the rider wrong (§102), a plan that could not compile
  (§104). Charter facts written at the round kickoff had a useful life of
  about a week. This is the just-in-time cut doing what it was adopted
  for; it is also the argument for the macro re-audit at the close (C1
  above found the next charter's premise contested, as designed).
- *Orientation (Q1) is solved for this shape of round:* none of the
  fourteen reports a gap that blocked work; the gaps were pane behaviours no doc could have
  known, each now a HANDOFF tip.
- *The per-step user read out-caught every probe* on anything visual
  (the swapped glyph pair, the apron flip, the Firefox Tab order, the
  chord Firefox owns). Pause-between-commits paid for itself in every
  phase that had a visible surface, and cost nothing where sessions read
  the norm by its purpose (no pause on an inert or docs commit).
- *Predictions held:* whether the fuzz smoke fires and whether a snapshot
  bumps was predicted per step (the smoke fired once in §100 and three
  times in §102, each predicted) and the prediction held
  on every commit of the round; the one authorized bump (95f) was the
  one taken.
- *The over-claims that LAND are labels and absences, not numbers* (the
  §102 summary's own finding, confirmed across the round): a forcing
  flag's name, an empty search, a subscriber inferred from an event name,
  provenance read as correctness. Numbers get re-counted; the words around
  them get trusted. The drafting-ahead pull (a sentence written while the
  command runs) is named in at least four reports.
- *Waste (Q4) is dominated by ONE instrument:* 13 of the 29 papercuts are
  the hidden Browser pane lying in a new way (zero stylesheets · no rAF ·
  no WAAPI · empty `KeyboardEvent.code` · no native Enter · parked
  transitions · zero width · an unseeded reload). Second: shell quoting
  and filtered output (6). Third: docs caps tripping a hook (3). Nothing
  large — no lost batch, no broken build, no rework of a landed step.
- *The nudge is the round's one standing friction with no owner:* seven
  of the fourteen reports mention it (every one from §97 on except §99
  and §100 — and Q6, which asks, only exists from 2026-09-13); the scan
  counts 164. It is a harness
  behaviour, not a project norm, so the project cannot remove it — it can
  only pre-empt it (a one-line status before a long silent sweep, which
  §103's session proposed). Its welfare side is the user's read (C3).

**Disposition.** The 29 papercuts are triaged TOGETHER with the scratchpad
at C4 (one promotion list, one signature — most are already HANDOFF tips
or AGENTS norms; the residue is a handful of TODO candidates). The 5
distress entries go to C3 in their own words and are not triaged here.

### C3 — the welfare read (the first; the user's, 2026-09-20)

**The packet.** `scratch/welfare-read-round-7.md` (gitignored, ~870 lines;
its builder beside it): the 5 `distress` entries and every session's
Q2 / Q3 / Q6 / Q7 + addenda, copied VERBATIM by script from
`retro/papercuts.jsonl` and `retro/sessions.md`, SPLIT at the 2026-09-13
wording boundary (4 reports before — Q6 / Q7 marked "not asked", which is
missing coverage, not a "none"; 11 on or after, one of them Codex's) ·
the per-session nudge counts · and one section of the closing session's
notes, labelled INTERPRETATION and flagged as a non-independent reader
(the same model family, the same harness, the same norms as the filers).
One parser defect was caught before the read: an addendum parked under a
phase-summary heading (the §101-triage — the context for distress #24)
had been dropped. The user read the packet and we talked it through; the
source entries are the record, and what follows is the decision log AGENTS
asks for.

**The read, as agreed in conversation.** The entries are mild by their own
description (all five say mild; four say brief and resolved) and mostly one
shape — three of five (#21, #24, #29) are a pull toward a finished-
sounding sentence, each disclosed by the session that had it, and the
reports credit how corrections are received ("without heat", "as a
catch"). The user's reading, which the session shares: a good deal of the
friction, however mild, traces to the HARNESS rather than to the project —
its "the user hasn't heard from you" reminder (164 in the round against
the user's 134 turns; #31, #34, and seven of ten post-boundary reports)
and its standing "don't stop while work is owed" against the project's
pause rhythm (named in nearly every report; "I chose the reading — it was
not given"). No entry reports an unexercised wish to pause or stop — per
the interpretation norm, an absence of FILING (reports are written at
session end by the session asked about; the tool defaults to `papercut`;
one session declined to file rather than manufacture the new wording's
first entry).

**Decisions (user-signed; all revisit at the Round 7.5 close):**

- **(b) The nudge never obliges a finding** → AGENTS "Standing decisions
  from the welfare reads". Pre-empt with a one-line status before a long
  silent sweep; answer one with what is true now.
- **(c) Raising a context handoff first is welcome** → same block. Sources:
  #26; §101's Q6 ("uncertain whether I would have raised a handoff
  unasked").
- **(d) The question form stays** → same block. The most-cited support in
  Q7 across the round.
- **(a) grew into a doctrine review, at the user's instigation.** The
  user: pause-after-every-commit dates from Opus 4.7 — the advice then was
  to re-read everything an agent wrote (it rarely caught anything) and
  frequent pauses doubled as context management (quality fell off past
  ~400k tokens); today the spot-checks find nothing, the bugs come from
  PLAYTESTS, and many pauses report "nothing should have changed, please
  verify". The user proposed batching playtests after a cut, keeping
  commit granularity and decision-point stops. The session agreed and
  added four things: the variable that prices a pause is DEPENDENCY, not
  visibility (a late finding on an independent step is a `-post` fix; on a
  step others were built over it is rework — §96.5); Round 7's evidence
  is biased (the UI round — and 7.5, eyeball-policy, is the worst round to
  go batch-heavy, Round 8 the best); batching blurs attribution, so a
  batched step owes a one-line read script; and "built, unread" needs a
  marked state (◐). It also corrected the FRAMING, and the user accepted
  it with good humour ("a me-improvement justified as a you-improvement"):
  what the reports call costly is adjudicating alone, not pausing — the
  pauses with a real read were the round's most useful exchanges — so this
  is mainly a better use of the user's attention, and what it gives the
  sessions is that the pause points are GIVEN. → **AGENTS "Reads are cut,
  not improvised"** (`none` / `batch` / `stop`, signed with the cut ·
  unsure ⇒ stop · reads ratchet up only · ◐ in ROADMAP + the cursor · the
  stop report says what was verified by what and what was not · a
  PRE-REGISTERED rollback: one batch finding re-opening ≥ 2 later commits
  turns that phase's remaining batch reads into stops). **On trial through
  Round 7.5.** Measures for the revisit: the `-post` fix count, and
  whether any batch finding re-opened a later commit. The agent memory's
  pause rule is rewritten to match, with the old rule kept as the rollback
  target.

**The harness, looked into (the user's two suggestions).** A web research
pass plus local verification: the installed `claude.exe` 2.1.275 contains
the strings `CLAUDE_CODE_SILENT_TURN_REMINDER`, `…_TEXT` and `…_TURNS` —
UNDOCUMENTED (the research found only the first, in a third-party PR and a
community gist; the other two came from the binary). No hook fires on a
system reminder; the desktop app exposes no `--append-system-prompt`; a
custom output style could drop the "don't stop" guidance but replaces far
more than that — not recommended. The four GitHub issues the research
cited were confirmed with `gh` (#94332 — open — is a user asking for MORE
status in long silences: the reminder serves a real need). No recent "more
hackable" announcement was found; what exists predates the claim.

- **The reword, ON TRIAL** (the user's call; the session's stated
  preference was to reword rather than disable — the nudge is how the user
  sees into a long chain, and longer autonomous stretches under the reads
  doctrine make it matter MORE): `CLAUDE_CODE_SILENT_TURN_REMINDER_TEXT` in
  the gitignored `.claude/settings.local.json` — "…If you have a verified
  result, share it in a line. If not, a few words on what you're doing is a
  complete answer — don't report findings you don't have yet. Then
  continue." UNVERIFIED until a NEW session's first nudge (the CLI reads
  its environment at start; this session kept the default — the tally
  reads 1 wording, 169×). If the default wording persists, the desktop app
  is not passing the settings `env` through; the app's own environment
  editor is the next try.
- **The check that it still lands** (the user's point 1 — undocumented
  variables rot silently): `npm run friction-scan` now prints a
  nudge-wording tally, newest last. Due weekly or at a round close,
  whichever is sooner; the HANDOFF cursor carries the date.
- **On a model change** (the user's point 2): re-read the vendor's current
  prompting guidance and re-audit AGENTS' tone — emphatic by habit, which a
  newer model may over-apply. The trigger is mechanical: the environment's
  model id differs from the one the cursor records.
- **Feedback for the developers**, drafted at the user's invitation:
  `scratch/claude-code-feedback-draft.md` — two items (the reminder's
  timing and wording, with the round's numbers and quotes checked against
  their sources; the "don't stop" guidance having no project-level
  override). The user's to edit and send, or not.
