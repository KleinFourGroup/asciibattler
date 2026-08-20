/**
 * E5 — per-subsystem sim tunables (target stickiness, and room for more
 * pathfinding/behavior knobs as Phase E/F grows). Source of truth at
 * `config/sim.json`. Mirrors the `config/spawn.json` + `config/tiles.json`
 * pattern: timings are authored in seconds (gotcha #6) and converted to
 * integer ticks at module load, so a TICK_RATE change re-derives the
 * cadence automatically.
 *
 * A4 pattern: parse at module load, throw on malformed JSON.
 *
 *   retargetCloserRatio — target stickiness keeps a unit locked onto its
 *     current enemy until another enemy is at least this many times
 *     closer (1.5 = "switch only when a rival is 1.5x nearer"). >= 1 so
 *     "switch on any closer enemy" degenerates cleanly at 1.0.
 *   rangedRetargetLosSeconds — a ranged unit that can't see its sticky
 *     target for this long drops it and re-picks. Converted to
 *     `rangedRetargetLosTicks`.
 *   occupiedCellPenalty — extra A* cost (on top of tile cost) for routing
 *     MovementBehavior's path through a cell occupied by another unit
 *     (ally / non-target enemy). The soft-block dial: high → flank around
 *     allies (the old hardcoded 100 was steep enough to favour long
 *     backward flanks off the spawn band); low → go straight and
 *     queue/sidestep when blocked. Must stay >= 0 (keeps total cost >= 1,
 *     Chebyshev admissible) and finite (no deadlock). Does NOT affect
 *     walls/half-cover — those are hard blockers, not penalised cells.
 *     §45a splits this into three tiers — this dial now covers only the
 *     STATIC occupant (a body with no in-flight move); the two below cover
 *     the temporal cases. All three are route-SELECTION dials only: the
 *     step-commit collision check and the §35b execution gate stay hard,
 *     so same-cell convergence stays impossible whatever these are set to.
 *   vacatingCellPenalty — §45a: the discounted penalty for a cell whose
 *     occupant's in-flight move will vacate it within the pather's own
 *     arrival window (Chebyshev distance × own step ticks, plus
 *     `vacancyWindowOwnSteps` steps of slack). Near-zero → a corridor
 *     column stops reading as a wall and followers route straight through
 *     the vacating lane. Kept >= 0 (admissibility, as above); keep it
 *     below `occupiedCellPenalty` or the split is meaningless. The vacancy
 *     ETA is DERIVED from the mover's active action (occupancy.vacancyEtaOf)
 *     — never serialized, no snapshot shape.
 *   inboundClaimPenalty — §45a: the penalty for a cell CLAIMED as an
 *     in-flight move's destination (a body is guaranteed to materialise
 *     there at the flip — worse than a static body, which might move).
 *     Replaces the flat `occupiedCellPenalty` those cells paid pre-§45a;
 *     keep it above `occupiedCellPenalty` per the §45 charter. >= 0.
 *   vacancyWindowOwnSteps — §45a: the vacancy window k, in multiples of the
 *     pather's OWN step duration (the ROADMAP §45 leaning). A cell counts
 *     as "vacating in time" when its ETA <= (Chebyshev distance to it + k)
 *     × own step ticks. 0 = only cells already free by strict arrival
 *     estimate; higher → more optimism about lanes clearing. A step-count,
 *     not a timing — scales with the unit's speed automatically.
 *   waitForVacancyOwnSteps — §45b: the wait-vs-sidestep gate. When the
 *     IMMEDIATE forward cell (the committed A* step) is occupied by a body
 *     whose vacancy ETA <= this many of the pather's OWN steps, the unit
 *     proposes a first-class WAIT (§44b) — queue in lane — instead of the
 *     E5.B sidestep. Beyond the gate (or no derivable ETA: a static body, a
 *     claim) the sidestep/queue behavior is exactly pre-§45b. 0 = wait only
 *     for a same-tick flip; higher → deeper patience before crabbing.
 *     Distinct from `vacancyWindowOwnSteps` (route pricing) so queueing
 *     patience and route optimism tune independently. A step-count, not a
 *     timing.
 *   routeSwitchMargin — §45c: the anti-flicker hysteresis, in A* COST units.
 *     When transient traffic (claims / soon-vacating bodies) steers the live
 *     route's first step OFF the stable-world route (the same route with
 *     those transients stripped — the derivable incumbent; §45c-pre's
 *     counterfactual, promoted to the decision rule), the unit follows the
 *     live detour only if its advantage under live pricing EXCEEDS this
 *     margin; otherwise it holds the stable lane and lets the §45b step
 *     machinery (wait / progress-guarded sidestep / queue) handle the
 *     traffic. One pulsing claim/body (+4..+8) stays under an 8-margin —
 *     the §45c-pre flicker class dies; a real crossing column (+12 and up)
 *     still yields by detour. 0 = live always wins (pre-§45c behavior).
 *     Derived per poll from serialized state only — nothing cached, so a
 *     resumed snapshot chooses identically (the §45c determinism decision).
 *   stableRouteHorizonOwnSteps — §45c: what counts as "transient" when
 *     building the stable incumbent, in multiples of the pather's OWN step
 *     duration. A vacating body / derivable claim whose flip ETA is within
 *     this horizon is stripped from the stable context (it will resolve
 *     around one of my steps — routing noise); beyond it, the body/claim is
 *     as good as furniture and stays a stable cost (a glacially-vacating
 *     blocker must still be detoured, not queued behind). A step-count, not
 *     a timing.
 *   healerPanicRangeCells — E7.B: when a healer (`SupportMovementBehavior`)
 *     has no wounded ally in heal range, it panic-retreats from the nearest
 *     enemy that is within this many cells (Chebyshev). A distance, not a
 *     timing — passed through verbatim like `occupiedCellPenalty`, not
 *     `secondsToTicks`-converted. Higher → flightier healer; 0 disables
 *     the retreat (healer only ever heals/follows).
 *   healerFollowGapCells — E7.B: when nothing is healable and no enemy is
 *     near, the healer trails the CENTROID of its living allies, stepping
 *     whenever it's more than this many cells (Chebyshev) from that point.
 *     The deadzone that turns the old static-then-lurch follow into a smooth
 *     trail: small (1) → hugs the pack centre continuously; larger → hangs
 *     back loosely. A distance, not a timing.
 *   actingCellSearchSlack — GP4: when a unit approaches a target to act on it
 *     (archers/mage shooting, the catapult lobbing, the healer healing), it
 *     paths to the nearest cell from which it can ACT (in range, + LOS where
 *     the action needs it) rather than to the target's own cell. That cell is
 *     found by a bounded BFS outward from the unit, capped at `range + this`
 *     Chebyshev steps so a far/hopeless target doesn't scan the board — beyond
 *     the cap the unit falls back to charging the target's cell (the
 *     anti-freeze guarantee) and snaps to the acting cell once it closes in.
 *     The "small slack" past pure range that lets it find a LOS-clearing cell
 *     or take a one-cell sidestep. A distance, not a timing — passed through
 *     verbatim like `occupiedCellPenalty`. 0 = only cells already in range
 *     qualify; higher → searches wider (more work) for a standoff cell.
 *   shoveSearchRadiusCells — §35c: the BFS depth the de-overlap SHOVE searches
 *     for the nearest free cell when relocating a co-located unit (the
 *     occupancy backstop / the future-knockback primitive). Co-location is
 *     local — a free cell is almost always adjacent — so a small radius keeps
 *     the shove minimal-disruption + bounded; if nothing is free within it the
 *     shove no-ops (returns false) rather than teleporting across the board. A
 *     distance, not a timing — passed through verbatim.
 *   campWanderChancePerSecond — §75f (re-authored per-second at the 75j
 *     verdicts): the chance PER SECOND that a PASSIVE camp member takes one
 *     wander step inside its leash. The behavior polls once per tick while
 *     the unit is eligible (free, move off cooldown), so the loader derives
 *     `campWanderChancePerTick = 1 − (1 − perSecond)^(1/TICK_RATE)` — the
 *     gotcha-#6 discipline applied to a probability: a TICK_RATE change
 *     re-derives the threshold instead of re-tuning idle fidget rate (the
 *     original per-tick 0.05 @ 20Hz ≡ 0.64/s, so the shipped value
 *     preserves the 75h feel exactly). Rolls on the presence-gated
 *     `campRng` — the user-signed exception to the no-RNG-in-movement
 *     doctrine (camp idle wander is scenery flavor, not faction pathing).
 *     [0,1]: 0 = camps stand still (vacating the drip anchor stays
 *     unconditional); 1 = a step every eligible poll.
 *   blockCampTurnEnd — §75g: when on, a decisive win/loss does NOT land
 *     while the would-be winner still has an UNCLEARED camp hostile to it —
 *     the battle runs on until the camp fight is finished (the turn cap
 *     still resolves a stalemate as a draw, so battles stay bounded).
 *     **Shipped ON — the 75j feel verdict (user-signed 2026-08-09):** there
 *     isn't fine-grained enough control to disengage a half-fought camp, so
 *     the last enemy dying mid-camp-fight felt bad, not merciful. Off =
 *     camps never extend a battle (the §75e-pinned behavior, test-injected).
 *   enemyPullChance — §75g/§75j2: per turn, on a camp-bearing layout, the
 *     chance the enemy team opens with a DELIBERATE camp pull — the enemy
 *     TEAM objective is pointed at one camp's PRIMED member
 *     (engage{neutral}; the first consumer of the enemy objective system,
 *     the user's design intent), detouring the whole team. The camp is NOT
 *     pre-marked hostile — damage stays hostility's single source, so a
 *     pulled camp reads passive until the enemy actually strikes it. Rolls
 *     per TURN on `deriveRng(terrainSeed, 'enemyPull', worldSeed)` (77d3 —
 *     the worldSeed index is what makes it per-turn), derived lazily only
 *     when the knob is >0 AND the layout has camps — the dormant path
 *     derives nothing (the shape-lock's no-append clause; a terrainSeed-only
 *     stream replayed identically every turn of an encounter — the
 *     fetidPond-caught defect). A probability in [0,1].
 *     **Shipped 0.25 — the 75j verdicts: 0.15 read "works, but too rare".**
 *   campsStartHostile — §83e: the forced-engagement PROBE dial. When > 0,
 *     every installed camp is pre-marked hostile to the PLAYER faction at
 *     install time (idempotent — `hostileTo` is a Set and serialized, so the
 *     `fromJSON`/rollout-clone path re-applies harmlessly). A deliberate,
 *     measurement-only override of the §75g "damage stays hostility's single
 *     source" doctrine: the realistic bot has no camp-seeking (the §75h scope
 *     guard), so reading camp-engagement economics needs engagement FORCED
 *     through the ordinary targeting machinery (`hostileCandidate` admits
 *     both directions symmetrically; `blockCampTurnEnd` then runs the camp
 *     fight to completion, realizing rewards). Player-side only — enemy camp
 *     kills pay nothing, so enemy hostility would add only noise. Stored
 *     NUMERIC (0/1 switch, no RNG draw — no stream perturbation) so the
 *     `--set` knob registry can address it (`sim.campsStartHostile=1`, the
 *     enemyPullChance pattern). Shipped 0 — byte-identical passive camps;
 *     never ship > 0.
 *   moveFlipFraction — §36b: the fraction of a single-step move's busy window
 *     at which the unit's LOGICAL position flips from `from` to `to` (and the
 *     destination claim releases). Locked at 0.5 — the unit logically occupies
 *     `from` for the first half of the slide and `to` for the second, so a slow
 *     unit attacked at melee range reads as still mostly on its prior tile. The
 *     flip tick is `startTick + floor(durationTicks * this)`, carried by the
 *     move proposal's phase timeline (`travel` then a 0-length `impact`
 *     boundary), NOT a new serialized field. A ratio in [0,1]: 0 = instant
 *     (today's pre-§36b model), 1 = flip only on arrival. `floor` keeps a
 *     1-tick move (the lowest move cooldown) instant + byte-identical.
 */

