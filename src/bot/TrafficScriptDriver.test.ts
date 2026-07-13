/**
 * 54a — the traffic-script driver's arbitration contract: fixed priority ·
 * the null action as the arm to beat · min-dwell no-thrash · release-own-
 * orders-only. Stub scripts + a real (tiny) World so emitted commands go
 * through the genuine drain/apply/auto-revert path — the driver compares
 * against `world.objectiveFor`, so applying for real is the honest test.
 * Harness-side wiring + the byte-identical no-op parity live in
 * `tests/fuzz/harnessTraffic.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { World } from '../sim/World';
import { scaledUnit } from '../sim/archetypes';
import type { GameEvents } from '../core/events';
import type { TeamObjective } from '../sim/objective';
import {
  TrafficScriptDriver,
  MIN_DWELL_TICKS,
  sameObjective,
  type TrafficScript,
} from './TrafficScriptDriver';

const HOLD: TeamObjective = { mode: 'hold' };
const RALLY: TeamObjective = { mode: 'engage', target: { kind: 'tile', cell: { x: 2, y: 2 } } };

/** A stub whose proposal is mutable from the test (null = trigger below
 *  threshold — the null action). */
function stub(id: string, initial: TeamObjective | null): TrafficScript & {
  proposal: TeamObjective | null;
} {
  return {
    id,
    proposal: initial,
    evaluate() {
      return this.proposal;
    },
  };
}

/** A world with units parked in opposite corners of a 20×20 grid — far
 *  enough apart that nothing makes contact inside any test's tick window
 *  (melee at ~5–6 cells per 2s never closes 17+ cells in ≤3 dwell windows);
 *  ticks exist only to drain the driver's commands and advance `currentTick`.
 *  TWO enemies, so a test can kill one (the auto-revert path) without ending
 *  the battle — `World.tick()` NO-OPS once `ended` is set (World.ts), so an
 *  ended world freezes `currentTick` (the 54a hang: an unbounded
 *  `while (currentTick < …)` loop spun forever on exactly that). */
function makeWorld(): World {
  const world = new World(new EventBus<GameEvents>(), new RNG(1), 20, 20);
  world.spawnUnit(scaledUnit('mercenary', 1), 'player', { x: 1, y: 1 }, null);
  world.spawnUnit(scaledUnit('mercenary', 1), 'enemy', { x: 18, y: 18 }, null);
  world.spawnUnit(scaledUnit('mercenary', 1), 'enemy', { x: 18, y: 16 }, null);
  return world;
}

/** Run one driver step against the world: decide → enqueue → tick (drain).
 *  Asserts the battle hasn't ended — a frozen world would otherwise turn a
 *  tick-counting loop into an infinite spin (see makeWorld). */
function step(world: World, driver: TrafficScriptDriver) {
  expect(world.ended).toBe(false);
  const commands = driver.decide(world);
  for (const cmd of commands) world.enqueueCommand(cmd);
  world.tick();
  return commands;
}

/** Step `n` times, asserting the driver stays quiet the whole way. Bounded
 *  by construction — never loops on `currentTick`. */
function expectQuietSteps(world: World, driver: TrafficScriptDriver, n: number) {
  for (let i = 0; i < n; i++) {
    expect(step(world, driver)).toEqual([]);
  }
}

describe('sameObjective', () => {
  it('matches on mode + target identity, not object identity', () => {
    expect(sameObjective(HOLD, { mode: 'hold' })).toBe(true);
    expect(sameObjective({ mode: 'atWill' }, { mode: 'atWill' })).toBe(true);
    expect(sameObjective(HOLD, { mode: 'atWill' })).toBe(false);
    expect(sameObjective(RALLY, { mode: 'engage', target: { kind: 'tile', cell: { x: 2, y: 2 } } })).toBe(true);
    expect(sameObjective(RALLY, { mode: 'engage', target: { kind: 'tile', cell: { x: 3, y: 2 } } })).toBe(false);
    expect(sameObjective(RALLY, { mode: 'focus', target: { kind: 'tile', cell: { x: 2, y: 2 } } })).toBe(false);
    expect(
      sameObjective(
        { mode: 'engage', target: { kind: 'enemy', unitId: 7 } },
        { mode: 'engage', target: { kind: 'enemy', unitId: 7 } },
      ),
    ).toBe(true);
    expect(
      sameObjective(
        { mode: 'engage', target: { kind: 'enemy', unitId: 7 } },
        { mode: 'engage', target: { kind: 'neutral', unitId: 7 } },
      ),
    ).toBe(false);
  });
});

