// Palette-quantization post-process pass. Always on (DESIGN.md).
//
// `__PALETTE_SIZE__` and `__BLACK_INDEX__` are substituted at module
// load by the consumer in src/render/PostProcess.ts — GLSL ES 1.00
// doesn't support template strings, and we want the loop bound /
// black-index lookup to be compile-time constants in the shader. See
// the `substituteShaderConstants` helper there.

precision highp float;

uniform sampler2D tDiffuse;
uniform vec3 uPalette[__PALETTE_SIZE__];

varying vec2 vUv;

void main() {
  vec3 src = texture2D(tDiffuse, vUv).rgb;
  vec3 bgColor = uPalette[__BLACK_INDEX__];

  // Color-key: scene.background draws a uniform TERMINAL_BLACK quad before
  // any geometry, so background pixels land EXACTLY at bgColor in linear
  // RGB. Terrain and sprite shaders never produce a perfectly gray color
  // (R != G != B by construction), so a tight distance threshold cleanly
  // separates background from foreground. Background pixels pass through
  // unchanged; foreground pixels then quantize over a palette that
  // *excludes* BLACK, so dark terrain can never snap to the background
  // color and punch a visible hole.
  if (distance(src, bgColor) < 0.001) {
    gl_FragColor = vec4(bgColor, 1.0);
    return;
  }

  // Snap to nearest non-BLACK palette entry by squared-Euclidean distance.
  vec3 best = vec3(0.0);
  float bestDist = 1e9;
  for (int i = 0; i < __PALETTE_SIZE__; i++) {
    if (i == __BLACK_INDEX__) continue;
    vec3 p = uPalette[i];
    float d = dot(src - p, src - p);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }

  gl_FragColor = vec4(best, 1.0);
}
