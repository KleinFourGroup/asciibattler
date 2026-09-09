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
