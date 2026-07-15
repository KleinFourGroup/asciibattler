import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { ARCHETYPE_CONFIG } from '../archetypes';
import { createAbility } from '../abilities/registry';
import { MovementBehavior } from './MovementBehavior';
import { AbilityBehavior } from './AbilityBehavior';
import { SwapAction } from '../actions/SwapAction';
import { WaitAction } from '../actions/WaitAction';
import { YIELD_SWAP_SCORE } from '../movement';
import { ABILITY_DEFS } from '../../config/abilities';
import { Unit, type Archetype, type Team, type UnitStats } from '../Unit';
import { deriveStats } from '../stats';
import type { GameEvents } from '../../core/events';

/**
 * 56c2 — the blocker-initiated RANGED YIELD (the GP5 healer pattern
 * generalized; the "swap request" design made stateless): a ranged unit that
 * is strictly blocking a boxed melee teammate proposes the yield-swap at its
 * own action-selection poll, scored ABOVE its attack — a fill-phase attacker
 * is busy for its entire cadence by design, so this is the ONLY window where
 * a swap can reach it (the observed scenario-1 starvation). The tick-driven
 * drain test is the regression pin for that observation.
 */

const bus = () => new EventBus<GameEvents>();

interface Spec {
  archetype: Archetype;
  team: Team;
  x: number;
  y: number;
  hp?: number;
  /** Attach MovementBehavior + AbilityBehavior + the archetype's ability. */
  combat?: boolean;
  ability?: string;
}

function build(specs: Spec[], b: EventBus<GameEvents> = bus()) {
  const world = new World(b, new RNG(1));
  const units = specs.map((s) => {
    const stats = { ...ARCHETYPE_CONFIG[s.archetype].baseStats, luck: 0 };
    const u = world.spawnUnit({ archetype: s.archetype, level: 1, stats, xp: 0 }, s.team, {
      x: s.x,
      y: s.y,
    });
    if (s.hp !== undefined) u.currentHp = s.hp;
    if (s.combat) {
      u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
      u.abilities.push(createAbility(s.ability ?? 'sword'));
    }
    return u;
  });
  return { world, units };
}

/** A neutral wall body (only team + position matter to the movement code). */
const WALL_STATS: UnitStats = {
  constitution: 20, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0, precision: 5, evasion: 5, speed: 5, mobility: 5, power: 1,
};
let nextWallId = 9000;
function addWalls(world: World, cells: Array<{ x: number; y: number }>) {
  for (const pos of cells) {
    world.units.push(
      new Unit({
        id: nextWallId++,
        team: 'neutral',
        archetype: 'mercenary',
        glyph: '#',
        stats: WALL_STATS,
        derived: deriveStats(WALL_STATS, 1),
        position: pos,
      }),
    );
  }
}

/** Walls lining y±1 over an x-span → a 1-wide corridor at row `y`. */
function corridor(world: World, y: number, x0: number, x1: number) {
  const cells: Array<{ x: number; y: number }> = [];
  for (let x = x0; x <= x1; x++) cells.push({ x, y: y - 1 }, { x, y: y + 1 });
  addWalls(world, cells);
}

describe('56c2 — YIELD_SWAP_SCORE (balance-proof)', () => {
  it('outranks every shipped ability priority (else fill-phase attackers starve the yield)', () => {
    for (const def of Object.values(ABILITY_DEFS)) {
      expect(def.priority, `ability '${def.id}' priority`).toBeLessThan(YIELD_SWAP_SCORE);
    }
  });
});

