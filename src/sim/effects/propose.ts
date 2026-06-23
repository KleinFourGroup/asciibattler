/**
 * Phase Y3 — the propose-time bridge: turn an `AbilityDef` + a casting unit into
 * an `EffectAction` + `ActionProposal`. This is the data-driven replacement for
 * each legacy ability's hand-coded `propose()` (`proposeBasicStrike`, the
 * healer's pick, the dash gate, …), reproducing the target resolution, the
 * range / LOS / minRange gates, and — critically — the CAST-TIME stat capture so
 * the Y3/Y4 determinism oracle reads byte-identical.
 *
 * Why cast-time capture matters: the legacy actions resolve `baseDamage` /
 * `critChance` / the half-cover multiplier at PROPOSE time (off the caster's
 * current stats) and carry them inertly to impact. The interpreter consumes the
 * same scalars off the `OpResolution`, so a charged spell's damage uses its
 * cast-time stats, not its impact-time stats — exactly as before. The def
 * supplies the STRUCTURAL params (evadable, accuracy, the move mode), read live.
 *
 * SCOPE grows one verb per Y3/Y4 commit. Today: the `enemyInRange` + `damage`
 * path (the four melee weapons). The other selectors / ops throw a clear
 * not-yet-migrated error until their commit wires them — the strangler keeps the
 * legacy class authoritative for everything still un-migrated.
 */

import type { Unit, UnitStats } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import { collectLosBlockers, collectHalfCoverPositions, currentTarget } from '../Targeting';
import { hasLineOfSight } from '../LineOfSight';
import { critChanceFor } from '../stats';
import { LEVELING } from '../../config/leveling';
import type { GridCoord } from '../../core/types';
import type { AbilityDef, DamageScaling, EffectOp } from './schema';
import { EffectAction } from './EffectAction';
import type { OpResolution } from './interpreter';
import { resolveCadenceTicks, resolvePhases } from './timeline';

/**
 * The caster stat an op's `scaling` names, ADDED to its flat `might`. Mirrors
 * `damageStatFor` for the migrated verbs (sword/club/katana/whip → `strength`),
 * but resolved off the op rather than the archetype — byte-identical because each
 * verb maps to exactly one stat (see `schema.ts`). `none` = flat `might` only.
 */
function scalingStatValue(scaling: DamageScaling, stats: UnitStats): number {
  switch (scaling) {
    case 'strength':
      return stats.strength;
    case 'ranged':
      return stats.ranged;
    case 'magic':
      return stats.magic;
    case 'none':
      return 0;
  }
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Resolve an `AbilityDef` to a proposal for `unit` this tick, or null if it
 * abstains (no target, out of range, LOS broken). Dispatches on the target
 * selector — the propose-time shape that differs per verb family.
 */
export function proposeEffectAbility(
  def: AbilityDef,
  unit: Unit,
  world: World,
): ActionProposal | null {
  switch (def.target.kind) {
    case 'enemyInRange':
      return proposeSingleTargetAttack(def, unit, world);
    // `lowestHpAlly` (heal), `aoe` (magic), `self` (dash) migrate in later
    // Y3/Y4 commits; the legacy class stays authoritative until then.
    default:
      throw new Error(
        `EffectAbility '${def.id}': target selector '${def.target.kind}' not yet migrated`,
      );
  }
}

/**
 * The single-target, LOS-gated strike (the four melee weapons; the bow joins in
 * the next commit). A line-for-line port of `proposeBasicStrike`'s melee path:
 * the same `currentTarget` pick, the same `[minRange, range]` band gate, the
 * same wall-abort + half-cover multiplier, and the cast-time damage/crit capture
 * — only now the scalars ride an `OpResolution` into the interpreter instead of
 * the per-class `AttackAction` fields.
 */
function proposeSingleTargetAttack(
  def: AbilityDef,
  unit: Unit,
  world: World,
): ActionProposal | null {
  const target = currentTarget(unit, world);
  if (target === null) return null;

  const dist = chebyshev(unit.position, target.position);
  if (dist > def.rangeCells || dist < def.minRangeCells) return null;

  const blockers = collectLosBlockers(world);
  if (blockers.length > 0 && !hasLineOfSight(unit.position, target.position, blockers)) {
    return null;
  }

  // E4 half-cover: a neutral non-LOS-blocker on the Bresenham line halves the
  // damage (the same invert-the-LOS-check trick `proposeBasicStrike` uses).
  const halfCovers = collectHalfCoverPositions(world);
  const behindCover =
    halfCovers.length > 0 && !hasLineOfSight(unit.position, target.position, halfCovers);
  const damageMultiplier = behindCover ? LEVELING.halfCoverDamageMult : 1;

  const speed = unit.effectiveStats.speed;
  const ops = def.effects.map((e) => resolveOp(e.op, unit, damageMultiplier));

  return {
    action: new EffectAction(def, { targetId: target.id, targetCell: undefined, ops }),
    score: def.priority,
    cooldown: resolveCadenceTicks(def, speed),
    phases: resolvePhases(def, speed),
    cooldownKey: def.id,
  };
}

/**
 * Compute one op's cast-time scalars. The `damageMultiplier` (half-cover) is a
 * single-target concern threaded in by the caller; an aoe path will pass 1.
 */
function resolveOp(op: EffectOp, unit: Unit, damageMultiplier: number): OpResolution {
  switch (op.kind) {
    case 'damage': {
      const baseDamage = op.might + scalingStatValue(op.scaling, unit.effectiveStats);
      const critChance = op.critable
        ? critChanceFor(op.critBase, unit.effectiveStats.luck)
        : 0;
      return { baseDamage, critChance, damageMultiplier };
    }
    // `heal` / `move` resolutions land with their verbs in later commits.
    default:
      throw new Error(`EffectAbility: op '${op.kind}' not yet resolvable at propose time`);
  }
}
