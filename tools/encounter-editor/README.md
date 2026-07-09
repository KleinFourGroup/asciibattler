# Encounter Editor (V2)

A standalone dev page for authoring `config/encounters.json` — the **authored
fight catalog** that replaced the random `rollEnemyWave` (Phase U). Visit
**http://localhost:5173/tools/encounter-editor/** after `npm run dev` (or via the
[tools index](../index.html)). Like every editor here it has no
`rollupOptions.input` entry, so it ships only on the dev server, never in
`dist/`.

## What it edits

Each encounter's:

- **Identity** — `id`, `name`, optional `description`, `healthPool` (the
  per-fight enemy pool), `kind` (`normal` / `elite` / `boss`), and an optional
  **layout fit-filter** (which battlefields the fight makes sense on, intersected
  against the sector's layout pool at selection — leave all unchecked to fit
  every board).
- **Rewards** (48e) — optional `{table, trigger:{chance}}` refs over the
  reward-table registry (`config/rewards.json`; author tables in the
  [reward table editor](../reward-editor/)). Each ref's `chance` is tested
  independently on encounter win; no rows omits the key entirely.
- **Wave list** — the U2 grammar (`wave` / `pick` / `loop` / `stages`, nesting to
  any depth). It's a small recursive DSL, so it's edited as live-validated JSON
  rather than a bespoke tree GUI; the **Insert skeleton** buttons append a
  well-formed node you then tune, and **⤺ tidy** re-indents.

## The three affordances

1. **Live schema validation** against the SAME `EncountersSchema` the game boots
   on (`src/config/encounters.ts`) plus a duplicate-id check, so "is this valid?"
   can't drift from the load-time parse. Save is disabled while invalid.
2. **A live resolution preview** — the headline V2 feature. Given a configurable
   sample roster (levels), hand size, level cap, and pool %, it walks the REAL
   pure resolvers (`waveForTurn` → `resolveWave`) for the first N turns and renders
   the resolved enemy team each turn. This is the "feel" surface: a `loop`,
   `pick`, sequence, or `stages` block is only legible once you see what it fields
   turn-by-turn. It imports the game modules (never reimplements them), so the
   preview and live combat can't disagree.
   - Budget basis: `factor × centralLevel × handSize` (mean/median of the roster
     levels). The **level cap** clamps the per-instance spread. **Pool %** feeds
     `stages` conditions (`enemyPoolAtOrBelow`) — drag it down to watch a boss
     flip phases.
3. **Save to disk** — POSTs the whole file (through the recursive
   `formatEncountersJson`, byte-for-byte the hand-edit shape) to the dev-only
   `/__save-config` endpoint (`vite.config.ts` allowlists `encounters.json`). An
   open game tab hot-reloads the new catalog. Copy / Download are offline
   fallbacks.

## Placement lives on the sector

Which sectors an encounter appears in — its hop gate and roll weight — is authored
on the **sector** side (sector-owns-both): see the
[sector editor](../sector-editor/)'s encounter-pool section (and the "add to
sector" toggle here). An encounter only owns its *intrinsic* eligibility (`kind` +
the layout fit-filter).

## Tests

`tests/tools/encounter-editor.test.ts` pins the formatter: re-emitting the
committed catalog reproduces `config/encounters.json` verbatim, and the output
round-trips through the real schema to a deep-equal value (incl. a synthetic
encounter exercising the full pick / loop / stages grammar).
