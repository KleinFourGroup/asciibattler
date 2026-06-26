import * as THREE from 'three';
import type { Team } from '../sim/Unit';
import type { StatusReadout } from '../sim/statusReadout';
import { displayLevel } from '../sim/xp';
import { statusColor } from './statusDisplay';

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
  /** §32c — the status pip-strip container (above the HP bar). Its child
   *  `.status-pip`s are reconciled by `updateStatuses`. */
  readonly statusStrip: HTMLDivElement;
  team: Team;
  /** Last applied opacity. Skips DOM writes when unchanged. */
  alpha: number;
  /** Last applied HP fill % (0..1). Skips DOM writes when unchanged. */
  hpPct: number;
  /** Last applied progress fill % (0..1), or null when hidden. */
  progressPct: number | null;
  /** Last applied level. */
  level: number;
  /** §32c — the sim tick the status strip last reconciled at. The status
   *  readout is identical between sim ticks (it's derived from `currentTick`),
   *  so BattleRenderer gates the per-frame recompute on this changing. `-1`
   *  forces a first-frame update. */
  statusTick: number;
}

export class UnitOverlayLayer {
  readonly root: HTMLDivElement;
  private readonly camera: THREE.Camera;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlays = new Map<number, UnitOverlayHandle>();
  private nextId = 1;
  private readonly projectScratch = new THREE.Vector3();
  /** I2 — second scratch for the hitsplat's lifted (top-of-sprite) point, so
   *  projecting it doesn't clobber the center projection mid-call. */
  private readonly liftScratch = new THREE.Vector3();
  /** E6.C — live floating-number anchors, swept on `clear`. */
  private readonly hitsplats = new Set<HTMLDivElement>();
  /** E6.C — per-unit count of active hitsplats, for vertical stacking. */
  private readonly hitsplatCounts = new Map<number, number>();

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
    levelBadge.textContent = `Lv ${displayLevel(level)}`;

