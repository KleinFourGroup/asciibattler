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
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

## Cluster 4 — Drafting & Identity (opened 2026-07-21)

- **Batch sizing: when does a batch belong on the box?** (user-filed at
  §65d, 2026-07-25). The 65d A/B (3 arms × 40 searcher seeds) ran local
  and took ~2.5h wall vs the box's demonstrated ~18min at `--jobs=8`
  for comparable work (§57h). The subtlety in crafting a rule: the
  pre-launch estimate said ~75min and was wrong for two reasons that
  only showed up mid-flight — draw-heavy arms fight LONGER battles
  (per-seed cost is arm-dependent, not constant), and concurrent
  pre-commit suites stole CPU from the batch. Candidate shapes for the
  distillation: (a) a wall-clock trigger ("estimate > ~30min → box"),
  (b) a shape trigger ("any multi-arm × ≥40-seed searcher batch →
  box"), (c) an in-flight escape hatch ("if a local batch blows 2× its
  estimate, kill + re-run on the box" — determinism makes the restart
  free). Note (c) needs care: killing arm N mid-batch orphans nothing
  (57g), but the estimate-blown signal arrived HOURS in. Decide at the
  round boundary, not mid-phase.

- **A flat outcome metric is only evidence after a covariate moved**
  (§68e, 2026-07-28). Five plagueSpreaders dose points read taken/inst
  flat (15.7–18.2) and the first instinct was "dead knobs" — because
  the SAME metric had just ranked the normals correctly. What broke
  the tie: enemy-deaths/wave swung 6.7↔30.7 across the same points, so
  the treatment was live and the RULER was saturated (right-censoring;
  BALANCE 2026-07-28 caveat). Distillation candidate: before declaring
  a knob dead OR a metric trustworthy, check one uncensored covariate
  moved; "the metric worked on the last read" is not evidence it works
  on this population's sampling shape. Rider: the user's fix (control
  the arrival state — `--first-node=elite`) beat metric-switching:
  prefer de-censoring the DESIGN over patching the estimator.
