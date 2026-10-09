import { describe, expect, it } from 'vitest';
import { repoRead, runtimeGraph, runtimeSpecifiers, type Read } from './importGraph';

// 117.5i — THE FAILURE WATCH LISTENS BEFORE THE GAME LOADS, and can speak
// whatever failed.
//
// Three things hold that, each pinned here on the source text:
//   1. `./failure` is main.ts's third import, after the store and the
//      settings' boot, so its listeners are on the window before any module
//      of the game is evaluated;
//   2. nothing its module graph reaches at run time is a catalog, three.js,
//      the renderer, the sim or the Game: the plate must go up when one of
//      those is what failed;
//   3. main.ts tells it of a boot that threw and of a game that started, and
//      the plate takes the loading line down (a failed boot leaves it up).
// The walker's own known answers are in store-boot.test.ts.

/** What the failure graph may not reach. */
const forbidden = (path: string): boolean =>
  ['src/config/', 'src/sim/', 'src/run/', 'src/render/', 'src/scenes/', 'src/audio/', 'src/dev/', 'src/store/'].some((dir) =>
    path.startsWith(dir),
  ) ||
  path === 'src/Game.ts' ||
  path === 'src/main.ts' ||
  path === 'src/config.ts';

describe('117.5i — the failure watch boots third and reaches nothing that can fail it', () => {
  it("is main.ts's third import", () => {
    const specifiers = runtimeSpecifiers(repoRead('src/main.ts') ?? '', 'src/main.ts');
    expect(specifiers.slice(0, 3)).toEqual(['./store', './settings/boot', './failure']);
  });

  it('reaches the plate, the shell, the string table and the build ID, and no more', () => {
    const graph = runtimeGraph('src/failure/index.ts', repoRead);
    // The exact set, so the graph can't grow unnoticed.
    expect(graph.files).toEqual([
      'locales/en/ui.json',
      'src/buildId.ts',
      'src/core/fnv1a.ts',
      'src/failure/index.ts',
      'src/failure/rules.ts',
      'src/i18n/locale.ts',
      'src/i18n/prose.ts',
      'src/i18n/provenance.ts',
      'src/i18n/ui.ts',
      'src/ui/FailurePlate.ts',
      'src/ui/button.ts',
      'src/ui/modal.ts',
      'src/ui/tooltip.ts',
    ]);
    expect(graph.files.filter(forbidden)).toEqual([]);
    // zod is the locale's; three.js is not here.
    expect(graph.packages).toEqual(['zod']);
  });

  it('the pin catches a planted reach: a plate that imports the palette, a rule that imports three.js', () => {
    const planted = new Map<string, string>([
      ['src/failure/index.ts', "import { showFailurePlate } from '../ui/FailurePlate';\nimport './rules';\nexport { showFailurePlate };"],
      ['src/failure/rules.ts', "import * as THREE from 'three';\nexport const x = THREE;"],
      ['src/ui/FailurePlate.ts', "import { COLORS } from '../render/palette';\nimport type { Game } from '../Game';\nexport const showFailurePlate = COLORS;"],
      ['src/render/palette.ts', 'export const COLORS = 1;'],
    ]);
    const read: Read = (path) => planted.get(path);
    const graph = runtimeGraph('src/failure/index.ts', read);
    expect(graph.files.filter(forbidden)).toEqual(['src/render/palette.ts']);
    expect(graph.packages).toEqual(['three']);
  });
});

/** What is wrong with the boot's wiring of the watch; empty when it is whole. */
function wiringFaults(main: string): string[] {
  const faults: string[] = [];
  const caught = /boot\(\)\.catch\(\(err: unknown\) => \{([\s\S]*?)\n\}\);/.exec(main);
  if (!caught) faults.push('no catch on the boot');
  else {
    if (!caught[1]!.includes('failure.boot(err)')) faults.push('the catch does not tell the watch');
    if (!caught[1]!.includes('throw err')) faults.push('the catch swallows the error');
  }
  const start = main.indexOf('game.start()');
  const started = main.indexOf('failure.started(() => game.halt(), canvas)');
  if (started < 0) faults.push('the watch is never told the game started');
  else if (start < 0 || started < start) faults.push('the watch is told before the loop starts');
  return faults;
}

describe('117.5i — the boot tells the watch', () => {
  const good = [
    'async function boot() {',
    '  const game = new Game(canvas);',
    '  game.start();',
    '  failure.started(() => game.halt(), canvas);',
    '  return { game };',
    '}',
    'const { game } = await boot().catch((err: unknown) => {',
    '  failure.boot(err);',
    '  throw err;',
    '});',
  ].join('\n');

  it('reads planted boots: no catch, a silent catch, a swallowing one, no start, an early start', () => {
    expect(wiringFaults(good)).toEqual([]);
    expect(wiringFaults(good.replace('.catch((err: unknown) => {\n  failure.boot(err);\n  throw err;\n})', ''))).toEqual([
      'no catch on the boot',
    ]);
    expect(wiringFaults(good.replace('  failure.boot(err);\n', ''))).toEqual(['the catch does not tell the watch']);
    expect(wiringFaults(good.replace('  throw err;\n', ''))).toEqual(['the catch swallows the error']);
    expect(wiringFaults(good.replace('  failure.started(() => game.halt(), canvas);\n', ''))).toEqual([
      'the watch is never told the game started',
    ]);
    const early = good
      .replace('  failure.started(() => game.halt(), canvas);\n', '')
      .replace('  game.start();', '  failure.started(() => game.halt(), canvas);\n  game.start();');
    expect(wiringFaults(early)).toEqual(['the watch is told before the loop starts']);
  });

  it('src/main.ts catches a failed boot and says when the game has started', () => {
    expect(wiringFaults(repoRead('src/main.ts') ?? '')).toEqual([]);
  });

  it('the plate takes the loading line down', () => {
    expect(repoRead('src/ui/FailurePlate.ts') ?? '').toContain("document.getElementById('boot-line')?.remove()");
  });
});