import { z } from 'zod';
import simJson from '../../config/sim.json';
import { secondsToTicks, TICK_RATE } from '../config';

const SimSchema = z.object({
  retargetCloserRatio: z.number().min(1),
  rangedRetargetLosSeconds: z.number().positive(),
  occupiedCellPenalty: z.number().nonnegative(),
  vacatingCellPenalty: z.number().nonnegative(),
  inboundClaimPenalty: z.number().nonnegative(),
  vacancyWindowOwnSteps: z.number().nonnegative(),
  waitForVacancyOwnSteps: z.number().nonnegative(),
  routeSwitchMargin: z.number().nonnegative(),
  stableRouteHorizonOwnSteps: z.number().nonnegative(),
  healerPanicRangeCells: z.number().int().nonnegative(),
  healerFollowGapCells: z.number().int().nonnegative(),
  actingCellSearchSlack: z.number().int().nonnegative(),
  shoveSearchRadiusCells: z.number().int().positive(),
  moveFlipFraction: z.number().min(0).max(1),
  campWanderChancePerSecond: z.number().min(0).max(1),
  blockCampTurnEnd: z.boolean(),
  enemyPullChance: z.number().min(0).max(1),
  campsStartHostile: z.number().min(0).max(1),
});

const parsed = SimSchema.parse(simJson);

