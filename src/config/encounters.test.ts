import { describe, it, expect } from 'vitest';
import {
  ENCOUNTERS,
  ENCOUNTER_IDS,
  EncountersSchema,
  ENCOUNTER_KINDS,
  getEncounter,
  type Encounter,
} from './encounters';

/** The authored unit archetypes of an encounter's single looped wave (the V1
 *  catalog shape: loop → wave). */
function waveArchetypes(e: Encounter): string[] {
  const loop = e.waves[0]!;
  if (loop.kind !== 'loop') throw new Error('expected a loop');
  const wave = loop.body[0]!;
  if (wave.kind !== 'wave') throw new Error('expected a wave');
  return wave.spec.units.map((u) => u.archetype);
}

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

// No `sectors`/`minHop` here: an encounter owns only its intrinsic eligibility
// (kind + an optional layout fit-filter). Placement (which sectors it's pooled
// in, hop gate, weight) lives on the SECTOR's encounter pool (see sectors.ts).
const base = {
  id: 'fixture',
  name: 'Fixture',
  healthPool: 8,
  waves: nestedWaves,
};

describe('encounters schema', () => {
  it('ships the catalog: the V1 anchors, the V2 grammar demos, the W1 boss, the W2 elites', () => {
    expect(ENCOUNTER_IDS).toEqual([
      // V1 anchors (loop → wave).
      'brigands',
      'highwaymen',
      'deserters',
      // V2 commit-C grammar demos.
      'artillery',
      'ronin-vs-mages',
      'adventurer-with-guards',
      // W1 — the boss (the stages grammar).
      'bandit-king',
      // W2 — the elite detours (harder optional fights).
      'brigand-champions',
      'warband-vanguard',
    ]);
    // Every `kind` value is now exercised by shipped content: the road fights are
    // `normal`, the lone `boss` is the terminal fight, the `elite` detours are
    // the optional harder fights.
    const expectedKind: Record<string, string> = {
      'bandit-king': 'boss',
      'brigand-champions': 'elite',
      'warband-vanguard': 'elite',
    };
    for (const e of ENCOUNTERS) {
      expect(e.kind).toBe(expectedKind[e.id] ?? 'normal');
    }
  });

  it('the V1 variants differ as authored: highwaymen pure-bandit, deserters add a healer', () => {
    expect(waveArchetypes(getEncounter('highwaymen')!)).toEqual(['bandit']);
    const deserters = waveArchetypes(getEncounter('deserters')!);
    expect(deserters).toContain('bandit');
    expect(deserters).toContain('healer');
  });

  it('the commit-C demos carry their grammar features (sequence / pick / finite-loop)', () => {
    // artillery — a forever loop whose body is a 2-wave sequence (skirmishers,
    // then catapults), alternating turn to turn.
    const artillery = getEncounter('artillery')!.waves[0]!;
    expect(artillery.kind).toBe('loop');
    if (artillery.kind === 'loop') expect(artillery.body.length).toBe(2);

    // ronin-vs-mages — a forever loop whose body is a weighted `pick`; because the
    // pick is the whole body, each iteration re-enters and re-rolls it (the
    // "chaotic" per-turn coin-flip, distinct from a roll-once-per-encounter pick).
    const ronin = getEncounter('ronin-vs-mages')!.waves[0]!;
    expect(ronin.kind).toBe('loop');
    if (ronin.kind === 'loop') expect(ronin.body[0]!.kind).toBe('pick');

    // adventurer-with-guards — a top-level FLAT sequence: a finite `loop {repeat:3}`
    // of guards, then a lone boss wave that the last-wave-repeats policy holds.
    const advWaves = getEncounter('adventurer-with-guards')!.waves;
    expect(advWaves.map((w) => w.kind)).toEqual(['loop', 'wave']);
    if (advWaves[0]!.kind === 'loop') expect(advWaves[0]!.repeat).toBe(3);
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

  it('is intrinsic-only: an optional layout fit-filter, no placement fields', () => {
    // The fit-filter (which boards the fight makes sense on) is intrinsic + stays
    // on the encounter; placement (sectors/hop gate) is the sector's job now.
    const parsed = EncountersSchema.parse([{ ...base, layouts: ['river'] }])[0]!;
    expect(parsed.layouts).toEqual(['river']);
    // Placement fields are gone from the schema — a stray one is stripped, not stored.
    const withStray = EncountersSchema.parse([
      { ...base, sectors: ['the-start'], minHop: 3 } as unknown as typeof base,
    ])[0]! as unknown as Record<string, unknown>;
    expect(withStray.sectors).toBeUndefined();
    expect(withStray.minHop).toBeUndefined();
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
