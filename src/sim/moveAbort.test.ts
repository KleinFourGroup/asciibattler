import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Team, UnitStats, Behavior } from './Unit';
import type { ActionProposal } from './Action';
import { MoveAction } from './actions/MoveAction';
import { moveProposal } from './movement';

/**
 * §35b — the proactive destination check + abort primitive, in isolation.
 *
 * On today's INSTANT model a unit's propose and execute are atomic (and behaviors
 * already route around occupied cells), so the abort never fires in a natural
 * battle — it's the primitive §36 makes load-bearing once the logical position
 * flips partway through a move. So these tests drive it directly: a stub behavior
 * proposes a `MoveAction` onto a cell that's occupied / untraversable AT
 * EXECUTION, and we assert the move is a clean no-op (the unit stays at `from`,
 * the cooldown is NOT consumed, no `unit:moved`) that announces itself via
 * `unit:moveAborted` — the contract the §36 settle-back will subscribe to.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

const MOVE_TICKS = 4;

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

describe('MoveAction.destinationCell — the proactive-destination seam', () => {
  it('reports the cell the move relocates onto', () => {
    const a = new MoveAction({ x: 2, y: 2 }, { x: 3, y: 2 }, MOVE_TICKS);
    expect(a.destinationCell()).toEqual({ x: 3, y: 2 });
  });
});

describe('§35b — move abort at execution', () => {
  it('aborts a move onto an occupied cell: no-op + unit:moveAborted, cooldown intact', () => {
    const { world, bus } = setup();
    const mover = spawnAt(world, 'player', { x: 2, y: 2 });
    const blocker = spawnAt(world, 'player', { x: 3, y: 2 });
    onlyBehavior(mover, new StubMoveBehavior({ x: 2, y: 2 }, { x: 3, y: 2 }));
    onlyBehavior(blocker); // static — keep the destination occupied

    const aborts: GameEvents['unit:moveAborted'][] = [];
    const moved: GameEvents['unit:moved'][] = [];
    bus.on('unit:moveAborted', (e) => aborts.push(e));
    bus.on('unit:moved', (e) => moved.push(e));

    world.tick();

    expect(mover.position).toEqual({ x: 2, y: 2 }); // never relocated
    expect(mover.activeAction).toBeNull(); // not locked into the move
    expect(mover.actionCooldowns.get('move') ?? 0).toBe(0); // cooldown not consumed → retry next tick
    expect(aborts).toEqual([{ unitId: mover.id, from: { x: 2, y: 2 }, to: { x: 3, y: 2 } }]);
    expect(moved).toEqual([]); // no phantom move
  });

  it('executes a move onto a free cell normally (control)', () => {
    const { world, bus } = setup();
    const mover = spawnAt(world, 'player', { x: 2, y: 2 });
    onlyBehavior(mover, new StubMoveBehavior({ x: 2, y: 2 }, { x: 3, y: 2 }));

    const aborts: GameEvents['unit:moveAborted'][] = [];
    const moved: GameEvents['unit:moved'][] = [];
    bus.on('unit:moveAborted', (e) => aborts.push(e));
    bus.on('unit:moved', (e) => moved.push(e));

    world.tick();

    expect(mover.position).toEqual({ x: 3, y: 2 }); // moved
    expect(mover.activeAction).not.toBeNull(); // locked for the busy window
    expect(mover.actionCooldowns.get('move')).toBe(MOVE_TICKS); // cooldown consumed
    expect(aborts).toEqual([]);
    expect(moved).toHaveLength(1);
  });

  it('aborts a move onto an untraversable (chasm) cell', () => {
    const { world, bus } = setup();
    const mover = spawnAt(world, 'player', { x: 2, y: 2 });
    world.tileGrid.setKind({ x: 3, y: 2 }, 'chasm'); // infinite cost
    onlyBehavior(mover, new StubMoveBehavior({ x: 2, y: 2 }, { x: 3, y: 2 }));

    const aborts: GameEvents['unit:moveAborted'][] = [];
    bus.on('unit:moveAborted', (e) => aborts.push(e));

    world.tick();

    expect(mover.position).toEqual({ x: 2, y: 2 });
    expect(aborts).toHaveLength(1);
  });

  it('retries the move next tick once the cell frees up', () => {
    const { world, bus } = setup();
    const mover = spawnAt(world, 'player', { x: 2, y: 2 });
    const blocker = spawnAt(world, 'player', { x: 3, y: 2 });
    // A far-off inert enemy keeps both teams fielded, so the battle stays
    // ongoing across the two ticks (an all-player board ends as a victory).
    onlyBehavior(spawnAt(world, 'enemy', { x: 10, y: 10 }));
    onlyBehavior(mover, new StubMoveBehavior({ x: 2, y: 2 }, { x: 3, y: 2 }));
    onlyBehavior(blocker);

    const aborts: GameEvents['unit:moveAborted'][] = [];
    bus.on('unit:moveAborted', (e) => aborts.push(e));

    world.tick(); // blocked → abort, cooldown intact
    expect(aborts).toHaveLength(1);
    expect(mover.position).toEqual({ x: 2, y: 2 });

    world.removeUnit(blocker.id); // the cell frees
    world.tick(); // now the move lands

    expect(mover.position).toEqual({ x: 3, y: 2 });
    expect(aborts).toHaveLength(1); // no further abort
  });
});
