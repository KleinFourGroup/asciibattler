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
 * The kinds (§44 adds `wait` when deliberate holds become WaitAction
 * proposals):
 *
 *   Steps (a proposal was returned)
 *   - `advance`     — took the A* step (or leap landing) toward a goal.
 *   - `sidestep`    — forward cell occupied; took the E5.B perpendicular.
 *   - `retreat`     — a deliberate away-step (the healer's panic-retreat).
 *   - `flee`        — panic-status step away from the nearest threat.
 *   - `wander`      — blind-status step to a random open neighbor.
 *   - `yield_swap`  — the healer's GP5 chokepoint swap with a boxed ally.
 *
 *   Abstains (returned null)
 *   - `queue`          — wanted to step; a unit blocks the way; holding.
 *   - `no_route`       — no path to any goal (or already on every goal).
 *   - `hold_band`      — in acting range (firing band / heal range) with the
 *                        shot clear; holding to act. The §44 WaitAction site.
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
export type MoveDecisionKind =
  | 'advance'
  | 'sidestep'
  | 'retreat'
  | 'flee'
  | 'wander'
  | 'yield_swap'
  | 'queue'
  | 'no_route'
  | 'hold_band'
  | 'hold_objective'
  | 'no_goal'
  | 'pinned'
  | 'boxed'
  | 'frozen';

/** Emit the one-per-poll decision record (see `MoveDecisionKind`). */
export function emitMoveDecision(world: World, unit: Unit, kind: MoveDecisionKind): void {
  world.emit('unit:moveDecision', { unitId: unit.id, kind });
}
