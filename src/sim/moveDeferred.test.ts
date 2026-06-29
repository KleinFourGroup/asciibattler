import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Team, UnitStats, Behavior } from './Unit';
import type { ActionProposal } from './Action';
import { moveProposal } from './movement';
import { distanceBetween, isClaimed, claimantOf } from './occupancy';
import { SIM } from '../config/sim';

/**
 * §36b — the non-instant logical position flip + the claim lifecycle.
 *
 * A single-step move no longer flips `unit.position` at `start`: the unit
 * logically holds `from` (and reserves `to`) for the first half of the slide,
 * then flips to `to` (and releases the reservation) at the locked 50% mark.
 * These drive the mechanism directly with a stub behavior — the same pattern as
 * `moveAbort.test.ts` — so the timing + claim lifecycle is pinned independent of
 * any real pathing decision.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

const MOVE_TICKS = 4;
// Config-derived (balance-proof): the flip lands at this offset from move-start.
const FLIP_OFFSET = Math.floor(MOVE_TICKS * SIM.moveFlipFraction);

/** A behavior that always proposes the same single-step move (no other logic). */
class StubMoveBehavior implements Behavior {
  readonly kind = 'test:stub-move';
  constructor(
    private readonly from: GridCoord,
    private readonly to: GridCoord,
  ) {}
  proposeAction(): ActionProposal | null {
    return moveProposal(this.from, this.to, MOVE_TICKS);
  }
}

function setup() {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  return { world, bus };
}

function spawnAt(world: World, team: Team, pos: GridCoord) {
  return world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
}

/** Strip a unit's default behaviors and give it exactly `b` (or nothing). */
function onlyBehavior(unit: { behaviors: Behavior[] }, b?: Behavior) {
  unit.behaviors.length = 0;
  if (b) unit.behaviors.push(b);
}

describe('§36b — deferred logical position flip', () => {
  it('the flip fraction is the locked 50% (sanity on the config dial)', () => {
    expect(SIM.moveFlipFraction).toBe(0.5);
    expect(FLIP_OFFSET).toBe(2); // floor(4 * 0.5)
  });

  it('holds at `from` (claim on `to`) before the flip, then flips to `to` (claim released) at 50%', () => {
    const { world } = setup();
    const from = { x: 2, y: 2 };
    const to = { x: 3, y: 2 };
    const mover = spawnAt(world, 'player', from);
    // A far inert enemy keeps the battle ongoing across the ticks.
    onlyBehavior(spawnAt(world, 'enemy', { x: 10, y: 10 }));
    onlyBehavior(mover, new StubMoveBehavior(from, to));

    world.tick(); // tick 1: start — claim `to`, emit moved, position still `from`
    expect(mover.position).toEqual(from);
    expect(isClaimed(world, to)).toBe(true);
    expect(claimantOf(world, to)).toBe(mover.id);

    // Tick up to (but not through) the flip offset: still on `from`, still claimed.
    for (let o = 1; o < FLIP_OFFSET; o++) {
      world.tick();
      expect(mover.position).toEqual(from);
      expect(isClaimed(world, to)).toBe(true);
    }

    world.tick(); // the flip tick (offset === FLIP_OFFSET)
    expect(mover.position).toEqual(to); // arrived logically
    expect(isClaimed(world, to)).toBe(false); // reservation released on arrival
  });

  it('a 1-tick move flips instantly (floor keeps it byte-identical to the instant model)', () => {
    const { world } = setup();
    const from = { x: 4, y: 4 };
    const to = { x: 5, y: 4 };
    const mover = spawnAt(world, 'player', from);
    onlyBehavior(spawnAt(world, 'enemy', { x: 10, y: 10 }));
    // A behavior proposing a 1-tick move: flip offset = floor(1 * 0.5) = 0.
    onlyBehavior(mover, {
      kind: 'test:stub-1tick',
      proposeAction: () => moveProposal(from, to, 1),
    } as Behavior);

    world.tick(); // start + offset-0 impact fire on the same tick
    expect(mover.position).toEqual(to);
    expect(isClaimed(world, to)).toBe(false); // claimed then released within the tick
  });

  it('adjacency / distance resolve against the LOGICAL position across the flip', () => {
    const { world } = setup();
    const from = { x: 5, y: 5 };
    const to = { x: 6, y: 5 };
    const probe = { x: 4, y: 5 }; // adjacent to `from`, two cells from `to` (the unit moves away)
    const mover = spawnAt(world, 'player', from);
    onlyBehavior(spawnAt(world, 'enemy', { x: 10, y: 10 }));
    onlyBehavior(mover, new StubMoveBehavior(from, to));

    world.tick(); // pre-flip
    expect(distanceBetween(probe, mover.position)).toBe(1); // still adjacent to the probe

    for (let o = 1; o < FLIP_OFFSET; o++) world.tick();
    world.tick(); // the flip
    expect(distanceBetween(probe, mover.position)).toBe(2); // no longer adjacent — moved on
  });
});

describe('§36b — the claim makes a second pather re-route (no collision)', () => {
  it('a peer whose move targets a CLAIMED cell aborts instead of colliding', () => {
    const { world, bus } = setup();
    const target = { x: 5, y: 5 };
    // A is processed first (lower id) → claims `target` and defers its flip.
    const a = spawnAt(world, 'player', { x: 4, y: 5 });
    // B proposes the SAME vacant cell from the other side.
    const b = spawnAt(world, 'player', { x: 6, y: 5 });
    onlyBehavior(spawnAt(world, 'enemy', { x: 10, y: 10 }));
    onlyBehavior(a, new StubMoveBehavior({ x: 4, y: 5 }, target));
    onlyBehavior(b, new StubMoveBehavior({ x: 6, y: 5 }, target));

    const aborts: GameEvents['unit:moveAborted'][] = [];
    bus.on('unit:moveAborted', (e) => aborts.push(e));

    world.tick();

    // A holds the claim and is in flight toward `target`; B saw the claim and aborted.
    expect(claimantOf(world, target)).toBe(a.id);
    expect(a.activeAction).not.toBeNull();
    expect(b.position).toEqual({ x: 6, y: 5 }); // never moved
    expect(b.activeAction).toBeNull();
    expect(aborts).toEqual([{ unitId: b.id, from: { x: 6, y: 5 }, to: target }]);

    // Advance to A's flip: it arrives on `target`, the claim is gone, B still
    // safe — no overlap. (Stop at the flip; the dumb stub would re-propose the
    // same move once A's busy window ends — a real behavior reads its live cell.)
    for (let o = 0; o < FLIP_OFFSET; o++) world.tick();
    expect(a.position).toEqual(target);
    expect(isClaimed(world, target)).toBe(false);
    expect(b.position).not.toEqual(a.position);
  });
});

describe('§36b — release on reap', () => {
  it('a unit removed mid-move drops its destination claim (no phantom block)', () => {
    const { world } = setup();
    const from = { x: 2, y: 2 };
    const to = { x: 3, y: 2 };
    const mover = spawnAt(world, 'player', from);
    onlyBehavior(spawnAt(world, 'enemy', { x: 10, y: 10 }));
    onlyBehavior(mover, new StubMoveBehavior(from, to));

    world.tick(); // start the move — claim held, flip pending
    expect(isClaimed(world, to)).toBe(true);

    world.removeUnit(mover.id); // reaped mid-move
    expect(isClaimed(world, to)).toBe(false); // claim released on reap
    expect(claimantOf(world, to)).toBeUndefined();
  });
});
