# Scratchpad — rolling notes on process, decisions, gotchas

Running notebook of "things worth talking about" — drop short observations here
as you build. **Swept at every round/cluster boundary** by the distillation
ritual (AGENTS.md §"The planning stack"): each entry gets **promoted** (to
AGENTS / GOTCHAS / TESTING / TODO) or **archived** with the round's docs, so
this file holds only undistilled observations from the current round. Keep
entries short; link commits; group by theme.

Prior eras: the MVP→H7 backlog was swept 2026-07-06 (the ritual's first run) →
[archive/retro-scratchpad-mvp-to-h7.md](../archive/retro-scratchpad-mvp-to-h7.md);
the process-audit + Cluster-3 backlog was swept 2026-07-11 (the second run, at
the micro-round kickoff) →
[archive/retro-scratchpad-cluster-3.md](../archive/retro-scratchpad-cluster-3.md);
the micro-round backlog was swept 2026-07-21 (the third run, at the Cluster-4
kickoff) →
[archive/retro-scratchpad-micro-round.md](../archive/retro-scratchpad-micro-round.md);
the Cluster-4 backlog was swept 2026-07-29 (the fourth run, at the 68h round
close) →
[archive/retro-scratchpad-cluster-4.md](../archive/retro-scratchpad-cluster-4.md);
the rollout-arbitration-interstitial backlog was swept 2026-08-04 (the fifth
run, at the 72f round close — promoted: the confirm-the-deficit and
twice-bitten-class-audit norms + the tsx-wedge note to AGENTS; the
baseline-batch, horizon-blindness, probe-shape, human-overperformance, and
dose-bracket rules to BALANCE §Caveats; the box-batch poll ceiling to TODO) →
[archive/retro-scratchpad-rollout-arbitration.md](../archive/retro-scratchpad-rollout-arbitration.md);
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

- **A new serialized RNG stream = an automatic seed re-baseline — the cut
  line must predict it.** The 74b cut promised "fuzz byte-identical through
  74a–74d" by reasoning about event-node REACHABILITY; the `eventRng`
  construction fork shifted every downstream parent fork (the documented
  H5/L1/48b/50d append cost) and three seed-sensitive tests broke. The
  union-bump prediction rule (48b/49c) has an exact sibling here: a cut
  line that adds a serialized stream predicts the seed re-roll. Candidate
  AGENTS promotion at the round sweep. (`32c1726`, worklog §74b.)
- **Non-vacuousness canaries should SCAN, not pin.** The two-act-walk test
  pinned seed 11 on "an overpowered roster clears act 1 essentially
  certainly" — probing showed ~40% of seeds clear even at level 15 (boss
  pool-bleed is roster-strength-independent). Rewritten to scan for the
  first clearing seed (`openEventAtSeedScan` in Run.test is the same
  shape) — the §61 stream-break lesson ("only non-vacuousness canaries
  re-scan") upgraded to self-healing-by-construction. (`32c1726`.)