export const SIM = {
  retargetCloserRatio: parsed.retargetCloserRatio,
  rangedRetargetLosTicks: Math.max(1, secondsToTicks(parsed.rangedRetargetLosSeconds)),
  occupiedCellPenalty: parsed.occupiedCellPenalty,
  vacatingCellPenalty: parsed.vacatingCellPenalty,
  inboundClaimPenalty: parsed.inboundClaimPenalty,
  vacancyWindowOwnSteps: parsed.vacancyWindowOwnSteps,
  waitForVacancyOwnSteps: parsed.waitForVacancyOwnSteps,
  routeSwitchMargin: parsed.routeSwitchMargin,
  stableRouteHorizonOwnSteps: parsed.stableRouteHorizonOwnSteps,
  healerPanicRangeCells: parsed.healerPanicRangeCells,
  healerFollowGapCells: parsed.healerFollowGapCells,
  actingCellSearchSlack: parsed.actingCellSearchSlack,
  shoveSearchRadiusCells: parsed.shoveSearchRadiusCells,
  moveFlipFraction: parsed.moveFlipFraction,
  // §75j — the per-tick threshold DERIVED from the per-second author value
  // (see the docstring). `1` short-circuits exactly (1 − 0^(1/rate) = 1).
  campWanderChancePerTick: 1 - (1 - parsed.campWanderChancePerSecond) ** (1 / TICK_RATE),
  blockCampTurnEnd: parsed.blockCampTurnEnd,
  enemyPullChance: parsed.enemyPullChance,
  campsStartHostile: parsed.campsStartHostile,
};
