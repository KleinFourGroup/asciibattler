# BALANCE.md's header: sections moved out

Sections of [BALANCE.md](../BALANCE.md)'s header that no session works
from any more, moved here verbatim to keep the header under its
700-line cap (`tests/docs.test.ts`). Each keeps a pointer where it
stood. A section comes back only if a session works from it again.

## Moved at 150a (2026-11-05), from the header at `a3a94395`

Three sections of the Phase X sweep (2026-06-21): why the authored
encounters replaced the global knobs, the sweep's funnel and its
`--preset` tiers (the presets' live sizes are `PRESETS` in
`tests/fuzz/search.ts`), and the sweep's mechanics. Their two links
are repointed from this folder; the text is otherwise as it stood.

### What changed (why this supersedes the old protocol)

The old sweep tuned **2–3 global constants** (`budgetFactor`, `swarmMaxMultiplier`,
`enemyArcherRatio` in `config/difficulty.json`) by mutating the live `DIFFICULTY`
object in-process between grid points. Phase V replaced the random wave generator
with **authored encounters** (a frozen JSON catalog). So three things move:

- **Unit of balance** = the **encounter** (in a layout, at a hop), not the run.
- **Lever** = a global/per-run multiplier the wave resolver reads, driven in
  ISOLATION per encounter (then baked into that encounter's budget) — so the
  encounter stays the unit of balance even though the lever itself is global.
- **Mechanism** = a **global/per-run difficulty multiplier** (`config/difficulty.json`
  default + a `RunConfig` per-run override — the future difficulty-system seam), NOT a
  field on the frozen encounter JSON. The sweep mutates this in-memory global while
  forcing one encounter (`--encounter`), so a global lever yields a clean
  per-encounter read; the tuned value is then **baked into that encounter's authored
  wave-spec budget** (see [The lever](../BALANCE.md#the-lever--the-per-run-difficulty-multipliers)).

**Keep the bones, swap the lever.** The signal, funnel, tiers, train/test split,
tune-against-a-stable-baseline, and the bot-is-a-lower-bound caveat all still apply.

### The funnel + tiers (carried forward)

Broad-cheap → narrow-expensive, now per-encounter:

1. **Broad** — forced-encounter, coarse multiplier grid (`waveSize × levelBudget`,
   e.g. `0.5:2.0`), light tier → flag the off-band / flat encounters.
2. **Medium** — narrow the grid around each flagged encounter's target.
3. **Heavy** — finalists, **full-length** reads (`--hops=11`), the OP/archetype read + the in-situ check.
4. **Overnight verify** — held-out seeds (`--seed-offset`).

Tiers size the *per-point* search (total = points × tier). **Time-estimate-first**:
time point 1 and project before committing (point 1 is often the cheapest corner →
re-time mid-sweep).

> **68b — the two-act variants:** post-67 "full length" means the two-act walk
> (11+11); the tier table's hop counts are single-sector probe lengths and
> `--hops=11` is the CONTINUITY shape (see BALANCE.md's Protocol v2). `--sector-hops=N`
> gives an N+N two-act read at any tier (run / search / sweep, `--jobs`-safe)
> and SUPPRESSES the tier's own hop count. Which instruments flip to two-act
> defaults is a §68d/e signing decision, not a plumbing default.

| tier      | vectors | train seeds | hops       | typical use             |
|-----------|---------|-------------|------------|-------------------------|
| quick     | 50      | 8           | 4          | single-config check     |
| medium    | 60      | 16          | 6          | narrowed grid           |
| heavy     | 120     | 30          | full (11)  | finalists               |
| overnight | 500     | 200         | full (11)  | the verify              |

### Mechanics

- **The override mechanism (the X fix):** the sweep mutates the **in-memory global
  difficulty multiplier** (`DIFFICULTY.waveSizeMultiplier` / `levelBudgetMultiplier`,
  or the `RunConfig` per-run override) per grid point, while forcing a single
  encounter (`--encounter`) — so a global lever yields a clean per-encounter read.
  This REVIVES the old mutate-`DIFFICULTY` trick (the frozen encounter JSON is never
  touched); making the multipliers first-class engine primitives is what keeps it
  clean *and* doubles as the future difficulty system's groundwork. The tuned value is
  then hand-baked into the encounter's wave-spec budget.
- **Determinism:** seeded sampler → `(samplerSeed, grid, tier)` reproduces.
- **Two levels of overfitting:** (1) *weights→seeds* — train/test split (select on
  train, score the winner on held-out test); (2) *config→seeds* — reserve a **fresh
  seed range** (`--seed-offset`) for the final verify, never tuned against.
  `--seed-offset` is an X1/X2 build (it was the long-missing prereq from H7d).
- **Re-baseline after any config change** — the balance-proof tests recompute from
  the config modules, so a clean change needs no test edits; commit the tuned config
  + re-run the suite (main + `fuzz:smoke`).
