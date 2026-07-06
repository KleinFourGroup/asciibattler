import { describe, it, expect } from 'vitest';
import { World } from './World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { deriveStats, inertDerived } from './stats';
import { ARCHETYPE_CONFIG, minRangeForArchetype, rangeForArchetype } from './archetypes';
import { MovementBehavior } from './behaviors/MovementBehavior';
import { SupportMovementBehavior } from './behaviors/SupportMovementBehavior';
import { SIM } from '../config/sim';
import type { GameEvents } from '../core/events';
import type { MoveDecisionKind } from './moveDecision';

/**
 * §42a — the `unit:moveDecision` record. Two properties under test:
 *
 *   1. **Kind correctness** — each movement-layer situation maps to the
 *      documented `MoveDecisionKind` (the taxonomy in moveDecision.ts).
 *   2. **Exactly one per poll** — every MovementBehavior /
 *      SupportMovementBehavior poll emits exactly one decision; a unit with an
 *      in-flight action (not polled) emits none that tick.
 *
 * Purely observational: none of these fixtures assert positions differently
 * from the pre-§42a suite — the record must not change what units do.
 */

interface SceneUnit {
  team: Team;
  x: number;
  y: number;
  attackRange?: number;
  moveCooldownTicks?: number;
  archetype?: UnitArchetype;
  /** Skip attaching MovementBehavior — for static targets; walls are always inert. */
  inert?: boolean;
}

interface Decision {
  tick: number;
  unitId: number;
  kind: MoveDecisionKind;
}

function scene(specs: SceneUnit[]): {
  world: World;
  units: Unit[];
  decisions: Decision[];
  kindsFor: (unitId: number) => MoveDecisionKind[];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const decisions: Decision[] = [];
  // Tag each record with the tick it was emitted on (the payload deliberately
  // carries only unitId + kind; the tick is observable from the `tick` event,
  // which fires at tick top before any unit is polled).
  let currentTick = 0;
  bus.on('tick', (p) => {
    currentTick = p.tick;
  });
  bus.on('unit:moveDecision', (p) => {
    decisions.push({ tick: currentTick, unitId: p.unitId, kind: p.kind });
  });

  let nextId = 1;
  const units = specs.map((s) => {
    const isNeutral = s.team === 'neutral';
    const stats: UnitStats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, luck: 0 };
    const range = s.attackRange ?? 1;
    let derived = isNeutral ? inertDerived(1) : deriveStats(stats, range);
    if (s.moveCooldownTicks !== undefined) {
      derived = { ...derived, moveCooldownTicks: s.moveCooldownTicks };
    }
    const u = new Unit({
      id: nextId++,
      team: s.team,
      archetype: s.archetype ?? (isNeutral ? 'environment' : 'mercenary'),
      glyph: isNeutral ? '#' : 'M',
      stats,
      derived,
      position: { x: s.x, y: s.y },
    });
    if (!s.inert && !isNeutral) u.behaviors.push(new MovementBehavior());
    world.units.push(u);
    return u;
  });
  return {
    world,
    units,
    decisions,
    kindsFor: (unitId) => decisions.filter((d) => d.unitId === unitId).map((d) => d.kind),
  };
}

/** A ring of walls around `cx,cy` (the 8 neighbors), minus any `except` cells. */
function wallRing(cx: number, cy: number, except: { x: number; y: number }[] = []): SceneUnit[] {
  const walls: SceneUnit[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (except.some((c) => c.x === x && c.y === y)) continue;
      walls.push({ team: 'neutral', x, y, inert: true });
    }
  }
  return walls;
}

