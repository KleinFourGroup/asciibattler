import * as THREE from 'three';

/**
 * The one implementation of "a point `lift` world units straight up the
 * screen from `anchor`", for everything that stacks above a ground anchor in
 * screen space: the unit's visual centre and top (FX endpoints, sparkles),
 * the hitsplat anchor, the objective marker, the HP overlay's follow point.
 *
 * Why camera-up and not world-Y: the billboard quad rises from its anchor in
 * view space (screen-up; see `instanceAnchor` in billboard.vert.glsl), so a
 * follower must rise the same way to stay on its glyph. Column 1 of the
 * camera's world matrix is its up axis (unit-length, orthonormal), so the
 * offset is exactly screen-up: the lifted point projects to the same screen
 * X as the anchor, always. Under the shipped orthographic camera a world-Y
 * offset would also project straight up the screen (the lean pin,
 * tests/board/cameraFit.test.ts), but by the pitch's scale, not the quad's;
 * under a perspective camera (the dev explorer's) it projects diagonally,
 * toward the vanishing point and away from the screen's centre.
 *
 * Pure camera math (no canvas or WebGL), headless-tested in anchor.test.ts,
 * the no-horizontal-drift pin among them. `out` may alias `anchor`.
 */
const _up = new THREE.Vector3();

export function aboveAnchor(
  anchor: THREE.Vector3,
  lift: number,
  camera: THREE.Camera,
  out: THREE.Vector3,
): THREE.Vector3 {
  _up.setFromMatrixColumn(camera.matrixWorld, 1);
  return out.copy(anchor).addScaledVector(_up, lift);
}
