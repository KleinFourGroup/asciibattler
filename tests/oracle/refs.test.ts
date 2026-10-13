import { describe, expect, it } from 'vitest';
import { computedReads, count, exportsOf, membersOf, openProject, readerKind, schemaKeys, standing, type Named } from './refs';

// The reference finder (refs.ts) against planted answers: a small program of
// files that are not on disk, where what reads what is known by construction,
// and one key of the real config, which holds the finder to zod's inferred
// types as the installed zod makes them.

const LIB = `
import { z } from 'zod';
export const used = 1;
export const lonely = 2;
export const tested = 3;
export const forTools = 5;
export function inner(): number { return helper(); }
export function helper(): number { return 4; }
export interface Options { seed: number; unused?: number }
const Schema = z.object({
  speed: z.number(),
  dead: z.number(),
  nested: z.object({ deep: z.number() }),
  list: z.array(z.object({ id: z.string() })),
  unpacked: z.number(),
});
export const CONFIG = Schema.parse({ speed: 1, dead: 2, nested: { deep: 3 }, list: [], unpacked: 4 });
const listed = 6;
const alsoListed = 7;
export { listed, alsoListed as renamed };
export const handed = 8;
export interface Counter { steps: number; idle: number }
`;
const GAME = `
import { CONFIG, handed, inner, used, type Counter, type Options } from './lib';
export const total = used + inner() + CONFIG.speed + CONFIG.nested.deep + CONFIG.list.length;
export function start(options: Options): number { return options.seed; }
declare const key: 'speed' | 'dead';
export const byKey = CONFIG[key];
declare const i: number;
export const nth = CONFIG.list[i];
const { unpacked } = CONFIG;
export const got = unpacked;
export const bag = { handed };
declare const counter: Counter;
export const label = \`n\${++counter.steps}\`;
counter.idle++;
`;
const TEST = `
import { CONFIG, tested, type Options } from './lib';
export const sum = tested + CONFIG.speed;
const unused = 2;
export const options: Options = { seed: 1, unused };
`;
const BARREL = `export { lonely } from './lib';\n`;
const TOOL = `import { CONFIG, forTools, listed } from '../../src/zzrefs/lib';\nexport const shown = [CONFIG.nested, forTools, listed];\n`;

const project = openProject(
  '.',
  new Map([
    ['src/zzrefs/lib.ts', LIB],
    ['src/zzrefs/game.ts', GAME],
    ['src/zzrefs/lib.test.ts', TEST],
    ['src/zzrefs/barrel.ts', BARREL],
    ['tools/zzrefs/tool.ts', TOOL],
  ]),
  true,
);
const byName = (list: readonly Named[]): Record<string, Named> => Object.fromEntries(list.map((n) => [n.name, n]));
const standings = (list: readonly Named[]): Record<string, string> => Object.fromEntries(list.map((n) => [n.name, standing(n)]));

