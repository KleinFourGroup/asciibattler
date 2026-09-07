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

**Status: §89–§92 ✅ CLOSED; §93 ✅ DECIDED KEEP 2026-09-05 (user-signed);
§94 NEXT — its kickoff in a FRESH session (the cut lands there).** The §87d3
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

## Phase 89 — The data phase ✅ CLOSED 2026-09-03 (user-signed)

The deficit confirmed before the mechanism: deaths are ATTRITION-shaped,
finished by a ≥ 10 blow, **61% overkilled by ≥ 3** (BALANCE 2026-09-03
89c; WORKLOG §89) · the pre-turn risk line shipped · ⛔ keep criterion 1
PINNED (spec §The experiment protocol). Cut + audit: WORKLOG §89.

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
- [x] **89d** — ✅ DECIDED 2026-09-03 (user-signed): keep criterion 1 =
  the OVERKILL ≥ 3 share ≤ 0.30 (baseline 0.61), no arm above 0.40 →
  the spec's keep criterion 1; rationale WORKLOG §89d.
- [x] **89e** — the pre-turn risk line: `turn:starting.poolAtRisk` via
  the PURE `rollTurnWave` preview (no cursor write; pins: preview ==
  fielded on turns 1+2, gated == headless waves) + the PreTurnScreen
  line. Landed 2026-09-03 (built in a worktree while 89c drained;
  browser-verified: "up to 9" == the fielded 6 bandits + 2 archers).

## Phase 90 — The seam floor ✅ CLOSED 2026-09-03 (user-signed; tag `pre-casualty-experiment` on the close commit)

`health.seamHealFloor` 1.0 live (every act opens on a full pool); the
paired read floor 1 − 0 = +0.017 / +0.033 win, inside noise (BALANCE
2026-09-03 §90); the seam pool a DIAGNOSTIC; rest heal a fraction;
no snapshot bump; both floor-0 legs byte-identical to 89c. The
rollback baseline for §93 = the tag. Cut + audit + docket: WORKLOG §90.

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
  (the close docket) + the HANDOFF cursor. ✅ The close SIGNED + the
  tag `pre-casualty-experiment` placed 2026-09-03 (WORKLOG §90).

## Phase 91 — The casualty rule (the experiment's build) ✅ CLOSED 2026-09-04 (user-endorsed)

Outcome: the casualty chip rule is BUILT and SHIPPED as the experiment's
arm — the fallen ledger (World v36), both modes + the cap surcharge as
their own mode, the charge telemetry, fatigue → constitution at rate 0,
the lines by rule set, the `casualty-seams` tag (the kept floor), the
power table (1 / legendary 2 / growth 0; summons zeroed by stamp), the
default flip, the surcharge default; the flip read (three-way, n=120 × 4)
found the twins SPLIT (regen 0.308 → 0.042, deploy 0.475 → 0.300 — the
survivors-searched ARM decides, the §92 re-search is the first real
number), the table alone moving the old rule's game, pacing bimodal at
~½ the user's targets. Re-pin count across the phase: zero. Detail:
WORKLOG §91 (kickoff → 91g) · BALANCE 2026-09-04 §91f · gotchas #129–130.
Kickoff 2026-09-03 (user-signed): World v35 → v36 predicted-corrected;
the cap penalty = a surcharge on the tick cap only; criteria 1 + 2
amended; order = kept seams → tag → table → flip.

- [x] **91a1** the fallen ledger (v36; byte-identical) · [x] **91a2** the
  modes + telemetry + `--set` strings (the tag-vs-HEAD oracle byte-identical)
- [x] **91-pre / 91-pre2 / 91-pre2b** — camp summons join the camp · the
  terminal-cell stand line · the marker compensation (user-signed inserts
  from the survivors playtests; below the tag)
- [x] **91c** fatigue → constitution at rate 0 (byte-identical) · [x]
  **91d** the lines by rule set (both modes off the DOM) → **tag
  `casualty-seams`**
- [x] **91b** the power table (REVERTS under rollback; the oracle FAILS by
  design) · [x] **91e** defaults → casualties (rule-agnostic fakes; the
  4-pair `--set` pin) · [x] **91e2** summons weigh 0 by the `summonedBy`
  stamp (from the first casualties playtest)
- [x] **91f-pre** the desk prediction · [x] **91f** the box flip read
  (BALANCE 2026-09-04 §91f) · [x] **91g** the flip + the close
- ✅ DECIDED (2026-09-04, user-endorsed): `capPenalty` → `survivors` (the
  SURCHARGE) — the cap-draw share rose under casualties on deploy (×3.4).
