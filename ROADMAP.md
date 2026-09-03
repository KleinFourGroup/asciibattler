# ROADMAP — The encounter feel interstitial (§89–§94): the casualty experiment

The active PLAN (it stays a plan for its whole life). The macro order is
[META-ROADMAP.md](META-ROADMAP.md) (Round 6 ✅ CLOSED 2026-09-02; Round 7
Idioms is NEXT after this interstitial); the spec is
[encounter-feel-spec.md](encounter-feel-spec.md) (kickoff resolutions
user-signed 2026-09-02); findings + rationale land in
[WORKLOG.md](WORKLOG.md); live status is HANDOFF's 🧭 Cursor. Sub-steps
are cut at each phase kickoff (AGENTS "The planning stack"), never here.
Prior round's plan: [archive/post-83-roadmap.md](archive/post-83-roadmap.md)
(Round 6, Instruments) with its worklog and spec beside it.

**Status: SHAPE-LOCKED 2026-09-02 (user-signed) — NEXT = the §89
kickoff.** The §87d3
charter (the defect list + the two reopened questions) widened at the
spec session into **the first experimental round**: the questions share
one root — the chip rule's bimodality + act coupling — and the user
chose to build the structural fix (the casualty chip rule) under a
pre-registered keep-or-rollback decision (§93). The seam floor (§90) and
the data reads (§89) are kept under both outcomes; the original charter
lands last (§94) against whichever rule wins.

**The frame (spec §Kickoff):** a run = a sequence of independent acts,
each a budget. Signed per-act clear targets **0.6 / 0.5 / (0.4 pre-noted
for act 3)**. Rollback baseline = the tag `pre-casualty-experiment` at
the §90 close; main, no branch; per-logical-change commits.

## Phase 89 — The data phase (kept under both outcomes)

Charter: confirm the deficit before the mechanism. The **alpha-strike
read** — the distribution of single-turn chip as a fraction of pool
max, and among pool deaths the share whose killing turn took ≥ 50% —
plus the **seam-hazard read** (pool at sector clear, `poolAtSectorClears`)
from per-turn chip telemetry: re-analyzed from an on-disk cohort if one
still carries `poolChips` (only two fetched batches remain locally), else
ONE fresh isolation cohort (single hop, the 87d3 rider; the extended
searcher arm — `--arbitrate` ⊥ `--encounter`). Plus the **pre-turn risk
line** ("at risk this turn: up to N", display-only — the cheapest
fairness fix on the list, correct under either rule).
**Why first:** the keep criteria's alpha threshold is pinned from THIS
baseline, before the rule exists. **Risk:** low. **Decision point:** ⛔
the alpha-strike threshold (keep criterion 1) — pinned at this phase's
close, user-signed. **Exit:** the baseline numbers in BALANCE; the
threshold pinned; the risk line browser-verified. **NOT doing:** any
config move; any rule change.

Cut at the 2026-09-02 kickoff (USER-SIGNED; audit → WORKLOG §89). The
on-disk branch is DEAD (no results.json survives) and the alpha share
is a WALK statistic → the cohort = the ARM walk twins, not an
isolation cohort. No snapshot bump; fuzz baselines hold.

- [x] **89a** — `PoolChip` gains the APPLIED pools (before/after, both
  sides) via a new `pools:chipped` event from `resolveTurn` (both paths;
  the harness-side read was contaminated — WORKLOG §89 audit correction).
  Landed 2026-09-02; results.json-only, summary.csv byte-identical.
- [x] **89b** — the alpha-strike reader (`alphaStrikeStats` +
  `--per-encounter` render + `alpha-strike.csv`): applied chip/max
  quantiles + shares; pool deaths split APPLIED (rule-agnostic) vs BLOW
  (survivors-only) + the arrival pool, by sector; the seam line. Landed
  2026-09-02 (7 hand-derived pins; local n=3 render).
- [x] **89c** — the cohort: six ARM two-act WALK arms n=120 at `9b4423a`,
  6/6 verified, every batch recomputed independently. Landed 2026-09-03
  (BALANCE 2026-09-03 89c; findings WORKLOG §89c): deaths are
  ATTRITION-shaped, finished by a ≥ 10 blow; 61% overkilled by ≥ 3.