describe('56c2 — the ranged yield (blocker-initiated)', () => {
  /** The corridor jam from the blocker's side: archer in front of a boxed
   *  melee, enemy beyond. Returns the archer's MovementBehavior proposal. */
  function jam(opts: { allyArchetype?: Archetype; allyBusy?: boolean; walls?: boolean } = {}) {
    const { world, units } = build([
      { archetype: 'ranged', team: 'player', x: 4, y: 5, combat: true, ability: 'bow' },
      { archetype: opts.allyArchetype ?? 'mercenary', team: 'player', x: 3, y: 5, combat: true },
      { archetype: 'mercenary', team: 'enemy', x: 8, y: 5, hp: 500 },
    ]);
    if (opts.walls !== false) corridor(world, 5, 0, 9);
    const [archer, ally] = units as [Unit, Unit];
    if (opts.allyBusy === true) {
      ally.activeAction = {
        action: new WaitAction(),
        startTick: world.currentTick,
        finishTick: world.currentTick + 6,
        phases: [{ phase: 'recovery', ticks: 6 }],
      };
    }
    return { world, archer, ally, proposal: new MovementBehavior().proposeAction(archer, world) };
  }

  it('yields to a strictly blocked melee teammate, scored above the attack', () => {
    const { proposal, archer, ally } = jam();
    expect(proposal).not.toBeNull();
    expect(proposal!.action).toBeInstanceOf(SwapAction);
    expect(proposal!.score).toBe(YIELD_SWAP_SCORE);
    const data = (proposal!.action as SwapAction).toData();
    expect(data.from).toEqual(archer.position); // the archer files back…
    expect(data.to).toEqual(ally.position); // …onto the melee's cell
    expect(data.otherId).toBe(ally.id);
  });

  it('does NOT yield in the open (the melee has another way forward)', () => {
    const { proposal } = jam({ walls: false });
    expect(proposal === null || !(proposal.action instanceof SwapAction)).toBe(true);
  });

  it('does NOT yield to a blocked RANGED ally (role order)', () => {
    const { proposal } = jam({ allyArchetype: 'ranged' });
    expect(proposal === null || !(proposal.action instanceof SwapAction)).toBe(true);
  });

  it('does NOT yield to a busy melee (the shared swappable-partner gate)', () => {
    const { proposal } = jam({ allyBusy: true });
    expect(proposal === null || !(proposal.action instanceof SwapAction)).toBe(true);
  });
});

describe('56c2 — the tick-driven corridor drain (the scenario-1 regression)', () => {
  it('a melee passes a PERPETUALLY-FIRING archer within a few cadences', () => {
    // The observed labyrinth bug: a fill-phase archer is never idle while
    // engaging, so no mover-side probe can ever catch it — the yield at its
    // own selection poll is the only door, and it must outrank the attack.
    const b = bus();
    const swaps: GameEvents['unit:swapped'][] = [];
    b.on('unit:swapped', (e) => swaps.push(e));
    const { world, units } = build(
      [
        { archetype: 'ranged', team: 'player', x: 4, y: 5, combat: true, ability: 'bow' },
        { archetype: 'mercenary', team: 'player', x: 3, y: 5, combat: true },
        // A tough, inert target dummy (no behaviors): in bow range of the
        // archer's cell, so the archer opens fire immediately and never stops.
        { archetype: 'mercenary', team: 'enemy', x: 7, y: 5, hp: 500 },
      ],
      b,
    );
    corridor(world, 5, 0, 9);
    const [archer, melee] = units as [Unit, Unit];

    for (let i = 0; i < 120 && melee.position.x <= archer.position.x; i++) world.tick();

    expect(swaps.length).toBeGreaterThanOrEqual(1); // the yield actually fired
    expect(melee.position.x).toBeGreaterThan(archer.position.x); // and the pass happened
  });
});

describe('56c2 — the pre-flip partner reserve (World.tick skip)', () => {
  it('a reserved partner starts NOTHING while the swap is pre-flip', () => {
    // The partner would otherwise attack every poll (adjacent enemy). While
    // the actor's swap is in flight pre-flip, the partner must not start an
    // action the coming exchange would invalidate.
    const b = bus();
    const attacks: GameEvents['unit:attacked'][] = [];
    b.on('unit:attacked', (e) => attacks.push(e));
    const { world, units } = build(
      [
        { archetype: 'mercenary', team: 'player', x: 5, y: 5, combat: true }, // the actor
        { archetype: 'mercenary', team: 'player', x: 4, y: 5, combat: true }, // the partner
        { archetype: 'mercenary', team: 'enemy', x: 3, y: 5, hp: 500 }, // adjacent to partner
      ],
      b,
    );
    const [actor, partner] = units as [Unit, Unit];
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, partner.id, 20);
    actor.activeAction = {
      action,
      startTick: world.currentTick,
      finishTick: world.currentTick + 20,
      phases: [
        { phase: 'travel', ticks: 10 },
        { phase: 'impact', ticks: 0 },
        { phase: 'recovery', ticks: 10 },
      ],
    };

    for (let i = 0; i < 5; i++) world.tick(); // all pre-flip (travel = 10)

    expect(partner.activeAction).toBeNull();
    expect(attacks.filter((a) => a.attackerId === partner.id)).toEqual([]);
  });
});
