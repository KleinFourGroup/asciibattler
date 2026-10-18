/**
 * The dev entry: the one module `main.ts` loads on a DEV page, by a
 * DEV-gated dynamic import, and through it everything else under `src/dev`
 * that a page uses. A production build drops that import, so it carries
 * none of this folder: tests/dev-guard.test.ts holds `src/dev` to gated
 * dynamic imports, and scripts/dev-scan.mjs reads a build for what would
 * have leaked.
 *
 * `main.ts` loads it before the Game is built and calls it twice: once
 * ahead of the boot, and once in the task that starts the loop, so the board
 * explorer's seams are in before the first battle stamps a sprite.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { statusDef } from '../config/statuses';
import type { Game } from '../Game';
import type { Team } from '../sim/Unit';
import type { World } from '../sim/World';
import { applyBoardFixtureUrl, attachBoardPanel, type BoardPanel } from './boardPanel';
import { attachDevKeys } from './devKeys';
import { plantBootFailure, plantRunFailure } from './failPlant';
import { installProbe } from './probe';
import { TraceRecorder, type BattleTrace } from './TraceRecorder';
import { clearTraces, loadTraces, pushTrace } from './traceStore';

/**
 * Ahead of the boot: the planted boot failures (`?fail=webgl`, `?fail=font`;
 * ./failPlant.ts), before what they make fail, and a board fixture's URL. A
 * fixture bookmark (`?bp=board-…`) stands for a set of run dials, and Game
 * parses the run dials in its constructor, so the fixture's run pairs are
 * written into the URL first (./boardPanel/boot.ts).
 */
export function beforeBoot(search: string): void {
  plantBootFailure(search);
  applyBoardFixtureUrl();
}

/** The dev handle: the live Game, and what the console reaches through it. */
type DevGame = Game & {
  applyStatus?: (id: string, target?: number | Team) => void;
  traceRecorder?: TraceRecorder;
  dumpTraces?: () => BattleTrace[];
  clearTraces?: () => void;
  boardPanel?: BoardPanel;
};

/**
 * Once the Game is built and its loop runs: `window.__game`, the handle the
 * browser console and the pane's tools poke at world state through.
 */
export function installDevHandle(game: Game): void {
  const handle = window as unknown as { __game: DevGame };
  handle.__game = game;
  // The battle-trace recorder, for the page's life: every battle records
  // into the localStorage ring, the last 80 (./traceStore.ts). From the
  // console, `__game.dumpTraces()` returns the ring, newest last, and
  // `__game.clearTraces()` empties it; Ctrl+Alt+D downloads it
  // (./devKeys.ts).
  // Game keeps `bus` private to TypeScript, and the dev code reaches it, as
  // `devApplyStatus` reaches the scene, by a cast: private is not enforced
  // at run time.
  const bus = (game as unknown as { bus: EventBus<GameEvents> }).bus;
  handle.__game.traceRecorder = new TraceRecorder(bus, pushTrace);
  handle.__game.dumpTraces = () => {
    const traces = loadTraces();
    console.info(`[traces] ${traces.length} trace(s) in the ring`);
    return traces;
  };
  handle.__game.clearTraces = clearTraces;
  // The board explorer (Ctrl+Alt+P), then the dev keys. The explorer's
  // seams install here, at boot, so a `?bp=` bookmark is live before the
  // first battle stamps a sprite. From the console:
  // `__game.boardPanel.set('cue', 'outline')`.
  handle.__game.boardPanel = attachBoardPanel(game);
  attachDevKeys(game, handle.__game.boardPanel);
  // `__game.applyStatus(id, target?)` applies a status to the living units
  // of a team in the battle on screen (the enemy by default), or to one
  // unit by id, so a status can be watched without a unit that applies it.
  handle.__game.applyStatus = (statusId, target = 'enemy') => devApplyStatus(game, statusId, target);
  // The planted running failures (`?fail=frame`, `?fail=context`).
  plantRunFailure(location.search, game);
  // `window.__probe`, installed last so a `ready()` that returns sees the
  // whole dev handle (and a board fixture's battle) in place. A pane
  // session starts with `await __probe.ready()`.
  installProbe(game);
}

/** The `__game.applyStatus` body. */
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
      : world.units.filter(
          // As a team, `neutral` takes the active neutrals (a camp's
          // members) alone, and leaves the inert scenery out.
          (u) => u.team === target && (u.team !== 'neutral' || u.campId !== null) && u.currentHp > 0,
        );
  for (const u of targets) world.applyStatusEffect(u, def, null);
  console.info(`[applyStatus] applied '${statusId}' to ${targets.length} unit(s)`);
}
