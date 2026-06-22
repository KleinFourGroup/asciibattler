/**
 * Phase Y2 — target/area resolution for the effect interpreter.
 *
 * The targeting axis (the brief's first axis): WHO an op resolves to. Single-
 * target selectors (`enemyInRange` / `lowestHpAlly` / `self`) resolve to one unit
 * at propose time (Y3); the `aoe` selector resolves to its occupants at FIRE time
 * (impact) — "hit whoever is standing in the cells now" — which is what these
 * helpers do.
 *
 * `unitsInCells` is the **Cluster-2 footprint seam**: today a unit occupies
 * exactly its `position` cell, so an area op is "units whose position is in the
 * cell set." When multi-tile footprints land, this single helper generalizes to
 * "units whose footprint intersects the cells," and every area op is multi-tile-
 * correct for free — no retrofit.
 */

import type { GridCoord } from '../../core/types';
import type { World } from '../World';
import { type Unit, type Team } from '../Unit';
import type { Affects } from './schema';

function cellKey(c: GridCoord): string {
  return `${c.x},${c.y}`;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * The occupants of a cell set, in `world.units` order (so the downstream
 * per-victim event/draw order is the same deterministic order MagicBolt's
 * `world.units.slice()` loop used). The Cluster-2 footprint seam (see header).
 */
export function unitsInCells(world: World, cells: Iterable<GridCoord>): Unit[] {
  const keys = new Set<string>();
  for (const c of cells) keys.add(cellKey(c));
  return world.units.filter((u) => keys.has(cellKey(u.position)));
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
 * Is a unit a valid combat-damage target TODAY? Alive, and not a neutral
 * wall/half-cover (destructibility is deferred to Cluster 2 — when neutrals gain
 * HP, this guard drops and `affects:'enemies'` chews them automatically).
 */
export function isCombatTargetable(u: Unit): boolean {
  return u.currentHp > 0 && u.team !== 'neutral';
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
 * scaled).
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
    .map((u) => ({ unit: u, mult: chebyshev(u.position, center) === 0 ? 1 : params.ringMultiplier }));
}
