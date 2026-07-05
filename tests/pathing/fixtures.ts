/**
 * §42b — hand-authored TEST fixtures for the movement-metrics harness (the
 * ROADMAP fixture-map set: a symmetric open field, a straight corridor, and a
 * two-crossing "river" abstraction). These are NOT shipped layouts — they're
 * controlled geometries where the metric expectations are derivable:
 *
 *   - **open field** — mirrored rows on empty ground. A fair mover nets
 *     lateral drift ≈ 0 here; the §43 exit criterion asserts exactly that.
 *   - **corridor** — a 1-wide east-west corridor with a throughput gate.
 *     Queueing/following quality shows up as gate crossings per 100 ticks.
 *   - **river fork** — a wall band with TWO symmetric gaps: min-cost paths
 *     through either gap tie, so the fixture isolates what the A* tie-break
 *     (not tactics) decides — the River-drift amplifier.
 *
 * All fixture units are ability-less melee movers (pure locomotion study):
 * battles never resolve, so runs are tick-capped by the harness. Mirrors the
 * MovementBehavior.test scene idiom — units pushed directly with hand ids.
 */

import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import { World } from '../../src/sim/World';
import { Unit, type Team, type UnitStats } from '../../src/sim/Unit';
import { deriveStats, inertDerived } from '../../src/sim/stats';
import { ARCHETYPE_CONFIG } from '../../src/sim/archetypes';
import { MovementBehavior } from '../../src/sim/behaviors/MovementBehavior';
import type { GameEvents } from '../../src/core/events';
import type { GridCoord } from '../../src/core/types';
import type { MetricsConfig } from './metrics';

export interface FixtureUnit {
  team: Team;
  x: number;
  y: number;
  /** Static blocker / target — no MovementBehavior attached. */
  inert?: boolean;
  moveCooldownTicks?: number;
}

export interface Scenario {
  world: World;
  bus: EventBus<GameEvents>;
  units: Unit[];
  config: MetricsConfig;
}

export function buildScenario(
  specs: FixtureUnit[],
  opts: { seed?: number; gridW?: number; gridH?: number; config?: MetricsConfig } = {},
): Scenario {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(opts.seed ?? 1), opts.gridW, opts.gridH);
  let nextId = 1;
  const units = specs.map((s) => {
    const isNeutral = s.team === 'neutral';
    const stats: UnitStats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, luck: 0 };
    let derived = isNeutral ? inertDerived(1) : deriveStats(stats, 1);
    if (s.moveCooldownTicks !== undefined) {
      derived = { ...derived, moveCooldownTicks: s.moveCooldownTicks };
    }
    const u = new Unit({
      id: nextId++,
      team: s.team,
      archetype: isNeutral ? 'environment' : 'mercenary',
      glyph: isNeutral ? '#' : 'M',
      stats,
      derived,
      position: { x: s.x, y: s.y },
    });
    if (!s.inert && !isNeutral) u.behaviors.push(new MovementBehavior());
    world.units.push(u);
    return u;
  });
  return { world, bus, units, config: opts.config ?? {} };
}

/**
 * Symmetric open field: `perSide` movers per team on mirrored rows of an
 * empty 12×12 board. Point-symmetric by construction, so any nonzero mean
 * lateral drift is algorithmic bias, not geometry.
 */
export function openFieldScenario(perSide = 4, seed = 1): Scenario {
  const specs: FixtureUnit[] = [];
  const x0 = 4; // centered: x = 4..4+perSide-1 on a 12-wide board
  for (let i = 0; i < perSide; i++) {
    specs.push({ team: 'player', x: x0 + i, y: 1, moveCooldownTicks: 2 });
    specs.push({ team: 'enemy', x: x0 + i, y: 10, moveCooldownTicks: 2 });
  }
  return buildScenario(specs, {
    seed,
    config: { forward: { player: { x: 0, y: 1 }, enemy: { x: 0, y: -1 } } },
  });
}

/** The corridor fixture's gate plane: a step crossing x = GATE_X eastward. */
export const CORRIDOR_GATE_X = 8;

/**
 * Straight corridor: `movers` player units queue west of a 1-wide, 8-long
 * tunnel (a solid wall block spanning x = 2..9, all rows except the y = 5
 * passage, on a 14×12 board) toward an inert enemy in the open ground beyond
 * it. The block is SEALED — the tunnel is the only route east — so the gate
 * (eastward crossings of x = 8, inside the tunnel) measures pure column
 * throughput, and mouth contention exercises queue/sidestep decisions.
 */
export function corridorScenario(movers = 3, seed = 1): Scenario {
  const specs: FixtureUnit[] = [];
  for (let x = 2; x <= 9; x++) {
    for (let y = 0; y <= 11; y++) {
      if (y === 5) continue; // the tunnel
      specs.push({ team: 'neutral', x, y, inert: true });
    }
  }
  for (let i = 0; i < movers; i++) {
    specs.push({ team: 'player', x: 1 - Math.floor(i / 3), y: 4 + (i % 3), moveCooldownTicks: 2 });
  }
  specs.push({ team: 'enemy', x: 12, y: 5, inert: true });
  return buildScenario(specs, {
    seed,
    gridW: 14,
    gridH: 12,
    config: {
      forward: { player: { x: 1, y: 0 }, enemy: { x: -1, y: 0 } },
      gate: (from: GridCoord, to: GridCoord) => from.x < CORRIDOR_GATE_X && to.x >= CORRIDOR_GATE_X,
    },
  });
}

/**
 * Two-crossing river abstraction: a wall band across row 6 of a 13×13 board
 * with gaps at x = 2 and x = 10, symmetric about the board's center column
 * (x = 6). Both teams spawn mirror-symmetric about that column, so the WHOLE
 * fixture is left-right symmetric: a fair algorithm routes each unit toward
 * its nearer ford (center-line units genuinely tie) and the per-team mean
 * lateral drift reads ≈ 0. A biased tie-break / sidestep skews the flow to
 * one ford and shows up as a signed drift (negative lateral for the player
 * team = the low-x gap, given forward (0,+1)).
 */
export function riverForkScenario(perSide = 4, seed = 1): Scenario {
  const specs: FixtureUnit[] = [];
  for (let x = 0; x <= 12; x++) {
    if (x === 2 || x === 10) continue; // the two fords
    specs.push({ team: 'neutral', x, y: 6, inert: true });
  }
  // Spawn columns symmetric about x = 6: e.g. perSide 4 → 4,5,7,8; 5 → 4..8.
  const offsets: number[] = [];
  for (let i = 1; offsets.length < perSide; i++) {
    offsets.push(-i, i);
  }
  const columns = (perSide % 2 === 1 ? [0, ...offsets] : offsets)
    .slice(0, perSide)
    .map((o) => 6 + o)
    .sort((a, b) => a - b);
  for (const x of columns) {
    specs.push({ team: 'player', x, y: 1, moveCooldownTicks: 2 });
    specs.push({ team: 'enemy', x, y: 11, moveCooldownTicks: 2 });
  }
  return buildScenario(specs, {
    seed,
    gridW: 13,
    gridH: 13,
    config: { forward: { player: { x: 0, y: 1 }, enemy: { x: 0, y: -1 } } },
  });
}
