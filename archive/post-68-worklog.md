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

**71b landed (2026-07-31) — the per-item decision-grade aggregate.**
The reading machinery over the 71a rows, one aggregation code path
with two entry doors: `decisionRowsOf(results)` (the serial CLI, in
memory) and `parseDecisionsCsv` (read-back — board instrument dirs,
fetched box batches; quote-aware, columns resolved by header NAME so
append-last extensions never break old readers). `itemKeyOf(site,
label)` strips INSTANCE noise (prices, hand/roster positions, node
ids) so decisions about the same item pool — unknown sites fall back
to the raw label (graceful degradation). `perItemDecisionStats` joins
every candidate row to ITS OWN decision's null-arm score (Δ =
candidate mean − null mean, the paired-luck margin; NOT the record's
best-challenger marginVsNull) → per (site, item): n, picked, Pick%,
meanΔ, Δ|picked. Surfaces: the fuzz CLI prints the table for any
batch carrying logs (serial-console-only, the 68e file-contract
discipline — a --jobs/box batch re-derives from the sidecar), and
`balance:board --report` appends a per-item section for any
instrument dir carrying decisions.csv (renders nothing today — the
board arms are pre-arbitration until §72 flips the default; the
machinery is what ships). Live-proofed on a 4-run probe: 34 decisions,
four items, sane values (patch preTurn picked 100% at Δ=2.0;
laverna's decline never beat ε — accept-all held). One semantics
catch from the probe, doc'd honestly rather than papered over: on
multi-instance sites n counts candidate INSTANCES, not decisions
(168 'empower' instances across 34 decisions — every hand position
pools into the one item), so empower's Pick% is per-instance; on the
sites the BALANCE reads care about (port slots, daemons, packets,
node kinds) instances ≡ decisions and the two readings coincide. The
n=80 floor rides the table itself (sub-floor rows marked ·,
DIRECTIONAL). renderTable gained a leftCols param (Site + Item both
left-aligned); four unit tests (key extraction · csv round-trip incl.
quoted labels · null-join pooling math · the floor marker).

**71c landed (2026-07-31) — the flip-rate instrument.** The §57g kFlip
lesson, tier-flavored: `--flip-telemetry[=<tier>]` (bare flag =
'searcher', the resolution-3 cheap-vs-recursive read; the value form
exists for cheap cross-tier reads + test sizing — validated in args:
requires --arbitrate, real tier, must differ from the primary or the
read is vacuously flip-free). The mechanism sits in the DRIVER: when
`shadowTier` is set, every decide re-judges the full arm set —
including its own null — under the shadow tier with the SAME CRN
pairs and the same ε rule, and records `shadowChosenIndex` on the
RunDecisionRecord. SHADOW-ONLY by construction: the live decision
never reads it, and the pairs are the driver's entire RNG draw
(derived before either tier evaluates), so a shadowed batch decides
byte-identically to an unshadowed one — pinned by a two-decide
sequence test (records deep-equal modulo the shadow field). Outputs:
`tier-flips.csv` (seed,strategy,site,decisions,flips — the k-flips
shape) via `writeTierFlips` shared serial/`--jobs` (the 71a sidecar
discipline; rides the same results.json round-trip), + a stdout
aggregate sorted most-flippy-first ("where recursion would get
paid"). The record field deliberately does NOT become a decisions.csv
column — the sidecar schema holds; deep digs read `--emit-results`.
Pins: 4 driver tests (flip recorded · agreement + shadow-off-no-field
· shadow honors ε against its OWN null · non-perturbation) + the
reporter fixture test + the parity case extended (tier-flips.csv
byte-identical serial-vs-jobs; traffic shadow on bare primary keeps
it ~60 s). Live probe (bare primary vs traffic shadow, 4 short runs):
4/34 flips (11.8%), ALL at grant:empower — even the two cheap tiers
disagree exactly where candidate sets are dense, a plausibility nod
for the 71d searcher read.

**71d landed (2026-07-31→08-01) — the measurement + the verdict
(user-signed). Numbers in BALANCE §71d (the canonical copy); this is
the narrative.** Box: cpx42 (cx43 vanished from the Hetzner catalog
mid-round — resource_unavailable in all three fallback locations;
type substitution is a human call by the §62 doctrine, user picked
cpx42, the 8-core drop-in; box-launch DEFAULT_TYPE updated in the
close). Three batches, all `fetched →` clean, box destroyed between
sessions (on-demand doctrine).

The diagnosis went through TWO corrections, both worth remembering:

1. **The horizon-censoring story died on the user's stink test.**
   First read of the 15% win rate: "grants are long-tail value the
   one-battle horizon censors" (the recruit lesson). The user pushed
   back — empower and redraw are ENCOUNTER-SCOPED; the horizon
   already contains their value. Correct. Second read: ε is a NOISE
   floor (2σ of A/A margins) mis-applied as a VALUE gate on free
   expiring actions — small true edges sit under it forever. The
   `--grant-epsilon` dial (`e1d7f87`) was cut to settle it.
2. **The ablation + the right baseline killed the second story
   too.** ε=0 moved win only 15.0→20.0 (inside paired noise) and
   refusals persisted ungated — no hidden value. And the "crater"
   itself was a BASELINE-ANCHORING ERROR: the measured doctrine arm
   on this shape wins 17.5 (§68f board), not 55–70 (the DESIGN band
   — which the user then flagged as carried unexamined from the
   one-act era). The arbitrated arm is AT PARITY. Scratchpad note:
   before diagnosing a gap, confirm the gap exists against the
   MEASURED anchor, not the aspirational one.

What stands after both corrections: the arm is healthy at doctrine
parity on the canonical shape; the rollouts honestly measure grant
margins ≈0, agreeing with the §68f fire-channel collapse (three
instruments, one story: marginal channels don't convert at the
settled config — the roster carries the game); the grant channel
joins the fire channel on §72's re-sign/buff agenda per the user's
call ("redraw and empower need major buffs"). The free-action
ε-polarity question (the 70c flip precedent) stays a noted design
nicety — the data says it's low-stakes at current grant values.

**Both phase decision points SIGNED (user, 2026-08-01):** the cheap
inner tier VALIDATED for v1 (economy sites 0% flips; grant flips are
≈0-margin wobble) WITH the pre-registered re-open trigger — re-run
the flip read after the grant buffs land; and the grant finding in
its final form above. All three §71 exit criteria met: the 40-seed
batch yielded decision-grade per-item reads (2,563 decisions) · the
flip read signed · summary.csv columns unchanged end to end (pinned
by test at 71a, verified by sha parity through every batch).

## Phase 72 — the balance agenda

**Kickoff (2026-08-01) — the code-reality audit + the shape-lock.**
Audit findings, cut into ROADMAP §72 same-day (user-signed):

1. **The board is run-alongside-ready except for the arm itself.**
   board.ts pins the doctrine ARM + 11 instruments; the CLI already
   feeds box-batch (`--plan`), selects (`--only`), and appends
   per-item decision sections for any instrument dir carrying
   decisions.csv (the 71b hook, written for exactly this moment). The
   one missing piece is an arbitrated-arm concept — and since seeds
   are 1..40 in-sample by construction, the paired same-seed
   doctrine-vs-arbitrated diff can ride the existing BoardDelta
   machinery as REPORT ROWS: the ceiling-move measurement becomes
   board output, not a hand ritual (the 68c principle re-applied).
2. **The arm labels compose cleanly, no CLI change needed:**
   `--arbitrate` bare = the traffic tier (the 71d-validated cheap
   tier — the settled default), and the arm names itself
   `arbitrated:${base.name}`, so a twin's strategyRow is the doctrine
   row `arbitrated:`-prefixed.
3. **The grant-buff knobs are pure config** — empower.json (the +4
   mods), deck.json's redraw block, packets.json's fire items,
   prices.json. Value-level buffs stay inside the round's
   no-new-mechanics guard, and the round snapshot prediction
   (v34/v40 hold) survives §72: config JSON is not a serialized
   union.
4. **Every dial the agenda needs exists, parse-guarded:**
   `--arbitrate`/`-tier`, `--grant-epsilon`, `--flip-telemetry`,
   `--draw-add`. §72 is reads + config tuning + one small board
   extension; no new instrument building.
5. **Cost reality:** the 71d walk batch (40 arbitrated-searcher
   seeds, `--jobs=8`, cpx42) ran ~30 min → the full 11-twin cycle ≈
   5–7 h of box time across 2–3 batches.

**Shape-lock decisions (user-signed 2026-08-01):**

- **Twins in the one board** (`arb-<id>`; NO checks until the 72f
  signing session gives them bands — pure measurement rows; paired
  ±8pt winRate delta rows per pair, where a WARN = a real ceiling
  move — the tell we render on purpose) over a separate `--arm`
  board mode, which would strand the paired diff outside the board
  or need a bespoke cross-dir diff — more machinery, not less. Spec
  resolution 6 says the paired old-vs-new diff IS the measurement
  the walk-wall re-read consumes; it deserves to be a persisted
  report artifact. The doctrine rows' post-flip disposition (retire
  vs regression control) is decided deliberately at 72f.
- **The full 22-instrument cycle** — box time explicitly not a
  constraint (user).
- **The elite-risk read runs cheap-first:** the 72a cycle's natural
  nodeChoice rows are the first look; the forced-elite dial
  (eliteChance/eliteMinSpacing are plain nodemap.json config) gets
  cut at 72e ONLY if the §71d directional signal (−1.40 mean / +5.0
  picked, n=10) holds and a retune is live. Roles per the §55
  doctrine: the forced shape is the tuning PROBE (force-isolate
  before tuning, the standing rule; also softens the C4
  arrival-censoring bias), the natural pooled read is the transfer
  check.
- **Ordering locked as chartered** (cycle → reads/band
  re-derivation → grant buffs → the flip re-read → remaining reads
  → the signing session): grants convert ≈0 at the settled config,
  so the cycle cleanly measures the ceiling move of arbitration
  ALONE; the buffs then move the value channels, needing only a
  targeted re-verify of affected rows before signing. Fire value
  buffs join 72c IF the 72b verification still reads ≈0 (user call
  at that decision point). The two-act band re-derives from scratch
  at 72b — 55–70 is NOT the anchor (one-act-era provenance,
  user-flagged at §71d).

**The 72b band conversation, part 1 (2026-08-01→02) — the
decomposition insight + the unified band architecture (user-signed).**
Presenting the 72a numbers for the band re-derivation surfaced the
load-bearing arithmetic: **win = reach × (1 − wall), and REACH is the
binding constraint** — at 42.5–52.5% reach, even a zero wall caps the
walk at ~43–53%, so the 55–70 aspiration dies in mid-run attrition,
not at the boss gate (the one-act era had ~90%+ reach; the carried
band was derived in a world without act-2 attrition). The user then
pushed the frame one level deeper — too many disconnected metrics
(per-encounter pool damage, win rate, boss wall), and health never
resets between acts, so sector-2 difficulty was confounded with
sector-1 exit state. The unification, SIGNED: **the run is a pool-HP
budget flow** — encounter grain (the §X damage bands) → trajectory
grain (pool by (sector, hop): the missing connective tissue) → run
grain (reach × wall = win, DERIVED not independently signed). The
new signable design feeling this exposes: the SEAM-POOL band ("how
beat up should you be entering act 2?"). Also signed: the instrument
insertion below (items 1+2 now, the fresh-act-2 counterfactual probe
CONTINGENT on the conditional read proving insufficient), and the
scope flag that a sector-clear partial heal — the obvious lever if
the seam turns out to be the whole story — is a NEW MECHANIC, out of
this round's guard, parked as a named contingency for the signing
session.

**72b-pre landed (2026-08-02) — the pool-trajectory instrument.**
Exactly the signed shape: `poolAtStart` on every BattleResult
(captured where `playerLevels` is, pre-damage — with (sector, hop)
this IS the trajectory sample), `poolAtSectorClears` (one push per
`sector:cleared`, sharing the 68e counter's handler — `[0]` is THE
act-1→act-2 seam value) + `finalPool` on RunResult, two append-last
summary.csv columns (`poolAtSectorEnd` blank pre-seam, `finalPool`),
and the seam-hazard conditional read (`seamHazardStats` — bins are
QUARTERS OF THE CONFIG MAX, the balance-proof rule; empty bins stay
in the shape; the n=80 · marker rides every sub-floor bin) printed by
the CLI for any batch that reached a seam (serial-console like the
71b read — the file contract is the columns themselves). The
deliberate loud change: summary.csv BYTES move (the sectorsCleared
append precedent), pinned by the updated header test
(`endsWith('poolAtSectorEnd,finalPool')`). Six new pins total
(trajectory capture invariants · column render blank/populated ·
binning + floor markers); fuzz:smoke 378→381; live-proofed on a
6-seed scored-only walk probe (1/6 crossed at seam pool 20.0, died
in act 2 — the read renders end to end). v34/v40 hold (harness-side
only).

**The 72b trajectory reads + the wall correction (2026-08-02).
Numbers in BALANCE §72b (canonical); this is the narrative.** The
4-arm walk batch (one box session at `8332ada`, 4/4 fetched, box
destroyed) came back with win rates byte-identical to §72a — the
72b-pre instrument consumed no RNG, exactly as designed — and the
new columns riding every row. The first pooled funnel pass smelled
wrong: 46 terminal arrivals at a 23.9% wall vs the board's
0.588/0.476 walls on the same seeds. Chasing the discrepancy found
**gotcha #120**: the board's §60e bossWall arithmetic filtered
arrivals on bare `finalHop`, which RESETS per sector — late act-1
deaths (hops 10–11 of an 11-hop act) out-hop the act-2 terminal
(hop 10), so ~half the "arrivals" were act-1 deaths and the
deep-end wall read ~2× true. The §68g "wall crisis" (58.8 vs
30–35) dissolves: **the true walls are 0.154–0.333 — at/below the
band already.** Fix-first: computeMetrics goes lexicographic
(sector-aware terminal + arrivals; single-sector shapes unchanged),
parseSummaryCsv gains the sectorsCleared column, the contamination
case is pinned in board.test.ts (18th board test), and the board
report now WARNs the walls from BELOW the band — the honest input
for the re-sign. What the corrected reads say (BALANCE §72b): the
funnel is 100 → 69 → 29 → 22 with **mid-act-2 as THE killer (59%
of entrants die pre-terminal)**; the seam is healthy (~2/3 pool);
the conditional gradient is flat above half pool (act-2 intrinsic
difficulty dominates; the carry tax bites only the bottom ~22% of
entrants — the fresh-act-2 probe stays parked); winners exit with
~2/3 pool (deaths are concentration events, not budget drains).
Next: the band-signing conversation (72b part 2) on the corrected
picture.

**72b CLOSED (2026-08-02) — the band signing (user-signed; numbers
in BALANCE §72b, the canonical copy).** The user signed the unified
architecture wholesale and made the one load-bearing call
conservatively: terminal reach 40–50, trimming my floated 50–60 on
the human-overperformance argument (the bot runs ~75% of human
skill, so a bot-anchored 50–60 would land humans past comfortable —
the §53g ceiling logic applied at design time). Encoding: the sheet
carries `seamPoolBand`/`terminalReachTarget`/`deepEndWallTarget`
and `twoActTargetWinRate` is GONE — the walk rows' win band now
COMPUTES from the signed pair inside `walkPosture` (balance-proof:
a future re-sign moves the derived band with the sheet, nobody
authors a win number again). Board metrics `seamPool` +
`terminalReach` land sector-aware, with graceful N/A on pre-72b-pre
batches (the act-1 dirs from the 72a cycle predate the pool
columns — the parse must not throw on them). The report against
current data is the agenda stated as WARNs: reach 0.225/0.325 vs
40–50 (the 72c gap), walls BELOW band at 0.222/0.154 (the terminal
is too soft — expected to drift in-band as reach rises), and the
shopper's win 0.275 already inside the derived 26–35. All grades
stay reference until 72f. With this, every 72b cut item is done
(fire verification → 72c · wall correction · trajectory reads ·
the audit · bands signed) — 72b closes; 72c (the grant + fire
value buffs, judged by the decision-grade instruments, aimed at
mid-act-2 attrition) is next.

**The 72b sector-merge audit (2026-08-02, user-prompted) — the
gotcha-#120 class closed codebase-wide.** After the wall correction
the user asked the right question: where ELSE does sector data merge?
The sweep covered every hop/sector read (harness, reporters, rollout
layer, board, bot, strategies, run layer, config). Ten surfaces
verified sector-aware or correct-by-design (the 68e funnel/chips ·
traces · decisions.csv · the fixed board · per-sector minHop gates ·
the total-by-intent hops cap · the --hops/--sectorHops dials · no
hop logic in bot/strategies). Three sector-blind stragglers found
and fixed same-day: **F1** the CLI's bare "avg hop" (reads BACKWARDS
on walks — an act-2 hop-2 death out-walks every act-1 death yet
lowers the average) → the (sc, hop) position pair, both aggregate
and per-daemon lines; **F2** `perLayoutHopStats` merged act-1 hop-N
with act-2 hop-N — in the table whose own charter is "disentangles
layout difficulty from roster strength by depth" → sector-keyed
rows + a Sec column + the CSV twin, with a merge pin; **F3**
`RecruitChoice` carried no sector (act-ambiguous recruit logs, the
latent third bite) → sector field + trace column. **F4** (caveat,
not defect): the per-item decision table pools across sectors BY
DESIGN — documented as the sector-key rule in BALANCE §"The metric"
(split on the decisions.csv sector column when an act split
matters). None of the four touched the §72b reads or the band
proposal — the funnel/seam/hazard/wall numbers were computed
sector-aware — so the band numbers stand without a re-run; existing
batch data stays valid (battles[] always carried sector).

**72a landed (2026-08-01) — the arbitrated board twins + the
run-alongside cycle. Numbers in BALANCE §72a (the canonical copy);
this is the narrative.** The build half (`57c380b`) was exactly the
shape-lock's shape: `arbitratedTwin()` maps every doctrine instrument
to an `arb-` twin (same args + bare `--arbitrate`; `arbitrated:`-
prefixed strategyRow; NO checks until 72f), 11 paired ceiling-move
delta rows at ±8pt (WARN = a real move, rendered on purpose), + the
`arb-fire-channel` delta pre-wiring 72b's verification — zero cli.ts
changes, three new pins, fuzz:smoke 375→378. Composition de-risked
for pennies before the box spend: a 2-seed local probe proved
`--arbitrate` × `--encounter=` (the one never-run pairing) and the
strategy-column match. The cycle half: box up (cpx42; the §71d
DEFAULT_TYPE fix paying off immediately), a scratchpad driver walked
all 22 instruments sequentially through box-batch.sh run (~4h, every
batch `fetched →` clean — the 68f completion signal), box destroyed
same-session. The report headline: 0 FAIL / 5 WARN — four inherited
two-act markers + ONE new WARN, the act-1 shopper ceiling at +15,
which decomposes as a POSTURE DISSOLUTION (the arm stops shopping
AND starts firing — the §60e posture split was a doctrine workaround
arbitration simply ignores at the sites it owns). Fire still doesn't
convert on the arbitrated arm (necessary-not-sufficient: the repair
fires, the items are too weak) → fire joins 72c per the
pre-registered contingency. The walk ceiling did NOT move — the 72b
band re-derivation anchors on 17.5–27.5/walls ~0.45–0.65 as
measured. One protocol implication flagged for 72f: the
firer/shopper posture-split reference rows lose their meaning on an
arm that dissolves postures — a re-sign question, noted in BALANCE.

**72c round 1 (2026-08-02→03) — the uniform 2× value buffs landed +
measured. Numbers in BALANCE §72c (canonical); this is the
narrative.** The magnitude proposal (the uniform 2× step across both
channels, per-item holds listed) was user-signed same-day and landed
as one config commit (`542596f`) — with one mid-commit catch: the
signed Surge draw-2→3 turned out DEAD under the 65d user-signed
`maxHandSize` 8 cap (hand 6 + 3 clamps; four Run tests caught it
immediately). Surge reverted rather than silently bumping a signed
cap; the user then parked the cap question deliberately —
**tentatively 10, feel-motivated ("a fuller fan of cards"), decide
with post-buff numbers at the signing session**; at 10, Surge-3
delivers fully with headroom, and the densest hand case is
render-layer (native-browser eyeball when taken). Fire joined the
buff per the pre-registered 72b Δ 0.000 contingency, which means
grant + fire shares are NOT separable this cycle (one commit — the
attribution caveat in BALANCE; a fire-ablated re-run is the split if
wanted). The cycle: box up at `542596f`, a scratchpad driver walked
the 4 walk twins + the act-1 regen anchor (5/5 `fetched →`, box
destroyed). The verdict: **the channels convert now** — walk-regen
+17.5 paired, arb-55pre +20.0, terminal reach lands IN the signed
40–50 band on both doctrine walks, outOfBattle patch opens from
zero (the banking-vs-fire flip §71d measured is priced away by
heal-6) — **but the 2× step bled into act 1**: seam 15.3–16.9 vs
the signed 13–15, act-1 regen ref 0.800 vs 65±8. The overshoot is
NOT fixable by more value buffing (more worsens seam/act-1; less
drops reach back out of band) — it is act-1-difficulty vs
value-buff tension, a signing-session / next-round encounter-tuning
question. Also queued: the sign-flipped ceiling deltas (−12.5
regen / +15.0 55pre) feed the 72d flip read with a named
hypothesis — cheap-tier myopia under stronger items. Next: the
user's call at the magnitude decision point (iterate vs proceed to
72d with round-1 values).

