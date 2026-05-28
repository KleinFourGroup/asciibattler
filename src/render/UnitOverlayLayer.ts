import * as THREE from 'three';
import type { Team } from '../sim/Unit';

/**
 * E3.6 — DOM-based per-unit overlay (HP bar + action progress bar + level
 * badge). Replaces the canvas-instanced `BarRenderer`. Each unit gets a
 * single `<div class="unit-overlay">` with three children; per-frame the
 * overlay's `transform` is set from the projected world position of the
 * unit's sprite (`SpriteRenderer.getPosition`), so overlays follow the
 * sprite through SpriteAnimator lerps for free.
 *
 * One projection per unit per frame: cheaper than three (one per bar +
 * the level badge) and the internal layout is pure CSS — no per-element
 * positioning math.
 *
 * Z-order: above the HUD but below `#scanlines` (which sits at z=1000).
 * The CRT scanline overlay still rakes across the unit overlays, so the
 * diorama framing stays unified.
 *
 * Builds on the world-to-screen projector that E6.C (hitsplats) reuses.
 */

export interface UnitOverlayHandle {
  readonly id: number;
  readonly root: HTMLDivElement;
  readonly hpFill: HTMLDivElement;
  readonly progressEl: HTMLDivElement;
  readonly progressFill: HTMLDivElement;
  readonly levelBadge: HTMLDivElement;
  team: Team;
  /** Last applied opacity. Skips DOM writes when unchanged. */
  alpha: number;
  /** Last applied HP fill % (0..1). Skips DOM writes when unchanged. */
  hpPct: number;
  /** Last applied progress fill % (0..1), or null when hidden. */
  progressPct: number | null;
  /** Last applied level. */
  level: number;
}

export class UnitOverlayLayer {
  readonly root: HTMLDivElement;
  private readonly camera: THREE.Camera;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlays = new Map<number, UnitOverlayHandle>();
  private nextId = 1;
  private readonly projectScratch = new THREE.Vector3();

  /**
   * `insertBefore` is the reference element the overlay container is
   * inserted before in its parent. Pass the existing `#ui` element so
   * the overlays paint *under* HUD chrome — world content shouldn't
   * obscure menus. Pass `null` to append at the end.
   */
  constructor(
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
    insertBefore: HTMLElement,
  ) {
    this.camera = camera;
    this.canvas = canvas;
    this.root = document.createElement('div');
    this.root.id = 'unit-overlays';
    insertBefore.parentElement!.insertBefore(this.root, insertBefore);
  }

  /**
   * Build a fresh overlay for a unit. Caller is responsible for the
   * initial position (`updatePosition`) on the same tick — the new
   * element is appended off-screen at (0, 0) until then.
   */
  add(team: Team, level: number, alpha = 1): UnitOverlayHandle {
    const id = this.nextId++;

    const root = document.createElement('div');
    root.className = `unit-overlay unit-overlay--${team}`;
    root.style.opacity = String(alpha);

    const stack = document.createElement('div');
    stack.className = 'unit-overlay-stack';

    const levelBadge = document.createElement('div');
    levelBadge.className = 'level-badge';
    levelBadge.textContent = `Lv ${level}`;

    const hpBar = document.createElement('div');
    hpBar.className = 'hp-bar';
    const hpFill = document.createElement('div');
    hpFill.className = 'hp-bar-fill';
    hpBar.appendChild(hpFill);

    const progressEl = document.createElement('div');
    progressEl.className = 'action-progress';
    progressEl.hidden = true;
    const progressFill = document.createElement('div');
    progressFill.className = 'action-progress-fill';
    progressEl.appendChild(progressFill);

    stack.appendChild(levelBadge);
    stack.appendChild(hpBar);
    stack.appendChild(progressEl);
    root.appendChild(stack);
    this.root.appendChild(root);

    const handle: UnitOverlayHandle = {
      id,
      root,
      hpFill,
      progressEl,
      progressFill,
      levelBadge,
      team,
      alpha,
      hpPct: 1,
      progressPct: null,
      level,
    };
    this.overlays.set(id, handle);
    this.applyHp(handle, 1);
    return handle;
  }

  remove(handle: UnitOverlayHandle): void {
    if (!this.overlays.delete(handle.id)) return;
    handle.root.remove();
  }

