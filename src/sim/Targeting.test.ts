import { describe, it, expect } from 'vitest';
import { findTarget, updateTarget, currentTarget } from './Targeting';
import { World } from './World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { deriveStats } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import { SIM } from '../config/sim';
import { spawnWall } from './environment';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';

describe('Targeting / findTarget', () => {
  it('returns null when there are no enemies', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'player', x: 5, y: 5 },
    ]);
    expect(findTarget(units[0]!, world)).toBeNull();
  });

  it('picks the nearest enemy by Chebyshev distance (not Euclidean)', () => {
    // From (0,0): candidate A at (3,3) is Chebyshev 3, Euclidean ~4.24;
    // candidate B at (0,4) is Chebyshev 4, Euclidean 4. Chebyshev winner is A.
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 3, y: 3 },
      { id: 3, team: 'enemy', x: 0, y: 4 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(2);
  });

  it('breaks distance ties by lowest currentHp', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 5, y: 5 },
      { id: 2, team: 'enemy', x: 6, y: 6, currentHp: 30 },
      { id: 3, team: 'enemy', x: 6, y: 4, currentHp: 10 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('breaks distance+HP ties by lowest id', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 5, y: 5 },
      { id: 7, team: 'enemy', x: 6, y: 6, currentHp: 20 },
      { id: 3, team: 'enemy', x: 4, y: 4, currentHp: 20 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('skips dead enemies (currentHp <= 0)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 5, y: 5 },
      { id: 2, team: 'enemy', x: 6, y: 5, currentHp: 0 },
      { id: 3, team: 'enemy', x: 8, y: 5, currentHp: 25 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('skips same-team units', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'player', x: 1, y: 1 },
      { id: 3, team: 'enemy', x: 5, y: 5 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('skips neutral units (walls, env entities) even when closer than enemies', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'neutral', x: 1, y: 1 }, // closer, but inert
      { id: 3, team: 'enemy', x: 5, y: 5 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('returns null when only neutrals are present', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'neutral', x: 1, y: 1 },
      { id: 3, team: 'neutral', x: 2, y: 2 },
    ]);
    expect(findTarget(units[0]!, world)).toBeNull();
  });
});

describe('Targeting / target stickiness (E5)', () => {
  it('currentTarget falls back to the nearest enemy when uncommitted (targetId null)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 2, y: 0 },
      { id: 3, team: 'enemy', x: 6, y: 0 },
    ]);
    expect(units[0]!.targetId).toBeNull();
    expect(currentTarget(units[0]!, world)?.id).toBe(2);
  });

  it('currentTarget honors a committed target even when it is not the nearest', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 2, y: 0 }, // nearest
      { id: 3, team: 'enemy', x: 6, y: 0 }, // committed
    ]);
    units[0]!.targetId = 3;
    expect(currentTarget(units[0]!, world)?.id).toBe(3);
  });

  it('currentTarget falls back to nearest when the committed target is dead', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 2, y: 0 },
      { id: 3, team: 'enemy', x: 6, y: 0, currentHp: 0 }, // committed but dead
    ]);
    units[0]!.targetId = 3;
    expect(currentTarget(units[0]!, world)?.id).toBe(2);
  });

  it('(a) updateTarget commits to the nearest enemy, then re-picks when it dies', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 2, y: 0 },
      { id: 3, team: 'enemy', x: 5, y: 0 },
    ]);
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);

    units[1]!.currentHp = 0; // kill the committed target
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(3);
  });

  it('(b) stays locked when a rival is only slightly closer (< ratio)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 6, y: 0 }, // committed (chebyshev 6)
      { id: 3, team: 'enemy', x: 5, y: 0 }, // nearer, but only 6/5 = 1.2x < 1.5x
    ]);
    units[0]!.targetId = 2;
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);
  });

  it('(b) switches when a rival is at least ratio-times closer', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 9, y: 0 }, // committed (chebyshev 9)
      { id: 3, team: 'enemy', x: 5, y: 0 }, // 9/5 = 1.8x >= 1.5x → switch
    ]);
    units[0]!.targetId = 2;
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(3);
  });

  it('(c) ranged unit drops a target hidden behind a wall after the LOS timeout', () => {
    const { world, units } = scene([
      // chebyshev 4, behind a wall — the slightly-nearer rival (3) is NOT
      // 1.5x closer (3*1.5=4.5 > 4) so rule (b) never fires; only the LOS
      // timeout breaks the lock.
      { id: 1, team: 'player', x: 0, y: 0, archetype: 'ranged' },
      { id: 2, team: 'enemy', x: 4, y: 0 }, // committed, will be occluded
      { id: 3, team: 'enemy', x: 3, y: 3 }, // visible alternative, chebyshev 3
    ]);
    spawnWall(world, { x: 2, y: 0 }); // occludes the line to (4,0)
    units[0]!.targetId = 2;

    // Below the timeout: stays locked on the hidden target.
    for (let i = 0; i < SIM.rangedRetargetLosTicks - 1; i++) updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);

    // The tick that hits the timeout re-picks the nearest (visible) enemy.
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(3);
  });

  it('(c) is melee-exempt: a melee unit keeps a hidden, non-much-closer target', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 }, // melee (default)
      { id: 2, team: 'enemy', x: 4, y: 0 },
      { id: 3, team: 'enemy', x: 3, y: 3 },
    ]);
    spawnWall(world, { x: 2, y: 0 });
    units[0]!.targetId = 2;
    for (let i = 0; i < SIM.rangedRetargetLosTicks + 2; i++) updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);
  });
});

