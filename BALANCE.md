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
- **I2 dodge lengthens battles (band-mover for N2)**: the flat 25% whiff (base
  `hitChanceBase 0.75`, uniform prc/eva until I5) stretches battles ~33%, so weak-bot
  *hangs* rose `1→5`/`1→7` per 50 seeds — battles hitting the harness's 100s
  decisive-wipe cap, concentrated on the slow corridor/fire layouts. These are
  turn-cap **draws** in-game, not freezes (the harness drives the World without
  `Run.resolveAsDraw`). Account for it in the **N2** re-sweep: longer turns mean more
  cap-draws chipping both pools, which interacts with the pool-ratio confound above.
  The whiff rate (`config/stats.json` hit-chance knobs) + I3's fast-forward both
  blunt the dead-time; re-measure the band against the full post-I–M model, not
  against I2 alone.

## Parallelism (optional; zero new dependencies)

Independent CPU-bound runs → embarrassingly parallel. Built-ins only:

- **Recommended — `node:child_process` grid-sharding**: parent splits grid points (or
  the vector list) across N ≈ `os.availableParallelism()` children, each runs the CLI
  on its shard + writes a partial, parent merges. Each process owns its own config
  object (clean for a config sweep). `--jobs=N` on `--search` / `--balance-sweep`.
  This is also the **H7d VPS wrapper** (same sharded command, more cores).
  - **N2 amendment (2026-06-14) — default `--jobs` on for any multi-point
    `--balance-sweep`.** The original "worth it only for heavy/overnight; run
    quick/medium single-process" rule was written for a *single* `--search` (one grid
    point → the ~13s tsx startup is paid once, not worth sharding a cheap search). A
    **multi-point sweep** is different: the heavy high-swarm points dominate wall-clock
    and shard well, so `--jobs` pays off even at quick/medium tier. Measured: a 30-point
    quick procedural grid projected ~13m+ single-process; jobs=8 on a 32-core box ≈ half
    that. **Caveat: tsx startup (~13s) is paid PER grid point**, so the win shrinks on an
    all-cheap grid and is largest exactly where the band lives (high swarm = heavy
    points). **Size it to leave headroom** — `--jobs ≈ cores/2` (e.g. `--jobs=8` on 32
    cores), NOT all cores, especially with a dev server running. A lone `--search` (one
    point) or a tiny/all-cheap grid stays fine single-process. `jobs=1 ≡ jobs=N`
    byte-identical (proven), so this is purely wall-clock.
  - **N2 caveat (2026-06-14, corrected 2026-06-15) — an environmental `dwm.exe` leak can kill
    burst child-spawning; reboot before heavy `--jobs` runs.** Heavy `--jobs` sweeps intermittently
    die mid-sweep with Windows `0xC0000142` (`STATUS_DLL_INIT_FAILED`) on child spawn. Root cause is
    NOT our code, NOT commit/RAM (a red herring — `--jobs=2` died with ~15 GB free), and **NOT the GPU
    driver** (a 5-month NVIDIA update 591→610 didn't fix it; the leak is cross-machine/cross-vendor —
    the prior AMD box had it too). It's `dwm.exe` leaking **committed memory** continuously (~3–10
    MB/min, scaling with on-screen composition), reaching ~24 GB / ~200K handles over multi-day uptime
    and shrinking the session margin until a spawn burst tips it over (probabilistic → the `d745836`
    retry helps a fresh session, not a degraded one). **Mitigation: a reboot fully reclaims it (a fresh
    session = hours of headroom), so reboot before any heavy/overnight `--jobs` run; `--jobs=1` never
    spawns a child → immune.** Watch `(Get-Process dwm).PrivateMemorySize64/1GB` — multi-GB → reboot
    first. Leading suspect = Windows/dwm itself or the accessibility hooks; full post-mortem +
    measurements: **[archive/dwm-leak-diagnosis.md](archive/dwm-leak-diagnosis.md)**.
- *Not recommended*: `node:worker_threads` — lower per-task overhead but real friction
  loading `.ts` under tsx in a worker; not worth it for this workload.

## Commands

- `npm run fuzz -- --search [--preset=quick|medium|heavy|overnight]` — single-config
  best-achievable (H7a/H7b; built).
- `npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.25:1.5:6 \
    --knob2=difficulty.swarmMaxMultiplier --range2=1.0:3.0:5 --tier=quick [--jobs=N]`
  — the grid sweep (**H7c step 0 — to build**; flag shape is a sketch, finalize when built).
- `npm run fuzz -- --objective=<file>.json|random|none` (J4) — hold one in-battle
  objective strategy FIXED across every run of a `--search` or `--balance-sweep`
  (threaded through the `--jobs` shards too). Default `none` = byte-identical to the
  pre-J4 sweep. Tune the strategy first in `--arena` (writes `best-objective.json`),
  then re-sweep with it active — the lever for N2 if objectives move the band.

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

- **Step 0 ✅ — tooling built (2026-06-05).** `--balance-sweep` harness + `medium`/
  `heavy` tiers + per-archetype / pool-chip / XP telemetry — all in `tests/fuzz/`,
  **zero src change** (baselines + 675-test suite intact; fuzz smoke 58, +18).
  Telemetry is opt-in + observation-only (per-archetype combat is player-side =
  the OP-unit question; pool chips two-sided = the confound). The sweep mutates
  the live `difficulty`/`health`/`leveling` objects per grid point + restores in
  `finally`. Per point: weight-search (best-achievable) + pure-random/greedy
  baselines (gradient) + a winner re-run with telemetry on. **Verified e2e:** the
  locked stage-1 dry-run reproduces the foregone conclusion at its easy corner
  (budgetFactor 0.25 × swarm 1.0 → 100% / 0pt) and a 2-pt smoke already
  discriminates (budgetFactor 0.5 → best 75% / grad 38pt; 1.0 → 13% / grad 13pt),
  the `meanChip` columns flipping player→enemy as it hardens.
  - **Timing caveat:** the time-estimate-first projects off point 1 = the CHEAPEST
    corner (smallest swarm); battle cost scales with swarm size, so the real
    broad-sweep total runs WELL above the point-1 projection. Re-time mid-sweep.
  - **Discovery:** `rollOffer` draws the FULL `ALL_ARCHETYPES` pool (the
    "recruit pool = melee/ranged-only" HANDOFF note is E7-era / stale — the Phase-F/G
    recruitment refactor widened it). So telemetry + the scored search range over
    all 6 archetypes; **melee already leads damage ~2.5×** (the melee-OP prior,
    pre-corroborated). Enemies stay melee/ranged-only (`enemyBudget.ts`).

- **Stage 1 ✅ — broad sweep (2026-06-05).** `budgetFactor 0.25→1.5 (×6) × swarmMax
  1.0→3.0 (×5)`, quick tier, 30 pts, ~17 min single-process. `samplerSeed=1`.
  CSV: `tests/fuzz/output/balance-sweep.csv` (gitignored).
  - **Win surface:** a clean diagonal 100%→0%. **budgetFactor is the dominant lever**
    (≥1.25 ⇒ best 0% everywhere; 0.25 ⇒ 100% everywhere); swarmMax hardens *within* a
    budget band.
  - **LEVERAGE DIAGNOSIS (the stage-1 question): budget×swarm IS the lever — NOT the
    pools.** The surface crosses the ~67% target cleanly and bottoms out at 0% at high
    budget, so it does NOT plateau-above-band → **no `health.json` fold-in needed for
    stage 2.** (The pool-ratio confound is visible — `meanChipPlayer` 7.3→0.2,
    `meanChipEnemy` 0.1→11.7 across the grid — but it's the *effect* of budget/swarm,
    not an independent lever overpowering them.)
  - **Target band (best ≈ 67% + steep gradient):** the ridge **budgetFactor 0.5–0.75 ×
    swarmMax 1.5–2.0**. Standouts: (0.5, 2.0) best 75% / grad 38pt; (0.75, 1.5) best 88%
    / grad 38pt; (0.75, 2.0) best 50% / grad 38pt. Gradient ridge maxes at 38pt = 3/8
    (coarse — quick tier's 8 train seeds quantize win rate to 12.5%; stage-2 medium
    sharpens it).
  - **OP-unit read:** **melee-OP CONFIRMED** as the damage leader (≈2–2.5× ranged at
    every point) AND the archetype the search STACKS (melee_final ~24–31 vs ranged ~16).
    BUT not via invincibility — melee dies plenty (`deathsPerRun` high); it's
    *damage-per-cost + tanky-enough-to-flood* (the GP2 `defense` prior). **healer-OP NOT
    corroborated at stage 1** — the search DROPS healers under pressure (healer_heal→0,
    healer_final→0 at every contested point); healing only shows at the easy corners.
    Likely a short-run truncation of the healer's compounding value → re-check at heavy
    / full-length (stage 3). rogue/mage/catapult are near-noise (search doesn't value
    them at floor-4 runs).
  - **→ Stage 2:** narrow to budgetFactor 0.5–0.75 × swarmMax 1.5–2.0, medium tier.

