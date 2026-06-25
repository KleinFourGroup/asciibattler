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
import { secondsToTicks } from '../../config';
import type { ChainInnerOp, ChainOp, EffectOp, TargetSelector } from './schema';
import { nearestChainTarget, resolveAreaVictims } from './targeting';
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
  /**
   * 29c chain: the cast-time resolutions of the chain's inner `ops`, aligned by
   * index with `op.ops`. Captured once at propose time (`resolveOp`) and scaled
   * by `falloff^jump` live per hop, so a charged chain's damage uses its CAST-time
   * stats — the same contract every other op holds. Round-trips via the recursive
   * `cloneResolution` (EffectAction), so an in-flight chain carries no new
   * serialized SHAPE beyond `OpResolution` gaining this optional nested array.
   */
  chainOps?: OpResolution[];
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
    case 'chain':
      executeChain(op, ctx);
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

/* -------------------------------------------------------------------------- */
/* 29c chain — the per-hop arc, optionally staggered over real sim ticks.      */
/* -------------------------------------------------------------------------- */

/**
 * 29c — chain: arc the op's `ops` across up to `maxJumps` targets. Jump 0 is the
 * committed primary (`ctx.target`); each later jump hops to the nearest fresh
 * enemy within `rangeCells` of the previous victim (`nearestChainTarget`), never
 * repeating a target, ending early if none remains. Each victim takes the inner
 * `ops` with `falloff^jump` applied to their captured damage (the primary full).
 *
 * Timing (the 29c follow-up): with `hopDelaySeconds > 0` only jump 0 lands NOW
 * (the impact tick); the remaining jumps ride `World.pendingChainHops`, firing one
 * every `hopDelaySeconds` so the bolt visibly travels (each hop's damage number /
 * HP drop / arc coincide on that hop's tick). `0` keeps the original synchronous
 * resolve (every hop on the impact tick). Either way the geometry is the same — a
 * deferred hop just re-resolves its next target LIVE at fire time, so a target that
 * moved or died between hops is handled deterministically (and the chain breaks if
 * the caster itself died mid-arc).
 *
 * The inner ops fire through the SAME `executeOp` (the recursion), under a
 * synthesized single-target context: selector `enemyInRange`, `commit-at-cast`,
 * the jump victim as `target`, and a FRESH per-jump scratch — so an `applyStatus`
 * rider reads only its own hop's hit/miss, never a prior hop's. A dead primary
 * (it died during a charged windup) yields no jump-0 victim → the whole chain
 * fizzles, mirroring a `commit-at-cast` strike onto a corpse.
 */
const CHAIN_INNER_SELECTOR: TargetSelector = { kind: 'enemyInRange' };

/**
 * A chain jump waiting to fire on a future tick (`World.pendingChainHops`). Holds
 * the chain op + the cast-time `resolution` (so the inner scalars + falloff are
 * authoritative), the running `hitIds` (no repeats) and the arc origin `fromPos`
 * (the previous victim's cell), and which `jumpIndex` this is (its `falloff^jump`).
 * Plain data — round-trips in the WorldSnapshot (v28); `op`/`resolution` are
 * immutable by convention, the mutable per-hop bits (`fromPos`/`hitIds`) get copied.
 */
export interface PendingChainHop {
  fireAtTick: number;
  casterId: number;
  op: ChainOp;
  resolution: OpResolution;
  fromPos: GridCoord;
  hitIds: number[];
  jumpIndex: number;
}

function executeChain(op: ChainOp, ctx: OpFireContext): void {
  const victim0 = ctx.target && ctx.target.currentHp > 0 ? ctx.target : undefined;
  if (!victim0) return; // dead/committed primary → the whole chain fizzles

  const hit = new Set<number>();
  fireChainHopOps(ctx.world, ctx.caster, op, ctx.resolution, victim0, 0, ctx.caster.position);
  hit.add(victim0.id);
  if (op.maxJumps <= 1) return;

  const delayTicks = secondsToTicks(op.hopDelaySeconds);
  let from: GridCoord = { ...victim0.position };

  if (delayTicks <= 0) {
    // Synchronous: every remaining hop lands on the impact tick (the original
    // all-at-once resolve, kept for `hopDelaySeconds: 0`).
    for (let jump = 1; jump < op.maxJumps; jump++) {
      const victim = nearestChainTarget(ctx.world, ctx.caster.team, from, op.rangeCells, hit);
      if (!victim) break;
      fireChainHopOps(ctx.world, ctx.caster, op, ctx.resolution, victim, jump, from);
      hit.add(victim.id);
      from = { ...victim.position };
    }
    return;
  }

  // Staggered: queue jump 1, which cascades the rest one hop per `delayTicks`.
  ctx.world.scheduleChainHop({
    fireAtTick: ctx.world.currentTick + delayTicks,
    casterId: ctx.caster.id,
    op,
    resolution: ctx.resolution,
    fromPos: from,
    hitIds: [...hit],
    jumpIndex: 1,
  });
}

