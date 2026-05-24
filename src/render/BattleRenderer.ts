import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { World } from '../sim/World';
import type { Team, Unit } from '../sim/Unit';
import type { SpriteHandle, SpriteRenderer } from './SpriteRenderer';
import type { BarHandle, BarRenderer } from './BarRenderer';
import type { TerrainRenderer } from './TerrainRenderer';
import { COLORS } from './palette';
import { SpriteAnimator } from './animation/SpriteAnimator';
import { TICK_RATE, ticksToSeconds } from '../config';
import { MOVE_ACTION_ID } from '../sim/actions/MoveAction';

/**
 * The simulation/render seam. Subscribes to sim events and turns them into
 * SpriteRenderer + BarRenderer calls — sim never imports from render. New
 * events get a new handler here; the renderers stay dumb instance-buffer
 * managers.
 *
 * Owns the per-frame SpriteAnimator that turns unit:moved events into smooth
 * lerps. Game calls `update(dt)` once per render frame; that drives sprite
 * lerps and bar position-follow + progress-bar fill (B3).
 */

interface BarPair {
  readonly hp: BarHandle;
  readonly progress: BarHandle;
}

/** Tracks an in-flight action's wall-clock start so the progress bar can fill smoothly between sim ticks. */
interface ActiveProgress {
  /** `world.tick` at which the current activeAction began. Identity check so we re-anchor when the action changes. */
  startTick: number;
  /** `performance.now()` ms when this run was first observed by the render loop. */
  startedAtMs: number;
  /** Total duration in ms, computed from `(finishTick - startTick) / TICK_RATE`. */
  durationMs: number;
}

interface BarFade {
  elapsed: number;
  readonly duration: number;
  readonly pair: BarPair;
}

export class BattleRenderer {
  private readonly handles = new Map<number, SpriteHandle>();
  private readonly barPairs = new Map<number, BarPair>();
  private readonly subscriptions: Array<() => void> = [];
  private readonly animator: SpriteAnimator;
  /** unitId → ticks left on its attack-flash override. */
  private readonly flashes = new Map<number, number>();
  /** unitId → in-flight action timing for the progress bar. */
  private readonly progress = new Map<number, ActiveProgress>();
  /** unitId → ongoing post-death bar fade. */
  private readonly barFades = new Map<number, BarFade>();
  /** Scratch vectors to avoid per-frame allocation when reading + offsetting sprite positions. */
  private readonly scratchPos = new THREE.Vector3();
  private readonly scratchBarPos = new THREE.Vector3();
  /**
   * The currently-attached battle World. Null when no battle is running (map
   * screen, defeat state). Set by `attach`, cleared by `detach`.
   */
  private world: World | null = null;

  constructor(
    private readonly sprites: SpriteRenderer,
    private readonly bars: BarRenderer,
    /** C1c: queried at sprite spawn + move endpoints so units stand on
     *  the tile top instead of floating at a fixed plane. */
    private readonly terrain: TerrainRenderer,
    bus: EventBus<GameEvents>,
  ) {
    this.animator = new SpriteAnimator(this.sprites);
    this.subscriptions.push(bus.on('unit:spawned', this.onUnitSpawned));
    this.subscriptions.push(bus.on('unit:moved', this.onUnitMoved));
    this.subscriptions.push(bus.on('unit:attacked', this.onUnitAttacked));
    this.subscriptions.push(bus.on('unit:died', this.onUnitDied));
    this.subscriptions.push(bus.on('tick', this.onTick));
  }

  /** Per-render-frame tick. Drives sprite lerps + bar position-follow + progress fill. */
  update(dt: number): void {
    this.animator.update(dt);
    this.updateBars(dt);
  }

  /**
   * Bind the renderer to a freshly-built World for the next battle. Must be
   * called before any unit:spawned event fires on that world.
   */
  attach(world: World): void {
    this.world = world;
  }

