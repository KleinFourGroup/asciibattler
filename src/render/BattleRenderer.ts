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
  /** unitId → ticks left on its attack-flash override. */
  private readonly flashes = new Map<number, number>();
  /**
   * The currently-attached battle World. Null when no battle is running (map
   * screen, defeat state). Set by `attach`, cleared by `detach`.
   */
  private world: World | null = null;

  constructor(
    private readonly sprites: SpriteRenderer,
    bus: EventBus<GameEvents>,
  ) {
    this.animator = new SpriteAnimator(this.sprites);
    this.subscriptions.push(bus.on('unit:spawned', this.onUnitSpawned));
    this.subscriptions.push(bus.on('unit:moved', this.onUnitMoved));
    this.subscriptions.push(bus.on('unit:attacked', this.onUnitAttacked));
    this.subscriptions.push(bus.on('unit:died', this.onUnitDied));
    this.subscriptions.push(bus.on('tick', this.onTick));
  }

  /** Per-render-frame tick. Drives in-flight sprite lerps. */
  update(dt: number): void {
    this.animator.update(dt);
  }

  /**
   * Bind the renderer to a freshly-built World for the next battle. Must be
   * called before any unit:spawned event fires on that world.
   */
  attach(world: World): void {
    this.world = world;
  }

  /**
   * End-of-battle teardown. Drops every sprite handle and clears all
   * animation state so the next battle starts clean. Bus subscriptions
   * stay live — only the World reference and the per-battle sprite state
   * are reset.
   *
   * Side effect: any in-flight death fades (started in the same tick
   * battle:ended fired) get cut short. Acceptable for 4.3 because Run
   * has no pause between battle-end and the next screen. Step 4.4 inserts
   * the RecruitScreen (and 4.5 the Game Over screen) — once those pauses
   * exist the fade plays out behind them and this no longer shows.
   */
  detach(): void {
    this.animator.clear();
    for (const handle of this.handles.values()) {
      this.sprites.removeSprite(handle);
    }
    this.handles.clear();
    this.flashes.clear();
    this.world = null;
  }

  dispose(): void {
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
  }

  private onUnitSpawned = ({ unitId }: { unitId: number }): void => {
    if (!this.world) return;
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
    if (!this.world) return;
    const handle = this.handles.get(unitId);
    if (!handle) return;
    this.animator.startLerp(
      handle,
      gridToWorld(from, this.world.gridSize),
      gridToWorld(to, this.world.gridSize),
      ticksToSeconds(durationTicks),
    );
  };

  /**
   * Flash both sides of the swing: TERMINAL_AMBER on the attacker so you
   * can see who's acting, FLOURESCENT_BLUE on the target so impacts read
   * clearly. Both fall back to the unit's team color when the per-flash
   * tick counter runs out. Mutual hits in the same tick are fine — the
   * later `startFlash` overwrites the earlier one and starts a fresh
   * countdown.
   */
  private onUnitAttacked = ({
    attackerId,
    targetId,
  }: GameEvents['unit:attacked']): void => {
    this.startFlash(attackerId, COLORS.TERMINAL_AMBER);
    this.startFlash(targetId, COLORS.FLOURESCENT_BLUE);
  };

  private startFlash(unitId: number, color: string): void {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    this.sprites.updateSprite(handle, { color });
    this.flashes.set(unitId, FLASH_TICKS);
  }

  /**
   * Fade the dead unit's sprite out, then remove it. Cancels any in-flight
   * position lerp and pending flash revert so they can't fight the fade.
   */
  private onUnitDied = ({ unitId }: GameEvents['unit:died']): void => {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    this.animator.cancel(handle);
    this.flashes.delete(unitId);
    this.animator.startFade(handle, FADE_SECONDS, () => {
      this.sprites.removeSprite(handle);
      this.handles.delete(unitId);
    });
  };

  /** Decrements active flashes; reverts each sprite when its counter hits 0. */
  private onTick = (): void => {
    if (!this.world) return;
    for (const [unitId, remaining] of this.flashes) {
      if (remaining <= 1) {
        const handle = this.handles.get(unitId);
        const unit = this.world.findUnit(unitId);
        if (handle && unit) {
          this.sprites.updateSprite(handle, { color: colorForTeam(unit.team) });
        }
        this.flashes.delete(unitId);
      } else {
        this.flashes.set(unitId, remaining - 1);
      }
    }
  };
}

/** Duration of the attacker-flash color override. */
const FLASH_TICKS = 2;

/** Duration of the dead-unit alpha fade-out. */
const FADE_SECONDS = 0.3;

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
