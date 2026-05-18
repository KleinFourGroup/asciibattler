import { describe, it, expect, vi } from 'vitest';
import { World } from './World';
import { Unit, type Team, type UnitStats } from './Unit';
import { MovementBehavior } from './behaviors/MovementBehavior';
import { AttackBehavior } from './behaviors/AttackBehavior';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { rollUnit } from './archetypes';
import type { GameEvents } from '../core/events';

describe('World (Step 3.1 skeleton)', () => {
  it('starts at tick 0 with an empty unit list', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1));
    expect(w.currentTick).toBe(0);
    expect(w.units).toEqual([]);
  });

  it('uses the default grid size when none is provided', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1));
    expect(w.gridSize).toBe(12);
  });

  it('accepts an explicit grid size', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1), 8);
    expect(w.gridSize).toBe(8);
  });

  it('tick() increments the counter and emits `tick` with the new value', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const handler = vi.fn();
    bus.on('tick', handler);

    w.tick();
    w.tick();
    w.tick();

    expect(w.currentTick).toBe(3);
    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenNthCalledWith(1, { tick: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, { tick: 2 });
    expect(handler).toHaveBeenNthCalledWith(3, { tick: 3 });
  });
});

describe('World.spawnUnit', () => {
  it('adds the unit to the unit list, assigns it sequential ids, and emits unit:spawned', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const handler = vi.fn();
    bus.on('unit:spawned', handler);

    const a = w.spawnUnit(rollUnit('melee', rng), 'player', { x: 1, y: 2 });
    const b = w.spawnUnit(rollUnit('melee', rng), 'enemy', { x: 3, y: 4 });

    expect(w.units).toEqual([a, b]);
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(a.team).toBe('player');
    expect(b.team).toBe('enemy');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { unitId: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, { unitId: 2 });
  });

  it('derives glyph from the template archetype', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const m = w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 });
    const r = w.spawnUnit(rollUnit('ranged', rng), 'player', { x: 1, y: 0 });
    expect(m.glyph).toBe('M');
    expect(r.glyph).toBe('a');
  });
});

describe('World.findUnit', () => {
  it('returns the unit with the given id, or undefined', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const a = w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 });
    expect(w.findUnit(a.id)).toBe(a);
    expect(w.findUnit(9999)).toBeUndefined();
  });
});

describe('World battle-end detection', () => {
  it('emits battle:ended with player as winner when no enemies remain', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 });
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    w.tick();

    expect(ends).toEqual([{ winner: 'player' }]);
    expect(w.ended).toBe(true);
  });

  it('emits battle:ended with enemy as winner when no players remain', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    w.spawnUnit(rollUnit('melee', rng), 'enemy', { x: 0, y: 0 });
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    w.tick();

    expect(ends).toEqual([{ winner: 'enemy' }]);
  });

  it('does not emit battle:ended while both teams have units', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 });
    w.spawnUnit(rollUnit('melee', rng), 'enemy', { x: 5, y: 5 });
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    for (let i = 0; i < 10; i++) w.tick();

    expect(ends).toHaveLength(0);
    expect(w.ended).toBe(false);
  });

  it('stops processing ticks once ended', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 });
    w.tick(); // ends immediately
    expect(w.ended).toBe(true);
    const tickBefore = w.currentTick;

    w.tick();
    w.tick();
    expect(w.currentTick).toBe(tickBefore);
  });
});

describe('World inline death handling', () => {
  it('removes a unit with currentHp <= 0 and emits unit:died on the next tick', () => {
    const { world, units, deaths } = scene([
      { team: 'player', x: 0, y: 0, hp: 0 },
      { team: 'enemy', x: 5, y: 5, hp: 30 },
    ]);

    world.tick();
    expect(world.findUnit(units[0]!.id)).toBeUndefined();
    expect(deaths).toEqual([{ unitId: units[0]!.id }]);
  });

  it('removes units with negative HP (overkill)', () => {
    const { world, units, deaths } = scene([
      { team: 'player', x: 0, y: 0, hp: -42 },
      { team: 'enemy', x: 5, y: 5, hp: 30 },
    ]);
    world.tick();
    expect(world.findUnit(units[0]!.id)).toBeUndefined();
    expect(deaths).toHaveLength(1);
  });

  it('dead units do not act the tick they die', () => {
    // Player and enemy adjacent. Player one-shots enemy. Enemy must not
    // get a posthumous swing back at the player even though its turn in
    // the iteration order comes after the kill.
    const { world, units, attacks } = scene([
      {
        team: 'player',
        x: 0,
        y: 0,
        hp: 50,
        attackDamage: 999,
        attackRange: 1,
        attackCooldownTicks: 5,
        behaviors: ['movement', 'attack'],
      },
      {
        team: 'enemy',
        x: 1,
        y: 0,
        hp: 30,
        attackDamage: 999,
        attackRange: 1,
        attackCooldownTicks: 5,
        behaviors: ['movement', 'attack'],
      },
    ]);

    world.tick();
    expect(attacks).toHaveLength(1);
    expect(attacks[0]?.attackerId).toBe(units[0]!.id);
    expect(units[0]!.currentHp).toBe(50);
    expect(world.findUnit(units[1]!.id)).toBeUndefined();
  });
});

interface DeathSceneUnit {
  team: Team;
  x: number;
  y: number;
  hp?: number;
  attackDamage?: number;
  attackRange?: number;
  attackCooldownTicks?: number;
  behaviors?: readonly ('movement' | 'attack')[];
}

function scene(specs: DeathSceneUnit[]): {
  world: World;
  units: Unit[];
  deaths: GameEvents['unit:died'][];
  attacks: GameEvents['unit:attacked'][];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const deaths: GameEvents['unit:died'][] = [];
  const attacks: GameEvents['unit:attacked'][] = [];
  bus.on('unit:died', (p) => deaths.push(p));
  bus.on('unit:attacked', (p) => attacks.push(p));

  let nextId = 1;
  const units = specs.map((s) => {
    const stats: UnitStats = {
      maxHp: 50,
      attackDamage: s.attackDamage ?? 10,
      attackRange: s.attackRange ?? 1,
      attackCooldownTicks: s.attackCooldownTicks ?? 8,
      moveCooldownTicks: 5,
    };
    const u = new Unit({
      id: nextId++,
      team: s.team,
      glyph: 'M',
      stats,
      position: { x: s.x, y: s.y },
    });
    if (s.hp !== undefined) u.currentHp = s.hp;
    for (const b of s.behaviors ?? []) {
      if (b === 'movement') u.behaviors.push(new MovementBehavior());
      else if (b === 'attack') u.behaviors.push(new AttackBehavior());
    }
    world.units.push(u);
    return u;
  });
  return { world, units, deaths, attacks };
}
