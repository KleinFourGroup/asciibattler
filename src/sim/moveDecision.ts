import type { Unit } from './Unit';
import type { World } from './World';

/**
 * The movement layer's decision record, one a poll.
 *
 * Every `MovementBehavior` and `SupportMovementBehavior` poll emits exactly
 * one `unit:moveDecision`, naming why the unit moved, or why it chose not to
 * or could not. The pathing metrics (the decision mix, oscillation, queue
 * counts) read these as values. Observational only: no world state, no RNG
 * draw, never serialized, so a world with no subscriber runs the same.
 *
 * It records the movement layer's intent for the poll, not the action taken:
 * a proposal can lose the selector to a higher-scoring ability (the dash),
 * so `unit:moved` is the motion. A unit with an action under way isn't
 * polled and emits nothing that tick.
 *
 *   Steps (a proposal was returned)
 *   - `advance` — took the route's step, or a leap's landing, toward a goal.
 *   - `sidestep` — the forward cell was occupied; took the perpendicular.
 *   - `retreat` — the healer's panic step away from a threat.
 *   - `flee` — a panicked unit's step away from the nearest threat.
 *   - `wander` — a blinded unit's step to a random open neighbour.
 *   - `yield_swap` — a swap the blocker starts: the healer's yield at a
 *     choke, or a ranged unit yielding to a melee teammate it strictly
 *     blocks, scored above its attack (`YIELD_SWAP_SCORE`).
 *   - `swap_through` — a swap the mover starts: a blocked melee unit passes
 *     through a friendly ranged one between actions, tried before the
 *     sidestep (`movement.ts`, `roleEligibleBlocker`). An eligible blocker
 *     that is busy means `queue`; its own yield covers that window.
 *   - `flee_swap` — a boxed-in panicked unit swaps with an adjacent idle
 *     ally, not fleeing and not a support, standing strictly farther from
 *     the threat; the displaced fighter gains a step it already wanted.
 *   - `wait` — a deliberate hold, a `WaitAction` proposal: in position to
 *     act (the firing band, heal range), or waiting in lane for a forward
 *     cell whose occupant leaves within `SIM.waitForVacancyOwnSteps` of the
 *     unit's own steps. A ready ability outranks it, and a wait that wins
 *     resolves within its tick (`WaitAction`).
 *
 *   Abstains (returned null, which means only "nothing to propose")
 *   - `queue` — wanted to step; a body or a claim blocks the way with no
 *     vacancy inside the wait's gate.
 *   - `no_route` — no path to any goal, or already on it.
 *   - `hold_objective` — a `hold` objective forbids moving.
 *   - `no_goal` — nothing to pursue (no enemy, rally or wounded ally; the
 *     healer already in formation).
 *   - `pinned` — a kiting ranged unit inside its minimum range with no
 *     reachable firing cell; it stays rather than charging its target.
 *   - `boxed` — wanted a step away or aside (flee, wander, the healer's
 *     retreat) and no cell qualified, the cases with no threat to step from
 *     included. A fleeing unit is boxed only when no flee swap qualified
 *     either, and a healer only when no yield did; each is tried first.
 *   - `frozen` — a status (`preventsMove`) roots the unit.
 */
export const MOVE_DECISION_KINDS = [
  'advance',
  'sidestep',
  'retreat',
  'flee',
  'wander',
  'yield_swap',
  'swap_through',
  'flee_swap',
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
