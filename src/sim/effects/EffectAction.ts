/**
 * The `Action` behind every ability def: it fires an `AbilityDef`'s
 * `effects: [{ phase, op }]` over the action's phase timeline, so every
 * ability is this one class and its data.
 *
 * When the ops fire, an order the determinism tests pin:
 *
 * - `start()` fires the ops on the phases that begin at offset 0, before
 *   World's offset-0 `action:phase` events, so a strike's `unit:attacked`
 *   comes before its `action:phase` for `impact`.
 * - `applyEffect()`, which World calls only at the `impact` boundary, fires the
 *   ops at that offset after the `action:phase` for `impact`, so a charged
 *   spell's detonation follows its phase event. It skips offset 0, which
 *   `start` already fired.
 *
 * So an op fires at offset 0 or at the `impact` boundary. An op on any other
 * phase that begins later than offset 0 (a `recovery` after an impact that is
 * not at 0) has no hook and never fires; no shipped def has one.
 *
 * The phases, and so each phase's offset, are on `unit.activeAction.phases`,
 * which World sets before `start()` and carries across a snapshot; the action
 * reads them there instead of keeping its own copy.
 */

import {
  phasesBeginningAt,
  type Action,
  type ActionPhase,
  type ActionPhaseName,
} from '../Action';
import type { GridCoord } from '../../core/types';
import { secondsToTicks } from '../../config';
import { collectLosBlockers, firingBandCell } from '../positioning';
import { speedScaledSeconds } from '../stats';
import type { Unit } from '../Unit';
import type { World } from '../World';
import type { AbilityDef } from './schema';
import { executeOp, newFireScratch, type OpResolution } from './interpreter';

/** What an `EffectAction` captured at cast, in its serialized form. */
export interface EffectActionData {
  defId: string;
  /** The single target's unit id; −1 for none, `aoe` and `self`. */
  targetId: number;
  /** The captured cell: an `aoe`'s centre, or where a fizzled shot's effect
   *  is drawn. */
  targetCell?: GridCoord | undefined;
  /** Each op's cast-time scalars, index for index with `def.effects`. */
  ops: OpResolution[];
}

type EffectContext = Omit<EffectActionData, 'defId'>;

function cloneResolution(r: OpResolution): OpResolution {
  const c: OpResolution = { ...r };
  if (r.moveDest) c.moveDest = { ...r.moveDest };
  // A chain op's per-hop resolutions are cloned in depth, so the inner scalars
  // round-trip through toData and fromData as every other field does.
  if (r.chainOps) c.chainOps = r.chainOps.map(cloneResolution);
  return c;
}

function ticksOfPhase(phases: readonly ActionPhase[], phase: ActionPhaseName): number {
  for (const p of phases) if (p.phase === phase) return p.ticks;
  return 0;
}

export class EffectAction implements Action {
  readonly id: string;

  constructor(
    private readonly def: AbilityDef,
    private readonly ctx: EffectContext,
  ) {
    this.id = def.id;
  }

  start(unit: Unit, world: World): void {
    this.fireOpsAt(unit, world, 0);
  }

  /**
   * The release gate (`Action.holdCheck`; the schema's `releaseGate`). At the
   * `release` boundary it runs the propose step's own predicate
   * (`firingBandCell`, positioning.ts) against the target's live position: a
   * dead target, or one outside the `[minRange, range]` band or behind a wall
   * for a line-of-sight ability, holds fire. It returns the re-aim cooldown in
   * ticks, at least 1, on the cadence curve when the gate `scalesWithSpeed`.
   */
  holdCheck(phase: ActionPhaseName, unit: Unit, world: World): number | null {
    const gate = this.def.releaseGate;
    if (gate === undefined || phase !== 'release') return null;
    const target = this.ctx.targetId >= 0 ? world.findUnit(this.ctx.targetId) : undefined;
    const aim =
      target !== undefined && target.currentHp > 0
        ? firingBandCell(
            unit.position,
            target,
            target.position,
            this.def.minRangeCells,
            this.def.rangeCells,
            this.def.ignoresLineOfSight ? null : collectLosBlockers(world),
          )
        : undefined;
    if (aim !== undefined) return null;
    const seconds = gate.scalesWithSpeed
      ? speedScaledSeconds(gate.reaimSeconds, unit.effectiveStats.speed)
      : gate.reaimSeconds;
    return Math.max(1, secondsToTicks(seconds));
  }

