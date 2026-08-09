/**
 * §75d — the spatial widening: an ACTIVE neutral (camp member) is a mobile
 * body, not scenery. Pins each worksheet site's new split (worklog §75):
 * soft-cost in `buildMovementContext` (the moving-wall fix, `excludeUnitId`
 * included), out of the static topology sets (`neutralCells`,
 * `nearestActingCell`, the bot choke masks), gated out of half-cover,
 * DELIBERATELY kept in the LOS-occluder pool, and afflicted by fire/healing
 * tiles. Inert neutrals (walls / half-cover) pin their unchanged wall
 * semantics alongside — the presence-gated byte-identity exit gate depends on
 * that half staying put.
 */

import { describe, it, expect } from 'vitest';
import { World } from './World';
import type { Unit, UnitStats, Team } from './Unit';
import type { GridCoord } from '../core/types';
import { spawnCamps } from './battleSetup';
import { spawnWall, spawnHalfCover } from './environment';
import { buildMovementContext } from './movement';
import { cellKey } from './occupancy';
import { neutralCells } from './blockedAlly';
import { nearestActingCell } from './actingPosition';
import { collectLosBlockers, collectHalfCoverPositions } from './positioning';
import { chokeCells, armyMinCut } from '../bot/sensors';
import { MoveAction } from './actions/MoveAction';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

const freshWorld = (): World => new World(new EventBus<GameEvents>(), new RNG(1));

function spawnAt(world: World, team: Team, pos: GridCoord): Unit {
  return world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
}

/** Materialize one camp member via the real 75c drip (the only production
 *  spawn path), then park it at `pos`. bandit-squatters drips two members;
 *  one tick materializes exactly the head-of-queue unit. */
function campMemberAt(world: World, pos: GridCoord): Unit {
  spawnCamps(world, [{ x: 10, y: 10 }], [{ campId: 'bandit-squatters' }], 42, 1);
  world.tick();
  const u = world.units.find((x) => x.campId !== null);
  if (!u) throw new Error('camp drip failed to materialize a member');
  u.position = pos;
  u.activeAction = null; // shed the spawn lockout — tests want an idle body
  return u;
}

// The occupancy.test.ts seatMove idiom — a MoveAction mid-flight the way
// World.executeActions seats one, claim included.
function seatMove(world: World, unit: Unit, to: GridCoord, travel: number) {
  const durationTicks = travel * 2;
  const action = new MoveAction(unit.position, to, durationTicks);
  unit.activeAction = {
    action,
    startTick: world.currentTick,
    finishTick: world.currentTick + durationTicks,
    phases: [
      { phase: 'travel', ticks: travel },
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: durationTicks - travel },
    ],
  };
  world.claimCell(to, unit.id);
}

describe('§75d — buildMovementContext (the moving-wall fix)', () => {
  it('an active neutral is SOFT (otherUnitCells + occupied), never a pathBlocker', () => {
    const world = freshWorld();
    // Camp first: campMemberAt ticks once, and a one-army board would trip
    // checkBattleEnd (a neutral-only board stays silent — combat never began).
    const camp = campMemberAt(world, { x: 4, y: 4 });
    const mover = spawnAt(world, 'player', { x: 1, y: 1 });
    const wall = spawnWall(world, { x: 6, y: 6 });
    const ctx = buildMovementContext(mover, world);
    expect(ctx.otherUnitCells.has(cellKey(camp.position))).toBe(true);
    expect(ctx.occupied.has(cellKey(camp.position))).toBe(true);
    expect(ctx.pathBlockers).not.toContainEqual(camp.position);
    // The inert half pins its unchanged wall semantics.
    expect(ctx.pathBlockers).toContainEqual(wall.position);
    expect(ctx.otherUnitCells.has(cellKey(wall.position))).toBe(false);
  });

  it('excludeUnitId can exclude an active neutral (the pursued camp target)', () => {
    const world = freshWorld();
    const camp = campMemberAt(world, { x: 4, y: 4 });
    const mover = spawnAt(world, 'player', { x: 1, y: 1 });
    const ctx = buildMovementContext(mover, world, { excludeUnitId: camp.id });
    expect(ctx.otherUnitCells.has(cellKey(camp.position))).toBe(false);
    expect(ctx.pathBlockers).not.toContainEqual(camp.position);
    // Still a body for the sidestep set — exclusion softens routing, never a
    // collision check (the gotcha #113 placement rule).
    expect(ctx.occupied.has(cellKey(camp.position))).toBe(true);
  });

  it('an active neutral mid-move prices by its vacancy ETA like any combatant', () => {
    const world = freshWorld();
    const camp = campMemberAt(world, { x: 4, y: 4 });
    const mover = spawnAt(world, 'player', { x: 1, y: 1 });
    seatMove(world, camp, { x: 5, y: 4 }, 5);
    const ctx = buildMovementContext(mover, world);
    expect(ctx.vacatingEta.get(cellKey({ x: 4, y: 4 }))).toBe(5);
  });
});

