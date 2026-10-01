import { readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chainTo, repoRead, runtimeGraph, type Read } from './importGraph';

// 113d — HEADLESS NEVER REACHES THE STORE (Round 8 spec D1).
//
// The simulation, the run model, the bots and the fuzz harness must never
// write a player's store, and the structural way to hold that is that none of
// them can reach the store's modules at run time, directly or through
// anything they import. The run journal (src/journal) is held to the same
// rule: its recorder and its replay run headless, and the game layer decides
// where a journal is kept. eslint.config.js bans the direct import, for the
// editor; this is the guard, because the pre-commit hook runs `npm test` and
// not lint, and because it follows the whole graph.

const HEADLESS_ROOTS = ['src/sim', 'src/run', 'src/bot', 'src/journal', 'tests/fuzz'] as const;
const isStore = (path: string): boolean => path.startsWith('src/store/');

/** Every `.ts` file under `dir` (repo-relative, forward slashes). Fuzz output
 *  is data the harness wrote, not source. */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) {
      if (path !== 'tests/fuzz/output') out.push(...sourcesUnder(path));
    } else if (name.endsWith('.ts')) out.push(path);
  }
  return out;
}

/** Each store module the entries reach, with the import chain that reaches it. */
function storeReaches(entries: readonly string[], read: Read): string[] {
  const graph = runtimeGraph(entries, read);
  return graph.files.filter(isStore).map((f) => chainTo(f, graph).join(' → '));
}

describe('113d — headless never reaches the store', () => {
  const entries = HEADLESS_ROOTS.flatMap(sourcesUnder);

  it('no file under src/sim, src/run, src/bot, src/journal or tests/fuzz reaches src/store at run time', () => {
    expect(storeReaches(entries, repoRead)).toEqual([]);
  });

  it('the walk covers the folders it guards', () => {
    // Known answers for the instrument: an empty or shallow walk would pass.
    for (const root of HEADLESS_ROOTS) expect(entries.some((e) => e.startsWith(`${root}/`)), root).toBe(true);
    expect(entries).toContain('src/sim/World.ts');
    expect(entries).toContain('src/run/Run.ts');
    expect(entries).toContain('tests/fuzz/harness.ts');
    expect(entries).toContain('src/journal/JournalRecorder.ts');
    expect(entries.every((e) => !e.startsWith('tests/fuzz/output/'))).toBe(true);
    // 298 when written (120 sim, 41 run, 23 bot, 114 fuzz, by a separate `find`).
    expect(entries.length).toBeGreaterThan(250);
    const graph = runtimeGraph(entries, repoRead);
    // The harness reaches well outside its own folders, so the walk is following imports.
    expect(graph.files.some((f) => f.startsWith('src/config/'))).toBe(true);
    expect(graph.files.some((f) => f.startsWith('src/core/'))).toBe(true);
  });

  it('a planted import is reported with its chain, direct or through another module', () => {
    const planted = new Map<string, string>([
      ['src/sim/World.ts', "import { helper } from './helper';\nexport const world = helper;"],
      ['src/sim/helper.ts', "import { save } from '../save/slot';\nexport const helper = save;"],
      ['src/save/slot.ts', "import { store } from '../store';\nexport const save = store;"],
      ['src/store/index.ts', "import { createStore } from './store';\nexport const store = createStore;"],
      ['src/store/store.ts', 'export const createStore = 1;'],
      ['src/run/Run.ts', "import type { Store } from '../store/store';\nexport class Run {}"],
      ['tests/fuzz/harness.ts', "import { store } from '../../src/store';\nexport const h = store;"],
    ]);
    const read: Read = (path) => planted.get(path);
    // Through two modules, from the simulation.
    expect(storeReaches(['src/sim/World.ts'], read)).toEqual([
      'src/sim/World.ts → src/sim/helper.ts → src/save/slot.ts → src/store/index.ts',
      'src/sim/World.ts → src/sim/helper.ts → src/save/slot.ts → src/store/index.ts → src/store/store.ts',
    ]);
    // Directly, from the harness.
    expect(storeReaches(['tests/fuzz/harness.ts'], read)[0]).toBe('tests/fuzz/harness.ts → src/store/index.ts');
    // A type-only import reaches nothing.
    expect(storeReaches(['src/run/Run.ts'], read)).toEqual([]);
  });
});
