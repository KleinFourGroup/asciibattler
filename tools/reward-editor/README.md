# Reward Table Editor (48e)

A standalone dev page for authoring `config/rewards.json` — the **reward-table
registry** (48a) that encounters reference by name via their `rewards` refs.
Visit **http://localhost:5173/tools/reward-editor/** after `npm run dev` (or via
the [tools index](../index.html)). Like every editor here it has no
`rollupOptions.input` entry, so it ships only on the dev server, never in
`dist/`.

## What it edits

Each table's `id` plus its **weighted entry list** — one entry is drawn per
settle, proportional to weight:

- **`bits {min, max}`** — a uniform integer roll (inclusive). The rolled BASE
  settles through `Run.gainBits`, where `bitsGain` daemon folds and
  `bitsMultiplier` apply (display derives from the same math — worklog §48).
- **`daemon`** — grants the named idol (a dropdown over the live catalog, so a
  typo'd id can't be authored). Owned daemons filter out *before* sampling.
- **`packet`** — the §49 seam: schema-complete but **dormant** (zero
  `PacketDef`s exist; the id is free text and deliberately unvalidated until
  §49's registry lands).

## The three affordances

1. **Live schema validation** against the SAME `RewardTablesSchema` the game
   boots on (`src/config/rewards.ts`), plus both referential asserts a bad save
   would otherwise trip at the next boot: `assertRewardDaemonRefs` (daemon
   entries name real idols) and the reverse of `assertEncounterRewardRefs`
   (renaming/deleting a table a committed encounter references). Save is
   disabled while invalid.
2. **A live draw preview** — each entry's roll chance (`weight / total`, the
   same weighted pick the reward engine makes) and the table's average BASE
   bits per settle. A **Referenced by** pane lists the committed encounters
   whose refs name the active table.
3. **Save to disk** — POSTs the whole file (through `formatRewardsJson`,
   byte-for-byte the hand-edit shape) to the dev-only `/__save-config` endpoint
   (`vite.config.ts` allowlists `rewards.json`). Copy / Download are offline
   fallbacks. The write triggers a Vite full reload of the page (the json →
   `rewards.ts` → `editor.ts` chain); a sessionStorage stash restores the
   active tab + confirmation across it (the encounter editor's pattern).

## Refs live on the encounter

Which encounters roll a table — and at what `chance` — is authored on the
**encounter** side: the [encounter editor](../encounter-editor/)'s Rewards
panel (48e added it alongside this editor). A table only owns its contents.

## Tests

`tests/tools/reward-editor.test.ts` pins the formatter: re-emitting the
committed registry reproduces `config/rewards.json` verbatim, and the output
round-trips through the real schema to a deep-equal value (incl. a synthetic
registry exercising all three entry kinds).
