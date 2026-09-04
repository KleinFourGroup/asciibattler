# Encounter feel interstitial spec — the casualty experiment (§89+)

The interstitial the §87d3 disposition called (2026-08-30): the encounter
defect list + the two reopened design questions (per-act bands,
inter-sector healing), spec-first. The spec session (2026-09-02) widened
it into **the project's first experimental round**: the questions turned
out to share one root (the chip rule's bimodality + act coupling), and
the user chose to build the structural fix under a pre-registered
keep-or-rollback decision. **Kickoff resolutions user-signed in chat
2026-09-02; the phase cut below SHAPE-LOCKED the same day.** Findings +
rationale: [WORKLOG.md](WORKLOG.md) §Kickoff. The plan:
[ROADMAP.md](ROADMAP.md). Macro order: [META-ROADMAP.md](META-ROADMAP.md)
(this round runs before Round 7).

## Intent (the draft, in the user's voice — distilled from the session)

The per-act difficulty bands got me thinking about how the game will
feel when we add a third act. 20 pool health isn't much, and as the
level budget rises, fights toward the end risk one-shotting the run:
enemy numbers go up AND each enemy's level and power go up. Difficulty
going up isn't bad — it's the randomness. It doesn't feel good to lose
an encounter to an alpha strike and just have the run be over. Upping
later acts compounds it, and it's worst arriving with a reduced pool:
act 3 opens under ten health against encounters risking more than that
per turn. I fear act-3 fights would have to be *easier in absolute
terms* even though harder in win rate — IF we can tune that finely at
all; the variance may be too high and force far larger balancer runs.
The alternative, a steady difficulty, is a linear drain that makes act 1
trivial if the full game is to be fair. What I want is something like
an exponential drop-off per act. Part of me thinks healing between
acts, even partially, lets us tune acts independently without the
compounding debuff of previous acts. Massively increasing heal drops
runs into the same variance fear. I don't have hard data for any of
this.

Rarity: I'm thinking of it from the ports side. There's no way to say
"always stock a workhorse packet — a common heal or buff." Not a big
problem now; I can see it becoming one as the catalog expands.

After the breakdown: the floor heal is the answer. At the act seam we
heal *up to* a percentage of max health — a dial; 0 is today, 1 a full
heal; ship at 1, and when meta progression and difficulty land it can
be adjusted. Rarity and the shelf guarantee wait for Round 9. I'm less
comfortable with a damage cap: it's a hidden number we'd have to find a
way to expose, and I liked that the player could just add the numbers
to see the potential risk. Let's fix the bimodal issue at its core.

I absolutely love the casualty idea — there's no sense of a Pyrrhic
victory in this game, and it's missing. But it's a massive overhaul: a
level-up that raises power becomes a bad thing, we may want fixed
archetype values, pools rebalance. Too much for a simple A/B; it can't
be encapsulated in a config switch. Retreat must either happen in-game
(walk back to the spawn band and despawn) or sit behind an unlock
timer, or both — "field a strong unit, kill one, immediately retreat"
must not be a valid strategy, though guerrilla fighting should be
directionally valid. So: our first experimental round. The data
gathering is §89 because it's good data to have anyway; we build the
casualty rule regardless, make every overhaul needed to get it
reasonably balanced, and at phase end decide: keep, or roll back to
here. We risk losing a week or more of work; the upside is worth it.
Pacing answers itself during the rebalance; injuries go to Round 9;
retreat punts to 9 too — the phase is large enough.

On the calls: I like powerful units costing more — a risk-reward
dynamic — but keep it simple: everything is one, legendaries are two,
symmetric. Heals: agreed (fractions for rest and the floor, absolutes
for packets). Bot: read with a re-searched arm. Stall: I cede the point
— the cap penalty as its own mode from day one. Fatigue scales the
unit's starting health, −10% per stack capped at 50%, sequenced
separately. Main plus a tag. Five playtest runs per rule. Targets: 0.6
act-1 clear, 0.5 act-2, and pre-note 0.4 for act 3.

## Kickoff resolutions (LOCKED 2026-09-02 — the spec-audit design conversation)

### The frame — a run is a sequence of independent acts, each a budget

The signed sheet encodes "one continuous budget flowing through two
acts" (seam pool 15–18 of 20 = act 1 costs 2–5 pool by design — the
"act 1 trivial" corner the user feared, already lived in). Under that
frame per-act clear rates don't multiply and the exponential shape is
unreachable; act 3 would have to be numerically easier. Under a known
entry pool per act they multiply, and measurement cost becomes
additive in acts (each act tunes against its own entry pool + the §87
sampled roster) instead of multiplicative.

