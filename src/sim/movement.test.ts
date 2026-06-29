import { describe, it, expect } from 'vitest';
import { World } from './World';
import { Unit, type Team, type UnitStats } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { deriveStats, inertDerived } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import { MoveAction } from './actions/MoveAction';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import { advance, routeToward, buildMovementContext, type MovementIntent } from './movement';

/**
 * J2 — unit tests for the shared movement seam. The behaviour-level
 * byte-identical contract (steps, sidestep, abstains, in-range) is pinned by
 * MovementBehavior.test.ts / SupportMovementBehavior.test.ts driving real
 * ticks; this file exercises the primitive directly, and in particular the
 * `maxCells > 1` DASH HOOK that no shipped ability uses yet — proving the seam
 * already serves Phase N's gap-closer.
 */

interface Spec {
  team: Team;
  x: number;
  y: number;
  range?: number;
  /** A wall (hard blocker) rather than a combatant. */
  neutral?: boolean;
}

function scene(specs: Spec[], gridW = 12, gridH = 12): { world: World; units: Unit[] } {
  const world = new World(new EventBus<GameEvents>(), new RNG(1), gridW, gridH);
  let nextId = 1;
  const units = specs.map((s) => {
    const neutral = s.neutral === true;
    const stats: UnitStats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, luck: 0 };
    const range = s.range ?? 1;
    const u = new Unit({
      id: nextId++,
      team: s.team,
      archetype: neutral ? 'environment' : 'mercenary',
      glyph: neutral ? '#' : 'M',
      stats,
      derived: neutral ? inertDerived(1) : deriveStats(stats, range),
      position: { x: s.x, y: s.y },
    });
    world.units.push(u);
    return u;
  });
  return { world, units };
}

/** The cell a move proposal would land the unit on. */
function landing(proposal: { action: unknown } | null): GridCoord | null {
  if (proposal === null) return null;
  return (proposal.action as MoveAction).toData().to;
}

describe('movement / buildMovementContext', () => {
  it('splits blockers: neutrals hard, other units soft, target excluded, self never listed', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 }, // the mover (self)
      { team: 'player', x: 1, y: 1 }, // ally → soft
      { team: 'neutral', x: 2, y: 2, neutral: true }, // wall → hard
      { team: 'enemy', x: 3, y: 3 }, // the target → excluded from soft
    ]);
    const [self, , , target] = units;
    const ctx = buildMovementContext(self!, world, { excludeUnitId: target!.id });

    expect(ctx.pathBlockers).toEqual([{ x: 2, y: 2 }]);
    expect([...ctx.otherUnitCells].sort()).toEqual(['1,1']); // ally only
    expect(ctx.otherUnitCells.has('3,3')).toBe(false); // target excluded
    expect(ctx.otherUnitCells.has('2,2')).toBe(false); // neutral is hard, not soft
    // occupied = every OTHER unit (all teams incl neutral), never self.
    expect([...ctx.occupied].sort()).toEqual(['1,1', '2,2', '3,3']);
    expect(ctx.occupied.has('0,0')).toBe(false);
  });

  it('with no excludeUnitId every non-neutral unit is a soft blocker (the tile-pursuit case)', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'enemy', x: 3, y: 3 },
    ]);
    const ctx = buildMovementContext(units[0]!, world);
    expect(ctx.otherUnitCells.has('3,3')).toBe(true);
  });
});

describe('movement / routeToward', () => {
  it('returns a start-to-goal path on open ground', () => {
    const { world, units } = scene([{ team: 'player', x: 0, y: 0 }]);
    const ctx = buildMovementContext(units[0]!, world);
    const path = routeToward({ x: 0, y: 0 }, { x: 3, y: 0 }, ctx, world);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 3, y: 0 });
  });

  it('detours around a hard wall (never routes through it)', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'neutral', x: 1, y: 0, neutral: true },
    ]);
    const ctx = buildMovementContext(units[0]!, world);
    const path = routeToward({ x: 0, y: 0 }, { x: 2, y: 0 }, ctx, world);
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((c) => c.x === 1 && c.y === 0)).toBe(false);
  });

  it('returns [] when the goal cell is itself a wall', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'neutral', x: 2, y: 0, neutral: true },
    ]);
    const ctx = buildMovementContext(units[0]!, world);
    expect(routeToward({ x: 0, y: 0 }, { x: 2, y: 0 }, ctx, world)).toEqual([]);
  });
});

