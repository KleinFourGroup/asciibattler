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
- **Inline `npx tsx -e` probes can wedge silently at spawn on Windows
  (~0 CPU forever, no output, no crash) — scratch probes go in real
  `.ts` files.** The 70a second-dock probe sat 28 min at 0.7s CPU; the
  §57g CPU-vs-wall test caught it, and the same probe as a file ran
  fine. Zero work lost (the probe was refine-only), but a
  depended-on probe would have stalled the step. (Worklog §70, 70a.)
- **Hand-authored banding died on the data twice in ONE phase — derive
  floor/threshold rules uniformly and let telemetry earn any
  conditioning.** The 70a port floor planned two depth bands (single
  depth in reality: ports sit mid-act); the 70b map-class sweep killed
  depth-banding outright (σ state-dependent, not depth-monotone — and
  exposed the 69f "mid-act map" context as a turn-outcome gate-state
  mislabel). The unified pooled-per-class flat rule replaced both; a
  state-conditioned ε is now a NAMED §71 candidate that must earn its
  way in from decisions.csv, not from a plausible axis. (Worklog §70,
  70a/70b.)

## §71d (2026-08-01)

- **Confirm a gap exists against the MEASURED anchor before diagnosing
  it.** The arbitrated arm's 15% win read as a crater vs "the 55–70
  band" — but that's the aspirational DESIGN band (itself carried
  unexamined from the one-act era, user-flagged); the measured
  doctrine arm on the same shape wins 17.5%. Two elaborate wrong
  diagnoses (horizon censoring, then ε-gate suppression) got authored
  against a phantom deficit before the baseline check. The ablation
  probe + the anchor lookup killed both in one afternoon — run the
  probe and pull the anchor BEFORE writing the mechanism story.
- **The user's domain stink test beat the model's first theory
  twice** (encounter-scoped grants vs "long-tail censoring"; "I
  sometimes skip redraw" vs "redraw is a big lever"). Surface the
  mechanism claim early and plainly — the correction is cheap when
  the claim is explicit.
- Hetzner ops: a server TYPE can vanish from the catalog entirely
  (cx43 → resource_unavailable everywhere, gone from `server-type
  list`); the §62 fail-loud-on-type doctrine handled it exactly as
  designed — human call, cpx42 picked, default updated.

## §72a–b (2026-08-02)

- **When a pooled recomputation contradicts an instrument, chase the
  discrepancy before trusting either.** The seam-funnel awk pass read
  46 terminal arrivals / 23.9% wall where the board said 0.588 — the
  contradiction WAS the finding (gotcha #120: bare `finalHop` counted
  act-1 deaths as terminal arrivals; the §68g "wall crisis" was
  instrument error, ~2× overstated). A cheap independent recompute of
  a headline metric from raw rows is the strongest lint an instrument
  can get; the §68 signed walls carried the contamination unnoticed
  for a full round because nothing ever cross-derived them.
- **Twice-bitten → audit the CLASS the same day** (user-prompted, and
  the right call): after the second finalHop bite, a one-hour sweep
  of every hop-reading surface found three more sector-blind spots
  (avg-hop, layout×hop, recruit log) and closed the class for good.
  The pattern generalizes: a second instance of any bug shape is the
  trigger to enumerate the shape's whole surface, not to fix the
  instance and move on.
- **The user trimmed a design band on human-overperformance grounds**
  (terminal reach 50–60 → 40–50): bot-anchored targets need the
  ~75%-of-human skill ratio applied at DESIGN time, not just at
  measurement time. Worth remembering whenever a band is proposed
  from bot data alone.
- **Sign the decomposition, derive the product.** Reach × (1−wall) =
  win as sheet MACHINERY (the derived band computes from the signed
  pair in board.ts) means a re-sign can never leave the product band
  stale — the same one-fact-one-home discipline, applied to numbers.