- **Stage 2 ✅ — narrowed sweep (2026-06-05).** `budgetFactor 0.5/0.625/0.75 × swarmMax
  1.5/1.75/2.0`, medium tier (60 vec × 16 train, floor 6), 9 pts, ~36 min. CSV
  overwrites stage-1's (gitignored; both reproducible at `samplerSeed=1`).
  - **Win surface** (best%): bF 0.5 → 100/100/81 · 0.625 → 94/75/63 · 0.75 → 81/75/56
    (cols swarm 1.5/1.75/2.0). **~67% lands at budgetFactor ≈ 0.625–0.70 × swarmMax ≈
    1.75–2.0.** Finalists bracketing 67%: **(0.625, 2.0)=63% / grad 44pt**; (0.625,
    1.75)=75% / grad 50pt; **(0.75, 2.0)=56% / grad 56pt** (baselines 0% — steepest).
  - **Gradient sharpened** to 44–63pt (medium's 16 seeds → 6.25% steps). Gradient PEAKS
    (62.5pt) at bF 0.5 × swarm 1.75–2.0 where best is still 81–100% — "skill matters
    most" sits just easier than the 67% point; at the 67% point it's still a healthy
    ~44–56pt. **This is a real skill gradient, not a foregone conclusion.**
  - **OP-unit read (floor 6):** melee STILL dominates (dmg ~16–20k vs ranged ~7–9k,
    ~2.3×; final ~48–57 vs ~32). **Healer signal now EMERGING** — at the harder swarm-2.0
    points the search keeps healers (healer_final up to 6–7, heal up to 2521, xp 8208),
    where floor-4 quick runs showed zero. Vindicates the short-run-truncation hypothesis:
    the healer earns its slot under sustained pressure + longer runs. rogue/mage/catapult
    still near-noise. → confirm both at FULL length in stage 3.
  - **→ Stage 3:** heavy tier (120 vec × 30 train, FULL floor-11 runs) on 2 finalists
    bracketing 67% → full-length OP read → archetype edits (melee nerf direction).

- **Stage 3 ✅ — heavy full-length read (2026-06-05).** `{0.625, 0.75} × {1.75, 2.0}`
  2×2 bracket (the 3 finalists + free corner), heavy tier (120 vec × 30 train, **FULL
  floor-11 runs**), 4 pts, **~69 min** compute (15–20 min/pt — well under the 30–45
  feared). `samplerSeed=1`. CSV overwrote stage-2's (reproducible).
  - **Win surface** (best% / baselines): (0.625,1.75) **60% / 0% / 0%**;
    (0.625,2.0) 40 / 0 / 0; (0.75,1.75) 50 / 0 / 0; (0.75,2.0) 27 / 0 / 0.
  - **HEADLINE: at full length the baselines are 0% EVERYWHERE** — pure-random / greedy
    NEVER win an 11-floor run in this band; only search-optimal play does (27–60%). So
    gradient = best% itself. The foregone conclusion is **fully** broken (if anything,
    toward "skill-REQUIRED" — fine for a roguelike). **Short runs overstated
    winnability** (H7b's warning, quantified): (0.625,1.75) read 75% at floor-6 → **60%
    at floor-11**. The 11-floor compounding is real.
  - **Recommended difficulty landing: budgetFactor 0.625 × swarmMax 1.75** = best 60%
    (closest to the ~67% target, baselines 0%, max gradient). Humans beat the linear
    ceiling (a LOWER bound), so true skilled-human best-achievable is north of 60% →
    "winnable-but-losable" holds. *Optional* nudge: budgetFactor ~0.55–0.60 to buy a
    little headroom toward 67% — a stage-5 fine-tune, not a blocker.
  - **OP-UNIT READ (the decision):**
    - **Melee — OP, CONFIRMED hard.** vs ranged at (0.625,1.75): damage **60918 vs 22917
      (2.66×)**, final roster **96 vs 60 (1.6× stacked)**, XP **210529 vs 86451 (2.4×** —
      leveling faster, compounding the lead). Melee dies plenty (deathsPerRun ~21–23) —
      it's *damage-per-cost + tanky-enough-to-flood* (GP2 `defense`), not invincibility.
    - **Healer — OP REJECTED.** Healer is **ZERO at 3 of 4 points** (incl. the
      recommended 0.625×1.75); it appears ONLY at the hardest corner (0.75×2.0, best
      27%) with final 5 / heal 2272. The floor-6 "emergence" was a mid-length artifact —
      at full length the optimal play is pure melee+ranged. So the healer is NOT a
      difficulty-breaker (arguably UNDER-valued; the search ignores it). rogue/mage/
      catapult: zero everywhere.
  - **→ Stage 4 (next session):** (1) set `difficulty.json` budgetFactor 0.625 / swarmMax
    1.75 (from 0.25 / 2.0); (2) **nerf melee** to close the 2.66× damage gap with ranged
    — candidate axes: `strength` (damage) and/or `defense` (the flood-enabler) in
    `archetypes.json`; (3) leveling pass — melee's 2.4× XP lead compounds, so re-read XP
    flow after the melee nerf before touching `leveling.json`. Specific edit values TBD
    WITH THE USER. Then re-sweep to re-confirm the band + re-baseline tests/fuzz.

- **Step 0.5 ✅ — tooling round 2 + the config-read that decides the nerf (2026-06-06).**
  Two telemetry/workflow adds (user-selected; per-floor + per-vector-regression DEFERRED
  as not decision-critical yet), all `tests/fuzz/`, zero src change. fuzz smoke 63 (+5),
  main 675 unchanged, lint+tsc clean.
  - **Adds:** (1) **damage-TAKEN per archetype** (the victim side of `unit:attacked`,
    which is post-`defense` HP lost — env/fire bypasses it — so it's combat HP absorbed
    net of defense); (2) **`--floors=N`** decoupling (override the tier's run length →
    cheap FULL-length reads: a band point ran full floor-11 in **1.4 min** on quick
    tier's budget vs ~18 min on heavy); (3) **`--report[=csv]`** + auto `.report.txt` — a
    human-readable per-point breakdown (humanized numbers, active-archetypes-only,
    tolerant of older CSVs missing a column → `—`).
  - **THE NERF-DECIDING CONFIG READ:** melee & ranged have **IDENTICAL offense** —
    damage = raw stat − defense (`hpPerConstitution` is **1.0**, not the stale 2.5);
    melee `strength` 6/0.6 == ranged `ranged` 6/0.6, same crit (luck 3). So melee's
    2.66× aggregate damage is **NOT raw power** — it's uptime×numbers: HP ratio (con
    30→30hp vs 18→18hp = **1.67×**) × stacked count (**1.6×**) ≈ 2.66×. **⇒ the nerf axis
    is SURVIVABILITY, not strength** (cutting strength would push melee BELOW ranged on
    offense while leaving the tank-flood loop intact).
  - **Damage-taken CONFIRMS constitution-first:** at the band (full length) melee absorbs
    **3.0×** ranged's combat damage ≈ its HP-pool×count (2.9×) — i.e. *in proportion to
    HP, not disproportionately more*. Since damage-absorbed-until-death ≈ maxHp regardless
    of defense, melee tankiness is fundamentally **constitution**; defense only changes
    hits-to-kill. **⇒ nerf `melee.constitution` (30, an outlier vs ranged 18 / healer 20 /
    mage 16) PRIMARY; trim `defense` (4) secondary if swarm-tankiness persists.** Values
    TBD WITH USER; re-sweep after.
  - **Methodology rule (from the short-runs-mislead lesson):** trust the difficulty BAND
    from any tier (win rate shifts ~uniformly with length), but trust the OP/archetype
    read ONLY at full length (archetype value is non-uniformly length-sensitive — the
    healer mid-length artifact). `--floors` makes the cheap full-length OP check routine.

- **Stage 4 (in progress) + the STRATEGY BLIND-SPOT discovery (2026-06-06).**
  - **Difficulty band SET (commit `8eefd76`):** `difficulty.json` budgetFactor 0.625 ×
    swarmMax 1.75.
  - **Archetype rebalance, WIP (commits `8eefd76` con-narrow, `1f7c208` defense+offense-
    growth):** narrowed the constitution spread (was [14,30] → [16,22]); melee con 30→22
    (the nerf); raised con growths (levels matter more); ADD defense to the glass cannons
    (ranged 2→3, rogue 0→2, healer 0→1, catapult 0→**5**, + def growths); TRIM offense
    growths ~half + some bases (rogue str 7→5, healer magic **8→4**, catapult ranged
    14→10); halved every power growth 0.2→0.1; healer power base **1→0**. NB **rogue
    deliberately untouched** until the rest is stable (user's call).
  - **More tooling (commits `782ac15`, `0825d05`):** **per-deployment telemetry**
    (`deployments` = player fieldings; the report now shows **dmg/dep, taken/dep,
    heal/dep** — the honest per-unit denominator, since aggregates conflate per-unit
    power with how many got fielded); **`--roster=archetype[:level],…`** forced starting
    roster on BOTH `--balance-sweep` and `--search`; the report's active filter keys off
    "was deployed" so a force-fielded underperformer still shows.
  - **CASTER VIABILITY (forced-roster eval, lvl-5 = the real start, vs 75% carry control):
    swap one carry → catapult **100%** (+25), healer **100%** (+25), mage **50%** (−25),
    rogue **50%** (−25).** Per-deployment overturned the naive read: **casters are NOT weak
    per unit** — catapult 46 dmg/dep + 7 taken/dep (tankiest), mage 39 dmg/dep — they
    OUT-damage carries. The dividing line is **survivability**: catapult (def 5) converts
    its damage to wins; **mage (def 0 base) dies ~3× as often → needs BASE DEFENSE, not
    damage**; **rogue is the one genuinely weak unit** (low dmg + fragile). Healer is
    **vindicated** — best chip ratio in the whole experiment (13:1); keeping carries alive
    IS its pool contribution.
  - **⇒ THE STRATEGY BLIND-SPOT (confirmed, the session's key finding):** the free search
    NEVER recruits casters because the recruit policy ([scored.ts](tests/fuzz/strategies/scored.ts:216))
    has a **rich-get-richer** term `diversity × rosterCount[archetype]` + a **fixed**
    3-melee-2-ranged start. With `diversity>0` (needed for the concentration that makes any
    archetype strong) the incumbent carries get a `×3` head start and a count-0 caster gets
    `×0` → it can never get a foothold; with `diversity<0` it diversifies but can't
    concentrate. **No reachable weight vector builds a caster comp from a carry start.**
    PROVEN: a catapult-SEEDED search hits 100% (recruiting 7 more catapults), but replaying
    that EXACT winning vector on the default roster recruits **~0 catapults and scores
    60%** (`--search --roster` + `--strategy` replay). So "the search only picks
    melee/ranged" is a BOT ARTIFACT, not a balance signal; and the free search's
    best-achievable is a CONSERVATIVE lower bound (skilled humans reach caster comps it
    can't — that's a big chunk of the assumed human-above-ceiling margin).
  - **USER DECISION — do NOT lean on forced-roster as the balance instrument** (it answers
    "force this comp," not "is swapping an archer for a healer worth it" — the proper
    balance knob the user wants). Instead **fix the strategy schema** to express
    **composition targets** (per-archetype, so the search can seed + stack a caster
    naturally and MEASURE its value). Forced-roster stays a diagnostic only.

  ### LOCKED PLAN (next session)
  1. **Add composition-target support to the strategies** — replace the scalar `diversity`
     rich-get-richer term with per-archetype composition targets (let the search choose +
     stack a starting/recruited composition), so "swap an archer for a healer → +X%
     win" becomes a measurable search outcome, not a forced-roster bandaid.
  2. **Re-confirm the broad difficulty sweep** with the fixed strategy schema (the band
     may shift now that the search can reach caster comps — best-achievable will rise).
  3. **Then tune rogue** (LAST — only after the measurement system + difficulty + other
     archetypes are settled, so the rogue buff is measured against a stable baseline).
  - Also pending from before: leveling pass (may self-resolve post-nerf — identical
    growth), stage-5 overnight verify on held-out seeds, re-baseline tests/fuzz, H7d
    launcher/VPS.

- **Step 1 ✅ — composition-target recruit policy (2026-06-06).** The locked-plan
  measurement fix, all in `tests/fuzz/` + the dev-only `config/fuzz-strategies.json`
  (zero src change; fuzz smoke 66, typecheck + lint clean). Replaced the rich-get-richer
  `diversity × rosterCount[A]` recruit term with per-archetype **composition targets**:
  the new recruit pick score is `archetype[A] + compWeight × (composition[A] −
  rosterFraction[A]) + continuousScore`. The `− rosterFraction[A]` makes it **saturate**
  — a count-0 archetype gets a positive foothold and preference decays as it fills — so
  the search can seed AND stack a caster comp from the fixed carry start, which the old
  `×count` term could never do (the BOT ARTIFACT).
  - **User design calls (this session):** (1) **target FRACTIONS, not counts** — keeps the
    search box uniform `[-1,1]` (the `target − fraction` delta is bounded, same scale as
    the stat terms) and is roster-size-invariant. (2) **KEEP the flat `archetype` affinity
    AND add `composition`** (expressiveness over parsimony); I added a `compWeight` scalar
    too (the natural replacement for the removed `diversity` scalar — decouples *what* comp
    from *how much* comp matters). (3) **RECRUITS ONLY — do NOT seed the starting roster
    from composition.** The starting roster is a **first-class designer balance knob** (set
    via the existing `--roster` / `startingRoster` config), NOT something the search may
    override. So two clean instruments: starting comp = designer knob; recruit comp =
    search freedom. No `pickStartingRoster` added.
  - **Pass gate UNCHANGED (continuous-only):** casters are reached via `composition` (wins
    the which-card argmax) + `passBias` (global recruit-eagerness). Feeding composition into
    the pass would re-gate casters by stat-quality and break the pass test's documented
    semantics, so it stays factored: composition = *which* card, passBias = *whether* to
    take any. Every existing test still passes.
  - **Schema break (expected):** `diversity` field gone, `composition` (per-archetype) +
    `compWeight` added → any pre-existing `best-strategy.json` is stale (gitignored output,
    regenerated). Sample order is now path→archetype→composition→compWeight→level→stats→
    total→passBias, so old `samplerSeed` sequences are invalidated (re-baseline expected).
  - **→ Step 2 (running):** re-confirm the broad difficulty sweep on the fixed schema —
    budgetFactor 0.25→1.5 (×6) × swarmMax 1.0→3.0 (×5), quick tier, samplerSeed=1 (the
    stage-1 grid). Best-achievable should RISE now that the search can reach caster comps,
    so the difficulty BAND (currently set 0.625 × 1.75) may shift.

- **Step 2 interim — broad re-sweep + full-length spot-check (2026-06-06).** Both on the
  fixed schema, samplerSeed=1, quick-tier vectors. THE REFACTOR WORKS — casters are now
  reachable + survive.
  - **Broad re-sweep** (stage-1 grid, quick, floor-4): surface rose ~12–25pt at the
    contested band vs stage-1 — **(0.5,2.0) 75→100, (0.75,2.0) 50→62.5** — *despite* the
    search now sampling +6 dims with the same 50 vectors (sparser), strong evidence the new
    policy space holds better play (the predicted "best-achievable rises"). Casters now
    RECRUITED + FIELDED where stage-1 had them as noise (e.g. (0.5,1.5): mage 16, catapult
    24 deployments; per-dep they out-damage carries). Healer/rogue still rarely chosen.
  - **Full-length spot-check** (`--floors=11`, `{0.625,0.75}×{1.75,2.0}`, quick vectors):
    **the headline — CASTERS SURVIVE THE LENGTH TEST.** At **budget 0.625** the optimal
    floor-11 comp fields **healer 7 + mage 5** (healer 44 fieldings @ 66 heal/dep); at
    budget 0.75 it reverts to pure carry. **This OVERTURNS stage 3's "HEALER — OP
    REJECTED."** That verdict was measured WITH the blind-spot in place (search couldn't
    build support comps); the healer wasn't valueless, it was **unreachable**. ⇒ **the
    stage-4 archetype nerfs were tuned under a now-false premise** ("healer under-valued") —
    revisit them once the heavy read confirms healer's value, BEFORE locking difficulty.
  - **Caveat (methodology rule):** quick-tier seeds (8 train / 4 test) are too noisy to PIN
    the band — the train/test gap (0.625×1.75 = 88 train / 50 test) is small-sample overfit;
    baselines are 0% everywhere (skill-required holds). The band number needs the HEAVY tier
    (30 train) like stage 3. The robust signal here is structural (caster reachability +
    survival), not the win-rate level.

- **Parallelism shipped — `--jobs=N` vector-level sharding (2026-06-06).** Built so the
  decision-grade HEAVY re-read doesn't cost ~70 min single-process (BALANCE.md "Parallelism"
  — chose vector-level over grid-point so a few-point heavy run uses many cores; child_
  process, NOT worker_threads, because each grid point MUTATES the live config and children
  need their own). All in `tests/fuzz/`, **zero src change**; fuzz smoke 74 (+8 pure tests:
  chunkVectors / generateVectors / assembleSearchResult), typecheck + lint clean.
  - **Design:** the PARENT generates the deterministic vector list (`generateVectors`,
    extracted from `runSearch` — which is otherwise UNTOUCHED, protecting its tests), splits
    it into `min(jobs, vectors)` contiguous chunks, and spawns one `--eval-shard` child per
    chunk (`node --import tsx cli.ts …` — cross-platform, no npx/.cmd). Each child re-applies
    the grid point's knobs to ITS live config + evaluates its slice; the parent merges win
    rates in index order and does the cheap test-eval/baselines/telemetry in-process (its
    config is already applied). `runBalanceSweep`/`defaultMeasurePoint` went async; `jobs=1`
    (default) keeps the exact single-process path.
  - **Determinism PROVEN:** a quick sweep at `--jobs=1` vs `--jobs=4` produced a
    **byte-identical** `balance-sweep.csv` — `--jobs` changes only wall-clock. ~2.4× at
    jobs=4 on a tiny 50-vector workload (overhead-bound; the 120-vector heavy tier scales
    better). Default `jobs=1`; `--jobs` is opt-in so a personal machine isn't saturated.
  - **→ Next:** run the HEAVY bracket `{0.625,0.75}×{1.75,2.0}` full-length, `--jobs=8`, for
    the decision-grade band + robust caster-comp / healer-value confirmation.

- **Step 2 DONE — heavy band read + difficulty SET to 0.625 × 1.90 (2026-06-06).** Heavy
  tier (120 vec × 30 train / 10 test, full floor-11), `--jobs=8` → **~18 min vs ~69 min
  single-process (~3.8×)**. The decision-grade re-confirm of the band.
  - **Band (heavy, best train/test %):** (0.625,1.75) **73/80** · (0.625,2.0) 53/80 ·
    (0.75,1.75) 43/20 · (0.75,2.0) 37/50. Baselines **0% everywhere** (skill-required holds).
    vs stage-3 heavy (60/40/50/27): **best-achievable ROSE ~+13pt at budget 0.625** — same
    encounters, the composition-reachable search just plays them better (a tighter lower
    bound now, so less human-above-ceiling headroom).
  - **HEALER OVERTURN — RETRACTED.** The step-2-interim quick-tier full-length spot-check
    showed a healer+mage winning comp at (0.625,1.75); the HEAVY read shows the robust
    optimum there (and at 3 of 4 points) is **pure melee+ranged** — casters inactive (only a
    sliver healer(2)/mage(2) at 0.75×1.75). The quick "healer 7+mage 5" was an **8-seed
    overfit** (its 88-train/50-test gap was the tell; heavy's gaps are tight, e.g. 73/80, and
    land on pure carry). So stage-3's "pure carry optimal at the band" **HOLDS** — BUT now as
    a *cleaner* conclusion: the refactor distinguishes **"unreachable" (fixed — the search
    demonstrably builds caster comps) from "reachable but not the robust optimum" (the real
    situation)**. ⇒ the "revisit stage-4 nerfs because healer under-valued" flag is **MOOT**.
    Caveat: the search is a LOWER bound (120 random vectors, +6 dims) — "no sampled caster
    comp beat carries robustly," not proof they can't; forced-roster already showed casters
    are *viable* when fielded, just not the bot's default-strong line.
  - **Melee still out-stacks ranged post-stage-4-nerf:** final 102 vs 61 (1.67×), dmg/dep 39
    vs 29. The con 30→22 nerf narrowed but didn't close the carry gap (a separate archetype
    axis from the difficulty band; user opted not to chase it now).
  - **Difficulty landing — the SWARM CLIFF:** chasing ~67% revealed `swarmMaxMultiplier` is a
    COARSE knob (it feeds `Math.round(swarmMax × teamSize)`): 1.75 & 1.85 round to the SAME
    counts (both 73%), then 1.90 tips a boundary → +1 enemy → **57%** (1.95/2.0 also ~53%).
    So 67% has no clean swarm point — it's 73% (≤1.85) or 57% (≥1.90). budgetFactor is the
    finer knob (≈0.65 would interpolate ~67%), but **USER CHOSE swarm 1.90 = 57%** (stable
    lower-plateau, slightly harder than 2/3; with the now-tight bot + human margin it lands
    near a true 2/3 from the challenging side — genre-appropriate). **`difficulty.json`
    swarmMaxMultiplier 1.75 → 1.90 (budgetFactor stays 0.625).**
  - **Re-baseline CLEAN:** main suite **675 pass**, fuzz smoke **74**, typecheck + lint clean
    — the balance-proof tests recompute from `DIFFICULTY` (no hardcoded swarm value), so the
    change needed zero test edits.
  - **→ Next (per locked plan):** tune ROGUE (step 3, LAST) — the one genuinely weak unit
    (low dmg + fragile, never recruited), now against a settled difficulty + measurement
    baseline. Also still pending: stage-5 overnight verify on held-out seeds (now cheap with
    `--jobs`); the melee↔ranged carry gap if it bothers playtest.

- **Step 2 REVERSED — swarm 1.90 → 1.75 after a PLAYTEST + per-floor telemetry caught a
  floor-1 wall (2026-06-06).** Playtesting the committed 1.90 surfaced "most deaths on floor 1,
  before you can make a difference." Built **per-floor run-death telemetry** to verify (commit
  `28215b4`): extended `--per-floor` (`reporters.ts#FloorStats`) with RUN-level `runsReached` /
  `runsDied` / `deathRate` (from `RunResult.outcome`/`finalFloorReached`) distinct from the
  per-WAVE `avgPlayerDeaths` — the two diverge under the H4/H5 pool+deck system (a lost wave
  chips the pool, doesn't end the run). *(First cut wrongly used per-battle `winner`; the data
  showed >1 "loss" per run — floors are multi-wave — so corrected to run-level.)*
  - **What the telemetry found (greedy & pure-random, 50 seeds each):** run-deaths are NOT
    floor-1-concentrated — they **ramp with depth** (floor-1 ~12% → floor-5 ~57%); the curve is
    back-loaded. BUT floor 1 IS a unit bloodbath: outnumbered **8.6 vs 5.0 (1.7×)** at the
    weakest fresh roster, ~3.3 of 5 lost per wave. The run survives (~88%) via pool attrition,
    but it *feels* like dying — exactly the playtest report.
  - **A/B — my 1.90 bump WAS the cause (swarm 1.75 vs 1.90, same seeds):** floor-1 run-deaths
    **0% → 12%**, deaths/wave 2.7 → 3.3, enemy 7.7 → 8.6, runs reaching floor 2 50/50 → 44/50.
    At 1.75 floor 1 is CLEAN; the 1.90 boundary-tip introduced the floor-1 deaths.
  - **MECHANIC (why swarm is the wrong band knob):** on **floor 1 the enemy count is
    SWARM-cap-bound** (`round(swarmMax×teamSize)`), so swarm hits the early game hardest — where
    the player is weakest, the marginal enemy is most lethal. On **deep floors the count is
    BUDGET-bound** (`budgetFactor×playerTeamLevel`, which grows as you level/recruit). ⇒ **swarm↑
    hammers EARLY floors; budgetFactor↑ hammers LATE floors.** budgetFactor is the right knob to
    harden the band without an early wall (a finding for any future difficulty tuning).
  - **DECISION (user):** **revert to swarm 1.75 (clean floor 1), accept best-achievable 73%**
    (slightly easier than 2/3, but a fair early game beats a hidden floor-1 wall; budgetFactor-
    harden was the alternative, declined for simplicity). **`difficulty.json` swarmMaxMultiplier
    1.90 → 1.75 (budgetFactor 0.625).** Net: difficulty is back to the stage-4 band; the 1.90
    detour is fully undone, the per-floor telemetry is the keeper. Re-baseline CLEAN (675 + 75).
  - **Methodology keeper:** playtest feel caught what the aggregate win-rate hid; per-floor
    run-death vs per-wave attrition are different questions; harden the band on the knob that's
    binding where you WANT the difficulty (budget=late, swarm=early).

