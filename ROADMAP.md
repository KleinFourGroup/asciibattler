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

## Phase 69 — the run-clone seam + the arbitration core

Charter: `cloneRunForRollout` (all eight serialized RNG streams
re-seeded + a fresh bus — the 57d clairvoyance guard verbatim), the
run-layer driver + evaluator (CRN seed sets shared across candidates,
the null arm, the LOCKED terminal score: pool-delta + death-dominant +
the swept-λ seam), decision-log emission built into the driver from day
one, and the inert-candidate A/A methodology that derives ε from the
CRN paired-margin noise floor. Headless-first; no decision site wired.

- Risk: **MEDIUM-HIGH** — the caching design and rollout-cost pricing
  live here; unknown until the kickoff bench (a `benchRollout` analog
  for run-layer rollouts) lands.
- Decision points: the cost read → confirms the five-site scope or
  triggers the appetite hatch (user call) · the A/A-derived ε
  methodology sign-off (per-site values land with their sites in §70,
  never silently baked).
- Exit criteria: arbitration determinism pinned by test (same seed +
  config → same decisions) · the cost model written to the worklog ·
  the A/A methodology proven on at least one site's context · fuzz
  baselines byte-untouched (everything is opt-in).
- Scope guard: no strategy chokepoint is rewired this phase.

The cut (kicked off 2026-07-30, user-signed; audit + rationale: WORKLOG §69):

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
- [x] 69f — the A/A ε methodology ✅ — AMENDED (the inert probe measures
      exactly 0 by the 69d pin; the floor = broken-pairing null-arm A/A,
      control kept) + proven on two contexts (ε≈3.4 fresh / 0.54
      mid-act); **sign-off = the listed decision point, pending**
      (WORKLOG §69).

## Phase 70 — the decision sites

Charter: wire the five sites through the existing strategy chokepoints,
one commit per site — port buys + packet fires (both contexts) FIRST,
then daemon picks (reward accept + the port lane), redraw/empower, and
node choice with the DP-tail bootstrap (the existing path DP as the
value estimate at the truncation). The recursion dial is plumbed on
every site but defaults cheap; each site's ε floor lands with it.

- Depends: §69 (the seam + driver + score are the substrate).
- Risk: **MEDIUM** — no harness surgery needed (the kickoff audit's
  finding), but each site has a candidate-enumeration design detail
  (fire targeting variants, buy-loop caching, the DP-tail weighting).
- Decision points: the node-choice DP-tail shape if the naive bootstrap
  misbehaves on the elite-detour cases.
- Exit criteria: the arbitrated arm completes full runs on BOTH
  canonical shapes (`--hops=11` and the two-act walk) with all five
  sites live · anchor-arm draw sequences and fuzz baselines
  byte-identical (arbitration is opt-in) · per-site ε values recorded
  in the worklog.

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
