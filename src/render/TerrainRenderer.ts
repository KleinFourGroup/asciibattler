import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { RNG } from '../core/RNG';
import type { TileGrid, TileKind } from '../sim/TileGrid';
import { COLORS } from './palette';
import VERTEX_SHADER from './shaders/terrain.vert.glsl?raw';
import FRAGMENT_SHADER from './shaders/terrain.frag.glsl?raw';

/**
 * C1c terrain: one faceted prism per tile in a 12×12 arena.
 *
 * Heights come from a fixed-seed simplex field — the visual character
 * is part of the canonical look, not a per-battle roll. Floor tile tops
 * live in [FLOOR_RANGE_LO, FLOOR_RANGE_HI]; water tiles drop to a sunken
 * WATER_TOP_Y so the recess reads at a glance. Top colors lerp
 * DARK_TERMINAL_GREEN → DARK_TERMINAL_AMBER over the floor height range
 * so variance reads both geometrically and chromatically.
 *
 * Geometry is non-indexed (each face owns its normals) for hard-edged
 * faceted shading. Lighting is baked from a fixed direction in the
 * fragment shader — no scene lights, so this material has no spill into
 * the sprite renderers (which are unlit by design).
 *
 * Buffers are sized once at gridSize² and rewritten in-place per
 * setTiles; nothing allocates per battle.
 *
 * `heightAt(cx, cy, kind)` is the public hook into the height field —
 * BattleRenderer uses it to set per-tile sprite Y so units stand on
 * their tile top instead of floating at a fixed plane.
 */

const VERTS_PER_TILE = 30; // 5 quads × 2 tris × 3 verts (top + 4 sides; bottom omitted — never visible from the locked camera pitch)
const BOTTOM_Y = -0.7;

const WATER_TOP_Y = -0.4;
const FLOOR_RANGE_LO = -0.3;
const FLOOR_RANGE_HI = 0.0;
const NOISE_FREQ = 0.42;
/** Fixed seed: the visual character is canonical, not a per-battle roll. */
const NOISE_SEED = 0xb1c1a1b;

/** Diffuse light direction in world space — view-space `normal · L` is the diffuse term. */
const LIGHT_DIR = new THREE.Vector3(0.4, 0.85, 0.35).normalize();
/** Ambient floor — sides never go fully black. */
const AMBIENT = 0.45;
/** Side-face color multiplier vs top (darker for face-to-face contrast). */
const SIDE_SHADE = 0.7;
/** Top-face grid-line width as a fraction of cell size. */
const GRID_LINE_WIDTH = 0.06;

export class TerrainRenderer {
  readonly mesh: THREE.Mesh;

  private readonly gridSize: number;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly colors: Float32Array;
  private readonly topUVs: Float32Array;
  private readonly positionAttr: THREE.BufferAttribute;
  private readonly normalAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly topUVAttr: THREE.BufferAttribute;

  private readonly noise2D: (x: number, y: number) => number;
  private readonly tmpTopColor = new THREE.Color();
  private readonly tmpSideColor = new THREE.Color();

