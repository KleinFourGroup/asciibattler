import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { OPERATORS, applyEdit, describeEdit, edits, editsOn, type Edit, type Operator } from './plant';

// The planted break's edit maker (plant.ts), against known answers: which
// edits a line admits, what is left alone, that an edited file still parses,
// and that each kind of edit changes what the code returns.

const SOURCE = [
  "import { a } from './a';", // 1
  'type Width = 3;', // 2
  'enum Kind { One = 1 }', // 3
  'declare const limit = 3;', // 4
  'export function step(hp: number, name: string): number {', // 5
  '  if (hp <= 0) return 0;', // 6
  '  const label = name + "!";', // 7
  '  log(label);', // 8
  '  for (let i = 0; i < 3; i++) hp -= i;', // 9
  '  const table = { 0: hp, cap: 9 };', // 10
  '  return hp > table.cap ? table.cap : hp + 1;', // 11
  '}',
].join('\n');

const shown = (list: readonly Edit[]): string[] => list.map((e) => `${e.operator} ${e.was} → ${e.text}`);
const syntaxErrors = (source: string): number => ts.transpileModule(source, { reportDiagnostics: true }).diagnostics?.length ?? 0;

/** What `call` returns once `source` is compiled, with the first `operator` edit made or with none. */
function run(source: string, call: string, operator?: Operator): unknown {
  const edit = operator === undefined ? undefined : edits('case.ts', source).find((e) => e.operator === operator);
  if (operator !== undefined && edit === undefined) throw new Error(`no ${operator} edit in the case`);
  const js = ts.transpileModule(edit === undefined ? source : applyEdit(source, edit), {}).outputText;
  return new Function(`${js}; return ${call};`)();
}

describe('the planted break: which edits a line admits', () => {
  it('lists each kind where it applies', () => {
    expect(shown(editsOn('s.ts', SOURCE, 6))).toEqual(['negate hp <= 0 → !(hp <= 0)', 'boundary <= → <', 'bump 0 → 1', 'bump 0 → 1']);
    expect(shown(editsOn('s.ts', SOURCE, 8))).toEqual(['drop log(label); → ;']);
    expect(shown(editsOn('s.ts', SOURCE, 9))).toEqual(['bump 0 → 1', 'negate i < 3 → !(i < 3)', 'boundary < → <=', 'bump 3 → 4', 'sign -= → +=']);
    expect(shown(editsOn('s.ts', SOURCE, 11))).toEqual(['negate hp > table.cap → !(hp > table.cap)', 'boundary > → >=', 'sign + → -', 'bump 1 → 2']);
    expect(new Set(edits('s.ts', SOURCE).map((e) => e.operator))).toEqual(new Set(OPERATORS));
  });

  it('leaves alone what computes nothing: an import, a type, an enum member, a declare, a joined string, a property name', () => {
    for (const line of [1, 2, 3, 4, 7]) expect(editsOn('s.ts', SOURCE, line), `line ${line}`).toEqual([]);
    expect(shown(editsOn('s.ts', SOURCE, 10))).toEqual(['bump 9 → 10']);
    expect(edits('s.ts', 'class B extends A { constructor() { super(); this.go(); } }').map((e) => e.was)).toEqual(['this.go();']);
    // A number too large for one more to change it, and a call behind an await.
    // A number in a parameter's type or behind an 'as' is a type too.
    expect(edits('s.ts', 'function f(mode: 0 | 1) { return mode as 1; }')).toEqual([]);
    expect(edits('s.ts', 'const big = 1e21;')).toEqual([]);
    expect(edits('s.ts', 'async function f() { await go(); }').map((e) => e.was)).toEqual(['await go();']);
  });

  it('describes an edit in one line', () => {
    expect(describeEdit(editsOn('s.ts', SOURCE, 8)[0]!)).toBe('drop     log(label);  →  (removed)');
    expect(describeEdit(editsOn('s.ts', SOURCE, 9)[2]!)).toBe('boundary <  →  <=');
  });
});

describe('the planted break: an edit made', () => {
  it('leaves a file that parses and differs, for every edit of the case and of a real source file', () => {
    const real = readFileSync('src/core/RNG.ts', 'utf8');
    expect(syntaxErrors(real)).toBe(0);
    for (const [name, source] of [['s.ts', SOURCE], ['src/core/RNG.ts', real]] as const) {
      const all = edits(name, source);
      expect(all.length, name).toBeGreaterThan(10);
      for (const edit of all) {
        const edited = applyEdit(source, edit);
        expect(edited, `${name}:${edit.line} ${edit.operator}`).not.toBe(source);
        expect(syntaxErrors(edited), `${name}:${edit.line} ${describeEdit(edit)}`).toBe(0);
      }
    }
  });

  it('is refused when the text is not the text it was listed for', () => {
    const edit = editsOn('s.ts', SOURCE, 8)[0]!;
    expect(() => applyEdit(SOURCE.replace('log(label)', 'say(label)'), edit)).toThrow(/not what the edit was listed for/);
  });

  it('changes what the code returns, kind by kind', () => {
    const pick = 'function f(x) { return x < 3 ? 1 : 2; }';
    expect([run(pick, 'f(0)'), run(pick, 'f(0)', 'negate')]).toEqual([1, 2]);
    expect([run(pick, 'f(3)'), run(pick, 'f(3)', 'boundary')]).toEqual([2, 1]);
    const sum = 'function g(a, b) { return a + b; }';
    expect([run(sum, 'g(5, 2)'), run(sum, 'g(5, 2)', 'sign')]).toEqual([7, 3]);
    const twice = 'function h(x) { return x * 2; }';
    expect([run(twice, 'h(5)'), run(twice, 'h(5)', 'bump')]).toEqual([10, 15]);
    const count = 'let n = 0; function inc() { n = n | 4; } function k() { inc(); return n; }';
    expect([run(count, 'k()'), run(count, 'k()', 'drop')]).toEqual([4, 0]);
  });
});
