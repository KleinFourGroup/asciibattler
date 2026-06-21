# Balance protocol (per-encounter)

The method for **measuring and fixing balance** in the authored-encounter world
(Phase X onward). The pre-X record — the H7c→Phase-O global-knob sweeps that derived
the `1.25 × 1.5` band — is archived at
[archive/balance-h7c-O-log.md](archive/balance-h7c-O-log.md); its *methodology*
(best-achievable + gradient, the funnel, tiers, overfitting guards, the dwm caveat)
is carried forward + adapted below, so you don't need to read it to work.

> Read [HANDOFF.md](HANDOFF.md) first.

## What changed (why this supersedes the old protocol)

The old sweep tuned **2–3 global constants** (`budgetFactor`, `swarmMaxMultiplier`,
`enemyArcherRatio` in `config/difficulty.json`) by mutating the live `DIFFICULTY`
object in-process between grid points. Phase V replaced the random wave generator
with **authored encounters** (a frozen JSON catalog). So three things move:

- **Unit of balance** = the **encounter** (in a layout, at a hop), not the run.
- **Lever** = per-encounter, not a global constant.
- **Mechanism** = the old mutate-`DIFFICULTY` trick no longer reaches authored
  encounters (their constants are frozen JSON) → the lever became a **first-class
  multiplier field** the harness mutates in-memory (see [The lever](#the-lever--per-encounter-difficulty-multipliers)).

**Keep the bones, swap the lever.** The signal, funnel, tiers, train/test split,
tune-against-a-stable-baseline, and the bot-is-a-lower-bound caveat all still apply.

## The signal (gradient first — unchanged)

- **best-achievable** = max over searched strategy-weight vectors of the outcome
  (`npm run fuzz -- --search`). A near-*upper* bound on play quality for our linear
  policy class, and a **lower bound on true best play** (linear, static weights — a
  human exceeds it by an unknown margin; aim ceilings conservatively).
- **skill gradient** = best-achievable − baseline (`pure-random` / `greedy`). **THE
  health metric.** Flat (everyone wins) = the foregone-conclusion failure we tune
  *away* from; steep = skill matters. A "fine" win rate with a flat gradient is
  still broken.
- Per encounter, ask **both**: is it **in-band** AND does it have **gradient**?
  "Too easy / too hard" is shorthand for "off-band **OR** wrong-gradient."
- **"Too hard" per the bot ≠ too hard by design.** The OP read is a mercenary+ranged
  duopoly; an encounter that punishes that comp may read hard to the bot while being
  *good* design (it forces diversity). Before nerfing, separate hard-for-everyone
  from hard-for-the-duopoly.

## The metric — pool damage

The per-encounter difficulty signal is **pool damage taken** (HP chipped off the
player's encounter health pool over the encounter). Continuous + low-variance +
comparable across encounters — unlike a binary win/loss. Keep three things distinct
(they diverge under the no-attrition pool model):

- **pool damage** — the *tuning* signal: how much the encounter costs you.
- **wave-win rate** — per-wave; a lost wave chips the pool, it does **not** end the run.
- **run-death contribution** — does the run END here? The *design* sanity check.

Tune on pool damage; sanity-check against run-death.

## The protocol — the 5-step loop

The method the user converged on (2026-06-21):

1. **Derive optimal strategy.** A *lot* of runs → `--search` for the best-achievable
   **run-level** weight vector (roster / recruit / redraw / empower). One strategy
   per run, held **fixed** for step 2.
2. **Telemetry batch.** Fix the step-1 strategy; gather **per-encounter /
   per-layout / per-hop pool-damage** telemetry. **Force encounters**
   (`--encounter=<id>`) for sample size — a natural run hits a given encounter far
   below uniform, and there are now many encounters diluting it.
3. **ID off-band / wrong-gradient encounters** (pool damage + gradient).
4. **Mutate the per-encounter multipliers** (`waveSize` / `levelBudget`) to pull
   each toward its per-kind target.
   1. Encounter×layout combos that *resist* tuning → **turn off the combo** (the
      encounter `layouts` fit-filter).
   2. Hop gates that resist → adjust the sector pool `minHop`.
5. **Verify** — redo 1+2 on **held-out seeds** (`--seed-offset`, never tuned against).

### Isolation AND in-situ — they answer different questions

- **Forced isolation** (`--encounter=<id>`, controlled player state): *"is this
  encounter well-formed?"* — the tractable, ~1-D-per-knob tuning read for step 4.
- **In-situ** (full run): *"how does it land where it actually appears?"* —
  full-length runs read materially harder than short runs (depth compounding; a
  favorable map compounds across an encounter's turns). The step-5 verify is
  in-situ. **Don't tune *only* in isolation.**

### Strategy staleness

Step-4 multiplier changes shift the optimum, so the step-1 strategy goes stale
*within* a pass. Fine **if** step 5 re-derives — don't iterate step 4 many times
against a frozen strategy.

## The lever — per-encounter difficulty multipliers

First-class **engine primitives** (X1), NOT harness-only — they're the groundwork
for the future difficulty system:

- **`waveSize`** — scales the resolved wave **count** `C` (`resolveTotalCount` in
  [wave.ts](src/run/encounters/wave.ts)). The **action-economy** axis (more bodies).
- **`levelBudget`** — scales the resolved **level budget** `L`
  (`resolveLevelBudget`). The **individual-strength** axis (more total levels).
- Each defaults to **1.0**, sweep range **0.5–2.0**, applied to **all waves** in the
  encounter (a boss applies it across all `stages`).
- Applied at resolve time via `WaveContext`. The **static per-encounter field is the
  Phase-X source**; a dynamic difficulty system (hop-ramp / ascension) is the
  *seamed* future source — same application point.

These are the two independent axes the resolver already separates (the K2 lesson:
count and strength are different levers, and **count hits the early game hardest**).

**`levelBudget` × `levelCap` saturates.** A capped wave can't spend extra budget
(it clamps to `n·cap`), so a `levelBudget` sweep **plateaus** on a capped encounter.
To make the strength axis bite on a spike encounter, **uncap it** (the X groundwork's
per-wave `levelCap`, absent = uncapped). This is exactly why "uncap the spikes"
(Ronin-and-Mages, the boss) pairs with the multiplier work.

### Escape hatches (step 4.1 / 4.2 — both already in the data model)

- **Encounter `layouts?`** fit-filter — prune a brutal encounter×layout combo
  (intersected against the sector's layout pool). **Guard:** a boot check keeps every
  (sector, reachable hop, kind) with ≥1 eligible encounter + non-empty layout
  intersection, so you can't silently prune to empty.
- **Sector pool `minHop`** — gate an encounter off the early/late hops where it's
  mis-sized.

### Global `difficulty.json` still exists

`budgetFactor` / `swarmMaxMultiplier` / `enemyArcherRatio` still feed `rollEnemyWave`
(the fuzz arena + spawn-overflow paths). But for authored encounters the
per-encounter multipliers are the **finer, primary** instrument; fold the global
knobs in only if the pool-ratio confound (below) demands it.

## Per-kind target bands (DATA-FIRST — not yet set)

A single ~2/3 target won't fit all kinds. **Gather pool-damage baselines BEFORE
setting these.** Tentative, speculative placeholders (2026-06-21): **elite ≈ 2×
normal pool damage, boss ≈ 4×.** Also open, decide on the data: a **uniform** ~2/3
best-achievable vs an authored **difficulty curve** (hop-ramped). Context: an elite
has a non-elite sibling = **optional detour** → it may legitimately be *harder*; a
boss is **climactic + multi-phase** (`stages`) → not a single budget.

## The funnel + tiers (carried forward)

Broad-cheap → narrow-expensive, now per-encounter:

1. **Broad** — forced-encounter, coarse multiplier grid (`waveSize × levelBudget`,
   e.g. `0.5:2.0`), light tier → flag the off-band / flat encounters.
2. **Medium** — narrow the grid around each flagged encounter's target.
3. **Heavy** — finalists, **full-length** reads (`--hops=11`), the OP/archetype read + the in-situ check.
4. **Overnight verify** — held-out seeds (`--seed-offset`).

Tiers size the *per-point* search (total = points × tier). **Time-estimate-first**:
time point 1 and project before committing (point 1 is often the cheapest corner →
re-time mid-sweep).

| tier      | vectors | train seeds | hops       | typical use             |
|-----------|---------|-------------|------------|-------------------------|
| quick     | 50      | 8           | 4          | single-config check     |
| medium    | 60      | 16          | 6          | narrowed grid           |
| heavy     | 120     | 30          | full (11)  | finalists               |
| overnight | 500     | 200         | full (11)  | the verify              |

## Mechanics

- **The override mechanism (the X fix):** the sweep mutates the **in-memory
  encounter's `waveSize` / `levelBudget` field** per grid point — NOT the frozen
  JSON, NOT (only) the global `DIFFICULTY`. Making the multipliers first-class
  (rather than harness-local) is what makes this clean *and* doubles as the future
  difficulty system's groundwork.
- **Determinism:** seeded sampler → `(samplerSeed, grid, tier)` reproduces.
- **Two levels of overfitting:** (1) *weights→seeds* — train/test split (select on
  train, score the winner on held-out test); (2) *config→seeds* — reserve a **fresh
  seed range** (`--seed-offset`) for the final verify, never tuned against.
  `--seed-offset` is an X1/X2 build (it was the long-missing prereq from H7d).
- **Re-baseline after any config change** — the balance-proof tests recompute from
  the config modules, so a clean change needs no test edits; commit the tuned config
  + re-run the suite (main + `fuzz:smoke`).

## Caveats

- **Conserved difficulty (`waveSize` ↔ `levelBudget`):** the same total enemy power
  can spread wide (many weak bodies → action-economy pressure) or concentrate (few
  strong → individual threat). **Sweep them together** — they trade off. (The X
  analog of the old `budgetFactor` ↔ `swarmMaxMultiplier` conservation.)
- **Pool-ratio confound:** the no-attrition pools (`playerHealthMax` /
  `enemyHealthMax`, chip multipliers in `config/health.json`) can dominate win rate
  over per-turn difficulty. If a multiplier sweep **plateaus off-band** at the
  extremes, the *pools* are the lever — fold `health.json` in.
- **Bot lower-bound:** the search can't reach every comp (the composition blind-spot
  history). "No sampled strategy beats it" ≠ "unwinnable." Trust the BAND from any
  tier; trust the **OP/archetype** read only at FULL length (`--hops=11`).

## Parallelism + the dwm leak (unchanged, environmental)

- **`--jobs=N`** (vector-level `child_process` sharding) — `jobs=1 ≡ jobs=N` is
  byte-identical (proven); purely wall-clock. Default ON for any multi-point sweep;
  size **~cores/2** for headroom. A lone `--search` / tiny grid stays single-process.
- ⚠️ **`dwm.exe` committed-memory leak** can kill burst child-spawning
  (`0xC0000142`) on a degraded Windows session. **Reboot before any heavy/overnight
  `--jobs` run**; `--jobs=1` is immune (it never spawns a child). Full post-mortem:
  [archive/dwm-leak-diagnosis.md](archive/dwm-leak-diagnosis.md). The overnight
  verify stays VPS-deferred for this reason.

## Commands

> The per-encounter flags below are **X1/X2 — to build.** Shapes are sketches;
> finalize when built.

- `npm run fuzz -- --search [--preset=quick|medium|heavy|overnight] [--jobs=N]` —
  best-achievable + gradient. *(built)*
- `npm run fuzz -- --encounter=<id> …` — force one encounter across every node
  (per-kind-bucket aware, per Wb4); the clean per-encounter sample. *(X2)*
- `npm run fuzz -- --balance-sweep --knob=<id>.waveSize --range=0.5:2.0:N \`
  `--knob2=<id>.levelBudget --range2=0.5:2.0:N --encounter=<id> --tier=… [--jobs=N]`
  — the per-encounter multiplier grid (mutates the in-memory encounter field). *(X2)*
- `npm run fuzz -- --per-encounter | --per-layout | --per-hop` — pool-damage +
  outcome rollups (`--per-encounter` = X2; the other two built).
- `--seed-offset=N` — base the eval seeds past the tuned range (the config-overfit
  holdout). *(X1/X2)*

---

## Run log

*(Append per change: what changed → band / gradient / per-encounter pool-damage
deltas. The pre-X H7c→O log lives at
[archive/balance-h7c-O-log.md](archive/balance-h7c-O-log.md).)*

- **2026-06-21 — protocol overhauled for authored encounters.** Old global-knob log
  archived. Phase X reshaped to build-then-sweep: X1 the `waveSize`/`levelBudget`
  multipliers as first-class engine primitives, X2 the per-encounter harness
  (`--encounter`, per-encounter pool-damage telemetry, the in-memory multiplier
  sweep, `--seed-offset`), X3 the 5-step sweep above. Decisions locked: gradient >
  win rate; metric = pool damage; multiplier range 0.5–2.0 applied per-encounter to
  all waves; per-kind bands data-first (tentative elite 2× / boss 4×); build
  `--seed-offset` for the held-out verify.
- *(Phase X sweep readings — to come.)*
