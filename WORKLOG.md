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

### 89d — ⛔ the threshold docket (AWAITING the user's sign)

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
