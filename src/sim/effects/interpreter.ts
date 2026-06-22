/**
 * Phase Y2 — the effect-op interpreter: one `switch` over `op.kind` that executes
 * a resolved op against the world. This is the data-driven replacement for the
 * per-class `start`/`applyEffect` bodies — `damage` → `world.applyDamage`,
 * `heal` → the heal path, `move` → the caster-reposition primitive — reproducing
 * each legacy action's mutations, `combatRng` draw order, and emitted events so
 * the Y3/Y4 determinism oracle reads byte-identical.
 *
 * Cast-time-resolved scalars (baseDamage, critChance, damageMultiplier, the heal
 * amount, the move destination) ride in on the `OpResolution` — captured at
 * propose time (Y3's ability builder), exactly as the legacy actions captured
 * them, so a charged spell's damage uses the caster's CAST-time stats, not its
 * impact-time stats. The def supplies the structural params (evadable, accuracy,
 * the aoe shape/affects/ring, the move mode) — read live, the source of truth.
 *
 * The reserved arms (`applyStatus`, `move` knockback/pull) throw — declared in
 * the closed union, no consumer until §29 / Cluster 2 (the F2 `re-home` pattern).
 */

import type { GridCoord } from '../../core/types';
import type { Unit } from '../Unit';
import type { World } from '../World';
import type { OrphanPolicy } from '../Action';
import { STATS } from '../../config/stats';
import type { EffectOp, TargetSelector } from './schema';
import { resolveAreaVictims } from './targeting';
import { retreatCell } from './reposition';

/** Cast-time-resolved values for one op, captured at propose time. */
export interface OpResolution {
  /** damage: `might + scalingStat(caster)` at cast. */
  baseDamage?: number;
  /** damage: `critable ? critChanceFor(critBase, luck) : 0` at cast. */
  critChance?: number;
  /** damage (single-target): the half-cover LOS multiplier (default 1). */
  damageMultiplier?: number;
  /** heal: `might + magic` at cast. */
  healAmount?: number;
  /** move: the `advance` landing cell, or the `retreat` anchor (struckFrom). */
  moveDest?: GridCoord;
}

/** Everything the interpreter needs to fire one op, assembled by `EffectAction`. */
export interface OpFireContext {
  caster: Unit;
  world: World;
  orphanPolicy: OrphanPolicy;
  selector: TargetSelector;
  /** The live single-target unit (re-resolved via `findUnit`), if any. */
  target: Unit | undefined;
  /** The captured cell: the aoe center, or the fizzle VFX fallback. */
  targetCell: GridCoord | undefined;
  resolution: OpResolution;
  /** Ticks of the phase this op fires on (the `advance` move's motion window). */
  phaseTicks: number;
  /** finishTick − currentTick (the `retreat` move's lerp window). */
  remainingTicks: number;
}

