import type { Archetype, Behavior } from '../Unit';
import { UNIT_DEFS } from '../../config/units';
import { MovementBehavior } from './MovementBehavior';
import { SupportMovementBehavior } from './SupportMovementBehavior';
import { AbilityBehavior } from './AbilityBehavior';
import { CampWanderBehavior } from './CampWanderBehavior';

/**
 * Behavior factories keyed by `Behavior.kind`. `World.fromJSON` uses these
 * to rehydrate each unit's `behaviors` list from a snapshot, which stores
 * only the kinds. Factories take no arguments because behaviors hold no
 * state; a behavior given per-instance state would also need serializing,
 * as actions are (`toData` / `fromData`, `actions/registry.ts`).
 */
type BehaviorFactory = () => Behavior;

const FACTORIES: Record<string, BehaviorFactory> = {
  [MovementBehavior.kind]: () => new MovementBehavior(),
  [SupportMovementBehavior.kind]: () => new SupportMovementBehavior(),
  [AbilityBehavior.kind]: () => new AbilityBehavior(),
  // A camp member's locomotion: wander inside the leash, engage when hostile.
  [CampWanderBehavior.kind]: () => new CampWanderBehavior(),
};

export function createBehavior(kind: string): Behavior {
  const factory = FACTORIES[kind];
  if (!factory) {
    throw new Error(`createBehavior: no factory registered for behavior kind '${kind}'`);
  }
  return factory();
}

/**
 * The movement behavior an archetype spawns with, chosen by its `UnitDef`
 * `movementBehavior` (`config/units.json`): `support` positions defensively
 * (`SupportMovementBehavior`: keep allies in heal range, retreat when
 * threatened); absent or `standard` charges the nearest enemy
 * (`MovementBehavior`). Shared by the spawn paths so they can't drift:
 * `battleSetup`'s team spawn, `World.spawnFromQueue`'s overflow spawn and
 * `World.spawnSummon` for a summon outside a camp. Camp members take
 * `CampWanderBehavior` instead, since a camp unit shares its catalog def with
 * the non-camp one.
 *
 * Runs only at a fresh spawn; a snapshot rehydrates the chosen `kind` through
 * `createBehavior`. `UNIT_DEFS` is read at call time, not module evaluation,
 * which keeps the import cycle-safe.
 */
export function createMovementBehavior(archetype: Archetype): Behavior {
  return UNIT_DEFS[archetype].movementBehavior === 'support'
    ? new SupportMovementBehavior()
    : new MovementBehavior();
}
