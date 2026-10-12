import { describe, expect, it } from 'vitest';
import { CAMPS } from '../../src/config/camps';
import { HEALTH } from '../../src/config/health';
import { configModules, dumpConfig, toJsonable } from './configDump';
import { describeDifference, jsonDiff, pathShape, summarize } from './jsonDiff';

// The two path-by-path proofs (jsonDiff.ts, configDump.ts). Each is held
// against a value compared with itself, which must be empty, and against a
// plant it must name.

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('jsonDiff', () => {
  const run = {
    bits: 12,
    team: [
      { id: 1, hp: 30, fatigue: 0 },
      { id: 2, hp: 18, fatigue: 2 },
    ],
    cache: ['a', 'b'],
    map: { rootId: 0, nodes: { n0: { kind: 'battle' } } },
  };

  it('finds nothing between a value and its copy', () => {
    expect(jsonDiff(run, clone(run))).toEqual([]);
    expect(jsonDiff(null, null)).toEqual([]);
    expect(jsonDiff([], [])).toEqual([]);
  });

  it('names a field removed from every unit, and nothing else', () => {
    const slim = clone(run) as { team: { fatigue?: number }[] };
    for (const unit of slim.team) delete unit.fatigue;
    const differences = jsonDiff(run, slim);
    expect(differences.map(describeDifference)).toEqual(['removed team[0].fatigue: 0', 'removed team[1].fatigue: 2']);
    expect(summarize(differences)).toEqual(['removed team[].fatigue ×2']);
  });

  it('names a changed value, an added field, and an array that grew or shrank', () => {
    const other = clone(run) as typeof run & { map: { seed?: number } };
    other.bits = 15;
    other.map.seed = 7;
    other.cache = ['a'];
    other.team.push({ id: 3, hp: 9, fatigue: 0 });
    expect(jsonDiff(run, other).map(describeDifference)).toEqual([
      'changed bits: 12 → 15',
      'added team[2]: {"id":3,"hp":9,"fatigue":0}',
      'removed cache[1]: "b"',
      'added map.seed: 7',
    ]);
  });

  it('reports the same keys in another order, since code that walks the keys behaves by it', () => {
    const reordered = { team: run.team, bits: run.bits, cache: run.cache, map: run.map };
    expect(jsonDiff(run, reordered)).toEqual([
      { kind: 'reordered', path: '', before: '["bits","team","cache","map"]', after: '["team","bits","cache","map"]' },
    ]);
  });

  it('reports a value whose type changed as changed, at its own path', () => {
    expect(jsonDiff({ a: { b: [1] } }, { a: { b: { 0: 1 } } }).map(describeDifference)).toEqual(['changed a.b: [1] → {"0":1}']);
    expect(jsonDiff({ a: null }, { a: 0 }).map(describeDifference)).toEqual(['changed a: null → 0']);
  });

  it('drops array indices from a path’s shape', () => {
    expect(pathShape('team[12].stats[0].hp')).toBe('team[].stats[].hp');
  });
});

describe('dumpConfig', () => {
  it('holds what the loaders export, under the export’s name, with its module', async () => {
    const dump = await dumpConfig();
    expect(dump.HEALTH).toEqual({ module: 'src/config/health.ts', value: clone(HEALTH) });
    expect(dump.CAMPS).toEqual({ module: 'src/config/camps.ts', value: clone(CAMPS) });
    // Every loader module contributes: an empty or shallow walk would pass the lines above.
    const modules = new Set(Object.values(dump).map((e) => e.module));
    expect(modules.size).toBeGreaterThanOrEqual(configModules().length - 2);
    expect(configModules()).toContain('units.ts');
    expect(configModules().every((name) => !name.endsWith('.test.ts'))).toBe(true);
    // Functions and schemas are the parsing, not what was parsed.
    expect(dump.getCamp).toBeUndefined();
    expect(dump.CampsSchema).toBeUndefined();
    expect(JSON.stringify(dump)).not.toContain('#function');
  });

  it('is the same on a second dump', async () => {
    expect(jsonDiff(await dumpConfig(), await dumpConfig())).toEqual([]);
  });

  it('a changed number is named at its path, and a moved export shows as its module only', async () => {
    const before = await dumpConfig();
    const changed = clone(before) as Record<string, { module: string; value: { restHealFraction: number } }>;
    changed.HEALTH!.value.restHealFraction = 0.5;
    expect(jsonDiff(before, changed).map(describeDifference)).toEqual([
      `changed HEALTH.value.restHealFraction: ${HEALTH.restHealFraction} → 0.5`,
    ]);
    const moved = clone(before);
    moved.HEALTH = { ...moved.HEALTH!, module: 'src/config/sim.ts' };
    expect(jsonDiff(before, moved).map(describeDifference)).toEqual([
      'changed HEALTH.module: "src/config/health.ts" → "src/config/sim.ts"',
    ]);
  });
});

describe('toJsonable', () => {
  it('keeps what JSON would drop or flatten', () => {
    expect(
      toJsonable({ m: new Map([['a', 1]]), s: new Set([2]), f: () => 0, u: undefined, n: null, list: [new Set(['x'])] }),
    ).toEqual({ m: { '#map': [['a', 1]] }, s: { '#set': [2] }, f: '#function', u: '#undefined', n: null, list: [{ '#set': ['x'] }] });
  });
});
