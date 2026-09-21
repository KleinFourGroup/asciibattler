/**
 * 105b — THE BOARD EXPLORER (Round 7.5, §105 the projection spike): a
 * dev-only, render-only panel of live dials over the battle board, toggled by
 * Ctrl+Alt+P (devKeys.ts), its state a bookmark in the URL (`?bp=…`, state.ts).
 * Wired from main.ts's DEV blocks only — the shipped bundle never contains it.
 *
 * This file is the glue: it owns the dial state, installs the seams once at
 * boot (so a bookmarked dial is live BEFORE the first battle's sprites are
 * stamped), and runs the pre-render frame sync — the ground cues under every
 * live combatant and the posed set's bars. The dial table is state.ts; how a
 * dial reaches the renderer is seams.ts; 105c's fixtures are fixtures.ts (what
 * and where), posed.ts (the sprites) and boot.ts (straight to the battle).
 */

import * as THREE from 'three';
import type { Game } from '../../Game';
import { footprintOf } from '../../sim/occupancy';
import { isInertNeutral } from '../../sim/Unit';
import { enterBoardFixture, type FixtureReport } from './boot';
import { fixtureSearch } from './fixtures';
import { GroundCues } from './groundCue';
import { BoardPanelView } from './panel';
import { PosedSet } from './posed';
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

export { applyBoardFixtureUrl } from './boot';

export interface BoardPanel {
  toggle(): boolean;
  /** For console / pane probes: `__game.boardPanel.set('anchor', 'bottom')`. */
  set(key: DialKey, value: string | number | boolean): void;
  readonly dials: DialState;
  /** Live counts, for a probe that must not trust the panel's own readout. */
  probe(): {
    /** Ground meshes on the board — the cues AND the flyer's shadow. */
    cues: number;
    posed: {
      glyph: string;
      cell: [number, number];
      flies: boolean;
      ground: [number, number, number];
    }[];
    restamped: number;
    battle: boolean;
    fixture: FixtureReport | null;
  };
}

export function attachBoardPanel(game: Game): BoardPanel {
  let dials = parseDials(new URLSearchParams(location.search).get(BOARD_PANEL_PARAM));
  const internals = internalsOf(game);
  const cues = new GroundCues(internals.renderer.scene);
  const scratch = new THREE.Vector3();
  // The atlas INSTANCE is what installSeams patches below, so the posed set's
  // lifts read the dialled rule.
  const posed = new PosedSet(internals, internals.sprites.atlas);
  let lastBattleRenderer: LiveBattle['battleRenderer'] | null = null;
  let lastRestamped = 0;
  let fixture: FixtureReport | null = null;

  const onFrame = (): void => {
    const battle = liveBattleOf(game);
    const current = battle?.battleRenderer ?? null;
    if (current !== lastBattleRenderer) {
      // A new battle (or none): the old one took its overlays with it.
      lastBattleRenderer = current;
      posed.clear();
      if (battle && dials.pose !== 'off') posed.build(battle, dials.pose);
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
      posed.live.forEach((m, i) => {
        // A flyer's cue and shadow stay on its TILE — the glyph is what leaves.
        cues.place(`p${i}`, m.spec, m.ground, 1, dials);
        if (m.flies && dials.shadow) cues.placeShadow(`s${i}`, m.ground, dials);
      });
      posed.sync(dials);
    }
    cues.endFrame();
  };

  const seams = installSeams(game, () => dials, onFrame);

  const bookmarkedSearch = (): string => spliceBookmark(location.search, encodeDials(dials));

  const writeUrl = (): void => {
    history.replaceState(history.state, '', location.pathname + bookmarkedSearch() + location.hash);
  };

  const describe = (): void => {
    const battle = liveBattleOf(game);
    const lines = [
      battle
        ? `battle ${battle.world.gridW}x${battle.world.gridH}`
        : 'no battle on screen - the dials apply when one starts',
    ];
    if (fixture) lines.push(fixture.text);
    if (battle && dials.pose !== 'off') lines.push(posed.where ?? 'pose pending');
    view.setStatus(lines.join('\n'));
  };

  /** What a dial change must DO beyond being read next frame. */
  const apply = (key: DialKey): void => {
    if (key === 'anchor') lastRestamped = seams.restampAnchors();
    if (key === 'pose') {
      const battle = liveBattleOf(game);
      if (dials.pose !== 'off' && battle) posed.build(battle, dials.pose);
      else posed.clear();
    }
  };

  const set = (key: DialKey, value: string | number | boolean): void => {
    if (dials[key] === value) return;
    (dials as Record<DialKey, string | number | boolean>)[key] = value;
    if (key === 'board') {
      // The one dial that cannot apply live (the run dials are read inside
      // `new Game`): put the fixture's run pairs — or none, for `off` — in the
      // URL beside the bookmark and reload. boot.ts re-derives them on load.
      const search = fixtureSearch(bookmarkedSearch(), dials.board === 'off' ? null : dials.board);
      location.assign(location.pathname + search + location.hash);
      return;
    }
    apply(key);
    writeUrl();
    view.refresh();
    describe();
  };

  const view = new BoardPanelView(() => dials, {
    onChange: set,
    onReset: () => {
      // "Today" is about the TREATMENTS: the board under them stays (resetting
      // it would reload), and so does where the panel starts.
      const { hide, board } = dials;
      dials = { ...defaultDials(), hide, board };
      apply('anchor');
      apply('pose');
      writeUrl();
      view.refresh();
      describe();
    },
  });

  // A bookmark opens the panel unless it says `hide-1`; no `bp` = stay shut.
  const bookmarked = new URLSearchParams(location.search).has(BOARD_PANEL_PARAM);
  if (bookmarked && !dials.hide) view.setOpen(true);

  // 105c — a `board-` bookmark goes straight to its battle (boot.ts). After the
  // seams, so the fixture's first sprites are stamped under the dialled rules.
  fixture = enterBoardFixture(game);
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
      posed: posed.live.map((m) => ({
        glyph: m.spec.glyph,
        cell: [m.cell.x, m.cell.y] as [number, number],
        flies: m.flies,
        ground: [m.ground.x, m.ground.y, m.ground.z] as [number, number, number],
      })),
      restamped: lastRestamped,
      battle: liveBattleOf(game) !== null,
      fixture,
    }),
  };
}
