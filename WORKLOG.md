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
- **69c — the bench + THE COST MODEL** (2026-07-30;
  [benchRunRollout.ts](../tests/fuzz/rollout/benchRunRollout.ts), run
  via `npx tsx`). Three depths: fresh hop-1 / 5-battle mid / 16-battle
  late-act-1 — a genuine act-2 state was UNREACHABLE because the cheap
  tier DIED at 8/12/19 battles on three of four trajectories (an
  incidental re-confirmation of the wall this interstitial exists to
  re-read, measured by a brand-new instrument). The numbers:
  - **Clone cost 0.03–0.05 ms — negligible at every depth.** The battle
    sim is ~100% of rollout cost. This kills the main caching
    motivation outright.
  - **Per-rollout (horizonBattles: 1)**: traffic 42–235 ms (the fresh
    hop-1 battle is the heavy end, ~500 ticks; mid/late states run
    40–60 ms) · bare 14–206 ms · searcher 16–454 ms.
  - **The recursion multiplier is 1–2× traffic, NOT the feared ~20×** —
    searcher searches are cadence-gated (4 s) and the searcher often
    ends battles faster; the spec's cost fork was priced against a
    worst case that doesn't materialize at run grain.
  - **Projections at K=2** (labeled assumptions in the bench source:
    ~776 rollouts/act over the seven arbitration surfaces, candidate
    counts + 27 turns/act estimated until §71 measures them): traffic
    ~33–182 s/act → **~1.2–6.7 min per arbitrated two-act run**
    (worst-case bound; realistic ~2–3 min).
  - A 40-seed arbitrated arm ≈ **1.5–2.5 h** → box territory (the 68h
    rule) but comfortably feasible; even full-searcher-tier sampling
    for the §71 flip-rate read is affordable.

  **Verdict SIGNED (user, 2026-07-30): the five-site scope STANDS — no
  appetite hatch; NO cache in v1** (clone cost nil; the only class worth
  ever building — rollout-result sharing across provably non-perturbing
  candidates, the port-ask case — waits for §71 profiling, per
  don't-abstract-for-hypotheticals).
- **69d landed** (`c4c3581`) — the resolution-4 score (dominance
  constants derived from `HEALTH.playerHealthMax`; pool delta SIGNED so
  rest-heals score positive; λ default 0 with bits/roster deltas always
  in the breakdowns) + the evaluator over CRN PAIRS (cloneSeed +
  policySeed, both off the caller's stream — the walker's independence
  contract). The keystone pin: **a byte-inert apply scores IDENTICALLY
  to the null arm** — paired margins of inert candidates are exactly
  zero by construction.
- **69e landed** (`a065360`) — `RunArbitrationDriver`: the 57f decide
  loop site-agnostic (CRN pairs off the driver's own stream · null arm +
  strict-ε · argmax first-wins), with the DECISION LOG built in
  (RunDecisionRecord: site, (sectorId, hop) with the #110 pre-root
  guard, labels null-first, full per-candidate results, chosen, margin,
  ε). **Arbitration determinism PINNED — the phase exit criterion.**
  Mechanics pinned via an injected-evaluator seam (the selectByScore
  inert-seam precedent); per-call ε override ready for §70's per-site
  floors.
- **69f — the A/A ε methodology, AMENDED by the 69d finding + proven on
  two contexts.** The spec's sketch (inert grants as the A/A probe)
  measures EXACTLY ZERO by construction — the 69d pin: byte-inert
  candidates keep CRN pairing perfect, so their margins carry no noise
  at all, and an ε derived from them would be 0 and guard nothing. The
  amended two-sided methodology ([epsilonAA.ts](../tests/fuzz/rollout/epsilonAA.ts)):
  the byte-inert read survives as the CONTROL (must margin exactly 0 —
  proves the floor read measures luck-resample noise, not estimator
  slop), and THE FLOOR is the null arm evaluated under DISJOINT fresh
  pair sets — equal true value, pairing FULLY broken, margins paired
  two-by-two, **ε ≈ 2σ**. A real candidate's noise sits between the
  control's 0 and this floor (trajectories share a prefix until the
  state divergence bites), so 2σ is conservative. First numbers
  ([readEpsilonAA.ts](../tests/fuzz/rollout/readEpsilonAA.ts), K=2,
  traffic, M=20 margins, out-of-battle class): **fresh hop-1 σ=1.717 →
  ε≈3.43 pool-HP · mid-act (5 battles in) σ=0.269 → ε≈0.54 · control
  exactly 0 at both.** The 6× spread across depth VINDICATES the
  per-site/per-context derivation (and suggests §70 sites may want
  their floors read at more than one depth — noted for the site
  wiring). Methodology sign-off = the listed decision point, user call
  pending.

