/**
 * 54f — armyMinCut + choke hold on crafted isthmus worlds. The canonical
 * geometry: deep water splits the 12×12 map into north/south halves with a
 * 2-wide land bridge at x∈{5,6} — the shape the articulation scan is blind
 * to (no single cell disconnects a 2-wide bridge; the 54c sensor gap).
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { World } from '../../sim/World';
import { scaledUnit } from '../../sim/archetypes';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import type { Team } from '../../sim/Unit';
import { TRAFFIC_SCRIPTS, TrafficScriptDriver } from '../TrafficScriptDriver';
import { armyMinCut, chokeCells } from '../sensors';
import { unjam } from './unjam';
import {
  chokeHold,
  chokeMemoStats,
  computeChokeRead,
  nominateChokeHold,
  CHOKE_MAX_CUT,
} from './chokeHold';

function makeWorld(): World {
  return new World(new EventBus<GameEvents>(), new RNG(1), 12, 12);
}

function spawn(world: World, team: Team, cell: GridCoord) {
  return world.spawnUnit(scaledUnit('mercenary', 1), team, cell, null);
}

/** Water rows y∈[5,6] except the bridge columns x∈{5,6}. Enemies north,
 *  player south (nearer the bridge — the cut must read as OUR side). */
function isthmusWorld(enemyCount = 6): World {
  const world = makeWorld();
  for (const y of [5, 6]) {
    for (let x = 0; x < 12; x++) {
      if (x !== 5 && x !== 6) world.tileGrid.setKind({ x, y }, 'deep_water');
    }
  }
  for (let i = 0; i < enemyCount; i++) spawn(world, 'enemy', { x: 1 + i, y: 1 });
  spawn(world, 'player', { x: 5, y: 8 });
  spawn(world, 'player', { x: 6, y: 8 });
  spawn(world, 'player', { x: 4, y: 9 });
  return world;
}

describe('armyMinCut', () => {
  it('finds the 2-wide bridge the articulation scan is blind to', () => {
    const world = isthmusWorld();
    expect(chokeCells(world)).toEqual([]); // the 54c gap, pinned
    const cut = armyMinCut(world, 'player', CHOKE_MAX_CUT);
    expect(cut).not.toBeNull();
    expect(cut!.length).toBe(2);
    for (const c of cut!) {
      expect([5, 6]).toContain(c.x); // on the bridge
      expect([4, 5, 6, 7]).toContain(c.y); // across it, not along the banks
    }
  });

  it('returns null on open ground (early bail)', () => {
    const world = makeWorld();
    for (let i = 0; i < 4; i++) spawn(world, 'enemy', { x: 1 + i, y: 1 });
    spawn(world, 'player', { x: 5, y: 10 });
    expect(armyMinCut(world, 'player', CHOKE_MAX_CUT)).toBeNull();
  });

  it('returns null when the armies are fully separated', () => {
    const world = makeWorld();
    for (let x = 0; x < 12; x++) world.tileGrid.setKind({ x, y: 5 }, 'deep_water');
    spawn(world, 'enemy', { x: 5, y: 1 });
    spawn(world, 'enemy', { x: 6, y: 1 });
    spawn(world, 'player', { x: 5, y: 10 });
    expect(armyMinCut(world, 'player', CHOKE_MAX_CUT)).toBeNull();
  });

  it('a 1-wide door reads as a cut of exactly 1 (the articulation case)', () => {
    const world = makeWorld();
    for (let x = 0; x < 12; x++) {
      if (x !== 6) world.tileGrid.setKind({ x, y: 5 }, 'deep_water');
    }
    spawn(world, 'enemy', { x: 5, y: 1 });
    spawn(world, 'enemy', { x: 7, y: 1 });
    spawn(world, 'player', { x: 6, y: 9 });
    const cut = armyMinCut(world, 'player', CHOKE_MAX_CUT);
    expect(cut).toEqual([{ x: 6, y: 5 }]);
  });
});

