# Attack Editor (`tools/attack-editor/`)

A dev-only Vite page for authoring `config/abilities.json` — the single
`AbilityDef` catalog every combat verb resolves against
(`src/sim/effects/schema.ts`). Visit `http://localhost:5173/tools/attack-editor/`
after `npm run dev`. Never bundled (no `rollupOptions.input` entry).

Like the archetype / encounter editors it offers: **live schema validation**
(the real `AbilityDefSchema`, Save disabled while invalid), a **structure
preview**, and **save-to-disk** via the dev-only `/__save-config` endpoint, all
through the byte-faithful `formatAbilitiesJson` (`format.ts`) — so a no-op Save
is a no-op diff.

## Scope (Cluster 1, Phase 30)

- **30a ✅** — the scaffold: ability picker, the scalar/identity fields (name ·
  cooldown · priority · range · min-range · orphan policy · speed-scaled ·
  ignores-LOS), the **target selector** form (self / enemyInRange / aoe /
  lowestHpAlly), live validation, save, and a structure preview.
- **30b ✅** — the recursive **effect-op tree**: every effect's `{phase, op}` is
  form-edited (phase ← timeline phases; add / remove / reorder-by-delete), all
  six op kinds (damage / heal / move / applyStatus / chain / summon) with a kind
  switch that swaps in a fresh default, `chain`'s per-hop ops (damage |
  applyStatus) nesting, and status-id / summon-archetype dropdowns from the live
  registries. The reusable target-selector widget also drives a summon's `at`
  anchor.
- **30c ✅** — the **timeline editor** (editable phases: name · seconds-or-`fill` ·
  `scalesWithSpeed`, add / remove, with the live schema refines — one `fill`, no
  `fill`+speed-scale) + a live **resolution-outline** preview that shares the real
  resolvers: `resolvePhases` / `resolveCadenceTicks` lay out the timeline in ticks,
  and the extracted [`resolveScalars`](../../src/sim/effects/resolveScalars.ts)
  kernel (also consumed by `propose.ts` — one source of truth) resolves the
  damage / heal / crit / chain-falloff numbers against an editable **sample
  caster** with archetype-base-stat presets.

## Notes

- `config/abilities.json` was normalized to the formatter's canonical shape in
  30a (defaults omitted, e.g. `speedScaled:true` / `minRangeCells:0` /
  `ringMultiplier:1`; trailing-zero floats trimmed). Semantically null — the
  deep-equal round-trip test (`tests/tools/attack-editor.test.ts`) guards it.
- A genuinely **new** ability id needs a registry wiring to be spawnable
  in-game; the editor only authors the data. Creating/renaming abilities is a
  later sub-step.
