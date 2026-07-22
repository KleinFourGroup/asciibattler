/**
 * 54g — cohesion focus on crafted worlds. The artillery premise (catapult
 * reach ≥ FOCUS_MIN_RANGE) is asserted from the spawned unit's own derived
 * stats, not hardcoded — if a rebalance drops catapult reach below the
 * threshold, the premise check fails loudly instead of the suite silently
 * testing nothing.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { World } from '../../sim/World';
import { scaledUnit, type Archetype } from '../../sim/archetypes';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import type { Team } from '../../sim/Unit';
import { TRAFFIC_SCRIPTS, TrafficScriptDriver } from '../TrafficScriptDriver';
import { chokeHold } from './chokeHold';
import { cohesionFocus, FOCUS_MIN_RANGE, FOCUS_MAX_DIST } from './cohesionFocus';

function makeWorld(): World {
  return new World(new EventBus<GameEvents>(), new RNG(1), 12, 12);
}

function spawn(world: World, team: Team, cell: GridCoord, archetype: Archetype = 'mercenary') {
  return world.spawnUnit(scaledUnit(archetype, 1), team, cell, null);
}

describe('cohesionFocus', () => {
  it('premise: a catapult reads as artillery (reach ≥ FOCUS_MIN_RANGE)', () => {
    const world = makeWorld();
    const cat = spawn(world, 'enemy', { x: 6, y: 6 }, 'catapult');
    expect(cat.derived.attackRange).toBeGreaterThanOrEqual(FOCUS_MIN_RANGE);
  });

  it('registry order: choke hold outranks cohesion focus', () => {
    expect(TRAFFIC_SCRIPTS.indexOf(chokeHold)).toBeLessThan(
      TRAFFIC_SCRIPTS.indexOf(cohesionFocus),
    );
  });

  it('proposes a leashed engage on a reachable catapult', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 2, y: 5 });
    const cat = spawn(world, 'enemy', { x: 2 + FOCUS_MAX_DIST, y: 5 }, 'catapult');
    spawn(world, 'enemy', { x: 10, y: 10 }); // a nearer-to-nothing bystander
    expect(cohesionFocus.evaluate(world, 'player')).toEqual({
      mode: 'engage',
      target: { kind: 'enemy', unitId: cat.id },
    });
  });

  it('stays silent when the artillery is out of assassination reach', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 0, y: 0 });
    spawn(world, 'enemy', { x: 0 + FOCUS_MAX_DIST + 2, y: 0 }, 'catapult');
    expect(cohesionFocus.evaluate(world, 'player')).toBeNull();
  });

  it('stays silent with no artillery on the board', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 2, y: 5 });
    spawn(world, 'enemy', { x: 5, y: 5 });
    spawn(world, 'enemy', { x: 6, y: 5 }, 'archer'); // bows are reach 3 — not artillery
    expect(cohesionFocus.evaluate(world, 'player')).toBeNull();
  });

  it('a mage is NOT a true target (the junction lesson — reach 5 < the bar)', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 2, y: 5 });
    const mage = spawn(world, 'enemy', { x: 6, y: 5 }, 'mage');
    expect(mage.derived.attackRange).toBeLessThan(FOCUS_MIN_RANGE); // premise
    expect(cohesionFocus.evaluate(world, 'player')).toBeNull();
  });

  it('picks the one true target: nearest among equal-reach artillery', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 2, y: 5 });
    const near = spawn(world, 'enemy', { x: 5, y: 5 }, 'catapult');
    spawn(world, 'enemy', { x: 7, y: 5 }, 'catapult');
    const proposal = cohesionFocus.evaluate(world, 'player');
    if (proposal === null || proposal.mode !== 'engage') throw new Error('unreachable');
    expect(proposal.target).toEqual({ kind: 'enemy', unitId: near.id });
  });

  it('is deterministic: the same world yields the same target', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 2, y: 5 });
    spawn(world, 'enemy', { x: 6, y: 5 }, 'catapult');
    spawn(world, 'enemy', { x: 6, y: 7 }, 'catapult');
    expect(cohesionFocus.evaluate(world, 'player')).toEqual(
      cohesionFocus.evaluate(world, 'player'),
    );
  });

  it('drives end-to-end through the REAL registry on an open board', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 2, y: 5 });
    spawn(world, 'enemy', { x: 7, y: 5 }, 'catapult');
    const driver = new TrafficScriptDriver('player');
    const commands = driver.decide(world);
    expect(commands).toHaveLength(1);
    if (commands[0]!.kind !== 'setObjective') throw new Error('unreachable');
    expect(commands[0]!.objective.mode).toBe('engage');
  });
});
