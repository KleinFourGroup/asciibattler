# Unit editor

Dev-only tool for authoring [`config/units.json`](../../config/units.json) — the
whole §38 `UnitDef` catalog. For a **combatant** archetype that's the glyph,
abilities, targeting policy, `draftable` flag, `baseStats`, and `growthRates`;
for a **neutral** (wall / half-cover / future rubble) it's the glyph, a flat
`hp` pool, `blocksLineOfSight`, and the `statusSusceptibility` allow-filter.
Built for Phase I5's by-feel subclass tuning (Mercenary / Adventurer / Ronin /
Bandit); §30d added **create / delete**, and §38e made creating a unit **pure
data — no code edit** (the closed-union wire-up panel is gone).

## Run

```
npm run dev
```

then open <http://localhost:5173/tools/archetype-editor/>. It is **not** part of
the production build (no `rollupOptions.input` entry), same dev-only posture as
the [layout editor](../layout-editor/).

## What it gives you over editing the JSON by hand

- **Live schema validation.** Every edit re-runs the same per-entry
  `UnitDefSchema` the game boots on (imported from `src/config/units.ts`) — a
  `z.union` of the combatant + neutral shapes — so the editor's "valid?" can
  never drift from the game's load-time parse. Save is disabled while anything is
  invalid. (Validates **per entry** — the whole-config `z.record` would silently
  strip an entry that fails structural checks.)
- **Live derived-stat preview.** maxHp, crit, move + per-ability attack cadence,
  to-hit, dodge, and attack/heal power — all computed by the **real** game
  functions (`deriveStats`, `hitChanceFor`, `attackCooldownTicksFor`,
  `scaleStats`), never reimplemented, so they match combat exactly.
  - **Level dial** previews where the growth rates land a unit deeper into a run
    (deterministic expected-growth path).
  - **vs EVA / vs PRC** set a reference opponent so the dodge identities are
    tunable by feel — at the I1 uniform `precision == evasion == 5` every unit
    sits at the `hitChanceBase` to-hit; spread them and watch it move.
  - Per-ability output reads each verb's `scaling` off its op (the post-Y source
    of truth), so the numbers are correct for **any** archetype — a freshly
    created one included — and status riders / chain / summon verbs are named.
- **Save to disk.** "Save to config" writes the whole file straight to
  `config/units.json` via a dev-only Vite endpoint (`/__save-config`, see
  [`vite.config.ts`](../../vite.config.ts)). An open game tab hot-reloads the
  new values. Copy / Download remain as offline fallbacks; the on-disk format is
  byte-identical to a hand edit (pinned by
  [`tests/tools/archetype-editor.test.ts`](../../tests/tools/archetype-editor.test.ts)).

## Create / delete — pure data (§38e)

**+ New unit** clones the active tab as a seed and inherits its **kind** (clone a
combatant tab for a new archetype, a wall/half-cover tab for a new neutral), so
edit its glyph + fields and go; **Delete** removes it (never the last).

§38 turned the closed `Archetype` union into an open catalog id (§38c) and made
unit glyphs **catalog-derived** (§38e-1), so a created unit needs **no code
edit** — Save writes `config/units.json`, an open game tab hot-reloads, and it
spawns + renders. The old **Wire-up** panel (which emitted `Archetype`-union /
`UnitDefsSchema` / `glyphs.ts` edits to paste) is therefore **gone**, replaced by
a **Font-atlas** budget indicator: the one real limit left is the atlas grid,
which caps the total glyph count (`n / 48` cells). Reusing a glyph or growing the
`FontAtlas.ts` grid is the only escape hatch if a Save would overflow it — and an
over-budget catalog **blocks Save** (it would crash the atlas build on reload).

The stat fields enumerate from `STAT_LABELS`, the ability/targeting choices from
the live registries, and the neutral status-susceptibility choices from
`STATUS_DEFS`, so a future stat / ability / status surfaces here with no edit to
this tool.