  /**
   * End-of-battle teardown. Drops every sprite + bar handle and clears all
   * animation state so the next battle starts clean. Bus subscriptions stay
   * live — only the World reference and the per-battle state are reset.
   *
   * Side effect: any in-flight death fades (started in the same tick
   * battle:ended fired) get cut short. Acceptable: subsequent screens hide
   * the cut-short visual. See HANDOFF gotcha #15.
   */
  detach(): void {
    this.animator.clear();
    for (const handle of this.handles.values()) {
      this.sprites.removeSprite(handle);
    }
    this.handles.clear();
    for (const pair of this.barPairs.values()) {
      this.bars.removeBar(pair.hp);
      this.bars.removeBar(pair.progress);
    }
    this.barPairs.clear();
    // Also clean up bars that were mid-fade when the battle ended (typically
    // the killing-blow victim — its onUnitDied fired in the same synchronous
    // burst as battle:ended). Without this the fade map gets cleared but the
    // bar handles linger in the scene and show up on the map screen.
    for (const fade of this.barFades.values()) {
      this.bars.removeBar(fade.pair.hp);
      this.bars.removeBar(fade.pair.progress);
    }
    this.barFades.clear();
    this.flashes.clear();
    this.progress.clear();
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
    const spritePos = this.tileWorldPos(unit.position);
    const handle = this.sprites.addSprite(unit.glyph, colorForTeam(unit.team), spritePos);
    this.handles.set(unit.id, handle);

    // Neutrals (walls, environment) are inert background — suppress the
    // halo and skip HP/progress bars entirely. C1a walls are indestructible
    // so an HP bar would be visual noise; destructible variants later can
    // opt back in.
    if (unit.team === 'neutral') {
      this.sprites.updateSprite(handle, { bloomIntensity: 0 });
      return;
    }

    // HP bar above the sprite; progress bar tucked between sprite and HP bar.
    // Both start in their full-fill state; the per-frame update tick will
    // hide the progress bar immediately (no activeAction at spawn).
    const hpColor = hpFillColor(1);
    const hp = this.bars.addBar({
      position: hpBarPos(spritePos, this.scratchPos),
      size: HP_BAR_SIZE,
      fillPct: 1,
      bgColor: HP_BAR_BG,
      fillColor: hpColor,
      alpha: 1,
    });
    const progress = this.bars.addBar({
      position: progressBarPos(spritePos, this.scratchPos),
      size: PROGRESS_BAR_SIZE,
      fillPct: 0,
      bgColor: PROGRESS_BAR_BG,
      fillColor: PROGRESS_BAR_FILL,
      alpha: 0,
    });
    this.barPairs.set(unit.id, { hp, progress });
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
      this.tileWorldPos(from),
      this.tileWorldPos(to),
      ticksToSeconds(durationTicks),
    );
  };

  /**
   * World position for the sprite standing on cell `coord`. XZ from
   * gridToWorld; Y is the terrain top-of-tile (per-cell from
   * `TerrainRenderer.heightAt`) plus the sprite's center offset so the
   * 1×1 quad's base sits flush on the surface.
   */
  private tileWorldPos(coord: GridCoord): THREE.Vector3 {
    if (!this.world) throw new Error('BattleRenderer.tileWorldPos: no attached world');
    const pos = gridToWorld(coord, this.world.gridW, this.world.gridH);
    const kind = this.world.tileGrid.kindAt(coord);
    pos.y = this.terrain.heightAt(coord.x, coord.y, kind) + SPRITE_CENTER_OFFSET;
    return pos;
  }

  /**
   * Flash both sides of the swing: TERMINAL_AMBER on the attacker so you
   * can see who's acting, FLOURESCENT_BLUE on the target so impacts read
   * clearly. Both fall back to the unit's team color when the per-flash
   * tick counter runs out. Mutual hits in the same tick are fine — the
   * later `startFlash` overwrites the earlier one and starts a fresh
   * countdown. Also refreshes the target's HP bar (the sim has applied
   * damage by the time this event fires).
   */
  private onUnitAttacked = ({
    attackerId,
    targetId,
  }: GameEvents['unit:attacked']): void => {
    this.startFlash(attackerId, COLORS.TERMINAL_AMBER);
    this.startFlash(targetId, COLORS.FLOURESCENT_BLUE);
    this.refreshHpBar(targetId);
  };

  private startFlash(unitId: number, color: string): void {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    this.sprites.updateSprite(handle, { color });
    this.flashes.set(unitId, FLASH_TICKS);
  }

  private refreshHpBar(unitId: number): void {
    if (!this.world) return;
    const unit = this.world.findUnit(unitId);
    const pair = this.barPairs.get(unitId);
    if (!unit || !pair) return;
    const pct = Math.max(0, unit.currentHp) / unit.stats.maxHp;
    this.bars.updateBar(pair.hp, { fillPct: pct, fillColor: hpFillColor(pct) });
  }

  /**
   * Fade the dead unit's sprite out, then remove it. Cancels any in-flight
   * position lerp and pending flash revert so they can't fight the fade.
   * Bars fade alongside the sprite for visual coherence, then get removed.
   */
  private onUnitDied = ({ unitId }: GameEvents['unit:died']): void => {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    this.animator.cancel(handle);
    this.flashes.delete(unitId);
    this.progress.delete(unitId);
    this.animator.startFade(handle, FADE_SECONDS, () => {
      this.sprites.removeSprite(handle);
      this.handles.delete(unitId);
    });
    const pair = this.barPairs.get(unitId);
    if (pair) {
      this.barFades.set(unitId, { elapsed: 0, duration: FADE_SECONDS, pair });
      this.barPairs.delete(unitId);
    }
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

  /**
   * Per-frame bar driver. Three responsibilities:
   *
   * 1. Bar position-follow: bars track the sprite's *current* world position,
   *    not the grid cell. Reading from SpriteRenderer.getPosition picks up
   *    SpriteAnimator lerps for free, so bars glide with their unit through
   *    a move instead of teleporting to the destination cell.
   * 2. Progress bar fill: anchor wall-clock to `activeAction.startTick`
   *    transitions so progress fills smoothly between sim ticks. The
   *    Clock owns sub-tick time and doesn't expose it, but anchoring on
   *    `performance.now()` at the first frame we observe an activeAction
   *    gives equivalent smoothness for actions long enough to matter.
   *    Progress bar is hidden (alpha=0) when no action is in flight.
   * 3. Bar fade-out on death: lerp alpha 1→0 over FADE_SECONDS, mirroring
   *    the sprite fade, then remove the bars.
   */
  private updateBars(dt: number): void {
    const now = performance.now();

    // Drive post-death fades; remove when complete.
    for (const [unitId, fade] of this.barFades) {
      fade.elapsed += dt;
      const t = fade.elapsed >= fade.duration ? 1 : fade.elapsed / fade.duration;
      const alpha = 1 - t;
      this.bars.updateBar(fade.pair.hp, { alpha });
      this.bars.updateBar(fade.pair.progress, { alpha: 0 });
      if (t >= 1) {
        this.bars.removeBar(fade.pair.hp);
        this.bars.removeBar(fade.pair.progress);
        this.barFades.delete(unitId);
      }
    }

    if (!this.world) return;

    for (const [unitId, pair] of this.barPairs) {
      const handle = this.handles.get(unitId);
      const unit = this.world.findUnit(unitId);
      if (!handle || !unit) continue;
      const spritePos = this.sprites.getPosition(handle, this.scratchPos);
      if (!spritePos) continue;

      this.bars.updateBar(pair.hp, { position: hpBarPos(spritePos, this.scratchBarPos) });
      this.bars.updateBar(pair.progress, { position: progressBarPos(spritePos, this.scratchBarPos) });

      this.updateProgressFill(unitId, unit, pair, now);
    }
  }

  private updateProgressFill(unitId: number, unit: Unit, pair: BarPair, now: number): void {
    const active = unit.activeAction;
    // Hide the progress bar for movement — every step would flash a 1-tick
    // bar, which reads as visual noise. The bar is meant for "this unit is
    // doing something that takes time" (attack swings, charge-ups, channels);
    // movement is handled by the sprite lerp itself.
    if (!active || active.finishTick <= active.startTick || active.action.id === MOVE_ACTION_ID) {
      if (this.progress.has(unitId)) this.progress.delete(unitId);
      this.bars.updateBar(pair.progress, { alpha: 0 });
      return;
    }

    let entry = this.progress.get(unitId);
    if (!entry || entry.startTick !== active.startTick) {
      const ticks = active.finishTick - active.startTick;
      const durationMs = (ticks * 1000) / TICK_RATE;
      // If this is the first frame we see an already-running action (e.g.
      // started mid-tick before our update fires), back-date the anchor by
      // the integer ticks that have already elapsed so the bar resumes at
      // the right fill rather than restarting from 0.
      const elapsedTicks = Math.max(0, (this.world?.currentTick ?? active.startTick) - active.startTick);
      const elapsedMs = (elapsedTicks * 1000) / TICK_RATE;
      entry = { startTick: active.startTick, startedAtMs: now - elapsedMs, durationMs };
      this.progress.set(unitId, entry);
    }

    const elapsed = now - entry.startedAtMs;
    const fillPct = Math.max(0, Math.min(1, elapsed / entry.durationMs));
    this.bars.updateBar(pair.progress, { fillPct, alpha: 1 });
  }
}

