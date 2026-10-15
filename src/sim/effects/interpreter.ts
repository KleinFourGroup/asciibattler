/**
 * The effect-op interpreter: one `switch` over `op.kind` that runs a resolved op
 * against the world (`damage` through `world.applyDamage`, `heal`, `move`
 * through the reposition step, `applyStatus`, `chain`, `summon`). Its RNG draws
 * and its events are in an order the determinism tests pin.
 *
 * The scalars captured at cast (the base damage, the crit chance, the heal
 * amount, the move's cell, a status's magnitude and duration, a summon's level)
 * arrive on the `OpResolution`, so a charged spell lands with the caster's
 * cast-time stats. The structural params (`evadable`, `accuracy`, the area's
 * shape, `affects` and ring, the move mode) are read off the def when the op
 * fires.
 */

import type { GridCoord } from '../../core/types';
import type { Archetype, Unit } from '../Unit';
import type { World } from '../World';
import type { OrphanPolicy } from '../Action';
import { STATS } from '../../config/stats';
import { statusDef } from '../../config/statuses';
import { secondsToTicks } from '../../config';
import type { ChainInnerOp, ChainOp, EffectOp, TargetSelector } from './schema';
import { nearestChainTarget, resolveAreaVictims } from './targeting';
import { nearestFreeCells } from '../actingPosition';
import { retreatCell } from './reposition';
import { behaviorFlags } from '../statusBehavior';

/**
 * A scratch shared by every op that fires on one phase boundary
 * (`EffectAction.fireOpsAt` makes one and passes it to each op). It holds the
 * misses: the targets a damage op on this boundary missed, so an `applyStatus`
 * on the same phase skips them and a status lands only on a hit.
 *
 * It records misses rather than hits because damage that cannot be evaded (no
 * shipped area op is `evadable`) and a ring cell that rounds to 0 never roll to
 * hit, so they are never missed: an area status lands on everyone the blast
 * covered, and only an evaded strike drops its rider. A dead or fizzled target
 * is left out by `applyStatus`'s own alive check.
 */
interface FireScratch {
  /** The unit ids a damage op on this boundary missed. */
  missed: Set<number>;
}

/** An empty scratch for one phase boundary. */
export function newFireScratch(): FireScratch {
  return { missed: new Set<number>() };
}

/** One op's values captured at cast (`propose.ts`'s `resolveOp`). */
export interface OpResolution {
  /** damage: `might` and the `scaling` stat. */
  baseDamage?: number;
  /** damage: the crit chance, 0 when the op is not `critable`. */
  critChance?: number;
  /** heal: the amount, `might` and the `scaling` stat. */
  healAmount?: number;
  /** move: the `advance` landing, or the `retreat` anchor (the struck cell). */
  moveDest?: GridCoord;
  /**
   * chain: the inner ops' resolutions, index for index with `op.ops`, captured
   * once at cast and scaled by `falloff^jump` per hop. `cloneResolution`
   * (EffectAction) copies them in depth, so a chain under way round-trips.
   */
  chainOps?: OpResolution[];
  /**
   * applyStatus: the magnitude and the duration (in seconds), scaled or not,
   * frozen at cast; both may be fractional. Rounding the magnitude and flooring
   * the ticks happen downstream (`World.applyStatusEffect`, `statusRuntime.ts`).
   * Undefined when the op authored neither, and the consumer's default (a
   * magnitude of 1, the def's duration) governs.
   */
  statusMagnitude?: number;
  statusDurationSeconds?: number;
  /** summon: the minions' level, a whole level of at least 1, since
   *  `scaledUnit` needs one. */
  summonLevel?: number;
}

