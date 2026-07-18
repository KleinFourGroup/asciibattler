/**
 * 57g.4 — the audition-everyone arm's pins, in one home (the arm is one
 * feature; its per-script rationale lives in each script file). Each
 * nominate pin sits exactly at its script's evaluate-null boundary: the
 * crafted world makes `evaluate` return null (a go/no-go threshold holds
 * the trigger cold) while `nominate` proposes (the geometry is
 * well-formed) — the semantic core of propose-regardless. Premises are
 * read back through the sensors (balance-proof style), never hardcoded.
 *
 * The registry pins carry the §57g.1 baseline-parity guard: the searcher's
 * nomination channel is `nominate ?? evaluate` keyed off the script OBJECT,
 * so TRAFFIC_SCRIPTS must stay nominate-free — if a nominate ever lands on
 * the standard objects, the default `--searcher` arm silently becomes the
 * audition arm and every recorded baseline breaks.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { World } from '../sim/World';
import { scaledUnit, type Archetype } from '../sim/archetypes';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Team } from '../sim/Unit';
import { statusDef } from '../config/statuses';
import { AUDITION_SCRIPTS, TRAFFIC_SCRIPTS } from './TrafficScriptDriver';
import { RolloutSearchDriver } from './RolloutSearchDriver';
import {
  armiesInContact,
  attritionRead,
  hazardCellList,
  jamRead,
  unitsApproachingHazard,
} from './sensors';
import {
  terrainEdgeHold,
  nominateTerrainEdgeHold,
  EDGE_HOLD_APPROACH_STEPS,
  EDGE_HOLD_MIN_UNITS,
} from './scripts/terrainEdgeHold';
import { unjam, nominateUnjam, UNJAM_MIN_FRACTION } from './scripts/unjam';
import { chokeHold, nominateChokeHold, CHOKE_OUTNUMBER_FACTOR } from './scripts/chokeHold';
import { cohesionFocus, nominateCohesionFocus, FOCUS_MAX_DIST } from './scripts/cohesionFocus';
import { attritionStall, nominateAttritionStall } from './scripts/attritionStall';

function makeWorld(): World {
  return new World(new EventBus<GameEvents>(), new RNG(1), 12, 12);
}

function spawn(world: World, team: Team, cell: GridCoord, archetype: Archetype = 'mercenary') {
  return world.spawnUnit(scaledUnit(archetype, 1), team, cell, null);
}

/** The 54f canonical isthmus, at enemy strength BELOW the funnel trade:
 *  deep water splits the map, a 2-wide bridge at x∈{5,6}, 3 enemies north
 *  (3 < 2-cut × CHOKE_OUTNUMBER_FACTOR), players south near the bridge. */
function underTradeIsthmus(): World {
  const world = makeWorld();
  for (const y of [5, 6]) {
    for (let x = 0; x < 12; x++) {
      if (x !== 5 && x !== 6) world.tileGrid.setKind({ x, y }, 'deep_water');
    }
  }
  for (let i = 0; i < 3; i++) spawn(world, 'enemy', { x: 1 + i, y: 1 });
  spawn(world, 'player', { x: 5, y: 8 });
  spawn(world, 'player', { x: 6, y: 8 });
  spawn(world, 'player', { x: 4, y: 9 });
  return world;
}

describe('the audition registry', () => {
  it('mirrors the standard registry: same ids, same order, nominate on every entry', () => {
    expect(AUDITION_SCRIPTS.map((s) => s.id)).toEqual(TRAFFIC_SCRIPTS.map((s) => s.id));
    for (const s of AUDITION_SCRIPTS) expect(s.nominate).toBeDefined();
  });

  it('PARITY GUARD: the standard registry stays nominate-free (the §57g.1 baseline contract)', () => {
    for (const s of TRAFFIC_SCRIPTS) expect(s.nominate).toBeUndefined();
  });
});

