import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { World } from '../sim/World';
import type { Team } from '../sim/Unit';
import type { SpriteHandle, SpriteRenderer } from './SpriteRenderer';
import { COLORS } from './palette';
import { SpriteAnimator } from './animation/SpriteAnimator';
import { ticksToSeconds } from '../config';

/**
 * The simulation/render seam. Subscribes to sim events and turns them into
 * SpriteRenderer calls — sim never imports from render. New events get a new
 * handler here; SpriteRenderer stays a dumb instance-buffer manager.
 *
 * Owns the per-frame SpriteAnimator that turns unit:moved events into smooth
 * lerps. Game calls `update(dt)` once per render frame.
 */
export class BattleRenderer {
  private readonly handles = new Map<number, SpriteHandle>();
  private readonly subscriptions: Array<() => void> = [];
  private readonly animator: SpriteAnimator;

  constructor(
    private readonly sprites: SpriteRenderer,
    private readonly world: World,
    bus: EventBus<GameEvents>,
  ) {
    this.animator = new SpriteAnimator(this.sprites);
    this.subscriptions.push(bus.on('unit:spawned', this.onUnitSpawned));
    this.subscriptions.push(bus.on('unit:moved', this.onUnitMoved));
  }

  /** Per-render-frame tick. Drives in-flight sprite lerps. */
  update(dt: number): void {
    this.animator.update(dt);
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

  private onUnitMoved = ({
    unitId,
    from,
    to,
    durationTicks,
  }: GameEvents['unit:moved']): void => {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    this.animator.startLerp(
      handle,
      gridToWorld(from, this.world.gridSize),
      gridToWorld(to, this.world.gridSize),
      ticksToSeconds(durationTicks),
    );
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
