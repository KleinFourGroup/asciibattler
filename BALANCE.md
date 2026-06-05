# Balance-sweep protocol (reusable)

A repeatable method for **measuring and fixing balance** using the *best-achievable
win rate* — the H7b weight-search — as the signal, instead of a single hand-authored
bot. Born in **H7c**; written to be reused for any future balance pass. The
run-specific decisions + log for the current pass are at the bottom.

> Read `HANDOFF.md` first. The tooling referenced here (`--search`) shipped in
> H7a/H7b; the `--balance-sweep` harness + tiers + telemetry are **H7c step 0 —
> build them before stage 1.**

## The signal

- **best-achievable win rate** = the max, over searched strategy-weight vectors, of
  win rate over seeds (`npm run fuzz -- --search`). A near-*upper bound* on play
  quality for our linear policy class.
- **skill gradient** = best-achievable − baseline (`pure-random` / `greedy`). A flat
  gradient (everything wins) is the *foregone-conclusion* failure; a steep one means
  strategy matters. **The gradient is the real health metric, not a single number.**
- **The search is a LOWER bound on the true best play** (linear, static weights,
  monotone-only preference — see H7a shortcomings). A human is expected to exceed
  it by an unknown margin, so aim the ceiling conservatively.

## The funnel (broad-cheap → narrow-expensive)

1. **Broad sweep** — wide config grid × *light* per-point search → flag the
   in-band points + **diagnose leverage** (does this knob even move the needle?).
2. **Medium** — narrowed grid × *medium* search → home to the target band.
3. **Heavy** — few finalists × *heavy* search → read **OP units** from the winning
   vectors + telemetry → propose archetype edits.
4. **Leveling pass** — tune `leveling.json` using XP-flow + levels-by-floor telemetry.
5. **Overnight verify** — full-scale search on **held-out seeds never tuned
   against** (see Overfitting).

## Tiers (size the *per-point* search; total = gridPoints × tier)

Starting points — the harness should **time the first grid point and project the
total before committing**, so a coarse-grid×light-tier broad pass and a
few-finalists×heavy-tier pass both land in budget.

| tier      | vectors | train seeds | floorCount | ~single-search | typical use            |
|-----------|---------|-------------|------------|----------------|------------------------|
| quick     | 50      | 8           | 4          | ~15–20s        | single-config check    |
| medium    | 60      | 16          | 6          | ~1–2 min       | stage 2 (narrowed grid)|
| heavy     | 120     | 30          | full (11)  | ~5–10 min      | stage 3 (finalists)    |
| overnight | 500     | 200         | full (11)  | ~hours         | stage 5 verify         |

## Mechanics

- **Config override**: balance configs are plain mutable objects read *live* per
  encounter (e.g. `DIFFICULTY` in `src/config/difficulty.ts`, consumed by
  `enemyBudgetFor`/`rollEnemyWave`). The sweep mutates them in-process between grid
  points — no JSON-edit-and-respawn. (Process-sharded parallelism gives each shard
  its own config; see Parallelism.)
- **Determinism**: seeded sampler → same `(samplerSeed, grid, tier)` reproduces.
- **Two levels of overfitting**:
  1. *weights → seeds* — guarded by H7b's train/test split (select on train, score
     the winner on held-out test).
  2. *config → seeds* — NEW: tuning the config against win rate can overfit the seed
     set too. Guarded by reserving a **fresh seed range for the final overnight
     verify** that was never used during tuning.

## Telemetry (gathered by the sweep, beyond win rate)

The harness gathers *outcomes* today (win/loss, floor, total deaths, levels-by-floor).
Stages 3–4 need *mechanism* — mostly cheap instrumentation (the sim already computes
these internally; the harness just surfaces them):

- **Per-archetype**: damage dealt, healing done, deaths, recruit picks, final roster
  composition.
- **Per-encounter**: turns taken, per-turn **pool chips** (player & enemy) —
  diagnoses the pool-ratio confound.
- **XP**: per battle per archetype (total per unit; by-source if feasible) —
  diagnoses leveling speed and *which* XP knob dominates.