  constructor(gridSize: number) {
    this.gridSize = gridSize;

    const rng = new RNG(NOISE_SEED);
    this.noise2D = createNoise2D(() => rng.next());

    const totalVerts = gridSize * gridSize * VERTS_PER_TILE;
    this.positions = new Float32Array(totalVerts * 3);
    this.normals = new Float32Array(totalVerts * 3);
    this.colors = new Float32Array(totalVerts * 3);
    this.topUVs = new Float32Array(totalVerts * 2);

    this.geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(this.positions, 3);
    this.normalAttr = new THREE.BufferAttribute(this.normals, 3);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3);
    this.topUVAttr = new THREE.BufferAttribute(this.topUVs, 2);
    this.positionAttr.setUsage(THREE.DynamicDrawUsage);
    this.normalAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttr);
    this.geometry.setAttribute('normal', this.normalAttr);
    this.geometry.setAttribute('aColor', this.colorAttr);
    this.geometry.setAttribute('aTopUV', this.topUVAttr);
    // Loose bounding sphere: the mesh is always inside the camera frustum
    // at our framing, so skipping the per-setTiles `computeBoundingSphere`
    // costs nothing.
    this.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, BOTTOM_Y / 2, 0),
      gridSize,
    );

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uLightDir: { value: LIGHT_DIR.clone() },
        uAmbient: { value: AMBIENT },
        uGridLineColor: { value: new THREE.Color(COLORS.TERMINAL_BLACK) },
        uGridLineWidth: { value: GRID_LINE_WIDTH },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);

    // Initial content: an all-floor grid so the mesh reads as a clean
    // empty stage between battles.
    this.fillFromKindFn(() => 'floor');
  }

  /**
   * Top Y of the cell at (cx, cy) given its tile kind. The same function
   * the geometry uses, exposed so other renderers (BattleRenderer for
   * per-tile sprite Y) can stay in sync with the surface without a
   * second source of truth.
   */
  heightAt(cx: number, cy: number, kind: TileKind): number {
    if (kind === 'shallow_water') return WATER_TOP_Y;
    const n = this.noise2D(cx * NOISE_FREQ, cy * NOISE_FREQ); // [-1, 1]
    const t = (n + 1) * 0.5;
    return FLOOR_RANGE_LO + (FLOOR_RANGE_HI - FLOOR_RANGE_LO) * t;
  }

  setTiles(tileGrid: TileGrid, gridSize: number): void {
    if (gridSize !== this.gridSize) {
      throw new Error(
        `TerrainRenderer.setTiles: gridSize mismatch ${gridSize} vs ${this.gridSize}`,
      );
    }
    this.fillFromKindFn((x, y) => tileGrid.kindAt({ x, y }));
  }

  clear(): void {
    this.fillFromKindFn(() => 'floor');
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  /** Walks every cell, computes height + color, writes 30 verts per cell. */
  private fillFromKindFn(kindAt: (x: number, y: number) => TileKind): void {
    const n = this.gridSize;
    const half = n / 2;
    const pos = this.positions;
    const norm = this.normals;
    const col = this.colors;
    const uv = this.topUVs;
    let vi = 0;

    const writeVert = (
      px: number, py: number, pz: number,
      nx: number, ny: number, nz: number,
      color: THREE.Color,
      uvU: number, uvV: number,
    ): void => {
      const pi = vi * 3;
      const ti = vi * 2;
      pos[pi] = px; pos[pi + 1] = py; pos[pi + 2] = pz;
      norm[pi] = nx; norm[pi + 1] = ny; norm[pi + 2] = nz;
      col[pi] = color.r; col[pi + 1] = color.g; col[pi + 2] = color.b;
      uv[ti] = uvU; uv[ti + 1] = uvV;
      vi++;
    };

    for (let cy = 0; cy < n; cy++) {
      for (let cx = 0; cx < n; cx++) {
        const kind = kindAt(cx, cy);
        const topY = this.heightAt(cx, cy, kind);
        topColorFor(topY, kind, this.tmpTopColor);
        this.tmpSideColor.copy(this.tmpTopColor).multiplyScalar(SIDE_SHADE);
        const top = this.tmpTopColor;
        const side = this.tmpSideColor;

        // World coords match BattleRenderer.gridToWorld.
        const x0 = cx - half;
        const x1 = cx + 1 - half;
        const zHi = half - cy;     // close to camera
        const zLo = half - cy - 1; // far from camera

        // Top face. CCW viewed from +Y → normal +Y.
        writeVert(x0, topY, zHi, 0, 1, 0, top, 0, 0);
        writeVert(x1, topY, zHi, 0, 1, 0, top, 1, 0);
        writeVert(x1, topY, zLo, 0, 1, 0, top, 1, 1);
        writeVert(x0, topY, zHi, 0, 1, 0, top, 0, 0);
        writeVert(x1, topY, zLo, 0, 1, 0, top, 1, 1);
        writeVert(x0, topY, zLo, 0, 1, 0, top, 0, 1);

        // Side: zHi face (close to camera, outward normal +Z).
        writeVert(x0, topY, zHi, 0, 0, 1, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zHi, 0, 0, 1, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zHi, 0, 0, 1, side, 0, 0);
        writeVert(x0, topY, zHi, 0, 0, 1, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zHi, 0, 0, 1, side, 0, 0);
        writeVert(x1, topY, zHi, 0, 0, 1, side, 0, 0);

        // Side: zLo face (away from camera, outward normal -Z).
        writeVert(x1, topY, zLo, 0, 0, -1, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zLo, 0, 0, -1, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zLo, 0, 0, -1, side, 0, 0);
        writeVert(x1, topY, zLo, 0, 0, -1, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zLo, 0, 0, -1, side, 0, 0);
        writeVert(x0, topY, zLo, 0, 0, -1, side, 0, 0);

        // Side: x1 face (right, outward normal +X).
        writeVert(x1, topY, zHi, 1, 0, 0, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zHi, 1, 0, 0, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zLo, 1, 0, 0, side, 0, 0);
        writeVert(x1, topY, zHi, 1, 0, 0, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zLo, 1, 0, 0, side, 0, 0);
        writeVert(x1, topY, zLo, 1, 0, 0, side, 0, 0);

        // Side: x0 face (left, outward normal -X).
        writeVert(x0, topY, zLo, -1, 0, 0, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zLo, -1, 0, 0, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zHi, -1, 0, 0, side, 0, 0);
        writeVert(x0, topY, zLo, -1, 0, 0, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zHi, -1, 0, 0, side, 0, 0);
        writeVert(x0, topY, zHi, -1, 0, 0, side, 0, 0);
      }
    }
    this.positionAttr.needsUpdate = true;
    this.normalAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.topUVAttr.needsUpdate = true;
  }
}

const _floorLow = new THREE.Color(COLORS.DARK_TERMINAL_GREEN);
const _floorHigh = new THREE.Color(COLORS.DARK_TERMINAL_AMBER);
const _waterColor = new THREE.Color('#1F5B7A');

/**
 * Top-face color. Water gets a flat blue (the recess reads through depth,
 * not color variance). Floor tiles lerp DARK_TERMINAL_GREEN →
 * DARK_TERMINAL_AMBER across the floor height range so height variance
 * shows up as a subtle palette shift as well as geometric relief.
 */
function topColorFor(topY: number, kind: TileKind, out: THREE.Color): void {
  if (kind === 'shallow_water') {
    out.copy(_waterColor);
    return;
  }
  const t = Math.max(0, Math.min(1, (topY - FLOOR_RANGE_LO) / (FLOOR_RANGE_HI - FLOOR_RANGE_LO)));
  out.copy(_floorLow).lerp(_floorHigh, t);
}