**72c CLOSED (2026-08-03, user-signed).** The user took the
recommendation whole: round-1 magnitudes stand as final, and the
seam/act-1 overshoot resolves by RAISING SECTOR-1 DIFFICULTY (the
direction signed; inserted as 72d2), not by trimming the value buffs
— the values are doing exactly what the channels needed, and the
overshoot is act-1 encounter tuning's problem. Ordering call (mine):
72d2 runs AFTER 72d, so the pre-registered flip read lands on the
round-1 config it was triggered by, not on a tree that shifts under
it. 72d also widens to BOTH postures (findings-driven: the ceiling
deltas flipped sign by posture, so the myopia hypothesis is tested
by WHERE the traffic-vs-searcher disagreement concentrates — the
§71d shape was regen-only).

**The 72d flip re-read ran (2026-08-03; numbers in BALANCE §72d,
canonical).** Ops note first: the flip batches outlived box-batch
run's 1h poll ceiling (longer battles + more rollout work on the
round-1 config) — the local watcher died at poll 240 while the box
batch ran on unharmed (nohup-detached, the §57g doctrine working as
designed); a second patient watcher (2.5h ceiling) re-attached,
fetched flip-regen, and drove flip-55pre through. Shadow
non-perturbation re-verified byte-identical against the §72c
arb-walk-regen rows. The verdict: **my cheap-tier-myopia hypothesis
is NOT SUPPORTED** — I pre-committed to the test (disagreement
should concentrate on the regen posture and at banking sites) and it
failed both prongs: posture-flat 8.8%/9.2%, banking unanimous (0
flips at outOfBattle on both postures). What DID move:
**fire-timing disagreement doubled** (preTurn 4.3%→8.0/9.5) — the
buffed items created genuine decision tension at fire sites, the
one place a tier upgrade would pay. Grants sit at ~13–14% flip on
still-small per-instance margins, unchanged through the buffs. The
−12.5 regen ceiling delta is left explained by paired noise and/or
well-swept doctrine fire heuristics, with the direct test (one real
searcher-tier walk batch) named for 72f if wanted. The tier-lock
disposition is the user's call at the decision point.

