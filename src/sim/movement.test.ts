import { describe, it, expect } from 'vitest';
import { World } from './World';
import { Unit, type Team, type UnitStats } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { deriveStats, inertDerived } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import { MoveAction } from './actions/MoveAction';
import { SwapAction } from './actions/SwapAction';
import { WAIT_ACTION_ID, WaitAction } from './actions/WaitAction';
import { SupportMovementBehavior } from './behaviors/SupportMovementBehavior';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import {
  advance,
  routeToward,
  buildMovementContext,
  costAt,
  sidestep,
  type MovementIntent,
} from './movement';
import { SIM } from '../config/sim';

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

function scene(
  specs: Spec[],
  gridW = 12,
  gridH = 12,
  bus: EventBus<GameEvents> = new EventBus<GameEvents>(),
): { world: World; units: Unit[] } {
  const world = new World(bus, new RNG(1), gridW, gridH);
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

describe('§43b — the sidestep tie balance (cell-parity alternation)', () => {
  // Direct sidestep() probes on an empty board: both perpendiculars in-bounds,
  // walkable, unoccupied — the pure tie geometry `advance` can't reach in open
  // space (A* detours around soft blockers there; see the E5.B note above).
  const empty = () => scene([{ team: 'player', x: 0, y: 11 }]); // parked out of the way
  const none = new Set<string>();

  it('a both-viable equidistant tie resolves by the FROM cell checkerboard parity', () => {
    const { world } = empty();
    // Moving east from an EVEN cell: the clockwise rotation (screen frame:
    // east → south) wins the tie. From the ODD cell one row down, it flips.
    expect(sidestep({ x: 4, y: 4 }, { x: 9, y: 4 }, world, none)).toEqual({ x: 4, y: 5 });
    expect(sidestep({ x: 4, y: 5 }, { x: 9, y: 5 }, world, none)).toEqual({ x: 4, y: 4 });
    // §45b — a pure-DIAGONAL approach no longer ties: both rotations are one
    // step FARTHER from the target (the backward shuttle the progress guard
    // culls), so the sidestep honestly abstains and the caller queues/waits.
    // Cardinal ties — the ones corridor flow is made of — keep the §43b rule.
    expect(sidestep({ x: 4, y: 4 }, { x: 9, y: 9 }, world, none)).toBeNull();
    expect(sidestep({ x: 4, y: 5 }, { x: 9, y: 10 }, world, none)).toBeNull();
  });

  it('adjacent cells in a column alternate sides (the self-decorrelation property)', () => {
    // A queue of units stacked in a column all heading east would previously
    // ALL crab the same body side; under cell parity they split alternately.
    const { world } = empty();
    const sides = [3, 4, 5, 6].map((y) => {
      const c = sidestep({ x: 4, y }, { x: 9, y }, world, none)!;
      return c.y - y; // +1 = south rotation, -1 = north rotation
    });
    expect(sides).toEqual([-1, 1, -1, 1]);
  });

  it('a NON-tie is untouched: the nearer candidate wins regardless of parity', () => {
    const { world } = empty();
    // Even cell, but the counter-clockwise candidate is strictly closer.
    expect(sidestep({ x: 4, y: 4 }, { x: 9, y: 5 }, world, none)).toEqual({ x: 5, y: 3 });
    // Odd cell, but the clockwise candidate is strictly closer.
    expect(sidestep({ x: 4, y: 5 }, { x: 9, y: 4 }, world, none)).toEqual({ x: 5, y: 6 });
  });

  it('a single viable candidate is untouched: the free cell wins regardless of parity', () => {
    const { world } = empty();
    // Even cell (parity prefers the clockwise (4,5)) — occupy it: (4,3) steps.
    expect(sidestep({ x: 4, y: 4 }, { x: 9, y: 4 }, world, new Set(['4,5']))).toEqual({
      x: 4,
      y: 3,
    });
    // Odd cell (parity prefers the counter-clockwise (4,4)) — occupy it: (4,6) steps.
    expect(sidestep({ x: 4, y: 5 }, { x: 9, y: 5 }, world, new Set(['4,4']))).toEqual({
      x: 4,
      y: 6,
    });
  });

  it('the rule is 180°-rotation symmetric (neither team gets a preferred side)', () => {
    // The fixtures relate the two teams by a 180° board rotation; a fair tie
    // rule must commute with it. Cell parity does on any W+H-even board
    // (rotation maps (x,y) → (W-1-x, H-1-y), preserving x+y parity). Probe a
    // spread of parities and approach directions on the 12×12 test board.
    const { world } = empty();
    const rot = (c: GridCoord): GridCoord => ({ x: 11 - c.x, y: 11 - c.y });
    const cases: [GridCoord, GridCoord][] = [
      [{ x: 4, y: 4 }, { x: 9, y: 4 }], // even, east
      [{ x: 4, y: 5 }, { x: 9, y: 5 }], // odd, east
      [{ x: 7, y: 4 }, { x: 2, y: 4 }], // odd, west
      [{ x: 5, y: 8 }, { x: 5, y: 2 }], // odd, north
      [{ x: 6, y: 4 }, { x: 6, y: 9 }], // even, south
    ];
    for (const [from, target] of cases) {
      const straight = sidestep(from, target, world, none);
      const rotated = sidestep(rot(from), rot(target), world, none);
      expect(straight).not.toBeNull();
      expect(rotated).toEqual(rot(straight!));
    }
    // §45b — the guard commutes with the rotation too: a diagonal approach
    // abstains identically in both frames (nullity is rotation-invariant).
    expect(sidestep({ x: 4, y: 4 }, { x: 9, y: 9 }, world, none)).toBeNull();
    expect(sidestep(rot({ x: 4, y: 4 }), rot({ x: 9, y: 9 }), world, none)).toBeNull();
  });

  it('mirrored pockets sidestep mirror-symmetrically through advance() (the ROADMAP pin)', () => {
    // The moveDecision.test.ts forced-pocket geometry (the only A* route runs
    // through the ally ahead; both perpendiculars are open dead-ends) and its
    // 180°-rotated copy: the two committed sidesteps must land on point-mirrored
    // cells. Under the old first-candidate rule both went the same BODY side —
    // the shared-sign drift 43b kills.
    const pocket = (r: (c: GridCoord) => GridCoord) => {
      const walls: Spec[] = [];
      for (let x = 1; x <= 5; x++) {
        walls.push({ team: 'neutral', ...r({ x, y: 4 }), neutral: true });
        walls.push({ team: 'neutral', ...r({ x, y: 6 }), neutral: true });
      }
      for (let x = 0; x <= 6; x++) {
        walls.push({ team: 'neutral', ...r({ x, y: 3 }), neutral: true });
        walls.push({ team: 'neutral', ...r({ x, y: 7 }), neutral: true });
      }
      const { world, units } = scene([
        { team: 'player', ...r({ x: 0, y: 5 }) },
        { team: 'player', ...r({ x: 1, y: 5 }) }, // the blocker ahead
        { team: 'enemy', ...r({ x: 5, y: 5 }) },
        ...walls,
      ]);
      const goal = r({ x: 5, y: 5 });
      const intent: MovementIntent = {
        goals: [goal],
        approachToward: goal,
        excludeUnitId: units[2]!.id,
        maxCells: 1,
      };
      return landing(advance(units[0]!, world, intent));
    };
    const straight = pocket((c) => c);
    const rotated = pocket((c) => ({ x: 11 - c.x, y: 11 - c.y }));
    expect(straight).toEqual({ x: 0, y: 4 }); // odd from-cell (0,5) → counter-clockwise
    expect(rotated).toEqual({ x: 11, y: 7 }); // the exact point-image of (0,4)
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

describe('§45a — vacancy-aware costs (the tiered costAt + route choice)', () => {
  /**
   * Seat `unit` mid-move to `to` the way World.executeActions does — active
   * action + destination claim — pre-flip (`travel` ticks remain before the
   * impact boundary). durationTicks = 2×travel matches the moveFlipFraction
   * 0.5 timeline shape.
   */
  function seatMove(world: World, unit: Unit, to: GridCoord, travel: number) {
    const durationTicks = travel * 2;
    unit.activeAction = {
      action: new MoveAction(unit.position, to, durationTicks),
      startTick: world.currentTick,
      finishTick: world.currentTick + durationTicks,
      phases: [
        { phase: 'travel', ticks: travel },
        { phase: 'impact', ticks: 0 },
        { phase: 'recovery', ticks: durationTicks - travel },
      ],
    };
    world.claimCell(to, unit.id);
  }

  // The dial ordering every §45a expectation below leans on. If a retune
  // breaks one of these, the tier split has lost its meaning — fix the
  // config, or rethink the tiers; don't loosen these.
  it('preconditions: the three tiers are ordered (vacating < static < inbound premium)', () => {
    expect(SIM.vacatingCellPenalty).toBeLessThan(SIM.occupiedCellPenalty);
    expect(SIM.inboundClaimPenalty).toBeGreaterThan(SIM.occupiedCellPenalty);
    expect(SIM.vacancyWindowOwnSteps).toBeGreaterThanOrEqual(0);
  });

  it('a static occupant prices at occupiedCellPenalty (the pre-§45a flat rate)', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 2, y: 2 },
    ]);
    const ctx = buildMovementContext(units[0]!, world);
    expect(costAt({ x: 2, y: 2 }, world, ctx, units[0]!.position)).toBe(
      1 + SIM.occupiedCellPenalty,
    );
  });

  it('a cell vacating within the arrival window prices at the discount', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 2, y: 2 },
    ]);
    const [mover, ally] = units;
    seatMove(world, ally!, { x: 3, y: 2 }, 2); // flips 2 ticks out — long before arrival
    const ctx = buildMovementContext(mover!, world);
    expect(ctx.vacatingEta.get('2,2')).toBe(2);
    expect(costAt({ x: 2, y: 2 }, world, ctx, mover!.position)).toBe(
      1 + SIM.vacatingCellPenalty,
    );
  });

  it('a cell vacating far beyond the window prices as static', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 2, y: 2 },
    ]);
    const [mover, ally] = units;
    // Window for a cell 2 away = (2 + k) × own step; a glacial flip misses it.
    const beyond = (2 + SIM.vacancyWindowOwnSteps + 1) * mover!.derived.moveCooldownTicks;
    seatMove(world, ally!, { x: 3, y: 2 }, beyond);
    const ctx = buildMovementContext(mover!, world);
    expect(costAt({ x: 2, y: 2 }, world, ctx, mover!.position)).toBe(
      1 + SIM.occupiedCellPenalty,
    );
  });

  it('a claim flipping inside the convergence window prices at the inbound premium', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 2, y: 0 },
    ]);
    const [mover, ally] = units;
    seatMove(world, ally!, { x: 1, y: 0 }, 2); // arriving right next to the mover
    const ctx = buildMovementContext(mover!, world);
    expect(costAt({ x: 1, y: 0 }, world, ctx, mover!.position)).toBe(
      1 + SIM.inboundClaimPenalty,
    );
  });

  it('a claim whose flip is long done by arrival prices as a mere body (static tier)', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 6, y: 6 },
    ]);
    const [mover, ally] = units;
    seatMove(world, ally!, { x: 6, y: 7 }, 2); // flips in 2 ticks; the mover is ~7 steps away
    const ctx = buildMovementContext(mover!, world);
    expect(costAt({ x: 6, y: 7 }, world, ctx, mover!.position)).toBe(
      1 + SIM.occupiedCellPenalty,
    );
  });

  it('a claim with underivable timing prices at the premium (conservative fallback)', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 6, y: 6 },
    ]);
    const [mover, claimant] = units;
    world.claimCell({ x: 6, y: 7 }, claimant!.id); // hand-claimed; no in-flight move
    const ctx = buildMovementContext(mover!, world);
    expect(ctx.claimed.has('6,7')).toBe(true);
    expect(ctx.claimed.get('6,7')).toBeUndefined();
    expect(costAt({ x: 6, y: 7 }, world, ctx, mover!.position)).toBe(
      1 + SIM.inboundClaimPenalty,
    );
  });

  it('a free cell still prices at plain tile cost', () => {
    const { world, units } = scene([{ team: 'player', x: 0, y: 0 }]);
    const ctx = buildMovementContext(units[0]!, world);
    expect(costAt({ x: 5, y: 5 }, world, ctx, units[0]!.position)).toBe(1);
  });

  /**
   * The corridor-aversion A/B — the §42c diagnosis this phase exists to fix.
   * A bottom-row lane walled off for four rows; a leader mid-move inside it.
   * Straight-through costs (7 free + vacating body + settled claim); the
   * around-the-wall detour costs ~17 plain cells. With the leader flipping
   * SOON, the lane prices cheap → stay in lane. Same geometry with a GLACIAL
   * leader (flip far beyond every window): body reads static, claim reads
   * premium → the detour wins, exactly the pre-§45a read. The pair proves the
   * discount is ETA-gated, not a blanket "mid-move = cheap".
   */
  function corridorScene(travel: number) {
    const specs: Parameters<typeof scene>[0] = [
      { team: 'player', x: 0, y: 11 }, // the follower
      { team: 'player', x: 4, y: 11 }, // the leader, seated mid-move below
    ];
    for (let x = 1; x <= 8; x++) {
      for (let y = 7; y <= 10; y++) specs.push({ team: 'neutral', x, y, neutral: true });
    }
    const { world, units } = scene(specs);
    const [follower, leader] = units;
    seatMove(world, leader!, { x: 5, y: 11 }, travel);
    const ctx = buildMovementContext(follower!, world);
    return routeToward(follower!.position, { x: 9, y: 11 }, ctx, world);
  }

  it('the follower stays in lane behind a leader vacating in time', () => {
    const path = corridorScene(3);
    expect(path.length).toBeGreaterThan(0);
    expect(path.every((c) => c.y === 11)).toBe(true);
  });

  it('the follower detours around a glacial leader (the ETA gate really gates)', () => {
    const path = corridorScene(10_000);
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((c) => c.y !== 11)).toBe(true);
  });
});

