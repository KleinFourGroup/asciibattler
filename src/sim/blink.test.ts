import { describe, expect, it } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { ActionProposal } from './Action';
import type { Behavior, Team, Unit, UnitStats } from './Unit';
import type { TileKind } from './TileGrid';
import { abilityDef } from '../config/abilities';
import { statusDef } from '../config/statuses';
import { parseAbilityDef, type AbilityDef } from './effects/schema';
import { proposeEffectAbility } from './effects/propose';
import { EffectAbility } from './effects/EffectAbility';
import type { EffectActionData } from './effects/EffectAction';
import { spawnWall } from './environment';
import { engagementDirective } from './positioning';
import { readyBlinkRange } from './behaviors/MovementBehavior';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { createMovementBehavior } from './behaviors/registry';

/**
 * The blink, a `move` op in `blink` mode: in range body to body, blind to
 * what stands between, landing on the free, unclaimed cell beside its target
 * farthest from the caster, never on a tile that drops; its landing is an
 * entry, and so is the dash's now. While a blink is ready, its carrier's
 * first goal is the nearest cell with its target in blink range. Cells are
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
  const dashed: GameEvents['unit:dashed'][] = [];
  bus.on('unit:dashed', (e) => dashed.push(e));
  const world = new World(bus, new RNG(1), 16, 16);
  /** A mercenary (a one-cell sword reach) with no behaviours, so it does
   *  only what `b` proposes; `act: true` gives it a mercenary's movement and
   *  an ability behaviour over its `abilities`. */
  const spawn = (team: Team, pos: GridCoord, opts: { b?: Behavior; act?: boolean; stats?: UnitStats } = {}): Unit => {
    const u = world.spawnUnit({ archetype: 'mercenary', level: 1, stats: opts.stats ?? BASE, xp: 0 }, team, pos);
    if (opts.act) u.behaviors.push(createMovementBehavior('mercenary'), new AbilityBehavior());
    if (opts.b) u.behaviors.push(opts.b);
    return u;
  };
  const tiles = (kind: TileKind, cells: GridCoord[]): void => {
    for (const c of cells) world.tileGrid.setKind(c, kind);
  };
  return { world, spawn, tiles, dashed };
}

const column = (x: number): GridCoord[] => Array.from({ length: 16 }, (_, y) => ({ x, y }));

const blink = (rangeCells = 5): AbilityDef =>
  parseAbilityDef({
    id: 'test_blink', name: 'Test Blink', description: 'A test blink.',
    cooldownSeconds: 10, speedScaled: false, rangeCells,
    target: { kind: 'self' },
    timeline: [{ phase: 'impact', seconds: 0.25 }],
    orphanPolicy: 'commit-at-cast', priority: 5,
    effects: [{ phase: 'impact', op: { kind: 'move', mode: 'blink' } }],
  });

const landingOf = (p: ActionProposal | null): GridCoord | undefined =>
  p === null ? undefined : (p.action.toData() as EffectActionData).ops[0]!.moveDest;

const hasStatus = (u: Unit, key: string): boolean => u.effects.some((e) => e.key === key);

describe('the blink', () => {
  it('crosses a chasm the dash cannot, and lands due behind its target', () => {
    const { world, spawn, tiles, dashed } = setup();
    tiles('chasm', column(6));
    const caster = spawn('player', { x: 4, y: 8 }, { b: new CastOnce(blink()) });
    spawn('enemy', { x: 8, y: 8 });
    expect(proposeEffectAbility(abilityDef('dash'), caster, world)).toBeNull(); // no route
    world.tick();
    expect(caster.position).toEqual({ x: 9, y: 8 });
    expect(dashed).toEqual([{ unitId: caster.id, from: { x: 4, y: 8 }, to: { x: 9, y: 8 }, durationTicks: dashed[0]!.durationTicks, blink: true }]);
  });

  it('passes walls and bodies between', () => {
    const { world, spawn } = setup();
    for (const y of [7, 8, 9]) spawnWall(world, { x: 6, y });
    spawn('player', { x: 5, y: 8 }); // an ally in the way
    const caster = spawn('player', { x: 4, y: 8 });
    spawn('enemy', { x: 8, y: 8 });
    expect(landingOf(proposeEffectAbility(blink(), caster, world))).toEqual({ x: 9, y: 8 });
  });

  it('lands on the free cell farthest from the caster; a body or a claim takes a cell out', () => {
    const { world, spawn } = setup();
    const caster = spawn('player', { x: 4, y: 8 });
    spawn('enemy', { x: 8, y: 8 });
    expect(landingOf(proposeEffectAbility(blink(), caster, world))).toEqual({ x: 9, y: 8 });
    const ally = spawn('player', { x: 9, y: 8 });
    // (9,7) and (9,9) are as far, and as near the line: the first in scan order.
    expect(landingOf(proposeEffectAbility(blink(), caster, world))).toEqual({ x: 9, y: 7 });
    world.claimCell({ x: 9, y: 7 }, ally.id);
    expect(landingOf(proposeEffectAbility(blink(), caster, world))).toEqual({ x: 9, y: 9 });
  });

  it('never lands on a tile that drops', () => {
    const { world, spawn, tiles } = setup();
    tiles('chasm', [{ x: 9, y: 7 }, { x: 9, y: 8 }]);
    tiles('deep_water', [{ x: 9, y: 9 }]);
    const caster = spawn('player', { x: 4, y: 8 });
    spawn('enemy', { x: 8, y: 8 });
    // The east column gone, the farthest left are (8,7) and (8,9), four cells off.
    expect(landingOf(proposeEffectAbility(blink(), caster, world))).toEqual({ x: 8, y: 7 });
  });

  it('is not proposed beyond its range, nor within strike reach', () => {
    const { world, spawn } = setup();
    const caster = spawn('player', { x: 4, y: 8 });
    const foe = spawn('enemy', { x: 10, y: 8 }); // six cells
    expect(proposeEffectAbility(blink(5), caster, world)).toBeNull();
    expect(proposeEffectAbility(blink(6), caster, world)).not.toBeNull();
    foe.position = { x: 5, y: 8 }; // beside it: the sword's
    expect(proposeEffectAbility(blink(6), caster, world)).toBeNull();
  });
});

