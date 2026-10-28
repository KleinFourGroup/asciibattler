/**
 * The battle's triggers: fixed dispatch points in the sim where registered
 * handlers may act, most often by applying a status. The handlers come from the
 * battle's rules (`battleRules.ts`), which a daemon grants.
 *
 * The combat triggers fire in `World.applyDamage` after the hit or the miss has
 * resolved and HP has moved, so a handler's stat change lands on the next
 * action, not the one under way. `kill` fires there too, while the attacker is
 * still known; `death` fires in `World.reapUnit`; `spawn` when a unit is placed
 * on the grid.
 *
 * Each trigger is named from its subject's side: `dealHit` is the attacker
 * landing a blow and `takeHit` the target taking it; `dealMiss` and `evade`
 * are the two sides of a dodged strike.
 *
 * The shipped rules handle `dealHit` and `kill`. No shipped code registers on
 * `spawn`, `takeHit`, `dealMiss`, `evade` or `death`: they are fire points
 * kept for the content that will handle them, not dead code to delete.
 * Nothing fires `dealMiss` or `evade` today, since every strike lands.
 * Landing note for the dodge planned as a passive special (Round 13):
 * `World.applyDamage` fires them, `dealMiss` then `evade`, for a dodged
 * strike.
 *
 * Handlers are not snapshotted. A World's come from its battle rules, which
 * the snapshot carries and `World.fromJSON` installs again.
 */

import type { Unit, Team } from './Unit';
import type { World } from './World';

/**
 * The closed set of triggers and their contexts. A new trigger is one entry
 * here; `World.fireTrigger` and `registerTrigger` stay type-safe off the map.
 */
export interface TriggerContextMap {
  /** A unit was placed on the grid, by any path, walls included. */
  spawn: { unit: Unit };
  /** The attacker landed a damage op's hit. */
  dealHit: { attacker: Unit; target: Unit; damage: number; crit: boolean };
  /** The target took a landed hit. */
  takeHit: { target: Unit; attacker: Unit; damage: number; crit: boolean };
  /** The attacker's evadable strike was dodged; no HP moved. Unfired until
   *  there is a dodge. */
  dealMiss: { attacker: Unit; target: Unit };
  /** The target dodged an evadable strike. Unfired until there is a
   *  dodge. */
  evade: { target: Unit; attacker: Unit };
  /** The attacker's hit took the victim to 0 HP or below. */
  kill: { attacker: Unit; victim: Unit };
  /** A dead unit is being reaped (`World.reapUnit`), whatever killed it. */
  death: { unit: Unit; team: Team };
}

export type TriggerName = keyof TriggerContextMap;

export type TriggerHandler<K extends TriggerName> = (
  ctx: TriggerContextMap[K],
  world: World,
) => void;

/**
 * A trigger dispatcher over a context map `M` and an owner `O`, which
 * `World` holds for the combat triggers. Handlers fire in the order they
 * were registered; a trigger with none costs one Map lookup.
 */
export class TriggerDispatcher<M, O> {
  private readonly handlers = new Map<keyof M, Array<(ctx: M[keyof M], owner: O) => void>>();

  register<K extends keyof M>(name: K, handler: (ctx: M[K], owner: O) => void): void {
    const list = this.handlers.get(name);
    // Stored with the type erased, since a Map cannot express the handler type
    // per key; the signature keeps registration type-safe, and `fire` hands a
    // handler only its own context.
    if (list) list.push(handler as (ctx: M[keyof M], owner: O) => void);
    else this.handlers.set(name, [handler as (ctx: M[keyof M], owner: O) => void]);
  }

  fire<K extends keyof M>(name: K, ctx: M[K], owner: O): void {
    const list = this.handlers.get(name);
    if (list === undefined || list.length === 0) return;
    for (const handler of list) (handler as (ctx: M[K], owner: O) => void)(ctx, owner);
  }
}