    // §32c — the status pip-strip, just ABOVE the HP bar (below the level
    // badge). Hidden until the unit carries at least one status.
    const statusStrip = document.createElement('div');
    statusStrip.className = 'status-strip';
    statusStrip.hidden = true;

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
    stack.appendChild(statusStrip);
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
      statusStrip,
      team,
      alpha,
      hpPct: 1,
      progressPct: null,
      level,
      statusTick: -1,
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
    const p = this.projectToCss(worldPos);
    // Off-screen (behind camera / past far plane): hide rather than
    // translate to negative pixels so overlays don't pile up off-canvas
    // as half-rendered ghosts.
    if (!p) {
      if (handle.root.style.visibility !== 'hidden') handle.root.style.visibility = 'hidden';
      return;
    }
    if (handle.root.style.visibility === 'hidden') handle.root.style.visibility = '';
    handle.root.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
  }

  /**
   * Project a world point to CSS pixel coords, or null when it's behind the
   * camera / past the far plane. Shared by per-frame overlay position-follow
   * and E6.C hitsplats — one source of truth for world→screen.
   */
  private projectToCss(worldPos: THREE.Vector3): { x: number; y: number } | null {
    const v = this.projectScratch.copy(worldPos).project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  }

  /**
   * E6.C — spawn a transient floating number above a unit's sprite. The anchor
   * is positioned ONCE in screen space (it does not follow the unit for its
   * ~0.6s life, which is fine at that duration). The inner element runs the CSS
   * rise+fade keyframe and self-removes on animationend. Concurrent hitsplats
   * sharing a `stackKey` (the unit id) stagger upward so clustered hits don't
   * overlap. No-op when the sprite center is off-screen.
   *
   * I2 — anchor on the billboard's SCREEN-SPACE top, not a projected world-up
   * point. The sprite is a screen-aligned billboard, so its on-screen top edge
   * is straight up from the projected center; but under the PerspectiveCamera a
   * world-up offset (`center + worldYLift`) projects DIAGONALLY toward the
   * vanishing point for off-axis sprites, dragging the splat sideways (the
   * "hitsplats drift to the side for units off to the edge" bug). Fix: take X
   * from the projected center (kills the drift) and only the vertical pixel
   * delta from the lifted point (keeps the offset perspective-correct — it
   * shrinks with distance).
   */
  spawnHitsplat(
    worldCenter: THREE.Vector3,
    worldYLift: number,
    text: string,
    kind: 'normal' | 'crit' | 'heal' | 'burn' | 'miss',
    stackKey: number,
  ): void {
    const center = this.projectToCss(worldCenter);
    if (!center) return;
    // Project the lifted (top-of-sprite) point for a depth-correct vertical
    // offset; if it falls behind the camera, fall back to the center Y.
    const lifted = this.projectToCss(this.liftScratch.copy(worldCenter).setY(worldCenter.y + worldYLift));
    const topY = lifted ? lifted.y : center.y;

    const stack = this.hitsplatCounts.get(stackKey) ?? 0;
    this.hitsplatCounts.set(stackKey, stack + 1);

    const anchor = document.createElement('div');
    anchor.className = 'hitsplat-anchor';
    const y = topY - stack * HITSPLAT_STACK_PX;
    anchor.style.transform = `translate3d(${center.x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

    const el = document.createElement('div');
    el.className = `hitsplat hitsplat--${kind}`;
    el.textContent = text;
    anchor.appendChild(el);

    this.root.appendChild(anchor);
    this.hitsplats.add(anchor);

    el.addEventListener(
      'animationend',
      () => {
        anchor.remove();
        this.hitsplats.delete(anchor);
        const c = (this.hitsplatCounts.get(stackKey) ?? 1) - 1;
        if (c <= 0) this.hitsplatCounts.delete(stackKey);
        else this.hitsplatCounts.set(stackKey, c);
      },
      { once: true },
    );
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
    handle.levelBadge.textContent = `Lv ${displayLevel(level)}`;
  }

  /**
   * §32c — reconcile the board pip-strip against a unit's active status
   * readouts (one pip per status, in the readout's stable canonical order). Each
   * pip is a depleting bar: its fill WIDTH = `durationFraction`, its fill OPACITY
   * brightens with stack count (an `add` status escalates), its color is the
   * status's display hue. Hidden when there are no statuses (no empty row).
   *
   * Cheap by construction: BattleRenderer gates the call on the sim tick
   * advancing (the readout is identical between ticks), and per-pip writes are
   * dataset-cached so an unchanged pip skips its DOM mutations.
   */
  updateStatuses(handle: UnitOverlayHandle, readouts: readonly StatusReadout[]): void {
    const strip = handle.statusStrip;
    if (readouts.length === 0) {
      if (!strip.hidden) {
        strip.hidden = true;
        strip.replaceChildren();
      }
      return;
    }
    if (strip.hidden) strip.hidden = false;
    // Match the pip count to the readout count, reusing existing pips.
    while (strip.childElementCount < readouts.length) strip.appendChild(makePip());
    while (strip.childElementCount > readouts.length) strip.lastElementChild!.remove();
    for (let i = 0; i < readouts.length; i++) {
      const r = readouts[i]!;
      const pip = strip.children[i] as HTMLDivElement;
      const fill = pip.firstElementChild as HTMLDivElement;
      // Recolor + retitle only when this slot's status identity changes (the
      // common per-tick path keeps the same status here and skips these writes).
      if (pip.dataset.sid !== r.statusId) {
        pip.dataset.sid = r.statusId;
        pip.title = r.name; // a hover nicety; the card row carries the live numbers
        fill.style.background = statusColor(r.statusId);
      }
      const opacity = pipBrightness(r).toFixed(2);
      if (fill.dataset.op !== opacity) {
        fill.dataset.op = opacity;
        fill.style.opacity = opacity;
      }
      const width = `${Math.round(r.durationFraction * 100)}%`;
      if (fill.dataset.w !== width) {
        fill.dataset.w = width;
        fill.style.width = width;
      }
    }
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
    // E6.C — drop any in-flight hitsplats so they don't linger into the
    // next scene. Removing the element skips its animationend, so reset
    // the per-unit counts explicitly here.
    for (const anchor of this.hitsplats) anchor.remove();
    this.hitsplats.clear();
    this.hitsplatCounts.clear();
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

/** E6.C — vertical stagger (CSS px) between concurrent hitsplats on the
 *  same unit so clustered hits read as a stack rather than overlapping. */
const HITSPLAT_STACK_PX = 14;

/** §32c — build one empty pip (a dark track + a colored depleting fill). */
function makePip(): HTMLDivElement {
  const pip = document.createElement('div');
  pip.className = 'status-pip';
  const fill = document.createElement('div');
  fill.className = 'status-pip-fill';
  pip.appendChild(fill);
  return pip;
}

/**
 * §32c — pip fill opacity by stack count. An `add` status (bleed/poison) brightens
 * as it escalates (1 stack ≈ 0.7 → caps at 1.0); every other merge sits at full
 * (its magnitude is a potency scalar, not a count, so brightness wouldn't read as
 * "more"). The card row carries the exact stack number.
 */
function pipBrightness(r: StatusReadout): number {
  if (r.merge !== 'add') return 1;
  return Math.min(1, 0.55 + 0.15 * r.stacks);
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
