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
Kickoff 2026-09-03 (user-signed; WORKLOG §91 — the audit, the
adversarial review, the docket): the snapshot prediction CORRECTED to
**World v35 → v36** (the fallen are spliced out at death); the cap
penalty = a SURCHARGE keyed on the tick cap only; criteria 1 + 2
amended in the spec; order = kept seams → tag `casualty-seams` → the
experiment (the rollback range).

- [x] **91a1** — World: the fallen-power ledger at both reap sites
  (neutrals excluded), serialized (**v36**), `battle:ended.fallenPower` +
  `reason`. Landed 2026-09-03: 10 pins (partition / mutual wipe / cap /
  neutral / summon / the DoT reap path / the v36 round-trip + v35 reject);
  baselines byte-identical (WORKLOG §91a1).
- [x] **91a2** — `health.chipMode` + `health.capPenalty` (defaults
  survivors HERE; `src/run/chipRule.ts` — a cap turn charges by every rule
  in {chipMode, capPenalty}); `pools:chipped` charges; `turn:resolved`
  applied chips; the readers on charges (old-shape fallback); the harness
  `reason` + the draw split; `--set` strings. Landed 2026-09-03: ⭐ the
  worktree diff oracle RUN — tag vs HEAD, regen twin n=20: every CSV
  BYTE-IDENTICAL, results.json identical modulo the new fields (WORKLOG).
- [x] **91-pre** — the frost-coven ghoul fix (a camp member’s summon JOINS
  the camp: campId + CampWanderBehavior + the wipe count; user-signed
  2026-09-03 mid-playtest, its fuzz footprint accepted) — inserted here so
  it lands BEFORE `casualty-seams` and survives a rollback (WORKLOG §91-pre).
- [x] **91-pre2** — the glyph stand line = the TERMINAL-CELL rule (the
  baseline sits a measured descender room above the tile; blocks unchanged;
  user-signed 2026-09-03, superseding the misread 79d2 baseline-on-tile
  rule). Render-only; browser-verified 47/47 atlas glyphs + 68/68 live
  sprite anchors against the asset (WORKLOG §91-pre2). **91-pre2b** — the
  X / ! objective markers compensated (`inkBottomLift`): ink-true gaps
  0.100 / 0.200 re-derived live (the user’s eyeball find).
- [x] **91c** — fatigue → constitution at rate 0 (`fatigueMaxStacks` 5,
  the currentHp clamp). Landed 2026-09-03, byte-identical (the oracle's
  new n=20 shape; WORKLOG §91c).
- [x] **91d** — the risk line / PostTurnScreen / UnitCard by mode
  (browser-verified) → **tag `casualty-seams`**. Landed 2026-09-03; both
  modes verified off the DOM (WORKLOG §91d).
- [x] **91b** — the power table (1 / legendary 2 / summon 0, growth 0;
  healer 0 → 1) + the config-derived pin + the (power, level) picker
  re-key. REVERTS under rollback. Landed 2026-09-03; re-pin count ZERO,
  the oracle FAILS by design — the table is live (WORKLOG §91b).
- [x] **91e** — defaults → casualties (both modes); fakes carry fallen
  (both vocabularies); the per-mode-pair harness pin via `--set`. Landed
  2026-09-03; re-pin count ZERO again (WORKLOG §91e).
- [x] **91f-pre** — the desk pre-read off the 90d results.json (the
  prediction 91f is checked against). Filed 2026-09-04 (WORKLOG §91f-pre):
  the player pool burn ~2× per run, both twins' win / act-1 clear well
  under 90d on the maladapted arm; turns-to-clear ~½ the user's targets
  on every kind; elites lose relative bite; the cap share stays open.
- [ ] **91f** — the box flip read (the 90d twins × both modes flipped
  together, n=120, ONE HEAD; three-way vs 90d) → BALANCE (own commit).
- [ ] **91g** — docs + the HANDOFF cursor; the §91 close.
- ⛔ Decision point (91f): the `capPenalty` default flips only on a
  cap-draw share that rises under casualties (the searcher is
  pool-blind — the read is armor against a human stall).
- [x] **91e2** (inserted 2026-09-04 off the user's first casualties
  playtest, user-signed): summons weigh 0 by the `summonedBy` STAMP in the
  fallen ledger, not by archetype; the ghoul's table row → 1 (a fielded
  ghoul is a body). Landed 2026-09-04; spec amended (WORKLOG §91e2).

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
pool-max vs per-unit-cost as the lever; the enemy pool re-pin per kind;
(added 2026-09-04 off the user's first casualties playtest — WORKLOG §91)
whether pacing gets DESIGNED here after all: the user's turn targets
(normal 2–3 / elite 4–5 / boss 6+, "vague vibes") as the enemy-pool
re-pin's anchor via pool ≈ turns × wave power; and a per-encounter POWER
OVERRIDE in the encounter designer (the user's ask) — diverges from the
pre-registered per-archetype weight, so a decision, not a default.
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