describe('a leap or a blink lands as an entry', () => {
  it('a blink onto mud poisons', () => {
    const { world, spawn, tiles } = setup();
    tiles('mud', [{ x: 9, y: 8 }]);
    const caster = spawn('player', { x: 4, y: 8 }, { b: new CastOnce(blink()) });
    spawn('enemy', { x: 8, y: 8 });
    world.tick();
    expect(caster.position).toEqual({ x: 9, y: 8 });
    expect(hasStatus(caster, 'poison')).toBe(true);
  });

  it('a dash onto mud poisons, and into shallow water puts out a burn', () => {
    for (const [kind, check] of [
      ['mud', (u: Unit) => hasStatus(u, 'poison')],
      ['shallow_water', (u: Unit) => !hasStatus(u, 'burn')],
    ] as const) {
      const { world, spawn, tiles } = setup();
      // Two columns of it, so every route's first two cells are in it.
      tiles(kind, [...column(5), ...column(6)]);
      const caster = spawn('player', { x: 4, y: 8 }, { b: new CastOnce(abilityDef('dash')) });
      spawn('enemy', { x: 10, y: 8 });
      world.applyStatusEffect(caster, statusDef('burn'), null);
      expect(hasStatus(caster, 'burn'), kind).toBe(true);
      world.tick();
      expect(caster.position.x, kind).toBe(6);
      expect(check(caster), kind).toBe(true);
    }
  });
});

describe('the approach while a blink is ready', () => {
  it('reads a ready blink off the abilities and cooldowns', () => {
    const { spawn } = setup();
    const u = spawn('player', { x: 2, y: 8 });
    expect(readyBlinkRange(u)).toBeNull(); // the sword alone
    u.abilities.push(new EffectAbility(blink(5)));
    expect(readyBlinkRange(u)).toBe(5);
    u.actionCooldowns.set('test_blink', 30);
    expect(readyBlinkRange(u)).toBeNull();
  });

  it('heads first for the near bank, in blink range across a chasm; with none ready, for the target', () => {
    const { world, spawn, tiles } = setup();
    tiles('chasm', [...column(6), ...column(7)]);
    const u = spawn('player', { x: 2, y: 8 });
    const foe = spawn('enemy', { x: 10, y: 8 });
    const ready = engagementDirective(u, world, foe, 0, 5);
    expect(ready.kind).toBe('approach');
    const goal = ready.kind === 'approach' ? ready.intent.goals[0]! : undefined;
    expect(goal!.x).toBe(5); // the near bank
    expect(Math.max(Math.abs(goal!.x - 10), Math.abs(goal!.y - 8))).toBeLessThanOrEqual(5);
    const cooling = engagementDirective(u, world, foe, 0, null);
    expect(cooling.kind === 'approach' ? cooling.intent.goals : []).toEqual([foe.position]);
  });

  it('searches for that cell with no sight check: behind two walls, the near side', () => {
    const { world, spawn } = setup();
    for (const x of [6, 7]) for (const c of column(x)) spawnWall(world, c);
    const u = spawn('player', { x: 2, y: 8 });
    const foe = spawn('enemy', { x: 10, y: 8 });
    const d = engagementDirective(u, world, foe, 0, 5);
    expect(d.kind === 'approach' ? d.intent.goals[0]!.x : undefined).toBe(5);
  });

  it('walks to the near bank and blinks across with its blink ready, and stands with it cooling', () => {
    for (const ready of [true, false]) {
      const { world, spawn, tiles } = setup();
      tiles('chasm', [...column(6), ...column(7)]);
      const u = spawn('player', { x: 2, y: 8 }, { act: true, stats: { ...BASE, mobility: 6 } });
      u.abilities.push(new EffectAbility(blink(5)));
      if (!ready) u.actionCooldowns.set('test_blink', 10_000);
      spawn('enemy', { x: 10, y: 8 });
      for (let i = 0; i < 200; i++) world.tick();
      if (ready) expect(u.position.x, 'ready').toBeGreaterThanOrEqual(9); // across, beside the foe
      else expect(u.position, 'cooling').toEqual({ x: 2, y: 8 });
    }
  });
});
