/**
 * 54d — terrain-edge hold on crafted fire worlds. Geometry used throughout:
 * a vertical fire strip at x=5 between the player (west) and the enemy
 * (east); candidates on the east side fail the our-side test, candidates on
 * the west tie on enemy distance and resolve row-major (deterministic).
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { World } from '../../sim/World';
import { scaledUnit } from '../../sim/archetypes';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import type { Team } from '../../sim/Unit';
import { TrafficScriptDriver } from '../TrafficScriptDriver';
import { terrainEdgeHold, edgeHoldCell, EDGE_HOLD_MIN_UNITS } from './terrainEdgeHold';

function makeWorld(): World {
  return new World(new EventBus<GameEvents>(), new RNG(1), 12, 12);
}

function spawn(world: World, team: Team, cell: GridCoord) {
  return world.spawnUnit(scaledUnit('mercenary', 1), team, cell, null);
}

/** A full-height fire WALL at x=5 (no end-around — a finite strip's end
 *  cell is a legitimate closer pick, which is exactly what an early draft
 *  of these tests learned the hard way); two approaching mercs west; one
 *  TWO enemies east at CROSSING distance — within the approach window and
 *  at the 55c1 prey-count floor (EDGE_HOLD_MIN_UNITS; strays and campers
 *  are not prey in force — see the prey tests). Candidates exist only at
 *  x=4 (x=6 fails our-side). */
function fireWorld(): World {
  const world = makeWorld();
  for (let y = 0; y < 12; y++) world.tileGrid.setKind({ x: 5, y }, 'fire');
  spawn(world, 'player', { x: 2, y: 4 });
  spawn(world, 'player', { x: 2, y: 6 });
  spawn(world, 'enemy', { x: 8, y: 4 });
  spawn(world, 'enemy', { x: 8, y: 6 });
  return world;
}