/**
 * Apply one hop's inner ops to `victim` (with the jump's cumulative `falloff`) and
 * emit the `unit:chained` arc event. Shared by the immediate jump 0, the
 * synchronous tail, and the deferred per-tick hops — so the firing is identical
 * however the hop is scheduled. `fromPos` is the arc's source cell (the caster for
 * jump 0, else the previous victim).
 */
function fireChainHopOps(
  world: World,
  caster: Unit,
  op: ChainOp,
  resolution: OpResolution,
  victim: Unit,
  jumpIndex: number,
  fromPos: GridCoord,
): void {
  const falloff = Math.pow(op.falloff, jumpIndex);
  const chainResolutions = resolution.chainOps ?? [];
  const scratch = newFireScratch();
  op.ops.forEach((inner: ChainInnerOp, i) => {
    executeOp(inner, {
      caster,
      world,
      orphanPolicy: 'commit-at-cast',
      selector: CHAIN_INNER_SELECTOR,
      target: victim,
      targetCell: undefined,
      resolution: scaleChainResolution(chainResolutions[i] ?? {}, falloff),
      phaseTicks: 0,
      remainingTicks: 0,
      fireScratch: scratch,
    });
  });
  world.emit('unit:chained', {
    casterId: caster.id,
    targetId: victim.id,
    from: { ...fromPos },
    to: { ...victim.position },
    jumpIndex,
  });
}

/**
 * Fire one DEFERRED chain hop (called by `processChainHops` when it comes due):
 * re-resolve the next target LIVE off the stored origin, fire its ops, then queue
 * the following hop if any jumps remain. Breaks the chain (fires nothing further)
 * if the caster died mid-arc or no fresh target sits in range.
 */
function advanceChainHop(world: World, hop: PendingChainHop): void {
  const caster = world.findUnit(hop.casterId);
  if (!caster || caster.currentHp <= 0) return; // caster gone → the arc dies with it
  const hit = new Set<number>(hop.hitIds);
  const victim = nearestChainTarget(world, caster.team, hop.fromPos, hop.op.rangeCells, hit);
  if (!victim) return; // no fresh target in range → chain ends

  fireChainHopOps(world, caster, hop.op, hop.resolution, victim, hop.jumpIndex, hop.fromPos);
  hit.add(victim.id);

  const nextJump = hop.jumpIndex + 1;
  if (nextJump < hop.op.maxJumps) {
    world.scheduleChainHop({
      fireAtTick: world.currentTick + secondsToTicks(hop.op.hopDelaySeconds),
      casterId: hop.casterId,
      op: hop.op,
      resolution: hop.resolution,
      fromPos: { ...victim.position },
      hitIds: [...hit],
      jumpIndex: nextJump,
    });
  }
}

/**
 * Process every pending chain hop that has come due this tick (`fireAtTick <=
 * currentTick`), in queue order, leaving the rest. Driven once per `World.tick`
 * alongside the periodic-status pass — the shared `reapDead` that follows reaps a
 * hop-kill on the same tick (combat-kill ordering). A hop that fires may enqueue
 * its successor (a strictly-later `fireAtTick`), so the not-yet-due remainder is
 * recomputed before firing to avoid re-running a freshly-scheduled hop this tick.
 */
export function processChainHops(world: World): void {
  const queue = world.pendingChainHops;
  if (queue.length === 0) return;
  const now = world.currentTick;
  const due = queue.filter((h) => h.fireAtTick <= now);
  if (due.length === 0) return;
  world.pendingChainHops = queue.filter((h) => h.fireAtTick > now);
  for (const hop of due) advanceChainHop(world, hop);
}

/**
 * Apply a jump's cumulative `falloff` to one inner op's captured resolution.
 * Only `baseDamage` falls off (the magnitude reduction per hop); a crit chance /
 * an `applyStatus`'s empty resolution pass through untouched. Returns the input
 * as-is when there's nothing to scale, so the no-damage ops keep their identity.
 */
function scaleChainResolution(r: OpResolution, factor: number): OpResolution {
  if (r.baseDamage === undefined) return r;
  return { ...r, baseDamage: r.baseDamage * factor };
}