  applyEffect(unit: Unit, world: World, tickOffset: number, _phase?: ActionPhaseName): void {
    // World calls this only at the `impact` boundary. `start()` already fired
    // offset 0, before the phase events, so an impact at offset 0 is skipped
    // here and never fires twice.
    if (tickOffset === 0) return;
    this.fireOpsAt(unit, world, tickOffset);
  }

  phaseTarget(): { targetId?: number | undefined; targetCell?: GridCoord | undefined } {
    const sel = this.def.target;
    // An `aoe` surfaces its blast cell; `self` (the dash) surfaces nothing. The
    // selector decides, not the ops, so a heal surfaces its ally.
    if (sel.kind === 'aoe') {
      return { targetCell: this.ctx.targetCell ? { ...this.ctx.targetCell } : undefined };
    }
    if (sel.kind === 'self') return {};
    // A single-target selector surfaces its unit.
    const targetId = this.ctx.targetId >= 0 ? this.ctx.targetId : undefined;
    if (this.def.orphanPolicy === 'fizzle') {
      // A shot that fizzles when its target is gone also surfaces its cast cell,
    // where the renderer draws it then.
      return { targetId, targetCell: this.ctx.targetCell ? { ...this.ctx.targetCell } : undefined };
    }
    return { targetId };
  }

  toData(): EffectActionData {
    return {
      defId: this.def.id,
      targetId: this.ctx.targetId,
      targetCell: this.ctx.targetCell ? { ...this.ctx.targetCell } : undefined,
      ops: this.ctx.ops.map(cloneResolution),
    };
  }

  /**
   * Rehydrates from a snapshot. The def is looked up again by id (by the
   * registry in production; a test passes it), so `data` holds only what was
   * captured at cast.
   */
  static fromData(data: EffectActionData, _world: World, def: AbilityDef): EffectAction {
    return new EffectAction(def, {
      targetId: data.targetId,
      targetCell: data.targetCell ? { ...data.targetCell } : undefined,
      ops: data.ops.map(cloneResolution),
    });
  }

  private fireOpsAt(unit: Unit, world: World, offset: number): void {
    const phases = unit.activeAction?.phases ?? [];
    const beginning = new Set<ActionPhaseName>(phasesBeginningAt(phases, offset));
    if (beginning.size === 0) return;
    // The window a retreat's slide may take: the busy ticks left, or the move
    // cooldown when fired outside an active action (tests).
    const remainingTicks = unit.activeAction
      ? unit.activeAction.finishTick - world.currentTick
      : unit.derived.moveCooldownTicks;
    const target = world.findUnit(this.ctx.targetId);
    // One scratch per phase boundary, shared by the ops firing here, so an
    // `applyStatus` op can read the misses its `damage` op recorded and land
    // only on a hit. Each boundary starts fresh: a status rides only its own
    // phase's hits.
    const fireScratch = newFireScratch();
    this.def.effects.forEach((effect, i) => {
      if (!beginning.has(effect.phase)) return;
      executeOp(effect.op, {
        caster: unit,
        world,
        orphanPolicy: this.def.orphanPolicy,
        selector: this.def.target,
        target,
        targetCell: this.ctx.targetCell,
        resolution: this.ctx.ops[i] ?? {},
        phaseTicks: ticksOfPhase(phases, effect.phase),
        remainingTicks,
        fireScratch,
      });
    });
  }
}