describe('Targeting / weakest strategy (rogue)', () => {
  it('picks the lowest max-HP enemy over a nearer, tankier one', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, targeting: 'weakest' },
      { id: 2, team: 'enemy', x: 1, y: 0, maxHp: 30 }, // nearest, but tanky
      { id: 3, team: 'enemy', x: 5, y: 0, maxHp: 10 }, // far, but squishy
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('breaks max-HP ties by Chebyshev distance', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, targeting: 'weakest' },
      { id: 5, team: 'enemy', x: 4, y: 0, maxHp: 12 }, // farther
      { id: 6, team: 'enemy', x: 2, y: 0, maxHp: 12 }, // nearer → wins
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(6);
  });

  it('breaks max-HP + distance ties by lowest id', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, targeting: 'weakest' },
      { id: 9, team: 'enemy', x: 2, y: 0, maxHp: 12 }, // chebyshev 2
      { id: 4, team: 'enemy', x: 0, y: 2, maxHp: 12 }, // chebyshev 2, lower id
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(4);
  });

  it('holds its committed mark even when a weaker enemy appears (no thrash)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, targeting: 'weakest' },
      { id: 2, team: 'enemy', x: 3, y: 0, maxHp: 15 }, // committed mark, alive
      { id: 3, team: 'enemy', x: 6, y: 0, maxHp: 5 }, // weaker, but appears later
    ]);
    units[0]!.targetId = 2;
    // The fresh weakest pick is now id 3, but the live mark is committed and
    // `weakest.shouldRetarget` is false → it never switches off a live target.
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);
  });

  it('re-picks the next weakest enemy when its mark dies', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, targeting: 'weakest' },
      { id: 2, team: 'enemy', x: 3, y: 0, maxHp: 8 }, // weakest
      { id: 3, team: 'enemy', x: 6, y: 0, maxHp: 20 },
    ]);
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);

    units[1]!.currentHp = 0; // mark dies → rule (a) re-picks
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(3);
  });
});

