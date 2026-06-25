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
import { statusDef } from '../../config/statuses';
import type { EffectOp, TargetSelector } from './schema';
import { resolveAreaVictims } from './targeting';
import { retreatCell } from './reposition';
import { behaviorFlags } from '../statusBehavior';

/**
 * 29 — per-FIRE scratch, shared across every op that fires in one phase pass
 * (`EffectAction.fireOpsAt` builds one and threads it into each op's context).
 * It carries the status-on-hit gate: which single-target evade MISSES happened
 * this pass, so an `applyStatus` op slotted on the same phase as its paired
 * `damage` op skips the targets the strike whiffed on.
 *
 * Why track misses, not hits: non-evadable damage (every AoE) and a 0-damage
 * ring cell never call into the evade roll, so they're never "missed" — an area
 * status still lands on everyone the blast covered, while an evaded single-target
 * swing (the only thing that populates this set) drops its rider. A dead/fizzled
 * target is filtered separately by `applyStatus`'s own alive check.
 */
export interface FireScratch {
  /** Unit ids a damage op this pass explicitly MISSED (evade). */
  missed: Set<number>;
}

/** A fresh, empty per-fire scratch. */
export function newFireScratch(): FireScratch {
  return { missed: new Set<number>() };
}

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
  /** 29 — the per-fire scratch shared by every op on this phase (status-on-hit). */
  fireScratch: FireScratch;
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
      executeApplyStatus(op, ctx);
      return;
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
    const crit = world.combatRng.next() < critChance;
    const critFactor = crit ? STATS.critMult : 1;
    // 28 — a CONFUSED caster's blast friendly-fires: its `affects:'all'` flag
    // overrides the def's authored filter, hitting allies in the radius too. Read
    // LIVE off the caster's effects at fire time (consistent with `affects` being
    // a structural, source-of-truth param) → no captured/serialized state, no
    // snapshot bump. The confused random target pick set the blast CENTRE.
    const affects = behaviorFlags(caster.effects).affects ?? ctx.selector.affects;
    const victims = resolveAreaVictims(world, caster, center, {
      shape: ctx.selector.shape,
      radius: ctx.selector.radius,
      ringMultiplier: ctx.selector.ringMultiplier,
      affects,
    });
    for (const { unit: victim, mult } of victims) {
      const damage = Math.round(baseDamage * critFactor * mult);
      if (damage <= 0) continue; // a ring cell that rounds to nothing
      const landed = world.applyDamage(caster.id, victim, damage, {
        crit,
        evadable: op.evadable,
        accuracy: op.accuracy,
        bypassDefense: op.bypassDefense,
      });
      if (!landed) ctx.fireScratch.missed.add(victim.id); // 29 — status-on-hit gate
    }
    return;
  }

  const target = ctx.target;

  // --- Single-target, fizzle (CatapultShot): abort with no draw if dead. ---
  if (ctx.orphanPolicy === 'fizzle') {
    const hit = !!target && target.currentHp > 0;
    if (!hit) return; // no crit draw on the abort path
    const crit = world.combatRng.next() < critChance;
    const damage = Math.round(baseDamage * (crit ? STATS.critMult : 1));
    if (damage <= 0) return;
    const landed = world.applyDamage(caster.id, target!, damage, {
      crit,
      evadable: op.evadable,
      accuracy: op.accuracy,
      bypassDefense: op.bypassDefense,
    });
    if (!landed) ctx.fireScratch.missed.add(target!.id); // 29 — status-on-hit gate
    return;
  }

  // --- Single-target, commit-at-cast (Attack/Gambit): skip if dead, no draw. ---
  if (!target || target.currentHp <= 0) return;
  const crit = world.combatRng.next() < critChance;
  const damageMultiplier = ctx.resolution.damageMultiplier ?? 1;
  const damage = Math.round(baseDamage * (crit ? STATS.critMult : 1) * damageMultiplier);
  const landed = world.applyDamage(caster.id, target, damage, {
    crit,
    evadable: op.evadable,
    accuracy: op.accuracy,
    bypassDefense: op.bypassDefense,
  });
  if (!landed) ctx.fireScratch.missed.add(target.id); // 29 — status-on-hit gate
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

/**
 * 29 — status-on-hit: apply a configured status to the op's resolved targets.
 * Targets resolve off the def's SELECTOR (the same axis the paired damage op
 * uses); the status-on-hit gate then drops any the strike MISSED this pass and
 * any already dead (a corpse / fizzled shot). A PURE applier (no paired damage,
 * e.g. an AoE control cloud) leaves the miss set empty, so it lands on every
 * resolved target. `magnitude` (default 1) scales the status's periodic output
 * and stacks under the `add` merge; `durationSeconds`, when authored, overrides
 * the def's base duration.
 *
 * ORDER MATTERS: this must be authored AFTER its paired `damage` op on the same
 * phase so the miss is recorded before the gate reads it (`fireOpsAt` walks
 * `def.effects` in order). The §30 attack editor enforces it; the interpreter
 * relies on it.
 */
function executeApplyStatus(
  op: Extract<EffectOp, { kind: 'applyStatus' }>,
  ctx: OpFireContext,
): void {
  const def = statusDef(op.statusId);
  for (const t of resolveStatusTargets(ctx)) {
    if (t.currentHp <= 0) continue; // never status a corpse / fizzled target
    if (ctx.fireScratch.missed.has(t.id)) continue; // the missed-swing gate
    ctx.world.applyStatusEffect(t, def, ctx.caster.id, op.magnitude ?? 1, op.durationSeconds);
  }
}

/**
 * The units an op resolves to under the def's selector at fire time — the
 * targeting axis, shared with the damage path. `aoe` resolves its live occupants
 * (honouring a confused caster's forced `affects:'all'`, like `executeDamage`);
 * `self` is the caster; a single-target selector is the captured live target.
 */
function resolveStatusTargets(ctx: OpFireContext): Unit[] {
  const sel = ctx.selector;
  if (sel.kind === 'aoe') {
    const center = ctx.targetCell;
    if (center === undefined) return [];
    const affects = behaviorFlags(ctx.caster.effects).affects ?? sel.affects;
    return resolveAreaVictims(ctx.world, ctx.caster, center, {
      shape: sel.shape,
      radius: sel.radius,
      ringMultiplier: sel.ringMultiplier,
      affects,
    }).map((v) => v.unit);
  }
  if (sel.kind === 'self') return [ctx.caster];
  // enemyInRange / lowestHpAlly — the captured live single target.
  return ctx.target ? [ctx.target] : [];
}
