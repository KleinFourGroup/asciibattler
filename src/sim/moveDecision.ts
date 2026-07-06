import type { Unit } from './Unit';
import type { World } from './World';

/**
 * §42a — the movement layer's typed per-poll decision record.
 *
 * Every `MovementBehavior` / `SupportMovementBehavior` poll emits EXACTLY ONE
 * `unit:moveDecision` naming why the unit moved — or why it deliberately (or
 * helplessly) didn't. Before §42a an abstain was a bare `null` that meant six
 * different things; the Pathfinding-Audit instrumentation (the §42b metrics
 * harness: decision-mix histogram, oscillation rate, queue counts) needs the
 * reasons to be values, not comment lore. Purely observational: no world
 * state, no combatRng draw, never serialized — a world with no subscriber is
 * byte-identical.
 *
 * This records the MOVEMENT layer's intent for the poll, not necessarily the
 * executed action: a proposal can lose the selector to a higher-scoring
 * ability (e.g. the dash) — cross-check `unit:moved` for actual motion. Units
 * with an in-flight action aren't polled and emit nothing that tick.
 *
 * The kinds (§44b converted the deliberate hold from an abstain into a real
 * proposal):
 *
 *   Steps (a proposal was returned)
 *   - `advance`     — took the A* step (or leap landing) toward a goal.
 *   - `sidestep`    — forward cell occupied; took the E5.B perpendicular.
 *   - `retreat`     — a deliberate away-step (the healer's panic-retreat).
 *   - `flee`        — panic-status step away from the nearest threat.
 *   - `wander`      — blind-status step to a random open neighbor.
 *   - `yield_swap`  — the healer's GP5 chokepoint swap with a boxed ally.
 *   - `wait`        — the DELIBERATE hold, a first-class `WaitAction`
 *                     proposal, from two families of site: §44b's in-acting-
 *                     range holds (firing band / heal range, holding to act —
 *                     the `hold_band` rename) and §45b's ETA-gated queue-in-
 *                     lane (the forward cell's occupant vacates within
 *                     `waitForVacancyOwnSteps` own-steps — queue for it
 *                     instead of crabbing). The selector weighs it — a ready
 *                     ability still outranks it, and a winning wait resolves
 *                     within its tick (the instantaneous-action rule; no
 *                     world-state trace).
 *
 *   Abstains (returned null — which now means ONLY "nothing to propose")
 *   - `queue`          — wanted to step; a unit blocks the way with NO
 *                        drain ETA inside §45b's gate (a static body, a
 *                        claim, or a too-slow vacate); holding helplessly.
 *                        The derivable-drain case is a `wait` since §45b.
 *   - `no_route`       — no path to any goal (or already on every goal).
 *   - `hold_objective` — an O2 `hold` objective forbids repositioning.
 *   - `no_goal`        — nothing to pursue (no enemy / rally / wounded ally;
 *                        healer already in formation).
 *   - `pinned`         — the Qb#3 shape: a kiting ranged unit inside minRange
 *                        with no reachable firing cell — queues rather than
 *                        charging its target.
 *   - `boxed`          — wanted an away/scatter step (flee / wander / the
 *                        healer's panic-retreat) and no cell qualified; also
 *                        the degenerate no-anchor cases those helpers fold in.
 *   - `frozen`         — a status (`preventsMove`) roots the unit.
 */
export const MOVE_DECISION_KINDS = [
  'advance',
  'sidestep',
  'retreat',
  'flee',
  'wander',
  'yield_swap',
  'wait',
  'queue',
  'no_route',
  'hold_objective',
  'no_goal',
  'pinned',
  'boxed',
  'frozen',
] as const;

export type MoveDecisionKind = (typeof MOVE_DECISION_KINDS)[number];

/** Emit the one-per-poll decision record (see `MoveDecisionKind`). */
export function emitMoveDecision(world: World, unit: Unit, kind: MoveDecisionKind): void {
  world.emit('unit:moveDecision', { unitId: unit.id, kind });
}
