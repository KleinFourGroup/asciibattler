import { describe, expect, it } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { ActionProposal } from './Action';
import type { Behavior, Team, Unit, UnitStats } from './Unit';
import { secondsToTicks } from '../config';
import { SIM } from '../config/sim';
import { parseAbilityDef, type AbilityDef } from './effects/schema';
import { proposeEffectAbility } from './effects/propose';
import type { EffectActionData } from './effects/EffectAction';
import { engagementReach } from './archetypes';
import { spawnWall } from './environment';
import { hasLineOfSight } from './LineOfSight';
import { lineCells } from './charge';
import { createMovementBehavior } from './behaviors/registry';
import { claimantOf, claimedDestinationOf } from './occupancy';

/**
 * The charge, a `move` op in `charge` mode on an `enemyInRange` def: from
 * three cells or more, along the straight line sight takes, stopping before
 * the first body, impassable tile or claim, a foe's claim meeting the foe
 * when it arrives before the blow; proposed only when it walks two cells or
 * more and meets a foe; the charger held for the cells at the push's rate
 * on its start, its landing claimed, and arriving there as it strikes, with
 * a bonus a cell walked, and a knockback on the foe it met, if still beside. Cells are
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
  const shoved: number[] = [];
  bus.on('unit:shoved', (e) => shoved.push(e.unitId));
  const world = new World(bus, new RNG(1), 16, 16);
  // A mercenary, its reach the sword's one cell, with no behaviours of its own.
  const spawn = (team: Team, pos: GridCoord, b?: Behavior): Unit => {
    const u = world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
    if (b) u.behaviors.push(b);
    return u;
  };
  return { world, spawn, shoved };
}

/** A charge from 3 (or `minRangeCells`) to 5 cells: might 2 and 1 more a
 *  cell walked, then a knockback of 1. */
const charge = (minRangeCells = 3): AbilityDef =>
  parseAbilityDef({
    id: 'test_charge', name: 'Test Charge', description: 'A test charge.',
    cooldownSeconds: 10, speedScaled: false, rangeCells: 5, minRangeCells,
    target: { kind: 'enemyInRange' },
    timeline: [
      { phase: 'travel', seconds: 0 },
      { phase: 'impact', seconds: 0 },
      { phase: 'recovery', seconds: 0.3 },
    ],
    orphanPolicy: 'commit-at-cast', priority: 10,
    effects: [
      { phase: 'travel', op: { kind: 'move', mode: 'charge' } },
      { phase: 'impact', op: { kind: 'damage', scaling: 'strength', might: 2, mightPerCell: 1, critBase: 0, critable: false, evadable: true, bypassDefense: false } },
      { phase: 'impact', op: { kind: 'push', cells: 1, direction: 'away' } },
    ],
  });

/** Ticks until `foe` is hit, or `max` ticks. */
const tickUntilHit = (world: World, foe: Unit, max = 60): void => {
  const hp = foe.currentHp;
  for (let i = 0; i < max && foe.currentHp === hp; i++) world.tick();
};

