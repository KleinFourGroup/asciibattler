/**
 * 105b — the board explorer's SEAMS: how a dev dial reaches the renderer
 * without the renderer knowing. The §105 scope guard is "nothing ships to
 * players; the one production seam is 105d's fit", so every hook here is a
 * RUNTIME patch applied from `src/dev` (TS `private` is runtime-accessible —
 * the devKeys / main.ts cast convention), and every patch falls through to
 * the original at the default dial, so an untouched panel is today's board.
 *
 * Three hooks:
 *  - `FontAtlas.baseAnchorY` (instance) — THE anchor rule. The three lifts
 *    (`inkCenterLift` / `inkTopLift` / `inkBottomLift`) and the mirror pick
 *    all read it, so one override moves the stand line AND everything stacked
 *    on it, consistently. The per-instance anchor attribute is written at
 *    glyph-write time, so a flip re-stamps the live slots (`restampAnchors`).
 *  - `BattleRenderer.prototype.inkTopLiftFor` — the ONE definition the overlay
 *    stack and the hitsplat anchor share (§79e). Patched once on the
 *    prototype: a BattleRenderer is built per battle.
 *  - `SpriteRenderer.sortByDepth` (instance) — Game calls it once per frame
 *    AFTER the scene has settled sprite positions and BEFORE the render, which
 *    is exactly when a follower (the ground cue, the posed row's bars) must
 *    sync. Wrapping it costs no frame of lag, unlike a second rAF.
 *
 * ⚠ These are name-keyed reaches into private members tsc cannot check. Each
 * is guarded at install: a renamed seam logs a loud `[board-panel]` error and
 * the dial goes inert, instead of silently reading as "no visible change".
 */

import type * as THREE from 'three';
import type { Game } from '../../Game';
import type { Renderer } from '../../render/Renderer';
import type { SpriteRenderer } from '../../render/SpriteRenderer';
import type { UnitOverlayLayer } from '../../render/UnitOverlayLayer';
import type { TerrainRenderer } from '../../render/TerrainRenderer';
import type { FontAtlas } from '../../render/FontAtlas';
import type { SpriteHandle } from '../../render/SpriteRenderer';
import { BattleRenderer } from '../../render/BattleRenderer';
import { footprintOf } from '../../sim/occupancy';
import type { Unit } from '../../sim/Unit';
import type { World } from '../../sim/World';
import { barLift, type DialState } from './state';

/** What the panel reaches on the live Game (all TS-private there). */
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
 * 105d — dial the projection through the phase's ONE production seam
 * (`Renderer.setCameraView`, typed — tsc checks this one), then re-point the
 * one holder that CAPTURED the camera: `UnitOverlayLayer` takes it at
 * construction (Game.ts), so after a perspective ⇄ ortho swap its bars would
 * project through the dead camera. Re-pointed from here rather than by a
 * production getter: only this panel ever swaps. Landing note — if a swap
 * ships (§106's call), the overlay reads `renderer.camera` per use instead and
 * this cast goes. Returns false when the overlay seam has moved.
 */
export function applyCameraView(
  game: Game,
  view: Parameters<Renderer['setCameraView']>[0],
): boolean {
  const { renderer, overlays } = internalsOf(game);
  renderer.setCameraView(view);
  const holder = overlays as unknown as { camera?: THREE.Camera };
  if (!(holder.camera && 'isCamera' in holder.camera)) {
    seamMoved('UnitOverlayLayer.camera');
    return false;
  }
  holder.camera = renderer.camera;
  return true;
}

interface SpriteInternals {
  readonly aGlyphUV: THREE.InstancedBufferAttribute;
  readonly aAnchor: THREE.InstancedBufferAttribute;
  readonly anchorModeAtSlot: readonly string[];
}

const uvKey = (u0: number, v0: number): string => `${Math.fround(u0)}|${Math.fround(v0)}`;

export interface Seams {
  /** Re-derive every live base-anchored sprite's anchor from the (patched)
   *  atlas rule. Call after the anchor dial flips. Returns the slots written. */
  restampAnchors(): number;
  /** The patched atlas — followers read lifts through it. */
  readonly atlas: FontAtlas;
}

export function installSeams(game: Game, dials: () => DialState, onFrame: () => void): Seams {
  const { sprites } = internalsOf(game);
  const atlas = sprites.atlas;

  // --- the anchor rule -------------------------------------------------------
  if (typeof atlas.baseAnchorY !== 'function') {
    seamMoved('FontAtlas.baseAnchorY');
  } else {
    const todayAnchorY = atlas.baseAnchorY.bind(atlas);
    atlas.baseAnchorY = (glyph: string): number =>
      dials().anchor === 'bottom' ? -0.5 : todayAnchorY(glyph);
  }

  // --- the bar line ----------------------------------------------------------
  const proto = BattleRenderer.prototype as unknown as {
    inkTopLiftFor?: (this: BattleRenderer, unit: Unit) => number;
  };
  const todayInkTopLiftFor = proto.inkTopLiftFor;
  if (typeof todayInkTopLiftFor !== 'function') {
    seamMoved('BattleRenderer.prototype.inkTopLiftFor');
  } else {
    proto.inkTopLiftFor = function (this: BattleRenderer, unit: Unit): number {
      const d = dials();
      if (d.bar === 'ink') return todayInkTopLiftFor.call(this, unit);
      return (
        barLift(d, atlas.inkTopLift(unit.glyph), atlas.baseAnchorY(unit.glyph)) * footprintOf(unit)
      );
    };
  }

  // --- the pre-render frame hook --------------------------------------------
  const sortByDepth = sprites.sortByDepth.bind(sprites);
  sprites.sortByDepth = (camera: THREE.Camera): void => {
    onFrame();
    sortByDepth(camera);
  };

  // --- re-stamping live anchors ---------------------------------------------
  // A slot records its UV rect, not its glyph; the atlas's UV table inverts it.
  const glyphByUv = new Map<string, string>();
  const uvByGlyph = (atlas as unknown as { uvByGlyph?: Map<string, { u0: number; v0: number }> })
    .uvByGlyph;
  if (uvByGlyph instanceof Map) {
    for (const [glyph, uv] of uvByGlyph) glyphByUv.set(uvKey(uv.u0, uv.v0), glyph);
  } else {
    seamMoved('FontAtlas.uvByGlyph');
  }

  const restampAnchors = (): number => {
    const s = sprites as unknown as Partial<SpriteInternals>;
    if (!s.aGlyphUV || !s.aAnchor || !s.anchorModeAtSlot) {
      seamMoved('SpriteRenderer.aGlyphUV / aAnchor / anchorModeAtSlot');
      return 0;
    }
    const uv = s.aGlyphUV.array as Float32Array;
    const anchor = s.aAnchor.array as Float32Array;
    let written = 0;
    for (let slot = 0; slot < sprites.count; slot++) {
      if (s.anchorModeAtSlot[slot] !== 'base') continue;
      const glyph = glyphByUv.get(uvKey(uv[slot * 4]!, uv[slot * 4 + 1]!));
      if (glyph === undefined) continue;
      anchor[slot * 2 + 1] = atlas.baseAnchorY(glyph);
      written++;
    }
    s.aAnchor.needsUpdate = true;
    return written;
  };

  return { restampAnchors, atlas };
}
