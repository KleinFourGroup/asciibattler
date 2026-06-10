import { describe, it, expect } from 'vitest';
import { MovementBehavior } from './MovementBehavior';
import { hasLineOfSight } from '../LineOfSight';
import { World } from '../World';
import { Unit, type Team, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { spawnHalfCover } from '../environment';
import { deriveStats, inertDerived } from '../stats';
import { ARCHETYPE_CONFIG } from '../archetypes';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';

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

    expect(units[0]!.position).toEqual({ x: 1, y: 0 });
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({
      unitId: units[0]!.id,
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      durationTicks: 4,
    });
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
    world.enqueueCommand({ kind: 'setObjective', objective: { kind: 'tile', cell } });
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

interface SceneUnit {
  team: Team;
  x: number;
  y: number;
  attackRange?: number;
  moveCooldownTicks?: number;
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
      archetype: isNeutral ? 'environment' : 'mercenary',
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
  return { world, units, moves };
}
