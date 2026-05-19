// Sprite fragment shader for the main (visible) render layer. The font
// atlas is white glyphs on transparent; alpha carries coverage. Tint by
// per-instance color and modulate by per-instance alpha. Discarding
// near-zero alpha avoids writing transparent pixels and keeps the depth
// buffer clean.
//
// bloomIntensity is NOT applied here — this layer always renders the
// sprite at its natural color. Bloom contribution is computed by a
// separate mesh on layer 1 using sprite-bloom.frag.glsl, fed through a
// dedicated bloomComposer and additively mixed back onto this output
// (B1.1 selective bloom). That decoupling is what lets bloomIntensity=0
// kill a sprite's halo without darkening the sprite itself.

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
  gl_FragColor = vec4(vColor, a);
}
