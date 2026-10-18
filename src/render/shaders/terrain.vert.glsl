// The terrain's faceted prisms. Per-vertex inputs beside `position` and
// `normal`:
//   aColor  — the vertex colour, baked from the tile's height and face.
//   aTopUV  — (0..1, 0..1) on the top face, (0, 0) on the sides.
//   aAnim   — (animType, phase): 0 none, 1 fire's flicker, 2 healing's
//             pulse, 3 deep water's bands. The phase is a per-tile hash of
//             the cell, so neighbouring fire tiles don't pulse in unison.
//
// `vIsTop` comes from the model-space normal, so the fragment stamps the
// grid line on the top face only. `vWorldPos` is the world position the
// deep-water bands and the ground marks run on: the bands use one
// world-space formula here and in the apron's shader, which keeps them
// continuous across the board's edge (the tile's V axis runs against world
// Z, so a tile-UV formula would turn the diagonal there).

precision highp float;

attribute vec3 aColor;
attribute vec2 aTopUV;
attribute vec2 aAnim;

varying vec3 vColor;
varying vec3 vNormalW;
varying vec2 vTopUV;
varying float vIsTop;
varying vec2 vAnim;
varying vec3 vWorldPos;

void main() {
  vColor = aColor;
  vNormalW = normalize(normalMatrix * normal);
  vTopUV = aTopUV;
  vIsTop = normal.y > 0.5 ? 1.0 : 0.0;
  vAnim = aAnim;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
