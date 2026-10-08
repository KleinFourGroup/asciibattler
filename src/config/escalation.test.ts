import { describe, it, expect } from 'vitest';
import type { DifficultyMultipliers } from './difficulty';
import {
  ESCALATION_LEVELS,
  ESCALATION_MAX,
  escalationSteps,
  isEscalationLevel,
  type EscalationLevers,
  leverFactors,
  parseEscalation,
  withEscalation,
} from './escalation';

const IDENTITY: DifficultyMultipliers = { waveSize: 1, levelBudget: 1, bits: 1, enemyMorale: 1 };

/**
 * THE SIGNED TABLE (Round 8 spec D8), written here by hand and not read from
 * `config/escalation.json`: what each level does to the four multipliers.
 *
 *   level 1  enemy level budget +10%
 *   level 2  enemy wave +10%       (the count, the budget and the pool)
 *   level 3  bits -25%
 *   level 4  enemy level budget +10% again, +20% in all
 *   level 5  enemy wave +10% again, +20% in all
 *
 * A lever that comes again adds; different levers multiply, so the budget at
 * level 2 is 1.1 x 1.1 and at level 5 is 1.2 x 1.2. The ladder is content the
 * user signed, which is why this test holds the shipped file to literal
 * numbers: a retune of the file is a change to this table too, made together.
 */
const SIGNED: ReadonlyArray<DifficultyMultipliers> = [
  { waveSize: 1, levelBudget: 1, bits: 1, enemyMorale: 1 },
  { waveSize: 1, levelBudget: 1.1, bits: 1, enemyMorale: 1 },
  { waveSize: 1.1, levelBudget: 1.21, bits: 1, enemyMorale: 1.1 },
  { waveSize: 1.1, levelBudget: 1.21, bits: 0.75, enemyMorale: 1.1 },
  { waveSize: 1.1, levelBudget: 1.32, bits: 0.75, enemyMorale: 1.1 },
  { waveSize: 1.2, levelBudget: 1.44, bits: 0.75, enemyMorale: 1.2 },
];

function expectClose(got: DifficultyMultipliers, want: DifficultyMultipliers, name: string): void {
  for (const key of ['waveSize', 'levelBudget', 'bits', 'enemyMorale'] as const) {
    expect(got[key], `${name}: ${key}`).toBeCloseTo(want[key], 12);
  }
}

describe('the Escalation ladder (config/escalation.json)', () => {
  it('has five levels', () => {
    expect(ESCALATION_MAX).toBe(5);
    expect(SIGNED).toHaveLength(ESCALATION_MAX + 1);
  });

  it('each level gives the signed table its four multipliers', () => {
    SIGNED.forEach((want, level) => expectClose(withEscalation(IDENTITY, level), want, `level ${level}`));
  });

  it('level 0 is the identity by construction: the multipliers given are the ones returned', () => {
    const base: DifficultyMultipliers = { waveSize: 1.5, levelBudget: 0.5, bits: 2, enemyMorale: 1.25 };
    expect(withEscalation(base, 0)).toBe(base);
    expect(withEscalation(IDENTITY, 0)).toBe(IDENTITY);
  });

  it("a level's factors multiply onto the run's own multipliers", () => {
    const base: DifficultyMultipliers = { waveSize: 2, levelBudget: 0.5, bits: 2, enemyMorale: 3 };
    expectClose(
      withEscalation(base, 5),
      { waveSize: 2.4, levelBudget: 0.72, bits: 1.5, enemyMorale: 3.6 },
      'level 5 over a base',
    );
  });

  it('a value off the ladder is not a level, and asking for its multipliers throws', () => {
    for (const level of [0, 1, ESCALATION_MAX]) expect(isEscalationLevel(level)).toBe(true);
    for (const value of [-1, ESCALATION_MAX + 1, 2.5, Number.NaN, '3', null, undefined]) {
      expect(isEscalationLevel(value), String(value)).toBe(false);
    }
    expect(() => withEscalation(IDENTITY, ESCALATION_MAX + 1)).toThrow(/not a level/);
    expect(() => withEscalation(IDENTITY, -1)).toThrow(/not a level/);
    expect(() => withEscalation(IDENTITY, 1.5)).toThrow(/not a level/);
  });
});

