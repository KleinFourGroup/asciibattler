# Archetype editor

Dev-only tool for tuning [`config/archetypes.json`](../../config/archetypes.json) —
the per-archetype glyph, abilities, targeting policy, `baseStats`, and
`growthRates`. Built for Phase I5's by-feel subclass tuning (Mercenary /
Adventurer / Ronin / Bandit), but useful for any balance pass.

## Run

```
npm run dev
```

then open <http://localhost:5173/tools/archetype-editor/>. It is **not** part of
the production build (no `rollupOptions.input` entry), same dev-only posture as
the [layout editor](../layout-editor/).

## What it gives you over editing the JSON by hand

- **Live schema validation.** Every edit re-runs the same `ArchetypesSchema`
  the game boots on (imported from `src/config/archetypes.ts`), so the editor's
  "valid?" can never drift from the game's load-time parse. Save is disabled
  while anything is invalid.
- **Live derived-stat preview.** maxHp, crit, move + per-ability attack cadence,
  to-hit, dodge, and attack/heal power — all computed by the **real** game
  functions (`deriveStats`, `hitChanceFor`, `attackCooldownTicksFor`,
  `scaleStats`), never reimplemented, so they match combat exactly.
  - **Level dial** previews where the growth rates land a unit deeper into a run
    (deterministic expected-growth path).
  - **vs EVA / vs PRC** set a reference opponent so the dodge identities are
    tunable by feel — at the I1 uniform `precision == evasion == 5` every unit
    sits at the `hitChanceBase` to-hit; spread them and watch it move.
- **Save to disk.** "Save to config" writes the whole file straight to
  `config/archetypes.json` via a dev-only Vite endpoint (`/__save-config`, see
  [`vite.config.ts`](../../vite.config.ts)). An open game tab hot-reloads the
  new values. Copy / Download remain as offline fallbacks; the on-disk format is
  byte-identical to a hand edit (pinned by
  [`tests/tools/archetype-editor.test.ts`](../../tests/tools/archetype-editor.test.ts)).

## Scope

Edits the **six existing** archetypes. Adding a brand-new archetype still needs
code — the `Archetype` union in `src/sim/Unit.ts`, a glyph, and ability
factories — because the roster is a closed union. Once those land, the new key
appears here automatically for tuning. The stat fields enumerate from
`STAT_LABELS` and the ability/targeting choices from the live registries, so a
future stat or ability surfaces here with no edit to this tool.