export function executeOp(op: EffectOp, ctx: OpFireContext): void {
  switch (op.kind) {
    case 'damage':
      executeDamage(op, ctx);
      return;
    case 'heal':
      executeHeal(op, ctx);
      return;
    case 'move':
      executeMove(op, ctx);
      return;
    case 'applyStatus':
      throw new Error(
        "effect op 'applyStatus' is reserved — not built until Phase 29 (status-on-hit)",
      );
    default: {
      const _exhaustive: never = op;
      throw new Error(`unknown effect op: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function executeDamage(
  op: Extract<EffectOp, { kind: 'damage' }>,
  ctx: OpFireContext,
): void {
  const { world, caster } = ctx;
  const baseDamage = ctx.resolution.baseDamage ?? 0;
  const critChance = ctx.resolution.critChance ?? 0;

  // --- AoE ground-target (MagicBolt): resolve victims at fire, one crit roll. ---
  if (ctx.selector.kind === 'aoe') {
    const center = ctx.targetCell;
    if (center === undefined) return;
    // Strangler FX artifact (retired in §Z): announce the detonation ONCE,
    // before the damage, even on a whiff.
    world.emit('magic:detonated', { casterId: caster.id, center: { ...center } });
    const crit = world.combatRng.next() < critChance;
    const critFactor = crit ? STATS.critMult : 1;
    const victims = resolveAreaVictims(world, caster, center, {
      shape: ctx.selector.shape,
      radius: ctx.selector.radius,
      ringMultiplier: ctx.selector.ringMultiplier,
      affects: ctx.selector.affects,
    });
    for (const { unit: victim, mult } of victims) {
      const damage = Math.round(baseDamage * critFactor * mult);
      if (damage <= 0) continue; // a ring cell that rounds to nothing
      world.applyDamage(caster.id, victim, damage, {
        crit,
        evadable: op.evadable,
        accuracy: op.accuracy,
      });
    }
    return;
  }

  const target = ctx.target;

  // --- Single-target, fizzle (CatapultShot): abort with no draw if dead. ---
  if (ctx.orphanPolicy === 'fizzle') {
    const hit = !!target && target.currentHp > 0;
    const impact = (target ? target.position : ctx.targetCell) ?? caster.position;
    // Strangler FX artifact (retired in §Z): announce the shot ONCE, always.
    world.emit('catapult:fired', { casterId: caster.id, impact: { ...impact }, hit });
    if (!hit) return; // no crit draw on the abort path
    const crit = world.combatRng.next() < critChance;
    const damage = Math.round(baseDamage * (crit ? STATS.critMult : 1));
    if (damage <= 0) return;
    world.applyDamage(caster.id, target!, damage, {
      crit,
      evadable: op.evadable,
      accuracy: op.accuracy,
    });
    return;
  }

  // --- Single-target, commit-at-cast (Attack/Gambit): skip if dead, no draw. ---
  if (!target || target.currentHp <= 0) return;
  const crit = world.combatRng.next() < critChance;
  const damageMultiplier = ctx.resolution.damageMultiplier ?? 1;
  const damage = Math.round(baseDamage * (crit ? STATS.critMult : 1) * damageMultiplier);
  world.applyDamage(caster.id, target, damage, {
    crit,
    evadable: op.evadable,
    accuracy: op.accuracy,
  });
}

function executeHeal(_op: Extract<EffectOp, { kind: 'heal' }>, ctx: OpFireContext): void {
  const target = ctx.target;
  if (!target || target.currentHp <= 0) return; // commit-at-cast guard
  const amount = ctx.resolution.healAmount ?? 0;
  const before = target.currentHp;
  target.currentHp = Math.min(target.derived.maxHp, before + amount);
  const healed = target.currentHp - before;
  ctx.world.recordHealing(ctx.caster.id, healed);
  ctx.world.emit('unit:healed', { unitId: target.id, amount: healed, healerId: ctx.caster.id });
}

function executeMove(op: Extract<EffectOp, { kind: 'move' }>, ctx: OpFireContext): void {
  if (op.mode === 'knockback' || op.mode === 'pull') {
    throw new Error(
      `move mode '${op.mode}' (target-moving) is reserved — deferred to Cluster 2's occupancy core`,
    );
  }
  const { world, caster } = ctx;
  const ref = ctx.resolution.moveDest;
  if (ref === undefined) return;

  if (op.mode === 'advance') {
    // The leap toward the target (dash): relocate to the captured landing.
    const from = { ...caster.position };
    caster.position = { ...ref };
    world.emit('unit:moved', { unitId: caster.id, from, to: { ...ref }, durationTicks: ctx.phaseTicks });
    world.emit('unit:dashed', { unitId: caster.id, from, to: { ...ref }, durationTicks: ctx.phaseTicks });
    return;
  }

  // retreat — the gambit dart-back: a step AWAY from the anchor, or hold.
  const dest = retreatCell(caster, ref, world);
  if (dest === null) return;
  const from = { ...caster.position };
  caster.position = dest;
  const moveTicks = caster.derived.moveCooldownTicks;
  const durationTicks = Math.max(1, Math.min(moveTicks, ctx.remainingTicks));
  world.emit('unit:moved', { unitId: caster.id, from, to: dest, durationTicks });
}
