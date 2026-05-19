import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { COLORS } from './palette';
import fullscreenVert from './shaders/fullscreen-pass.vert.glsl?raw';
import paletteSatClampedFrag from './shaders/palette-sat-clamped.frag.glsl?raw';
import scanlinesFrag from './shaders/scanlines.frag.glsl?raw';

/**
 * Post-process passes. Three are wired into the main composer chain (see
 * Renderer.ts):
 *
 *   1. Saturation-clamp — pulls every fragment into a vibrancy band so
 *      nothing reads muddy. Replaces the MVP palette-quant pass; the
 *      palette is now an art-direction discipline (the COLORS table is
 *      still the canonical source of unit/team colors in code), not a
 *      shader-enforced post-quantization.
 *   2. Bloom (UnrealBloomPass) — bright pixels smear into a glow halo.
 *      The high-pass shader is patched to use max(R,G,B) instead of
 *      Rec.709 luminance so NEON_RED enemies glow on the same footing as
 *      TERMINAL_GREEN allies.
 *   3. Scanlines — CRT-diorama band overlay.
 *
 * Sprites can opt into stronger bloom by bumping `bloomIntensity` per-
 * instance in [SpriteRenderer.ts](./SpriteRenderer.ts) — pushing the
 * output color past the bloom threshold gives the sprite a halo without
 * a separate render layer.
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
 * are generous so bright pixels really halo; threshold sits at 0.6 in
 * max-channel terms (see below) so unsaturated darks don't bleed.
 *
 * Out of the box UnrealBloomPass uses Rec.709 perception-weighted
 * luminance (`0.299·R + 0.587·G + 0.114·B`) for its high-pass, which
 * makes pure red glow far less than pure green at the same RGB intensity
 * — physically correct for HDR scenes, actively wrong for stylized
 * glyphs where we want "any saturated channel triggers glow." We swap in
 * a max-channel high-pass so NEON_RED enemies bloom on the same footing
 * as TERMINAL_GREEN allies.
 */
export function createBloomPass(size: THREE.Vector2): UnrealBloomPass {
  const STRENGTH = 1.2;
  const RADIUS = 0.5;
  const THRESHOLD = 0.6;
  const bloom = new UnrealBloomPass(size, STRENGTH, RADIUS, THRESHOLD);

  const material = (bloom as unknown as { materialHighPassFilter: THREE.ShaderMaterial })
    .materialHighPassFilter;
  material.fragmentShader = MAX_CHANNEL_HIGH_PASS_FRAG;
  material.needsUpdate = true;

  return bloom;
}

/**
 * Replacement for three's LuminosityHighPassShader fragment. Same
 * uniforms + signature; only the brightness measure differs (max of the
 * three channels instead of Rec.709 luminance).
 */
const MAX_CHANNEL_HIGH_PASS_FRAG = /* glsl */ `
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

const SCANLINE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.15 },
    uBandSize: { value: 4.0 },
  },
  vertexShader: fullscreenVert,
  fragmentShader: scanlinesFrag,
};

export function createScanlinePass(): ShaderPass {
  return new ShaderPass(SCANLINE_SHADER);
}

// TODO(future): CRT curvature pass — barrel-distort UVs and vignette edges.
