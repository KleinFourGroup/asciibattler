import type { Action } from '../Action';
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
}

/**
 * E7.A — the rogue's signature. A single-tick melee strike (identical
 * damage resolution to `AttackAction`: crit roll off `world.combatRng`,
 * the half-cover `damageMultiplier`, the same `unit:attacked` event +
 * XP ledger entry) PLUS a free one-cell reposition AWAY from the unit it
 * just struck.
 *
 * Both happen in `start` on the same tick: there's no separate
 * cooldown-gated MoveAction, so the "kite" pattern (strike → dart back →
 * strike) emerges from the rogue's high `speed` outrunning the target's
 * re-approach via MovementBehavior — no extra unit state needed (see
 * ROADMAP E7). Against an equal-speed enemy it's a wash; that speed
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

  constructor(
    private readonly target: Unit | undefined,
    private readonly baseDamage: number,
    private readonly critChance: number,
    private readonly damageMultiplier: number = 1,
  ) {}

  start(unit: Unit, world: World): void {
    if (!this.target || this.target.currentHp <= 0) return;

    // --- Damage (mirrors AttackAction.start) ---
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

    // --- Gambit reposition: free step away from the struck target ---
    const dest = retreatCell(unit, this.target.position, world);
    if (dest !== null) {
      const from = unit.position;
      unit.position = dest;
      world.emit('unit:moved', {
        unitId: unit.id,
        from,
        to: dest,
        durationTicks: unit.derived.moveCooldownTicks,
      });
    }
  }

  toData(): GambitStrikeActionData {
    return {
      targetId: this.target?.id ?? -1,
      baseDamage: this.baseDamage,
      critChance: this.critChance,
      damageMultiplier: this.damageMultiplier,
    };
  }

  static fromData(data: GambitStrikeActionData, world: World): GambitStrikeAction {
    return new GambitStrikeAction(
      world.findUnit(data.targetId),
      data.baseDamage,
      data.critChance,
      data.damageMultiplier ?? 1,
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