describe('§45b — the ETA-gated wait-vs-sidestep', () => {
  /** Same seat shape as the §45a block: active move + destination claim. */
  function seatMove(world: World, unit: Unit, to: GridCoord, travel: number) {
    const durationTicks = travel * 2;
    unit.activeAction = {
      action: new MoveAction(unit.position, to, durationTicks),
      startTick: world.currentTick,
      finishTick: world.currentTick + durationTicks,
      phases: [
        { phase: 'travel', ticks: travel },
        { phase: 'impact', ticks: 0 },
        { phase: 'recovery', ticks: durationTicks - travel },
      ],
    };
    world.claimCell(to, unit.id);
  }

  /**
   * The M6 forcedStep box: walls at (0,1)/(1,1) pin the mover's route to
   * (1,0), and neither perpendicular sidestep cell exists ((0,1) walled,
   * (0,-1) off-grid) — so the poll's outcome isolates the §45b gate: wait
   * when it fires, bare-null queue when it doesn't.
   */
  function boxedAdvance(blockerTravel: number | 'static' | 'claim-only') {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 1, y: 0 },
      { team: 'neutral', x: 0, y: 1, neutral: true },
      { team: 'neutral', x: 1, y: 1, neutral: true },
      { team: 'player', x: 3, y: 3 }, // the claim-only case's claimant
    ]);
    const [mover, blocker, , , claimant] = units;
    if (blockerTravel === 'claim-only') {
      // The forward cell holds no body — only an inbound claim (an arriving
      // unit). Move the blocker OFF the lane first.
      blocker!.position = { x: 3, y: 5 };
      seatMove(world, claimant!, { x: 1, y: 0 }, 2);
    } else if (blockerTravel !== 'static') {
      seatMove(world, blocker!, { x: 2, y: 0 }, blockerTravel);
    }
    const intent: MovementIntent = {
      goals: [{ x: 5, y: 0 }],
      approachToward: { x: 5, y: 0 },
      maxCells: 1,
    };
    return advance(mover!, world, intent);
  }

  it('proposes the first-class wait when the forward blocker vacates within the gate', () => {
    const p = boxedAdvance(3); // flips 3 ticks out — well inside 1 own-step
    expect(p).not.toBeNull();
    expect(p!.action.id).toBe(WAIT_ACTION_ID);
    // The §44b wait shape: move-tier score, no cooldown, empty timeline
    // (instantaneous — resolves within the tick, never enters activeAction).
    expect(p!.score).toBe(1);
    expect(p!.cooldown).toBe(0);
    expect(p!.phases).toEqual([]);
  });

  it('does NOT wait for a blocker vacating beyond the gate (pre-§45b queue abstain)', () => {
    // Gate = waitForVacancyOwnSteps × own step ticks; a glacial flip misses it.
    expect(boxedAdvance(10_000)).toBeNull();
  });

  it('does NOT wait for a static blocker (no derivable drain)', () => {
    expect(boxedAdvance('static')).toBeNull();
  });

  it('does NOT wait for a bare inbound claim (an arriving body is not a draining lane)', () => {
    expect(boxedAdvance('claim-only')).toBeNull();
  });

  it('the gate derives from config (balance-proof): a flip exactly AT the gate waits', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 1, y: 0 },
      { team: 'neutral', x: 0, y: 1, neutral: true },
      { team: 'neutral', x: 1, y: 1, neutral: true },
    ]);
    const [mover, blocker] = units;
    const gateTicks = SIM.waitForVacancyOwnSteps * mover!.derived.moveCooldownTicks;
    seatMove(world, blocker!, { x: 2, y: 0 }, gateTicks); // eta === gate, inclusive
    const intent: MovementIntent = {
      goals: [{ x: 5, y: 0 }],
      approachToward: { x: 5, y: 0 },
      maxCells: 1,
    };
    const p = advance(mover!, world, intent);
    expect(p).not.toBeNull();
    expect(p!.action.id).toBe(WAIT_ACTION_ID);
  });

  it('the progress guard: a sidestep never loses ground (the standoff shuttle dies)', () => {
    // The riverFork shuttle engine, distilled: a diagonal approach whose
    // forward cell is blocked. Both perpendicular rotations sit one step
    // FARTHER from the target — pre-§45b the viable one was taken anyway
    // (286 backtracks/300t on the fixture), post-§45b the unit queues.
    const { world } = scene([{ team: 'player', x: 0, y: 11 }]);
    const none = new Set<string>();
    expect(sidestep({ x: 5, y: 5 }, { x: 8, y: 8 }, world, none)).toBeNull(); // even from-cell
    expect(sidestep({ x: 5, y: 6 }, { x: 8, y: 9 }, world, none)).toBeNull(); // odd from-cell
    // A strictly-CLOSER rotation on a diagonal approach still fires — the
    // guard culls backward steps, not diagonal geometry.
    expect(sidestep({ x: 5, y: 5 }, { x: 9, y: 6 }, world, none)).toEqual({ x: 6, y: 4 });
  });

  it('an in-gate wait preempts a VIABLE sidestep at a corridor mouth (the ford picture)', () => {
    // The §45a A/B geometry: lane y=11 walled off for four rows (x=1..8,
    // y=7..10) so the around-route costs more than the through-lane. The
    // mover stands at the MOUTH (0,11) where the sidestep cell (0,10) is
    // open and viable — pre-§45b this is exactly the crab-walk trigger.
    // The blocker one cell in, mid-move away: the draining lane wins.
    const specs: Spec[] = [
      { team: 'player', x: 0, y: 11 },
      { team: 'player', x: 1, y: 11 },
    ];
    for (let x = 1; x <= 8; x++) {
      for (let y = 7; y <= 10; y++) specs.push({ team: 'neutral', x, y, neutral: true });
    }
    const { world, units } = scene(specs);
    const [mover, blocker] = units;
    seatMove(world, blocker!, { x: 2, y: 11 }, 3);
    // Sanity: the sidestep really is viable (would fire without the gate).
    const ctx = buildMovementContext(mover!, world);
    expect(sidestep(mover!.position, { x: 9, y: 11 }, world, ctx.occupied)).not.toBeNull();
    const p = advance(mover!, world, {
      goals: [{ x: 9, y: 11 }],
      approachToward: { x: 9, y: 11 },
      maxCells: 1,
    });
    expect(p).not.toBeNull();
    expect(p!.action.id).toBe(WAIT_ACTION_ID);
  });
});

