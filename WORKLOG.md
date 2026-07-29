# WORKLOG — The Rollout-Arbitration Interstitial

Per-round narrative log (AGENTS "The planning stack"): findings, decision
rationale, rejected alternatives, scope changes, playtest verdicts land
here under the matching `## Phase N`; the ROADMAP stays a plan (one-line
mutations + a pointer back here). Created at the 68h close (2026-07-29);
the kickoff section lands at the spec session. Prior round's log:
[archive/post-60-worklog.md](archive/post-60-worklog.md).

## Pre-kickoff

- The 68h close ritual archived Cluster 4 → `archive/post-60-*` (the
  close note lives in the archived worklog §68h). The spec session's
  anchor: BALANCE §"The sanctioned direction" + the seven-point brief.

## Kickoff — the spec session (2026-07-29)

**The code-reality audit** (run BEFORE the design conversation, per the
spec-first protocol; the draft spec it hardened:
[rollout-arbitration-spec.md](../rollout-arbitration-spec.md), pending
user edit + sign-off). Findings:

1. **The §57 seams port cleanly.** `cloneForRollout`
   ([src/bot/rollout.ts](../src/bot/rollout.ts)) is a wire-format
   round-trip + re-seed-both-streams + fresh bus; `Run` has the same
   full round-trip (`toJSON`/`fromJSON`, RunSnapshot v40,
   [Run.ts:3285](../src/run/Run.ts)) with **eight named RNG streams all
   serialized verbatim** — so the run-clone seam is the identical
   pattern with the identical clairvoyance guard (re-seed all eight).
   Driver shape (nominate → CRN → evaluate → null-arm + ε,
   [RolloutSearchDriver.ts](../src/bot/RolloutSearchDriver.ts)) and the
   dumb-terminal evaluator ([evaluator.ts](../src/bot/evaluator.ts))
   are the templates.
2. **Every v1 decision site already flows through a single strategy
   chokepoint** — `pickNextNode` (harness.ts:614), the `pickPortBuy`
   ask-until-null loop (:835), `pickPacketFire` at both contexts
   (:557), `pickRecruit` (:905), plus the redraw/empower policy seams.
   Strategies receive the live `Run` read-only and never dispatch —
   an arbitrating strategy needs **no harness surgery**.
3. **The clairvoyance inventory** (what a rollout legitimately knows):
   pre-rolled = map DAG + node kinds, the §66 boss forewarning pair
   (v39), current offer/stock/prices; on-arrival = encounter
   selection, wave rolls, future offers/stock, battle dice — re-seeded
   streams turn those into sampled futures, which is the *correct*
   semantics.
4. **The scored policies' blindnesses confirmed in code**: flat
   `port.daemonValue`/`packetValue`
   ([scored.ts:266,281](../tests/fuzz/strategies/scored.ts)); static
   path kind-weights with no roster-strength conditioning — the 68e
   elite-risk blindness IS this (scored.ts:77–123); the fire policy is
   a threshold + first-usable-packet + max/min-power targeting
   (scored.ts:365–407) — mistiming is structural, not a tuning miss.
5. **The cost fork is real**: a run-layer rollout simulates whole
   battles; whether rollout battles run the battle searcher
   recursively or the cheap tier is the dominant cost driver.
   [benchRollout.ts](../tests/fuzz/benchRollout.ts) exists to price it
   (re-run at the phase kickoff).
6. **Telemetry attaches cleanly**: the H7c opt-in accumulator
   ([telemetry.ts](../tests/fuzz/telemetry.ts)) + `RunResult`
   (`portPurchases`/`packetsFired`/`recruits`) are the precedent; a
   per-decision sidecar (`decisions.csv`) slots beside `summary.csv`
   without touching the fuzz baselines.

Design forks posed to the user (with costs attached): the spec's
UNDECIDED docket, six items.

**The design conversation (same day)** — all six resolved in one
sitting, user-ratified; the resolutions are LOCKED in the spec
([rollout-arbitration-spec.md](../rollout-arbitration-spec.md)
§Kickoff resolutions). Rationale worth keeping beyond the spec's
one-liners:

- **Node choice (IN)**: the horizon objection (path value realizes
  over multiple battles) is answered by a hybrid, not a choice — the
  DP path score becomes the tail estimate at the truncation, a
  value-function bootstrap. The risky immediate decision (elite vs its
  guaranteed non-elite sibling) is what 68e showed the DP getting
  wrong, and that part IS inside the one-battle horizon.
- **Recruits (OUT + named contingency)**: rejected for validity, not
  cost — a one-battle rollout of a permanent asset is censored by the
  draw (most rollouts never field the candidate). The contingency
  (forced-fielding rollouts + analytic draw-probability correction,
  shadow mode first) is pre-named in the spec so a v2 re-open starts
  from a design. Key structural luck: port unit buys share
  `scoreOffer` with recruits, so v1 runs the scorer-vs-rollout
  head-to-head for free.
- **Inner tier (cheap + dial)**: recursion multiplies per-decision
  cost by the battle searcher's own search burden (~20×+ bare battle
  ticks); the CRN pairing shares the cheap tier's bias across
  candidates, so *comparisons* stay mostly fair even where levels are
  pessimistic. The flip-rate instrument decides where recursion is
  worth paying — the §57g K-lock methodology reused verbatim.
- **Terminal score (pool-delta + death-dominant + swept λ)**: the λ=0
  wrinkle is that bits have no terminal value inside one battle, so a
  pure pool-delta arbitrator turns spend-happy (price sensitivity
  deleted). One swept scalar bounds the hand-authoring; §60e's
  accepted idle-high bank is the opposite polarity's precedent —
  neither extreme is obviously wrong, so it's measured, not assumed.
- **ε (empirical A/A)**: at the battle layer ε is anti-thrash for
  standing orders; run-layer decisions are one-shot, so ε's job here
  is purely don't-act-on-noise — hence a noise-floor derivation
  (inert grants are pinned byte-identical → their paired margins ARE
  the noise distribution), per site because a port buy and a preTurn
  fire plausibly have different floors.
- **Re-anchor (run-alongside one cycle)**: the paired same-seed
  old-arm/new-arm diff is precisely the ceiling-move measurement the
  deferred walk-wall/two-act re-read consumes — flipping the default
  immediately would leave the move inferred instead of measured. Extra
  box batches absorbed by the 68h sizing rule.
