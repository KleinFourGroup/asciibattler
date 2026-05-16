import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { RNG } from '../core/RNG';
import { COLORS } from './palette';

/**
 * Procedural terrain plane that sits under the battle grid. Purely
 * decorative for MVP — doesn't affect movement, combat, or pathfinding.
 *
 * Geometry is a subdivided plane in the XZ plane (Y up). Vertex heights
 * come from CPU-side fractional Brownian motion over seeded simplex noise,
 * so the same seed produces byte-identical terrain across runs (this is
 * the same determinism contract the sim relies on, just one-shot).
 *
 * The fragment shader blends three "dark" palette colors by height and
 * subtly darkens steeper slopes, so the terrain reads as background without
 * fighting the sprites for attention.
 */

/** Center Y of the terrain. Sits below the sprite plane (y ≈ 0.5). */
const PLANE_BASE_Y = -0.5;
/** Max vertex displacement above/below the base height. */
const DISPLACEMENT_AMPLITUDE = 0.4;
/** Base noise frequency. Smaller = larger features. */
const NOISE_FREQUENCY = 0.25;

const VERTEX_SHADER = /* glsl */ `
  varying float vWorldY;
  varying vec3 vNormalW;

  void main() {
    vWorldY = position.y;
    vNormalW = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec3 uColorLow;
  uniform vec3 uColorMid;
  uniform vec3 uColorHigh;
  uniform float uMinY;
  uniform float uMaxY;

  varying float vWorldY;
  varying vec3 vNormalW;

  void main() {
    float t = smoothstep(uMinY, uMaxY, vWorldY);

    // Two-stop palette blend: low → mid → high.
    vec3 color = t < 0.5
      ? mix(uColorLow, uColorMid, smoothstep(0.0, 0.5, t))
      : mix(uColorMid, uColorHigh, smoothstep(0.5, 1.0, t));

    // Slope darkening: world up is +Y, so abs(normal.y) ≈ 1 on flat ground.
    float slope = 1.0 - clamp(abs(vNormalW.y), 0.0, 1.0);
    color *= 1.0 - slope * 0.35;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class TerrainRenderer {
  readonly mesh: THREE.Mesh;

  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.ShaderMaterial;

  /**
   * Build the terrain. `sizeWorld` matches the planned grid size (12 for
   * MVP). `segments` controls displacement detail; 64×64 gives plenty of
   * variation without being expensive.
   */
  constructor(seed: number, sizeWorld: number, segments = 64) {
    const rng = new RNG(seed);
    const noise2D = createNoise2D(() => rng.next());

    this.geometry = new THREE.PlaneGeometry(sizeWorld, sizeWorld, segments, segments);
    // PlaneGeometry's default normal is +Z. Rotate so the plane lies in XZ
    // with normal +Y (matches our Y-up world).
    this.geometry.rotateX(-Math.PI / 2);

    const positions = this.geometry.attributes['position']!.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]!;
      const z = positions[i + 2]!;
      const h = fbm(noise2D, x * NOISE_FREQUENCY, z * NOISE_FREQUENCY);
      positions[i + 1] = PLANE_BASE_Y + h * DISPLACEMENT_AMPLITUDE;
    }
    this.geometry.attributes['position']!.needsUpdate = true;
    this.geometry.computeVertexNormals();

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uColorLow: { value: new THREE.Color(COLORS.DARK_FLOURESCENT_BLUE) },
        uColorMid: { value: new THREE.Color(COLORS.DARK_TERMINAL_GREEN) },
        uColorHigh: { value: new THREE.Color(COLORS.DARK_TERMINAL_AMBER) },
        uMinY: { value: PLANE_BASE_Y - DISPLACEMENT_AMPLITUDE },
        uMaxY: { value: PLANE_BASE_Y + DISPLACEMENT_AMPLITUDE },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Fractional Brownian motion: sum multiple noise octaves at increasing
 * frequency / decreasing amplitude. Gives more interesting silhouettes
 * than single-octave noise without much extra cost.
 */
function fbm(
  noise2D: (x: number, y: number) => number,
  x: number,
  z: number,
  octaves = 3,
  lacunarity = 2,
  persistence = 0.5,
): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2D(x * freq, z * freq);
    max += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return sum / max;
}
