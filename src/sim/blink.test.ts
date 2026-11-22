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
 * first goal is the nearest cell with its target in blink range; with no
 * foe in range, it jumps toward where its carrier walks when that saves
 * more than its range. Cells are worked out on the grid by hand.
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

describe("the blink's jump toward where its unit walks", () => {
  /** A chasm two columns wide, x 6 and 7, open only at the board's top two
   *  rows, so the walk round is long; and a foe parked in the far corner. */
  const chasmBoard = () => {
    const s = setup();
    s.tiles('chasm', [6, 7].flatMap((x) => column(x).filter((c) => c.y >= 2)));
    s.spawn('enemy', { x: 15, y: 15 });
    return s;
  };
  /** The player's order to a tile; the tick drains it, and a unit far from
   *  the tile is left with no target. */
  const orderTile = (world: World, cell: GridCoord): void => {
    world.enqueueCommand({ kind: 'setObjective', team: 'player', objective: { mode: 'focus', target: { kind: 'tile', cell } } });
    world.tick();
  };
  const landing = (p: ActionProposal | null): GridCoord | undefined =>
    p === null ? undefined : (p.action.toData() as EffectActionData).ops[0]!.moveDest;

  it('under a tile order across a chasm, jumps it to the cell with the least walk left, straight across', () => {
    const { world, spawn } = chasmBoard();
    const u = spawn('player', { x: 4, y: 12 });
    orderTile(world, { x: 12, y: 12 });
    expect(u.targetId).toBeNull();
    expect(landing(proposeEffectAbility(blink(5), u, world))).toEqual({ x: 9, y: 12 });
  });

  it('a claim takes a cell out, the next nearest the straight line taken; a wall line is jumped as a chasm is', () => {
    const { world, spawn } = chasmBoard();
    const u = spawn('player', { x: 4, y: 12 });
    orderTile(world, { x: 12, y: 12 });
    world.claimCell({ x: 9, y: 12 }, spawn('enemy', { x: 9, y: 14 }).id);
    expect(landing(proposeEffectAbility(blink(5), u, world))).toEqual({ x: 9, y: 11 });

    const walled = setup();
    walled.spawn('enemy', { x: 15, y: 15 });
    for (const x of [6, 7]) for (const c of column(x).filter((c) => c.y >= 2)) spawnWall(walled.world, c);
    const w = walled.spawn('player', { x: 4, y: 12 });
    orderTile(walled.world, { x: 12, y: 12 });
    expect(landing(proposeEffectAbility(blink(5), w, walled.world))).toEqual({ x: 9, y: 12 });
  });

  it('a slow tile counts at its cost: across six columns of mud it jumps, where a walk of floor would not', () => {
    const { world, spawn, tiles } = setup();
    spawn('enemy', { x: 15, y: 15 });
    tiles('mud', [5, 6, 7, 8, 9, 10].flatMap(column));
    const u = spawn('player', { x: 4, y: 12 });
    orderTile(world, { x: 14, y: 12 });
    expect(landing(proposeEffectAbility(blink(5), u, world))).toEqual({ x: 9, y: 12 });
  });

  it('on open ground it walks, since a jump saves exactly its range there', () => {
    const { world, spawn } = setup();
    spawn('enemy', { x: 15, y: 15 });
    const u = spawn('player', { x: 4, y: 12 });
    orderTile(world, { x: 12, y: 12 });
    expect(proposeEffectAbility(blink(5), u, world)).toBeNull();
  });

  it('with its foe out of range across the chasm and no near bank in range, jumps it; with one, walks there to blink at the foe', () => {
    const { world, spawn } = chasmBoard();
    const u = spawn('player', { x: 4, y: 12 });
    const foe = spawn('enemy', { x: 13, y: 12 });
    u.targetId = foe.id;
    // Every cell in blink range of the foe is across; the nearest landing among them.
    expect(landing(proposeEffectAbility(blink(5), u, world))).toEqual({ x: 8, y: 12 });
    foe.position = { x: 10, y: 12 }; // the near bank, (5,12), is in blink range of it
    expect(proposeEffectAbility(blink(5), u, world)).toBeNull();
  });

  it('not with no order and no foe, nor while blind, nor for a blink that carries a hit', () => {
    const lone = setup();
    lone.tiles('chasm', [6, 7].flatMap((x) => column(x).filter((c) => c.y >= 2)));
    const alone = lone.spawn('player', { x: 4, y: 12 });
    expect(proposeEffectAbility(blink(5), alone, lone.world), 'no order, no foe').toBeNull();
    // The foe parked across the chasm is a target to jump toward, so the
    // gates below are read under the order.
    const { world, spawn } = chasmBoard();
    const u = spawn('player', { x: 4, y: 12 });
    orderTile(world, { x: 12, y: 12 });
    const hits = parseAbilityDef({
      id: 'test_blink_hit', name: 'Test Blink Hit', description: 'A test blink that strikes.',
      cooldownSeconds: 10, speedScaled: false, rangeCells: 5,
      target: { kind: 'self' },
      timeline: [{ phase: 'impact', seconds: 0.25 }],
      orphanPolicy: 'commit-at-cast', priority: 5,
      effects: [
        { phase: 'impact', op: { kind: 'move', mode: 'blink' } },
        { phase: 'impact', op: { kind: 'damage', scaling: 'strength', might: 2, critBase: 0, critable: false, evadable: true, bypassDefense: false } },
      ],
    });
    expect(proposeEffectAbility(hits, u, world), 'a hit').toBeNull();
    expect(proposeEffectAbility(blink(5), u, world), 'the order').not.toBeNull();
    world.applyStatusEffect(u, statusDef('blind'), null);
    expect(proposeEffectAbility(blink(5), u, world), 'blind').toBeNull();
  });
});
