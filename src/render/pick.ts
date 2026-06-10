import * as THREE from 'three';

/**
 * J3 — a click candidate for the billboard hit-test: a sprite's world-space
 * center + its full world-space quad extent (`uSpriteSize × instanceSize`).
 */
export interface PickCandidate {
  readonly id: number;
  readonly position: THREE.Vector3;
  readonly size: number;
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
    // Project the center and a +half/+half corner (same view-Z, so the quad is
    // an axis-aligned rect in NDC). applyMatrix4 does the perspective divide.
    _centerNdc.copy(v).applyMatrix4(camera.projectionMatrix);
    _cornerNdc.set(v.x + half, v.y + half, v.z).applyMatrix4(camera.projectionMatrix);
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
