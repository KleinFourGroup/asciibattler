import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import {
  playerTeamLevel,
  avgTeamLevel,
  buildEnemyTeam,
  chooseSwarmCount,
  distributeBudget,
} from './enemyBudget';
import { DIFFICULTY } from '../config/difficulty';
import { DECK } from '../config/deck';
import { ARCHETYPE_CONFIG } from '../sim/archetypes';
import { scaleStats } from '../sim/leveling';
import type { UnitTemplate } from '../sim/Unit';

/** Build a fake roster at the given per-unit levels (stats = baseStats; only
 *  `level` matters to the budget math). */
function roster(levels: number[], archetype: 'mercenary' | 'ranged' = 'mercenary'): UnitTemplate[] {
  return levels.map((level) => ({
    archetype,
    level,
    stats: { ...ARCHETYPE_CONFIG[archetype].baseStats },
    xp: 0,
  }));
}

describe('playerTeamLevel (the G4/H5 seam)', () => {
  // H5: the seam is `avgLevel × min(rosterSize, handSize)` — the EXPECTED hand
  // level, not the whole-roster sum. Expectations derive from DECK.handSize.
  const { handSize } = DECK;

  it('equals avgLevel × min(rosterSize, handSize)', () => {
    for (const levels of [[1, 2, 3], [5, 5, 5, 5, 5], [2, 2, 2, 2, 2, 2, 2, 2], [1, 3, 9, 4, 5, 7, 2]]) {
      const team = roster(levels);
      const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
      expect(playerTeamLevel(team)).toBe(avg * Math.min(levels.length, handSize));
    }
  });

  it('for a roster ≤ handSize it still equals the level SUM (avg × size == sum)', () => {
    // Pre-H5 behavior preserved at small rosters — the swap only diverges once
    // the roster outgrows the hand.
    expect(playerTeamLevel(roster([1, 2, 3]))).toBe(6);
    expect(playerTeamLevel(roster(new Array(handSize).fill(5)))).toBe(5 * handSize);
  });

  it('caps at handSize: an oversized roster does NOT keep inflating the budget', () => {
    // The treadmill fix — recruiting past handSize adds bodies to the deck but
    // not to the enemy budget; only the average level moves it.
    const big = roster(new Array(handSize + 4).fill(3)); // avg 3, size > handSize
    expect(playerTeamLevel(big)).toBe(3 * handSize); // NOT 3 × (handSize+4)
  });

  it('is 0 for an empty roster', () => {
    expect(playerTeamLevel([])).toBe(0);
  });
});

describe('avgTeamLevel (recruit basis)', () => {
  it('is the MEAN of roster unit levels', () => {
    expect(avgTeamLevel(roster([2, 4]))).toBe(3);
    expect(avgTeamLevel(roster([1, 1, 1, 1, 6]))).toBe(2);
  });

  it('is 1 for an empty roster (a recruit onto nothing comes in at 1 + bonus)', () => {
    expect(avgTeamLevel([])).toBe(1);
  });
});

