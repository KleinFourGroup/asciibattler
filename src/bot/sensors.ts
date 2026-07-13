/**
 * 54b — the traffic-script SENSORS: every read a script's trigger consumes,
 * as pure functions of world STATE (the §54 fork-3 lock). No event-history
 * aggregation, no internal caches, no RNG — each sensor answers identically
 * on a cloned snapshot (§55 rollout-compatibility) and on a resumed run
 * (derive-don't-cache). Thresholds baked here are PROVISIONAL until 54c's
 * trace mining calibrates them against the 53g human commands.
 *
 * The jam sensor is the phase's flagged unknown (worklog §54): the sim's
 * `queue`/`pinned`/`boxed` classifications live inside MovementBehavior's
 * poll and surface only as `unit:moveDecision` EVENTS — deliberately not
 * re-derived here (that would mean re-running the movement proposal). The
 * sensor reads a coarser, local signal instead: "idle, out of acting range,
 * and every progress cell toward my nearest enemy is held by a teammate who
 * isn't vacating soon" — built from the §45 claim/vacancy-ETA machinery.
 * Whether this local read fires where the human actually intervened is
 * exactly what 54c measures.
 */

import type { World } from '../sim/World';
import type { Unit } from '../sim/Unit';
import type { ObjectiveTeam } from '../sim/objective';
import type { GridCoord } from '../core/types';
import type { Archetype } from '../sim/archetypes';
import {
  cellKey,
  cellsOccupiedBy,
  claimantOf,
  distanceBetween,
  unitAt,
  vacancyEtaOf,
} from '../sim/occupancy';
import { tileDef, type TileKind } from '../sim/TileGrid';
import type { StatusDef } from '../sim/effects/statusSchema';
import { statusDef } from '../config/statuses';
import { TILES_CONFIG } from '../config/tiles';
import { secondsToTicks } from '../config';

/** The opposing combat team (neutrals have no objective and no opponent). */
export function opposingTeam(team: ObjectiveTeam): ObjectiveTeam {
  return team === 'player' ? 'enemy' : 'player';
}

/** Living, on-grid units of `team` (world.units never holds the spawn queue). */
export function livingUnits(world: World, team: ObjectiveTeam): Unit[] {
  return world.units.filter((u) => u.team === team && u.currentHp > 0);
}

// ---------------------------------------------------------------------------
// Jam (the unjam script's read)
// ---------------------------------------------------------------------------

/**
 * A teammate blocker counts as "draining soon" when its move flips it off the
 * contested cell within this window — the unit behind it is QUEUED (§45b's
 * productive wait), not jammed. PROVISIONAL; 54c calibrates.
 */
export const JAM_VACANCY_WINDOW_SECONDS = 0.5;
export const JAM_VACANCY_WINDOW_TICKS = secondsToTicks(JAM_VACANCY_WINDOW_SECONDS);

export interface JamRead {
  /** Units judged traffic-jammed this tick (insertion order — deterministic). */
  readonly jammedUnitIds: readonly number[];
  /** jammed / living team units; 0 when the team is empty. */
  readonly jamFraction: number;
}

/**
 * A unit is JAMMED when it (1) has a living enemy but stands OUT of its own
 * acting range, (2) is idle (`activeAction === null` — a mid-move/attack unit
 * is making progress), (3) has at least one passable PROGRESS cell (an 8-way
 * neighbor strictly Chebyshev-closer to its nearest enemy — terrain-boxed
 * units are `no_route`'s problem, not traffic), and (4) every progress cell
 * is occupied or claimed with NO free cell and no teammate blocker vacating
 * inside `JAM_VACANCY_WINDOW_TICKS` — and at least one blocker IS a teammate
 * (an enemy wall of bodies is a fight, not a jam).
 *
 * Approximations, on record: positions are the canonical corner (an N×N
 * enemy's true nearest edge may differ by a cell); the read is local (one
 * step), so a jam around a corner registers only once the column actually
 * stalls. Both acceptable for a TRIGGER — 54c's table is the arbiter.
 */
