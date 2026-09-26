/**
 * 105b — THE BOARD EXPLORER (Round 7.5, §105 the projection spike): a
 * dev-only, render-only panel of live dials over the battle board, toggled by
 * Ctrl+Alt+P (devKeys.ts), its state a bookmark in the URL (`?bp=…`, state.ts).
 * Wired from main.ts's DEV blocks only — the shipped bundle never contains it.
 *
 * This file is the glue: it owns the dial state, installs the seams once at
 * boot (so a bookmarked dial is live BEFORE the first battle's sprites are
 * stamped), and runs the pre-render frame sync — the posed set's ground marks
 * and bars. The dial table is state.ts; how a
 * dial reaches the renderer is seams.ts; 105c's fixtures are fixtures.ts (what
 * and where), posed.ts (the sprites) and boot.ts (straight to the battle).
 */

import * as THREE from 'three';
import type { Game } from '../../Game';
import { enterBoardFixture, type FixtureReport } from './boot';
import { formatBenchReport, type BenchOptions, type BenchReport } from './bench';
import { runLiveBench } from './benchRig';
import { fixtureSearch } from './fixtures';
import { BoardPanelView } from './panel';
import { PosedSet } from './posed';
import { DEFAULT_MARK_STYLE, isDashedPlate, markExtent, markShapeOf } from '../../render/groundMarks';
import { spriteColorForUnit } from '../../render/spriteColor';
import {
  applyCameraView,
  installSeams,
  internalsOf,
  liveBattleOf,
  type LiveBattle,
} from './seams';
import {
  BOARD_PANEL_PARAM,
  DIALS,
  VIEW_DIALS,
  cameraViewOf,
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
  /** For console / pane probes: `__game.boardPanel.set('yaw', 30)`. */
  set(key: DialKey, value: string | number | boolean): void;
  readonly dials: DialState;
  /** 108d — the frame-cost bench on the board on screen (the panel's button runs the defaults). */
  bench(options?: BenchOptions): Promise<BenchReport | string>;
  /** Live counts, for a probe that must not trust the panel's own readout. */
  probe(): {
    posed: {
      glyph: string;
      cell: [number, number];
      flies: boolean;
      ground: [number, number, number];
    }[];
    /** 105e — size writes so far (unit bodies stamped `footprint × scale`). */
    sized: number;
    /** 107b — N×N bodies re-stood by the last view or battle change. */
    slabs: number;
    /** 108b — the terrain marks' last upload: marks, dropped placements, the fullest bin. */
    marks: { count: number; overflow: number; maxBin: number };
    battle: boolean;
    fixture: FixtureReport | null;
  };
}

export function attachBoardPanel(game: Game): BoardPanel {
  let dials = parseDials(new URLSearchParams(location.search).get(BOARD_PANEL_PARAM));
  const internals = internalsOf(game);
  const markColour = new THREE.Color();
  // The atlas INSTANCE is what installSeams patches below (the glyph scale),
  // so the posed set's lifts read the dialled scale.
  const posed = new PosedSet(internals, internals.sprites.atlas);
  let lastBattleRenderer: LiveBattle['battleRenderer'] | null = null;
  /** 105e — cumulative size writes (a probe reads it before / after a dial). */
  let lastSized = 0;
  /** 107b — N×N bodies re-stood by the last view or battle change. */
  let lastSlabs = 0;
  let fixture: FixtureReport | null = null;

  const onFrame = (): void => {
    const battle = liveBattleOf(game);
    const current = battle?.battleRenderer ?? null;
    if (current !== lastBattleRenderer) {
      // A new battle (or none): the old one took its overlays with it.
      lastBattleRenderer = current;
      posed.clear();
      if (battle && dials.pose !== 'off') posed.build(battle, dials.pose);
      // 107b — rubble spawns before the camera is re-fitted to THIS board, and
      // a dialled lens's slide reads the camera's position. Under ortho the
      // re-stand writes the positions the rubble already has.
      if (battle) lastSlabs = seams.restampSlabs(battle);
      describe();
    }
    if (battle) {
      for (const m of posed.live) {
        // A posed body's mark goes on the same table as the live bodies'
        // (BattleRenderer began this frame's before this hook ran), at its
        // ground point: a flyer's mark stays on its TILE, and only the glyph
        // leaves.
        const shape = markShapeOf(m.spec);
        markColour.set(spriteColorForUnit(m.spec));
        internals.terrain.addMark({
          x: m.ground.x,
          z: m.ground.z,
          shape,
          extent: markExtent(shape, 1, internals.terrain.markStyle),
          dashed: isDashedPlate(m.spec),
          r: markColour.r,
          g: markColour.g,
          b: markColour.b,
          alpha: 1,
        });
      }
      posed.sync(dials);
      lastSized += seams.stampSizes(battle);
    }
  };

  // `onFrame` runs only from the sortByDepth hook, after this returns.
  const seams = installSeams(game, () => dials, onFrame);

  // 105d — a bookmarked projection is live before the first battle mounts. An
  // untouched panel never calls the seam: the Renderer boots at the default.
  if (VIEW_DIALS.some((key) => dials[key] !== DIALS[key].def)) {
    applyCameraView(game, cameraViewOf(dials));
  }
  // 108b — so are bookmarked terrain marks (typed calls on the terrain, no patch).
  const applyMarks = (): void => {
    internals.terrain.setGroundMarks(dials.marks);
    internals.terrain.setMarkStyle({ ...DEFAULT_MARK_STYLE, plateCorner: dials.plateCorner });
  };
  if (dials.marks !== DIALS.marks.def || dials.plateCorner !== DIALS.plateCorner.def) applyMarks();

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
    if (VIEW_DIALS.includes(key)) applyCameraView(game, cameraViewOf(dials));
    if (key === 'marks' || key === 'plateCorner') applyMarks();
    // 107b — the slab rule reads the camera, so a view change re-stands it.
    if (VIEW_DIALS.includes(key)) {
      const battle = liveBattleOf(game);
      if (battle) lastSlabs = seams.restampSlabs(battle);
    }
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

  // 108d — one bench at a time; its report goes to the panel and the console.
  let benching: Promise<BenchReport | string> | null = null;
  const bench = (options?: BenchOptions): Promise<BenchReport | string> => {
    benching ??= (async () => {
      view.setStatus(
        'frame-cost bench running, about 15 s: leave the window alone. The board freezes, and white circles ' +
          'flash on every tile during the full-bins legs (the planted GPU load).',
      );
      try {
        const report = await runLiveBench(game, options);
        const text = typeof report === 'string' ? `bench: ${report}` : formatBenchReport(report);
        console.log(`[board-panel] ${text}`);
        view.setStatus(text);
        return report;
      } finally {
        benching = null;
      }
    })();
    return benching;
  };

  const view = new BoardPanelView(() => dials, {
    onBench: () => void bench(),
    onChange: set,
    onReset: () => {
      // "Today" is about the TREATMENTS: the board under them stays (resetting
      // it would reload), and so does where the panel starts.
      const { hide, board } = dials;
      dials = { ...defaultDials(), hide, board };
      apply('proj');
      apply('pose');
      apply('marks');
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
    bench,
    probe: () => ({
      posed: posed.live.map((m) => ({
        glyph: m.spec.glyph,
        cell: [m.cell.x, m.cell.y] as [number, number],
        flies: m.flies,
        ground: [m.ground.x, m.ground.y, m.ground.z] as [number, number, number],
      })),
      sized: lastSized,
      slabs: lastSlabs,
      marks: internals.terrain.markStats,
      battle: liveBattleOf(game) !== null,
      fixture,
    }),
  };
}
