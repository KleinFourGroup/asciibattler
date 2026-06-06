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
