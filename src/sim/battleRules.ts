/**
 * The daemons' battle rules, compiled into the World as data. A
 * `BattleRule` is plain JSON: the run compiles it from an owned daemon's
 * battle-trigger hooks (`battleRulesFor`, `src/run/daemon.ts`), it rides the
 * `BattleEncounter` into every setup path, it is serialized in the
 * snapshot, and `World.fromJSON` registers its handlers again from the data.
 * Sim data, not a bus subscription, so the sim stays pure and the fuzz
 * oracle holds.
 *
 * How a rule fires, each a signed call:
 *
 * - Only for the player's acting units. A daemon is the player's relic: an
 *   enemy's blow earns no bits, an enemy's crit emboldens no one.
 * - `applyStatus` lands on the acting unit (the striker, the killer) unless
 *   `applyTo: 'target'` puts it on the struck unit (venom's "your hits
 *   apply poison"), which is legal on `dealHit` alone, since a `kill`'s
 *   victim is dead (the config's matrices refuse it). The filters read the
 *   acting unit either way.
 * - The filters gate before the chance, so a firing that doesn't match
 *   costs no draw.
 * - A chance draws on `world.combatRng`, and only when `0 < chance < 1`, so
 *   a chance-gated rule shifts the combat rolls after it. No shipped battle
 *   rule has a chance.
 * - `gainBits` adds to the World's tally and never touches the Run
 *   mid-battle. The tally settles at `battle:ended` through `Run.gainBits`,
 *   where the `bitsGain` fold applies, so Laverna stacks with Moneta with no
 *   coupling.
 *
 * `dealHit` fires once for each landed blow, in `World.applyDamage` after
 * the hit resolves, with the crit flag; `kill` fires when the blow was
 * lethal. Both carry the attacker, the acting unit every filter reads.
 */

import type { TriggerContextMap } from './triggers';
import type { World } from './World';
import { statusDef, STATUS_DEFS } from '../config/statuses';

/** The battle triggers, mirroring `BATTLE_TRIGGER_KEYS` in
 *  `config/daemons.ts`; kept here, so the World's serialized vocabulary
 *  doesn't import the daemons' config. */
export type BattleRuleTrigger = 'dealHit' | 'kill';

/** The filters a battle rule may carry: `crit` on `dealHit` alone (the
 *  parse refuses it on `kill`), and `archetype`, the acting unit's. */
interface BattleRuleFilter {
  archetype?: string;
  crit?: boolean;
}

/** The effects a battle rule may carry: `gainBits`, into the tally, and
 *  `applyStatus`, its def found by id as it fires; `applyTo` absent is
 *  `'actor'`, and `'target'` is legal on `dealHit` alone. */
type BattleRuleEffect =
  | { op: 'gainBits'; amount: number }
  | {
      op: 'applyStatus';
      statusId: string;
      magnitude?: number;
      durationSeconds?: number;
      applyTo?: 'actor' | 'target';
    };

/** One compiled battle rule, plain JSON, serialized as it is. */
export interface BattleRule {
  on: BattleRuleTrigger;
  chance?: number;
  filter?: BattleRuleFilter;
  effect: BattleRuleEffect;
}

/**
 * Checks every `applyStatus` id when the rules are installed, so a bad one
 * throws at setup, never mid-tick. The daemon catalog is checked at boot
 * (`assertDaemonStatusRefs`); this covers rules built in memory too.
 */
export function assertBattleRuleStatusRefs(rules: readonly BattleRule[]): void {
  for (const rule of rules) {
    if (rule.effect.op === 'applyStatus' && !(rule.effect.statusId in STATUS_DEFS)) {
      throw new Error(
        `battleRules: applyStatus references unknown status id '${rule.effect.statusId}'`,
      );
    }
  }
}

/** Whether a firing's chance is granted: absent is 1, and 0 or 1 draws
 *  nothing, as on the daemons' stream. */
function granted(chance: number | undefined, world: World): boolean {
  const c = chance ?? 1;
  if (c >= 1) return true;
  if (c <= 0) return false;
  return world.combatRng.next() < c;
}

/** Runs a granted rule's effect. `recipient` is where an `applyStatus` lands
 *  (the actor, or the struck unit under `applyTo: 'target'`); the status's
 *  source is the actor either way. */
function execute(
  world: World,
  actor: TriggerContextMap['dealHit']['attacker'],
  recipient: TriggerContextMap['dealHit']['attacker'],
  effect: BattleRuleEffect,
): void {
  if (effect.op === 'gainBits') {
    world.tallyBits(effect.amount);
  } else {
    // The def is found as it fires (gotcha #114). The check at install
    // guarantees the id, so the throwing `statusDef` never throws mid-tick.
    world.applyStatusEffect(
      recipient,
      statusDef(effect.statusId),
      actor.id,
      effect.magnitude ?? 1,
      effect.durationSeconds,
    );
  }
}

/**
 * Registers the handlers for the World's installed rules, once a battle,
 * from `World.installBattleRules` (on a new World and on `fromJSON`). The
 * rules of one trigger fire in installed order: the daemons' ownership
 * order, then each daemon's authored order, as the run's hooks fire.
 */
export function registerBattleRules(world: World, rules: readonly BattleRule[]): void {
  for (const rule of rules) {
    if (rule.on === 'dealHit') {
      world.registerTrigger('dealHit', ({ attacker, target, crit }) => {
        if (attacker.team !== 'player') return;
        if (rule.filter?.archetype !== undefined && attacker.archetype !== rule.filter.archetype) return;
        if (rule.filter?.crit !== undefined && crit !== rule.filter.crit) return;
        if (!granted(rule.chance, world)) return;
        // `gainBits` ignores `applyTo`.
        const recipient =
          rule.effect.op === 'applyStatus' && rule.effect.applyTo === 'target' ? target : attacker;
        // A lethal blow fires `dealHit` too, before `kill`: a status on the
        // corpse would vanish with the removal and emit a phantom
        // `status:applied`, so it is skipped. After the chance draw, so the
        // draw count never depends on HP (the filters-first rule covers the
        // authored filters only).
        if (recipient.currentHp <= 0) return;
        execute(world, attacker, recipient, rule.effect);
      });
    } else {
      world.registerTrigger('kill', ({ attacker }) => {
        if (attacker.team !== 'player') return;
        if (rule.filter?.archetype !== undefined && attacker.archetype !== rule.filter.archetype) return;
        // The parse refuses `crit` and `applyTo: 'target'` on `kill` (the
        // victim is dead), so there is no crit gate and the recipient is the
        // actor.
        if (!granted(rule.chance, world)) return;
        execute(world, attacker, attacker, rule.effect);
      });
    }
  }
}
