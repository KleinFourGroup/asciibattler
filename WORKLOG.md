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
