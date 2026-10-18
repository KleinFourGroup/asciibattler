// The sprite fragment shader for the main (visible) layer. The font atlas is
// white glyphs on transparent, its alpha the coverage: tint by the
// per-instance colour and scale by the per-instance alpha. A near-zero alpha
// is discarded, a fragment that would add nothing to the blend (the sprites
// write no depth).
//
// bloomIntensity is not applied here: this layer always draws the sprite at
// its own colour. The bloom's share comes from a separate mesh on layer 1
// with sprite-bloom.frag.glsl, through its own composer, added back onto
// this output. That split is what lets bloomIntensity 0 remove a sprite's
// halo without darkening the sprite.

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
