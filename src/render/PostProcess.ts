import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { COLORS } from './palette';
import fullscreenVert from './shaders/fullscreen-pass.vert.glsl?raw';
import paletteSatClampedFrag from './shaders/palette-sat-clamped.frag.glsl?raw';
import mixBloomFrag from './shaders/mix-bloom.frag.glsl?raw';

/**
 * The post-process passes of the two composers (see Renderer.ts):
 *
 *   1. The saturation clamp, on the main composer, pulls every fragment
 *      into a vibrancy band so nothing reads muddy. The palette is an
 *      art-direction discipline
 *      (`COLORS` is the vocabulary code reaches for), not a
 *      post-quantization.
 *   2. The bloom (UnrealBloomPass), on the bloom composer: bright pixels
 *      smear into a glow halo. Its high-pass is patched to use max(R,G,B)
 *      instead of Rec.709 luminance, so NEON_RED enemies glow on the same
 *      footing as TERMINAL_GREEN allies.
 *   3. The bloom mix additively composites the bloom composer's texture
 *      onto the main framebuffer.
 *
 * The CRT scanlines are a CSS overlay on `#scanlines`, not a post-process
 * pass.
 *
 * A sprite's halo strength is its per-instance `bloomIntensity`
 * (SpriteRenderer.ts), which scales what its bloomMesh draws into the bloom
 * layer, so a halo never darkens the visible glyph.
 */

const TERMINAL_BLACK_LINEAR = new THREE.Color(COLORS.TERMINAL_BLACK);

const PALETTE_SAT_CLAMPED_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uBgColor: {
      value: new THREE.Vector3(
        TERMINAL_BLACK_LINEAR.r,
        TERMINAL_BLACK_LINEAR.g,
        TERMINAL_BLACK_LINEAR.b,
      ),
    },
    uSatMin: { value: 0.4 },
    uSatMax: { value: 1.0 },
  },
  vertexShader: fullscreenVert,
  fragmentShader: paletteSatClampedFrag,
};

export function createSatClampedPass(): ShaderPass {
  return new ShaderPass(PALETTE_SAT_CLAMPED_SHADER);
}

/**
 * UnrealBloomPass tuned for the "Tron"-style neon glow. Strength + radius
 * are generous so bright pixels really halo.
 *
 * The threshold is 0 (not the more typical 0.6+) because in the selective
 * bloom the bloom layer renders only the sprites' bloom against a hard
 * (0,0,0) cleared background, so there are no dim background pixels to
 * filter out. A non-zero threshold would gate a low `bloomIntensity` to
 * zero and make the attribute a step (off below the threshold, full
 * above) instead of a linear knob. With threshold 0 the bloom scales
 * linearly with `color × bloomIntensity` all the way down.
 *
 * Out of the box UnrealBloomPass uses Rec.709 perception-weighted
 * luminance (`0.299·R + 0.587·G + 0.114·B`) for its high-pass, which
 * makes pure red glow far less than pure green at the same RGB intensity
 * — physically correct for HDR scenes, actively wrong for stylized
 * glyphs where we want "any saturated channel triggers glow." We swap in
 * a max-channel high-pass so NEON_RED enemies bloom on the same footing
 * as TERMINAL_GREEN allies (gotcha #29). With threshold 0 the high-pass
 * accepts nearly every non-zero pixel, so the two measures differ only on
 * the darkest, inside the smoothstep's width.
 */
export function createBloomPass(size: THREE.Vector2): UnrealBloomPass {
  const STRENGTH = 1.2;
  const RADIUS = 0.5;
  const THRESHOLD = 0;
  const bloom = new UnrealBloomPass(size, STRENGTH, RADIUS, THRESHOLD);

  const internals = bloom as unknown as {
    materialHighPassFilter: THREE.ShaderMaterial;
    blendMaterial: THREE.ShaderMaterial;
  };

  // Patch 1 (gotcha #29): high-pass uses max(R,G,B) instead of Rec.709
  // luminance so NEON_RED bloom on equal footing with TERMINAL_GREEN.
  internals.materialHighPassFilter.fragmentShader = MAX_CHANNEL_HIGH_PASS_FRAG;
  internals.materialHighPassFilter.needsUpdate = true;

  // Patch 2 (the selective bloom, gotcha #30): UnrealBloomPass's final step
  // copies the bloom result onto its input target (`readBuffer`) with
  // AdditiveBlending via `blendMaterial`. In the canonical single-
  // composer setup that's exactly right — the bloom smears glow on top
  // of the scene already in readBuffer. In a two-composer selective-
  // bloom setup we want the bloom composer to output just the halo (not
  // input + halo), because the visible sprite already lives in
  // mainComposer's framebuffer. Switching to NormalBlending makes the
  // final copy *replace* readBuffer with the halo blur; transparent=
  // false ensures fully-dark pixels (alpha=0) still overwrite to 0,0,0
  // instead of bleeding through whatever was there. Property name is
  // `blendMaterial` in three.js r184+ (was `materialCopy` pre-r163).
  internals.blendMaterial.blending = THREE.NormalBlending;
  internals.blendMaterial.transparent = false;
  internals.blendMaterial.needsUpdate = true;

  return bloom;
}

/**
 * Replacement for three's LuminosityHighPassShader fragment. Same
 * uniforms + signature; only the brightness measure differs (max of the
 * three channels instead of Rec.709 luminance).
 */
const MAX_CHANNEL_HIGH_PASS_FRAG = /* glsl */ /* i18n-ok: shader source */ `
  uniform sampler2D tDiffuse;
  uniform float luminosityThreshold;
  uniform float smoothWidth;
  uniform vec3 defaultColor;
  uniform float defaultOpacity;
  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    float v = max(max(texel.r, texel.g), texel.b);
    vec4 outputColor = vec4(defaultColor.rgb, defaultOpacity);
    float alpha = smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, v);
    gl_FragColor = mix(outputColor, texel, alpha);
  }
`;

/**
 * Additively mixes a bloom-buffer texture onto the main framebuffer. Pair
 * with a separate `bloomComposer` that renders the bloom layer and runs
 * UnrealBloomPass; pass its output render-target texture in as `uBloom`
 * each frame, after the bloom composer renders.
 */
export function createBloomMixPass(): ShaderPass {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uBloom: { value: null },
    },
    vertexShader: fullscreenVert,
    fragmentShader: mixBloomFrag,
  });
}

