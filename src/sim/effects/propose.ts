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

import type { Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import { currentTarget, lowestWoundedAlly } from '../Targeting';
import {
  collectLosBlockers,
  collectHalfCoverPositions,
  firingBandCell,
} from '../positioning';
import { hasLineOfSight } from '../LineOfSight';
import { unitDistance } from '../occupancy';
import { leapLanding } from '../movement';
import { LEVELING } from '../../config/leveling';
import type { GridCoord } from '../../core/types';
import type { AbilityDef, EffectOp, SummonOp } from './schema';
import { EffectAction } from './EffectAction';
import type { OpResolution } from './interpreter';
import { evalScaled, resolveDamageScalars, resolveHealAmount } from './resolveScalars';
import { resolveCadenceTicks, resolvePhases } from './timeline';

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
      return proposeSelfAbility(def, unit, world);
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

  // 44-pre-c — the band + LOS gate is the shared footprint-aware predicate
  // (`firingBandCell`): in band of (and, for LOS-gated shots, with a clear line
  // to) ANY of the target's body cells — 1×1 targets take the old corner test
  // exactly. The LOS skip stays E7.D's (the catapult lobs OVER walls → null
  // blockers, band-only). `MovementBehavior.inFiringBand` routes through the
  // SAME predicate — moving one without the other re-creates the GP4/Qb#3
  // freeze class (hold says in-band, strike says out-of-range → deadlock).
  const aim = firingBandCell(
    unit.position,
    target,
    target.position,
    def.minRangeCells,
    def.rangeCells,
    def.ignoresLineOfSight ? null : collectLosBlockers(world),
  );
  if (aim === undefined) return null;

  // E4 half-cover: a neutral non-LOS-blocker on the Bresenham line halves the
  // damage (the same invert-the-LOS-check trick `proposeBasicStrike` uses). A
  // `fizzle` artillery shot ignores the multiplier in the interpreter, so it's
  // inert there — harmless to compute (and 0 in the open field anyway).
  // 44-pre-c — measured to the AIM cell (the gate's body cell), which for a 1×1
  // target is exactly `target.position`.
  const halfCovers = collectHalfCoverPositions(world);
  const behindCover =
    halfCovers.length > 0 && !hasLineOfSight(unit.position, aim, halfCovers);
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
  // 44-pre-c — footprint distance: body-adjacent to a big rubble reads as "in
  // reach" (corner-only, the rogue leapt around the body it could already hit).
  if (unitDistance(unit, target) <= unit.derived.attackRange) return null;

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
 * A `self`-target ability splits two ways by its op: a `summon` op (the Shaman —
 * caster-anchored minion placement) vs a caster-reposition `move` (the rogue dash).
 * Both target `self` (they subject the caster / its surroundings, not an enemy), so
 * they share the propose dispatch but diverge in their gate + capture.
 */
function proposeSelfAbility(def: AbilityDef, unit: Unit, world: World): ActionProposal | null {
  const summon = def.effects.find((e) => e.op.kind === 'summon');
  if (summon && summon.op.kind === 'summon') return proposeSummon(def, summon.op, unit, world);
  return proposeSelfMove(def, unit, world);
}

/**
 * The summoner's cast (the Shaman — a `self`-target ability whose op is `summon`).
 * Gated ONLY on the per-caster `maxLive` cap: abstain at the ceiling so the unit
 * does something else (move) and re-proposes the instant a minion dies. No enemy /
 * range gate — a summoner raises its pack whenever it has room (the placement is
 * caster-anchored, so it needn't be near a foe). For a non-`self` `at` anchor (a
 * flank / area summon) the committed target's cell is captured so the interpreter
 * can resolve the anchor at fire; `at:self` needs no capture (`targetId -1`).
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
    // A flank / area summon anchors on the committed target; abstain with none.
    const anchor = currentTarget(unit, world);
    if (anchor === null) return null;
    targetId = anchor.id;
    targetCell = { ...anchor.position };
  }

  const speed = unit.effectiveStats.speed;
  const ops = def.effects.map((e) => resolveOp(e.op, { unit, damageMultiplier: 1 }));
  return {
    action: new EffectAction(def, { targetId, targetCell, ops }),
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

  // 44-pre-c — the same shared footprint band + LOS gate as the single-target
  // strike (this gate was in the corner-only class too, though the audit's site
  // list missed it — a hold/blast disagreement is the same freeze). The blast
  // CENTRE becomes the aim cell: the in-range, visible body cell the gate
  // passed on — for a 1×1 target that is exactly `target.position`, and against
  // a multi-tile body the detonation lands where the caster can actually reach
  // (44-pre-b's best-covered-cell mult reads it as a direct hit either way).
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
  // No single-target unit + no half-cover: an area detonation is dodged by
  // leaving the blast, not by a per-cell roll (the interpreter's aoe branch
  // ignores `damageMultiplier`). The blast centre is captured at cast time.
  const ops = def.effects.map((e) => resolveOp(e.op, { unit, damageMultiplier: 1 }));

  return {
    action: new EffectAction(def, { targetId: -1, targetCell: { ...aim }, ops }),
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
      // §30c — the cast-time damage scalars (`might + scalingStat`, the crit
      // probability) come from the shared `resolveScalars` kernel the attack
      // editor's preview also consumes; only the half-cover multiplier is
      // context (single-target LOS).
      const { baseDamage, critChance } = resolveDamageScalars(op, c.unit.effectiveStats);
      return { baseDamage, critChance, damageMultiplier: c.damageMultiplier };
    }
    case 'heal': {
      // I6 — heal amount is `might + magic` (mirrors `healAmountFor`); via the
      // shared kernel. `none` scaling = flat `might`; never rolls to-hit or crit.
      const healAmount = resolveHealAmount(op, c.unit.effectiveStats);
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
    case 'applyStatus': {
      // §31 — capture the (optionally scaled) magnitude + duration NOW, off the
      // caster's stats (frozen), the same cast-time-capture contract `damage`
      // holds. A bare number passes straight through `evalScaled`; an unauthored
      // field stays undefined → the KEY is OMITTED (exactOptionalPropertyTypes),
      // so the interpreter's `?? 1` / def-duration default governs. (The
      // `statusId` is still read live at fire — the registry owns the op/behavior;
      // only the SCALARS freeze here.)
      const res: OpResolution = {};
      const magnitude = evalScaled(op.magnitude, c.unit);
      if (magnitude !== undefined) res.statusMagnitude = magnitude;
      const durationSeconds = evalScaled(op.durationSeconds, c.unit);
      if (durationSeconds !== undefined) res.statusDurationSeconds = durationSeconds;
      return res;
    }
    case 'chain':
      // 29c — capture each inner op's cast-time scalars NOW (off the caster's
      // current stats), aligned with `op.ops`; the interpreter scales the damage
      // by `falloff` per hop at fire time. Recurses through the same `resolveOp`,
      // so a chained `damage` captures `baseDamage`/`critChance` exactly as a
      // top-level one would (cast-time-stat capture, the charged-spell contract).
      // The inner ops can't themselves be chains (ChainInnerOp = damage |
      // applyStatus), so this recursion is one level deep.
      return { chainOps: op.ops.map((inner) => resolveOp(inner, c)) };
    case 'summon': {
      // §31c — capture the minion level NOW (frozen), int-rounded ≥1 since
      // `scaledUnit` needs an int. A bare number passes through `evalScaled`
      // unchanged (byte-identical); a `ScaledValue` scales off the summoner at cast.
      // ⚠️ §33 OP caveat: scaling off the caster's overall `level` can be strong — a
      // one-line `perPoint`/`stat` dial-back. (count / cap / radius stay live on the
      // op — registry-of-truth, like `applyStatus`'s `statusId`.)
      const level = evalScaled(op.summon.level, c.unit) ?? 1;
      return { summonLevel: Math.max(1, Math.round(level)) };
    }
  }
}
