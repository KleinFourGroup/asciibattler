import type { Action } from '../Action';
import type { World } from '../World';
import { MOVE_ACTION_ID, MoveAction, type MoveActionData } from './MoveAction';
import { ATTACK_ACTION_ID, AttackAction, type AttackActionData } from './AttackAction';
import { SPAWN_ACTION_ID, SpawnAction } from './SpawnAction';
import { HEAL_ACTION_ID, HealAction, type HealActionData } from './HealAction';
import { SWAP_ACTION_ID, SwapAction, type SwapActionData } from './SwapAction';
import { EffectAction, type EffectActionData } from '../effects/EffectAction';
import { abilityDef } from '../../config/abilityDefs';

/**
 * Action factories keyed by `Action.id`. `World.fromJSON` uses these to
 * rehydrate every unit's `activeAction` from a snapshot. New action kinds
 * register here; the registry stays a thin lookup table so the union of
 * supported actions is discoverable in one place.
 *
 * Factories take `(data, world)` because some actions reference live world
 * state (e.g. `AttackAction` resolves a `targetId` via `world.findUnit`).
 * Pure-data actions like `MoveAction` ignore the world arg.
 */
export type ActionFactory = (data: unknown, world: World) => Action;

const FACTORIES: Record<string, ActionFactory> = {
  [MOVE_ACTION_ID]: (data) => MoveAction.fromData(data as MoveActionData),
  [ATTACK_ACTION_ID]: (data, world) => AttackAction.fromData(data as AttackActionData, world),
  [SPAWN_ACTION_ID]: () => SpawnAction.fromData(),
  [HEAL_ACTION_ID]: (data, world) => HealAction.fromData(data as HealActionData, world),
  [SWAP_ACTION_ID]: (data) => SwapAction.fromData(data as SwapActionData),
};

export function createAction(id: string, data: unknown, world: World): Action {
  const factory = FACTORIES[id];
  if (factory) return factory(data, world);
  // Phase Y3 — a non-legacy id is a migrated `EffectAction`, whose `Action.id`
  // is its `AbilityDef` id (e.g. 'sword'), not one of the per-class ids above.
  // Re-resolve the def and rehydrate the captured cast-time context. `abilityDef`
  // throws on a genuinely unknown id, so a corrupt snapshot still fails loudly.
  //
  // ⚠️ A migrated verb whose `AbilityDef` id EQUALS a legacy action id
  // (`gambit_strike`, `dash`, `magic_bolt`, `catapult_shot`) MUST NOT be
  // registered above, or that legacy factory would shadow this fallback and
  // mis-decode the `EffectActionData`. The legacy class stays alive for the
  // determinism oracle (registered NOWHERE), deleted at Y5. Verbs whose ids
  // DON'T collide (`attack`/`heal`) keep their factory entry until Y5.
  return EffectAction.fromData(data as EffectActionData, world, abilityDef(id));
}
