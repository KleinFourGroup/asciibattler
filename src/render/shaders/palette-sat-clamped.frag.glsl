// B1 variant (c): full-RGB pass-through with saturation clamped to a band.
//
// Anything goes hue/luminance-wise, but saturation is forced into
// [uSatMin, uSatMax]. This prevents muddy mid-saturations (anything
// below the floor gets pushed up to vibrant) and the saturation ceiling
// keeps "neon" feeling consistent rather than letting some sprites read
// as washed-out and others fluorescent.
//
// RGB↔HSV via the standard Sam Hocevar branch-free routines.

precision highp float;

uniform sampler2D tDiffuse;
uniform vec3 uBgColor;
uniform float uSatMin;
uniform float uSatMax;

varying vec2 vUv;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec3 src = texture2D(tDiffuse, vUv).rgb;

  if (distance(src, uBgColor) < 0.001) {
    gl_FragColor = vec4(uBgColor, 1.0);
    return;
  }

  vec3 hsv = rgb2hsv(src);
  // Pure-gray inputs (sat == 0) have an undefined hue; leave saturation
  // alone so we don't paint random color over the terrain shadows.
  if (hsv.y > 0.0) {
    hsv.y = clamp(hsv.y, uSatMin, uSatMax);
  }
  gl_FragColor = vec4(hsv2rgb(hsv), 1.0);
}
