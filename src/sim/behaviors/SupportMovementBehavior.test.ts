import { describe, it, expect } from 'vitest';
import { SupportMovementBehavior } from './SupportMovementBehavior';
import { MoveAction } from '../actions/MoveAction';
import { SwapAction } from '../actions/SwapAction';
import { World } from '../World';
import { spawnRubble } from '../environment';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import { SIM } from '../../config/sim';
import type { ActionProposal } from '../Action';
import type { GameEvents } from '../../core/events';

/**
 * E7.B — SupportMovementBehavior decision-ladder tests. The heal-range and
 * panic-range expectations derive from the unit's `derived.attackRange` and
 * `SIM.healerPanicRangeCells` (wiring convention) so a config tweak can't
 * silently break the geometry.
 */

const HEAL_RANGE = 3;
const PANIC = SIM.healerPanicRangeCells;
const FOLLOW = SIM.healerFollowGapCells;

const HEALER_STATS: UnitStats = {
  constitution: 20, strength: 0, ranged: 0, magic: 8, luck: 0, defense: 0, precision: 5, evasion: 5, speed: 6, mobility: 5, power: 1,
};
const COMBATANT_STATS: UnitStats = {
  constitution: 20, strength: 6, ranged: 0, magic: 0, luck: 0, defense: 0, precision: 5, evasion: 5, speed: 5, mobility: 5, power: 1,
};

function makeUnit(
  id: number,
  team: Team,
  pos: { x: number; y: number },
  opts: { archetype?: UnitArchetype; range?: number; hp?: number } = {},
): Unit {
  const archetype = opts.archetype ?? 'mercenary';
  const stats = archetype === 'healer' ? HEALER_STATS : COMBATANT_STATS;
  const u = new Unit({
    id, team, archetype,
    glyph: archetype === 'healer' ? 'h' : 'M',
    stats, derived: deriveStats(stats, opts.range ?? 1), position: pos,
  });
  if (opts.hp !== undefined) u.currentHp = opts.hp;
  return u;
}

function makeHealer(pos: { x: number; y: number }, hp?: number): Unit {
  return makeUnit(1, 'player', pos, {
    archetype: 'healer',
    range: HEAL_RANGE,
    ...(hp !== undefined ? { hp } : {}),
  });
}

function world(units: Unit[]): World {
  const w = new World(new EventBus<GameEvents>(), new RNG(1));
  w.units.push(...units);
  return w;
}

/** A neutral wall unit at `pos` (the GP5 swap tests need real chokepoints —
 *  the bare test worlds have none). Only its team + position matter to the
 *  movement code. */
function makeWall(id: number, pos: { x: number; y: number }): Unit {
  return new Unit({
    id, team: 'neutral', archetype: 'mercenary',
    glyph: '#', stats: COMBATANT_STATS,
    derived: deriveStats(COMBATANT_STATS, 1), position: pos,
  });
}

/** Walls lining y±1 over an x-span → a 1-wide horizontal corridor at row `y`. */
function corridorWalls(y: number, x0: number, x1: number): Unit[] {
  const walls: Unit[] = [];
  let id = 100;
  for (let x = x0; x <= x1; x++) {
    walls.push(makeWall(id++, { x, y: y - 1 }), makeWall(id++, { x, y: y + 1 }));
  }
  return walls;
}

function dest(p: ActionProposal): { x: number; y: number } {
  return (p.action as MoveAction).toData().to;
}

