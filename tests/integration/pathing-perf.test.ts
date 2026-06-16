import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import { Unit, type Team, type UnitStats } from '../../src/sim/Unit';
import { MovementBehavior } from '../../src/sim/behaviors/MovementBehavior';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import { deriveStats } from '../../src/sim/stats';
import { ARCHETYPE_CONFIG } from '../../src/sim/archetypes';
import { pathfindingStats } from '../../src/sim/Pathfinding';
import type { GameEvents } from '../../src/core/events';

/**
 * J2 — the ROADMAP §J2 recompute-budget guard. The flagged risk is that a
 * player who THRASHES the shared objective (re-sets it every tick), stacked
 * with I3's 3× fast-forward, blows the per-tick pathing budget.
 *
 * J2 deliberately DEFERS the path cache (pathing is measured-cheap — I3
 * profiled ≤ 0.236 ms/tick on a big board, ~1.4% of a 3× frame), so this guard
 * asserts the structural property that makes thrash safe in the no-cache model:
 * each free unit runs at most TWO A* searches per tick (a ranged unit's
 * firing-cell goal + the target-cell fallback; melee runs one), and re-setting
 * the objective changes only WHICH goal a unit pursues, never HOW MANY searches
 * it runs. So objective-thrash is free here, and the per-tick `findPath` count
 * is bounded by `2 × (live mobile units)` no matter how hard the objective is
 * thrashed.
 *
 * When the deferred cache lands, this same scenario should show the count DROP
 * well below the bound — so the guard doubles as the cache's effectiveness
 * meter. If a future cache ever recomputes MORE than the naive model under
 * thrash (a broken invalidation), this trips.
 */
describe('pathing perf: bounded per-tick recompute under objective thrash', () => {
  function combatant(
    id: number,
    team: Team,
    x: number,
    y: number,
    range: number,
  ): Unit {
    const stats: UnitStats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, luck: 0 };
    const u = new Unit({
      id,
      team,
      archetype: 'mercenary',
      glyph: 'M',
      stats,
      derived: { ...deriveStats(stats, range), moveCooldownTicks: 1 },
      position: { x, y },
    });
    // Movement only (no AbilityBehavior) → nobody attacks or dies, so the live
    // mobile population stays constant and the bound is clean. We're measuring
    // pathing load, not combat.
    u.behaviors.push(new MovementBehavior());
    return u;
  }

  it('per-tick findPath calls never exceed 2 × live mobile units while the objective is re-set every tick', () => {
    const gridW = 24;
    const gridH = 24;
    const world = new World(new EventBus<GameEvents>(), new RNG(1), gridW, gridH);

    let id = 1;
    // A worst-case-ish crowd: two facing lines, a mix of melee (range 1) and
    // ranged (range 4, which exercises the firing-cell + fallback two-search
    // path). All on the player/enemy split so both teams pathfind every tick.
    for (let i = 0; i < 6; i++) {
      world.units.push(combatant(id++, 'player', 2 + i, 2, i % 2 === 0 ? 1 : 4));
    }
    for (let i = 0; i < 6; i++) {
      world.units.push(combatant(id++, 'enemy', 2 + i, 21, i % 2 === 0 ? 1 : 4));
    }

    const mobileUnits = world.units.length; // no deaths → constant
    const bound = 2 * mobileUnits;

    let maxObserved = 0;
    let totalObserved = 0;
    const TICKS = 40;
    for (let t = 0; t < TICKS; t++) {
      // Thrash: a fresh tile objective every tick (deterministic pseudo-spread
      // across the board), the exact pattern the §J2 risk describes.
      world.enqueueCommand({
        kind: 'setObjective',
        team: 'player',
        objective: {
          mode: 'engage',
          target: { kind: 'tile', cell: { x: (t * 7) % gridW, y: (t * 13) % gridH } },
        },
      });
      pathfindingStats.reset();
      world.tick();
      const calls = pathfindingStats.calls;
      expect(calls).toBeLessThanOrEqual(bound);
      maxObserved = Math.max(maxObserved, calls);
      totalObserved += calls;
    }

    // Sanity: the path was actually exercised (the bound isn't passing on zero).
    expect(totalObserved).toBeGreaterThan(0);
    expect(maxObserved).toBeGreaterThan(0);
  });

  it('thrashing the objective costs no more pathing than holding it static (cache-free invariant)', () => {
    // Two identical boards, same seed: one with a static objective, one re-set
    // every tick. In the no-cache model the per-tick search count is driven by
    // unit positions + ranges, not objective churn — so the totals must match
    // tick-for-tick when the units follow the same path. We keep the objective
    // FIXED in both to isolate "does re-issuing the same command cost extra?"
    function run(thrash: boolean): number {
      const world = new World(new EventBus<GameEvents>(), new RNG(7), 24, 24);
      let id = 1;
      for (let i = 0; i < 6; i++) world.units.push(combatant(id++, 'player', 2 + i, 2, 1));
      for (let i = 0; i < 6; i++) world.units.push(combatant(id++, 'enemy', 2 + i, 21, 1));
      const cell = { x: 0, y: 0 };
      const objective = { mode: 'engage', target: { kind: 'tile', cell } } as const;
      world.enqueueCommand({ kind: 'setObjective', team: 'player', objective });
      let total = 0;
      for (let t = 0; t < 30; t++) {
        if (thrash) world.enqueueCommand({ kind: 'setObjective', team: 'player', objective });
        pathfindingStats.reset();
        world.tick();
        total += pathfindingStats.calls;
      }
      return total;
    }
    expect(run(true)).toBe(run(false));
  });
});
