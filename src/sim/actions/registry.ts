import type { Action } from '../Action';
import type { World } from '../World';
import { MOVE_ACTION_ID, MoveAction, type MoveActionData } from './MoveAction';
import { ATTACK_ACTION_ID, AttackAction, type AttackActionData } from './AttackAction';
import { SPAWN_ACTION_ID, SpawnAction } from './SpawnAction';
import {
  GAMBIT_STRIKE_ACTION_ID,
  GambitStrikeAction,
  type GambitStrikeActionData,
} from './GambitStrikeAction';
import { HEAL_ACTION_ID, HealAction, type HealActionData } from './HealAction';
import {
  MAGIC_BOLT_ACTION_ID,
  MagicBoltAction,
  type MagicBoltActionData,
} from './MagicBoltAction';
import {
  CATAPULT_SHOT_ACTION_ID,
  CatapultShotAction,
  type CatapultShotActionData,
} from './CatapultShotAction';

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
  [GAMBIT_STRIKE_ACTION_ID]: (data, world) =>
    GambitStrikeAction.fromData(data as GambitStrikeActionData, world),
  [HEAL_ACTION_ID]: (data, world) => HealAction.fromData(data as HealActionData, world),
  [MAGIC_BOLT_ACTION_ID]: (data) => MagicBoltAction.fromData(data as MagicBoltActionData),
  [CATAPULT_SHOT_ACTION_ID]: (data, world) =>
    CatapultShotAction.fromData(data as CatapultShotActionData, world),
};

export function createAction(id: string, data: unknown, world: World): Action {
  const factory = FACTORIES[id];
  if (!factory) {
    throw new Error(`createAction: no factory registered for action id '${id}'`);
  }
  return factory(data, world);
}
