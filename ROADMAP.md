# ROADMAP — The Rollout-Arbitration Interstitial (Cluster 4→5)

**Round charter**: the §57 lesson applied to the run layer — run-layer
decisions enumerate candidates and truncated rollouts arbitrate under
paired luck, killing the §60c consumption treadmill BY CONSTRUCTION,
with decision-level value telemetry as a co-equal first-class goal.
The governing spec: [rollout-arbitration-spec.md](rollout-arbitration-spec.md)
(RATIFIED + all six resolutions LOCKED 2026-07-29). Narrative home:
[WORKLOG.md](WORKLOG.md). Phases 69–72, shape-locked 2026-07-29.

**Why this order**: seam before sites (§70 consumes §69's clone/driver/ε
machinery) · instruments before the agenda (§72's reads need §71's
decision grade) · the agenda last because every deferred item explicitly
waits on the ceiling move.

**Round scope guards** (the spec's OUTs): no player-facing AI (this is a
harness/bot instrument, the §57 shape) · no battle-searcher re-tune
(K=2 + the §57c locks stay closed) · no new mechanics or content ·
recruit/pass stays scored — the forced-fielding shadow contingency is
NOT built (its re-open triggers are pre-registered in the spec).

**The appetite hatch** (runs on SCOPE, not time): if §69's cost pricing
comes back ugly, §70 narrows to port buys + packet fires (the
irreducible core carrying goals 1 and 2) — the round does not extend.

**Snapshot prediction** (the 48b/49c rule, round-level): World v34 /
Run v40 HOLD all round — everything lands bot/harness-side; no
serialized union is touched. A phase cut that contradicts this must say
so loudly at its kickoff.

## Phase 69 — the run-clone seam + the arbitration core ✅ CLOSED 2026-07-30, user-signed

The full arbitration substrate landed bot/harness-side in six commits +
one fix-first repair: the eight-stream clone seam · the horizon walker
(tier dial) · the cost model (clone ~0 ms, recursion 1–2× not ~20×;
**five-site scope + no-cache SIGNED**) · the resolution-4 evaluator
(inert≡null pinned) · the driver + built-in decision log (**arbitration
determinism pinned — the exit criterion**) · the **AMENDED A/A ε
methodology SIGNED** (zero-control + broken-pairing floor; ε 3.43
fresh / 0.54 mid — per-site+depth floors for §70) · the latent §54×K4
sensor crash found + fixed (`2023b6d`). All four exit criteria met;
v34/v40 held; baselines byte-untouched. Detail: WORKLOG §69.

- [x] 69a — `cloneRunForRollout` ✅ `11e95ea` — six contract tests, fuzz
      baselines byte-untouched, no bump (as predicted).
- [x] 69b — the rollout walker ✅ — both contexts + determinism pinned;
      surfaced + fixed the latent §54×K4 sensor crash fix-first
      (`2023b6d`); no bump (WORKLOG §69).
- [x] 69c — `benchRunRollout` + the cost model ✅ `ed8b81e` — **DECIDED,
      USER-SIGNED 2026-07-30: five-site scope STANDS (no hatch) · NO
      cache in v1** (clone cost negligible; WORKLOG §69).
- [x] 69d — terminal score + evaluator ✅ `c4c3581` — resolution-4 lock,
      dominance config-derived; inert-apply ≡ null-arm pinned (the 69f
      foundation).
- [x] 69e — driver core + decision log ✅ — arbitration determinism
      PINNED (the exit criterion); ties→NULL/ε/argmax mechanism-pinned
      via the evaluator seam.
- [x] 69f — the A/A ε methodology ✅ `2f604c4` — AMENDED (the inert probe
      measures exactly 0 by the 69d pin; the floor = broken-pairing
      null-arm A/A, control kept) + proven on two contexts (ε≈3.4
      fresh / 0.54 mid-act); **methodology SIGNED, user, 2026-07-30**
      (WORKLOG §69).

## Phase 70 — the decision sites ✅ CLOSED 2026-07-31, user-signed

All five sites live on the arbitrated arm in six commits, opt-in end
to end: port buys + the scaffold (`--arbitrate`, per-seed factory,
decision log built in) · packet fires ×2 contexts (**the 60c heal
guard RETIRED — the fire-channel repair by construction**) · daemon
picks via the ADDITIVE `pickReward?` (polarity flipped: null=accept) ·
redraw/empower via the ADDITIVE `pickGrantAction?` (rollout grant
policies off) · node choice w/ the DP-tail bootstrap (tail INERT on
the doctrine arm — default path weights all 0). **ε floors UNIFIED to
pooled-per-class flat** (port 3.145 / map 3.265 / preTurn 1.101 /
reward 2.873) after depth-banding died on the data twice. Exit verify:
all seven site counters live over 16 full runs (660 decisions, zero
wedges) + 8 full-dress searcher runs zero hangs inside the 69c cost
band; baselines byte-identical throughout; v34/v40 held. Detail:
WORKLOG §70.

- [x] 70a — port buys + the arbitrated-arm scaffold ✅ — site
      determinism pinned; ε=3.845 (the port site read SINGLE-depth —
      ports sit mid-act; WORKLOG §70); baselines byte-identical
      (fuzz:smoke 340). No bump (as predicted).
