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

- [x] 85a — the table-builder per-hop weight fix (finding 9) + the
      fold design note; table rebuilt from the 84f3 sidecar with the
      corrected builder ✅ 2026-08-24 — meanΔ byte-stable, value/hop
      moved (cornucopia −2.43→−2.69), WORKLOG §85a.
- [x] 85b — the walk-fidelity batch: all-rollouts fire overlay + the
      walker's `rolloutSearch` config + the future-docks rule (only
      the decision dock excluded) + the 0x70a1/0x84c1 → keyed-stream
      migration ✅ 2026-08-24 — re-pin count ZERO (the §77 keyed
      architecture absorbed the break); the 84f2 tripwire probe reads
      portBuy/live/packet 0.4%→56% live — WORKLOG §85b.
- [x] 85c — the fold mechanics: holdings in `readRunMetrics` +
      the clone-bus fired-packet tally + `priorBonus` in scoreTerminal /
      breakdown / decisions.csv (`priorBonus`+`priorLambda`,
      append-last) + `--prior-lambda` ✅ 2026-08-24 — λ=0 probe
      BYTE-IDENTICAL (summary + decisions), λ=1 reads the table's own
      rows back exactly; 12a clamp + 12b fired-as-held + 12c
      judgeLong strip all pinned — WORKLOG §85c.
- [x] 85d — the campRaid preTurn run-layer site ({null, raid};
      player-pull rails at spawn; walker plays it out) ✅ 2026-08-24 —
      the A/B probe caught two silent no-ops pre-commit (the campId
      null predicate; the spawn-order drain race →
      `World.setInitialObjective`, setup-phase only); live probe: 21
      candidates, 4 raids won, mean margin +1.55 — WORKLOG §85d.
- [x] 85e — the ε re-read ✅ 2026-08-24 — the v2 floor rule (E1 +
      max-context, λ=0-derived for all arms, user-signed ×3) re-pins
      all six classes (campRaid's provisional was ~5.6× under; the
      fold's λ=1 noise injection = #12c quantified) — WORKLOG §85e.
- [x] 85f — the box cohort ✅ 2026-08-25 — 30 arms banked (two HEADs,
      pooling PROVEN by the byte-identity oracle); 55pre λ=0.5 paired
      Δwin +0.142 p=0.008 (EXPLORATORY — the tiger-team train/select
      leak); separation + WATCH pass; wall refs RE-PINNED 0.775/0.675
      (user-signed); the pin-fix + ghost-driver saga → WORKLOG §85f +
      gotcha #126.
- [ ] 85h — the amendment session (RE-ORDERED before 85g, user-signed
      2026-08-25: the 55pre fork + λ protocol + search-arm compat all
      shape what 85g searches): agenda =
      scratch/85f-tiger-team-actions.md (8 items incl. the mandatory
      candidate-delta de-fold + disjoint-seed λ banks, the board
      split, the 55pre fork, prior v2 shrinkage) + the
      fold-makes-arb-pay thesis + the λ=0.5>λ=1 overspend signature +
      the campRaid causal arm + the 0.438 regen-walk wall re-read;
      λ_prior's default signs here or at the post-rerun follow-up.
- [ ] 85g — the 55pre re-derive, RE-SCOPED BY 85h (the fork decision
      + λ default + possible `--arbitrate`+`--search` compat);
      `pre55ReachRef` retires or re-pins with it.

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

_(Sub-steps cut at phase kickoff.)_

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