- [ ] **89d** — ⛔ the threshold PINNED (user-signed) → the spec's keep
  criterion 1 + WORKLOG. Docket WORKLOG §89d: overkill ≥ 3 share,
  baseline 0.61, proposed KEEP bar ≤ 0.30.
- [x] **89e** — the pre-turn risk line: `turn:starting.poolAtRisk` via
  the PURE `rollTurnWave` preview (no cursor write; pins: preview ==
  fielded on turns 1+2, gated == headless waves) + the PreTurnScreen
  line. Landed 2026-09-03 (built in a worktree while 89c drained;
  browser-verified: "up to 9" == the fielded 6 bandits + 2 archers).

## Phase 90 — The seam floor (decided; kept under both outcomes)

Charter: `health.seamHealFloor` (0–1, shipped 1.0) applied at
`advanceSector` — `max(pool, floor × max)`; the SectorClearedScreen
line; rest heal re-expressed as a fraction of max (packet heals stay
absolute). A paired read floor 0 vs 1 on the survivors rule so the
experiment's baseline INCLUDES the floor. BALANCE: the seam-pool band
demoted to a diagnostic (pre-floor pool stays recorded). Close with the
tag `pre-casualty-experiment`.
**Why here:** decided, cheap, needed under both rules — landing it
before the flip means §91's paired read isolates the chip rule.
**Risk:** low. **Snapshot prediction:** no bump (`playerHealth` already
serializes). **Exit:** the dial live at 1.0; the paired read in BALANCE;
the tag placed. **NOT doing:** the per-act band decision (dissolves
under independence); heal-drop inflation.

Cut at the 2026-09-03 kickoff (USER-SIGNED in chat 2026-09-02; audit →
WORKLOG §90 — the cut held; the predicted two-act re-pin did not exist).

- [x] **90a** — `health.seamHealFloor` (shipped 1.0) clamps at
  `advanceSector` BEFORE the emit; `sector:cleared` gains `poolBefore`/
  `poolAfter`; the harness records the PRE-floor seam. `bd44a3a`.
- [x] **90b** — `restHealAmount` 5 → `restHealFraction` 0.25 of max;
  `DP_TAIL_SCALE` re-expressed, pinned byte-identical at 5. `f58e5fb`.
- [x] **90c** — the SectorClearedScreen pool line ("Pool restored 7 →
  20" / "Pool 20 / 20 carries on"); browser-verified. `d30f0bf`.
- [x] **90d** — the paired cohort at `71a5000` (4/4 verified, box
  destroyed): floor 1 − 0 paired Δwin +0.017 regen / +0.033 deploy
  (inside noise); act-2 opens full 100%; ⭐⭐ both floor-0 legs
  BYTE-IDENTICAL to 89c @`9b4423a`. BALANCE 2026-09-03 §90 · WORKLOG.
- [x] **90e** — BALANCE (the dated read + the seam pool → a DIAGNOSTIC
  in the header; the user-signed sheet field untouched → §92) + WORKLOG
  (the close docket) + the HANDOFF cursor. ⛔ **The tag
  `pre-casualty-experiment` + the close sign are the USER's** (docket
  WORKLOG §90).

## Phase 91 — The casualty rule (the experiment's build)