describe('the charge', () => {
  it('rushes along a line off the eight directions to beside its foe, arriving as it hits with a bonus a cell, and knocks it back', () => {
    const { world, spawn, shoved } = setup();
    const caster = spawn('player', { x: 2, y: 8 }, new CastOnce(charge()));
    const foe = spawn('enemy', { x: 7, y: 10 }); // five east, two south
    const hp = foe.currentHp;
    world.tick();
    // The line: (3,8) (4,9) (5,9) (6,10), then the foe's cell. Four cells.
    // It sets off: the slide begins and the landing is claimed, but the
    // caster stands on its start until the blow.
    expect(shoved).toEqual([caster.id]);
    expect(claimantOf(world, { x: 6, y: 10 })).toBe(caster.id);
    expect(caster.position).toEqual({ x: 2, y: 8 });
    expect(foe.currentHp).toBe(hp);
    tickUntilHit(world, foe);
    expect(caster.position).toEqual({ x: 6, y: 10 });
    expect(claimantOf(world, { x: 6, y: 10 })).toBeUndefined();
    expect(foe.currentHp).toBe(hp - (2 + 4));
    expect(foe.position).toEqual({ x: 8, y: 10 }); // knocked a cell on
  });

  it('is held for the cells it walked at the push rate', () => {
    const { world, spawn } = setup();
    const caster = spawn('player', { x: 2, y: 8 });
    spawn('enemy', { x: 7, y: 10 });
    const p = proposeEffectAbility(charge(), caster, world)!;
    expect(p.phases.find((ph) => ph.phase === 'travel')!.ticks).toBe(secondsToTicks(4 * SIM.pushSecondsPerCell));
    expect((p.action.toData() as EffectActionData).ops[0]!.moveDest).toEqual({ x: 6, y: 10 });
  });

  it('is not proposed from nearer than its run-up, nor beyond its range', () => {
    const { world, spawn } = setup();
    const caster = spawn('player', { x: 2, y: 8 });
    const foe = spawn('enemy', { x: 4, y: 8 }); // two cells
    expect(proposeEffectAbility(charge(), caster, world)).toBeNull();
    foe.position = { x: 5, y: 8 }; // three
    expect(proposeEffectAbility(charge(), caster, world)).not.toBeNull();
    // A floor of 4 refuses it, though the walk of two would pass.
    expect(proposeEffectAbility(charge(4), caster, world)).toBeNull();
    foe.position = { x: 8, y: 8 }; // six
    expect(proposeEffectAbility(charge(), caster, world)).toBeNull();
  });

  it('is not proposed into an ally, a wall, a chasm or a claim in the way, nor on a one-cell walk', () => {
    const blocked: [string, (w: World, spawn: (t: Team, p: GridCoord) => Unit) => void][] = [
      ['an ally', (_w, spawn) => void spawn('player', { x: 5, y: 8 })],
      ['a wall', (w) => void spawnWall(w, { x: 5, y: 8 })],
      ['a chasm', (w) => w.tileGrid.setKind({ x: 5, y: 8 }, 'chasm')],
      ['a claim', (w, spawn) => w.claimCell({ x: 5, y: 8 }, spawn('player', { x: 5, y: 12 }).id)],
      ['a foe a cell off', (_w, spawn) => void spawn('enemy', { x: 4, y: 8 })],
    ];
    for (const [what, place] of blocked) {
      const { world, spawn } = setup();
      const caster = spawn('player', { x: 2, y: 8 });
      const foe = spawn('enemy', { x: 7, y: 8 });
      caster.targetId = foe.id;
      place(world, spawn);
      if (what === 'a foe a cell off') caster.targetId = foe.id; // committed past the nearer one
      expect(proposeEffectAbility(charge(), caster, world), what).toBeNull();
    }
  });

  it('a foe in the way takes the charge in its target\'s place', () => {
    const { world, spawn } = setup();
    const caster = spawn('player', { x: 2, y: 8 });
    const far = spawn('enemy', { x: 7, y: 8 });
    const near = spawn('enemy', { x: 5, y: 8 });
    caster.targetId = far.id;
    const p = proposeEffectAbility(charge(), caster, world);
    expect(p).not.toBeNull();
    const d = p!.action.toData() as EffectActionData;
    expect(d.targetId).toBe(near.id);
    expect(d.ops[0]!.moveDest).toEqual({ x: 4, y: 8 });
  });

  /** A foe four cells from the caster, spawned first so it sets off toward
   *  the caster, claiming the cell before it, before the caster looks; its
   *  mobility of 4 steps a cell in 0.7 s, its flip at half that. */
  const walkingIn = (world: World): Unit => {
    const foe = world.spawnUnit({ archetype: 'mercenary', level: 1, stats: { ...BASE, mobility: 4 }, xp: 0 }, 'enemy', { x: 7, y: 8 });
    foe.behaviors.push(createMovementBehavior('mercenary'));
    return foe;
  };

  it('meets a foe walking in at the cell it is stepping into, and strikes it there, when it arrives before the blow', () => {
    const { world, spawn } = setup();
    const foe = walkingIn(world);
    const caster = spawn('player', { x: 2, y: 8 }, new CastOnce(charge()));
    const hp = foe.currentHp;
    world.tick();
    expect(claimedDestinationOf(world, foe.id)).toEqual({ x: 6, y: 8 });
    // The walk stops before the claim, three cells, the foe still on (7,8).
    expect(claimantOf(world, { x: 5, y: 8 })).toBe(caster.id);
    expect(foe.position).toEqual({ x: 7, y: 8 });
    tickUntilHit(world, foe);
    expect(caster.position).toEqual({ x: 5, y: 8 });
    expect(foe.currentHp).toBe(hp - (2 + 3));
  });

  it('is not proposed at a foe walking in that would arrive after the blow: a slow step onto sand', () => {
    const { world, spawn } = setup();
    for (let y = 0; y < 16; y++) world.tileGrid.setKind({ x: 6, y }, 'sand');
    const foe = walkingIn(world);
    const caster = spawn('player', { x: 2, y: 8 }, new CastOnce(charge()));
    world.tick();
    expect(claimedDestinationOf(world, foe.id)).toEqual({ x: 6, y: 8 });
    expect(caster.position).toEqual({ x: 2, y: 8 });
    expect(proposeEffectAbility(charge(), caster, world)).toBeNull();
  });

  it('misses a foe that stepped out of reach during the rush, and its knockback skips it', () => {
    const { world, spawn } = setup();
    const caster = spawn('player', { x: 2, y: 8 }, new CastOnce(charge()));
    const foe = spawn('enemy', { x: 7, y: 8 });
    const hp = foe.currentHp;
    world.tick();
    expect(claimantOf(world, { x: 6, y: 8 })).toBe(caster.id);
    foe.position = { x: 9, y: 8 };
    tickUntilHit(world, foe);
    expect(caster.position).toEqual({ x: 6, y: 8 });
    expect(foe.currentHp).toBe(hp);
    expect(foe.position).toEqual({ x: 9, y: 8 });
  });

  it('its landing is an entry: onto mud it poisons', () => {
    const { world, spawn } = setup();
    world.tileGrid.setKind({ x: 6, y: 8 }, 'mud');
    const caster = spawn('player', { x: 2, y: 8 }, new CastOnce(charge()));
    const foe = spawn('enemy', { x: 7, y: 8 });
    world.tick();
    expect(caster.effects.some((e) => e.key === 'poison')).toBe(false); // not there yet
    tickUntilHit(world, foe);
    expect(caster.position).toEqual({ x: 6, y: 8 });
    expect(caster.effects.some((e) => e.key === 'poison')).toBe(true);
  });

  it('its knockback drops the foe it hits into a chasm', () => {
    const { world, spawn } = setup();
    world.tileGrid.setKind({ x: 8, y: 8 }, 'chasm');
    spawn('player', { x: 2, y: 8 }, new CastOnce(charge()));
    const foe = spawn('enemy', { x: 7, y: 8 });
    for (let i = 0; i < 60 && world.units.includes(foe); i++) world.tick();
    expect(world.units.includes(foe)).toBe(false);
  });

  it('sets no reach, so its carrier closes as melee', () => {
    expect(engagementReach(charge())).toBeNull();
  });

  it('a charge outside the enemyInRange selector, off a travel phase, or with a fill phase is refused', () => {
    const raw = (over: Record<string, unknown>) => ({
      id: 'x', name: 'X', cooldownSeconds: 10, rangeCells: 5, target: { kind: 'enemyInRange' },
      timeline: [{ phase: 'travel', seconds: 0 }, { phase: 'impact', seconds: 0 }], orphanPolicy: 'commit-at-cast', priority: 1,
      effects: [{ phase: 'travel', op: { kind: 'move', mode: 'charge' } }], ...over,
    });
    expect(() => parseAbilityDef(raw({}))).not.toThrow();
    expect(() => parseAbilityDef(raw({ target: { kind: 'self' } }))).toThrow(/charge/);
    expect(() => parseAbilityDef(raw({ effects: [{ phase: 'impact', op: { kind: 'move', mode: 'charge' } }] }))).toThrow(/charge/);
    expect(() => parseAbilityDef(raw({ timeline: [{ phase: 'travel', seconds: 0 }, { phase: 'recovery', seconds: 'fill' }] }))).toThrow(/charge/);
  });
});

describe('the charge\'s line', () => {
  it('is the line sight takes: each cell short of the end blocks sight, and no other does', () => {
    const from = { x: 5, y: 5 };
    for (let tx = 0; tx <= 10; tx++) {
      for (let ty = 0; ty <= 10; ty++) {
        const to = { x: tx, y: ty };
        const line = lineCells(from, to);
        const onLine = new Set(line.slice(0, -1).map((c) => `${c.x},${c.y}`));
        for (let x = 0; x <= 10; x++) {
          for (let y = 0; y <= 10; y++) {
            if ((x === from.x && y === from.y) || (x === tx && y === ty)) continue;
            const seen = hasLineOfSight(from, to, [{ x, y }]);
            expect(seen, `${x},${y} on ${from.x},${from.y} to ${tx},${ty}`).toBe(!onLine.has(`${x},${y}`));
          }
        }
      }
    }
  });
});