**72d CLOSED (2026-08-03, user-signed): the cheap tier holds.** The
user committed the direct test — one real (non-shadow) searcher-tier
walk batch — to 72f, where it rides alongside the full board re-run
and the fire-ablated attribution split if wanted. Next: 72d2, the
act-1 encounter buff.

**72e in flight (2026-08-03; numbers in BALANCE §72e as they land).**
The cheap-first half paid immediately: the natural elite read holds
negative on current config (29 pooled decisions, 0 picked — the
forced-dial condition met) and discard-one FLIPPED positive
post-72d2 (culling reads better when act 1 is harder). The
shape-lock's contingent dial got cut: `--elite-chance` /
`--port-chance` ride the G1 RunConfig override precedence
(`7fe5296`; absent-case byte-identity pinned; no bump — RunConfig
is not persisted), de-risked with a 2-seed local composition probe
before any box spend. The draw read came back first and DISSOLVED
its own question: +2 vs +4 are sha256-identical batches — both
clamp to the 65d maxHandSize 8 (`min(8, 6+add)`), so the §65d
non-monotonicity was an A/A pair plus noise. The live findings:
hand-8 vs hand-6 reads −5.0 (inside noise) with the Option-B
budget tax as the mechanism, and ⭐ the 72d2 act-1 buff ENGAGED
the empower channel (Pick% 4→14.3 at Δ|picked +1.03) — harder
fights make grants worth taking; the grant-channel story is now
value-buffs × difficulty, not value-buffs alone. Probe batches
(elite-offer ×2 postures, port-dock ×1 shopper) in flight.