- Riders → §92 (WORKLOG §91g): the RE-SEARCH first · the user's turn
  targets (2–3 / 4–5 / 6+) as the pool re-pin's anchor · the small-wave
  encounters by composition · the power override · the rollback comparator
  must share a table · the derived-artifact registry fires.

## Phase 92 — The rebalance (under the casualty rule) ✅ CLOSED 2026-09-05 (user-endorsed with the §93 KEEP)

Outcome, one breath: the arm RE-SEARCHED under the rule and the refined winner deployed (92c1/92c2) · the signed table landed — pool max 20 → 40, twelve pools at booked burn × the user's turn targets, the per-encounter POWER OVERRIDE built and used on the four bosses (92d/92e) · the candidate read froze the config on the pre-signed rule (92f: pacing 2.81 / 4.13 / 5.58, act-1 0.717; fatigue costs wins → stays 0) · prior v4 + roster v2 + the fresh derive at the frozen config (92g/92h) · the first fully-manifested board of the new game 0 FAIL / 16 WARN → criterion 1 **0.072**, the gradient holds, the DRAFT lineage tabled unsigned (92i). Two instruments born on the way: the pacing reader (92a) and the scaled overkill threshold (92d-pre). ⚠ open → §94: the arbitration ceilings negative (the ARM docket); the two held flags. Detail: WORKLOG §92 · BALANCE 2026-09-05 · git.

