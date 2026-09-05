# WORKLOG — The encounter feel interstitial (§89–§94): the casualty experiment

Per-round narrative log (AGENTS "The planning stack"): findings, decision
rationale, rejected alternatives, scope changes, playtest verdicts land
here under the matching `## Phase N`; the ROADMAP stays a plan (one-line
mutations + a pointer back here). Created 2026-09-02 at the Round 6
close (88e); the spec is [encounter-feel-spec.md](encounter-feel-spec.md).
Prior round's log: [archive/post-83-worklog.md](archive/post-83-worklog.md)
(Round 6, Instruments — §84 the shadow instrument → §85 the fold → §86
perf → §87 roster realism → §88 the rarity read + the close).

## Kickoff (2026-09-02 — the spec session; resolutions USER-SIGNED in chat)

### The code-reality audit (before the design conversation)

- **Inter-sector healing does not exist.** `advanceSector` (Run.ts
  ~3496) swaps sector state and never touches `playerHealth`; the only
  heals are rest (+5 absolute), Patch (+6), and `healPool` ops. Pool max
  20; the signed seam band 15–18 ⇒ a seam heal is worth +2..+5 on
  average — less than one act-2 elite. Cheap to build (a knob + a line +
  a SectorClearedScreen line, no bump); the real cost is that the sheet
  defines the run as ONE budget, so a seam heal retires the seam band.
- **No per-act difficulty knob exists.** `difficulty.json` multipliers
  are per RUN; act 2 is hot only because its encounters are authored
  hotter. "Per-act bands" is purely a target question.
- **The §87d defect list splits** into members off-band under EITHER
  answer to the act question (act-1 normals 0.03–1 · warband-vanguard
  1.18/0.95 · plagueVictims 0.03 · infernalColumn 7.7 / miscreants 6.9
  above the ELITE band · plagueSpreaders 10.6/9.3) and members off-band
  only under the single band (elementalTrio · act-2 artillery /
  adventurer · plagueDoctors 0.3–1.8).
- **The King is probably not a defect:** isolation 5.97 vs the prose
  band 10, but his full-length wall reads 33% — INSIDE the signed 30–35.
  Tuning him to the isolation band would breach a signed band to
  satisfy a prose one → bosses are judged by the wall.
- **Isolation reads run on the extended searcher arm** (`--arbitrate` ⊥
  `--encounter`, the 84b refusal) — every per-encounter tune reads on a
  slightly weaker bot than the board; the exit board is load-bearing.
- **Packets today:** rarity-by-SOURCE already exists (small/large/
  elite/boss tables at 30/50/75% triggers); the one uniform surface is
  the port shelf (`rollPortStock`: `sampleDistinct` 5 of 8, Venom at 15
  beside Patch); prices per id 5–15. Unit rarity is the analog (tier
  field · `rarityWeights` · Portunus forced tiers · the P1 card seam).
- **The chip formula** (`resolveTurn`, Run.ts ~3009): each side's pool
  loses the OPPOSING survivors' Σ`power` × `chipMultiplier`(1). `power`
  base 1, growth 0.1/level (L10 ≈ 1.9); enemy pools 7–10; a winning hand
  chips ~7.5 ⇒ encounters are 1–2 turns; a lost turn vs 6–8 survivors
  chips 11–15 of 20. Per-turn `poolChips` telemetry (survivor power per
  side, per encounter, per hop) rides `--per-encounter`; `poolAtSectorClears`
  exists since 72b-pre. Only two fetched box batches remain on disk
  locally (whether the 87d2 cohort is re-analyzable = a §89 check).

### The design conversation — how the charter widened

The user's ramble decomposed into three problems sharing one symptom:
(1) **the per-turn tail** — the chip is linear in the winner's survivor
count, a won turn costs 0, so per-encounter pool damage is a spike at 0
plus a fat tail; (2) **the carry across acts** — the sheet already lives
at the "act 1 trivial" corner (seam 15–18 of 20); (3) **the run-shape
math** — with a fixed pool and no reset, act clear rates don't multiply,
so the exponential drop-off is unreachable and act 3 would have to be
numerically easier ("harder in win rate, easier in absolute terms" only
exists under coupling). Independence is also a MEASUREMENT property:
coupled acts make cost multiplicative (act 3 needs acts 1–2's residue
simulated faithfully); a known entry pool + the §87 sampled roster make
it additive. StS precedent: full heal after each act boss below
Ascension 5, removed as a rung — a free difficulty lever later.