**Reading it:** the **winning-vector archetype affinities** are the OP signal;
telemetry **corroborates independently** (e.g. melee-OP = high damage + low deaths;
healer-OP = high healing + win-correlation + self-leveling via `xpPerHealing`).
levels-by-floor + XP-flow drive the leveling pass.

## Caveats

- **Conserved enemy budget**: `budgetFactor` ↔ `swarmMaxMultiplier` trade off (spread
  wide = fodder, concentrate = half-level threats) — sweep them *together*.
- **Pool-ratio confound**: the no-attrition health pools (`playerHealthMax` vs
  `enemyHealthMax`, `chipMultiplier`) can dominate win rate over the per-turn
  difficulty. If a difficulty-knob sweep plateaus above the band at extreme values,
  the *pools* are the lever — fold `health.json` into the grid.
- **Re-baseline**: tuning configs shifts the `pure-random`/`greedy` fuzz baselines +
  any config-derived test expectations (by design — "balance-proof"). Commit the
  tuned configs and re-run the suite.

## Parallelism (optional; zero new dependencies)

Independent CPU-bound runs → embarrassingly parallel. Built-ins only:

- **Recommended — `node:child_process` grid-sharding**: parent splits grid points (or
  the vector list) across N ≈ `os.availableParallelism()` children, each runs the CLI
  on its shard + writes a partial, parent merges. Each process owns its own config
  object (clean for a config sweep). Cost: ~13s tsx startup × cores, paid in parallel
  *once* → worth it only for **heavy/overnight**; run quick/medium single-process.
  This is also the **H7d VPS wrapper** (same sharded command, more cores).
- *Not recommended*: `node:worker_threads` — lower per-task overhead but real friction
  loading `.ts` under tsx in a worker; not worth it for this workload.

## Commands

- `npm run fuzz -- --search [--preset=quick|medium|heavy|overnight]` — single-config
  best-achievable (H7a/H7b; built).
- `npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.25:1.5:6 \
    --knob2=difficulty.swarmMaxMultiplier --range2=1.0:3.0:5 --tier=quick [--jobs=N]`
  — the grid sweep (**H7c step 0 — to build**; flag shape is a sketch, finalize when built).

---

## Current pass — H7c (decisions locked)

**Goal**: break the ~100% foregone conclusion (no-attrition pools make encounters
foregone — every reasonable strategy wins).

**Decisions (locked with the user):**
- **Target = a skill gradient**, best-achievable ≈ **2/3 (~67%)**, with `pure-random`/
  `greedy` meaningfully lower. Humans are assumed to outperform the linear ceiling by
  an unknown margin, so ~67% keeps the game winnable-but-losable for skilled play.
- **Config-level seed holdout** for the final overnight verify: **agreed**.
- **Telemetry set**: per-archetype damage/healing/deaths/picks/final-composition;
  per-turn pool chips; per-battle XP (total per unit, source-breakdown if feasible):
  **approved**.
- **Stage-1 grid**: `budgetFactor` 0.25→1.5 × `swarmMaxMultiplier` 1.0→3.0, ~6×5,
  light tier, time-estimate-first: **approved**.
- **Parallelism**: deferred until heavy/overnight; built-in `child_process` sharding
  when needed (doubles as H7d).

**Priors to test (user's hypotheses):**
- **melee OP** — via the GP2 `defense` stat (expect high damage-dealt + low deaths).
- **healer OP** — via too-high healing rate (expect high healing-done +
  win-correlation; also self-levels via `xpPerHealing=3`, an XP-curve interaction).

**Sequence:** **step 0 = build** the `--balance-sweep` harness + `medium`/`heavy`
tiers + telemetry + tests (one commit). Then stage 1 (broad budget×swarm sweep +
pool-leverage diagnosis) → stage 2 (narrow to band) → stage 3 (heavy; OP-unit read +
archetype edits) → stage 4 (leveling) → stage 5 (overnight verify on held-out seeds).

### Run log
_(append per change: what changed → band / gradient / telemetry deltas)_

- _(nothing run yet — tooling not built)_
