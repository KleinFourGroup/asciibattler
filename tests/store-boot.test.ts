import { describe, expect, it } from 'vitest';
import { repoRead, runtimeGraph, runtimeSpecifiers, type Read } from './importGraph';

// 113c — THE STORE BOOTS FIRST, and reaches no catalog.
//
// The store has to be read before any module that bakes from it: the
// catalogs resolve their prose through the locale as they load, and modules
// evaluate in import order. Two things hold that, and both are pinned here on
// the source text, the surface a bundler follows (importGraph.ts):
//   1. `./store` is main.ts's first import;
//   2. nothing the store's module graph reaches at run time lies outside
//      `src/store/` and `src/buildId.ts`, and it imports no package.
// A type-only import is erased and doesn't count.

const inside = (path: string): boolean => path.startsWith('src/store/') || path === 'src/buildId.ts';

describe('113c — the store boots first', () => {
  it("is main.ts's first import", () => {
    expect(runtimeSpecifiers(repoRead('src/main.ts') ?? '', 'src/main.ts')[0]).toBe('./store');
  });

  it('reaches only its own folder and the build ID, and no package', () => {
    const graph = runtimeGraph('src/store/index.ts', repoRead);
    // The exact set, so the graph can't grow unnoticed.
    expect(graph.files).toEqual([
      'src/buildId.ts',
      'src/store/adapter.ts',
      'src/store/choose.ts',
      'src/store/electron.ts',
      'src/store/index.ts',
      'src/store/store.ts',
      'src/store/web.ts',
    ]);
    expect(graph.files.filter((f) => !inside(f))).toEqual([]);
    expect(graph.packages).toEqual([]);
  });

  it('the walker follows a real graph: main.ts reaches Game and the catalogs', () => {
    // The known answer for the instrument: an empty walk would pass the pin above.
    const graph = runtimeGraph('src/main.ts', repoRead);
    expect(graph.files).toContain('src/Game.ts');
    expect(graph.files).toContain('src/i18n/locale.ts');
    expect(graph.files.some((f) => f.startsWith('src/config/'))).toBe(true);
    expect(graph.packages).toContain('zod');
    expect(graph.files.length).toBeGreaterThan(100);
  });

  it('the walker catches a planted catalog import, and lets a type-only one through', () => {
    const planted = new Map<string, string>([
      ['src/store/index.ts', "import { createStore } from './store';\nimport './runSlot';\nexport { createStore };"],
      ['src/store/store.ts', "import type { z } from 'zod';\nimport { type Run } from '../run/Run';\nexport const createStore = 1;"],
      ['src/store/runSlot.ts', "import { Run } from '../run/Run';\nexport const slot = Run;"],
      ['src/run/Run.ts', "import { DECK } from '../config/deck';\nimport { z } from 'zod';\nexport class Run {}"],
      ['src/config/deck.ts', 'export const DECK = 1;'],
    ]);
    const read: Read = (path) => planted.get(path);
    const graph = runtimeGraph('src/store/index.ts', read);
    expect(graph.files.filter((f) => !inside(f))).toEqual(['src/config/deck.ts', 'src/run/Run.ts']);
    expect(graph.packages).toEqual(['zod']);

    // The same files with the slot left out: the type-only imports alone reach nothing.
    planted.set('src/store/index.ts', "import { createStore } from './store';\nexport { createStore };");
    const clean = runtimeGraph('src/store/index.ts', read);
    expect(clean.files).toEqual(['src/store/index.ts', 'src/store/store.ts']);
    expect(clean.packages).toEqual([]);
  });

  it('the walker sees a dynamic import and a re-export', () => {
    const source = "export * from './a';\nexport type { T } from './b';\nconst m = await import('./c');\nimport type { U } from './d';";
    expect(runtimeSpecifiers(source, 'x.ts')).toEqual(['./a', './c']);
  });
});