- [x] 70b — packet fires, both contexts ✅ — 60c heal guard DROPPED
      (rollouts judge now); ε rule UNIFIED to pooled-per-class flat
      floors (preTurn 1.101 / outOfBattle 3.265 / port re-pinned
      3.145) + the 69f "mid-act map" context exposed as a turn-outcome
      mislabel (WORKLOG §70). No bump (as predicted).
- [x] 70c — daemon picks ✅ — `pickReward?` landed (absent ≡ hardwired
      pinned by identical-RunResult); polarity FLIPPED at this site
      (null=accept, challenger=decline — hysteresis protects the
      incumbent); reward-gate ε=2.873 pooled (WORKLOG §70). No bump
      (as predicted).
- [x] 70d — redraw/empower ✅ — `pickGrantAction?` landed (mirror ≡
      policy path pinned byte-identical); grant-site rollouts walk with
      grant policies OFF (decide-time override); ε = the preTurn class
      floor 1.101 (WORKLOG §70). No bump (as predicted).
- [x] 70e — node choice ✅ — DP tail via the evaluator's `tailScore`
      seam (`DP_TAIL_SCALE = restHealAmount`, config-derived; the
      DEFAULT vector's path weights are all 0 → tail inert on the
      doctrine arm); null pick pinned to the base nominator; ε=3.265
      (map class); elite-detour exercised (WORKLOG §70). No bump (as
      predicted).
- [x] 70f — the exit verify ✅ — 16 bare-tier runs: ALL SEVEN site
      counters live, 660 decisions, zero wedges; 8 full-dress searcher
      runs: zero hangs, ~1.6–6.8 min/run (the 69c band); ε table +
      byte-identity trail → WORKLOG §70.

## Phase 71 — telemetry reporting + instruments

Charter: the `decisions.csv` sidecar + reporters (site, sector/hop,
candidate set, per-candidate rollout means, chosen, margin vs null),
board integration for per-item realized value at decision grade, and
the flip-rate instrument (cheap vs recursive inner tier, the §57g
kFlip-prefix pattern) run on a sampled batch.

- Depends: §70 (needs live sites to log).
- Risk: **LOW-MEDIUM** — reporting is well-trodden (the H7c
  accumulator precedent); the flip-rate read is the one unknown.
- Decision points: the flip-rate verdict — validate the cheap inner
  tier, or name where recursion gets paid (user-signed, the §57g
  K-lock precedent).
- Exit criteria: one 40-seed box batch yields decision-grade per-item
  value reads · the flip-rate read is signed · `summary.csv` columns
  unchanged (the sidecar is additive).

Cut 2026-07-31 (shape-locked; audit findings + schema rationale in
WORKLOG §71 — long-format sidecar, decisions ride `RunResult`,
flip-rate is shadow-only, all three user-signed at the kickoff):

- [x] 71a — the log rides out + the sidecar ✅ — landed as cut (18-col
      long format; `writeDecisionsSidecar` shared serial/`--jobs`);
      byte-identity + summary-untouched pinned; no bump (as predicted).
      Detail: WORKLOG §71.
- [x] 71b — the per-item decision-grade aggregate ✅ — landed as cut
      (itemKeyOf instance-noise stripping · per-decision null joins ·
      n = candidate instances, floor-marked; CLI print + board
      sections); live-proofed on a probe batch. No bump (as
      predicted). Detail: WORKLOG §71.
- [ ] 71c — the flip-rate instrument: a flag on the arbitrated arm
      that shadow-evaluates every decision under both tiers with
      shared CRN pairs (live decisions stay cheap — the §57g own-arm
      caveat honored by construction); per-site flips →
      `tier-flips.csv` + stdout aggregate (the k-flips.csv shape). No
      bump.
- [ ] 71d — the measurement: one 40-seed arbitrated doctrine-arm box
      batch → per-item value reads to BALANCE; one sampled dual-tier
      batch → the flip-rate read; closes at the user-signed flip-rate
      verdict (the phase decision point).

## Phase 72 — the balance agenda

Charter: the run-alongside board cycle (box batches; the scored arm
stays the continuity anchor), then the deferred re-reads in dependency
order — fire-channel repair verification → the walk-wall/two-act
re-read + band re-sign at the MEASURED ceiling move (the paired
same-seed old-vs-new diff) → the +2-vs-+4 draw non-monotonicity at
decision grade → the elite-risk node read → price re-dispositions
where decision-level realized value contradicts the §68 run-level
reads. Closes with the signing session: the realistic-bot default
flips to the arbitrated arm and the sheet re-signs.

- Depends: §71 (every read here consumes decision-grade telemetry).
- Risk: **MEDIUM** — reads may contradict priors (that is the point);
  batches follow the 68h sizing rule (multi-arm × ≥40 seeds → the
  box; commit+push before driver launch).
- Decision points: EVERY band re-sign is user-signed · the default-arm
  flip is user-signed · the four two-act board WARNs resolve (re-sign
  or repair) one way or the other.
- Exit criteria: the signed sheet updated (supersedes §68d/f where
  values moved, the supersession precedent) · `balance:board --report`
  green against the new sheet · the round-close ritual runs (scratchpad
  sweep, archives, cursor flip).
