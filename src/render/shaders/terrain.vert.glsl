// Terrain (C1c faceted low-poly). Per-vertex inputs in addition to
// `position` + `normal`:
//   aColor  — vertex color baked from tile height + face shading.
//   aTopUV  — (0..1, 0..1) on the top face, (0,0) on sides.
//   aAnim   — (animType, phase). D7.C per-tile animation hook. animType
//             0 = none, 1 = fire flicker, 2 = healing pulse. Phase is a
//             deterministic per-tile offset (hash of cell coord) so
//             neighboring fire tiles don't pulse in unison.
//
// `vIsTop` is set from the model-space normal so the fragment can stamp
// the grid line only on the top face.

precision highp float;

attribute vec3 aColor;
attribute vec2 aTopUV;
attribute vec2 aAnim;

varying vec3 vColor;
varying vec3 vNormalW;
varying vec2 vTopUV;
varying float vIsTop;
varying vec2 vAnim;

void main() {
  vColor = aColor;
  vNormalW = normalize(normalMatrix * normal);
  vTopUV = aTopUV;
  vIsTop = normal.y > 0.5 ? 1.0 : 0.0;
  vAnim = aAnim;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
