import { describe, it, expect } from 'vitest';
import { MovementBehavior } from './MovementBehavior';
import { hasLineOfSight } from '../LineOfSight';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { spawnHalfCover } from '../environment';
import { deriveStats, inertDerived } from '../stats';
import { ARCHETYPE_CONFIG, minRangeForArchetype, rangeForArchetype } from '../archetypes';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import type { StatusEffect } from '../statusEffects';
import { MoveAction } from '../actions/MoveAction';
import { WAIT_ACTION_ID } from '../actions/WaitAction';
import { findOverlappingCells } from '../occupancy';

describe('MovementBehavior', () => {
  it('does not move on the first tick when already in attack range', () => {
    const { world, units, moves } = scene([
      { team: 'player', x: 5, y: 5, attackRange: 1 },
      { team: 'enemy', x: 6, y: 5, inert: true },
    ]);
    world.tick();
    expect(units[0]!.position).toEqual({ x: 5, y: 5 });
    expect(moves).toHaveLength(0);
  });

  it('does not move when no enemies exist', () => {
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 5, y: 5 },
    ]);
    world.tick();
    expect(units[0]!.position).toEqual({ x: 0, y: 0 });
    expect(moves).toHaveLength(0);
  });

  it('steps one cell toward the target, emits unit:moved with correct fields, and sets the cooldown', () => {
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 4 },
      { team: 'enemy', x: 5, y: 0, inert: true },
    ]);

    world.tick();

    // §36b — `unit:moved` fires at start (the renderer lerp spans the window),
    // but the logical step is deferred to the 50% flip (floor(4*0.5)=2 ticks in).
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({
      unitId: units[0]!.id,
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      durationTicks: 4,
    });
    expect(units[0]!.position).toEqual({ x: 0, y: 0 }); // not yet flipped
    world.tick();
    world.tick(); // offset 2 → the flip
    expect(units[0]!.position).toEqual({ x: 1, y: 0 });
  });

  it('waits exactly moveCooldownTicks between consecutive moves', () => {
    // Action ticks must be N apart so the sprite lerp (durationTicks=N)
    // dovetails into the next move with no idle frame in between.
    const { world, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 3 },
      { team: 'enemy', x: 8, y: 0, inert: true },
    ]);

    world.tick(); // tick 1: moves
    expect(moves).toHaveLength(1);
    world.tick(); // tick 2: cooldown 2 → 1
    world.tick(); // tick 3: cooldown 1 → 0
    expect(moves).toHaveLength(1);
    world.tick(); // tick 4: cooldown 0 → moves
    expect(moves).toHaveLength(2);
  });

  it('retries every tick while blocked (no cooldown reset)', () => {
    const wall: SceneUnit[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        wall.push({ team: 'player', x: 5 + dx, y: 5 + dy, inert: true });
      }
    }
    const { world, units, moves } = scene([
      { team: 'player', x: 5, y: 5, attackRange: 1, moveCooldownTicks: 5 },
      ...wall,
      { team: 'enemy', x: 0, y: 0, inert: true },
    ]);

    for (let i = 0; i < 5; i++) world.tick();
    expect(moves).toHaveLength(0);
    expect(units[0]!.position).toEqual({ x: 5, y: 5 });
  });

  it('moves toward a target whose attack-range neighbors are all walls + allies (C1d Labyrinth regression)', () => {
    // C1d Labyrinth softlock: pre-fix MovementBehavior picked a goal cell
    // within attackRange of target, then pathed there. When every in-range
    // cell was a wall (e.g. row 8 of the Labyrinth) or an ally (rest of
    // the team packed on the spawn row), the goal-picker returned null
    // and the unit froze — even though target was reachable through a
    // diagonal squeeze. The fix paths to target's cell directly, with
    // target excluded from blockers.
    //
    // Setup on a 5x5 grid:
    //   row 0: P . . . .       <- player at (0,0)
    //   row 1: . . . . .
    //   row 2: . . . . .
    //   row 3: # # . # #       <- walls at x=0,1,3,4 ; gap at (2,3)
    //   row 4: . . A T A       <- allies at (2,4),(4,4) ; target T at (3,4)
    // Target T's 5 in-bounds neighbors are: (2,3) wall, (3,3) wall,
    // (4,3) wall, (2,4) ally, (4,4) ally. All blocked → pre-fix freezes.
    // Post-fix steps from (0,0) toward (3,4) via (2,3).
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 1 },
      // Target first so it gets the lowest enemy id and wins the
      // chebyshev tie at distance 4 against the two allies.
      { team: 'enemy', x: 3, y: 4, inert: true },
      { team: 'enemy', x: 2, y: 4, inert: true },
      { team: 'enemy', x: 4, y: 4, inert: true },
      { team: 'player', x: 0, y: 3, inert: true },
      { team: 'player', x: 1, y: 3, inert: true },
      { team: 'player', x: 3, y: 3, inert: true },
      { team: 'player', x: 4, y: 3, inert: true },
    ]);

    world.tick();

    expect(moves).toHaveLength(1);
    // Step must approach (3,4). Pre-fix this would be 0 moves.
    const newPos = units[0]!.position;
    expect(newPos).not.toEqual({ x: 0, y: 0 });
    const distAfter = Math.max(Math.abs(newPos.x - 3), Math.abs(newPos.y - 4));
    expect(distAfter).toBeLessThan(4);
  });

  it('D6: paths AROUND a half-cover (pathfinding still treats it as a blocker)', () => {
    // Straight line player→enemy passes through (3,0); half-cover sits there.
    // Player should detour rather than walking through.
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 1 },
      { team: 'enemy', x: 5, y: 0, inert: true },
    ]);
    spawnHalfCover(world, { x: 3, y: 0 });

    world.tick();
    expect(moves).toHaveLength(1);
    // First step should be a valid neighbor of (0,0) other than (3,0).
    const newPos = units[0]!.position;
    expect(newPos).not.toEqual({ x: 3, y: 0 });
    // Chebyshev distance to (3,0) should be > 0 after one step (didn't land on it).
    const distToHC = Math.max(Math.abs(newPos.x - 3), Math.abs(newPos.y - 0));
    expect(distToHC).toBeGreaterThan(0);
  });

  it('D6: ranged unit with half-cover on the LOS line still abstains in-range (lets AttackBehavior fire)', () => {
    // The pre-D6 MovementBehavior treated half-cover as an LOS blocker,
    // so a ranged unit in range with a half-cover between it and target
    // would keep stepping forward (LOS-gated in-range abstain failed).
    // Post-D6 the LOS check ignores half-cover, so movement abstains and
    // AttackBehavior is free to fire.
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 5, moveCooldownTicks: 1 },
      { team: 'enemy', x: 4, y: 0, inert: true },
    ]);
    spawnHalfCover(world, { x: 2, y: 0 });

    world.tick();
    expect(moves).toHaveLength(0);
    expect(units[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it('E7.D: a unit whose ability ignores LOS abstains in-range even with a wall on the line', () => {
    // The catapult lobs an arcing shot over walls. In chebyshev range of the
    // target with a wall breaking LOS, a ranged/mage unit would keep pathing
    // forward to clear the wall (LOS-gated abstain fails) — but the catapult
    // has nothing to path around, so MovementBehavior abstains and lets the
    // shot fire.
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 6, moveCooldownTicks: 1, ignoresLos: true },
      { team: 'enemy', x: 4, y: 0, inert: true },
      { team: 'neutral', x: 2, y: 0, inert: true }, // wall on the LOS line
    ]);

    world.tick();
    expect(moves).toHaveLength(0);
    expect(units[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it('E7.D: a normal LOS-gated unit in the SAME spot keeps pathing to clear the wall', () => {
    // Contrast to the catapult case above: without an LOS-ignoring ability,
    // the in-range abstain requires line of sight, so the wall makes the unit
    // step forward for a clear shot. This pins that the abstain is genuinely
    // CONDITIONAL on the ability flag, not unconditionally dropped.
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 6, moveCooldownTicks: 1 },
      { team: 'enemy', x: 4, y: 0, inert: true },
      { team: 'neutral', x: 2, y: 0, inert: true }, // same wall on the LOS line
    ]);

    world.tick();
    expect(moves).toHaveLength(1);
    expect(units[0]!.position).not.toEqual({ x: 0, y: 0 });
  });

  it('two opposing units converge until adjacent, then stop', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 5, attackRange: 1, moveCooldownTicks: 1 },
      { team: 'enemy', x: 5, y: 5, attackRange: 1, moveCooldownTicks: 1 },
    ]);

    // Tick until they touch or we hit a cap.
    for (let i = 0; i < 20; i++) {
      world.tick();
      const dist = Math.max(
        Math.abs(units[0]!.position.x - units[1]!.position.x),
        Math.abs(units[0]!.position.y - units[1]!.position.y),
      );
      if (dist <= 1) break;
    }

    const finalDist = Math.max(
      Math.abs(units[0]!.position.x - units[1]!.position.x),
      Math.abs(units[0]!.position.y - units[1]!.position.y),
    );
    expect(finalDist).toBe(1);

    // Now they shouldn't move any further.
    const before = [units[0]!.position, units[1]!.position];
    for (let i = 0; i < 10; i++) world.tick();
    expect(units[0]!.position).toEqual(before[0]);
    expect(units[1]!.position).toEqual(before[1]);
  });

  it('E5.B: sidesteps to a free perpendicular cell when the forward step is occupied', () => {
    // Forced chokepoint along the bottom edge (row y=0): P must reach T at
    // (5,0); an ally sits on the only forward cell (1,0); row 1 is walled at
    // x=1..5 so the sole route to T runs east through the occupied (1,0)
    // (path[1] is occupied). The free perpendicular cell (0,1) only loops
    // back, so A* doesn't route through it — confirming this is the
    // path[1]-occupied case. Rather than abstain, the unit takes (0,1).
    //
    // (In open space A* simply routes around a soft-blocked ally, so the
    // sidestep is reserved for exactly this forced case.)
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 1 },
      { team: 'enemy', x: 5, y: 0, inert: true },
      { team: 'player', x: 1, y: 0, inert: true },
      ...[1, 2, 3, 4, 5].map((x): SceneUnit => ({ team: 'neutral', x, y: 1, inert: true })),
    ]);

    world.tick();
    expect(moves).toHaveLength(1);
    expect(units[0]!.position).toEqual({ x: 0, y: 1 });
  });

  it('E5.B: abstains (queues) when the forward step is occupied and no sidestep is free', () => {
    // Same chokepoint, but row 1 is fully walled (x=0..5) so neither
    // perpendicular cell is free. The unit falls back to abstaining —
    // corridor queueing, the pre-E5.B behavior, still emerges.
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 1 },
      { team: 'enemy', x: 5, y: 0, inert: true },
      { team: 'player', x: 1, y: 0, inert: true },
      ...[0, 1, 2, 3, 4, 5].map((x): SceneUnit => ({ team: 'neutral', x, y: 1, inert: true })),
    ]);

    world.tick();
    expect(moves).toHaveLength(0);
    expect(units[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it('GP4: a ranged unit in range but LOS-blocked repositions for a clear shot (does not charge)', () => {
    // Player ranged (range 6) is already in chebyshev range of the target, but
    // a wall on the straight line breaks LOS. Pre-GP4 it pathed toward the
    // target's cell (creeping at the wall); post-GP4 it paths to the nearest
    // cell with a clear shot and holds there.
    const wall = { x: 2, y: 0 };
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 6, moveCooldownTicks: 1 },
      { team: 'enemy', x: 4, y: 0, inert: true },
      { team: 'neutral', x: wall.x, y: wall.y, inert: true },
    ]);
    const target = units[1]!.position;

    // Tick generously so it settles into a firing slot (the abstain then holds).
    for (let i = 0; i < 15; i++) world.tick();

    const finalPos = units[0]!.position;
    expect(moves.length).toBeGreaterThan(0); // it repositioned
    expect(hasLineOfSight(finalPos, target, [wall])).toBe(true); // now it can shoot
    const dist = Math.max(Math.abs(finalPos.x - target.x), Math.abs(finalPos.y - target.y));
    expect(dist).toBeLessThanOrEqual(6); // still in range
    expect(dist).toBeGreaterThan(1); // held at standoff, didn't charge to melee
  });

  it('GP4: a catapult (LOS-ignoring) out of range approaches and holds at firing range', () => {
    // Guards the dropped `!ignoresLos` exclusion: the catapult now routes via
    // the acting-cell search (range-only), so it must still close to range and
    // stop, not stall or overrun.
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 6, moveCooldownTicks: 1, ignoresLos: true },
      { team: 'enemy', x: 10, y: 0, inert: true },
    ]);
    const target = units[1]!.position;

    for (let i = 0; i < 30; i++) world.tick();

    const finalPos = units[0]!.position;
    expect(moves.length).toBeGreaterThan(0);
    const dist = Math.max(Math.abs(finalPos.x - target.x), Math.abs(finalPos.y - target.y));
    expect(dist).toBeLessThanOrEqual(6); // reached firing range
    expect(dist).toBeGreaterThan(1); // and held there (didn't charge to point-blank)
  });
});

