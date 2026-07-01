import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Team, UnitStats } from './Unit';

/**
 * §35c — the de-overlap shove backstop (`World.shove`), in isolation.
 *
 * Nothing co-locates on today's instant model (35b's abort + the summon/spawn
 * occupancy checks see to that), so shove never fires in a natural battle — it's
 * the safety net for a future breach (a knockback / a dynamic-terrain push) and
 * the primitive a directional `knockback` op wraps. So these tests force a
 * co-location (two units spawned on one cell) and assert the relocation is to
 * the NEAREST free cell, DETERMINISTIC (the fixed `nearestFreeCells` BFS order),
 * and announced via `unit:shoved` (+ `unit:moved` for the slide).
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

function setup(gridW = 12, gridH = 12) {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1), gridW, gridH);
  return { world, bus };
}

function spawnAt(world: World, team: Team, pos: GridCoord) {
  return world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
}

describe('World.shove — the §35c de-overlap backstop', () => {
  it('relocates a co-located unit to the nearest free cell (deterministic), emitting unit:shoved + unit:moved', () => {
    const { world, bus } = setup();
    const a = spawnAt(world, 'player', { x: 5, y: 5 });
    const b = spawnAt(world, 'player', { x: 5, y: 5 }); // co-located with a

    const shoved: GameEvents['unit:shoved'][] = [];
    const moved: GameEvents['unit:moved'][] = [];
    bus.on('unit:shoved', (e) => shoved.push(e));
    bus.on('unit:moved', (e) => moved.push(e));

    const ok = world.shove(b);

    expect(ok).toBe(true);
    // nearestFreeCells expands neighbours in fixed dx,dy = -1..1 order, so the
    // top-left diagonal (4,4) is the first free cell — the deterministic pick.
    expect(b.position).toEqual({ x: 4, y: 4 });
    expect(a.position).toEqual({ x: 5, y: 5 }); // the other unit is untouched
    const expected = {
      unitId: b.id,
      from: { x: 5, y: 5 },
      to: { x: 4, y: 4 },
      durationTicks: b.derived.moveCooldownTicks,
    };
    expect(shoved).toEqual([expected]);
    expect(moved).toEqual([expected]); // the slide reuses the move lerp
  });

  it('skips an occupied first-choice cell and picks the next nearest free cell', () => {
    const { world } = setup();
    spawnAt(world, 'player', { x: 5, y: 5 });
    const b = spawnAt(world, 'player', { x: 5, y: 5 });
    world.spawnEnvironment({ archetype: 'wall', position: { x: 4, y: 4 } }); // block the first choice

    world.shove(b);

    // (4,4) is walled, so the BFS's next free neighbour (4,5) wins.
    expect(b.position).toEqual({ x: 4, y: 5 });
  });

  it('is deterministic — identical co-locations shove to the same cell', () => {
    const first = setup();
    spawnAt(first.world, 'player', { x: 3, y: 7 });
    const b1 = spawnAt(first.world, 'player', { x: 3, y: 7 });
    first.world.shove(b1);

    const second = setup();
    spawnAt(second.world, 'player', { x: 3, y: 7 });
    const b2 = spawnAt(second.world, 'player', { x: 3, y: 7 });
    second.world.shove(b2);

    expect(b1.position).toEqual(b2.position);
  });

  it('returns false (no-op) when no free cell is within the search radius', () => {
    const { world, bus } = setup(1, 1); // a 1×1 board — no cell to shove onto
    spawnAt(world, 'player', { x: 0, y: 0 });
    const b = spawnAt(world, 'player', { x: 0, y: 0 });

    const shoved: GameEvents['unit:shoved'][] = [];
    bus.on('unit:shoved', (e) => shoved.push(e));

    expect(world.shove(b)).toBe(false);
    expect(b.position).toEqual({ x: 0, y: 0 }); // unmoved
    expect(shoved).toEqual([]);
  });
});
