import { describe, it, expect } from 'vitest';
import { RNG } from '../../core/RNG';
import { resolveWave, distributeWeightedLevels, type WaveSpec, type WaveContext } from './wave';
import { ARCHETYPE_CONFIG } from '../../sim/archetypes';
import { scaleStats } from '../../sim/leveling';
import type { Archetype, UnitTemplate } from '../../sim/Unit';

// ---------------------------------------------------------------------------
// Fixtures. Mechanic tests use EXPLICIT literals — never the shipped config
// (TESTING.md / balance-proof discipline). A wave's only config dependency is
// `scaledUnit`'s archetype stats, asserted directly against `scaleStats`.
// ---------------------------------------------------------------------------

function roster(levels: number[], archetype: Archetype = 'mercenary'): UnitTemplate[] {
  return levels.map((level) => ({
    archetype,
    level,
    stats: { ...ARCHETYPE_CONFIG[archetype].baseStats },
    xp: 0,
  }));
}

/** A context with a hand size; roster defaults to one level-5 unit so
 *  `mean`/`median` budgets (and a `roster` cap) have a basis when a test doesn't
 *  care. The per-instance cap now lives on the spec (`levelCap?`), not here. */
function ctx(over: Partial<WaveContext> = {}): WaveContext {
  return { roster: roster([5]), handSize: 6, ...over };
}

const counts = (team: UnitTemplate[]) => {
  const m: Partial<Record<Archetype, number>> = {};
  for (const u of team) m[u.archetype] = (m[u.archetype] ?? 0) + 1;
  return m;
};

describe('resolveWave — count distribution', () => {
  it("reproduces the brief's worked example (C=10, 2 catapults fixed → 6 bandits / 2 archers by 3:1)", () => {
    const spec: WaveSpec = {
      levelBudget: { kind: 'fixed', value: 20 },
      count: { kind: 'fixed', value: 10 },
      units: [
        { archetype: 'catapult', count: { kind: 'fixed', value: 2 }, level: { kind: 'weight', weight: 1 } },
        { archetype: 'bandit', count: { kind: 'weight', weight: 3 }, level: { kind: 'weight', weight: 1 } },
        { archetype: 'ranged', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } },
      ],
    };
    const team = resolveWave(spec, ctx(), new RNG(1));
    expect(team).toHaveLength(10);
    expect(counts(team)).toEqual({ catapult: 2, bandit: 6, ranged: 2 });
  });

  it('the count split is DETERMINISTIC — independent of the RNG seed', () => {
    const spec: WaveSpec = {
      levelBudget: { kind: 'fixed', value: 30 },
      count: { kind: 'fixed', value: 13 },
      units: [
        { archetype: 'bandit', count: { kind: 'weight', weight: 2 }, level: { kind: 'weight', weight: 1 } },
        { archetype: 'ranged', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } },
      ],
    };
    const a = counts(resolveWave(spec, ctx(), new RNG(1)));
    const b = counts(resolveWave(spec, ctx(), new RNG(99)));
    expect(a).toEqual(b);
    // 13 split 2:1 → 9 / 4 (largest-remainder; index tiebreak favours bandit).
    expect(a).toEqual({ bandit: 9, ranged: 4 });
  });

  it('fixed counts exceeding C → weight-count units resolve to 0 (fixed still placed)', () => {
    const spec: WaveSpec = {
      levelBudget: { kind: 'fixed', value: 8 },
      count: { kind: 'fixed', value: 5 },
      units: [
        { archetype: 'bandit', count: { kind: 'fixed', value: 8 }, level: { kind: 'weight', weight: 1 } },
        { archetype: 'ranged', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } },
        { archetype: 'mage', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } },
      ],
    };
    const team = resolveWave(spec, ctx(), new RNG(1));
    expect(counts(team)).toEqual({ bandit: 8 }); // ranged + mage → 0
  });

  it('count: hand reads context.handSize × factor', () => {
    const spec: WaveSpec = {
      levelBudget: { kind: 'fixed', value: 10 },
      count: { kind: 'hand', factor: 1.5 },
      units: [{ archetype: 'bandit', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } }],
    };
    expect(resolveWave(spec, ctx({ handSize: 6 }), new RNG(1))).toHaveLength(9); // round(6 × 1.5)
    expect(resolveWave(spec, ctx({ handSize: 4 }), new RNG(1))).toHaveLength(6); // round(4 × 1.5)
  });

  it('weight-count ratios hold across totals (proportional, large C)', () => {
    const spec = (c: number): WaveSpec => ({
      levelBudget: { kind: 'fixed', value: 200 },
      count: { kind: 'fixed', value: c },
      units: [
        { archetype: 'bandit', count: { kind: 'weight', weight: 3 }, level: { kind: 'weight', weight: 1 } },
        { archetype: 'ranged', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } },
      ],
    });
    for (const c of [4, 8, 40, 100]) {
      const m = counts(resolveWave(spec(c), ctx(), new RNG(1)));
      expect((m.bandit ?? 0) + (m.ranged ?? 0)).toBe(c);
      expect(m.bandit! / m.ranged!).toBeCloseTo(3, 0); // ≈ 3:1
    }
  });
});

