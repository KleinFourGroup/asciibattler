import type { Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal, Action } from '../Action';
import { AttackAction } from '../actions/AttackAction';
import { GambitStrikeAction } from '../actions/GambitStrikeAction';
import { currentTarget, collectLosBlockers } from '../Targeting';
import { hasLineOfSight } from '../LineOfSight';
import { basicAttackDamage, attackCooldownTicksFor } from '../stats';
import { LEVELING } from '../../config/leveling';
import { abilityConfig } from '../../config/abilities';
import type { Ability } from './Ability';

/**
 * E7.A — strikes diverge only in the Action they produce. The melee/ranged
 * basic strikes wrap `AttackAction`; the rogue's gambit wraps
 * `GambitStrikeAction` (same damage resolution + a free reposition). The
 * propose path (target, range gate, LOS, half-cover, crit, cadence) is
 * identical, so it's shared via this factory rather than duplicated.
 */
type StrikeActionFactory = (
  target: Unit,
  baseDamage: number,
  critChance: number,
  damageMultiplier: number,
) => Action;

const attackActionFactory: StrikeActionFactory = (target, baseDamage, critChance, damageMultiplier) =>
  new AttackAction(target, baseDamage, critChance, damageMultiplier);

const gambitActionFactory: StrikeActionFactory = (target, baseDamage, critChance, damageMultiplier) =>
  new GambitStrikeAction(target, baseDamage, critChance, damageMultiplier);

/**
 * The pre-E2 `AttackBehavior` propose path, generalized over ability id.
 * Both `MeleeStrike` and `RangedShot` share this; they diverge through
 * their registry id — which drives `basicAttackDamage` (strength vs.
 * ranged via the unit's archetype) and now the per-ability cadence in
 * `config/abilities.json`, so a swing and a shot can fire at different
 * rates without re-pointing the stat curve.
 *
 * E4 — the half-cover damage multiplier finally lands. Walls (neutral +
 * `blocksLineOfSight: true`) still abort the proposal entirely; half-
 * cover (neutral + `blocksLineOfSight: false`) lets the shot through
 * but at `LEVELING.halfCoverDamageMult` of the damage. The check runs
 * at propose time so the multiplier rides into AttackAction with the
 * resolved base damage — AttackAction stays a thin "apply damage +
 * crit" primitive.
 *
 * The proposal score is 10 — same as pre-E2 — chosen so AbilityBehavior's
 * basic-strike proposal beats MovementBehavior's 1. Future per-ability
 * scoring (e.g. a clustering-aware AoE) returns its own value here.
 */
function proposeBasicStrike(
  unit: Unit,
  world: World,
  abilityId: string,
  makeAction: StrikeActionFactory = attackActionFactory,
): ActionProposal | null {
  const target = currentTarget(unit, world);
  if (target === null) return null;
  // E5: gate on THIS ability's own range (config/abilities.json), not
  // the unit's max engagement range — a multi-ability unit's short-range
  // strike must abstain when only its long-range ability can reach.
  const range = abilityConfig(abilityId).range;
  if (chebyshev(unit.position, target.position) > range) return null;

  const blockers = collectLosBlockers(world);
  if (blockers.length > 0 && !hasLineOfSight(unit.position, target.position, blockers)) {
    return null;
  }

  // E4: half-cover detection. `hasLineOfSight` returns `false` when any
  // blocker sits on the Bresenham line strictly between the endpoints,
  // so passing the half-cover positions as blockers and inverting the
  // result tells us whether the shot crosses one.
  const halfCovers = collectHalfCoverPositions(world);
  const behindCover =
    halfCovers.length > 0 &&
    !hasLineOfSight(unit.position, target.position, halfCovers);
  const damageMultiplier = behindCover ? LEVELING.halfCoverDamageMult : 1;

  const baseDamage = basicAttackDamage(unit);
  // E5 pre-work: cadence is the ability's own `cooldownSeconds` (from
  // `config/abilities.json`), scaled by the unit's `speed` — no longer
  // the single global attack-CD that melee + ranged used to share.
  const durationTicks = attackCooldownTicksFor(
    abilityConfig(abilityId).cooldownSeconds,
    unit.stats.speed,
  );

  return {
    action: makeAction(target, baseDamage, unit.derived.critChance, damageMultiplier),
    score: 10,
    cooldown: durationTicks,
    // F2 — the strike's damage lands in `start` (impact at offset 0); the
    // unit is then locked for the cadence window. `[impact 0, recovery D]`
    // reproduces the pre-F2 busy window exactly.
    phases: [
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: durationTicks },
    ],
    cooldownKey: abilityId,
  };
}

export class MeleeStrike implements Ability {
  static readonly id = 'melee_strike';
  readonly id = MeleeStrike.id;
  propose(unit: Unit, world: World): ActionProposal | null {
    return proposeBasicStrike(unit, world, this.id);
  }
}

export class RangedShot implements Ability {
  static readonly id = 'ranged_shot';
  readonly id = RangedShot.id;
  propose(unit: Unit, world: World): ActionProposal | null {
    return proposeBasicStrike(unit, world, this.id);
  }
}

export class GambitStrike implements Ability {
  static readonly id = 'gambit_strike';
  readonly id = GambitStrike.id;
  propose(unit: Unit, world: World): ActionProposal | null {
    return proposeBasicStrike(unit, world, this.id, gambitActionFactory);
  }
}

/**
 * E4 — half-cover positions: neutral units whose `blocksLineOfSight` is
 * `false`. Symmetric to `collectLosBlockers` but for the OTHER half of
 * the neutral-team population.
 */
function collectHalfCoverPositions(world: World): GridCoord[] {
  const out: GridCoord[] = [];
  for (const u of world.units) {
    if (u.team === 'neutral' && !u.blocksLineOfSight) out.push(u.position);
  }
  return out;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
