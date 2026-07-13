/**
 * 54e — unjam on crafted jam worlds. The jam geometry reuses the 54b
 * sensor-test shape: a rear unit boxed at the map edge by three idle
 * teammates, enemy across the map (jamFraction 1/4 = 0.25 ≥ the 0.2
 * trigger). The regroup tile must never rally FORWARD (closer to the
 * enemy than the jammed centroid) and never onto a hazard.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { World } from '../../sim/World';
import { scaledUnit } from '../../sim/archetypes';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import type { Team } from '../../sim/Unit';
import { distanceBetween } from '../../sim/occupancy';
import { TRAFFIC_SCRIPTS, TrafficScriptDriver } from '../TrafficScriptDriver';
import { terrainEdgeHold } from './terrainEdgeHold';
import { unjam, regroupCell, UNJAM_MIN_FRACTION } from './unjam';
import { jamRead } from '../sensors';

function makeWorld(): World {
  return new World(new EventBus<GameEvents>(), new RNG(1), 12, 12);
}

function spawn(world: World, team: Team, cell: GridCoord) {
  return world.spawnUnit(scaledUnit('mercenary', 1), team, cell, null);
}

/** The 54b jam shape: `stuck` boxed at (0,5) by three idle teammates. */
function jamWorld(): { world: World; stuckId: number } {
  const world = makeWorld();
  const stuck = spawn(world, 'player', { x: 0, y: 5 });
  spawn(world, 'player', { x: 1, y: 4 });
  spawn(world, 'player', { x: 1, y: 5 });
  spawn(world, 'player', { x: 1, y: 6 });
  spawn(world, 'enemy', { x: 10, y: 5 });
  return { world, stuckId: stuck.id };
}

describe('unjam', () => {
  it('registry order: safety first — terrain-edge hold outranks unjam', () => {
    expect(TRAFFIC_SCRIPTS.indexOf(terrainEdgeHold)).toBeLessThan(
      TRAFFIC_SCRIPTS.indexOf(unjam),
    );
  });

  it('proposes an engage:tile regroup when the jam fraction clears the trigger', () => {
    const { world } = jamWorld();
    expect(jamRead(world, 'player').jamFraction).toBeGreaterThanOrEqual(UNJAM_MIN_FRACTION);
    const proposal = unjam.evaluate(world, 'player');
    expect(proposal).not.toBeNull();
    if (proposal === null || proposal.mode !== 'engage') throw new Error('unreachable');
    expect(proposal.target.kind).toBe('tile');
    const cell = (proposal.target as Extract<typeof proposal.target, { kind: 'tile' }>).cell;
    // Never a forward rally: no closer to the enemy than the jammed centroid.
    const enemy = { x: 10, y: 5 };
    expect(distanceBetween(cell, enemy)).toBeGreaterThanOrEqual(
      distanceBetween({ x: 0, y: 5 }, enemy),
    );
    // Unoccupied, on the board, and passable by construction — spot-check it
    // isn't one of the occupied cells.
    expect([{ x: 0, y: 5 }, { x: 1, y: 4 }, { x: 1, y: 5 }, { x: 1, y: 6 }]).not.toContainEqual(
      cell,
    );
  });

  it('is deterministic: the same world yields the same tile', () => {
    const { world } = jamWorld();
    expect(unjam.evaluate(world, 'player')).toEqual(unjam.evaluate(world, 'player'));
  });

  it('stays silent below the trigger (an open-field team is never jammed)', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 2, y: 5 });
    spawn(world, 'player', { x: 2, y: 7 });
    spawn(world, 'enemy', { x: 10, y: 5 });
    expect(jamRead(world, 'player').jamFraction).toBe(0);
    expect(unjam.evaluate(world, 'player')).toBeNull();
  });

  it('rallies OUTSIDE enemy reach when artillery covers part of the field', () => {
    const world = makeWorld();
    const stuck = spawn(world, 'player', { x: 0, y: 5 });
    spawn(world, 'player', { x: 1, y: 4 });
    spawn(world, 'player', { x: 1, y: 5 });
    spawn(world, 'player', { x: 1, y: 6 });
    const cat = world.spawnUnit(scaledUnit('catapult', 1), 'enemy', { x: 10, y: 5 }, null);
    const cell = regroupCell(world, 'player', [stuck.id]);
    expect(cell).not.toBeNull();
    // Strictly beyond the catapult's reach — the amendment's contract.
    expect(distanceBetween(cell!, cat.position)).toBeGreaterThan(cat.derived.attackRange);
  });

  it('stands on the null action under TOTAL fire coverage (never falls back through it)', () => {
    const world = makeWorld();
    const stuck = spawn(world, 'player', { x: 0, y: 5 });
    spawn(world, 'player', { x: 1, y: 4 });
    spawn(world, 'player', { x: 1, y: 5 });
    spawn(world, 'player', { x: 1, y: 6 });
    // A catapult at board center: reach 6 covers every cell of a 12×12.
    const cat = world.spawnUnit(scaledUnit('catapult', 1), 'enemy', { x: 6, y: 5 }, null);
    expect(cat.derived.attackRange).toBeGreaterThanOrEqual(6); // premise
    expect(regroupCell(world, 'player', [stuck.id])).toBeNull();
    expect(unjam.evaluate(world, 'player')).toBeNull();
  });

  it('never rallies onto a hazard tile', () => {
    const { world, stuckId } = jamWorld();
    // Carpet the whole fall-back half with fire except one safe plaza cell —
    // the regroup must land on the safe cell or nowhere.
    for (let x = 0; x <= 4; x++) {
      for (let y = 0; y < 12; y++) {
        world.tileGrid.setKind({ x, y }, 'fire');
      }
    }
    world.tileGrid.setKind({ x: 0, y: 0 }, 'floor');
    const cell = regroupCell(world, 'player', [stuckId]);
    if (cell !== null) {
      expect(world.tileGrid.kindAt(cell)).not.toBe('fire');
    }
  });

  it('drives end-to-end through the REAL registry on a jam world', () => {
    const { world } = jamWorld();
    const driver = new TrafficScriptDriver('player');
    const commands = driver.decide(world);
    expect(commands).toHaveLength(1);
    if (commands[0]!.kind !== 'setObjective') throw new Error('unreachable');
    expect(commands[0]!.objective.mode).toBe('engage');
  });
});
