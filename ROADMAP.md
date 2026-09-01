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

## Phase 86 — The balancer performance pass ✅ CLOSED 2026-08-29 (user-signed)

**Outcome, one breath:** profile-first found the balancer IS a
pathfinding benchmark; four oracle-gated levers + the batch riders +
the fail-closed board landed, and the 86f DIRECT end-to-end re-run of
the 86a shapes (pre-lever `d24362e` vs the close HEAD, warmed
worktree, 3 alternating pairs, sanity row byte-identical) measured
**3.47× scored / 3.32× searcher / 2.95× full ARM** — confirming the
chained estimates; fuzz:smoke 314→~146 s at +20 tests. Detail:
WORKLOG §86a–§86f + BALANCE §"The board integrity protocol" + git.

- [x] 86a ✅ — timings sidecar + the first-ever profiles (A* ~50%
      self; the string-key layer ≈ ⅓ of the run; pooling DEAD).
- [x] 86b ✅ — `scripts/perf-oracle.sh` (the 47e oracle, mechanized).
- [x] 86c ✅ — the four levers, each oracle-PASS: L1 A* numeric core ·
      L2 numeric keys · L2b `activeAction` chokepoint + O(1) partner
      index · L3 the exact-input choke-read memo.
- [x] 86d ✅ — the batch riders (transient-only retry ·
      `--merge-stages` · the CHUNK_FACTOR=4 pool · deferrals re-signed).
- [x] 86e ✅ — the fail-closed board split (manifest → VERDICT/DRIFT/
      HEALTH + anchors; decisions user-signed; WORKLOG §86e).
- [x] 86f ✅ 2026-08-29 — the close: the direct re-run above
      (WORKLOG §86f).

## Phase 87 — Roster realism for isolation reads ✅ CLOSED 2026-08-30

The capture → the first manifested board → the committed roster table +
`--roster=sampled` → the X3 re-read at n=80 → ⛔ dispositioned: bands
HOLD as intent, off-band members + the per-act question → §89. Detail:
WORKLOG §87* + BALANCE 2026-08-30.

- [x] 87a ✅ 2026-08-29 — the capture: `playerArchetypes` +
      `rosters.csv` on every batch, byte-identical through --jobs +
      --merge-stages (WORKLOG §87a).
- [x] 87b ✅ 2026-08-30 — the capture cohort: 17/17 at `8c47b73`,
      ⭐⭐ the first verdict-clean MANIFESTED board (0 FAIL / 6
      known-family WARN; gradient monotone; 10,250 roster rows
      banked) — WORKLOG §87b + BALANCE 2026-08-30.
- [x] 87c ✅ 2026-08-30 — the table (8 ARM arms, manifest provenance)
      + the sampled mode, serial/--jobs byte-identical; act-2 entry
      battles record hop 0 (WORKLOG §87c, `4a48fd4`).
- [ ] 87d — the X3 re-read under sampled rosters (⛔ decision point:
      the per-kind band dispositions). Cut 2026-08-30 (shape-locked in
      chat, n=80 the user's call — WORKLOG §87d):
  - [x] 87d1 ✅ 2026-08-30 — shapes confirmed + timing (~1–2 min/arm
        boxed); ⚠ the cohort arm = the EXTENDED searcher arm
        (--arbitrate ⊥ --encounter, the 84b refusal — WORKLOG §87d1).
  - [x] 87d2 ✅ 2026-08-30 — 41/41 verified at `25b487b` (~80 min,
        destroyed on drain); numbers BALANCE 2026-08-30 (87d2) +
        WORKLOG §87d2.
  - [x] 87d3 ✅ 2026-08-30 — ⛔ RESOLVED (user, in chat): bands HOLD
        as intent (per-kind, single band); off-band members → the §89
        defect list; the per-act question DEFERRED-REOPENED at §89
        with inter-sector healing (the A/B feel round); future
        isolation reads use a SINGLE hop (the bracket null) —
        WORKLOG §87d3.

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

Sub-steps (cut at the 2026-08-31 kickoff; audit findings + the scope
calls in WORKLOG §88 kickoff — ⭐ all 17 unit rows are SIGNABLE in the
v2 table, so the unit read is desk work; the thin rows = the 9+9
daemon/packet directional list, shortlist scoped by the user):

- [x] **88a** ✅ 2026-08-31 — tiers order correctly EXCEPT two
      defects (halberdier at uncommon = value #1; the rare tier =
      the worst tier at ×2 price); judged on meanΔ (ρ=+0.400 vs
      price; v/hop −0.105). BALANCE 2026-08-31 + WORKLOG §88a.
- [x] **88b** ✅ 2026-08-31 — 8/8 verified at `45c3232` (bank
      4001–4080, box destroyed): every free endowment ≥ 0 — the
      three negative v2 rows are RELATIVE/priced effects, miner =
      a pure trap-price; discard-one the strongest arm (+0.087).
      BALANCE 2026-08-31 (88b) + WORKLOG §88b.
- [x] **88c** ✅ 2026-08-31 — ⛔ signed: halberdier→rare ·
      rioter→common · janus 40 · all else HOLD (`042c6fe`); ⭐ the
      miner reversal (2,057 considerations/0 fires — fire-site
      horizon blindness) → **daemonized as Dis Pater** (`e176749`,
      +the run-duration guard); discard-one's +0.087 retracted as
      noise; the standing protocol = BALANCE §"The rarity
      verification protocol". WORKLOG §88c.
- [ ] **88d** — the ONE amendment + its board run: the X3 band
      promote question (87d3 docket) + the §88 dispositions; if
      config moved, the FULL board MANIFESTED at one HEAD (the §86e
      pre-registration) + ref re-pins; sheet signed.
      · 88d-board ✅ 2026-09-01 (first fully-manifested board, 0 FAIL / 8
      WARN; the armArgv catch) · 88d2 ✅ signed: v3 prior rebuild + fresh
      derive + band promote → §89 close + the derived-artifact TRIPWIRE ·
      88d3 ✅ v3 + tripwire landed; the scoped ceiling re-read + the sheet
      edit OPEN. WORKLOG §88d–§88d3.
- [ ] **88e** — the close ritual: scratchpad sweep · ROADMAP/WORKLOG/
      spec archive (the post-83 pair) · HANDOFF demotion + Closed
      rounds + cursor → §89 · META-ROADMAP Round 6 ✅ · memory.

## Phase 89 — The encounter feel round (interstitial, post-§88)

Charter (planned 2026-08-30 at the 87d3 disposition, user-called): the
§87d defect list tuned per encounter against the held per-kind bands
(soft: warband-vanguard · five act-1 normals · plagueVictims /
elementalTrio / act-2 artillery+adventurer · the King's climax gap;
hot: plagueSpreaders · infernalColumn · miscreants), and the TWO
REOPENED design questions as a properly-attended A/B feel test:
per-act bands (act-2 systematically hot — design or defect?) and
inter-sector healing. **Spec-first kickoff** (the feel A/B is the
user's call to design, not a numbers-only pass); isolation reads use
the §87 sampled mode at a single hop. **Why post-§88:** encounter
surgery moves board numbers — it lands after the round's ONE sheet
amendment signs, never under it. **Risk:** medium (feel + numbers).
**Exit:** the defect list dispositioned per encounter; both reopened
questions decided; the board re-run green at the tuned config.
**NOT doing:** new encounter content; archetype changes; rarity
(that's §88).

_(Sub-steps cut at phase kickoff, after the spec conversation.)_
