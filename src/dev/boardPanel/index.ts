/**
 * 105b — THE BOARD EXPLORER (Round 7.5, §105 the projection spike): a
 * dev-only, render-only panel of live dials over the battle board, toggled by
 * Ctrl+Alt+P (devKeys.ts), its state a bookmark in the URL (`?bp=…`, state.ts).
 * Wired from main.ts's DEV block only — the shipped bundle never contains it.
 *
 * This file is the glue: it owns the dial state, installs the seams once at
 * boot (so a bookmarked dial is live BEFORE the first battle's sprites are
 * stamped), and runs the pre-render frame sync — the ground cues under every
 * live combatant and the posed row's bars. The dial table is state.ts; how a
 * dial reaches the renderer is seams.ts.
 */

import * as THREE from 'three';
import type { Game } from '../../Game';
import { footprintOf } from '../../sim/occupancy';
import { isInertNeutral } from '../../sim/Unit';
import { GroundCues } from './groundCue';
import { BoardPanelView } from './panel';
import { PosedRow } from './posedRow';
import { installSeams, internalsOf, liveBattleOf, type LiveBattle } from './seams';
import {
  BOARD_PANEL_PARAM,
  DIALS,
  defaultDials,
  encodeDials,
  spliceBookmark,
  parseDials,
  type DialKey,
  type DialState,
} from './state';

export interface BoardPanel {
  toggle(): boolean;
  /** For console / pane probes: `__game.boardPanel.set('anchor', 'bottom')`. */
  set(key: DialKey, value: string | number | boolean): void;
  readonly dials: DialState;
  /** Live counts, for a probe that must not trust the panel's own readout. */
  probe(): {
    cues: number;
    posed: { glyph: string; ground: [number, number, number] }[];
    restamped: number;
    battle: boolean;
  };
}

export function attachBoardPanel(game: Game): BoardPanel {
  let dials = parseDials(new URLSearchParams(location.search).get(BOARD_PANEL_PARAM));
  const internals = internalsOf(game);
  const cues = new GroundCues(internals.renderer.scene);
  const scratch = new THREE.Vector3();
  // The atlas INSTANCE is what installSeams patches below, so the row's lifts
  // read the dialled rule.
  const row = new PosedRow(internals, internals.sprites.atlas);
  let lastBattleRenderer: LiveBattle['battleRenderer'] | null = null;
  let lastRestamped = 0;

  const onFrame = (): void => {
    const battle = liveBattleOf(game);
    const current = battle?.battleRenderer ?? null;
    if (current !== lastBattleRenderer) {
      // A new battle (or none): the old one took its overlays with it.
      lastBattleRenderer = current;
      row.clear();
      if (battle && dials.row) row.build(battle);
      describe();
    }
    cues.beginFrame();
    if (battle) {
      for (const unit of battle.world.units) {
        if (isInertNeutral(unit)) continue;
        const handle = battle.handles.get(unit.id);
        const ground = handle && internals.sprites.getPosition(handle, scratch);
        if (!ground) continue;
        cues.place(`u${unit.id}`, unit, ground, footprintOf(unit), dials);
      }
      row.live.forEach((m, i) => cues.place(`p${i}`, m.spec, m.ground, 1, dials));
      row.sync(dials);
    }
    cues.endFrame();
  };

  const seams = installSeams(game, () => dials, onFrame);

  const writeUrl = (): void => {
    history.replaceState(
      history.state,
      '',
      location.pathname + spliceBookmark(location.search, encodeDials(dials)) + location.hash,
    );
  };

  const describe = (): void => {
    const battle = liveBattleOf(game);
    view.setStatus(
      battle
        ? `battle ${battle.world.gridW}x${battle.world.gridH}` +
            (dials.row ? ` | ${row.where ?? 'row pending'}` : '')
        : 'no battle on screen - the dials apply when one starts',
    );
  };

  /** What a dial change must DO beyond being read next frame. */
  const apply = (key: DialKey): void => {
    if (key === 'anchor') lastRestamped = seams.restampAnchors();
    if (key === 'row') {
      const battle = liveBattleOf(game);
      if (dials.row && battle) row.build(battle);
      else row.clear();
    }
  };

  const set = (key: DialKey, value: string | number | boolean): void => {
    if (dials[key] === value) return;
    (dials as Record<DialKey, string | number | boolean>)[key] = value;
    apply(key);
    writeUrl();
    view.refresh();
    describe();
  };

  const view = new BoardPanelView(() => dials, {
    onChange: set,
    onReset: () => {
      const hide = dials.hide;
      dials = { ...defaultDials(), hide };
      apply('anchor');
      apply('row');
      writeUrl();
      view.refresh();
      describe();
    },
  });

  // A bookmark opens the panel unless it says `hide-1`; no `bp` = stay shut.
  const bookmarked = new URLSearchParams(location.search).has(BOARD_PANEL_PARAM);
  if (bookmarked && !dials.hide) view.setOpen(true);
  describe();

  return {
    toggle: () => {
      view.setOpen(!view.open);
      describe();
      return view.open;
    },
    set: (key, value) => {
      const spec = DIALS[key];
      const ok =
        spec.kind === 'enum'
          ? typeof value === 'string' && (spec.options as readonly string[]).includes(value)
          : spec.kind === 'range'
            ? typeof value === 'number' && Number.isFinite(value)
            : typeof value === 'boolean';
      if (!ok) throw new Error(`[board-panel] ${String(value)} is not a value of dial '${key}'`);
      set(key, value);
    },
    get dials() {
      return dials;
    },
    probe: () => ({
      cues: cues.count,
      posed: row.live.map((m) => ({
        glyph: m.spec.glyph,
        ground: [m.ground.x, m.ground.y, m.ground.z] as [number, number, number],
      })),
      restamped: lastRestamped,
      battle: liveBattleOf(game) !== null,
    }),
  };
}
