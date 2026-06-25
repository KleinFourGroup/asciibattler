/**
 * Phase Y2 — the single generic `Action` that interprets an `AbilityDef`'s
 * `effects:[{phase, op}]` over the F2 timeline. Replaces `MeleeStrike` /
 * `MagicBolt` / `CatapultShot` / `HealAlly` / `GambitStrike` / `Dash` — every
 * combat verb becomes ONE class + data (the migration's whole point: fewer
 * classes, not more).
 *
 * Firing model — reproduces the legacy `start`/`applyEffect` split (and its event
 * ORDER, which the determinism oracle pins):
 *   - `start()` fires the ops on phases that BEGIN at offset 0 — BEFORE World's
 *     offset-0 `action:phase` emits (so a strike's `unit:attacked` precedes its
 *     `action:phase{impact}`, exactly as `AttackAction.start` did).
 *   - `applyEffect()` is called by World only at the `impact` boundary; it fires
 *     the impact-offset ops AFTER the `action:phase{impact}` emit (so a charged
 *     spell's detonation follows its phase event). It skips offset 0 — `start`
 *     already ran those (no double-fire).
 *
 * This covers every Y verb: a strike's damage at offset 0 (impact-at-front), a
 * charged spell's damage at the impact boundary, the gambit's damage at offset 0
 * (windup) + its reposition at the impact boundary, the dash's relocate at offset
 * 0. (Ops on a non-impact, non-zero boundary — e.g. a recovery after a NON-zero
 * impact — have no firing hook today; no Y verb needs one. That generalization
 * waits for a consumer, the same discipline as the phase set itself.)
 *
 * The phases (and so each phase's tick offset) live on `unit.activeAction.phases`
 * — World sets them before `start()` and carries them across a snapshot — so the
 * action reads them there rather than storing/serializing its own copy.
 */

import {
  phasesBeginningAt,
  type Action,
  type ActionPhase,
  type ActionPhaseName,
  type OrphanPolicy,
} from '../Action';
import type { GridCoord } from '../../core/types';
import type { Unit } from '../Unit';
import type { World } from '../World';
import type { AbilityDef } from './schema';
import { executeOp, newFireScratch, type OpResolution } from './interpreter';

/** The cast-time-resolved context an `EffectAction` carries (serialized form). */
export interface EffectActionData {
  defId: string;
  /** The single-target unit id (−1 = none / aoe / self). */
  targetId: number;
  /** The captured cell: aoe center, or the fizzle VFX fallback. */
  targetCell?: GridCoord | undefined;
  /** Per-op cast-time scalars, aligned with `def.effects`. */
  ops: OpResolution[];
}

type EffectContext = Omit<EffectActionData, 'defId'>;

function cloneResolution(r: OpResolution): OpResolution {
  const c: OpResolution = { ...r };
  if (r.moveDest) c.moveDest = { ...r.moveDest };
  return c;
}

function ticksOfPhase(phases: readonly ActionPhase[], phase: ActionPhaseName): number {
  for (const p of phases) if (p.phase === phase) return p.ticks;
  return 0;
}

export class EffectAction implements Action {
  readonly id: string;
  readonly orphanPolicy: OrphanPolicy;

  constructor(
    private readonly def: AbilityDef,
    private readonly ctx: EffectContext,
  ) {
    this.id = def.id;
    this.orphanPolicy = def.orphanPolicy;
  }

  start(unit: Unit, world: World): void {
    this.fireOpsAt(unit, world, 0);
  }

  applyEffect(unit: Unit, world: World, tickOffset: number, _phase?: ActionPhaseName): void {
    // World only calls this at the `impact` boundary. The offset-0 case was
    // already fired by `start()` (before the phase emits) — skip it here so an
    // impact-at-offset-0 op never double-fires.
    if (tickOffset === 0) return;
    this.fireOpsAt(unit, world, tickOffset);
  }

  phaseTarget(): { targetId?: number | undefined; targetCell?: GridCoord | undefined } {
    const sel = this.def.target;
    // aoe (the mage bolt) surfaces its blast cell; `self` (a pure caster-
    // reposition — the dash) surfaces nothing, mirroring DashAction's absent
    // phaseTarget. The discriminant is the SELECTOR, not the op: a heal has no
    // damage op yet still surfaces its ally (like HealAction).
    if (sel.kind === 'aoe') {
      return { targetCell: this.ctx.targetCell ? { ...this.ctx.targetCell } : undefined };
    }
    if (sel.kind === 'self') return {};
    // A single-target selector (enemyInRange strike / lowestHpAlly heal) surfaces
    // its resolved unit, mirroring AttackAction / HealAction.
    const targetId = this.ctx.targetId >= 0 ? this.ctx.targetId : undefined;
    if (this.def.orphanPolicy === 'fizzle') {
      // The homing artillery shot also surfaces its cast cell as the VFX fallback.
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
   * Rehydrate from a snapshot. The `def` is re-resolved by id (the registry does
   * the lookup in production; tests pass it directly), so only the cast-time
   * context rides in `data`.
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
    // The retreat-move lerp window (mirrors GambitStrikeAction): the remaining
    // busy ticks, or the move cooldown when fired outside an activeAction (tests).
    const remainingTicks = unit.activeAction
      ? unit.activeAction.finishTick - world.currentTick
      : unit.derived.moveCooldownTicks;
    const target = world.findUnit(this.ctx.targetId);
    // 29 — ONE scratch per phase pass, shared across every op firing here, so an
    // `applyStatus` op can read the misses its paired `damage` op recorded
    // (status-on-hit). Each phase boundary starts fresh — a status rides only the
    // hits from its OWN phase, never a prior phase's.
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