**Signed targets (per-act clear rate, ARM):** act 1 **0.6** · act 2
**0.5** · act 3 **0.4** (pre-noted; act 3 is Round 10 content). Derived
win: 0.30 at two acts (≈ the current sheet), 0.12 at three. Under a
KEEP these targets derive the new lineage's reach/wall bands; the old
numbers are not re-signed.

### The seam floor (decided; lands under both outcomes)

At `advanceSector`: `playerHealth = max(playerHealth, floor ×
playerHealthMax)`. **`health.seamHealFloor`**, a 0–1 dial (0 = today,
1 = full heal), **shipped at 1.0**; the later difficulty/meta-progression
lever (the StS Ascension-5 precedent: full heal below A5, removed as a
rung). Surfaces on the SectorClearedScreen. No snapshot bump
(`playerHealth` already serializes). Sheet consequence: the seam-pool
band retires or demotes to a diagnostic (pool-at-seam BEFORE the floor
stays recorded — `poolAtSectorClears` already exists).

### The casualty chip rule (the experiment)

Root cause, stated exactly: (1) the loser pays the WINNER'S survivors
(`resolveTurn`, Run.ts — a decisive turn zeroes one side; a won turn
costs 0; a lost turn costs most of the wave: power 1 + 0.1/level ⇒
~1.9 at L10 ⇒ a lost turn vs 6–8 survivors chips 11–15 of 20); (2)
encounters are 1–2 turns (a winning hand chips ~7.5 vs enemy pools
7–10). Per-encounter pool damage is a spike at 0 plus a fat tail.

**The rule:** each side's pool loses the power of ITS OWN fallen units
that turn. Symmetric: the enemy pool loses their dead, so losses still
progress the fight and the enemy pool reads as "their strength; every
kill removes some."

- **Power = headcount weight**, fixed per archetype: **1 everywhere,
  legendary 2** (§91 kickoff: healer 0 → 1; prodigy — the event-granted
  legendary — 2 on both sides); `growthRates.power = 0`. Symmetric (an
  enemy stormcaller = two kills). **Summons weigh 0 by the `summonedBy`
  STAMP in the fallen ledger, not by archetype** (91e2 amendment,
  2026-09-04: the first casualties playtest found two encounters + two
  camps FIELD ghouls, which the original "ghoul = 0" row priced at nothing
  — a fielded ghoul is a body like any other; a conjured one still costs
  its side nothing). The existing `power` stat IS the weight (no new
  field); a config-derived test pins power ∈ {1,2}, legendary ⇒ 2; a
  World pin zeroes the stamped summon. A player's max per-turn exposure
  = the power they fielded — the "add your own numbers" legibility.
- **Both rules stay alive behind `health.chipMode: "survivors" |
  "casualties"`** — the paired same-seed A/B of the rule flip at any
  config is the experiment's instrument all round; the human A/B is
  one line in `health.json` under hot reload.
