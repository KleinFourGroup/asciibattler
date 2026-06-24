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
import {
  collectLosBlockers,
  collectHalfCoverPositions,
  currentTarget,
  lowestWoundedAlly,
} from '../Targeting';
import { hasLineOfSight } from '../LineOfSight';
import { leapLanding } from '../movement';
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
    case 'lowestHpAlly':
      return proposeHeal(def, def.target.rangeCells, unit, world);
    case 'self':
      return proposeSelfMove(def, unit, world);
    case 'aoe':
      return proposeAreaBlast(def, unit, world);
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

  // LOS gate — skipped for an arcing shot that lobs OVER walls (the catapult,
  // `ignoresLineOfSight`; `catapult.ts` has no `hasLineOfSight` check).
  // `MovementBehavior`'s in-range abstain reads the same flag off the ability, so
  // the gate and the movement stay consistent.
  if (!def.ignoresLineOfSight) {
    const blockers = collectLosBlockers(world);
    if (blockers.length > 0 && !hasLineOfSight(unit.position, target.position, blockers)) {
      return null;
    }
  }

  // E4 half-cover: a neutral non-LOS-blocker on the Bresenham line halves the
  // damage (the same invert-the-LOS-check trick `proposeBasicStrike` uses). A
  // `fizzle` artillery shot ignores the multiplier in the interpreter, so it's
  // inert there — harmless to compute (and 0 in the open field anyway).
  const halfCovers = collectHalfCoverPositions(world);
  const behindCover =
    halfCovers.length > 0 && !hasLineOfSight(unit.position, target.position, halfCovers);
  const damageMultiplier = behindCover ? LEVELING.halfCoverDamageMult : 1;

  const speed = unit.effectiveStats.speed;
  // `retreatAnchor` = the struck cell, for a gambit's `move`-retreat op (the
  // strike effects ignore it). A copy is taken inside `resolveOp`.
  const ops = def.effects.map((e) =>
    resolveOp(e.op, { unit, damageMultiplier, retreatAnchor: target.position }),
  );

  // Fizzle (the catapult): capture the cast cell as the dud-VFX impact fallback
  // (mirrors `CatapultShotAction.castPosition`) — the interpreter's fizzle branch
  // + the homing `phaseTarget` read it when the locked target died mid-flight. The
  // commit-at-cast strikes carry no cell.
  const targetCell = def.orphanPolicy === 'fizzle' ? { ...target.position } : undefined;

  return {
    action: new EffectAction(def, { targetId: target.id, targetCell, ops }),
    score: def.priority,
    cooldown: resolveCadenceTicks(def, speed),
    phases: resolvePhases(def, speed),
    cooldownKey: def.id,
  };
}

/**
 * The healer's pick (the `lowestHpAlly` selector). A line-for-line port of
 * `HealAlly.propose`: the lowest-HP wounded ally within `rangeCells` (self
 * included), the heal amount captured at cast, and the strike-shaped proposal
 * (score, speed-scaled cadence). No LOS / half-cover gate — a heal isn't a shot.
 */
function proposeHeal(
  def: AbilityDef,
  rangeCells: number,
  unit: Unit,
  world: World,
): ActionProposal | null {
  const target = lowestWoundedAlly(unit, world, rangeCells);
  if (target === null) return null;

  const speed = unit.effectiveStats.speed;
  // A heal has no half-cover multiplier; pass 1 (the heal op ignores it anyway).
  const ops = def.effects.map((e) => resolveOp(e.op, { unit, damageMultiplier: 1 }));

  return {
    action: new EffectAction(def, { targetId: target.id, targetCell: undefined, ops }),
    score: def.priority,
    cooldown: resolveCadenceTicks(def, speed),
    phases: resolvePhases(def, speed),
    cooldownKey: def.id,
  };
}

/**
 * A pure caster-reposition (the `self` selector — the rogue dash). A line-for-line
 * port of `DashAbility.propose`: resolve an enemy to leap at (only to compute the
 * landing — the EFFECT subjects the caster), abstain when already in strike reach,
 * and capture the `leapLanding` into the `advance` op. The leap distance is the
 * def's `rangeCells` (the movement-ability range); cadence is the FLAT cooldown
 * (`speedScaled:false`), decoupled from the short motion window.
 */
