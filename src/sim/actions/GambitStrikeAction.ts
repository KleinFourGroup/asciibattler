import type { Action, ActionPhaseName, OrphanPolicy } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import { STATS } from '../../config/stats';

export const GAMBIT_STRIKE_ACTION_ID = 'gambit_strike';

export interface GambitStrikeActionData {
  targetId: number;
  baseDamage: number;
  critChance: number;
  damageMultiplier: number;
  /** F4 — the struck target's cell, captured at cast, that the deferred
   *  reposition retreats AWAY from. Serialized so a snapshot taken mid-windup
   *  (before the `impact` boundary fires `applyEffect`) still knows where to
   *  dart back from. */
  struckFrom?: GridCoord | undefined;
}

/**
 * E7.A — the rogue's signature. A single-tick melee strike (identical
 * damage resolution to `AttackAction`: crit roll off `world.combatRng`,
 * the half-cover `damageMultiplier`, the same `unit:attacked` event +
 * XP ledger entry) PLUS a free one-cell reposition AWAY from the unit it
 * just struck.
 *
 * F4 — the two are SEQUENCED across the action's phase timeline so the
 * on-screen strike shove plays out before the retreat lerp (E6.A made shove
 * and move-lerp mutually exclusive per sprite, so a same-tick reposition
 * clobbered the shove and the strike vanished). The damage lands in `start`
 * at offset 0; the reposition moves to `applyEffect`, which `World.tick` fires
 * at the `impact` boundary `gambit_strike.retreatDelaySeconds` later (the
 * windup-split lives in `strikePhases`, abilities/strikes.ts). The busy window
 * and cadence cooldown are unchanged, so only WHEN within the cycle the rogue
 * darts back moves — the kite pattern (strike → dart back → strike) still
 * emerges from the rogue's high `speed` outrunning the target's re-approach
 * via MovementBehavior. Against an equal-speed enemy it's a wash; that speed
 * differential IS the rogue's identity.
 *
 * The reposition is deliberately conservative: it only fires when a
 * neighbor cell strictly increases Chebyshev distance from the target and
 * is in-bounds, passable (finite tile cost), and unoccupied (walls are
 * neutral units, so they sit in the occupied set). When nothing qualifies
 * — boxed in, corner, 1-wide corridor — the rogue simply holds position
 * after striking. `retreatCell` is pure given the world snapshot, so the
 * step is deterministic for replay.
 *
 * Serialization mirrors `AttackAction`: store `targetId`, resolve via
 * `world.findUnit` on rehydrate. Registered in `actions/registry.ts` so a
 * snapshot taken while a gambit is the unit's `activeAction` round-trips.
 */
export class GambitStrikeAction implements Action {
  readonly id = GAMBIT_STRIKE_ACTION_ID;
  // The strike commits at cast (damage in `start`); the deferred reposition
  // (F4) retreats from the cell captured at cast, so a target that dies during
  // the windup never strands the rogue — same commit-at-cast spirit as
  // AttackAction.
  readonly orphanPolicy: OrphanPolicy = 'commit-at-cast';

  constructor(
    private readonly target: Unit | undefined,
    private readonly baseDamage: number,
    private readonly critChance: number,
    private readonly damageMultiplier: number = 1,
    // F4 — the cell to retreat AWAY from, captured at cast (defaults to the
    // target's position when constructed at propose time; `fromData` restores
    // the serialized value on snapshot resume). Mirrors E7.D's
    // `CatapultShotAction.castPosition` captured-at-cast pattern.
    private readonly struckFrom: GridCoord | undefined = target
      ? { ...target.position }
      : undefined,
  ) {}

  start(unit: Unit, world: World): void {
    if (!this.target || this.target.currentHp <= 0) return;

    // --- Damage (mirrors AttackAction.start), at offset 0. The reposition is
    //     deferred to `applyEffect` at the `impact` boundary (F4). ---
    const crit = world.combatRng.next() < this.critChance;
    const critFactor = crit ? STATS.critMult : 1;
    const damage = Math.round(this.baseDamage * critFactor * this.damageMultiplier);
    this.target.currentHp -= damage;
    world.recordDamage(unit.id, this.target, damage);
    world.emit('unit:attacked', {
      attackerId: unit.id,
      targetId: this.target.id,
      damage,
      crit,
    });
  }

