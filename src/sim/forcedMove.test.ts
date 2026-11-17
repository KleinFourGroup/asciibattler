import { describe, expect, it } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { ActionProposal } from './Action';
import type { Archetype, Behavior, Team, Unit, UnitStats } from './Unit';
import { moveProposal, swapProposal } from './movement';
import { claimantOf, findOverlappingCells } from './occupancy';
import { SpawnAction } from './actions/SpawnAction';
import { TICK_RATE } from '../config';
import { createMovementBehavior } from './behaviors/registry';
import simJson from '../../config/sim.json';

/**
 * The forced move's hold (`World.forceMove`): the victim's action ended, the
 * unit held while its glyph slides, the landing's entry at the slide's end.
 * The slide's length is worked out here from the raw config, not from `SIM`.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};
/** Ticks a forced move of `cells` holds its victim, from the raw config. */
const slide = (cells: number): number => Math.max(1, Math.round(cells * simJson.pushSecondsPerCell * TICK_RATE));
const STEP_TICKS = 4;

/** Proposes one action, once. */
class Once implements Behavior {
  readonly kind = 'test:once';
  private used = false;
  constructor(private readonly make: () => ActionProposal) {}
  proposeAction(): ActionProposal | null {
    if (this.used) return null;
    this.used = true;
    return this.make();
  }
}

