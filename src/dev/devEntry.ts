/**
 * 117.5j — THE DEV ENTRY: the one module `main.ts` loads on a DEV page, by a
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
  // 53b — the passive battle-trace recorder (page-lifetime). Every battle
  // auto-records into the localStorage ring (last 80); from the console:
  //   __game.dumpTraces()   → the ring, newest last (copy(...) to clipboard)
  //   __game.clearTraces()  → empty the ring
  // Bulk download: Ctrl+Alt+D (devKeys.ts, 53f).
  // Game keeps `bus` TS-private; the dev convention (devApplyStatus's
  // activeScene reach-in below) is a cast — private is runtime-accessible.
  const bus = (game as unknown as { bus: EventBus<GameEvents> }).bus;
  handle.__game.traceRecorder = new TraceRecorder(bus, pushTrace);
  handle.__game.dumpTraces = () => {
    const traces = loadTraces();
    console.info(`[traces] ${traces.length} trace(s) in the ring`);
    return traces;
  };
  handle.__game.clearTraces = clearTraces;
  // 53f — the dev keys (Ctrl+Alt+S export the run / Ctrl+Alt+L load one,
  // map-phase saves only / Ctrl+Alt+D dump the trace ring). A separate window
  // listener, NOT the Keybindings registry (its zod schema ships every
  // action — worklog §53).
  // 105b — the board explorer (Ctrl+Alt+P; Round 7.5's projection spike). Its
  // seams install HERE, at boot, so a `?bp=` bookmark is live before the first
  // battle stamps a sprite. From the console: __game.boardPanel.set('cue', 'outline').
  handle.__game.boardPanel = attachBoardPanel(game);
  attachDevKeys(game, handle.__game.boardPanel);
  // 28 dev hook — apply a status to units in the ACTIVE battle so the behavior
  // statuses (blind/panic/frozen/confusion) are observable BEFORE §29's
  // status-on-hit applier ships. From the browser console:
  //   __game.applyStatus('confusion')            → every living enemy (default)
  //   __game.applyStatus('frozen', 'player')     → every living player unit
  //   __game.applyStatus('blind', 7)             → just unit id 7
  handle.__game.applyStatus = (statusId, target = 'enemy') => devApplyStatus(game, statusId, target);
  // 117.5i — the planted running failures (`?fail=frame`, `?fail=context`).
  plantRunFailure(location.search, game);
  // 112a — `window.__probe`, installed last so a `ready()` that returns sees
  // the whole dev handle (and a board fixture's battle) in place. A pane
  // session starts with `await __probe.ready()`.
  installProbe(game);
}

/** 28 — the `__game.applyStatus` body. */
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
          // §75e — 'neutral' as a team filter reaches ACTIVE neutrals (camp
          // members) only; inert scenery stays out of the dev status sprayer.
          (u) => u.team === target && (u.team !== 'neutral' || u.campId !== null) && u.currentHp > 0,
        );
  for (const u of targets) world.applyStatusEffect(u, def, null);
  console.info(`[applyStatus] applied '${statusId}' to ${targets.length} unit(s)`);
}