/** Duration of the attacker-flash color override. */
const FLASH_TICKS = 2;

/** Duration of the dead-unit alpha fade-out (sprite + bars). */
const FADE_SECONDS = 0.3;

/** HP bar geometry. World units; sprite quad is 1×1 so 0.8 is most-but-not-all of the unit's width. */
const HP_BAR_SIZE = new THREE.Vector2(0.8, 0.1);
const PROGRESS_BAR_SIZE = new THREE.Vector2(0.6, 0.05);

/** Vertical offsets above the sprite center (world Y units). */
const HP_BAR_Y_OFFSET = 0.6;
const PROGRESS_BAR_Y_OFFSET = 0.45;

const HP_BAR_BG = COLORS.TERMINAL_BLACK;
const PROGRESS_BAR_BG = COLORS.TERMINAL_BLACK;
const PROGRESS_BAR_FILL = COLORS.FLOURESCENT_BLUE;

const _gradientScratch = new THREE.Color();
const _gradientLow = new THREE.Color(COLORS.NEON_RED);
const _gradientMid = new THREE.Color(COLORS.TERMINAL_AMBER);
const _gradientHigh = new THREE.Color(COLORS.TERMINAL_GREEN);

/**
 * HP gradient: green at full → amber at half → red at zero. Per the B3
 * design pick — same color for both teams so HP state reads independent of
 * which side the unit is on (team identity is already conveyed by the
 * sprite's color).
 */