**The probe cycle landed — with one instrument lesson (2026-08-03;
numbers in BALANCE §72e).** The first probe cycle came back
act-1-scoped: `advanceSector` regenerates sector maps with an
`undefined` config BY DESIGN (hopCount's single-sector semantics
must not leak), which silently kept the new scatter dials out of
the deep-end — exactly the class of quiet scoping gap the
gotcha-#120 audit taught us to hunt. Fix: `sectorAdvanceConfig`
(a pinned pure slice — only the scatter pair survives the advance),
re-run, and the fix's surgical scope RECEIPTED by act-1 decision
rows hashing byte-identical across the fix commit. The reads: the
elite economics are now decision-grade (116 pooled: refuse at 97%,
margins −0.8..−2.8, the three takes realized +4..+6 — overpriced
risk, the reward tables under-compensate) and the port story is
margins-vs-ε (582 decisions: every class positive post-buff, all
sub-ε by ~2.5 pool-HP). Both feed the price re-disposition
proposal (user-signed decision point). Also noted: candidate n at
elite-chance=1 stays modest — adjacency and early deaths gate
offers; the probe raises OFFERS, not takes, and the fresh-roster
hop-2 elite is brutal (the local 4-seed probe died 3/4 mid-act-1).

**72e CLOSED (2026-08-03; the re-dispositions user-signed same-day,
verified; numbers in BALANCE §72e ×2).** The user signed the whole
package — packet cuts ~40%, elites BUFFED cache-first (their call:
focus the cache chance, bits in reserve), daemons/units held. The
verify cycle delivered the round's most instructive result: both
decision-grade needles FLAT, both flatnesses structural. Ports are
price-inelastic at decision grade (bits abundance + the truncated
horizon capturing ~1 fire of stocked value — prices cannot close
the ε gap; the state-conditioned-ε watch gains its second exhibit),
and elite cache value is horizon-invisible (untaken elites never
roll; a daemon passive outlives any rollout). Meanwhile the
run-level needle jumped: act-1 doctrine shopper 0.650→0.800 — the
cuts convert THROUGH the heuristic shopper at run grade. The
noise-vs-bias lesson extends: run-grade and decision-grade
instruments disagree here because they measure different horizons,
not because either is wrong. Every 72e cut item is done (draw ✓
dissolved · elite ✓ decision-grade confirmed + buffed · prices ✓
re-disposed + verified) — 72e closes; 72f (the signing session) is
next, with the docket: the wall tune-or-re-sign · the default-arm
flip · twins' bands · the searcher-tier test (user-committed) ·
maxHandSize-10/Surge-3 · elite bits round-2 · the posture-row
disposition · act-1 ref re-signs (two +15 drifts now banked:
value-buffs and cheap-stock) · the full 22-instrument board cycle.

