import type { Action } from '../Action';
import type { World } from '../World';
import { MOVE_ACTION_ID, MoveAction, type MoveActionData } from './MoveAction';
import { SPAWN_ACTION_ID, SpawnAction } from './SpawnAction';
import { SWAP_ACTION_ID, SwapAction, type SwapActionData } from './SwapAction';
import { EffectAction, type EffectActionData } from '../effects/EffectAction';
import { abilityDef } from '../../config/abilities';

/**
 * Action factories keyed by `Action.id`, which `World.fromJSON` uses to
 * rehydrate a unit's in-flight `activeAction` from a snapshot. The table
 * holds the non-combat actions; every other id is a combat verb, an
 * `EffectAction` whose id is its `AbilityDef` id.
 *
 * No shipped factory reads `world`: an `EffectAction` keeps its target's id
 * and resolves the unit when it fires.
 *
 * `WaitAction` (`'wait'`) is absent on purpose: a wait resolves within its
 * tick, so it is never in flight at a snapshot. If `'wait'` reaches
 * `createAction`, that rule broke, and the `abilityDef` fallback throws.
 */
type ActionFactory = (data: unknown, world: World) => Action;

const FACTORIES: Record<string, ActionFactory> = {
  [MOVE_ACTION_ID]: (data) => MoveAction.fromData(data as MoveActionData),
  [SPAWN_ACTION_ID]: () => SpawnAction.fromData(),
  [SWAP_ACTION_ID]: (data) => SwapAction.fromData(data as SwapActionData),
};

export function createAction(id: string, data: unknown, world: World): Action {
  const factory = FACTORIES[id];
  if (factory) return factory(data, world);
  // A combat verb: re-resolve its def and rehydrate the context captured at
  // cast time. The table above is checked first, so no ability may take the
  // id `move`, `spawn` or `swap`. `abilityDef` throws on an unknown id, so a
  // corrupt snapshot fails loudly.
  return EffectAction.fromData(data as EffectActionData, world, abilityDef(id));
}
