import { describe, expect, it } from 'vitest';
import { World } from '../World';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import type { Behavior, Team, Unit, UnitStats } from '../Unit';
import { abilityDef } from '../../config/abilities';
import { parseAbilityDef, type AbilityDef } from './schema';
import { proposeEffectAbility } from './propose';
import type { EffectActionData } from './EffectAction';

/**
 * The hit after a leap: a leap keeps its enemy, a damage op after the move
 * hits it only within the caster's reach from the landing, and a leap that
 * carries a hit is proposed only from its minimum range and only when its
 * landing puts the enemy within reach. Cast through a real World tick, as
 * `pushOp.test.ts` casts; the cells are worked out on the grid by hand.
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
  // A mercenary's reach is its sword's, one cell.
  const spawn = (team: Team, pos: GridCoord, b?: Behavior): Unit => {
    const u = world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
    if (b) u.behaviors.push(b);
    return u;
  };
  return { world, spawn };
}

/** A pounce: a leap of up to four cells from three or more, then a hit of 5
 *  as it lands, after a 0.25 s slide. `hit: false` is the same leap with no
 *  hit, as the dash is. */
const pounce = (opts: { hit?: boolean; minRangeCells?: number; orphanPolicy?: 'commit-at-cast' | 'fizzle' } = {}): AbilityDef =>
  parseAbilityDef({
    id: 'test_pounce', name: 'Test Pounce', description: 'A test pounce.',
    cooldownSeconds: 5, speedScaled: false, rangeCells: 4, minRangeCells: opts.minRangeCells ?? 3,
    target: { kind: 'self' },
    timeline: [
      { phase: 'travel', seconds: 0.25 },
      { phase: 'impact', seconds: 0 },
      { phase: 'recovery', seconds: 0.3 },
    ],
    orphanPolicy: opts.orphanPolicy ?? 'commit-at-cast', priority: 10,
    effects: [
      { phase: 'travel', op: { kind: 'move', mode: 'advance' } },
      ...(opts.hit === false
        ? []
        : [{ phase: 'impact', op: { kind: 'damage', scaling: 'strength', might: 5, critBase: 0, critable: false, evadable: true, bypassDefense: false } }]),
    ],
  });

/** Ticks until `foe` is hit, or `max` ticks. */
const tickUntilHit = (world: World, foe: Unit, max = 40): void => {
  const hp = foe.currentHp;
  for (let i = 0; i < max && foe.currentHp === hp; i++) world.tick();
};

describe('the hit after a leap', () => {
  it('a leap keeps its enemy: the action carries its id, the dash as a pounce', () => {
    for (const def of [pounce(), abilityDef('dash')]) {
      const { world, spawn } = setup();
      const caster = spawn('player', { x: 4, y: 8 });
      const foe = spawn('enemy', { x: 8, y: 8 });
      const p = proposeEffectAbility(def, caster, world);
      expect(p, def.id).not.toBeNull();
      expect((p!.action.toData() as EffectActionData).targetId, def.id).toBe(foe.id);
    }
  });

  it('a hit after the leap lands on its enemy from the landing, after the slide', () => {
    const { world, spawn } = setup();
    const caster = spawn('player', { x: 4, y: 8 }, new CastOnce(pounce()));
    const foe = spawn('enemy', { x: 8, y: 8 });
    const hp = foe.currentHp;
    world.tick();
    // The leap stops before the foe's body: (5,8), (6,8), (7,8).
    expect(caster.position).toEqual({ x: 7, y: 8 });
    expect(foe.currentHp).toBe(hp); // not yet: the hit comes as the slide ends
    tickUntilHit(world, foe);
    expect(foe.currentHp).toBe(hp - 5);
    expect(caster.position).toEqual({ x: 7, y: 8 });
  });

  it('misses an enemy that stepped out of reach during the slide, whatever its orphan policy', () => {
    for (const orphanPolicy of ['commit-at-cast', 'fizzle'] as const) {
      const { world, spawn } = setup();
      const caster = spawn('player', { x: 4, y: 8 }, new CastOnce(pounce({ orphanPolicy })));
      const foe = spawn('enemy', { x: 8, y: 8 });
      const hp = foe.currentHp;
      world.tick();
      expect(caster.position, orphanPolicy).toEqual({ x: 7, y: 8 });
      foe.position = { x: 10, y: 8 }; // three cells from the landing
      tickUntilHit(world, foe);
      expect(foe.currentHp, orphanPolicy).toBe(hp);
    }
  });

  it('is not proposed from nearer than its minimum range', () => {
    const { world, spawn } = setup();
    const caster = spawn('player', { x: 4, y: 8 });
    spawn('enemy', { x: 6, y: 8 }); // two cells: beyond the sword, inside the floor of 3
    expect(proposeEffectAbility(pounce(), caster, world)).toBeNull();
    expect(proposeEffectAbility(pounce({ minRangeCells: 0 }), caster, world)).not.toBeNull();
  });

  it('a leap that carries a hit is not proposed when its landing falls short of reach', () => {
    const { world, spawn } = setup();
    const caster = spawn('player', { x: 4, y: 8 });
    spawn('enemy', { x: 10, y: 8 }); // six cells: four of leap leaves two
    expect(proposeEffectAbility(pounce(), caster, world)).toBeNull();
  });

  it('a leap with no hit still leaps short, as the dash does', () => {
    const { world, spawn } = setup();
    const caster = spawn('player', { x: 4, y: 8 });
    spawn('enemy', { x: 10, y: 8 });
    const p = proposeEffectAbility(pounce({ hit: false }), caster, world);
    expect(p).not.toBeNull();
    expect((p!.action.toData() as EffectActionData).ops[0]!.moveDest).toEqual({ x: 8, y: 8 });
  });
});