**72d2 landed + verified (2026-08-03; numbers in BALANCE §72d2,
canonical).** The audit found no sector-level difficulty scalar
(inventing one = a new mechanic, out of guard), so the signed shape
was levelBudget ×1.15 on the six act-1-exclusive encounters, with
the two act-2-shared ones deliberately held (the config edition of
the sector-blind class — buffing artillery/adventurer-with-guards
raw would bleed into act 2) and bosses out (wall refs signed). One
designed tripwire fired mid-commit: the levelCap migration pin
caught warband-vanguard's never-binding cap starting to BIND at the
new budget — its documented "conscious retune point" — resolved by
stamping the roster+2 cap (the signed ×1.15, no stealth uncapped
spike). The verify cycle: a one-round hit. Seam back in band
(14.9/14.2), reach held (0.425 both), act-1 anchor back inside its
drift ref (0.725), and the §72c −12.5 regen ceiling anomaly
re-read at −0.025 — noise, as the 72d flip read suggested; the
cheap-tier hold is vindicated in the same cycle. Remaining agenda
for 72e/72f: the wall WARN (0.235 vs 30–35), the arb-55pre +12.5
ceiling (posture dissolution), and the arb-regen seam 17.4 (the
patch fires offsetting drain — twins get bands at the signing
session).

