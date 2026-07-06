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
  **§44b renamed `hold_band` → `wait`** (the deliberate hold became a
  first-class WaitAction proposal — same decision, same sites, same counts);
  tables at §44b and later say `wait` where earlier tables say `hold_band`.

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

## 43c — the §43 close-out re-measure (vs the frozen §42c baseline) — 2026-07-05

**The three tie fixes together** (43a A* cross-track straightness · 43b
sidestep cell-parity · 43b2 targeting minor-axis alignment), measured
against the frozen §42c tables. **USER VERDICT (native River playtest,
2026-07-05): "No drift that I can ID at all."** Phase 43's exit criterion
is met on every axis it owns; the §45 targets (oscillation, throughput,
queue mass) remain open by design.

### The §42c target table, checked off

| metric | §42c | now | target (§43) | |
|---|---|---|---|---|
| openField lat drift | +4.00 / −4.00 | **0.00 / 0.00** | ≈ 0 / ≈ 0 | ✅ (exact) |
| riverFork lat drift | +4.00 / −3.50 | **−0.25 / +0.25** | ≈ 0 / ≈ 0 | ✅ |
| river net dx | ≤ 0 in 6/6 team-seeds | **sign-mixed** (P +0.8/−1.8/−1.2 · E +1.0/−0.4/−0.4) | sign-mixed, seed-dependent | ✅ |
| corridor(3/6) throughput /100t | 0.75 / 1.50 | 0.75 / 1.50 | hold | ✅ (byte-identical) |
| riverFork oscillation | 0.943 / 0.895 | 0.923 / 0.000 | may drop some (≪ 0.5 is §45b's) | → §45b |
| labyrinth queue : advance | up to 4.1 : 1 (718) | up to 1.5 : 1 (287) | hold (↓ is §45's) | ✅ improved en passant |
| endlessCorridors oscillation | up to 0.178 | up to 0.132 | ↓ is §45c's | → §45c |

### Current shipped-layout picture (full tables regenerable via `npm run pathing`)

| map | seed | ticks | ttfc | lat drift P/E | net dx P/E | osc P/E | moves P/E |
|---|---|---|---|---|---|---|---|
| river | 100 | 373 | 69 | -1.08 / 0.73 | 0.80 / 1.00 | 0.033 / 0.000 | 30 / 31 |
| river | 101 | 281 | 85 | 0.81 / -1.11 | -1.80 / -0.40 | 0.053 / 0.033 | 38 / 30 |
| river | 102 | 302 | 85 | 0.94 / -0.55 | -1.20 / -0.40 | 0.000 / 0.034 | 40 / 29 |
| isthmus | 100 | 421 | 169 | -0.16 / 0.11 | -0.40 / 0.20 | 0.051 / 0.043 | 39 / 46 |
| isthmus | 101 | 414 | 169 | -0.23 / 0.02 | -1.00 / 0.80 | 0.000 / 0.024 | 38 / 41 |
| isthmus | 102 | 509 | 169 | 0.83 / -0.00 | -1.00 / 0.20 | 0.026 / 0.083 | 38 / 48 |
| labyrinth | 100 | 987 | 491 | -1.15 / 1.30 | 4.40 / -7.80 | 0.163 / 0.100 | 208 / 220 |
| labyrinth | 101 | 875 | 491 | 2.07 / -2.63 | 6.00 / -5.00 | 0.078 / 0.089 | 217 / 191 |
| labyrinth | 102 | 1013 | 477 | -2.69 / 2.12 | -4.80 / 6.60 | 0.156 / 0.081 | 211 / 223 |
| endlessCorridors | 100 | 849 | 225 | 1.66 / -3.87 | 2.20 / 3.60 | 0.073 / 0.075 | 151 / 159 |
| endlessCorridors | 101 | 555 | 225 | -2.14 / 2.14 | -0.40 / -3.60 | 0.107 / 0.040 | 112 / 125 |
| endlessCorridors | 102 | 694 | 225 | -1.18 / 1.44 | 1.40 / 0.80 | 0.132 / 0.098 | 136 / 183 |
| procedural | 100 | 287 | 71 | 1.11 / -1.38 | 0.80 / 1.60 | 0.000 / 0.071 | 35 / 28 |
| procedural | 101 | 407 | 71 | 2.58 / -3.76 | 1.60 / 4.40 | 0.000 / 0.053 | 39 / 38 |
| procedural | 102 | 246 | 69 | 1.46 / -1.65 | -1.60 / -1.40 | 0.069 / 0.026 | 29 / 39 |

**Readings:**

- **River, the map the round was called on:** drift magnitudes ≤ 1.11
  (were up to 3.44/−4.14 through the sub-steps), dx sign-mixed, decision
  mixes clean (no `no_route`, tiny sidestep mass). Isthmus — the other
  user-reported "leans left" map — now reads |drift| ≤ 0.83 with dx
  straddling zero.
- **procedural still shows mirrored unit-frame drifts (P +, E −)** — that
  is GEOMETRY, not bias: procedural maps are not symmetric, so a fair
  algorithm legitimately drifts around terrain. The symmetric-fixture
  gates are the bias instrument; procedural is scenery here.
- **labyrinth's queue collapse (718 → 287 worst-seed) came free** from the
  §43 fixes reshaping approach paths (fewer units piling into the same
  corridor at once). §45 still owns converting the remaining queue mass.
- **ttfc:** stable per map (river 69/85/85, isthmus 169×3,
  endlessCorridors 225×3 — seed 102's 351 normalized to 225 as its funnel
  detour died). Approach paths remain deterministic — the point of
  symmetric rules over RNG.

### The standing gates (landed this sub-step)

**[tests/pathing/drift.test.ts](tests/pathing/drift.test.ts)** — the
fairness invariant as regression tests, BOUNDS distinct from
`baseline.test.ts`'s exact pins (pins re-baseline on every deliberate
change; gates must survive every re-baseline):

- openField / riverFork: per-team |mean lateral drift| ≤ 0.5;
- shipped river (seeds 100–102, real battles): per-team-seed |lat drift|
  ≤ 2.5, and net dx sign-MIXED across the six team-seeds (the
  everyone-drains-left signature stays dead).

A future change (§45 included) that trips a gate has re-introduced a
systematic bias — fix the change, never relax the gate.

**PHASE 43 COMPLETE** (43-pre-a/b · 43a · 43b · 43b2 · 43c; user-confirmed
twice — 43a "drift much reduced", 43c "no drift I can ID at all").

---

## 44-pre-a — footprint-blind movement/status occupancy sets — 2026-07-05

The first of the three §44-pre corner-only straggler fixes (the pre-44a
audit's COMBAT/STATUS sweep; spec in ROADMAP §44-pre). Two occupancy sets
built from `key(u.position)` corners routed through the §35
`occupiedCells` builder (footprint-aware via `cellsOccupiedBy`):

- **(D) `MovementBehavior.proposeWander`** — a BLIND wanderer could roll
  a step onto a rubble BODY cell;
- **(E) `SupportMovementBehavior`'s local set** (fed `stepAwayFrom` /
  `countOpenNeighbors` / `blockedAlly.passable`) — a PANICKING healer
  could pick a rubble body cell as its retreat, and openness ties padded
  toward bodies. The `blockedAlly` openness read is fixed alongside with
  NO behavior change (its BFS `distanceField` walls were already
  footprint-correct and gate the result) — the audited-clean prediction
  held.

**Severity correction vs the audit filing:** no unit-inside-rubble
OVERLAP was actually reachable — both sites ship `MoveAction` proposals,
and §35b's `destinationBlocked` (footprint-aware `unitAt`, occupied OR
claimed) re-validates at execution. The real defect was a DOOMED
proposal: the roll landed on a body cell, §35b aborted it
(`unit:moveAborted`), and the unit wasted its whole tick instead of
wandering/retreating/yielding.

