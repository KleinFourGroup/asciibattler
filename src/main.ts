// Bundled FOSS monospace font. Loaded first so canvas2d rasterization in the
// FontAtlas finds it registered when document.fonts.ready resolves.
import '@fontsource/jetbrains-mono/latin-400.css';

import { Game } from './Game';
import { FontAtlas } from './render/FontAtlas';
import { statusDef } from './config/statuses';
import type { World } from './sim/World';
import type { Team } from './sim/Unit';

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
  const handle = window as unknown as {
    __game: typeof game & { applyStatus?: (id: string, target?: number | Team) => void };
  };
  handle.__game = game;
  // 28 dev hook — apply a status to units in the ACTIVE battle so the behavior
  // statuses (blind/panic/frozen/confusion) are observable BEFORE §29's
  // status-on-hit applier ships. From the browser console:
  //   __game.applyStatus('confusion')            → every living enemy (default)
  //   __game.applyStatus('frozen', 'player')     → every living player unit
  //   __game.applyStatus('blind', 7)             → just unit id 7
  handle.__game.applyStatus = (statusId, target = 'enemy') =>
    devApplyStatus(game, statusId, target);
}

/** 28 — the `__game.applyStatus` body (DEV-only; tree-shaken from prod builds). */
function devApplyStatus(g: Game, statusId: string, target: number | Team): void {
  const world = (g as unknown as { activeScene: { world?: World | null } | null }).activeScene?.world;
  if (!world) {
    console.warn('[applyStatus] no active battle — enter a fight first');
    return;
  }
  let def;
  try {
    def = statusDef(statusId);
  } catch {
    console.warn(`[applyStatus] unknown status id '${statusId}'`);
    return;
  }
  const targets =
    typeof target === 'number'
      ? world.units.filter((u) => u.id === target && u.currentHp > 0)
      : world.units.filter((u) => u.team === target && u.team !== 'neutral' && u.currentHp > 0);
  for (const u of targets) world.applyStatusEffect(u, def, null);
  console.info(`[applyStatus] applied '${statusId}' to ${targets.length} unit(s)`);
}
