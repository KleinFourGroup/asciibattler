import { describe, it, expect } from 'vitest';
import { ENCOUNTERS, EncountersSchema, ENCOUNTER_KINDS } from './encounters';
import { SECTOR_IDS } from './sectors';

// A deeply-nested grammar fixture exercising the recursive `waves` zod:
// stages → loop(forever) → pick → wave, plus a final open-ended stage.
const nestedWaves = [
  {
    kind: 'stages',
    stages: [
      {
        until: { kind: 'enemyPoolAtOrBelow', fraction: 0.5 },
        body: [
          {
            kind: 'loop',
            repeat: 'forever',
            body: [
              {
                kind: 'pick',
                options: [
                  {
                    entry: {
                      kind: 'wave',
                      spec: {
                        levelBudget: { kind: 'mean', factor: 1 },
                        count: { kind: 'hand', factor: 1 },
                        units: [{ archetype: 'bandit', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } }],
                      },
                    },
                    weight: 1,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        body: [
          {
            kind: 'wave',
            spec: {
              levelBudget: { kind: 'fixed', value: 10 },
              count: { kind: 'fixed', value: 1 },
              units: [{ archetype: 'catapult', count: { kind: 'fixed', value: 1 }, level: { kind: 'fixed', value: 5 } }],
            },
          },
        ],
      },
    ],
  },
];

const base = {
  id: 'fixture',
  name: 'Fixture',
  healthPool: 8,
  sectors: [SECTOR_IDS[0]!],
  waves: nestedWaves,
};

describe('encounters schema', () => {
  it('the shipped catalog is empty (V populates it; the reproduction is code-built)', () => {
    expect(ENCOUNTERS).toEqual([]);
  });

  it('parses a deeply-nested wave grammar (stages → loop → pick → wave)', () => {
    const parsed = EncountersSchema.parse([base]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.waves[0]!.kind).toBe('stages');
  });

  it('kind defaults to normal and accepts each enum value', () => {
    expect(EncountersSchema.parse([base])[0]!.kind).toBe('normal');
    for (const kind of ENCOUNTER_KINDS) {
      expect(EncountersSchema.parse([{ ...base, kind }])[0]!.kind).toBe(kind);
    }
  });

  it('rejects an unknown archetype in a wave unit', () => {
    const bad = {
      ...base,
      waves: [
        {
          kind: 'wave',
          spec: {
            levelBudget: { kind: 'fixed', value: 1 },
            count: { kind: 'fixed', value: 1 },
            units: [{ archetype: 'wizard', count: { kind: 'fixed', value: 1 }, level: { kind: 'fixed', value: 1 } }],
          },
        },
      ],
    };
    expect(EncountersSchema.safeParse([bad]).success).toBe(false);
  });

  it('rejects an empty wave list and empty units', () => {
    expect(EncountersSchema.safeParse([{ ...base, waves: [] }]).success).toBe(false);
    const emptyUnits = {
      ...base,
      waves: [{ kind: 'wave', spec: { levelBudget: { kind: 'fixed', value: 1 }, count: { kind: 'fixed', value: 1 }, units: [] } }],
    };
    expect(EncountersSchema.safeParse([emptyUnits]).success).toBe(false);
  });

  it('rejects a malformed stage condition (out-of-range fraction)', () => {
    const bad = {
      ...base,
      waves: [
        {
          kind: 'stages',
          stages: [
            { until: { kind: 'enemyPoolAtOrBelow', fraction: 1.5 }, body: nestedWaves[0]!.stages[1]!.body },
            { body: nestedWaves[0]!.stages[1]!.body },
          ],
        },
      ],
    };
    expect(EncountersSchema.safeParse([bad]).success).toBe(false);
  });
});
