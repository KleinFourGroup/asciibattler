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

## The economy metrics (§52 — defined ahead of the data)

The Cluster-3 metric family, defined at the §52 close so the interstitial's
balance pass measures against a settled vocabulary (no numbers exist yet —
the §52 calibration finding deferred all measurement; see the run log):

- **bits-per-hop** — total bits earned ÷ hops survived; the earn-curve
  signal. Split by source (win bounty vs daemon tally) when provenance
  matters — the 51a labeled portions make that free.
- **spend mix** — fraction of earned bits spent, split by sink (units /
  daemons / packets / removal), plus the **terminal bank** (bits held at
  run end — §50g's "dies holding ~50" read is the founding data point).
- **transaction rate** — fraction of runs that ever buy + purchases/run
  (§50g: ~24% / ~0.4). The transaction-starvation guard: a price read at
  near-zero transactions is not a price read (sweep `path.port` first).

Like win rate, these are STRATEGY-TIER metrics — read them at the anchors
AND the optimum; an earn/spend number quoted without its tier is noise.

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
  **The margin is now QUANTIFIED (§52): ~50pt** — bot optimum ~30% vs human ~80%
  native, localized to battle-layer objective handling. Until the interstitial's
  bot-realism round closes the gap, treat every ABSOLUTE win-rate target as
  bot-anchored (relative reads — gradients, bands, deltas — stay valid).

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

- **2026-07-10 — §50g the Ports-phase closer re-baseline: STABLE — ports + the purchase
  policy are outcome-neutral at anchor level, and the spend surface is BARELY COUPLED in
  bot play (the §52 headline).** §50 is an engine round twice over (Run v33→v35: the port
  node kind regenerates map-kind assignments on some paths — battles → ports — and two new
  port streams append; the 50c 200-seed oracle proved structure/rest/elite/boss placement
  byte-identical, so only kind + streams moved) AND the harness gains its first SPEND
  behavior (the 50g purchase policy: buys daemons → units → packets-if-room, default-on,
  the reward accept-all analog). The 48g CSVs were stale for comparison since 50c; these
  batches supersede them as the comparison baseline. Method: two 120-run anchors
  (`tests/fuzz/output/50g-{greedy,random}`); the FIXED-VECTOR probe is deliberately absent
  — the §41 winning vector's weights file predates the `port` path-weight key and fails
  `loadWeightsFile` (the 50c carry), so the probe re-runs at §52 after `--search`
  regenerates it. New summary.csv columns (appended last): `portPurchases` + `finalBits`.
  - **greedy 12.5% / pure-random 10.8%, 0 hangs, capped draws 25 / 14 per 120** — vs the
    48g anchors 12.5 / 14.2: greedy EXACT, random −3.4pt (inside the ±~3.5pt band).
    Ports replacing some battles + buys changing rosters did not move the anchor ceiling.
  - **The purchase read (the §52 pre-instrumentation earning its keep): only ~24% of runs
    ever buy (29/120 greedy, 28/120 random), ~0.4 purchases/run, and runs die holding
    ~50 bits on average.** Two compounding causes, both named for §52: the scored/greedy
    path weighting carries `port: 0` (ports are optional detours the bots don't seek),
    and prices sit high relative to mid-run bank (~1 daemon ≈ 3–4 normal-win bounties).
    §52 must sweep `path.port` alongside prices + `bitsMultiplier`, or the price read is
    transaction-starved.
  - Per-daemon splits (n=10–25/bucket) remain seat-level noise — no read taken (the 48g
    discipline); the daemon-price spread (50f) gets its verdict from §52's forced arms if
    sought.
  - **VERDICT: re-baseline ACCEPTED, no config change.** Prices ship launch-rough BY
    DESIGN (50a/f); the boss-wall watch item (held-out 59%, §46b) stays FILED for §52,
    which now owns: the fixed-vector regeneration + probe, the `path.port` weight sweep,
    prices + `bitsMultiplier` at the optimum, and the packet fire-policy arm decision.

- **2026-07-11 — §52 the Economy-cluster closer: NO MEASUREMENT RUN — the pass's result
  is a CALIBRATION FINDING about the instrument, not a tuning read on the game.**
  Method: the kickoff code-reality audit + the user's playtest report; zero batches,
  deliberately — a heavy `--search` against the current bot would derive an optimum the
  next round immediately replaces (dead compute), and prices tuned at a fictional
  optimum are fictional prices.
  - **The finding: bot best-achievable ~30% (§46b ~31 in / ~24 held) vs the user's
    native win rate ~80% (self-report, error bars honest) — a ~50pt human–bot gap.**
    Localized by ELIMINATION: the user wins usually without recruiting and without
    daemon mechanics, so the run-level strategy layer isn't the edge — the battle-layer
    objective handling is (J4's static proclivity draw vs closed-loop human control).
  - **The human edge is TRAFFIC MANAGEMENT, not targeting** (user introspection,
    worklog §52): un-jamming melee stuck behind own ranged (fall back → re-sort →
    re-engage), stopping short of hazard terrain, choke holding, the spiral
    opposite-spawn burn cheese (attrition wins without fighting), focus fire mainly as
    cohesion (catapults the one assassination target). The §42–46 round's residual:
    unit-level cooperation is fixed; composition-level traffic is objective-layer work.
  - **The human's ~20% losses are REACTION-TIME cells** (spawn-in-range alpha strikes:
    funnel / adjacent-spiral vs ronin+mages; artillery company on strafing funnel;
    junction ambush) — a loss mode a tick-0 bot is IMMUNE to. Expect per-fixture sign
    flips in paired comparisons; that's signal, not noise.
  - **Consequences:** every ABSOLUTE bot-anchored target — including the boss-wall
    43–55% design target the §46b rider measures against — needs re-derivation once a
    realistic bot exists; RELATIVE reads (gradients, per-encounter bands, before/after
    deltas) remain valid, so the run log's history stands. The bot-lower-bound caveat
    (protocol header) now carries the quantified margin.
  - **The rider: RE-SCOPED, not resolved-by-tuning** — the boss-wall verdict moves to
    the interstitial round's re-anchoring phase, per the §52 charter's own escape
    clause ("resolved or re-scoped"). Alongside it move: the fixed-vector probe
    regeneration, the `path.port` sweep, prices + `bitsMultiplier`, packet drop
    weights, the fire-policy arm, and the expressive economy-strategy design (one
    scored vector; recruit-scorer reuse for port units) — the full agenda: worklog §52.
  - **VERDICT: Cluster 3 closes with economy numbers launch-rough BY DESIGN**, awaiting
    the interstitial's realistic optimum (rung ladder: recorder + gauntlet → reactive
    traffic scripts → gated portfolio rollout search → economy expressiveness → the
    real balance pass). The 50g anchor batches stay the comparison baseline; the
    economy metric family above is defined and waiting for its first data.

- **2026-07-12 — §53e the GAUNTLET bot baseline (micro round, Rung 0). ⚠ SUPERSEDED
  same day as the 53g comparator by §53e.2 below (the STANDARD-ROSTER context);
  this fresh-team table stays as the contrast row (`npm run gauntlet -- --fresh`).**
  Method: `npm run gauntlet` — the 10 shape-locked cells (worklog §53) × 3
  fixed seeds × objective arms `none`/`random`; run-level strategy `greedy`
  (`path:elite` for the elite cell); `daemon=none` (no pre-turn choices — the
  paired-seed contract); each cell a minimal run (`hops=2`; elite `hops=4` —
  a 3-hop map can NEVER host an elite, the scatter min-spacing; seeds
  scan-verified). "cleared" = the target encounter's node was advanced past.
  ⚠ **Context caveat:** cells run vs FRESH seed-rolled default starting
  teams at full pool — easier than the mid-run contexts the killer cells
  were reported in. The paired human read (53g) shares the exact context, so
  the comparison stands; do NOT read these as run-level rates.

  | cell | arm | cleared | draws | deaths | avg ticks |
  |---|---|---|---|---|---|
  | alpha-funnel | none | 3/3 | 0 | 24 | 1635 |
  | alpha-funnel | random | 3/3 | 0 | 32 | 2178 |
  | alpha-spiral | none | 3/3 | 0 | 33 | 834 |
  | alpha-spiral | random | 3/3 | 1 | 40 | 941 |
  | artillery-funnel | none | 3/3 | 0 | 24 | 2606 |
  | artillery-funnel | random | 3/3 | 0 | 13 | 1924 |
  | junction-elite | none | 2/3 | 0 | 57 | 1068 |
  | junction-elite | random | 2/3 | 0 | 68 | 1418 |
  | unjam-corridors | none | 3/3 | 0 | 28 | 1848 |
  | unjam-corridors | random | 3/3 | 0 | 18 | 1748 |
  | fire-edge | none | 3/3 | 1 | 67 | 1861 |
  | fire-edge | random | 3/3 | 0 | 58 | 1784 |
  | choke-isthmus | none | 3/3 | 0 | 8 | 1254 |
  | choke-isthmus | random | 3/3 | 0 | 9 | 1047 |
  | stall-spiral | none | 3/3 | 0 | 10 | 419 |
  | stall-spiral | random | 3/3 | 0 | 23 | 581 |
  | focus-river | none | 3/3 | 0 | 20 | 960 |
  | focus-river | random | 3/3 | 0 | 7 | 556 |
  | boss-fortress | none | 2/3 | 0 | 58 | 1487 |
  | boss-fortress | random | 0/3 | 0 | 80 | 1800 |

  - **Reads:** the bot CLEARS every normal cell 3/3 on both arms — at
    fresh-team strength, cell *clearing* is not the discriminator; the
    discriminating signals are **deaths** (8–68 across cells), **draws**,
    **ticks**, and the elite/boss cells (elite 2/3 both arms; boss `none`
    2/3 vs `random` 0/3 — the only arm gradient, and it points the expected
    direction). The 53g human session reads PAIRED per-cell deltas on these
    same seeds; per-fixture sign flips on the reaction-time cells are
    expected signal (§52).
  - Raw rows: `tests/gauntlet/output/gauntlet.csv` (regenerate:
    `npm run gauntlet -- --csv`); the human-session URL list:
    `npm run gauntlet -- --urls`.

- **2026-07-12 — §53e.2 THE gauntlet bot baseline: the STANDARD mid-run roster +
  pool damage taken as the primary metric (user-locked; supersedes §53e as the
  53g comparator).** The fresh-team context saturated (§53e); the user's real
  context is the default starting comp leveled (~no recruiting): the STANDARD
  ROSTER = 6 mercenary + 4 ranged at levels 7–8 with one ranged 9 ("something
  higher thrown in"), baked into the cells (`tests/gauntlet/cells.ts`) and the
  53g URLs alike — the game's own relative enemy-budget scaling supplies the
  hardness, no fictional difficulty multiplier. **Primary metric = player pool
  damage taken** across the target encounter (telemetry pool chips — the
  established tuning signal, X3-band-comparable: normal≈3 / elite≈6 / boss≈10).
  Known simplification: in <50% of real runs the user recruits a healer/shaman
  (rogues on Laverna runs) — the standard comp stays majority-shape; real comp
  frequencies come from recorded FULL runs later in the round.

  | cell | arm | pool dmg | cleared | draws | deaths | avg ticks |
  |---|---|---|---|---|---|---|
  | alpha-funnel | none | 12.7 | 2/3 | 0 | 41 | 2008 |
  | alpha-funnel | random | 12.0 | 2/3 | 0 | 40 | 2103 |
  | alpha-spiral | none | 8.7 | 3/3 | 0 | 43 | 901 |
  | alpha-spiral | random | 9.3 | 3/3 | 0 | 43 | 955 |
  | artillery-funnel | none | 0.3 | 3/3 | 0 | 12 | 1587 |
  | artillery-funnel | random | 0.0 | 3/3 | 0 | 11 | 1623 |
  | junction-elite | none | 16.3 | 1/3 | 0 | 70 | 1006 |
  | junction-elite | random | 10.7 | 1/3 | 0 | 52 | 903 |
  | unjam-corridors | none | 4.0 | 3/3 | 0 | 34 | 2059 |
  | unjam-corridors | random | 2.3 | 3/3 | 0 | 29 | 2097 |
  | fire-edge | none | 10.7 | 2/3 | 0 | 80 | 2125 |
  | fire-edge | random | 9.0 | 3/3 | 0 | 65 | 1842 |
  | choke-isthmus | none | 0.0 | 3/3 | 0 | 10 | 1090 |
  | choke-isthmus | random | 0.0 | 3/3 | 0 | 8 | 1029 |
  | stall-spiral | none | 4.0 | 3/3 | 0 | 25 | 521 |
  | stall-spiral | random | 2.0 | 3/3 | 0 | 21 | 512 |
  | focus-river | none | 0.0 | 3/3 | 0 | 8 | 468 |
  | focus-river | random | 6.3 | 3/3 | 0 | 27 | 1028 |
  | boss-fortress | none | 19.3 | 0/3 | 0 | 52 | 1294 |
  | boss-fortress | random | 24.7 | 0/3 | 0 | 64 | 1458 |
  | unjam-labyrinth† | none | 0.0 | 3/3 | 0 | 10 | 1660 |
  | unjam-labyrinth† | random | 4.3 | 3/3 | 0 | 33 | 2820 |

  † added 53g-pre (user call, same protocol/roster — worklog §53g-pre): the
  maze variant of unjam, `brigands` × `labyrinth` (seeds 1101–1103) — same
  encounter as `unjam-corridors`, only the layout swapped (a clean layout
  A/B). Read: **labyrinth punishes bad traffic orders more than passivity**
  — the passive arm walks the intentional slow maze clean (0.0, but slow),
  while random objectives bleed (4.3, 33 deaths, ~70% longer battles); the
  inverse of `focus-river`'s arm split. The user reports a distinct human
  strategy here vs corridors — the paired traces should show its shape.

  - **Reads: the gradient is BACK, and it points at the §52 killers.** Pool
    damage spans 0.0–24.7. The named killer cells sit far above band:
    `alpha-funnel` ~12 (4× the normal band), `alpha-spiral` ~9 (3×),
    `junction-elite` 10.7–16.3 (vs elite≈6, and only 1/3 cleared), the boss
    19.3–24.7 (2× boss band, 0/3 cleared). The traffic showcases are mild
    (unjam/stall ~2–4) to zero (choke, focus-none) — consistent with §52's
    localization: the bot survives easy traffic but bleeds where traffic
    management IS the fight. One surprise: `artillery-funnel` collapses to
    ~0.2 at leveled strength — the catapult wave may be a fresh-team-only
    threat (a §57 tuning note, not a gauntlet defect).
  - These arm-labeled rows are the 53g paired comparator: the human plays the
    SAME cells/seeds/roster; the read is per-cell pool-damage deltas + the
    cleared column on the elite/boss cells.

- **2026-07-13 — §53g THE HUMAN BASELINE (the paired-seed session; the ~80%
  self-report RETIRES).** The user played all 11 cells × 3 seeds in the native
  browser over the `--urls` list (standard roster, `daemon=none`, recorder on);
  ingest validated **104/104 unique turns replay byte-identical** (fixture:
  `tests/gauntlet/fixtures/53g-human-traces.json`, era `e5c8a0fd`, guarded by
  `humanFixture.test.ts`). Method: traces joined to cells by worldSeed against
  deterministic bot re-runs of each cell's RunConfig; layout+enemy-composition
  fingerprint fallback where the human's path diverged the RNG (junction 407,
  boss 1003); per-turn pool damage reconstructed from `battle:ended.
  survivorPower` on replay. Bot columns = §53e.2 above.

  | cell | human dmg | bot none | bot random | human cleared | bot cleared (none) | human cmds/enc |
  |---|---|---|---|---|---|---|
  | alpha-funnel | 13.3 | 12.7 | 12.0 | 2/3 | 2/3 | 6.7 |
  | alpha-spiral | 3.3 | 8.7 | 9.3 | 3/3 | 3/3 | 3.0 |
  | artillery-funnel | 1.3 | 0.3 | 0.0 | 3/3 | 3/3 | 8.0 |
  | junction-elite | 6.7† | 16.3 | 10.7 | 2/3 | 1/3 | 5.0 |
  | unjam-corridors | 2.3 | 4.0 | 2.3 | 3/3 | 3/3 | 10.3 |
  | fire-edge | **0.0** | 10.7 | 9.0 | 3/3 | 2/3 | 6.0 |
  | choke-isthmus | 0.0 | 0.0 | 0.0 | 3/3 | 3/3 | 4.0 |
  | stall-spiral | 0.7 | 4.0 | 2.0 | 3/3 | 3/3 | 5.3 |
  | focus-river | 3.3 | 0.0 | 6.3 | 3/3 | 3/3 | 4.7 |
  | unjam-labyrinth | 1.7 | 0.0 | 4.3 | 3/3 | 3/3 | 10.0 |
  | boss-fortress | 23.0‡ | 19.3 | 24.7 | **0/2**‡ | 0/3 | 10.5 |

  † seed 416 recorded as DEFEATED at pool damage 20 (= playerHealthMax): the
  ledger shows 19 across six turns and the user confirmed the seventh, fatal
  turn resolved as a loss but its trace was lost to a fast tab-close.
  ‡ two completed attempts, both full-pool defeats; the third abandoned after
  one lost turn (the user declined to finish: "I don't think it's winnable").

  - **⭐ The headline: the human–bot gap is LOCALIZED, not uniform.** Decisive
    human edge exactly where §52 predicted — the traffic cells: `fire-edge`
    **0.0 vs 10.7** (the round's cleanest single number), `junction-elite`
    6.7 & 2/3 vs 16.3 & 1/3, `alpha-spiral` 3.3 vs 8.7, `stall-spiral` 0.7 vs
    4.0. Near-PARITY on the pure-geometry killer (`alpha-funnel` 13.3 vs 12.7
    — the adjacent-spawn alpha strike kills humans too) and at the boss.
  - **⭐ The boss wall is NOT a bot artifact: the human is 0-for-3.** User
    diagnosis on record (worklog §53g): the mercenary wave alone is brutal,
    and the final stage's mage AoE is unanswerable because the desert sand's
    slow means melee can never close. §57's boss-wall rider verdict must
    treat this as CONTENT tuning, not bot realism — the 43–55% target is
    unreachable by anyone today.
  - **The null-action finding (a §54 design input):** on the slow-terrain
    cells the PASSIVE bot beats the human — `unjam-labyrinth` 0.0 vs 1.7,
    `focus-river` 0.0 vs 3.3 (and §53e.2's labyrinth arm-split showed random
    orders bleeding 4.3). Intervention has negative marginal value there;
    the traffic scripts' arbitration needs "do nothing" as a first-class arm.
  - **Command intensity tracks the traffic cells:** ~10 commands/encounter on
    corridors/labyrinth/boss vs ~3–5 on the rest — the user's clicking
    concentrates exactly where the §54 script families live.
  - **The ~80% self-report retires with credit:** measured 28/30 non-boss
    encounters cleared (93%) and 28/33 overall (85%) — the per-cell rows
    above are the anchor now.
  - ⚠ Caveats on record: the SPIRAL SPAWN SCRAMBLE (user report — spawn
    geometry is seed-rolled, so the spiral cells' why-labels are approximate;
    alpha-spiral 201/203's instant clears were likely non-adjacent spawns
    while 202's LLW/10-dmg was the real alpha geometry); the RING EVICTION
    incident (session + retries overran cap 80 — recovered via the
    mid-session partial export + a 4-URL top-up; protocol for future
    sessions: `clearTraces()` at session start + export mid-session).

- **2026-07-13 — §54 THE PAIRED RE-MEASURE (54i): the five traffic scripts
  vs the passive anchor vs the human, all 11 cells × 3 seeds.** Protocol:
  `npm run gauntlet -- --arms=none,scripts --csv` (the 54i `scripts` arm =
  `trafficScripts: true`, the standard registry in priority order
  terrain-edge hold › unjam › choke hold › cohesion focus › attrition
  stall; greedy strategy, `path:elite` on the elite cell; STANDARD roster;
  CSV: `tests/gauntlet/output/gauntlet.csv`). **The `none` rows reproduce
  §53e.2 EXACTLY — method validity; the anchors stayed frozen through the
  whole build.** Human column = §53g. Residual = scripts − human (negative
  = the bot BEATS the human).

  | cell | human | bot none | bot scripts | Δ vs none | residual |
  |---|---|---|---|---|---|
  | alpha-funnel | 13.3 | 12.7 | 10.7 | −2.0 | **−2.6** |
  | alpha-spiral | 3.3 | 8.7 | 7.3 | −1.4 | +4.0 |
  | artillery-funnel | 1.3 | 0.3 | 1.3 | +1.0 | 0.0 |
  | junction-elite | 6.7 | 16.3 | 18.0 | +1.7 | **+11.3** |
  | unjam-corridors | 2.3 | 4.0 | 3.0 | −1.0 | +0.7 |
  | fire-edge | 0.0 | 10.7 | 7.0 | −3.7 & 3/3 | **+7.0** |
  | choke-isthmus | 0.0 | 0.0 | 0.0 | 0 | 0.0 |
  | stall-spiral | 0.7 | 4.0 | 0.0 | −4.0 | **−0.7** |
  | focus-river | 3.3 | 0.0 | 0.0 | 0 | **−3.3** |
  | unjam-labyrinth | 1.7 | 0.0 | 0.0 | 0 | **−1.7** |
  | boss-fortress | 23.0 | 19.3 | 20.7 | +1.4 | −2.3 |

  - **⭐ The headline: on the six traffic showcases the human–bot gap
    closes ~81%** (none-vs-human 10.7 total → scripts-vs-human 2.0), and
    the scripts bot sits AT-OR-BETTER-THAN-HUMAN on **7 of 11 cells**
    (funnel, artillery, isthmus, stall, river, labyrinth, boss). fire-edge
    — the round's cleanest single number — moves 10.7 → 7.0 with the clear
    going 2/3 → 3/3 and deaths 80 → 55; alpha-spiral deaths drop 43 → 27
    at 30% faster; stall-spiral 4.0 → 0.0 beats the human's 0.7.
  - **⭐ The RESIDUAL — §55's gate input — is concentrated in THREE cells,
    each with an attributed cause on record (worklog §54d–h):**
    `junction-elite` **+11.3** (and +1.7 vs passive — the unjam melee
    fall-back cost in the ambush layout, the one cell the scripts made
    WORSE than doing nothing); `fire-edge` **+7.0** (the human's 0.0 is
    edge-perfection; −1.7 of it is banked as the
    `EDGE_HOLD_APPROACH_STEPS` 3→~5 widening candidate, worklog §54h);
    `alpha-spiral` **+4.0** (jam-management depth). Everything else is
    ≤ +0.7 or bot-better.
  - **Known costs held, on record:** artillery +1.0 vs passive (the 54g
    focus-engage residual); labyrinth deaths 10→14 at +16% ticks, pool
    0.0 HELD (the 54e transient-spike threshold candidate); boss +1.4
    (content wall — the human is 0-for-3 there too, §53g).
  - **§55 framing:** priority + thresholds alone got 81% of the traffic
    gap with a null-discipline record of zero damage-regressions on the
    slow-terrain cells the passive bot already won. What a scoring layer
    must beat is now quantified per cell — and the three residual cells
    are exactly where dumb-deterministic arbitration runs out (junction's
    fall-back-vs-fight tradeoff, fire-edge's edge-perfection, the
    spiral's jam depth).
    **⚠ SUPERSEDED AS THE GATE INPUT by §55-pre below** (user re-framing:
    the gauntlet is the instrument, not the target — the gate question is
    whether the BALANCE TESTER moves toward human-real numbers).

- **2026-07-14 — §55-pre THE FIXED-VECTOR PROBE WITH SCRIPTS: scripts-on
  REGRESSES full-run win rate — the §55 gate re-scoped on this reading.**
  Method: the §46b/§48g fixed-vector doctrine — the §46b winning vector
  re-run unchanged (`55pre-vector.json` = `best-strategy.json` + a neutral
  `path.port: 0` patch; the saved vector predates §50 ports — schema
  requires the axis now; ⚠ the vector is STALE wrt the §49–52 economy, so
  absolute levels aren't §48g-comparable — the OFF arms are the new
  baseline, the ON−OFF delta is the read), 120 runs/arm, full length,
  in-sample (seeds 1–120) + held-out (`--seed-offset=5000`), greedy
  anchors; scripts arm = the new fuzz `--scripts` flag (run-mode only).

  | arm | scripts OFF | scripts ON | Δ win rate |
  |---|---|---|---|
  | fixed vector, in-sample | 27.5% (avgHop 8.03) | 24.2% (7.05) | **−3.3** |
  | fixed vector, held-out | 38.3% (8.04) | 23.3% (7.45) | **−15.0** |
  | greedy, in-sample | 12.5% (7.45) | 10.8% (6.40) | **−1.7** |

  Paired per-seed (same seeds, on-vs-off): fixed-in 22 win→loss / 18
  loss→win · fixed-held 30/12 · greedy 15/13; hop-down ≫ hop-up in all
  three. Terminal-reach drops ~11pt per pairing.

  Per-layout localization (fixed-in pair, per-wave player win rate,
  off → on): **fetidPond 78.5→61.8 (−16.7)** · **spiralFireLife
  67.2→54.7 (−12.5)** · **desertFortress 76.5→66.1 (−10.4)** · labyrinth
  −6.5 · junctionAmbush −5.1 · procedural −2.0 · river −1.0 ·
  strafingFunnel +2.4 · isthmus +2.9 · endlessCorridors +3.8 · icebergs
  +6.8 · rubbleQuarry +8.7.

  - **⭐ The headline: the gauntlet's positive signs GENERALIZE where it
    sampled (corridors/isthmus/funnel all positive in the wild) — but the
    distribution contains failure modes the gauntlet structurally could
    not see,** and they outweigh the wins:
    1. **fetidPond (−16.7): mud read as fire-grade hazard.** 74 mud cells
       on 15×15, zero fire; mud's on-enter poison makes `isHazardKind`
       true, so terrain-edge hold rallies at puddle edges instead of
       crossing. The scripts were calibrated ENTIRELY on fire; the
       gauntlet never sampled this layout (excluded as strays at §54c).
       → 55a: hazard severity.
    2. **desertFortress (−10.4): the §54 table's one scripts-worse-than-
       passive row (+1.4) was DISCOUNTED because the human loses that
       cell too — but in full runs the boss is the last gate of every
       win: 8 of the fixed-in pair's 22 win→loss flips died at hop 10.**
       → 55b attribution.
    3. **spiralFireLife (−12.5) FLIPS SIGN vs the gauntlet** (all three
       gauntlet spiral cells improved) — the gauntlet ran 2-hop
       fresh-STANDARD-roster daemon-none contexts; full runs hit spirals
       with recruited comps, active daemons, attrition-worn rosters.
       → 55b attribution.
  - **The verdict that re-scoped §55 (user, 2026-07-14):** rollouts on
    mis-calibrated primitives optimize the wrong thing — portfolio search
    PARKED; §55 = the distribution-generalization arc (gate/threshold
    fixes only, cutoff + decision rules in ROADMAP §55). The re-probe
    (55d) re-runs THIS protocol on the same seeds; scripts-on must beat
    scripts-off on both seed sets to become the balance-tester default.
  - ⚠ On record: the OFF arms' in-vs-held spread (27.5 vs 38.3) is wide —
    seed-set variance at 120 runs is real; the paired same-seed deltas +
    the layout attribution carry the finding, not the absolute levels.

- **2026-07-14 — §55 THE VERDICT: NO (the §46a shape) — the scripts do not
  robustly improve full-run realism; the PASSIVE bot remains the balance
  anchor and `--scripts` stays opt-in.** The distribution-generalization
  arc ran its full course (55a barrier split · 55b attributions · 55c1
  prey-in-force · 55c2 threshold sweep = documented no-change) and 55d
  re-ran the §55-pre protocol on the same seeds (off arms reused —
  scripts-off is code-untouched; the on-in batch reproduced the working
  state BYTE-IDENTICALLY):

  | arm | OFF | ON (final) | Δ |
  |---|---|---|---|
  | fixed vector, in-sample | 27.5% | 29.2% | +1.7 |
  | fixed vector, held-out | 38.3% | 24.2% | **−14.2** |
  | greedy, in-sample | 12.5% | 13.3% | +0.8 |

  **The decision rule (ROADMAP §55, binding): beat scripts-off on BOTH
  seed sets → the held-out arm fails decisively.** Caveats on record, not
  verdict-changing: the off-held 38.3% is an anomalously hot seed set
  (in-sample sibling 27.5); the 55c variant selection iterated on the
  in-sample seeds, so part of the +5.0 in-sample recovery (24.2→29.2) is
  selection overfit by construction — the held-out transfer was +0.9.
  - **What the arc bought anyway:** scripts-on at its final state is
    strictly better than at §54 close everywhere measured (gauntlet
    fire-edge 7.0→5.7 with all other cells held-or-better; fetidPond
    61.8→72.9 per-wave; natural in-sample 24.2→29.2) — the OPT-IN scripts
    arm is now the most human-real CELL-LEVEL instrument we have, and
    stays available for §57 cell-scale work. The full-run anchor stays
    passive.
  - **The named residuals (all measured, none buildable within the §55
    scope rules):** deserters/fleers vs edge-hold (~50% loss vs passive
    21% in the forced-spiral isolate under every prey variant — separating
    committed attackers from fleers is INTENT detection, a new sensor
    family = the cutoff bell); unjam's mid-fight rallies at the boss/
    junction (a trigger cannot separate them from unjam's
    distribution-wide value — 0.25/0.30 collapsed the natural probe
    29.2→15.8; contact gate falsified); seed-set sensitivity of the
    scripts arm itself (29.2 in vs 24.2 held).
  - **Doctrine unchanged:** the §52 calibration finding stands — the
    human–bot gap remains ~50pt on full runs, bot-anchored ABSOLUTE
    targets remain fiction, RELATIVE reads (gradients, bands, deltas)
    govern §57's balance pass, exactly as §52 prescribed.

- **2026-07-13 — §54c TRACE MINING: sensor values at the human's command
  moments (the trigger-threshold table for 54d–54h).** Method: `npm run
  trace-mine` — replay the 53g fixture (era `e5c8a0fd`) through the 54b
  sensors via `replayTrace`'s observation hook, sampling every tick;
  cell join reproduces the 53g ingest (worldSeed anchors from 33
  deterministic bot re-runs; layout+enemy-multiset fallback). Joined
  76/104 traces (59 seed + 17 fingerprint); 17 off-target correctly
  excluded; 11 unjoined-excluded (mostly non-cell strays — fetidPond /
  procedural warm-ups — plus the known junction-407/boss-1003 divergence
  tail). Full 197-command dump:
  `tests/gauntlet/output/trace-mine-commands.csv` (regenerate:
  `npm run trace-mine`).

  Condensed contrast (bg mean → mean at the human's commands), the
  load-bearing rows:

  | cell | cmds (mix) | jamCount | jamFrac | hazApproach | powerΔ | enemyDot |
  |---|---|---|---|---|---|---|
  | alpha-funnel | 20 (engage:enemy 12 / :tile 8) | 0.01→0.50 | 0.00→0.08 | 0 | −1.6→−1.4 | 0 |
  | alpha-spiral | 9 (:tile 6) | 0.77→1.67 | 0.13→0.28 | 3.9→4.8 | 1.5→3.2 | 1.5 |
  | unjam-corridors | 23 (:tile 13 / :enemy 10) | 0.13→0.13 | 0.03→0.03 | 0 | 0.9→1.6 | 0 |
  | unjam-labyrinth | 30 (:tile 14 / :neutral 9) | 0.16→0.50 | 0.03→0.09 | 0 | 0.0→−0.6 | 0 |
  | fire-edge | 18 (:tile 15!) | 0.93→1.44 | 0.17→0.25 | 3.9→3.9 | 1.4→1.1 | 3.2→2.0 |
  | choke-isthmus | 12 (:tile 7 / clear 3 / hold 2) | 0.25→0.17 | — | 0 | 2.7→0.8 | 0 |
  | stall-spiral | 16 (:tile 10 / clear 3) | 0.91→1.69 | 0.16→0.29 | 3.6→4.3 | 2.1→1.9 | 2.0→1.6 |
  | focus-river | 10 (:enemy 7) | 0.05→0 | — | 0 | 2.5→2.3 | 0 |
  | boss-fortress | 17 (mixed + clear 4) | 0 | — | 0 | −5.0→−8.3 | 0 |

  - **⭐ `engage:tile` is the human's workhorse** (~55% of all 197
    commands; 15/18 on fire-edge, 13/23 on corridors) — the scripts
    should steer by RALLY TILES, exactly what the four-mode vocabulary
    already expresses. `hold` is RARE (3 uses total) — the human "holds"
    by rallying short, not by the hold mode.
  - **Jam lift is real where jams form** (alpha-spiral 0.77→1.67,
    stall 0.91→1.69, fire-edge 0.93→1.44, labyrinth 3× lift) — but
    **unjam-corridors shows NO lift (0.13→0.13): the corridors human
    plays PREVENTIVELY**, re-sorting with rally tiles before jams
    register. 54e design input: a reactive jamCount≥1 trigger
    under-fires on corridors; trigger shape ≈ jamFraction ≥ ~0.2
    (fires on the spiral/fire/stall cells' command levels, stays silent
    on labyrinth background 0.03 — the null-discipline read).
  - **fire cells: hazardApproach is a STANDING condition (~3.9 bg),
    not a spike** — the human manages the edge continuously (15
    engage:tile). 54d's trigger = hazardApproach ≥ 1-2; the script's
    value is the PROPOSAL (hold units at a computed pre-hazard edge
    tile), not trigger timing.
  - **⚠ SENSOR GAP: `chokeCells` reads ZERO on choke-isthmus** (bg max
    0 for both choke columns) — the isthmus "land bridge" is ≥2 cells
    wide, so it has NO articulation points; labyrinth's 1-wide
    corridors read fine (playerOnChoke bg 3.5). 54f needs a width-
    tolerant choke definition (bottleneck/min-cut generalization) or a
    different trigger entirely — decided at 54f, on record here.
  - **stall-spiral: the burn cheese is measurable** — enemyDot bg 2.0
    with powerΔ ≈ +2: enemies burn while the human refuses engagement
    (10 rally tiles + 3 clears). 54h trigger shape ≈ enemyDot ≥ 1 ∧
    powerΔ ≥ 0 → disengage/rally-away.
  - **boss confirms content** (powerΔ bg −5.0, commands at −8.3 — the
    human commands hardest while already losing); alpha-funnel commands
    are the opening scramble (jam 0.01→0.50 in the first ticks).

- **2026-07-15 — §56d THE FULL RE-BASELINE: the swap engine (56a–56c2)
  measured at distribution level — the ceiling MOVED UP on every arm.**
  §56 changed the movement engine (role-order swap-through · flee-swap ·
  the 56c2 two-sided protocol: deferred flip / pre-flip partner reserve /
  ranged YIELD at score 12 / swap-before-sidestep); every gate stayed
  quiet through the build because the pathing fixtures are same-role.
  This entry is the deliberate read. Movement-quality tables:
  [PATHING.md](PATHING.md) §56d (fixtures byte-identical → NO re-pins;
  `yield_swap` live at last-resort mass; labyrinth doctrine intact).

  **The fixed-vector probe (§46b/§55-pre protocol, `55pre-vector.json`,
  120 runs/arm, scripts OFF — the passive anchor; comparators = the §55
  OFF arms on the same seeds/vector):**

  | arm | §55 OFF (pre-swap) | §56d (post-swap) | Δ win rate |
  |---|---|---|---|
  | fixed vector, in-sample | 27.5% (avgHop 8.03) | 40.0% (8.32) | **+12.5** |
  | fixed vector, held-out | 38.3% (8.04) | 40.8% (7.84) | **+2.5** |
  | greedy, in-sample | 12.5% (7.45) | 19.2% (7.38) | **+6.7** |

  All three arms UP, hangs 0 everywhere (also 0 across the 20-seed
  default sweep — no new deadlock mode). ⭐ **The §55 in-vs-held spread
  COLLAPSED** (27.5/38.3 → 40.0/40.8): what read as "an anomalously hot
  held-out seed set" at §55 was substantially traffic-jam variance the
  sorting effect smoothed out. ⚠ The §55-pre vector-staleness caveat
  carries: absolute levels aren't §48g-comparable; the pre/post delta on
  the SAME vector+seeds is the read. Outputs: `tests/fuzz/output/56d-*`.

  **The gauntlet board (all 11 cells × 3 seeds × none/random/scripts;
  STANDARD roster, pool damage taken; comparators = §53e.2 none/random +
  §54i/§55-final scripts; CSV refreshed):** ⚠ the none rows NO LONGER
  reproduce §53e.2 — that is the measurement, not a validity break: the
  engine changed, and **this board supersedes §53e.2/§54i as the cell
  anchor for §57+.**

  | cell | none 53e.2→56d | random 53e.2→56d | scripts 54i/55→56d |
  |---|---|---|---|
  | alpha-funnel | 12.7→10.0 | 12.0→10.0 (2/3→3/3) | 10.7→8.0 |
  | alpha-spiral | 8.7→10.7 ⚠ (3/3→2/3) | 9.3→12.0 ⚠ (3/3→2/3) | 7.3→13.3 ⚠ |
  | artillery-funnel | 0.3→4.3 ⚠ | 0.0→2.0 | 1.3→4.0 |
  | junction-elite | 16.3→14.0 | 10.7→10.0 (1/3→2/3) | 18.0→14.0 |
  | unjam-corridors | 4.0→2.7 | 2.3→0.7 | 3.0→4.3 |
  | fire-edge | 10.7→9.3 (2/3→3/3) | 9.0→13.3 ⚠ (3/3→2/3) | 5.7→8.0 ⚠ |
  | choke-isthmus | 0.0→0.0 | 0.0→0.0 | 0.0→0.0 |
  | stall-spiral | 4.0→3.3 | 2.0→2.0 | 0.0→0.0 |
  | focus-river | 0.0→0.0 | 6.3→6.3 | 0.0→0.0 |
  | unjam-labyrinth | 0.0→0.0 (ticks −29%, deaths 10→5) | 4.3→0.0 ⭐ (deaths 33→12) | 0.0→0.0 |
  | boss-fortress | 19.3→20.0 (0/3) | 24.7→20.7 (0/3) | 20.7→20.0 (0/3) |

  - **⭐ The traffic cells improve SCRIPT-FREE — the swap engine does part
    of unjam's job passively.** unjam-labyrinth random 4.3→0.0 with
    deaths 33→12 (the §53g-pre "labyrinth punishes bad traffic orders"
    read has softened — the maze self-sorts); the none arm crosses it
    29% faster (1660→1177 ticks, deaths 10→5); unjam-corridors down on
    both non-script arms; junction-elite better on ALL arms (scripts
    18.0→14.0 — §54's one made-it-worse cell is off that list; random
    now clears 2/3).
  - **⚠ The spiral cells regress on the board** (alpha-spiral up on all
    three arms, two clears slip 3/3→2/3; scripts 7.3→13.3 is the worst)
    — while spiralFireLife IMPROVES in full runs (per-wave 67.2→70.4 on
    the fixed-in pair; §55-pre's other named layouts: desertFortress
    76.5→80.8, fetidPond 78.5→70.6 with the survivor-composition
    confound — runs live longer, deeper waves enter the sample). This is
    the §55 cell-Goodhart shape with the sign REVERSED, and the doctrine
    holds unchanged: **the cell board never arbitrates global tuning —
    the full-run anchor governs, and it is up.** The spiral cell rows +
    the fire-edge scripts drift (5.7→8.0: edge-hold was calibrated on
    pre-swap movement) go on record as §57/§58 inputs, not §56 actions.
  - **artillery-funnel none 0.3→4.3:** the §53e.2 "fresh-team-only
    threat?" note re-opens — faster front arrival re-exposes the
    catapult wave (ticks 1587→2006). At-band for a normal (≈3), filed
    for §57.
  - **Boss wall unchanged** (~20, 0/3 on every arm) — the content wall
    stands exactly as §52 diagnosed; §60 owns the verdict. Gradient
    intact: 0.0–20.7 span, killers still killers.

- **2026-07-15 — §56e-pre RE-MEASURE: the full-window partner reserve — the
  fixed arms give back part of the 56d ceiling gain; the read is SOFT and
  the verdict rides the user's 56e close.** The 56e feel test caught a
  mid-window partner re-grab (the 56c2 reserve released at the FLIP);
  56e-pre (`880901e`) extends it to the whole window — the designed
  semantics (the swap is the partner's action too). Same battery, same
  protocol; movement tables: [PATHING.md](PATHING.md) §56e-pre (fixtures
  byte-identical AGAIN → no re-pins; all gates held).

  | arm | §55 OFF | 56d half-window | 56e-pre full-window |
  |---|---|---|---|
  | fixed vector, in-sample | 27.5% | 40.0% | 33.3% (8.50) |
  | fixed vector, held-out | 38.3% | 40.8% | 30.8% (8.03) |
  | greedy, in-sample | 12.5% | 19.2% | 18.3% (7.78) |

  - **Paired same-seed vs 56d:** fixed-in 29 win→loss / 21 loss→win ·
    fixed-held 32/20 · **~42% of seeds flip outcome entirely** — the nets
    (−8/−12 runs) ride on churn; sign tests are individually borderline
    (p≈0.32 / 0.12, jointly ≈0.06). Directionally consistent, statistically
    soft. Greedy −0.8 = noise. Hangs 0 on all arms + the 20-seed sweep.
  - **vs PRE-SWAP:** +5.8 in-sample / +5.8 greedy / −7.5 held-out — the
    engine's gain survives on two of three arms; held-out was §55's
    flagged-hot seed set (38.3). The 56d spread-collapse SURVIVES
    (33.3/30.8 stay tight) — the LEVEL dropped, not the stability.
  - **Probable mechanism (symmetric rule, asymmetric benefit — the §46b
    shape):** attackers push through terrain and therefore swap more; the
    reserve taxes each swap up to a half-window of partner tempo, so the
    pushing side pays more. Consistent with capped draws 12→15 (in) and
    avg ticks +2–5%.
  - **The 56e-pre gauntlet board (CSV refreshed):** volatile in both
    directions at 3-seed granularity — better: artillery-funnel none
    4.3→0.0 · unjam-corridors none 2.7→0.0 · alpha-funnel random 10.0→7.3;
    worse: alpha-spiral all arms → 14.0–14.7 (clears 1/3 across) ·
    junction-elite +3 · unjam-labyrinth none/random 0.0→2.0/3.3. Boss flat
    (~21, 0/3). Doctrine: cells never arbitrate — the probe carries the
    read; the spiral row stays a §57/§58 input either way.
  - **On record, not re-litigated here:** the full-window semantics is the
    USER'S design ruling (correctness + the visible mid-lerp grab); the
    probe is an INSTRUMENT (§52 — bot-anchored absolutes are fiction).
    Whether the ceiling cost changes anything is the user's 56e call; §57's
    re-ask gate re-runs this protocol and accumulates the evidence.

- **2026-07-16 — §57-GATE (the re-ask): static scripts lose-or-tie on ALL
  FOUR pairings post-swap; the −14.2 pathology is GONE but nothing beats
  OFF; unjam = post-swap dead weight; spiral = the lone repeated villain.**
  Method: the §55-pre protocol on the post-swap engine (`55pre-vector.json`,
  120 runs/arm, `--per-layout`), widened per the reopen with a THIRD seed
  set (`--seed-offset=10000`) so no verdict carries the hot-seed asterisk.
  **Determinism spot-check first (the 55d precedent):** the OFF fixed-in
  arm re-run at HEAD reproduced `56e-pre-fixed-in` BYTE-IDENTICALLY (all
  three CSVs) — the 56e-pre anchors are valid, and 56e-pre2's
  "event-emission-only, no outcome change" claim is proven at distribution
  scale, not just asserted. Scripts ran AS-IS (§55-final state; the kickoff
  staleness caveat applies — a regression reads "stale static scripts
  regress," NOT "scripts are worthless").

  | arm | scripts OFF | scripts ON | Δ win rate |
  |---|---|---|---|
  | fixed vector, in-sample (1–120) | 33.3% | 30.8% | −2.5 |
  | fixed vector, held-out (5001–5120) | 30.8% | 30.0% | −0.8 |
  | fixed vector, third (10001–10120) | 37.5% | 33.3% | −4.2 |
  | greedy, in-sample | 18.3% | 18.3% | 0.0 |

  Paired same-seed flips (win→loss / loss→win): 29/26 · 22/21 · 27/22 ·
  16/16 — near-symmetric churn everywhere (§55's held-out was 30/12,
  systematically negative; that pathology did not survive the swap engine).
  Hangs 0 on every arm.
  - **The unjam leave-one-out (fixed-in, the new `--scripts=<spec>` CLI
    seam):** minus-unjam **32.5%** (≈ the OFF 33.3) · only-unjam **31.7%**
    (worse than nothing). The 55b shape, inverted by the engine: unjam
    carried most layouts pre-swap (55c2); post-swap it is dead weight —
    the engine self-sorts (56d's "does part of unjam's job passively"
    prediction, now measured). The other four scripts together ≈ −0.8.
  - **Per-layout: spiralFireLife is negative in ALL FOUR pairings**
    (−9.2 / −2.9 / −9.8 / −14.4) — the deserters/edge-hold residual (55b,
    55c1's cutoff bell) is THE surviving named failure. The old villains
    resolved: desertFortress +4.6 in-sample (unjam's boss harm gone with
    unjam's value); fetidPond flat everywhere (the 55a barrier split
    holding). Other negatives (labyrinth/icebergs on fixed-in) do NOT
    replicate across seed sets — churn, not signal.
  - **The gate read for the STOP (user verdict pending):** static
    triggers don't flip the default on the new engine either — the §55 NO
    generalizes, now on three seed sets. The residual persists (bot 33–37%
    vs the human ~80% class); the question this phase exists to measure —
    rollout ARBITRATION (triggers demoted to nomination, the null-arm
    floor) — remains unmeasured. NO-BUILD-outcome (a)/(b) conditions did
    not materialize; outcome (c) BUILD is the assistant read. ⚠ OFF
    absolute levels span 30.8–37.5 across seed sets — the §55-pre
    seed-variance note stands; deltas carry the finding.

- **2026-07-17 — §57g.1 THE SEARCHER'S FIRST MEASUREMENT: fixed-in 36.7%
  vs OFF 33.3 (+3.4) and static scripts ON 30.8 (+5.9) — the first arm
  EVER to beat passive in-sample on this engine; the static-scripts
  spiral harm is GONE under arbitration.** Protocol: the §57-gate shape —
  55pre vector (as of this arm the COMMITTED fixture
  [tests/fuzz/fixtures/55pre-vector.json](tests/fuzz/fixtures/55pre-vector.json);
  byte-identical to the output/ scratch copy), seeds 1–120, `--searcher`
  at the v2 default dials (H=8s · K=2 · cadence 4s · ε=0.25),
  `--per-layout`. Hangs 0. Output: `tests/fuzz/output/57g-searcher-fixed-in`.
  - **Paired same-seed flips vs OFF: 21 win→loss / 25 loss→win, net +4**
    — direction positive, individually soft (the familiar churn-heavy
    shape); the BINDING read is 57h's three-set rule, not this arm.
  - **Per-layout (per-wave win-rate deltas vs OFF): spiralFireLife −0.2**
    — static scripts scored −9.2 here; the searcher ELIMINATES the harm
    (the deserters pathology doesn't survive nomination→rollout→null-floor)
    but does not yet improve the layout — the 57g threat-exposure scoring
    arm keeps its target. Gains concentrate in the contested-crossing
    traffic layouts: **river +6.2 · isthmus +5.8**. New watch rows:
    rubbleQuarry −6.4 · desertFortress −4.3.
  - **⚠ Capped draws 15→24 vs OFF** — the ties→NULL hysteresis floor may
    be leaving wins on the table as draws; filed as a 57g ε/dial input.
  - **The greedy companion: 30.8% vs OFF 18.3 — +12.5, the largest delta
    any arm has ever posted** (static scripts moved this row 0.0). Paired
    13 win→loss / 28 loss→win, net +15, **p≈0.02 — the round's first
    individually-significant paired read.** The shape: searcher value
    GROWS as the surrounding run-policy weakens (+3.4 tuned vector /
    +12.5 greedy) — in-battle arbitration compensates for bad recruiting,
    consistent with the §52 human-gap read (humans have both). Output:
    `tests/fuzz/output/57g-searcher-greedy-in`.

- **2026-07-18 — §57g.4 THE AUDITION-EVERYONE A/B: 57.5% — audition
  nomination beats trigger-gated nomination by +20.8 and passive by +24.2;
  both paired reads individually significant. The §57c v1 nomination lock
  (nominate = evaluate) was the binding constraint on the whole searcher.**
  Protocol: same §57g.1 shape (fixture vector, seeds 1–120, v2 dials),
  `--searcher --audition`, `--jobs=8` ON THE BOX via box-batch.sh (batch
  `20260718-010409-9927b41`, 18 min wall — the audition cost fear did not
  materialize; summary sha256 4d273a18). Hangs 0. Fetched:
  `output/box-batches/20260718-010409-9927b41`.
  - **Paired same-seed flips: vs trigger-gated searcher 14 win→loss /
    39 loss→win (net +25, p≈0.0006); vs OFF 15/44 (net +29, p≈0.0002)**
    — not churn; the first LARGE paired effects of the round.
  - The read: rollout arbitration was never the bottleneck — CANDIDATE
    SUPPLY was. Trigger-gated nomination starved the search (the §57-gate
    scripts lose-or-tie shape reached the nomination channel too); with
    thresholds stripped, the null-floor does the deciding job the
    thresholds were badly approximating.
  - ⚠ IN-SAMPLE ONLY (57g contamination discipline). Consequence for 57h,
    ON RECORD BEFORE any held-out contact: the audition searcher is now
    the NAMED CANDIDATE DEFAULT for the pre-registered three-set close.
  - ⚠ Per-layout not captured (`--jobs` bails on `--per-*`); the spiral/
    artillery diagnostics re-run serial if the 57g.6 scoring arm needs them.

- **2026-07-18 — §57h THE PRE-REGISTERED CLOSE: VERDICT YES ON ALL
  THREE SETS — the audition searcher beats passive everywhere, and the
  held-out sets beat IN-SAMPLE (the anti-overfit signature; the §55
  pathology's mirror image).** Protocol exactly as pre-registered
  (worklog §57h, written before the K read): candidate = audition
  searcher at v2 dials + K=2 (user-locked); OFF anchors re-validated
  byte-identical at HEAD (seed-1 check); both arms box `--jobs=8`.
  | set | OFF | audition | Δ | paired (w→l / l→w) |
  |---|---|---|---|---|
  | in-sample 1–120 | 33.3 | 57.5 | +24.2 | 15/44 (p≈2e-4) |
  | held-out 5001+ | 30.8 | **60.8** | **+30.0** | **11/47 (p≈2e-6)** |
  | third 10001+ | 37.5 | **60.0** | **+22.5** | 12/39 (p≈2e-4) |
  Hashes: held 7afc9ffb · third bf32973b (fetched
  `output/box-batches/20260718-23*-e6f4e34`). **Consequence, per the
  pre-registered rule: the audition searcher IS the default realistic-
  bot arm** — the §55 "passive = anchor" NO stands for the FROZEN
  anchors (they remain the comparison floor), but skill-anchored
  balance reads from §58 on use the searcher. ⭐ Calibration: bot ~60%
  vs human ~80% — the §52 ~50pt gap is now ~20pts; absolute bot-
  anchored targets remain fiction, but the fiction is half as tall. (K=8 prefix instrument,
  box serial ~9.7h, batch `20260718-131436-402b3ea`, summary 3aecf834):
  K=2 disagrees with K=8 on 9.5% of SEARCH decisions (1,325/13,928;
  K=4: 5.8%) — and on ZERO of the outcomes: 57.5% both arms, paired
  22/22, perfectly symmetric.** The §57c low-regret prediction measured:
  prefix disagreements concentrate on near-tie decisions; shared-luck
  K=2 already ranks meaningfully-different candidates correctly. The
  knife-edge coverage fear is dismissed at distribution scale.
  **Recommendation: LOCK K=2** (4× cheaper searches, no measurable
  cost); candidate config unchanged ⟹ per the pre-registered §57h
  protocol the existing in-sample audition arm STANDS. Hangs 0, capped
  draws 14. Output: `output/box-batches/20260718-131436-402b3ea`
  (k-flips.csv = per-run counters).

- **2026-07-18 — §57g.4b THE AUDITION CELL BOARD (11 cells × 3 seeds,
  `--arms=audition`): a clean sweep — equal-or-better than the
  trigger-gated searcher on EVERY cell; SIX cells at 0.0 pool; fire-edge
  0.0 = THE HUMAN'S NUMBER (the §53g original gap, human 0.0 vs bot 10.7,
  closed outright); the artillery-funnel blemish GONE (3.3→0.0).**
  | cell | none | searcher | audition |
  |---|---|---|---|
  | alpha-spiral | 14.7 (1/3) | 7.3 (2/3) | **6.7 (3/3)** |
  | fire-edge | 9.7 | 3.0 | **0.0 (3/3)** |
  | artillery-funnel | 0.0 | 3.3 ⚠ | **0.0 (3/3)** |
  | stall-spiral | 4.7 | 0.7 | **0.0** |
  | unjam-labyrinth | 2.0 | 1.3 | **0.0** |
  | alpha-funnel | 12.7 | 10.7 | **8.7** |
  | junction-elite | 17.3 (1/3) | 15.7 (1/3) | 15.0 (1/3) |
  | boss-fortress | 21.3 (0/3) | 17.3 (1/3) | **16.0 (1/3)** |
  (corridors/isthmus/river all 0.0 across.) Caveats standing: 3 seeds,
  cells never arbitrate. 57g.6 consequence: the threat-exposure term's
  designated spiral target has largely dissolved under candidate supply —
  the term must earn its slot against THIS board; the full-run
  `--per-layout` audition read is the gate evidence (running).

- **2026-07-18 — §57g.4c THE AUDITION PER-LAYOUT READ (serial local,
  `--per-layout`; summary.csv **4d273a18** = BYTE-IDENTICAL to the box
  jobs=8 batch — machine × parallelism × telemetry parity in one hash):
  spiralFireLife INVERTS to +12.2 — the deserters residual is not merely
  neutralized but a STRENGTH; both trigger-gated watch rows resolve.**
  Per-wave win-rate deltas vs OFF: rubbleQuarry **+16.1** (was −6.4 ⚠) ·
  isthmus +15.7 · fetidPond +12.7 · icebergs/spiralFireLife +12.2 ·
  desertFortress +0.4 (was −4.3) · negatives small: junctionAmbush −4.4
  (filed as a §58 threat-read input) · strafingFunnel −2.4. Aggregates:
  win 57.5%, avg hop 9.07 (audition runs go DEEP — the serial batch runs
  ~3× the trigger-gated wall clock, ~85 min), capped draws 18 (OFF 15 /
  trigger-gated 24 — the ε floor is NOT eating wins; the ε arm is
  deprioritized to optional). Output:
  `tests/fuzz/output/57g-audition-fixed-in-perlayout`.
  - **§57g.6 GATE RECOMMENDATION (assistant; decision = user's):** close
    the threat-exposure scoring investigation as MEASURED-UNNECESSARY.
    The term's designated target (spiral: "material says hold, right
    answer is advance") is +12.2 with 3/3 cell clears under candidate
    supply alone; a λ-term must earn its slot against THIS board, and
    the λ-at-scale risk (§57c: systematic bias, amplified confidently)
    now buys nothing measurable. Quiescence stays parked as designed.

- **2026-07-17 — §57g.3 THE SEARCHER CELL BOARD (all 11 cells × 3 seeds,
  `--arms=searcher`, vs the stored §56e-pre board): the boss wall CRACKS
  — the first boss clear by ANY bot arm since §52 (1/3 at pool 17.3;
  every prior arm 0/3 at ~21) — and the spiral watch row breaks open.**
  CSV refreshed (56e-pre board preserved at `gauntlet-56e-pre.csv`).
  - **alpha-spiral 14.7→7.3, clears 1/3→2/3** — HALVED on the cell that
    regressed on every §56 arm. **fire-edge 9.7→3.0 (3/3)** — 3× better
    than the best prior arm; the "edge-hold calibrated on pre-swap
    movement" drift row, answered by arbitration instead of re-tuning.
    **stall-spiral 0.7** (best); corridors/isthmus/river/labyrinth tie
    or near-tie the best.
  - **⚠ artillery-funnel 0.0→3.3 vs none** — the lone cell where the
    searcher is worse than passive; the §53e.2 catapult wake-up row
    stays open as a §57/§58 input.
  - Caveat stands: 3-seed cells never arbitrate — these are spot-checks;
    the full-run probe (§57g.1) and the 57h three-set rule govern.

- **2026-07-19 — §58 THE NO-OP CHECK (58a): the forced-spiral isolate
  under the audition searcher — audition beats OFF on BOTH seed sets,
  decisively; per the pre-registered rule (worklog §58, locked before
  the read) the NO-OP EXIT IS EARNED — the deserters residual is
  SEARCHER-ATE-IT.** Protocol: the 55b isolate shape at HEAD `4917b31`
  (fixture vector [tests/fuzz/fixtures/55pre-vector.json](tests/fuzz/fixtures/55pre-vector.json),
  `--layout=spiralFireLife`, 40 full runs/arm), in-sample seeds 1–40 +
  held-out `--seed-offset=5000`, arms OFF vs `--searcher --audition`
  (v2 dials, K=2), box `--jobs=8`. Hangs 0, draws 0 on every arm.
  | set | OFF | audition | Δ | paired (w→l / l→w) | sign p |
  |---|---|---|---|---|---|
  | in-sample 1–40 | 52.5 (avgHop 7.80) | 77.5 (9.45) | +25.0 | 5/15 | ≈0.04 |
  | held-out 5001–5040 | 40.0 (6.78) | **87.5** (9.35) | **+47.5** | **2/21** | **≈7e-5** |
  - Held-out ABOVE in-sample again — the §57h anti-overfit signature,
    reproduced on the isolate. The 55b cap-draw stall signature (4×
    cap-draws under static edge-hold) is ABSENT outright: zero draws
    in 160 runs.
  - Baseline staleness confirmed as predicted: 55b's pre-swap passive
    read 52.5% on the old engine; OFF at HEAD reads 52.5/40.0 (the
    in-sample match is coincidence — different engine, different arms).
  - Ledger consequence: the §55 named residual "deserters/fleers vs
    edge-hold (~50% loss in the isolate)" closes SEARCHER-ATE-IT — the
    audition searcher holds-or-advances correctly where the static
    trigger held for fleers; no threat sensor built (§58's no-op exit,
    exercised as designed). Batches `output/box-batches/20260719-{005301,
    005430,005600,011157}-4917b31` (OFF-in / OFF-held / aud-in /
    aud-held); summary sha256 5bc07142 / 1acbd4ff / 66600e28 / ba13c958.

- **2026-07-20 — §59 THE ECONOMY REGEN + THE FIXED-VECTOR PROBE: the
  first overnight box search (economy dims live) converges and the
  economy layer is measurably ALIVE (packets fire in 37/40 runs) — but
  the expressiveness LIFT over the pinned old vector is a WASH at
  current economy config: two opposite economic postures tie.** All
  §59 exit criteria met; the wash is itself the §60 input.
  - **The regen (batch `20260720-020433-4acca2c`, 8.85h box wall):**
    `--search --refine --searcher --audition --preset=heavy
    --vectors=96 --seeds=32 --sampler-seed=59 --jobs=8` at HEAD
    `4acca2c` — 96 full-length candidates × 26 train / 6 test seeds,
    K3×8@0.15 refinement (SHARDED — 59f-pre; the cost probe caught the
    serial-refine trap: ~67s/full-length audition eval ⇒ ~7h serial).
    Winner: train 73.1% / 6-seed test 50.0%; refinement improved 1/3
    finalists, crown unchanged. Pinned as
    [tests/fuzz/fixtures/59-regen-vector.json](tests/fuzz/fixtures/59-regen-vector.json).
  - **The winner's economy posture (coherent, learned):** avoid ports
    (`path.port` −0.28 vs battle/rest/elite ≈0.7) · if docked buy
    daemons (0.92) never packets (−0.97) · reserve ≈26 bits · FIRE at
    normals (+0.37), lukewarm elites (+0.08), HOARD at boss (−0.84 —
    a full cache can't flip it: −0.84+0.46<0). The inverse of the
    save-for-boss human instinct.
  - **The fixed-vector probe (§46b instrument): new vs old
    ([55pre-vector](tests/fuzz/fixtures/55pre-vector.json)), both
    `--searcher --audition`, 40 seeds in-sample + 40 held-out
    (`--seed-offset=5000`), box `--jobs=8`, HEAD `2b42019`:**
  | vector | in-sample | held-out | packetsFired | portPurchases |
  |---|---|---|---|---|
  | NEW 59-regen | **65.0** (26/40) | 57.5 (23/40) | 96 / 76 | **0 / 0** |
  | OLD 55pre | 62.5 (25/40) | 57.5 (23/40) | 0 / 0 | 25 / 21 |
  - Paired same-seed flips: in-sample +10/−9, held-out +7/−7 — **net
    ≈0 both sets**. +2.5pt in-sample is inside the §52 seed-variance
    band; held-out is an exact tie. **VERDICT: the expressive economy
    vector matches, not beats, the fixed-policy vector** — the whole
    strategy-side economy (fires, no shopping) and the hardwired one
    (buy-all, no fires) reach the same ceiling.
  - **⭐ The §60 handoff finding — PORT STARVATION IS OPTIMAL:** the
    searcher-optimal vector never docks (0 purchases in 80 runs; mean
    terminal bank 81.5 bits = massive idle liquidity). "Ports aren't
    worth the hop at current prices" is now a MEASURED optimum, not a
    bot quirk — §60's `path.port`-first sweep order (the §50g
    transaction-starvation guard) has its motivating number, and
    "make economy decisions matter" (prices · bitsMultiplier · drop
    weights) is the tuning target, with BOTH instrument vectors
    (economy-live + fixed-policy) as the A/B pair.
  - Stability cross-check: the old vector at 40 seeds (62.5/57.5)
    is consistent with §57h's 120-seed reads (57.5/60.8) within seed
    variance. Batches `20260720-{124227,125030,130045,131033}-2b42019`
    (new-in/new-held/old-in/old-held), summary sha256 f90f1cfe /
    a1ca0174 / 8e8c1607 / 87f3858f.
- **2026-07-20 — §60 THE OPENING READS: 60a fire-ablation (fires are
  REAL — the §59 wash decomposed into two equal channels) + 60b the
  `path.port` ladder (the toll curve exists and the FIXED BUY POLICY is
  who pays it).** 8 batches at HEAD `f5f504d`, 40 seeds each,
  `--searcher --audition --jobs=8`; the live comparison arms are the
  §59 probe batches (code-identical — `2b42019..f5f504d` is docs-only).
  - **60a — the fire ablation (59-regen with the fire group zeroed;
    port group untouched):**
  | arm | in-sample | held-out |
  |---|---|---|
  | live 59-regen (~2.4 fires/run) | **65.0** | **57.5** |
  | ablated (0 fires) | 57.5 | 52.5 |
  - **Paired same-seed flips: +3/−0 in-sample, +2/−0 held-out — five
    wins lost to ablation, ZERO reverse flips in 80 paired runs**
    (one-sided sign p≈0.03). **Firing packets IS strictly beneficial**
    — the user's §59 close hypothesis confirmed in the strict sense
    (no seed anywhere got worse by firing).
  - **⭐ The §59 wash DECOMPOSED — two equal channels, not a dead
    layer:** no-economy (ablated: no fires, no buys) 57.5/52.5 ·
    fire-only (59-regen) 65.0/57.5 · shop-only (55pre) 62.5/57.5. The
    economy layer carries ~+5pt through EITHER channel; the §59 tie
    was two vectors harvesting the same-size dividend, not
    outcome-neutrality. "Make it matter" sharpens to "make the
    channels STACK and DIFFERENTIATE."
  - **60b — the `path.port` ladder (40 in-sample seeds/rung; tx-rate =
    runs with ≥1 purchase; bank = mean finalBits):**
  | rung | regen win% | tx | buys/run | bank | 55pre win% | tx | buys/run | bank |
  |---|---|---|---|---|---|---|---|---|
  | −0.28 | 65.0 (native) | 0/40 | 0 | 81.5 | 57.5 | 12/40 | 0.42 | 66.3 |
  | 0 | 65.0 (row-identical to native) | 0/40 | 0 | 81.5 | 62.5 (native) | 17/40 | 0.63 | 60.6 |
  | +0.75 | 67.5 | 9/40 | 0.25 | 64.0 | 55.0 | 21/40 | 0.82 | 55.9 |
  | +1.5 | 67.5 | 11/40 | 0.33 | 59.8 | **50.0** | 32/40 | 1.43 | 39.4 |
  - **The toll is POLICY-SHAPED, not universal:** the learned tight
    posture (reserve ≈26, daemons-only) pays NOTHING for dock-forcing
    (paired +8/−7 ≈ net 0 at both +0.75 and +1.5) but also barely
    transacts — 0.33 buys/run at DOMINANT port weight: the port
    SCORER throttles, not the route. The fixed buy-all policy pays
    monotonically: 62.5 → 55.0 → 50.0 (always-dock vs native paired
    +6/−1 AGAINST docking). The §59 "ports aren't worth the hop"
    refines to: **the GOODS aren't worth the hop under buy-all
    discipline; a disciplined buyer breaks even; nobody profits** —
    port stock has no upside at ANY tested posture. That no-upside
    curve is 60c's tuning target.
  - Kickoff predictions: regen@0 starved ✅ (stronger — all 40 rows
    identical to native ex strategy-name) · 55pre@−0.28 still docks ✅
    (12/40) · both @+1.5 dock-heavy — HALF-MISS for regen (the route
    docks but the scorer keeps tx at 11/40; NB `portPurchases` can't
    distinguish dock-without-buy from no-dock — a dock counter is a
    small RunResult add if 60c needs the split).
  - **The 60c operating point (PROPOSED, user confirms): 55pre@+1.5**
    (80% tx-rate, 1.43 buys/run — the §50g guard finally satisfied)
    as the primary price-read arm + **regen@+1.5** as the
    learned-posture control; held-out seeds spent only there.
  - Batches `20260720-{142120,142852,143854,144624,145640,150655,
    151439,152341}-f5f504d`, summary sha256 a06c6bfa / 71422f88 /
    d1c8e6d2 / 17ef9357 / dd2e1d8f / c9cd86c4 / 4bc0b8b5 / 34c5f386.
- **2026-07-20 — §60c WAVE 1: the stack DOESN'T stack, the boss dial is
  SLACK, income recovers only HALF the buy-all toll — and ONE mechanism
  explains all three: ⭐ THE FIRE ARM MOSTLY FIRES NO-OPS** (patch at a
  full pool; acquisition-order "first usable" = a patch monopoly). 6
  batches at HEAD `d476fa9`, 40 in-sample seeds each, paired.
  | arm | win% | paired | vs |
  |---|---|---|---|
  | stack-55pre (shopper + fire dials) | 62.5 | **+0/−0, 40 same** | native 55pre 62.5 |
  | stack-regen (fire + buy-all @+1.5) | 60.0 | +0/−3 | fire-only @+1.5 67.5 |
  | bossflip (boss bias −0.84→+0.84) | 65.0 | **+0/−0, 40 same** | live regen 65.0 |
  | bits ×1.5 @ 55pre@+1.5 | 57.5 | +4/−1 | ×1.0 50.0 |
  | bits ×2.0 @ 55pre@+1.5 | 52.5 | +3/−2 | ×1.0 50.0 |
  | bits ×1.5 @ regen@+1.5 (control) | 65.0 | +0/−1 | ×1.0 67.5 |
  - **The mechanism (row-diffs + a headless fire-log probe):** the two
    +0/−0 arms are TICK-IDENTICAL to their controls per row (only the
    `packetsFired` column differs) — and re-examining 60a, **33/40 of
    live-vs-ablated regen rows are tick-identical too**: the fire
    channel's +5pt rides a consequential MINORITY of fires. The probe
    (fires logged, no searcher) shows why: fires are almost all
    `outOfBattle:patch` (+ the odd `preTurn:reroute`). `patch` =
    healPool +3 — clamps to a NO-OP at a full pool; `reroute` grants
    redraws NO harness redraw policy consumes (a harness artifact, not
    a content verdict); hype/shield/venom/miner essentially never fire
    — patch is the most-common drop AND dual-context, so "fire the
    first context-usable cache slot" is a patch monopoly.
  - **Re-readings forced by the mechanism:** 60a's fire value =
    pool-repair-when-damaged (real, just badly timed — fired on
    cooldown regardless of pool state); the boss-flip slack is NOT
    evidence that boss-relevant fire content is missing (miner/hype
    were never TRIED at the boss — blocked behind patch); §59's
    "packets fire in 92% of runs" was DISPATCH liveness, not EFFECT
    liveness.
  - **The income duality read:** ×1.5 recovers about half the buy-all
    toll (50.0 → 57.5, +4/−1) but ×2.0 does no better (buys rise to
    2.23/run while the bank climbs to 76 — income outruns useful
    stock; a junk-buying ceiling). The tight-posture control is flat
    (+0/−1), as predicted (the reserve binds before income). ⇒ price
    cuts (income's dual) likely NARROW but cannot FLIP the port toll
    under buy-all; the disciplined buyer already breaks even.
  - Batches `20260720-{162110,163037,163930,164701,165555,170509}-
    d476fa9`, summary sha256 406d2233 / 25cb3145 / b3ed8a76 /
    06371a29 / 02b1e8c2 / 1d418d81.
- **2026-07-20 — §60c THE GRANT-LIVE FLOOR: the instrument arm extends
  to `--searcher --audition --redraw=level:2 --empower=level:hi`
  (⚠ DOCTRINE — the §57h default realistic-bot arm definition AMENDS
  to this; the grant-consumer catch is the worklog §60c story), and
  the re-run says the grant layer is worth LESS than its price sheet:
  ≈0 for the firer, a lean +5 for the shopper.** 4 batches at HEAD
  `035b3be`, the A/B pair × in/held, 40 seeds each.
  | vector | in (old→new) | held (old→new) | paired vs old floor |
  |---|---|---|---|
  | 59-regen | 65.0 → 57.5 | 57.5 → 65.0 | in +3/−6 · held +5/−2 — **net 0/80** |
  | 55pre | 62.5 → 67.5 | 57.5 → 65.0 | in +7/−5 · held +4/−1 — net +5/80 |
  - **The grant layer's realized value at fixed dials ≈ NOTHING for
    the never-shopping firer** (+8/−8 over 80 — pure churn from
    perturbed hands) **and a modest consistent-direction lean for the
    shopper** (+11/−6). The per-daemon lens agrees: grant-daemon runs
    didn't jump (regen-in 15/24 → 13/24 wins; 55pre-in 14/24 →
    15/24). 60% of runs roll a grant daemon, and consuming its grants
    every turn barely moves outcomes.
  - **⭐ The pricing implication:** Mars (55 bits — the priciest
    daemon) delivers ≈0 realized bot value; the only daemons whose
    value the harness realizes are the auto three, and Fortuna (25)
    is the CHEAPEST. The 50f daemon-price spread is upside-down
    against measured value — a direct 60c/60e input. Caveat on
    record: level:2 / level:hi are DUMB consumers; a smarter redraw
    could realize more (the §55 lesson pattern) — but the shipped
    game's floor player is not smarter, so the price sheet still has
    to answer to these numbers.
  - **The §59 WASH verdict stands, now leaning shopper:** regen vs
    55pre on the new floor = in +5/−9, held +5/−5 (net −4/80) —
    inside variance; two postures, one ceiling, unchanged.
  - Prior §53–60 verdicts STAND (the deadness was uniform → cancels
    in every paired read); absolute levels from grant-dead arms are
    superseded by this floor. Held-out spend on the ladder point
    deferred until the fire-selection fix (next entry) settles the
    regen arm.
  - Batches `20260720-{174431,175219,180218,180842}-035b3be`, summary
    sha256 d3bb5644 / 8879ae43 / 3393e002 / 6a75ffaa.
- **2026-07-20 — §60c THE B WAVE: the heal guard pays small but
  STRICTLY (+1/−0 on each set — zero regressions in 80 paired runs),
  and the fire channel on the grant-live floor confirms real-but-
  modest.** 4 batches at HEAD `7e3895f` (the guard live), extended
  arm, 40 seeds each.
  | arm | in | held | fires/run |
  |---|---|---|---|
  | regen + heal guard | **60.0** | **67.5** | 1.30 / 1.70 |
  | fire-ablated (no fires) | 57.5 | 57.5 | 0 |
  | (regen, dumb selection — prior entry) | 57.5 | 65.0 | 2.40 / 2.13 |
  - **B vs dumb selection: +1/−0 in, +1/−0 held** — fires/run DROPS
    2.40→1.30 while win rate rises: fewer fires, better fires, no
    seed anywhere got worse. The guard ships as the fire rule.
  - **The fire channel (B vs ablated): +3/−2 in, +5/−1 held** — net
    +8/−3 over 80 (60.0/67.5 vs 57.5/57.5): the channel is real and
    worth ~+2.5–10pt, strongest held-out — consistent with 60a's
    +5/−0 direction on the old floor.
  - Ablated grant-live vs grant-dead: +4/−7 — the third net-zero
    grant read (the floor entry's finding, re-confirmed with fires
    removed from the comparison).
  - **The regen instrument arm's pinned numbers are now B's:
    60.0 / 67.5.** Batches `20260720-{182938,183725,184741,185602}-
    7e3895f`, summary sha256 936b3669 / 6ccba1d6 / d181a6d1 /
    6876e956.
- **2026-07-20 — §60c CLOSES: the config bake validates clean (+3/−1
  firer, +1/−1 shopper) and every lever is dispositioned.** The two
  user-called changes (daemon reprice mars 40/janus 32/mercury 30 ·
  bits-small patch 0.25 + shield 0.25) ran combined, 40 in-sample
  seeds per vector, extended arm, HEAD `eb07276`:
  | arm | win% | paired vs pinned | fires/run |
  |---|---|---|---|
  | regen @ final config | **65.0** | +3/−1 (vs B's 60.0) | 1.30 → **1.95** |
  | 55pre @ final config | 67.5 | +1/−1 (flat) | 0 |
  - The firer's gain is the drop probe working as designed: shield in
    the common table → the heal-guarded rule finally fires buffs
    (fires/run up 50% with the guard still banking patches). The
    shopper is unmoved (native docking is modest; the reprice shifts
    little volume at 0.63 buys/run). **Both changes STAY.**
  - **Ledger of the 60c dispositions:** daemon prices TUNED (toward
    realized value, deliberately partial) · drop weights TUNED (the
    probe stays) · fire arm TUNED (the heal guard) · `bitsMultiplier`
    ACCEPT at 1.0 (income is not the port problem — documented no-op)
    · `path.port`/port economics ACCEPT-AS-MEASURED (the toll is the
    policy; goods-vs-hop value is next-round content work, filed for
    the Cluster-4 proposal) · the ladder's held-out spend CLOSED
    UNSPENT (no price sweep materialized at the operating point —
    the in-sample ladder + the documented-no-op precedent carry it).
  - **Boss wall at the FINAL config: 26.4% (19/72 arrivals)** —
    consistent pre/post config; §60e tunes it up into the re-anchored
    **30–35%** band (user call). Batches `20260720-{222911,223730}-
    eb07276`, summary sha256 e41693a8 / c1859eb7.
- **2026-07-20 — §60e THE PER-BOSS SPLIT (user catch: the catalog has
  TWO bosses — every §60 wall number to here pooled the roll): the
  measured order INVERTS the paper read — the King (pool 13) is the
  harder wall.** Forced-boss in-situ (`--encounter=`), both vectors,
  40 in-sample seeds each, extended arm, HEAD `fb3bf75`:
  | forced boss | win regen/55pre | wall (pooled n=72) |
  |---|---|---|
  | bandit-king (pool 13, factors 1.15/1.2) | 65.0 / 55.0 | **33.3%** — IN the 30–35 band |
  | banditQueen (pool 20, factors 1.25/1.3, banshee-led) | 70.0 / 60.0 | **27.8%** — just under |
  - Paired same-seed King-vs-Queen: +5/−7 (regen) · +2/−4 (55pre) —
    net −4/80, every read the same direction: Queen-runs win MORE.
    The bigger pool + hotter factors do NOT make the harder fight —
    the Queen's banshee-led waves are softer in practice than the
    King's mercenary/ranged discipline (mechanism unprobed; the
    numbers govern, per the round's doctrine).
  - Batches `20260720-{232038,232914,233522,234307}-fb3bf75`, summary
    sha256 88f439f7 / e0cb55d7 / dc10150e / 8f08270a.