describe('MovementBehavior / tile objective (J1)', () => {
  function setTileObjective(world: World, cell: GridCoord): void {
    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'engage', target: { kind: 'tile', cell } },
    });
  }

  // A far, inert enemy parked at (11,11) keeps `checkBattleEnd` from declaring
  // an instant victory (a lone player team wins outright), without ever being
  // engageable: the player paths along y=0, so the Chebyshev distance to
  // (11,11) is always >= 11 — far past the leash, and the enemy is inert so it
  // never approaches. The unit therefore pursues the TILE uninterrupted.
  const farEnemy: SceneUnit = { team: 'enemy', x: 11, y: 11, inert: true };

  it('an unengaged unit paths toward the tile objective (an attractor)', () => {
    const { world, units, moves } = scene([
      { team: 'player', x: 8, y: 0, attackRange: 1, moveCooldownTicks: 1 },
      farEnemy,
    ]);
    setTileObjective(world, { x: 0, y: 0 });
    for (let i = 0; i < 6; i++) world.tick();
    expect(moves.length).toBeGreaterThan(0);
    // Closer to the rally cell (0,0) than the start (Chebyshev == max(x, y)).
    const pos = units[0]!.position;
    expect(Math.max(pos.x, pos.y)).toBeLessThan(8);
  });

  it('reaches the rally cell, then holds (persist-until-cleared, no jitter)', () => {
    const { world, units, moves } = scene([
      { team: 'player', x: 4, y: 0, attackRange: 1, moveCooldownTicks: 1 },
      farEnemy,
    ]);
    setTileObjective(world, { x: 0, y: 0 });
    for (let i = 0; i < 20; i++) world.tick();
    expect(units[0]!.position).toEqual({ x: 0, y: 0 });
    const movesAtArrival = moves.length;
    for (let i = 0; i < 10; i++) world.tick();
    expect(moves.length).toBe(movesAtArrival); // parked on the cell, no further steps
  });

  it('a wall ON the rally cell does NOT freeze the unit (best-effort: paths as close as it can)', () => {
    // J3 playtest fix: right-clicking an unpathable tile set a tile objective on
    // an unreachable cell. A single unreachable goal → findPath [] → no step,
    // and the objective suppresses the nearest-enemy fallback, so the whole team
    // idled at spawn. Best-effort routing approaches the wall instead.
    const { world, units, moves } = scene([
      { team: 'player', x: 8, y: 0, attackRange: 1, moveCooldownTicks: 1 },
      { team: 'neutral', x: 0, y: 0, inert: true }, // a wall ON the rally cell
      farEnemy,
    ]);
    setTileObjective(world, { x: 0, y: 0 });
    for (let i = 0; i < 6; i++) world.tick();
    expect(moves.length).toBeGreaterThan(0); // moved — did NOT freeze
    expect(units[0]!.position.x).toBeLessThan(8); // closer to the walled rally cell
  });

  it('an adjacent enemy interrupts tile pursuit (engaged → fights, does not walk on to the tile)', () => {
    // The player is pursuing a far tile but an enemy is in engage range (cheby
    // 1). updateTarget preempts to that enemy; MovementBehavior then abstains
    // (in range), so the unit holds + fights instead of marching past it.
    const { world, units, moves } = scene([
      { team: 'player', x: 6, y: 6, attackRange: 1, moveCooldownTicks: 1 },
      { team: 'enemy', x: 7, y: 6, inert: true }, // adjacent → engageable
    ]);
    setTileObjective(world, { x: 0, y: 0 });
    for (let i = 0; i < 6; i++) world.tick();
    expect(units[0]!.targetId).toBe(units[1]!.id);
    expect(moves).toHaveLength(0); // engaged + in range → no movement toward the tile
    expect(units[0]!.position).toEqual({ x: 6, y: 6 });
  });
});

