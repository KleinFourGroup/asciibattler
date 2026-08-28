# ROADMAP — Round 6 (Instruments), Phases 84–88

The round's PLAN (it stays a plan for its whole life). The macro order
and this round's charter are in [META-ROADMAP.md](META-ROADMAP.md)
§Round 6; the signed design record is [round-6-spec.md](round-6-spec.md)
§Kickoff resolutions; findings + rationale land in [WORKLOG.md](WORKLOG.md);
live status is HANDOFF's 🧭 Cursor. Sub-steps are cut at each phase
kickoff (AGENTS "The planning stack"), never here.

**Status: SPEC LOCKED 2026-08-22** (the skeleton's §84–87 re-cut to
§84–88 — the measurement instrument became a regular phase, the
`--grant` cohort was retired as the prior's source; WORKLOG §Kickoff).
Sub-steps for §84 are cut at its kickoff.

**Ordering in one breath:** the instrument first (the fold consumes
its table); the fold second (every board run on the pre-fold arm
measures a soon-superseded doctrine — principle #5); perf third
(profile-first, byte-identical, nothing downstream leans on it);
roster realism fourth (re-reads the X3 bands on the fold's arm); the
rarity read last (it consumes §84's unit rows; box time only for the
thin rows); ONE sheet amendment at the close (pre-registered at 83f).

## Phase 84 — The long-horizon shadow instrument ✅ CLOSED 2026-08-24 (user-signed)

**Outcome, one breath:** the run-end shadow on the acquisition sites
landed (84a–c), the first cohort ran (84d) and caught three findings
(packets inert in every rollout · hops-linearity NO · the bridge
underpowered), 84f armed the shadow walk + built the inert-class
tripwire + reran arm 1 — the tripwire reads ALL LIVE, the shadow-only
contract held byte-identical at batch scale, and the **v1 table**
(`tests/fuzz/board/prior-table.json`: 17 units signable · 9 daemons +
9 packets directional = the §88 list · miner structurally 0 at λ=0)
is §85's input. Snapshots held (World v35 / Run v44). Detail: WORKLOG
§84* · BALANCE 2026-08-23/24 · round-6-spec.

- [x] **84a** ✅ 2026-08-22 — `shadowHorizon: { horizonBattles, sample }`
      on the driver (no `k` — a different shadow K would draw extra
      pairs and perturb the stream); a separate record with `horizon`;
      7 new pins incl. a real run-end walk. `hopsRemaining` lands with
      84b's getter. Detail: git.
- [x] **84b** ✅ 2026-08-22 — `Run.hopsRemaining` + the pure
      `remainingSectorHops` (shortest DAG path); 11 pins incl. the
      walker-driven post-seam read. No bump (held). ⚠ Finding: clones
      drop BOTH run-shape dials (`Run.fromJSON`) — a run-end shadow is
      unbounded whatever the batch dial → 84c refuses `--shadow-horizon`
      with `--hops`/`--sector-hops` (WORKLOG §84b).
- [x] **84c** ✅ 2026-08-22 — `shadowDecide` (shadow-only sites on their
      own `siteRng`; null = an EXPLICIT pass) + the `recruit` site + the
      flags with the 84b refusal + `horizon`/`hopsRemaining` append-last
      (pre-84 sidecars still parse) + the horizon-keyed aggregate with
      Δ/hop; 17 new pins; the one-seed smoke wrote the columns (WORKLOG
      §84c — the cost read). Detail: git.
- [x] **84d** ✅ 2026-08-23 — m=1 (the probe) → the cohort on the box
      (arm 1 n=160 + the bridge ×3 at n=80; ~7 h; the stand-down watcher
      destroyed the box on drain). ⭐ Three findings: packets INERT in
      every rollout (no `fire` group in the walker's default weights —
      since §59c/§69e) · hops-linearity ✅ DECIDED NO (the cheap walk
      completes 4.8% from 16–20 hops vs 33% live; value sits in the last
      five hops) · the bridge UNDERPOWERED (paired se ≈ 28 at n=80).
      WORKLOG §84d · BALANCE 2026-08-23.
- [x] **84e** ✅ 2026-08-23 — the v0 table committed (17 units signable ·
      9 daemons directional = the §88 list · 9 packets structural-zero,
      provenance-noted); bridge verdict ✅ DECIDED: CONSISTENT, NOT
      VALIDATING. BALANCE 2026-08-23.
- [x] **84f** ✅ 2026-08-24 — inserted 2026-08-23 (the 84d findings;
      user-signed): 84f1 ✅ the armed shadow long-walk (SHADOW-ONLY,
      live byte-identical) · 84f2 ✅ the inert-class tripwire (at-0
      trigger RE-SIGNED at the 2/499 read) · 84f3 ✅ the overnight
      arm-1 rerun → all classes LIVE, the v1 table, hops-linearity NO
      stands. WORKLOG §84f/§84f2/§84f3 · BALANCE 2026-08-24.

## Phase 85-pre — The rollout-stack adversarial review

Inserted 2026-08-23 at the 84d close (user-asked: "what else are we
missing?"). Charter: a code-reality audit of the arbitration/rollout
stack with adversarial lenses — the live-vs-rollout divergence table
(every `FuzzStrategy` method × the walker's default × each site's
override), evaluator pathologies (the ±200 terms saturating long walks
and swamping the bridge), the CRN/seed contracts, the ε + sample gates,
horizon truncation + the DP tail, clone round-trip losses. Why here:
every §84 hole (packets inert since §59c/§69e · the 84a every-site
shadow · the 84b clone dials · the walker's long-walk death) is ONE
class — the clone diverging from the live run at an un-enumerated seam
— and §85 builds on the table. Runs while 84f3's box arm churns.
**Risk:** low (read-only until fix-first). **Decision point:** ✅
DECIDED 2026-08-23 (user) — a hybrid: the divergence table inline + a
3-agent adversarial panel (one per lens, Fable) + inline probe-verified
merge. **Exit:** the divergence
table + a findings list, fix-first triaged, WORKLOG §85-pre. **Scope
guard:** no live-arm doctrine change outside the §85 standard amendment.
- [x] 85-pre.a/b/c — table + panel + probe-verified merge ✅ 2026-08-23:
      15 findings (9 CONFIRMED incl. dead-terminal quantization = the
      mechanism under the 84d findings; clone dial resets LIVE on the
      board's two --encounter wall rows; the 84f1 no-op edge) —
      WORKLOG §85-pre.
- [x] 85-pre.d — fix-first F1–F5 ✅ landed 2026-08-23 (user-signed; F3 =
      option A: wall rows de-arbitrated, refs PENDING RE-PIN at the next
      board); the walk-fidelity/ε/seed-offset/fold items DEFERRED to the
      §85 amendment — WORKLOG §85-pre "fix-first landing". PHASE CLOSED.

## Phase 85 — The fold + the ε re-read + the two riders

`scoreTerminal` gains `priorBonus = λ_prior × Σ table[item] ×
hopsRemaining` over the holdings delta (daemons · cache packets ·
roster units); λ_prior a board arm swept {0, 0.5, 1}, 0 byte-identical;
the breakdown + decisions.csv column. The ε floors re-derive post-fold
with an event-page context added to `readEpsilonAA`. Riders: the
campRaid RUN-LAYER preTurn decision site (seeds the camp objective;
the 83e forced-engagement probe is its baseline) and the 55pre vector
re-derive (a post-fold `--search`, new fixture). **Risk:** medium-high
(changes the doctrine arm — every arb board row moves). **Decision
points:** λ_prior's signed default (at the amendment); the campRaid
layer re-opens only if it literally never gets picked. **Exit:** the
paired pre/post-fold read; the boon event's three rows separate;
floors re-pinned; the nominator auditioning; the 55pre twin on its
re-derived anchor (`pre55ReachRef` retired or re-pinned).

Cut at the 2026-08-24 kickoff (audit + shape-lock: WORKLOG §85). The
locked spec's linear `× hopsRemaining` is SUPERSEDED at the lock
(user-signed): the fold reads the UNSCALED `meanDelta` (hops-linearity
NO, twice-measured) with a ±0.5×death-penalty clamp; fired packets
count as held; shadow records stay λ_prior=0; campRaid v1 = {null,
raid}. Ordering is fidelity-first so the cohort measures the walk we
keep. World v35 / Run v44 predicted to hold (all harness/bot-side).

- [x] 85a — the table-builder per-hop weight fix ✅ 2026-08-24 — WORKLOG §85a.
- [x] 85b — the walk-fidelity batch (fire overlay · keyed streams; re-pin ZERO) ✅ 2026-08-24 — WORKLOG §85b.
- [x] 85c — the fold mechanics (`--prior-lambda`; λ=0 BYTE-IDENTICAL) ✅ 2026-08-24 — WORKLOG §85c.
- [x] 85d — the campRaid preTurn site ({null, raid}) ✅ 2026-08-24 — WORKLOG §85d.
- [x] 85e — the ε re-read (v2 floors, all six classes) ✅ 2026-08-24 — WORKLOG §85e.
- [x] 85f — the box cohort (55pre λ=0.5 +0.142 p=0.008 EXPLORATORY; wall refs 0.775/0.675) ✅ 2026-08-25 — WORKLOG §85f + gotcha #126.
- [x] 85h — all twelve amendments signed as proposed (λ rerun MANDATORY; λ=0.5 pre-registered) ✅ 2026-08-25 — WORKLOG §85h.
- [x] 85g — the 55pre regenerate + the λ rerun ✅ CLOSED 2026-08-28
      (predictions HELD: World v35 / Run v44, no new RNG streams):
  - [x] 85g1 — the candidate-delta de-fold (per-site `priorItemKeys`) ✅ 2026-08-25 — WORKLOG §85g-kickoff.
  - [x] 85g2 — prior v2 (shrinkage · provenance · TABLE v2) ✅ 2026-08-26 — WORKLOG §85g2a/b.
  - [x] 85g3 — the search-arm compat (the `wrapStrategy` seam, ORACLE sha-IDENTICAL) ✅ 2026-08-25 — WORKLOG §85g3.
  - [x] 85g4 — HYBRID-LIGHT DECIDED ✅ 2026-08-25, user-signed — WORKLOG §85g4.
  - [x] 85g5 — the re-derive at λ=0 doctrine ✅ CLOSED 2026-08-26
        (search → arbitrated selection → finalist-56 DEPLOYED →
        `pre55ReachRef` retired → the re-anchor board run 0 FAIL /
        9 WARN → the re-pin amendment user-signed; ⭐ reach in-band
        first read · parity breach REPAIRED) — WORKLOG §85g5 +
        BALANCE 2026-08-26.
  - [ ] 85g6 — the λ cohort on the CHOOSE bank + the campRaid causal
        arm → λ* → the one-use SIGN bank → λ signs, the 0.438 wall
        re-reads, the ARM updates if λ* ≠ 0. Cut at the 2026-08-26
        kickoff (WORKLOG §85g6-kickoff):
    - [x] 85g6a — the `--camp-raid=off|on` causal-arm dial ✅
          2026-08-26 (site-omission semantics; WORKLOG §85g6-kickoff).
    - [x] 85g6b — the 7-arm λ cohort + the TRAIN bank probe ✅
          2026-08-27 (9/9 verified) — BALANCE 2026-08-27.
    - [x] 85g6c — the reads ✅ 2026-08-27: λ=0.5 confirms
          directionally · campRaid causal ≈0 · the anomaly closed —
          WORKLOG §85g6c.
    - [x] 85g6d — **λ=0.5 SIGNED** ✅ 2026-08-27/28 (SIGN +0.092
          z=2.04 on the pre-specified Δ>0; the ARM gains
          `--prior-lambda=0.5`; the fold-baseline board 0 FAIL —
          ⭐⭐ walls IN BAND 0.304/0.324, ⭐ the port economy
          re-activated; the re-pin amendment user-signed
          2026-08-28) — WORKLOG §85g6d + BALANCE 2026-08-27/28.

**PHASE 85 ✅ CLOSED 2026-08-28** — the fold shipped end to end and
SIGNED INTO THE ARM: `scoreTerminal` + the shrunk site-conditioned
prior (λ=0.5, the three-bank chain) · the ε v2 floors · the campRaid
site (causal ≈0, alive-selective) · the 55pre re-derive (finalist-56
DEPLOYED, `pre55ReachRef` retired, parity repaired) · both walls in
the signed band · the port economy re-activated. Exit criteria all
met (the §85 charter's paired pre/post-fold read = the three-cohort
chain; floors re-pinned at 85e; the twin on its re-derived anchor).
Detail: WORKLOG §85* + BALANCE 2026-08-23 → 08-28.

## Phase 86 — The balancer performance pass

Profile-first (none ever taken): split per-seed cost between outer
battles and rollouts, then `World.tick` itself. Expected levers are
tick-level (pathfinding scratch · `livingUnits` filters · Map churn ·
the pooling TODO with airtight reset discipline); the clone is
measured negligible and K=2 has nothing to halve. Byte-identity oracle
mandatory (the 47e worktree-pinned diff: summary.csv + decisions.csv
sha across arms); a lever that flips a decision is a doctrine change
for the user, not a speedup. **Risk:** medium (the hot loop).
**Exit:** a measured per-seed speedup with byte-identical outputs — or
a documented no-op with the profile on record.

85h riders (user-signed 2026-08-25, WORKLOG §85h): (1) the **board
split** lands §86-adjacent — fail-closed verdict board (missing /
N-A / empty-strategy / under-n / duplicate-seed / provenance all
FAIL) vs drift dashboard vs instrument-health suite, + the
skill-gradient anchor rows (pure-random / greedy / searched upper) +
the per-batch machine manifest; (2) batch/search **perf riders** join
the profile-first agenda (measure before building): transient-only
spawn retry · dynamic per-seed queue · staged n40→80→120 with
pre-registered extension rules · stratified shadow site quotas ·
warm-start + successive-halving for `--search`.

Cut at the 2026-08-28 kickoff (audit + shape-lock: WORKLOG §86;
user riders: robustness over cleverness · in-depth reads). The
charter's outer-vs-rollout split is already answered on record
(battle sim ≈100% of rollout cost) — the profile goes straight at
`World.tick` + the per-tick bot `decide()` layer. World v35 /
Run v44 predicted to hold; timing rides a SIDECAR, never
summary.csv (oracle safety).

- [x] 86a ✅ 2026-08-28 — sidecar `521d606` + the three-shape
      profiles: **the balancer is a pathfinding benchmark** (A* core
      ~50% self / string-key layer ≈ a third of the run; GC 1.5%,
      clone+fold ≈0 — pooling DEAD, profile-backed) — WORKLOG §86a.
- [x] 86b ✅ 2026-08-28 — `scripts/perf-oracle.sh` (worktree-pin +
      junction + sha-compare summary+decisions on 2 shapes; the
      HEAD-vs-HEAD self-test PASSED both shapes). Gates every lever.
- [x] 86c ✅ 2026-08-28 — the levers (✅ DECIDED: L1→L2→L2b→L3, each
      its own oracle-gated commit; escalation floor 1.5× cleared by
      L1 alone). L1 A* numeric core (2.44×/2.29×/2.09×) · L2 numeric
      keys + `(x,y)` CostFn · L2b the `activeAction` chokepoint + the
      O(1) reserved-partner index (scan kept as verifier; scored
      CORRECTED ~1.09× — the first 1.2× was cold-worktree bench bias)
      · L3 the exact-input choke-read memo (ARM median 1.10×).
      **CLOSED at compound ~3.4× scored / ~3.1× searcher / ~2.9× ARM**;
      fuzz:smoke 314→140 s — WORKLOG §86c-signing…§86c-L3-landed.
- [x] 86d ✅ 2026-08-28 — the batch riders; ⛔ RESOLVED (dispositions
      re-signed with two user amendments: no cross-platform magic
      error code — determinism-derived classification, 0xC0000142
      win32-gated; the queue as the finer-chunk pool, NOT a worker
      protocol). d1 transient-only retry (fail-fast on deterministic
      failures) · d2 `--merge-stages` (staged-n → one serial-identical
      artifact set; the real n=12 oracle pins it) · d3 the CHUNK_FACTOR=4
      worker pool (measured: static ~1.15× ideal, dynamic ~1.05× —
      median ~8% box wall; parity pins hold) · d4 deferrals re-signed —
      WORKLOG §86d.
- [ ] 86e — the board split (§86-adjacent, independent): machine
      manifest → fail-closed verdict board (missing / runs=0 /
      under-n / dup-seed / provenance FAIL) vs drift dashboard vs
      instrument health · + skill-gradient anchor rows
      (⛔ decision point: FAIL vs WARN semantics · anchor cadence).
- [ ] 86f — the close: re-run the 86a shapes, record the measured
      speedup or the documented no-op; WORKLOG + Cursor.

## Phase 87 — Roster realism for isolation reads

`playerArchetypes` captured beside `playerLevels` on `BattleResult`; a
committed per-hop roster table with provenance; `--roster=sampled:<hop>`
draws a WHOLE recorded roster row harness-side (no Run stream change);
the X3 isolation cohort re-runs under it on the fold's arm. **Risk:**
low-medium. **Exit:** the sampled mode on the default arm; the
per-kind bands dispositioned hold / re-pin / defect.

_(Sub-steps cut at phase kickoff.)_

## Phase 88 — The rarity read + the round close

Read §84's recruit-site rows per draftable archetype against the
5/3/3/2 tiers and `unitPriceFor`; targeted `--grant` paired arms at
n=80 for the thin rows only; tiers + prices dispositioned per
archetype; the protocol written down as standing for every new
archetype from Round 9 on. Then the close ritual: the ONE sheet
amendment (signed at the post-fold arm, λ_prior's default included),
the scratchpad sweep, the HANDOFF demotion, the META-ROADMAP ✅.
**Exit:** every draftable archetype dispositioned; the amended sheet
signed; Round 7 (Idioms) is NEXT.

_(Sub-steps cut at phase kickoff.)_
