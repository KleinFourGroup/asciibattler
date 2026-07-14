/**
 * 54h — attrition stall on crafted DoT worlds. The positive-path worlds
 * poison an enemy DIRECTLY (`applyStatusEffect`) — a non-terrain DoT is the
 * script's actual domain: a burn from a fire TILE reads as hazard-between
 * and correctly DEFERS to terrain-edge hold (the option-A lock, pinned
 * below). Premises are read back through `attritionRead` (balance-proof
 * style — never hardcoded stat arithmetic). The stand-off tile must never
 * advance on the enemy, never land on a hazard, and respect the
 * artillery-only under-fire filter (the 54e-amendment contract).
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { World } from '../../sim/World';
import { scaledUnit, type Archetype } from '../../sim/archetypes';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import type { Team } from '../../sim/Unit';
import { distanceBetween } from '../../sim/occupancy';
import { TRAFFIC_SCRIPTS, TrafficScriptDriver } from '../TrafficScriptDriver';
import { cohesionFocus } from './cohesionFocus';
import {
  attritionStall,
  standOffCell,
  STALL_MIN_ENEMY_DOTS,
  STALL_MIN_POWER_DELTA,
} from './attritionStall';
import { armiesInContact, attritionRead, hazardCellList } from '../sensors';
import { statusDef } from '../../config/statuses';

function makeWorld(): World {
  return new World(new EventBus<GameEvents>(), new RNG(1), 12, 12);
}

function spawn(
  world: World,
  team: Team,
  cell: GridCoord,
  archetype: Archetype = 'mercenary',
  level = 1,
) {
  return world.spawnUnit(scaledUnit(archetype, level), team, cell, null);
}

/** The stall shape: two mercs vs one POISONED enemy merc across an open
 *  field — power advantage by construction, no terrain in play (the
 *  script's real domain post-deferral). The lone mercenary enemy keeps
 *  every HIGHER-priority script null: no hazard anywhere (edge hold), no
 *  jam, enemies < 2 (choke), reach < artillery (focus). */
function stallWorld(): { world: World; enemyCell: GridCoord } {
  const world = makeWorld();
  spawn(world, 'player', { x: 1, y: 4 });
  spawn(world, 'player', { x: 1, y: 6 });
  const enemy = spawn(world, 'enemy', { x: 10, y: 5 });
  world.applyStatusEffect(enemy, statusDef('poison'), null);
  return { world, enemyCell: { x: 10, y: 5 } };
}

