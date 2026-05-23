import * as THREE from 'three';
import type { TileGrid } from '../../sim/TileGrid';
import { COLORS } from '../palette';
import VERTEX_SHADER from '../shaders/c1c-flat.vert.glsl?raw';
import FRAGMENT_SHADER from '../shaders/c1c-flat.frag.glsl?raw';
import type { TerrainVariant } from './TerrainVariant';

/**
 * C1c variant A — flat tiles + shader-baked grid.
 *
 * Single plane at tile-top Y, the fragment shader paints tile-kind
 * color (floor vs water) plus a grid line at each cell edge. Tile
 * kinds are pushed into a small DataTexture once per battle (in
 * `setTiles`); no per-frame work.
 *
 * Tile-top sits at TOP_Y; sprite center at 0.5 with the quad's base
 * at 0 means the sprite base is just above the surface (flush, no
 * floating). The B4-deferred vertical-stack tightening is captured
 * by this Y choice — the previous fBm TerrainRenderer peaked at
 * Y=-0.1, a 0.1-unit gap from the sprite base.
 */

const TOP_Y = 0;

/** Half-width of the shader's grid-line band, in cell-fraction units. */
const GRID_LINE_WIDTH = 0.045;

export class FlatGridTerrain implements TerrainVariant {
  readonly label = 'Flat + grid bake';
  readonly mesh: THREE.Mesh;

  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly tileTexture: THREE.DataTexture;
  /** R channel only, but DataTexture wants RGBA on most paths — write all four to a single shared buffer. */
  private readonly tileData: Uint8Array;
  private readonly gridSize: number;

  constructor(gridSize: number) {
    this.gridSize = gridSize;

    this.geometry = new THREE.PlaneGeometry(gridSize, gridSize);
    this.geometry.rotateX(-Math.PI / 2);
    this.geometry.translate(0, TOP_Y, 0);

    this.tileData = new Uint8Array(gridSize * gridSize * 4);
    this.tileData.fill(255);
    this.tileTexture = new THREE.DataTexture(this.tileData, gridSize, gridSize);
    this.tileTexture.magFilter = THREE.NearestFilter;
    this.tileTexture.minFilter = THREE.NearestFilter;
    this.tileTexture.needsUpdate = true;

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTileMap: { value: this.tileTexture },
        uGridSize: { value: gridSize },
        uFloorColor: { value: new THREE.Color(COLORS.DARK_TERMINAL_GREEN) },
        uWaterColor: { value: new THREE.Color('#1F5B7A') },
        uGridLineColor: { value: new THREE.Color(COLORS.TERMINAL_BLACK) },
        uGridLineWidth: { value: GRID_LINE_WIDTH },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  setTiles(tileGrid: TileGrid, gridSize: number): void {
    if (gridSize !== this.gridSize) {
      throw new Error(
        `FlatGridTerrain.setTiles: gridSize mismatch ${gridSize} vs ${this.gridSize}`,
      );
    }
    for (const cell of tileGrid.cells()) {
      const i = (cell.y * gridSize + cell.x) * 4;
      const v = cell.kind === 'floor' ? 255 : 0;
      this.tileData[i] = v;
      this.tileData[i + 1] = v;
      this.tileData[i + 2] = v;
      this.tileData[i + 3] = 255;
    }
    this.tileTexture.needsUpdate = true;
  }

  clear(): void {
    // Paint everything floor — the variant is dormant between battles, so a
    // featureless slab of base color is the cleanest "empty" read.
    this.tileData.fill(255);
    this.tileTexture.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.tileTexture.dispose();
  }
}
