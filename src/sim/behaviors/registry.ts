import type { Archetype, Behavior } from '../Unit';
import { MovementBehavior } from './MovementBehavior';
import { SupportMovementBehavior } from './SupportMovementBehavior';
import { AbilityBehavior } from './AbilityBehavior';

/**
 * Behavior factories keyed by `Behavior.kind`. `World.fromJSON` uses these
 * to rehydrate each unit's `behaviors` list from a snapshot. Behaviors are
 * stateless in MVP, so factories are zero-arg; if a future behavior gains
 * per-instance state, change its factory signature to take a snapshot blob
 * and add a `toData()` method on the behavior class (mirrors the Action
 * pattern in `actions/registry.ts`).
 *
 * E2 retired AttackBehavior in favor of AbilityBehavior — the per-ability
 * id list lives on `unit.abilities` (snapshotted as `string[]`).
 */
export type BehaviorFactory = () => Behavior;

const FACTORIES: Record<string, BehaviorFactory> = {
  [MovementBehavior.kind]: () => new MovementBehavior(),
  [SupportMovementBehavior.kind]: () => new SupportMovementBehavior(),
  [AbilityBehavior.kind]: () => new AbilityBehavior(),
};

export function createBehavior(kind: string): Behavior {
  const factory = FACTORIES[kind];
  if (!factory) {
    throw new Error(`createBehavior: no factory registered for behavior kind '${kind}'`);
  }
  return factory();
}

/**
 * E7.B — the movement behavior an archetype spawns with. The healer
 * positions defensively (`SupportMovementBehavior` — keep allies in heal
 * range, flee when threatened); every other archetype charges the nearest
 * enemy (`MovementBehavior`). Shared by both spawn paths — `battleSetup`'s
 * initial team spawn and `World.spawnFromQueue`'s D5.C overflow spawn — so
 * the two can't drift. The chosen behavior's `kind` is snapshotted and
 * rehydrated via `createBehavior`, so this only runs at fresh spawn time.
 */
export function createMovementBehavior(archetype: Archetype): Behavior {
  return archetype === 'healer' ? new SupportMovementBehavior() : new MovementBehavior();
}
