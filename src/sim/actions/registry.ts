import type { Action } from '../Action';
import type { World } from '../World';
import { MOVE_ACTION_ID, MoveAction, type MoveActionData } from './MoveAction';
import { SPAWN_ACTION_ID, SpawnAction } from './SpawnAction';
import { SWAP_ACTION_ID, SwapAction, type SwapActionData } from './SwapAction';
import { EffectAction, type EffectActionData } from '../effects/EffectAction';
import { abilityDef } from '../../config/abilities';

/**
 * Action factories keyed by `Action.id`. `World.fromJSON` uses these to
 * rehydrate every unit's `activeAction` from a snapshot. New action kinds
 * register here; the registry stays a thin lookup table so the union of
 * supported actions is discoverable in one place.
 *
 * Factories take `(data, world)` because some actions reference live world
 * state (e.g. `AttackAction` resolves a `targetId` via `world.findUnit`).
 * Pure-data actions like `MoveAction` ignore the world arg.
 *
 * §44b — `WaitAction` ('wait') is DELIBERATELY absent: the instantaneous-
 * action rule resolves a wait within its tick, so it can never be mid-flight
 * at a snapshot. If 'wait' ever reaches `createAction`, that invariant broke
 * — the `abilityDef` fallback below throws, keeping the failure loud.
 */
export type ActionFactory = (data: unknown, world: World) => Action;

const FACTORIES: Record<string, ActionFactory> = {
  [MOVE_ACTION_ID]: (data) => MoveAction.fromData(data as MoveActionData),
  [SPAWN_ACTION_ID]: () => SpawnAction.fromData(),
  [SWAP_ACTION_ID]: (data) => SwapAction.fromData(data as SwapActionData),
};

export function createAction(id: string, data: unknown, world: World): Action {
  const factory = FACTORIES[id];
  if (factory) return factory(data, world);
  // Y3–Y5 — every combat verb is now a data-driven `EffectAction`, whose
  // `Action.id` is its `AbilityDef` id (e.g. 'sword', 'heal_ally', 'magic_bolt').
  // None are registered above (Y5c deleted the last two non-colliding entries,
  // `attack`/`heal`); the only registered factories are the non-verb actions
  // (move/spawn/swap). Re-resolve the def and rehydrate the captured cast-time
  // context. `abilityDef` throws on a genuinely unknown id, so a corrupt
  // snapshot still fails loudly.
  return EffectAction.fromData(data as EffectActionData, world, abilityDef(id));
}
