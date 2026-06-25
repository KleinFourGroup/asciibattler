# Archetype editor

Dev-only tool for authoring [`config/archetypes.json`](../../config/archetypes.json) —
the per-archetype glyph, abilities, targeting policy, `draftable` flag,
`baseStats`, and `growthRates`. Built for Phase I5's by-feel subclass tuning
(Mercenary / Adventurer / Ronin / Bandit); §30d added **create / delete** + the
guided wire-up.

## Run

```
npm run dev
```

then open <http://localhost:5173/tools/archetype-editor/>. It is **not** part of
the production build (no `rollupOptions.input` entry), same dev-only posture as
the [layout editor](../layout-editor/).

## What it gives you over editing the JSON by hand

- **Live schema validation.** Every edit re-runs the same per-entry
  `ArchetypeSchema` the game boots on (imported from `src/config/archetypes.ts`),
  so the editor's "valid?" can never drift from the game's load-time parse. Save
  is disabled while anything is invalid. (§30d validates **per entry** — the
  whole-config `z.object` would silently strip a new, not-yet-wired key.)
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
  `config/archetypes.json` via a dev-only Vite endpoint (`/__save-config`, see
  [`vite.config.ts`](../../vite.config.ts)). An open game tab hot-reloads the
  new values. Copy / Download remain as offline fallbacks; the on-disk format is
  byte-identical to a hand edit (pinned by
  [`tests/tools/archetype-editor.test.ts`](../../tests/tools/archetype-editor.test.ts)).

## Create / delete (§30d)

**+ New archetype** clones the active one as a seed (edit its glyph, abilities,
stats); **Delete** removes it (never the last). Because the roster is a **closed
typed vocabulary**, the editor authors the DATA but can't make a new archetype
spawn + render on its own — that needs three code edits. So the **Wire-up** panel
emits them verbatim for any created / deleted archetype:

1. `src/sim/Unit.ts` — add / remove the key in the `Archetype` union.
2. `src/config/archetypes.ts` — add / remove the key in `ArchetypesSchema`.
3. `src/render/glyphs.ts` — append / remove its glyph in `GLYPHS` (append-only,
   gotcha #33; the panel tracks the `n/48` atlas budget and flags a needed
   `FontAtlas.ts` resize).

The JSON Save and those edits land together. This keeps the union closed and
type-safe (every exhaustive `switch(archetype)` still checks) while removing the
multi-file tedium.

The stat fields enumerate from `STAT_LABELS` and the ability/targeting choices
from the live registries, so a future stat or ability surfaces here with no edit
to this tool.