- **The cap penalty is its own mode from day one:**
  `health.capPenalty: "survivors" | "casualties"`, default casualties.
  ⭑ SEMANTICS (2026-09-03, §91 kickoff, user-signed): keyed on the
  TICK-CAP draw only (a mutual wipe is a casualty turn, never a stall —
  `battle:ended.reason`), and a SURCHARGE: a capped turn always pays its
  own fallen, and under `"survivors"` ALSO the enemy's standing power.
  The tactical searcher is pool-blind (it cannot discover a kiting
  stall); the mode is armor against a human stall until Retreat lands.
  Humans rarely force a draw; the SEARCHER might find a free kiting
  vector — the first paired read tells, and the flip is config.
- **The telemetry carries the APPLIED deltas** (`poolChips` today
  records survivor power per side; `perEncounterStats` multiplies it
  into "pool damage taken" — wrong under casualties). Lands in the SAME
  commit as the rule.
- **Names are proposals** (renameable at the §91 kickoff).

### The experiment protocol (pre-registered)

- **Baseline tag `pre-casualty-experiment`** at the §90 close (the
  floor is kept under both outcomes, so the tag sits AFTER it);
  per-logical-change commits so a rollback is one contiguous revert.
  Main, no branch (user call: a week of doc divergence is where the
  merge pain lives).
