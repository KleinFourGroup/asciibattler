import type { Behavior } from '../Unit';
import { MovementBehavior } from './MovementBehavior';
import { AttackBehavior } from './AttackBehavior';

/**
 * Behavior factories keyed by `Behavior.kind`. `World.fromJSON` uses these
 * to rehydrate each unit's `behaviors` list from a snapshot. Behaviors are
 * stateless in MVP, so factories are zero-arg; if a future behavior gains
 * per-instance state, change its factory signature to take a snapshot blob
 * and add a `toData()` method on the behavior class (mirrors the Action
 * pattern in `actions/registry.ts`).
 */
export type BehaviorFactory = () => Behavior;

const FACTORIES: Record<string, BehaviorFactory> = {
  [MovementBehavior.kind]: () => new MovementBehavior(),
  [AttackBehavior.kind]: () => new AttackBehavior(),
};

export function createBehavior(kind: string): Behavior {
  const factory = FACTORIES[kind];
  if (!factory) {
    throw new Error(`createBehavior: no factory registered for behavior kind '${kind}'`);
  }
  return factory();
}