describe('nominate at the evaluate-null boundary', () => {
  it('terrain-edge-hold: one approaching unit, zero prey — trigger cold, nomination stands', () => {
    const world = makeWorld();
    for (let y = 0; y < 12; y++) world.tileGrid.setKind({ x: 6, y }, 'fire');
    spawn(world, 'player', { x: 4, y: 5 }); // 2 steps off the fire, enemy beyond it
    spawn(world, 'enemy', { x: 10, y: 5 }); // 4 steps off the fire — not prey
    const approaching = unitsApproachingHazard(world, 'player', EDGE_HOLD_APPROACH_STEPS);
    expect(approaching.length).toBeGreaterThanOrEqual(1); // premise: an anchor exists
    expect(approaching.length).toBeLessThan(EDGE_HOLD_MIN_UNITS); // premise: below the floor
    expect(terrainEdgeHold.evaluate(world, 'player')).toBeNull();
    const proposal = nominateTerrainEdgeHold(world, 'player');
    expect(proposal).not.toBeNull();
    if (proposal === null || proposal.mode !== 'engage') throw new Error('unreachable');
    expect(proposal.target.kind).toBe('tile');
    const cell = (proposal.target as Extract<typeof proposal.target, { kind: 'tile' }>).cell;
    expect(cell.x).toBe(5); // the edge column on OUR side of the fire
  });

  it('unjam: one boxed unit below the 0.2 fraction — trigger cold, nomination stands', () => {
    const world = makeWorld();
    // One unit boxed against the left wall by five teammates; enemy far
    // right. 1 jammed of 6 = 0.167 < the CONFIRMED 0.2 trigger.
    spawn(world, 'player', { x: 0, y: 5 });
    for (const c of [
      { x: 0, y: 4 },
      { x: 0, y: 6 },
      { x: 1, y: 4 },
      { x: 1, y: 5 },
      { x: 1, y: 6 },
    ]) {
      spawn(world, 'player', c);
    }
    spawn(world, 'enemy', { x: 10, y: 5 });
    const jam = jamRead(world, 'player');
    expect(jam.jammedUnitIds.length).toBeGreaterThanOrEqual(1); // premise
    expect(jam.jamFraction).toBeLessThan(UNJAM_MIN_FRACTION); // premise
    expect(unjam.evaluate(world, 'player')).toBeNull();
    expect(nominateUnjam(world, 'player')).not.toBeNull();
  });

  it('choke-hold: a real cut without the funnel trade — trigger cold, nomination stands', () => {
    const world = underTradeIsthmus();
    expect(3).toBeLessThan(2 * CHOKE_OUTNUMBER_FACTOR); // premise: under the trade
    expect(chokeHold.evaluate(world, 'player')).toBeNull();
    const proposal = nominateChokeHold(world, 'player');
    expect(proposal).not.toBeNull();
    if (proposal === null || proposal.mode !== 'engage') throw new Error('unreachable');
    const cell = (proposal.target as Extract<typeof proposal.target, { kind: 'tile' }>).cell;
    expect([5, 6]).toContain(cell.x); // still the bridge plug
  });

  it('cohesion-focus: artillery beyond the assassination leash — trigger cold, nomination stands', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 0, y: 0 });
    const cat = spawn(world, 'enemy', { x: FOCUS_MAX_DIST + 2, y: 0 }, 'catapult');
    expect(cohesionFocus.evaluate(world, 'player')).toBeNull();
    expect(nominateCohesionFocus(world, 'player')).toEqual({
      mode: 'engage',
      target: { kind: 'enemy', unitId: cat.id },
    });
  });

  it('attrition-stall: no DoTs at all — trigger cold, nomination stands (a generic refusal)', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 1, y: 4 });
    spawn(world, 'player', { x: 1, y: 6 });
    spawn(world, 'enemy', { x: 10, y: 5 });
    expect(attritionRead(world, 'player').enemyDotCount).toBe(0); // premise
    expect(attritionStall.evaluate(world, 'player')).toBeNull();
    expect(nominateAttritionStall(world, 'player')).not.toBeNull();
  });

  it('attrition-stall: the hazard deferral is DROPPED under audition (user call, worklog §57g.4)', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 1, y: 4 });
    spawn(world, 'player', { x: 1, y: 6 });
    const enemy = spawn(world, 'enemy', { x: 10, y: 5 });
    world.applyStatusEffect(enemy, statusDef('poison'), null);
    world.tileGrid.setKind({ x: 5, y: 5 }, 'mud'); // terrain in play
    expect(hazardCellList(world).length).toBeGreaterThan(0); // premise
    expect(attritionStall.evaluate(world, 'player')).toBeNull(); // trigger defers
    expect(nominateAttritionStall(world, 'player')).not.toBeNull(); // audition doesn't
  });

  it('attrition-stall: the contact gate is KEPT under audition (the 54h conviction)', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 5, y: 5 });
    spawn(world, 'enemy', { x: 6, y: 5 });
    expect(armiesInContact(world, 'player')).toBe(true); // premise
    expect(nominateAttritionStall(world, 'player')).toBeNull();
  });
});

describe('the A/B seam end-to-end', () => {
  it('standard nomination is silent where audition auditions and commits', () => {
    // The under-trade isthmus: every standard evaluate is null (no hazard,
    // no jam, no trade, no artillery, no DoTs) — the standard searcher has
    // nothing to roll. The audition searcher gets choke-hold's nomination
    // and, with the null floor forced open (ε=-1000, the 57f liveness
    // pattern), must commit it.
    const standard = new RolloutSearchDriver('player', new RNG(7).fork());
    expect(standard.decide(underTradeIsthmus())).toHaveLength(0);

    const audition = new RolloutSearchDriver('player', new RNG(7).fork(), {
      scripts: AUDITION_SCRIPTS,
      epsilon: -1000,
    });
    const commands = audition.decide(underTradeIsthmus());
    expect(commands).toHaveLength(1);
    if (commands[0]!.kind !== 'setObjective') throw new Error('unreachable');
    expect(commands[0]!.objective.mode).toBe('engage');
  });
});
