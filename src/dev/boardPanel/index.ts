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
import { GroundCues, cueSideOf } from './groundCue';
import { BoardPanelView } from './panel';
import { PosedSet } from './posed';
import { footprintCentre, slabGroundOf, slabViewOf } from '../../render/slabAnchor';
import { DEFAULT_MARK_STYLE, isDashedPlate, markExtent, markShapeOf } from '../../render/groundMarks';
import { spriteColorForUnit } from '../../render/spriteColor';
import type { DrapeView, TileTops } from './conform';
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
  MARK_STYLE_DIALS,
  VIEW_DIALS,
  cameraViewOf,
  markStyleOf,
  defaultDials,
  encodeDials,
  spliceBookmark,
  parseDials,
  type DialKey,
  type DialState,
} from './state';

export { applyBoardFixtureUrl } from './boot';

/**
 * 106c-post2 — which step faces the live camera sees, and a key that changes
 * exactly when that answer can. Under parallel rays a face is turned toward the
 * camera iff its normal points against the view direction, so four bits say it
 * all; under a lens it depends on where the face is, so the key is the pose.
 */
function drapeViewOf(camera: THREE.Camera): { view: DrapeView; key: string } {
  camera.updateMatrixWorld(); // the frame hook runs before the render refreshes it
  const { fwd, position: p, ortho } = slabViewOf(camera);
  if (ortho) {
    const faces = (nx: number, nz: number): boolean => nx * fwd.x + nz * fwd.z < 0;
    const key = [faces(-1, 0), faces(1, 0), faces(0, -1), faces(0, 1)].map(Number).join('');
    return { view: { faces }, key: `ortho:${key}` };
  }
  return {
    view: { faces: (nx, nz, x, z) => nx * (p.x - x) + nz * (p.z - z) > 0 },
    key: `lens:${p.x},${p.y},${p.z}`,
  };
}

export interface BoardPanel {
  toggle(): boolean;
  /** For console / pane probes: `__game.boardPanel.set('anchor', 'bottom')`. */
  set(key: DialKey, value: string | number | boolean): void;
  readonly dials: DialState;
  /** Live counts, for a probe that must not trust the panel's own readout. */
  probe(): {
    /** Ground meshes on the board — every mark `ground` draws (a `both` or
     *  `merged` unit has two), the N×N plates, and the flyer's 105c shadow. */
    cues: number;
    posed: {
      glyph: string;
      cell: [number, number];
      flies: boolean;
      ground: [number, number, number];
    }[];
    restamped: number;
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
  const cues = new GroundCues(internals.renderer.scene);
  const scratch = new THREE.Vector3();
  const markColour = new THREE.Color();
  // The atlas INSTANCE is what installSeams patches below, so the posed set's
  // lifts read the dialled rule.
  const posed = new PosedSet(internals, internals.sprites.atlas);
  let lastBattleRenderer: LiveBattle['battleRenderer'] | null = null;
  let lastRestamped = 0;
  /** 105e — cumulative size writes (a probe reads it before / after a dial). */
  let lastSized = 0;
  /** 107b — N×N bodies re-stood by the last view or battle change. */
  let lastSlabs = 0;
  /** 106c-post — the live battle's tile tops, built once per battle
   *  (106c-post2: and again when the drape's visible faces change). */
  let tops: TileTops | null = null;
  let topsKey = '';
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
      tops = null;
      describe();
    }
    // 106c-post — ONE tile-tops object per battle: the marks re-cut only when
    // a placement changes, and that is decided by this object's identity.
    // 106c-post2 — the drape's faces follow the view, so a change in what the
    // camera sees (or the dial) makes a new object, and every mark re-cuts once.
    if (battle) {
      const drape = dials.drape ? drapeViewOf(internals.renderer.camera) : null;
      const key = drape?.key ?? 'tops';
      if (!tops || key !== topsKey) {
        const ground = slabGroundOf(battle.world, internals.terrain);
        tops = { gridW: battle.world.gridW, gridH: battle.world.gridH, heightAt: ground.heightAt };
        if (drape) tops = { ...tops, drape: drape.view };
        topsKey = key;
      }
    }
    cues.beginFrame(tops);
    if (battle && tops) {
      for (const unit of battle.world.units) {
        const handle = battle.handles.get(unit.id);
        if (!handle) continue; // the dead leave `world.units` (World.removeUnit)
        const n = footprintOf(unit);
        // 106b — an N×N body's marks stand on its FOOTPRINT, never its sprite
        // anchor (which the slab rule may slide toward the camera).
        const centre =
          n > 1
            ? footprintCentre(unit.position.x, unit.position.y, n, tops.gridW, tops.gridH, tops.heightAt)
            : null;
        // 106c — a body with no cue of its own (scenery) gets the plate: the N×N
        // slabs, or (106c-post, `plateScope-all`) every one of them.
        if (cueSideOf(unit) === null && (centre || dials.plateScope === 'all')) {
          const at = centre ?? footprintCentre(unit.position.x, unit.position.y, 1, tops.gridW, tops.gridH, tops.heightAt);
          cues.placePlate(`n${unit.id}`, unit, at, n, dials);
        }
        if (isInertNeutral(unit)) continue;
        const at = centre ?? internals.sprites.getPosition(handle, scratch);
        if (!at) continue;
        cues.place(`u${unit.id}`, unit, at, n, dials);
      }
      posed.live.forEach((m, i) => {
        // A flyer's marks stay on its TILE — the glyph is what leaves.
        cues.place(`p${i}`, m.spec, m.ground, 1, dials);
        // 105c's flyer shadow belongs to `ground-cue`; every other mode already
        // puts a contact mark under the flyer through `place`.
        if (m.flies && dials.shadow && dials.ground === 'cue') cues.placeShadow(`s${i}`, m.ground, dials);
        // 108b — and its production mark, on the same table as the live bodies'
        // (BattleRenderer began this frame's before this hook ran).
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
      });
      posed.sync(dials, seams.inkTopLiftAtSize1);
      lastSized += seams.stampSizes(battle);
    }
    cues.endFrame();
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
    internals.terrain.setMarkStyle({ ...DEFAULT_MARK_STYLE, ...markStyleOf(dials) });
  };
  if ([...MARK_STYLE_DIALS, 'marks' as const].some((key) => dials[key] !== DIALS[key].def)) applyMarks();

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
    if (key === 'marks' || MARK_STYLE_DIALS.includes(key)) applyMarks();
    if (key === 'anchor') lastRestamped = seams.restampAnchors();
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

  const view = new BoardPanelView(() => dials, {
    onChange: set,
    onReset: () => {
      // "Today" is about the TREATMENTS: the board under them stays (resetting
      // it would reload), and so does where the panel starts.
      const { hide, board } = dials;
      dials = { ...defaultDials(), hide, board };
      apply('proj');
      apply('anchor');
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
    probe: () => ({
      cues: cues.count,
      posed: posed.live.map((m) => ({
        glyph: m.spec.glyph,
        cell: [m.cell.x, m.cell.y] as [number, number],
        flies: m.flies,
        ground: [m.ground.x, m.ground.y, m.ground.z] as [number, number, number],
      })),
      restamped: lastRestamped,
      sized: lastSized,
      slabs: lastSlabs,
      marks: internals.terrain.markStats,
      battle: liveBattleOf(game) !== null,
      fixture,
    }),
  };
}