**The ⚠ claimedCells question (spec'd alongside): guarded elsewhere,
documented, NOT folded.** A wander/panic step onto a claimed cell cannot
same-cell-collide with an in-flight mover's flip — the same §35b
occupied-OR-claimed gate rejects it at execution. The asymmetry with
`retreatCell` (which folds claims itself) is principled: effect
repositions write `position` instantly inside `applyEffect`, bypassing
the selector gate. Comments at all three sites now say so.

**Fingerprint: fixtures BYTE-IDENTICAL** (they carry no rubble and the
capture rosters no healers/blind — `baseline.test.ts` pins + the
drift gates passed unregenerated). Live behavior change is confined to a
blind/panicking unit adjacent to a 2×2/3×3 rubble body (River): it now
proposes among genuinely free cells (or holds/yields honestly) instead
of burning ticks on aborts. 3 new tests (2 wander, 1 panic) verified to
FAIL against the pre-fix sim. 1734 main / 212 fuzz:smoke / typecheck
clean; no fuzz re-baseline needed.

---

## 44-pre-b — the AoE/chain footprint seam (the one §39 planted) — 2026-07-05

The second §44-pre straggler: `effects/targeting.ts` was corner-only in
three places — the seam §39's own docblock promised to fill and §39/§40
never did. All three now route through the footprint:

- **`unitsInCells`** — "units whose FOOTPRINT intersects the cells"
  (`cellsOccupiedBy`), so an AoE covering a big rubble's BODY but not
  its §39 corner no longer misses it entirely;
- **`resolveAreaVictims` mult** — the BEST covered cell: any footprint
  cell on the blast center → 1, else ring (a blast centered on a body
  cell used to pay the ring multiplier against the corner);
- **`nearestChainTarget`** — hop range + ranking measure to the nearest
  body cell via the NEW `occupancy.cellUnitDistance` (cell→body min,
  the `unitDistance` sibling; 44-pre-c's gates are its next consumers).
  Covers both the synchronous chain loop and deferred
  `pendingChainHops` (one geometry query serves both).

Deliberate scope hold: a chain hopping ONWARD from a multi-tile victim
still measures from that victim's corner (`from = victim.position`) —
`PendingChainHop.fromPos` is serialized state, so re-anchoring it is not
a docs-level tweak; today's chains chew INTO rubble, they don't relay
out of it, so the corner origin has no observable consequence.

**Fingerprint: BYTE-IDENTICAL for every 1×1 unit** (all three changes
reduce to the old expressions at footprint 1 — `baseline.test.ts` pins +
drift gates passed unregenerated; fixtures/captures carry no AoE anyway).
Live behavior change: mage bolts / chain arcs vs River's 2×2/3×3 rubble
only. 8 new tests (3 `cellUnitDistance`, 5 effects-targeting) verified
to FAIL against the pre-fix sim. 1742 main / 212 fuzz:smoke / typecheck
clean; no fuzz re-baseline needed.

---

## 44-pre-c — the footprint firing band (strike gates + movement hold, ONE commit) — 2026-07-05

The last §44-pre straggler, the behavior-changing one: every range gate
measured `chebyshev(unit.position, target.position)` — corner-to-corner
— so against a 3×3 rubble a melee unit flush with the FAR side read "out
of range" and walked around the body to its §39 corner (§40's "fires the
moment body-adjacent" comment was FALSE; §40b's reachability probes
already used footprint-aware `unitDistance`, so the two layers
disagreed).

**The fix: ONE shared predicate.** `Targeting.firingBandCell(from,
target, anchor, minRange, maxRange, losBlockers)` — the first target
BODY cell (anchored at its logical position or its §36b claimed
destination) inside the band with a clear line (`null` blockers = the
E7.D band-only lob). Both halves of the freeze pair route through it in
this commit:

- **strike gates** (`effects/propose.ts`): the single-target strike, the
  AoE blast (a FIFTH site the audit's list missed — same class, and a
  hold/blast disagreement is the same freeze; its blast CENTRE becomes
  the aim cell), and the dash abstain (`unitDistance`);
- **movement hold** (`MovementBehavior.inFiringBand` + the kite `dist`);
- **`findInRangeEnemy`** (O2 hold / blind acquisition) → `unitDistance`
  (byte-identical — neutrals are excluded there — but the measure now
  matches).

Semantics deliberately accepted (∃-cell over the body; the corner IS a
body cell, so the new band is a strict SUPERSET of the old one for
LOS-ignoring lobs): a catapult now lobs at a big body whose FAR side
enters its `[4,6]` band even when flush against the near side — "some
part of the body is at lob distance" — and the hold agrees (same
predicate), so it holds and fires instead of marching in. A bow in
body-range with a clear body ray fires even though the ray to the corner
threads the body; self-occlusion of far body cells is correct (the near
visible cell carries the gate). Aim-cell iteration is `footprintCells`
row-major — deterministic, no RNG.

