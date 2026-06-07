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

  ### To finish H7
  1. **Stage-5 overnight verify — the one remaining H7 step (DEFERRED by the user, run later).**
     `--search --preset=overnight --jobs=<cores>` — now a one-liner (H7d wired `--jobs` into search).
     For a RIGOROUS config→seed-overfit guard it wants **`--seed-offset`** (logged above + in TODO)
     so it runs on a fresh, never-tuned seed range; without it it's still a strong best-achievable
     read on the tuned seed bases. Confirms the 0.625 × 1.75 band + archetype edits hold out-of-sample.
  2. *Optional:* the leveling pass (may self-resolve post-nerf — identical growth) + the melee↔ranged
     carry gap (final 102 vs 61) if playtest bothers; re-baseline tests/fuzz after any config change.
