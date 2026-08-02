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

## Phase 71 — telemetry reporting + instruments ✅ CLOSED 2026-08-01, user-signed

Decision-grade telemetry end to end in five commits: the sidecar →
the per-item aggregate → the flip instrument → the measurement.
Headline: the arbitrated arm sits AT DOCTRINE PARITY on the canonical
walk (17.5 doctrine / 15.0 pinned / 20.0 grant-ε0, all inside paired
noise — the "crater" was a baseline-anchoring error vs the DESIGN
band); grant margins ≈0 confirmed by ablation (three instruments now
agree the marginal channels don't convert at the settled config);
**the cheap inner tier VALIDATED, user-signed, with the
pre-registered re-open after the grant buffs**. v34/v40 held all
phase; summary.csv columns unchanged (pinned). Numbers: BALANCE
§71d; narrative: WORKLOG §71.

- [x] 71a — the log rides out + the sidecar ✅ (18-col long format;
      serial/`--jobs` byte-parity pinned; no bump).
- [x] 71b — the per-item aggregate ✅ (itemKeyOf · null joins · the
      n=80 floor on the table; CLI print + board sections; no bump).
- [x] 71c — the flip-rate instrument ✅ (`--flip-telemetry`,
      shadow-only, non-perturbation pinned; no bump).
- [x] 71d — the measurement + verdict ✅ — 3 box batches (value /
      flips / the findings-driven `--grant-epsilon=0` ablation,
      `e1d7f87`); both decision points user-signed 2026-08-01;
      cpx42 replaces the vanished cx43 (BALANCE §71d).

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
- §71 insertions (2026-08-01, worklog §71): grants join fire on the
  buff agenda · 55–70 is NOT the re-sign anchor · the tier-lock
  re-opens post-buffs (re-run the flip read).
- Cut (kickoff 2026-08-01, user-signed; audit + rationale → WORKLOG
  §72):
- [x] 72a — the arbitrated board twins + the run-alongside cycle ✅
      `57c380b` + the 22-batch box cycle 2026-08-01 — ONE ceiling
      move (act-1 shopper +15, a posture DISSOLUTION), walk ceiling
      unmoved, arb fire Δ 0.000 → fire joins 72c; no bump (as
      predicted). BALANCE §72a + WORKLOG §72.
- [x] 72b-pre — the pool-trajectory instrument ✅ 2026-08-02
      (findings-driven insertion, user-signed: the UNIFIED BAND
      ARCHITECTURE — trajectory grain, win DERIVED; the act-seam
      disentangle; the fresh-act-2 probe CONTINGENT; WORKLOG §72).
      No bump.
- [x] 72b — the reads + the band re-derivation ✅ CLOSED 2026-08-02,
      user-signed — fire verification Δ 0.000 (→ 72c) · the wall
      correction (gotcha #120; §68g dissolved) · the trajectory/seam
      reads (mid-act-2 = the killer) · the sector-merge audit (class
      closed) · ⭐ BANDS SIGNED: seam 13–15 · wall 30–35 re-signed ·
      terminal reach 40–50 · win DERIVED 26–35, 55–70 RETIRED.
      BALANCE §72b ×3 + WORKLOG §72; no bump.
- [ ] 72c — the grant-channel buffs (config-only): redraw + empower
      values swept, judged by the decision-grade instruments
      (Pick%/Δ|picked must move off ≈0) + paired win reads;
      magnitudes user-signed; fire value buffs join here IF 72b
      still reads ≈0 (decision point). No bump.
- [ ] 72d — the tier-lock re-open: the flip read re-runs post-buffs
      (the pre-registered §71d trigger; ~12-seed shadow batch).
- [ ] 72e — the remaining agenda reads: the +2-vs-+4 draw
      non-monotonicity at decision grade (`--draw-add` arms +
      sidecar) · the elite-risk node read (cheap-first off 72a's
      natural rows; the forced-elite dial contingent) · price
      re-dispositions where realized value contradicts §68
      (candidates: discard-one at 8 vs Δ|picked +3.13; the shopper
      port read → unit prices).
- [ ] 72f — the signing session + the round close: the default-arm
      flip (ARM gains `--arbitrate` + doctrine docs) · the sheet
      re-signs (supersession precedent; twins gain bands, the
      doctrine rows' disposition decided) · board green vs the new
      sheet · the round-close ritual.
- Exit criteria: the signed sheet updated (supersedes §68d/f where
  values moved, the supersession precedent) · `balance:board --report`
  green against the new sheet · the round-close ritual runs (scratchpad
  sweep, archives, cursor flip).