describe('§36a — claims block pathing (occupied OR claimed)', () => {
  it("a peer's claimed cell joins the soft-block set; the unit's own claim does not", () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 }, // the mover
      { team: 'enemy', x: 5, y: 5 }, // the claimant
    ]);
    const [mover, claimant] = units;
    world.claimCell({ x: 2, y: 2 }, claimant!.id);

    const ctx = buildMovementContext(mover!, world);
    expect(ctx.occupied.has('2,2')).toBe(true);
    expect(ctx.otherUnitCells.has('2,2')).toBe(true);

    // The mover's OWN claim never blocks itself (it may step into what it reserved).
    world.claimCell({ x: 1, y: 1 }, mover!.id);
    const ctx2 = buildMovementContext(mover!, world);
    expect(ctx2.occupied.has('1,1')).toBe(false);
    expect(ctx2.otherUnitCells.has('1,1')).toBe(false);
  });

  it('a pather routes AROUND a claimed cell (the second-mover re-route)', () => {
    // The straight line 0,0 → 4,0 would pass through (2,0); claiming it makes the
    // router detour (a claimed cell is soft-cost, like an occupied one).
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'enemy', x: 4, y: 0 },
    ]);
    const [mover, claimant] = units;
    world.claimCell({ x: 2, y: 0 }, claimant!.id);

    const ctx = buildMovementContext(mover!, world);
    const path = routeToward({ x: 0, y: 0 }, { x: 4, y: 0 }, ctx, world);
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((c) => c.x === 2 && c.y === 0)).toBe(false);
  });
});

describe('movement / advance (maxCells = 1, the byte-identical step)', () => {
  it('steps one cell toward the goal on open ground', () => {
    const { world, units } = scene([{ team: 'player', x: 0, y: 0 }]);
    const intent: MovementIntent = {
      goals: [{ x: 5, y: 0 }],
      approachToward: { x: 5, y: 0 },
      maxCells: 1,
    };
    expect(landing(advance(units[0]!, world, intent))).toEqual({ x: 1, y: 0 });
  });

  it('falls back to the next goal when the first yields no route (anti-freeze)', () => {
    // Goal 1 is a wall (no route); goal 2 is open. advance must try goal 2,
    // not abstain on goal 1 — the load-bearing fallback chain.
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'neutral', x: 5, y: 5, neutral: true },
    ]);
    const intent: MovementIntent = {
      goals: [
        { x: 5, y: 5 }, // walled → routeToward []
        { x: 3, y: 0 }, // open → step (1,0)
      ],
      approachToward: { x: 3, y: 0 },
      maxCells: 1,
    };
    expect(landing(advance(units[0]!, world, intent))).toEqual({ x: 1, y: 0 });
  });

  // The E5.B sidestep itself (forward cell occupied → perpendicular step, and
  // abstain when none free) is pinned by MovementBehavior.test.ts driving real
  // ticks; it can't be isolated cleanly here because at `occupiedCellPenalty`
  // 4 any one-cell detour is cheaper than stepping through a soft-blocked ally,
  // so A* routes around rather than producing the path[1]-occupied case.

  it('returns null when fully boxed in by walls', () => {
    const walls: Spec[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        walls.push({ team: 'neutral', x: 5 + dx, y: 5 + dy, neutral: true });
      }
    }
    const { world, units } = scene([{ team: 'player', x: 5, y: 5 }, ...walls]);
    const intent: MovementIntent = {
      goals: [{ x: 0, y: 0 }],
      approachToward: { x: 0, y: 0 },
      maxCells: 1,
    };
    expect(advance(units[0]!, world, intent)).toBeNull();
  });
});