function proposeSelfMove(def: AbilityDef, unit: Unit, world: World): ActionProposal | null {
  const target = currentTarget(unit, world);
  if (target === null) return null;
  // Already within strike reach → abstain so the strike (higher score) preempts.
  if (chebyshev(unit.position, target.position) <= unit.derived.attackRange) return null;

  const landing = leapLanding(unit, world, {
    goals: [target.position],
    approachToward: target.position,
    maxCells: def.rangeCells,
  });
  if (landing === null) return null;

  const speed = unit.effectiveStats.speed;
  // No single-target unit (the leap subjects the caster); the enemy was only a
  // landing reference, so targetId is -1 and phaseTarget surfaces nothing.
  const ops = def.effects.map((e) =>
    resolveOp(e.op, { unit, damageMultiplier: 1, advanceLanding: landing }),
  );

  return {
    action: new EffectAction(def, { targetId: -1, targetCell: undefined, ops }),
    score: def.priority,
    cooldown: resolveCadenceTicks(def, speed),
    phases: resolvePhases(def, speed),
    cooldownKey: def.id,
  };
}

/**
 * The charged, ground-targeted area blast (the `aoe` selector — the mage bolt).
 * A line-for-line port of `MagicBolt.propose`: the same `currentTarget` pick, the
 * same `[minRange, range]` band gate, and the same LOS gate (a bolt can't be
 * lobbed through stone). It captures the target's CURRENT cell as the blast
 * CENTRE (`anchor:targetCell`) and carries it on the action; `targetId` is −1 —
 * the blast subjects whoever stands in the cells at impact, not a locked unit —
 * so `phaseTarget` surfaces only the cell. The interpreter's `executeDamage` aoe
 * branch (one crit roll, the ring multiplier) does the rest; the detonation FX
 * now rides the §Z registry off `action:phase{impact}`, not a sim event.
 */
function proposeAreaBlast(def: AbilityDef, unit: Unit, world: World): ActionProposal | null {
  const target = currentTarget(unit, world);
  if (target === null) return null;

  const dist = chebyshev(unit.position, target.position);
  if (dist > def.rangeCells || dist < def.minRangeCells) return null;

  const blockers = collectLosBlockers(world);
  if (blockers.length > 0 && !hasLineOfSight(unit.position, target.position, blockers)) {
    return null;
  }

  const speed = unit.effectiveStats.speed;
  // No single-target unit + no half-cover: an area detonation is dodged by
  // leaving the blast, not by a per-cell roll (the interpreter's aoe branch
  // ignores `damageMultiplier`). The blast centre is captured at cast time.
  const ops = def.effects.map((e) => resolveOp(e.op, { unit, damageMultiplier: 1 }));

  return {
    action: new EffectAction(def, { targetId: -1, targetCell: { ...target.position }, ops }),
    score: def.priority,
    cooldown: resolveCadenceTicks(def, speed),
    phases: resolvePhases(def, speed),
    cooldownKey: def.id,
  };
}

/** Per-op cast-time inputs an `EffectOp` may need, assembled by the caller. */
interface OpResolveContext {
  unit: Unit;
  /** single-target half-cover damage multiplier (default 1). */
  damageMultiplier: number;
  /** `move` retreat (the gambit): the cell to dart AWAY from (the struck target's
   *  position at cast — `struckFrom`). */
  retreatAnchor?: GridCoord;
  /** `move` advance (the dash): the captured leap landing. */
  advanceLanding?: GridCoord;
}

/**
 * Compute one op's cast-time scalars — the values the legacy actions resolved at
 * propose time and carried inertly to impact.
 */
function resolveOp(op: EffectOp, c: OpResolveContext): OpResolution {
  switch (op.kind) {
    case 'damage': {
      const baseDamage = op.might + scalingStatValue(op.scaling, c.unit.effectiveStats);
      const critChance = op.critable
        ? critChanceFor(op.critBase, c.unit.effectiveStats.luck)
        : 0;
      return { baseDamage, critChance, damageMultiplier: c.damageMultiplier };
    }
    case 'heal': {
      // I6 — heal amount is `might + magic` (mirrors `healAmountFor`). `none`
      // scaling = flat `might`; the heal op never rolls to-hit or crit.
      const healAmount = op.might + scalingStatValue(op.scaling, c.unit.effectiveStats);
      return { healAmount };
    }
    case 'move': {
      // retreat (the gambit dart-back): the anchor is the struck cell, captured
      // at cast (`GambitStrikeAction.struckFrom`); the interpreter steps AWAY
      // from it via `retreatCell`. advance (the dash): the captured leap landing,
      // which the interpreter relocates the caster onto.
      if (op.mode === 'retreat') {
        return c.retreatAnchor ? { moveDest: { ...c.retreatAnchor } } : {};
      }
      if (op.mode === 'advance') {
        return c.advanceLanding ? { moveDest: { ...c.advanceLanding } } : {};
      }
      // knockback / pull are the reserved Cluster-2 seam (never authored here).
      throw new Error(`EffectAbility: move mode '${op.mode}' is reserved`);
    }
    // `applyStatus` is reserved until Phase 29 (status-on-hit).
    default:
      throw new Error(`EffectAbility: op '${op.kind}' not yet resolvable at propose time`);
  }
}
