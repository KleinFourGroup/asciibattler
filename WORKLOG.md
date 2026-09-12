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
at `40 / 40`. Console: no errors. **Playtest: pending (the user's).**
