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

/**
 * Ordered 4×4 Bayer dither, sized to nudge pixels by a small linear-RGB
 * offset before the palette-quant pass sees them. The point isn't dither for
 * its own sake — it's to make smooth gradients in the terrain shader land on
 * a stippled mix of two neighbouring palette entries instead of a hard band.
 *
 * Must sit BEFORE the palette-quant pass; running it after would just shift
 * already-discrete colors off the palette.
 *
 * GLSL ES 1.00 doesn't support variable indexing into a `mat4` or const
 * array, so the lookup is an if-chain. Sixteen branches per pixel is fine
 * for a fullscreen pass at this resolution.
 */
const DITHER_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 0.05 },
    uBgColor: { value: buildPaletteUniform()[BLACK_INDEX] },
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
    uniform float uStrength;
    uniform vec3 uBgColor;

    varying vec2 vUv;

    float bayer4(vec2 pos) {
      int x = int(mod(pos.x, 4.0));
      int y = int(mod(pos.y, 4.0));
      int i = y * 4 + x;
      // 4×4 Bayer threshold matrix, row-major, values 0–15.
      float v = 0.0;
      if (i == 0)  v = 0.0;
      else if (i == 1)  v = 8.0;
      else if (i == 2)  v = 2.0;
      else if (i == 3)  v = 10.0;
      else if (i == 4)  v = 12.0;
      else if (i == 5)  v = 4.0;
      else if (i == 6)  v = 14.0;
      else if (i == 7)  v = 6.0;
      else if (i == 8)  v = 3.0;
      else if (i == 9)  v = 11.0;
      else if (i == 10) v = 1.0;
      else if (i == 11) v = 9.0;
      else if (i == 12) v = 15.0;
      else if (i == 13) v = 7.0;
      else if (i == 14) v = 13.0;
      else              v = 5.0;
      return v / 16.0;
    }

    void main() {
      vec3 src = texture2D(tDiffuse, vUv).rgb;
      // Skip background pixels: the palette-quant pass uses an exact-match
      // color key to identify the background quad. Dithering background
      // pixels by ±uStrength would push them off that sentinel and the
      // quant pass would snap them to the nearest non-black palette
      // entry — making the void around the arena flash green/amber.
      if (distance(src, uBgColor) < 0.001) {
        gl_FragColor = vec4(src, 1.0);
        return;
      }
      // Center the threshold around 0 so the offset is symmetric (no DC shift).
      // Average of 0..15/16 is 7.5/16 = 0.46875.
      float offset = (bayer4(gl_FragCoord.xy) - 0.46875) * uStrength;
      gl_FragColor = vec4(src + offset, 1.0);
    }
  `,
};

export function createDitherPass(): ShaderPass {
  return new ShaderPass(DITHER_SHADER);
}

/**
 * Horizontal CRT scanlines. Bands of `uBandSize` pixels darken by uIntensity,
 * alternating with light bands of equal thickness — at 4px thickness on a
 * 1440p screen that lands at ~180 visible scanlines, in CRT-realistic
 * territory. 1px alternation reads as a faint uniform dimming at modern DPI
 * (the eye can't resolve single-pixel stripes from normal viewing distance)
 * so we go thicker to make the texture actually perceptible.
 *
 * Lives AFTER palette quant; the darkened pixels land off-palette but the
 * eye still reads the result as palette-correct against the bright bands.
 *
 * Uses `step` + `mod` for crisp band edges; a sinusoid would smear across
 * fractional pixels and lose the CRT-line look.
 */
const SCANLINE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.15 },
    uBandSize: { value: 4.0 },
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
    uniform float uIntensity;
    uniform float uBandSize;

    varying vec2 vUv;

    void main() {
      vec3 src = texture2D(tDiffuse, vUv).rgb;
      float cycle = uBandSize * 2.0;
      float isDark = step(uBandSize, mod(gl_FragCoord.y, cycle));
      float factor = 1.0 - isDark * uIntensity;
      gl_FragColor = vec4(src * factor, 1.0);
    }
  `,
};

export function createScanlinePass(): ShaderPass {
  return new ShaderPass(SCANLINE_SHADER);
}

// TODO(future): CRT curvature pass — barrel-distort UVs and vignette edges.