/** What the interpreter needs to fire one op, from `EffectAction`. */
export interface OpFireContext {
  caster: Unit;
  world: World;
  orphanPolicy: OrphanPolicy;
  selector: TargetSelector;
  /** The single target, looked up live (`findUnit`), if there is one. */
  target: Unit | undefined;
  /** The captured cell: an `aoe`'s centre, or where a fizzled shot is drawn. */
  targetCell: GridCoord | undefined;
  resolution: OpResolution;
  /** The ticks of the phase this op fires on: an `advance` move's slide. */
  phaseTicks: number;
  /** The action's busy ticks left: the most a `retreat` move's slide takes. */
  remainingTicks: number;
  /** The scratch every op on this boundary shares. */
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
    case 'summon':
      executeSummon(op, ctx);
      return;
    default: {
      const _exhaustive: never = op;
      throw new Error(`unknown effect op: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * An `aoe`'s centre: for `anchor: 'caster'` the caster's live cell as the op
 * fires, so a shove during the wind-up moves the blast with the body and nothing
 * is captured at cast; for `anchor: 'targetCell'` the cell captured at cast.
 */
function aoeCenter(
  sel: Extract<TargetSelector, { kind: 'aoe' }>,
  ctx: OpFireContext,
): GridCoord | undefined {
  return sel.anchor === 'caster' ? ctx.caster.position : ctx.targetCell;
}

function executeDamage(
  op: Extract<EffectOp, { kind: 'damage' }>,
  ctx: OpFireContext,
): void {
  const { world, caster } = ctx;
  const baseDamage = ctx.resolution.baseDamage ?? 0;
  const critChance = ctx.resolution.critChance ?? 0;

  // --- An area: the victims as it fires, one crit roll for all. ---
  if (ctx.selector.kind === 'aoe') {
    const center = aoeCenter(ctx.selector, ctx);
    if (center === undefined) return;
    const crit = world.combatRng.next() < critChance;
    const critFactor = crit ? STATS.critMult : 1;
    // A confused caster's blast hits its own side too: the status's
    // `affects: 'all'` overrides the def's filter. It is read off the caster's
    // effects as the op fires, as `affects` itself is, so nothing is captured;
    // the confused random target pick set the centre.
    const affects = behaviorFlags(caster.effects).affects ?? ctx.selector.affects;
    const victims = resolveAreaVictims(world, caster, center, {
      shape: ctx.selector.shape,
      radius: ctx.selector.radius,
      ringMultiplier: ctx.selector.ringMultiplier,
      affects,
    });
    for (const { unit: victim, mult } of victims) {
      const damage = Math.round(baseDamage * critFactor * mult);
      if (damage <= 0) continue; // a ring cell that rounds to 0
      const landed = world.applyDamage(caster.id, victim, damage, {
        crit,
        evadable: op.evadable,
        accuracy: op.accuracy,
        bypassDefense: op.bypassDefense,
      });
      if (!landed) ctx.fireScratch.missed.add(victim.id); // for applyStatus
    }
    return;
  }

  const target = ctx.target;

  // --- One target, `fizzle`: a dead target stops it with no draw. ---
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
    if (!landed) ctx.fireScratch.missed.add(target!.id); // for applyStatus
    return;
  }

  // --- One target, `commit-at-cast`: a dead target is skipped, no draw. ---
  if (!target || target.currentHp <= 0) return;
  const crit = world.combatRng.next() < critChance;
  const damage = Math.round(baseDamage * (crit ? STATS.critMult : 1));
  const landed = world.applyDamage(caster.id, target, damage, {
    crit,
    evadable: op.evadable,
    accuracy: op.accuracy,
    bypassDefense: op.bypassDefense,
  });
  if (!landed) ctx.fireScratch.missed.add(target.id); // for applyStatus
}

function executeHeal(_op: Extract<EffectOp, { kind: 'heal' }>, ctx: OpFireContext): void {
  const target = ctx.target;
  if (!target || target.currentHp <= 0) return; // a dead target is skipped
  const amount = ctx.resolution.healAmount ?? 0;
  const before = target.currentHp;
  target.currentHp = Math.min(target.derived.maxHp, before + amount);
  const healed = target.currentHp - before;
  ctx.world.recordHealing(ctx.caster.id, healed);
  ctx.world.emit('unit:healed', { unitId: target.id, amount: healed, healerId: ctx.caster.id });
}

function executeMove(op: Extract<EffectOp, { kind: 'move' }>, ctx: OpFireContext): void {
  const { world, caster } = ctx;
  const ref = ctx.resolution.moveDest;
  if (ref === undefined) return;

  if (op.mode === 'advance') {
    // The leap (the dash): onto the landing captured at cast.
    const from = { ...caster.position };
    caster.position = { ...ref };
    world.emit('unit:moved', { unitId: caster.id, from, to: { ...ref }, durationTicks: ctx.phaseTicks });
    world.emit('unit:dashed', { unitId: caster.id, from, to: { ...ref }, durationTicks: ctx.phaseTicks });
    return;
  }

  // `retreat`: a step away from the anchor, or none.
  const dest = retreatCell(caster, ref, world);
  if (dest === null) return;
  const from = { ...caster.position };
  caster.position = dest;
  const moveTicks = caster.derived.moveCooldownTicks;
  const durationTicks = Math.max(1, Math.min(moveTicks, ctx.remainingTicks));
  world.emit('unit:moved', { unitId: caster.id, from, to: dest, durationTicks });
}

/**
 * Puts the op's status on its resolved targets. The targets come from the def's
 * selector, as the damage op's do; then the targets a damage op on this boundary
 * missed, and the dead (a corpse, a fizzled shot's target), are skipped. An
 * `applyStatus` with no damage op beside it (a cloud of control) finds no misses
 * and lands on every target. `magnitude` (1 by default) scales the status's
 * periodic output and stacks under an `add` merge; `durationSeconds`, when
 * authored, replaces the def's duration.
 *
 * Order matters: the op must come after its damage op on the same phase, so the
 * miss is recorded before it is read (`fireOpsAt` walks `def.effects` in
 * order). Nothing checks the order; the author keeps it.
 */
function executeApplyStatus(
  op: Extract<EffectOp, { kind: 'applyStatus' }>,
  ctx: OpFireContext,
): void {
  const def = statusDef(op.statusId);
  for (const t of resolveStatusTargets(ctx)) {
    if (t.currentHp <= 0) continue; // never a corpse or a fizzled target
    if (ctx.fireScratch.missed.has(t.id)) continue; // a missed strike
    // The magnitude and duration captured at cast, not the op's fields.
    ctx.world.applyStatusEffect(
      t,
      def,
      ctx.caster.id,
      ctx.resolution.statusMagnitude ?? 1,
      ctx.resolution.statusDurationSeconds,
    );
  }
}

/**
 * The units a status op resolves to under the def's selector as it fires: an
 * `aoe`'s occupants now (with a confused caster's `affects: 'all'`, as
 * `executeDamage` reads it), the caster for `self`, and the live captured target
 * for a single-target selector.
 */
function resolveStatusTargets(ctx: OpFireContext): Unit[] {
  const sel = ctx.selector;
  if (sel.kind === 'aoe') {
    const center = aoeCenter(sel, ctx);
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
  // `enemyInRange` and `lowestHpAlly`: the captured target, if alive in the world.
  return ctx.target ? [ctx.target] : [];
}

/* -------------------------------------------------------------------------- */
/* Summon: minions placed around an anchor.                                   */
/* -------------------------------------------------------------------------- */

/**
 * Places `op.summon.count` minions on the caster's team in the free cells
 * nearest the resolved `at` anchor, within `radiusCells`. The caster's `maxLive`
 * cap holds here as well as at propose, against a proposal made stale since,
 * so the cap is never passed. No free cell in range: the cast fizzles and
 * nothing is placed. The placement is a breadth-first search and the stats come
 * from `scaledUnit` (`World.spawnSummon`), so nothing draws RNG. Each minion
 * fades in (`unit:spawned` with `instant: false`) under a `SpawnAction` lockout
 * and acts from the next tick: `World.tick` walks a copy of `units`, so a unit
 * added at impact is not in this tick's pass.
 */
function executeSummon(op: Extract<EffectOp, { kind: 'summon' }>, ctx: OpFireContext): void {
  const anchor = resolveSummonAnchor(op.at, ctx);
  if (anchor === undefined) return; // no anchor (a dead or absent target): fizzle
  const room = op.summon.maxLive - ctx.world.liveSummonCount(ctx.caster.id);
  if (room <= 0) return; // at the cap
  const want = Math.min(op.summon.count, room);
  const cells = nearestFreeCells(anchor, want, op.summon.radiusCells, ctx.world);
  // The level captured at cast, not the op's; propose always captures one.
  const level = ctx.resolution.summonLevel ?? 1;
  for (const cell of cells) {
    ctx.world.spawnSummon(op.summon.archetype as Archetype, level, ctx.caster.team, cell, ctx.caster.id);
  }
}

/**
 * A summon's `at` anchor as a cell: the caster's cell for `self` (the default),
 * the blast's centre for an `aoe`, the live target's cell for a single-target
 * selector (a flank summon). `undefined`, for a dead or never-captured target,
 * fizzles the cast.
 */
function resolveSummonAnchor(at: TargetSelector, ctx: OpFireContext): GridCoord | undefined {
  switch (at.kind) {
    case 'self':
      return ctx.caster.position;
    case 'aoe':
      return aoeCenter(at, ctx);
    case 'enemyInRange':
    case 'lowestHpAlly':
      return ctx.target?.position;
  }
}

/* -------------------------------------------------------------------------- */
/* Chain: the arc from hop to hop, spaced over sim ticks if the op says so.   */
/* -------------------------------------------------------------------------- */

/**
 * A chain arcs its `ops` across up to `maxJumps` targets. Jump 0 is the committed
 * primary (`ctx.target`); each later jump goes to the nearest fresh enemy within
 * `rangeCells` of the last victim (`nearestChainTarget`), never repeating one,
 * and the chain ends early when none is left. Each victim takes the inner ops
 * with `falloff^jump` applied to their captured damage, the primary in full.
 *
 * With `hopDelaySeconds > 0` only jump 0 lands on the impact tick; the rest wait
 * in `World.pendingChainHops` and land one every `hopDelaySeconds`, so the arc
 * travels and each hop's number, HP drop and arc show on its own tick. With 0,
 * every hop lands on the impact tick. The geometry is the same either way: a
 * waiting hop finds its target when it fires, so a target that moved or died
 * between hops is handled deterministically, and the chain stops if the caster
 * died mid-arc.
 *
 * The inner ops fire through `executeOp` itself, under a single-target context
 * made for the hop (`enemyInRange`, `commit-at-cast`, the hop's victim as the
 * target) with a fresh scratch, so an `applyStatus` rider reads only its own
 * hop's miss. A primary that died (during a charged wind-up, say) leaves no
 * victim for jump 0, and the whole chain fizzles, as a strike on a corpse does.
 */
const CHAIN_INNER_SELECTOR: TargetSelector = { kind: 'enemyInRange' };

/**
 * A chain hop waiting to fire on a later tick (`World.pendingChainHops`): the op
 * and the cast-time `resolution` (whose inner scalars and falloff it fires
 * with), the ids already hit (`hitIds`, so none repeats), the arc's origin
 * `fromPos` (the last victim's cell), and its `jumpIndex` (the power of
 * `falloff`). Plain data, serialized in the World snapshot. `op` and
 * `resolution` are not mutated; `fromPos` and `hitIds` are copied per hop.
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
  if (!victim0) return; // a dead primary: the whole chain fizzles

  const hit = new Set<number>();
  fireChainHopOps(ctx.world, ctx.caster, op, ctx.resolution, victim0, 0, ctx.caster.position);
  hit.add(victim0.id);
  if (op.maxJumps <= 1) return;

  const delayTicks = secondsToTicks(op.hopDelaySeconds);
  let from: GridCoord = { ...victim0.position };

  if (delayTicks <= 0) {
    // `hopDelaySeconds: 0`: every remaining hop lands on the impact tick.
    for (let jump = 1; jump < op.maxJumps; jump++) {
      const victim = nearestChainTarget(ctx.world, ctx.caster.team, from, op.rangeCells, hit);
      if (!victim) break;
      fireChainHopOps(ctx.world, ctx.caster, op, ctx.resolution, victim, jump, from);
      hit.add(victim.id);
      from = { ...victim.position };
    }
    return;
  }

  // Spaced: queue jump 1, which queues the next as it fires, one per `delayTicks`.
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
 * Fires one hop's inner ops on `victim`, with the jump's `falloff`, and emits the
 * `unit:chained` arc. Jump 0, the hops on the impact tick and the waiting hops
 * all fire through here, so a hop fires the same however it was scheduled.
 * `fromPos` is the arc's origin: the caster for jump 0, the last victim after.
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
 * Fires one waiting hop as it comes due (`processChainHops`): finds the next
 * target from the stored origin as things stand, fires its ops, then queues the
 * following hop if jumps remain. The chain stops, firing nothing more, if the
 * caster died mid-arc or no fresh target is in range.
 */
function advanceChainHop(world: World, hop: PendingChainHop): void {
  const caster = world.findUnit(hop.casterId);
  if (!caster || caster.currentHp <= 0) return; // the caster is gone: the arc ends
  const hit = new Set<number>(hop.hitIds);
  const victim = nearestChainTarget(world, caster.team, hop.fromPos, hop.op.rangeCells, hit);
  if (!victim) return; // no fresh target in range: the chain ends

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
 * Fires every waiting hop that is due (`fireAtTick <= currentTick`), in queue
 * order, and keeps the rest. `World.tick` calls it once a tick beside the
 * periodic-status pass, and the `reapDead` after both reaps a hop's kill on the
 * same tick. A hop that fires may queue its successor at a later tick, so the
 * queue is split before any hop fires, and a hop queued this tick does not run
 * this tick.
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
 * One inner op's resolution with the jump's `falloff` applied. Only `baseDamage`
 * falls off: the crit chance and an `applyStatus`'s magnitude and duration pass
 * through, so the rider is the same on every hop and only the bolt weakens. An op
 * with nothing to scale gets its resolution back as it is.
 */
function scaleChainResolution(r: OpResolution, factor: number): OpResolution {
  if (r.baseDamage === undefined) return r;
  return { ...r, baseDamage: r.baseDamage * factor };
}