function setup() {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1), 16, 16);
  /** A bare unit carrying `b` alone, or with `fights` a combatant wired as
   *  battle setup wires one. */
  const spawn = (team: Team, pos: GridCoord, b?: Behavior, fights?: Archetype): Unit => {
    const u = world.spawnUnit({ archetype: fights ?? 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
    if (fights) world.wireSpawned(u, createMovementBehavior(fights), true);
    else if (b) u.behaviors.push(b);
    return u;
  };
  spawn('enemy', { x: 14, y: 14 }); // keeps the battle open
  return { world, bus, spawn };
}

function ticks(world: World, n: number): void {
  for (let i = 0; i < n; i++) world.tick();
}

describe('World.forceMove — the action it ends', () => {
  it('ends a step before its flip, so the flip never moves the unit back', () => {
    const { world, bus, spawn } = setup();
    const from = { x: 2, y: 2 }, to = { x: 3, y: 2 };
    const mover = spawn('player', from, new Once(() => moveProposal(from, to, STEP_TICKS)));
    world.tick(); // the step starts: it claims `to` and stands on `from`
    expect(claimantOf(world, to)).toBe(mover.id);
    const aborted: GameEvents['unit:moveAborted'][] = [];
    bus.on('unit:moveAborted', (e) => aborted.push(e));

    world.forceMove(mover, { x: 2, y: 5 }, 3);

    expect(aborted).toEqual([{ unitId: mover.id, from, to }]);
    expect(claimantOf(world, to)).toBeUndefined();
    expect(mover.actionCooldowns.get('move')).toBe(0);
    ticks(world, STEP_TICKS + 1); // past where the flip would have landed
    expect(mover.position).toEqual({ x: 2, y: 5 });
    expect(findOverlappingCells(world)).toEqual([]);
  });

  it("ends a swap's actor before the exchange: the swap aborts and the partner stays", () => {
    const { world, bus, spawn } = setup();
    const a = { x: 6, y: 6 }, b = { x: 7, y: 6 };
    const partner = spawn('player', b);
    const actor = spawn('player', a, new Once(() => swapProposal(a, b, partner.id, STEP_TICKS)));
    world.tick(); // the swap starts; the exchange lands at its flip
    expect(world.isSwapReservedPartner(partner.id)).toBe(true);
    const aborted: GameEvents['unit:swapAborted'][] = [];
    bus.on('unit:swapAborted', (e) => aborted.push(e));

    world.forceMove(actor, { x: 6, y: 9 }, 3);

    expect(aborted).toEqual([{ unitA: actor.id, unitB: partner.id, cellA: a, cellB: b }]);
    expect(world.isSwapReservedPartner(partner.id)).toBe(false);
    expect(actor.actionCooldowns.get('swap')).toBe(0);
    ticks(world, STEP_TICKS + 1);
    expect(actor.position).toEqual({ x: 6, y: 9 });
    expect(partner.position).toEqual(b);
    expect(findOverlappingCells(world)).toEqual([]);
  });

  it("leaves a swap whose partner is pushed to step alone, with no overlap", () => {
    const { world, spawn } = setup();
    const a = { x: 6, y: 6 }, b = { x: 7, y: 6 };
    const partner = spawn('player', b);
    const actor = spawn('player', a, new Once(() => swapProposal(a, b, partner.id, STEP_TICKS)));
    world.tick();
    world.forceMove(partner, { x: 7, y: 9 }, 3);
    ticks(world, STEP_TICKS + 1);
    expect(actor.position).toEqual(b);
    expect(partner.position).toEqual({ x: 7, y: 9 });
    expect(findOverlappingCells(world)).toEqual([]);
  });

  it("ends an ability with nothing more fired and its cooldown spent: the gambit's spring-back never lands", () => {
    const { world, bus, spawn } = setup();
    const rogue = spawn('player', { x: 5, y: 5 }, undefined, 'rogue');
    spawn('enemy', { x: 6, y: 5 });
    let n = 0;
    while (rogue.activeAction?.action.id !== 'gambit_strike' && n++ < 20) world.tick();
    expect(rogue.activeAction?.action.id).toBe('gambit_strike');
    const moved: GameEvents['unit:moved'][] = [];
    bus.on('unit:moved', (e) => { if (e.unitId === rogue.id) moved.push(e); });

    world.forceMove(rogue, { x: 5, y: 8 }, 3);

    expect(rogue.actionCooldowns.get('gambit_strike')).toBeGreaterThan(0);
    ticks(world, slide(3) - 1); // the hold, inside which the spring-back was due
    expect(moved.map((e) => e.to)).toEqual([{ x: 5, y: 8 }]);
    expect(rogue.position).toEqual({ x: 5, y: 8 });
  });
});

describe('World.forceMove — the hold', () => {
  it('holds the unit for the slide, and lets it act on the tick the slide ends', () => {
    const { world, bus, spawn } = setup();
    const at = { x: 3, y: 3 };
    const landing = { x: 3, y: 6 };
    const next = { x: 4, y: 6 };
    const u = spawn('player', at, new Once(() => moveProposal(landing, next, STEP_TICKS)));
    const pushedAt = world.currentTick;
    world.forceMove(u, landing, 3);
    expect(u.activeAction?.action.id).toBe('forcedMove');
    expect(u.activeAction?.finishTick).toBe(pushedAt + slide(3));

    const starts: number[] = [];
    bus.on('unit:moved', (e) => { if (e.unitId === u.id) starts.push(world.currentTick); });
    ticks(world, slide(3));
    expect(starts).toEqual([pushedAt + slide(3)]); // its step, once the hold ends
  });

  it("keeps a spawn's lockout that outlasts the slide", () => {
    const { world, spawn } = setup();
    const u = spawn('player', { x: 3, y: 3 });
    const LOCK = 20;
    const t0 = world.currentTick;
    world.seatAction(u, new SpawnAction(), [{ phase: 'impact', ticks: LOCK }]);
    world.forceMove(u, { x: 3, y: 4 }, 1);
    expect(u.activeAction?.finishTick).toBe(t0 + LOCK);
    ticks(world, LOCK - 1);
    expect(u.activeAction).not.toBeNull();
    world.tick();
    expect(u.activeAction).toBeNull();
  });

  it("keeps an earlier push's hold when a second, shorter one lands", () => {
    const { world, spawn } = setup();
    const u = spawn('player', { x: 3, y: 3 });
    const t0 = world.currentTick;
    world.forceMove(u, { x: 3, y: 6 }, 3);
    ticks(world, 2);
    world.forceMove(u, { x: 3, y: 7 }, 1);
    expect(u.activeAction?.finishTick).toBe(t0 + slide(3));
  });

  it('runs the landing tile\'s entry as the slide ends, not as the push fires', () => {
    const { world, bus, spawn } = setup();
    const u = spawn('player', { x: 5, y: 5 });
    const landing = { x: 5, y: 8 };
    world.tileGrid.setKind(landing, 'mud');
    const poisoned: number[] = [];
    bus.on('status:applied', (e) => { if (e.unitId === u.id && e.statusId === 'poison') poisoned.push(world.currentTick); });
    const pushedAt = world.currentTick;
    world.forceMove(u, landing, 3);
    expect(poisoned).toEqual([]);
    ticks(world, slide(3));
    expect(poisoned).toEqual([pushedAt + slide(3)]);
  });

  it('round-trips a unit mid-slide: the reloaded world ends the hold and runs the entry as the unbroken one does', () => {
    const run = (reloadAt: number | null): string => {
      const { world, spawn } = setup();
      const u = spawn('player', { x: 5, y: 5 });
      world.tileGrid.setKind({ x: 5, y: 8 }, 'mud');
      world.forceMove(u, { x: 5, y: 8 }, 3);
      let w = world;
      for (let i = 0; i < slide(3) + 3; i++) {
        if (i === reloadAt) {
          const wire = JSON.parse(JSON.stringify(w.toJSON())) as ReturnType<World['toJSON']>;
          expect(wire.units.find((x) => x.id === u.id)?.activeAction?.actionId).toBe('forcedMove');
          w = World.fromJSON(wire, new EventBus<GameEvents>());
        }
        w.tick();
      }
      return JSON.stringify(w.toJSON());
    };
    expect(run(3)).toBe(run(null));
  });
});
