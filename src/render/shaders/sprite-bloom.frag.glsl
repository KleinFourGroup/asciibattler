// Sprite fragment shader for the bloom-only render layer (B1.1 selective
// bloom). Identical to sprite.frag.glsl except output color is scaled by
// the per-instance bloomIntensity attribute: this controls how much each
// sprite contributes to the bloom-buffer that gets blurred + composited
// back onto the main scene. 0 = sprite contributes nothing (no halo),
// 1 = natural contribution (halo iff color crosses the bloom threshold),
// >1 = amplified contribution (forced strong glow). The main mesh on
// layer 0 renders the sprite's visible color independently, so changing
// bloomIntensity here NEVER darkens the visible sprite — it only adjusts
// the halo strength.

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
  gl_FragColor = vec4(vColor * vBloomIntensity, a);
}
