// Bundled FOSS monospace font. Loaded first so canvas2d rasterization in the
// FontAtlas (Step 2.1) finds it registered when document.fonts.ready resolves.
// `latin-400.css` is one @font-face — regular weight, latin subset only —
// so Vite bundles a single ~80KB .woff2 rather than every weight/subset.
import '@fontsource/jetbrains-mono/latin-400.css';

import { Game } from './Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('Missing <canvas id="game-canvas"> in index.html');

const game = new Game(canvas);
game.start();
