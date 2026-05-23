// C1c variant A: flat grid terrain.
//
// Reads a per-tile data texture (R channel: 1.0 = floor, 0.0 = water),
// lerps between two flat palette colors, and stamps grid lines on the
// cell edges so the boardgame read is unmistakable regardless of how
// monochrome a battle's tile layout happens to be.
//
// Grid lines use a smoothstep band around fract(worldXZ) — a hard
// threshold would alias badly at the camera pitch we render at.

precision highp float;

uniform sampler2D uTileMap;
uniform float uGridSize;
uniform vec3 uFloorColor;
uniform vec3 uWaterColor;
uniform vec3 uGridLineColor;
uniform float uGridLineWidth;

varying vec3 vWorldPos;

void main() {
  float halfSize = uGridSize * 0.5;
  // World → continuous cell coord. Grid Y axis is inverted relative to
  // world Z (see BattleRenderer.gridToWorld) — `halfSize - worldZ`
  // recovers grid Y growing downward in screen-space.
  vec2 cellF = vec2(vWorldPos.x + halfSize, halfSize - vWorldPos.z);

  if (cellF.x < 0.0 || cellF.x > uGridSize || cellF.y < 0.0 || cellF.y > uGridSize) {
    discard;
  }

  vec2 cellIdx = floor(cellF);
  vec2 uv = (cellIdx + 0.5) / uGridSize;
  float kind = texture2D(uTileMap, uv).r;

  vec3 baseColor = mix(uWaterColor, uFloorColor, kind);

  vec2 frac = fract(cellF);
  vec2 edgeDist = min(frac, 1.0 - frac);
  float edge = min(edgeDist.x, edgeDist.y);
  float lineAlpha = 1.0 - smoothstep(0.0, uGridLineWidth, edge);

  vec3 color = mix(baseColor, uGridLineColor, lineAlpha * 0.7);

  gl_FragColor = vec4(color, 1.0);
}
