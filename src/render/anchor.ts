import * as THREE from 'three';

/**
 * §79d — THE one implementation of "a point `lift` world-units straight up the
 * SCREEN from `anchor`", for everything that stacks above a ground anchor in
 * screen space: the unit visual center/top (FX endpoints, sparkles), the
 * hitsplat anchor, the enemy objective marker, the HP-overlay follow point.
 *
 * Why camera-up and not world-Y: the billboard quad rises from its anchor in
 * VIEW space (screen-up — see `instanceAnchor` in billboard.vert.glsl), and
 * under the pitched perspective camera a world-Y offset projects DIAGONALLY
 * toward the vanishing point for anything away from screen center. That
 * off-axis skew produced three separate bugs fixed three separate ways (the I2
 * hitsplat dual-projection, the J3 marker's hand-rolled camera-up lift, and
 * the §79b sprite-anchor finding: ±9px at 720p screen edges) before §79 made
 * the rule structural. Column 1 of the camera's world matrix is its up axis
 * (unit-length, orthonormal), so the offset is exactly screen-up: the lifted
 * point projects to the SAME screen X as the anchor, always.
 *
 * Pure camera math (no canvas/WebGL) — headless-tested in anchor.test.ts,
 * including the no-horizontal-drift pin. `out` may alias `anchor`.
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
