// Horizontal CRT scanlines. Bands of `uBandSize` pixels darken by
// uIntensity, alternating with light bands of equal thickness — at 4px
// thickness on a 1440p screen that lands at ~180 visible scanlines, in
// CRT-realistic territory. 1px alternation reads as a faint uniform
// dimming at modern DPI so we go thicker to make the texture actually
// perceptible.
//
// Lives AFTER palette quant; the darkened pixels land off-palette but
// the eye still reads the result as palette-correct against the bright
// bands.
//
// Uses `step` + `mod` for crisp band edges; a sinusoid would smear
// across fractional pixels and lose the CRT-line look.

precision highp float;

uniform sampler2D tDiffuse;
uniform float uIntensity;
uniform float uBandSize;

varying vec2 vUv;

void main() {
  vec3 src = texture2D(tDiffuse, vUv).rgb;
  float cycle = uBandSize * 2.0;
  float isDark = step(uBandSize, mod(gl_FragCoord.y, cycle));
  float factor = 1.0 - isDark * uIntensity;
  gl_FragColor = vec4(src * factor, 1.0);
}
