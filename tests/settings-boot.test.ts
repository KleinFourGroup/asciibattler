import { describe, expect, it } from 'vitest';
import { repoRead, runtimeGraph, runtimeSpecifiers, type Read } from './importGraph';

// 116a — THE SETTINGS BOOT SECOND, and reach no catalog.
//
// A stored locale has to be set before any catalog resolves its prose, and
// modules evaluate in import order. So the settings' boot module is main.ts's
// second import, right after the store (tests/store-boot.test.ts holds the
// first), and nothing it reaches at run time may be a catalog or a module
// that loads one: a catalog evaluated on the way in would bake its prose
// before the locale was set. Both are pinned on the source text, the surface
// a bundler follows (importGraph.ts). A type-only import is erased and
// doesn't count.

const BOOT = 'src/settings/boot.ts';

describe('116a — the settings boot second', () => {
  it("is main.ts's second import", () => {
    const specifiers = runtimeSpecifiers(repoRead('src/main.ts') ?? '', 'src/main.ts');
    expect(specifiers.slice(0, 2)).toEqual(['./store', './settings/boot']);
  });

  it('reaches the store, its own folder, the locale runtime and the palette, and nothing else', () => {
    const graph = runtimeGraph(BOOT, repoRead);
    // The exact set, so the graph can't grow unnoticed.
    expect(graph.files).toEqual([
      'src/buildId.ts',
      'src/core/fnv1a.ts',
      'src/i18n/locale.ts',
      'src/i18n/prose.ts',
      'src/i18n/provenance.ts',
      'src/render/palette.ts',
      'src/settings/atBoot.ts',
      'src/settings/boot.ts',
      'src/settings/index.ts',
      'src/settings/model.ts',
      'src/settings/settings.ts',
      'src/store/adapter.ts',
      'src/store/choose.ts',
      'src/store/electron.ts',
      'src/store/index.ts',
      'src/store/store.ts',
      'src/store/web.ts',
    ]);
    expect(graph.files.filter((f) => f.startsWith('src/config/') || f.startsWith('locales/'))).toEqual([]);
    expect(graph.packages).toEqual(['zod']);
  });

  // 116f — the boot chooses the palette, so it reaches palette.ts. Every
  // other module that reads `COLORS` must load after the choice, so none of
  // them may be in the boot's graph, and palette.ts itself imports nothing.
  it('reaches the palette and no module that reads it', () => {
    const graph = runtimeGraph(BOOT, repoRead);
    expect(graph.files.filter((f) => f.startsWith('src/render/'))).toEqual(['src/render/palette.ts']);
    expect(runtimeGraph('src/render/palette.ts', repoRead).files).toEqual(['src/render/palette.ts']);
  });

  it('the walker catches a catalog planted behind the settings, and lets a type-only import through', () => {
    const planted = new Map<string, string>([
      [BOOT, "import { settings } from './index';\nexport const boot = settings;"],
      ['src/settings/index.ts', "import { SECTION } from './settings';\nexport const settings = SECTION;"],
      [
        'src/settings/settings.ts',
        "import { KEYBIND_ACTIONS } from '../config/keybindings';\nimport type { ShakePolicy } from '../ui/lossFx';\nexport const SECTION = KEYBIND_ACTIONS;",
      ],
      ['src/config/keybindings.ts', "import { z } from 'zod';\nexport const KEYBIND_ACTIONS = z;"],
    ]);
    const read: Read = (path) => planted.get(path);
    const graph = runtimeGraph(BOOT, read);
    expect(graph.files.filter((f) => f.startsWith('src/config/'))).toEqual(['src/config/keybindings.ts']);
    // The type-only import of src/ui/lossFx reached nothing.
    expect(graph.files.some((f) => f.startsWith('src/ui/'))).toBe(false);
  });
});