**Resolved:** the seam floor (`seamHealFloor` 0–1, shipped 1.0). The user
declined the per-turn cap (a hidden number; "I liked that the player
could add the numbers") and asked for the root fix.

**The menu** (simple → radical): (1) HP-weighted survivors ("wounded push
less") · (2) **casualty-based chip** (each side pays its OWN fallen —
the body fills in, the ceiling is the player's own fielded power,
losses still progress the fight, the enemy pool becomes literal) · (3)
a retreat stance (only coherent under 2 — under survivors retreating
early leaves MORE survivors to chip you) · (4) more draws per encounter
(√n variance, a pacing price) · (5) injuries via the inert fatigue seam
· (6) drop the pool for persistent unit HP · (7) the exposed cap. The
user chose (2) — "there's no sense of a Pyrrhic victory in this game" —
and, recognizing the overhaul (power-on-level-up becomes a penalty;
pools rebalance; not a config switch), called **the first experimental
round**: build it regardless, rebalance, then ⛔ keep or roll back.

**The hardening pass** (the user's "what am I forgetting / what are you
unsure of" round) firmed: headcount weights 1 / legendary 2 / summon 0,
symmetric · heals as fractions (rest, floor) vs absolutes (packets) ·
the keep read on a RE-SEARCHED arm (the §85f leak shape) · the cap
penalty as its own mode from day one (the SEARCHER, not the player, is
the stall risk) · fatigue re-targeted to starting HP (−10%/stack, cap
50%), landed at rate 0 and read separately · main + tag, no branch ·
5 playtest runs per rule, feel verdict before numbers · per-act targets
0.6 / 0.5 / (0.4). The arithmetic's prediction — the PLAYER pool is the
knob, not the enemy pools (a decisive win chips the wave's power ≈
today's survivor chip; a won turn now costs its fallen) — is a
hypothesis for §91's flip read, not a premise.

### Rejected alternatives

- **Deciding the per-act band question first** — it dissolves under
  independence; the defect list then tunes to the single band per act.
- **A rarity tier axis for packets now** — the real need is a SHELF
  GUARANTEE (weights bias, they don't guarantee): a role tag + a forced
  slot, the recruit offer's melee+ranged precedent → Round 9 with the
  catalog growth it serves.
- **Massively increased heal drops** — the same variance fear.
- **An experiment branch** — the merge pain is a week of doc/BALANCE
  divergence; a tag + contiguous commits make the revert free.
- **Rule 4 as the variance fix** — a pacing question the rebalance
  answers by measurement.
- **Retreat / optional deploy / injuries now** — the phase is large
  enough; written into META-ROADMAP Round 9 with the anti-exploit
  constraint (walked to spawn + despawn, or an unlock timer, or both).

### The blind-spot register (→ the §91 kickoff audit)

Neutral exclusion from the survivor sum (camps) · summons at power 0 ·
the rollout evaluator's objective (survivor power as a chip proxy?) ·
the telemetry proxy (deltas must land WITH the rule) · XP on death · the
riders re-scope under keep vs rollback · box time 4–6 nights · snapshot
prediction NO bump for the round · exposure has no lever but Cull.

### Adversarial review (planned, reviewer unpinned)

The §85f tiger-team shape at the §91 kickoff — "the strongest available
second model at the time" + a read-only peer verifying file:line. Hunt:
pre-registration leaks (a criterion the bot can satisfy instead of the
rule) · confounded reads (two changes before one paired read) ·
inherited seams · rollback completeness · scope-creep vectors and
decisions not written as stops.

### Shape-lock (2026-09-02, USER-SIGNED in chat)

The six-phase cut (§89 data → §90 floor → §91 rule → §92 rebalance →
§93 ⛔ keep-or-rollback → §94 the list + the close) signed as proposed;
the adversarial review scheduled at the §91 kickoff (when the build's
cut lines exist to be attacked — movable earlier on request). Config
names (`chipMode` / `capPenalty` / `seamHealFloor`) and the tag name
are proposals until §91.

## Phase 89 — The data phase

### §89 kickoff (2026-09-02) — the code-reality audit

The surfaces the charter names, checked as they exist at `e461583`:

- ⭐ **No on-disk cohort carries `poolChips`.** The charter's "re-analyze
  if a fetched batch still carries it" branch is DEAD: per-turn chips
  live only in `results.json` (`--emit-results`, the shard protocol's
  round-trip file), and no `results.json` exists anywhere under
  `tests/fuzz/output/` — the two surviving fetched boards (`board-87b`
  @ `8c47b73`, `board` @ `962a363`) hold summary/decisions/rosters/
  timings only. The 87d2 results.json files the X3 re-read used are
  gone. → ONE fresh cohort (89c).
- ⭐ **The alpha-strike share is a WALK statistic, not an isolation
  one.** "Among pool deaths, the share whose killing turn took ≥ 50%
  of pool max" needs deaths that happen in a run's pool trajectory
  (act-2 deaths arrive at 15–18, the seam hazard IS the question); a
  single-hop isolation cohort starts every fight at a full 20 and can
  only die to that one fight. The charter's "isolation cohort, single
  hop" (the 87d3 rider) is the §94 per-ENCOUNTER instrument, not this
  read's. The cohort = the ARM walk twins with telemetry on:
  `--per-encounter` (harness `telemetry: true`, pure observation)
  composes with `--arbitrate` — the 84b refusal set is the RunConfig
  probe dials (`--hops` under the shadow, `--layout`, `--draw-add`,
  `--encounter`; args.ts ~629), and the 87b board's own arb walk args
  already ran `--hops=11 --arbitrate`. `--emit-results` is a shard
  flag stripped from the arm signature (manifest.ts), so the manifest
  still matches the ARM. `box-batch.sh fetch` scp's the whole batch
  dir, so results.json comes home.
- **The telemetry records the rule's INPUT, and the applied pools are
  unreadable from outside the Run.** `PoolChip` = `{sector, hop,
  encounterId, player, enemy}` — survivor power per side, recorded at
  `battle:ended`. The harness subscribes BEFORE constructing the Run,
  so its handler runs first and sees the PRE-chip pools (correction
  to the first draft of this note, caught at 89a build: Run's handler
  runs SECOND, and on the headless path it chains synchronously into
  `startNextTurn` — whose `executeInstantOps` can heal — before any
  later subscriber runs, so a post-Run subscriber reads a contaminated
  "after"). The only clean source of the applied values is the site
  that applies them → 89a emits `pools:chipped` from `resolveTurn`
  (both paths) and the harness stitches it to the survivor half.
  Under survivors the
  applied delta = survivor × `chipMultiplier` exactly (chipMultiplier
  1), so the alpha read is computable from `enemy` alone — but the
  arrival pool at the killing turn (the "act 3 opens under ten" fear)
  is not, and heals (rest +5 / Patch +6 / `healPool`) make the
  trajectory non-reconstructible from chips. Widening `PoolChip` with
  per-turn pool snapshots (before/after, both sides) is additive to
  results.json only — summary.csv's columns don't change, so the
  byte-for-byte fuzz baselines hold — and it pre-lands §91's
  "telemetry carries the APPLIED deltas" rule-agnostically (delta =
  after − before under either rule). The per-encounter reader keeps
  survivor × chip for now (identical under survivors; §91 switches it).
- **The seam-hazard read is free TODAY:** `poolAtSectorEnd` +
  `finalPool` + `outcome` are summary.csv columns (72b-pre), so the
  post-fold board-87b arms give a preview read at `8c47b73` without a
  box; the cohort's own summary re-reads it at HEAD.
- **The pre-turn risk line needs the wave BEFORE the gate.**
  `turn:starting` fires from `startNextTurn` (Run.ts ~2223) carrying
  hand/piles/grants/pools/encounter name — no enemy composition; the
  wave is rolled in `beginTurn` (~2705: `waveForTurn` → `resolveWave`
  off the keyed `battle` stream, AFTER the player's `advanceTurn`).
  Under survivors "at risk: up to N" = the wave's Σ`power` ×
  `chipMultiplier` (capped at the pool); under casualties = the
  fielded hand's Σ`power` (known at the gate for free). The 66a boss
  forewarning pre-rolled AND serialized its pair (v38→v39) — the
  shape the spec forbids this round (NO bump). The no-bump route: a
  PURE preview — re-derive the same keyed stream (`streamRng` =
  `deriveRng(root, 'battle', sector, node, turn)`, hash-derived, no
  parent consumption → byte-neutral for every other stream), draw the
  worldSeed and discard, run `waveForTurn`/`resolveWave` WITHOUT
  assigning `waveCursor`. Divergence vectors between gate and fight:
  `team.length` (the count/budget basis) — `removeRosterUnit` throws
  "only legal at the map", so no gate-time roster mutation exists;
  `effectiveDrawAmount` — packet draws mutate `hand`, never the fold;
  the enemy pool fraction (stage gates) — `healPool` touches the
  PLAYER pool only. A test pins preview == fielded wave.
- **Cost (board-87b timings):** an ARM walk arm at n=40, `--jobs=8`,
  ran ~6–7 min wall on the box (22–74 s/seed); n=120 ≈ 20 min/arm.
  Pool deaths per arm 9–14 of 40 → ~30–40 at n=120; the threshold's
  denominator wants the n=80 floor, so the cohort takes the three
  character twins (soldier/priest/gambler × regen/deploy = 6 arms,
  ~2 h box) rather than the two soldier arms alone.
- **Snapshot prediction: NO bump** (an event payload field + a
  harness telemetry field + a pure preview). **Fuzz baselines: hold**
  (results.json-only widening; the preview derives, never consumes).

### Shape-lock (2026-09-02, USER-SIGNED in chat)

The five-step cut (ROADMAP §89: 89a telemetry → 89b reader → 89c
cohort → 89e risk line while the box drains → 89d ⛔ the pin) signed as
proposed. Two calls: **six arms** (the n=80 death denominator over the
~80 box-minutes saved) and **the pre-turn PREVIEW** over the in-battle
HUD fallback (the number has to inform the redraw decision).

### 89a/89b/89b2 — the instrument (2026-09-02; `ee9bdd2` · `9b4423a` · `b21de71`)

- **89a corrected its own cut line.** "Capture at `battle:started`" was
  the plan; the build found the harness-side read structurally
  contaminated (the audit correction above) and moved the truth to the
  site that applies it: `pools:chipped` from `resolveTurn`, both paths.
  The harness stitches survivor half + applied half into ONE record; the
  identity `after == max(0, before − survivors × chip)` is pinned in
  telemetry.test.ts as the survivors-rule identity — §91 REWRITES that
  pin with its rule, never loosens it.
- **89b is rule-agnostic by construction** — every column reads applied
  deltas; the survivors-specific columns (AlphaBlow, and 89b2's overkill —
  both need the uncapped charge, which the clamp at 0 hides) are labeled
  so. ⚠ Landing note for §91: `pools:chipped` must carry the PRE-CLAMP
  charge per side, or the blow/overkill columns go blind under the
  casualty rule.
- **89b2 — the OVERKILL margin** (the user's metric, read off batch 1 in
  chat): the killing turn's blow minus the pool the run arrived with =
  the pool the run would have needed on top to survive that turn. "Even
  with better play (+1–3 pool) it still would have ended the run", as a
  number. Cross-checked against an import-free scratch recompute on the
  first two fetched arms — identical.
- **The seam preview (free, board-87b @ `8c47b73`, post-fold arb walks,
  n=40):** deploy 31/40 crossings · p25/p50/p75 12/18/20 · under 10: 6
  (19%); regen 26/40 · 18/20/20 · under 10: 2 (8%). Consistent with the
  signed seam 15–18; the tail is the seam-hazard number, at n=31.
- **The cohort shape correction:** the board's `--hops=11` arms are
  single-sector act-1 refs (ZERO crossings in their summary.csv) — the
  walk shape (no `--hops`, the board's `arb-walk-*` lines) is the only
  one where the seam and act-2 deaths exist. Priest/gambler WALK arms
  are new shapes (the board reads them at `--hops=11` only).

### 89c — the cohort (launched 2026-09-02 23:46Z at `9b4423a`)

`scripts/box-drive.sh tests/fuzz/output/queue-89c.txt --poll=120
--est-hours=3 --artifact=results.json` — six ARM two-act walk arms ×
n=120 (soldier/priest/gambler × regen/deploy), `--per-encounter
--emit-results`. Walk time 26–36 min/arm at `--jobs=8` (the board-87b
timings said ~22; walks with telemetry run longer). Every fetch was
recomputed independently from results.json (scratchpad
`alpha-recompute.js` + `margin.js`, no reporter import) and matched the
batch.log render exactly; every manifest at `9b4423a`, dirty false.
Numbers: BALANCE 2026-09-03 (89c). The driver ran past the Bash tool's
10-minute ceiling untouched (a background task is not killed at the
foreground timeout — verified by PID at +13 min).

### 89e — the risk line (built in a detached worktree while the cohort drained; `1efb6f9`)

- Built in a worktree (`git worktree add --detach` + a node_modules
  junction) because the driver refuses a dirty tree before EVERY launch
  — the ONE-HEAD-PER-COHORT guard turns "no doc edits until the last
  launch" into "no tree edits at all"; the worktree is how to keep
  building. `.claude/launch.json` is TRACKED, so a worktree preview
  config would have dirtied the cohort tree — browser verification
  waited for the patch to land on main after the sixth launch fired.
- The wave roll was extracted from `beginTurn` into a PURE
  `rollTurnWave()` (worldSeed + cursor + team off the keyed stream, no
  state writes); `beginTurn` commits its result, `previewPoolAtRisk()`
  discards all but Σ power. Two pins: preview == the fielded wave's
  bound on turns 1 AND 2 (cursor advanced, pools moved), and the gated
  run (previews every turn) fields byte-identical worldSeeds + waves to
  the headless run (never previews) at the same seed — the H4b
  RNG-alignment contract re-pinned against the extra derive. fuzz:smoke
  549 byte-identical. Browser: "up to 9 pool" on Brigands turn 1 == the
  fielded 6 bandits (power 1) + 2 archers (2 + 1).
- The bound reads the wave's BASE power (template stats — the number the
  player could add from the cards); in-battle enemy buffs and a
  spawn-queue overflow that never lands both sit outside it, documented
  at the method. Under §91's casualty rule the line becomes the HAND's
  Σ power (known at the gate for free) — the survivors branch is the
  one that needed the preview.

### 89c — the findings (2026-09-03; numbers BALANCE 2026-09-03 89c)

- ⭐ **The feared shape ("healthy, then one-shot") is the minority
  case: 12.7% of pool deaths.** The majority case is "worn down over
  several small turns, then one lost turn against 6–8 survivors ends
  it": arrival p50 5, killing blow p50 10, 61% of killing blows ≥ 10.
  The user's ear was right about the blow (2026-09-02 chat: "died to a
  big blow is what I was picking up on") and the instrument says the
  blow lands on an already-bled pool.
- ⭐⭐ **The unfun part, as a number: 61% of deaths were OVERKILLED by
  ≥ 3** — better play at the margin (+1–3 pool) would not have changed
  the outcome; 39% by ≥ 5. Uniform across all six arms (57–67%) and
  both acts (57% / 63%). This is the metric the user proposed on
  reading batch 1; it became 89b2.
- **The per-turn tail is real but thin:** p90 = 6 pool, the worst turn
  16 of 20, 3–4.5% of turns ≥ 10. The design's variance problem is not
  a fat per-turn tail; it is that a 10-blow is the NORMAL cost of a
  lost turn against a pool that arrives at 5.
- **The seam is healthier than feared:** 6.5% under 10 at n=525 (the
  87b preview's 19% on the deploy arm at n=31 was a small-n reading);
  p50 20. The seam floor (§90) is cheap insurance for a 1-in-15 tail,
  not a rescue.
- **The per-act frame reads off this cohort for free:** act-1 clear
  0.73 pooled vs the signed 0.6, act-2 0.44 vs 0.5 — act 1 is easier
  than target on every arm and act 2 harder on four of six. A §92 fact,
  recorded here so it isn't rediscovered.
- **Priest/regen on the walk is a parity item** (win 0.175, act-2 clear
  0.27 — the weakest arm by far; the board's priest reads are act-1
  refs at `--hops=11`). Named, not this phase's question; it rides to
  §92 with the re-search.

### 89d — ⛔ the threshold docket — SIGNED 2026-09-03 (the user, in chat: the recommendation as proposed — overkill ≥ 3 share ≤ 0.30, no arm above 0.40; written into the spec's keep criterion 1)

**Recommendation:** keep criterion 1 = **the OVERKILL ≥ 3 share of pool
deaths** (blow − arrival ≥ 3), read with the 89b2 reader on the
re-searched arm at §93, pooled across the same six walk arms.
**Baseline 0.61** (per arm 0.57–0.67). **Proposed KEEP bar: ≤ 0.30**
(halved), with a "no single arm above 0.40" guard. Why this metric over
the two alpha definitions: AlphaApp (0.127) measures the rare case and
would move on noise; AlphaBlow (0.61) is the same number as overkill
≥ 0 and says nothing about whether the run could have survived;
overkill ≥ 3 is exactly "the death was already decided at that pool" —
the sentence the user wrote. Why 0.30 and not lower: under the casualty
rule the blow is bounded by the player's OWN fielded power (~6 at a
full hand, legendaries 2), so an arm that dies mostly at arrival ≤ 3
with everything falling would still register; a mechanism-working
outcome likely reads ≤ 0.15, so a §93 read between 0.15 and 0.30 is
"passes, investigate", not "passes, sign". Alternatives on the table:
≤ 0.25 (a stricter "big blows are rare" bar) · ≤ 0.40 (a looser bar
that only rejects a rule that changed nothing). **Two riders written
with the pin:** (1) §91's `pools:chipped` must carry the PRE-CLAMP
charge per side, or the overkill column goes blind under the new rule
(the 89b landing note); (2) the alpha shares (12.7% / 60.9%) and the
per-turn tail (p90 30%, ≥ 50% at 3–4.5%) are reported beside the
criterion at §93, not signed.

### Blind spots carried forward

The rest of the spec's audit register (neutrals in the survivor sum ·
summons · the evaluator objective · XP on death) is the §91 kickoff's
file:line pass, not this phase's.

## Phase 90 — The seam floor

Built by a second session (asciibattler-5c) while the §89 session
closed its phase — the user's "option 1" (2026-09-02 chat); the cut
below was user-signed in chat and relayed at the handoff (2026-09-03
≈ 03:00Z, tree free at `353b71d`).

### §90 kickoff (2026-09-03) — the code-reality audit (at `353b71d`)

The cut HOLDS against code reality; four things it didn't name, none a
contradiction:

- **The pool max is UNFOLDED.** Every `playerHealthMax` read in Run.ts is
  the raw config (`HEALTH.playerHealthMax` — refill, packet-heal caps,
  the risk line, the pool fraction); no daemon/rule folds it. The floor
  clamps to the raw config, correctly.
- ⭐ **The rest heal had a hidden consumer:** the arbitrated arm's
  `DP_TAIL_SCALE` (70e) priced one path-weight point at
  `HEALTH.restHealAmount`. Re-expressed as `restHealFraction ×
  playerHealthMax` it is the same 5 — the ARM's tail is byte-identical
  across the rename, pinned both ways (definition + the exact 5). A
  future fraction/max move re-pins the arm deliberately with §92's
  re-search. Import-time evaluation kept (the tail prices at the
  SHIPPED config; `--set` never dials rest heals).
- **The harness read the LIVE pool at `sector:cleared`** (`run.playerHealth`
  in the handler) — under floor 1.0 that is a constant 20 and the
  seam-hazard read goes blind. Hence the payload's `poolBefore` and the
  recorder switch (the cut's item 2, confirmed necessary).
- **`--set=health.seamHealFloor=0` is admissible:** `KNOB_GROUPS.health`
  IS the parsed HEALTH object (balanceSweep.ts), `applySetOverrides`
  mutates it in place at run-mode entry before any Run exists, `--jobs`
  children re-apply from argv, and rollout clones share the module —
  the floor-0 leg is consistent live and in rollouts. `--set` is not in
  the `--arbitrate` refusal list (it isn't a RunConfig dial).
- Smaller: the existing payload test's 33-pool sentinel sits ABOVE max,
  so the floor leaves it alone (before == after == 33); no live doc names
  `restHealAmount` (archives only — left as history).

**Predictions checked:** NO snapshot bump — held (`playerHealth` already
serializes; toJSON untouched). ⭐ **The predicted two-act summary.csv
re-pin did NOT materialize:** no test pins a two-act walk's outcome
exactly (the determinism/baseline pins are single-battle or
single-sector), so the floor-1.0 default changed no fuzz baseline. The
90d cohort is therefore the FIRST floored walk read — nothing on disk
predates it at the new default.

### The cut (user-signed 2026-09-02, relayed at the handoff)

90a the floor + the payload + the harness pre-floor read → 90b the rest
fraction → 90c the screen line → 90d the paired cohort → 90e the docs;
the tag `pre-casualty-experiment` and the close sign are the USER's.

### 90a/90b/90c — the build (2026-09-03; `bd44a3a` · `f58e5fb` · `d30f0bf`)

- **90a** — `health.seamHealFloor` (0–1, shipped 1.0; `max`, never `min`)
  applied at the top of `advanceSector`, BEFORE the emit; `sector:cleared`
  gains `poolBefore`/`poolAfter`; the harness records `poolBefore`. Tests:
  the clamp at 0 / 0.5 / 1.0 (config-derived), the shipped-1.0 pin, the
  emit-order pin (a live-pool subscriber sees the healed value — exactly
  why the harness can't read live), no floor at a sink, and the harness
  pin re-derived from a surface the recorder doesn't consult (the same
  seed at floor 0, where seam == live pool by construction; act 2 opens on
  max vs the seam — the §79e circular-verification lesson applied).
- **90b** — `restHealAmount` 5 → `restHealFraction` 0.25 (identical at max
  20); `DP_TAIL_SCALE` re-expressed + pinned; a new pin flips
  `playerHealthMax` in place and proves the heal scales. Packets stay
  absolute; fatigue untouched (§91).
- **90c** — `sectorClearedPoolLine`: "Pool restored 7 → 20" on a heal,
  "Pool 20 / 20 carries on" when the floor didn't bite (the screen never
  implies a heal that didn't happen). Browser-verified on `dev-preview`
  (5191): a 7-pool run driven through the post-turn gate emitted
  `{poolBefore 7, poolAfter 20}`, the DOM read the amber line, Press on
  released to The Deep End's map; the full-pool branch read the carried
  form.
- Gate at each commit: typecheck clean · main 2714 → 2720 (90a) → +1 (90b)
  · fuzz:smoke 549 → 551 → 552 · no re-pins.

### Riders relayed from the §89 close (→ §92, recorded so they aren't rediscovered)

The 89c priest/regen walk arm is a parity item (win 0.175, act-2 clear
0.27 — the board reads priests at `--hops=11` only); act-1 clear pooled
0.73 vs the signed 0.6, act-2 0.44 vs 0.5.

### 90d — the paired cohort (launched 2026-09-03)

Four ARM two-act WALK arms at `n=120`: the two soldier twins
(regen/deploy — the board's arb-walk shape, NO `--hops`: the act-1 refs
have zero crossings) × floor **1** (HEAD as shipped) vs floor **0**
(`--set=health.seamHealFloor=0`, the pre-§90 carry), `--per-encounter
--emit-results`, `scripts/box-drive.sh --poll=120 --est-hours=3
--artifact=results.json`, queue `tests/fuzz/output/queue-90d.txt`
(gitignored, modelled on `queue-89c`). What the pair isolates: the
floor's effect on act-2 clear / win / the seam distribution, on the
SURVIVORS rule — so §91's rule-flip read starts from a baseline that
already includes the floor. The seam column stays PRE-floor on both
legs by construction (90a), so the two legs' seam distributions should
match to paired noise — a mismatch is an instrument bug, not a finding.

### 90d — the findings (2026-09-03; numbers BALANCE 2026-09-03 §90)

- **The floor's effect is small and in the predicted direction:** paired
  Δwin +0.017 regen / +0.033 deploy (pooled +0.025, 9/3 discordant, z
  1.73); act-2 clear +2.5 / +4.1 pt. The 89c reading ("cheap insurance
  for a 1-in-15 tail, not a rescue") stands. Every act-2 opening is at a
  full pool on the floor-1 legs (100% vs 53–54%) — the independent-acts
  frame now holds structurally, not statistically.
- ⭐⭐ **Byte-identity, twice.** The seams are identical across the legs
  on every crossing (81/81, 99/99 — act 1 is untouched by the floor and
  the column reads pre-floor), AND both floor-0 legs' `summary.csv` are
  byte-identical to the 89c batches at `9b4423a`: the whole §90 build
  plus 89e is byte-neutral at floor 0 on 240 walk runs. The audit's
  "predicted re-pin did not exist" now has a measured twin — nothing
  moved that wasn't meant to.
- **The §91 baseline:** the rule-flip paired read starts from the
  floor-1 twins (regen 0.308 / act-2 0.457 · deploy 0.475 / 0.576). Act-2
  clear brackets the signed 0.5 from both sides at floor 1 — the
  per-act frame is live for §92 with no act-1 residue to disentangle.
- Instrument: `recompute90d.mjs` (scratchpad, not repo-resident — the
  83b rule) re-derived every number from results.json; 0 render
  mismatches across four batches; the batch.log seam lines agree.

### The §90 close docket — SIGNED 2026-09-03 (the user, in chat; the tag `pre-casualty-experiment` placed on the close commit and pushed). The user's read of the paired result: the minimal floor effect "hints toward the act-1-trivial" picture — recorded as two facts pointing one way: the seam was already nearly full (act 1 costs survivors little; act-1 clear 0.675/0.825 vs the signed 0.6) AND +3 pool at the seam rescues few act-2 deaths (the 61% overkill ≥ 3 from the other side — the casualty rule's target).

Exit criteria vs the charter: **the dial live at 1.0** ✅ (90a; the
shipped-value pin) · **the paired read in BALANCE** ✅ (2026-09-03 §90)
· **the tag placed** ⛔ the user's: `git tag pre-casualty-experiment
<close HEAD>` after this docket is signed (the spec: the tag sits AFTER
the floor, so a §93 rollback is one contiguous revert of §91+§92 on top
of it). BALANCE: the seam-pool band demoted to a diagnostic in prose
(the header note); the sheet's `seamPoolBand` field is user-signed and
was deliberately NOT edited — its disposition (keep as a diagnostic row
/ retire / re-sign) is a §92 lineage-draft line. Also pending the user:
⛔ 89d (WORKLOG §89d). Nothing in §90 is open on the build side.

## Phase 91 — The casualty rule (the experiment's build)

### §91 kickoff (2026-09-03) — the code-reality audit (at `088054d`)

The spec's blind-spot register, walked at file:line, plus what the walk
turned up that the register didn't name. One prediction in the spec is
WRONG (item 1 — a World snapshot bump); everything else holds or is a
one-line consequence.

1. ⭐ **Dead units are SPLICED OUT at death, so the fallen are invisible
   at battle end.** Both reap sites (`World.ts:1284-1289` the step-1
   death check; `:1816-1820` `reapDead` for DoT kills) fire `death`,
   `removeUnit`, then `unit:died`; `survivorPower()` (`World.ts:2310`)
   walks `this.units` and can only ever see who is standing. The casualty
   rule therefore needs a per-side FALLEN-power accumulator written at
   the two death sites (`effectiveStats.power` at the moment of death —
   the same stat the survivors formula reads), carried on `battle:ended`
   beside `survivorPower` as `fallenPower: {player, enemy}`. Neutrals are
   excluded by `team` (camp units spawn `team: 'neutral'`, `World.ts:2026`)
   — register item 1 holds by construction; a player unit killed BY a
   camp is still the player's fallen (charged — the spec's "own fallen").
   ⚠ **Snapshot prediction CHANGES: World v35 → v36.** A mid-battle
   save that loses the accumulator under-charges the turn on restore, so
   it must serialize (the `damageDealt` / `utilityDone` precedent,
   `World.ts:453-463`, with the v35 reject). The spec's "NO bump for the
   whole round" was written before anyone checked the reap; this is the
   "unexpected bump is the tell" — a real shape change, not a leak. Run
   v44 is untouched (the modes are config, not `RunConfig`). Rejected: a
   Run-side derivation (wave power − survivors − queue) — the spawn queue
   isn't exposed, summons spawn mid-battle, and it would be a second copy
   of the rule's arithmetic (the 89a lesson).
2. **`effectiveStats.power` has exactly ONE modifier in the tree** — the
   fatigue effect (`fatigue.ts:44`); statuses / daemons / empower /
   packets / abilities / events / characters carry no `power` mod (swept
   by key). After the fatigue retarget, `effectiveStats.power ===
   stats.power` everywhere: the power TABLE is the chip weight, no
   hidden multiplier.
3. **The power table vs `units.json`** (23 combatant archetypes): base 1,
   growth 0.1 (bandit / ghoul 0.05) everywhere except **healer 0** and
   **ghoul 0** (the summon minion — the only `summon` op, `abilities.json:523`,
   spawns `ghoul`). Legendaries: stormcaller, shaman, and **prodigy** —
   `draftable: false` (never in a recruit / port pool; the player gets one
   ONLY via the `prodigy` event's `grantUnit`, `events.json:252`; fielded
   by the enemy at `encounters.json:826`) ⇒ power 2 under the symmetric
   rule (an enemy prodigy = two kills, and so is yours). ⚠ Decision for the user: the healer's 0
   (a healer never pushed under survivors) becomes **1** under "everything
   is one" — a lost healer costs pool. The zod ranges admit a 2
   (`units.ts:102` power int ≤ STAT_CAP; `:116` growth 0..1). The
   config-derived pin: for every combatant, power ∈ {0,1,2}; rarity
   legendary ⇒ 2; the archetype any `summon` op spawns ⇒ 0; else 1;
   `growthRates.power` 0. `simulateLevelUps` draws `rng.next()` once per
   stat per level REGARDLESS of the rate (`leveling.ts:65-69`) ⇒ growth 0
   shifts NO stream; `leveling.test.ts:184-217` derives from config and
   holds. ⚠ Fuzz baselines DO move at the table commit (L10 power 1.9 → 1,
   legendary 1 → 2 change survivor chips under BOTH modes) — so the
   survivors leg at HEAD ≠ 89c/90d by the table alone (hence the
   three-way read, 91f). `power` is a serialized VALUE, not a shape ⇒ no
   Run bump; an old save carries stale powers (the H6 retune precedent).
4. **The cap penalty = the DRAW turn's rule.** `resolveTurn`
   (`Run.ts:3050-3068`) charges both sides regardless of `winner`; a
   `'draw'` comes only from the tick cap (`World.resolveAsDraw`,
   `World.ts:2255`, `maxTurnSeconds`) or a mutual wipe. Under casualties a
   kited draw with no deaths costs 0 — the searcher's free vector.
   Reading of the spec's `capPenalty`: **decisive turns charge by
   `chipMode`; draw turns charge by `capPenalty`** (`'survivors'` = a
   stall still pays the enemy's standing power). Both default
   casualties. The `maxTurns` pool-fraction tiebreak (`Run.ts:3080-3087`)
   is untouched; the battles' `winner === 'draw'` share per arm is the
   kiting instrument (already recorded — no new column).
5. **A SECOND copy of the rule's arithmetic ships to the player:**
   `turn:resolved` (`Run.ts:2994-3004`) re-derives `survivors × mult`
   for the PostTurnScreen's "Your survivors → enemy pool" / "Enemy
   survivors → your pool" lines (`PostTurnScreen.ts:62-63`). Under
   casualties the meaning inverts (your FALLEN → your pool). The emit
   should carry the APPLIED deltas `resolveTurn` already computed; the
   labels read by mode. UI-only; browser-verified.
6. **The pre-turn risk line is wave-bounded** (`previewPoolAtRisk`,
   `Run.ts:2743-2760`: Σ wave power × mult, capped at the pool). Under
   casualties the bound is the HAND's Σ power (the player's own fielded
   power — the spec's "add your own numbers"), capped at the pool; the
   89e preview==fielded pin stays for the survivors branch.
7. **Telemetry:** `PoolChip` (`telemetry.ts:71-95`) carries survivor
   power + the applied pools; `pools:chipped` (`events.ts:739`) the
   applied pools only. The 89d rider (the overkill column needs the
   PRE-clamp charge) lands as `playerCharge` / `enemyCharge` on
   `pools:chipped` (the rule's uncapped charge per side, pool-HP) and
   `fallenPower` on the chip record. Consumers that re-do the arithmetic
   today: `alphaStrikeStats` (`reporters.ts:1739-1746` blow/overkill =
   `last.enemy × chipMult`), `perEncounterStats` (`reporters.ts:1509-1512`
   taken/dealt = survivors × mult — the UNCLAMPED blow, so a death turn
   over-counts today), `aggregateTelemetry.meanPoolChip`
   (`telemetry.ts:229-261`). All three switch to the charges — under
   survivors `charge === survivors × mult` by construction, so every
   read is BYTE-IDENTICAL at the seam commit (the diff oracle). The
   harness already records deaths off `unit:died` (`harness.ts:559`) —
   under the flat table `Σ died power = deaths (+1 per legendary)`, a
   cheap independent recompute of the accumulator (the 72b lint).
8. **The rollout evaluator is already rule-agnostic**
   (`evaluator.ts:215`: `poolDamageTaken = before.playerHealth −
   after.playerHealth`, the applied delta) — register item 3 ✓, no
   change. BUT the bot's SENSORS re-derive survivor power in lockstep
   (`sensors.ts:526-570` `attritionRead` → the attrition-stall script's
   `powerΔ ≥ 0` signature; `:602-618` `focusTargetFeatures.power` "the
   pool chip this unit threatens" → the cohesion-focus weights). Under
   casualties a standing enemy threatens nothing; killing it costs THEIR
   pool. These are the old-rule habits criterion 2's RE-SEARCH exists to
   replace (§92) — §91 leaves the bot untouched (one change per paired
   read; the §85f leak shape named in the spec).
9. **`--set` coerces every value to `Number`** (`commands/run.ts:134`) —
   `--set=health.chipMode=survivors` reads NaN and the typo guard throws.
   Extend: a string value is admissible when the live key holds a string
   (one branch + a setArg pin); the §90 in-place `KNOB_GROUPS.health`
   mutation then makes a mode flip consistent live, in rollouts, and in
   `--jobs` children.
10. **The fatigue retarget has a deferred clamp to land.** `fatigueEffect`
    mods `power` (`fatigue.ts:44`); the retarget is `constitution: {mul:
    1 − rate}`, magnitude `min(stacks, 5)`. `Unit.ts:440-447` seeds
    spawn effects AFTER `currentHp = derived.maxHp` and says "no K1
    effect modifies constitution, so maxHp is unchanged" — `recomputeEffective`
    DOES re-derive `maxHp` (`Unit.ts:515`) but `currentHp` keeps the
    un-fatigued value ⇒ a fatigued unit would spawn OVER its max. The
    retarget lands the clamp the K1 comment deferred (`currentHp =
    min(currentHp, maxHp)` after seeding). Byte-neutral at rate 0 (no
    effect seeded). `statusEffects.test.ts:49-57` (the curve on power)
    re-targets; the 50% cap pins as a config-derived read of
    `fatigueMaxStacks` (5, beside `fatiguePerStack`).
11. **XP on death** (`xpFlatPerFallen` 20, `xp.ts:117`) — register item 4
    ✓ unchanged: the XP is the unit's, the pool is the side's.
12. **Summons** — ghoul base 0, growth 0.05 (round(0.05 × 9) = 0 at L10;
    1 at L20). Under growth 0 it is 0 forever; a summon that dies is a
    casualty at 0 — register item 2 ✓ by the table.
13. **The Run.test chip fakes** (`chipTurn`, `Run.test.ts:5126-5139`)
    emit `battle:ended` with `survivorPower` only. Under a casualties
    default an absent `fallenPower` must be a LOUD 0/0 for test fakes
    only (the `survivorPower ?? {0,0}` precedent at `Run.ts:2905`), and
    the ~15 chip tests that assert "enemy 5 → pool −5" re-express as
    fallen fakes at the default flip (91e) — the prediction to check.
14. `enemyHealth` inits from `encounter.healthPool` (7–10). Under
    casualties the enemy pool reads "their strength; every kill removes
    some" — a decisive win chips the wave's Σ power ≈ today's survivor
    chip (the spec's arithmetic). Untouched at §91; the flip read's
    enemy-side check (91f).

**Predictions, restated for the build:** World **v35 → v36** (item 1;
the spec's no-bump line is corrected in the same commit); Run v44 holds;
NO RNG stream shift (items 3, 10); summary.csv baselines BYTE-IDENTICAL
at the seam commits (91a1/91a2, default survivors) and at the fatigue
commit (rate 0); baselines RE-PIN twice — at the table (91b) and at the
default flip (91e).

### The adversarial review (2026-09-03 — the §85f tiger-team shape, run at this kickoff)

Reviewer: a fresh Claude Fable 5.1 instance (the strongest available
model at the time — a fresh context, not a different family), read-only,
handed the spec + ROADMAP §91–§93 + the audit + the DRAFT cut and the
spec's hunt list. Peer: a second read-only instance verifying every
claim at file:line before anything was believed. Tally: 12 findings —
5 CONFIRMED, 7 PARTIAL (citation precision or an inference overreach;
none reversed), 0 REFUTED; the reviewer's nine "could not fault" lines
all confirmed (exactly two death sites · `units.splice` only in
`removeUnit` · `reapDead` before `checkBattleEnd` · `playerRosterIds`
player-only · `spawn-overflow.test.ts:216` pins schema 35 ·
`hpPerConstitution` 1.0 · the fold rounds · rehydrate sets `currentHp`
after construction · `rollTurnWave` is a keyed derived stream). What
each finding changes in the cut, most severe first:

1. **Keep criterion 1 is pinned in absolute pool-HP** ("overkill ≥ 3")
   while §92 is licensed to move the pool max — the threshold would
   pass or fail on the lever. (`chipMultiplier` is already absorbed: the
   overkill is computed in pool-HP.) → ⛔ a PRE-REGISTRATION AMENDMENT
   for the user, before 91b: criterion 1 reads **≥ 0.15 × playerHealthMax**
   (= 3 at 20), and §92 names the pool max the §93 read is taken at.
2. **The 91f survivors leg flipped only `chipMode`** — draw turns would
   still charge by the casualty `capPenalty`, so the leg was not the
   survivors rule and the third leg not table-only. CONFIRMED. → the
   queue line carries BOTH `--set`s; the 91e harness pin asserts the
   mode PAIR; the 91a2 diff oracle is RUN (a worktree-pinned n=20 twin
   at the tag vs HEAD, same seeds), not assumed.
3. ⭐ **`winner === 'draw'` conflates the tick-cap draw with a MUTUAL
   WIPE** (`checkBattleEnd`, `World.ts:2197` / `:2228`, since 34a — the
   `reporters.ts:870` comment "checkBattleEnd never emits 'draw'" is
   stale). Under `capPenalty: survivors` keyed on `'draw'`, a mutual wipe
   — every fielded unit dead — would charge 0/0. CONFIRMED. → the cap
   penalty keys on the CAP only: `battle:ended` gains `reason:
   'decisive' | 'mutualWipe' | 'cap'` (from `resolveAsDraw`); the
   harness records it and the draw column splits by reason
   (`cappedDraws` becomes honest). ⛔ Replace-vs-surcharge is a stop:
   recommended **SURCHARGE** — a capped turn always pays its own fallen,
   and under `capPenalty: 'survivors'` ALSO the enemy's standing power
   (a stall never gets cheaper than fighting); "replace" would make
   stalling after heavy losses the cheap option.
4. **The tactical searcher is POOL-BLIND** (`src/bot/evaluator.ts:9/43/84-97`:
   material differential + `WIN_BONUS`, no pool read; the run-layer
   `tests/fuzz/rollout/evaluator.ts:215` is the only pool-aware
   objective) — a rule-aware kiting stall is structurally impossible
   for the bot, so the "searcher finds a free kiting vector" decision
   point cannot fire for the hypothesized reason; `capPenalty` ships as
   unguarded armor (Retreat, Round 9, is what makes stalling reachable).
   And the two 91f legs fight IDENTICAL battles until the pool trajectory
   reaches a run-layer decision. → stated in the plan; **91f-pre: a
   DESK pre-read** applies the casualty arithmetic to the 90d
   `results.json` battles (deaths per side under the flat table) to
   PREDICT the per-encounter cost and the player-pool burn before the
   box runs — the prediction the flip read is checked against. The peer's
   correction: `attritionStall.ts:179-182` still gates `evaluate` on
   `ownPower − enemyPower` (the nominator dropped it, the evaluate path
   did not) — a flat table changes its meaning on the non-audition tier;
   filed under audit item 8 (the §92 re-search's list).
5. **Criterion 2 is satisfiable by search EFFORT alone** (gradient =
   best-achievable − baseline; no re-search budget is pinned). → ⛔ a
   pre-registration amendment: the re-search runs at the finalist's
   recipe (`--preset=heavy --vectors=96 --seeds=32`, the 85g5 sampler
   seed) and compares against the survivors gradient RE-READ at HEAD on
   the new table (or a same-budget survivors re-search if §92 can afford
   the night) — never the archived number.
6. **Rollback was not one contiguous revert** under the draft order
   (kept seams interleaved with the table; the power table on neither
   the kept nor the revert list). CONFIRMED. → REORDERED: the kept seams
   first (91a1 → 91a2 → 91c → 91d), then the tag **`casualty-seams`**,
   then the experiment proper (91b the table → 91e the flip → §92): the
   revert range under ROLLBACK = `casualty-seams..§92-end`; ⛔ the user
   signs that **91b (the table) REVERTS** (it is the rule's, not the
   seams'). Measurement records (BALANCE / WORKLOG entries) commit
   SEPARATELY from code across §91–§92 so a range revert keeps the
   reads; ARCHITECTURE/DESIGN edits ride their code commit (they
   describe it and should revert with it — the AGENTS same-commit rule).
7. **The feel-verdict blinding** (criterion 4, "written BEFORE the
   numbers") is strained by the plan's own order: 91f publishes numbers
   before any playtest (PARTIAL — the shape-locked §91 exit requires
   that entry; 91f's reads are not keep criteria). → the SURVIVORS
   playtests (5 runs) happen NOW, at the tag, during the build; the
   CASUALTIES verdict is written at §93 on the rebalanced build BEFORE
   the user reads the §92 board (filed by the session; read after the
   verdict) — ⛔ a stop for the user to confirm.
8. **The charge-reading readers break on the 89c/90d batch shape** (the
   on-disk `poolChips` records carry no charge fields; a new reader
   would read `undefined`). CONFIRMED (the dirs live at
   `output/box-batches/…`, gitignored). → the readers fall back
   `charge ?? survivors × chipMultiplier`, pinned on an old-shape
   record — the third leg stays recomputable.
9. **Inherited `power` seams the audit did not list**: the arbitrated
   arm's packet targeting (`arbitratedStrategy.ts:572-581` via
   `maxPowerIndex` / `minPowerIndex`, `scored.ts:338-358`, lowest-index
   ties — under the flat table every non-legendary hand ties → slot 0
   always buffed / always discarded); `pass:weak` = `declineBelowPower(2)`
   (`policies.ts:167`, `registry.ts:63` — under the table only
   legendaries pass, coherent, left as-is and recorded); the UnitCard
   tooltip (`UnitCard.ts:258`), `health.ts:9-10`, `events.ts:80-84`,
   `PostTurnScreen.ts:3` docs. CONFIRMED. → 91b re-keys the two index
   pickers to (power, level) — power stays dominant, level breaks the
   ties (a fixed heuristic the re-search can't repair); docs at 91a2/91g.
10. **`--set` string admissibility needs a second site** —
    `balanceSweep.ts:104` throws "not numeric" (PARTIAL: the type at
    `:67` is `Record<string, Record<string, number>>`). → 91a2.
11. **The accumulator lint is off by summon deaths** (the harness counts
    every spawned unit's death, ghoul at 0). CONFIRMED. → the lint reads
    the per-archetype deaths and subtracts the summon archetype's.
12. **Decisions written as build notes that need a signature** — the
    World v36 bump vs the spec's no-bump line (a spec AMENDMENT, not a
    doc fix), replace-vs-surcharge, whether 91b reverts, which build
    carries the casualties verdict, the healer 0 → 1. → the shape-lock
    docket below.

Two peer-side notes for the record: the 90d cohort ran BOTH twins (the
peer read one manifest and saw only `59-regen-vector.json`; the queue
file carries regen AND `85g5-finalist-56` — no attribution issue); and
the review + verification cost ≈ 18 min wall, ~370k subagent tokens.

### The REVISED cut (2026-09-03 — post-review; pending shape-lock)

Order = the rollback story: the KEPT seams first, a tag, then the
experiment. Code and measurement records commit separately.

- **91a1** — World: the fallen-power accumulator at both reap sites
  (neutrals excluded; `effectiveStats.power` at death), serialized
  (**World v36** + the v35 reject; `spawn-overflow.test.ts:216` moves),
  `battle:ended` gains `fallenPower` + `reason: 'decisive' | 'mutualWipe'
  | 'cap'`. Pins: accumulator == Σ died power · a camp kill charges
  nobody · a summon at its power · the mid-battle round-trip · the
  reason per path. Byte-identical baselines.
- **91a2** — the modes + the telemetry: `health.chipMode` +
  `health.capPenalty` (zod enums, defaults **survivors** here);
  `resolveTurn(reason, survivors, fallen)` charges by `chipMode`, and a
  `cap` turn ADDS the survivors charge under `capPenalty: 'survivors'`
  (the surcharge); `pools:chipped` gains the uncapped charges;
  `turn:resolved` carries the applied chips; PoolChip / alphaStrike /
  perEncounter / meanPoolChip read charges with the `?? survivors ×
  mult` fallback (pinned on an old-shape record); the harness records
  `reason` and `cappedDraws` splits by it; `--set` string admissibility
  at BOTH sites; the survivors-arithmetic docs re-worded. Pins: a mode
  test per rule (headless, fallen fakes) · charge == survivors × mult
  under survivors · the overkill column off charges · the surcharge on a
  cap turn only (a mutual wipe never reads `capPenalty`). Exit: `npm test`
  + `fuzz:smoke`; EVERY summary.csv baseline byte-identical; ⭐ the
  worktree-pinned diff oracle RUN — one twin, n=20, tag vs HEAD, same
  seeds, `summary.csv` + `alpha-strike.csv` byte-identical.
- **91c** — the fatigue retarget at rate 0: constitution mul,
  `fatigueMaxStacks` 5, the currentHp clamp at seed; the curve / cap /
  rate-0-neutral pins. Byte-identical baselines.
- **91d** — the player-facing lines by mode: `previewPoolAtRisk` reads
  the hand under casualties (the 89e pin extended); the PostTurnScreen
  labels; the UnitCard tooltip. Browser-verified. **→ tag
  `casualty-seams`** (the ROLLBACK floor: everything above it stays).
- **91b** — the power table (REVERTS under rollback): `units.json` all 1
  (healer 0 → 1), stormcaller / shaman / prodigy 2, ghoul 0, growth 0 ×
  23; the config-derived pin; the (power, level) re-key of the two index
  pickers. Exit: baselines re-pin (count reported); no bump.
- **91e** — the default flip to casualties (BOTH modes) in `health.json`;
  the Run.test fakes carry fallen; baselines re-pin; a harness pin that
  walks a short run under EACH mode PAIR via `--set`.
- **91f-pre** — the DESK pre-read (local, minutes): the casualty
  arithmetic applied to the 90d `results.json` battles → the predicted
  per-encounter cost / pool burn / act clear under the table, filed in
  WORKLOG as the prediction 91f is checked against.
- **91f** — the flip read (box, ONE HEAD): the 90d twins × {default
  casualties, `--set=health.chipMode=survivors --set=health.capPenalty=survivors`}
  n=120, `--per-encounter --emit-results`, poll 120, est 3 h. THREE-way:
  casualties vs survivors@HEAD (the rule flip, paired) + survivors@HEAD
  vs the 90d floor-1 legs (the table alone, same seeds). Reads: win ·
  per-act clear · the applied per-turn shape · the overkill share (a
  PREVIEW, not a signing read) · the draw share BY REASON · the
  enemy-pool side → BALANCE (its own commit) naming the knob; WORKLOG.
- **91g** — docs: ROADMAP checks · WORKLOG · HANDOFF cursor ·
  ARCHITECTURE (event rows + World v36) · DESIGN (both rules documented)
  · the spec amendments (the bump, criteria 1 + 2, the playtest order)
  · GOTCHAS if anything bit.

### Shape-lock (2026-09-03, USER-SIGNED in chat)

The docket signed as proposed, every line: the criterion-1 amendment
(≥ 0.15 × playerHealthMax) · the criterion-2 amendment (the finalist's
recipe; the survivors gradient re-read at HEAD as the comparator) · the
cap penalty keyed on the tick cap only, as a SURCHARGE · the World v36
bump as a spec amendment · 91b (the table) REVERTS under rollback ·
healer 0 → 1 · prodigy 2 · the playtest order (survivors runs NOW at the
tag; the casualties verdict at §93 before the §92 board is read) · the
names (`chipMode` / `capPenalty` / `fatigueMaxStacks` / the tag
`casualty-seams`). One correction from the user, recorded above (item
3): prodigy is not enemy-only — it is recruitable via its event, which
changes nothing about the weight. The amendments are written into the
spec in this commit (pre-registration: signed BEFORE any casualties
number exists); the cut into ROADMAP §91.

### 91a1 — the fallen ledger (2026-09-03)

Landed as cut: `World.recordFallen` at BOTH reap sites (the step-1 death
check + `reapDead`), booked before the splice off `effectiveStats.power`
(the survivors’ stat), neutrals excluded by team; `WorldSnapshot` **v36**
(`fallenPower`; a v35 save is rejected — the dead are gone from `units`,
nothing else on the wire can rebuild them); `battle:ended` gains
`fallenPower` + `reason: decisive | mutualWipe | cap` (`resolveAsDraw` is the
only cap — the review’s finding 3 lands here, ahead of the mode that
reads it). Ten pins, every weight read from the unit’s own stats (the §91b
table moves nothing here): the decisive / mutual-wipe / cap partitions, a
neutral charges nobody, a summon at its own power, the periodic-status
reap path (a burn-tile DoT kill), fielded == survivors + fallen on both
sides over a fought 3v3, the v36 round-trip byte-faithful, a mid-battle
restore ending with the same ledger, the v35 reject;
`spawn-overflow.test.ts` pin 35 → 36. Prediction check: the ONLY moved
baseline is the schema pin — no fuzz baseline touched (the payload gained
fields nothing reads yet). Rides ARCHITECTURE (the event row + the World
note). One tooling note for the record: the tree is CRLF on disk (git
normalizes) — a script that anchors on multi-line text must normalize
line endings first; the first attempt matched nothing.

### 91a2 — the modes + the telemetry (2026-09-03)

Landed as cut, defaults **survivors / survivors** (the byte-identity leg).
The rule lives in `src/run/chipRule.ts` (`turnCharges`, pure, config
injectable): a turn charges by every rule named in {`chipMode`,
`capPenalty` on a `'cap'` turn} — so (survivors, survivors) is ONE rule
(never doubled), (casualties, survivors) is the surcharge, and a mutual
wipe never reads `capPenalty` (the review's finding 3). `Run.resolveTurn`
takes (reason, survivors, fallen), returns the APPLIED losses for
`turn:resolved` (the second-copy site is gone), and `pools:chipped`
carries the UNCAPPED charges (the 89d rider). Telemetry: `PoolChip` gains
the fallen half + `reason` + the charges (all optional — absent on the
89c/90d batches); the ONE legacy re-derivation is `chargeToPlayer` /
`chargeToEnemy` (`?? survivors × chipMultiplier`, the rule those batches
ran under); `perEncounterStats` / `alphaStrikeStats` / `meanPoolChip`
read charges; `BattleResult.reason` + the draw split (`capDraws` /
`wipeDraws` / `unlabeledDraws` beside the legacy every-draw
`cappedDraws`, rendered in the alpha-strike stdout — NOT a CSV column:
the exit criterion is byte-identity). `--set` takes a string when the
live key holds one, checked against the enum's literals (both sites:
`commands/run.ts` + `resolveKnob`). Pins: the chipRule matrix (8) · the
modes through the Run with fallen fakes (5, incl. the applied-vs-charge
split on a lethal turn and the pre-91a1 fake mapping) · the harness
structural pin re-expressed on charges · the readers on a
charge-disagrees-with-survivors record + the legacy shape · the `--set`
string knob · every cap-run draw labeled 'cap'.

⭐ **The diff oracle, RUN** (the cut's exit): the regen twin
(`59-regen-vector`, the full ARM) at n=20 `--per-encounter
--emit-results --jobs=8`, the tag `pre-casualty-experiment` pinned in a
detached worktree (node_modules junction) vs the 91a2 working tree, same
seeds, both legs in parallel (~4 min): **summary.csv · alpha-strike.csv
· per-encounter.csv · rosters.csv · decisions.csv (1.1 MB) all
BYTE-IDENTICAL**; results.json IDENTICAL once the five new fields are
stripped (20 runs, 5 wins each); on the HEAD leg every one of the 469
chips reads `charge == survivors × mult` (the survivors identity), and
the reasons split 465 decisive / 4 cap / 0 mutual wipe. The whole seam —
the ledger, the rule module, the modes, the readers, the harness — is
byte-neutral at the shipped defaults. What it does NOT prove: the
casualties branch's numbers (that is 91f); the mutual-wipe branch never
fired on this twin (the World pins cover it).

### 91-pre — the frost-coven ghoul fix (2026-09-03, found in the user’s survivors playtests)

The user’s report (two screenshots): a neutral camp shaman (`frost-coven`)
summoned ghouls that appeared in the passive tint with no level bar,
never finished materializing, and never moved; player shamans were fine.
Root cause at file:line: the summon op spawns onto the CASTER’s team
(`effects/interpreter.ts:356`), and `World.spawnSummon` never stamped the
summoner’s `campId` — so a camp shaman’s ghoul was a neutral with no camp:
`isInertNeutral` true → the renderer’s WALL path (passive tint, no
overlay, the fade never resolving), no camp hostility to act on, and —
since only destructibles and camp members are legal neutral targets
(`World.ts:2178-2180`) — untouchable. One symptom, three faces. The fix
(user-signed, including the design call): the minion inherits the
summoner’s `campId` and takes the camp member’s wiring
(`CampWanderBehavior`, the 75f shape) instead of the catalog movement;
as a member it counts toward the camp’s wipe (`campCleared`), so a camp
is not cleared while its ghouls stand — the drip-aware definition
extended one step. A faction summoner’s minion is unchanged. Repro
headless-first in camps.combat.test.ts (the interpreter’s exact call on a
dripped member: stamp · behavior · passive-scenery / hostile-target · the
wipe stamp waits for the ghoul), and the CONTROL PROBE run: on the old
`spawnSummon` the pin fails on `campId` null vs 1 — the test measures the
bug, not itself.

**Placement (the user’s question, answered):** it lands NOW, between
91a2 and 91c — i.e. BEFORE the `casualty-seams` tag — so a §93 rollback
keeps it by construction (anything after the tag survives only by
cherry-pick, the fragile shape finding 6 removed). Cost, named and
accepted by the user: the sim half moves fuzz baselines wherever a
shaman camp rolls, so the 91f “table alone” comparison against the 90d
legs carries a second, small, legible change (neutral-shaman battles
only) — bounded at 91f-pre on the desk read. The pre-commit smoke will
say whether any pinned baseline moved.

**The second report — the ghoul sprite “clipping into the ground” — is
NOT a bug by the tree’s own record:** the ghoul glyph is `g`, the census’s
lone descender unit glyph, and the 79d2 stand-line rule (USER-SIGNED at
the 79d2 design talk, `glyphs.ts:212-227`) chose “terminal-faithful”:
letterforms stand on the font baseline, so `g` dips its tail below the
line like text on ruled paper, explicitly instead of standing
tail-tip-on-tile with a raised bowl. Re-opened as a decision for the
user (not re-decided here): keep the rule · lift descenders to stand on
their ink bottom (a one-branch change to `baseAnchorYFor`, headless-
pinned, render-only) · or swap the ghoul glyph (a font rebuild).

### 91-pre2 — the terminal-cell stand line (2026-09-03, from the user's playtest report)

The second half of the playtest report — "the ghoul sprite clips through
the ground" — was NOT a bug by the tree's record: 79d2's user-signed rule
put the font BASELINE on the tile, so `g` (the roster's lone descender)
dipped its tail below the line "like ruled paper". Put back to the user
with the record, the answer was that the 79d2 option had been misread at
signing; what they want is the TERMINAL CELL: the quad is the cell, its
bottom stands on the tile, and the baseline sits a fixed distance above
it that is "enough to fit descenders" — the clickbox stays the ink bbox
plus a few px (which is already `padInk`, 79a). Signed 2026-09-03:

- **The rule** (`baseAnchorYFor(ink, baselineY, descenderRoom)`,
  glyphs.ts): letterforms anchor at `baselineY − descenderRoom`; the
  floor family (`▄` `╥`, and the unmeasured fallback) stays on the quad
  bottom, untouched. `descenderRoom = 0` is the 79d2 line exactly (the
  old pins keep it as a named case).
- **The room is MEASURED, not hand-set** (`descenderRoomFor`): the deepest
  registered letterform ink bottom below the baseline, plus
  `DESCENDER_BARRIER_PX` 3 (the same 3px the clickbox pads by) — computed
  at atlas build off the ink just rasterized (the 79e principle: from the
  asset, never a census). A future deeper glyph lifts the whole line
  instead of clipping; a one-row overshoot (round letters) counts as a
  one-row descender, which is correct and pinned.
- **The tension, named at signing:** 79d2 existed because the pre-79d2
  cell-bottom anchor floated the ink a quarter cell up (the rally X). This
  rule floats it by exactly the room — 0.199 cell here (13 rows of 64:
  baseline 0.2615, deepest ink 0.109 at `g`/`@`, +3px) instead of 17 —
  by design. Rider: the objective marker X rises with the line; retune
  `OBJECTIVE_MARKER_TILE_LIFT` down if it reads as floating (eyeball).
  ⚠ Walls (`#`) are letterform-classified (ink bottom 0.266) and rise
  with the line too — consistent with "a character in a cell", but a
  visible change the user should eyeball natively.

**Verification, re-derived from the asset (the 79e/79g lesson):** a
browser probe recomputed the room independently off `inkByGlyph` (the
raw measured cells) and the baseline — 47/47 glyphs, expected anchor ==
`baseAnchorY`, 0 mismatches: every letterform at −0.4375 (one shared
line, 4px above the quad bottom), `g` and `@` clearing the tile by
exactly 3.0px, `▄`/`╥` at −0.5. Then a live battle (68 sprites — walls,
M/a/B/z): every `aAnchor` attribute the SpriteRenderer wrote equals the
atlas rule, 0 mismatches. Headless: 22 inkRect pins (the rule at room 0
and at a room; the room's exclusion of the floor family; the overshoot
row; the barrier clearance invariant). Render-only — no baseline risk;
lands before `casualty-seams` beside the ghoul fix.

### 91-pre2b — the objective markers under the terminal-cell line (2026-09-03, the user’s eyeball find)

The rider named at 91-pre2 was real: the rally X and the focus ! are
base-anchored sprites, so the room lifted their INK by `room × size`
(0.199 × 1.6 ≈ 0.32 world units for the tile X) above the designed gap.
Fix: `FontAtlas.inkBottomLift(glyph)` (the anchor→ink-bottom twin of
`inkTopLift`), and both marker placements subtract it × their size, so
the gap is stated on the INK under any stand-line rule: the tile X’s ink
stands `OBJECTIVE_MARKER_TILE_LIFT` (0.1) above the cell’s ground point,
the ! mark’s ink `OBJECTIVE_MARKER_ENEMY_LIFT` (0.2) above the target’s
ink top (the renderer now remembers the marker’s current glyph, since X
and ! have different ink bottoms). Browser-verified by re-derivation
(raw `getGlyphInk` + each sprite’s own `aAnchor`/`aSize` attribute, the
camera-up projection off `matrixWorld` — never `inkBottomLift` itself):
tile X ink bottom above ground **0.1000** (anchor lift −0.225 absorbing
the room); focus ! ink bottom above the target a’s ink top **0.2000**.
A tooling note: the battle clock only advances on animation frames, and
the Browser pane goes hidden while tools run, so the probe drained the
objective command with one manual `world.tick()` + `battleRenderer.update()`
— the same reason a “stalled” preview battle is not a sim bug.

### 91c — the fatigue retarget at rate 0 (2026-09-03)

Landed as cut. `fatigueEffect` now mods `constitution: { mul: 1 − rate }`
at magnitude `min(stacks, fatigueMaxStacks)` (the new `health.fatigueMaxStacks`
5, zod `int().positive()`, an injectable third arg beside `rate`); the
K1 fold recovers `constitution × (1 − rate·stacks)` exactly, so the spec's
curve reads −10%/stack, flat past 5 stacks = −50%. Why constitution: under
the casualties rule `power` is what a fallen unit COSTS, so the old power
debuff made a tired unit CHEAPER to lose — the retarget puts the penalty
where it reads (less starting HP on the field). The deferred K1 clamp lands
in the `Unit` constructor: after seeding, `currentHp = min(currentHp,
derived.maxHp)` — the first constitution consumer would otherwise spawn OVER
its max. Placement per the signed cut (at seed): fatigue is seeded at spawn
only (`endOfTurn`), and a sweep of `config/*.json` + `src/` found NO other
effect that touches constitution, so the clamp is the identity on every
existing spawn; the snapshot rehydrate path overwrites `currentHp` after
construction regardless. A RUNTIME constitution effect (`addEffect`
mid-battle) would still need the clamp in `refreshDerived` — deferred to the
first such consumer, noted at the seam. Pins (+7, all re-derived from the
fold + `deriveStats`, never from `Unit`): the constitution curve · power
UNTOUCHED (the retarget's point) · starting HP through `deriveStats` (config
`hpPerConstitution`) · the stack cap (magnitude tracks stacks to
`fatigueMaxStacks`, then holds; at the spec's 0.1 the cap is 50) · the
explicit-maxStacks seam · the spawn-at-max clamp with the production effect
(fatigue.test) and with a generic constitution debuff + the byte-neutral
non-constitution leg (Unit.test); the Run-level fatigue block re-expressed
on constitution (folded stats ARE the base object at rate 0; at 0.6 the
fielded constitution and maxHp fall, power holds, the roster is untouched);
statusEffects' curve pin re-targeted. 2759 main green (2752 + 7), typecheck
clean.

⭐ **Byte-identity, RUN two ways** (the scratchpad's "n=20 oracle as the
default exit"): `scripts/perf-oracle.sh HEAD` (the mechanized 47e oracle —
worktree-pinned `6b348b5` vs the dirty tree) PASSED on its two shapes
(scored n=4: summary `fabc597e5466` · rosters; ARM n=1 hops=5: summary
`da56367572a1` · decisions `9a377b1bb2ed` · rosters) AND on a new optional
third shape — the script gained `ORACLE_EXTRA_SHAPE="<flags>"` (a shape
'extra' on both trees; every emitted CSV compared, results.json deliberately
not) — run as the regen twin, full ARM, n=20 `--per-encounter
--emit-results --jobs=8`: summary `5bdf7fbc2939` · decisions `4e2f1d13e5d4`
· per-encounter `5e53a6d848f8` · alpha-strike `3e4054a39587` · rosters
`67f1795c1ad2`, ALL identical (~12 min for the three shapes sequentially;
the per-shape CSV list is now summary + decisions + per-encounter +
alpha-strike + rosters, n/a when a shape doesn't emit one). The mechanism
is a provable null at rate 0 — `fatigueEffect` returns before the new code
— but the oracle is what makes the claim a measurement.

### 91d — the player-facing lines by mode (2026-09-03) → tag `casualty-seams`

Landed as cut, plus one small addition. The arithmetic stays in
`chipRule.ts`; a new pure `src/ui/chipLabels.ts` owns what the screens SAY
about it, keyed on the rule SET a turn pays, so the three surfaces flip
together at 91e and a two-rule cap turn says so instead of mislabeling one:

- **The risk line** — `chipRule.playerExposure(fielded)`: under survivors
  the WAVE's Σ base power (89e's preview, unchanged), under casualties the
  HAND's Σ base power (the player's own numbers, free at the gate); × mult,
  the caller clamps at the pool. The cap-turn SURCHARGE is deliberately
  OUTSIDE the bound (documented at the method + the helper): the line bounds
  the ordinary turn; a stall is the exception the surcharge exists to make
  expensive, and folding it in would inflate every ordinary turn's number
  by the whole wave. The PreTurnScreen's hover text reads by mode.
- **The PostTurnScreen** — `turn:resolved` gains `reason` (Run's resolved
  `why`, so a reason-less fake maps 'draw' → 'cap', else 'decisive');
  `chipLineLabels(rulesForTurn(reason))` labels the two chip lines: opposing
  survivors / own fallen / both. The one addition beyond the cut: a draw
  heading names its kind ("Skirmish Drawn — tick cap" / "— mutual wipe") —
  the surcharge's trigger should read differently from the largest casualty
  turn, and the user's playtests are where that reads first.
- **The UnitCard power tooltip** — `powerTooltip(mode, team)`: the compact
  battle cards say "what YOUR pool loses if this unit falls" / "what the
  ENEMY pool loses when this unit falls"; the side-agnostic stat rows
  (roster / recruit / promotion) say "its side's pool"; survivors keeps
  "chips the opposing health pool each turn it survives".

Pins: `playerExposure` (wave vs hand × mult, uncapped, the live default) ·
the 91d Run pin (under `HEALTH.chipMode = 'casualties'`, mutated + restored:
`poolAtRisk` == the payload's OWN hand templates summed by hand, turns 1 and
2 against the live pool; `turn:resolved.reason` follows the documented fake
mapping) · `chipLabels.test.ts` (each rule set names the RIGHT quantity on
each pool and never the wrong one; the two-rule set names both; composed
with `rulesForTurn` the same turn reads differently by reason; the title +
tooltip words per mode). The 89e survivors pins stand unchanged.

**Browser-verified, BOTH modes, off the DOM** (the mode flipped by a
temporary `health.json` edit, reverted before the commit): survivors —
pre-turn "up to 8 pool" with the wave hover text, six stat rows reading
"chips the opposing health pool each turn it survives", post-turn "Your
survivors → enemy pool −6" / "Enemy survivors → your pool 0", enemy 8 → 2;
casualties — pre-turn "up to 6 pool" re-derived from the six cards' OWN
power-row values (1 each — the DOM, not the preview method) with the hand
hover text, every stat row "what its side's pool loses if this unit falls",
in battle the compact cards split by side ("your pool loses" / "the enemy
pool loses"), post-turn "Enemy fallen → enemy pool −9" / "Your fallen →
your pool −2", pools 18/20 · 0/9 (two power-1 losses; the wave's power past
the enemy pool, clamped at 9). A tooling note for the record: the Deserters
wave took ~2.5 min of wall at 3× before the outcome screen mounted — the
battle DOES advance across `wait` actions here (the 91-pre2b probe's
hidden-pane stall did not recur), just slowly.

The tag **`casualty-seams`** goes on this commit: everything at or below it
(the ledger, the modes, the telemetry, the fatigue retarget, the lines by
mode, the three pre-fixes) is KEPT under either §93 outcome; a rollback is
one contiguous revert of what lands above it (91b → §92).

### 91b — the power table (2026-09-03) — the first commit ABOVE the tag; REVERTS under rollback

Landed as signed: `units.json` power = **1** everywhere, **2** for the three
legendaries (stormcaller / shaman / prodigy — prodigy on both sides, the
kickoff's correction), **0** for the ghoul (the one summoned archetype),
**healer 0 → 1** (a lost healer costs pool — the user's kickoff call), and
`growthRates.power` **0** for all 23 combatants. The surgery ran through the
archetype editor's `formatArchetypesJson` (byte-faithful on the current file
modulo the trailing newline, checked before writing), so the diff is exactly
the 27 changed fields — 27 lines, no formatting noise — and the 83d rule held:
the printout enumerated every id with its power / growth / rarity after the
write.

**The pin** (`units.test.ts` §91b): config-derived on both axes — the
legendary set from `rarity`, the summon set from the ABILITIES catalog (the
archetype any `summon` op spawns; pinned to be exactly `{ghoul}` today) — so a
new legendary or a new summon fails until its weight is set on purpose; one
`it.each` row per combatant (23) + the three-row sanity + the {0,1,2} sweep.
**The re-key**: `maxPowerIndex` / `minPowerIndex` (the arbitrated arm's
packet nominators, `scored.ts`) compare (power, level) — power dominant,
level breaks the tie (max → the highest level, min → the lowest), a full tie
keeps the lowest index so every old pin holds; without it the flat table
would have buffed / discarded slot 0 forever (audit item 9). 3 pins in
`scored.test.ts`.

**Re-pin count: ZERO** — the cut's "baselines re-pin" prediction did not
materialize: 2792 main (2767 + 25) + 559 fuzz:smoke (556 + 3) green on the
first run, typecheck clean. The fuzz determinism pins are run-vs-run
equalities (`toEqual(a, b)` across two drives), not literal outcomes, so a
table that moves every outcome moves both sides together. The CONTROL that
the table is live: `scripts/perf-oracle.sh HEAD` **FAILS on all five
compared CSVs** (scored summary + rosters; ARM summary + decisions + rosters
— e.g. summary `fabc597e5466 → f1a85269c1ec`), exactly as predicted (L10
power 1.9 → 1 and legendary 1 → 2 change survivor chips under the shipped
rule) — the opposite of 91c's PASS, and the reason the 91f read is
three-way (survivors@HEAD ≠ the 90d legs by the table alone). Rider → §92:
the derived-artifact registry's trigger fires (a sim change that moves item
values) — the prior table + roster table re-derive at the §92 amendment
board, not before (BALANCE §"The derived-artifact registry").

### 91e — the default flip (2026-09-03) — the tree now PLAYS casualties

`config/health.json`: `chipMode` + `capPenalty` → **`casualties`** (one rule
again — a stall pays only its own fallen; the surcharge pair is the 91f
decision point, armed by `--set=health.capPenalty=survivors`). The `health.ts`
doc rows re-worded (shipped survivors through the seam commits; casualties
since 91e).

**The fakes** (audit item 13, the prediction that held): 72 tests failed on
the bare flip — every chip fake emitted `survivorPower` alone, so under
casualties nothing chipped, encounters never resolved, and the cascade
reached the port / reward / snapshot / camp suites. The re-expression is ONE
idea, not ~15 rewrites: a fake states the chips it WANTS in both vocabularies
— `chipTurn(bus, chips)` emits `survivorPower: chips` AND the mirrored
`fallenPower: { player: chips.enemy, enemy: chips.player }` (an explicit
`extra.fallenPower` wins); `winEncounter` / `loseEncounter` / the three
inline fakes in `Run.test.ts` and the three in `determinism.test.ts` carry
the mirror too. Under either shipped mode the applied losses are identical
(the shipped pairs are one rule each; a cap turn under two DIFFERENT modes
would double up, which is why rule-SPECIFIC tests set `HEALTH` themselves —
the 89e wave-bound pin now names `survivors` explicitly, mutated + restored,
beside its 91d casualties twin). `runRollout.test`'s `DRAW_CHIP` (0/0) needed
nothing.

**The integration pin re-expressed**: `encounter-loop.test`'s "a tick cap
chips BOTH pools" was survivors-specific (a 1-tick cap has NO fallen). It now
drives one real 1-tick-capped World per turn under three pairs — (survivors,
survivors) · (casualties, casualties) · (casualties, survivors) — and asserts
off `rulesForTurn('cap')`: a pair that reads survivors dents both pools on
turn 1; the shipped pair charges nothing and runs to `maxTurns` (the
pool-fraction tiebreak ends it); every pair terminates inside the cap. (The
enemy pool is the ENCOUNTER's authored `healthPool`, read off
`run.enemyHealthPoolMax` — the first draft compared against the global max
and read 10 vs 8.)

**The per-mode-pair harness pin** (`tests/fuzz/harnessChipMode.test.ts`, the
cut's last line): all FOUR pairs, the modes written the way `--set` writes
them (`resolveKnob('health.<key>')` → the live object, in place), a
`hopCount: 2` pure-random run with telemetry per pair; on every recorded
chip `playerCharge / enemyCharge == turnCharges(reason, survivors, fallen)`
under THAT pair and `applied == min(charge, poolBefore)`; plus the control
that the modes are not interchangeable (the same seed's first chip charges
differently under survivors vs casualties — the battle is seeded before the
rule reads) and the pin that the shipped default IS (casualties,
casualties).

**Re-pin count: ZERO, again** — 2792 main (unchanged: re-expressions, no new
main pins) + 565 fuzz:smoke (559 + 6) green, typecheck clean. Byte-identity
is NOT claimed (the flip changes the rule by design; 91f measures it). What
the tree plays now: casualties on the 91b table — the experiment's arm. The
user's SURVIVORS playtests belong at the `casualty-seams` tag (old table,
survivors), never at HEAD.

### The user's first casualties playtest (2026-09-04, at 91e — INTERIM feel, pre-§92; NOT the §93 verdict)

The user's report, verbatim in substance (one run, won):

1. Most basic "swarm" fights end with the enemy dying in ONE turn — as they
   suspected. 1.1 Unless the swarm is ghouls: "those fights feel weird."
2. Fights built around one or two really strong enemies don't feel great
   any more — they end up dealing minimal pool damage.
3. Together these suggest some sort of POWER OVERRIDE in the encounter
   designer, maybe.
4. Healing kept pace with the new damage levels reasonably (the run was won).
5. "We definitely nailed the feel of health steadily dropping."
6. The biggest issue: some fights really easy, others slogs.
7. A target feel: **2–3 turns for most encounters, elites 4–5, bosses 6+**
   — "pure vague vibes" (the user's words) for the numbers.

The code-reality read behind each (off `encounters.json` + the table):

- **(1) the one-turn swarms are arithmetic.** Under casualties the enemy pool
  falls by the wave's fallen power; normal waves are `hand × 1.3–2` = ~8–12
  units at power 1 against pools of 7–10 (brigands 7 vs ~8; highwaymen 10 vs
  ~12; deserters 9 vs ~12). A wipe clears the pool in one turn by
  construction. Turns-to-clear under this rule ≈ pool ÷ (wave power killed
  per turn) — so the lever is the per-encounter `healthPool` RELATIVE to the
  wave's Σ power, and it is already authored per encounter (no new
  mechanism): pool ≈ T × expected wave power for a T-turn fight. That is the
  §92 sheet's job; the user's (7) are its working per-kind targets.
- **(1.1) the ghoul swarms are a DEFECT of the summon-0 premise, not a feel.**
  The table zeroes the ghoul by ARCHETYPE ("the one summon"), but two
  encounters FIELD ghouls directly — `plagueVictims` (pool 10, `hand × 2`,
  ghoul weight 4 vs healer weight 1 ⇒ ~9–10 of ~12 units are worth 0; a full
  wipe chips ~2–3) and `plagueDoctors` (3 corrupters + ~6 ghouls, pool 7) —
  and two camps (`ghoul-nest`, the barrow-haunt) do too. Killing them
  progresses nothing: the "weird" is the enemy pool not moving while the
  field empties. Proposed fix (a spec AMENDMENT — user decision, cheap):
  weight a unit 0 in the fallen ledger by the `summonedBy` STAMP (spawned by a
  `summon` op, `World.spawnSummon`) instead of by archetype; the ghoul row in
  the table becomes 1 like everyone else; the config-derived pin re-expresses
  (no summon-set row; a ledger pin that a stamped summon reaps at 0). Then a
  summoned ghoul still costs its side nothing and a fielded ghoul is a body
  like any other. Should land BEFORE 91f measures, or the read carries the
  artifact on both plague encounters (→ a 91e2 insert, pending the user).
- **(2) the strong-enemy fights are two facts.** (a) Threat to the PLAYER
  pool under casualties = kill rate: a lone strong unit that kills one of
  yours a turn costs you 1 — inherent to the rule, not a tuning miss; the
  levers are lethality / composition (a heavy hitter plus fodder — but the
  fodder's deaths cost the ENEMY), or, if the rule is kept, a hybrid at §93
  (the surcharge already mixes rules on a cap turn; a partial-survivors mix
  is the same machinery). (b) Progress on THEIR pool when the big unit dies
  = its weight: 1 (or 2 for a legendary) against pools of 7–20 — the "slog"
  half of (6) for boss-shaped waves (banditQueen / witch-hunt pool 20 vs
  ~8–9 power per wave). The user's (3) — a per-encounter POWER OVERRIDE in
  the designer — addresses (b) directly (the Bandit King "worth 6" reads
  fine under "add your own numbers"); it is buildable (an optional
  `power` on a wave unit entry, stamped by the resolver) but DIVERGES from
  the pre-registered "power = headcount weight fixed per archetype" — so it
  is a §92 DECISION POINT, not a build now.
- **(6) easy-vs-slog is the pool/wave-power RATIO spread across the
  catalog**: brigands ~0.9 (one turn) · darkMagicPosse 7 vs ~4 · plagueVictims
  ~3+ effective turns of zero-cost kills · witch-hunt 20 vs ~9. The §92
  re-anchor flattens the spread to the (7) targets by kind.
- **(4)(5)** are the experiment's positive reads — filed as-is for §93.

What this changes in the plan: 91f-pre (the desk pre-read) now ALSO predicts
turns-to-clear per encounter off the 90d kills (pool ÷ fallen-per-turn) and
checks it against (7); the ghoul weighting is a pending insert (91e2) before
91f; the power override is a §92 decision point. Nothing built off this
report yet — it is the feel record the numbers get checked against.

### 91e2 — summons weigh 0 by the STAMP, not the table (2026-09-04, user-signed in chat)

The premise the 91b table carried ("ghoul = the one summon ⇒ power 0")
was false in the catalog: `plagueVictims` / `plagueDoctors` and the
`ghoul-nest` / barrow-haunt camps FIELD ghouls. Landed: `World.recordFallen`
returns before booking when `unit.summonedBy != null` (the §29d stamp
`spawnSummon` sets — the same signal the summon-XP ledger and the `maxLive`
cap already key on), so a conjured body costs its side nothing whatever its
archetype weighs; `units.json` ghoul power 0 → **1** (one field, through the
formatter, verified) — a fielded ghoul is a body like any other. The pins:
the 91a1 "a summon books its own power" pin re-expressed as "a summon books
0 by its stamp, and its archetype is NOT free" + a new sibling "a FIELDED
ghoul (no stamp) books its table power" (World.test); the §91b table pin
drops the summon row (power ∈ {1,2}, legendary ⇒ 2; the ghoul pinned at 1
with the reason). The spec's table bullet amended in place; `events.ts`'s
`fallenPower` doc notes the identity survivors + fallen = fielded now
excludes fallen summons. 2793 main (+1) + 565 fuzz green, typecheck clean;
no byte-identity claim (the two plague encounters + both ghoul camps now
chip when their ghouls fall — the point). Design note for §92: this also
means a summoner's minions are free bodies for the ENEMY too (the warlock's
ghouls die for nothing), which is the intended reading — summoning is
tempo, not headcount.

### 91f-pre — the DESK pre-read (2026-09-04): the prediction 91f is checked against

Method (a scratchpad probe, not repo-resident): the 90d floor-1 twins'
`results.json` (regen `20260903-032344-71a5000`, deploy `-042229-`; n=120
each; every battle record = one TURN's World with `playerDeaths` /
`enemyDeaths` / the wave size, and the applied survivors chip beside it in
`telemetry.poolChips`). Casualties applied FIRST-ORDER: a side's pool loses
deaths × 1 per turn (the 91b table at power 1 — legendary waves are an
UNDER-estimate by 1 per legendary death: darkMagicPosse / elementalTrio /
plagueSpreaders / witch-hunt; summoner waves an OVER-estimate on the enemy
side since 91e2 zeroes summoned ghouls: warlock / miscreants), the enemy
pool = the encounter's authored `healthPool` (read off the chip record).
Per encounter instance (consecutive turns at one node): the predicted
turns-to-clear = the first turn where cumulative enemy deaths ≥ pool
("unresolved" = the survivors run ended the node before that — the
casualties fight would have run LONGER than the record shows); the
predicted player cost = Σ player deaths over those turns. The battles
themselves are taken as-is (turn 1 of each node is byte-identical across
rules; later turns diverge — the read is a bound, not a simulation).

**Prediction 1 — the PLAYER pool is the knob, and it moves ~2×.** Per run,
the player pool lost (Σ applied) under survivors vs predicted under
casualties: regen **29.8 → 65.2** · deploy **27.3 → 49.5** (truncated at
the predicted clears; 95.5 / 80.3 if every recorded turn were fought).
Act 1 alone: **15.4 → 33.3** · **11.7 → 21.9**; runs whose predicted act-1
loss reaches a whole pool (20, heals ignored): **102/120** (regen, vs 49
actual) · **65/120** (deploy, vs 33). So at UNCHANGED config the paired
flip read should show win rate and act-1 clear falling sharply on both
twins — regen (0.308 win / 0.675 act-1 clear) and deploy (0.475 / 0.825)
both well under, act-1 clear plausibly near or below 0.5. The mechanism
is the ARM, not only the rule: the finalist vector was searched under
survivors, where a player death cost nothing (~4 player deaths per normal
encounter, 10–13 per boss); casualties price exactly the behaviour the
searcher learned to spend. **91f measures the rule on a MALADAPTED arm —
the drop is expected and is not the verdict; the shape reads are.**

**Prediction 2 — the enemy side runs SHORT of the user's turn targets, by
~2× on every kind.** Predicted turns-to-clear (resolved instances) vs the
target: normal **1.31 / 1.35** vs 2–3 (57% / 54% of normals clear on turn
1 — deserters / highwaymen / plagueVictims 0.96–1.00, artillery / brigands
/ plagueDoctors 0.88–0.95); elite **2.04 / 1.80** vs 4–5 (darkMagicPosse
clears turn 1 in 82% / 97% — 13–19 kills against pool 7); boss **2.74 /
2.84** vs 6+ (banditQueen / witch-hunt 3.2 against pool 20; bandit-king /
generalissimo 2.4–2.5 against 13). The one-turn swarms the user felt are
the record's modal normal. And the OTHER failure mode is in the same
table: the small-wave fights are "unresolved" — adventurer-with-guards
0.51 / 0.46, ronin-vs-mages 0.71 / 0.74, elementalTrio 0.47 / 0.31,
infernalColumn 0.27 / 0.50 — waves at hand × 0.7 or fixed counts whose Σ
power sits under the pool, so a clear needs two or more full wipes: the
user's slogs. Easy-vs-slog = the pool ÷ wave-power spread, in numbers.

**Prediction 3 — elites lose their bite relative to normals.** Predicted
per-encounter player cost vs actual: normal **1.2 → 4.0 / 1.1 → 3.3**
(×3.3 / ×2.9), elite **7.4 → 9.9 / 7.0 → 8.2** (×1.3 / ×1.2), boss **7.6 →
12.8 / 7.9 → 11.7** (×1.7 / ×1.5). The elite ÷ normal cost ratio falls
from ~6 to ~2.5 — the user's "strong enemies deal minimal pool damage" is
a RELATIVE statement and the arithmetic agrees: under casualties a few
strong units kill slowly, a swarm kills more of yours.

**What 91f should therefore show, in order of confidence:** (a) the player
pool burn roughly doubles per encounter, most on normals; (b) both twins'
win / act-1 clear drop well below the 90d floor-1 numbers, more on regen;
(c) the enemy side: most normals clear in one turn, the four small-wave
encounters lengthen, bosses ~3 turns; (d) the cap-draw share — no
prediction from this data (the 90d record has no reason column; the
searcher is pool-blind so kiting has no incentive to change) — this is the
91f decision-point read and it stays open. What the desk read CANNOT
say: the overkill share (criterion 1 — no per-death HP in the record) and
anything about a re-searched arm (§92). The §92 lever the numbers point
at, for the record: enemy pools ≈ 2× to reach the turn targets on
swarms, with the small-wave encounters needing composition or count
changes rather than pool changes (their Σ power is the binding term).

### 91f — the flip read (2026-09-04; numbers BALANCE 2026-09-04 §91f)

The cohort: `scripts/box-drive.sh tests/fuzz/output/queue-91f.txt
--poll=120 --est-hours=2.5 --artifact=results.json` at `4c06999` (pushed
first — the user granted standing push permission for box runs this
session; saved to the agent memory), 4/4 verified, ~3.6 h (the 2.5 h
estimate missed because the new-table survivors legs fight ~30% more
turns — a pacing fact, not a driver fault; the 2× hatch never armed),
box `abox-20260904-135117` destroyed on drain. The log monitor pattern
(launch / fetched / HOLD / refus / error / destroy / EXIT) caught every
transition; the tree stayed untouched until the fourth launch fired.

**Findings, in the order the cut asked for them:**

1. **Which knob moves: both pools, the player's most, and the ARM decides
   how much.** Regen collapses (win 0.267 → 0.042 paired 28:1), deploy
   holds (0.392 → 0.300, 27:16; act-1 clear unchanged at 0.82). The two
   finalists were searched under a rule where a player death was free;
   the regen vector spends units and casualties prices exactly that. So
   the flip read says less about the rule's viability than about the
   arm — the §92 RE-SEARCH is the experiment's real first number, as the
   spec's criterion 2 always said (the finalist's recipe re-run under the
   new rule, the survivors gradient at HEAD as the comparator).
2. **The table is its own experiment.** Survivors@HEAD vs 90d moved every
   headline (win −4 / −8, act-1 +7.5 / −3.3, turns +31% / +27%, overkill
   ≥ 3 down 0.14 / 0.23) on the same rule and seeds. Two consequences: the
   §93 rollback range (91b upward) reverts a table that CHANGED the old
   rule's game too — a rollback is not "back to 90d" without re-reading;
   and criterion 1's instrument is reading the roster mix (the table
   shrank every unit's chip weight; the overkill share is computed off
   deaths' HP margins on a longer, differently-composed fight), so the
   §93 keep read must compare LIKE tables.
3. **Pacing is bimodal and half the target.** The swarms clear on turn 1
   (six normals at 1.00–1.10); the four small-wave encounters run 2–3.4;
   elites 2.4 / 3.0 and bosses 2.75 / 2.9 sit at roughly half the user's
   4–5 / 6+. The §92 levers the numbers point at: enemy pools ≈ 2× for the
   swarms (pool ≈ turns × wave power), and composition / count for the
   small waves (their Σ power under the pool is the binding term — a
   bigger pool there makes a longer slog, not a better fight); the
   per-encounter power override the user floated is the third lever for
   boss-shaped waves (their pool 13–20 vs ~8 power per wave).
4. ⛔ **The `capPenalty` decision point.** The cap-draw share ROSE under
   casualties on the deploy twin (0.034 vs 0.010, 74 vs 34 capped turns)
   and held flat on regen (0.022 vs 0.018). The ROADMAP rule says the
   default flips to the surcharge (`capPenalty: survivors`) on a rise.
   The honest mechanism: the searcher cannot stall on purpose (it never
   reads the rule), so the rise is a MIX shift — once swarms clear in one
   turn, a larger share of the remaining turns are the slog fights where
   the tick cap bites (ronin-vs-mages, the guards) — not a kiting
   incentive. The docket, for the user: **(a) flip** `capPenalty →
   survivors` — the surcharge costs an ordinary turn nothing, arms the
   rule against a HUMAN stall (the read the rule was written for), and
   the criterion as written is met; the cost is that 2–3% of bot turns
   get pricier on the §92 board and the shipped pair becomes two rules
   (the PostTurnScreen already labels it); **(b) hold** `casualties` —
   one rule, the rise is compositional, revisit at §93 with the human
   playtests as the stall read. Recommendation: (a) — the surcharge is
   armor, the searcher is not the threat it guards against, and a
   compositional rise is still a rise in how often the cap decides a
   fight. Either way a one-field config flip + one pin
   (`harnessChipMode.test`'s shipped-default row).
5. **Criterion 1, previewed only:** 0.39 / 0.42 — above the 0.30 keep
   line, deploy over the 0.40 ceiling by a hair, and most of the movement
   from 0.58 / 0.70 came with the table. Not a signing read (the rule is
   judged at §93 on the rebalanced build, and finding 2 says the
   comparator must share the table).

**The pre-read scorecard** (the point of pre-registering): mechanism and
direction right on all three predictions; magnitude over-called on pool
per run (early deaths truncate spending — the desk's "truncated at the
predicted clear" still fought every turn to the clear); the twin split
unforeseen (the desk pooled both arms' death rates without asking which
arm spends); bosses' turns exact, normals close, elites under by the
summoner effect (darkMagicPosse 1.0 predicted / 3.5–4.4 measured — the
survivors-era kills were free ghouls). The lesson for the next pre-read:
split by ARM, and never count a kill the ledger will not book.

**What the numbers do NOT decide:** keep-or-rollback (§93, after §92 —
this read is on a maladapted arm and an un-rebalanced board); whether
the user's turn targets are right (the §92 anchor, "vague vibes" by their
own label); the rarity / price book (superseded under keep).

### 91g — the flip + the close (2026-09-04, user-endorsed in chat)

**The `capPenalty` docket:** the user endorsed (a) — `health.capPenalty →
survivors`, the surcharge; the shipped pair is (casualties, survivors).
The one seam it touched beyond config: the 91e rule-agnostic fakes stated
their chips in BOTH vocabularies, which is exact only under a ONE-rule
pair — on a two-rule cap turn (what a reason-less `'draw'` fake maps to)
the survivors half and the mirrored fallen half both charge, 2× the
stated number. `chipTurn` now derives the fallen half from
`rulesForTurn(reason)`: survivors in the set → fallen 0 (the survivor
half carries the chips), casualties alone → the mirror. Every pair reads
the stated chips (gotcha #129); `harnessChipMode`'s shipped-default pin
re-pinned to the pair; health.ts + the spec bullet amended; gotcha #130
files the pre-read's summoner miss (death counts are not fallen power).
2793 main + 565 fuzz green at the flip commit `da13e7d`.

**The §91 close — what the phase built** (2026-09-03 → 2026-09-04, 13
commits from `ee3d305` to the close): the fallen ledger (World v36) · the
two chip modes + the cap surcharge as their own mode · the charge
telemetry + every reader on charges · `--set` string knobs · fatigue →
constitution at rate 0 with the spawn clamp · the player-facing lines by
rule set · the `casualty-seams` tag (the kept floor) · the power table
(1 / legendary 2 / growth 0; summons zeroed by stamp) · the default flip
· the desk pre-read + the box flip read (three-way, n=120 × 4, the
predictions scored) · the surcharge default. Three user-signed insertions
from the survivors playtests (the camp summon fix, the terminal-cell
stand line, the marker compensation) and one from the first casualties
playtest (91e2). Four byte-identity claims made and RUN (91a1, 91a2,
91c, the 90d floor-0 legs); two behaviour changes CONTROLLED by an
expected oracle FAIL (91b) and a modes-differ pin (91e). Re-pin count
across the whole phase: **zero** — every predicted "baselines re-pin"
was a structural pin that moved with the run, and the three fake
re-expressions (91e, 91g) were one idea each.

**Exit criteria, checked:** both modes green under `npm test` +
`fuzz:smoke` (the 4-pair harness pin walks each) ✓; the flip read in
BALANCE naming the knob ✓ (the player pool, ×1.3–1.6 per run, ×2.6–3.1
per turn — and the ARM decides how much). Snapshot prediction: the
kickoff corrected "no bump" to World v36 (the dead are spliced); Run v44
held ✓.

**Riders → §92 (the kickoff audit should start from these):** the
RE-SEARCH is the first number (both finalists were searched under
survivors; regen is maladapted 28:1, deploy 27:16) · the user's turn
targets (normal 2–3 / elite 4–5 / boss 6+) as the pool re-pin's anchor
(pool ≈ turns × wave power for the swarms; composition / count for the
four small-wave encounters; a per-encounter power override for
boss-shaped waves — three decision points, all pending) · the table
changed the OLD rule's game too (the §93 rollback comparator must share
a table; criterion 1's instrument read the roster mix) · the
derived-artifact registry fires (prior table v4 + roster table at the
amendment board) · fatigue's rate switch-on as its own paired read · the
Round 6 riders (priest/regen walk parity · act-1/act-2 vs the signed
0.6 / 0.5 · `seamPoolBand`) carried unchanged. **Process notes →
retro/scratchpad** (the HANDOFF char cap, the two-vocabulary fake, split
pre-reads by arm, the monitor pattern, the wall-time estimate).

## Phase 92 — The rebalance (under the casualty rule)

### §92 kickoff (2026-09-04) — the code-reality audit (at `deb180c`)

Started from the §91g riders. Every claim below is a file:line or a number
recomputed from the 91f batch dirs; nothing is built yet.

**A. The `--set` registry cannot reach an encounter.** `resolveKnob`
([tests/fuzz/balanceSweep.ts:70](tests/fuzz/balanceSweep.ts)) resolves
`group.key` over four FLAT groups — `difficulty` · `health` · `leveling` ·
`sim`. An encounter's `healthPool` / wave `count.factor` / a unit entry live
under `encounters.json` by id, so a per-encounter pool candidate is a COMMIT,
and ONE HEAD PER COHORT (box-drive) makes every candidate table its own
push + cohort. `health.playerHealthMax`, `health.chipMultiplier`,
`health.restHealFraction`, `health.fatiguePerStack` ARE probe arms today.
→ a decision: extend the registry with an id-keyed `encounter.<id>.healthPool`
(+ the first wave's `count.factor`) so pool candidates ride one cohort as
`--set` arms; or design once on the desk and read once. (Cut line 92b.)

**B. The pacing/burn read has no repo-resident reader.** `per-encounter.csv`
([tests/fuzz/reporters.ts:1560–1578](tests/fuzz/reporters.ts)) carries
`waves` / `instances` (turns per instance, all instances) and DEATH counts
per battle — and death counts are not booked power (gotcha #130: the
summoner encounters read 17–70 "deaths" per turn while the ledger books
1.7–2.5). The 91f pacing table came from a scratchpad probe over
`results.json` (`telemetry.poolChips`: per turn `encounterId` · `reason` ·
`playerCharge` / `enemyCharge` · `fallenPlayer` / `fallenEnemy` · the pool
before/after) — the probe is gone with its session, and §92 reads this
table on every cohort. → 92a: `pacing.csv` beside `per-encounter.csv`
(turns per WON instance · booked burn / cost per turn per side · player
cost per instance · cap share, by encounter and by kind), config-derived
test, rides `--per-encounter --emit-results`. The forgetful-path rule: the
reader ships with the batch, not in a scratchpad.

**C. The re-search recipe exists verbatim** —
`output/box-batches/88d2-derive.queue`: `--search --refine --searcher
--audition --preset=heavy --vectors=96 --seeds=32 --sampler-seed=85
--seed-offset=1000 --jobs=8`, artifact `best-strategy.json`, ~2.7 h box at
88d2b (post-perf). The search runs under the SHIPPED `health.json`
(casualties, surcharge) — the spec's criterion-2 recipe exactly. What the
search does NOT do: pick the deploy vector. 85g5's shape follows —
regenerate the base finalists from `generateVectors(DEFAULT_BOX, 85, 96)`
(non-circular check: the refined winner must lie inside its parent's 0.15
perturb envelope), then the K=4 arbitrated-selection cohort (n=30 @ offset
1000 under the ARM, ~1 h) → the argmax is the deploy decision (user-signed,
as at 85g5). Two circularities to name, not fix: (1) the selection cohort's
arb rows load the v3 PRIOR TABLE (measured under survivors, the regen
vector) — stale by the registry's own rule until v4; (2) the arm adapts to
the pools we then move — the closing fresh derive at the amendment board
(the registry's standing requirement) is the ceiling read that closes it.
The regen vector is NOT re-searched (the hand-authored 59 twin, the drift
anchor).

**D. The prior table v4** — `88d2-prior-v3.queue` (the TRAIN bank 1001–1120,
`--shadow-horizon=run`, ~1.5 h) measured under the REGEN vector. Under
casualties the regen twin wins 0.042 (28:1 paired against survivors) — a v4
on the regen vector would price items on runs that die in act 1. → a
decision: v4 measured under the RE-SEARCHED deploy vector (the 85h
deployed-semantics rule read literally: measure under what ships). The
roster table rebuilds off the §92 board's own ARM rows (`npm run
roster:table -- <board-dir>`, a free rider). Both invalidate AGAIN on every
config move, so both build ONCE at the final config, before the board.

**E. The power override is a small seam, one prediction.** `resolveWave`
([src/run/encounters/wave.ts:164](src/run/encounters/wave.ts)) builds each
instance via `scaledUnit(archetype, level)`; `WaveUnitSchema`
([src/config/encounters.ts:111](src/config/encounters.ts)) is
`{archetype, count, level}`. An optional `power` on the entry → the
resolver stamps `stats.power` on the template after scaling
(`growthRates.power` = 0 since 91b, so level scaling never disturbs it);
`World.recordFallen` ([src/sim/World.ts:2381](src/sim/World.ts)) books
`effectiveStats.power`, so the stamp rides straight into the ledger; the
risk line (`playerExposure`, [src/run/chipRule.ts](src/run/chipRule.ts))
reads the player's OWN fielded power under casualties, untouched. The
encounter editor gains a field. Snapshot prediction: NO bump — the wave is
resolved at encounter start and templates already serialize `stats`
(verify at step zero: the resolved wave is not itself in `RunSnapshot`).
It DIVERGES from the spec's "power = headcount weight fixed per archetype"
(the `units.test.ts` §91b pin stays: the CATALOG stays {1,2}; the override
is per-entry) → a spec amendment on the user's signature, and the pin
gains a row: an override books its stamped power. The override goes BOTH
ways — a boss-shaped unit "worth 6" (the user's ask) AND fodder "worth
0.5" in a swarm (halves the wipe burn without touching the count).

**F. Fatigue's switch-on is a probe arm, not a commit.**
`health.fatiguePerStack` ([config/health.json](config/health.json), 0;
[src/run/fatigue.ts:46](src/run/fatigue.ts)) is a flat health key → the
paired read is `--set=health.fatiguePerStack=0.1` against the default on
the same seeds, no commit until it reads. Its bite scales with turns per
encounter (deployment stacks reset per encounter) — read AFTER the pools
move, on the design candidate, or it reads on one-turn swarms and says
nothing.

**G. The board + the walk shape.** The signing board is the 88d shape
(`88d-board.queue`: 15 base rows n=40 + 10 checked rows extended to n=120;
~9.6 h at 85g5, and the 91f legs fought ~30% more turns on the new table —
budget 10–12 h). Criterion 1 (overkill ≥ 3, pooled over the SIX ARM walk
arms) is not on the board — it is the 89c shape (`queue-89c.txt`: 3
characters × 2 vectors, n=120, `--per-encounter --emit-results`, ~3.1 h at
the old table). The §93 read needs both at ONE HEAD plus the survivors
comparator on the SAME table (`--set=health.chipMode=survivors
--set=health.capPenalty=survivors` twins — the 91f rider) — so the §92
closing cohort = board + the six walk arms + the two survivors walk twins,
~16–18 h, two nights. The prior tripwire fires on `npm test` the moment the
deploy vector changes (the ARM changed) — v4 must land in the same commit
as the deploy flip or the tree goes red.

**H. THE DESK TABLE — booked charges, the 91f casualties legs**
(`20260904-135211` regen · `-154006` deploy, pooled; scratchpad probe
`pacing-desk.js` over `results.json`; an INSTANCE = one (seed, sector, hop);
`turns` = per WON instance; burn/cost = booked pool-HP per turn; `pool@T` =
burn × the user's target turns (normal 2.5 / elite 4.5 / boss 6);
`pCost@T` = the player's per-turn cost × T):

| encounter | kind | pool | n | win | turns | burn/turn | pCost/turn | pCost/inst | cap% | pool@T | pCost@T |
|---|---|---|---|---|---|---|---|---|---|---|---|
| highwaymen | normal | 10 | 176 | 1.00 | 1.04 | 11.7 | 1.43 | 1.5 | 0 | 29 | 3.6 |
| plagueVictims | normal | 10 | 130 | 1.00 | 1.00 | 11.9 | 0.24 | 0.2 | 3 | 30 | 0.6 |
| deserters | normal | 9 | 163 | 0.99 | 1.07 | 11.4 | 1.62 | 1.7 | 3 | 29 | 4.0 |
| artillery | normal | 8 | 268 | 1.00 | 1.05 | 8.7 | 1.74 | 1.8 | 0 | 22 | 4.3 |
| plagueDoctors | normal | 7 | 120 | 1.00 | 1.06 | 8.5 | 3.39 | 3.6 | 0 | 21 | 8.5 |
| brigands | normal | 7 | 146 | 1.00 | 1.08 | 7.7 | 2.51 | 2.7 | 0 | 19 | 6.3 |
| elementalTrio | normal | 9 | 163 | 0.98 | 2.01 | 6.3 | 1.76 | 3.5 | 0 | 16 | 4.4 |
| miscreants | normal | 10 | 32 | 0.88 | 2.11 | 7.5 | 3.76 | 7.4 | 2 | 19 | 9.4 |
| adventurer-with-guards | normal | 8 | 314 | 0.98 | 2.33 | 3.4 | 1.70 | 4.0 | 0 | 9 | 4.3 |
| infernalColumn | normal | 10 | 29 | 0.69 | 2.50 | 3.9 | 4.83 | 11.8 | 1 | 10 | 12.1 |
| ronin-vs-mages | normal | 8 | 163 | 0.91 | 3.28 | 2.9 | 2.69 | 8.7 | 0 | 7 | 6.7 |
| warband-vanguard | elite | 8 | 79 | 0.96 | 2.18 | 4.5 | 3.07 | 6.6 | 0 | 20 | 13.8 |
| brigand-champions | elite | 12 | 63 | 0.92 | 2.34 | 6.4 | 3.71 | 8.4 | 0 | 29 | 16.7 |
| plagueSpreaders | elite | 10 | 40 | 0.68 | 3.56 | 2.5 | 3.61 | 15.3 | **42** | 11 | 16.2 |
| darkMagicPosse | elite | 7 | 43 | 0.67 | 4.07 | 1.7 | 3.73 | 13.7 | **15** | 8 | 16.8 |
| bandit-king | boss | 13 | 110 | 0.91 | 2.40 | 6.0 | 3.00 | 7.0 | 0 | 36 | 18.0 |
| generalissimo | boss | 13 | 40 | 0.72 | 2.48 | 5.1 | 4.32 | 10.4 | 0 | 31 | 25.9 |
| witch-hunt | boss | 20 | 39 | 0.64 | 3.36 | 6.4 | 3.80 | 11.7 | 0 | 39 | 22.8 |
| banditQueen | boss | 20 | 87 | 0.85 | 3.42 | 6.4 | 3.06 | 10.4 | 2 | 38 | 18.3 |

**What the table says (the findings the shape-lock turns on):**

1. **The swarms are one turn by arithmetic and the fix is ×2.5–3 on their
   pools** (19–30 vs 7–10) — the pre-registered `pool ≈ T × wave power`
   holds cleanly: a full wipe books the whole wave (8–12) and the pool is
   smaller than one wave.
2. ⭐ **The player's per-turn cost does NOT fall when the enemy pool rises,
   so the targets blow the PLAYER budget.** Booked cost per turn is
   1.4–3.4 on normals, 3.1–3.7 elites, 3.0–4.3 bosses. An act at the
   targets is ~6 × 2.5 + 2 × 4.5 + 6 ≈ 30 turns against a budget of 20 +
   two rests × 5 = ~30 pool → ~1 pool per turn for a sure clear, and the
   user's own targets say a boss alone would cost 18–26 of a 20 pool. So
   pool-only pacing is not a rebalance — it is a guaranteed loss. The
   lever pair is (enemy pools UP) × (player pool max UP ~2–2.5×, 20 → 40–50,
   `--set`-able; criterion 1's threshold already scales as 0.15 ×
   `playerHealthMax` — the §91 amendment anticipated exactly this move), or
   the per-turn cost falls by design (fewer bodies per wave → fewer player
   deaths per turn AND less burn per turn — the count factor). The ROADMAP's
   "pool-max vs per-unit-cost" decision point is this row.
3. **The bosses cannot reach 6+ turns on pool alone** — even at pool max 50
   a 6-turn boss at 3–4.3 per turn eats half the run's pool. A 6-turn boss
   needs a per-turn cost ≈ 1.5–2: fewer attackers per wave around a boss
   unit worth MORE (the override at 4–6 on the named unit, fodder counts
   down, pool ≈ 30–36). This is wave DESIGN per boss, not a re-pin — the
   §94 per-encounter pass's territory; §92 sets the boss pool + the
   override seam and names the shape.
4. **The slogs are the two summoner elites, and they are CAP fights:**
   plagueSpreaders 42% of turns tick-capped, darkMagicPosse 15% — booked
   burn 1.7–2.5 per turn because their bodies are summons (0), so the pool
   drains only when the summoners die; the surcharge is charging the player
   the enemy's standing power on nearly half of plagueSpreaders' turns.
   Both already sit at the elite turn target (3.6 / 4.1); the defect is
   composition (the §87d list had plagueSpreaders at 10.57 pool damage,
   OVER the elite band under survivors too). → by composition at §94, or a
   cap on the summoners' summon rate; not a pool move.
5. **The four small waves are IN BAND by turns already** — adventurer 2.33
   · infernalColumn 2.50 · elementalTrio 2.01 · ronin-vs-mages 3.28 (a hair
   over) against 2–3; their pools at burn × 2.5 come out at 7–16 (at or
   near the authored 8–10). Leave their pools; the two with a real defect
   are infernalColumn (win 0.69 on a NORMAL, cost 11.8 — the 87d 7.7
   pool-damage member) and miscreants (0.88 / 7.4) — composition, §94.
6. **The elite/normal cost ratio is the boss-shaped-wave finding in
   miniature:** elites cost 6.6–15 per instance vs normals 1.5–4 — the
   bite is right; the TURNS are half the target because their pools
   (7–12) are one to two wipes of a 6–9-body wave.

**The run budget, stated once** (the frame every number above answers to):
player pool max `P` + rests (`restHealFraction` × `P` each; ~2 per act)
+ the seam floor (refill to `P`) per act vs Σ (per-turn cost × turns) over
~9 fights. At the user's targets that is ~30 turns per act. The design
choice is which side moves: `P` (cheap, one key, scales criterion 1) or
per-turn lethality (wave counts — content). Recommendation below.

### The draft cut (2026-09-04 — pending shape-lock)

Ordering principle: the arm first (every read after it is on the
re-searched arm), instruments before the design, the design as ONE
candidate commit read once (not a sweep — finding 2 says the levers
interact, and a 3 × 3 grid of (P, pool scale) is 9 cohorts), the
derived artifacts at the final config, the board last.

- **92a — the pacing reader.** `pacing.csv` per batch (finding B): by
  encounter + by kind, turns per won instance, booked burn / cost per turn
  per side, player cost per instance, cap share; config-derived test off a
  synthetic `results` fixture. Rides `--per-encounter --emit-results`.
  Exit: the 91f casualties legs re-read through it reproduce the table
  above. Snapshot: none. (~1 h)
- **92b — the `encounter.<id>.<key>` `--set` group** (finding A; optional,
  the user's call): `healthPool` + the wave `count.factor` reachable as
  probe arms so a candidate table can ride a cohort WITHOUT a commit.
  Exit: `--set=encounter.brigands.healthPool=19` moves the fielded pool
  (harness pin). (~1 h) — SKIP if the design is committed once (92e).
- **92c — the RE-SEARCH** (the rider's first number; finding C): the
  88d2-derive line verbatim at HEAD (~2.7 h) → finalist regeneration +
  the K=4 selection cohort (~1 h) → ⛔ the deploy decision (user-signed
  argmax) → the fixture + `board.ts` DEPLOY path + the prior table v4 in
  the SAME commit (finding G: the tripwire). Exit: the new deploy vector
  fixtured; v4 measured under it (~1.5 h box). Box: ~5.5 h = night 1,
  with 92a/92b landing locally while it cooks (no commits until the last
  launch fires — the three launches are sequential queue lines, so 92a
  commits go in AFTER the selection cohort's fetch).
- **92d — the desk design → the candidate table** (findings 1–6): the
  player pool max `P` (⛔ decision: 40 or 50), `restHealFraction` held
  (heals scale with `P`), enemy pools at burn × T for the six swarms
  (19–30) and the elites/bosses per the table (bosses 30–36 pending the
  override), the four small waves + the two summoner elites UNTOUCHED
  (§94's list), fatigue still 0. One config commit through the encounter
  editor's formatter (the 83d per-id printout). Exit: the printout
  enumerates every encounter's (old → new) pool; typecheck + tests green
  (the pool pins are config-derived).
- **92e — the power override** (finding E; ⛔ decision — spec amendment):
  `WaveUnitSpec.power?` → resolver stamp → editor field → the pin row.
  Snapshot: no bump (predicted; verify at step zero). If signed, the four
  bosses' named unit gets its weight in 92d's table. (~2 h)
- **92f — the candidate read + fatigue** (night 2, ~8 h): the two soldier
  walk twins at the candidate (n=120, the 91f shape) + the same twins at
  `--set=health.fatiguePerStack=0.1` (the paired fatigue read, finding F)
  — four legs. Exit: pacing by kind vs the targets; the player budget
  (pool lost per run vs `P` + heals); fatigue's paired Δ. One adjustment
  commit allowed (92f2) if the read misses by a band, then the final
  config is FROZEN.
- **92g — the derived artifacts at the final config**: prior table v4
  re-measured IF 92d moved after v4 (it will — v4 at 92c precedes the
  pools; the registry rule says re-measure at the amendment board: budget
  it, ~1.5 h) + the fresh derive as the ceiling read (~2.7 h).
- **92h — the closing cohort** (nights 3–4, ~16–18 h; finding G): the
  88d board shape at the new table + the six 89c walk arms + the two
  survivors@HEAD walk twins (the §93 comparator on the SAME table) →
  `npm run roster:table` off the board's ARM rows → the board report.
- **92i — the reads + the DRAFT lineage**: criterion 1 (the 89b2 reader,
  six arms) · the gradient (the fresh derive's ceiling vs the deployed
  ARM, and the survivors gradient re-read at HEAD as the comparator) · the
  §88 rarity / price re-read on v4 · the Round 6 riders (superseded under
  keep, read for the record) → `signed-sheet.json` DRAFT (seam / wall /
  reach / act-1 refs at the new `P`; NOT signed — §93 decides) → HANDOFF
  cursor → the §93 handoff: the user's five casualties playtests at the
  92h HEAD, verdict written before the board is read.

**Box budget:** 92c 5.5 h · 92f 8 h · 92g 4 h · 92h 17 h ≈ 35 h ≈ 4 nights
(the ROADMAP's 3–4). Every cohort at one HEAD; every candidate table one
commit.

**The decision points, with recommendations:**

- ⛔ **The lever (finding 2):** `P` 20 → **40** (×2, criterion 1's threshold
  → 6) with the enemy pools at burn × T. Why not lethality: fewer bodies
  per wave changes the content the user just praised ("health steadily
  dropping"; the swarms as swarms); `P` is one key, probe-able, and the
  spec pre-scaled criterion 1 for it. 50 is the fallback if 92f reads the
  act-1 clear under the signed 0.6.
- ⛔ **The swarm pools:** burn × 2.5 rounded — highwaymen 29 · plagueVictims
  30 · deserters 29 · artillery 22 · plagueDoctors 21 · brigands 19; the
  two elites with real waves 20 / 29 (warband / champions); bosses 36 /
  31 / 39 / 38 pending the override.
- ⛔ **The four small waves + the two summoner elites: NO pool move** (in
  band by turns; composition defects → §94).
- ⛔ **The power override: BUILD** (both directions; spec amendment). The
  boss shape at 6+ turns is unreachable without it (finding 3).
- ⛔ **v4 under the re-searched deploy vector**, not regen (finding D).
- ⛔ **92b (the encounter `--set` group): SKIP** — the design lands once
  (92d) and reads once (92f); a sweep is 9 cohorts the budget doesn't have.

### Shape-lock (2026-09-04, USER-SIGNED in chat)

The user signed the draft cut and every recommendation as proposed, after
one clarification (what the `--set` registry is and why 92b is skipped:
the design lands once and reads once; an encounter-keyed group earns its
hour only for a sweep the budget does not have — it stays a candidate tool
for §94's per-encounter pass if the adjustment round needs it). DECIDED:
the lever = `health.playerHealthMax` 20 → **40** (50 the fallback if the
act-1 clear reads under the signed 0.6) with the enemy pools at burn × T ·
the swarm pools per the desk table · NO pool move on the four small waves
+ the two summoner elites (composition → §94) · the power override BUILT
both directions (a spec amendment lands with 92e) · prior v4 measured
under the re-searched deploy vector · 92b SKIPPED. The cut is in ROADMAP
§92 as checkboxes; night 1 (the derive) launches from this commit.

### 92a — the pacing reader (2026-09-04, built while 92c1 cooked)

`pacingStats` / `renderPacing` / `renderPacingCsv` in
[tests/fuzz/reporters.ts](tests/fuzz/reporters.ts), written beside the
alpha-strike reader and riding the same `--per-encounter` flag in
`writeAggregateAnalyses` (`pacing.csv` + a batch.log table). The unit of
read is the encounter INSTANCE — one (sector, hop) visit off
`telemetry.poolChips` — WON when its last chip leaves the enemy pool at 0;
turns per won instance is the number the user's targets are stated in.
Burn and cost are the BOOKED charges (`chargeToEnemy` / `chargeToPlayer`,
so a pre-91a2 batch reads the survivors arithmetic), never death counts —
the reader exists because the death-count table over-read the summoner
encounters by 7–28× (finding B / gotcha #130). Rows by encounter (kind
order, then id) and by kind + `all`. Ten pins in `pacing.test.ts`, every
expected number derived by hand from a synthetic chip fixture; the kinds
are config-derived (the catalog is asserted, not assumed).

**Exit check RUN:** the two 91f casualties legs (`20260904-135211` ·
`-154006`, 240 runs) re-read through the real reader reproduce the
kickoff's desk table row for row — the desk probe was an independent JS
derivation over the same `results.json` (highwaymen 176 / 1.04 / 11.7 /
1.43 · plagueSpreaders cap 42.0% · banditQueen 3.42 · the kind rows normal
1.61 / elite 2.72 / boss 2.85 turns per won instance, cost per instance
3.35 / 10.0 / 9.2). 2793 main + 575 fuzz:smoke (565 + 10) green,
typecheck clean.

### 92e — the power override (2026-09-04, built ahead of 92c2 while the derive cooked)

Pulled forward in the cut: the seam is INERT until an encounter authors it
(92d), so it lands before the selection cohort without moving a byte of
what 92c2 measures — and 92d's table needs it in hand. Landed as audited
(kickoff finding E): `WaveUnitSpec.power?` ([wave.ts](src/run/encounters/wave.ts)),
stamped onto the resolved template's `stats.power` AFTER `scaledUnit` (every
other stat untouched; `growthRates.power` = 0 so level never re-touches it);
zod `power: nonnegative().optional()` with the `levelCap` boundary cast
([encounters.ts](src/config/encounters.ts)); the encounter editor's unit row
gains a `pow` number field (blank = absent = the catalog weight; the field
is DELETED on blank, never set to undefined — the exact-optional contract
the formatter emits). Step zero held: the resolved wave is not in
`RunSnapshot` (it is resolved at `beginTurn`, Run.ts:2742, and the World
serializes units with their stats) — no bump, World v36 / Run v44.

**Pins (+5):** wave.test — the override stamps EVERY instance of its entry
and only that entry (bandit 0.5 × 6, mercenary at table × 2) · touches ONLY
power (stats == scaledUnit's ⊕ power at a scaled level) · absent ≡ the
pre-92e resolution (toEqual across a spread copy; catalog weights) · 0 is
legal (a free body by the AUTHOR, distinct from the summon stamp).
World.test — a template with power 6 is booked at 6 in `fallenPower`
(mercenary's table power asserted ≠ 6 so the pin cannot be vacuous). The
§91b catalog pin is unchanged: the TABLE stays {1, 2}; the override is
per-entry. Spec §The casualty chip rule ⭑ AMENDED 2026-09-04 (the
user-signed decision) + DESIGN §Run structure one clause. The risk line
reads the resolved templates' `stats.power` (Run.ts:2765), so an override
flows into the survivors-mode exposure line by construction.

**The control:** `scripts/perf-oracle.sh HEAD` (the dirty tree vs `70cefa2`,
both default shapes) — see the result line below; a PASS is the proof the
seam is inert at the shipped catalog, the 91c pattern.

**Oracle RESULT:** PASS — the live tree byte-identical to `70cefa2` on every compared artifact (scored summary `a423e77ea9e4` · rosters `b6e0766aa819`; ARM summary `8efd140c1c08` · decisions `17565052490a` · rosters `0ef3bb1f6c3b`). The seam is inert at the shipped catalog; 92d is where it turns live (and where the oracle must FAIL, the 91b pattern).

### 92d-pre — the criterion-1 threshold scales with the pool max (2026-09-04, found prepping 92d)

Step zero on 92d's premise: the spec's keep criterion 1 was amended at the
§91 kickoff to read the overkill threshold as **0.15 × `playerHealthMax`**
(= 3 at 20) precisely so a §92 pool-max move could neither pass nor fail
the test on the lever — and the 89b2 reader that computes it
(`alphaStrikeStats`, [reporters.ts](tests/fuzz/reporters.ts)) hardcoded
`>= 3` / `>= 5`. At the signed 40 the §93 read would have been taken at a
threshold of 3 (7.5% of the pool), reading every death as an overkill.
Landed: `OVERKILL_FRAC = 0.15`, `overkillThreshold = OVERKILL_FRAC ×
poolMax` on every sector row, `shareOverkillGeThreshold` beside the
ABSOLUTE ≥ 3 / ≥ 5 shares (kept as pool-HP columns so old batches stay
comparable; the keep read is the scaled share). The render gains a
`≥0.15×max` column, the CSV two trailing columns (consumers read by
name; the 91f recompute used `shareOverkillGe3` and still can). One pin:
at 20 the scaled share equals the ≥ 3 share; at 40 the threshold is 6 and
only the 10-margin death clears it while the absolute share is untouched.
21 reader tests green, typecheck clean.

### The overnight pre-signatures (2026-09-04 evening, USER-SIGNED in chat — "pause for my review if any number looks suspicious, otherwise see you in the morning")

Signed after the 92e/92d-pre landings, so the session can run the box
chain through the night without a morning gate at each step:

- **The boss weights for 92d** (the four bosses' named unit, one per boss):
  bandit-king adventurer **6** (final stage) · witch-hunt luminant **6**
  (final stage) · banditQueen banshee **3** (every stage) · generalissimo
  officer **3** (every stage); pools **36 / 39 / 44 / 36** (the Queen and
  the Generalissimo rise above the shape-lock's 38 / 31 to absorb a
  per-turn payoff — an every-stage unit dies most turns, so a 6 there is a
  burn floor, not a turning point). 92f checks them.
- **(a) The deploy decision at 92c2** = the pre-registered argmax over the
  four selection arms by TRAIN-bank win count; tie → a base finalist over
  the refined winner (the 85g5 inversion); HOLD for the user only on a
  driver HOLD, an envelope-check failure, or an exact top-two tie.
- **(b) The 92c2 arm loads the stale v3 prior table** (λ=0.5 stays in the
  ARM — measure under what ships; v3 was measured under survivors; v4 lands
  at 92g). Accepted, noted.
- **(c) 92d commits and 92f launches the same night**: after the 92c2
  fetch — the deploy fixture + `board.ts` DEPLOY path, then the signed
  table (pool max 40 · the pools · the boss weights) as its own commit,
  push, and the 92f cohort (the regen + NEW-deploy walk twins × fatigue
  {0, 0.1}, n=120, `--per-encounter --emit-results`; ~8 h).
- **(d) The 92f2 adjustment RULE** (the one allowed adjustment, mechanical):
  pool max 40 → 50 if the deploy twin's act-1 clear < 0.6 · a kind whose
  turns per won instance misses its target (normal 2.5 / elite 4.5 /
  boss 6) by > 20% has its pools rescaled by target ÷ measured · fatigue
  stays 0.1 only if its paired win Δ is inside noise (else 0) · all in band
  → the config FREEZES untouched. Then 92g (prior v4 under the deployed
  vector + the fresh derive, ~4 h) launches on the frozen config. Anything
  92f reads that the rule does not cover is WRITTEN UP AND HELD.
- **Standing clause:** any number that looks suspicious pauses the chain
  for the user's review.

Correction folded in at the same time (kickoff finding G, checked at
92e): the prior tripwire checks catalog MEMBERSHIP, not the deploy vector,
so a vector change does not trip `npm test` — v4 builds ONCE at 92g (the
92c2 line no longer carries it; ~1.5 h of box saved).

### 92c1 — the RE-SEARCH under the casualty rule (2026-09-04/05; box `abox-20260904-230313`, batch `20260904-230406-f68540e`)

The 88d2-derive line verbatim at `f68540e` (the shipped rule: casualties +
the surcharge, the 91b/91e2 table, pool max 20 — the PRE-92d config, by the
cut's order): 23:04Z → 01:10Z, **2.1 h** (88d2b took 2.7 h under survivors —
shorter fights), artifact-verified, box destroyed on drain. The search:
96 vectors × 26 train seeds, refine K3×8@0.15 — **3/3 finalists improved,
train 30.8% → 42.3%**, held-out test **33.3%** (n=6). For scale: the 88d2b
derive under survivors read train 42.3% → 50.0%, test 16.7% — the casualty
rule's ceiling is lower on TRAIN by ~8 pt at this budget, and the held-out
read is not comparable at n=6.

**Finalist materialization** (scratchpad `finalists-92c2.ts`, the 85g5
procedure mechanized): the ranking off `search-results.csv` → top-3
**#80 (30.8%) · #27 (23.1%) · #54 (23.1%)**; `generateVectors(DEFAULT_BOX,
85, 96)` regenerated; the non-circular envelope check PASSED — the refined
winner sits 0.2974 ≤ 0.30 from #80 on every coordinate and 1.84 / 1.90 from
#27 / #54 (the script dry-ran on the 88d2b derive first: same shape, #80's
perturb there too — the same sampler seed proposes the same 96, and the
same base vector tops both rules' coarse screens). Fixtures
`tests/fuzz/fixtures/92c2-finalist-{80,27,54}.json` + `92c2-winner.json`;
the selection queue `tests/fuzz/output/queue-92c2.txt` (K=4 arms, n=30 @
offset 1000, the ARM with λ=0.5 — pre-signature (b)).

### 92c2 — the arbitrated selection + the deploy (2026-09-05; box `abox-20260905-011430`, batches `20260905-{011733,012359,013026,013858}-cf90f56`)

The K=4 cohort at `cf90f56` (the 85g5 shape: n=30 on the TRAIN bank @
offset 1000 under the full ARM incl. λ=0.5 — pre-signature (b)), 4/4
artifact-verified in **31 min** (~7 min per arm — the casualty rule's
shorter fights), every manifest at HEAD, dirty false, box destroyed on
drain. Wins on the bank:

| arm | wins / 30 | paired vs the argmax (only-argmax · only-other, net of discordant) |
|---|---|---|
| finalist-80 (base, the winner's parent) | 10 | 7 · 4 (+3 of 11) |
| finalist-27 (base) | 8 | 8 · 3 (+5 of 11) |
| finalist-54 (base) | 5 | 11 · 3 (+8 of 14) |
| **the refined winner** | **13** | — |

**The argmax is the refined winner, unique — DEPLOYED per pre-signature
(a)** (no HOLD condition met: no driver HOLD, the envelope check passed
at 92c1, no top-two tie). The 85g5 inversion did NOT recur: the refine
step improved 3/3 finalists this time and its winner beat its own parent
+3 net of 11 — thin, as 85g5's +2 of 10 was, and the rule was written for
exactly that. For scale, the survivors-era selection read 18 / 14 / 16 /
15 on the same bank at pool max 20; the casualty rule at the PRE-92d
config wins 5–13 of 30 — the pre-rebalance ceiling the flip read
predicted, not a verdict.

**The deploy commit:** `board.ts` DEPLOY → `92c2-winner.json`, the four
`strategyRow` literals `scored:92c2-winner` (ids stay `deploy`); the 85g5
fixture stays on disk as the survivors-era comparator; the sheet's deploy
refs are PENDING RE-PIN at the §92 board (DRAFT — §93 decides; no sheet
edit at §92 by the charter's NOT-doing). Prior v4 waits for 92g (the
tripwire reads catalog membership, not the vector — the finding-G
correction). The read script (scratchpad `read-92c2.ts`) reproduced the
85g5 record (18/14/16/15, +2 of 10) on the archived batches before it
read this cohort.
