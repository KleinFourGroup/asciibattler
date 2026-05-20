// Bar fragment: shader-cutoff fill. uv.x sweeps 0 → 1 across the bar's
// width; pixels left of `vFillPct` get the fill color, right of it the
// background. Per-instance alpha lets the renderer hide a bar entirely
// (e.g. progress bar when no action is in flight) without removing the
// instance.

precision highp float;

varying vec2 vUv;
varying float vFillPct;
varying vec3 vBgColor;
varying vec3 vFillColor;
varying float vAlpha;

void main() {
  if (vAlpha < 0.01) discard;
  vec3 color = vUv.x <= vFillPct ? vFillColor : vBgColor;
  gl_FragColor = vec4(color, vAlpha);
}