describe('MovementBehavior / hold (O2)', () => {
  function setHold(world: World): void {
    world.enqueueCommand({ kind: 'setObjective', team: 'player', objective: { mode: 'hold' } });
  }

  it('a held unit does NOT pursue an enemy out of reach (acts in place)', () => {
    // Without hold this unit would step toward the enemy every tick (see the
    // "steps one cell toward the target" test). Under hold it stays put.
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 1 },
      { team: 'enemy', x: 5, y: 0, inert: true },
    ]);
    setHold(world);
    for (let i = 0; i < 6; i++) world.tick();
    expect(moves).toHaveLength(0);
    expect(units[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it('a held ranged unit does NOT reposition to clear LOS for a blocked shot (the guard)', () => {
    // Mirror the "ranged unit steps forward to clear a wall for the shot" test
    // above — the exact case where hold's MovementBehavior guard is
    // load-bearing: there the unit MOVES to get LOS; under hold it must hold
    // position (it shoots only if it already has the shot, never moves to make
    // one).
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 6, moveCooldownTicks: 1 },
      { team: 'enemy', x: 4, y: 0, inert: true },
      { team: 'neutral', x: 2, y: 0, inert: true }, // wall on the LOS line
    ]);
    setHold(world);
    for (let i = 0; i < 6; i++) world.tick();
    expect(moves).toHaveLength(0);
    expect(units[0]!.position).toEqual({ x: 0, y: 0 });
  });
});