describe('distributeBudget', () => {
  it('each unit ∈ [1, cap], spread ≤ 1, sums to the clamped budget', () => {
    const cases: Array<[budget: number, count: number, cap: number]> = [
      [10, 4, 5],
      [3, 5, 3], // budget < count → each floored at 1, total = count
      [60, 6, 7], // budget < count·cap
      [50, 5, 7], // budget > count·cap → maxed at cap each
      [1, 1, 9],
    ];
    for (const [budget, count, cap] of cases) {
      for (let s = 0; s < 25; s++) {
        const levels = distributeBudget(new RNG(s), budget, count, cap);
        expect(levels).toHaveLength(count);
        const total = Math.min(count * cap, Math.max(count, budget));
        expect(levels.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.min(...levels)).toBeGreaterThanOrEqual(1);
        expect(Math.max(...levels)).toBeLessThanOrEqual(cap);
        expect(Math.max(...levels) - Math.min(...levels)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic per seed', () => {
    expect(distributeBudget(new RNG(7), 17, 5, 6)).toEqual(distributeBudget(new RNG(7), 17, 5, 6));
  });
});

describe('chooseSwarmCount', () => {
  it('stays within [min, max]', () => {
    for (let s = 0; s < 200; s++) {
      const c = chooseSwarmCount(new RNG(s), 2, 10, DIFFICULTY.swarmBias);
      expect(c).toBeGreaterThanOrEqual(2);
      expect(c).toBeLessThanOrEqual(10);
    }
  });

  it('bias = 1 always returns max', () => {
    for (let s = 0; s < 50; s++) {
      expect(chooseSwarmCount(new RNG(s), 2, 10, 1)).toBe(10);
    }
  });

  it('bias = 0 is uniform enough to reach both ends across seeds', () => {
    const seen = new Set<number>();
    for (let s = 0; s < 300; s++) seen.add(chooseSwarmCount(new RNG(s), 2, 10, 0));
    expect(seen.has(2)).toBe(true);
    expect(seen.has(10)).toBe(true);
  });

  it('collapses to min when max <= min (no inversion)', () => {
    expect(chooseSwarmCount(new RNG(1), 5, 5, DIFFICULTY.swarmBias)).toBe(5);
    expect(chooseSwarmCount(new RNG(1), 7, 3, DIFFICULTY.swarmBias)).toBe(7);
  });
});

describe('buildEnemyTeam (balance-proof — derives from DIFFICULTY)', () => {
  const { budgetFactor, budgetOffset, unitLevelDelta, minBudget, swarmBias, swarmMaxMultiplier } =
    DIFFICULTY;

  // A mid-run roster: 5 units, summed level 25, highest 6.
  const player = roster([6, 5, 5, 5, 4]);
  const size = player.length;
  const budget = Math.max(
    minBudget,
    Math.round(budgetOffset + budgetFactor * playerTeamLevel(player)),
  );
  const cap = Math.max(...player.map((u) => u.level)) + unitLevelDelta;
  const minCount = Math.max(1, Math.ceil(budget / cap));
  const maxCount = Math.max(minCount, Math.min(Math.round(swarmMaxMultiplier * size), budget));

  it('count ∈ [minCount, maxCount] and no enemy exceeds the cap', () => {
    for (let s = 0; s < 100; s++) {
      const team = buildEnemyTeam(new RNG(s), player);
      expect(team.length).toBeGreaterThanOrEqual(minCount);
      expect(team.length).toBeLessThanOrEqual(maxCount);
      for (const u of team) {
        expect(u.level).toBeGreaterThanOrEqual(1);
        expect(u.level).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('total enemy level == the budget exactly (count bounded by budget)', () => {
    for (let s = 0; s < 100; s++) {
      const team = buildEnemyTeam(new RNG(s), player);
      const total = team.reduce((a, u) => a + u.level, 0);
      expect(total).toBe(budget);
    }
  });

  it('per-unit levels stay roughly equal (spread ≤ 1)', () => {
    for (let s = 0; s < 100; s++) {
      const lv = buildEnemyTeam(new RNG(s), player).map((u) => u.level);
      expect(Math.max(...lv) - Math.min(...lv)).toBeLessThanOrEqual(1);
    }
  });

  it('swarm bias skews the mean count above the range midpoint', () => {
    if (swarmBias <= 0) return; // a future uniform config wouldn't skew
    const N = 200;
    let sum = 0;
    for (let s = 0; s < N; s++) sum += buildEnemyTeam(new RNG(s), player).length;
    expect(sum / N).toBeGreaterThan((minCount + maxCount) / 2);
  });

  it('builds via the deterministic scaledUnit path (stats == scaleStats)', () => {
    for (const u of buildEnemyTeam(new RNG(3), player)) {
      const cfg = ARCHETYPE_CONFIG[u.archetype];
      expect(u.stats).toEqual(scaleStats(cfg.baseStats, cfg.growthRates, u.level - 1));
    }
  });

  it('keeps the 60/40 split by index, fielding BANDIT (not mercenary) as the enemy melee', () => {
    // I5: the enemy melee slot is `bandit` (low-growth fodder), distinct from the
    // player's `mercenary`. The ranged slot stays generic `ranged`.
    const team = buildEnemyTeam(new RNG(9), player);
    const bandits = team.filter((u) => u.archetype === 'bandit').length;
    expect(bandits).toBe(Math.round(team.length * 0.6));
    // No `mercenary` ever appears on the enemy side post-I5.
    expect(team.some((u) => u.archetype === 'mercenary')).toBe(false);
    expect(team.every((u) => u.archetype === 'bandit' || u.archetype === 'ranged')).toBe(true);
  });

  it('budget follows the affine formula, floored at minBudget', () => {
    // A tiny roster (sum 1) — the budget is the affine result, clamped up to
    // minBudget if the offset/factor would push it below (the safety floor).
    const tiny = roster([1]);
    const expectedBudget = Math.max(minBudget, Math.round(budgetOffset + budgetFactor * 1));
    for (let s = 0; s < 30; s++) {
      const team = buildEnemyTeam(new RNG(s), tiny);
      expect(team.length).toBeGreaterThanOrEqual(1);
      expect(team.reduce((a, u) => a + u.level, 0)).toBe(expectedBudget);
    }
  });

  it('is deterministic per seed', () => {
    expect(buildEnemyTeam(new RNG(42), player)).toEqual(buildEnemyTeam(new RNG(42), player));
  });
});
