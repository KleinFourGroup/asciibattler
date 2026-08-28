import { describe, it, expect } from 'vitest';
import {
  SwapAction,
  isReservedSwapPartner,
  isSwappablePartner,
  scanReservedSwapPartners,
} from './SwapAction';
import { MoveAction } from './MoveAction';
import { createAction } from './registry';
import { World } from '../World';
import type { Unit, UnitStats, UnitTemplate } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';

/**
 * GP5 #5 / 56c2 — SwapAction, the DEFERRED atomic position exchange (§36b
 * twin): `start` emits the render event only; the logical exchange lands in
 * `applyEffect` at the impact boundary, where all validation now lives (a
 * live-tick propose→start is synchronous behind the proposers' own gates, and
 * a rehydrated action never re-runs `start` — the flip is the one place stale
 * state can appear). These pin the primitive with explicit inputs (no config
 * / no behavior), so they stay valid regardless of who proposes the swap.
 */

const STATS: UnitStats = {
  constitution: 20, strength: 6, ranged: 0, magic: 0, luck: 0, defense: 0, precision: 5, evasion: 5, speed: 5, mobility: 5, power: 1,
};

function spawn(w: World, x: number, y: number) {
  const tmpl: UnitTemplate = { archetype: 'mercenary', level: 1, stats: STATS, xp: 0 };
  return w.spawnUnit(tmpl, 'player', { x, y });
}

function makeWorld(bus: EventBus<GameEvents> = new EventBus<GameEvents>()): World {
  return new World(bus, new RNG(1));
}

/** Seat `unit` mid-move to `to` the way World.executeActions does — active
 *  action + destination claim, pre-flip (the movement.test.ts §45a helper). */
function seatMove(world: World, unit: Unit, to: { x: number; y: number }, travel: number) {
  const durationTicks = travel * 2;
  world.seatAction(unit, new MoveAction(unit.position, to, durationTicks), [
    { phase: 'travel', ticks: travel },
    { phase: 'impact', ticks: 0 },
    { phase: 'recovery', ticks: durationTicks - travel },
  ]);
  world.claimCell(to, unit.id);
}

/** Seat an in-flight PRE-FLIP swap on `actor` (the 56c2 deferred timeline). */
function seatSwap(world: World, actor: Unit, action: SwapAction, durationTicks: number) {
  const travel = Math.floor(durationTicks / 2);
  world.seatAction(actor, action, [
    { phase: 'travel', ticks: travel },
    { phase: 'impact', ticks: 0 },
    { phase: 'recovery', ticks: durationTicks - travel },
  ]);
}

/**
 * 86c-L2b — the recompute-and-compare VERIFIER: the reserved-partner index
 * must equal what the retired derived scan re-derives from live
 * `activeAction`s (the §79e principle — the check consults a surface
 * production no longer reads).
 */
function expectIndexConsistent(world: World) {
  expect(world.swapReservedPartnerIndex).toEqual(scanReservedSwapPartners(world));
}