describe('terrainEdgeHold', () => {
  it('55a: stays SILENT on a mud wall — an on-enter hazard is a toll booth, not a barrier (fetidPond)', () => {
    const world = makeWorld();
    for (let y = 0; y < 12; y++) world.tileGrid.setKind({ x: 5, y }, 'mud');
    spawn(world, 'player', { x: 2, y: 4 });
    spawn(world, 'player', { x: 2, y: 6 });
    spawn(world, 'enemy', { x: 9, y: 5 });
    expect(terrainEdgeHold.evaluate(world, 'player')).toBeNull();
  });

  it('proposes an engage:tile rally at the near edge of the fire', () => {
    const proposal = terrainEdgeHold.evaluate(fireWorld(), 'player');
    expect(proposal).not.toBeNull();
    if (proposal === null || proposal.mode !== 'engage') throw new Error('unreachable');
    expect(proposal.target.kind).toBe('tile');
    const cell = (proposal.target as Extract<typeof proposal.target, { kind: 'tile' }>).cell;
    // West of the strip (our side), adjacent to it, off the fire itself.
    expect(cell.x).toBe(4);
    expect(cell.y).toBeGreaterThanOrEqual(2);
    expect(cell.y).toBeLessThanOrEqual(8);
  });

  it('is deterministic: the same world yields the same tile', () => {
    const world = fireWorld();
    expect(terrainEdgeHold.evaluate(world, 'player')).toEqual(
      terrainEdgeHold.evaluate(world, 'player'),
    );
  });

  it('stays silent below the unit threshold', () => {
    const world = makeWorld();
    world.tileGrid.setKind({ x: 5, y: 5 }, 'fire'); // a single fire cell
    spawn(world, 'player', { x: 3, y: 5 }); // one approaching unit
    spawn(world, 'player', { x: 0, y: 11 }); // far from the fire — not approaching
    spawn(world, 'enemy', { x: 8, y: 5 }); // two crossers — prey in force,
    spawn(world, 'enemy', { x: 8, y: 4 }); // so the null is OUR threshold's
    expect(EDGE_HOLD_MIN_UNITS).toBeGreaterThan(1); // the case this test pins
    expect(terrainEdgeHold.evaluate(world, 'player')).toBeNull();
  });

  it('55c1: releases when nobody is crossing — a camping enemy is not prey', () => {
    const world = makeWorld();
    for (let y = 0; y < 12; y++) world.tileGrid.setKind({ x: 5, y }, 'fire');
    spawn(world, 'player', { x: 2, y: 4 });
    spawn(world, 'player', { x: 2, y: 6 });
    spawn(world, 'enemy', { x: 10, y: 5 }); // 5 steps out — beyond the window
    expect(terrainEdgeHold.evaluate(world, 'player')).toBeNull();
  });

  it('55c1: enemies already ON the fire are prey (mid-crossing)', () => {
    const world = makeWorld();
    for (let x = 5; x <= 7; x++) {
      for (let y = 0; y < 12; y++) world.tileGrid.setKind({ x, y }, 'fire');
    }
    spawn(world, 'player', { x: 2, y: 4 });
    spawn(world, 'player', { x: 2, y: 6 });
    spawn(world, 'enemy', { x: 7, y: 4 }); // on the far column of the wide strip
    spawn(world, 'enemy', { x: 7, y: 6 });
    const proposal = terrainEdgeHold.evaluate(world, 'player');
    expect(proposal).not.toBeNull();
    if (proposal === null || proposal.mode !== 'engage') throw new Error('unreachable');
    expect((proposal.target as Extract<typeof proposal.target, { kind: 'tile' }>).cell.x).toBe(4);
  });

  it('55c1: one stray crosser among scattered fleers is NOT prey in force (deserters)', () => {
    const world = makeWorld();
    for (let y = 0; y < 12; y++) world.tileGrid.setKind({ x: 5, y }, 'fire');
    spawn(world, 'player', { x: 2, y: 4 });
    spawn(world, 'player', { x: 2, y: 6 });
    spawn(world, 'enemy', { x: 8, y: 5 }); // one committed crosser…
    spawn(world, 'enemy', { x: 11, y: 11 }); // …the rest scattered far away
    expect(EDGE_HOLD_MIN_UNITS).toBeGreaterThan(1); // the floor this test pins
    expect(terrainEdgeHold.evaluate(world, 'player')).toBeNull();
  });

  it('stays silent with no hazard on the map', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 2, y: 4 });
    spawn(world, 'player', { x: 2, y: 6 });
    spawn(world, 'enemy', { x: 9, y: 5 });
    expect(terrainEdgeHold.evaluate(world, 'player')).toBeNull();
  });

  it('stays silent with no living enemies', () => {
    const world = makeWorld();
    for (let y = 0; y < 12; y++) world.tileGrid.setKind({ x: 5, y }, 'fire');
    spawn(world, 'player', { x: 2, y: 4 });
    spawn(world, 'player', { x: 2, y: 6 });
    expect(terrainEdgeHold.evaluate(world, 'player')).toBeNull();
  });

  it('edgeHoldCell never returns a hazard or far-side cell', () => {
    const world = fireWorld();
    const ids = world.units.filter((u) => u.team === 'player').map((u) => u.id);
    const cell = edgeHoldCell(world, 'player', ids);
    expect(cell).not.toBeNull();
    expect(world.tileGrid.kindAt(cell!)).not.toBe('fire');
    expect(cell!.x).toBeLessThan(5); // our side of the strip
  });

  it('drives end-to-end through the REAL registry (the driver emits the rally)', () => {
    const world = fireWorld();
    const driver = new TrafficScriptDriver('player'); // default = TRAFFIC_SCRIPTS
    const commands = driver.decide(world);
    expect(commands).toHaveLength(1);
    expect(commands[0]!.kind).toBe('setObjective');
    if (commands[0]!.kind !== 'setObjective') throw new Error('unreachable');
    expect(commands[0]!.objective.mode).toBe('engage');
  });
});
