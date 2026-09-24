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
 * Later steps added (each in its own section below): 105e's glyph scale (the
 * two unit lifts + the two pick builders). 106b's `unitAnchorPos` patch went
 * when its rule shipped (107b, `render/slabAnchor.ts`); what stays is
 * `restampSlabs`, which re-stands the N×N bodies after a view change.
 *
 * ⚠ These are name-keyed reaches into private members tsc cannot check. Each
 * is guarded at install: a renamed seam logs a loud `[board-panel]` error and
 * the dial goes inert, instead of silently reading as "no visible change".
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
import { isInertNeutral, type Unit } from '../../sim/Unit';
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
 * (`Renderer.setCameraView`, typed — tsc checks this one). Every holder reads
 * the camera per use since 107a (`UnitOverlayLayer` takes a getter), so a
 * perspective ⇄ ortho swap needs no re-pointing here.
 */
export function applyCameraView(
  game: Game,
  view: Parameters<Renderer['setCameraView']>[0],
): void {
  internalsOf(game).renderer.setCameraView(view);
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
  /** 105e — `inkTopLift` BEFORE the scale patch, for a caller that applies
   *  the scale itself (`barLift`'s contract). */
  inkTopLiftAtSize1(glyph: string): number;
  /** 105e — write `footprint × scale` onto every live unit body whose stamped
   *  size differs (walls and other inert neutrals stay size 1). Idempotent per
   *  frame: a Map lookup per unit, a buffer write only on change. */
  stampSizes(battle: LiveBattle): number;
  /** 107b — re-stand every live N×N body by the production slab rule under
   *  the current camera (the slide is view-dependent). Call after a view dial
   *  changes or a battle mounts. Returns the bodies written. */
  restampSlabs(battle: LiveBattle): number;
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

  // --- 105e: the two UNIT lifts scale with the glyph --------------------------
  // `inkTopLift` (bars, hitsplats, the marker over its target) and
  // `inkCenterLift` (FX endpoints) are world units at size 1, so a scaled quad's
  // ink top and centre are `scale` × further up. `inkBottomLift` is NOT patched:
  // its one consumer is the objective marker's OWN glyph, which stays size 1.
  const inkTopLiftAtSize1 = atlas.inkTopLift.bind(atlas);
  const inkCenterLiftAtSize1 = atlas.inkCenterLift.bind(atlas);
  atlas.inkTopLift = (glyph: string): number => inkTopLiftAtSize1(glyph) * dials().scale;
  atlas.inkCenterLift = (glyph: string): number => inkCenterLiftAtSize1(glyph) * dials().scale;

  // --- the bar line ----------------------------------------------------------
  const proto = BattleRenderer.prototype as unknown as {
    inkTopLiftFor?: (this: BattleRenderer, unit: Unit) => number;
    enemyBillboards?: (this: BattleRenderer) => PickCandidate[];
    destructibleBillboards?: (this: BattleRenderer) => PickCandidate[];
    unitAnchorPos?: (this: BattleRenderer, corner: GridCoord, footprint: number) => THREE.Vector3;
  };
  const todayInkTopLiftFor = proto.inkTopLiftFor;
  if (typeof todayInkTopLiftFor !== 'function') {
    seamMoved('BattleRenderer.prototype.inkTopLiftFor');
  } else {
    proto.inkTopLiftFor = function (this: BattleRenderer, unit: Unit): number {
      const d = dials();
      // Today's path reads the scale-patched atlas, so it is already × scale.
      if (d.bar === 'ink') return todayInkTopLiftFor.call(this, unit);
      return (
        barLift(d, inkTopLiftAtSize1(unit.glyph), atlas.baseAnchorY(unit.glyph)) *
        footprintOf(unit) *
        d.scale
      );
    };
  }

  // --- 105e: the mirror pick follows the scaled quad -------------------------
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

  // --- 107b: re-standing the N×N bodies ---------------------------------------
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

  // --- 105e: the unit bodies' size ---------------------------------------------
  // Spawn writes a unit's size ONCE (`footprint`, BattleRenderer.onUnitSpawned)
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
      // Spawn's own write IS `footprint`, so an untouched dial writes nothing.
      if ((stampedSize.get(handle.id) ?? footprint) === size) continue;
      sprites.updateSprite(handle, { size });
      stampedSize.set(handle.id, size);
      written++;
    }
    return written;
  };

  return { restampAnchors, atlas, inkTopLiftAtSize1, stampSizes, restampSlabs };
}