describe('MovementBehavior / focus tile (O3, leashAtNearest default)', () => {
  function setFocusTile(world: World, cell: GridCoord): void {
    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'focus', target: { kind: 'tile', cell } },
    });
  }

  it('far from the tile: an adjacent enemy is IGNORED — the unit keeps marching (the full-preempt vs engage)', () => {
    // The mirror of the J1 "an adjacent enemy interrupts tile pursuit" test:
    // there engage stops to fight the cheby-1 enemy. Under FOCUS while still far
    // from the tile (cheby 6 > leash) the unit eats the hit and marches on.
    const { world, units, moves } = scene([
      { team: 'player', x: 6, y: 6, attackRange: 1, moveCooldownTicks: 1 },
      { team: 'enemy', x: 7, y: 6, inert: true }, // adjacent → would interrupt under engage
    ]);
    setFocusTile(world, { x: 0, y: 0 });
    for (let i = 0; i < 6; i++) world.tick();
    expect(units[0]!.targetId).toBeNull(); // ignored the adjacent enemy
    expect(moves.length).toBeGreaterThan(0); // kept moving toward the rally cell
    expect(Math.max(units[0]!.position.x, units[0]!.position.y)).toBeLessThan(6);
  });

  it('once at the tile: engages locally — an adjacent enemy interrupts (acts like engage there)', () => {
    const { world, units, moves } = scene([
      { team: 'player', x: 1, y: 1, attackRange: 1, moveCooldownTicks: 1 }, // ON the tile
      { team: 'enemy', x: 2, y: 1, inert: true }, // adjacent → engageable locally
    ]);
    setFocusTile(world, { x: 1, y: 1 });
    for (let i = 0; i < 6; i++) world.tick();
    expect(units[0]!.targetId).toBe(units[1]!.id); // engageLocal picked the enemy
    expect(moves).toHaveLength(0); // in range → fights in place, no march
    expect(units[0]!.position).toEqual({ x: 1, y: 1 });
  });
});

