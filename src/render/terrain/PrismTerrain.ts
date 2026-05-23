import * as THREE from 'three';
import type { TileGrid, TileKind } from '../../sim/TileGrid';
import type { TerrainVariant } from './TerrainVariant';
import VERTEX_SHADER from '../shaders/c1c-prism.vert.glsl?raw';
import FRAGMENT_SHADER from '../shaders/c1c-prism.frag.glsl?raw';
import { COLORS } from '../palette';

/**
 * Shared builder for C1c variants B (faceted low-poly) and C (stepped
 * simplex). Both render a prism per tile — top quad + 4 side quads, no
 * bottom (never visible from the locked camera pitch). What differs is
 * how `heightFn` maps a tile to its top Y; everything else (palette,
 * lighting, grid line on the top face) is the same.
 *
 * Geometry is non-indexed so every face has its own normals → hard-edged
 * faceted shading without needing `flatShading` or an indexed→non-indexed
 * pre-pass. Buffers are pre-allocated once at gridSize² capacity and
 * rewritten in-place each setTiles; nothing here allocates per battle.
 */

const VERTS_PER_TILE = 30; // 5 quads × 2 tris × 3 verts (top + 4 sides; bottom omitted)
const BOTTOM_Y = -0.7;

/** Diffuse light direction (in world space). View-space normal . light is the diffuse term. */
const LIGHT_DIR = new THREE.Vector3(0.4, 0.85, 0.35).normalize();
/** Floor of the diffuse term — sides never go fully black. */
const AMBIENT = 0.45;
/** Side-face color multiplier (darker than the top for face-to-face contrast). */
const SIDE_SHADE = 0.7;
/** Top-face grid-line width as a fraction of cell size. */
const GRID_LINE_WIDTH = 0.06;

export interface PrismTerrainConfig {
  readonly label: string;
  readonly gridSize: number;
  /** topY for a given cell. Called once per cell during setTiles. */
  heightFn(cx: number, cy: number, kind: TileKind): number;
}

export class PrismTerrain implements TerrainVariant {
  readonly label: string;
  readonly mesh: THREE.Mesh;

  private readonly gridSize: number;
  private readonly heightFn: PrismTerrainConfig['heightFn'];

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

  private readonly tmpTopColor = new THREE.Color();
  private readonly tmpSideColor = new THREE.Color();

  constructor(config: PrismTerrainConfig) {
    this.label = config.label;
    this.gridSize = config.gridSize;
    this.heightFn = config.heightFn;

    const totalVerts = config.gridSize * config.gridSize * VERTS_PER_TILE;
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
    // Bounding sphere covers the worst case (full-tile heights through the
    // bottom). Skipping `computeBoundingSphere` per setTiles avoids the
    // attribute walk; the loose bound is fine since the mesh is always on
    // screen at this camera framing.
    this.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, BOTTOM_Y / 2, 0),
      config.gridSize,
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

    // Default content: all-floor grid at heightFn(_, _, 'floor'). Keeps the
    // mesh non-empty between battles so the user can compare variants on
    // the map screen if they want.
    this.fillFromHeightFn(() => 'floor');
  }

  setTiles(tileGrid: TileGrid, gridSize: number): void {
    if (gridSize !== this.gridSize) {
      throw new Error(`PrismTerrain.setTiles: gridSize mismatch ${gridSize} vs ${this.gridSize}`);
    }
    this.fillFromHeightFn((x, y) => tileGrid.kindAt({ x, y }));
  }

  clear(): void {
    // Dormant state: all floor, same as boot. Makes between-battle reads
    // identical regardless of the last battle's tile layout.
    this.fillFromHeightFn(() => 'floor');
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  /** Walks every cell, computes height + color, writes 30 verts per cell. */
  private fillFromHeightFn(kindAt: (x: number, y: number) => TileKind): void {
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
        const topY = this.heightFn(cx, cy, kind);
        topColorFor(topY, kind, this.tmpTopColor);
        this.tmpSideColor.copy(this.tmpTopColor).multiplyScalar(SIDE_SHADE);
        const top = this.tmpTopColor;
        const side = this.tmpSideColor;

        // World coords (matches BattleRenderer.gridToWorld).
        const x0 = cx - half;
        const x1 = cx + 1 - half;
        const zHi = half - cy;       // close to camera
        const zLo = half - cy - 1;   // far from camera

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

/**
 * Shared top-face color treatment for B and C. Water tiles get a single
 * blue regardless of topY. Floor tiles lerp DARK_TERMINAL_GREEN →
 * DARK_TERMINAL_AMBER across the height range so the height variance
 * reads as a subtle palette gradient as well as geometric variation.
 */
const _floorLow = new THREE.Color(COLORS.DARK_TERMINAL_GREEN);
const _floorHigh = new THREE.Color(COLORS.DARK_TERMINAL_AMBER);
const _waterColor = new THREE.Color('#1F5B7A');

function topColorFor(topY: number, kind: TileKind, out: THREE.Color): void {
  if (kind === 'shallow_water') {
    out.copy(_waterColor);
    return;
  }
  // Floor heights expected in [-0.3, 0]. Clamp + lerp.
  const t = Math.max(0, Math.min(1, (topY + 0.3) / 0.3));
  out.copy(_floorLow).lerp(_floorHigh, t);
}