describe('SwapAction (deferred, 56c2)', () => {
  it('start emits ONE unit:swapped and moves NOBODY (the flip is deferred)', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const mover = spawn(w, 5, 5);
    const other = spawn(w, 4, 5);
    const swaps: GameEvents['unit:swapped'][] = [];
    const moves: GameEvents['unit:moved'][] = [];
    bus.on('unit:swapped', (e) => swaps.push(e));
    bus.on('unit:moved', (e) => moves.push(e));

    new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, other.id, 10).start(mover, w);

    expect(mover.position).toEqual({ x: 5, y: 5 }); // still pre-flip
    expect(other.position).toEqual({ x: 4, y: 5 });
    expect(moves).toEqual([]);
    expect(swaps).toEqual([
      { unitA: mover.id, unitB: other.id, cellA: { x: 5, y: 5 }, cellB: { x: 4, y: 5 }, durationTicks: 10 },
    ]);
  });

  it('applyEffect performs the atomic exchange (silent — the start event promised it)', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const mover = spawn(w, 5, 5);
    const other = spawn(w, 4, 5);
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, other.id, 10);
    action.start(mover, w);
    const events: string[] = [];
    bus.on('unit:moved', () => events.push('moved'));
    bus.on('unit:moveAborted', () => events.push('aborted'));

    action.applyEffect(mover, w, 5);

    expect(mover.position).toEqual({ x: 4, y: 5 });
    expect(other.position).toEqual({ x: 5, y: 5 });
    expect(events).toEqual([]);
  });

  it('degrades to a silent plain step at the flip when the partner is gone and the cell is free', () => {
    // Post-rehydrate / partner-died-mid-window shape: nobody on `to` by flip
    // time → the actor just arrives (the start event already showed it
    // sliding there; a dead partner's sprite belongs to the death anim).
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const mover = spawn(w, 5, 5); // no unit with id 999 exists
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, 999, 10);
    action.start(mover, w);
    const events: string[] = [];
    bus.on('unit:moved', () => events.push('moved'));
    bus.on('unit:moveAborted', () => events.push('aborted'));

    action.applyEffect(mover, w, 5);

    expect(mover.position).toEqual({ x: 4, y: 5 });
    expect(events).toEqual([]);
  });

  it('aborts at the flip when the cell is occupied by a third party (§36c shape)', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const mover = spawn(w, 5, 5);
    const third = spawn(w, 4, 5); // NOT the named partner — a usurper
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, 999, 10);
    seatSwap(w, mover, action, 10);
    const aborts: GameEvents['unit:swapAborted'][] = [];
    bus.on('unit:swapAborted', (e) => aborts.push(e));

    action.applyEffect(mover, w, 5);

    expect(mover.position).toEqual({ x: 5, y: 5 }); // stayed home
    expect(third.position).toEqual({ x: 4, y: 5 }); // untouched
    // 56e-pre2 — the TWO-body abort: both parties' true cells, so the
    // renderer settles both sprites (the partner began the dual lerp too).
    expect(aborts).toEqual([
      { unitA: mover.id, unitB: 999, cellA: { x: 5, y: 5 }, cellB: { x: 4, y: 5 } },
    ]);
    expect(mover.activeAction).toBeNull(); // lockout released for the retry
    expect(mover.actionCooldowns.get('swap')).toBe(0); // cooldown reset
  });

  it('aborts at the flip when the partner is present but mid-action (never relocate in-flight units)', () => {
    // The partner started something mid-window (only reachable post-rehydrate
    // — live play reserves partners for the whole window via the World.tick
    // skip). Its own body makes `to` non-free, so the abort branch catches it.
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const mover = spawn(w, 5, 5);
    const other = spawn(w, 4, 5);
    seatMove(w, other, { x: 3, y: 5 }, 4);
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, other.id, 10);
    seatSwap(w, mover, action, 10);
    const aborts: GameEvents['unit:swapAborted'][] = [];
    bus.on('unit:swapAborted', (e) => aborts.push(e));

    action.applyEffect(mover, w, 5);

    expect(mover.position).toEqual({ x: 5, y: 5 });
    expect(other.position).toEqual({ x: 4, y: 5 }); // its own move still owns it
    expect(aborts).toHaveLength(1);
  });

  it('56e-pre2: removing the actor PRE-FLIP emits the two-body abort (death mid-window)', () => {
    // The 56e labyrinth desync's likeliest trigger: the actor is killed
    // inside the swap's first half. The flip will never fire, but BOTH
    // sprites began the dual lerp at start — removeUnit must tell the
    // renderer (and the pathing metrics) to settle the partner back.
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const actor = spawn(w, 5, 5);
    const partner = spawn(w, 4, 5);
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, partner.id, 10);
    seatSwap(w, actor, action, 10); // pre-flip: offset 0 < travel 5
    const aborts: GameEvents['unit:swapAborted'][] = [];
    bus.on('unit:swapAborted', (e) => aborts.push(e));

    w.removeUnit(actor.id);

    expect(aborts).toEqual([
      { unitA: actor.id, unitB: partner.id, cellA: { x: 5, y: 5 }, cellB: { x: 4, y: 5 } },
    ]);
    expect(partner.position).toEqual({ x: 4, y: 5 }); // never moved logically
  });

  it('56e-pre2: removing the actor POST-FLIP emits nothing (the exchange landed)', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const actor = spawn(w, 5, 5);
    const partner = spawn(w, 4, 5);
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, partner.id, 10);
    seatSwap(w, actor, action, 10);
    action.applyEffect(actor, w, 5); // the flip lands; window still open
    w.seatActiveAction(actor, { ...actor.activeAction!, startTick: w.currentTick - 5 });
    const aborts: GameEvents['unit:swapAborted'][] = [];
    bus.on('unit:swapAborted', (e) => aborts.push(e));

    w.removeUnit(actor.id);

    expect(aborts).toEqual([]); // both sprites already lerp to their true cells
    expect(partner.position).toEqual({ x: 5, y: 5 }); // the exchange stands
  });

  it('round-trips through the action registry', () => {
    const data = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, 2, 10).toData();
    const rebuilt = createAction('swap', data, makeWorld());
    expect(rebuilt).toBeInstanceOf(SwapAction);
    expect(rebuilt.toData()).toEqual(data);
  });
});