describe('resolveWave — level distribution', () => {
  it('total level == the budget when affordable, every unit ≥ 1', () => {
    const spec: WaveSpec = {
      levelBudget: { kind: 'fixed', value: 24 },
      count: { kind: 'fixed', value: 6 },
      units: [{ archetype: 'bandit', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } }],
    };
    for (let s = 0; s < 30; s++) {
      const team = resolveWave(spec, ctx(), new RNG(s));
      expect(team).toHaveLength(6);
      expect(team.reduce((a, u) => a + u.level, 0)).toBe(24);
      expect(Math.min(...team.map((u) => u.level))).toBeGreaterThanOrEqual(1);
    }
  });

  it('uniform level-weights → a TIGHT even spread (≤ 1), like distributeBudget', () => {
    const spec: WaveSpec = {
      levelBudget: { kind: 'fixed', value: 17 },
      count: { kind: 'fixed', value: 5 },
      units: [{ archetype: 'bandit', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } }],
    };
    for (let s = 0; s < 30; s++) {
      const lv = resolveWave(spec, ctx(), new RNG(s)).map((u) => u.level);
      expect(Math.max(...lv) - Math.min(...lv)).toBeLessThanOrEqual(1);
    }
  });

  it('per-instance weighting: a higher level-weight type gets HIGHER-level individuals', () => {
    // 2 elite archers (weight 4) + 4 fodder bandits (weight 1), budget 30.
    const spec: WaveSpec = {
      levelBudget: { kind: 'fixed', value: 30 },
      count: { kind: 'fixed', value: 6 },
      units: [
        { archetype: 'bandit', count: { kind: 'fixed', value: 4 }, level: { kind: 'weight', weight: 1 } },
        { archetype: 'ranged', count: { kind: 'fixed', value: 2 }, level: { kind: 'weight', weight: 4 } },
      ],
    };
    const team = resolveWave(spec, ctx(), new RNG(3));
    const archerLv = team.filter((u) => u.archetype === 'ranged').map((u) => u.level);
    const banditLv = team.filter((u) => u.archetype === 'bandit').map((u) => u.level);
    expect(Math.min(...archerLv)).toBeGreaterThan(Math.max(...banditLv));
    expect(team.reduce((a, u) => a + u.level, 0)).toBe(30);
  });

  it('fixed levels pin their instances (honoured ABOVE a present cap — authored elite)', () => {
    const spec: WaveSpec = {
      levelBudget: { kind: 'fixed', value: 100 },
      count: { kind: 'fixed', value: 3 },
      levelCap: { kind: 'fixed', value: 5 },
      units: [
        { archetype: 'catapult', count: { kind: 'fixed', value: 1 }, level: { kind: 'fixed', value: 15 } },
        { archetype: 'bandit', count: { kind: 'fixed', value: 2 }, level: { kind: 'weight', weight: 1 } },
      ],
    };
    const team = resolveWave(spec, ctx(), new RNG(1));
    const boss = team.find((u) => u.archetype === 'catapult')!;
    expect(boss.level).toBe(15); // pinned, NOT clamped to cap 5
    // The 2 bandits split the remaining 85, each clamped to cap 5.
    for (const u of team.filter((u) => u.archetype === 'bandit')) {
      expect(u.level).toBe(5);
    }
  });

  it('budget below the instance count → each floored at 1 (level must be positive)', () => {
    const spec: WaveSpec = {
      levelBudget: { kind: 'fixed', value: 2 }, // 2 budget, 6 units
      count: { kind: 'fixed', value: 6 },
      units: [{ archetype: 'bandit', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } }],
    };
    const team = resolveWave(spec, ctx(), new RNG(1));
    expect(team.map((u) => u.level)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('levelBudget mean/median = factor × centralLevel × handSize (= factor × playerTeamLevel)', () => {
    const oneEach = (lb: WaveSpec['levelBudget']): WaveSpec => ({
      levelBudget: lb,
      count: { kind: 'fixed', value: 1 },
      units: [{ archetype: 'bandit', count: { kind: 'fixed', value: 1 }, level: { kind: 'weight', weight: 1 } }],
    });
    const r = roster([2, 4, 4, 10]); // mean 5, median 4
    // handSize 3 → the single unit absorbs the whole budget = factor × central × 3
    // (no levelCap on the spec → the spread is uncapped, so it reaches the budget).
    const c = ctx({ roster: r, handSize: 3 });
    expect(resolveWave(oneEach({ kind: 'mean', factor: 2 }), c, new RNG(1))[0]!.level).toBe(30); // 2 × 5 × 3
    expect(resolveWave(oneEach({ kind: 'median', factor: 2 }), c, new RNG(1))[0]!.level).toBe(24); // 2 × 4 × 3
    // Doubling the fielded hand doubles the budget (the playerTeamLevel scaling).
    const c6 = ctx({ roster: r, handSize: 6 });
    expect(resolveWave(oneEach({ kind: 'mean', factor: 2 }), c6, new RNG(1))[0]!.level).toBe(60); // 2 × 5 × 6
  });

  it('builds via the deterministic scaledUnit path (stats == scaleStats)', () => {
    const spec: WaveSpec = {
      levelBudget: { kind: 'fixed', value: 20 },
      count: { kind: 'fixed', value: 4 },
      units: [{ archetype: 'bandit', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } }],
    };
    for (const u of resolveWave(spec, ctx(), new RNG(2))) {
      const cfg = ARCHETYPE_CONFIG[u.archetype];
      expect(u.stats).toEqual(scaleStats(cfg.baseStats, cfg.growthRates, u.level - 1));
    }
  });
});

