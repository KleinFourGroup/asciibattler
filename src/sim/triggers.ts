/**
 * K1 — the combat/lifecycle trigger vocabulary.
 *
 * A trigger is a deterministic dispatch point fired from the sim (or, in K1
 * commit 2, the run) where registered handlers may apply status effects. The
 * handlers are the seam the Phase-L daemon system plugs into; K1 ships the
 * dispatch surface + the fire points + tests (fixture handlers), with fatigue
 * as the one real consumer (via the effect-seed path, not a runtime handler).
 *
 * The combat triggers all fire at the single `World.applyDamage` chokepoint,
 * **after** the hit/miss fully resolves (post-HP-mutation), so a handler's stat
 * changes land on the NEXT action, not the one in flight. `kill` fires there
 * too (clean attacker attribution); `death` fires at the death-removal sites;
 * `spawn` when a unit enters the grid.
 *
 * Each trigger names its subject from that unit's perspective — `dealHit` is
 * the attacker landing a blow, `takeHit` the target receiving it; `dealMiss` /
 * `evade` are the attacker- and target-side of an evaded strike. Handlers are
 * NOT snapshotted (they're behaviour, re-attached at construction like the
 * behaviour/ability registries); in K1 production no handler is registered for
 * the combat triggers, so a mid-battle resume has nothing to re-attach.
 */

import type { Unit, Team } from './Unit';
import type { World } from './World';

/**
 * The closed set of triggers and their context payloads. Adding a trigger is
 * one entry here; `World.fireTrigger` / `registerTrigger` stay type-safe off
 * the map.
 */
export interface TriggerContextMap {
  /** A unit entered the grid (initial layout or a D5.C overflow spawn). */
  spawn: { unit: Unit };
  /** The attacker landed a blow (melee / ranged / mage / catapult). */
  dealHit: { attacker: Unit; target: Unit; damage: number; crit: boolean };
  /** The target received a landed blow. */
  takeHit: { target: Unit; attacker: Unit; damage: number; crit: boolean };
  /** The attacker's evadable strike was dodged (no HP touched). */
  dealMiss: { attacker: Unit; target: Unit };
  /** The target evaded an incoming evadable strike — the dodge-buff hook (L). */
  evade: { target: Unit; attacker: Unit };
  /** The attacker's blow dropped the victim to ≤ 0 HP. */
  kill: { attacker: Unit; victim: Unit };
  /** A unit is being removed from the grid for death (combat or fire kill). */
  death: { unit: Unit; team: Team };
}

export type TriggerName = keyof TriggerContextMap;

export type TriggerHandler<K extends TriggerName> = (
  ctx: TriggerContextMap[K],
  world: World,
) => void;

/**
 * K1 — a generic trigger dispatcher, parameterised by a context map `M` and an
 * owner `O`. Shared by `World` (combat triggers, owner = World) and `Run`
 * (lifecycle triggers, owner = Run). Handlers fire in registration order; an
 * empty trigger costs a single Map lookup, so the no-handler path is free.
 * Handlers are not snapshotted — the owner re-registers on a fresh/rehydrated
 * instance (like the behaviour/ability registries).
 */
export class TriggerDispatcher<M, O> {
  private readonly handlers = new Map<keyof M, Array<(ctx: M[keyof M], owner: O) => void>>();

  register<K extends keyof M>(name: K, handler: (ctx: M[K], owner: O) => void): void {
    const list = this.handlers.get(name);
    // Stored type-erased (the Map can't express the per-key handler type); the
    // method signature keeps registration type-safe and `fire` only ever hands
    // a handler its matching context.
    if (list) list.push(handler as (ctx: M[keyof M], owner: O) => void);
    else this.handlers.set(name, [handler as (ctx: M[keyof M], owner: O) => void]);
  }

  fire<K extends keyof M>(name: K, ctx: M[K], owner: O): void {
    const list = this.handlers.get(name);
    if (list === undefined || list.length === 0) return;
    for (const handler of list) (handler as (ctx: M[K], owner: O) => void)(ctx, owner);
  }
}
