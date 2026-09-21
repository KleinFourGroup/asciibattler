/**
 * 105c — the board explorer's STRAIGHT-TO-BATTLE loader, in two halves that
 * straddle `new Game` (main.ts's DEV blocks call both; neither ships).
 *
 * BEFORE Game: `applyBoardFixtureUrl` — Game parses the run dials from
 * `location.search` in its constructor, so a board fixture has to be IN the
 * URL by then. `bp=board-<id>` is the one source: the run pairs are re-derived
 * from the BOARDS table on every load (a `replaceState`, no navigation), so a
 * bookmark can only ever open the board its `board-` names.
 *
 * AFTER Game: `enterBoardFixture` — the two dispatches a player's two clicks
 * would make (the root node, then the pre-turn screen's Fight), then the
 * countdown parked for a `park` fixture. The loader CHECKS what it opened
 * against the fixture's `expect` and says so loudly: "a fixture that opens a
 * different board" is the cut's definition of wrong, so the panel is where it
 * must show.
 */

import type { Game } from '../../Game';
import { BOARDS, fixtureSearch, type BoardId } from './fixtures';
import { internalsOf, liveBattleOf, seamMoved } from './seams';
import { BOARD_PANEL_PARAM, parseDials } from './state';

function boardInUrl(): BoardId | null {
  const board = parseDials(new URLSearchParams(location.search).get(BOARD_PANEL_PARAM)).board;
  return board === 'off' ? null : board;
}

/** Call BEFORE `new Game`. No `board-` in the bookmark ⇒ the URL is untouched. */
export function applyBoardFixtureUrl(): void {
  const board = boardInUrl();
  if (board === null) return;
  const search = fixtureSearch(location.search, board);
  if (search === location.search) return;
  history.replaceState(history.state, '', location.pathname + search + location.hash);
}

export interface FixtureReport {
  readonly board: BoardId;
  readonly ok: boolean;
  readonly text: string;
}

/** Call AFTER `game.start()`. Null when the bookmark names no board. */
export function enterBoardFixture(game: Game): FixtureReport | null {
  const board = boardInUrl();
  if (board === null) return null;
  const fixture = BOARDS[board];
  const fail = (text: string): FixtureReport => {
    console.error(`[board-panel] fixture '${board}': ${text}`);
    return { board, ok: false, text: `FIXTURE ${board} FAILED - ${text}` };
  };

  const run = (game as unknown as { run?: { nodeMap?: { rootId?: unknown } } | null }).run;
  const rootId = run?.nodeMap?.rootId;
  if (typeof rootId !== 'number') {
    seamMoved('Game.run.nodeMap.rootId');
    return fail('no run at boot (is character= in the URL?)');
  }
  game.dispatch({ kind: 'enterNode', nodeId: rootId });
  game.dispatch({ kind: 'advanceTurn' });

  const battle = liveBattleOf(game);
  if (!battle) return fail('two dispatches did not reach a battle');
  const encounter = (run as unknown as { currentEncounter?: { layoutId?: string | null } | null })
    .currentEncounter;
  const got = {
    layoutId: encounter?.layoutId ?? null,
    gridW: battle.world.gridW,
    gridH: battle.world.gridH,
  };
  const want = fixture.expect;
  if (got.layoutId !== want.layoutId || got.gridW !== want.gridW || got.gridH !== want.gridH) {
    return fail(
      `opened ${got.layoutId ?? 'procedural'} ${got.gridW}x${got.gridH}, ` +
        `the table says ${want.layoutId ?? 'procedural'} ${want.gridW}x${want.gridH}`,
    );
  }

  let parked = '';
  if (fixture.park) {
    // The HANDOFF recipe: the countdown object is per-battle, so an instance
    // patch parks THIS board only. Space / a speed button still skips it
    // (BattleScene.tick reads the unpause), so a parked board is one key from live.
    const countdown = (
      internalsOf(game).activeScene as { countdown?: { advance?: unknown } } | null
    )?.countdown;
    if (countdown && typeof countdown.advance === 'function') {
      countdown.advance = () => {};
      parked = ' | PARKED - Space to fight';
    } else {
      seamMoved('BattleScene.countdown.advance');
      parked = ' | NOT parked (seam moved)';
    }
  }
  return { board, ok: true, text: `fixture ${board}: ${fixture.label}${parked}` };
}