describe('resolveWave — levelCap (the optional per-wave ceiling)', () => {
  // One weighted unit eating a large budget: with no cap it reaches the full
  // level; a `roster`/`fixed` cap clamps the weighted spread.
  const lone = (cap?: WaveSpec['levelCap']): WaveSpec => ({
    levelBudget: { kind: 'fixed', value: 40 },
    count: { kind: 'fixed', value: 1 },
    ...(cap ? { levelCap: cap } : {}),
    units: [{ archetype: 'bandit', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } }],
  });

  it('absent → UNCAPPED: the weighted spread spends the full budget', () => {
    // roster [5] → a `roster` cap would pin this to 7; absent leaves it at 40.
    expect(resolveWave(lone(), ctx(), new RNG(1))[0]!.level).toBe(40);
  });

  it("'roster' cap = highestRosterLevel + delta (the retired global cap, now per-wave)", () => {
    const team = resolveWave(lone({ kind: 'roster', delta: 2 }), ctx({ roster: roster([5, 8]) }), new RNG(1));
    expect(team[0]!.level).toBe(10); // max(5,8) + 2
  });

  it('roster cap uses max(1, …) for an empty roster', () => {
    const team = resolveWave(lone({ kind: 'roster', delta: 3 }), ctx({ roster: [] }), new RNG(1));
    expect(team[0]!.level).toBe(4); // max(1) + 3
  });

  it("'fixed' cap clamps the weighted spread to an absolute ceiling", () => {
    const spec: WaveSpec = {
      levelBudget: { kind: 'fixed', value: 40 },
      count: { kind: 'fixed', value: 4 },
      levelCap: { kind: 'fixed', value: 6 },
      units: [{ archetype: 'bandit', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } }],
    };
    for (const u of resolveWave(spec, ctx(), new RNG(1))) expect(u.level).toBeLessThanOrEqual(6);
  });
});

