// The sprite fragment shader for the bloom-only layer. sprite.frag.glsl's,
// with the colour scaled by the per-instance bloomIntensity: how much the
// sprite gives the bloom buffer that is blurred and added back onto the
// main frame. 0 gives nothing (no halo), 1 the colour's own (the bloom's
// threshold is 0, so any colour halos), above 1 a stronger glow. The main
// mesh on layer 0 draws the visible colour on its own, so bloomIntensity
// never darkens the visible sprite; it sets only the halo's strength.

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