function cheb(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

describe('SupportMovementBehavior', () => {
  it('waits when a wounded ally is already in heal range (lets heal_ally fire)', () => {
    // §44b — the in-heal-range hold is a first-class wait proposal (score 1);
    // a ready heal_ally at 10 still pre-empts it in the selector.
    const healer = makeHealer({ x: 5, y: 5 });
    const wounded = makeUnit(2, 'player', { x: 5, y: 5 + HEAL_RANGE }, { hp: 5 });
    expect(new SupportMovementBehavior().proposeAction(healer, world([healer, wounded]))?.action.id).toBe('wait');
  });

  it('waits when only the healer itself is hurt (self-heal in range)', () => {
    const healer = makeHealer({ x: 5, y: 5 }, /* hp */ 5);
    expect(new SupportMovementBehavior().proposeAction(healer, world([healer]))?.action.id).toBe('wait');
  });

  it('panic-retreats (score 5) from a too-close enemy when nothing is healable', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    const enemy = makeUnit(2, 'enemy', { x: 5, y: 5 + PANIC }, {}); // exactly at panic range
    const proposal = new SupportMovementBehavior().proposeAction(healer, world([healer, enemy]));
    expect(proposal).not.toBeNull();
    expect(proposal!.score).toBe(5);
    expect(cheb(dest(proposal!), enemy.position)).toBeGreaterThan(cheb(healer.position, enemy.position));
  });

  it('does not retreat from an enemy just beyond panic range (and idles if nothing to do)', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    const enemy = makeUnit(2, 'enemy', { x: 5, y: 5 + PANIC + 1 }, {});
    // No allies, no wounded → nothing to approach/follow → idle.
    expect(new SupportMovementBehavior().proposeAction(healer, world([healer, enemy]))).toBeNull();
  });

  it('retreat outranks approaching a wounded ally', () => {
    // Enemy to the north (in panic range); wounded ally also north but far
    // out of heal range. Approaching the ally would step TOWARD the enemy;
    // retreat must win and step away (south).
    const healer = makeHealer({ x: 5, y: 5 });
    const enemy = makeUnit(2, 'enemy', { x: 5, y: 5 - PANIC }, {});
    const wounded = makeUnit(3, 'player', { x: 5, y: 0 }, { hp: 5 });
    const proposal = new SupportMovementBehavior().proposeAction(
      healer,
      world([healer, enemy, wounded]),
    );
    expect(proposal!.score).toBe(5);
    expect(cheb(dest(proposal!), enemy.position)).toBeGreaterThan(cheb(healer.position, enemy.position));
  });

  it('approaches the nearest wounded ally (score 1) when no enemy is near', () => {
    const healer = makeHealer({ x: 1, y: 1 });
    const wounded = makeUnit(2, 'player', { x: 1, y: 9 }, { hp: 5 }); // far, out of range
    const proposal = new SupportMovementBehavior().proposeAction(healer, world([healer, wounded]));
    expect(proposal!.score).toBe(1);
    expect(cheb(dest(proposal!), wounded.position)).toBeLessThan(cheb(healer.position, wounded.position));
  });

  it('trails toward the allies CENTROID (score 1), not an individual ally', () => {
    // Nearest ally is one cell WEST; a second ally is far EAST, so the
    // centroid sits east of the healer. A centroid anchor steps EAST (toward
    // the average); a nearest-ally anchor would step WEST onto its neighbor.
    const healer = makeHealer({ x: 5, y: 5 });
    const nearWest = makeUnit(2, 'player', { x: 4, y: 5 }); // full HP, dist 1
    const farEast = makeUnit(3, 'player', { x: 10, y: 5 }); // full HP, dist 5
    const centroid = { x: 7, y: 5 }; // round((4+10)/2)=7
    const proposal = new SupportMovementBehavior().proposeAction(
      healer,
      world([healer, nearWest, farEast]),
    );
    expect(proposal!.score).toBe(1);
    expect(dest(proposal!).x).toBeGreaterThan(healer.position.x); // east, toward centroid
    expect(cheb(dest(proposal!), centroid)).toBeLessThan(cheb(healer.position, centroid));
  });

  it('idles when within healerFollowGapCells of the allies centroid', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    // Single ally exactly FOLLOW cells away → centroid == ally, gap == FOLLOW
    // (not strictly greater) → in formation, idle.
    const ally = makeUnit(2, 'player', { x: 5, y: 5 + FOLLOW });
    expect(new SupportMovementBehavior().proposeAction(healer, world([healer, ally]))).toBeNull();
  });

  it('idles when alone', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    expect(new SupportMovementBehavior().proposeAction(healer, world([healer]))).toBeNull();
  });
});

/**
 * GP5 #5 — the yield rule. When the healer sits on the only cell a boxed ally
 * can advance through (a 1-wide corridor, no lateral escape), it SWAPS places
 * with that ally so the column drains instead of deadlocking. The swap is the
 * only thing that can resolve a single-file jam where the support can't pass
 * its own fighters; see the GP4 HANDOFF entry for the live repro it clears.
 */
