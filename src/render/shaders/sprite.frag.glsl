// Sprite fragment shader. The font atlas is white glyphs on transparent;
// the alpha channel carries coverage. Tint by per-instance color and
// modulate by per-instance alpha. Discarding near-zero alpha avoids
// writing transparent pixels and keeps the depth buffer clean.

precision highp float;

uniform sampler2D uAtlas;

varying vec2 vAtlasUV;
varying vec3 vColor;
varying float vAlpha;
varying float vBloomIntensity;

void main() {
  vec4 sampled = texture2D(uAtlas, vAtlasUV);
  float a = sampled.a * vAlpha;
  if (a < 0.01) discard;
  // Multiply by bloomIntensity (can exceed 1.0). The composer's render
  // target is half-float so over-bright values survive intact to the
  // bloom high-pass downstream.
  gl_FragColor = vec4(vColor * vBloomIntensity, a);
}
