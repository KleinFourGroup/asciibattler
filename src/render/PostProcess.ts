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
 * Index of TERMINAL_BLACK in the palette uniform. The shader applies a small
 * distance handicap to this entry so dark terrain pixels prefer a colored
 * dark neighbor over snapping to the same color as the scene background
 * (which would punch a visible "hole" through the terrain).
 */
const BLACK_INDEX = PALETTE_ENTRIES.indexOf(COLORS.TERMINAL_BLACK);

/**
 * Tuned by hand: linear-space distance from TERMINAL_BLACK to its nearest
 * neighbor (DARK_TERMINAL_GREEN) is ~0.00132, so a bias well under that
 * still lets exact-black inputs (distance 0) win, but pushes borderline
 * dark terrain pixels to a colored neighbor.
 */
const BLACK_DISTANCE_BIAS = 0.0008;

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

      // Snap to nearest palette entry by squared-Euclidean distance.
      // (sqrt is monotonic; comparing squared distances is identical and
      // cheaper.) TERMINAL_BLACK gets a tiny additive handicap so dark
      // terrain pixels don't snap to the background color and read as holes.
      vec3 best = uPalette[0];
      float bestDist = dot(src - best, src - best);
      if (0 == ${BLACK_INDEX}) bestDist += float(${BLACK_DISTANCE_BIAS});
      for (int i = 1; i < ${PALETTE_SIZE}; i++) {
        vec3 p = uPalette[i];
        float d = dot(src - p, src - p);
        if (i == ${BLACK_INDEX}) d += float(${BLACK_DISTANCE_BIAS});
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
