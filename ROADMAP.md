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

**Status: §89 + §90 ✅ CLOSED; §91 IN PROGRESS (kickoff user-signed
2026-09-03 — the cut below; audit + review WORKLOG §91).** The §87d3
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
the largest box spend of the round — ~35 box-hours, 4 nights).
**Decision points — ✅ DECIDED at the 2026-09-04 shape-lock (user-signed;
rationale + the desk table WORKLOG §92 kickoff):** the lever = the player
pool max 20 → 40 (50 the fallback) WITH the enemy pools at booked burn ×
the user's turn targets (pacing IS designed here) · the swarm pools per
the desk table, NO move on the four small waves + the two summoner
elites (composition → §94) · the per-encounter POWER OVERRIDE BUILT,
both directions (spec amendment with 92e) · prior v4 under the
re-searched deploy vector · the encounter `--set` group SKIPPED. Still
open: ⛔ the deploy vector (92c2's argmax, user-signed) · ⛔ 40 vs 50
after 92f. **Exit:** the board green at the draft lineage; the
alpha-strike and gradient reads recomputed on the re-searched arm; the
§88 rarity/price re-read filed. **NOT doing:** signing anything — the
decision is §93.

The cut (2026-09-04, user-signed; ~1 line each, detail WORKLOG §92):
- [x] **92a** the pacing reader ✅ 2026-09-04 — `pacing.csv` + the batch.log table ride `--per-encounter`; the 91f casualties legs re-read through it reproduce the desk table row for row (WORKLOG §92a).
- [ ] **92c1** the RE-SEARCH — the 88d2-derive line verbatim at HEAD (night 1, ~2.7 h; `queue-92c1.txt`).
- [ ] **92c2** finalist regeneration (the 85g5 non-circular envelope check) → the K=4 selection cohort (n=30 @ 1000, ~1 h) → ⛔ the deploy decision → the fixture + `board.ts` DEPLOY + prior v4 (~1.5 h) in ONE commit (the tripwire).
- [ ] **92d** the candidate table — `playerHealthMax` 40, swarm/elite/boss pools per the desk table, one config commit through the formatter with the per-id (old → new) printout.
- [x] **92e** the power override ✅ 2026-09-04 (built ahead of 92c2 while the derive cooked — an inert seam until 92d authors it) — `WaveUnitSpec.power?` → the resolver stamp → the editor's `pow` field → four wave pins + the ledger pin + the spec/DESIGN amendment; no bump (confirmed); the oracle PASSED (WORKLOG §92e).
- [ ] **92f** the candidate read — the two soldier walk twins n=120 + the same twins at `--set=health.fatiguePerStack=0.1` (night 2, ~8 h); one adjustment commit (92f2) allowed, then the config FREEZES.
- [ ] **92g** the derived artifacts at the final config — prior v4 re-measured + the fresh derive (the ceiling read), ~4 h.
- [ ] **92h** the closing cohort — the 88d board shape + the six 89c walk arms + the two survivors@HEAD walk twins (the §93 comparator on the SAME table), nights 3–4 (~17 h) → `roster:table` off the board's ARM rows.
- [ ] **92i** the reads + the DRAFT lineage — criterion 1 · the gradient (fresh ceiling vs the ARM; the survivors gradient at HEAD as the comparator) · the §88 rarity/price re-read · the Round 6 riders for the record → `signed-sheet.json` DRAFT (unsigned) → the §93 handoff.

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