function hpFillColor(pct: number): THREE.Color {
  const p = Math.max(0, Math.min(1, pct));
  if (p >= 0.5) {
    const t = (p - 0.5) * 2;
    return _gradientScratch.copy(_gradientMid).lerp(_gradientHigh, t);
  }
  const t = p * 2;
  return _gradientScratch.copy(_gradientLow).lerp(_gradientMid, t);
}

function hpBarPos(spritePos: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  return out.set(spritePos.x, spritePos.y + HP_BAR_Y_OFFSET, spritePos.z);
}

function progressBarPos(spritePos: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  return out.set(spritePos.x, spritePos.y + PROGRESS_BAR_Y_OFFSET, spritePos.z);
}

function colorForTeam(team: Team): string {
  if (team === 'player') return COLORS.TERMINAL_GREEN;
  if (team === 'enemy') return COLORS.NEON_RED;
  return COLORS.TERMINAL_STONE;
}

/**
 * Sprite center height above the tile top. The 1×1 sprite quad is centered
 * on `SPRITE_CENTER_OFFSET`, so with this at 0.5 the quad's base sits flush
 * on whatever Y the terrain reports for the cell — no floating gap on lower
 * tiles, no clipping into higher ones. Pre-C1c this was a fixed `SPRITE_Y`
 * relative to world origin; now it's a delta off `TerrainRenderer.heightAt`.
 */
const SPRITE_CENTER_OFFSET = 0.5;

/**
 * Grid → world coordinates (XZ only). Cells are 1×1; the grid is centered
 * on the world origin. `cell.y` (grid axis 2) maps to world `-z` so grid
 * (0, 0) is the near-left cell from the camera's POV — matches the
 * "(0, 0) is bottom-left" convention in core/types.ts.
 *
 * D3: X and Z half-extents come from `gridW` and `gridH` independently
 * so rectangular arenas stay centered on the world origin (pre-D3 took
 * a single `gridSize`).
 *
 * Y is left at `SPRITE_CENTER_OFFSET` as a sensible default for callers
 * without per-tile-height context; BattleRenderer overrides Y per cell via
 * `tileWorldPos`.
 */
export function gridToWorld(cell: GridCoord, gridW: number, gridH: number): THREE.Vector3 {
  const halfX = gridW / 2;
  const halfZ = gridH / 2;
  return new THREE.Vector3(cell.x + 0.5 - halfX, SPRITE_CENTER_OFFSET, halfZ - cell.y - 0.5);
}
