/**
 * Phase Y2 — target/area resolution for the effect interpreter.
 *
 * The targeting axis (the brief's first axis): WHO an op resolves to. Single-
 * target selectors (`enemyInRange` / `lowestHpAlly` / `self`) resolve to one unit
 * at propose time (Y3); the `aoe` selector resolves to its occupants at FIRE time
 * (impact) — "hit whoever is standing in the cells now" — which is what these
 * helpers do.
 *
 * `unitsInCells` is the **Cluster-2 footprint seam** — FILLED (44-pre-b): an
 * area op is "units whose FOOTPRINT intersects the cell set" (`cellsOccupiedBy`),
 * so a 2×2/3×3 rubble is caught by a blast covering any of its body cells, not
 * just its §39 corner. Every 1×1 unit takes the same single-cell membership test
 * as before — byte-identical for the whole combatant roster.
 */

import type { GridCoord } from '../../core/types';
import type { World } from '../World';
import { type Unit, type Team } from '../Unit';
import { isDestructibleNeutral } from '../../config/units';
import { cellKey, cellUnitDistance, cellsOccupiedBy } from '../occupancy';
import type { Affects } from './schema';

/**
 * The units whose footprint intersects the cell set, in `world.units` order (so
 * the downstream per-victim event/draw order is the same deterministic order
 * MagicBolt's `world.units.slice()` loop used). The Cluster-2 footprint seam,
 * filled 44-pre-b (see header).
 */
export function unitsInCells(world: World, cells: Iterable<GridCoord>): Unit[] {
  const keys = new Set<string>();
  for (const c of cells) keys.add(cellKey(c));
  return world.units.filter((u) => cellsOccupiedBy(u).some((c) => keys.has(cellKey(c))));
}

/** The Chebyshev-radius square around a center — a (2·radius+1)² block. */
export function squareCells(center: GridCoord, radius: number): GridCoord[] {
  const cells: GridCoord[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      cells.push({ x: center.x + dx, y: center.y + dy });
    }
  }
  return cells;
}

/** The cells an `aoe` shape covers around its center. Only `square` ships; the
 *  other shapes are reserved seams (declared in the schema, no consumer yet). */
export function cellsForAoeShape(
  shape: 'square' | 'line' | 'cross',
  center: GridCoord,
  radius: number,
): GridCoord[] {
  switch (shape) {
    case 'square':
      return squareCells(center, radius);
    case 'line':
    case 'cross':
      throw new Error(`aoe shape '${shape}' is reserved — no consumer until a verb needs it`);
  }
}

/**
 * The friendly-fire team filter relative to the caster. `'enemies'` is "not the
 * caster's team" (the brief's seam — so AoE chews destructible terrain for free
 * once Cluster 2 gives neutrals HP); the present-day neutral exclusion is the
 * SEPARATE `isCombatTargetable` guard, not this filter, so lifting it in Cluster
 * 2 is a one-line change here.
 */
export function affectsMatch(affects: Affects, unitTeam: Team, casterTeam: Team): boolean {
  switch (affects) {
    case 'enemies':
      return unitTeam !== casterTeam;
    case 'allies':
      return unitTeam === casterTeam;
    case 'all':
      return true;
  }
}

/**
 * Is a unit a valid combat-damage target? Alive, AND either a combatant or a
 * DESTRUCTIBLE neutral. §40b lifted the blanket `team !== 'neutral'` exclusion →
 * destructibility = HP-PRESENCE: a neutral with an `hp` pool (rubble) is targetable;
 * an hp-less neutral (wall / half-cover) is not. This is what lets an
 * `affects:'enemies'` AoE chew rubble automatically — `resolveAreaVictims` filters
 * through here — while indestructible walls stay untouched. The `team === 'neutral'`
 * short-circuit keeps the combatant path (the overwhelming common case) a single
 * cheap check, consulting the catalog only for the rare neutral.
 */
export function isCombatTargetable(u: Unit): boolean {
  if (u.currentHp <= 0) return false;
  return u.team !== 'neutral' || isDestructibleNeutral(u.archetype);
}

/**
 * §29c — the chain op's hop geometry: the nearest combat-targetable enemy (not on
 * `casterTeam`) within `rangeCells` (Chebyshev) of `from`, skipping any id in
 * `exclude` (the already-hit set, so the arc never repeats a target). Deterministic
 * — `world.units` order tie-breaks an equal-distance pick (strict `<`, so the first
 * occupant wins), the same order `unitsInCells` preserves for the blast. Returns
 * `undefined` when no fresh target remains in range → the chain ends early.
 * 44-pre-b — distance is to the nearest FOOTPRINT cell (`cellUnitDistance`), so a
 * big rubble whose body edges into hop range is a valid (and honestly-ranked)
 * hop even when its §39 corner sits outside; 1×1 units are byte-identical.
 *
 * Takes the caster's TEAM (not the caster unit) so a deferred hop — resolved a few
 * ticks after the cast — needn't deref a caster that may have died mid-chain (the
 * caller bails on a dead caster separately; this stays a pure geometry query).
 */
export function nearestChainTarget(
  world: World,
  casterTeam: Team,
  from: GridCoord,
  rangeCells: number,
  exclude: Set<number>,
): Unit | undefined {
  let best: Unit | undefined;
  let bestDist = Infinity;
  for (const u of world.units) {
    if (exclude.has(u.id)) continue;
    if (u.team === casterTeam) continue;
    if (!isCombatTargetable(u)) continue;
    const d = cellUnitDistance(from, u);
    if (d > rangeCells) continue;
    if (d < bestDist) {
      best = u;
      bestDist = d;
    }
  }
  return best;
}

/** A resolved area victim + its per-cell damage multiplier (center 1, ring `ringMultiplier`). */
export interface AreaVictim {
  unit: Unit;
  mult: number;
}

/**
 * Resolve an `aoe` selector to its victims at fire time: the targetable units in
 * the shape, filtered by `affects` (relative to the caster), each tagged with its
 * center-vs-ring damage multiplier. Reproduces MagicBolt's blast set + order
 * (same-team / neutral / dead skipped, `world.units` order, center full / ring
 * scaled). 44-pre-b — the multiplier is the unit's BEST covered cell: any
 * footprint cell on the center takes 1, else ring (`cellUnitDistance === 0` ⇔
 * the body covers the center). Byte-identical for 1×1 units.
 */
export function resolveAreaVictims(
  world: World,
  caster: Unit,
  center: GridCoord,
  params: { shape: 'square' | 'line' | 'cross'; radius: number; ringMultiplier: number; affects: Affects },
): AreaVictim[] {
  const cells = cellsForAoeShape(params.shape, center, params.radius);
  return unitsInCells(world, cells)
    .filter((u) => isCombatTargetable(u) && affectsMatch(params.affects, u.team, caster.team))
    .map((u) => ({ unit: u, mult: cellUnitDistance(center, u) === 0 ? 1 : params.ringMultiplier }));
}
