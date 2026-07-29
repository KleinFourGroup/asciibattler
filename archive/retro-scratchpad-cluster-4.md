# Archived scratchpad — Cluster 4: Drafting & Identity (Phases 61→68)

Swept 2026-07-29 at the 68h round close (the distillation ritual's fourth
run — AGENTS.md §"The planning stack"). Disposition of every entry:

- **Batch sizing: when does a batch belong on the box?** → **PROMOTED**
  to AGENTS.md ("Batch sizing" bullet, user-signed at 68h): the shape
  trigger (any multi-arm × ≥40-seed searcher batch → the box) + the
  2×-estimate escape hatch; the wall-clock-estimate shape was rejected
  because the §65d estimate failed for mid-flight-only reasons. The
  68f box-driver ops lessons (commit+push before launching a driver;
  pipeline exit-code masking / the `fetched →` completion signal) were
  promoted alongside it from worklog §68f-ladder.
- **A flat outcome metric is only evidence after a covariate moved** →
  **PROMOTED** to BALANCE.md §Caveats (the uncensored-covariate check +
  prefer de-censoring the design over patching the estimator).

Original entries follow verbatim.

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