- [x] **92a** the pacing reader ✅ 2026-09-04 — `pacing.csv` + the batch.log table ride `--per-encounter`; the 91f casualties legs re-read through it reproduce the desk table row for row (WORKLOG §92a).
- [x] **92c1** the RE-SEARCH ✅ 2026-09-05 — the 88d2-derive line at `f68540e`, 2.1 h: train 30.8 → 42.3% (3/3 finalists improved), test 33.3%; finalists #80 / #27 / #54 + the winner fixtured, envelope-verified (WORKLOG §92c1).
- [x] **92c2** ✅ 2026-09-05 — the K=4 selection cohort at `cf90f56` (31 min): 10 / 8 / 5 / **13** of 30; the refined winner is the unique argmax → DEPLOYED per pre-signature (a) (`board.ts` DEPLOY = `92c2-winner.json`; the sheet's deploy refs PENDING RE-PIN at the §92 board; prior v4 at 92g — WORKLOG §92c2).
- [x] **92d-pre** ✅ 2026-09-04 (inserted: step zero on 92d found the 89b2 reader hardcoding the overkill threshold at 3 while the spec scales it 0.15 × pool max) — `overkillThreshold` + `shareOverkillGeThreshold` on the alpha-strike row/render/CSV, the absolute columns kept (WORKLOG §92d-pre).
- [x] **92d** the candidate table ✅ 2026-09-05 — `playerHealthMax` 40; twelve pools (swarms 19–30 · elites 20 / 29 · bosses 36 / 39 / 44 / 36) + the four boss overrides 6 / 6 / 3 / 3 through the formatter; the formatter's dropped-`power` emit fixed on the way; the oracle FAILED on all five CSVs (the control — WORKLOG §92d).
- [x] **92e** the power override ✅ 2026-09-04 (built ahead of 92c2 while the derive cooked — an inert seam until 92d authors it) — `WaveUnitSpec.power?` → the resolver stamp → the editor's `pow` field → four wave pins + the ledger pin + the spec/DESIGN amendment; no bump (confirmed); the oracle PASSED (WORKLOG §92e).
- [x] **92f** the candidate read ✅ 2026-09-05 (2.6 h at `1d51d06`) — pacing normal 2.81 / elite 4.13 / boss 5.58 (targets 2.5 / 4.5 / 6), deploy act-1 clear 0.717 / win 0.350; the pre-signed rule: R1 pool max HOLDS 40 · R2 in band per kind (⚠ the moved swarms read 3.04, +22% — held, flagged for the user) · R3 fatigue COSTS wins (regen 13:3) → stays 0; **the config FREEZES at `1d51d06`, no 92f2** (BALANCE 2026-09-05 §92f · WORKLOG §92f).
- [x] **92g** ✅ 2026-09-05 — prior v4 under the deployed vector (`9c6c60d`; the bank reads 0.342 / 0.733) + the fresh derive at the frozen config (train 46.2 → 57.7%, held-out 33.3% — the criterion-2 ceiling read); one artifact-kind HOLD, benign (WORKLOG §92g).
- [x] **92h** ✅ 2026-09-05 — the closing cohort at `9c6c60d`, 33/33 in 12 h: integrity 17/17, 0 FAIL / 16 WARN (the sheet's refs are the pool-20 era); the roster table v2 off the eight ARM rows (BALANCE 2026-09-05 §92h · WORKLOG §92h).
- [x] **92i** ✅ 2026-09-05 — criterion 1 **0.072** (pooled, max arm 0.138 — the mechanism working as designed) · the gradient holds (0.100 < 0.125 < 0.725) · pacing at the targets on six arms (2.82 / 4.19 / 5.66) · deploy parity inside ±5 · the §88 re-read on v4 filed · the DRAFT lineage tabled UNSIGNED → the §93 handoff; ⚠ the arbitration ceilings NEGATIVE and larger (deploy −0.20 / walk −0.25) — the ARM question docketed beside §93 (WORKLOG §92i).

## Phase 93 — ⛔ Keep or roll back ✅ DECIDED 2026-09-05: **KEEP** (user-signed)

Taken in the pre-registered order: the feel verdict FIRST (three casualties runs, "really good" — filed before the board was shown, the count deviation stated) → criterion 1 **0.072** (≤ 0.30 / max arm 0.138) → the gradient holds (0.10 < 0.125 < 0.725; ⚠ the arbitration ceilings open) → the run shape at the targets (2.82 / 4.19 / 5.66; act-1 0.725) → **KEEP**. The rule ships; the new sheet lineage proceeds to signing at §94; the Round 6 riders SUPERSEDED. Detail: WORKLOG §93.

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
**Added at the §93 KEEP (2026-09-05, user-signed):** (1) the **λ=0 paired
probe** on the negative arbitration ceilings (the 85g6 shape, ~1.5 h) and,
if it does not close them, a `DP_TAIL_SCALE` dial + a 5-vs-10 paired read
(the ARM docket, WORKLOG §92i); (2) the user's UI items — the post-turn
screen shows the fallen LEDGER (who fell when, both sides) and the pool is
shown everywhere, events included (the user's ideas lead); (3) the held
small waves / summoner elites lifted to the swarm scale in the
per-encounter pass (the "sloggy at small numbers" read); (4) the two held
§92 flags dispositioned with the signing (the swarms at 3.04 · the
exchange-rate re-pin); (5) "morale" as the pool's name — a DESIGN naming
decision for the user. Riders → TODO (a won-turn reward shape · power by
rarity · the AoE-status rework · SFX). The kickoff runs in a FRESH session.

**Cut (kickoff 2026-09-05, SHAPE-LOCKED 2026-09-06 user-signed — WORKLOG §94):** the per-encounter pass = the SEVEN HELD rows (§92 already dispositioned 7 of the §87d 14 by measurement); snapshot prediction World v36 holds · **Run v44 → v45 at 94d** (the Run-owned fallen ledger — the user's call, run-end stats); the pacing bands SIGNED onto the sheet at 94h (normal 2.5–3.25 · elite 4–5 · boss 5–6.5); box budget ~23 h over three cohorts.
- [x] 94a — the λ=0 paired probe ✅ 2026-09-06 (8 batches, ~2.2 h, box destroyed): **the fold is NOT the cause** — at λ=0 every ceiling is as negative or worse (deploy −0.325 vs doctrine) and the fold is what helps the deploy shape (act-1 6/20 discordant, z −2.75, −12 pt without it); the doctrine lead is the ROLLOUT's → 94g reads the exchange rate first (BALANCE 2026-09-06 §94a · WORKLOG §94a).
- [x] 94b — the per-encounter pass ✅ 2026-09-06 (⛔ user-signed per row, the level trims included): the seven held rows 20 / 21 / 21 / 24 / 16 / 18 / 22 with the count · level · override levers, ONE config commit through the formatter, per-id verified, the perf oracle FAIL as the live control — WORKLOG §94b.
- [x] 94c — ✅ CLOSED 2026-09-07: the trims re-read (six arms n=120, 3.4 h) — **turns HOLD on every row, normal mean 2.98**; three deep-end rows stay over the cost line (a pre-94b bite property → TODO) → ⛔ **the config FROZEN at `d9675b6` (user-signed)** — WORKLOG §"94c — the re-read + the freeze". The read ✅ 2026-09-06 (the six ARM walk arms n=120, 3.6 h): **both elites HOLD** (posse 4.15 · spreaders 4.05, cap 16.6 → 13.2%); **five normals BREACH** (3.2–4.3 turns; the burn per turn saturates at the player's kill throughput, not the wave — WORKLOG §94c) → the rule's trims 20 → 14 · 21 → 19 · 21 → 17 · 24 → 22 · 16 → 13 **or** the override alternative (lift the burn per kill, keep the pools) = ⛔ DECIDED 2026-09-06 (user-signed): **the rule's trims** as ONE config commit (the override rejected: fractional morale on screen, integers overshoot — WORKLOG §"94c — the disposition") → the six-arm re-read `94c-reread.queue` (~3.7 h) → a HOLD freezes the config.
- [ ] 94d — the fallen ledger, two commits: the DATA ✅ 2026-09-06 (`unit:died` identity + the BOOKED power at ONE emit; `Run.fallenLedger` **Run v45**; 5 main + 1 fuzz pins incl. the Σ-per-side cross-check on real runs — WORKLOG §94d) → the PRESENTATION ✅ 2026-09-06 (the post-turn screen: this turn's fallen per side + the encounter by turn, browser-verified on a 2-turn Guarded Adventurer; the live pool-bar decrement in battle = ⛔ the user's eyeball call, off the same event — open).
- [x] 94e — the pool everywhere ✅ 2026-09-06 (`Run.setPlayerHealth` the ONE write + `run:poolChanged` — four of five writes emitted nothing before; the Game-owned PoolOverlay, fourth chip of the left column, browser-verified on map / event / battle / post-turn; 2 pins — WORKLOG §94e).
- [x] 94f — ⛔ DECIDED 2026-09-06 (user-signed): **"morale" YES** (a words-only rename via `POOL_LABELS` + the chipLabels strings; DESIGN §The encounter loop) + the price book on v4: **gunslinger → uncommon · healer 30 → 32**, everything else HOLD, five KIT watches → TODO; both moves ride 94h (WORKLOG §94f).
- [ ] 94g — ⛔ the ARM disposition: 94a read the fold as NOT the cause → **94g-1 the dial ✅ 2026-09-06** (`rollout.dpTailScale`, a `--set` knob the tail reads at call time; WORKLOG §94g-1) → **94g-2 ✅ READ 2026-09-07 — NULL BY CONSTRUCTION** (eight batches n=120 with same-HEAD dp=10 controls: 0/0 discordant, byte-identical artifacts): **the DP tail has priced ZERO on every CLI arm since 70e** — the arbitration never receives the vector's path weights (gotcha #131; WORKLOG §94g-2 · BALANCE 2026-09-07). The exchange-rate flag is re-graded, not closed: a constant multiplying zero. → ⛔ **the ARM disposition RE-POSED: delete the dead tail (recommended — byte-identical, NOT an ARM change, 94h launches at the frozen config) vs wire it (an ARM change → a real 5-vs-10 read ~3.4 h → 94h re-derives under a live tail)**; the override count bounds the lever (node choice overridden 4–5 %) and moves the ceilings' suspect to portBuy / rewardDaemon / eventChoice / preTurn. → ⛔ DECIDED 2026-09-07 (user-signed): **WIRE and measure** — 94g-3 the wiring (`FuzzStrategy.weights` → `base.weights` fallback; the pin THROUGH `arbitratedWrapFromArgs`; the local proof: tail-on nonzero, dial-at-0 byte-identical to the 94g-2 dp=10 rows) + the tail-on pair `94g3-tailon.queue` (~1.2 h) paired by seed against the 94g-2 dp=10 rows → ⛔ keep-or-delete on the read (WORKLOG §94g-3).
- [ ] 94h — the signing cohort (box ~15 h, one overnight: the fresh derive [`94h-derive.queue`, its own cohort] → the 88d board shape at the final config [`94h-board.queue`, + the prior v5 shadow] → prior v5 + roster v3 → the sheet's numeric re-pins · the parity prose · the swarms flag dispositioned) → the board green → ⛔ user-signed. **94h-pre ✅ 2026-09-06 — the SHAPE landed ahead:** `seamPoolFraction` 0.40–0.45 (the board derives pool HP at verdict time) · `pacingBands` as a DRIFT read on the walk rows (`--per-encounter`, `--merge-stages` POOLS `pacing.csv`) — WORKLOG §94h-pre.
- [ ] 94i — the close (scratchpad sweep → archive `post-88-*` + the spec → META-ROADMAP status → HANDOFF cursor: Round 7 Idioms NEXT → TODO → the agent memory).

## Riders carried in from the Round 6 close — ✅ SUPERSEDED by the §93 KEEP (2026-09-05)

Read for the record at 92i (WORKLOG §92i): the walls (0.467 regen / 0.323 deploy) · the deploy-walk overperformance (reach 0.517) · the gambler shape-flip (deploy +0.8 / regen −7.5 on the maladapted vector) · the band promote (moot under a new lineage). The prior table is v4, the roster table v2 (the registry rebuilt both at the frozen config).

_(Sub-steps cut at each phase kickoff, after shape-lock.)_
