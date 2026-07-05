# PATHING — movement-quality run log

The [BALANCE.md](BALANCE.md) discipline applied to movement: an instrument, a
baseline, and a re-measure after every change. **No Pathfinding-Audit fix
lands without its before/after entry here** (ROADMAP Phases 42→46 — the round
charter, symptom→cause diagnosis, and the four-schools orientation live
there).

**The instrument:** `tests/pathing/` (§42b) — `MovementMetricsCollector` (a
pure fold over bus events incl. the §42a `unit:moveDecision` records), three
fixture maps, and the shipped-layout capture. **Regenerate every table below
with `npm run pathing`.** Fixture headline numbers are additionally pinned
exactly in `tests/pathing/baseline.test.ts` — a deliberate movement change
(§43+) re-baselines that test the way fuzz baselines shift, and an
*accidental* movement change trips it.

## Reading the metrics

- **lat drift** — mean net displacement per unit orthogonal to its team's
  forward axis (own→opposing spawn centroid), in cells. UNIT-frame: lateral
  = forward rotated 90° CCW, so mirror-symmetric teams read the same sign.
  A fair sim on a symmetric map reads ≈ 0 for both teams.
- **net dx** — mean world-frame x displacement per unit (the "walks left on
  River" claim is world-frame).
- **⚠ the two bias signatures.** The A* tie-break bias is WORLD-framed (it
  prefers lexicographically low keys regardless of who's walking), so it
  shows as the SAME dx sign for both teams = MIRRORED unit-frame drifts
  (P +, E −). The sidestep first-candidate bias is BODY-framed, so it shows
  as the SAME unit-frame sign for both teams. §43a should kill the mirrored
  component, §43b the shared component.
- **osc** — backtracks (a move landing on a cell that unit vacated within
  its last 3 moves) / moves. The crab-walk detector.
- **ttfc** — tick of the first attack attempt.
- **throughput** (fixtures with a gate) — gate crossings per 100 ticks.
- **decision mix** — the §42a per-poll histogram. `hold_band` dominating is
  normal (in-position units poll every tick); the load-bearing signals are
  the `queue`/`sidestep`/`no_route` masses and the `advance` share.

Fixtures are ability-less and hold no RNG → **seed-invariant** (pure
algorithm portraits). Shipped-layout battles are real (3 merc + 2 ranged per
side, `spawnEncounter`, combat rolls) → seeds matter; `both`-availability
spawns also swap sides per seed, which is why unit-frame drift is the
headline and dx the map-specific read.

---

## §42c BASELINE — 2026-07-04 (pre-fix; the "before" picture)

### Fixtures (seed-invariant)

| map | seed | ticks | ttfc | lat drift P/E | net dx P/E | osc P/E | moves P/E |
|---|---|---|---|---|---|---|---|
| openField(4) | — | 200 | — | 4.00 / -4.00 | -4.00 / -4.00 | 0.000 / 0.000 | 16 / 16 |
| corridor(3) | — | 400 | — | 0.00 / 0.00 | 10.00 / 0.00 | 0.029 / 0.000 | 34 / 0 | 0.75 |
| corridor(6) | — | 400 | — | -0.17 / 0.00 | 11.17 / 0.00 | 0.048 / 0.000 | 83 / 0 | 1.50 |
| riverFork(4) | — | 300 | — | 4.00 / -3.50 | -4.00 / -3.50 | 0.943 / 0.895 | 455 / 162 |

(corridor rows carry a trailing throughput/100t column: **0.75** and **1.50**.)

| map | seed | team | decision mix (nonzero, desc) |
|---|---|---|---|
| openField(4) | — | player | hold_band 768 · advance 16 |
| openField(4) | — | enemy | hold_band 768 · advance 16 |
| corridor(3) | — | player | hold_band 1131 · advance 31 · sidestep 3 · queue 1 |
| corridor(6) | — | player | hold_band 2225 · advance 71 · sidestep 12 · queue 9 |
| riverFork(4) | — | player | hold_band 290 · advance 236 · sidestep 219 |
| riverFork(4) | — | enemy | hold_band 876 · sidestep 146 · advance 16 |

**Readings:**

- **openField: the A* tie-break bias is TOTAL.** 16 moves per team, net dx
  −4 per unit for BOTH teams, zero contention (no sidesteps — pure A*).
  Every unit's every open-ground step resolved its Chebyshev tie leftward
  (world −x): the lexicographic-string tie-break isn't an occasional
  artifact, it decides *all* open ground. Mirrored unit-frame signs (+4/−4)
  = the world-frame signature.
- **riverFork: the crab-walk, isolated.** Oscillation 0.94 — of 455 player
  moves, 429 were backtracks; sidestep is ~half the move mix. Units at the
  wall band shuffle A→B→A nearly every move (sidestep → repath → routed
  back → sidestep). Both teams also drain toward the low-x ford (dx −4.0 /
  −3.5): the tie-break picks the same world-side crossing for everyone.
  This fixture is the §45b (wait-vs-sidestep) before/after centerpiece.
- **corridor: throughput 0.75/100t (3 movers), 1.50 (6).** The tunnel
  pipeline works but is thin; mouth contention shows as sidestep+queue.
  §45a/§45c should raise crossings-per-100t and cut the mouth churn.

### Shipped layouts (real battles, cap 2000 ticks; seeds 100–102)

| map | seed | ticks | ttfc | lat drift P/E | net dx P/E | osc P/E | moves P/E |
|---|---|---|---|---|---|---|---|
| river | 100 | 283 | 85 | 0.76 / -0.28 | -1.00 / 0.00 | 0.000 / 0.118 | 30 / 34 |
| river | 101 | 454 | 85 | 1.13 / -0.94 | -2.00 / -0.20 | 0.031 / 0.094 | 32 / 32 |
| river | 102 | 360 | 69 | 3.44 / -2.21 | -3.60 / -2.00 | 0.061 / 0.000 | 33 / 33 |
| isthmus | 100 | 445 | 169 | -0.08 / 0.44 | -0.40 / -0.20 | 0.000 / 0.174 | 43 / 46 |
| isthmus | 101 | 419 | 169 | -0.25 / 0.31 | -1.00 / 0.60 | 0.054 / 0.047 | 37 / 43 |
| isthmus | 102 | 493 | 169 | 0.01 / -0.57 | -0.20 / -0.40 | 0.048 / 0.125 | 42 / 40 |
| labyrinth | 100 | 923 | 491 | -1.87 / 0.34 | 4.20 / -6.60 | 0.116 / 0.098 | 198 / 205 |
| labyrinth | 101 | 910 | 491 | 2.76 / -2.34 | 8.00 / -4.80 | 0.122 / 0.110 | 246 / 200 |
| labyrinth | 102 | 872 | 477 | -3.11 / 1.98 | -3.40 / 7.20 | 0.136 / 0.061 | 191 / 213 |
| endlessCorridors | 100 | 682 | 225 | -1.62 / 1.66 | -1.20 / -2.00 | 0.034 / 0.134 | 116 / 157 |
| endlessCorridors | 101 | 580 | 225 | -2.22 / 1.44 | -0.60 / -3.00 | 0.143 / 0.078 | 119 / 116 |
| endlessCorridors | 102 | 1031 | 351 | 0.73 / 1.00 | -0.60 / 0.40 | 0.178 / 0.121 | 236 / 215 |
| procedural | 100 | 343 | 69 | 1.24 / -0.93 | 1.00 / 1.20 | 0.000 / 0.065 | 29 / 31 |
| procedural | 101 | 236 | 69 | 2.61 / -3.53 | 1.60 / 4.20 | 0.000 / 0.050 | 40 / 40 |
| procedural | 102 | 295 | 69 | 2.75 / -1.94 | -3.00 / -1.80 | 0.048 / 0.069 | 42 / 29 |

| map | seed | team | decision mix (nonzero, desc) |
|---|---|---|---|
| river | 100 | player | no_route 78 · advance 28 · hold_band 25 · sidestep 2 |
| river | 100 | enemy | advance 32 · hold_band 27 · sidestep 2 |
| river | 101 | player | advance 31 · hold_band 30 · sidestep 1 |
| river | 101 | enemy | no_route 82 · advance 32 · hold_band 26 |
| river | 102 | player | advance 31 · hold_band 21 · sidestep 2 |
| river | 102 | enemy | advance 33 · hold_band 27 |
| isthmus | 100 | player | advance 41 · hold_band 35 · sidestep 2 |
| isthmus | 100 | enemy | advance 42 · hold_band 18 · sidestep 4 |
| isthmus | 101 | player | advance 36 · hold_band 18 · sidestep 1 |
| isthmus | 101 | enemy | advance 41 · hold_band 23 · sidestep 2 · no_goal 1 |
| isthmus | 102 | player | hold_band 46 · advance 41 · queue 15 · sidestep 1 |
| isthmus | 102 | enemy | advance 36 · hold_band 24 · sidestep 4 |
| labyrinth | 100 | player | queue 347 · advance 185 · hold_band 31 · sidestep 13 |
| labyrinth | 100 | enemy | advance 195 · queue 81 · hold_band 18 · sidestep 10 |
| labyrinth | 101 | player | advance 228 · queue 110 · hold_band 26 · sidestep 18 |
| labyrinth | 101 | enemy | advance 187 · queue 157 · sidestep 13 · hold_band 12 |
| labyrinth | 102 | player | queue 718 · advance 175 · hold_band 26 · sidestep 16 |
| labyrinth | 102 | enemy | advance 206 · queue 24 · hold_band 16 · sidestep 7 |
| endlessCorridors | 100 | player | advance 113 · hold_band 20 · sidestep 3 |
| endlessCorridors | 100 | enemy | advance 153 · hold_band 38 · queue 21 · sidestep 4 |
| endlessCorridors | 101 | player | advance 117 · hold_band 23 · sidestep 2 · queue 1 |
| endlessCorridors | 101 | enemy | advance 115 · hold_band 19 · queue 2 · sidestep 1 |
| endlessCorridors | 102 | player | advance 223 · queue 60 · hold_band 21 · sidestep 13 |
| endlessCorridors | 102 | enemy | advance 212 · hold_band 22 · queue 5 · sidestep 3 |
| procedural | 100 | player | advance 28 · hold_band 23 · sidestep 1 |
| procedural | 100 | enemy | advance 30 · hold_band 27 · sidestep 1 |
| procedural | 101 | player | advance 40 · hold_band 21 |
| procedural | 101 | enemy | advance 39 · hold_band 9 · sidestep 1 · queue 1 |
| procedural | 102 | player | advance 41 · hold_band 24 · sidestep 1 · no_goal 1 |
| procedural | 102 | enemy | advance 83 · hold_band 17 · sidestep 1 |

**Readings:**

- **river — the user's report, confirmed in real battles.** Player net dx is
  negative in all three seeds (−1.0 / −2.0 / −3.6) and enemy dx ≤ 0 in all
  three: everyone drains world-left, mirrored unit-frame signs → the A*
  tie-break signature (the two near-equal-cost crossings amplify it — the
  tie-break, not tactics, picks the ford).
- **⚠ river anomaly — the `no_route` spam.** Seed 100: a player-side unit
  spends **78 polls** with no path to any goal; seed 101 mirrors it (enemy
  82). River-only. Something on River is intermittently unreachable —
  plausibly a rubble/water enclosure interacting with the strict-path
  chase. Investigate during §43 with per-unit decision traces; if it's the
  §40b auto-target gate misfiring, that's a bug outside this round's four
  symptoms. *Filed as an audit finding, not fixed here.*
  **→ RESOLVED in the 43-pre entry below** (footprint-blind
  `nearestActingCell`, not the auto-target gate).
- **labyrinth — the corridor-following cost, quantified (NOT a pacing
  bug — the slow maze is BY DESIGN).** `queue` is the largest or
  second-largest player decision in every seed (347 / 110 / **718**): units
  spend hundreds of polls stuck behind allies in 1-wide passages. The §45
  cooperation work should convert queue-mass into advances (higher
  moves-per-tick through the maze) *without* touching the maze's intended
  length. Also the widest drift swings on the board (|drift| up to 3.1) —
  corridor walls turn small biases into big detours.
- **endlessCorridors (user-added to the suite) — the odd-queuing report
  shows as the highest oscillation among shipped maps** (up to 0.178 at
  seed 102, with queue 60) — parallel corridors mean constant lane-choice
  re-litigation. A prime §45c (path-commitment) before/after.
- **isthmus — mildest symptoms of the named maps** (drift within ±0.6, low
  queue mass except seed 102's 15). The user-perceived leftness is likely
  the same tie-break signal at lower amplitude (dx ≤ 0 in 5 of 6
  team-seeds); expect §43a to clear it.
- **procedural — clean corroboration of the tie-break:** mirrored
  unit-frame drifts (P +, E −) in all seeds, near-zero oscillation, tiny
  queue mass. Open ground = pure A* behavior.
- **ttfc note:** identical ttfc across seeds within a map (85/85/69 river,
  169×3 isthmus, 225/225/351 endlessCorridors) — approach paths are so
  seed-stable that first contact lands on the same tick; combat divergence
  starts only after contact. Another marker of how deterministic (and
  bias-locked) the movement layer is.

### §43/§45 targets this baseline sets

| metric | now | target (§43) | target (§45) |
|---|---|---|---|
| openField lat drift (both teams) | +4.00 / −4.00 | **≈ 0 / ≈ 0** | hold |
| riverFork lat drift | +4.00 / −3.50 | **≈ 0 / ≈ 0** | hold |
| riverFork oscillation | 0.943 / 0.895 | (may drop some) | **≪ 0.5** (wait-vs-sidestep) |
| corridor(3/6) throughput /100t | 0.75 / 1.50 | hold | **↑ measurably** (vacancy costs + commitment) |
| river net dx (both teams) | ≤ 0 everywhere | **sign-mixed, seed-dependent** | hold |
| labyrinth queue : advance ratio | up to 4.1 : 1 | hold | **↓ substantially** (fight length may shorten a bit; the maze stays long by design) |
| endlessCorridors oscillation | up to 0.178 | — | **↓** (path commitment) |

---

## 43-pre-a — footprint-blind pathing queries (the `no_route` finding) — 2026-07-05

**Root cause of the river spam (traced with
`tests/pathing/trace-no-route.ts`):** in both spam seeds the stuck unit is a
kited archer (range 3, minRange 2) whose target closed to distance 1. The
Qb#3 guard correctly withholds the charge-the-target fallback inside
minRange, leaving ONE goal — the `nearestActingCell` firing cell. That
helper's neutral wall set held only each neutral's §39 canonical CORNER, so
it returned a multi-tile rubble's BODY cell (seed 100: (4,2) in the 2×2 at
(3,2); seed 101: (3,7) in the 3×3 at (1,6)) — a cell `findPath`
(footprint-aware via `buildMovementContext`) can never reach → `no_route`
every poll until a death forced a retarget. NOT the §40b auto-target gate.

**The fix:** three corner-only neutral blocker sets routed through
`cellsOccupiedBy` (the occupancy chokepoint doctrine): `nearestActingCell`'s
wall set ([actingPosition.ts]), and SupportMovementBehavior's `stepToward`
blockers + `neutralCells` navigability set (the healer could otherwise route
onto rubble body cells / anchor its trail inside one — both pinned by new
unit tests). Three more corner-only sites are LOS-side (MovementBehavior's
`losBlockers`, `collectLosBlockers`, `collectHalfCoverPositions`) — **43-pre-b,
separate fingerprint** (behavior-changing: big rubble starts blocking shots
through its whole body).

**Fingerprint (vs the §42c baseline):** fixtures BYTE-IDENTICAL (no rubble
in them — `baseline.test.ts` pins hold untouched); isthmus / labyrinth /
endlessCorridors / procedural BYTE-IDENTICAL in every row; **river is the
only mover** — exactly the bug's habitat.

| map | seed | ticks | ttfc | lat drift P/E | net dx P/E | osc P/E | moves P/E |
|---|---|---|---|---|---|---|---|
| river @42c | 100 | 283 | 85 | 0.76 / -0.28 | -1.00 / 0.00 | 0.000 / 0.118 | 30 / 34 |
| river 43-pre | 100 | 281 | 85 | 1.19 / -0.38 | -1.40 / 0.00 | 0.000 / 0.073 | 31 / 41 |
| river @42c | 101 | 454 | 85 | 1.13 / -0.94 | -2.00 / -0.20 | 0.031 / 0.094 | 32 / 32 |
| river 43-pre | 101 | 316 | 85 | 0.91 / -1.80 | -2.00 / -1.20 | 0.026 / 0.083 | 39 / 36 |
| river @42c | 102 | 360 | 69 | 3.44 / -2.21 | -3.60 / -2.00 | 0.061 / 0.000 | 33 / 33 |
| river 43-pre | 102 | 272 | 69 | 3.25 / -2.82 | -3.40 / -2.60 | 0.033 / 0.000 | 30 / 36 |

| map | seed | team | decision mix (nonzero, desc) |
|---|---|---|---|
| river | 100 | player | advance 29 · hold_band 26 · sidestep 2 *(was: no_route 78 · advance 28 · hold_band 25 · sidestep 2)* |
| river | 100 | enemy | advance 39 · hold_band 23 · sidestep 2 |
| river | 101 | player | advance 36 · hold_band 22 · sidestep 3 |
| river | 101 | enemy | advance 36 · hold_band 22 *(was: no_route 82 · advance 32 · hold_band 26)* |
| river | 102 | player | advance 30 · hold_band 16 |
| river | 102 | enemy | advance 36 · hold_band 26 |

**Readings:**

- **`no_route` mass is ZERO in all six river team-seeds** (was 78 + 82). The
  trace tool confirms: no unit emits a single `no_route` on seeds 100–102.
- **Battles shorten where the spam lived** (seed 101: 454 → 316 ticks; seed
  100/102 shift a little) — the formerly-pinned archer repositions and
  fights instead of idling helplessly, so ticks/moves/drift jitter within
  normal seed noise. ttfc is UNCHANGED on all three seeds (approach paths
  untouched — the fix only bites once a kite gets pinned near rubble).
- **The §43 bias signatures are intact:** river net dx still ≤ 0 in 5/6
  team-seeds (tie-break world-frame signature), openField/riverFork fixture
  drifts untouched. This fix removes the audit-finding noise WITHOUT eating
  into 43a/43b's before/after — the target table above stands as written.

---

## 43-pre-b — footprint-blind LOS/cover occluders — 2026-07-05

**The fix:** the remaining three corner-only sites, all LOS-side, routed
through `cellsOccupiedBy`: MovementBehavior's `losBlockers` (the in-band
hold + firing-cell search), `Targeting.collectLosBlockers` (the shot gate +
the ranged re-target visibility check), and `collectHalfCoverPositions`
(byte-identical future-proofing — no shipped multi-tile def is
LOS-transparent; only rubble_2x2/3x3 are multi-tile, both LOS-blocking).

**Behavior change (deliberate):** a multi-tile rubble now blocks sight
through its WHOLE body, not just its corner cell. Before, movement and the
shot gate shared the corner-only fiction — an archer would hold_band behind
a rubble body and fire straight through it (no freeze, just wrong cover
geometry). Now "behind big rubble" means no shot: the unit repositions to a
real firing cell, and the E7.D catapult still lobs over (pinned). Four new
tests (shot gate + movement hold, each with a catapult/LOS-ignorer guard).

**Fingerprint (vs the 43-pre-a entry above):** fixtures BYTE-IDENTICAL
(pins untouched); isthmus / labyrinth / endlessCorridors / procedural
BYTE-IDENTICAL; **river seeds 100/101 are the only movers** (seed 102 is
byte-identical too — that battle's sight lines never crossed a rubble
body).

| map | seed | ticks | ttfc | lat drift P/E | net dx P/E | osc P/E | moves P/E |
|---|---|---|---|---|---|---|---|
| river @43-pre-a | 100 | 281 | 85 | 1.19 / -0.38 | -1.40 / 0.00 | 0.000 / 0.073 | 31 / 41 |
| river 43-pre-b | 100 | 326 | 72 | 0.56 / -0.90 | -0.80 / -0.60 | 0.000 / 0.091 | 29 / 33 |
| river @43-pre-a | 101 | 316 | 85 | 0.91 / -1.80 | -2.00 / -1.20 | 0.026 / 0.083 | 39 / 36 |
| river 43-pre-b | 101 | 323 | 85 | 1.27 / -2.03 | -2.60 / -1.40 | 0.040 / 0.081 | 50 / 37 |
| river (both) | 102 | 272 | 69 | 3.25 / -2.82 | -3.40 / -2.60 | 0.033 / 0.000 | 30 / 36 |

**Readings:**

- **Seed 100 ttfc 85 → 72:** the ranged re-target visibility check now sees
  the rubble body, drops the occluded mark sooner and commits a VISIBLE
  target — first attack attempt lands 13 ticks earlier. Ticks lengthen a
  little (326 vs 281): archers flank around rubble instead of shooting
  through it, which is the point.
- **`no_route` stays ZERO everywhere** — the 43-pre-a guarantee holds
  through the LOS change (the firing-cell search and the LOS occluders now
  agree on the same footprint geometry, so a goal is never proposed that
  the path layer can't reach).
- **The §43 bias signatures remain intact:** river net dx ≤ 0 in ALL six
  team-seeds now, fixture drifts untouched — 43a/43b's before/after stays
  clean, the target table stands as written.

---

## 43a — the A* straightness tie-break — 2026-07-05

**The fix:** `popLowestF`'s final tie among equal-f/equal-h open nodes was a
STRING compare of `"x,y"` keys (`"5,1" < "6,1"`, `"10,3" < "2,3"`) —
resolving every open-ground Chebyshev tie toward low-x. Replaced with
**cross-track straightness**: prefer the node with the smallest integer
cross-product magnitude |(n−start) × (goal−start)| (nearest the start→goal
line), then numeric (y, x) as the deterministic total-order fallback. Pure
expansion ordering — f-values untouched, Chebyshev admissibility (gotcha
#34) holds, paths stay min-cost; benched slightly FASTER than the string
compare (straightness drains tie plateaus with fewer pops). Five new unit
tests incl. a hand-derived bend repro and a mirrored-worlds symmetry test.

**Fixture fingerprint (the full shipped-layout re-measure lands at 43c,
after 43b):**

| map | | lat drift P/E | net dx P/E | osc P/E | moves P/E |
|---|---|---|---|---|---|
| openField(4) | @42c | 4.00 / -4.00 | -4.00 / -4.00 | 0.000 / 0.000 | 16 / 16 |
| openField(4) | 43a | **1.00 / -1.00** | **-1.00 / -1.00** | 0.000 / 0.000 | 19 / 18 |
| riverFork(4) | @42c | 4.00 / -3.50 | -4.00 / -3.50 | 0.943 / 0.895 | 455 / 162 |
| riverFork(4) | 43a | 3.75 / -3.50 | -3.75 / -3.50 | 0.925 / 0.845 | 453 / 168 |
| corridor(3/6) | 43a | unchanged | unchanged | 0.029 / 0.036 | unchanged |

**Readings:**

- **openField drift 4.00 → 1.00 (75% of the headline bias dead).** The A*
  component was the mirrored world-frame signature — gone. Corridor
  unchanged (a 1-wide tunnel has no route ties to decide).
- **⚠ NEW audit finding — the residual ±1.00 is a TARGETING-tie funnel,
  not pathing.** On openField every enemy ties at Chebyshev 9 from every
  spawn, and the `nearest` strategy resolves the tie by stable unit order
  (lowest id = leftmost spawn): PROBED — all 8 units on both teams commit
  to the leftmost opponent, so everyone honestly walks the (now-straight)
  line to a biased pick. World-framed in effect (spawn order correlates
  with x), a sibling of the A* bug one layer up. Zero sidesteps in the mix,
  so 43b (body-framed) will NOT clear it. *Filed, not fixed here — slot
  USER-LOCKED (2026-07-05) = 43b2, between 43b and 43c.*
- **riverFork barely moved (4.00 → 3.75), as predicted:** this fixture is
  the crab-walk's (osc 0.925) — the sidestep tie (43b) + wait-vs-sidestep
  (§45b) own it. The tie-break component here was the ford CHOICE, which
  the targeting funnel + sidestep churn still dominate.
- `baseline.test.ts` re-pinned to the post-43a numbers (this entry is the
  diff). The catapult integration smoke re-seeded 1 → 2 (the seed-1 battle
  re-shaped: the wind-up now fizzles mid-flight every time; 7/11 probed
  seeds land shots, mechanic intact). Two full-run fuzz tests bumped 30s →
  90s (sim-content duration, not a perf regression — see the bench note).

---

## 43b — the sidestep tie balance — 2026-07-05

**The fix:** the E5.B `sidestep` tie among two viable equidistant
perpendicular candidates was FIRST-CANDIDATE-WINS — a fixed array order =
always the same rotation of the approach direction = the BODY-framed bias
(every unit crabs the same body side). Replaced with **from-cell
checkerboard parity**: `(from.x + from.y) % 2` decides which rotation gets
tie priority (even → clockwise, odd → counter-clockwise; screen frame).
Stateless, RNG-free, and self-decorrelating on every axis that matters:
adjacent cells in a column alternate sides, a unit's own successive cardinal
steps flip parity (a crab-walk pair nets zero instead of compounding), and
the rule commutes with the 180° board rotation relating the two teams on
symmetric maps (W+H even) — neither team gets a preferred side. Non-ties and
single-viable-candidate sidesteps are untouched. Six new unit tests incl. a
rotation-commutation sweep and the ROADMAP's mirrored-pocket `advance()` pin.

**The keyboard decision (parity-of-WHAT — measured):** the ROADMAP's leading
candidate, unit-ID parity, was REJECTED at the keyboard: spawn-order ids
hand a whole team one parity whenever team spawns interleave — both §42b
fixtures do exactly that (riverFork: neutrals take ids 1–11, then
player/enemy alternate per column → players all EVEN, enemies all ODD), so
the fixture that must zero would have kept its full one-sided bias; any
odd-sized roster keeps a residual under id parity regardless. Cell parity
balances by geometry, not roster composition.

**Fingerprint (isolated — both runs at post-43a code):**

- **Fixtures: BYTE-IDENTICAL, all four.** `baseline.test.ts` pins hold with
  no re-pin — the first deliberate movement change that needed none.
- **Shipped layouts: 12 of 15 battles byte-identical.** Movers: labyrinth
  102 (queue 718 → 384, ticks 872 → 969, osc P 0.136 → 0.098 — one flipped
  tie reshaped the battle and the giant queue pileup dissolved into a more
  even fight), endlessCorridors 101 (739 → 709 ticks, drift jitter),
  procedural 100 (sidestep 4 → 1, drift jitter). No systematic drift
  direction in the deltas.

**Readings:**

- **⚠ Finding: post-43a, the E5.B tie is RARE in practice.** A sidestep
  needs a forced geometry (open ground lets A* detour around soft blockers),
  and forced geometries usually leave only ONE viable perpendicular — the
  both-viable equidistant tie fired in 3 of 15 shipped battles and in ZERO
  of the ~370 fixture sidesteps (riverFork's 212+143 all had a wall or a
  strict distance winner on one side).
- **riverFork's residual drift (3.75 / −3.50) is PROVEN not the
  sidestep's:** the tie rule changed and the fixture didn't move a byte. The
  drift is world-framed (same dx sign both teams) = the 43b2 targeting
  funnel; the oscillation 0.925 is §45b's wait-vs-sidestep. The §43 target
  table's "riverFork lat drift ≈ 0" therefore gates on **43b2**, not 43b.
- **The ROADMAP's open-space-aware escalation clause does NOT fire:** the
  mirrored-fixture drift that "doesn't zero" is attributable to the
  targeting tie one layer up, not to any remaining sidestep bias — more
  tactical sidestep code would decide almost nothing. Documented no-op
  territory, §41 precedent.
- Suite: 1724 main + 212 fuzz:smoke green with **zero re-pins** (no fuzz
  re-baseline — the three moved battles sit outside the pinned smoke set).

---

## 43b2 — the targeting distance-tie (the 43a finding; user-locked slot) — 2026-07-05

**The fix:** the `nearest` strategy's distance+HP tie fell straight to
lowest unit id = SPAWN order = the leftmost opponent (the probed openField
funnel: all 8 units committing to the same flank). An **alignment layer**
now sits between the HP tie and the id last-resort: prefer the candidate
with the smaller **minor-axis offset** `min(|dx|, |dy|)` — among
equal-Chebyshev candidates (whose distance IS the major axis) that is the
enemy most directly ahead/beside, i.e. nearest the unit's own column/row of
advance, with no forward vector needed. Frame-free and symmetric under both
axis mirrors, x/y swap, and 180° rotation — the ROADMAP's
"own-column/axis-of-advance" lean, derived without a frame. The id layer
survives as the deterministic last resort but now only decides true mirror
pairs. E5 stickiness (`shouldRetarget`) untouched — only the fresh-pick tie
moved. All four strategy-ranked pickers (`findTarget`,
`nearestReachableHostile`, `findEngageableEnemy`, `findInRangeEnemy`)
inherit the fix through the one `compare` seam. **`weakest` deliberately
NOT touched** (its distance-tie has the same id residual): the user-locked
slot covers `nearest`, and no §42 instrument can see the rogue strategy —
an unmeasured change would be doctrine, not data (noted in the code; insert
the same layer if a playtest ever reads a rogue-flank bias). Four new
targeting tests (alignment beats spawn order; HP still outranks alignment;
mirror pair → id; the funnel-is-dead probe shape).

**Fixture fingerprint (corridor byte-identical — one inert enemy, no tie):**

| map | | lat drift P/E | net dx P/E | osc P/E | moves P/E |
|---|---|---|---|---|---|
| openField(4) | @43b | 1.00 / -1.00 | -1.00 / -1.00 | 0.000 / 0.000 | 19 / 18 |
| openField(4) | 43b2 | **0.00 / 0.00** | **0.00 / 0.00** | 0.000 / 0.000 | 16 / 16 |
| riverFork(4) | @43b | 3.75 / -3.50 | -3.75 / -3.50 | 0.925 / 0.845 | 453 / 168 |
| riverFork(4) | 43b2 | **-0.25 / 0.25** | 0.25 / 0.25 | 0.923 / 0.000 | 310 / 19 |

**Readings:**

- **openField drift = 0.00 EXACTLY, both teams — the §43 exit criterion,
  hit.** Each unit picks its opposite number and walks a straight line;
  moves drop back to the minimal 16/16 (the 19/18 was the funnel detour).
- **riverFork drift 3.75/−3.50 → ±0.25** — the ford choice is column-driven
  and symmetric (columns 4,5 → the x=2 ford; 7,8 → x=10). The §43 target
  table's "riverFork lat drift ≈ 0" — hit. The player-side crab-walk
  REMAINS (osc 0.923, sidestep 194) — §45b's charter, cleanly separated
  from the drift at last. (The enemy side now barely moves — its paired
  targets come to it — hence osc 0 / 19 moves; expect §45 to reshape this
  fixture again.)
- **Shipped layouts (isolated pre/post at post-43b code): broadly
  reshaped, biases collapse where geometry is symmetric.** River's seed-100
  drift outlier tamed (−4.14 → −1.08) and **river net dx is finally
  SIGN-MIXED across seeds** (P +0.8/−1.8/−1.2 — was ≤ 0 in 6/6 team-seeds
  at §42c): the last §43 target-table row, hit. Isthmus drifts collapse
  toward 0 (−0.16/0.11 · −0.23/0.02 · 0.83/−0.00). labyrinth 100/101
  BYTE-IDENTICAL (corridor engagements rarely present equal-distance
  ties); labyrinth 102 / endlessCorridors / procedural reshape within
  seed noise, no systematic sign. ttfc stable everywhere (69/85/85 river,
  169×3 isthmus).
- **Suite: 1727 main + 212 fuzz:smoke green; NO fuzz re-pin needed.**
  baseline.test.ts re-pinned deliberately (this entry is the diff). The
  full three-fix re-measure vs the frozen §42c baseline + the drift
  regression tests land at **43c**, as chartered.

---

*(Next entry: §43c — the full bias-fix re-measure vs the §42c baseline +
the |drift| ≈ 0 regression tests + the user's River playtest.)*