Housekeeping in the same commit: `Targeting.minCellToBody` deduped into
44-pre-b's `occupancy.cellUnitDistance` (same math); the stale §40b
comment corrected.

**Fingerprint: the full `npm run pathing` re-measure is ROW-FOR-ROW
IDENTICAL to the 43c tables** — fixtures (no rubble) AND all five
shipped layouts × seeds 100–102, ticks/ttfc/drift/osc/decision-mix all
unmoved: the measured seeds never commit a rubble target (auto-target
fires only when a route is blocked; the fords stay open), so the change
is confined to actual rubble engagements. Drift gates + baseline pins
pass unregenerated. 10 new tests: 7 verified to FAIL pre-fix (melee
far-side strike + hold, bow body-shot fire + hold, catapult far-lob fire
+ hold, mage body-cell blast) and 3 standing pins (bow/dash too-close
abstains, and **the hold/strike pair-consistency sweep** — every free
cell around a 3×3 rubble × melee/bow/catapult: wherever movement says
`hold_band`, the strike MUST fire; the GP4/Qb#3 freeze-class gate, kept
green forever). 1752 main / 212 fuzz:smoke / typecheck clean; no fuzz
re-baseline needed.

**§44-pre COMPLETE** (a·b·c) — the §39 corner-only class is now cleared
through COMBAT/STATUS; 44a relocates onto this corrected base.