**72f measurement half (2026-08-04, overnight; numbers in BALANCE
§72f, canonical).** The user signed off for the night with standing
permission for re-runs/extra experiments (≤2 boxes, wrapped by
09:00) — used for: the full 22-instrument cycle on box A and the
committed searcher-tier direct test on box B IN PARALLEL (first
two-box session; the searcher batch alone ran ~2.5h ≈ the whole
22-batch walk, so the split halved wall clock), plus one local
single-arm extension (gambler-55pre seeds 41–80, allowed under 68h)
and the free pooled-decisions reads. Every signing decision waits
for the morning session — this entry is measurement only. The
board: 0 FAIL / 8 WARN, all eight accounted (docket items, the
banked drifts, or good news: the fire channel now CONVERTS on
doctrine +0.100 while the arb arm reads it ≈0 by substitution — the
ablated twin's +17.5 ceiling is arbitration routing around the
missing heuristics). The searcher-tier verdict is the round's
cleanest number: paired Δ EXACTLY 0.000 vs the traffic twin (7
flips each way, 12/40 both) — the cheap-tier lock closes by direct
test. New finding: gambler-55pre 0.575 replicated at n=80, a real
−12.5 drift and a −22.5 shopper-posture parity breach (arb twins
carry the same gap → character-intrinsic; deaths 53% at the act-1
boss, so NOT the 72d2 buff's early hops) — repair is next-round
scope, disposition on the docket. The 72a shopper-dissolution WARN
dissolved itself: doctrine 55pre caught up (0.800) to its twin
(0.850), closing the gap from above — a channel repair converting
at run grade reads as a ceiling-delta WARN disappearing. Docket
data now complete: wall soft at 0.15–0.235 across all four walk
arms vs the 30–35 band · twins' trajectory numbers banked for
bands · elites still horizon-invisible at cache 0.5 in the natural
shape (87 pooled, 1.1% pick, −1.35) with bits as the only
decision-grade lever · both act-1 +15 drifts re-confirmed.

**72f signing session + ROUND CLOSE (2026-08-04; numbers in BALANCE
§72f ×2, canonical).** The docket ran start to finish in one day on
the overnight measurement: every item user-signed in the morning
walk-through (wall TUNE via the sector-pool split — the user's
shared-pool concern answered by per-sector boss variants, config-only,
explicitly provisional pending real sector-2 bosses at cluster 5 ·
flip agreed · twins' bands tied to the post-tune numbers · the
trimmed 5-row control set kept for the cluster-5 stress test · fire
+0.10 · cap/Surge bumped for wacky combos · elites stay human-variance
with the measured-terminal-prior ladder pre-registered · posture rows
retired). The wall tune was the session's one open engineering
question and the two-dose bracket answered it emphatically: ×1.25
mid-band on both arms, ×1.5 craters the finale — a steepness nobody
would have guessed from the ×1.0 baseline (the bracket protocol goes
to BALANCE caveats). Two catches worth the log: the 65f deck-cue
tests hardcoded Surge's count-2 arithmetic (re-choreographed
config-derived per the balance-proof norm), and the closing driver
requires a FROZEN HEAD for its whole walk (box-batch's dirty-tree
parity guard) — the close-out docs waited in the scratchpad until the
last fetch. The closing cycle: 0 FAIL / 3 WARN, all three
pre-registered (the 55pre-twin overperformance family), walk numbers
byte-identical to the dose pair (the reshape provably sim-neutral).
v34/v40 held end to end, exactly the round kickoff's prediction. The
ROUND CLOSES: 69 (substrate) → 70 (five sites) → 71 (telemetry +
the parity table + the cheap tier) → 72 (the balance agenda through
the arbitrated-default signing). Riders to the cluster-5 kickoff:
the gambler shopper repair · real sector-2 bosses · the
measured-terminal-prior ladder · the 55pre overperformance watch ·
the full control set re-entry at the stress test.