describe('MovementBehavior / minRange kiting (O4)', () => {
  const cheb = (a: GridCoord, b: GridCoord) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  // Config-derived so these hold at whatever floor the bow ships with.
  const FLOOR = minRangeForArchetype('archer');
  const REACH = rangeForArchetype('archer');

  it('a ranged unit with an enemy INSIDE minRange kites OUT to the band', () => {
    // An enemy one cell inside the floor: the unit backs away to re-establish
    // standoff instead of holding point-blank (the anti-blob fall-back).
    const { world, units, moves } = scene([
      { team: 'player', x: 5, y: 5, archetype: 'archer', attackRange: REACH, moveCooldownTicks: 1 },
      { team: 'enemy', x: 5 + (FLOOR - 1), y: 5, inert: true },
    ]);
    expect(cheb(units[0]!.position, units[1]!.position)).toBe(FLOOR - 1); // starts inside
    for (let i = 0; i < 5; i++) world.tick();
    expect(moves.length).toBeGreaterThan(0); // it repositioned
    expect(cheb(units[0]!.position, units[1]!.position)).toBeGreaterThanOrEqual(FLOOR); // out to the band
  });

  it('a ranged unit already at the floor holds (in band → abstains, no creep)', () => {
    const { world, units, moves } = scene([
      { team: 'player', x: 5, y: 5, archetype: 'archer', attackRange: REACH, moveCooldownTicks: 1 },
      { team: 'enemy', x: 5 + FLOOR, y: 5, inert: true }, // exactly at the floor → in band
    ]);
    for (let i = 0; i < 5; i++) world.tick();
    expect(moves).toHaveLength(0);
    expect(units[0]!.position).toEqual({ x: 5, y: 5 });
  });
});

