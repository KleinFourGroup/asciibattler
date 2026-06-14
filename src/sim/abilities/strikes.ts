import type { Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionPhase, ActionProposal, Action } from '../Action';
import { secondsToTicks } from '../../config';
import { AttackAction } from '../actions/AttackAction';
import { GambitStrikeAction } from '../actions/GambitStrikeAction';
import { currentTarget, collectLosBlockers } from '../Targeting';
import { hasLineOfSight } from '../LineOfSight';
import { basicAttackDamage, attackCooldownTicksFor, critChanceFor } from '../stats';
import { LEVELING } from '../../config/leveling';
import { attackConfig } from '../../config/abilities';
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
  evadable: boolean,
  accuracy: number,
) => Action;

const attackActionFactory: StrikeActionFactory = (
  target,
  baseDamage,
  critChance,
  damageMultiplier,
  evadable,
  accuracy,
) => new AttackAction(target, baseDamage, critChance, damageMultiplier, evadable, accuracy);

const gambitActionFactory: StrikeActionFactory = (
  target,
  baseDamage,
  critChance,
  damageMultiplier,
  evadable,
  accuracy,
) => new GambitStrikeAction(target, baseDamage, critChance, damageMultiplier, evadable, accuracy);

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
  const cfg = attackConfig(abilityId);
  // E5: gate on THIS ability's own range (config/abilities.json), not
  // the unit's max engagement range — a multi-ability unit's short-range
  // strike must abstain when only its long-range ability can reach.
  if (chebyshev(unit.position, target.position) > cfg.range) return null;

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

  // I6 — damage is the weapon's flat `might` plus the archetype's scaling stat;
  // crit is resolved per-weapon (`critBase + luck`), zeroed when the weapon is
  // not `critable`; the weapon's `accuracy`/`evadable` thread into the
  // `applyDamage` to-hit roll.
  const baseDamage = basicAttackDamage(unit, cfg.might);
  // K1 — crit + cadence read `effectiveStats` (luck / speed) so a status effect
  // buffs them; `effectiveStats === stats` when the unit has no effects.
  const critChance = cfg.critable ? critChanceFor(cfg.critBase, unit.effectiveStats.luck) : 0;
  // E5 pre-work: cadence is the ability's own `cooldownSeconds` (from
  // `config/abilities.json`), scaled by the unit's `speed` — no longer
  // the single global attack-CD that melee + ranged used to share.
  const durationTicks = attackCooldownTicksFor(cfg.cooldownSeconds, unit.effectiveStats.speed);

  return {
    action: makeAction(target, baseDamage, critChance, damageMultiplier, cfg.evadable, cfg.accuracy),
    score: 10,
    cooldown: durationTicks,
    phases: strikePhases(abilityId, durationTicks),
    cooldownKey: abilityId,
  };
}

/**
 * The strike's busy-window timeline. A basic strike's damage lands in `start`
 * (impact at offset 0) and the unit is then locked for the cadence window —
 * `[impact 0, recovery D]` reproduces the pre-F2 busy window exactly.
 *
 * F4 — when the ability declares `retreatDelaySeconds` (only the rogue's
 * `gambit_strike` does), carve a leading `windup` of that length out of the
 * recovery: `[windup R, impact 0, recovery D−R]`. The strike STILL lands in
 * `start` at offset 0 (during the windup); the windup is the on-screen
 * strike-contact/recoil beat, and the `impact` boundary R ticks later is where
 * `GambitStrikeAction.applyEffect` commits the dart-back. Σ ticks (= the busy
 * window) and the cadence cooldown are unchanged, so this is balance-neutral
 * on the rogue's attack rate — it only defers the reposition past the shove so
 * the two no longer fight over the sprite (E6.A mutual-exclusion). The
 * gambit's `action:phase` events have no consumer (the renderer's
 * `onActionPhase` handles only mage/catapult `release`), so the `windup` label
 * is internal-only. `min(..., D)` guards a degenerately short cadence.
 */
function strikePhases(abilityId: string, durationTicks: number): ActionPhase[] {
  const retreatSeconds = attackConfig(abilityId).retreatDelaySeconds;
  if (retreatSeconds === undefined) {
    return [
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: durationTicks },
    ];
  }
  const windup = Math.min(secondsToTicks(retreatSeconds), durationTicks);
  return [
    { phase: 'windup', ticks: windup },
    { phase: 'impact', ticks: 0 },
    { phase: 'recovery', ticks: durationTicks - windup },
  ];
}

/**
 * I6 — the melee family's basic strike, now PARAMETERIZED by weapon id. The
 * four melee subclasses share this one behavior class but each carries a
 * distinct weapon (`sword`/`club`/`katana`/`whip`) whose `config/abilities.json`
 * profile (might / accuracy / critBase) the propose path reads via `this.id`.
 * The registry constructs one per id (`new MeleeStrike('sword')`, …).
 */
export class MeleeStrike implements Ability {
  readonly id: string;
  constructor(id: string) {
    this.id = id;
  }
  propose(unit: Unit, world: World): ActionProposal | null {
    return proposeBasicStrike(unit, world, this.id);
  }
}

export class RangedShot implements Ability {
  // I6 — `ranged_shot` renamed to `bow`. Single ranged weapon today, so the id
  // stays a static constant (no constructor param, unlike the 4-weapon melee
  // family); a second bow-type would parameterize this the same way MeleeStrike is.
  static readonly id = 'bow';
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