describe('unit:moveDecision — kind correctness (MovementBehavior)', () => {
  it('advance: an open approach emits exactly one `advance` on the moving tick', () => {
    const { world, units, kindsFor } = scene([
      { team: 'player', x: 0, y: 0, moveCooldownTicks: 4 },
      { team: 'enemy', x: 5, y: 0, inert: true },
    ]);
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['advance']);
  });

  it('queue: a corridor blocked by an ally emits `queue` (blocked, no sidestep) and holds', () => {
    // 1-wide corridor along y=5; the ally directly ahead is the only way
    // through, and the perpendicular sidestep cells are walls.
    const walls: SceneUnit[] = [];
    for (let x = 0; x <= 5; x++) {
      walls.push({ team: 'neutral', x, y: 4, inert: true });
      walls.push({ team: 'neutral', x, y: 6, inert: true });
    }
    const { world, units, kindsFor } = scene([
      { team: 'player', x: 0, y: 5, moveCooldownTicks: 1 },
      { team: 'player', x: 1, y: 5, inert: true }, // the blocker ahead
      { team: 'enemy', x: 5, y: 5, inert: true },
      ...walls,
    ]);
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['queue']);
    expect(units[0]!.position).toEqual({ x: 0, y: 5 });
  });

  it('sidestep: a blocked forward cell with an open perpendicular emits `sidestep`', () => {
    // The mover's perpendicular cells (0,4)/(0,6) are open but DEAD-END
    // pockets (rows 3 and 7 walled across, rows 4 and 6 walled from x=1) — so
    // the only A* route runs through the ally directly ahead, and the E5.B
    // sidestep is the only committable step.
    const walls: SceneUnit[] = [];
    for (let x = 1; x <= 5; x++) {
      walls.push({ team: 'neutral', x, y: 4, inert: true });
      walls.push({ team: 'neutral', x, y: 6, inert: true });
    }
    for (let x = 0; x <= 6; x++) {
      walls.push({ team: 'neutral', x, y: 3, inert: true });
      walls.push({ team: 'neutral', x, y: 7, inert: true });
    }
    const { world, units, kindsFor } = scene([
      { team: 'player', x: 0, y: 5, moveCooldownTicks: 1 },
      { team: 'player', x: 1, y: 5, inert: true }, // the blocker ahead
      { team: 'enemy', x: 5, y: 5, inert: true },
      ...walls,
    ]);
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['sidestep']);
    expect(units[0]!.activeAction).not.toBeNull(); // the shuffle committed
  });

  it('no_route: a fully walled-in unit emits `no_route` every free tick', () => {
    const { world, units, kindsFor } = scene([
      { team: 'player', x: 5, y: 5, moveCooldownTicks: 1 },
      ...wallRing(5, 5),
      { team: 'enemy', x: 0, y: 0, inert: true },
    ]);
    world.tick();
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['no_route', 'no_route']);
  });

  it('wait: in attack range with LOS emits `wait` and no move (§44b, was hold_band)', () => {
    const { world, units, kindsFor } = scene([
      { team: 'player', x: 5, y: 5, attackRange: 1 },
      { team: 'enemy', x: 6, y: 5, inert: true },
    ]);
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['wait']);
    expect(units[0]!.position).toEqual({ x: 5, y: 5 });
  });

  it('no_goal: with no enemies on the board emits `no_goal`', () => {
    const { world, units, kindsFor } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 5, y: 5, inert: true },
    ]);
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['no_goal']);
  });

  it('hold_objective: a `hold` objective emits `hold_objective`', () => {
    const { world, units, kindsFor } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'enemy', x: 5, y: 5, inert: true },
    ]);
    world.enqueueCommand({ kind: 'setObjective', team: 'player', objective: { mode: 'hold' } });
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['hold_objective']);
  });

  it('pinned: a kiting archer inside minRange with no reachable firing cell emits `pinned`', () => {
    const FLOOR = minRangeForArchetype('ranged');
    const REACH = rangeForArchetype('ranged');
    expect(FLOOR).toBeGreaterThan(1); // the fixture needs an "inside minRange" to exist
    // Seal the archer and its adjacent target in a 2-cell box: dist 1 < FLOOR
    // (too close, so the target-cell fallback is off) and the acting-cell BFS
    // can't escape the walls → no firing cell → the Qb#3 pinned shape.
    // The box: the ring of 10 cells around the (5,5)-(6,5) domino.
    const box: SceneUnit[] = [];
    for (let x = 4; x <= 7; x++) {
      for (let y = 4; y <= 6; y++) {
        if (y === 5 && (x === 5 || x === 6)) continue; // the interior
        box.push({ team: 'neutral', x, y, inert: true });
      }
    }
    const { world, units, kindsFor } = scene([
      { team: 'player', x: 5, y: 5, archetype: 'ranged', attackRange: REACH, moveCooldownTicks: 1 },
      { team: 'enemy', x: 6, y: 5, inert: true },
      ...box,
    ]);
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['pinned']);
    expect(units[0]!.position).toEqual({ x: 5, y: 5 });
  });
});

