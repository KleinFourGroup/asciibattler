import { describe, expect, it } from 'vitest';
import { World } from '../World';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import type { Behavior, Team, Unit, UnitStats } from '../Unit';
import { isInertNeutral } from '../Unit';
import { parseAbilityDef, type AbilityDef } from './schema';
import { proposeEffectAbility } from './propose';
import { pushLanding } from '../push';
import { findOverlappingCells, unitAt } from '../occupancy';
import { createMovementBehavior } from '../behaviors/registry';
import { spawnCamps } from '../battleSetup';

/**
 * The `push` op through a real cast: a test behaviour proposes the def once
 * (`proposeEffectAbility`), the World seats it, and the op fires at its
 * impact inside the tick, as a shipped ability's does. Expectations are
 * worked out on the grid by hand.
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
  const spawn = (team: Team, pos: GridCoord, b?: Behavior): Unit => {
    const u = world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
    if (b) u.behaviors.push(b);
    return u;
  };
  return { world, bus, spawn };
}

const pushDef = (target: unknown, op: unknown, rangeCells = 6): AbilityDef =>
  parseAbilityDef({
    id: 'test_push', name: 'Test Push', description: 'A test push.', cooldownSeconds: 5, rangeCells,
    target,
    timeline: [{ phase: 'impact', seconds: 0 }, { phase: 'recovery', seconds: 'fill' }],
    orphanPolicy: 'ground-target', priority: 10,
    effects: [{ phase: 'impact', op }],
  });

describe('the push op', () => {
  it('moves a packed line farthest first, so the inner victim follows the outer one out', () => {
    const { world, spawn } = setup();
    // In world order the inner victim comes first; pushed first, it would
    // meet the outer one and stay.
    const inner = spawn('enemy', { x: 9, y: 8 });
    const outer = spawn('enemy', { x: 10, y: 8 });
    // North of the centre: from the centre it goes north; from the caster,
    // five east and one north, it would go north-east.
    const north = spawn('enemy', { x: 9, y: 7 });
    // A grenade on its target's cell, the inner victim's: the inner one is
    // on the centre and goes away from the caster, east, as the outer does.
    spawn('player', { x: 4, y: 8 }, new CastOnce(pushDef(
      { kind: 'aoe', shape: 'square', radius: 1, anchor: 'targetCell', affects: 'enemies' },
      { kind: 'push', cells: 1, direction: 'away', from: 'center' },
    )));
    world.tick();
    expect(outer.position).toEqual({ x: 11, y: 8 });
    expect(inner.position).toEqual({ x: 10, y: 8 });
    expect(north.position).toEqual({ x: 9, y: 6 });
  });

  it('pushes a burst around its caster outward, and leaves its allies and anyone outside it', () => {
    const { world, spawn } = setup();
    spawn('player', { x: 8, y: 8 }, new CastOnce(pushDef(
      { kind: 'aoe', shape: 'square', radius: 1, anchor: 'caster', affects: 'enemies' },
      { kind: 'push', cells: 2, direction: 'away' },
    )));
    const west = spawn('enemy', { x: 7, y: 8 });
    const southEast = spawn('enemy', { x: 9, y: 9 });
    const outside = spawn('enemy', { x: 8, y: 6 });
    const ally = spawn('player', { x: 8, y: 9 });
    world.tick();
    expect(west.position).toEqual({ x: 5, y: 8 });
    expect(southEast.position).toEqual({ x: 11, y: 11 });
    expect(outside.position).toEqual({ x: 8, y: 6 });
    expect(ally.position).toEqual({ x: 8, y: 9 });
  });

  it('pulls a single target in beside its caster, holding it from the tick it fires', () => {
    const { world, bus, spawn } = setup();
    const caster = spawn('player', { x: 4, y: 8 }, new CastOnce(pushDef(
      { kind: 'enemyInRange' },
      { kind: 'push', cells: 2, direction: 'toward' },
      3,
    )));
    // Spawned after its caster, so it meets its hold later in the same tick.
    const target = spawn('enemy', { x: 7, y: 8 });
    const phases: string[] = [];
    bus.on('action:phase', (e) => { if (e.unitId === target.id) phases.push(`${world.currentTick}:${e.phase}`); });
    world.tick();
    expect(caster.position).toEqual({ x: 4, y: 8 });
    expect(target.position).toEqual({ x: 5, y: 8 });
    expect(target.activeAction?.action.id).toBe('forcedMove');
    // Its slide's first phase once, on the tick it was pushed, not again
    // when its own turn in that tick came round.
    expect(phases).toEqual([`${world.currentTick}:travel`]);
  });

  it('moves a camp member without turning its camp hostile', () => {
    const { world, spawn } = setup();
    spawn('enemy', { x: 1, y: 1 }); // the two keep the battle open
    spawn('player', { x: 1, y: 14 });
    spawnCamps(world, [{ x: 10, y: 10 }], [{ campId: 'bandit-squatters' }], 42, 1);
    world.tick();
    const member = world.units.find((u) => u.campId !== null)!;
    world.clearActiveAction(member);
    member.position = { x: 9, y: 8 };
    const camp = world.campById(member.campId!)!;
    expect(camp.hostileTo.size).toBe(0);
    spawn('player', { x: 8, y: 8 }, new CastOnce(pushDef(
      { kind: 'aoe', shape: 'square', radius: 1, anchor: 'caster', affects: 'all' },
      { kind: 'push', cells: 2, direction: 'away' },
    )));
    world.tick();
    expect(member.position).toEqual({ x: 11, y: 8 });
    expect(camp.hostileTo.size).toBe(0);
  });

  it("refuses a push from 'center' without an area", () => {
    expect(() => pushDef({ kind: 'enemyInRange' }, { kind: 'push', cells: 1, direction: 'away', from: 'center' })).toThrow();
  });
});

describe('a push storm', () => {
  /**
   * Two sides fight on a board with walls and a chasm while, every tick, a
   * seeded draw pushes or pulls a random unit from a random origin. After
   * every push and every tick no two bodies share a cell, and no body stands
   * on a cell another unit has claimed (gotcha #113).
   */
  it('keeps every body on a cell of its own, off every other unit\'s claim', () => {
    const { world, spawn } = setup();
    for (const [x, y] of [[7, 4], [7, 5], [8, 10], [3, 12]] as const) world.spawnEnvironment({ archetype: 'wall', position: { x, y } });
    for (let y = 6; y <= 9; y++) world.tileGrid.setKind({ x: 12, y }, 'chasm');
    for (let i = 0; i < 6; i++) {
      for (const [team, x] of [['player', 2], ['enemy', 13]] as const) {
        const u = spawn(team, { x, y: 2 + i * 2 });
        world.wireSpawned(u, createMovementBehavior('mercenary'), true);
      }
    }
    const draw = new RNG(7);
    const check = (when: string): void => {
      expect(findOverlappingCells(world), when).toEqual([]);
      for (const claim of world.claims.values()) {
        const there = unitAt(world, claim.cell);
        expect(there === undefined || there.id === claim.unitId, `${when}: unit ${there?.id} on ${claim.unitId}'s claim`).toBe(true);
      }
    };
    let pushes = 0;
    let ticksWithClaims = 0;
    for (let t = 0; t < 300 && !world.ended; t++) {
      if (world.claims.size > 0) ticksWithClaims++;
      const movable = world.units.filter((u) => !isInertNeutral(u));
      const victim = movable[Math.floor(draw.next() * movable.length)]!;
      const origin = {
        x: Math.min(15, Math.max(0, victim.position.x + Math.floor(draw.next() * 7) - 3)),
        y: Math.min(15, Math.max(0, victim.position.y + Math.floor(draw.next() * 7) - 3)),
      };
      const landing = pushLanding(world, victim, origin, draw.next() < 0.5 ? 'away' : 'toward', 1 + Math.floor(draw.next() * 3));
      if (landing !== null) {
        world.forceMove(victim, landing.cell, landing.cells);
        pushes++;
        check(`tick ${world.currentTick}, after a push`);
      }
      world.tick();
      check(`tick ${world.currentTick}`);
    }
    // Not vacuous: many pushes, and claims standing on most ticks to land on.
    expect(pushes).toBeGreaterThan(100);
    expect(ticksWithClaims).toBeGreaterThan(100);
  });
});
