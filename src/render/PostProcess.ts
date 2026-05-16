import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { COLORS } from './palette';

/**
 * Post-process passes. The palette-quantization pass is always on (it's the
 * single biggest stylistic lever per DESIGN.md). Scanlines, dither, and CRT
 * curvature are future hooks — placeholders called out below so the pipeline
 * extends with a one-liner instead of a refactor.
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

const PALETTE_QUANT_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uPalette: { value: buildPaletteUniform() },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform vec3 uPalette[${PALETTE_SIZE}];

    varying vec2 vUv;

    void main() {
      vec3 src = texture2D(tDiffuse, vUv).rgb;
      vec3 bgColor = uPalette[${BLACK_INDEX}];

      // Color-key: scene.background draws a uniform TERMINAL_BLACK quad before
      // any geometry, so background pixels land EXACTLY at bgColor in linear
      // RGB. Terrain and sprite shaders never produce a perfectly gray color
      // (R != G != B by construction), so a tight distance threshold cleanly
      // separates background from foreground. Background pixels pass through
      // unchanged; foreground pixels then quantize over a palette that
      // *excludes* BLACK, so dark terrain can never snap to the background
      // color and punch a visible hole.
      if (distance(src, bgColor) < 0.001) {
        gl_FragColor = vec4(bgColor, 1.0);
        return;
      }

      // Snap to nearest non-BLACK palette entry by squared-Euclidean distance.
      vec3 best = vec3(0.0);
      float bestDist = 1e9;
      for (int i = 0; i < ${PALETTE_SIZE}; i++) {
        if (i == ${BLACK_INDEX}) continue;
        vec3 p = uPalette[i];
        float d = dot(src - p, src - p);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }

      gl_FragColor = vec4(best, 1.0);
    }
  `,
};

export function createPaletteQuantPass(): ShaderPass {
  return new ShaderPass(PALETTE_QUANT_SHADER);
}

// TODO(checkpoint-3 / future): scanlines pass — modulate brightness by a
// sin(uv.y * H * PI) term so horizontal lines darken every other pixel.
// TODO(checkpoint-3 / future): ordered-dither pass — break smooth palette
// regions with a small Bayer matrix so banding reads as texture.
// TODO(future): CRT curvature pass — barrel-distort UVs and vignette edges.