describe('§45c — the stable-route margin (anti-flicker hysteresis)', () => {
  /** Same seat shape as the §45a/§45b blocks: active move + destination claim. */
  function seatMove(world: World, unit: Unit, to: GridCoord, travel: number) {
    const durationTicks = travel * 2;
    unit.activeAction = {
      action: new MoveAction(unit.position, to, durationTicks),
      startTick: world.currentTick,
      finishTick: world.currentTick + durationTicks,
      phases: [
        { phase: 'travel', ticks: travel },
        { phase: 'impact', ticks: 0 },
        { phase: 'recovery', ticks: durationTicks - travel },
      ],
    };
    world.claimCell(to, unit.id);
  }

  /**
   * The junction geometry — where lane flicker actually lives (§45c-pre: on
   * open ground A* dodges diagonally without changing its FIRST step, so
   * distant transients can't flip a poll; at a corridor branch the whole
   * lane is committed at step one). Two parallel 1-wide lanes off a mouth:
   * lane A (y=5) and lane B (y=7), a wall row between and around, goal at
   * the far merge. Equal lengths — the mover's baseline choice is lane A
   * (the 43a numeric (y,x) tie fallback).
   */
  function junction(traffic: (world: World, laneUnits: Unit[]) => void) {
    const specs: Spec[] = [{ team: 'player', x: 0, y: 6 }];
    // Lane-resident units get seated by the traffic callback (up to two).
    specs.push({ team: 'player', x: 3, y: 5 });
    specs.push({ team: 'player', x: 6, y: 5 });
    for (let x = 1; x <= 8; x++) {
      specs.push({ team: 'neutral', x, y: 4, neutral: true }); // above lane A
      specs.push({ team: 'neutral', x, y: 6, neutral: true }); // between lanes
      specs.push({ team: 'neutral', x, y: 8, neutral: true }); // below lane B
    }
    const { world, units } = scene(specs);
    const [mover, resA, resB] = units;
    traffic(world, [resA!, resB!]);
    const p = advance(mover!, world, {
      goals: [{ x: 9, y: 6 }],
      approachToward: { x: 9, y: 6 },
      maxCells: 1,
    });
    return { proposal: p, mover: mover! };
  }

  /** Park the lane residents far off the board's action (empty lane A). */
  const parked = (_world: World, lane: Unit[]) => {
    lane[0]!.position = { x: 0, y: 0 };
    lane[1]!.position = { x: 11, y: 0 };
  };

  it('baseline: with no traffic the mover takes lane A (the deterministic tie)', () => {
    const { proposal } = junction(parked);
    expect(landing(proposal)).toEqual({ x: 1, y: 5 });
  });

  it('a single transient pulse on lane A does NOT flip the choice (the flicker dies)', () => {
    // One mid-move body on lane A: vacating discount (+1) + its claim's
    // static tier (+4) = a +5 live advantage for lane B — under the margin.
    // Pre-§45c the live route switched lanes for it (and back, next poll).
    const { proposal } = junction((world, lane) => {
      lane[1]!.position = { x: 11, y: 0 }; // only one resident in play
      seatMove(world, lane[0]!, { x: 4, y: 5 }, 2);
    });
    expect(landing(proposal)).toEqual({ x: 1, y: 5 }); // stays in lane A
  });

  it('heavy transient traffic on lane A still yields by detour (above the margin)', () => {
    // Two mid-move bodies: 2 × (+1 body +4 claim) = +10 > routeSwitchMargin 8.
    const { proposal } = junction((world, lane) => {
      seatMove(world, lane[0]!, { x: 4, y: 5 }, 2);
      seatMove(world, lane[1]!, { x: 7, y: 5 }, 2);
    });
    expect(landing(proposal)).toEqual({ x: 1, y: 7 }); // lane B
  });

  it('a STATIC blocker on lane A is priced in the stable route too (no stuck regression)', () => {
    // A body at rest is furniture: both routes prefer lane B — agreement, no
    // margin in play. The §45a corridor-aversion math is untouched.
    const { proposal } = junction((_world, lane) => {
      lane[1]!.position = { x: 11, y: 0 };
      // lane[0] stays parked at (3,5) with no active move — a static body.
    });
    expect(landing(proposal)).toEqual({ x: 1, y: 7 }); // lane B
  });

  it('the margin derives from config (balance-proof: the pulse sits under it)', () => {
    // The single-pulse advantage (+5) must actually be under the dial for the
    // flicker test above to mean anything; the heavy case (+10) above it.
    expect(SIM.routeSwitchMargin).toBeGreaterThanOrEqual(5);
    expect(SIM.routeSwitchMargin).toBeLessThan(10);
  });

  it('a glacially-vacating blocker stays a stable cost (the horizon gates the strip)', () => {
    // Same single-body geometry, but the move is far beyond the horizon: the
    // body prices as furniture in BOTH routes → agreement on lane B.
    const { proposal } = junction((world, lane) => {
      lane[1]!.position = { x: 11, y: 0 };
      seatMove(world, lane[0]!, { x: 4, y: 5 }, 10_000);
    });
    expect(landing(proposal)).toEqual({ x: 1, y: 7 }); // lane B
  });
});