describe('TrafficScriptDriver', () => {
  it('empty registry (the 54a state) never emits', () => {
    const world = makeWorld();
    const driver = new TrafficScriptDriver('player', []);
    expectQuietSteps(world, driver, 5);
    expect(world.objectiveFor('player').mode).toBe('atWill');
  });

  it('a triggered script emits setObjective once, then goes idempotent', () => {
    const world = makeWorld();
    const driver = new TrafficScriptDriver('player', [stub('s', HOLD)]);
    expect(step(world, driver)).toEqual([
      { kind: 'setObjective', team: 'player', objective: HOLD },
    ]);
    expect(world.objectiveFor('player').mode).toBe('hold');
    // Standing order + unchanged proposal → no re-issue, tick after tick.
    expectQuietSteps(world, driver, 3);
  });

  it('fixed priority: the first registry entry wins a simultaneous trigger', () => {
    const world = makeWorld();
    const first = stub('first', HOLD);
    const second = stub('second', RALLY);
    const driver = new TrafficScriptDriver('player', [first, second]);
    const emitted = step(world, driver);
    expect(emitted).toEqual([{ kind: 'setObjective', team: 'player', objective: HOLD }]);
  });

  it('min-dwell gates a changed proposal, then lets it through', () => {
    const world = makeWorld();
    const s = stub('s', HOLD);
    const driver = new TrafficScriptDriver('player', [s]);
    step(world, driver); // emits hold; the command tick is 0, currentTick is now 1
    s.proposal = RALLY; // trigger now proposes something else
    // Inside the dwell window: quiet, the standing hold plays out. Decides
    // run at ticks 1 .. MIN_DWELL_TICKS-1 — a BOUNDED count, never a
    // currentTick-polling loop (see makeWorld).
    expectQuietSteps(world, driver, MIN_DWELL_TICKS - 1);
    expect(world.objectiveFor('player').mode).toBe('hold');
    // Dwell elapsed → the new proposal lands.
    expect(step(world, driver)).toEqual([
      { kind: 'setObjective', team: 'player', objective: RALLY },
    ]);
    expect(world.objectiveFor('player').mode).toBe('engage');
  });

  it('the null action releases the driver’s own standing order after dwell', () => {
    const world = makeWorld();
    const s = stub('s', HOLD);
    const driver = new TrafficScriptDriver('player', [s]);
    step(world, driver); // hold standing
    s.proposal = null; // trigger clears — the null action should win
    // Dwell holds the stale order: quiet decides at ticks 1 .. MIN_DWELL_TICKS-1.
    expectQuietSteps(world, driver, MIN_DWELL_TICKS - 1);
    expect(step(world, driver)).toEqual([{ kind: 'clearObjective', team: 'player' }]);
    expect(world.objectiveFor('player').mode).toBe('atWill');
    // Fully released: nothing further, ever.
    expectQuietSteps(world, driver, 3);
  });

  it('never clobbers a foreign order (release is own-orders-only)', () => {
    const world = makeWorld();
    const driver = new TrafficScriptDriver('player', [stub('s', null)]);
    // A foreign steer (the UI path): set directly, not via the driver.
    world.enqueueCommand({ kind: 'setObjective', team: 'player', objective: HOLD });
    world.tick();
    expect(world.objectiveFor('player').mode).toBe('hold');
    expectQuietSteps(world, driver, 5);
    expect(world.objectiveFor('player').mode).toBe('hold'); // untouched
  });

  it('adopting an already-standing identical objective emits nothing', () => {
    const world = makeWorld();
    const driver = new TrafficScriptDriver('player', [stub('s', HOLD)]);
    // The proposal already stands (foreign source) — adopt, don't re-issue.
    world.enqueueCommand({ kind: 'setObjective', team: 'player', objective: HOLD });
    world.tick();
    expect(step(world, driver)).toEqual([]);
    expect(world.objectiveFor('player').mode).toBe('hold');
  });

  it('drops its bookkeeping when the sim auto-reverts the target away', () => {
    const world = makeWorld();
    // Target ONE of the two enemies — the battle must survive the kill (an
    // all-dead team ends it, and an ended world freezes; see makeWorld).
    const enemy = world.units.find((u) => u.team === 'enemy')!;
    const engageEnemy: TeamObjective = {
      mode: 'engage',
      target: { kind: 'enemy', unitId: enemy.id },
    };
    const s = stub('s', engageEnemy);
    const driver = new TrafficScriptDriver('player', [s]);
    step(world, driver);
    expect(world.objectiveFor('player').mode).toBe('engage');
    // Kill the target → the sim's auto-revert lands the objective on atWill.
    enemy.currentHp = 0;
    s.proposal = null;
    world.tick();
    expect(world.ended).toBe(false);
    expect(world.objectiveFor('player').mode).toBe('atWill');
    // The driver sees the revert, drops bookkeeping, and does NOT emit a
    // redundant clear — including well past the dwell window.
    expectQuietSteps(world, driver, MIN_DWELL_TICKS + 1);
  });
});
