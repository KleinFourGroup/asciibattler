import { describe, expect, it } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import { secondsToTicks } from '../config';
import { SIM } from '../config/sim';
import type { ActionProposal } from './Action';
import type { Behavior, Team, Unit, UnitStats } from './Unit';
import { parseAbilityDef, type AbilityDef } from './effects/schema';
import { proposeEffectAbility } from './effects/propose';
import { pushLanding } from './push';
import { spawnCamps } from './battleSetup';

/**
 * The fall: a push or a pull whose walk meets chasm or deep water walks its
 * victim onto that cell, and as the slide ends the victim falls, the pusher
 * credited as a blow would be. A boss, a self-move and the board's edge stop
 * the walk. Each expectation is worked out on the grid by hand from the rule
 * the test names; the slide's length is the config's seconds a cell.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};

/** Casts `def` once, the first tick it proposes. */
class CastOnce implements Behavior {
  readonly kind = 'test:castOnce';
  private used = false;
  constructor(private readonly def: AbilityDef) {}
  proposeAction(unit: Unit, world: World): ActionProposal | null {
    if (this.used) return null;
    const p = proposeEffectAbility(this.def, unit, world);
    if (p !== null) this.used = true;
    return p;
  }
}

function setup() {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1), 16, 16);
  const spawn = (team: Team, pos: GridCoord, b?: Behavior, boss = false): Unit => {
    const u = world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0, ...(boss ? { boss: true } : {}) }, team, pos);
    if (b) u.behaviors.push(b);
    return u;
  };
  const fell: GameEvents['unit:fell'][] = [];
  const hits: GameEvents['unit:attacked'][] = [];
  bus.on('unit:fell', (e) => fell.push(e));
  bus.on('unit:attacked', (e) => hits.push(e));
  return { world, bus, spawn, fell, hits };
}

const pushDef = (op: unknown): AbilityDef =>
  parseAbilityDef({
    id: 'test_push', name: 'Test Push', description: 'A test push.', cooldownSeconds: 5, rangeCells: 6,
    target: { kind: 'enemyInRange' },
    timeline: [{ phase: 'impact', seconds: 0 }, { phase: 'recovery', seconds: 'fill' }],
    orphanPolicy: 'ground-target', priority: 10,
    effects: [{ phase: 'impact', op }],
  });
const knockback = (cells: number): AbilityDef => pushDef({ kind: 'push', cells, direction: 'away' });
const pull = (cells: number): AbilityDef => pushDef({ kind: 'push', cells, direction: 'toward' });

/** The ticks a slide of `cells` cells lasts, from the config. */
const slideTicks = (cells: number): number => Math.max(1, secondsToTicks(cells * SIM.pushSecondsPerCell));

/** Ticks until `pred` holds, at most `max`; returns the ticks run. */
function tickUntil(world: World, pred: () => boolean, max = 60): number {
  let n = 0;
  while (!pred() && n < max) {
    world.tick();
    n++;
  }
  return n;
}

