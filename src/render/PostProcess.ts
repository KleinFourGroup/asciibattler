import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { COLORS } from './palette';
import fullscreenVert from './shaders/fullscreen-pass.vert.glsl?raw';
import paletteFragSource from './shaders/palette.frag.glsl?raw';
import ditherFrag from './shaders/dither.frag.glsl?raw';
import scanlinesFrag from './shaders/scanlines.frag.glsl?raw';

/**
 * Post-process passes. The palette-quantization pass is always on (it's the
 * single biggest stylistic lever per DESIGN.md). Scanlines, dither, and CRT
 * curvature are future hooks — placeholders called out below so the pipeline
 * extends with a one-liner instead of a refactor.
 *
 * Shader sources live under `src/render/shaders/*.glsl` (Vite `?raw`
 * imports). The palette fragment shader carries two compile-time
 * constants (`__PALETTE_SIZE__`, `__BLACK_INDEX__`) substituted at load
 * because GLSL ES 1.00 can't index `uPalette` by a non-const variable
 * and can't `#define` from a uniform.
 */

const PALETTE_ENTRIES = Object.values(COLORS);
const PALETTE_SIZE = PALETTE_ENTRIES.length;

/**
 * Index of TERMINAL_BLACK in the palette uniform. The shader uses it as a
 * color-key sentinel (background pixels land EXACTLY here because the scene
 * draws a uniform full-screen quad before any geometry), and as the index to
 * exclude from foreground quantization so dark terrain can't snap to the
 * background color and read as a hole punched through the terrain.
 */
const BLACK_INDEX = PALETTE_ENTRIES.indexOf(COLORS.TERMINAL_BLACK);

/**
 * Build the palette uniform as an array of vec3s. `new THREE.Color(hex)`
 * interprets the string as sRGB and stores it in the working color space
 * (linear by default in modern three.js), so palette comparisons happen in
 * the same linear space as the sampled scene color. Linear-vs-linear is the
 * boring-and-correct version.
 */
function buildPaletteUniform(): THREE.Vector3[] {
  return PALETTE_ENTRIES.map((hex) => {
    const c = new THREE.Color(hex);
    return new THREE.Vector3(c.r, c.g, c.b);
  });
}

/**
 * Replace `__NAME__`-style placeholders in a shader source. The palette
 * pass uses this for two compile-time constants the GLSL compiler needs
 * to see as integer literals; other passes don't need it yet.
 */
function substituteShaderConstants(source: string, subs: Record<string, string | number>): string {
  let out = source;
  for (const [key, value] of Object.entries(subs)) {
    out = out.replaceAll(`__${key}__`, String(value));
  }
  return out;
}

const PALETTE_FRAG = substituteShaderConstants(paletteFragSource, {
  PALETTE_SIZE,
  BLACK_INDEX,
});

const PALETTE_QUANT_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uPalette: { value: buildPaletteUniform() },
  },
  vertexShader: fullscreenVert,
  fragmentShader: PALETTE_FRAG,
};

export function createPaletteQuantPass(): ShaderPass {
  return new ShaderPass(PALETTE_QUANT_SHADER);
}

const DITHER_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 0.05 },
    uBgColor: { value: buildPaletteUniform()[BLACK_INDEX] },
  },
  vertexShader: fullscreenVert,
  fragmentShader: ditherFrag,
};

export function createDitherPass(): ShaderPass {
  return new ShaderPass(DITHER_SHADER);
}

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