describe('resolveWave — determinism & edge cases', () => {
  const spec: WaveSpec = {
    levelBudget: { kind: 'mean', factor: 1.5 },
    count: { kind: 'hand', factor: 1.75 },
    units: [
      { archetype: 'bandit', count: { kind: 'weight', weight: 7 }, level: { kind: 'weight', weight: 1 } },
      { archetype: 'ranged', count: { kind: 'weight', weight: 3 }, level: { kind: 'weight', weight: 1 } },
    ],
  };

  it('is deterministic per seed', () => {
    expect(resolveWave(spec, ctx(), new RNG(42))).toEqual(resolveWave(spec, ctx(), new RNG(42)));
  });

  it('empty unit list → empty team', () => {
    expect(resolveWave({ ...spec, units: [] }, ctx(), new RNG(1))).toEqual([]);
  });

  it('zero total count → empty team', () => {
    expect(resolveWave({ ...spec, count: { kind: 'fixed', value: 0 } }, ctx(), new RNG(1))).toEqual([]);
  });

  it('empty roster → mean/median basis 1 (no divide-by-zero)', () => {
    const team = resolveWave(spec, ctx({ roster: [] }), new RNG(1));
    expect(team.length).toBeGreaterThan(0);
    for (const u of team) expect(u.level).toBeGreaterThanOrEqual(1);
  });
});

describe('distributeWeightedLevels (the generalized distributeBudget primitive)', () => {
  it('each unit ∈ [1, cap], sums to the clamped total', () => {
    const cases: Array<[budget: number, weights: number[], cap: number]> = [
      [10, [1, 1, 1, 1], 5],
      [3, [1, 1, 1, 1, 1], 3], // budget < count → each 1, total = count
      [60, [1, 1, 1, 1, 1, 1], 7], // budget < count·cap
      [50, [1, 1, 1, 1, 1], 7], // budget > count·cap → all maxed at cap
      [30, [4, 1, 1], 20], // weighted
    ];
    for (const [budget, weights, cap] of cases) {
      for (let s = 0; s < 25; s++) {
        const levels = distributeWeightedLevels(new RNG(s), budget, weights, cap);
        expect(levels).toHaveLength(weights.length);
        const total = Math.min(weights.length * cap, Math.max(weights.length, budget));
        expect(levels.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.min(...levels)).toBeGreaterThanOrEqual(1);
        expect(Math.max(...levels)).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('uniform weights → tight even split (max − min ≤ 1), matching distributeBudget', () => {
    for (let s = 0; s < 40; s++) {
      const lv = distributeWeightedLevels(new RNG(s), 17, [1, 1, 1, 1, 1], 6);
      expect(Math.max(...lv) - Math.min(...lv)).toBeLessThanOrEqual(1);
    }
  });

  it('weighted: higher weight → strictly higher level when budget allows', () => {
    const lv = distributeWeightedLevels(new RNG(1), 30, [1, 5], 30);
    expect(lv[1]!).toBeGreaterThan(lv[0]!);
    expect(lv[0]! + lv[1]!).toBe(30);
  });

  it('non-positive total weight falls back to uniform', () => {
    const lv = distributeWeightedLevels(new RNG(1), 12, [0, 0, 0], 10);
    expect(lv.reduce((a, b) => a + b, 0)).toBe(12);
    expect(Math.max(...lv) - Math.min(...lv)).toBeLessThanOrEqual(1);
  });

  it('is deterministic per seed', () => {
    expect(distributeWeightedLevels(new RNG(7), 23, [2, 3, 1], 9)).toEqual(
      distributeWeightedLevels(new RNG(7), 23, [2, 3, 1], 9),
    );
  });
});
