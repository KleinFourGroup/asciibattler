// Terrain (C1c faceted low-poly). Per-vertex inputs in addition to
// `position` + `normal`:
//   aColor  — vertex color baked from tile height + face shading.
//   aTopUV  — (0..1, 0..1) on the top face, (0,0) on sides.
//
// `vIsTop` is set from the model-space normal so the fragment can stamp
// the grid line only on the top face.

precision highp float;

attribute vec3 aColor;
attribute vec2 aTopUV;

varying vec3 vColor;
varying vec3 vNormalW;
varying vec2 vTopUV;
varying float vIsTop;

void main() {
  vColor = aColor;
  vNormalW = normalize(normalMatrix * normal);
  vTopUV = aTopUV;
  vIsTop = normal.y > 0.5 ? 1.0 : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