describe('attritionStall', () => {
  it('registry order: opportunism last — attrition stall is the final script', () => {
    expect(TRAFFIC_SCRIPTS.indexOf(cohesionFocus)).toBeLessThan(
      TRAFFIC_SCRIPTS.indexOf(attritionStall),
    );
    expect(TRAFFIC_SCRIPTS[TRAFFIC_SCRIPTS.length - 1]).toBe(attritionStall);
  });

  it('proposes an engage:tile stand-off when the stall signature reads', () => {
    const { world, enemyCell } = stallWorld();
    // Premise, read back through the sensor (never hardcoded arithmetic).
    const read = attritionRead(world, 'player');
    expect(read.enemyDotCount).toBeGreaterThanOrEqual(STALL_MIN_ENEMY_DOTS);
    expect(read.ownPower - read.enemyPower).toBeGreaterThanOrEqual(STALL_MIN_POWER_DELTA);

    const proposal = attritionStall.evaluate(world, 'player');
    expect(proposal).not.toBeNull();
    if (proposal === null || proposal.mode !== 'engage') throw new Error('unreachable');
    expect(proposal.target.kind).toBe('tile');
    const cell = (proposal.target as Extract<typeof proposal.target, { kind: 'tile' }>).cell;
    // Refuse, never advance: the stand-off is no closer to the enemy than
    // the own-army centroid (x:1, y:5 by construction).
    expect(distanceBetween(cell, enemyCell)).toBeGreaterThanOrEqual(
      distanceBetween({ x: 1, y: 5 }, enemyCell),
    );
  });

  it('DEFERS to terrain-edge hold whenever ANY hazard exists on the map (option A)', () => {
    // The old fire-crafted shape: a burning enemy on a fire map. Terrain in
    // play is edge-hold's domain WHOLESALE — a narrower "hazard between the
    // armies" deferral still leaked in the post-crossing windows, where
    // standing pat while the crossers' burns expire wastes the finish
    // (worklog §54h). The stall must stand down on the whole map.
    const world = makeWorld();
    spawn(world, 'player', { x: 1, y: 4 });
    spawn(world, 'player', { x: 1, y: 6 });
    const enemy = spawn(world, 'enemy', { x: 10, y: 5 });
    world.tileGrid.setKind(enemy.position, 'fire');
    world.tick(); // the tile sustain applies burn
    // Premises: the raw stall signature reads, disengaged, terrain in play.
    const read = attritionRead(world, 'player');
    expect(read.enemyDotCount).toBeGreaterThanOrEqual(STALL_MIN_ENEMY_DOTS);
    expect(read.ownPower - read.enemyPower).toBeGreaterThanOrEqual(STALL_MIN_POWER_DELTA);
    expect(armiesInContact(world, 'player')).toBe(false);
    expect(hazardCellList(world).length).toBeGreaterThan(0);
    expect(attritionStall.evaluate(world, 'player')).toBeNull();
  });

  it('is deterministic: the same world yields the same tile', () => {
    const { world } = stallWorld();
    expect(attritionStall.evaluate(world, 'player')).toEqual(
      attritionStall.evaluate(world, 'player'),
    );
  });

  it('stays silent when no enemy carries a DoT', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 1, y: 4 });
    spawn(world, 'player', { x: 1, y: 6 });
    spawn(world, 'enemy', { x: 10, y: 5 });
    world.tick();
    expect(attritionRead(world, 'player').enemyDotCount).toBe(0);
    expect(attritionStall.evaluate(world, 'player')).toBeNull();
  });

  it('stays silent once the fight is joined (the contact gate — the 54h amendment)', () => {
    const world = makeWorld();
    const merc = spawn(world, 'player', { x: 1, y: 4 });
    spawn(world, 'player', { x: 1, y: 6 });
    const poisoned = spawn(world, 'enemy', { x: 10, y: 5 });
    const brawler = spawn(world, 'enemy', { x: 2, y: 5 }); // adjacent — contact
    world.applyStatusEffect(poisoned, statusDef('poison'), null);
    // Premises: the stall signature reads, but the brawl is already joined.
    const read = attritionRead(world, 'player');
    expect(read.enemyDotCount).toBeGreaterThanOrEqual(STALL_MIN_ENEMY_DOTS);
    expect(read.ownPower - read.enemyPower).toBeGreaterThanOrEqual(STALL_MIN_POWER_DELTA);
    expect(distanceBetween(merc.position, brawler.position)).toBeLessThanOrEqual(
      merc.derived.attackRange,
    );
    expect(armiesInContact(world, 'player')).toBe(true);
    expect(attritionStall.evaluate(world, 'player')).toBeNull();
  });

  it('stays silent from weakness: a burning enemy we do NOT out-power is a fight, not a stall', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 1, y: 5 });
    const e1 = spawn(world, 'enemy', { x: 10, y: 4 }, 'mercenary', 5);
    spawn(world, 'enemy', { x: 10, y: 6 }, 'mercenary', 5);
    world.applyStatusEffect(e1, statusDef('poison'), null);
    const read = attritionRead(world, 'player');
    expect(read.enemyDotCount).toBeGreaterThanOrEqual(STALL_MIN_ENEMY_DOTS); // premise: burning
    expect(read.ownPower - read.enemyPower).toBeLessThan(STALL_MIN_POWER_DELTA); // premise: losing
    expect(attritionStall.evaluate(world, 'player')).toBeNull();
  });

  it('stands off OUTSIDE artillery reach (the 54e-amendment filter)', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 1, y: 4 });
    spawn(world, 'player', { x: 1, y: 6 });
    spawn(world, 'player', { x: 2, y: 5 });
    // A catapult at (7,5): reach 6 covers everything but the x=0 column —
    // the only legal stand-off cells sit strictly beyond its reach.
    const cat = world.spawnUnit(scaledUnit('catapult', 1), 'enemy', { x: 7, y: 5 }, null);
    expect(cat.derived.attackRange).toBeGreaterThanOrEqual(6); // premise
    const cell = standOffCell(world, 'player');
    expect(cell).not.toBeNull();
    expect(distanceBetween(cell!, cat.position)).toBeGreaterThan(cat.derived.attackRange);
  });

  it('stands on the null action under TOTAL artillery coverage', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 1, y: 4 });
    spawn(world, 'player', { x: 1, y: 6 });
    // A catapult at board center: reach 6 covers every cell of a 12×12.
    const cat = world.spawnUnit(scaledUnit('catapult', 1), 'enemy', { x: 6, y: 5 }, null);
    expect(cat.derived.attackRange).toBeGreaterThanOrEqual(6); // premise
    expect(standOffCell(world, 'player')).toBeNull();
    world.applyStatusEffect(cat, statusDef('poison'), null);
    // Poisoned artillery — null twice over: reach 6 over the whole board
    // means the fight is joined (contact gate) AND no legal stand-off
    // exists (the standOffCell assertion above pins the coverage null alone).
    expect(attritionStall.evaluate(world, 'player')).toBeNull();
  });

  it('never stands off onto a hazard tile', () => {
    const { world } = stallWorld();
    // Carpet the own half with fire except one safe plaza cell.
    for (let x = 0; x <= 5; x++) {
      for (let y = 0; y < 12; y++) {
        world.tileGrid.setKind({ x, y }, 'fire');
      }
    }
    world.tileGrid.setKind({ x: 0, y: 0 }, 'floor');
    const cell = standOffCell(world, 'player');
    if (cell !== null) {
      expect(world.tileGrid.kindAt(cell)).not.toBe('fire');
    }
  });

  it('drives end-to-end through the REAL registry on a stall world', () => {
    const { world } = stallWorld();
    const driver = new TrafficScriptDriver('player');
    const commands = driver.decide(world);
    expect(commands).toHaveLength(1);
    if (commands[0]!.kind !== 'setObjective') throw new Error('unreachable');
    expect(commands[0]!.objective.mode).toBe('engage');
  });
});
