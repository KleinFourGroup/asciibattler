// Ordered 4×4 Bayer dither. Nudges pixels by a small linear-RGB offset
// before the palette-quant pass sees them, so smooth gradients in
// terrain land on a stippled mix of two neighbouring palette entries
// instead of a hard band. Must sit BEFORE palette-quant; after, it
// would shift already-discrete colors off the palette.
//
// GLSL ES 1.00 doesn't support variable indexing into a `mat4` or const
// array, so the lookup is an if-chain. Sixteen branches per pixel is
// fine for a fullscreen pass at this resolution.

precision highp float;

uniform sampler2D tDiffuse;
uniform float uStrength;
uniform vec3 uBgColor;

varying vec2 vUv;

float bayer4(vec2 pos) {
  int x = int(mod(pos.x, 4.0));
  int y = int(mod(pos.y, 4.0));
  int i = y * 4 + x;
  // 4×4 Bayer threshold matrix, row-major, values 0–15.
  float v = 0.0;
  if (i == 0)  v = 0.0;
  else if (i == 1)  v = 8.0;
  else if (i == 2)  v = 2.0;
  else if (i == 3)  v = 10.0;
  else if (i == 4)  v = 12.0;
  else if (i == 5)  v = 4.0;
  else if (i == 6)  v = 14.0;
  else if (i == 7)  v = 6.0;
  else if (i == 8)  v = 3.0;
  else if (i == 9)  v = 11.0;
  else if (i == 10) v = 1.0;
  else if (i == 11) v = 9.0;
  else if (i == 12) v = 15.0;
  else if (i == 13) v = 7.0;
  else if (i == 14) v = 13.0;
  else              v = 5.0;
  return v / 16.0;
}

void main() {
  vec3 src = texture2D(tDiffuse, vUv).rgb;
  // Skip background pixels: the palette-quant pass uses an exact-match
  // color key to identify the background quad. Dithering background
  // pixels by ±uStrength would push them off that sentinel and the
  // quant pass would snap them to the nearest non-black palette
  // entry — making the void around the arena flash green/amber.
  if (distance(src, uBgColor) < 0.001) {
    gl_FragColor = vec4(src, 1.0);
    return;
  }
  // Center the threshold around 0 so the offset is symmetric (no DC shift).
  // Average of 0..15/16 is 7.5/16 = 0.46875.
  float offset = (bayer4(gl_FragCoord.xy) - 0.46875) * uStrength;
  gl_FragColor = vec4(src + offset, 1.0);
}
