// The store is the first import. Modules evaluate in import order, and the
// catalogs under `./Game` resolve their prose through the locale as they
// load; the store is read before any of them, so a stored setting can decide
// what they bake. tests/store-boot.test.ts holds this line first, and holds
// the store's own imports clear of every catalog.
import './store';
// The settings' boot is the second. It sets the stored locale before the
// catalogs load (src/settings/boot.ts); tests/settings-boot.test.ts holds
// this line second and holds its graph clear of every catalog too.
import './settings/boot';
// The failure watch is the third. It listens from here on, so a module below
// that throws as it loads gets the plate too (src/failure);
// tests/failure-boot.test.ts holds this line third and holds its graph clear
// of the catalogs, three.js and the game.
import { failure } from './failure';

// The self-hosted font subsets (src/fonts.css, built by `npm run gen:font`),
// declared before the FontAtlas is built, which loads the face by name
// before it rasterizes. They are ours because fontsource publishes no subset
// with the box-drawing and block elements that draw the half-cover's `╥` and
// the rubble's `▄` (assets/fonts/jetbrains-mono/README.md).
import './fonts.css';

import { Game } from './Game';
import { FontAtlas } from './render/FontAtlas';
import { installMotionGate } from './render/motion';
import { BUILD_ID } from './buildId';
import { acquireRunLock, type LockManagerLike } from './store/runLock';

// The build's ID on `<html data-build>`, so any build, a production one
// included, can be asked which commit it is.
document.documentElement.dataset.build = BUILD_ID;

// The motion gate stamps `html[data-motion]` from the OS preference before
// any screen renders (the CSS keys off the attribute, the JS off
// `reducedMotion()`); it follows the OS live, and the motion setting
// overrides it.
installMotionGate();

/**
 * The boot: everything from the page's two mounts to the running loop. One
 * function, so that one catch (below) hears whatever it throws: no WebGL
 * context, a font file that didn't load, a Game that failed to build.
 */
async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  if (!canvas) throw new Error('Missing <canvas id="game-canvas"> in index.html');

  const uiMount = document.querySelector<HTMLDivElement>('#ui');
  if (!uiMount) throw new Error('Missing <div id="ui"> in index.html');

  // Everything under src/dev comes in here, by a DEV-gated dynamic import of
  // its one entry (src/dev/devEntry.ts): the dev handle, the trace ring, the
  // dev keys, the board explorer, the probe kit, the planted failures. `DEV`
  // is a build-time constant, so a production build drops the import and
  // with it the whole folder's module graph. A static import would rest on
  // the tree-shaker proving each module's top level pure, which it does not
  // always manage. tests/dev-guard.test.ts holds every reach into src/dev to
  // this shape, and scripts/dev-scan.mjs reads a build for what would have
  // leaked.
  // Loaded before the Game is built, so what it installs afterwards is in the
  // task that starts the loop.
  const dev = import.meta.env.DEV ? await import('./dev/devEntry') : null;
  // The planted boot failures and a board fixture's URL, ahead of what reads
  // them. An `if`, not `dev?.…`: the minifier folds this form's test away and
  // leaves `null?.beforeBoot(…)` of the other in every build.
  if (dev) dev.beforeBoot(location.search);

  // The module pauses here until the font has parsed and the atlas is
  // rasterized. The two-tab lock is asked for beside it, since its answer has
  // to be in hand before the Game, the run slot's writer, exists.
  // `navigator.locks` is missing on a page that isn't a secure context.
  const [fontAtlas, runLock] = await Promise.all([
    FontAtlas.create(),
    acquireRunLock((navigator as { locks?: LockManagerLike }).locks),
  ]);

  // The diagnostics panel, behind a constant only a build made with
  // `VITE_DIAG=1` sets (src/dev/diag/index.ts). It goes in before the Game, the
  // store's writer, so it times the first write too.
  if (import.meta.env.VITE_DIAG === '1') {
    (await import('./dev/diag')).installDiag({ runLock });
  }

  const game = new Game(canvas, fontAtlas, uiMount, runLock);
  // Game's constructor has mounted the first screen, so the loading line that
  // index.html stood up comes down here, in the same task: no frame shows the
  // two together. A boot that throws above this line leaves the line standing,
  // and the failure plate takes it down as it speaks (src/ui/FailurePlate.ts).
  document.getElementById('boot-line')?.remove();
  game.start();
  // The boot is over: from here a failure is the running game's, and the
  // plate halts it before it speaks.
  failure.started(() => game.halt(), canvas);
  // `window.__game`, `window.__probe` and the rest of the dev handle.
  if (dev) dev.installDevHandle(game);
}

// Top-level await: Vite + ESM + modern browsers handle it. A boot that
// throws is told to the player, then thrown on, so the console has it as the
// uncaught error it is.
await boot().catch((err: unknown) => {
  failure.boot(err);
  throw err;
});