describe('SupportMovementBehavior — GP5 chokepoint yield (swap)', () => {
  function swapData(p: ActionProposal): { from: { x: number; y: number }; to: { x: number; y: number }; otherId: number } {
    return (p.action as SwapAction).toData();
  }

  it('swaps with a boxed ally when it is the ally\'s only way forward (1-wide corridor)', () => {
    // y=5 corridor walled at y=4/y=6. Ally (west) wants the enemy (east); the
    // healer sits between them on the ally's sole forward cell → swap.
    const healer = makeHealer({ x: 5, y: 5 });
    const ally = makeUnit(2, 'player', { x: 4, y: 5 });
    const enemy = makeUnit(3, 'enemy', { x: 8, y: 5 });
    const w = world([healer, ally, enemy, ...corridorWalls(5, 3, 8)]);

    const p = new SupportMovementBehavior().proposeAction(healer, w);
    expect(p).not.toBeNull();
    expect(p!.action).toBeInstanceOf(SwapAction);
    expect(p!.score).toBe(1);
    const data = swapData(p!);
    expect(data.from).toEqual(healer.position); // healer retreats onto…
    expect(data.to).toEqual(ally.position); // …the ally's cell (ally advances onto the healer's)
    expect(data.otherId).toBe(ally.id);
  });

  it('swaps from the panic-boxed branch (enemy adjacent, no retreat cell)', () => {
    // Enemy one cell ahead in the corridor → panic fires, but the healer is
    // boxed (no cell increases distance) → it must fall through to the swap.
    const healer = makeHealer({ x: 5, y: 5 });
    const ally = makeUnit(2, 'player', { x: 4, y: 5 });
    const enemy = makeUnit(3, 'enemy', { x: 6, y: 5 });
    const w = world([healer, ally, enemy, ...corridorWalls(5, 3, 7)]);

    const p = new SupportMovementBehavior().proposeAction(healer, w);
    expect(p).not.toBeNull();
    expect(p!.action).toBeInstanceOf(SwapAction);
    expect(swapData(p!).otherId).toBe(ally.id);
  });

  it('does NOT offer a swap to a mid-move ally (56a — the in-flight partner gate)', () => {
    // The corridor-swap shape, but the ally has an IN-FLIGHT move (logical
    // position holds at (4,5) until the §36b flip, so pre-56a it read as
    // adjacent-and-blocked and the healer proposed a doomed swap — the latent
    // GP5 hazard). With the gate the healer abstains instead.
    const healer = makeHealer({ x: 5, y: 5 });
    const ally = makeUnit(2, 'player', { x: 4, y: 5 });
    const enemy = makeUnit(3, 'enemy', { x: 8, y: 5 });
    const w = world([healer, ally, enemy, ...corridorWalls(5, 3, 8)]);
    const durationTicks = 8;
    ally.activeAction = {
      action: new MoveAction(ally.position, { x: 3, y: 5 }, durationTicks),
      startTick: w.currentTick,
      finishTick: w.currentTick + durationTicks,
      phases: [
        { phase: 'travel', ticks: 4 },
        { phase: 'impact', ticks: 0 },
        { phase: 'recovery', ticks: 4 },
      ],
    };
    w.claimCell({ x: 3, y: 5 }, ally.id);

    expect(new SupportMovementBehavior().proposeAction(healer, w)).toBeNull();
  });

  it('does NOT swap in the open — the ally has another way forward', () => {
    // Same units, NO walls: the ally can route around the healer, so it isn't
    // strictly blocked and the healer just idles.
    const healer = makeHealer({ x: 5, y: 5 });
    const ally = makeUnit(2, 'player', { x: 4, y: 5 });
    const enemy = makeUnit(3, 'enemy', { x: 8, y: 5 });
    expect(
      new SupportMovementBehavior().proposeAction(healer, world([healer, ally, enemy])),
    ).toBeNull();
  });
});

/**
 * GP5.2 #4 — navigable-snap. The allies' rounded centroid can land on an
 * impassable cell between them; the healer must snap the anchor to the nearest
 * navigable tile and keep trailing rather than findPath()→[] and stall.
 */
describe('SupportMovementBehavior — GP5.2 centroid navigable-snap', () => {
  it('snaps the anchor off an impassable centroid cell and still trails', () => {
    // Two allies astride a wall → their centroid rounds onto the wall cell
    // (round((7+9)/2)=8, round(5)=5). Pre-snap the healer would path to the
    // wall, get [], and idle; post-snap it steps toward the nearest open tile.
    const healer = makeHealer({ x: 5, y: 5 });
    const allyW = makeUnit(2, 'player', { x: 7, y: 5 });
    const allyE = makeUnit(3, 'player', { x: 9, y: 5 });
    const wall = makeWall(200, { x: 8, y: 5 });
    const p = new SupportMovementBehavior().proposeAction(
      healer,
      world([healer, allyW, allyE, wall]),
    );
    expect(p).not.toBeNull();
    expect(p!.action).toBeInstanceOf(MoveAction);
    expect(dest(p!).x).toBeGreaterThan(healer.position.x); // trails toward the pack, not stuck
  });

  it('is a no-op when the centroid is already navigable (unchanged trail)', () => {
    // Bare world, centroid on open floor → snap returns it unchanged, healer
    // steps east toward it exactly as before GP5.2.
    const healer = makeHealer({ x: 5, y: 5 });
    const allyW = makeUnit(2, 'player', { x: 7, y: 5 });
    const allyE = makeUnit(3, 'player', { x: 9, y: 5 });
    const p = new SupportMovementBehavior().proposeAction(
      healer,
      world([healer, allyW, allyE]),
    );
    expect(p).not.toBeNull();
    expect(dest(p!).x).toBeGreaterThan(healer.position.x);
  });
});

