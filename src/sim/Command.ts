import type { ObjectiveTeam, TeamObjective } from './objective';

/**
 * The in-battle command channel. The UI and the bot drivers enqueue
 * `WorldCommand`s on the active `World`, and `World.tick()` drains the queue
 * at a fixed point (the top of the tick, before the units step) and applies
 * each. Pending commands are part of `WorldSnapshot`, so a save made mid-battle
 * keeps an intent not yet applied.
 *
 * The objective commands name the team they steer. `setObjective` sets that
 * team's `TeamObjective`; `clearObjective` puts it back to `atWill`, the same
 * as `setObjective` with `{ mode: 'atWill' }`, and the objective UI and the
 * bot drivers send it. `noop` changes nothing, so a test can exercise the
 * channel without touching play.
 */
export type WorldCommand =
  | { readonly kind: 'noop' }
  | { readonly kind: 'setObjective'; readonly team: ObjectiveTeam; readonly objective: TeamObjective }
  | { readonly kind: 'clearObjective'; readonly team: ObjectiveTeam };