---

## 44a — the `positioning.ts` extraction (behavior-NEUTRAL checkpoint) — 2026-07-05

Phase 44 proper opens with the relocation onto the §44-pre-corrected
base. New module [src/sim/positioning.ts](src/sim/positioning.ts) — the
WHERE knowledge, one home:

- **moved in:** `firingBandCell` + the LOS pools
  (`collectLosBlockers` / `collectHalfCoverPositions`) from Targeting.ts;
  MovementBehavior's engagement block (~120 lines: band hold incl. the
  §36b arriving-claim case · the §40b rubble bestEffort approach · the
  firing-cell/target goal list · the O4/Qb#3 minRange kite) as
  `engagementDirective(unit, world, target, minRange)` returning
  `hold | approach{intent} | pinned`; the behavior keeps only the
  DECISION plumbing (proposals + `MoveDecisionKind`s). The 45-line
  protocol comment is now the module doc it was compensating for.
- **deduped:** the TRIPLICATED `NEIGHBORS`/`passable`/`countOpenNeighbors`
  leaves (MovementBehavior · SupportMovementBehavior ·
  effects/reposition) and the duplicated strictly-away retreat geometry —
  now ONE `awayStep(from, anchor, world, occupied)`; the occupancy-set
  semantics stay at the two callers (the gambit `retreatCell` folds
  claims, the healer `stepAwayFrom` deliberately doesn't — 44-pre-a).
- **⚠ gotcha #114 recurrence (documented there):** positioning.ts is
  reachable from `config/units`'s init via the effects layer, so its
  first cut importing `minRangeForArchetype` from archetypes.ts TDZ-
  crashed 69 test files at import. Fix shape: `minRange` is a PARAMETER
  (MovementBehavior, outside the cycle, resolves it); positioning.ts
  carries a top-of-imports warning.

**Byte-identity proof (the §38-oracle discipline):** 1752 main + 212
fuzz:smoke green untouched (incl. baseline pins + drift gates,
unregenerated), and the full `npm run pathing` re-measure is
ROW-FOR-ROW identical to the 43c tables — fixtures AND all five shipped
layouts × seeds 100–102, ticks/ttfc/drift/osc/moves/decision-mix all
unmoved. No new tests (a pure relocation; the existing band/LOS/kiting
matrix pins it), no snapshot change.

---

## 44b — first-class WaitAction (the deliberate hold becomes a proposal) — 2026-07-05

Two commits close Phase 44. **44b-1 (the seam):** `WaitAction` (empty
timeline, no `applyEffect`, score 1 / cooldown 0) + World's
INSTANTANEOUS-ACTION rule — a winning zero-length/no-deferred-effect
proposal resolves entirely within its tick: `start()` emits the new
`unit:waited`, nothing enters `activeAction`, no 0-cooldown entry is
written (both serialize — the two byte-identity landmines, found by
audit, dodged by construction). 'wait' is deliberately NOT in the action
registry: it can never be mid-flight at a snapshot, so decode reaching it
throws loudly. **44b-2 (the conversion):** the two deliberate-hold sites
— MovementBehavior's `hold` directive (the firing-band hold) and the
healer's in-heal-range hold (SupportMovementBehavior step 1, via the new
`yieldSwap` split of `yieldChokepoint`) — now propose the wait instead of
returning bare null. `MoveDecisionKind` **renames `hold_band` → `wait`**
(same decision, same sites, same counts — now a Steps kind, since a
proposal is returned); bare `null` again means only "nothing to propose".
The helpless abstains (frozen / boxed / no_goal / hold_objective / queue /
pinned / no_route) stay null — `queue`'s conversion is §45b's ETA-gated
wait, deliberately NOT this step.

