// Adds the bloom buffer onto the main frame. The bloom buffer is the output
// of a separate EffectComposer that ran the bloom layer through
// UnrealBloomPass, so it already holds the blurred halo, ready to add.
//
// Plain addition: bright halos brighten what's underneath; black pixels
// in the bloom buffer leave the main color untouched. This is the same
// composition UnrealBloomPass uses internally when wired into a single
// composer chain, just split out so the bloom layer can render
// independently of the main scene.

precision highp float;

uniform sampler2D tDiffuse;  // main framebuffer (visible scene)
uniform sampler2D uBloom;    // blurred bloom buffer
varying vec2 vUv;

void main() {
  vec4 main = texture2D(tDiffuse, vUv);
  vec4 bloom = texture2D(uBloom, vUv);
  gl_FragColor = vec4(main.rgb + bloom.rgb, main.a);
}
