// Bundled FOSS monospace font. Loaded first so canvas2d rasterization in the
// FontAtlas finds it registered when document.fonts.ready resolves.
import '@fontsource/jetbrains-mono/latin-400.css';

import { Game } from './Game';
import { FontAtlas } from './render/FontAtlas';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('Missing <canvas id="game-canvas"> in index.html');

const uiMount = document.querySelector<HTMLDivElement>('#ui');
if (!uiMount) throw new Error('Missing <div id="ui"> in index.html');

// Top-level await: Vite + ESM + modern browsers handle it; the module just
// pauses until the font has parsed and the atlas is rasterized.
const fontAtlas = await FontAtlas.create();

const game = new Game(canvas, fontAtlas, uiMount);
game.start();

// Dev-only debug handle. Exposes the live Game so the browser console
// (and the preview MCP) can poke at world state for verification work
// — D5.C overflow scenarios, animator fade probing, etc. Excluded from
// the production bundle by `import.meta.env.DEV`.
if (import.meta.env.DEV) {
  (window as unknown as { __game: typeof game }).__game = game;
}