export function jamRead(world: World, team: ObjectiveTeam): JamRead {
  const own = livingUnits(world, team);
  const enemies = livingUnits(world, opposingTeam(team));
  const jammed: number[] = [];
  if (own.length === 0 || enemies.length === 0) {
    return { jammedUnitIds: jammed, jamFraction: 0 };
  }
  for (const unit of own) {
    if (unit.activeAction !== null) continue;
    // Nearest enemy — first-wins on ties (insertion order, deterministic).
    let nearest = enemies[0]!;
    let best = distanceBetween(unit.position, nearest.position);
    for (const e of enemies) {
      const d = distanceBetween(unit.position, e.position);
      if (d < best) {
        best = d;
        nearest = e;
      }
    }
    if (best <= unit.derived.attackRange) continue; // can act from here
    let sawProgressCell = false;
    let sawFreeCell = false;
    let sawTeammateBlocker = false;
    let sawDrainingTeammate = false;
    for (let dx = -1; dx <= 1 && !sawFreeCell; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const cell = { x: unit.position.x + dx, y: unit.position.y + dy };
        if (cell.x < 0 || cell.y < 0 || cell.x >= world.gridW || cell.y >= world.gridH) continue;
        if (distanceBetween(cell, nearest.position) >= best) continue; // not progress
        if (!tileDef(world.tileGrid.kindAt(cell)).passable) continue;
        sawProgressCell = true;
        const occupant = unitAt(world, cell);
        const claimantId = occupant ? undefined : claimantOf(world, cell);
        const blocker = occupant ?? (claimantId !== undefined ? world.findUnit(claimantId) : undefined);
        if (blocker === undefined) {
          sawFreeCell = true;
          break;
        }
        if (blocker.team === team) {
          sawTeammateBlocker = true;
          const eta = vacancyEtaOf(blocker, world);
          if (eta !== undefined && eta <= JAM_VACANCY_WINDOW_TICKS) sawDrainingTeammate = true;
        }
      }
    }
    if (sawProgressCell && !sawFreeCell && sawTeammateBlocker && !sawDrainingTeammate) {
      jammed.push(unit.id);
    }
  }
  return { jammedUnitIds: jammed, jamFraction: jammed.length / own.length };
}

// ---------------------------------------------------------------------------
// Hazard (the terrain-edge-hold script's read)
// ---------------------------------------------------------------------------

/** A status HARMS when its periodic op deals damage (burn/bleed/poison; the
 *  `heal` kind — rejuvenate — is the beneficial sibling). */
function statusHarms(def: StatusDef): boolean {
  return def.periodic?.op.kind === 'damage';
}

/**
 * Whether standing on / stepping onto `kind` afflicts a unit. MIRRORS the two
 * sim apply sites — keep in lockstep if they change:
 *   - `World.applyTileStatuses`: `fire` sustains `burn` per-tick, HARDCODED by
 *     kind and NOT config-gated (`healing` sustains rejuvenate — beneficial,
 *     not a hazard).
 *   - `World.applyTileEnterEffects`: `TileDef.statusOnEnter` (mud → poison),
 *     gated by `TILES_CONFIG.applyStatusOnEnter` — gate off = no hazard.
 * Impassable tiles (chasm, deep_water) are not hazards: nothing can stand
 * there, and pathing already prices them as walls.
 */
export function isHazardKind(kind: TileKind): boolean {
  if (kind === 'fire') return true;
  const def = tileDef(kind);
  if (!def.passable) return false;
  if (def.statusOnEnter && TILES_CONFIG.applyStatusOnEnter) {
    return statusHarms(statusDef(def.statusOnEnter));
  }
  return false;
}

/** Every hazard cell on the grid, row-major. Pure grid scan — recomputed
 *  per call (tile kinds can change; derive-don't-cache). */