- **Step 3 — ROGUE pass: targeting-strategy infra shipped; `weakest` DISPROVED for the rogue
  (2026-06-07).** The locked-plan rogue step. Instead of buffing HP/damage (not "rogue-coded"),
  the idea was **target priority**: re-point the rogue at the squishy backline. Built it as a
  GENERAL, extensible per-archetype **targeting strategy** ([config/archetypes.json](config/archetypes.json) `targeting`
  field + [src/sim/targetingStrategies.ts](src/sim/targetingStrategies.ts) registry: `nearest` = the historical pick,
  `weakest` = lowest `derived.maxHp`). Resolved at spawn onto `Unit.targeting` (like
  glyph/abilities) so the leaf `Targeting.ts` needn't import the config layer (no cycle). 689
  main tests + 75 fuzz smoke green; no snapshot bump (re-derived from archetype on rehydrate).
  - **Forced-roster eval (the measurement, quick tier, `--floors=11`, samplerSeed=1, set config
    0.625×1.75):** swap one starting melee → a level-1 rogue, rogue on `weakest` vs `nearest`:
    - **`weakest`: rogue dmg/dep 3.1**, taken/dep 15.6, deaths/run 8.0.
    - **`nearest`: rogue dmg/dep 6.1**, taken/dep 15.3, deaths/run 7.1.
    - Both lineups floor at **0% best-achievable** (a fragile L1 rogue replacing a melee tank
      tanks the run regardless; quick-tier's 8 seeds saturate the win metric) — so dmg/dep is
      the honest signal. The free composition search (control, rogue=`weakest`, default roster)
      leaves the rogue **inactive** = it won't recruit it.
  - **VERDICT: `weakest` HALVES the rogue's damage (6.1 → 3.1) — it BACKFIRES.** Mechanism: the
    rogue is **range 1** with no gap-closer, so committing to the farthest squishy mark makes it
    walk *past* adjacent enemies (the strike only fires on the committed target) and die en
    route. This is the "can it REACH the backline?" caveat, quantified: without mobility, no.
  - **DECISION (user):** **keep the infrastructure** (a general feature wanted regardless),
    **set the rogue back to `nearest`** (no harmful change; `weakest` stays registered + tested
    but **unassigned**, ready for a unit that can reach the backline). The real rogue fix is
    **mobility** — a dash/leap/blink so `weakest` becomes viable; logged as a roadmap
    exploration in [TODO.md](TODO.md) "Movement abilities (dash / gap-closer)". Net config change: targeting
    infra added, all archetypes = `nearest` (rogue behavior UNCHANGED), so fuzz baselines hold.
    Rogue's broader identity (evasion / stealing) stays deferred to Phase I+ / shop, as before.

- **Layout-difficulty telemetry + the Junction Ambush read (2026-06-07).** Playtest flagged some
  layouts (esp. Junction Ambush) as disproportionately brutal. Added per-layout instrumentation
  (all `tests/fuzz/`, zero src; fuzz smoke 77): `npm run fuzz -- --per-layout` (per-layout +
  layout×floor **wave win rate / deaths/wave / team sizes** tables + `per-layout.csv` /
  `per-layout-floor.csv`) and `--layout=<id>` (force ONE layout across every battle for a clean
  full sample — natural runs only hit a given layout ~12%). Metric is WAVE-level (a lost wave
  chips the pool, doesn't end the run — distinct from per-floor run-death).
  - **Survey (200 seeds × pure-random+greedy, set config):** player wave-win by layout —
    river **41%** · junctionAmbush **45%** · procedural 45% · spiralFireLife 69% · labyrinth 83% ·
    endlessCorridors 84% · strafingFunnel 85%. Enemy team size is ~9.5 EVERYWHERE (swarm-cap-bound,
    NOT layout-driven), so the spread is **pure geometry**: chokepoint layouts let 5 funnel a
    9-swarm (~85% win, ~2 deaths/wave); open/multi-approach layouts let the swarm surround you
    (~45% win, ~3.8 deaths/wave).
  - **Per-floor:** junctionAmbush tracks procedural almost exactly per floor (F1 70% → F5 26%,
    ramping as the swarm grows 7.7→15+), and BOTH diverge from the chokepoint layouts immediately
    (F2: junctionAmbush 43% vs strafingFunnel 85%). So Junction Ambush is NOT a unique outlier vs a
    generic open battle — the real story is "open/ambush ≈ 2× harder than chokepoint," and a human's
    positioning skill rescues them in chokepoints but not when surrounded, widening the felt gap.
  - **DECISION (user): leave layouts as-is for now** — the **post-Phase-H rework will introduce
    map / difficulty gating** (don't roll the hard open layouts on the weakest early floors), which
    is the right lever; logged in [TODO.md](TODO.md). This pass was diagnosis-only.

- **H7d ✅ — sweep GUI + `--jobs` extended to `--search` (2026-06-07).** The H7 tooling closer.
  All `tests/fuzz/` + `tools/` + docs, **zero src change**; fuzz smoke 89 (+12 sweepCommand), main
  689 unchanged, lint + tsc clean. **The overnight verify itself is DEFERRED** (run it later — see
  below). Two commits + an eslint chore (`scratch/**` added to eslint ignores — gitignored per
  `10545e1` but still linted, regressing the 0-error baseline).
  - **Sweep GUI** ([tools/sweep-gui/](tools/sweep-gui/), served by the dev server like the run
    launcher) — a point-and-click **command-builder** for the fuzz CLI: pick a balance-sweep grid
    (knob + `min:max:steps`, optional 2nd knob, tier, jobs, dry-run) or a search (preset + overrides)
    and it emits the `npm run fuzz -- …` line to paste (the search runs in Node, so it hands you the
    command rather than running it — the GUI sibling of the run launcher's URL). Single source of
    truth: [sweepCommand.ts](tests/fuzz/sweepCommand.ts)'s `SWEEP_KNOBS` is enumerated LIVE from
    `DIFFICULTY`/`HEALTH`/`LEVELING` (the same three `KNOB_GROUPS` the sweep tunes) so the menu can't
    drift / offer a rejected knob, and `buildFuzzArgs` mirrors the CLI flag rules. Browser-verified
    end-to-end (a GUI-shaped 2-knob dry-run parsed + ran through the real CLI).
  - **`--jobs` now parallelizes `--search` too** (was balance-sweep-only — a gap, since vector-level
    sharding was chosen precisely so ALL searches parallelize). `runSearchCli` forks the same
    `evaluateVectorsSharded` path with empty `knobs` (each child loads the same committed JSON the
    parent has). **Proven byte-identical**: `--search --jobs=1` vs `--jobs=4` → identical
    `best-strategy.json` + `search-results.csv`. So the overnight verify is now a plain
    `--search --preset=overnight --jobs=<cores>` — **no separate VPS wrapper needed** (the sharded
    command IS the wrapper; the H7d "VPS niceties" collapse to that + docs, per the user's docs-only call).
  - **Found + logged (NOT fixed):** the config-overfit holdout the stage-5 verify wants (a seed range
    *never tuned against*) is **not yet expressible** — `splitSeeds` always bases seeds at
    `1…`/`1_000_000…` and `--sampler-seed` only reseeds the weight sampler, not the eval seeds. A
    `--seed-offset` is the missing prereq; logged in [TODO.md](TODO.md). Until then the overnight run
    is a strong best-achievable read but on the same seed bases the config was tuned against.

  ### Phase H DONE — the H7 balance deferrals resequenced behind the rogue rework (user call, 2026-06-07)
  Phase H is **effectively complete** (H1–H7 ✅). The two open balance items are NOT dropped — they're
  sequenced AFTER the next focus, the **rogue salvage** (a mobility / gap-closer ability; TODO.md
  "Movement abilities"), because that's a structural combat change that will move the difficulty band +
  XP flow, and both items must be measured against a **stable post-rogue baseline** (the same "tune
  against a stable baseline" rule that put rogue LAST in H7c — verifying/leveling against a config we're
  about to disturb is wasted). **Post-rogue order:**
  1. **Re-confirm the difficulty band** — re-sweep (the band may shift now the rogue is viable, the way
     the composition-target refactor shifted it). The sweep GUI / `--jobs` search are ready.
  2. **Leveling pass** — against the now-stable combat baseline + fresh XP-flow telemetry (may still
     self-resolve — identical growth across archetypes).
  3. **Stage-5 overnight verify** — `--search --preset=overnight --jobs=<cores>` on the settled config;
     ideally after a **`--seed-offset`** add (logged above + in TODO) for a rigorous config→seed-overfit
     holdout. Without it it's still a strong best-achievable read, but on the tuned seed bases.
  - *Also optional, anytime:* the melee↔ranged carry gap (final 102 vs 61) if a playtest bothers.
  Re-baseline tests/fuzz after any config change.

- **I5 ROGUE re-measure — the dodge-tank decision (2026-06-09).** The Phase-I rogue decision (ROADMAP
  §I5 / §N1): does the dodge system ALONE make the rogue viable, or does Phase N mobility stay? Re-measured
  the user's editor-tuned dodge-tank block AS-IS (committed `9441f5c`: LCK 12 / EVA 7, growth PRC .45 /
  EVA .5 / LCK .7; targeting `nearest`) against the live band (budgetFactor 0.625 × swarmMax 1.75), quick
  tier, `--floors=11`, `samplerSeed=1`. Output gitignored (reproducible).
  - **Free composition search (default roster):** best-achievable **88%** (test 100% / baselines 0% —
    skill still required), optimal comp = mercenary + ranged + **catapult**; **rogue INACTIVE** (never
    recruited) — same as the pre-dodge verdict. (adventurer/ronin/bandit also inactive — the new melee
    subclasses aren't the bot's optimal line either; the usual lower-bound caveat, NOT a balance verdict
    on them.)
  - **Forced-roster A/B (lvl-5, swap one carry → rogue):** 5-carry control **87.5%** (test 100%) → rogue
    lineup **50%** (test 75%) — a **−25 to −37pt** hit for fielding the rogue.
  - **Per-deployment telemetry (the honest per-unit read):** rogue **dmg/dep 15.4** vs carries' ~37
    (mercenary 38.0 / ranged 36.6) — **<½ the carry damage**; rogue **taken/dep 17.0 ≈ mercenary's 19.4**
    DESPITE far less CON/DEF (16/2 vs 22/4). ⇒ **the dodge tuning WORKED for survivability** (EVA ~9 at
    lvl-5 → ~52% incoming hit vs the carries' 60%, making the fragile rogue carry-durable per deployment)
    — **but the rogue is now DAMAGE-STARVED** (a range-1 `gambit_strike` on STR 5 just can't output). The
    binding constraint flipped from fragility → reach/damage.
  - **VERDICT (the rogue decision): dodge alone does NOT make the rogue viable → Phase N mobility STAYS
    (the N1 contingency resolves to "build it").** But the finding REFINES the fix: dodge solved
    survivability, so N1's gap-closer isn't for *staying alive* — it's for **reach** (close on the squishy
    backline so the rogue's strike lands where crit/damage matters, flipping it to `weakest` targeting,
    which BALANCE step 3 disproved for a *range-1* rogue precisely because it couldn't reach). Mobility +
    `weakest` is the coherent rogue identity; logged for N1. **No config change this pass** (re-measured
    as-is, per the user); re-confirm post-mobility in N2's sweep.
  - **Methodology caveat:** forced-roster is a diagnostic (answers "force this comp," not "is the rogue
    worth a slot"); the free search is a lower bound. Both point the same way here AND the per-deployment
    signal (½ carry damage) is structural, so the verdict is robust to quick-tier's 8-seed quantization.

- **J4 objective tooling — the arena + `--objective` sweep lever (2026-06-10).** Phase-J's fuzz step added
  an **arena harness** (one forced `World`, no `Run`) that tunes an in-battle objective strategy in
  isolation and an **`--objective=<json|random|none>`** flag that holds it fixed across the full run fuzz /
  `--search` / `--balance-sweep` (threaded through the `--jobs` shards; default `none` = byte-identical, so
  no baseline shifted). Dev tooling only, no config change. **Early arena signal** (default lvl-5 carry comp,
  8 seeds, procedural): `none` 50% → `hp:lowest` (focus-fire the weakest) 75% — objectives are a real skill
  lever, not noise. **For N2:** when re-sweeping the band against the full post-I–M model, optionally hold a
  tuned objective fixed (a human will steer objectives, so the bot-with-objective is a tighter lower bound on
  play). Tune in `--arena` → `--objective=output/best-objective.json` on the sweep.

- **K2 roster/hand decouple — a latent wave-size BUG + band re-sweep (2026-06-10).** K2 raised the
  starting roster **5 → 10** (6 merc + 4 ranged) and `handSize` **5 → 6** (user call), so a draw is a
  real 6-of-10 subset (redraw becomes meaningful in K3). It read as a **massacre** at first (weak-bot
  avg floor 1.0 vs the old ~3.1), and the diagnosis is the useful part:
  - **Stress tests isolated the cause** (all `npm run fuzz`, 20 seeds, gitignored output):
    (1) **draw variance EXONERATED** — a zero-variance roster-6/hand-6 (whole roster fields every turn)
    wiped *identically* to roster-10 (floor 1.0, byte-identical ticks); (2) **absolute level EXONERATED**
    — a level-10 roster was *identical* (floor 1.0): the enemy budget scales with player level, so it's
    a treadmill, the matchup is RELATIVE; (3) **archers INDICTED** — cutting the enemy archer ratio
    40%→15% nearly doubled the floor (1.0 → 1.9). So: too many enemies, too many of them archers.
  - **The real culprit — a latent H5 wave-size bug.** After two coarse band-aids (archers 0.15, swarmMax
    1.4), the user noticed **waves > 2× the hand**. `rollEnemyWave` sized the enemy COUNT off
    `playerTeam.length` (the whole 10-roster) instead of the fielded `min(roster, handSize)` — so the wave
    was `swarmMax × 10` (~18, budget-capped) vs a 6-card hand. The BUDGET hand-capped correctly; the COUNT
    didn't (pre-K2 roster==hand, so latent). **Fixed** (`size = min(playerTeam.length, DECK.handSize)`).
    That bug, not the budget, was the massacre.
  - **Re-sweep against the FIXED count** (2-D `budgetFactor × swarmMaxMultiplier`, quick tier, `--floors=11`,
    `samplerSeed=1`, `--jobs=16`, `enemyArcherRatio 0.3`): with the bug gone, fewer-but-stronger waves are
    much EASIER (action economy dominates individual strength), so the band CLIMBS. Sharp cliff at
    **`swarmMax 2.0 → 2.25`** (best-achievable 63% → 0%); at `swarmMax 2.0`, `budgetFactor` is the fine
    lever (0.5/0.625/0.75 → weak bots 62%/37%/0%). **Landed `budgetFactor 0.75 × swarmMax 2.0 ×
    enemyArcherRatio 0.3`** — best-achievable **~63%** (the 2/3 target), weak bots 0% in-sweep / **5–10%
    over 20 seeds**, avg floor ~4.9. **The cell is cliff-adjacent (fragile); re-sweep in N2** once the K
    player-buffs (redraw/empower) + daemons land and shift the band again.
  - **`enemyArcherRatio` is now a config knob** ([difficulty.json](config/difficulty.json), was a hardcoded
    `0.6` melee split). **Takeaways for N2:** the SIZE/COUNT knobs (`swarmMax`, the hand-capped basis) and
    archer density move the band far more than `budgetFactor`; absolute level and draw variance don't move
    it at all. Re-baseline tests/fuzz after the change (done — `npm run fuzz` reproduces the floor ~4.9 read).

- **K3.5 one-map-per-encounter — the fuzz read SHIFTED, band re-tune deferred to N2 (2026-06-11).** Hoisting
  the map roll to encounter scope (layout/size/terrainSeed/theme rolled once in `beginEncounter`; only the
  wave + worldSeed stay per-turn) restructures the run RNG stream, so the whole fuzz baseline re-rolls — and
  the measured read came back EASIER at the unchanged K2 knobs (`budgetFactor 0.75 × swarmMax 2.0 ×
  archerRatio 0.3`): **pure-random 20% win / avg floor 5.94 over 50 seeds** (30% over the first 20; greedy
  15% over 20) vs the K2-era **~5–10% / floor ~4.9**. Two candidate mechanisms, not yet separated:
  (1) pure re-roll — different sampled waves at new stream offsets; (2) **systematic** — a favorable map now
  COMPOUNDS across an encounter's turns (win turn 1 on a good field → fight turns 2-3 on the same field)
  where per-turn rolls used to average it out. Weak bots at 20% is ABOVE the "rarely win" target, so the
  band is loose — **left as-is deliberately**: K4 empower (a player buff) moves it again, and N2 re-sweeps
  against the final model (the whole point of doing K3.5 before N2). Also: **1 hang / 50 seeds** (procedural
  map; trace in gitignored `tests/fuzz/output`) — first hang since the I2 cap bump. Plausibly the same
  persistence effect (a stall-prone map repeats all encounter turns instead of re-rolling away); watch in N2.
  **Human data point (same day):** the user completed a FULL run post-K3.5 (the first in ages) and enjoyed
  it - consistent with the easier read. Acceptable while the K player-buffs land; N2 calibrates the band.

- **K3c3 redraw-policy lift + the map-signal experiment (2026-06-11).** The K3-closing measurement pass,
  taken with the new `--redraw` bot (zero src change; knobs unchanged: `budgetFactor 0.75 × swarmMax 2.0 ×
  archerRatio 0.3`, `redraw 1 batch × 6 cards`). **(A) Redraw lift — SMALL.** 50 seeds × both baseline
  strategies per policy (100 full runs each; baseline reproduces the K3.5 read exactly — pure-random 20% /
  floor 5.94):

  | policy           | pure-random win/floor | greedy win/floor | combined wins/100 |
  |------------------|----------------------|------------------|-------------------|
  | none             | 20% / 5.94           | 14% / 5.72       | 17                |
  | random:2         | 12% / 4.42           | 18% / 4.66       | 15                |
  | level:2          | 20% / 5.78           | 26% / 5.62       | **23**            |
  | level:6          | 22% / 5.94           | 18% / 5.48       | 20                |
  | scored lvl-fisher| 24% / 6.14           | 14% / 5.50       | 19                |

  Conclusions: (1) **no naive policy moves win rate beyond ~1.5σ** (σ≈3.8 wins/100) — redraw as shipped is
  NOT a band-breaking lever, so deferring the re-tune to N2 stays safe; (2) the most solid signal is
  **`random:2` losing ~1.2 avg floors on BOTH strategies** (floor variance is tight) — indiscriminate
  tossing sometimes benches carries, so the resource-free mechanic still carries a real decision (good
  design news); (3) modest targeted fishing (`level:2`, +6 wins/100 at par floor) is the best read —
  directionally what the mechanic should reward; (4) an early small-sample "full-mulligan craters" read
  (75%→25% at 8 floors, 5 seeds) did NOT replicate at 100 runs — withdrawn. Caveat: naive policies on
  baseline strategies; a TUNED scored policy (weight search ± comp/map terms) may find more.
  **(B) Map signal — HUGE, and policy-relevant.** Arena isolates (40 seeds, all-lvl-5 rosters, identical
  waves per seed, objective none): melee-heavy (5× mercenary) vs ranged-heavy (5× ranged) per layout:

  | layout           | melee win | ranged win | gap        |
  |------------------|-----------|------------|------------|
  | labyrinth        | 100%      | 13%        | melee +87  |
  | river            | 93%       | 20%        | melee +73  |
  | endlessCorridors | 93%       | 65%        | melee +28  |
  | junctionAmbush   | 90%       | 15%        | melee +75  |
  | strafingFunnel   | 70%       | 95%        | **ranged +25** |
  | spiralFireLife   | 55%       | 90%        | **ranged +35** |
  | procedural       | 93%       | 15%        | melee +78  |

  The comp×map interaction DWARFS every redraw-policy effect measured above — two layouts FLIP the
  preferred comp by 25–35 points while the rest favor melee by 70–87. So (1) **map-aware terms in the
  scored policies are justified by measurement** (the design-round "confirm before building" gate passes);
  note the axis is NOT simply open-vs-narrow — the corridor labyrinth favors melee while the funnel/spiral
  favor ranged, so per-layout features (spawn distance / lanes / hazard tiles) likely matter more than an
  openness scalar. (2) A flat **melee-over-ranged dominance** shows on 5/7 boards at this comp/level —
  an arena-only read (no run context), but worth a telemetry look in N2's archetype pass.

- **K4c3 empower-policy lift — LARGE, and targeting-insensitive (2026-06-11).** The K4-closing measurement
  pass with the new `--empower` bot (zero src change; knobs unchanged: `budgetFactor 0.75 × swarmMax 2.0 ×
  archerRatio 0.3`, `empower 1/turn × [+4 STR/RNG/MAG, merge add]`). 100 seeds × both baseline strategies
  per policy (200 full runs each — double the K3c3 sample; the gates-on ≡ headless control from K3c3 still
  pins the gate path, so the lift below is pure empower effect):

  | policy   | pure-random win/floor | greedy win/floor | combined wins/200 |
  |----------|----------------------|------------------|-------------------|
  | none     | 19% / 5.75           | 18% / 5.58       | 37                |
  | random   | 33% / 7.04           | 31% / 6.94       | **64**            |
  | level:hi | 30% / 6.88           | 28% / 6.69       | 58                |
  | level:lo | 34% / 7.11           | 30% / 6.82       | **64**            |

  Conclusions: (1) **empower is a BAND-MOVING lever** — +21…+27 wins/200 (σ≈5.7 at p≈0.2 → ~4σ) and
  +1.1…+1.4 avg floors on BOTH strategies, an order bigger than redraw's best (+6/100 ≈ 1.5σ). The
  free-every-turn stacking default (+12 team stats per 3-turn encounter, compounding) is generous —
  exactly the K-buff shift the K2/K3.5 notes predicted; **N2 re-sweeps against it** (the magnitude /
  cadence knobs are config-only data: `config/empower.json` mods, `empowersPerTurn`, or L gating it
  behind a daemon). (2) **WHICH card barely matters at the shipped buff**: random ≡ level:lo (64) ≳
  level:hi (58, within ~1σ) — the value is the stats themselves, not the targeting, so a tuned scored
  empower search is NOT justified yet (the scored kind ships for the L-era anyway; `scored{level:1}` ≡
  `level:hi` is pinned by unit test). Weak evidence that stacking the carry is the WORST naive pick
  (overkill saturation — the carry already wins its fights); spreading via `lo`/`random` edges it out.
  (3) The ~1 hang/100 procedural/spiralFireLife/labyrinth tail persists from the K3.5 read at every
  policy — unchanged by empower; still an N2 watch item.

- **L1c3 per-idol read — MINERVA IS AN EXTREME OUTLIER; the idol roll is now the biggest single lever
  in the game (2026-06-12).** The L1-closing measurement with the new `--daemon` arm (zero src change;
  knobs unchanged; **daemon-only gates** now live, so redraw/empower exist only where an idol grants
  them). 100 seeds × both baseline strategies per arm (200 full runs each), bots fixed at the K-era
  naive best — `--redraw=level:2 --empower=random` — so each arm measures the idol's value GIVEN a
  player who uses what's granted (under `none` both bots no-op; the K3c3 gates-on ≡ headless control
  still pins the gate path):

  | arm (forced)  | pooled win/200 | avg floor | greedy win | pure-random win | hangs |
  |---------------|---------------|-----------|------------|-----------------|-------|
  | none (control)| 14.0% (28)    | 5.09      | 15%        | 13%             | 2     |
  | janus         | 16.5% (33)    | 5.10      | 14%        | 19%             | 1     |
  | mercury       | 18.5% (37)    | 5.40      | 16%        | 21%             | 0     |
  | mars          | 31.5% (63)    | 6.62      | 26%        | 37%             | 0     |
  | **minerva**   | **69.5% (139)**| **9.28** | 67%        | 72%             | 2     |
  | random (roll) | 34.0% (68)    | ~6.4      | 32%        | 36%             | 0     |

  The `random` arm's per-idol buckets (janus 17.2%/64 runs · mars 33.3%/54 · mercury 20.0%/40 ·
  minerva 73.8%/42) replicate the forced arms within noise — the `perDaemonStats` bucketing works as
  a one-batch per-idol read. Conclusions: (1) **daemon-only gates put the baseline back where the
  pre-K4 model sat** (none 14% ≈ the K4c3 no-empower 18.5%, modulo the daemonRng stream re-roll) and
  **Mars ≈ the K4c3 always-on empower read** (31.5% vs 32%) — clean cross-validation that the idol
  IS the old static enable. (2) **Minerva (+4 DEF, stacking, 1/turn) is wildly dominant**: +55.5pp
  over the control (σ≈2.5pp at this n → off the charts) and +38pp over Mars, nearly QUINTUPLING the
  win rate. Mechanism (the design-round flag, now confirmed): DEF is GP2's FLAT SUBTRACTIVE
  mitigation, so against low-might fodder (Bandit club +2) a few stacks push per-hit damage toward
  the `minDamage` floor — carries go functionally unkillable while `survivorPower` chips the enemy
  pool every turn. The response is pure config data and the USER'S call (logged, not changed here):
  lower the add (+2?), switch to a `mul`, cap the stack, or embrace it as the catalog's "god roll"
  at a rarity cost once the economy lands. (3) **The redraw idols barely move the band** (janus
  +2.5pp ≈ 1σ, mercury +4.5pp ≈ 1.6σ — not significant) — consistent with K3c3's "naive redraw lift
  is small"; their value as shipped is texture/agency, not power. (4) **The idol roll is now the
  dominant variance source** — 14%→70% at fixed bot skill — which is exactly the roguelite spread
  the user chose with daemon-only gates; the per-daemon buckets make it measurable per arm, and the
  future starting-profiles round inherits the same bucketing. (5) Hangs stay at the known ~0.5–1%
  labyrinth/spiralFireLife tail, idol-independent; still N2's watch item. **N2 must re-sweep the
  band PER-IDOL (or post-Minerva-rebalance)** — a single global band no longer describes the game.
  - **Follow-up (same day) — Minerva NERFED +4 → +2 DEF (the user's call) and re-measured.** The
    forced arm at +2: **34.0% / floor 7.51 over 200 runs, 0 hangs** (was 69.5% / 9.28 at +4) —
    landing right beside Mars (31.5% / 6.62), so the two empower idols are now PEERS (+17.5–20pp
    over the 14% control) and the catalog spread compresses **14%→70% ⇒ 14%→34%**. The random arm's
    minerva bucket replicates the nerf (73.8% → 38.1% at n=42), and its OTHER three buckets came
    back byte-identical to the pre-nerf batch (same seeds, untouched idols — the determinism
    contract visible in the data). Residual shape worth remembering: minerva still edges mars on
    FLOOR (7.5 vs 6.6 — defense keeps even the losing runs alive longer), and both empower idols
    sit ~2× the redraw idols' lift; whether the redraw idols deserve bigger budgets is N2 material.

- **M1 per-turn promotion cadence — stash-compared BAND-NEUTRAL (2026-06-12).** M1 moves XP banking
  from encounter end to the TURN boundary (promotions pop mid-encounter; a leveled unit fields
  stronger on the very next turn; `pendingEncounterXp` retired, Run v16→v17). In principle a player
  buff — `encounterBudget` is fixed at encounter start, so a mid-encounter level is "free" strength
  inside that encounter — so it was measured before docs/commit. Stash-compare at identical commands
  (`--count=50 --jobs=4`, knobs unchanged, no bot flags — daemon = the Run's own roll):

  | strategy    | pre-M1 win/floor/hangs | post-M1 win/floor/hangs |
  |-------------|------------------------|--------------------------|
  | pure-random | 22.0% / 5.24 / 1       | 22.0% / 5.28 / 1         |
  | greedy      | 26.0% / 5.24 / 1       | 24.0% / 5.24 / 1         |

  Deltas are within noise (σ≈5.9pp at n=50) — **the cadence alone moves nothing at naive-bot skill**,
  which is the good outcome: at the shipped leveling rate (start level 5, big `xpToNext`) mid-encounter
  crossings are rare, so M1 delivers its intent (levels SURFACE more often — the "too rare" feel from
  the Phase-H feedback) without becoming an accidental band-mover ahead of N2. The leveling RATE stays
  N3's lever, measured against a stable post-N2 band. One model change worth remembering for N3: a
  LOSING turn's XP is never banked (defeat is terminal — no level-up screen ahead of the defeat
  screen), so an N3 rate hike won't leak XP into lost runs. The ~1-hang/50 labyrinth tail persists
  pre- and post- (same seed, same layout) — still N2's watch item.

- **M2-session leveling-curve LIVE TUNE (user, 2026-06-12, UNMEASURED — a TESTING knob, not a
  design call).** Alongside the M2 screen work the user tuned `config/leveling.json`
  **`baseXp 100→20, exponent 1.25→1.1`** to make promotions frequent enough to exercise the new
  reveal (xpToNext(1) 100→20; xpToNext(5) ~565→~117), then chose to **leave it in for a while**
  ("let's leave it for a bit") — so it ships on main for now but is NOT a leveling-rate decision:
  **N3's rate pass still owns that call** and should treat this curve as a placeholder to re-derive,
  not a baseline to defend. While it lives, it's a presumptive **band-mover** (H7c lesson: the
  matchup is RELATIVE since enemy budget scales with player level, but faster leveling also
  compounds stat growth + per-turn promotion surfacing) — any fuzz read taken at this curve carries
  it; flag it in N2-era comparisons. NOT stash-measured.
  Test fallout: four `Run.test.ts` promotion-phase pins hardcoded `xpGained: 100` (== the OLD
  `xpToNext(1)`) and broke at the new curve — switched to the file's own `xpToNext(1)` convention
  (the balance-proof rule: derive from config, never hardcode curve arithmetic).
  **[SUPERSEDED 2026-06-14 — see the N2-opening entry below: the curve was raised `20→50`
  (commit `8e37203`) and LOCKED as a playtest-validated feel target. N3 is reframed from a
  from-scratch re-derivation to a consistency check; the "placeholder to re-derive, not a baseline
  to defend" framing above no longer holds — 50/1.1 IS the baseline the N2 band is tuned around.]**

- **M6 procedural-map rework DEPLOYED — fuzz baseline SHIFTS (terrain), N2 re-sweep on the hook
  (2026-06-13, UNMEASURED here — left for N2).** The procedural path is no longer a uniform
  6%-scatter: it's now a crossbar + divider + noise blend ([proceduralMap.ts](src/sim/proceduralMap.ts)),
  with **chokepoints + fordable water gaps + half-cover windows in the walls** — i.e. real
  structure where the scatter had none. Terrain structure strongly moves win rates (the **K3
  comp×map interaction**: ranged vs melee FLIP by layout), so this is a presumptive **band-mover**
  on top of daemons (L1, the biggest lever) + empower (K4) + the playtest-locked leveling curve
  (50/1.1, N2-opening). **NOT swept here** — folded into N2 against the final model. Two isolation levers
  ready for that sweep: **`--layout=procedural`** forces the new procedural maps every battle (the
  clean full-sample read, mirroring `--layout=<id>`), and `?layout=procedural` does the same in the
  browser. The map *envelope* itself is now config-tunable ([config/terrain.json](config/terrain.json)
  `procedural`: per-knob ranges/weights + `windowChance`), so N2 can move terrain difficulty as a
  knob, not just a structural given. One smoke read at the M2-session leveling curve (3-seed,
  `--layout=procedural`): pure-random ~85% — INFLATED by the testing curve, NOT a balance signal;
  flagged per the M2-session caveat.

- **N1 rogue dash IMPLEMENTED — fuzz baseline SHIFTS (rogue behavior), N2 absorbs it (2026-06-14,
  UNMEASURED here — left for N2).** The rogue gained an aggressive-close **dash**
  ([config/abilities.json](config/abilities.json) `#dash`: movement / range 2 / 0.25s motion / 10s
  cd) — it leaps toward a target beyond `derived.attackRange`, closing the gap the H7c step-3
  `weakest`-targeting eval proved a *range-1* rogue couldn't. This changes rogue trajectories in
  every rogue-bearing run → a presumptive **band-mover** joining daemons (L1, the biggest lever) +
  empower (K4) + the M6 terrain rework + the playtest-locked leveling curve (50/1.1, N2-opening). **NOT
  measured here** — the rogue re-measure (the H7c forced-roster protocol: does dodge+dash finally
  make it recruit-worthy? flip it to `weakest` targeting and re-run) is **N2's job, on the final
  model**. fuzz:smoke stayed byte-identical: the dash only changes rogue-bearing sims, and emitting
  the extra `unit:dashed` event doesn't perturb sim state (positions/RNG), so the determinism guards
  are unaffected.

- **N2 OPENING — leveling curve LOCKED at `baseXp 50 / exp 1.1` + N3 reframed (2026-06-14, commit
  `8e37203`).** The `baseXp 20` testing knob (M2-session) is retired: the user raised it `20→50`
  off **playtest feel** (20 still surfaced level-ups too rarely; 50 gives a satisfying cadence) —
  NOT a balance call, but it makes the curve a **playtest-validated feel target**, not a free
  variable. **Decision (user, this session): balance the N2 difficulty band AROUND 50/1.1.** The
  rate and the band can't be cleanly disentangled (the curve governs power accumulation across a
  run; the difficulty constants govern per-encounter enemy strength; they interact through run
  length / snowball dynamics) — so rather than tune them as two independent passes:
  - **N2 = the difficulty-band sweep at a FIXED 50/1.1 curve** (the funnel below, unchanged).
  - **N3 = reframed from "re-derive the curve from scratch" → a CONSISTENCY CHECK:** use the
    heavy-stage **levels-by-floor + XP-flow telemetry** to confirm the final N2 constants didn't
    distort the level-up cadence, and to catch a snowball (units out-scaling enemies on deep floors)
    or fall-behind. If the telemetry shows distortion, nudge `leveling.json` and re-confirm the band
    — a short feedback loop with N2, not a separate pass.
  This SUPERSEDES the M2-session entry's "placeholder to re-derive, not a baseline to defend"
  framing. Every N2 sweep reading is now taken at the intended curve (50/1.1) — no testing-knob
  inflation to flag. Pre-commit: typecheck clean, 950/950 main green (the four `Run.test.ts`
  promotion pins read `xpToNext(1)` from config, so they tracked `20→50` with no edit). **NEXT =
  stage 1: the broad `budgetFactor × swarmMax` grid (quick tier), isolated to `--layout=procedural`.**

- **N2 TOOLING — `--layout` threaded through `--balance-sweep` + `--search` (2026-06-14, commit
  `1bbb57b`, dev-only/zero-src).** Caught before stage 1: `--layout=procedural` was only wired into
  the plain run fuzz; the sweep + search command `Pick`s omitted `layout`, and an unread global flag
  is silently ignored — so `--balance-sweep … --layout=procedural` would have swept the DEFAULT
  layout mix (a wrong-but-plausible band). The harness already supported `runConfig.forcedLayoutId`;
  only the command layer never plumbed it. Fixed via a shared `layoutFromArgs` (validates + bails
  loudly on a typo) threaded through sweep/search + the `--jobs` shard path. Verified: typo bails;
  `--layout=procedural` forces all waves onto procedural; a hard procedural point reads identically
  at jobs=1 vs jobs=2 (best 75%/grad 13). **Protocol amendment (commit `50cac38`): default `--jobs`
  on for any multi-point sweep** (heavy high-swarm points dominate wall-clock + shard well; size
  ~cores/2 for headroom; single `--search`/tiny grids stay single-process).

- **N2 STAGE 1 — broad leverage map (2026-06-14, `output/n2-stage1/`).** Grid `budgetFactor 0.25:1.5:6
  × swarmMaxMultiplier 1.0:3.0:5` (30 pts), **quick tier, `--layout=procedural`, BARE model** (no
  empower/redraw policy bots → the default random daemon roll is INERT, since L1 idols only grant
  redraw/empower gates and nothing drove them). So this is the **agency-free floor + a leverage map**,
  not the band. best-achievable %:

  | budget\swarm | 1.0 | 1.5 | 2.0 | 2.5 | 3.0 |
  |---|---|---|---|---|---|
  | 0.25 | 100 | 100 | 100 | 100 | 100 |
  | 0.50 | 100 | 100 | 100 | 75 | 50 |
  | 0.75 | 100 | 100 | 100 | 75 | 13 |
  | 1.00 | 100 | 100 | 88 | 38 | 13 |
  | 1.25 | 88 | 100 | 88 | 13 | 0 |
  | 1.50 | 88 | 50 | 25 | 0 | 0 |

  **Findings:** (1) the band moved WAY up — the old shipped `0.75 × 2.0` is a flat 100%/0-grad
  foregone conclusion; the ~67% zone is a **diagonal ridge** (`0.5×3.0` → `1.5×1.5`). (2) **swarm is
  the dominant lever and budget now interacts** (it barely moved the band in K2 — the stacked buffs
  changed that); they trade off (crank both → 0%). (3) the steepest gradients (+25pt) cluster at
  **higher budget (1.25–1.5)** not pure swarm — a few stronger enemies reward play more than a weak
  horde → the region to zoom. (4) **OP read holds:** mercenary + ranged dominate every point (at hard
  points the optimizer fields ONLY those two); rogue/mage/catapult/healer/ronin/adventurer/bandit
  barely recruited — the flat **mercenary>ranged** dominance confirmed, and **the dash did NOT make
  the rogue recruit-worthy** to the free search (its forced-roster re-measure still owed).
  **Caveats:** quick-tier noise is heavy (8 train seeds = 12.5% quantization; big train/test gaps,
  e.g. `1.25×2.0` train 88% / held-out 25%) → a region-finder, not the band; and the gradient is
  SMALL everywhere (≤+25pt) — the foregone conclusion is shifted, not fully broken (the stacked
  buffs help all strategies ~uniformly; steepening it is stage-3/archetype-pass work).
  **Decision (user): stage 2 tunes the REALISTIC model** — add `--empower=level:hi` + `--redraw=level:2`
  policy bots so the random daemon's granted tools get used (ROADMAP §N2's mandate). **Validated the
  bots fire** (1-pt quick dry-runs at `1.0×2.5`, bare 38%): random-daemon realistic → **50%** (+12pp);
  forced `--daemon=mars` (guaranteed empower) → **75% / grad +63pt** — a hard point WITH an empower
  idol breaks the foregone conclusion HARD (best 75% vs baselines ~12%), so agency tools *steepen* the
  gradient where we want it. The realistic band sits ~½-step harder than bare; its ~67% ridge crosses
  lower-swarm at high budget (≈ `1.0×2.35` / `1.25×2.2` / `1.5×1.6`). **NEXT = stage 2: medium tier,
  `--jobs=8`, grid `budgetFactor 1.0:1.5:3 × swarmMaxMultiplier 1.5:2.5:5` (15 pts), realistic bots.**

- **N2 STAGE 2 — narrowed realistic band (2026-06-14, `output/n2-stage2/`).** Grid `budgetFactor
  1.0:1.5:3 × swarmMaxMultiplier 1.5:2.5:5` (15 pts), **medium tier (16 seeds), `--jobs=8`,
  `--layout=procedural`, REALISTIC model** (`--empower=level:hi --redraw=level:2` + the random daemon
  roll). best-achievable % (gradient pt):

  | budget\swarm | 1.5 | 1.75 | 2.0 | 2.25 | 2.5 |
  |---|---|---|---|---|---|
  | 1.0 | 100 (0) | 100 (19) | 94 (13) | 56 (25) | 38 (13) |
  | 1.25 | 100 (13) | **75 (38)** | 56 (0) | 31 (19) | 25 (19) |
  | 1.5 | **63 (31)** | 19 (0) | 19 (19) | 13 (6) | 13 (13) |

  **Candidate band — two leaders bracket the ~67% target with STEEP gradients:** `1.25 × 1.75` →
  **75% / +38pt** (rand 38 / greedy 31) and `1.5 × 1.5` → **63% / +31pt** (rand 25 / greedy 31).
  Band center ≈ `1.35 × 1.6`. **A much healthier result than stage-1 bare:** (a) the gradient is real
  (best ≈ 2× the baselines, vs bare's ≤25pt — the realistic agency tools STEEPEN it, as the
  forced-Mars probe foreshadowed); (b) **roster DIVERSITY emerges at the band** — at `1.25×1.75` the
  optimizer fields mercenary + ranged + adventurer + **rogue (43 deployments, 35.5 dmg/dep)** + mage +
  healer + catapult (only ronin/bandit benched); `1.5×1.5` similarly fields 8 of 9. So at the
  concentrated/harder difficulty the specialists become worth fielding — the mercenary>ranged
  monoculture partly self-corrects WITHOUT archetype edits (re-confirm at heavy). **Caveat:** the
  medium test-seed split is tiny (~3 test seeds) so held-out win rates are very noisy (e.g. `1.5×1.5`
  train 63% / test 0%); the **train-based gradient is the reliable read**, heavy's 30 seeds tighten
  it. **NEXT = stage 3 (launched): 3×3 heavy, FULL 11 floors, `--jobs=8`, `budgetFactor 1.25:1.5:3 ×
  swarmMaxMultiplier 1.5:1.75:3` centered on the band — precise best%/gradient + the OP-unit read +
  whether the full-floor band drifts from the 6-floor medium read.**

- **N2 STAGE 3 — heavy/full-floor COMPLETE (2026-06-15, `output/n2-stage3/`).** The dwm blocker was
  resolved by a reboot (full diagnosis split to [archive/dwm-leak-diagnosis.md](archive/dwm-leak-diagnosis.md);
  driver update ruled out, cross-vendor → reboot-before-heavy-runs is the standing mitigation). Heavy
  tier (30 train + held-out test seeds), FULL 11 floors, realistic `--empower=level:hi --redraw=level:2`
  bots, `--layout=procedural`, grid `budgetFactor 1.125:1.375:3 × swarmMax 1.5:1.75:3` (9 pts),
  `--jobs=8`, samplerSeed=1. Ran clean and **reproduced the partial reads byte-for-byte.**
  best-achievable % (held-out test · gradient):

  | budget\swarm | 1.5 | 1.625 | 1.75 |
  |---|---|---|---|
  | 1.125 | 87 (test 70, +33) | 73 (50, +37) | 60 (50, +33) |
  | 1.25  | **70 (60, +30)** | 47 (30, +27) | 40 (30, +33) |
  | 1.375 | 47 (20, +27) | 23 (20, +10) | 23 (10, +20) |

  **BAND LOCKED → `1.25 × 1.5`** (committed to `config/difficulty.json`, was `0.75 × 2.0`): 70% best /
  **60% held-out** / +30 gradient (best ≈ 2× both baselines), on the ~67% target with the TIGHTEST
  train→test gap of the contenders (`1.125 × 1.625`'s steeper +37 came with a 73→50 overfit gap — less
  trustworthy). Full floors read ~20–30pp HARDER than the 6-floor medium tier (factor into N4).
  **OP-UNIT READ (the owed telemetry):** at the band it's a **mercenary + ranged DUOPOLY** — at
  `1.25×1.5`, mercenary 1872 deployments + ranged 1320, everything else ≤17 (the other 7 benched).
  **Stage-2's "diversity emerges at the band" did NOT survive full floors:** diversity shows up only
  BELOW the band, at the harder/losing points (`1.25×1.75` 40%: healer 199 / mage 96 / rogue 45) — a
  symptom of the optimizer *struggling*, not health. Nuance: per-unit, **ranged out-damages mercenary**
  (~40–44 vs ~35–38 dmg/dep); mercenary leads on volume + tanking (soaks ~2× damage, ~2× deaths) — the
  meatshield that lets ranged farm safely. The monoculture is NOT self-corrected by the difficulty knob
  → making the specialists band-worthy is archetype-balance work. **Rogue still inactive at the band**
  (the N1 dash didn't make it recruit-worthy; the `weakest`-targeting re-measure is the lever, still
  owed). **NEXT:** optional ~67%-dead-on nudge-sweep (budget ~1.1875 or swarm ~1.5625) if wanted; the
  rogue re-measure; N3 leveling consistency check; N4 overnight (reboot FIRST — the dwm leak persists).

- **N2 ROGUE RE-MEASURE — `weakest`+dash STILL backfires → keep `nearest` (2026-06-15).** The owed
  H7c/I5 forced-roster A/B at the LOCKED band (`1.25 × 1.5`), `--layout=procedural`, realistic bots
  (`--empower=level:hi --redraw=level:2`), quick tier, `--floors=11`, samplerSeed=1. The SAME forced
  lvl-5 rogue lineup (`--roster=rogue:5,mercenary:5,mercenary:5,ranged:5,ranged:5`) run under each
  rogue targeting (the only difference), reading the rogue's per-deployment telemetry:

  | rogue targeting | dmg/dep | taken/dep | deaths/run | deployed | best% |
  |---|---|---|---|---|---|
  | **`nearest`** (shipped) | **19.6** | 21.8 | 13.5 | 125 | 75 |
  | **`weakest`** (test)    | **2.6**  | 23.6 | 20.8 | 171 | 75 |

  *(carries for reference: mercenary ~40 / ranged ~46–57 dmg/dep.)* **`weakest` COLLAPSES the rogue's
  per-unit damage ~87%** (19.6→2.6) and RAISES its death rate (13.5→20.8/run) despite MORE deployments
  (dying more → re-drawn from the pool more often) — even WORSE than H7c's pre-dash 3.1. Decisive over
  125–171 deployments (structural, not quick-tier's 8-seed quantization); best-achievable stayed 75% both
  runs (the optimizer never leans on the forced rogue → per-deployment is the honest signal).
  **Mechanism (H7c's, unchanged): the dash doesn't fix the `weakest` identity problem.** `weakest`
  commits to the lowest-`maxHp` enemy (the backline) and NEVER retargets (`shouldRetarget=false`); the
  dash is only 2 cells / 10 s cd, so it closes one leap of a 6+-cell gap, then the rogue WALKS the rest
  through the live enemy front to reach its committed mark — and even when it deletes a squishy it's a
  lone fragile unit deep in the formation, surrounded, team a board away → focus-fired and dead. The
  dash solved "close the last gap to an out-of-range NEAREST target" (its N1 job), not "operate alone in
  the backline." **VERDICT: keep `nearest` (no config change ships — reverted byte-identical to HEAD,
  per I5/H7c); the dash STAYS on its own N1 merits.** The free-composition search is moot — the optimizer
  already benched the *better* (`nearest`) rogue at the band in STAGE 3, so it won't field the
  strictly-worse `weakest` one. **Implication (flagged, future archetype-balance work):** the rogue's
  "backline assassin" identity needs more than a short dash — a long blink/teleport, post-strike
  untargetability/stealth, or one-shot burst (none exist) — so the rogue stays a benched specialist
  alongside the rest of the non-duopoly roster. **N2 rogue thread CLOSED. NEXT: N3 leveling consistency
  check** (optional 67%-nudge-sweep skipped, user call); N4 overnight deferred to a VPS.

- **N3 LEVELING CONSISTENCY CHECK — GREEN, no nudge (2026-06-15).** The reframed N3: confirm the locked
  `baseXp 50 / exp 1.1` curve isn't distorted by the final `1.25 × 1.5` band (snowball / fall-behind).
  Levels-by-floor telemetry via `--per-floor` at the band, `--layout=procedural`, realistic bots
  (`--empower=level:hi --redraw=level:2`), full floors — two independent reads (greedy ×20 + scored ×50,
  the scored line reaching deeper for a solid floor-9/10 sample, Runs 17–18). Both AGREE:

  | floor | P.avgLv | E.avgLv | P−E gap |
  |---|---|---|---|
  | 1 | 5.10 | 4.59 | +0.51 |
  | 3 | 6.26 | 5.51 | +0.75 |
  | 5 | 7.15 | 6.48 | +0.67 |
  | 7 | 7.86 | 7.01 | +0.85 |
  | 9 | 8.42 | 7.34 | +1.08 |
  | 10 | 8.63 | 7.77 | +0.86 |

  (scored ×50.) **Findings:** (1) **cadence is steady** — player avg level climbs 5.10 → 8.63 over 10
  floors = **+0.39 level/floor**, units level regularly (the M1/M2 "leveling too rare" concern is fully
  resolved by 50/1.1 — consistent with the playtest-validated feel); no runaway, no stall. (2) **No
  snowball, no fall-behind** — the player-over-enemy level gap stays in a TIGHT `+0.5…+1.08` band across
  ALL 10 floors. It does NOT widen on deep floors (a snowball would blow the gap out to +2/+3 as survivors
  out-scale enemies — it doesn't) and does NOT collapse (the enemy never catches up — E scales in lockstep
  4.59 → 7.77). (3) Within-team level spread grows 0.14 → ~1.15 (carries level faster via more
  deployments/XP) but median tracks mean — no extreme outliers. (4) Funnel healthy: Died% ramps 0 (F1–2)
  → ~10–19% (mid) → LOW 6% on F9–10 (deep-floor survivors are well-equipped — selection effect). **VERDICT:
  the locked `50/1.1` curve and the final `1.25 × 1.5` band are MUTUALLY CONSISTENT — N3 satisfied, no
  `leveling.json` change.** **N3 CLOSED → Phase N near-term work COMPLETE** (rogue re-measure + N3 done;
  optional nudge-sweep skipped). **Remaining Phase N:** the N2 turn-cap-unification cleanup (fold
  `maxTurnSeconds`/`DEFAULT_MAX_TICKS` onto one source — non-gating chore) and **N4 overnight verify
  (deferred INDEFINITELY to a VPS** — the local dwm leak risk).

---

### O4 (2026-06-16) — ranged kiting moved the baseline; re-confirmation PENDING

Phase-O O4 added ranged **`minRange`** (kiting): a ranged unit whose target is inside the floor backs off
to the `[minRange, attackRange]` band before firing. Shipped values **bow 2 / mage 2 / catapult 4** (melee
+ heal 0). This is a real combat-effectiveness change (ranged units now disengage from melee instead of
trading point-blank), so it **shifts the fuzz read** — but per the stable-baseline rule the sweep is
**folded into the Phase-O Cleanup re-confirmation, not run yet**. When it runs: light broad→medium,
**isolate the procedural maps** (`--layout=procedural`), retune only if the locked `1.25 × 1.5` band moved
materially. **Two things to watch:** (1) does kiting net-buff or net-nerf ranged at the band (it improves
positioning but costs shots while repositioning)? (2) **catapult `minRange 4` on a slow unit** — flagged
as possibly too fragile: a matched-speed chaser inside 4 cells can keep it from ever firing (kite-pinned);
if telemetry shows catapults cratering, drop the floor (a one-number config tweak). No band change made in
O4 itself.

**Playtest data-point (user, 2026-06-16, O4b signed off):** kiting "made a drastic difference" and "broke
up the blob fights massively" (the anti-blob goal — confirmed). BUT archers now feel **"really slippery."**
So watch-item (1) leans **net-buff for ranged** — kiting may have over-helped archers (mobile + hard to
pin). The re-confirmation sweep should specifically check whether the mercenary+ranged duopoly (the N2 OP
read) got *worse* with kiting, and whether archers want a counter-nudge (e.g. accuracy/cadence trim, or a
shorter bow `minRange`) — NOT a band-factor change. No retune yet (stable-baseline rule).

### O5 + Phase-O re-confirmation (2026-06-17) — band HOLDS, duopoly UNCHANGED, NO retune

O5 added the dev-only objective **coverage churn bot** (`tests/fuzz/objectiveCoverage.ts`) — exercises
every typed-objective mode on both teams for termination/determinism, kept SEPARATE from the measurement
path (the proclivity stays engage-only so pure-random win rate remains a valid skill-gradient floor). NOT a
balance instrument; the re-confirmation below uses the normal measurement bots.

**Re-confirmation = the O4 (kiting) + O5 read folded into Cleanup.** Three single-process runs (no `--jobs`
— dwm-leak-immune), full 11 floors:

- **Two quick baseline sanity reads** (30 seeds, pure-random + greedy):
  - default layout MIX — rand 0% / greedy 13% · avg floor 4.9/5.1 · **0 hangs · 0 capped draws**
  - `--layout=procedural` — rand 10% / greedy 3% · avg floor 5.5/5.0 · **0 hangs · 1 capped draw** (in ~700 battles)
  - Baselines winning ~0–13% over 11 floors is the HEALTHY band read (N2: baselines "NEVER win an 11-floor
    run in this band; only skilled play does"). The **~0 capped draws is the key O4 signal** — kiting did
    NOT create the stalemate/kite-pin timeouts the watch-items feared.

- **Telemetry read** (the comparable-to-N2 one): single point at the live band `budgetFactor 1.25 ×
  swarmMax 1.5`, `--floors=11 --layout=procedural --empower=level:hi --redraw=level:2 --jobs=1`, quick tier
  (50 vec × 8 train / 4 test), 2.3 min. **best-achievable 75% train · +50 gradient · rand 25% · greedy 13%**
  (held-out test 25% is 1/4 seeds = the quick-tier small-sample noise N2 flagged — read train + gradient).
  vs N2 heavy's 70% / +30 → **same ballpark, no material band move.**
  - **Per-archetype (active only): mercenary 479 (dmg/dep 36.5 · taken/dep 22.5 · deaths/run 35.9) ·
    ranged 329 (35.9 · 11.0 · 13.5) · ronin 8 · rest benched.** Shares ≈ **merc 59% / ranged 40%** vs N2's
    `1872/1320` ≈ **58% / 41%** (merc:ranged ratio ~1.45 both). **The duopoly is UNCHANGED — kiting did NOT
    worsen or flip it.**
  - **Archers ARE measurably safer post-kiting** (taken/dep 11.0 vs merc 22.5; deaths/run 13.5 vs 35.9 — the
    "slippery" feel is real in the data) **but NOT dominant** (dmg/dep ≈ merc; fielded LESS, 329 vs 479). So
    watch-item (1): kiting net-helped archer SURVIVABILITY without converting to deployment/damage dominance
    → not an over-buff at the band. **No counter-nudge made.**
  - **catapult `minRange 4` (watch-item 2): unobservable** — catapults are benched at the band regardless
    (as in N2), so the kite-pin can't manifest. The flag is moot until catapults are viable → folds into the
    future ARCHETYPE-BALANCE thread, not O4.

**Verdict: `1.25 × 1.5` STANDS (no retune).** Band holds within noise, duopoly unchanged, sim healthy
(0 hangs / ~0 draws across 180 runs). The archer-slippery / duopoly / catapult observations are all
archetype-BALANCE questions (the flagged next major thread), NOT band-factor changes — consistent with the
O4 entry's guidance. Phase-O balance re-confirmation CLOSED.
