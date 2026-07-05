import { describe, it, expect } from 'vitest';
import { WaitAction, WAIT_ACTION_ID, waitProposal } from './WaitAction';
import { moveProposal } from '../movement';
import { World } from '../World';
import type { Behavior, UnitStats, UnitTemplate } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';

/**
 * §44b — the first-class wait + the instantaneous-action rule. The load-
 * bearing contract: a wait is a REAL proposal the selector weighs (score 1,
 * losable to any ability), but when it wins it resolves entirely within the
 * tick — no `activeAction`, no `actionCooldowns` entry, no serialized trace.
 * The byte-identity test at the bottom IS the §44 exit criterion: a waiting
 * unit's world bytes match the old bare-null abstainer's exactly.
 */

const STATS: UnitStats = {
  constitution: 20, strength: 6, ranged: 0, magic: 0, luck: 0, defense: 0, precision: 5, evasion: 5, speed: 5, mobility: 5, power: 1,
};

function spawn(w: World, x: number, y: number, team: 'player' | 'enemy' = 'player') {
  const tmpl: UnitTemplate = { archetype: 'mercenary', level: 1, stats: STATS, xp: 0 };
  return w.spawnUnit(tmpl, team, { x, y });
}

function makeWorld(bus: EventBus<GameEvents> = new EventBus<GameEvents>()): World {
  return new World(bus, new RNG(1));
}

/** Replace a unit's real behaviors with a single stub proposer. */
function stubBehavior(unit: { behaviors: Behavior[] }, behavior: Behavior): void {
  unit.behaviors.splice(0, unit.behaviors.length, behavior);
}

const waiter: Behavior = { kind: 'stub', proposeAction: () => waitProposal() };
const abstainer: Behavior = { kind: 'stub', proposeAction: () => null };

describe('WaitAction', () => {
  it('emits unit:waited on start and touches nothing else', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const u = spawn(w, 5, 5);
    const waits: GameEvents['unit:waited'][] = [];
    bus.on('unit:waited', (e) => waits.push(e));

    new WaitAction().start(u, w);

    expect(waits).toEqual([{ unitId: u.id }]);
    expect(u.position).toEqual({ x: 5, y: 5 });
    expect(u.activeAction).toBeNull();
  });

  it('a winning wait resolves inline: no activeAction, no cooldown entry, no action:phase', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const u = spawn(w, 5, 5);
    stubBehavior(u, waiter);
    const waits: GameEvents['unit:waited'][] = [];
    const phases: GameEvents['action:phase'][] = [];
    bus.on('unit:waited', (e) => waits.push(e));
    bus.on('action:phase', (e) => phases.push(e));

    w.tick();

    expect(waits).toEqual([{ unitId: u.id }]);
    // The §44b contract: nothing enters the in-flight machinery. A lingering
    // `activeAction` or a serialized `['wait', 0]` cooldown entry is exactly
    // the state that would force a WorldSnapshot bump.
    expect(u.activeAction).toBeNull();
    expect(u.actionCooldowns.has(WAIT_ACTION_ID)).toBe(false);
    expect(phases).toEqual([]);
  });

  it('re-decides every tick: no cooldown, no busy window — one wait per tick', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const u = spawn(w, 5, 5);
    stubBehavior(u, waiter);
    // An inert opponent keeps the battle live past tick 1 — a lone team ends
    // the battle at the first end-check and later ticks never poll.
    stubBehavior(spawn(w, 10, 5, 'enemy'), abstainer);
    const waits: GameEvents['unit:waited'][] = [];
    bus.on('unit:waited', (e) => waits.push(e));

    w.tick();
    w.tick();
    w.tick();

    expect(waits).toEqual([{ unitId: u.id }, { unitId: u.id }, { unitId: u.id }]);
  });

  it('loses the selector to any higher-scoring proposal', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const u = spawn(w, 5, 5);
    // Two stub proposers on one unit: the wait (score 1) vs a move at the
    // ability tier (score 10) — the selector must take the move, mirroring
    // how a ready attack/heal outranks holding position.
    const mover: Behavior = {
      kind: 'stub',
      proposeAction: (unit) => moveProposal(unit.position, { x: 6, y: 5 }, unit.derived.moveCooldownTicks, 10),
    };
    stubBehavior(u, waiter);
    u.behaviors.push(mover);
    const waits: GameEvents['unit:waited'][] = [];
    bus.on('unit:waited', (e) => waits.push(e));

    w.tick();

    expect(waits).toEqual([]);
    expect(u.activeAction).not.toBeNull();
    expect(u.activeAction!.action.id).not.toBe(WAIT_ACTION_ID);
  });

  it('EXIT TEST: a waiting unit\'s world bytes match the old abstaining unit\'s', () => {
    // Two identical worlds, same seed; the only difference is the §44b
    // conversion itself — one unit proposes a wait, its twin returns the old
    // bare null. After ticking both, the serialized worlds must be
    // byte-identical: the wait is observable ONLY in the event stream.
    const wWait = makeWorld();
    const wNull = makeWorld();
    const uWait = spawn(wWait, 5, 5);
    const uNull = spawn(wNull, 5, 5);
    stubBehavior(uWait, waiter);
    stubBehavior(uNull, abstainer);
    // Matching inert opponents keep both battles live across all 5 ticks —
    // otherwise the end-check fires at tick 1 and the comparison degenerates.
    stubBehavior(spawn(wWait, 10, 5, 'enemy'), abstainer);
    stubBehavior(spawn(wNull, 10, 5, 'enemy'), abstainer);

    for (let i = 0; i < 5; i++) {
      wWait.tick();
      wNull.tick();
    }

    expect(uWait.activeAction).toBeNull();
    expect(JSON.stringify(wWait.toJSON())).toBe(JSON.stringify(wNull.toJSON()));
  });
});