Charter: `health.chipMode: survivors | casualties` (both alive; default
casualties) + `health.capPenalty` (its own mode, default casualties) +
the telemetry carrying APPLIED deltas + the per-encounter reader on
deltas (same commit as the rule) + the power table (1 / legendary 2 /
summon 0, `growthRates.power = 0`, the config-derived pin) + the
fatigue re-target to constitution (−10%/stack, cap 50%; rate 0 here) +
the kickoff audit register (neutrals excluded from the sum · summons ·
the rollout evaluator's objective → pool deltas · XP on death) — then
**the rule-flip paired same-seed read at UNCHANGED config** (the
"which knob moves" read: the arithmetic predicts the PLAYER pool, not
the enemy pools; verify, never assume). The adversarial review of the
spec + this plan (reviewer unpinned — the strongest available second
model + a read-only file:line peer) runs at this kickoff.
**Depends on:** §90 (the floor in the baseline). **Risk:** medium-high
(the sim's loss semantics; the instrument's meaning). **Decision
points:** the cap-penalty default if the searcher finds a free kiting
vector (config flip); evaluator objective change if it proxies survivor
power. **Snapshot prediction:** no bump. **Exit:** both modes green
under `npm test` + fuzz:smoke; the flip read in BALANCE naming the knob.
**NOT doing:** retreat / optional deploy (Round 9); any balance move.

## Phase 92 — The rebalance (under the casualty rule)

Charter: make the new rule reasonably balanced at the signed per-act
targets — the player pool max / heal fractions / enemy pools / encounter
factors (the §87d defect list folds in HERE under the new rule) / fatigue
switched ON as its own commit + paired read / the **re-search of the
arm** (the finalist vector was searched under survivors) / the
derived-artifact rebuilds (prior table v4 + roster table, registry
recipes) / the **fully MANIFESTED board at ONE HEAD** → the new sheet
lineage DRAFT. Pacing (turns per encounter) is read here, not designed.
**Depends on:** §91's flip read. **Risk:** high (every band re-anchors;
the largest box spend of the round — 3–4 nights). **Decision points:**
pool-max vs per-unit-cost as the lever; the enemy pool re-pin per kind.
**Exit:** the board green at the draft lineage; the alpha-strike and
gradient reads recomputed on the re-searched arm; the §88 rarity/price
re-read filed. **NOT doing:** signing anything — the decision is §93.

## Phase 93 — ⛔ Keep or roll back (the decision point)

Charter: the pre-registered keep test, in this order — the user's feel
verdict from **5 playtest runs per rule** (written BEFORE the numbers) →
criteria 1–3 (alpha share vs the §89 threshold · the gradient on the
re-searched arm · the run shape at the targets, floor included). KEEP =
the new sheet lineage proceeds to signing at §94; the Round 6 riders
SUPERSEDED. ROLLBACK = revert the §91–§92 range to the tag (the floor,
the reads, the risk line, the fatigue seam and the mode seams stay);
§94 runs the original charter.
**Depends on:** §92. **Risk:** the decision itself. **Decision point:** ⛔
the whole phase — a STOP, user-signed either way. **Exit:** the verdict
+ the four criteria recorded in WORKLOG; the tree at the chosen rule.
**NOT doing:** re-litigating the criteria after the numbers are seen.

## Phase 94 — The encounter list + the close

Charter: the §87d defect list dispositioned per encounter against the
ruling lineage (under keep: the per-encounter pass on the §92 board;
under rollback: the original §89 charter — the softs/hots vs the
survivors bands, the boss judged by the WALL not the isolation band) →
the round's ONE signing (keep: the new lineage; rollback: the amendment —
band promote + riders) → the prior table rebuild at the final config →
the scratchpad sweep → archive (spec + pair) → HANDOFF cursor → Round 7.
**Depends on:** §93. **Risk:** medium. **Decision points:** per-encounter
dispositions (user-signed); the band promote (rollback branch only).
**Exit:** every §87d member dispositioned; the sheet signed; the
prior/roster tables current; archives written. **NOT doing:** new
encounter content; archetype changes; Round 9 mechanisms.

## Riders carried in from the Round 6 close

One line each; detail = BALANCE 2026-09-01/02 + archive/post-83-worklog.md
§88d4. **Under KEEP all four are superseded by the new lineage**; under
ROLLBACK they are read on the §94 board:

- The **band promote question** (X3 per-kind bands → signed sheet),
  deferred to this round's close.
- The **walls** UNDER band on the 88d3 partial (0.271 / 0.293) — a
  full-board read, not a band move.
- The **deploy-walk overperformance** on BOTH arms (0.625 / 0.550 vs
  40–50) — the design-target question.
- The **gambler shape-flip parity item** (deploy −10.0 / regen +5.8).
- ⚠ **Every config move invalidates the prior table** (BALANCE §"The
  derived-artifact registry") — the rebuild recipe runs at §92 and again
  at §94's final config.

_(Sub-steps cut at each phase kickoff, after shape-lock.)_
