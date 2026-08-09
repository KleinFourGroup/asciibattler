# Camp Editor (§75i)

A standalone dev page for authoring `config/camps.json` — the **neutral camp
catalog** (§75: fixed groups of combatants that spawn onto `team: 'neutral'`,
wander a leash, turn hostile when struck, and pay reward refs when wiped by
the player). Visit **http://localhost:5173/tools/camp-editor/** after
`npm run dev` (or via the [tools index](../index.html)). Like every editor
here it has no `rollupOptions.input` entry, so it ships only on the dev
server, never in `dist/`.

## What it edits

Each camp's:

- **Identity** — `id`, `name`, optional `description`, and `leashRadius` (the
  Chebyshev radius around the spawn tile that PASSIVE members wander within;
  a hostile member pursuing may leave it — the leash bounds idling, not
  retaliation).
- **Units** — the fixed roster: combatant archetypes only (`UNIT_DEFS` is the
  combatant view, so walls/rubble can't be picked), each with an optional
  `count` (≤ 8, the typo guard) and `level`; blank = the schema default 1, and
  a bare entry saves — and re-loads — bare.
- **Rewards** — optional `{table, trigger:{chance}}` refs over the
  reward-table registry, rolled when the camp is killed BY THE PLAYER and
  granted at turn completion win-or-lose (the 51a portion rule). No rows
  omits the key (the camp pays nothing).

## The two affordances

1. **Live validation, every layer the game boots on** (the event-editor
   posture): the SAME `CampsSchema` (`src/config/camps.ts`) plus the
   duplicate-id check plus BOTH 75a boot asserts — `assertCampRewardRefs`
   (reward refs resolve) and `assertLayoutCampRefs` (every committed layout's
   `camps[].campId` still resolves here, so renaming or deleting a camp a
   layout references blocks Save instead of bricking the game's next boot).
2. **Save to disk** — POSTs the whole file (through `formatCampsJson`,
   byte-for-byte the hand-edit shape) to the dev-only `/__save-config`
   endpoint (`vite.config.ts` allowlists `camps.json` since 75a). An open
   game tab hot-reloads the new catalog. Copy / Download are offline
   fallbacks.

## Placement lives on the layout

Which battlefields host a camp — the spawn tiles and the weighted roll list —
is authored on the **layout** side: the
[layout editor](../layout-editor/)'s Camps layer (`campSpawns` + `camps` on
the layout, the sector-owns-both split imported to camps). A camp def owns
only its *intrinsic* content (roster, leash, rewards).

## Tests

`tests/tools/camp-editor.test.ts` pins the formatter: re-emitting the
committed catalog reproduces `config/camps.json` verbatim, the output
round-trips through the real schema deep-equal, and the optional-key paths
(bare unit entries / no description / no rewards / the empty catalog) hold.
