import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { World } from '../sim/World';
import type { Team } from '../sim/Unit';
import type { SpriteHandle, SpriteRenderer } from './SpriteRenderer';
import { COLORS } from './palette';

/**
 * The simulation/render seam. Subscribes to sim events and turns them into
 * SpriteRenderer calls — sim never imports from render. New events get a new
 * handler here; SpriteRenderer stays a dumb instance-buffer manager.
 *
 * Step 3.2 handles unit:spawned only. unit:moved / unit:attacked / unit:died
 * land in 3.5–3.8.
 */
export class BattleRenderer {
  private readonly handles = new Map<number, SpriteHandle>();
  private readonly subscriptions: Array<() => void> = [];

  constructor(
    private readonly sprites: SpriteRenderer,
    private readonly world: World,
    bus: EventBus<GameEvents>,
  ) {
    this.subscriptions.push(bus.on('unit:spawned', this.onUnitSpawned));
    this.subscriptions.push(bus.on('unit:moved', this.onUnitMoved));
  }

  dispose(): void {
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
  }

  private onUnitSpawned = ({ unitId }: { unitId: number }): void => {
    const unit = this.world.findUnit(unitId);
    if (!unit) return;
    const handle = this.sprites.addSprite(
      unit.glyph,
      colorForTeam(unit.team),
      gridToWorld(unit.position, this.world.gridSize),
    );
    this.handles.set(unit.id, handle);
  };

  /**
   * Step 3.5: teleport the sprite to its new cell. Step 3.6 swaps this for a
   * lerp driven by SpriteAnimator using `from` + `durationTicks`.
   */
  private onUnitMoved = ({ unitId, to }: GameEvents['unit:moved']): void => {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    this.sprites.updateSprite(handle, {
      position: gridToWorld(to, this.world.gridSize),
    });
  };
}

function colorForTeam(team: Team): string {
  return team === 'player' ? COLORS.TERMINAL_GREEN : COLORS.NEON_RED;
}

/** Sprite center height. Sits just above the terrain plane (base Y = -0.5). */
const SPRITE_Y = 0.5;

/**
 * Grid → world coordinates. Cells are 1×1; the grid is centered on the world
 * origin. `cell.y` (grid axis 2) maps to world `-z` so grid (0, 0) is the
 * near-left cell from the camera's POV — matches the "(0, 0) is bottom-left"
 * convention in core/types.ts.
 */
export function gridToWorld(cell: GridCoord, gridSize: number): THREE.Vector3 {
  const half = gridSize / 2;
  return new THREE.Vector3(cell.x + 0.5 - half, SPRITE_Y, half - cell.y - 0.5);
}