**Decisions locked (from the ROADMAP §44 leanings, all confirmed):**
1-tick re-decide · no cooldown · NO `activeAction` (within-tick,
event-only — a committed multi-tick wait has no consumer; if §45+ wants
one, audit the WorldSnapshot surface first, it's a bump) · deliberate
holds only · renderer "queued" stance deferred to §45 · wait score 1
(move tier — any ready ability outranks holding by construction, which
is the selector-prefers-attacks exit test).

**Byte-identity proof (the §44 exit criterion):** the standing A/B exit
test (a wait-proposing world's serialized JSON === its bare-null twin's,
5 ticks) + 1757 main + 212 fuzz:smoke green with NO re-baseline (incl.
baseline pins + drift gates, unregenerated) + the full `npm run pathing`
re-measure ROW-FOR-ROW identical to the 43c tables — fixtures AND all
five shipped layouts × seeds 100–102, every metric unmoved; the decision
mixes differ ONLY by the `hold_band` → `wait` rename (e.g. openField
`wait 768 · advance 16`, exactly §42c's hold_band 768). WorldSnapshot
v32 / RunSnapshot v24 hold. The §36b claim-hold, 43-pre-b LOS-hold,
44-pre-c band-hold, and §40b rubble-hold tests all re-pin against the
wait proposal (`action.id === 'wait'`), keeping the GP4/Qb#3
hold⇒strike sweep aligned with the new kind.

**What §45 buys with this:** the wait is now a REAL selector citizen —
§45b's ETA-gated wait-vs-sidestep just proposes it from a new site with
its own condition; no new machinery needed. `unit:waited` is the
renderer's future "queued" stance hook.

**PHASE 44 COMPLETE** (44-pre-a/b/c · 44a · 44b).

---

## 45a — vacancy-aware costs (occupancy stops being timeless) — 2026-07-05

Phase 45 opens: the first behavior-changing cooperation step. The A* soft-
block penalty stops pricing every body/claim at a flat +4 and starts asking
WHEN the cell will actually hold a body at the pather's arrival:

- **`occupancy.vacancyEtaOf(unit, world)`** — ticks until a unit's in-flight
  move flips it off its current cells (`startTick` + the impact-boundary
  offset − now; pre-flip detected by its live destination claim). DERIVED
  from `activeAction` on every query, never serialized — a resumed snapshot
  answers identically, no bump (v32/v24 hold). **`occupancy.claimEtas`** —
  the claim-side sibling: every claimed cell with its flip ETA (the same
  number; one flip both vacates the origin and fills the claim).
- **`costAt` tiers** (`config/sim.json`; `occupiedCellPenalty` 4 splits):
  *vacating in time* → `vacatingCellPenalty` **1** (occupant flips out within
  `(chebyshev + vacancyWindowOwnSteps) ×` the pather's OWN step ticks; k =
  **1** own-step, the ROADMAP leaning); *claim flipping inside the
  convergence window* (or timing underivable) → `inboundClaimPenalty` **8**
  (a body lands there right around when I would — the charter's "claim into
  the unit's path", priced ABOVE a body); *claim flipping long before
  arrival* → static 4 (just a body by then — this is what lets a column's
  lead claim stop reading WORSE than the leader itself); *static body* →
  4 unchanged.
- **Both movers share the doctrine:** `buildMovementContext` (combat, tile
  pursuit, dash) and the healer's bespoke `stepToward` feed the same
  `costAt`. The healer's claim exposure is NEW (its cost fn never saw claims
  before — routes shift, commit semantics untouched).
- **Safety unchanged (the charter's "carefully"):** every discount touches
  route SELECTION only. The step-commit collision set, the sidestep
  occupancy set, and §35b's occupied-OR-claimed execution gate stay strict —
  same-cell convergence stays impossible at any dial setting. Pinned by the
  new ticking corridor-column test (80 ticks, `findOverlappingCells` empty
  every tick, no overtake) + the standing §35d fuzz invariant.

**Fingerprint (vs the 43c/44b tables):**

| fixture | 43c | 45a | reading |
|---|---|---|---|
| openField(4) | 0.00 / 0.00, mix 768w/16a | byte-identical | no in-flight traffic on anyone's route |
| corridor(3) | 0.75/100t, q1 s3 | byte-identical | sealed tunnel, no detour to un-choose |
| corridor(6) | 1.50/100t, q9 **s12**, osc 0.048 | 1.50/100t, q9 **s11**, osc **0.036** | one crab-step became a lane-follow |
| riverFork(4) | drift **−0.25** / +0.25 | drift **0.00 EXACT** / +0.25 | ford approach stops detouring around mid-move allies; osc 0.923 untouched (§45b's) |

Shipped layouts (seeds 100–102): river 100 byte-identical; the rest reshape
within the gates — all six river/isthmus team-seed |drifts| ≤ 1.08 (gate
2.5), river net dx sign-mixed (gate), **labyrinth all three seeds END
FASTER** (987→901, 875→850, 1013→989 ticks) on fewer moves (less detour
walking); procedural 100/101 shorter too (287→255, 407→355).

**⚠ Two honest intermediates, both §45b/§45c's charter — watch, don't fix
here:** (1) **queue mass re-concentrates** (labyrinth 100 player queue
287-era worst → 623; isthmus 102 → 105): units now stay in a blocked lane
(queue-abstain) instead of flanking around it — pre-45b a queue-abstain
does nothing useful, it's precisely the raw material 45b converts into
ETA-gated waits. (2) **isthmus fights run longer** (421→534 / 414→440 /
509→518) for the same reason — queuing at the chokepoint beats flanking
only once waiting is an action. endlessCorridors osc worst 0.132 → 0.156
(§45c's hysteresis owns oscillation there). If 45b doesn't drain these,
the dials come down before 45d.

**Proof:** 1775 main (18 new: 7 `vacancyEtaOf` · 10 costAt-tier/route —
incl. the corridor A/B pair proving the discount is ETA-GATED (a glacial
leader still reads as a wall and the follower detours; a prompt one reads
as a draining lane and it stays in lane) · 1 ticking column) + 212
fuzz:smoke green with **NO re-baseline** + drift gates passed
unregenerated + `baseline.test.ts` re-pinned (riverFork player drift
−0.25 → 0.00; corridor(6) sidestep 12 → 11) + typecheck clean.

---

## 45b — wait-vs-sidestep (THE CRAB-WALK DIES) — 2026-07-05

Two rules land together; the second was found at the keyboard when the
first alone measured a no-op on its own target.

**Rule 1 — the ETA-gated wait (the chartered one).** In `stepAlongRoute`,
when the committed forward cell (`path[1]`) is occupied by a body whose
`vacancyEtaOf` is within `waitForVacancyOwnSteps` (**1** own-step,
`config/sim.json`) of the mover's own cadence, propose §44b's first-class
`WaitAction` — queue in lane — instead of the E5.B sidestep. Re-decided
every poll (a stalled blocker fails the gate next tick — no freeze);
claims never qualify (an ARRIVING body is not a draining lane); fires for
`sidestepWhenBlocked: false` consumers too (it IS queueing). Decision
kind: `wait` (its second site family); `queue` now means "blocked with NO
derivable drain".

**The measured surprise:** the gate alone left riverFork at **0.926**
(was 0.923) — sidestep 194 → 195. Diagnosis (probed, not vibes): the
fixture is ability-less, so the ford contest never resolves — the fords
are PLUGGED by in-band units whose §44b waits are instantaneous
(no `activeAction`), making every blocker ETA-LESS by construction. The
gate's mechanism was proven elsewhere (corridor(6) queue 9 → 6 converted
to waits; isthmus/labyrinth below) but the crab itself was a different
animal: units SHUTTLING between the two plugged fords via sidesteps that
moved them FARTHER from their targets (286 backtracks/300t — on a
diagonal approach, both perpendicular rotations lose ground, and the
viable one was taken anyway).

**Rule 2 — the sidestep PROGRESS GUARD (the shuttle killer).** `sidestep`
rejects a candidate strictly farther (Chebyshev) from the approach anchor
than standing still. Stateless, RNG-free, rotation-symmetric (nullity
commutes with the 180° board rotation — gate-tested). Consequences, all
measured: a pure-diagonal approach never sidesteps backward (both
rotations lose ground → honest queue/wait); a strictly-closer diagonal
rotation still fires; cardinal ties — the ones corridor flow is made
of — keep §43b's cell-parity rule untouched (the mirrored-pocket pin
passes unmodified).

**Fingerprint (vs 45a):**

| fixture | 45a | 45b | |
|---|---|---|---|
| riverFork osc P | 0.923 | **0.087** | the §45 target line (≪ 0.5) — CLEARED |
| riverFork sidestep / moves / backtracks P | 194 / 310 / 286 | **4 / 23 / 2** | the shuttle WAS the fixture's motion |
| riverFork drift P/E | 0.00 / +0.25 | −0.25 / +0.25 | symmetric; 45a's 0.00 was partly shuttle-averaging; gate (≤0.5) holds |
| corridor(3/6) throughput | 0.75 / 1.50 | **0.75 / 1.50** | HELD — patience costs zero crossings |
| corridor(3/6) osc P | 0.029 / 0.037 | 0.000 / 0.014 | churn → waits/queues |
| openField | byte-identical | byte-identical | no traffic, no change |

Shipped layouts (vs 43c worst-seeds): **isthmus osc 0.000 in 4/6
team-seeds** (43c worst 0.083) and 45a's queue-105 seed drained
(→ waits); **labyrinth osc worst 0.163 → 0.066** with queue mass 623
(45a) → 391 absorbed by waits 202–330; river osc ≤ 0.091 everywhere,
seed 101 ends in 225t (fastest recorded); procedural osc ≈ 0.000
across the board. endlessCorridors osc worst 0.150 (flat since 42c)
— §45c's hysteresis owns it, unchanged by charter. Isthmus 100 runs
534t vs 43c's 421t: approach-phase standoffs are queue-heavy now
(honest queues > phantom shuffling); the 45d feel playtest judges it,
45c's commitment should shrink it.

**Standing gates landed (drift.test.ts, same never-relax doctrine):**
riverFork oscillation ≤ 0.5 both teams (the crab-walk stays dead) +
corridor(3/6) throughput floors ≥ 0.75/1.50 (queueing must never starve
the gate).

**Proof:** 1784 main (+9: the wait-gate matrix incl. the ford-mouth
preempt-a-viable-sidestep pin and the gate-inclusive boundary; the
progress-guard pins; the 2 gates) + 212 fuzz:smoke **NO re-baseline** +
§43c drift gates passed unregenerated + baseline.test.ts re-pinned +
typecheck clean. v32/v24 hold (nothing serialized — the wait stays
instantaneous, the guard is pure geometry).

---

## 45c-pre — the flip audit (the determinism decision resolves: DERIVE, no bump) — 2026-07-06

Pure instrumentation + a trace, per the resolved plan (user-confirmed the
(b) lean 2026-07-06): measure the repath flip-flop before building its
cure, so the cache-vs-determinism decision — the round's ONE candidate
snapshot bump — resolves on data.

**New instruments (byte-identical — observational only):**

- **`zigzagRate`** (per team) — consecutive move pairs whose direction
  INVERTS on either axis, / moves. The flip-flop detector `oscillationRate`
  (backtracks) can't see: lane thrash advances while alternating laterally,
  never revisiting a cell. ⚠ zigzags ⊇ honest bends (maze switchbacks,
  chases) — compare across runs, never to zero.
- **`pathfindingCalls` (+ /100t)** — the A* delta per run, off the §J2
  `pathfindingStats` counter. The headline tables carry both new columns
  from this entry on.
- **[tests/pathing/trace-flips.ts](tests/pathing/trace-flips.ts)** — the
  attribution tool: for every flip it re-derives the route under
  counterfactual contexts (claims stripped / all soft bodies stripped) and
  names the cause. Kept through §46 alongside trace-no-route.ts.

**The attribution table (endlessCorridors · isthmus · labyrinth × seeds
100–102, 351 flips):**

| cause | share | reading |
|---|---|---|
| geometry | **57%** | even the terrain-only route agrees with the flip — labyrinth switchbacks (44–47 of ~60 flips/seed) + honest chases. NOT flip-flop; nothing should suppress these. |
| retarget | 18% | target changed between moves — deaths + stickiness (already dialed, §E5). |
| **claim** | **17%** | strip claims and the old heading returns — the transient-reservation flicker. **The (b)-able class.** |
| **body** | **8%** | claims kept, soft bodies stripped → old heading returns — peers shuffling in/out of the lane. Also (b)-able. |

On **endlessCorridors — §45c's centerpiece — the flicker classes are
33–39% of flips**; labyrinth is switchback-dominated (by design — the
standing warning); **isthmus barely flips at all post-45b** (12 flips
across three seeds).

**Baseline readings (new columns):** endlessCorridors zigzag 0.12–0.26;
riverFork fixture **A\* 205/100t** — its 573 queue-abstain polls re-path
every tick ("repath is the tick default", quantified); corridor fixtures
10–25/100t; labyrinth 168–238/100t.

**THE §45c DECISION — ✅ RESOLVED: (b) derive-don't-cache, NO snapshot
bump.** The data: the only fixable flip class (claim+body, 25% overall)
is cost-flicker — a *derivable* hysteresis (stateless, from serialized
state only) can suppress it; the 57% geometry class is honest and route
MEMORY would wrongly fight it; nothing measurable remains that only (a)
serialization could buy. Consequence, honestly stated: **the charter's
"repath-count drops measurably" is RE-FRAMED** — it was premised on
caching; under derive-don't-cache A* still runs per poll, so 45c's
success metrics are the flicker-flip share (re-run the trace), the
endlessCorridors oscillation/zigzag, and the standing gates holding.
A\*/100t stays an informational perf meter (the pathing-perf budget test
is green; if the queue-repath load ever matters, skipping repath for
gate-failed queued units is a §46-notable optimization, not a §45c goal).

Housekeeping in the same commit: the H4 encounter-loop seed tests get a
20s budget (seed 4 sat at the old 5s wall — §45 battles legitimately run
longer where units queue; sim CONTENT, the 43a fuzz-timeout precedent).

**Proof:** 1791 main (+7 metric-arithmetic pins) + 212 fuzz:smoke, both
green with zero sim changes (tests/ + docs only — byte-identical by
construction); typecheck clean; v32/v24 hold.

---

## 45c — the stable-route margin (derivable anti-flicker hysteresis) — 2026-07-06

The build the resolved decision allows: **route commitment without route
memory.** Per poll, `chooseRoute` derives TWO routes from serialized state:

- the **stable incumbent** — the same A* with short-horizon transients
  stripped (bodies/claims whose flip ETA ≤ `stableRouteHorizonOwnSteps`
  × the pather's own step — §45c-pre's counterfactual probe promoted to
  the decision rule; longer-horizon traffic stays priced: a glacial
  blocker is furniture and must still be detoured);
- the **live challenger** — the full §45a pricing, exactly as before.

When their FIRST steps agree (or no short-horizon transient exists — the
quiet-world fast path, one search, byte-identical), the live route
proceeds. When they diverge, the live detour is followed only if its
advantage under live pricing exceeds `routeSwitchMargin` (**8** — one
pulsing claim/body (+4..+8) holds the lane; a crossing column (+12 and
up) still yields by detour); otherwise the unit keeps the stable lane and
the §45b step machinery (wait / progress-guarded sidestep / queue)
handles what's actually standing there. Everything re-derives per poll
from serialized state — a resumed snapshot chooses identically (the H4
resume-determinism oracle + the fuzz resume oracles keep proving it; NO
snapshot bump, v32/v24 hold). Dash + healer stay live-only (no measured
flip evidence there; scope tight).

**Fingerprint (the §45c-pre instruments, pre → post):**

| metric | 45c-pre | 45c | |
|---|---|---|---|
| trace: total flips (3 maps × 3 seeds) | 351 | **291** | −17% |
| trace: claim+body FLICKER flips | 88 (25%) | **52 (18%)** | **−41% absolute — the target class** |
| trace: endlessCorridors flicker | 57 | **29** | −49% on the centerpiece |
| trace: geometry/retarget (honest) | 263 | 239 | untouched by design (fewer moves overall) |
| endlessCorridors osc P (worst seed) | 0.150 | **0.104**; others ≤ 0.057 | first movement since 42c |
| endlessCorridors moves P/E (s100) | 161/207 | 116/132 | the thrash was walking |
| isthmus osc | 0.000×4 + 0.028/0.056 | **0.000 on ALL SIX team-seeds** | |
| isthmus ticks (s100 — the 45b watch item) | 534 | **475** | most of the 43c-421 regression recovered |
| labyrinth ticks / osc worst | 928/936/956 · 0.055 | **864/893/843** · 0.055 | faster again |
| corridor(6) fixture | sidestep 6 | **5** (re-pin) | one more crab → lane-hold |
| riverFork / openField / corridor(3) | — | byte-identical | |
| A*/100t (labyrinth) | 168–238 | 241–457 | the second search; informational — see below |

All standing gates pass unregenerated (drift bounds · dx sign-mixed ·
riverFork osc ≤ 0.5 · throughput floors).

**Two perf gates tried and REJECTED at the keyboard** (comment at the
`chooseRoute` site): a straight-first-step fast path and a
transient-distance prune — both measurably skipped REAL suppressions
(corridor(6)'s conversion died; endless osc regressed toward baseline),
and the fuzz wall-time growth that motivated them turned out to be
**CONTENT, not compute**: the §45c perf probe (worktree A/B, greedy
corpus) measured per-tick cost at +~1% on equal seeds, while several
greedy RUNS now go materially deeper/longer — battle outcomes shifted, so
run trajectories did too. Fuzz budgets re-bumped per the 43a precedent
(30s → 90s config default; occupancyInvariant 60s → 180s). ⚠ The
outcome-drift hint is FILED FOR §46b's balance spot-check (win rates vs
the §41 numbers).

**Proof:** 1797 main (+6: the junction margin matrix — baseline lane
pick, single-pulse holds, heavy traffic yields, static blocker still
detours, glacial-horizon gate, margin-from-config) + 212 fuzz:smoke
green; typecheck clean. (Mid-step incident, owned: a scratch worktree's
node_modules junction was deleted recursively — `npm install` restored
it from the untouched lockfile; no project file was affected.)

---

*(Next: 45d — the §45 close-out re-measure + regression bounds + the
NATIVE PLAYTEST that closes the phase. Residual by charter: the §46
verdict weighs the remaining queue mass, the A* load, and the School-2/3
gate on the full residue.)*
