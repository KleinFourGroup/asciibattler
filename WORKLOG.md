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