describe('Targeting / shared objective (J1)', () => {
  // The objective only steers a player unit's target via `updateObjectiveTarget`
  // inside `updateTarget`. Applying it through the command channel + ONE tick is
  // the faithful path: the command drains at top of tick, then `updateTarget`
  // runs the objective branch the same tick. The scene units carry no behaviors,
  // so nothing moves — the post-tick `targetId` is the pure objective decision.
  function applyTileObjective(world: World, cell: GridCoord): void {
    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'engage', target: { kind: 'tile', cell } },
    });
    world.tick();
  }
  function applyEnemyObjective(world: World, unitId: number): void {
    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'engage', target: { kind: 'enemy', unitId } },
    });
    world.tick();
  }

  it('tile objective + no enemy in range → the unit holds no enemy target (pursues the tile)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 2, y: 2 },
      { id: 2, team: 'enemy', x: 10, y: 10 }, // cheby 8 > leash 3
    ]);
    applyTileObjective(world, { x: 0, y: 0 });
    expect(units[0]!.targetId).toBeNull();
    // currentTarget honors it — no nearest-enemy fallback under an objective.
    expect(currentTarget(units[0]!, world)).toBeNull();
  });

  it('an enemy within engage range preempts the tile objective (en-route engage)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 2, y: 2 }, // melee: engage radius = min(range 1, leash 3) = 1
      { id: 2, team: 'enemy', x: 3, y: 2 }, // cheby 1 <= 1 → engageable
    ]);
    applyTileObjective(world, { x: 10, y: 10 });
    expect(units[0]!.targetId).toBe(2);
  });

  it('an engaged unit is NOT preempted by the objective (keeps its in-range fight)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 5, y: 5, targetId: 2 },
      { id: 2, team: 'enemy', x: 6, y: 5 }, // adjacent, committed → engaged
    ]);
    applyTileObjective(world, { x: 0, y: 0 });
    expect(units[0]!.targetId).toBe(2);
  });

  it('enemy objective: an unengaged unit commits to the objective enemy even when far', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 2, y: 2 },
      { id: 9, team: 'enemy', x: 10, y: 10 }, // far (beyond leash), the objective
    ]);
    applyEnemyObjective(world, 9);
    expect(units[0]!.targetId).toBe(9);
  });

  it('enemy objective: a closer enemy en route preempts the objective enemy', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 2, y: 2 },
      { id: 2, team: 'enemy', x: 3, y: 2 }, // cheby 1 → in engage range → preempts
      { id: 9, team: 'enemy', x: 10, y: 10 }, // the objective, far
    ]);
    applyEnemyObjective(world, 9);
    expect(units[0]!.targetId).toBe(2);
  });

  it('the leash CAPS a long-range unit: an enemy beyond the leash but within firing range does NOT preempt the tile', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, archetype: 'ranged', attackRange: 6 },
      { id: 2, team: 'enemy', x: 5, y: 0 }, // cheby 5 > leash 3, <= range 6
    ]);
    applyTileObjective(world, { x: 0, y: 10 });
    expect(units[0]!.targetId).toBeNull(); // pursues the tile, doesn't plink
  });

  it('RETALIATION: a leashed archer engages an attacker beyond the leash that is shooting it', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, archetype: 'ranged', attackRange: 6 },
      // a ranged enemy at cheby 5 (> leash 3, within both ranges) committed to
      // the archer (it's actively shooting) → retaliation overrides the leash.
      { id: 2, team: 'enemy', x: 5, y: 0, archetype: 'ranged', attackRange: 6, targetId: 1 },
    ]);
    applyTileObjective(world, { x: 0, y: 10 });
    expect(units[0]!.targetId).toBe(2);
  });

  it('no retaliation when the far enemy is NOT attacking this unit (leashed out)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, archetype: 'ranged', attackRange: 6 },
      { id: 2, team: 'enemy', x: 5, y: 0, archetype: 'ranged', attackRange: 6 }, // not committed
    ]);
    applyTileObjective(world, { x: 0, y: 10 });
    expect(units[0]!.targetId).toBeNull();
  });

  it('enemy AI is unaffected by the player objective (still targets nearest player)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 2, y: 2 },
      { id: 2, team: 'enemy', x: 5, y: 5 },
    ]);
    applyTileObjective(world, { x: 11, y: 11 });
    // The enemy ran the default (non-objective) targeting branch → committed to
    // the only player. The objective never touches enemy units.
    expect(units[1]!.targetId).toBe(1);
  });
});