describe('§75d — the static-topology sets exclude active neutrals', () => {
  it('neutralCells: wall in, camp member out', () => {
    const world = freshWorld();
    const camp = campMemberAt(world, { x: 4, y: 4 });
    const wall = spawnWall(world, { x: 6, y: 6 });
    const cells = neutralCells(world);
    expect(cells.has(`${wall.position.x},${wall.position.y}`)).toBe(true);
    expect(cells.has(`${camp.position.x},${camp.position.y}`)).toBe(false);
  });

  it('nearestActingCell BFS traverses a camp member but not a wall (lockstep with movement)', () => {
    // A full wall line at x=3 with a single door at (3,5): the only route from
    // the west side to a cell in range of the east-side target runs through
    // the door.
    const buildCorridor = (world: World, door: 'camp' | 'wall' | 'open') => {
      for (let y = 0; y < world.gridH; y++) {
        if (y === 5) continue;
        spawnWall(world, { x: 3, y });
      }
      if (door === 'camp') campMemberAt(world, { x: 3, y: 5 });
      if (door === 'wall') spawnWall(world, { x: 3, y: 5 });
    };
    const from = { x: 1, y: 5 };
    const target = { x: 6, y: 5 };

    const open = freshWorld();
    buildCorridor(open, 'open');
    const openCell = nearestActingCell(from, target, 1, 12, open, null);
    expect(openCell).not.toBeNull();

    const withCamp = freshWorld();
    buildCorridor(withCamp, 'camp');
    // The camp body doesn't wall the door: same reachability as the open door.
    expect(nearestActingCell(from, target, 1, 12, withCamp, null)).toEqual(openCell);

    const withWall = freshWorld();
    buildCorridor(withWall, 'wall');
    expect(nearestActingCell(from, target, 1, 12, withWall, null)).toBeNull();
  });

  it('chokeCells: a camp member standing on the door leaves the arena mask unchanged', () => {
    const buildDoorway = (world: World) => {
      for (let y = 0; y < world.gridH; y++) {
        if (y === 5) continue;
        spawnWall(world, { x: 3, y });
      }
    };
    const bare = freshWorld();
    buildDoorway(bare);
    const bareChokes = chokeCells(bare);
    // Sanity: the door IS an articulation cell of the bare arena.
    expect(bareChokes).toContainEqual({ x: 3, y: 5 });

    const withCamp = freshWorld();
    buildDoorway(withCamp);
    campMemberAt(withCamp, { x: 3, y: 5 });
    expect(chokeCells(withCamp)).toEqual(bareChokes);
  });

  it('armyMinCut: an open-field camp member leaves the cut unchanged', () => {
    const setupArmies = (world: World) => {
      for (let y = 0; y < world.gridH; y++) {
        if (y === 5) continue;
        spawnWall(world, { x: 3, y });
      }
      spawnAt(world, 'player', { x: 1, y: 5 });
      spawnAt(world, 'enemy', { x: 6, y: 5 });
    };
    const bare = freshWorld();
    setupArmies(bare);
    const bareCut = armyMinCut(bare, 'player', 4);
    expect(bareCut).not.toBeNull();

    const withCamp = freshWorld();
    campMemberAt(withCamp, { x: 8, y: 8 }); // before the armies — see above
    setupArmies(withCamp);
    expect(armyMinCut(withCamp, 'player', 4)).toEqual(bareCut);
  });
});

describe('§75d — cover & LOS', () => {
  it('an active neutral never grants half-cover, even with blocksLineOfSight false', () => {
    const world = freshWorld();
    const camp = campMemberAt(world, { x: 4, y: 4 });
    // No shipped camp def is a non-LOS-blocker — force the flag (readonly in
    // prod, hence the cast) to pin the explicit gate: a future non-LOS camp
    // def must not become mobile cover.
    (camp as { blocksLineOfSight: boolean }).blocksLineOfSight = false;
    const cover = spawnHalfCover(world, { x: 6, y: 6 });
    const positions = collectHalfCoverPositions(world);
    expect(positions).toContainEqual(cover.position);
    expect(positions).not.toContainEqual(camp.position);
  });

  it('an active neutral IS an LOS occluder (the deliberate census call)', () => {
    const world = freshWorld();
    const camp = campMemberAt(world, { x: 4, y: 4 });
    expect(camp.blocksLineOfSight).toBe(true); // spawns like every combatant def
    expect(collectLosBlockers(world)).toContainEqual(camp.position);
  });
});

describe('§75d — tile statuses reach active neutrals', () => {
  it('a camp member on a fire tile catches burn; a wall on fire stays clean', () => {
    const world = freshWorld();
    const camp = campMemberAt(world, { x: 4, y: 4 });
    const wall = spawnWall(world, { x: 6, y: 6 });
    world.tileGrid.setKind({ x: 4, y: 4 }, 'fire');
    world.tileGrid.setKind({ x: 6, y: 6 }, 'fire');
    world.tick();
    expect(camp.effects.some((e) => e.key === 'burn')).toBe(true);
    expect(wall.effects.some((e) => e.key === 'burn')).toBe(false);
  });

  it('a camp member on a healing tile is topped up like any combatant', () => {
    const world = freshWorld();
    const camp = campMemberAt(world, { x: 4, y: 4 });
    world.tileGrid.setKind({ x: 4, y: 4 }, 'healing');
    world.tick();
    expect(camp.effects.some((e) => e.key === 'rejuvenate')).toBe(true);
  });
});
