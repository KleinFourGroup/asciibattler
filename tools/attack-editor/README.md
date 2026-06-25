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

- **30a (this commit)** — the scaffold: ability picker, the scalar/identity
  fields (name · cooldown · priority · range · min-range · orphan policy ·
  speed-scaled · ignores-LOS), the **target selector** form (self / enemyInRange
  / aoe / lowestHpAlly), live validation, save, and a structure preview. The
  **timeline** and the recursive **effect-op tree** are shown read-only.
- **30b** — the recursive effect-op tree builder (all six ops; `chain`'s inner
  ops recurse; status-id + summon-archetype dropdowns).
- **30c** — the timeline editor + a live **resolution-outline** preview that
  shares the real interpreter (resolved damage/heal numbers vs a sample caster).

## Notes

- `config/abilities.json` was normalized to the formatter's canonical shape in
  30a (defaults omitted, e.g. `speedScaled:true` / `minRangeCells:0` /
  `ringMultiplier:1`; trailing-zero floats trimmed). Semantically null — the
  deep-equal round-trip test (`tests/tools/attack-editor.test.ts`) guards it.
- A genuinely **new** ability id needs a registry wiring to be spawnable
  in-game; the editor only authors the data. Creating/renaming abilities is a
  later sub-step.