describe('chokeHold', () => {
  it('registry order: edge-hold › unjam › choke hold', () => {
    expect(TRAFFIC_SCRIPTS.indexOf(unjam)).toBeLessThan(TRAFFIC_SCRIPTS.indexOf(chokeHold));
  });

  it('proposes an engage:tile plug on the bridge when outnumbering enemies approach', () => {
    const world = isthmusWorld(6); // 6 enemies vs a 2-cut → the funnel trade
    const proposal = chokeHold.evaluate(world, 'player');
    expect(proposal).not.toBeNull();
    if (proposal === null || proposal.mode !== 'engage') throw new Error('unreachable');
    expect(proposal.target.kind).toBe('tile');
    const cell = (proposal.target as Extract<typeof proposal.target, { kind: 'tile' }>).cell;
    expect([5, 6]).toContain(cell.x); // the plug is on the bridge
  });

  it('stays silent when the enemy does not outnumber the cut', () => {
    const world = isthmusWorld(3); // 3 enemies vs 2-cut ×2 = 4 → no trade
    expect(chokeHold.evaluate(world, 'player')).toBeNull();
  });

  it('stays silent on open ground', () => {
    const world = makeWorld();
    for (let i = 0; i < 6; i++) spawn(world, 'enemy', { x: 1 + i, y: 1 });
    spawn(world, 'player', { x: 5, y: 10 });
    expect(chokeHold.evaluate(world, 'player')).toBeNull();
  });

  it('stays silent when the enemy holds the choke (their side, not ours)', () => {
    const world = makeWorld();
    for (const y of [5, 6]) {
      for (let x = 0; x < 12; x++) {
        if (x !== 5 && x !== 6) world.tileGrid.setKind({ x, y }, 'deep_water');
      }
    }
    // Enemies adjacent to the bridge mouth; our units far south.
    for (let i = 0; i < 6; i++) spawn(world, 'enemy', { x: 3 + i, y: 4 });
    spawn(world, 'player', { x: 5, y: 11 });
    spawn(world, 'player', { x: 6, y: 11 });
    const proposal = chokeHold.evaluate(world, 'player');
    expect(proposal).toBeNull();
  });

  it('is deterministic: the same world yields the same plug', () => {
    const world = isthmusWorld();
    expect(chokeHold.evaluate(world, 'player')).toEqual(chokeHold.evaluate(world, 'player'));
  });

  it('drives end-to-end through the REAL registry on the isthmus', () => {
    const world = isthmusWorld();
    const driver = new TrafficScriptDriver('player');
    const commands = driver.decide(world);
    expect(commands).toHaveLength(1);
    if (commands[0]!.kind !== 'setObjective') throw new Error('unreachable');
    expect(commands[0]!.objective.mode).toBe('engage');
  });
});

// 86c-L3 — the memo's recompute-and-compare verifier (the §79e principle:
// the memoized production path is checked against the exported pure compute,
// a surface production no longer consults) + the two invalidation pins the
// key must catch: a unit moving, a tile mutating.
describe('the choke-read memo (86c-L3)', () => {
  it('stays compute-identical across a real driven battle, and actually hits', () => {
    const world = isthmusWorld(6);
    const driver = new TrafficScriptDriver('player');
    const before = { ...chokeMemoStats };
    for (let t = 0; t < 120 && !world.ended; t++) {
      for (const cmd of driver.decide(world)) world.enqueueCommand(cmd);
      // The verifier: the memoized production read (via nominate — pure
      // chokeRead, no outnumber gate) equals a fresh recompute, every tick.
      expect(nominateChokeHold(world, 'player')).toEqual(
        computeChokeRead(world, 'player')?.proposal ?? null,
      );
      world.tick();
    }
    const calls = chokeMemoStats.calls - before.calls;
    const hits = chokeMemoStats.hits - before.hits;
    expect(calls).toBeGreaterThan(0);
    expect(hits).toBeGreaterThan(0); // the memo engaged, not just fell through
  });

  it('invalidates on a unit position change (decisively: stale ≠ fresh)', () => {
    const world = isthmusWorld(6);
    const first = nominateChokeHold(world, 'player');
    expect(first).not.toBeNull(); // memo warmed with a real proposal
    // Move every player unit to the NORTH half — same side as the enemy, so
    // the bridge no longer sits between the armies and the fresh read is
    // NULL. A memo that missed the position change would still return the
    // stale plug, so equality here proves invalidation, not luck.
    let px = 8;
    for (const u of world.units) {
      if (u.team === 'player') u.position = { x: px++, y: 1 };
    }
    expect(computeChokeRead(world, 'player')).toBeNull(); // the mutation is decisive
    expect(nominateChokeHold(world, 'player')).toBeNull();
  });

  it('invalidates on a death (the alive flag — decisively: stale ≠ fresh)', () => {
    const world = isthmusWorld(6);
    expect(nominateChokeHold(world, 'player')).not.toBeNull();
    for (const u of world.units) {
      if (u.team === 'enemy') u.currentHp = 0;
    }
    expect(computeChokeRead(world, 'player')).toBeNull(); // no living enemies
    expect(nominateChokeHold(world, 'player')).toBeNull();
  });

  it('invalidates on a tile mutation (the TileGrid epoch)', () => {
    const world = isthmusWorld(6);
    const first = nominateChokeHold(world, 'player');
    expect(first).not.toBeNull();
    // Open a second bridge far from the first — the min cut widens to 4 >
    // CHOKE_MAX_CUT, so the fresh read is null; a stale memo would still
    // propose the old plug.
    world.tileGrid.setKind({ x: 0, y: 5 }, 'floor');
    world.tileGrid.setKind({ x: 0, y: 6 }, 'floor');
    world.tileGrid.setKind({ x: 1, y: 5 }, 'floor');
    world.tileGrid.setKind({ x: 1, y: 6 }, 'floor');
    expect(computeChokeRead(world, 'player')).toBeNull(); // the mutation is decisive
    expect(nominateChokeHold(world, 'player')).toBeNull();
  });

  it('memoizes per World instance — a snapshot clone never shares entries', () => {
    const world = isthmusWorld(6);
    const warm = nominateChokeHold(world, 'player');
    const clone = World.fromJSON(
      JSON.parse(JSON.stringify(world.toJSON())),
      new EventBus<GameEvents>(),
    );
    expect(nominateChokeHold(clone, 'player')).toEqual(warm);
    expect(nominateChokeHold(clone, 'player')).toEqual(
      computeChokeRead(clone, 'player')?.proposal ?? null,
    );
  });
});