**Phase 69 CLOSED (2026-07-30, user-signed ×2 — the amended ε
methodology + the phase close).** All four exit criteria met
(arbitration determinism pinned · the cost model signed · the A/A
methodology proven on two contexts · fuzz baselines byte-untouched,
307→334 purely additive); the round-level snapshot prediction held
(World v34 / Run v40, no bump — every commit bot/harness-side). Six
landing commits (`11e95ea` `d75eab9` `ed8b81e` `c4c3581` `a065360`
`2f604c4`) + the fix-first sensor repair (`2023b6d`). The ROADMAP
section demoted per the §60f rule; two process notes to the scratchpad
(the control-probe drill; pin-before-methodology). NEXT: the §70 phase
kickoff.

## Phase 70 — the decision sites

**Kickoff (2026-07-30).** Shape-locked same day, all four calls
user-approved. The code-reality audit (a day after §69's, so focused on
the site chokepoints as the build meets them):

1. **Three of five sites have ready chokepoints; two don't.** Port buys
   / packet fires / node choice are existing (optional) `FuzzStrategy`
   methods receiving the live `Run` ([Strategy.ts](../tests/fuzz/Strategy.ts))
   — arbitration slots straight in. Reward-accept is HARDWIRED in the
   harness (accept-all / decline-packet-at-full-cache, the 48b/49c
   policy — harness.ts `'reward'` case) and redraw/empower are PURE
   SELECTORS (`selectRedrawPositions(hand, pool, …)` never sees the
   `Run`), consumed directly by the grant walk. So §70 adds TWO
   additive optional chokepoints in the 59a pattern — `pickReward?`
   (70c) and a grant-walk hook (70d), absent = today's behavior
   byte-for-byte. Flagged loudly against the ROADMAP's "no harness
   surgery" risk note; **APPROVED under the scope guard** (additive
   opt-in chokepoints, not surgery; the absent-method byte-identity
   pin is the safety story).
2. **The arbitrated strategy must be per-run stateful** — `runMany`
   reuses ONE strategy instance across seeds, and the arm carries a
   driver RNG + the decision log. Ships as a per-seed factory
   (`makeArbitratedStrategy(runSeed, config)`, driver seed derived
   from the run seed) with the log exposed for §71's csv reporter.
   `scoredStrategy` is stateless so this never mattered before.
3. **The driver seam is ready as-designed** (per-call ε override,
   implicit null arm, labels = the log vocabulary). Rollout-internal
   run decisions stay on the scored cheap tier (the walker contract) —
   no run-layer recursion; the recursion dial is purely the battle
   `innerTier`.
4. **Node choice has no legal "do nothing"** — **null = the scored
   nominator's pick** (the walker resolves it), challengers = the
   other frontier nodes (APPROVED). `makeBestScore` is module-private
   in scored.ts → export at 70e; its units are path-weights, not
   pool-HP — the tail weighting stays the phase's pre-registered
   decision point.
5. **ε floors: per site at TWO depths on the site's REAL context
   class** (APPROVED) — 69f read only the out-of-battle *map-phase*
   class; the port site needs a docked-phase read and
   redraw/empower/preTurn-fire need the preTurn class added to
   readEpsilonAA. Values pin as constants the arm defaults to + land
   here (the exit criterion).
