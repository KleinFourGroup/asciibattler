import * as THREE from 'three';
import { type GlyphInk, FULL_GLYPH_INK } from './glyphs';

/**
 * J3 — a click candidate for the billboard hit-test: a sprite's world-space
 * center + its full world-space quad extent (`uSpriteSize × instanceSize`).
 */
export interface PickCandidate {
  readonly id: number;
  readonly position: THREE.Vector3;
  readonly size: number;
  /** §40e-follow-up — the glyph's normalized ink rect within the quad (see
   *  `glyphInk`). The hit-test tests only this sub-rect, so the clickbox hugs the
   *  visible glyph rather than the empty full quad. Omitted ⇒ the full quad
   *  (`FULL_GLYPH_INK`) — byte-identical to the pre-ink behavior. */
  readonly ink?: GlyphInk;
}

const _view = new THREE.Vector3();
const _centerNdc = new THREE.Vector3();
const _cornerNdc = new THREE.Vector3();

/**
 * J3 — screen-space hit-test against camera-facing billboard sprites, given the
 * cursor in NDC ([-1,1]). Replicates `billboard.vert.glsl` EXACTLY: transform
 * the instance center into view space, offset the quad's half-extent in VIEW
 * space (so it faces the camera), then project. That's why this — not the
 * terrain cell-pick — is what "click the glyph you see" needs: the billboard
 * floats above its tile, so a ground raycast through the glyph lands on the tile
 * BEHIND the unit.
 *
 * Returns the FRONTMOST (nearest-camera) candidate whose quad contains the
 * cursor, or null. Pure (camera matrices in, id out) so it's node-testable
 * without a canvas/WebGL — `Renderer.pickInstance` just feeds it the cursor NDC.
 *
 * Assumes the sprite mesh has an identity model matrix (it does — added to the
 * scene at the origin, untransformed), so `modelViewMatrix === viewMatrix`.
 */
export function pickInstanceAtNdc(
  candidates: readonly PickCandidate[],
  ndcX: number,
  ndcY: number,
  camera: THREE.Camera,
): number | null {
  let bestId: number | null = null;
  // View space looks down -Z, so a NEARER sprite has the LARGER (less negative)
  // z; track the max so overlapping billboards resolve front-to-back.
  let bestZ = -Infinity;
  for (const c of candidates) {
    const v = _view.copy(c.position).applyMatrix4(camera.matrixWorldInverse); // → view space
    if (v.z >= 0) continue; // at/behind the camera — never clickable
    const half = 0.5 * c.size;
    // §40e-follow-up — test the glyph's INK sub-rect, not the whole quad, so the
    // clickbox hugs the visible glyph (a half-height `▄` slab otherwise stays
    // clickable a full cell above its ink). The rect is normalized [0,1] with the
    // origin bottom-left, y up; map a coord t∈[0,1] to a view-space offset from
    // the instance center as (2t−1)·half. The default FULL_GLYPH_INK ({0,0,1,1})
    // gives cxOff/cyOff 0 and hx/hy = half — the original symmetric full quad,
    // byte-identical. The ink center shares the instance's view-Z (the quad is
    // camera-facing), so depth (`v.z`) is unchanged.
    const ink = c.ink ?? FULL_GLYPH_INK;
    const cxOff = (ink.x0 + ink.x1 - 1) * half; // ink-center x offset from center
    const cyOff = (ink.y0 + ink.y1 - 1) * half; // ink-center y offset from center
    const hx = (ink.x1 - ink.x0) * half; // ink half-width
    const hy = (ink.y1 - ink.y0) * half; // ink half-height
    // Project the ink center and a +hx/+hy corner (same view-Z ⇒ an axis-aligned
    // rect in NDC). applyMatrix4 does the perspective divide.
    _centerNdc.set(v.x + cxOff, v.y + cyOff, v.z).applyMatrix4(camera.projectionMatrix);
    _cornerNdc.set(v.x + cxOff + hx, v.y + cyOff + hy, v.z).applyMatrix4(camera.projectionMatrix);
    const halfNdcX = Math.abs(_cornerNdc.x - _centerNdc.x);
    const halfNdcY = Math.abs(_cornerNdc.y - _centerNdc.y);
    if (Math.abs(ndcX - _centerNdc.x) <= halfNdcX && Math.abs(ndcY - _centerNdc.y) <= halfNdcY) {
      if (v.z > bestZ) {
        bestZ = v.z;
        bestId = c.id;
      }
    }
  }
  return bestId;
}