describe('movement / advance (maxCells > 1, the N1 dash hook)', () => {
  it('leaps up to maxCells cells along the route on open ground', () => {
    const { world, units } = scene([{ team: 'player', x: 0, y: 0 }], 16, 16);
    const intent: MovementIntent = {
      goals: [{ x: 8, y: 0 }],
      approachToward: { x: 8, y: 0 },
      maxCells: 4,
    };
    // 1 cell per step normally; maxCells 4 lands 4 cells along the straight route.
    expect(landing(advance(units[0]!, world, intent))).toEqual({ x: 4, y: 0 });
  });

  it('lands on the goal when it is nearer than maxCells', () => {
    const { world, units } = scene([{ team: 'player', x: 0, y: 0 }]);
    const intent: MovementIntent = {
      goals: [{ x: 3, y: 0 }],
      approachToward: { x: 3, y: 0 },
      maxCells: 10,
    };
    expect(landing(advance(units[0]!, world, intent))).toEqual({ x: 3, y: 0 });
  });

  it('stops before the first occupied cell along the leap (conservative default)', () => {
    // 1-wide corridor on y=0 (row y=1 walled) with an ally on (3,0): the leap
    // walks (1,0),(2,0) then hits the occupied (3,0) and lands on (2,0).
    const specs: Spec[] = [
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 3, y: 0 }, // ally blocks the corridor
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((x): Spec => ({ team: 'neutral', x, y: 1, neutral: true })),
    ];
    const { world, units } = scene(specs, 16, 16);
    const intent: MovementIntent = {
      goals: [{ x: 8, y: 0 }],
      approachToward: { x: 8, y: 0 },
      maxCells: 5,
    };
    expect(landing(advance(units[0]!, world, intent))).toEqual({ x: 2, y: 0 });
  });
});

describe('movement / advance — M6 water bog-down (move duration)', () => {
  /** The duration (ticks) a move proposal locks the unit + lerps the sprite over. */
  function moveTicks(proposal: { action: unknown } | null): number | null {
    if (proposal === null) return null;
    return (proposal.action as MoveAction).toData().durationTicks;
  }

  // A unit boxed so its ONLY forward cell is (1,0): the diagonals (0,1)/(1,1)
  // are walled, so A* can't route AROUND a water tile placed there — it must
  // wade in. (An isolated water tile on open ground is simply detoured, which
  // is exactly why the cost-2 slow was invisible before M6.)
  function forcedStep(water: boolean): {
    land: GridCoord | null;
    ticks: number | null;
    base: number;
  } {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'neutral', x: 0, y: 1, neutral: true },
      { team: 'neutral', x: 1, y: 1, neutral: true },
    ]);
    const u = units[0]!;
    if (water) world.tileGrid.setKind({ x: 1, y: 0 }, 'shallow_water');
    const intent: MovementIntent = {
      goals: [{ x: 2, y: 0 }],
      approachToward: { x: 2, y: 0 },
      maxCells: 1,
    };
    const p = advance(u, world, intent);
    return { land: landing(p), ticks: moveTicks(p), base: u.derived.moveCooldownTicks };
  }

  it('a step onto floor keeps the base move cooldown (byte-identical on dry ground)', () => {
    const dry = forcedStep(false);
    expect(dry.land).toEqual({ x: 1, y: 0 });
    expect(dry.ticks).toBe(dry.base);
  });

  it('a step that wades into water takes cost-2× as long', () => {
    const wet = forcedStep(true);
    expect(wet.land).toEqual({ x: 1, y: 0 }); // still steps in — cost 2 is finite
    expect(wet.ticks).toBe(wet.base * 2); // shallow_water TILE_COST = 2 → 2× duration
    expect(wet.ticks).toBeGreaterThan(wet.base);
  });

  it('the leap (maxCells > 1) keeps base cadence even when forced through water', () => {
    // 1-wide corridor on y=0 (row y=1 walled) with water on the first cells: the
    // leap is FORCED through water yet keeps base cadence — wade scaling is a
    // normal-step property, the dash's terrain interaction is N1's call.
    const specs: Spec[] = [
      { team: 'player', x: 0, y: 0 },
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((x): Spec => ({ team: 'neutral', x, y: 1, neutral: true })),
    ];
    const { world, units } = scene(specs, 16, 16);
    const u = units[0]!;
    world.tileGrid.setKind({ x: 1, y: 0 }, 'shallow_water');
    world.tileGrid.setKind({ x: 2, y: 0 }, 'shallow_water');
    const intent: MovementIntent = {
      goals: [{ x: 8, y: 0 }],
      approachToward: { x: 8, y: 0 },
      maxCells: 4,
    };
    const p = advance(u, world, intent);
    expect(landing(p)).toEqual({ x: 4, y: 0 }); // leapt through the water
    expect(moveTicks(p)).toBe(u.derived.moveCooldownTicks); // base, not scaled
  });
});
