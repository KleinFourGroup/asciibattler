/**
 * The board explorer's seams: how a dev dial reaches the renderer without
 * the renderer knowing. Nothing here ships to players, and the explorer's
 * one production seam is `Renderer.setCameraView`, so every hook here is a
 * runtime patch applied from `src/dev` (TypeScript's `private` is not
 * enforced at run time; the dev entry and the dev keys reach Game the same
 * way), and every patch falls through to the original at the default dial,
 * so an untouched panel is today's board.
 *
 * The hooks, each in its own section below:
 * - The glyph scale: the two unit lifts on the atlas instance
 *   (`inkTopLift`, `inkCenterLift`), the two pick builders on the
 *   BattleRenderer prototype (patched once: a BattleRenderer is built per
 *   battle), and the unit bodies' size, stamped per frame.
 * - `SpriteRenderer.sortByDepth` (instance): Game calls it once per frame
 *   after the scene has settled sprite positions and before the render,
 *   which is exactly when a follower (the posed set's bars and marks) must
 *   sync. Wrapping it costs no frame of lag, unlike a second rAF.
 * - `restampSlabs`: no patch, it calls the production slab rule
 *   (`render/slabAnchor.ts`) again after a view change.
 *
 * The prototype's members are reached by name, which tsc cannot check, so
 * each is guarded at install: a renamed one logs a `[board-panel]` error and
 * its dial goes inert, instead of silently reading as "no visible change".
 * A renamed `handles` map reads as no battle on screen (`liveBattleOf`).
 */

import type * as THREE from 'three';
import type { GridCoord } from '../../core/types';
import type { Game } from '../../Game';
import type { Renderer } from '../../render/Renderer';
import type { SpriteRenderer } from '../../render/SpriteRenderer';
import type { UnitOverlayLayer } from '../../render/UnitOverlayLayer';
import type { TerrainRenderer } from '../../render/TerrainRenderer';
import type { FontAtlas } from '../../render/FontAtlas';
import type { SpriteHandle } from '../../render/SpriteRenderer';
import { BattleRenderer } from '../../render/BattleRenderer';
import type { PickCandidate } from '../../render/pick';
import { footprintOf } from '../../sim/occupancy';
import { isInertNeutral } from '../../sim/Unit';
import type { World } from '../../sim/World';
import type { DialState } from './state';

/** What the panel reaches on the live Game (all private there). */
export interface GameInternals {
  readonly renderer: Renderer;
  readonly sprites: SpriteRenderer;
  readonly overlays: UnitOverlayLayer;
  readonly terrain: TerrainRenderer;
  readonly activeScene: { battleRenderer?: BattleRenderer | null; world?: World | null } | null;
}

/** The live battle, or null outside one (map, rewards, mid-swap). */
export interface LiveBattle {
  readonly battleRenderer: BattleRenderer;
  readonly world: World;
  /** unit id → body sprite handle (BattleRenderer's private map). */
  readonly handles: ReadonlyMap<number, SpriteHandle>;
}

export function internalsOf(game: Game): GameInternals {
  return game as unknown as GameInternals;
}

export function liveBattleOf(game: Game): LiveBattle | null {
  const scene = internalsOf(game).activeScene;
  const battleRenderer = scene?.battleRenderer;
  const world = scene?.world;
  if (!battleRenderer || !world) return null;
  const handles = (battleRenderer as unknown as { handles?: Map<number, SpriteHandle> }).handles;
  if (!(handles instanceof Map)) return null;
  return { battleRenderer, world, handles };
}

export function seamMoved(what: string): void {
  console.error(
    `[board-panel] seam moved: ${what} is not where §105 found it — whatever rides it is INERT. ` +
      `Re-point src/dev/boardPanel/seams.ts.`,
  );
}

/**
 * Dial the projection through the explorer's one production seam
 * (`Renderer.setCameraView`, typed, so tsc checks this one). Every holder
 * reads the camera per use (`UnitOverlayLayer` takes a getter), so a
 * perspective ⇄ ortho swap needs no re-pointing here.
 */
export function applyCameraView(
  game: Game,
  view: Parameters<Renderer['setCameraView']>[0],
): void {
  internalsOf(game).renderer.setCameraView(view);
}

interface Seams {
  /** The patched atlas — followers read lifts through it. */
  readonly atlas: FontAtlas;
  /** Write `footprint × scale` onto every live unit body whose stamped size
   *  differs (walls and other inert neutrals keep their spawned size).
   *  Idempotent per frame: a Map lookup per unit, a buffer write only on
   *  change. */
  stampSizes(battle: LiveBattle): number;
  /** Re-stand every live N×N body by the production slab rule under
   *  the current camera (the slide is view-dependent). Call after a view dial
   *  changes or a battle mounts. Returns the bodies written. */
  restampSlabs(battle: LiveBattle): number;
}