6. **Snapshot prediction confirmed at step grain**: every step is
   bot/harness-side; World v34 / Run v40 hold; fuzz baselines stay
   byte-identical (arbitration is opt-in everywhere).

**The cut** (approved 2026-07-30; scaffold rides 70a — no separate
plumbing commit, APPROVED): 70a port buys + scaffold · 70b packet
fires · 70c daemon picks · 70d redraw/empower · 70e node choice ·
70f exit verify. Checkbox one-liners in ROADMAP §70.

**70a landed (2026-07-30) — port buys + the arbitrated-arm scaffold.**
[arbitratedStrategy.ts](../tests/fuzz/rollout/arbitratedStrategy.ts)
(`makeArbitratedStrategy(runSeed, config)` — per-seed factory, driver
stream at a documented domain offset off the run seed, decision log on
`.driver.decisions`); `--arbitrate` + `--arbitrate-tier` (run-mode-only
per the --scripts discipline; composes with `--jobs` for free — the
parallel parent passes arm flags through verbatim and children re-derive
true seed values, so per-seed construction is shard-safe); the walker
gained the `stopAtPhase: 'port'` stop-condition hook (the header's named
extension seam — the ε-context prep needed a way to park a run at a
dock). Six tests (enumeration derived from live dock state · winner→
PortBuy mapping · re-enumeration after a landed buy · delegation +
pickPacketFire presence mirroring · SITE DETERMINISM with the real
evaluator — the per-site exit pin). CLI wiring smoke: one real
`--arbitrate` run end to end, summary keyed `arbitrated:scored`.

**The 70a ε finding — the port site is SINGLE-DEPTH in act 1.** The
kickoff planned two-depth floors, but both derivation contexts docked
at hop 6: the map places ports mid-act, so there is no early-hop dock
to band against, and act-2 docks are unreachable on the cheap tier
today (the 69c mortality wall). Read (readEpsilonAA, K=2 · traffic ·
M=20 margins · 2026-07-30, both controls exactly 0): fresh-trajectory
dock σ=1.923 → ε=3.845 · warmed-trajectory dock (5-battle warmup,
same hop) σ=1.117 → ε=2.234. **Pinned: `PORT_BUY_EPSILON = 3.845`** —
the conservative of the two same-depth trajectory samples — behind a
`portBuyEpsilon(run)` function seam so a §71/72 depth-aware refinement
(act-2 docks, once the ceiling moves) never touches call sites.

**70b landed (2026-07-30) — packet fires, both contexts.** The site:
per-PACKET candidates with nominator-picked targets (max-power hand/
roster unit; discardCards sheds min-power — the 68a polarity), sites
`packetFire:preTurn` / `packetFire:outOfBattle` (separate ε floors,
§71 reads them apart); duplicate packet ids collapse to the lowest
cache index; legality guards mirrored (context usability · tile ·
the 68a drawCards/discardCards firability pair). **The 60c heal guard
is deliberately DROPPED** — whether a partially-clamped patch is worth
firing is now the rollout's question (a wasted fire margins ~0 and
fails strict-ε): the fire-channel repair working by construction
instead of by hand-authored timing rules; pinned by the
patch-at-full-pool candidate test. The arm now always defines
`pickPacketFire` → always rides the gated path (H4b-aligned). Five new
tests (enumeration restatement · heal-guard drop · dedupe · winner→
PacketFire mapping · preTurn site determinism, real evaluator); 68b
grants = the deterministic cache fixtures.

**The 70b ε findings — TWO amendments, both data-forced:**

1. **The 69f "mid-act map" context was a MISLABEL** — `walkToHorizon(N
   battles)` parks at the `turn-outcome` GATE, not the map (the enterNode
   no-op exposed it when the preTurn prep tried to build on it). The
   famous 0.539 "mid-act map" floor was a gate-state read — a different
   class (one forced dispatch from resolution, hence the low noise).
   readEpsilonAA now stages TRUE map states via the `stopAtPhase: 'map'`
   walker hook (widened from 'port') and keeps the old context, honestly
   relabeled, for the 69f cross-reference. The §69 worklog numbers stand
   as recorded history; the class insight ("6× depth spread") does NOT —
   see 2.
