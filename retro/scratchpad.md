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
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

## The rollout-arbitration interstitial

- **First-consumer combinations surface latent seams; control-probe the
  OLD path before assuming the new code is at fault.** The 69b walker's
  first run crashed in `attritionRead` — a scratchpad repro + a `runOne`
  CONTROL probe with the same flag combination (searcher-sans-audition ×
  empower) proved the crash was a latent shipped bug (`2023b6d`), not a
  walker bug, in one step. The §70 site wiring will keep crossing
  never-run combinations — same drill each time. (Worklog §69; the
  chaos-driver TODO carries the instrument-shaped version.)
- **A perfect-pairing pin can invalidate a spec'd methodology — build
  the pin first.** 69d's inert≡null test (margins EXACTLY 0) disproved
  resolution 5's inert-grant ε probe before 69f built it; the amended
  two-sided design (zero-control + broken-pairing floor) fell straight
  out. Cheap contract tests on the substrate pay for themselves at the
  methodology layer. (Worklog §69f.)
