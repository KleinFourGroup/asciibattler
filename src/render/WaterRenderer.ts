import * as THREE from 'three';
import type { TileGrid } from '../sim/TileGrid';

/**
 * C1a stand-in for shallow-water tiles. Flat-colored instanced quads at a
 * fixed world Y, one per water cell. No animation, no shader, no bloom —
 * the visual budget is being saved for C1c when terrain gets its proper
 * tile-mesh rewrite.
 *
 * Page-lifetime renderer owned by Game; BattleScene calls `setTiles` on
 * mount (after `applyTerrain`) and `clear` on dispose. Mirrors the
 * SpriteRenderer / BarRenderer lifecycle so all three live in the same
 * `scene3D` and BattleScene only manages their content, not their
 * existence.
 *
 * The water color is local to this module rather than in the COLORS
 * table — it's a stand-in palette choice that C1c is expected to revise
 * (or lift into COLORS if it stays). Treating it as a tactical override
 * keeps the canonical palette small.
 */

/** Y position of the flat water quads. The MVP TerrainRenderer's plane is
 *  centered at -0.5 with ±0.4 fBm displacement, so peaks reach -0.1; the
 *  water Y lifts just above that to avoid z-fighting against terrain
 *  highlands. C1c reconciles this with the rewritten tile mesh. */
const WATER_Y = -0.05;

const WATER_COLOR = new THREE.Color('#1F5B7A');

/** GRID_SIZE * GRID_SIZE upper bound; covers a full-grid water lake. */
const DEFAULT_CAPACITY = 144;

export class WaterRenderer {
  readonly mesh: THREE.InstancedMesh;

  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly capacity: number;
  private readonly tmpMatrix = new THREE.Matrix4();

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = capacity;
    // Unit-size quad laid flat in XZ (matches the terrain plane orientation).
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.geometry.rotateX(-Math.PI / 2);
    this.material = new THREE.MeshBasicMaterial({ color: WATER_COLOR });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  /** Repopulate the water quads from the current tile grid. Walks every
   *  cell; writes one instance per shallow_water tile. Cheap (12×12 = 144
   *  iterations + 144 matrix writes max). */
  setTiles(tileGrid: TileGrid, gridSize: number): void {
    const half = gridSize / 2;
    let n = 0;
    for (const cell of tileGrid.cells()) {
      if (cell.kind !== 'shallow_water') continue;
      if (n >= this.capacity) break;
      // Same grid→world mapping as BattleRenderer.gridToWorld; inlined to
      // avoid the cross-module coupling for what's a stand-in renderer.
      const wx = cell.x + 0.5 - half;
      const wz = half - cell.y - 0.5;
      this.tmpMatrix.makeTranslation(wx, WATER_Y, wz);
      this.mesh.setMatrixAt(n, this.tmpMatrix);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.mesh.count = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