describe('Targeting / hold (O2)', () => {
  // Hold = act in place: target only what's ALREADY within attack range, never
  // reposition. One tick drains the command + runs updateTarget's hold branch.
  function setHold(world: World): void {
    world.enqueueCommand({ kind: 'setObjective', team: 'player', objective: { mode: 'hold' } });
    world.tick();
  }

  it('targets an enemy already within strike range', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 2, y: 2 }, // melee range 1
      { id: 2, team: 'enemy', x: 3, y: 2 }, // cheby 1 → in range
    ]);
    setHold(world);
    expect(units[0]!.targetId).toBe(2);
  });

  it('ignores an enemy out of range → no target (idle, never closes)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 2, y: 2 },
      { id: 2, team: 'enemy', x: 5, y: 5 }, // cheby 3 > range 1
    ]);
    setHold(world);
    expect(units[0]!.targetId).toBeNull();
    // currentTarget honors hold — no nearest-enemy fallback to chase.
    expect(currentTarget(units[0]!, world)).toBeNull();
  });

  it('a ranged unit fires at its FULL attackRange, not the engage leash', () => {
    // Contrast the engage leash test above: at cheby 5 (> leash 3, <= range 6)
    // engage would NOT target (leashed off the objective), but hold attacks
    // anything in actual reach.
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, archetype: 'ranged', attackRange: 6 },
      { id: 2, team: 'enemy', x: 5, y: 0 }, // cheby 5 <= range 6
    ]);
    setHold(world);
    expect(units[0]!.targetId).toBe(2);
  });

  it('re-picks an in-range enemy over a stale out-of-range commitment (in-place switch)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 2, y: 2, targetId: 9 }, // committed to the far one
      { id: 2, team: 'enemy', x: 3, y: 2 }, // in range (cheby 1)
      { id: 9, team: 'enemy', x: 10, y: 10 }, // out of range — drop it
    ]);
    setHold(world);
    expect(units[0]!.targetId).toBe(2);
  });
});

/**
 * Build a World seeded with hand-placed units. We bypass spawnUnit because
 * Targeting tests want precise ids and HPs without rolling templates.
 */
interface UnitSpec {
  id: number;
  team: Team;
  x: number;
  y: number;
  currentHp?: number;
  /** Defaults to melee for combatants, environment for neutrals. */
  archetype?: UnitArchetype;
  /** Target-selection strategy; defaults to the Unit ctor default (nearest). */
  targeting?: string;
  /** Override `derived.maxHp` for this unit — lets the `weakest` tests vary
   *  structural HP per candidate (also sets `currentHp` via the ctor). */
  maxHp?: number;
  /** Override `derived.attackRange` — the J1 objective tests need long-range
   *  units to exercise the leash cap + retaliation gate (the default scene
   *  builds range-1 melee). */
  attackRange?: number;
  /** Pre-set the unit's sticky target id (the E5 commitment). */
  targetId?: number;
}

function scene(specs: UnitSpec[]): { world: World; units: Unit[] } {
  const world = new World(new EventBus<GameEvents>(), new RNG(1));
  // E1: melee baseline. luck=0 keeps the crit roll deterministically
  // off, though Targeting never ticks the world so it can't matter here.
  const stats: UnitStats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, luck: 0 };
  const derived = deriveStats(stats, 1);
  const units = specs.map((s) => {
    let d = derived;
    if (s.maxHp !== undefined) d = { ...d, maxHp: s.maxHp };
    if (s.attackRange !== undefined) d = { ...d, attackRange: s.attackRange };
    const u = new Unit({
      id: s.id,
      team: s.team,
      archetype: s.archetype ?? (s.team === 'neutral' ? 'environment' : 'mercenary'),
      glyph: 'M',
      stats,
      derived: d,
      position: { x: s.x, y: s.y } satisfies GridCoord,
      ...(s.targeting !== undefined ? { targeting: s.targeting } : {}),
    });
    if (s.currentHp !== undefined) u.currentHp = s.currentHp;
    if (s.targetId !== undefined) u.targetId = s.targetId;
    world.units.push(u);
    return u;
  });
  return { world, units };
}