describe('MovementBehavior / corridor kite-pin (Qb #3)', () => {
  const cheb = (a: GridCoord, b: GridCoord) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const FLOOR = minRangeForArchetype('archer');
  const REACH = rangeForArchetype('archer');

  /** Cells shared by more than one non-neutral (combatant) unit. */
  function overlappingCells(world: World): string[] {
    const counts = new Map<string, number>();
    for (const u of world.units) {
      if (u.team === 'neutral') continue;
      const k = `${u.position.x},${u.position.y}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts].filter(([, n]) => n > 1).map(([k]) => k);
  }

  it('an archer pinned in a 1-wide corridor never steps ONTO the hostile (no same-cell overlap)', () => {
    // The reported Qb #3 repro. Corridor along y=5 (rows 4 and 6 walled). The
    // archer is sandwiched: a friendly behind sits on the ONLY retreat cell, the
    // hostile ahead sits one cell in — INSIDE minRange, so the archer can neither
    // fire (the band gates firing too, strikes.ts) nor hold; it wants to kite OUT
    // but the walls kill the perpendicular sidestep and the friendly blocks the
    // back-step. Pre-fix, the target-cell anti-freeze fallback (the target is
    // soft-EXCLUDED from the step-collision set so findPath always has a goal)
    // walked the archer straight onto the hostile's cell — a real same-cell overlap.
    const walls: SceneUnit[] = [];
    for (let x = 2; x <= 8; x++) {
      walls.push({ team: 'neutral', x, y: 4, inert: true });
      walls.push({ team: 'neutral', x, y: 6, inert: true });
    }
    const { world, units } = scene([
      { team: 'player', x: 5, y: 5, archetype: 'archer', attackRange: REACH, moveCooldownTicks: 1 },
      { team: 'enemy', x: 5 + (FLOOR - 1), y: 5, inert: true }, // hostile, one cell inside the floor
      { team: 'player', x: 4, y: 5, inert: true }, // friendly on the only retreat cell
      ...walls,
    ]);
    const archer = units[0]!;
    const hostile = units[1]!;
    expect(cheb(archer.position, hostile.position)).toBe(FLOOR - 1); // starts inside the floor

    for (let i = 0; i < 10; i++) {
      world.tick();
      // The invariant: no two combatants share a cell at a tick boundary.
      expect(overlappingCells(world)).toEqual([]);
    }
    // And specifically: it never marched onto the hostile (the corridor queues it).
    expect(archer.position).not.toEqual(hostile.position);
  });
});

describe('MovementBehavior / §36b: a pursuer holds for a target arriving into its band', () => {
  it('a melee unit waits when its target CLAIMS a cell in its firing band (no kite-pin sidestep)', () => {
    // M targets E. E is mid-move toward M: logically still out of melee range, but
    // its destination CLAIM sits on the cell ADJACENT to M. Pre-fix M read itself
    // out of range and tried to advance — the forward step (E's claimed cell) was
    // blocked, firing the sidestep/detour. Now M reads the claim as "my target is
    // arriving adjacent" and holds; it strikes when E lands (the §36b locomotion
    // dual of the claim's pathing-block). Driven at the behavior level: inject the
    // claim directly, so the abstain is pinned independent of E's move timing.
    const { world, units } = scene([
      { team: 'player', x: 5, y: 5, attackRange: 1, moveCooldownTicks: 1 },
      { team: 'enemy', x: 7, y: 5, inert: true }, // logical pos 2 cells off → out of melee
    ]);
    const [m, e] = units as [Unit, Unit];
    m.targetId = e.id; // committed pursuit
    const mover = new MovementBehavior();

    // No claim yet → out of range → M proposes a step toward E (the control).
    expect(mover.proposeAction(m, world)?.action).toBeInstanceOf(MoveAction);

    // E claims the cell ADJACENT to M (its in-flight destination) → M HOLDS
    // (§44b: the hold is a wait proposal, not a null).
    world.claimCell({ x: 6, y: 5 }, e.id);
    expect(mover.proposeAction(m, world)?.action.id).toBe(WAIT_ACTION_ID);

    // Releasing the claim (e.g. the move aborted) resumes pursuit.
    world.releaseClaim({ x: 6, y: 5 });
    expect(mover.proposeAction(m, world)?.action).toBeInstanceOf(MoveAction);
  });

  it('does NOT over-fire: a claim INSIDE a ranged unit’s minRange still kites (band-respecting)', () => {
    // The hold only triggers for a claim in the firing BAND [minRange, attackRange].
    // A ranged unit whose target is arriving INSIDE its minRange must still kite out,
    // not freeze — a claim short of the floor must NOT abstain (the `inFiringBand`
    // floor check is what guarantees it).
    const FLOOR = minRangeForArchetype('archer');
    const REACH = rangeForArchetype('archer');
    expect(FLOOR).toBeGreaterThan(1); // the test needs a floor for "inside minRange" to exist
    const { world, units } = scene([
      { team: 'player', x: 5, y: 5, archetype: 'archer', attackRange: REACH, moveCooldownTicks: 1 },
      { team: 'enemy', x: 6, y: 5, inert: true }, // adjacent → inside minRange → M wants to kite
    ]);
    const [m, e] = units as [Unit, Unit];
    m.targetId = e.id;
    const mover = new MovementBehavior();

    // Claim another adjacent cell — also inside minRange (dist 1 < floor). It is NOT
    // in band, so it must not suppress the kite: M still proposes a MOVE (not a wait).
    world.claimCell({ x: 6, y: 6 }, e.id);
    expect(mover.proposeAction(m, world)?.action).toBeInstanceOf(MoveAction);
  });
});

interface SceneUnit {
  team: Team;
  x: number;
  y: number;
  attackRange?: number;
  moveCooldownTicks?: number;
  /**
   * O4 — override the archetype (default `mercenary`). `minRangeForArchetype`
   * reads it, so a `ranged` unit picks up the bow's firing floor and kites.
   */
  archetype?: UnitArchetype;
  /** Skip attaching MovementBehavior — for static targets and walls. */
  inert?: boolean;
  /**
   * E7.D — give the unit an ability that ignores line of sight (a catapult
   * stand-in). Only the `ignoresLineOfSight` flag matters to MovementBehavior;
   * the stub never proposes, so the test isolates the movement abstain.
   */
  ignoresLos?: boolean;
}

/**
 * E5.B — `team: 'neutral'` specs become walls (hard pathfinding blockers).
 * Routing them through `scene()`'s shared id counter avoids the id
 * collision that `spawnWall` (which pulls ids from World's own counter)
 * would cause against the hand-assigned combatant ids.
 */

function scene(specs: SceneUnit[]): {
  world: World;
  units: Unit[];
  moves: GameEvents['unit:moved'][];
  bus: EventBus<GameEvents>;
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const moves: GameEvents['unit:moved'][] = [];
  bus.on('unit:moved', (p) => moves.push(p));

  let nextId = 1;
  const units = specs.map((s) => {
    const isNeutral = s.team === 'neutral';
    // E1: build stats from the melee archetype baseline (con=20 → maxHp=50,
    // matching the pre-E1 default) with luck=0 so the AttackAction crit
    // roll never fires — keeps exact-value assertions deterministic.
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
    if (s.ignoresLos) {
      u.abilities.push({ id: 'stub_los_ignorer', ignoresLineOfSight: true, propose: () => null });
    }
    world.units.push(u);
    return u;
  });
  return { world, units, moves, bus };
}

/**
 * 43-pre-b — the movement layer's LOS occluder list must cover a multi-tile
 * neutral's WHOLE footprint (`cellsOccupiedBy`), not just its §39 canonical
 * corner. Corner-only, a 2×2 rubble's body cells were LOS-transparent to the
 * in-band hold: a ranged unit sat holding behind them (§42a's `hold_band`,
 * §44b's `wait`) with a shot the (consistently corner-blind) gate then fired
 * through. Footprint-aware, "behind rubble" reads as no-LOS and the unit
 * repositions for a real shot.
 */
describe('MovementBehavior — multi-tile neutral footprints (43-pre-b)', () => {
  it('a rubble BODY cell on the sight line breaks the in-band hold (repositions)', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 5, attackRange: 3 },
      // Corner (1,4) is OFF the sight line; body cells (1,5)(2,5) are ON it.
      { team: 'neutral', x: 1, y: 4, archetype: 'rubble_2x2', inert: true },
      { team: 'enemy', x: 3, y: 5, inert: true }, // dist 3 — in band, but no shot
    ]);
    const [m, , e] = units as [Unit, Unit, Unit];
    m.targetId = e.id;
    // Corner-only LOS read "clear" → the in-band hold. Footprint-aware the
    // hold breaks and the unit moves for a firing cell with a true shot line.
    expect(new MovementBehavior().proposeAction(m, world)?.action).toBeInstanceOf(MoveAction);
  });

  it('an LOS-ignoring unit (the catapult) still holds in band behind the rubble body', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 5, attackRange: 3, ignoresLos: true },
      { team: 'neutral', x: 1, y: 4, archetype: 'rubble_2x2', inert: true },
      { team: 'enemy', x: 3, y: 5, inert: true },
    ]);
    const [m, , e] = units as [Unit, Unit, Unit];
    m.targetId = e.id;
    // E7.D — it lobs over the body exactly as it lobbed over the corner
    // (§44b: the in-band hold is a wait proposal).
    expect(new MovementBehavior().proposeAction(m, world)?.action.id).toBe(WAIT_ACTION_ID);
  });
});

/**
 * 44-pre-c — the movement hold measures the firing band against the target's
 * BODY (the shared `firingBandCell` predicate), not its §39 corner. Corner-only,
 * a unit flush against a big rubble's far side read "out of range" and WALKED
 * AROUND the body to its corner; a bow crept for corner-LOS it didn't need; a
 * catapult marched inside its own lob arc. All three now hold — §44b: a `wait`
 * proposal — where the strike gate (the SAME predicate) fires. Open field + a
 * committed target, so a wait here can only be the in-band hold (the
 * boxed/pinned/no_goal abstains stay null and are unreachable in this scene).
 */
describe('MovementBehavior — footprint firing band vs multi-tile targets (44-pre-c)', () => {
  // rubble_3x3 at (4,4) → body x,y ∈ [4..6].
  const RUBBLE3 = { team: 'neutral' as const, x: 4, y: 4, archetype: 'rubble_3x3' as const, inert: true };

  it('melee flush against the FAR side holds to strike the body (no walk-around)', () => {
    const { world, units } = scene([
      { team: 'player', x: 7, y: 5, attackRange: 1 },
      RUBBLE3,
    ]);
    const [m, rubble] = units as [Unit, Unit];
    m.targetId = rubble.id;
    // Corner-only: corner (4,4) read dist 3 > 1 → the §40b advance walked the
    // unit around the body toward the corner. Body cell (6,5) is adjacent.
    expect(new MovementBehavior().proposeAction(m, world)?.action.id).toBe(WAIT_ACTION_ID);
  });

  it('a bow holds on a clear BODY shot instead of creeping for corner-LOS', () => {
    const { world, units } = scene([
      { team: 'player', x: 6, y: 4, attackRange: 3, archetype: 'archer' },
      { team: 'neutral', x: 3, y: 3, archetype: 'rubble_2x2', inert: true },
    ]);
    const [b, rubble] = units as [Unit, Unit];
    b.targetId = rubble.id;
    // Body cell (4,3) is at dist 2 (in the bow's [2,3] band) with a clear ray;
    // the ray to the CORNER threads the body, so corner-only read no-LOS and
    // proposed a reposition it didn't need.
    expect(new MovementBehavior().proposeAction(b, world)?.action.id).toBe(WAIT_ACTION_ID);
  });

  it("E7.D — a catapult holds when the body's far side enters its lob band", () => {
    const { world, units } = scene([
      { team: 'player', x: 11, y: 5, attackRange: 6, archetype: 'catapult', ignoresLos: true },
      RUBBLE3,
    ]);
    const [c, rubble] = units as [Unit, Unit];
    c.targetId = rubble.id;
    // Corner-only: corner dist 7 > 6 → marched in. Body cell (6,5) is at 5 —
    // inside the [minRange 4, range 6] band, band-only (LOS-ignoring lob).
    expect(new MovementBehavior().proposeAction(c, world)?.action.id).toBe(WAIT_ACTION_ID);
  });
});

/**
 * 44-pre-a — the blind wander's occupied set must cover a multi-tile neutral's
 * WHOLE footprint (the §35 `occupiedCells` builder), not just its §39 corner.
 * Corner-only, a rubble's body cells read as free wander candidates: the roll
 * onto one was a doomed proposal §35b's destination gate then aborted
 * (`unit:moveAborted`, no overlap), wasting the wanderer's tick.
 */
describe('MovementBehavior — blind wander vs multi-tile footprints (44-pre-a)', () => {
  /** A held blind status (movement: wander) — the shipped def, key-resolved. */
  function blind(): StatusEffect {
    return { key: 'blind', magnitude: 1, mods: {}, lifetime: { kind: 'endOfTurn' }, merge: 'replace' };
  }

  // rubble_2x2 anchored at (6,4) → cells (6,4) (7,4) (6,5) (7,5). Of the
  // wanderer's ring at (5,5), (6,4) is the corner (blocked either way) and
  // (6,5) is a BODY cell — free corner-only, occupied footprint-aware.
  const RUBBLE = { team: 'neutral' as const, x: 6, y: 4, archetype: 'rubble_2x2' as const, inert: true };
  const RUBBLE_CELLS = [
    { x: 6, y: 4 }, { x: 7, y: 4 },
    { x: 6, y: 5 }, { x: 7, y: 5 },
  ];

  it('abstains (boxed) when the only corner-free neighbor is a rubble BODY cell', () => {
    const { world, units } = scene([
      { team: 'player', x: 5, y: 5 },
      RUBBLE,
      // Walls on every other ring cell → footprint-aware there is NO free
      // neighbor; corner-only, body cell (6,5) reads free and gets proposed.
      { team: 'neutral', x: 4, y: 4, inert: true },
      { team: 'neutral', x: 5, y: 4, inert: true },
      { team: 'neutral', x: 4, y: 5, inert: true },
      { team: 'neutral', x: 4, y: 6, inert: true },
      { team: 'neutral', x: 5, y: 6, inert: true },
      { team: 'neutral', x: 6, y: 6, inert: true },
    ]);
    const w = units[0]!;
    w.addEffect(blind());
    expect(new MovementBehavior().proposeAction(w, world)).toBeNull();
  });

  it('never rolls a wander step onto a rubble BODY cell (open ring)', () => {
    const { world, units } = scene([
      { team: 'player', x: 5, y: 5 },
      RUBBLE,
      // Leave (4,6) (5,6) (6,6) genuinely free alongside the phantom (6,5):
      // corner-only, ~30 draws hit the body cell with p ≈ 1 − (3/4)³⁰.
      { team: 'neutral', x: 4, y: 4, inert: true },
      { team: 'neutral', x: 5, y: 4, inert: true },
      { team: 'neutral', x: 4, y: 5, inert: true },
    ]);
    const w = units[0]!;
    w.addEffect(blind());
    for (let i = 0; i < 30; i++) {
      const p = new MovementBehavior().proposeAction(w, world);
      expect(p).not.toBeNull();
      const to = (p!.action as MoveAction).toData().to;
      expect(RUBBLE_CELLS).not.toContainEqual(to);
    }
  });
});

/**
 * §45a — the ticking nose-to-tail column: a sealed 1-wide corridor, two movers
 * marching on an inert enemy at the far end. The route is forced (walls both
 * sides), so this doesn't discriminate the cost tiers (movement.test.ts's
 * corridor A/B does that) — it pins what must NOT change under them: the
 * column drains single-file, nobody leaves the lane, nobody overtakes, and
 * the §35d one-unit-per-cell invariant holds on EVERY tick (the charter's
 * "same-cell convergence must stay impossible" — the §45a discounts touch
 * route selection only, never the commit/execution gates).
 */
describe('§45a — corridor column (nose-to-tail under vacancy-aware costs)', () => {
  it('drains single-file with the occupancy invariant intact every tick', () => {
    const specs: SceneUnit[] = [
      { team: 'player', x: 0, y: 5, moveCooldownTicks: 4 },
      { team: 'player', x: 1, y: 5, moveCooldownTicks: 4 },
      { team: 'enemy', x: 7, y: 5, inert: true },
    ];
    for (let x = 0; x <= 7; x++) {
      specs.push({ team: 'neutral', x, y: 4, inert: true });
      specs.push({ team: 'neutral', x, y: 6, inert: true });
    }
    const { world, units, bus } = scene(specs);
    const [rear, front] = units as [Unit, Unit];
    // §45b — the rear's queueing is now DELIBERATE where the drain is
    // derivable: behind a mid-move front it proposes the first-class wait
    // (decision `wait`); it never crabs (walls preclude the sidestep anyway,
    // but the decision record proves it queued by CHOICE, not helplessness).
    const rearKinds: string[] = [];
    bus.on('unit:moveDecision', (p) => {
      if (p.unitId === rear.id) rearKinds.push(p.kind);
    });

    for (let t = 0; t < 80; t++) {
      world.tick();
      expect(findOverlappingCells(world)).toEqual([]);
      expect(rear.position.y).toBe(5);
      expect(front.position.y).toBe(5);
      expect(rear.position.x).toBeLessThan(front.position.x); // never overtakes/swaps
    }
    // The column drained: front holds at attack range 1, rear queues behind it.
    expect(front.position).toEqual({ x: 6, y: 5 });
    expect(rear.position).toEqual({ x: 5, y: 5 });
    // §45b: the drain-derivable polls queued as waits; no sidesteps ever.
    expect(rearKinds.filter((k) => k === 'wait').length).toBeGreaterThan(0);
    expect(rearKinds).not.toContain('sidestep');
  });
});