describe('the swap-partner reserve (56c2; full-window since 56e-pre)', () => {
  it('a named partner is reserved for the WHOLE window and freed when the action clears', () => {
    const w = makeWorld();
    const actor = spawn(w, 5, 5);
    const partner = spawn(w, 4, 5);
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, partner.id, 10);
    seatSwap(w, actor, action, 10);

    // Pre-flip (offset 0 < travel 5): reserved.
    expect(isReservedSwapPartner(partner.id, w)).toBe(true);
    expect(isSwappablePartner(partner, w)).toBe(false);
    // The ACTOR is busy via its own activeAction, not the partner scan.
    expect(isReservedSwapPartner(actor.id, w)).toBe(false);
    expect(isSwappablePartner(actor, w)).toBe(false);

    // Post-flip, window still open (travel boundary in the past, finishTick
    // ahead): STILL reserved — the swap is the partner's action too, and the
    // renderer's dual lerp is mid-slide (the 56e mid-window re-grab).
    w.seatActiveAction(actor, { ...actor.activeAction!, startTick: w.currentTick - 5 });
    expect(isReservedSwapPartner(partner.id, w)).toBe(true);
    expect(isSwappablePartner(partner, w)).toBe(false);
    expectIndexConsistent(w);

    // The window closes (the actor's action clears): the reserve drops.
    w.clearActiveAction(actor);
    expect(isReservedSwapPartner(partner.id, w)).toBe(false);
    expect(isSwappablePartner(partner, w)).toBe(true);
    expectIndexConsistent(w);
  });

  // 86c-L2b — the index's own lifecycle pins: recompute-and-compare across
  // every transition the chokepoint owns, plus the two invariants the design
  // called out (one-reservation-per-partner asserted; a removed ACTOR frees
  // its partner while a removed PARTNER's entry stands until the flip).
  describe('the reserved-partner index (86c-L2b)', () => {
    it('stays scan-identical across seat → abort-clear', () => {
      const w = makeWorld();
      const mover = spawn(w, 5, 5);
      spawn(w, 4, 5); // a third party on `to` forces the abort branch
      const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, 999, 10);
      seatSwap(w, mover, action, 10);
      expectIndexConsistent(w);

      action.applyEffect(mover, w, 5); // abort: clears via the chokepoint
      expect(mover.activeAction).toBeNull();
      expectIndexConsistent(w);
      expect(w.swapReservedPartnerIndex.size).toBe(0);
    });

    it('a removed ACTOR takes its reservation with it', () => {
      const w = makeWorld();
      const actor = spawn(w, 5, 5);
      const partner = spawn(w, 4, 5);
      seatSwap(w, actor, new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, partner.id, 10), 10);
      expect(isReservedSwapPartner(partner.id, w)).toBe(true);

      w.removeUnit(actor.id);
      expect(isReservedSwapPartner(partner.id, w)).toBe(false);
      expectIndexConsistent(w);
    });

    it('a removed PARTNER stays reserved (the actor still names it; the flip settles it)', () => {
      const w = makeWorld();
      const actor = spawn(w, 5, 5);
      const partner = spawn(w, 4, 5);
      seatSwap(w, actor, new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, partner.id, 10), 10);

      w.removeUnit(partner.id);
      // The scan kept answering true here (the actor's seated swap names the
      // id); the index must mirror that until the actor's action clears.
      expect(isReservedSwapPartner(partner.id, w)).toBe(true);
      expectIndexConsistent(w);

      w.clearActiveAction(actor);
      expect(isReservedSwapPartner(partner.id, w)).toBe(false);
      expectIndexConsistent(w);
    });

    it('seating a second swap on an already-reserved partner throws (the bypassed-gate guard)', () => {
      const w = makeWorld();
      const a1 = spawn(w, 5, 5);
      const a2 = spawn(w, 3, 5);
      const partner = spawn(w, 4, 5);
      seatSwap(w, a1, new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, partner.id, 10), 10);
      expect(() =>
        seatSwap(w, a2, new SwapAction({ x: 3, y: 5 }, { x: 4, y: 5 }, partner.id, 10), 10),
      ).toThrow(/already the reserved partner/);
    });

    it('rebuilds through a snapshot round-trip (fromJSON seats through the chokepoint)', () => {
      const w = makeWorld();
      const actor = spawn(w, 5, 5);
      const partner = spawn(w, 4, 5);
      seatSwap(w, actor, new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, partner.id, 10), 10);

      const revived = World.fromJSON(
        JSON.parse(JSON.stringify(w.toJSON())),
        new EventBus<GameEvents>(),
      );
      expect(isReservedSwapPartner(partner.id, revived)).toBe(true);
      expectIndexConsistent(revived);
    });
  });
});
