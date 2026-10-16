/**
 * The propose step: an `AbilityDef` and its caster become an `EffectAction` and
 * its `ActionProposal`, or null when the ability abstains. It resolves the
 * target, applies the range, line-of-sight and minimum-range gates, and captures
 * the cast-time scalars.
 *
 * The scalars (the base damage, the crit chance, a heal's amount, a status's
 * magnitude and duration, a summon's level) are captured here off the caster's
 * stats as they are now, and carried on the `OpResolution` to impact, so a
 * charged spell lands with its cast-time stats, not its impact-time ones. The
 * op's structural params (`evadable`, `accuracy`, the move mode) are read off
 * the def when it fires.
 */

import type { Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import { currentTarget, lowestWoundedAlly } from '../Targeting';
import { resolveAreaVictims } from './targeting';
import { collectLosBlockers, firingBandCell } from '../positioning';
import { unitDistance } from '../occupancy';
import { leapLanding } from '../movement';
import type { GridCoord } from '../../core/types';
import type { AbilityDef, EffectOp, SummonOp } from './schema';
import { EffectAction } from './EffectAction';
import type { OpResolution } from './interpreter';
import { evalScaled, resolveDamageScalars, resolveHealAmount } from './resolveScalars';
import { resolveCadenceTicks, resolvePhases } from './timeline';

/**
 * `def`'s proposal for `unit` this tick, or null when it abstains (no target,
 * out of range, no line of sight). Dispatches on the target selector.
 */
export function proposeEffectAbility(
  def: AbilityDef,
  unit: Unit,
  world: World,
): ActionProposal | null {
  // An aura with no ops never proposes: `World.applyAuraStatuses` runs it
  // outside the ability pipeline, so the carrier stays free to move or strike
  // on the same tick. Without this, an op-less `self` def would fall into
  // `proposeSelfMove` and spend the action on a leap that does nothing. A def
  // with ops and an aura proposes normally; the aura still radiates.
  if (def.aura && def.effects.length === 0) return null;
  switch (def.target.kind) {
    case 'enemyInRange':
      return proposeSingleTargetAttack(def, unit, world);
    case 'lowestHpAlly':
      return proposeHeal(def, def.target.rangeCells, unit, world);
    case 'self':
      return proposeSelfAbility(def, unit, world);
    case 'aoe':
      return proposeAreaBlast(def, unit, world);
  }
}

/**
 * A single-target strike (the `enemyInRange` selector): the `currentTarget`
 * pick, the `[minRange, range]` band and line-of-sight gate, and the cast-time
 * capture.
 */
function proposeSingleTargetAttack(
  def: AbilityDef,
  unit: Unit,
  world: World,
): ActionProposal | null {
  const target = currentTarget(unit, world);
  if (target === null) return null;

  // The band and line-of-sight gate (`firingBandCell`): in band of, and with a
  // clear line to, any of the target's body cells; an ability that
  // `ignoresLineOfSight` passes no blockers and is gated on the band alone. The
  // positioning protocol's hold (`positioning.ts`) runs the same predicate, and
  // changing one without the other brings back a freeze: the hold says in band
  // while the strike says out of range.
  const aim = firingBandCell(
    unit.position,
    target,
    target.position,
    def.minRangeCells,
    def.rangeCells,
    def.ignoresLineOfSight ? null : collectLosBlockers(world),
  );
  if (aim === undefined) return null;

  const speed = unit.effectiveStats.speed;
  // `retreatAnchor` is the struck cell, for a `move` op in `retreat` mode; the
  // other ops ignore it. `resolveOp` copies it.
  const ops = def.effects.map((e) => resolveOp(e.op, { unit, retreatAnchor: target.position }));

  // A shot that fizzles when its target is gone captures the cast cell: the
  // interpreter's fizzle branch and `phaseTarget` draw the dud there if the
  // locked target dies in flight. Other strikes carry no cell.
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
 * A heal (the `lowestHpAlly` selector): `lowestWoundedAlly`'s pick within
 * `rangeCells`, the caster included, with the heal amount captured at cast.
 * There is no line-of-sight gate; a heal is not a shot.
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
  const ops = def.effects.map((e) => resolveOp(e.op, { unit }));

  return {
    action: new EffectAction(def, { targetId: target.id, targetCell: undefined, ops }),
    score: def.priority,
    cooldown: resolveCadenceTicks(def, speed),
    phases: resolvePhases(def, speed),
    cooldownKey: def.id,
  };
}

/**
 * A leap (a `self` def whose op is a `move` in `advance` mode, the dash). An
 * enemy is resolved only to compute the landing, since the effect moves the
 * caster; the def abstains when the enemy is already within strike reach, and
 * captures `leapLanding`'s cell for the op. The leap's reach is the def's
 * `rangeCells`.
 */
function proposeSelfMove(def: AbilityDef, unit: Unit, world: World): ActionProposal | null {
  const target = currentTarget(unit, world);
  if (target === null) return null;
  // Within strike reach: abstain, so the strike proposes instead. The distance
  // is to the target's body, so standing beside a large rubble counts as in
  // reach.
  if (unitDistance(unit, target) <= unit.derived.attackRange) return null;

  const landing = leapLanding(
    unit,
    world,
    { goals: [target.position], approachToward: target.position },
    def.rangeCells,
  );
  if (landing === null) return null;

  const speed = unit.effectiveStats.speed;
  // No target unit: the enemy only placed the landing, so `targetId` is -1 and
  // `phaseTarget` surfaces nothing.
  const ops = def.effects.map((e) =>
    resolveOp(e.op, { unit, advanceLanding: landing }),
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
 * A `self` def proposes by its op: a `summon` op places minions around an
 * anchor, and anything else is a leap. Both act on the caster or its
 * surroundings rather than an enemy, which is why they share the selector.
 */
function proposeSelfAbility(def: AbilityDef, unit: Unit, world: World): ActionProposal | null {
  const summon = def.effects.find((e) => e.op.kind === 'summon');
  if (summon && summon.op.kind === 'summon') return proposeSummon(def, summon.op, unit, world);
  return proposeSelfMove(def, unit, world);
}

/**
 * A summon (a `self` def whose op is `summon`). Gated only on the caster's
 * `maxLive` cap: at the cap it abstains, so the unit does something else, and it
 * proposes again once a minion dies. No enemy or range gate. An anchor other
 * than `self` captures the committed target's cell, so the interpreter can
 * resolve the anchor when it fires; `at: self` captures nothing (`targetId`
 * −1).
 */
function proposeSummon(
  def: AbilityDef,
  op: SummonOp,
  unit: Unit,
  world: World,
): ActionProposal | null {
  if (world.liveSummonCount(unit.id) >= op.summon.maxLive) return null; // at the cap

  let targetId = -1;
  let targetCell: GridCoord | undefined;
  if (op.at.kind !== 'self') {
    // The anchor is the committed target; abstain without one.
    const anchor = currentTarget(unit, world);
    if (anchor === null) return null;
    targetId = anchor.id;
    targetCell = { ...anchor.position };
  }

  const speed = unit.effectiveStats.speed;
  const ops = def.effects.map((e) => resolveOp(e.op, { unit }));
  return {
    action: new EffectAction(def, { targetId, targetCell, ops }),
    score: def.priority,
    cooldown: resolveCadenceTicks(def, speed),
    phases: resolvePhases(def, speed),
    cooldownKey: def.id,
  };
}

/**
 * An area blast aimed at a cell (an `aoe` selector anchored on the target):
 * the `currentTarget` pick, the band gate and a line-of-sight gate, with the
 * aimed cell captured as the blast's centre. `targetId` is −1, since the blast
 * hits whoever stands in its cells at impact rather than a locked unit, so
 * `phaseTarget` surfaces only the cell. The interpreter's area branch of
 * `executeDamage` does the rest.
 */
function proposeAreaBlast(def: AbilityDef, unit: Unit, world: World): ActionProposal | null {
  // Anchored on the caster: no aim, no target, no line of sight.
  if (def.target.kind === 'aoe' && def.target.anchor === 'caster') {
    return proposeCasterAnchoredBlast(def, def.target, unit, world);
  }

  const target = currentTarget(unit, world);
  if (target === null) return null;

  // The strike's band and line-of-sight gate, which the hold shares as well.
  // The blast's centre is the cell the gate passed on: `target.position` for a
  // 1×1 target, and against a larger body a cell the caster can reach, which
  // the area's multiplier still reads as a direct hit.
  const aim = firingBandCell(
    unit.position,
    target,
    target.position,
    def.minRangeCells,
    def.rangeCells,
    collectLosBlockers(world),
  );
  if (aim === undefined) return null;

  const speed = unit.effectiveStats.speed;
  // No target unit: a blast is dodged by leaving its cells. The centre is
  // captured at cast.
  const ops = def.effects.map((e) => resolveOp(e.op, { unit }));

  return {
    action: new EffectAction(def, { targetId: -1, targetCell: { ...aim }, ops }),
    score: def.priority,
    cooldown: resolveCadenceTicks(def, speed),
    phases: resolvePhases(def, speed),
    cooldownKey: def.id,
  };
}

/**
 * A blast anchored on the caster (an `aoe` selector with `anchor: 'caster'`).
 * No target, no band and no line of sight; the one gate is whether the blast
 * would touch anyone now, judged by the `resolveAreaVictims` the interpreter
 * runs when it fires, so the two cannot disagree. An `affects: 'allies'` or
 * `'all'` blast always finds the caster, whose footprint covers the centre, so
 * it fires on every cooldown. Nothing is captured as the centre: the
 * interpreter's `aoeCenter` reads the caster's live cell when it fires, so a
 * shove during the wind-up moves the blast with the body. `targetId` −1, and
 * `phaseTarget` surfaces nothing.
 */
function proposeCasterAnchoredBlast(
  def: AbilityDef,
  sel: Extract<AbilityDef['target'], { kind: 'aoe' }>,
  unit: Unit,
  world: World,
): ActionProposal | null {
  const victims = resolveAreaVictims(world, unit, unit.position, {
    shape: sel.shape,
    radius: sel.radius,
    ringMultiplier: sel.ringMultiplier,
    affects: sel.affects,
  });
  if (victims.length === 0) return null;

  const speed = unit.effectiveStats.speed;
  const ops = def.effects.map((e) => resolveOp(e.op, { unit }));
  return {
    action: new EffectAction(def, { targetId: -1, targetCell: undefined, ops }),
    score: def.priority,
    cooldown: resolveCadenceTicks(def, speed),
    phases: resolvePhases(def, speed),
    cooldownKey: def.id,
  };
}

/** The cast-time inputs an op may need, from the propose function. */
interface OpResolveContext {
  unit: Unit;
  /** A `retreat` move's anchor: the struck target's cell at cast, which the
   *  caster steps away from. */
  retreatAnchor?: GridCoord;
  /** An `advance` move's landing cell. */
  advanceLanding?: GridCoord;
}

/** One op's cast-time scalars, carried unchanged to impact. */
function resolveOp(op: EffectOp, c: OpResolveContext): OpResolution {
  switch (op.kind) {
    case 'damage': {
      // The kernel the editors' previews share (`resolveScalars.ts`).
      const { baseDamage, critChance } = resolveDamageScalars(op, c.unit.effectiveStats);
      return { baseDamage, critChance };
    }
    case 'heal': {
      // The shared kernel too; a heal never rolls to hit or to crit.
      const healAmount = resolveHealAmount(op, c.unit.effectiveStats);
      return { healAmount };
    }
    case 'move': {
      // `retreat`: the struck cell, which the interpreter steps away from
      // (`retreatCell`). `advance`: the leap's landing, where it puts the caster.
      if (op.mode === 'retreat') {
        return c.retreatAnchor ? { moveDest: { ...c.retreatAnchor } } : {};
      }
      return c.advanceLanding ? { moveDest: { ...c.advanceLanding } } : {};
    }
    case 'applyStatus': {
      // The magnitude and duration, scaled or not, frozen off the caster's stats
      // now. A field the def leaves out is left off the resolution
      // (`exactOptionalPropertyTypes`), so the interpreter's default (a
      // magnitude of 1, the def's duration) governs. The `statusId` is read
      // when it fires; only the scalars freeze here.
      const res: OpResolution = {};
      const magnitude = evalScaled(op.magnitude, c.unit);
      if (magnitude !== undefined) res.statusMagnitude = magnitude;
      const durationSeconds = evalScaled(op.durationSeconds, c.unit);
      if (durationSeconds !== undefined) res.statusDurationSeconds = durationSeconds;
      return res;
    }
    case 'chain':
      // Each inner op's scalars, index for index with `op.ops`, through this same
      // function, so a chained `damage` captures as a top-level one does; the
      // interpreter applies `falloff` per hop when it fires. An inner op is a
      // `damage` or an `applyStatus`, never a chain, so this recursion is one
      // level deep.
      return { chainOps: op.ops.map((inner) => resolveOp(inner, c)) };
    case 'summon': {
      // The minions' level, frozen now and rounded to a whole level of at least
      // 1, since `scaledUnit` needs one. The count, the cap and the radius are
      // read off the op when it fires, as `applyStatus`'s `statusId` is.
      const level = evalScaled(op.summon.level, c.unit) ?? 1;
      return { summonLevel: Math.max(1, Math.round(level)) };
    }
  }
}