  /** Number of attached overlays. Test hook. */
  get count(): number {
    return this.overlays.size;
  }

  /**
   * Project a world position to CSS pixels and apply it to the overlay
   * root via `transform: translate3d(...)`. GPU-composited; no layout
   * thrash. If the point projects behind the camera the overlay is
   * hidden (visibility: hidden, preserving the DOM node).
   */
  updatePosition(handle: UnitOverlayHandle, worldPos: THREE.Vector3): void {
    const v = this.projectScratch.copy(worldPos).project(this.camera);
    // NDC z > 1 means behind the camera or past the far plane; |x|, |y| > 1
    // means off-screen. Hide rather than translate to negative pixels so
    // overlays don't pile up off-canvas as half-rendered ghosts.
    const offscreen = v.z > 1 || v.z < -1;
    if (offscreen) {
      if (handle.root.style.visibility !== 'hidden') handle.root.style.visibility = 'hidden';
      return;
    }
    if (handle.root.style.visibility === 'hidden') handle.root.style.visibility = '';
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const x = (v.x * 0.5 + 0.5) * w;
    const y = (-v.y * 0.5 + 0.5) * h;
    handle.root.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  updateHp(handle: UnitOverlayHandle, pct: number): void {
    const clamped = Math.max(0, Math.min(1, pct));
    if (clamped === handle.hpPct) return;
    this.applyHp(handle, clamped);
  }

  /** Show + fill the progress bar at `pct`, or pass `null` to hide it. */
  updateProgress(handle: UnitOverlayHandle, pct: number | null): void {
    if (pct === null) {
      if (handle.progressPct === null) return;
      handle.progressEl.hidden = true;
      handle.progressPct = null;
      return;
    }
    const clamped = Math.max(0, Math.min(1, pct));
    if (clamped === handle.progressPct) return;
    if (handle.progressEl.hidden) handle.progressEl.hidden = false;
    handle.progressFill.style.width = `${(clamped * 100).toFixed(2)}%`;
    handle.progressPct = clamped;
  }

  updateLevel(handle: UnitOverlayHandle, level: number): void {
    if (handle.level === level) return;
    handle.level = level;
    handle.levelBadge.textContent = `Lv ${level}`;
  }

  setAlpha(handle: UnitOverlayHandle, alpha: number): void {
    const clamped = Math.max(0, Math.min(1, alpha));
    if (clamped === handle.alpha) return;
    handle.alpha = clamped;
    handle.root.style.opacity = String(clamped);
  }

  /**
   * Tear down every overlay. Called when the BattleRenderer detaches
   * between battles, so the next mount starts with an empty container.
   */
  clear(): void {
    for (const handle of this.overlays.values()) {
      handle.root.remove();
    }
    this.overlays.clear();
  }

  /** Remove the container from the document. Page-lifetime teardown. */
  dispose(): void {
    this.clear();
    this.root.remove();
  }

  private applyHp(handle: UnitOverlayHandle, pct: number): void {
    handle.hpPct = pct;
    handle.hpFill.style.width = `${(pct * 100).toFixed(2)}%`;
    handle.hpFill.style.background = hpFillColor(pct);
  }
}

/**
 * HP gradient: green at full → amber at half → red at zero. Mirrors the
 * B3 BarRenderer pick — same color for both teams so HP state reads
 * independent of which side the unit is on. Returns a CSS rgb() string.
 */
const _gradHigh = new THREE.Color(0x33ff00); // TERMINAL_GREEN
const _gradMid = new THREE.Color(0xffb000); // TERMINAL_AMBER
const _gradLow = new THREE.Color(0xff3131); // NEON_RED
const _gradOut = new THREE.Color();

function hpFillColor(pct: number): string {
  const p = Math.max(0, Math.min(1, pct));
  if (p >= 0.5) {
    const t = (p - 0.5) * 2;
    _gradOut.copy(_gradMid).lerp(_gradHigh, t);
  } else {
    const t = p * 2;
    _gradOut.copy(_gradLow).lerp(_gradMid, t);
  }
  const r = Math.round(_gradOut.r * 255);
  const g = Math.round(_gradOut.g * 255);
  const b = Math.round(_gradOut.b * 255);
  return `rgb(${r}, ${g}, ${b})`;
}