export function hazardCellList(world: World): GridCoord[] {
  const out: GridCoord[] = [];
  for (let y = 0; y < world.gridH; y++) {
    for (let x = 0; x < world.gridW; x++) {
      if (isHazardKind(world.tileGrid.kindAt({ x, y }))) out.push({ x, y });
    }
  }
  return out;
}

/** The `cellKey` set form of `hazardCellList`. */
export function hazardCells(world: World): Set<string> {
  return new Set(hazardCellList(world).map(cellKey));
}

/**
 * Units of `team` within `withinSteps` Chebyshev of a hazard cell AND whose
 * nearest enemy lies on the far side (the hazard sits between: stepping
 * toward the enemy shrinks hazard distance). The terrain-edge-hold trigger's
 * core read: "my advance is about to walk into the fire".
 */
export function unitsApproachingHazard(
  world: World,
  team: ObjectiveTeam,
  withinSteps: number,
): number[] {
  const cells = hazardCellList(world);
  if (cells.length === 0) return [];
  const enemies = livingUnits(world, opposingTeam(team));
  if (enemies.length === 0) return [];
  const out: number[] = [];
  for (const unit of livingUnits(world, team)) {
    let nearestHazard: GridCoord | undefined;
    let hazardDist = Infinity;
    for (const c of cells) {
      const d = distanceBetween(unit.position, c);
      if (d < hazardDist) {
        hazardDist = d;
        nearestHazard = c;
      }
    }
    if (nearestHazard === undefined || hazardDist > withinSteps) continue;
    let enemyDist = Infinity;
    let enemyDistFromHazard = Infinity;
    for (const e of enemies) {
      const d = distanceBetween(unit.position, e.position);
      if (d < enemyDist) {
        enemyDist = d;
        enemyDistFromHazard = distanceBetween(nearestHazard, e.position);
      }
    }
    // The hazard is "between" when the enemy is beyond it on this axis:
    // closing on the enemy means closing on the hazard first.
    if (enemyDistFromHazard < enemyDist) out.push(unit.id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Choke (the choke-hold script's read)
// ---------------------------------------------------------------------------

/**
 * The passable grid's ARTICULATION CELLS (cut vertices of the 8-way
 * passability graph): cells whose loss disconnects some pair of passable
 * cells — corridors, isthmuses, doorways. Passability = tile passability
 * MINUS cells held by living NEUTRAL units: this game's walls / half-cover
 * / §40 rubble are neutral-team Units, not tiles (battleSetup spawns them),
 * so a terrain-only read would see every walled corridor map as an open
 * field. Mobile combatants deliberately DON'T count — bodies move; choke is
 * the arena's shape. Rubble death re-opens cells on the next call
 * (derive-don't-cache — recomputed per call, no setup-time freeze). Pure
 * function of state, deterministic row-major ordering; O(cells) iterative
 * DFS (Hopcroft–Tarjan).
 */
export function chokeCells(world: World): GridCoord[] {
  const w = world.gridW;
  const h = world.gridH;
  const idx = (x: number, y: number) => y * w + x;
  const neutralBlocked = new Set<string>();
  for (const u of world.units) {
    if (u.team !== 'neutral' || u.currentHp <= 0) continue;
    for (const c of cellsOccupiedBy(u)) neutralBlocked.add(cellKey(c));
  }
  const passable: boolean[] = new Array<boolean>(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      passable[idx(x, y)] =
        tileDef(world.tileGrid.kindAt({ x, y })).passable && !neutralBlocked.has(cellKey({ x, y }));
    }
  }
  const disc = new Array<number>(w * h).fill(-1);
  const low = new Array<number>(w * h).fill(0);
  const isCut = new Array<boolean>(w * h).fill(false);
  let timer = 0;

  const neighborsOf = (v: number): number[] => {
    const x = v % w;
    const y = (v - x) / w;
    const out: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = idx(nx, ny);
        if (passable[n]) out.push(n);
      }
    }
    return out;
  };

  // Iterative DFS with an explicit frame stack (recursion would blow on long
  // corridor maps). Standard articulation rule: non-root v is a cut vertex
  // when some child's low >= v's disc; the root when it has 2+ DFS children.
  for (let root = 0; root < w * h; root++) {
    if (!passable[root] || disc[root] !== -1) continue;
    let rootChildren = 0;
    const stack: { v: number; parent: number; nbrs: number[]; i: number }[] = [
      { v: root, parent: -1, nbrs: neighborsOf(root), i: 0 },
    ];
    disc[root] = low[root] = timer++;
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      if (frame.i < frame.nbrs.length) {
        const n = frame.nbrs[frame.i]!;
        frame.i++;
        if (n === frame.parent) continue;
        if (disc[n] !== -1) {
          low[frame.v] = Math.min(low[frame.v]!, disc[n]!);
          continue;
        }
        disc[n] = low[n] = timer++;
        if (frame.v === root) rootChildren++;
        stack.push({ v: n, parent: frame.v, nbrs: neighborsOf(n), i: 0 });
      } else {
        stack.pop();
        const parent = frame.parent;
        if (parent !== -1) {
          low[parent] = Math.min(low[parent]!, low[frame.v]!);
          if (parent !== root && low[frame.v]! >= disc[parent]!) isCut[parent] = true;
        }
      }
    }
    if (rootChildren >= 2) isCut[root] = true;
  }

  const out: GridCoord[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isCut[idx(x, y)]) out.push({ x, y });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Attrition (the attrition-stall script's read)
// ---------------------------------------------------------------------------

export interface AttritionRead {
  /** Σ `effectiveStats.power` over each side's living units — the same
   *  formula as `World.survivorPower` (private there; re-derived here in
   *  lockstep — it IS the pool chip each side deals at the turn boundary). */
  readonly ownPower: number;
  readonly enemyPower: number;
  /** Units currently carrying a DAMAGING periodic status (burn/bleed/poison
   *  — def-resolved by key), per side: attrition already in motion. */
  readonly ownDotCount: number;
  readonly enemyDotCount: number;
}

export function attritionRead(world: World, team: ObjectiveTeam): AttritionRead {
  const sum = (units: Unit[]) => units.reduce((acc, u) => acc + u.effectiveStats.power, 0);
  const dots = (units: Unit[]) =>
    units.filter((u) => u.effects.some((e) => statusHarms(statusDef(e.key)))).length;
  const own = livingUnits(world, team);
  const enemy = livingUnits(world, opposingTeam(team));
  return {
    ownPower: sum(own),
    enemyPower: sum(enemy),
    ownDotCount: dots(own),
    enemyDotCount: dots(enemy),
  };
}

// ---------------------------------------------------------------------------
// Focus-target features (the cohesion-focus script's read)
// ---------------------------------------------------------------------------

/**
 * Raw per-enemy features for 54g's cohesion-focus trigger to weight. The
 * WEIGHTS deliberately don't live here: the frozen `scored` proclivity
 * (tests/fuzz — an anchor arm, unimportable from src by direction anyway)
 * keeps its own model, and 54g sets fresh weights from 54c's table.
 */
export interface FocusTargetFeature {
  readonly unitId: number;
  readonly archetype: Archetype;
  /** currentHp / derived.maxHp — kill proximity. */
  readonly hpFraction: number;
  /** `effectiveStats.power` — the pool chip this unit threatens. */
  readonly power: number;
  readonly attackRange: number;
  /** Chebyshev to the closest living unit of `team` — reachability. */
  readonly distToNearestOwn: number;
}

export function focusTargetFeatures(world: World, team: ObjectiveTeam): FocusTargetFeature[] {
  const own = livingUnits(world, team);
  return livingUnits(world, opposingTeam(team)).map((e) => {
    let dist = Infinity;
    for (const u of own) dist = Math.min(dist, distanceBetween(u.position, e.position));
    return {
      unitId: e.id,
      archetype: e.archetype,
      hpFraction: e.currentHp / e.derived.maxHp,
      power: e.effectiveStats.power,
      attackRange: e.derived.attackRange,
      distToNearestOwn: dist,
    };
  });
}
