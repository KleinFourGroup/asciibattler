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
- **Lever** = a global/per-run multiplier the wave resolver reads, driven in
  ISOLATION per encounter (then baked into that encounter's budget) — so the
  encounter stays the unit of balance even though the lever itself is global.
- **Mechanism** = a **global/per-run difficulty multiplier** (`config/difficulty.json`
  default + a `RunConfig` per-run override — the future difficulty-system seam), NOT a
  field on the frozen encounter JSON. The sweep mutates this in-memory global while
  forcing one encounter (`--encounter`), so a global lever yields a clean
  per-encounter read; the tuned value is then **baked into that encounter's authored
  wave-spec budget** (see [The lever](#the-lever--the-per-run-difficulty-multipliers)).

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
4. **Drive the per-run multipliers in isolation** (`waveSize` / `levelBudget`, under
   `--encounter`) to find each encounter's in-band value, then **bake it into that
   encounter's wave-spec budget** (the lever returns to 1.0 — it's an experiment knob
   + the future difficulty source, not persisted per-encounter content).
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

## The lever — the per-run difficulty multipliers

First-class **engine primitives** (X1 — shipped), NOT harness-only — the groundwork
for the future difficulty system. They live on the **run**, not the encounter:

- **`waveSize`** — scales the resolved wave **count** `C` (`resolveTotalCount` in
  [wave.ts](src/run/encounters/wave.ts)). The **action-economy** axis (more bodies).
- **`levelBudget`** — scales the resolved **level budget** `L`
  (`resolveLevelBudget`). The **individual-strength** axis (more total levels).
- Each defaults to **1.0**, sweep range **0.5–2.0**, applied to **every wave** the
  encounter fields (a boss applies it across all `stages`).
- **Source = the run, not the encounter.** The global default lives in
  `config/difficulty.json` (`waveSizeMultiplier` / `levelBudgetMultiplier`); a per-run
  override lives on `RunConfig` (the seam a future difficulty level / hop-ramp /
  ascension sets). `resolveDifficultyMultipliers` resolves `override ?? default`;
  `Run` threads the result into `WaveContext` at resolve time. There is deliberately
  **no per-encounter multiplier field** — the encounter's authored wave-spec budget
  stays its single source of truth.
- **Tuning bakes, it doesn't persist a multiplier.** The sweep drives the lever in
  isolation to find an in-band value, then that value is **baked into the encounter's
  wave-spec `factor`/`value`** and the lever returns to 1.0.

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

> The per-encounter flags below are **X2 — BUILT** (X2a–X2c, 2026-06-21).

- `npm run fuzz -- --search [--preset=quick|medium|heavy|overnight] [--jobs=N]` —
  best-achievable + gradient. *(built)*
- `npm run fuzz -- --encounter=<id> …` — force one encounter at every node of its
  KIND (per-kind-bucket aware, Wb4); the clean per-encounter sample. Loud-validated
  against the catalog. *(built — X2b)*
- `npm run fuzz -- --balance-sweep --knob=difficulty.waveSizeMultiplier --range=0.5:2.0:N \`
  `--knob2=difficulty.levelBudgetMultiplier --range2=0.5:2.0:N --encounter=<id> --tier=… [--jobs=N]`
  — the difficulty-multiplier grid (the GLOBAL `DIFFICULTY` lever under `--encounter`
  isolation; the knobs are X1's live `difficulty.json` keys, so the existing sweep
  engine drives them — no per-encounter field). For a boss/elite, add `--hops=2
  --roster=<leveled>` so every run is that fight. *(built — X2a/X1)*
- `npm run fuzz -- --per-encounter | --per-layout | --per-hop` — pool-damage +
  outcome rollups (`--per-encounter` = X2a: player pool damage TAKEN per instance +
  per wave, keyed by encounter id; the other two pre-built).
- `--seed-offset=N` — base the eval seeds past the tuned range (the config-overfit
  holdout); run / search / sweep. *(built — X2c)*

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
- **2026-06-21 — X1 shipped: the lever as a per-run seam, not a per-encounter field.**
  `waveSizeMultiplier` / `levelBudgetMultiplier` added to `config/difficulty.json`
  (default 1.0) + a `RunConfig` per-run override (the future difficulty-system seam);
  `resolveDifficultyMultipliers` resolves `override ?? default`, `Run` threads it into
  `WaveContext`, the resolver scales `C` (`resolveTotalCount`) and `L`
  (`resolveLevelBudget`, saturating against `levelCap`). **Model revised from the
  overhaul's first cut** (a per-encounter multiplier field on the Encounter schema):
  the lever is global/per-run and tuning BAKES into the wave-spec budget, keeping the
  encounter's authored budget its single source of truth — so X1 touches no encounter
  schema. Proven **1.0 ≡ pre-X1 byte-identical** (fuzz:smoke 205); the encounter
  editor gains a preview-only difficulty slider. Sweep readings still to come (X2/X3).
- **2026-06-21 — X2 shipped: the per-encounter balance harness** (X2a `99acbf7`
  per-encounter pool-damage telemetry + `--per-encounter`; X2b `3a0f66c`
  `--encounter=<id>` force-select, per-kind aware, via a `RunConfig.forcedEncounterId`
  seam; X2c `cce21f4` `--seed-offset=N` held-out holdout). The metric is **player
  pool damage taken** (the chip's `enemy` field × `HEALTH.chipMultiplier`), reported
  per instance + per wave. **The multiplier sweep needed no new build** — X1 made
  `waveSize`/`levelBudget` live `DIFFICULTY` keys, so `--balance-sweep
  --knob=difficulty.waveSizeMultiplier --encounter=<id>` already works. First read
  (greedy, 8 seeds, natural full runs, UNTUNED): elites `brigand-champions` ~16 /
  `warband-vanguard` ~12 and the boss `bandit-king` ~24 lead per-instance pool
  damage; normals span `adventurer-with-guards` ~11 down to `highwaymen` ~0. NOT a
  tuning pass — just the harness's first sanity read; the X3 5-step sweep is next.
  **X2d** extended `--hops`/`--roster` to the plain run mode (was sweep/search-only),
  so a boss/elite isolation telemetry read works standalone (`--encounter=bandit-king
  --hops=2 --roster=<leveled> --per-encounter` → 12 boss instances vs 1 in a full run).
- **2026-06-21 — X3 the band RE-DERIVATION (the 5-step sweep).** The pre-X band was
  **invalidated, not perturbed** — the heavy full-length `--search` of the authored
  catalog won **0.0% held-out / 6.7% train**: near-unwinnable end-to-end, the gradient
  flat AT THE FLOOR. Root cause: the old `1.25 × 1.5` band was tuned for SINGLE random
  waves, but authored encounters `loop` over their `healthPool` (~3 waves each), so the
  same per-wave budget × N waves ran far over the 20-pool. Per-kind bands set
  **data-first WITH the user** (player pool 20, ~2–3 rests × 5, ~8–10 fights/run):
  **normal ≈ 3 · elite ≈ 6 (2×) · boss ≈ 10 (~3×)** pool-damage-taken/instance; scope
  = **content only** (bake into wave-spec budgets + `healthPool`; the pool/rest economy
  held fixed); the easy normals **brought up** into band.
  - **Method:** coarse knockdown vs a fixed reference → **re-derive** the optimal on the
    rebalanced content (`--search` heavy, jobs=8) → fine-tune vs the true gradient →
    **held-out verify** (`--seed-offset=5000`). The lever is the per-encounter
    `count.factor`/`levelBudget.factor`/`healthPool`; **pool damage is super-linear** in
    the per-wave budget (winning the wave craters it), so spikes need aggressive cuts.
  - **Result (optimal in-situ):** win rate **0% → 36.9%** (greedy 13.1%) — a **+24pt
    skill gradient** where there was none; smooth funnel (hops 0–9 ≤9% death) with the
    boss as the climactic wall (hop 10 ≈ 43–55%). Per-encounter, baseline → final
    pool-damage: warband 20.2→~7, boss 19.0→**8.5**, adventurer-with-guards 11.3→2.8,
    brigand-champions 9.7→~6–8, brigands 7.0→2.5; the easy normals raised
    highwaymen 0.3→2.2 / deserters 0.9→2.9 / ronin-vs-mages 1.6→1.4. **Held-out verify
    (offset 5000): bands HOLD out-of-sample** — normals 2.2–3.4, boss 10.8; best-
    achievable ~37% train. Config is NOT seed-overfit.
  - **Two planned items the data RETIRED:** the deferred **"uncap the spikes"** — the
    boss/ronin-vs-mages were *over* budget, not under, so uncapping (which RAISES
    difficulty) was exactly wrong; **no uncaps applied** (ronin re-capped after an
    overshoot to 7.7). And the **brigands anchor** (pinned faithful to `rollEnemyWave`)
    was retuned — X is "the conscious retune point" the anchor test itself named — and
    `brigands.test.ts` re-baselined to assert its own authored spec (derived from config,
    not the old generator).
  - **Elites stay under-sampled in-situ** (the optimal skips the optional detours);
    forced isolation (greedy, leveled roster) put both ≈ 2.4× a normal — leaning slightly
    hard, acceptable for optional detours (`warband` is mage-driven by design). Their
    final feel is a playtest call. **Test fix:** post-X3 some normals pool deeper than
    `HEALTH.enemyHealthMax` (highwaymen 10 / deserters 9), so the `winEncounter` test
    helper's one-chip default (8) no longer cleared them → defaulted to clear any pool
    (`resolveTurn` floors `enemyHealth` at 0, so over-chipping is safe).
- **2026-06-27 — §33 the Cluster-1 balance closer: the §29-archetype showcase
  content tuned into band.** Four draft encounters built on the §29 afflicter/
  summoner/chain roster were stabilized (`ce45ca5` — banditQueen's reversed stage
  thresholds fixed 0.33↔0.66 so its middle stage actually runs; catalog-enumeration
  tests updated; the levelCapMigration proof scoped to the 9 pre-migration ids) then
  tuned **encounter-local only** (the user chose NOT to touch the global §31c summon
  scaling — Shaman's math is untouched). Forced-isolation reads (greedy, leveled
  rosters, `--jobs=1`), baseline → final pool-damage/instance:
  - **darkMagicPosse** (normal, shaman flood): **25 → ~6.1**. The dominant lever was
    the fixed shaman counts (count.factor is INERT on an all-`fixed` wave — only
    `weight` units draw from `C`); cut shaman 5→1 / 3→1, corrupter 2→1, `levelBudget`
    1.25→1. At its minimal-content floor it still reads ~2× band — the summon-flood +
    confusion/poison disruption hard-counters the bot's mercenary+ranged duopoly (the
    "hard-for-the-duopoly ≠ hard-by-design" caveat; greedy is a lower bound, so ~6 by
    the bot ≈ ~3–4 by diverse human play). Left as the deliberately-hard "scary" road
    fight — **final feel is a playtest call.**
  - **elementalTrio** (normal): **8.3 → ~2.5**. `count.factor` 1.5→1 all waves +
    catapult 2→1; `levelBudget` 1.25→1 on waves 1–2, kept 1.25 on the ice_mage/catapult
    climax (beefier casters over more bodies, on-theme).
  - **plagueDoctors** (normal): **1.5 → ~3.8** (brought UP) — corrupter 2→3,
    `count.factor` 1.5 (more ghoul fillers).
  - **banditQueen** (boss): **4.5 → ~11.1** (brought UP) — `healthPool` 8→20, matching
    `bandit-king`; reads a touch under king's ~14.4 at the same boss roster, fitting an
    alternate boss. Config + tests only, no snapshot bump; 1403 main + 210 fuzz:smoke
    green. **Pending: the user's playtest + the 33c held-out (`--seed-offset`) verify.**
- **2026-06-27 — §33c the STRATEGY RE-DERIVATION + drift fold-in (the closer's verify;
  `e059574`). User playtested & LOVED.** The §29 draft pool grew **9→18 archetype
  dimensions** since X3 (reaver/corrupter/stormcaller/shaman are `draftable`), so the
  X3-derived optimum was **structurally stale** — its per-archetype strategy vector
  couldn't even express a preference over the new picks (the recruitable-content thread
  the user flagged). Re-derived the optimum (heavy `--search`, jobs=8) on the current
  content:
  - **Run health (in-situ, 120 seeds):** optimum **25.0%** / greedy **10.0%** →
    **+15pt gradient**; smooth funnel (hops 0–9 ≤10% death), boss wall hop 10 **51.6%**
    (X3's 43–55% target). shaman/corrupter/reaver are FAVORED picks; the optimum shifted
    OFF the merc+ranged duopoly to a magic/constitution caster-summoner comp — **none OP**
    (win didn't run away; §31c's summon-OP fear unrealized). **The duopoly DISSOLVED
    rather than re-monocultured** → 33c's "duopoly fold-in" is resolved by the new content;
    no separate tuning.
  - **Drift fold-in (forced-isolation tuning calibrated to the RE-DERIVED optimum —
    greedy-isolation mis-rated elementalTrio 2.5 vs the optimum's 0.5):** isolation
    PDmg/instance baseline → final — elementalTrio 0.5→**2.7**, brigand-champions
    2.1→**6.6** (OLD elite softened by the new optimum), bandit-king 6.4→**10.0** (OLD boss
    softened), banditQueen 11.6→**10.7**, plagueDoctors **3.8** + darkMagicPosse **6.7**
    (the two intentionally-spicy §29 showcases, left slightly hot). Levers: `healthPool` /
    `levelBudget` / `count.factor` (the §33b lesson — `count.factor` inert on all-`fixed`
    waves).
  - **⭐ Isolation vs in-situ (the round that taught the lesson):** optional-detour elites
    + climactic bosses read HOTTER in-situ than isolation (depth-compounding premium,
    X3-consistent — X3's own "elites leaning slightly hard, acceptable"). An in-situ trim
    round chased **small-sample NOISE** (elites appear ~16–31× in-situ vs 60–71× in
    isolation; trims moved nothing reliably) and was **reverted** — tune to the stable
    isolation read, accept the in-situ premium.
  - **Held-out verify (`--seed-offset=5000`):** win **24.2%** + bands hold out-of-sample
    (bosses banditQueen 12.4 / bandit-king 9.2; normals cluster ~2–4), **not seed-overfit.**
  - **The win-rate cost:** optimum win dropped **32.5%→~25%** — the honest consequence of
    folding the soft content UP into band. The bands are correct by construction; a softer
    overall run is the **global difficulty multiplier** (`waveSize`/`levelBudget`) /
    pool-rest economy — a run-level knob OUT of §33's content scope. **User playtested the
    rebalanced content & LOVED it** → no ease applied.
  Config-only (16 value swaps in `encounters.json`, no structural change); no snapshot
  bump. 1406 main + 210 fuzz:smoke green, typecheck clean. **§33 (33a→33b→33c) COMPLETE &
  user-confirmed; ▶ §34 Polish next** (34a double-KO soft-lock / 34b blank ability rows).
- **2026-06-29 — §36d the fuzz re-baseline under non-instant moves (the claim system).**
  Cluster-2 Phase 36 made moves NON-INSTANT (36b: the logical position flips at the 50%
  mark; a unit holds a *claim* on its destination across the open window) — a real
  combat-timing change (when melee connects / when targeting re-reads the still-arriving
  target), so the win-rate baseline gets re-read. **No config touched** since §33c, so this
  is a pure ENGINE delta against §33c's recorded greedy 10.0% (seeds 1–120). Method =
  hold the strategy FIXED (the reproducible `greedy`/`pure-random` baselines; the §33c
  *searched* optimum vector wasn't saved), change only the engine, measure.
  - **Occupancy invariant (§35d) HOLDS across the open claim window** — `assertOccupancy`
    on (no two units share a cell per plane after any tick) across the 12+12-seed committed
    smoke AND a broader 40+40-seed temp corpus (greedy + pure-random, non-instant moves +
    claims live; ~80 full runs, hundreds of thousands of ticks). The load-bearing safety
    property the claim/flip timing could have reopened is clean.
  - **Win rate — NO DETECTABLE SHIFT.** greedy **7.5%** / pure-random **15.8%** (in-sample,
    seeds 1–120) vs greedy **14.2%** / pure-random **11.7%** (held-out, `--seed-offset=5000`),
    **0 hangs** in all four 120-seed runs. The two greedy samples (7.5% / 14.2%) **bracket**
    §33c's 10.0%: a 6.7pt swing between two n=120 samples ⇒ greedy seed-variance is ±~3.5pt
    here, which swamps the in-sample −2.5pt. So the non-instant-move timing produced no
    win-rate move the bot can see (consistent with 36c being provably inert + 36b's flip
    being a subtle timing nudge). **Carried to §41:** the precise melee/ranged
    characterization + any rebalance, which gets the full `--search` re-derivation budget
    (re-saving the optimum vector this round retired). No config change, no snapshot bump;
    1458 main + 212 fuzz:smoke green. **▶ Phase 36 (36a→36d) COMPLETE; §37 Terrain next.**
- **2026-07-04 — §41 the closing balance pass: a documented NO-OP (the Cluster-2 closer).**
  The §35–40 spatial layer (occupancy core / non-instant move timing / terrain mods /
  multi-tile footprints / destructibles) reshaped board control + the to-hit layer, so the
  BALANCE.md loop was re-run scoped to what moved. **No config touched** — a pure ENGINE
  re-baseline like §36d. Method: heavy full-length `--search` (120 vectors / 30 train / 10
  test, jobs=16, ~11 min) re-derived the optimum (re-saved to `best-strategy.json` — §36d had
  retired the vector), then per-encounter / per-hop telemetry gathered UNDER THE FIXED OPTIMUM
  (BALANCE.md step 2 — NOT greedy) in-sample + held-out (`--seed-offset=5000`).
  - **Reproducible anchors — no win-rate shift.** greedy 13.3% (in) / 11.7% (held) ·
    pure-random 14.2% / 10.8% — all inside §36d's ±~3.5pt seed-variance band; balance-config
    unchanged since §36d, so this isolates §37+§39+§40 as balance-neutral. 0 hangs across 480
    runs (the labyrinth 15×15 slow maze did NOT hang).
  - **Optimum in-situ — healthier than §33c.** win **35.0%** (in) / **33.3%** (held) vs §33c
    ~25%; **+22pt** gradient over greedy; boss wall hop-10 death **48% / 42%** — dead-on §33c's
    43–55% design target; early funnel (hops 0–9) ≤9% death. The **§33 caster-summoner
    equilibrium HOLDS** (optimum favors shaman/reaver/ghoul; mercenary −0.83 / ranged −0.81 /
    mage −0.88 disfavored — NO merc+ranged relapse).
  - **The greedy-vs-optimum correction (the round's methodology re-learning of §33c).** The
    FIRST telemetry pass used greedy/pure-random and flagged banditQueen ~12.5 (boss, band ~10)
    + ronin-vs-mages ~5.4 (normal, band ~3). Re-gathered UNDER THE OPTIMUM both softened:
    banditQueen **10.0** on-band (greedy had inflated it ~+2.5 — the §33c "greedy mis-rated
    elementalTrio 2.5 vs the optimum's 0.5" trap). A forced-ISOLATION read of ronin
    (`--encounter=ronin-vs-mages` under the optimum, 642/634 instances) landed **3.4 / 3.4** —
    on the ~3 normal band; the in-situ ~4.25 is the in-situ premium §33c says to ACCEPT.
    bandit-king 9.9/8.1, elites clustered on/under band. **Every flag dissolved → no dial
    tuned.**
  - **Terrain-density content call — settled with data.** The §37 mod tiles are HEAVILY
    exposed, not dormant: the "The Start" pool (13 weight-units) puts ~31% of battles on a
    33–73%-modded map (icebergs 73% / isthmus 58% / desertFortress 57% / fetidPond 33% —
    ice/deep_water/sand/hills/mud), plus procedural's shallow_water. Balance stayed neutral
    anyway because terrain mods are **symmetric** (they apply to whichever unit stands on the
    tile). So the uniform-vs-curve question resolves: **KEEP the clustered authoring** —
    density is flavor, not a balance lever.
  - **Rubble HP (25/60/110, "UNTUNED")** stays a PLAYTEST-feel call — destructibles are too
    rare in natural runs to register in the sweep; out of the fuzz-neutral scope.
  - Docs-only close (BALANCE §41 + HANDOFF/ROADMAP/memory); no config, no snapshot bump; 1677
    main + 212 fuzz:smoke green. **▶ Phase 41 + Cluster 2 (Spatial & Movement) COMPLETE &
    user-confirmed; NEXT = Cluster 3 (Economy).**
- **2026-07-06 — §46b the Pathfinding-Audit closer spot-check: ACCEPT + RE-BASELINE, no
  config change (the ceiling moved, the floor didn't).** The §42–45 movement round
  (bias fixes / WaitAction / vacancy costs / wait-vs-sidestep / stable-route margin)
  shifted battle outcomes — the §45c fuzz probe filed the hint ("greedy runs go deeper"),
  and this scoped re-run of the §41 methodology quantifies it. Method: heavy `--search`
  re-derive (preset=heavy 120/30/10, jobs=16, samplerSeed=1 — the SAME 120 candidates +
  train seeds as §41) → anchors + telemetry UNDER THE FIXED OPTIMUM, in-sample + held-out
  (`--seed-offset=5000`), 120 runs/batch → forced-isolation reads for everything the
  natural tables flagged. **1,440 measured runs, 0 hangs.**
  - **Anchors — the floor is STABLE.** greedy 10.0 (in) / 14.2 (held) vs §41's 13.3/11.7 ·
    pure-random 12.5 / 14.2 vs 14.2/10.8 — all four inside the ±~3.5pt seed-variance band.
  - **The ceiling is NOT — real engine drift, isolated on a fixed strategy.** §41's own
    winning vector, re-run unchanged: win **25.0% (in) / 24.2% (held)** vs its §41 reads
    35.0/33.3 — **−10.0/−9.1pt, consistent across BOTH seed sets** (so not seed noise, and
    the anchors rule out a floor shift). A fresh search over the *identical* candidate pool
    recovers in-sample to **30.8%** but only **22.5%** held-out: best-achievable now reads
    ~31/~24 vs §41's 35/33. Part staleness (§41's vector was tuned to pre-§45 movement),
    part a genuinely harder top end. **Skill gradient stays steep: +20.8pt in-sample**
    (30.8 vs greedy 10.0; §41 +22) — the health metric holds.
  - **Why (the mechanism, briefly):** §45's cooperation is symmetric, but its benefit
    isn't uniform — big melee-heavy teams pushing chokepoints gain the most from queue
    conversion + no-dither lanes, and at the wall that's the ENEMY (boss waves field 7–8
    units vs the player's 6). Fights resolve more decisively; runs go deeper (greedy avg
    hop 7.22, capped draws down); the bot's linear policy finds less edge at the top.
  - **Per-encounter bands — HOLD; the natural-table boss spikes were sample noise.**
    Normals/elites on-band in natural runs (ronin-vs-mages 3.3/4.7 ≈ its accepted in-situ
    premium; elites 4.0–6.3 vs band ≈6). The bosses flagged in natural runs (banditQueen
    12.6/**15.2**, n=37/24) → forced isolation under the fixed optimum (n=79 in / 66 held):
    **bandit-king 10.6/10.4 · banditQueen 11.8/10.3 — ON the ≈10 band** (banditQueen's
    in-sample +1.8 ≈ an in-situ-premium-sized residual, held-out on-band). **No off-band
    encounter → no dial, per protocol.**
  - **Boss wall (hop-10 death): 53% (in) / 59% (held)** vs the 43–55% design target and
    §41's 48/42%. In-sample inside; held-out 4pt above. With both bosses ON-band in
    isolation, the elevation is the weaker-arriving-optimum effect, not boss overweight —
    tuning boss budgets down would push them UNDER band. **Filed as the WATCH ITEM for
    Cluster 3's balance pass** (run-level economy — pool/rest — is the native lever if the
    top end should come back up; re-read the wall there).
  - **The §33 equilibrium HOLDS as a class — and rotated within it.** No merc+ranged
    relapse (new optimum: mercenary −0.26 / mage −0.60 / ronin −0.89 disfavored; ranged
    ~0.1 neutral). But the favored SET moved: §41's reaver/shaman/ghoul → warlock 0.99 /
    ghoul 0.93 / ice_mage 0.89 / corrupter 0.76 / banshee 0.76 / stormcaller 0.70. Same
    candidate pool, same train seeds, different winner — §45 changed which casters shine
    (better lanes reward backline-heavy comps). Content-neutral; noted for Cluster 4
    (Drafting) flavor awareness.
  - **Early funnel ≤9%/hop (hops 0–9), 0 hangs, labyrinth included.** Capped draws 12–23
    per 120 — in family with §41.
  - **VERDICT: the §45 movement layer is balance-ACCEPTED, not balance-neutral** (contrast
    §41's spatial layer, which WAS neutral): every design target holds (bands · gradient ·
    equilibrium-class · funnel · in-sample wall), the one edge-high number (held-out wall
    59%) is filed for Cluster 3, and the §46b readings become the comparison baseline going
    forward (fixed-vector probes: re-run `best-strategy.json` before/after any future
    engine round — the cheapest ceiling-drift instrument this round leaves behind).
    Docs-only close; no config, no snapshot bump.

- **2026-07-09 — §48g the Rewards-phase closer re-baseline: STABLE — the reward economy is
  outcome-neutral at launch numbers (fixed-vector probe flat; anchors within noise).** §48
  is an engine round twice over: two new run-level RNG streams shift every per-encounter
  fork (48b, append-after-daemonRng), and the reward economy itself now grants loot
  daemons mid-run (the harness accept-all policy takes them). Method: the §46b
  fixed-vector doctrine — 4 × 120-run batches (greedy + pure-random anchors · §41's
  winning vector re-run unchanged, in-sample + `--seed-offset=5000` held-out), 480
  measured runs, **0 hangs**, capped draws 11–19/120 (in family).
  - **The fixed-vector probe is FLAT: 25.0% (in) / 25.0% (held) vs §46b's 25.0/24.2** —
    the cheapest ceiling-drift read says the ceiling didn't move. Anchors: greedy 12.5%
    (§46b 10.0) · pure-random 14.2% (§46b 12.5) — both +~2pt, inside the ±~3.5pt
    seed-variance band and directionally consistent with free loot idols.
  - **Why so quiet:** bits have NO spend surface until §50 ports, so the only
    outcome-coupled reward is the daemon drop — elite-gated at chance 0.35 through a
    7-idol table that owned-exclusion thins further. The economy's outcome lever arrives
    with ports; today's rewards are mostly banked potential. (Per-daemon splits shifted
    seat-to-seat as the stream re-alignment re-dealt arms — expected, not signal.)
  - **Natural-table spot reads (greedy, small-n — hints per protocol, not dials):**
    bosses banditQueen 9.1 / bandit-king 9.0 PDmg/inst (≈10 band holds); elites 6.0–10.0
    vs band ≈6 (warband-vanguard's 10.0 at n=18 is the §46b-style natural-run spike —
    forced isolation owns the verdict if §52 cares); normals 2.3–4.5 vs band ≈3.
  - **VERDICT: re-baseline ACCEPTED, no config change.** The 48g batches
    (`tests/fuzz/output/48g-{greedy,random,fixed-in,fixed-held}`) supersede §46b as the
    comparison baseline; the boss-wall watch item (held-out 59% at §46b) stays FILED for
    §52's cluster-closing pass, where `bitsMultiplier` (48f) + ports give run-level
    economy its first real levers.

- **2026-07-10 — §49h the Packets-phase closer sweep: HEALTHY, deliberately light — NOT a
  re-baseline (the 48g batches stay the comparison baseline).** §49's outcome coupling is
  one notch below §48's: every battle stream is untouched (the fire engine is run-level;
  `passIsFinal` is validation-only, the 49d bots were already strict-compliant), and the
  only outcome-coupled config change is reward-table dilution — `daemon-cache`'s daemon
  odds drop 7/8 → 7/11 with the three packet entries (slightly fewer loot idols per
  elite), and `bits-small` stops being a zero-draw singleton (one new `rewardRng` draw per
  sample; isolated stream, reward outcomes only). Packets themselves are OUTCOME-INERT in
  the harness — the fuzz policy accepts-if-room but never fires (the noted future
  fire-policy arm, possible since 49d precisely because pass/fire state is engine-level).
  Method: the standard 20-seed sweep (`npm run fuzz`), not the 480-run fixed-vector
  protocol — proportional to the coupling (the §47-close precedent: no BALANCE entry at
  all; §49 gets the spot read because a table shape DID change).
  - **greedy 20.0% / pure-random 15.0%, 0 hangs, capped draws 2–3/20** — vs the 48g
    n=120 anchors (12.5 / 14.2), inside the n=20 binomial band (±~8pt); no directional
    read at this n, and none sought. The health signals (hangs, caps) are the sweep's
    real payload: both clean.
  - **VERDICT: phase close ACCEPTED, no config change.** Packet drop weights ship rough
    BY DESIGN — §52's cluster-closing pass owns the tuning, with the fire-policy fuzz arm
    as its instrument if packet POWER (not just drop rate) needs measuring; the boss-wall
    watch item stays FILED there too.
