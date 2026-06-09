import type { BattleObjective } from './objective';

/**
 * In-battle command channel. UI (and the headless harness in A3) enqueues
 * `WorldCommand`s on the active `World`; `World.tick()` drains the queue
 * at a deterministic point (top of tick, before per-unit step) and applies
 * each command. Pending commands are part of `WorldSnapshot` so a
 * mid-battle save/restore preserves intent that hasn't been processed yet.
 *
 * J1 — the first real command kinds land: `setObjective` / `clearObjective`
 * drive the player team's shared objective (the low-intensity steering layer;
 * see `src/sim/objective.ts`). `noop` stays so the channel can still be
 * exercised by snapshot tests without coupling to gameplay. The union stays
 * open so later additions land without touching the channel plumbing.
 */
export type WorldCommand =
  | { readonly kind: 'noop' }
  | { readonly kind: 'setObjective'; readonly objective: BattleObjective }
  | { readonly kind: 'clearObjective' };

export const WORLD_COMMAND_KINDS: readonly WorldCommand['kind'][] = [
  'noop',
  'setObjective',
  'clearObjective',
] as const;
