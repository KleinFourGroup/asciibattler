/**
 * 54b — per-sensor tests on crafted worlds. Expectations derive from the
 * spawned units' own stats / the config modules (never hardcoded balance
 * arithmetic) and from hand-built tile layouts. The jam sensor's
 * vacancy-ETA drain branch (a blocker mid-move flipping soon) rides §45a's
 * own `vacancyEtaOf` tests — crafting a live in-flight move here would
 * re-test the sim, not the sensor.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { World } from '../sim/World';
import { scaledUnit, type Archetype } from '../sim/archetypes';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Team } from '../sim/Unit';
import { spawnWall } from '../sim/environment';
import { cellKey } from '../sim/occupancy';
import { TILES_CONFIG } from '../config/tiles';
import {
  jamRead,
  isHazardKind,
  hazardCells,
  unitsApproachingHazard,
  chokeCells,
  armiesInContact,
  attritionRead,
  focusTargetFeatures,
} from './sensors';

function makeWorld(w = 12, h = 12): World {
  return new World(new EventBus<GameEvents>(), new RNG(1), w, h);
}

function spawn(world: World, team: Team, cell: GridCoord, archetype: Archetype = 'mercenary') {
  return world.spawnUnit(scaledUnit(archetype, 1), team, cell, null);
}

describe('jamRead', () => {
  it('open field: free progress cells → nobody jammed', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 2, y: 5 });
    spawn(world, 'enemy', { x: 10, y: 5 });
    expect(jamRead(world, 'player')).toEqual({ jammedUnitIds: [], jamFraction: 0 });
  });

  it('every progress cell held by an idle teammate → jammed', () => {
    const world = makeWorld();
    const stuck = spawn(world, 'player', { x: 0, y: 5 });
    // The three cells strictly Chebyshev-closer to the enemy at (10,5).
    spawn(world, 'player', { x: 1, y: 4 });
    spawn(world, 'player', { x: 1, y: 5 });
    spawn(world, 'player', { x: 1, y: 6 });
    spawn(world, 'enemy', { x: 10, y: 5 });
    const read = jamRead(world, 'player');
    // Only the boxed-in rear unit is jammed — the blockers themselves have
    // free progress cells ahead of them.
    expect(read.jammedUnitIds).toEqual([stuck.id]);
    expect(read.jamFraction).toBeCloseTo(1 / 4);
  });

  it('terrain-boxed (impassable tiles) is not traffic → not jammed', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 0, y: 5 });
    spawn(world, 'enemy', { x: 10, y: 5 });
    for (const cell of [{ x: 1, y: 4 }, { x: 1, y: 5 }, { x: 1, y: 6 }]) {
      world.tileGrid.setKind(cell, 'chasm');
    }
    expect(jamRead(world, 'player').jammedUnitIds).toEqual([]);
  });

  it('neutral-wall-boxed (wall UNITS) is not traffic → not jammed', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 0, y: 5 });
    spawn(world, 'enemy', { x: 10, y: 5 });
    for (const cell of [{ x: 1, y: 4 }, { x: 1, y: 5 }, { x: 1, y: 6 }]) {
      spawnWall(world, cell);
    }
    expect(jamRead(world, 'player').jammedUnitIds).toEqual([]);
  });

  it('a unit already in acting range is never jammed', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 0, y: 5 }); // melee, range 1
    // Adjacent enemy: in range → skipped even though teammates box it in.
    spawn(world, 'enemy', { x: 1, y: 5 });
    spawn(world, 'player', { x: 1, y: 4 });
    spawn(world, 'player', { x: 1, y: 6 });
    spawn(world, 'player', { x: 0, y: 4 });
    spawn(world, 'player', { x: 0, y: 6 });
    expect(jamRead(world, 'player').jammedUnitIds).toEqual([]);
  });

  it('no living enemies → empty read', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 2, y: 2 });
    expect(jamRead(world, 'player')).toEqual({ jammedUnitIds: [], jamFraction: 0 });
  });
});

describe('hazard sensors', () => {
  it('classifies kinds by the sim’s real apply rules', () => {
    expect(isHazardKind('fire')).toBe(true); // hardcoded sustain, ungated
    expect(isHazardKind('healing')).toBe(false); // beneficial sustain
    expect(isHazardKind('floor')).toBe(false);
    expect(isHazardKind('chasm')).toBe(false); // impassable — priced as a wall
    expect(isHazardKind('deep_water')).toBe(false);
    // mud→poison is gated by the config flag — the expectation DERIVES from
    // the flag (flag off would legitimately make mud safe).
    expect(isHazardKind('mud')).toBe(TILES_CONFIG.applyStatusOnEnter);
  });

  it('hazardCells scans the grid', () => {
    const world = makeWorld(6, 6);
    world.tileGrid.setKind({ x: 2, y: 3 }, 'fire');
    world.tileGrid.setKind({ x: 4, y: 1 }, 'fire');
    const cells = hazardCells(world);
    expect(cells.has(cellKey({ x: 2, y: 3 }))).toBe(true);
    expect(cells.has(cellKey({ x: 4, y: 1 }))).toBe(true);
    expect(cells.size).toBe(2);
  });

  it('flags units whose advance crosses the hazard, not units past it', () => {
    const world = makeWorld();
    // A fire strip between the approaching unit and the enemy.
    for (const y of [4, 5, 6]) world.tileGrid.setKind({ x: 4, y }, 'fire');
    const approaching = spawn(world, 'player', { x: 2, y: 5 });
    spawn(world, 'enemy', { x: 8, y: 5 });
    expect(unitsApproachingHazard(world, 'player', 3)).toEqual([approaching.id]);
  });

  it('a hazard BEHIND the unit does not flag it', () => {
    const world = makeWorld();
    world.tileGrid.setKind({ x: 0, y: 5 }, 'fire');
    spawn(world, 'player', { x: 2, y: 5 });
    spawn(world, 'enemy', { x: 8, y: 5 });
    expect(unitsApproachingHazard(world, 'player', 3)).toEqual([]);
  });

  it('a hazard outside the step window does not flag', () => {
    const world = makeWorld();
    world.tileGrid.setKind({ x: 6, y: 5 }, 'fire');
    spawn(world, 'player', { x: 1, y: 5 });
    spawn(world, 'enemy', { x: 9, y: 5 });
    expect(unitsApproachingHazard(world, 'player', 3)).toEqual([]);
  });
});

describe('chokeCells', () => {
  it('an open rectangle has no articulation cells', () => {
    expect(chokeCells(makeWorld(8, 6))).toEqual([]);
  });

  it('finds the single-cell doorway between two rooms (impassable tiles)', () => {
    const world = makeWorld(9, 5);
    for (let y = 0; y < 5; y++) {
      if (y !== 2) world.tileGrid.setKind({ x: 4, y }, 'chasm');
    }
    expect(chokeCells(world)).toEqual([{ x: 4, y: 2 }]);
  });

  it('finds the doorway when the walls are NEUTRAL UNITS (the real-map shape)', () => {
    const world = makeWorld(9, 5);
    for (let y = 0; y < 5; y++) {
      if (y !== 2) spawnWall(world, { x: 4, y });
    }
    expect(chokeCells(world)).toEqual([{ x: 4, y: 2 }]);
  });

  it('every interior cell of a 1-wide corridor is a choke', () => {
    const world = makeWorld(5, 3);
    for (const x of [0, 1, 2, 3, 4]) {
      world.tileGrid.setKind({ x, y: 0 }, 'chasm');
      world.tileGrid.setKind({ x, y: 2 }, 'chasm');
    }
    expect(chokeCells(world)).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
  });
});

describe('attritionRead', () => {
  it('sums living effective power per side (the survivorPower formula)', () => {
    const world = makeWorld();
    const a = spawn(world, 'player', { x: 1, y: 1 });
    const b = spawn(world, 'player', { x: 1, y: 3 }, 'ranged');
    const e = spawn(world, 'enemy', { x: 10, y: 10 });
    const dead = spawn(world, 'enemy', { x: 10, y: 8 });
    dead.currentHp = 0;
    const read = attritionRead(world, 'player');
    // Derived from the spawned units' own stats — never hardcoded.
    expect(read.ownPower).toBe(a.effectiveStats.power + b.effectiveStats.power);
    expect(read.enemyPower).toBe(e.effectiveStats.power);
    expect(read.ownDotCount).toBe(0);
    expect(read.enemyDotCount).toBe(0);
  });

  it('counts damaging DoTs but not the healing periodic', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 1, y: 1 });
    const burning = spawn(world, 'enemy', { x: 10, y: 10 });
    world.tileGrid.setKind(burning.position, 'fire');
    const healed = spawn(world, 'player', { x: 1, y: 5 });
    world.tileGrid.setKind(healed.position, 'healing');
    world.tick(); // one tick: the tile sustains apply burn + rejuvenate
    const read = attritionRead(world, 'player');
    expect(read.enemyDotCount).toBe(1); // burn = damage periodic
    expect(read.ownDotCount).toBe(0); // rejuvenate = heal periodic, not a DoT
  });
});

describe('armiesInContact', () => {
  it('reads contact by EITHER side own reach — a bow in range is contact even when melee cannot answer', () => {
    const world = makeWorld();
    const merc = spawn(world, 'player', { x: 1, y: 5 });
    const bow = spawn(world, 'enemy', { x: 4, y: 5 }, 'ranged');
    // Premises derived from the units' own stats (never hardcoded): the gap
    // exceeds the merc's reach but sits inside the bow's.
    const gap = 3; // Chebyshev between (1,5) and (4,5) by construction
    expect(gap).toBeGreaterThan(merc.derived.attackRange);
    expect(gap).toBeLessThanOrEqual(bow.derived.attackRange);
    expect(armiesInContact(world, 'player')).toBe(true);
    expect(armiesInContact(world, 'enemy')).toBe(true); // symmetric by definition
  });

  it('reads disengaged when the separation exceeds every reach', () => {
    const world = makeWorld();
    const merc = spawn(world, 'player', { x: 1, y: 5 });
    const enemy = spawn(world, 'enemy', { x: 10, y: 5 });
    expect(9).toBeGreaterThan(merc.derived.attackRange); // premise
    expect(9).toBeGreaterThan(enemy.derived.attackRange); // premise
    expect(armiesInContact(world, 'player')).toBe(false);
  });
});

describe('focusTargetFeatures', () => {
  it('extracts per-enemy features from unit state', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 0, y: 0 });
    const near = spawn(world, 'enemy', { x: 3, y: 3 });
    const far = spawn(world, 'enemy', { x: 9, y: 9 }, 'ranged');
    far.currentHp = far.derived.maxHp / 2;
    const features = focusTargetFeatures(world, 'player');
    expect(features).toEqual([
      {
        unitId: near.id,
        archetype: 'mercenary',
        hpFraction: 1,
        power: near.effectiveStats.power,
        attackRange: near.derived.attackRange,
        distToNearestOwn: 3,
      },
      {
        unitId: far.id,
        archetype: 'ranged',
        hpFraction: 0.5,
        power: far.effectiveStats.power,
        attackRange: far.derived.attackRange,
        distToNearestOwn: 9,
      },
    ]);
  });

  it('returns empty with no living enemies', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 0, y: 0 });
    expect(focusTargetFeatures(world, 'player')).toEqual([]);
  });
});