describe('the fall', () => {
  it('a knockback walks a foe onto a chasm, and it falls as the slide ends', () => {
    const { world, spawn, fell, hits } = setup();
    world.tileGrid.setKind({ x: 7, y: 5 }, 'chasm');
    spawn('player', { x: 1, y: 14 }); // keeps the battle open
    const foe = spawn('enemy', { x: 6, y: 5 });
    spawn('enemy', { x: 14, y: 14 });
    const caster = spawn('player', { x: 5, y: 5 }, new CastOnce(knockback(2)));
    const hp = foe.currentHp;
    tickUntil(world, () => foe.position.x !== 6);
    // On the chasm, alive, held for the slide; nothing has fallen yet.
    expect(foe.position).toEqual({ x: 7, y: 5 });
    expect(world.units.includes(foe)).toBe(true);
    expect(fell).toEqual([]);
    for (let i = 0; i < slideTicks(1); i++) world.tick();
    expect(fell).toEqual([{ unitId: foe.id, into: 'chasm', pusherId: caster.id }]);
    expect(world.units.includes(foe)).toBe(false);
    // Credited as a blow that took every HP it had, with no hit drawn.
    expect(world.damageDealtBy(caster.id)).toBe(hp);
    expect(hits.filter((h) => h.targetId === foe.id)).toEqual([]);
  });

  it('keeps the pusher through a snapshot taken mid-slide', () => {
    const { world, spawn } = setup();
    world.tileGrid.setKind({ x: 7, y: 5 }, 'chasm');
    spawn('player', { x: 1, y: 14 });
    const foe = spawn('enemy', { x: 6, y: 5 });
    spawn('enemy', { x: 14, y: 14 });
    // The forced move the op makes, with no test behaviour in the snapshot,
    // which a restore could not rebuild.
    const caster = spawn('player', { x: 5, y: 5 });
    const landing = pushLanding(world, foe, caster.position, 'away', 2, { drops: true })!;
    world.forceMove(foe, landing.cell, landing.cells, caster.id);
    expect(foe.position).toEqual({ x: 7, y: 5 });
    const bus = new EventBus<GameEvents>();
    const fell: GameEvents['unit:fell'][] = [];
    bus.on('unit:fell', (e) => fell.push(e));
    const restored = World.fromJSON(JSON.parse(JSON.stringify(world.toJSON())), bus);
    for (let i = 0; i < slideTicks(1); i++) restored.tick();
    expect(fell).toEqual([{ unitId: foe.id, into: 'chasm', pusherId: caster.id }]);
  });

  it('deep water drowns as a chasm drops', () => {
    const { world, spawn, fell } = setup();
    world.tileGrid.setKind({ x: 7, y: 5 }, 'deep_water');
    spawn('player', { x: 1, y: 14 });
    const foe = spawn('enemy', { x: 6, y: 5 });
    spawn('enemy', { x: 14, y: 14 });
    const caster = spawn('player', { x: 5, y: 5 }, new CastOnce(knockback(2)));
    tickUntil(world, () => fell.length > 0);
    expect(fell).toEqual([{ unitId: foe.id, into: 'deep_water', pusherId: caster.id }]);
  });

  it('a pull drags a foe into the gap between them', () => {
    const { world, spawn, fell } = setup();
    world.tileGrid.setKind({ x: 4, y: 5 }, 'chasm');
    spawn('player', { x: 1, y: 14 });
    const foe = spawn('enemy', { x: 5, y: 5 });
    spawn('enemy', { x: 14, y: 14 });
    // Its first cell is the chasm: the pull's room gate counts the drop as
    // room, or the cast would never fire.
    const caster = spawn('player', { x: 2, y: 5 }, new CastOnce(pull(3)));
    tickUntil(world, () => fell.length > 0);
    expect(fell).toEqual([{ unitId: foe.id, into: 'chasm', pusherId: caster.id }]);
  });

  it("fires the pusher's kill hooks, and marks a camp hostile as a blow does", () => {
    const { world, spawn, fell } = setup();
    const kills: number[] = [];
    world.registerTrigger('kill', ({ attacker, victim }) => kills.push(attacker.id, victim.id));
    spawn('enemy', { x: 1, y: 1 });
    spawn('player', { x: 1, y: 14 });
    spawnCamps(world, [{ x: 10, y: 10 }], [{ campId: 'bandit-squatters' }], 42, 1);
    world.tick();
    const member = world.units.find((u) => u.campId !== null)!;
    world.clearActiveAction(member);
    member.position = { x: 9, y: 8 };
    world.tileGrid.setKind({ x: 10, y: 8 }, 'chasm');
    const camp = world.campById(member.campId!)!;
    // A camp member is no `enemyInRange` target, so the forced move is
    // driven as the op makes it, from the caster's cell with its id.
    const caster = spawn('player', { x: 8, y: 8 });
    const landing = pushLanding(world, member, caster.position, 'away', 2, { drops: true });
    expect(landing).toEqual({ cell: { x: 10, y: 8 }, cells: 1, drops: true });
    world.forceMove(member, landing!.cell, landing!.cells, caster.id);
    tickUntil(world, () => fell.length > 0);
    expect(fell).toEqual([{ unitId: member.id, into: 'chasm', pusherId: caster.id }]);
    expect(kills).toEqual([caster.id, member.id]);
    expect(camp.hostileTo.has('player')).toBe(true);
  });

  it('a boss stops at the edge', () => {
    const { world, spawn, fell } = setup();
    world.tileGrid.setKind({ x: 8, y: 5 }, 'chasm');
    spawn('player', { x: 1, y: 14 });
    const boss = spawn('enemy', { x: 6, y: 5 }, undefined, true);
    spawn('enemy', { x: 14, y: 14 });
    spawn('player', { x: 5, y: 5 }, new CastOnce(knockback(3)));
    tickUntil(world, () => boss.position.x !== 6);
    for (let i = 0; i < 10; i++) world.tick();
    expect(boss.position).toEqual({ x: 7, y: 5 });
    expect(fell).toEqual([]);
    expect(world.units.includes(boss)).toBe(true);
  });

  it("the board's edge stops the walk: no one falls off the board", () => {
    const { world, spawn, fell } = setup();
    spawn('player', { x: 1, y: 14 });
    const foe = spawn('enemy', { x: 14, y: 5 });
    spawn('enemy', { x: 1, y: 1 });
    spawn('player', { x: 13, y: 5 }, new CastOnce(knockback(3)));
    tickUntil(world, () => foe.position.x !== 14);
    for (let i = 0; i < 10; i++) world.tick();
    expect(foe.position).toEqual({ x: 15, y: 5 });
    expect(fell).toEqual([]);
  });
});

describe('pushLanding and the fall', () => {
  it('without a drop (a self-move, a boss) it stops before chasm and deep water', () => {
    const { world, spawn } = setup();
    world.tileGrid.setKind({ x: 8, y: 5 }, 'chasm');
    const v = spawn('enemy', { x: 6, y: 5 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'away', 3)).toEqual({ cell: { x: 7, y: 5 }, cells: 1 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'away', 3, { drops: true })).toEqual({ cell: { x: 8, y: 5 }, cells: 2, drops: true });
  });

  it('a second victim stops at the edge of a cell a falling one holds, and a falling one moves no further', () => {
    const { world, spawn } = setup();
    world.tileGrid.setKind({ x: 7, y: 5 }, 'chasm');
    const caster = spawn('player', { x: 5, y: 3 });
    const first = spawn('enemy', { x: 6, y: 5 });
    world.forceMove(first, { x: 7, y: 5 }, 1, caster.id);
    // Diagonal from (5, 3) through (6, 4) toward (7, 5), which the first holds.
    const second = spawn('enemy', { x: 6, y: 4 });
    expect(pushLanding(world, second, { x: 5, y: 3 }, 'away', 2, { drops: true })).toBeNull();
    expect(pushLanding(world, first, { x: 6, y: 5 }, 'away', 2, { drops: true })).toBeNull();
  });
});
