import type { ObjectiveTeam, TeamObjective } from './objective';

/**
 * In-battle command channel. UI (and the headless harness in A3) enqueues
 * `WorldCommand`s on the active `World`; `World.tick()` drains the queue
 * at a deterministic point (top of tick, before per-unit step) and applies
 * each command. Pending commands are part of `WorldSnapshot` so a
 * mid-battle save/restore preserves intent that hasn't been processed yet.
 *
 * O1 (Phase O) — the objective commands carry the team they steer.
 * `setObjective(team, objective)` sets that team's always-present
 * `TeamObjective`; `clearObjective(team)` reverts it to `atWill` (a thin alias
 * for `setObjective(team, { mode: 'atWill' })`, kept because the J3 UI calls
 * it). `noop` stays so the channel can still be exercised by snapshot tests
 * without coupling to gameplay. The union stays open so later additions land
 * without touching the channel plumbing.
 */
export type WorldCommand =
  | { readonly kind: 'noop' }
  | { readonly kind: 'setObjective'; readonly team: ObjectiveTeam; readonly objective: TeamObjective }
  | { readonly kind: 'clearObjective'; readonly team: ObjectiveTeam };

export const WORLD_COMMAND_KINDS: readonly WorldCommand['kind'][] = [
  'noop',
  'setObjective',
  'clearObjective',
] as const;
