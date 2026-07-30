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

**The roadmap shape-lock (same day)** — Phases 69–72 approved as
proposed (seam → sites → instruments → agenda; ordering rationale in
the ROADMAP header). ROADMAP_MAX_LINES re-sized 500→320 at authoring
(the C4 re-size precedent). Round-level snapshot prediction recorded:
World v34 / Run v40 hold — everything is bot/harness-side.

## Phase 69 — the run-clone seam + the arbitration core

**Kickoff (2026-07-30).** Pre-flight green: 2343 tests / 150 files, 0
skipped (matches the Cursor pin). The code-reality audit — a day after
the spec-session audit, so focused on what the *build* touches:

1. **The 57d template ports mechanically.** `Run.toJSON` serializes
   exactly eight named streams ([Run.ts:3285](../src/run/Run.ts)) and
   `fromJSON(snap, bus)` already takes a fresh bus — `cloneRunForRollout`
   is a wire round-trip + eight forks off one seed stream.
2. **The real new machinery is the run-forward WALKER, and it can't
   reuse `runOne`.** The harness battle machinery (harness.ts:400–748)
   is bus-handler closures over `runOne` locals (battle:started builds
   the World + spawns; the phase switch walks map/turn-intro/battle).
   §69 writes a purpose-built ~100-line walker (bus wiring + phase walk
   to the horizon; none of the telemetry/abort/arm bookkeeping).
   Intermediate run decisions inside a horizon resolve via the scored
   cheap policies — made explicit in the walker's contract.
3. **Horizon detection is free**: count `battle:ended` on the clone's
   bus (1 for preTurn contexts, "end of next battle" for out-of-battle).
4. **The ε A/A substrate exists as advertised**: `RunConfig.grants`
   daemon/packet grants draw nothing — byte-identical run stream
   ([RunConfig.ts:199](../src/run/RunConfig.ts)).
5. **benchRollout is battle-layer only** → `benchRunRollout` is a new
   sibling needing clone + walker first; the cost read lands at 69c, as
   early as the machinery allows (front-loads the appetite-hatch call).
6. **Snapshot prediction confirmed at step grain**: every step is
   bot/harness-side, v34/v40 hold, no step touches harness.ts, fuzz
   baselines byte-untouched.

**Three calls, user-signed at the shape-lock:**

- **Placement**: the clone seam in `src/bot/` mirroring `rollout.ts`
  (the RolloutSearchDriver harness-only-but-src/bot precedent); the
  walker/evaluator/driver in `tests/fuzz/rollout/` — they import the
  scored strategies + redraw/empower policies, which are test-side.
- **The cheap inner tier defaults to `traffic`** on a
  bare|traffic|searcher dial: RNG-free, deterministic, meaningfully
  less dumb than bare at near-bare cost. The bench prices all three;
  §71's flip-rate instrument arbitrates cheap-vs-searcher (the lock).
- **Caching design DEFERRED to the 69c bench read** — no cache in v1
  unless the numbers demand it (don't-abstract-for-hypotheticals; the
  bench is precisely the data that would justify one). If 69c comes
  back ugly, the caching design happens BEFORE the appetite-hatch call,
  since a cheap cache might save the five-site scope.

**The harness-monolith question (user, at the shape-lock): does
`runOne` need urgent refactoring? Verdict: NO — watch, don't refactor.**
(a) It's harness code, not shipped code — the mess costs developer
friction, not correctness. (b) Its draw sequences are byte-pinned by
the fuzz baselines / frozen-anchor doctrine, so any restructure is a
behavior-equivalence surgery (worktree-pinned diff oracle, the 47e
protocol) with zero behavioral payoff — inside a round whose scope
guard is literally "no harness surgery." (c) The walker actively should
NOT share code with it: coupling would make every future walker tweak a
baseline threat, and walker fidelity needn't be exact — bias shared
across candidates cancels under CRN (the same argument that justified
the cheap inner tier). (d) The risk worth naming is DIFFERENTIAL drift
(walker bias that differs *between* candidates — CRN can't cancel
that); §71's decision telemetry + flip-rate instrument are the
detectors. Re-open triggers pre-registered in TODO.md: a third
run-walk consumer (rule of three), or §71 showing systematic
walker-vs-realized divergence.

**The build (2026-07-30).**

- **69a landed** (`11e95ea`) — `cloneRunForRollout` + the six contract
  tests; fuzz baselines byte-untouched, v34/v40 hold, as predicted.
- **69b's first run surfaced a LATENT pre-existing crash** — the
  walker's traffic/searcher tiers died on
  `statusDef: no definition for status id 'empowered'`
  ([sensors.ts](../src/bot/sensors.ts) `attritionRead`, unguarded
  catalog lookup over unit effects). The probe chain: a scratchpad
  repro pinned the effect to a spawned player unit carrying the Mars
  empower buff → a `runOne` CONTROL with `--searcher` (no audition) +
  `--empower=level:hi` **crashed identically** → so this was a live
  harness bug, not a walker bug. Why it stayed latent: plain K1
  stat-fold effects (fatigued/empowered/warded) deliberately have no
  `STATUS_DEFS` entry ([statusBehavior.ts](../src/sim/statusBehavior.ts));
  the traffic anchor arms never ran WITH empower, and the doctrine
  searcher arm always rode `--audition`, whose nominate channel skips
  `evaluate()` — attritionRead never met an empowered unit until the
  walker's cheap tier crossed the two. **Fixed fix-first** (`2023b6d`):
  tolerant `STATUS_DEFS` lookup (a def-less fold buff is never a DoT) +
  a regression pin. Anchor-arm draw sequences untouched (they never
  reached the changed branch); fuzz:smoke green. Exactly the class of
  latent seam the §69 divergence watch expected — surfaced on day one,
  by construction (the walker exercises real combinations the arms
  never did).
- **69b landed** — [walker.ts](../tests/fuzz/rollout/walker.ts):
  horizon = a `battle:ended` count, which DISSOLVES the spec's
  current-vs-next-battle distinction (both are `horizonBattles: 1` from
  their clone contexts); gates always ON in the clone (H4b RNG-aligned)
  so the run pauses at turn gates instead of auto-cascading mid-emit;
  one-walk-per-clone; the `policySeed` independence contract documented
  in the header (passing the rolloutSeed itself would collide fork #1
  of the policy stream with the clone's re-seeded `rng` — draw-free
  under today's default policies, but the contract guards a drawing
  policy); a node-clear horizon, if the node-choice site ever wants
  one, extends the stop condition in one named place. Six tests: both
  cut-mandated contexts, determinism (identical WalkResult +
  byte-identical final snapshot), seed divergence, the tier dial
  (bare/searcher), the maxHops safety bound.
