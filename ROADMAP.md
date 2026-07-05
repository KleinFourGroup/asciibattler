# ROADMAP — The Pathfinding Audit (Movement Intelligence, Phases 42→46)

> **▶ ACTIVE — an interstitial round between Cluster 2 (Spatial & Movement,
> archived → [archive/post-34-roadmap.md](archive/post-34-roadmap.md)) and
> Cluster 3 (Economy, [META-ROADMAP.md](META-ROADMAP.md)).** The user-called
> movement-quality audit: fix the *directional biases* players can see, make
> *waiting* a first-class tactical decision, and teach units to *cooperate*
> (follow columns, queue at chokepoints) instead of fighting each other's
> pathing — all measured by a new instrumentation harness, not vibes. Same
> precedent as the Post-N agency round (O→R): a user-feedback round slotted
> between clusters. **First task of Cluster 3's kickoff = archive this file →
> `archive/post-41-roadmap.md` and author the Economy roadmap** (the same
> archive-and-replace ritual that produced this one).

Companion to [DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[BALANCE.md](BALANCE.md), [TODO.md](TODO.md), [GOTCHAS.md](GOTCHAS.md), and
[META-ROADMAP.md](META-ROADMAP.md). Prior roadmaps in [archive/](archive/) —
most recently [post-x](archive/post-x-roadmap.md) (Cluster 1, Y→34) and
[post-34](archive/post-34-roadmap.md) (Cluster 2, 35→41, the round this one
audits). This round's run-logs live in a new **[PATHING.md](PATHING.md)**
(the BALANCE.md pattern: baseline first, every change re-measured against it).

## Where this came from (read this first)

Cluster 2 hardened the spatial *substrate* (occupancy, claims, terrain,
footprints, destructibles) but never audited the *intelligence* on top of it.
The user's playtest observations (2026-07-04 session), each traced to code:

1. **"Bottom-spawn units drift left on River/Isthmus."** CONFIRMED, two causes.
   (a) The E5.B sidestep ([movement.ts](src/sim/movement.ts) `sidestep`) tries
   its two perpendicular candidates in a fixed order — `(x−1, …)` first — and
   ties go to the *first candidate*. A unit heading straight at its target has
   both candidates exactly tied in Chebyshev (the forward axis dominates), so
   **every contested step shuffles toward −x**; top-spawn units get the mirror.
   (b) The A* equal-f/equal-h tie-break ([Pathfinding.ts](src/sim/Pathfinding.ts)
   `popLowestF`) compares `"x,y"` keys as **strings** — `"10,3" < "2,3"` — a
   digit-ordering artifact, not a spatial rule. Under the Chebyshev heuristic
   with uniform diagonal cost, min-cost ties are *everywhere* on open ground
   (any path inside the diagonal cone costs the same), so this "rare fallback"
   fires constantly. River amplifies both: its two crossings are near-equal
   cost, so the tie-break — not tactics — picks the same one for the whole team.
2. **"Not sure the boids fire at the right time."** "Boids" is only an informal
   comment nickname (corridor-flow.test.ts) for the E5.B sidestep — there is no
   flocking system. And no, it does NOT fire at the right time: it triggers on
   "forward cell occupied *now*" with zero reasoning about whether the blocker
   is mid-move and about to vacate. Sidestep → repath → routed back → sidestep:
   the crab-walk oscillation.
3. **"Units hate following each other down corridors."** Three compounding
   causes: an ally-occupied cell costs +`occupiedCellPenalty` (4), so a 4-deep
   queue justifies a ~16-cell detour; **claims read as walls** for pathing
   (occupied-OR-claimed blocks, gotcha #113) even though every cell in a moving
   column is about to be vacated; and full per-tick repathing re-litigates the
   queue-vs-detour call every tick, so units flip-flop.
4. **"Individual units fighting each other's algorithms, not a tactical
   battle."** That's the architecture: greedy per-unit replanning, no plan
   commitment, no vacancy prediction, first-mover advantage from tick iteration
   order. Deterministic, but not coordinated.

**The architecture verdict (settled with the user):** the proposal/selector
system is **sound — evolve it, don't overhaul it**. Behaviors returning scored
proposals to a 12-line arbiter is a standard utility/arbitration pattern, and
the J2 seam (behavior = goal selection; `advance`/`routeToward` = routing) is
exactly where any future cooperative planner plugs in. The real smells are
*interface* problems: (a) `return null` means six different things in
[MovementBehavior.ts](src/sim/behaviors/MovementBehavior.ts) — some "nothing to
do", some "actively deciding to stand still" — so the decision "wait, the
blocker clears in 3 ticks" has **nowhere to live**; (b) coordination-by-
convention — movement re-implements firing-band/LOS/minRange knowledge just to
know when to abstain for AbilityBehavior, a protocol enforced by comments
instead of types. Both get fixed by *making the implicit explicit* (§44), not
by a behavior tree / GOAP / two-phase global resolver (all rejected).

## The education (the state of the art, for orientation)

Multi-unit pathfinding has four schools. Knowing which one we're in — and
which we're deliberately NOT in — is this round's compass:

- **School 1 — independent replanning + local rules** (*we are here*): per-unit
  A*, conflicts patched locally (penalties, sidesteps, waits). The classic RTS
  architecture; its ceiling is the quality of the local rules. Ours are
  first-draft, two with literal bugs. This round raises the ceiling.
- **School 2 — cooperative / space-time (WHCA\*, reservation tables, MAPF):**
  units plan through (x, y, *time*), writing reservations others path around
  (Silver 2005, *Cooperative Pathfinding*; windowed = WHCA\*). **Our claim
  system is already a 1-step reservation table** — the §36 core is the seed of
  WHCA\*-lite, and a deterministic 20Hz tick sim is the ideal host. §46 decides
  whether to grow it.
- **School 3 — flow fields:** one Dijkstra flood per *goal*, all units descend
  the gradient (Supreme Commander 2, crowd sims). O(map) per goal — trivial at
  ≤32×32 — and corridor-following/queueing emerge naturally. Our per-unit
  sticky targets would need per-target fields; cacheable. The §46 alternative.
- **School 4 — continuous local avoidance (actual boids, RVO/ORCA):** steering
  forces and velocity obstacles in continuous space. **Ruled out** — it fights
  the discrete grid, the claim-then-flip move model, and byte-stream
  determinism.

What ships in real games is hybrids: global planner + local conflict resolver +
explicit anti-deadlock rules. Phases 42→45 perfect our School-1 rules on
instruments; Phase 46 decides — on measured data — whether School 2 or 3 earns
its complexity. There's a decent chance a well-tuned School 1 is simply enough.

## The two guiding goals

1. **Instruments before interventions.** Movement quality is currently asserted
   by mechanism-pinning tests and eyeballs. This round builds the measuring
   harness FIRST (drift, throughput, oscillation, time-to-contact), captures
   the baseline, and re-measures after every change — the BALANCE.md discipline
   applied to movement ([PATHING.md](PATHING.md)). No fix lands without its
   before/after numbers.
2. **Determinism ≠ sameness.** The byte-stream determinism requirement stays
   absolute (no RNG in tie-breaks — the E5.B call stands). But deterministic
   tie-breaks must be *balanced* — symmetric across teams and axes (parity
   alternation, straightness preference) — not "always the same world
   direction". Fairness is a property we can now measure (goal 1).

## Vocabulary (the new types + seams — full shapes settled at each phase)

- **`MoveDecision`** (§42) — the typed record of *why* a unit did what it did
  each tick: `advance | sidestep | queue | hold-band | hold-objective | no-goal
  | pinned | wait`. Dev-observable (event or transient field), never serialized.
- **The movement-metrics harness** (§42) — headless scripted battles emitting
  aggregate movement-quality metrics: mean lateral drift, corridor throughput,
  oscillation rate, time-to-first-contact, decision-mix histogram.
- **`PATHING.md`** (§42) — the run-log home: baseline + every re-measure.
- **`positioning.ts`** (§44) — the extracted "is this unit in position / where
  should it stand" module (firing bands, LOS gating, kiting, acting cells);
  the one place a new archetype teaches its positioning rules.
- **`WaitAction`** (§44) — a deliberate short hold as a first-class proposal:
  visible to the selector, the renderer, tests, and the §45 claim-ETA logic.
- **Vacancy ETA** (§45) — when a claimed/occupied cell frees, *derived* from
  the mover's in-flight action (startTick + phases + flip fraction). Derived,
  never serialized — no snapshot bump.
- **Path commitment / hysteresis** (§45) — keep last tick's route unless
  invalidated or beaten by a margin; kills repath flip-flop.

## The phase sequence at a glance

| Phase | Name | One-liner | Risk |
|---|---|---|---|
| **42** | Instrumentation | Decision records + metrics harness + PATHING.md baseline | Low (additive, byte-identical) |
| **43** | The bias fixes | A* tie-break + sidestep balance, measured | Low-med (paths change; fuzz re-baseline) |
| **44** | The decision protocol | `positioning.ts` extraction + first-class `WaitAction` | Med (interface refactor, behavior-neutral intent) |
| **45** | Cooperation | Vacancy-aware costs, wait-vs-sidestep, path commitment | High (the round's behavior-changing core) |
| **46** | The verdict | Re-measure + feel playtest + balance spot-check + School-2/3 gate | Low (decision phase; may be a documented no-op like §41) |

### Sequencing rationale

42 first — nothing else lands without its before/after numbers, and the
decision records it adds are what make waits/oscillations *countable*. 43
before 45 so the cooperation deltas aren't polluted by bias artifacts (a
left-drifting queue measures as garbage throughput). 44 before 45 because
`WaitAction` is where §45b's "queue instead of sidestepping" answer *lives* —
building cooperation on six-meanings-of-null would recreate the mess we're
draining. 46 last: it's the gate that decides whether this round closes the
audit or specs WHCA\*-lite / flow fields as a follow-up.

### Hard ordering constraints

- 42a (decision records) gates 42b (the harness counts decisions).
- 42c (baseline) gates every later re-measure step (43c, 45d, 46a).
- 44b (`WaitAction`) gates 45b (wait-vs-sidestep proposes waits).
- 43 and 44 are mutually independent — 43 may interleave if a playtest wants
  the visible drift fix early.

## Conventions (unchanged — they still hold)

Headless-first (this whole round is pure-sim; vitest before browser — but
movement *feel* is render-observable, so **browser/native playtest checkpoints
close §43 and §45**); balance-proof tests derive from config, never hardcode;
commit per sub-step + **pause between commits** for the user's manual run;
fuzz re-baselines are EXPECTED at 43/45 (path bytes change — that's the point)
and each gets its own commit note; keep DESIGN/ARCHITECTURE honest in-commit;
⚠️ labyrinth's long fights are BY DESIGN (gotcha-adjacent — the harness may
*measure* labyrinth, but its slowness is not a defect to fix).

---

## Phase 42 — Instrumentation (decision records + the metrics harness + the baseline)

The audit's measuring instruments. Additive and byte-identical: no unit moves
differently after this phase; we can just finally *see* what they do.

**Shape:** a typed `MoveDecision` taxonomy emitted from the movement layer
(dev-observable, never serialized — the transient-field vs debug-event call is
42a's decision point); a headless harness that runs scripted/seeded battles on
fixture + shipped maps and computes aggregate movement-quality metrics; the
PATHING.md baseline capture on the shipped layouts. Reuses `pathfindingStats`
(movement.ts) where it fits.

**Metrics (the v1 set):** mean signed lateral drift (x-displacement orthogonal
to the spawn→spawn axis, per team — the River symptom, quantified); corridor
throughput (units through a fixture chokepoint per 100 ticks); oscillation
rate (a unit re-entering a cell it left within k ticks); time-to-first-contact;
the decision-mix histogram (what % of ticks are advance/sidestep/queue/…).

**Decision points 42:** ~~event vs transient field for decisions~~ **RESOLVED
(42a): an ALWAYS-ON event** — `unit:moveDecision { unitId, kind }`, one per
Movement/SupportMovement poll. Dev-gating was rejected as needless
conditionality: a no-subscriber emit is nearly free, events never serialize,
and an always-on record works in any build. Kinds are snake_case (TileKind
style); the taxonomy grew from the sketch's 8 to **14 kinds** to cover the
healer's ladder honestly (`retreat`/`boxed`/`yield_swap`/`flee`/`wander`/
`frozen` beyond the mechanical set). Still open: the fixture-map set (a
symmetric open field + a straight corridor + a two-crossing river abstraction
— hand-authored TEST fixtures, not shipped layouts); whether drift is measured
per-team or per-spawn-region (per-region — availability `both` means teams
swap sides).

### Sub-steps (42a–42c) — the proposed cut

- **✅ 42a — the `MoveDecision` records (landed).** The 14-kind taxonomy +
  emit helper in `src/sim/moveDecision.ts`; the mechanical kinds
  (`advance`/`sidestep`/`queue`/`no_route`) emit from `movement.ts advance`
  (via a `StepOutcome` union on `stepAlongRoute`), the contextual kinds from
  the two behaviors (every healer idle path funnels through
  `yieldChokepoint`, which now carries the abstain kind). Byte-identical
  world; `moveDecision.test.ts` (13 tests) pins kind correctness per fixture
  + the exactly-one-per-poll invariant (in-flight units emit nothing; a
  finishing action polls same-tick).
- **42b — the metrics harness.** The scripted-battle runner + the five v1
  metrics over fixture maps; deterministic (seeded) so re-runs reproduce.
  Tests pin harness determinism + metric arithmetic on hand-computable
  micro-fixtures. *Commit: harness + fixtures + tests.*
- **42c — the baseline.** Run the harness on the shipped layouts (River,
  Isthmus, labyrinth, open procedural) + fixtures; author **PATHING.md** with
  the numbers (the drift columns should *prove* the user's River report);
  regression tests assert only harness stability, NOT drift-zero (that's §43's
  exit criterion). *Commit: PATHING.md + baseline snapshot test.*

---

## Phase 43 — The bias fixes (the tie-breaks)

The two confirmed bias bugs, plus the exit criterion 42 made assertable:
**|mean drift| ≈ 0 on symmetric fixtures, both teams**.

**Shape:** replace the string-lex A* tie-break with an explicitly *balanced*
deterministic rule; balance the sidestep's first-candidate tie; re-measure.
Paths WILL change → fuzz re-baseline + possibly hand-authored-layout test
updates (they were hardened for resizes, not path shapes).

**Decision points 43:** the A* final tie-break rule — leading candidate:
**cross-track straightness** (prefer the node nearer the start→goal line;
symmetric by construction, complements the E5.B h-tie-break, and drains the
Chebyshev cone's tie plateau) with numeric (y,x) as the boring fallback;
the sidestep tie rule — leading candidate: **unit-id parity alternation**
(deterministic, team-agnostic, self-decorrelating in a column) vs
open-space-aware (more "tactical", more code — decide at the keyboard);
whether a tiny cross-track cost epsilon is wanted at all after the tie-break
fix (only if 43c still shows cone wander — keep admissibility, gotcha #34).

### Sub-steps (43a–43c) — the proposed cut

- **43a — the A* tie-break.** Fix `popLowestF`: straightness (or numeric)
  final tie-break replacing the string compare; unit tests on constructed tie
  plateaus (equal-f/equal-h sets resolve symmetrically); fuzz re-baseline.
  *Commit: Pathfinding.ts + tests + baseline.*
- **43b — the sidestep balance.** The balanced tie rule in `sidestep`;
  mirrored-fixture unit tests (a bottom-spawn and top-spawn unit in identical
  pockets sidestep mirror-symmetrically); fuzz re-baseline if bytes move.
  *Commit: movement.ts + tests.*
- **43c — the re-measure + the drift regression tests.** Harness re-run vs the
  42c baseline; PATHING.md entry; NOW land the |drift| ≈ 0 symmetric-fixture
  regression tests + River per-region drift bounds. **User playtest checkpoint
  (native browser): does River still lean?** *Commit: PATHING.md + tests.*

---

## Phase 44 — The decision protocol (positioning extraction + first-class Wait)

The targeted refactor that makes §45 buildable without spaghetti — the
"evolve, don't overhaul" phase. Behavior-neutral INTENT throughout: world
bytes should not change (the §38 equivalence-proof discipline; any deviation
is a finding, not a shrug).

**Shape:** extract the positioning knowledge (firing band, LOS gate, minRange
kiting, acting-cell goal list — MovementBehavior lines ~139–208 and its
SupportMovementBehavior sibling) into one `positioning.ts` module both
behaviors and future archetypes consult; then convert the *deliberate-hold*
abstains (in-band hold; blocked-and-queueing) into explicit `WaitAction`
proposals the selector weighs, leaving bare `null` to mean only "nothing to
propose".

**Decision points 44:** `WaitAction` duration (leaning 1 tick — re-decide every
tick, zero commitment) and cooldown (leaning none); whether a wait sets
`activeAction` (if yes: **audit the WorldSnapshot surface first** — an
in-flight wait entering serialization is a bump; leaning NO — resolve the wait
within the tick, event-only, no in-flight state); which abstains convert
(deliberate holds only — frozen/no-target/hold-objective stay null); whether
the renderer gets a "queued" stance now or at §45 (leaning §45, when waits
become common enough to see).

### Sub-steps (44a–44b) — the proposed cut

- **44a — the `positioning.ts` extraction.** Pure relocation + renames; both
  movement behaviors consume it; the 70-line protocol comment gets carved into
  the module docs it was compensating for. Existing tests pin byte-identity
  (they already cover the band/LOS/kiting matrix). *Commit: refactor only.*
- **44b — first-class `WaitAction` + typed abstains.** The action + proposal
  plumbing; the two deliberate-hold sites convert; `MoveDecision` gains its
  `wait` arm for real. Tests: selector still prefers attacks over waits; a
  waiting unit's world bytes match the old abstaining unit's. *Commit: sim +
  tests (+ snapshot audit note).*

---

## Phase 45 — Cooperation (the behavior-changing core)

Units stop treating allies as furniture. Everything here is measured against
the 42c baseline, and everything is dial-gated in `config/sim.json` so the
balance surface stays inspectable (balance-proof tests derive from it).

**Shape:** three cooperating changes. (1) **Vacancy-aware costs** — a cell
whose occupant/claimant will vacate within the unit's own arrival window costs
near-nothing extra; a claim *into* the unit's path costs more than today's
flat +4 (`occupiedCellPenalty` splits into dials). Corridor columns stop
reading as walls (the gotcha #113 predicate softens for *outbound* claims —
carefully: same-cell convergence must stay impossible). (2) **Wait-vs-
sidestep** — when the forward cell's vacancy ETA ≤ k ticks, propose Wait;
sidestep only otherwise. Queues form; the crab-walk dies. (3) **Path
commitment + hysteresis** — cache the route, keep it unless invalidated
(blocked, target moved past a threshold, or beaten by a margin); repath
becomes the exception, not the tick default.

**Decision points 45:** the vacancy window k (config dial; leaning ≈ the
unit's own step duration); the outbound-claim cost discount + inbound-claim
premium values; **the 45c determinism question — THE open decision of the
round:** a transient path cache diverges a resumed-snapshot run from an
uninterrupted one (cold cache ⇒ different repaths). Options: (a) serialize
the committed path (WorldSnapshot bump), (b) derive commitment purely from
serialized state (e.g. commit-until-invalidated recomputed from position +
target — no cache to lose), (c) accept divergence and downgrade the
determinism guarantee (REJECTED — the fuzz oracle depends on it). Leaning (b);
audit before building, and if only (a) works, it's this round's one bump.

### Sub-steps (45a–45d) — the proposed cut

- **45a — vacancy-aware costs.** Vacancy ETA derivation (from the mover's
  in-flight action — derived, not serialized) + the cost split; corridor
  fixture tests (a column follows nose-to-tail; convergence invariant holds —
  extend the §35d fuzz invariant's reach). Fuzz re-baseline. *Commit: sim +
  config + tests.*
- **45b — wait-vs-sidestep.** The ETA-gated Wait proposal (on 44b); corridor-
  flow integration tests flip from pinning the old shuffle to pinning queues;
  oscillation-rate regression test (< baseline by a margin). *Commit: sim +
  config + tests.*
- **45c — path commitment + hysteresis.** Per the resolved determinism
  decision; repath-count metric drops measurably; snapshot-resume equivalence
  test (the §38 oracle pattern) proves the guarantee held. *Commit: sim +
  tests (+ bump iff (a)).*
- **45d — the re-measure + the cooperation regression suite.** Full harness
  vs baseline; PATHING.md verdict entry; throughput/oscillation/time-to-
  contact regression bounds land. **User playtest checkpoint (native browser):
  the feel question — "a tactical battle playing out?"** *Commit: PATHING.md +
  tests.*

---

## Phase 46 — The verdict (measure, spot-check balance, gate School 2/3)

The round closer — a decision phase, possibly a documented no-op (§41
precedent). **READ BALANCE.md + PATHING.md first.**

**Shape:** the full-harness + feel review against the round's exit criteria
(drift ≈ 0; corridors queue; oscillation down; the user's four symptoms
addressed or explicitly re-scoped); a *scoped* balance spot-check — movement
changes shift combat outcomes, so re-baseline the fuzz win-rate + gradient vs
§41's numbers (33–35% / +22pt / boss 42–48%) and confirm the §33 equilibrium
holds (full §41 methodology only if the spot-check flags drift); the
**School-2/3 gate**: on the measured residue, decide NO (close the round;
WHCA\*-lite / flow fields stay in the drawer, seams documented) or YES (spec
the follow-up phases 46b+ *then*, from data, not now); the close-out
(HANDOFF cursor → Cluster 3, META-ROADMAP note, memory update).

**Decision points 46:** the gate itself; whether any §45 dial needs a balance
correction (the §41 lesson: measure at the optimum, not greedy); whether the
renderer "queued" stance deferred from §44 is wanted for ship-feel.

### Sub-steps (46a–46c) — the proposed cut

- **46a — the verdict measure + feel playtest.** Harness + native-browser
  session against the exit criteria; PATHING.md verdict; the School-2/3 call
  documented with its data. *Commit: PATHING.md.*
- **46b — the balance spot-check.** Fuzz win-rate/gradient vs §41 baselines +
  equilibrium confirmation; tune only what it flags (likely nothing — the §41
  no-op is the prior). *Commit: config iff flagged + BALANCE.md entry.*
- **46c — the close-out.** HANDOFF/META-ROADMAP/memory cursor flip → Cluster 3
  kickoff (which archives this file). *Commit: docs.*

---

## What we're explicitly NOT doing (the scope guard)

- **No WHCA\*/reservation windows, no flow fields** — unless §46 says so, from
  data. The seams (claims-as-reservations; per-target field caching at
  `routeToward`) are documented, not built.
- **No two-phase global conflict resolution** (everyone-proposes-then-resolve)
  — rejected in the architecture verdict; the per-unit priority loop stays.
- **No behavior tree / GOAP / utility-curve rewrite** — the selector stays.
- **No RNG in movement decisions** — determinism is absolute; balance comes
  from symmetric rules, not noise.
- **No formation movement / group orders** — a different feature (Drafting/Map
  Content era), not an audit item.
- **No tick-iteration-order rework** — first-mover advantage is measured (§42)
  but only acted on if the data says it matters (a rotating-priority note in
  the §46 verdict at most).
- **No labyrinth pacing "fix"** — by design, per the standing warning.

## Open decisions to resolve when building (the cross-cutting set)

- 42a: decision event vs transient field (leaning dev-gated event).
- 43a: straightness vs numeric final tie-break (leaning straightness).
- 43b: parity vs open-space sidestep tie (decide at the keyboard, measured).
- 44b: wait-as-activeAction vs within-tick (leaning within-tick, no bump).
- 45c: the determinism-vs-cache resolution (leaning derive-don't-cache; the
  round's only candidate snapshot bump if not).
- 46: the School-2/3 gate (the round's whole point — decided last, on data).