- **Keep criteria — written BEFORE the rule lands:**
  1. ⭑ PINNED 2026-09-03 (89d, user-signed): the **OVERKILL ≥ 3 share
     of pool deaths** (killing blow − arrival pool ≥ 3, the 89b2 reader,
     pooled across the six ARM walk arms on the RE-SEARCHED arm) falls
     from the **0.61 baseline** (per arm 0.57–0.67, BALANCE 2026-09-03
     89c) to **≤ 0.30**, with **no single arm above 0.40** — ⭑ AMENDED
     2026-09-03 (§91 kickoff, user-signed): the ≥ 3 threshold is
     **≥ 0.15 × `playerHealthMax`** (= 3 at 20), so a §92 pool-max move
     cannot pass or fail it on the lever; §92 names the pool max the §93
     read is taken at; a read in
     0.15–0.30 is "passes, investigate", ≤ 0.15 is the mechanism
     working as designed. The two alpha definitions (AlphaApp 0.127 ·
     AlphaBlow 0.609) and the per-turn tail are REPORTED beside it at
     §93, not signed (why: WORKLOG §89d);
  2. the **skill gradient** holds or widens, read with a **RE-SEARCHED
     arm** (the finalist vector was searched under survivors; reading
     the new rule through old-rule habits is the §85f train/select leak
     in a new coat) — ⭑ AMENDED 2026-09-03 (§91 kickoff, user-signed):
     the re-search runs at the finalist's recipe (`--preset=heavy
     --vectors=96 --seeds=32`, the 85g5 sampler seed) and the comparator
     is the survivors gradient RE-READ at HEAD on the new power table
     (or a same-budget survivors re-search), never the archived number —
     a wider gradient bought by search effort is not a pass;
  3. a reachable run shape at the signed per-act targets, floor
     included;
  4. the user's **feel verdict from 5 playtest runs per rule**, written
     BEFORE looking at the numbers — ⭑ ORDER (2026-09-03, §91 kickoff,
     user-signed): the SURVIVORS runs happen at the tag, during the §91
     build; the CASUALTIES verdict is written at §93 on the rebalanced
     build BEFORE the user reads the §92 board (the session files it;
     the user reads it after the verdict).
- **Kept under BOTH outcomes:** the §89 data reads + the pre-turn risk
  line · the seam floor · the fatigue seam (constitution target, rate
  0) · the chip-mode / cap-mode seams (a rollback flips the default,
  it doesn't delete the code).
- **Under KEEP:** a NEW sheet lineage (not an amendment): every band
  re-anchors from the per-act targets; the riders carried from Round 6
  (walls under · deploy-walk overperformance · the gambler flip · the
  band promote) are SUPERSEDED, not dispositioned; the §88 rarity
  dispositions + the price book re-read (keeping units alive is now
  worth pool — healers/Shield/defense rise, glass cannons fall); the
  prior table + roster table rebuild; fuzz baselines re-pin.
- **Under ROLLBACK:** revert the range to the tag; the original §89
  charter (the defect list against the survivors bands) runs on the
  old-rule board with the ONE amendment (band promote + riders).
- **Cost, honestly:** 4–6 box nights (the alpha read · the rule-flip
  paired read · rebalance sweeps · the re-search · the board); a keep
  is nearer two weeks than one.

### Heals

Rest heal + the seam floor as **fractions of max** (survive the pool-max
move and the later dial); packet heals stay **absolute** (the number on
the card). The rebalance's first paired read (the rule flip at
UNCHANGED config) says which knob moves — the arithmetic predicts the
PLAYER pool (a win now costs its fallen; ~16 turns/act of attrition
exceeds a 20 pool), NOT the enemy pools (a decisive win chips the wave's
power ≈ today's survivor chip) — to be verified, never assumed.

### Fatigue (the seam lands now; the effect sequenced separately)

`Fatigued` re-targets from `power` (meaningless under casualties — a
tired unit would be cheaper to lose) to **constitution/starting HP:
−10% per stack, capped at 50%** (stacks clamped at 5). Lands at rate 0
inside the rule-flip read (one change per paired read); switched on as
its own commit + paired read during the rebalance. Bites only if
encounters lengthen (deployment counts reset per encounter) — read
where rule 4 lands.

### Deferred to Round 9 (written into META-ROADMAP now so they aren't rediscovered)

- **Retreat** (a pre-turn withdrawal stance; caps losses under
  casualties by construction) — constraint: physically walked to the
  spawn band + despawn, or an unlock timer, or both.
- **Optional deploy** (bench a drawn card — today Cull is the only
  exposure lever).
- **The port shelf guarantee** (a role tag + a forced slot in
  `rollPortStock`, the Portunus forced-tier precedent; tiers as
  weighting only if ever wanted).
- **Injuries** (fallen units return wounded — the fatigue seam's
  run-scoped cousin).

### The original charter lands LAST

The §87d defect list tunes against whichever rule wins: under keep it
is the per-encounter disposition pass on the new board (the rebalance
already moved encounters); under rollback it is the original charter in
full. Tuning encounters before the rule is decided is the one piece of
work certainly wasted.

### Rejected alternatives (rationale WORKLOG §Kickoff)

The per-turn cap (a hidden clamp on a number the player already summed —
kept only as a documented last resort) · deciding the per-act band
question first (it dissolves under independence) · a rarity tier axis
now (weights bias, they don't guarantee; Round 9 content scaling) ·
massively increased heal drops (the same variance fear) · an
experiment branch · more-draws-per-encounter as the variance fix (a
pacing question; answered by the rebalance) · dropping the pool for
persistent unit HP (rewrites the run layer, the sheet, the evaluator).

### Kickoff audit register (verify at the §91 kickoff, file:line)

- the survivor sum excludes NEUTRALS (camps) — the new rule inherits it;
- summons exist (`summonDamageXpShare`) — power 0 by table;
- the rollout evaluator's battle objective (survivor power as a proxy
  for chip?) — switch to actual pool deltas if so;
- XP on death (`xpFlatPerFallen`) unchanged;
- ~~snapshot prediction: NO bump for the whole round~~ ⭑ CORRECTED
  2026-09-03 (§91 kickoff, user-signed): **World v35 → v36** — dead
  units are spliced out at death, so the casualty rule needs a
  serialized fallen-power accumulator (WORKLOG §91 audit item 1). Run
  v44 holds; chip mode · power · pool max · the floor · fatigue stay
  config / per-turn seeds;
- the fold's prior-table semantics under a new pool metric (rebuild,
  registry recipe).

## The phase cut (SHAPE-LOCKED 2026-09-02, user-signed)

§89 data → §90 floor → §91 rule → §92 rebalance → §93 ⛔ keep-or-rollback
→ §94 the encounter list + the close. Charters in [ROADMAP.md](ROADMAP.md).