describe('unit:moveDecision — kind correctness (SupportMovementBehavior)', () => {
  const HEAL_RANGE = 3;
  const HEALER_STATS: UnitStats = {
    ...ARCHETYPE_CONFIG.mercenary.baseStats,
    luck: 0,
  };

  function supportScene(specs: (SceneUnit & { hp?: number; healer?: boolean })[]): ReturnType<typeof scene> {
    const built = scene(specs.map((s) => ({ ...s, inert: true })));
    specs.forEach((s, i) => {
      const u = built.units[i]!;
      if (s.healer) {
        u.behaviors.push(new SupportMovementBehavior());
        u.derived = { ...deriveStats(HEALER_STATS, HEAL_RANGE), moveCooldownTicks: 1 };
      }
      if (s.hp !== undefined) u.currentHp = s.hp;
    });
    return built;
  }

  it('wait: a wounded ally already in heal range emits `wait` (§44b, was hold_band)', () => {
    const { world, units, kindsFor } = supportScene([
      { team: 'player', x: 5, y: 5, healer: true },
      { team: 'player', x: 5, y: 5 + HEAL_RANGE, hp: 5 },
    ]);
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['wait']);
  });

  it('advance: a wounded ally out of heal range emits `advance`', () => {
    const { world, units, kindsFor } = supportScene([
      { team: 'player', x: 0, y: 0, healer: true },
      { team: 'player', x: 0, y: HEAL_RANGE + 3, hp: 5 },
    ]);
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['advance']);
  });

  it('retreat: an enemy inside panic range with open ground emits `retreat`', () => {
    const { world, units, kindsFor } = supportScene([
      { team: 'player', x: 5, y: 5, healer: true },
      { team: 'enemy', x: 5 + SIM.healerPanicRangeCells, y: 5 },
    ]);
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['retreat']);
  });

  it('no_goal: alone with nothing to do emits `no_goal`', () => {
    const { world, units, kindsFor } = supportScene([
      { team: 'player', x: 5, y: 5, healer: true },
    ]);
    world.tick();
    expect(kindsFor(units[0]!.id)).toEqual(['no_goal']);
  });
});

describe('unit:moveDecision — the one-per-poll invariant', () => {
  it('a mixed battle emits exactly one decision per free movement poll, none while in-flight', () => {
    // Two movers per side plus a corridor pinch — enough traffic to exercise
    // advance/sidestep/queue/wait across the run.
    const walls: SceneUnit[] = [];
    for (let x = 3; x <= 7; x++) {
      walls.push({ team: 'neutral', x, y: 4, inert: true });
      walls.push({ team: 'neutral', x, y: 6, inert: true });
    }
    const { world, units, decisions } = scene([
      { team: 'player', x: 0, y: 5, moveCooldownTicks: 3 },
      { team: 'player', x: 1, y: 5, moveCooldownTicks: 4 },
      { team: 'enemy', x: 10, y: 5, moveCooldownTicks: 3 },
      { team: 'enemy', x: 9, y: 5, moveCooldownTicks: 5 },
      ...walls,
    ]);
    const movers = units.filter((u) => u.team !== 'neutral');

    // Mirror the world's private tick counter: a fresh world starts at 0 and
    // increments once per tick() call, at tick top.
    let tickBefore = 0;
    for (let i = 0; i < 40; i++) {
      // A unit is POLLED this tick iff it's free at tick top OR its in-flight
      // action finishes this tick (tickCount++ happens at tick top, then the
      // finish check clears + falls through to the selector on the same tick).
      const tickAfter = tickBefore + 1;
      const polled = new Set(
        movers
          .filter(
            (u) =>
              u.currentHp > 0 &&
              (u.activeAction === null || tickAfter >= u.activeAction.finishTick),
          )
          .map((u) => u.id),
      );
      const before = decisions.length;
      world.tick();
      tickBefore = tickAfter;
      const emitted = decisions.slice(before);

      // Exactly the polled units emitted, and exactly once each. (No abilities
      // exist in this fixture, so nobody dies mid-tick and every polled unit's
      // movement behavior runs.)
      const perUnit = new Map<number, number>();
      for (const d of emitted) {
        perUnit.set(d.unitId, (perUnit.get(d.unitId) ?? 0) + 1);
        expect(polled.has(d.unitId), `tick ${d.tick}: unpolled unit ${d.unitId} emitted`).toBe(true);
      }
      for (const id of polled) {
        expect(
          perUnit.get(id) ?? 0,
          `tick ${tickAfter}: polled unit ${id} emitted ${perUnit.get(id) ?? 0} decisions (want 1)`,
        ).toBe(1);
      }
      if (world.ended) break;
    }
  });
});