export function installSeams(game: Game, dials: () => DialState, onFrame: () => void): Seams {
  const { sprites } = internalsOf(game);
  const atlas = sprites.atlas;

  // --- the two unit lifts scale with the glyph -------------------------------
  // `inkTopLift` (bars, hitsplats, the marker over its target) and
  // `inkCenterLift` (FX endpoints) are world units at size 1, so a scaled quad's
  // ink top and centre are `scale` × further up. `inkBottomLift` is not
  // patched: its one consumer is the objective marker's own glyph, which keeps
  // its own size.
  const inkTopLiftAtSize1 = atlas.inkTopLift.bind(atlas);
  const inkCenterLiftAtSize1 = atlas.inkCenterLift.bind(atlas);
  // BattleRenderer's `inkTopLiftFor` (the overlay stack, hitsplats) and the
  // posed set read `inkTopLift` through this instance, so both follow.
  atlas.inkTopLift = (glyph: string): number => inkTopLiftAtSize1(glyph) * dials().scale;
  atlas.inkCenterLift = (glyph: string): number => inkCenterLiftAtSize1(glyph) * dials().scale;

  const proto = BattleRenderer.prototype as unknown as {
    enemyBillboards?: (this: BattleRenderer) => PickCandidate[];
    destructibleBillboards?: (this: BattleRenderer) => PickCandidate[];
    unitAnchorPos?: (this: BattleRenderer, corner: GridCoord, footprint: number) => THREE.Vector3;
  };

  // --- the mirror pick follows the scaled quad -------------------------------
  // A candidate's `size` is the quad's world extent; its `ink` and `anchor` are
  // quad-local, so scaling `size` alone keeps the click box on the visible ink.
  for (const name of ['enemyBillboards', 'destructibleBillboards'] as const) {
    const today = proto[name];
    if (typeof today !== 'function') {
      seamMoved(`BattleRenderer.prototype.${name}`);
      continue;
    }
    proto[name] = function (this: BattleRenderer): PickCandidate[] {
      const scale = dials().scale;
      const out = today.call(this);
      return scale === 1 ? out : out.map((c) => ({ ...c, size: c.size * scale }));
    };
  }

  // --- re-standing the N×N bodies --------------------------------------------
  // The production slab rule (`unitAnchorPos` → `render/slabAnchor.ts`) reads
  // the camera when a body is placed, and rubble never moves, so after a dev
  // view change a slab would keep the old view's slide: shifted a little on
  // screen, and open to a mound's bite. This calls the production rule again
  // under the current camera. No patch: the rule is production's own.
  const anchorPos = proto.unitAnchorPos;
  if (typeof anchorPos !== 'function') seamMoved('BattleRenderer.prototype.unitAnchorPos');

  const restampSlabs = (battle: LiveBattle): number => {
    if (typeof anchorPos !== 'function') return 0;
    let written = 0;
    for (const unit of battle.world.units) {
      const n = footprintOf(unit);
      const handle = battle.handles.get(unit.id);
      if (n === 1 || !handle) continue;
      sprites.updateSprite(handle, { position: anchorPos.call(battle.battleRenderer, unit.position, n) });
      written++;
    }
    return written;
  };

  // --- the pre-render frame hook --------------------------------------------
  const sortByDepth = sprites.sortByDepth.bind(sprites);
  sprites.sortByDepth = (camera: THREE.Camera): void => {
    onFrame();
    sortByDepth(camera);
  };

  // --- the unit bodies' size ------------------------------------------------
  // Spawn writes a unit's size once (`footprint`, BattleRenderer.onUnitSpawned)
  // and nothing tweens it, so a per-frame "stamp what differs" is the whole
  // mechanism. Keyed by handle id: a new battle's handles are new ids, and a
  // dead unit's handle simply stops appearing.
  const stampedSize = new Map<number, number>();
  const stampSizes = (battle: LiveBattle): number => {
    const scale = dials().scale;
    let written = 0;
    for (const unit of battle.world.units) {
      if (isInertNeutral(unit)) continue;
      const handle = battle.handles.get(unit.id);
      if (!handle) continue;
      const footprint = footprintOf(unit);
      const size = footprint * scale;
      // Spawn's own write is `footprint`, so an untouched dial writes nothing.
      if ((stampedSize.get(handle.id) ?? footprint) === size) continue;
      sprites.updateSprite(handle, { size });
      stampedSize.set(handle.id, size);
      written++;
    }
    return written;
  };

  return { atlas, stampSizes, restampSlabs };
}