describe('leverFactors (how the levers combine), on explicit levers', () => {
  it('the wave lever goes to the count, the budget and the pool alike', () => {
    expectClose(
      leverFactors({ levelBudget: 1, wave: 1.5, bits: 1 }),
      { waveSize: 1.5, levelBudget: 1.5, bits: 1, enemyMorale: 1.5 },
      'the wave lever alone',
    );
  });

  it('the budget lever goes to the budget alone', () => {
    expectClose(
      leverFactors({ levelBudget: 1.3, wave: 1, bits: 1 }),
      { waveSize: 1, levelBudget: 1.3, bits: 1, enemyMorale: 1 },
      'the budget lever alone',
    );
  });

  it('the two multiply on the budget, and the bits lever touches nothing else', () => {
    expectClose(
      leverFactors({ levelBudget: 1.5, wave: 2, bits: 0.5 }),
      { waveSize: 2, levelBudget: 3, bits: 0.5, enemyMorale: 2 },
      'all three',
    );
  });
});

describe('parseEscalation (no level is easier than the one under it)', () => {
  const ladder = (...levels: Array<[number, number, number]>): unknown => ({
    levels: levels.map(([levelBudget, wave, bits]) => ({ levelBudget, wave, bits })),
  });

  it('takes a ladder that only climbs, a level that changes nothing included', () => {
    expect(parseEscalation(ladder([1.1, 1, 1], [1.1, 1, 1], [1.1, 1.2, 0.5]))).toHaveLength(3);
  });

  it('refuses a lever that eases, by level and by name', () => {
    expect(() => parseEscalation(ladder([1.1, 1, 1], [1.05, 1, 1]))).toThrow(/level 2 is easier than level 1 on levelBudget/);
    expect(() => parseEscalation(ladder([1, 1.2, 1], [1, 1.1, 1]))).toThrow(/on wave/);
    expect(() => parseEscalation(ladder([1, 1, 0.75], [1, 1, 0.8]))).toThrow(/on bits/);
  });

  it('refuses a first level that is easier than Escalation off', () => {
    expect(() => parseEscalation(ladder([0.9, 1, 1]))).toThrow(/level 1 is easier than level 0 on levelBudget/);
    expect(() => parseEscalation(ladder([1, 1, 1.25]))).toThrow(/level 1 is easier than level 0 on bits/);
  });

  it('refuses an empty ladder', () => {
    expect(() => parseEscalation({ levels: [] })).toThrow();
  });

  it('the shipped ladder parses, which the import above already proved', () => {
    expect(ESCALATION_LEVELS).toHaveLength(ESCALATION_MAX);
  });
});

describe('escalationSteps (what a level adds to the one under it)', () => {
  const ladder = (...levels: Array<[number, number, number]>): readonly EscalationLevers[] =>
    levels.map(([levelBudget, wave, bits]) => ({ levelBudget, wave, bits }));

  it('the shipped ladder adds the signed table, a lever at a time', () => {
    // By hand from the table above: budget, wave, bits, budget again, wave again.
    const added = [1, 2, 3, 4, 5].map((level) => escalationSteps(level));
    expect(added).toEqual([
      [{ lever: 'levelBudget', earlier: 0 }],
      [{ lever: 'wave', earlier: 0 }],
      [{ lever: 'bits', earlier: 0 }],
      [{ lever: 'levelBudget', earlier: 1 }],
      [{ lever: 'wave', earlier: 1 }],
    ]);
  });

  it('level 0 and a value off the ladder add nothing', () => {
    for (const level of [0, -1, 6, 1.5, Number.NaN]) expect(escalationSteps(level), String(level)).toEqual([]);
  });

  it('a level that moves two levers lists both, in the levers’ order', () => {
    const two = ladder([1, 1.1, 0.9], [1.2, 1.1, 0.8]);
    expect(escalationSteps(1, two)).toEqual([
      { lever: 'wave', earlier: 0 },
      { lever: 'bits', earlier: 0 },
    ]);
    expect(escalationSteps(2, two)).toEqual([
      { lever: 'levelBudget', earlier: 0 },
      { lever: 'bits', earlier: 1 },
    ]);
  });

  it('a level that changes nothing adds nothing, and is not counted as an earlier move', () => {
    const flat = ladder([1.1, 1, 1], [1.1, 1, 1], [1.2, 1, 1], [1.3, 1, 1]);
    expect(escalationSteps(2, flat)).toEqual([]);
    expect(escalationSteps(3, flat)).toEqual([{ lever: 'levelBudget', earlier: 1 }]);
    expect(escalationSteps(4, flat)).toEqual([{ lever: 'levelBudget', earlier: 2 }]);
  });
});