/**
 * 56b/56c2 — the swap-through probe: a blocked MELEE mover passes a friendly
 * RANGED blocker via the GP5 atomic swap. Since 56c2 the probe PRECEDES the
 * E5.B sidestep for role-eligible blockers (§45b wait → swap-or-queue →
 * sidestep for everyone else): an equal-distance sidestep around a unit that
 * belongs behind you is a loop, not progress (the observed labyrinth
 * scenario 2). A role-eligible-but-BUSY blocker means queue — its own 56c2
 * yield (MovementBehavior) covers that window from the other side. The role
 * order (melee through ranged, never the reverse) is the anti-oscillation:
 * antisymmetry means a pair can never swap twice. Shape-locked 2026-07-15
 * (worklog §56, amended §56c2); the in-band eligibility alternative was
 * REJECTED there (it excludes the canonical max-range corridor jam).
 */
describe('56b — swap-through (the mover-initiated pass)', () => {
  /** A 1-wide corridor at row `y`: walls on y±1 across the full grid width. */
  function corridorSpecs(y: number, gridW = 12): Spec[] {
    const specs: Spec[] = [];
    for (let x = 0; x < gridW; x++) {
      specs.push({ team: 'neutral', x, y: y - 1, neutral: true });
      specs.push({ team: 'neutral', x, y: y + 1, neutral: true });
    }
    return specs;
  }

  /** The standard jam: melee at (3,5) behind a ranged ally at (4,5), enemy
   *  at (8,5), 1-wide corridor. Returns the advance() proposal for the melee. */
  function jam(
    opts: {
      blockerRange?: number;
      blockerTeam?: Team;
      blockerSupport?: boolean;
      blockerMidMove?: boolean;
      moverRange?: number;
    } = {},
  ) {
    const bus = new EventBus<GameEvents>();
    const decisions: GameEvents['unit:moveDecision'][] = [];
    bus.on('unit:moveDecision', (e) => decisions.push(e));
    const { world, units } = scene(
      [
        { team: 'player', x: 3, y: 5, range: opts.moverRange ?? 1 }, // the mover
        { team: opts.blockerTeam ?? 'player', x: 4, y: 5, range: opts.blockerRange ?? 3 },
        { team: 'enemy', x: 8, y: 5 }, // the target
        ...corridorSpecs(5),
      ],
      12,
      12,
      bus,
    );
    const [mover, blocker, enemy] = units;
    if (opts.blockerSupport === true) blocker!.behaviors.push(new SupportMovementBehavior());
    if (opts.blockerMidMove === true) {
      // Mid-move BACKWARD (the forward cell holds the mover) — pre-flip, so
      // the logical position still reads (4,5). ETA (4 ticks) is inside the
      // §45b gate, so the WAIT branch resolves this shape before the probe.
      blocker!.activeAction = {
        action: new MoveAction(blocker!.position, { x: 5, y: 5 }, 8),
        startTick: world.currentTick,
        finishTick: world.currentTick + 8,
        phases: [
          { phase: 'travel', ticks: 4 },
          { phase: 'impact', ticks: 0 },
          { phase: 'recovery', ticks: 4 },
        ],
      };
      world.claimCell({ x: 5, y: 5 }, blocker!.id);
    }
    const proposal = advance(mover!, world, {
      goals: [enemy!.position],
      approachToward: enemy!.position,
      excludeUnitId: enemy!.id,
      maxCells: 1,
    });
    return { proposal, decisions, world, mover: mover!, blocker: blocker!, enemy: enemy! };
  }

  it('proposes the swap in the canonical corridor jam (melee behind idle friendly ranged)', () => {
    const { proposal, decisions, mover, blocker } = jam();
    expect(proposal).not.toBeNull();
    expect(proposal!.action.id).toBe('swap');
    expect(decisions).toEqual([{ unitId: mover.id, kind: 'swap_through' }]);
    // The swap is move-shaped: score 1, cooldown = the full step duration.
    expect(proposal!.score).toBe(1);
    expect(proposal!.cooldown).toBe(mover.derived.moveCooldownTicks);
    const data = (proposal!.action as SwapAction).toData();
    expect(data.from).toEqual(mover.position);
    expect(data.to).toEqual(blocker.position);
    expect(data.otherId).toBe(blocker.id);
  });

  it('role order: a MELEE blocker is never passed (equal roles queue)', () => {
    const { proposal, decisions } = jam({ blockerRange: 1 });
    expect(proposal).toBeNull();
    expect(decisions[0]!.kind).toBe('queue');
  });

  it('role order: a RANGED mover never initiates (ranged queues behind anyone)', () => {
    const { proposal, decisions } = jam({ moverRange: 3, blockerRange: 3 });
    expect(proposal).toBeNull();
    expect(decisions[0]!.kind).toBe('queue');
  });

  it('an ENEMY blocker is fought, not passed', () => {
    const { proposal, decisions } = jam({ blockerTeam: 'enemy' });
    expect(proposal).toBeNull();
    expect(decisions[0]!.kind).toBe('queue');
  });

  it('a SUPPORT blocker is never passed from the mover side (GP5 owns the healer yield)', () => {
    const { proposal, decisions } = jam({ blockerSupport: true });
    expect(proposal).toBeNull();
    expect(decisions[0]!.kind).toBe('queue');
  });

  it('a mid-move blocker resolves via the §45b WAIT gate, not the swap (56a doctrine upstream)', () => {
    const { proposal, decisions } = jam({ blockerMidMove: true });
    expect(proposal).not.toBeNull();
    expect(proposal!.action.id).toBe('wait');
    expect(decisions[0]!.kind).toBe('wait');
  });

  /** The scenario-2 pocket: a 1-wide corridor with ONE open sidestep bay at
   *  (3,6) — the route must pass the blocker at (4,5), but an equal-distance
   *  lateral exists, so pre-56c2 the mover crab-looped through it. */
  function pocketSpecs(): Spec[] {
    const specs: Spec[] = [];
    for (let x = 0; x < 12; x++) {
      specs.push({ team: 'neutral', x, y: 4, neutral: true });
      if (x !== 3) specs.push({ team: 'neutral', x, y: 6, neutral: true });
    }
    return specs;
  }

  it('a role-eligible blocker is never sidestepped around: BUSY → queue (the scenario-2 loop fix)', () => {
    // Pre-56c2 the mover crabbed to the (3,6) bay — an equal-distance
    // sidestep that locks it for a full move window and loops. Now:
    // eligible-but-busy blocker → queue, staying poll-dense for the
    // blocker's own yield window.
    const bus = new EventBus<GameEvents>();
    const decisions: GameEvents['unit:moveDecision'][] = [];
    bus.on('unit:moveDecision', (e) => decisions.push(e));
    const { world, units } = scene(
      [
        { team: 'player', x: 3, y: 5 },
        { team: 'player', x: 4, y: 5, range: 3 },
        { team: 'enemy', x: 8, y: 5 },
        ...pocketSpecs(),
      ],
      12,
      12,
      bus,
    );
    const [mover, blocker, enemy] = units;
    // Busy but going nowhere (no claim → no §45b vacancy ETA): a seated wait.
    blocker!.activeAction = {
      action: new WaitAction(),
      startTick: world.currentTick,
      finishTick: world.currentTick + 6,
      phases: [{ phase: 'recovery', ticks: 6 }],
    };
    const proposal = advance(mover!, world, {
      goals: [enemy!.position],
      approachToward: enemy!.position,
      excludeUnitId: enemy!.id,
      maxCells: 1,
    });
    expect(proposal).toBeNull();
    expect(decisions).toEqual([{ unitId: mover!.id, kind: 'queue' }]);
  });

  it('a role-eligible IDLE blocker is swapped, not sidestepped (precedence proof)', () => {
    // Same pocket geometry, blocker idle: the swap now outranks the available
    // equal-distance sidestep.
    const bus = new EventBus<GameEvents>();
    const decisions: GameEvents['unit:moveDecision'][] = [];
    bus.on('unit:moveDecision', (e) => decisions.push(e));
    const { world, units } = scene(
      [
        { team: 'player', x: 3, y: 5 },
        { team: 'player', x: 4, y: 5, range: 3 },
        { team: 'enemy', x: 8, y: 5 },
        ...pocketSpecs(),
      ],
      12,
      12,
      bus,
    );
    const [mover, , enemy] = units;
    const proposal = advance(mover!, world, {
      goals: [enemy!.position],
      approachToward: enemy!.position,
      excludeUnitId: enemy!.id,
      maxCells: 1,
    });
    expect(proposal).not.toBeNull();
    expect(proposal!.action.id).toBe('swap');
    expect(decisions[0]!.kind).toBe('swap_through');
  });

  it('the swap never fires in the open (the router detours first)', () => {
    // Same units, NO corridor walls: the router detours around the soft-
    // blocked cell (or the E5.B sidestep crabs past it) long before the
    // cascade reaches the probe — a plain move, never a swap.
    const bus = new EventBus<GameEvents>();
    const decisions: GameEvents['unit:moveDecision'][] = [];
    bus.on('unit:moveDecision', (e) => decisions.push(e));
    const { world, units } = scene(
      [
        { team: 'player', x: 3, y: 5 },
        { team: 'player', x: 4, y: 5, range: 3 },
        { team: 'enemy', x: 8, y: 5 },
      ],
      12,
      12,
      bus,
    );
    const [mover, , enemy] = units;
    const proposal = advance(mover!, world, {
      goals: [enemy!.position],
      approachToward: enemy!.position,
      excludeUnitId: enemy!.id,
      maxCells: 1,
    });
    expect(proposal).not.toBeNull();
    expect(proposal!.action.id).toBe('move');
    expect(['advance', 'sidestep']).toContain(decisions[0]!.kind);
  });

  it('anti-oscillation: the displaced ranged unit does NOT swap back (antisymmetry)', () => {
    const { proposal, world, mover, blocker, enemy } = jam();
    // Execute the full deferred swap: start (event only) then the flip.
    proposal!.action.start(mover, world);
    proposal!.action.applyEffect!(mover, world, 0);
    expect(mover.position).toEqual({ x: 4, y: 5 });
    expect(blocker.position).toEqual({ x: 3, y: 5 });
    // The displaced archer polls next: forward cell holds the melee that just
    // passed — a ranged MOVER never initiates, so it queues (no ping-pong).
    const reverse = advance(blocker, world, {
      goals: [enemy.position],
      approachToward: enemy.position,
      excludeUnitId: enemy.id,
      maxCells: 1,
    });
    expect(reverse).toBeNull();
  });

  it('chain jam: ONE hop per swap window — the reserved partner refuses the second swap', () => {
    // The observed 56c2 bug: instant flips + a free-idle partner let an aMM
    // column double-swap to MMa within one tick. Now: while M1's swap is
    // PRE-FLIP, the archer is reserved (isPreFlipSwapPartner) and M2 queues;
    // only after the flip does the next hop propose.
    const { world, units } = scene([
      { team: 'player', x: 2, y: 5 }, // M2 (rear)
      { team: 'player', x: 3, y: 5 }, // M1
      { team: 'player', x: 4, y: 5, range: 3 }, // R (front)
      { team: 'enemy', x: 8, y: 5 },
      ...corridorSpecs(5),
    ]);
    const [m2, m1, r, enemy] = units;
    const intent = {
      goals: [enemy!.position],
      approachToward: enemy!.position,
      excludeUnitId: enemy!.id,
      maxCells: 1,
    };
    // Poll M1: proposes the swap; World would seat it in flight — mirror that.
    const p1 = advance(m1!, world, intent);
    expect(p1!.action.id).toBe('swap');
    const total = p1!.phases.reduce((s, p) => s + p.ticks, 0);
    m1!.activeAction = {
      action: p1!.action,
      startTick: world.currentTick,
      finishTick: world.currentTick + total,
      phases: p1!.phases,
    };
    p1!.action.start(m1!, world);
    // Mid-window: nobody has moved, and M2's probe refuses the reserved archer.
    expect(m1!.position).toEqual({ x: 3, y: 5 });
    expect(r!.position).toEqual({ x: 4, y: 5 });
    expect(advance(m2!, world, intent)).toBeNull();
    // The flip lands; the window closes.
    p1!.action.applyEffect!(m1!, world, 0);
    m1!.activeAction = null;
    expect(m1!.position).toEqual({ x: 4, y: 5 });
    expect(r!.position).toEqual({ x: 3, y: 5 });
    // Only NOW does the second hop propose: R files one more cell rearward.
    const p2 = advance(m2!, world, intent);
    expect(p2!.action.id).toBe('swap');
    p2!.action.start(m2!, world);
    p2!.action.applyEffect!(m2!, world, 0);
    expect(m2!.position).toEqual({ x: 3, y: 5 });
    expect(r!.position).toEqual({ x: 2, y: 5 }); // the archer filed to the rear
  });
});