/**
 * 43-pre — the healer's blocker sets must cover a multi-tile neutral's WHOLE
 * footprint (`cellsOccupiedBy`), not just its canonical corner. Corner-only
 * sets let `stepToward` route (and step!) onto rubble BODY cells, and let the
 * GP5.2 navigable-snap accept an in-rubble centroid as a valid trail anchor.
 * Unit ids here start at 50 — `spawnRubble` draws from the world's own id
 * counter (from 1), and a collision makes `stepToward` skip the rubble as
 * "itself".
 */
describe('SupportMovementBehavior — multi-tile neutral footprints (43-pre)', () => {
  const RUBBLE_CORNER = { x: 3, y: 3 };
  const RUBBLE_CELLS = [
    { x: 3, y: 3 }, { x: 4, y: 3 },
    { x: 3, y: 4 }, { x: 4, y: 4 },
  ];

  it('stepToward never proposes a step onto a rubble BODY cell', () => {
    // Wounded ally straight across a 2x2 rubble. Corner-only blocking routed
    // the healer THROUGH the body row and proposed the overlap step (3,4).
    const healer = makeUnit(50, 'player', { x: 2, y: 4 }, { archetype: 'healer', range: HEAL_RANGE });
    const wounded = makeUnit(51, 'player', { x: 7, y: 4 }, { hp: 5 });
    const w = world([healer, wounded]);
    spawnRubble(w, RUBBLE_CORNER, 2);
    const p = new SupportMovementBehavior().proposeAction(healer, w);
    expect(p).not.toBeNull(); // a route AROUND the rubble exists
    expect(RUBBLE_CELLS).not.toContainEqual(dest(p!));
  });

  it('the trail anchor snaps OFF a rubble BODY cell (GP5.2 snap, footprint-aware)', () => {
    // Allies astride the rubble → centroid (4,4) is a BODY cell (the corner
    // (3,3) was already handled by GP5.2). Corner-only navigability accepted
    // (4,4) as the anchor; the healer at (3,5) sat "in formation" against a
    // phantom anchor inside the rubble and idled. Footprint-aware, the anchor
    // snaps to real ground and the healer keeps trailing.
    const healer = makeUnit(50, 'player', { x: 3, y: 5 }, { archetype: 'healer', range: HEAL_RANGE });
    const allyW = makeUnit(51, 'player', { x: 1, y: 4 });
    const allyE = makeUnit(52, 'player', { x: 7, y: 4 });
    const w = world([healer, allyW, allyE]);
    spawnRubble(w, RUBBLE_CORNER, 2);
    const p = new SupportMovementBehavior().proposeAction(healer, w);
    expect(p).not.toBeNull(); // buggy code abstained (`no_goal`) here
    expect(p!.action).toBeInstanceOf(MoveAction);
    expect(RUBBLE_CELLS).not.toContainEqual(dest(p!));
  });
});

/**
 * 44-pre-a — the panic retreat's occupied set must cover a multi-tile
 * neutral's WHOLE footprint (the §35 `occupiedCells` builder), not just its
 * §39 corner. Corner-only, a rubble's body cells read as free retreat cells:
 * the panicking healer's step onto one was a doomed proposal §35b's
 * destination gate then aborted (`unit:moveAborted`, no overlap), wasting the
 * tick it should have spent yielding/holding.
 */
describe('SupportMovementBehavior — panic retreat vs multi-tile footprints (44-pre-a)', () => {
  it('stepAwayFrom never retreats onto a rubble BODY cell (abstains when boxed by the body)', () => {
    // Enemy due south at exactly panic range; the only distance-increasing
    // cells are the northern ring (3,4) (4,4) (5,4). A 2×2 rubble at corner
    // (3,3) covers (3,4) (4,4) with BODY cells (the corner (3,3) is off the
    // ring, so a corner-only set blocks neither) and a wall takes (5,4).
    // Footprint-aware there is NO retreat cell → boxed → yield path → null
    // (no blocked ally). Corner-only proposed the overlap step onto (3,4).
    const healer = makeUnit(50, 'player', { x: 4, y: 5 }, { archetype: 'healer', range: HEAL_RANGE });
    const enemy = makeUnit(51, 'enemy', { x: 4, y: 5 + PANIC });
    const wall = makeWall(60, { x: 5, y: 4 });
    const w = world([healer, enemy, wall]);
    spawnRubble(w, { x: 3, y: 3 }, 2);
    expect(new SupportMovementBehavior().proposeAction(healer, w)).toBeNull();
  });
});
