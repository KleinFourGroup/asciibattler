/**
 * 47f — battle-domain daemon rules, compiled INTO the World as data (the
 * cluster-3-spec seam crossing: "battle hooks compile into the World at
 * battle setup"). A `BattleRule` is plain JSON — the run layer compiles it
 * from an owned daemon's battle-trigger hooks (`battleRulesFor`,
 * src/run/daemon.ts), it rides `BattleEncounter` into both World
 * construction sites (BattleScene + the fuzz harness), is serialized in the
 * WorldSnapshot (v33), and the World re-registers its handlers from the
 * data on `fromJSON` (the K1 behavior-registry pattern — handlers are never
 * snapshotted). First-class sim data, NOT a bus subscription: sim purity +
 * the fuzz oracle stay intact.
 *
 * Launch evaluation semantics (all deliberate; user-locked at the 47f
 * shape-lock):
 *  - **Player-team acting units only.** A daemon is the player's relic — an
 *    enemy rogue's blow earns no bits, an enemy crit emboldens no one.
 *    (Enemy-scoped daemons are a noted future idea, not launch vocabulary.)
 *  - **`applyStatus` lands on the ACTING unit** (the striker/killer) — the
 *    "any crit → embolden the striker" shape. A target-side axis waits for
 *    content that needs it.
 *  - **Filter gates BEFORE chance** (the 47e `resolveInstantHooks`
 *    discipline): a non-matching firing costs no `combatRng` draw.
 *  - **Chance draws ride `world.combatRng`** (only when `0 < chance < 1` —
 *    the daemon-stream contract, applied to the battle stream). A
 *    chance-gated battle rule therefore shifts subsequent combat rolls —
 *    launch content is chance-less, so the shipped catalog adds no draws.
 *  - **`gainBits` accumulates into the World's serialized tally** — it never
 *    touches the Run mid-battle. The tally settles at `battle:ended` via
 *    `Run.gainBits` (the XP pattern), where the `bitsGain` fold applies —
 *    so Laverna stacks with Moneta with zero coupling.
 *
 * Trigger payload note: `dealHit` fires once per landed blow at the
 * `applyDamage` chokepoint (post-resolution) with the crit flag; `kill`
 * fires when the blow was lethal. Both carry the attacker — the acting
 * unit every launch filter reads.
 */

import type { TriggerContextMap } from './triggers';
import type { World } from './World';
import { statusDef, STATUS_DEFS } from '../config/statuses';

/** The battle-domain trigger keys (mirrors `BATTLE_TRIGGER_KEYS` in
 *  config/daemons.ts — kept sim-local so the World's serialized vocabulary
 *  doesn't import the run-layer config module). */
export type BattleRuleTrigger = 'dealHit' | 'kill';

/** The battle-legal filter axes (parse-time matrix: `crit` only rides
 *  `dealHit`; `archetype` names the ACTING unit's archetype). */
export interface BattleRuleFilter {
  archetype?: string;
  crit?: boolean;
}

/** The battle-legal effect ops: `gainBits` (→ the serialized tally) and
 *  `applyStatus` (→ the acting unit, def-resolved by id at fire time). */
export type BattleRuleEffect =
  | { op: 'gainBits'; amount: number }
  | { op: 'applyStatus'; statusId: string; magnitude?: number; durationSeconds?: number };

/** One compiled battle rule — plain JSON, serialized verbatim (v33). */
export interface BattleRule {
  on: BattleRuleTrigger;
  chance?: number;
  filter?: BattleRuleFilter;
  effect: BattleRuleEffect;
}

/**
 * Validate every `applyStatus` ref up front (install time), so a bad id
 * throws at battle setup — never mid-tick. The daemon catalog is already
 * boot-asserted (`assertDaemonStatusRefs`); this guards the bespoke
 * in-memory path too.
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

/** The per-firing chance condition — the daemon-stream draw contract
 *  (absent = 1, no draw; endpoints deterministic, no draw). */
function granted(chance: number | undefined, world: World): boolean {
  const c = chance ?? 1;
  if (c >= 1) return true;
  if (c <= 0) return false;
  return world.combatRng.next() < c;
}

/** Execute one granted rule's effect for the acting unit. */
function execute(world: World, actor: TriggerContextMap['dealHit']['attacker'], effect: BattleRuleEffect): void {
  if (effect.op === 'gainBits') {
    world.tallyBits(effect.amount);
  } else {
    // Def-resolved at fire time (the gotcha #114 call-time discipline);
    // the install-time assert guarantees the ref resolves, so the throwing
    // `statusDef` lookup can never fire mid-tick.
    world.applyStatusEffect(
      actor,
      statusDef(effect.statusId),
      actor.id,
      effect.magnitude ?? 1,
      effect.durationSeconds,
    );
  }
}

/**
 * Register trigger handlers for the World's installed rules. Called once
 * per battle by `World.installBattleRules` (fresh AND `fromJSON` paths).
 * Rules evaluate in installed order per trigger (= daemon ownership order ×
 * authored rule order, the 47c discipline carried across the seam).
 */
export function registerBattleRules(world: World, rules: readonly BattleRule[]): void {
  for (const rule of rules) {
    if (rule.on === 'dealHit') {
      world.registerTrigger('dealHit', ({ attacker, crit }) => {
        if (attacker.team !== 'player') return;
        if (rule.filter?.archetype !== undefined && attacker.archetype !== rule.filter.archetype) return;
        if (rule.filter?.crit !== undefined && crit !== rule.filter.crit) return;
        if (!granted(rule.chance, world)) return;
        execute(world, attacker, rule.effect);
      });
    } else {
      world.registerTrigger('kill', ({ attacker }) => {
        if (attacker.team !== 'player') return;
        if (rule.filter?.archetype !== undefined && attacker.archetype !== rule.filter.archetype) return;
        // `crit` is parse-illegal on `kill` (the 47b matrix) — no crit gate here.
        if (!granted(rule.chance, world)) return;
        execute(world, attacker, rule.effect);
      });
    }
  }
}
