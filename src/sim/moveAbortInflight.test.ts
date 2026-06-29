import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Team, UnitStats, Behavior } from './Unit';
import type { ActionProposal } from './Action';
import { moveProposal } from './movement';
import { isClaimed, claimantOf, distanceBetween } from './occupancy';
import { SIM } from '../config/sim';

/**
 * §36c — the smooth mid-flight abort.
 *
 * A deferred move (§36b) holds a claim on its destination until the logical flip
 * at the 50% mark. §36c adds a per-tick in-flight re-validation across that
 * pre-flip window: if the destination became occupied / untraversable AFTER
 * move-start (dynamic terrain or a non-pathed knockback onto `to` — a peer
 * pather can NEVER cause it, the claim blocks convergence), the move aborts via
 * the §35b `unit:moveAborted` path. The unit settles back to `from` (it never
 * left logically), the claim releases, the move cooldown resets (retry next
 * tick), and the renderer's settle-back lerp subscribes to the event.
 *
 * The trigger is INERT in real play — the only natural cause (a converging peer)
 * is impossible under the claim, and the real triggers (dynamic terrain, a
 * non-pathed knockback) arrive with §37/§40. So these tests SYNTHESIZE the
 * invalidation: force `to` to chasm, or shove another unit's logical position
 * onto `to`, mid-flight. The mechanism is exercised the same way it will be once
 * a production trigger exists.
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

describe('§36c — in-flight move abort (the destination goes invalid mid-slide)', () => {
  it('FLIP_OFFSET sanity (the pre-flip window has a tick to inject into)', () => {
    expect(FLIP_OFFSET).toBe(2); // floor(4 * 0.5) → there is a pre-flip tick at offset 1
  });

  it('aborts when the destination becomes untraversable (dynamic-terrain proxy) before the flip', () => {
    const { world, bus } = setup();
    const from = { x: 2, y: 2 };
    const to = { x: 3, y: 2 };
    const mover = spawnAt(world, 'player', from);
    // A far inert enemy keeps the battle ongoing across the deferred window.
    onlyBehavior(spawnAt(world, 'enemy', { x: 10, y: 10 }));
    onlyBehavior(mover, new StubMoveBehavior(from, to));

    const aborts: GameEvents['unit:moveAborted'][] = [];
    const moved: GameEvents['unit:moved'][] = [];
    bus.on('unit:moveAborted', (e) => aborts.push(e));
    bus.on('unit:moved', (e) => moved.push(e));

    world.tick(); // start: claim `to`, emit moved, position holds at `from`
    expect(mover.position).toEqual(from);
    expect(isClaimed(world, to)).toBe(true);
    expect(moved).toHaveLength(1);

    // Mid-flight: the destination tile collapses to a chasm (infinite cost).
    world.tileGrid.setKind(to, 'chasm');

    world.tick(); // offset 1 (pre-flip) — the in-flight re-validation aborts

    expect(mover.position).toEqual(from); // settled back — never flipped onto the bad cell
    expect(mover.activeAction).toBeNull(); // released from the move
    expect(isClaimed(world, to)).toBe(false); // claim dropped
    expect(claimantOf(world, to)).toBeUndefined();
    expect(mover.actionCooldowns.get('move') ?? 0).toBe(0); // cooldown reset → retry next tick
    expect(aborts).toEqual([{ unitId: mover.id, from, to }]);
    expect(moved).toHaveLength(1); // no second `unit:moved` — the flip never happened
  });

  it('aborts when another unit lands on the destination (knockback proxy) before the flip', () => {
    const { world, bus } = setup();
    const from = { x: 4, y: 4 };
    const to = { x: 5, y: 4 };
    const mover = spawnAt(world, 'player', from);
    // A second unit we will forcibly relocate onto `to` (a non-pathed knockback:
    // it bypasses the claim-aware placement paths, exactly what §40 will do).
    const intruder = spawnAt(world, 'player', { x: 8, y: 8 });
    onlyBehavior(spawnAt(world, 'enemy', { x: 10, y: 10 }));
    onlyBehavior(mover, new StubMoveBehavior(from, to));
    onlyBehavior(intruder); // inert

    const aborts: GameEvents['unit:moveAborted'][] = [];
    bus.on('unit:moveAborted', (e) => aborts.push(e));

    world.tick(); // start the move — `to` claimed, flip pending
    expect(isClaimed(world, to)).toBe(true);

    // A forced relocation drops the intruder onto the claimed destination.
    intruder.position = { x: to.x, y: to.y };

    world.tick(); // pre-flip re-validation sees the occupant → abort

    expect(mover.position).toEqual(from); // settled back; did NOT flip onto the occupied cell
    expect(isClaimed(world, to)).toBe(false);
    expect(aborts).toEqual([{ unitId: mover.id, from, to }]);
    // The §35d-style invariant the abort protects: no two units share `to`.
    expect(distanceBetween(mover.position, intruder.position)).toBeGreaterThan(0);
  });

  it('aborts on the flip tick itself rather than flipping onto a now-invalid cell', () => {
    const { world, bus } = setup();
    const from = { x: 2, y: 5 };
    const to = { x: 3, y: 5 };
    const mover = spawnAt(world, 'player', from);
    onlyBehavior(spawnAt(world, 'enemy', { x: 10, y: 10 }));
    onlyBehavior(mover, new StubMoveBehavior(from, to));

    const aborts: GameEvents['unit:moveAborted'][] = [];
    bus.on('unit:moveAborted', (e) => aborts.push(e));

    world.tick(); // start (offset 0)
    // Tick up to just before the flip; still in flight, no invalidation yet.
    for (let o = 1; o < FLIP_OFFSET; o++) world.tick();
    expect(mover.position).toEqual(from);
    expect(aborts).toEqual([]);

    // Invalidate exactly as the flip tick is about to commit.
    world.tileGrid.setKind(to, 'chasm');
    world.tick(); // offset === FLIP_OFFSET: re-validation runs BEFORE impact → abort

    expect(mover.position).toEqual(from); // never flipped
    expect(isClaimed(world, to)).toBe(false);
    expect(aborts).toEqual([{ unitId: mover.id, from, to }]);
  });

  it('a move whose destination stays valid completes normally (no spurious abort)', () => {
    const { world, bus } = setup();
    const from = { x: 6, y: 6 };
    const to = { x: 7, y: 6 };
    const mover = spawnAt(world, 'player', from);
    onlyBehavior(spawnAt(world, 'enemy', { x: 10, y: 10 }));
    onlyBehavior(mover, new StubMoveBehavior(from, to));

    const aborts: GameEvents['unit:moveAborted'][] = [];
    bus.on('unit:moveAborted', (e) => aborts.push(e));

    world.tick(); // start
    for (let o = 0; o < FLIP_OFFSET; o++) world.tick(); // run out to the flip

    expect(mover.position).toEqual(to); // arrived
    expect(isClaimed(world, to)).toBe(false);
    expect(aborts).toEqual([]); // the in-flight check never fired
  });
});
