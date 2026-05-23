import type * as THREE from 'three';
import type { TileGrid } from '../../sim/TileGrid';

/**
 * C1c decision-point demo interface. Each variant is a self-contained
 * terrain renderer: it owns its mesh (the thing added to the scene) and
 * its own water rendering. Swapping variants is just removing one mesh
 * and adding another.
 *
 * Lifecycle parallels WaterRenderer / SpriteRenderer — page-lifetime
 * object that BattleScene populates on mount and clears on dispose.
 * After the user picks a winner the losing variants get deleted, the
 * winner gets folded back into a single TerrainRenderer, and this
 * interface goes away.
 */
export interface TerrainVariant {
  /** Short label shown by the dev overlay when this variant is active. */
  readonly label: string;
  /** Root object added to the THREE scene. May be a Mesh, Group, or
   *  InstancedMesh — the controller treats it as opaque. */
  readonly mesh: THREE.Object3D;
  /** Repopulate this variant's per-tile data from the current world tile grid. */
  setTiles(tileGrid: TileGrid, gridSize: number): void;
  /** Drop any tile-specific visuals so the variant reads as empty between battles. */
  clear(): void;
  /** Release GL resources. Called at page teardown only. */
  dispose(): void;
}
