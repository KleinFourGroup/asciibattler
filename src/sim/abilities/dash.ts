import type { Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import { DashAction } from '../actions/DashAction';
import { currentTarget } from '../Targeting';
import { leapLanding, chebyshev } from '../movement';
import { secondsToTicks } from '../../config';
import { movementConfig } from '../../config/abilities';
import type { Ability } from './Ability';

/** Proposal score: between a strike (10) and a walk (1) — the dash beats a plain
 *  step when out of reach, but a ready strike (10) always preempts it. */
const DASH_SCORE = 5;

/**
 * N1 — the rogue's gap-closer: a short, fast LEAP toward its target, the
 * `movement`-kind ability that exercises the J2 dash seam for the first time.
 *
 * Unlike every prior ability this proposes a MOVE, not an attack — but it's
 * still just an `Ability` returning a scored proposal, so `AbilityBehavior`
 * handles it with no special-casing (the flat runtime model; `kind` is a config
 * data-shape distinction only). The proposal is built here rather than via
 * `movement.ts`'s `moveProposal` because a dash DECOUPLES its motion duration
 * (a ~0.25s blink) from its cooldown (~10s) — `moveProposal` assumes
 * `cooldown == durationTicks`. `cooldownKey` is this ability's id, so the dash
 * counter is independent of the normal-move cadence (it never touches the
 * `'move'` cooldown).
 *
 * Trigger (the N1 "aggressive close" call): dash whenever the target is beyond
 * the unit's STRIKE reach (`derived.attackRange`, which excludes this movement
 * ability's own range — see `rangeForArchetype`) and the dash is ready. If the
 * leap can't fully close it still commits, trading the cooldown for partial
 * ground — the accepted aggressive-close tradeoff. When already in strike range
 * it abstains so the strike (score 10) preempts.
 */
export class DashAbility implements Ability {
  static readonly id = 'dash';
  readonly id = DashAbility.id;

  propose(unit: Unit, world: World): ActionProposal | null {
    const target = currentTarget(unit, world);
    if (target === null) return null;
    // Already within strike reach → let the attack fire; a dash here is wasted.
    if (chebyshev(unit.position, target.position) <= unit.derived.attackRange) return null;

    const cfg = movementConfig(this.id);
    // Leave the target a soft-blocker (no `excludeUnitId`): the route ends AT
    // its cell and the leap stops the cell before, so a dash AT an enemy lands
    // adjacent rather than on top of it.
    const landing = leapLanding(unit, world, {
      goals: [target.position],
      approachToward: target.position,
      maxCells: cfg.range,
    });
    if (landing === null) return null;

    const durationTicks = Math.max(1, secondsToTicks(cfg.durationSeconds));
    const cooldownTicks = Math.max(1, secondsToTicks(cfg.cooldownSeconds));
    return {
      action: new DashAction(unit.position, landing, durationTicks),
      score: DASH_SCORE,
      cooldown: cooldownTicks,
      // A single `impact` phase IS the in-flight lockout (mirrors `moveProposal`
      // / F2), here the short motion window — distinct from the long cooldown.
      phases: [{ phase: 'impact', ticks: durationTicks }],
      cooldownKey: this.id,
    };
  }
}