describe('the reference finder, on a planted program', () => {
  it('says where each export stands', () => {
    const found = exportsOf(project, 'src/zzrefs/lib.ts');
    expect(standings(found)).toEqual({ used: 'used', lonely: 'unread', tested: 'test-only', forTools: 'used', inner: 'used', helper: 'own-only', Options: 'used', CONFIG: 'used', listed: 'used', renamed: 'unread', handed: 'used', Counter: 'used' });
    // A re-export hands the name on and reads nothing.
    expect(byName(found).lonely!.references).toEqual([{ file: 'src/zzrefs/barrel.ts', line: 1, kind: 'game', use: 'pass' }]);
    expect(count(byName(found).CONFIG!, 'tool', 'read')).toBe(1);
    expect(count(byName(found).used!, 'game', 'pass')).toBe(1);
  });

  it('follows a schema key through the inferred type to its reads, by path', () => {
    const found = schemaKeys(project, 'src/zzrefs/lib.ts');
    expect(standings(found)).toEqual({
      'Schema.speed': 'used',
      'Schema.dead': 'unread',
      'Schema.nested': 'used',
      'Schema.nested.deep': 'used',
      'Schema.list': 'used',
      'Schema.list.[].id': 'unread',
      // Read only by `const { unpacked } = CONFIG`.
      'Schema.unpacked': 'used',
    });
    expect(count(byName(found)['Schema.speed']!, 'game', 'read')).toBe(1);
    expect(count(byName(found)['Schema.speed']!, 'test', 'read')).toBe(1);
    expect(byName(found)['Schema.nested']!.references.map((r) => `${r.kind} ${r.use}`).sort()).toEqual(['game read', 'tool read']);
  });

  it('tells a member that is only set from one that is read', () => {
    const found = byName(membersOf(project, 'src/zzrefs/lib.ts', 'Options'));
    expect(standing(found['Options.seed']!)).toBe('used');
    expect(standing(found['Options.unused']!)).toBe('unread');
    // `{ seed: 1, unused }` builds the member from a variable of its name: a write of the member.
    expect(found['Options.unused']!.references).toEqual([{ file: 'src/zzrefs/lib.test.ts', line: 5, kind: 'test', use: 'write' }]);
    expect(() => membersOf(project, 'src/zzrefs/lib.ts', 'Missing')).toThrow(/no interface or type literal named Missing/);
  });

  it('takes `{ name }` for a read of the variable, and a step whose result is used for a read', () => {
    // `handed` is read nowhere but in `{ handed }`.
    const handed = byName(exportsOf(project, 'src/zzrefs/lib.ts')).handed!;
    expect(handed.references.map((r) => `${r.kind} ${r.use}`).sort()).toEqual(['game pass', 'game read']);
    const counter = byName(membersOf(project, 'src/zzrefs/lib.ts', 'Counter'));
    // `n${++counter.steps}` uses what it writes; `counter.idle++` on a line of its own does not.
    expect(standing(counter['Counter.steps']!)).toBe('used');
    expect(standing(counter['Counter.idle']!)).toBe('unread');
    expect(counter['Counter.idle']!.references.map((r) => r.use)).toEqual(['write']);
  });

  it('lists the read by a computed key that it cannot follow', () => {
    const found = computedReads(project, ['src/zzrefs/game.ts', 'src/zzrefs/lib.ts']);
    expect(found.map((r) => `${r.file}:${r.line}`)).toEqual(['src/zzrefs/game.ts:6']);
    // That read is of `dead` as much as of `speed`, and `dead` stands unread above: the blind spot, shown.
    // An array read by a number is not one: line 8 is left out.
  });

  it('sorts a reader by its path', () => {
    const kinds = ['src/sim/World.ts', 'src/dev/devKeys.ts', 'src/bot/rollout.ts', 'tests/fuzz/harness.ts', 'tests/importGraph.ts', 'src/run/Run.test.ts', 'tools/x/main.ts', 'scripts/replay.ts'].map((f) => readerKind(f, 'src/run/Run.ts'));
    expect(kinds).toEqual(['game', 'dev', 'instrument', 'instrument', 'test', 'test', 'tool', 'script']);
    expect(readerKind('src/run/Run.ts', 'src/run/Run.ts')).toBe('own');
  });
});

describe('the reference finder, on the repo', () => {
  it('finds the run model reading config/economy.json’s one key, and not RunConfig’s field of the same name', { timeout: 120_000 }, () => {
    const repo = openProject();
    const key = schemaKeys(repo, 'src/config/economy.ts').find((k) => k.name === 'EconomySchema.startingBits')!;
    expect(key.references.filter((r) => r.kind === 'game').map((r) => `${r.file} ${r.use}`)).toEqual(['src/run/Run.ts read']);
    // `git grep -w startingBits` also finds src/run/RunConfig.ts, which declares another name.
    expect(key.references.some((r) => r.file === 'src/run/RunConfig.ts')).toBe(false);
    const field = membersOf(repo, 'src/run/RunConfig.ts', 'RunConfig').find((m) => m.name === 'RunConfig.startingBits')!;
    expect(count(field, 'game', 'read')).toBeGreaterThan(0);
  });
});