2. **Depth-banding died on the data twice, so the v1 rule is now
   UNIFORM: one FLAT floor per site class, ε = 2σ of the POOLED A/A
   margins across that class's read contexts.** TRUE map states show no
   depth trend (σ 1.717 / 1.561 / 1.139 / 1.994 at hop-1 / 2 / 3 / 5
   battles — state-dependent, not depth-monotone); ports read
   single-depth (70a). Pins (readEpsilonAA 2026-07-30, K=2 · traffic ·
   M=20/context, all controls exactly 0): **map class (outOfBattle
   fires, node choice later) pooled σ 1.632 → ε=3.265 · preTurn class
   pooled σ 0.551 → ε=1.101** (fresh turn-intro σ 0.779; mid-act
   turn-intro σ EXACTLY 0 — a dominated current-battle horizon has
   nothing left to vary, confirming preTurn as the quiet class) ·
   **port re-pinned 3.845 → ε=3.145** (same data, the derivation rule
   unified — the 70a "conservative max-of-two" was ad hoc). A
   state-conditioned ε (noise tracks what's AHEAD, not hops elapsed) is
   a named §71 candidate once decisions.csv shows where noise
   concentrates.

**70c landed (2026-07-31) — daemon picks (the `pickReward?`
chokepoint).** The first approved additive harness touch: an optional
`FuzzStrategy.pickReward(portion, run, rng)` decides the head
`pendingRewards[0]` (true=accept / false=decline; both consume, no
wedge); ABSENT = the hardwired 48b/49c policy byte-for-byte — pinned by
the strongest cheap test available (same seed, absent vs a
hardwired-mirror seam → `toEqual`-identical RunResult, seam
consultation spied). The arm arbitrates DAEMON portions only —
**the polarity FLIPS at this site**: the null arm CARRIES the
acquisition (the walker's reward case accepts on every null rollout)
and the single challenger is `declineReward`, so hysteresis protects
the incumbent accept-all and a decline must prove the daemon actively
HARMS by > ε within the horizon. That's the bias-safe frame for a free
permanent asset the one-battle horizon can only under-count (the
recruit-censoring lesson, resolution 2) — and the decision log's
margin is per-daemon draft attribution EITHER way (goal 2 rides the
record, not declines). Bits/packet portions mirror hardwired with no
arbitration. The port lane of the daemon site was already live (70a
port buys). ε: the reward-gate class read at two depths (σ 1.059 /
1.734, controls 0) → pooled **ε=2.873**; readEpsilonAA's
`stopAtPhase` prep widened to 'reward'. Fixtures: daemon drops are
elite/boss-gated (35% daemon-cache) — too rare to hunt, so tests
splice a daemon portion into a real reward snapshot (rollRewards'
header blesses synthetic inputs; 'portunus' is port-lane-only, never
pre-owned). Five new tests; fuzz:smoke 345→350 expected at commit.

**70d landed (2026-07-31) — redraw/empower (the grant-walk
chokepoint).** The second approved additive harness touch: an optional
`FuzzStrategy.pickGrantAction(grantIndex, run, rng)` the grant walk
consults ask-until-null per grant (same no-progress contract as the
policy blocks; presence supersedes the `--redraw`/`--empower` policy
path entirely and flips the turn gates). Routing equivalence pinned the
strong way: a hook MIRRORING level:2/hi ≡ the policy path,
`toEqual`-identical RunResult on a janus+mars granted run (the level
policies are draw-free, so the stream difference between `strategyRng`
and the dedicated policy streams is invisible — that's what makes the
mirror exact). Arm candidates are nominator-trimmed: redraw = the
level-policy picks at k∈{1,2} (position sets deduped; k=0 IS the null),
empower = every hand position (hands are small; level:hi is among
them). **The rollout walks with the grant policies forced OFF** via a
new decide-time rollout override on the driver (merge-over-config,
additive) — the walker's own doctrine-default grant walk would
otherwise re-spend the grant under the NULL arm and collapse every
margin while the live loop passed (the port-site divergence, grant
flavored); no future turn-intro is contaminated because the preTurn
horizon ends at the current battle. ε: the grant site shares the
preTurn CLASS floor (`GRANT_EPSILON = FIRE_PRETURN_EPSILON = 1.101` —
same turn-intro clone context, same horizon; the unified per-class rule
needs no new read). Sites `grant:redraw` / `grant:empower`. One fixture
lesson: MERCURY is the coin-flip redraw idol and JANUS the unconditional
one — the descriptions say so and the first fixture run enforced it.
Five new tests; fuzz:smoke 350→355 expected at commit.

**70e landed (2026-07-31) — node choice with the DP-tail bootstrap.
ALL FIVE SITES ARE LIVE.** The site: the base strategy is the NOMINATOR
— its pick IS the null arm, and the decide-time rollout override pins
the walker's map pick to `base.pickNextNode`, so a live "null stands"
and a rollout null enter the SAME node (the coherence rule every site
obeys); challengers = the other frontier nodes; a singleton frontier is
not a decision. The tail (resolution 1): `makeBestScore` exported from
scored.ts; the evaluator gained an optional `spec.tailScore` (score +=
tail on each walked clone, `tailBonus` always visible in the breakdown
— resolution 4); tail = `DP_TAIL_SCALE × max over ONWARD children of
bestScore` from wherever the clone stopped (the entered node's own
value is REALIZED by the rollout, never double-counted). **Two scale
findings:** (1) `DP_TAIL_SCALE = HEALTH.restHealAmount` (5 pool HP per
path-weight point) — config-derived per the balance-proof rule, not
hand-tuned; (2) **the DEFAULT vector's path weights are ALL ZERO**, so
under the doctrine arm the tail contributes exactly 0 and node
arbitration is pure rollout-vs-ε — the tail activates only for
searched vectors carrying real path preferences. The pre-registered
decision point (the tail shape if the naive bootstrap misbehaves on
elite detours) stays open pending §71 telemetry; the elite-detour case
itself is exercised by a real-evaluator test (elite + non-elite
frontier, hunted deterministically, decision logged + deep-equal
across two constructions). ε: the map class floor
(`NODE_CHOICE_EPSILON = FIRE_OUTOFBATTLE_EPSILON = 3.265` — same clone
context + horizon). `pickRecruit` alone still delegates (resolution 2:
recruit/pass OUT for v1). Four new site tests + the evaluator tail
pin; fuzz:smoke 355→360 at commit (the entry's original 361
prediction miscounted — corrected at 70f).

**70f — the exit verify (2026-07-31).**
[verifyArbitratedRuns.ts](../tests/fuzz/rollout/verifyArbitratedRuns.ts)
(kept as a re-runnable artifact) drove 16 FULL arbitrated runs — both
canonical shapes × 8 seeds (two per shape with forced janus+mars
grants so the grant sites engage regardless of character daemons),
bare-selector battles (site liveness is run-layer; strength is the
searcher's business). **ALL SEVEN SITE COUNTERS LIVE, 660 decisions
logged, every run terminal without a wedge** (3 complete / 13 defeat —
the bare tier losing is expected): portBuy 4 · packetFire:preTurn 186
· packetFire:outOfBattle 31 · rewardDaemon 5 (natural elite-drop
daemons, no surgery needed at run grain) · grant:redraw 59 ·
grant:empower 321 · nodeChoice 54. Per-run decision volume 12–89 —
the goal-2 density promise (hundreds of decisions per small batch) is
already visible. **Full-dress doctrine-arm runs (searcher battles,
`--searcher --audition --arbitrate`, both default bases wrapped): 8
runs across both shapes, ZERO hangs, 50% win rate per arm,
~1.6–6.8 min per run — inside the 69c projection band (~1.2–6.7 min);
a 40-seed arbitrated box arm stays ~2 h territory as priced.**

**The per-site ε table (the exit criterion; the unified pooled-σ rule,
readEpsilonAA 2026-07-30/31, K=2 · traffic · M=20/context · every
byte-inert control exactly 0):**

| context class | per-context σ | pooled σ | ε = 2σ | sites |
|---|---|---|---|---|
| port dock | 1.923 / 1.117 | 1.573 | **3.145** | portBuy |
| map | 1.717 / 1.561 / 1.139 / 1.994 | 1.632 | **3.265** | packetFire:outOfBattle · nodeChoice |
| turn-intro (preTurn) | 0.779 / 0.000 | 0.551 | **1.101** | packetFire:preTurn · grant:redraw · grant:empower |
| reward gate | 1.059 / 1.734 | 1.437 | **2.873** | rewardDaemon |

Baseline byte-identity: fuzz:smoke green at every §70 commit
(307→334→340→345→350→355→360 across the phase, all additive; the
anchor arms never define the new chokepoints).

**A port-site semantics note (the 70a design detail, decided at
kickoff):** each ask of the ask-until-null loop arbitrates ONE forced
buy — candidate = "buy slot X now", null = "stop here". Inside the
rollout the walker's port handler must NOT re-shop the current dock
(that would let the cheap policy buy the candidate under the null arm
and zero the margin while the LIVE loop stops buying — a live-vs-
rollout divergence): the rollout strategy carries no `pickPortBuy`, so
every clone leaves the dock right after the applied candidate (null =
leave immediately). Future ports inside the horizon go unshopped under
EVERY arm — shared bias, cancels under CRN. Multi-buy value emerges
greedily: each landed buy re-arbitrates against the mutated stock/bits
(the 59a idiom unchanged). At λ=0 spending is score-free by
resolution 4 — a useless buy margins ~0 and FAILS the strict-ε gate,
and the always-on bitsDelta telemetry columns keep any spend-happy
drift visible.

**Phase 70 CLOSED (2026-07-31, user-signed).** All three exit criteria
met (all-sites-live full runs on both shapes · baselines byte-identical
throughout · the per-site ε table above) and the round-level snapshot
prediction held (World v34 / Run v40 — every commit bot/harness-side).
Seven commits: the kickoff docs (`498a23b`) + six landings (`d946bf6`
70a · `f89031a` 70b · `3a51c03` 70c · `62e53b4` 70d · `64752b2` 70e ·
`aa6a07a` 70f); fuzz:smoke 334→360 purely additive, 2350 main green at
every gate. The two approved ADDITIVE chokepoints (`pickReward?` /
`pickGrantAction?`) are the phase's only harness touches, both pinned
absent≡hardwired. ROADMAP §70 demoted per the §60f rule; two process
notes to the scratchpad (the `-e` probe wedge; banding-dies-twice →
uniform derivation). NEXT: the §71 phase kickoff (telemetry reporting +
instruments — the decisions.csv sidecar, board integration, the
flip-rate read).

## Phase 71 — telemetry reporting + instruments

**Kickoff (2026-07-31) — the code-reality audit + the shape-lock.**
Audit findings, cut into ROADMAP §71 same-day (user-signed):

1. **The §70 claim held: the decision log is reporter-ready.**
   `RunDecisionRecord` (rollout/driver.ts) already carries the full
   spec list — site, sectorId, hop, labels, per-candidate results with
   means AND per-pair breakdowns, chosenIndex, marginVsNull, ε — as
   plain JSON data, exposed per-seed via `ArbitratedRunStrategy.driver
   .decisions`. §71 needs no driver change at all.
2. **The one real gap: the log dies at the end of each run.** The CLI
   constructs the per-seed arm inline at the `runOne` call and
   discards it — nothing harvests `driver.decisions`, and `RunResult`
   doesn't carry decisions. That second half matters because `--jobs`
   composition rides ENTIRELY on RunResult round-tripping through
   results.json (the 68e shard protocol). DECIDED: harvest into an
   optional `RunResult.decisions` post-`runOne` — `--jobs` then works
   for free (the parent's merged results carry it), the sidecar
   writer stays a pure reporter function, and summary.csv is untouched
   by construction (the exit criterion).
3. **The flip-rate read cannot literally reuse the §57g prefix
   trick.** kFlip re-derived decisions at K-prefixes WITHIN one
   batch's rollouts — free, prefixes being subsets. Cheap-vs-searcher
   changes the rollout itself, so each sampled decision is evaluated
   TWICE with the same CRN pairs (once per tier), disagreements
   counted. What carries over: the telemetry-is-its-own-arm doctrine
   (honored here as SHADOW-ONLY — live decisions stay cheap-tier, so
   the telemetry never perturbs the batch), the side-CSV shape
   (k-flips.csv), per-site counting. The 69c bench pre-priced
   dual-tier sampling as affordable.
4. **Board + box plumbing already friendly.** The board only reads
   files from instrument out-dirs, and `box-batch.sh fetch` scp's the
   WHOLE batch dir — decisions.csv rides home with zero driver
   changes. §71 adds the per-item READING machinery only; no new
   board instruments (run-alongside is §72's charter).
5. **Pre-registered watches re-confirmed in this log:** the
   state-conditioned ε candidate must earn its way in FROM
   decisions.csv; the DP-tail decision point stays open pending this
   phase's telemetry; the 69c bench's candidate-count / turns-per-act
   estimates were labeled "until §71 measures them" — the sidecar
   yields those numbers for free.

**Schema decisions (shape-locked, user-signed 2026-07-31):** the
sidecar is LONG format — one row per (seed, decision, candidate),
null arm always present at candidateIndex 0 — with mean score + mean
breakdown components (poolDelta / deathPenalty / tailBonus /
bitsDelta) and NO per-pair columns (full breakdowns stay reachable
via `--emit-results` results.json). Decisions attach to `RunResult`
rather than a separate per-run artifact. The flip-rate instrument is
shadow-only, not a separate full arm.

**Round predictions re-affirmed at the cut:** World v34 / Run v40
hold (everything bot/harness-side); fuzz:smoke grows additively.

**71a landed (2026-07-31) — the log rides out + the decisions.csv
sidecar.** Exactly the audit's shape: `RunResult.decisions?` (plain
JSON data, type-only import — the harness never touches it; the CLI
harvests `driver.decisions` from the per-seed arm AFTER `runOne`),
`renderDecisionsCsv` in reporters (18 columns, LONG format — one row
per (seed, decision, candidate), null arm always candidate 0; means
only, per-pair breakdowns stay in `--emit-results`), and one shared
`writeDecisionsSidecar(outDir, results)` called by the serial path and
the `--jobs` parent — parity by code path (the 68e discipline), with
`needResults` widened so `--arbitrate --jobs` round-trips results even
without aggregate flags (the audit's silent-skip gap). Labels are
RFC4180-quoted ONLY when comma-bearing (redraw position lists) — every
other column stays byte-identical to a naive join. Pins: three
reporter unit tests (long-format shape + chosen flags + tailBonus
blank/populated · minimal quoting is load-bearing · summary.csv
byte-unaffected by an attached log — the exit criterion) + the
end-to-end `--jobs` parity case (serial ≡ parallel decisions.csv,
non-vacuous, sized to arbitrated-run costs after the first cut sat AT
the 200s child timeout: 8 runs @hops=3 ≈ 200s vs 4 runs @hops=2 ≈ 19s
— an incidental fresh datapoint for the 69c cost model at bare tier).
A 4-run hops=2 probe wrote 208 candidate rows — the sidecar is dense
even on tiny batches; the 40-seed 71d batch will carry thousands of
rows (fine: it's a sidecar, grep/spreadsheet-bound).
