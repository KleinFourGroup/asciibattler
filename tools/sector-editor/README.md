# Sector Editor (T3)

A standalone dev page for editing `config/sectors.json` — the **Sector** is the
run's container (a node-map + its layout pool + theme + length). Part of the
Post-R encounter-system round.

## Launch

```
npm run dev
```

then open <http://localhost:5173/tools/sector-editor/> (or the tools index at
<http://localhost:5173/tools/>). It is **dev-only** — there is no
`rollupOptions.input` entry, so it never ships in `dist/`.

## What it does

- Edit each sector's **id / title / description / length** (node-map hop count) /
  **theme** / **layout pool**. Each pool entry is a `layoutId` (a real layout or
  the `procedural` sentinel) plus an optional `minHop` (hop gate) and `weight`
  (roll bias; blank = 1).
- **Live schema validation** against the real `SectorsSchema` (`src/config/sectors.ts`)
  — Save is disabled while invalid (unknown layoutId, a hop with no eligible
  board, etc.).
- **Live weighted-pool preview**: pick a hop and see the eligible pool with each
  board's roll chance (`weight / total`) — the same weighted pick
  `rollEncounterMap` makes. This is where the procedural-vs-authored mix gets
  tuned by feel.
- **Save to disk** via the dev-only `/__save-config` endpoint (`vite.config.ts`
  allowlists `sectors.json`). An open game tab hot-reloads the new sectors.
  Copy / Download are offline fallbacks.

The whole file is emitted through `format.ts` (`formatSectorsJson`) so a saved
file is byte-for-byte the shape a hand-edit produces — `tests/tools/sector-editor.test.ts`
pins that fidelity. The layout-editor's "add to sector" toggle writes the sector
file through the **same** formatter.

## Not in scope

The **sector-selection DAG** (`config/sector-map.json` — which sectors follow
which) stays hand-edited JSON this round; this editor owns sectors, not the graph.