  /**
   * F4 — the gambit's free step away from the struck target, deferred to the
   * `impact` boundary (`retreatDelaySeconds` after the strike landed in
   * `start`) so the on-screen retreat lerp no longer clobbers the strike shove.
   * Retreats from `struckFrom` (the target's cell at cast), NOT the live
   * target, so a target that died during the windup — including from this very
   * strike — still lets the rogue dart back, matching pre-F4 behaviour. Draws
   * no RNG (the crit roll stayed in `start`), so deferring it moves no draw.
   */
  applyEffect(unit: Unit, world: World, _tickOffset: number, _phase?: ActionPhaseName): void {
    if (this.struckFrom === undefined) return;
    const dest = retreatCell(unit, this.struckFrom, world);
    if (dest !== null) {
      const from = unit.position;
      unit.position = dest;
      // F4 — lerp the dart-back over the rogue's REMAINING busy window (the
      // gambit's recovery phase), capped at a normal move's duration. At the
      // rogue's high speed the gambit cadence is short, so the recovery window
      // is often SHORTER than `moveCooldownTicks`: a full-cooldown lerp would
      // still be mid-flight when the unit frees up and starts its next action,
      // whose `startLerp` snaps the sprite — cutting the retreat off (the bug
      // this fixes). Capping at the recovery window lands the dart exactly as
      // the rogue frees up, the way a normal move's lerp fills its cooldown.
      // Falls back to the move cooldown when there's no `activeAction` (the
      // direct-construction unit tests; at runtime `applyEffect` only fires
      // from `World.tick` while the action is live).
      const moveTicks = unit.derived.moveCooldownTicks;
      const remaining = unit.activeAction
        ? unit.activeAction.finishTick - world.currentTick
        : moveTicks;
      const durationTicks = Math.max(1, Math.min(moveTicks, remaining));
      world.emit('unit:moved', {
        unitId: unit.id,
        from,
        to: dest,
        durationTicks,
      });
    }
  }

  phaseTarget(): { targetId?: number | undefined } {
    return { targetId: this.target?.id };
  }

  toData(): GambitStrikeActionData {
    return {
      targetId: this.target?.id ?? -1,
      baseDamage: this.baseDamage,
      critChance: this.critChance,
      damageMultiplier: this.damageMultiplier,
      struckFrom: this.struckFrom,
    };
  }

  static fromData(data: GambitStrikeActionData, world: World): GambitStrikeAction {
    return new GambitStrikeAction(
      world.findUnit(data.targetId),
      data.baseDamage,
      data.critChance,
      data.damageMultiplier ?? 1,
      data.struckFrom,
    );
  }
}

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/**
 * Pick the cell the rogue retreats to after striking: the neighbor that
 * maximizes Chebyshev distance from `target` (must STRICTLY increase it,
 * so a sideways/closer step never reads as a "retreat"), breaking ties
 * toward open space (the candidate with the most free neighbors), then by
 * fixed `NEIGHBORS` order for determinism. Returns null when no neighbor
 * qualifies — caller then leaves the rogue in place.
 */
function retreatCell(unit: Unit, target: GridCoord, world: World): GridCoord | null {
  const occupied = new Set<string>();
  for (const u of world.units) {
    if (u.id === unit.id) continue;
    occupied.add(key(u.position));
  }

  const currentDist = chebyshev(unit.position, target);
  let best: GridCoord | null = null;
  let bestDist = -1;
  let bestOpenness = -1;
  for (const [dx, dy] of NEIGHBORS) {
    const c: GridCoord = { x: unit.position.x + dx, y: unit.position.y + dy };
    if (!passable(c, world, occupied)) continue;
    const dist = chebyshev(c, target);
    if (dist <= currentDist) continue;
    const openness = countOpenNeighbors(c, world, occupied);
    if (dist > bestDist || (dist === bestDist && openness > bestOpenness)) {
      best = c;
      bestDist = dist;
      bestOpenness = openness;
    }
  }
  return best;
}

function countOpenNeighbors(c: GridCoord, world: World, occupied: ReadonlySet<string>): number {
  let n = 0;
  for (const [dx, dy] of NEIGHBORS) {
    if (passable({ x: c.x + dx, y: c.y + dy }, world, occupied)) n++;
  }
  return n;
}

function passable(c: GridCoord, world: World, occupied: ReadonlySet<string>): boolean {
  if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) return false;
  if (!isFinite(world.tileGrid.costAt(c))) return false;
  if (occupied.has(key(c))) return false;
  return true;
}

function key(c: GridCoord): string {
  return `${c.x},${c.y}`;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
