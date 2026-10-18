import * as THREE from 'three';
import type { Team } from '../sim/Unit';
import type { StatusReadout } from '../sim/statusReadout';
import { displayLevel } from '../sim/xp';
import { COLORS } from './palette';
import { statusColor, statusSymbol } from './statusDisplay';
import { isDotHitsplatKind, type HitsplatKind } from './fxRegistry';
import { t } from '../i18n/ui';

/**
 * The DOM overlay over each unit: its level badge, status pips, action bar
 * and HP bar. Each unit gets one `<div class="unit-overlay">` holding one
 * stack of the four; each frame BattleRenderer sets the overlay's `transform`
 * from the projected ink top of the unit's sprite, so the overlay follows the
 * sprite through its slides. One projection per unit per frame, not one per
 * element, and the stack's layout is CSS alone.
 *
 * Game inserts the layer before `#ui`, so it paints under the HUD's chrome,
 * and `#scanlines` rakes across it with the rest of the page. The hitsplats
 * share its world-to-screen projection.
 */

export interface UnitOverlayHandle {
  readonly id: number;
  readonly root: HTMLDivElement;
  /** The HP bar's container, not just its fill, so a destructible neutral's
   *  overlay can hide the whole bar, track included, until it is damaged. */
  readonly hpBar: HTMLDivElement;
  readonly hpFill: HTMLDivElement;
  readonly progressEl: HTMLDivElement;
  readonly progressFill: HTMLDivElement;
  readonly levelBadge: HTMLDivElement;
  /** The status pips' container, above the bars; `updateStatuses`
   *  reconciles its `.status-pip`s. */
  readonly statusStrip: HTMLDivElement;
  team: Team;
  /** Last applied opacity. Skips DOM writes when unchanged. */
  alpha: number;
  /** Last applied HP fill (0..1). Skips DOM writes when unchanged. */
  hpPct: number;
  /** Last applied action-bar fill (0..1), or null when hidden. */
  progressPct: number | null;
  /** Whether the action bar wears the amber `.reaim` variant. */
  progressReaim: boolean;
  /** The sim tick the pips were last reconciled at. The status readout
   *  changes only between sim ticks (it is derived from `currentTick`), so
   *  BattleRenderer recomputes it only when this differs. `-1` forces the
   *  first frame's update. */
  statusTick: number;
  /** A destructible neutral (one with HP, such as rubble or a breakable
   *  wall): its HP bar shows only while damaged (`hpPct < 1`), so a board
   *  full of rubble stays uncluttered. `false` for a combatant, whose bar
   *  always shows. */
  destructible: boolean;
}

export class UnitOverlayLayer {
  readonly root: HTMLDivElement;
  /** A getter, read per projection: the Renderer swaps its camera, rather
   *  than rebuilding it, when the dev board explorer changes the projection,
   *  so a captured camera would go stale. */
  private readonly cameraOf: () => THREE.Camera;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlays = new Map<number, UnitOverlayHandle>();
  private nextId = 1;
  private readonly projectScratch = new THREE.Vector3();
  /** The live floating numbers' anchors, swept on `clear`. */
  private readonly hitsplats = new Set<HTMLDivElement>();
  /** Each unit's count of live floating numbers, for stacking them. */
  private readonly hitsplatCounts = new Map<number, number>();

  /**
   * The layer's container is inserted before `insertBefore` in its parent.
   * Game passes `#ui`, so the overlays paint under the HUD's chrome and world
   * content never covers a menu.
   */
  constructor(
    cameraOf: () => THREE.Camera,
    canvas: HTMLCanvasElement,
    insertBefore: HTMLElement,
  ) {
    this.cameraOf = cameraOf;
    this.canvas = canvas;
    this.root = document.createElement('div');
    this.root.id = 'unit-overlays';
    insertBefore.parentElement!.insertBefore(this.root, insertBefore);
  }

  /**
   * Build a unit's overlay. The caller sets its first position
   * (`updatePosition`) on the same tick; until then it sits off-screen at
   * (0, 0).
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
    levelBadge.textContent = t('common.lv', { level: displayLevel(level) });

    // Hidden until the unit carries a status.
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

    // Top to bottom: the level badge, the status pips, the action bar, the HP
    // bar. The HP bar is last and the stack is bottom-anchored (ui.css), so
    // the stack grows upward: showing the action bar or the pips never moves
    // the HP bar, the element the eye tracks.
    stack.appendChild(levelBadge);
    stack.appendChild(statusStrip);
    stack.appendChild(progressEl);
    stack.appendChild(hpBar);
    root.appendChild(stack);
    this.root.appendChild(root);

    const handle: UnitOverlayHandle = {
      id,
      root,
      hpBar,
      hpFill,
      progressEl,
      progressFill,
      levelBadge,
      statusStrip,
      team,
      alpha,
      hpPct: 1,
      progressPct: null,
      progressReaim: false,
      statusTick: -1,
      destructible: false,
    };
    this.overlays.set(id, handle);
    this.applyHp(handle, 1);
    return handle;
  }

  /**
   * An overlay for a destructible neutral. It is a combatant's overlay, so
   * BattleRenderer's HP refresh on `unit:attacked` fills it and the per-frame
   * loop moves it, with three differences:
   * - no level badge (rubble has no level);
   * - the HP bar is hidden until damaged (`applyHp` shows it below full), so a
   *   board full of rubble isn't a wall of full bars;
   * - the bar is as wide as the footprint (`applyFootprintScale`), so it reads
   *   as the big body's.
   * The caller seeds HP and position on the same tick, as with `add`.
   */
  addDestructible(footprint: number): UnitOverlayHandle {
    const handle = this.add('neutral', 1, 1);
    handle.destructible = true;
    handle.levelBadge.hidden = true;
    handle.hpBar.hidden = true;
    this.applyFootprintScale(handle, footprint);
    return handle;
  }

  /**
   * Widen a destructible's bar to its footprint: a 1×1 keeps the CSS default
   * (`--fp-scale: 1`, a combatant's width), and a larger body's bar widens in
   * step (a 3×3's is three times as wide). The bar takes no lift for the
   * taller glyph: the caller's anchor, the glyph's ink top, already rises with
   * the footprint, and a lift here would count it twice.
   */
  private applyFootprintScale(handle: UnitOverlayHandle, footprint: number): void {
    if (footprint <= 1) return;
    const stack = handle.root.firstElementChild as HTMLElement;
    stack.style.setProperty('--fp-scale', String(footprint));
  }

  remove(handle: UnitOverlayHandle): void {
    if (!this.overlays.delete(handle.id)) return;
    handle.root.remove();
  }

  /**
   * Project a world point to CSS pixels and set it on the overlay's root as
   * `translate3d`, which the GPU composites with no layout. A point behind the
   * camera or past the far plane hides the overlay (`visibility: hidden`,
   * the node kept) rather than placing it, so it leaves no half-drawn ghost.
   */
  updatePosition(handle: UnitOverlayHandle, worldPos: THREE.Vector3): void {
    const p = this.projectToCss(worldPos);
    if (!p) {
      if (handle.root.style.visibility !== 'hidden') handle.root.style.visibility = 'hidden';
      return;
    }
    if (handle.root.style.visibility === 'hidden') handle.root.style.visibility = '';
    handle.root.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
  }

  /**
   * A world point in CSS pixels, or null when it lies behind the camera or
   * past the far plane. The overlays and the floating numbers share it.
   */
  private projectToCss(worldPos: THREE.Vector3): { x: number; y: number } | null {
    const v = this.projectScratch.copy(worldPos).project(this.cameraOf());
    if (v.z > 1 || v.z < -1) return null;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  }

  /**
   * Float a number above a unit's sprite. The anchor is placed once in screen
   * space and doesn't follow the unit through its 0.6 s life (ui.css's
   * `hitsplat-rise`), which is short enough not to show; the inner element
   * runs the rise and fade and removes itself on `animationend`. Numbers
   * sharing a `stackKey` (the unit's id) stack upward, so clustered hits
   * don't overlap. A no-op when the point is behind the camera or past the
   * far plane.
   *
   * `worldTop` is the glyph's visible top, already lifted along the camera's
   * up by the caller (`aboveAnchor`), so one projection lands on it: a lift
   * along camera-up keeps the screen X and scales like the quad, so the
   * number doesn't drift sideways at the board's edge under any camera.
   */
  spawnHitsplat(
    worldTop: THREE.Vector3,
    text: string,
    kind: HitsplatKind,
    stackKey: number,
  ): void {
    const top = this.projectToCss(worldTop);
    if (!top) return;

    const stack = this.hitsplatCounts.get(stackKey) ?? 0;
    this.hitsplatCounts.set(stackKey, stack + 1);

    const anchor = document.createElement('div');
    anchor.className = 'hitsplat-anchor';
    const lift = stack * HITSPLAT_STACK_REM;
    anchor.style.transform = `translate3d(${top.x.toFixed(1)}px, calc(${top.y.toFixed(1)}px - ${lift}rem), 0)`;

    const el = document.createElement('div');
    el.className = `hitsplat hitsplat--${kind}`;
    // A DoT's number draws in its status's hue (the kind is the status id), so
    // the pip, the card row and the number share one table. The other kinds
    // keep their CSS colors (`.hitsplat--crit` red, `--heal` cyan, `--miss`
    // white).
    if (isDotHitsplatKind(kind)) el.style.color = statusColor(kind);
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

  /** Show and fill the action bar at `pct`, or hide it with `null`. `reaim`
   *  switches it to the amber re-aim variant (the `.reaim` class, ui.css);
   *  the class toggles only when the variant changes, so a frame's cost stays
   *  one width write. */
  updateProgress(handle: UnitOverlayHandle, pct: number | null, reaim = false): void {
    if (pct === null) {
      if (handle.progressPct === null) return;
      handle.progressEl.hidden = true;
      handle.progressPct = null;
      return;
    }
    const clamped = Math.max(0, Math.min(1, pct));
    if (clamped === handle.progressPct && reaim === handle.progressReaim) return;
    if (handle.progressEl.hidden) handle.progressEl.hidden = false;
    if (reaim !== handle.progressReaim) {
      handle.progressEl.classList.toggle('reaim', reaim);
      handle.progressReaim = reaim;
    }
    handle.progressFill.style.width = `${(clamped * 100).toFixed(2)}%`;
    handle.progressPct = clamped;
  }

  /**
   * Reconcile the unit's pips with its status readouts: one pip per status, in
   * the readout's stable order. A pip is the status's symbol over a depleting
   * bar: the fill's width is `durationFraction`, its opacity brightens with
   * the stack count (an `add` status escalates), and symbol and bar wear the
   * status's hue. The symbol is the read that isn't the hue: a camp unit has
   * no card, so its pip is all a player has. The strip hides when there are no
   * statuses.
   *
   * Cheap by construction: BattleRenderer calls it only when the sim tick has
   * advanced, and each pip caches its writes in its dataset, so an unchanged
   * pip skips the DOM.
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
      const symbol = pip.firstElementChild as HTMLDivElement;
      const fill = pip.lastElementChild!.firstElementChild as HTMLDivElement;
      // Recolor only when this slot's status changes; the common path keeps
      // the same status here and skips the writes. No title or tooltip: the
      // layer is `pointer-events: none`, so no hover could reach one, and the
      // card's status row is the read for this pip.
      if (pip.dataset.sid !== r.statusId) {
        pip.dataset.sid = r.statusId;
        const color = statusColor(r.statusId);
        symbol.textContent = statusSymbol(r.statusId);
        symbol.style.color = color;
        fill.style.background = color;
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
   * Tear down every overlay. BattleRenderer calls it as it detaches after a
   * battle, so the next mount starts with an empty container.
   */
  clear(): void {
    for (const handle of this.overlays.values()) {
      handle.root.remove();
    }
    this.overlays.clear();
    // Drop the numbers in flight too, so none lingers into the next scene.
    // Removing an element skips its animationend, so the counts reset here.
    for (const anchor of this.hitsplats) anchor.remove();
    this.hitsplats.clear();
    this.hitsplatCounts.clear();
  }

  private applyHp(handle: UnitOverlayHandle, pct: number): void {
    handle.hpPct = pct;
    handle.hpFill.style.width = `${(pct * 100).toFixed(2)}%`;
    handle.hpFill.style.background = hpFillColor(pct);
    // A destructible neutral shows its bar only while damaged.
    if (handle.destructible) {
      const hidden = pct >= 1;
      if (handle.hpBar.hidden !== hidden) handle.hpBar.hidden = hidden;
    }
  }
}

/** The vertical step between a unit's concurrent floating numbers, so
 *  clustered hits read as a stack. In rem (14px at the default size), since
 *  the numbers are text and grow with the text scale: a step in px would let
 *  a larger number cover the one under it. */
const HITSPLAT_STACK_REM = 0.875;

/** One empty pip: the symbol's line, then a dark track with a colored
 *  depleting fill. `updateStatuses` reads the two by position. */
function makePip(): HTMLDivElement {
  const pip = document.createElement('div');
  pip.className = 'status-pip';
  const symbol = document.createElement('div');
  symbol.className = 'status-pip-symbol';
  const track = document.createElement('div');
  track.className = 'status-pip-track';
  const fill = document.createElement('div');
  fill.className = 'status-pip-fill';
  track.appendChild(fill);
  pip.append(symbol, track);
  return pip;
}

/**
 * A pip's fill opacity by stack count. An `add` status (bleed, poison)
 * brightens as it escalates, from 0.7 at one stack to 1 at three; every other
 * merge sits at 1, since its magnitude is a potency, not a count, and
 * brightness wouldn't read as "more". The card row gives the exact count.
 */
function pipBrightness(r: StatusReadout): number {
  if (r.merge !== 'add') return 1;
  return Math.min(1, 0.55 + 0.15 * r.stacks);
}

/**
 * The HP gradient: green at full, amber at half, red at zero, the same for
 * both teams, so HP reads apart from the unit's side. The three stops are the
 * palette's, read when this module loads. Returns a CSS `rgb()`.
 */
const _gradHigh = new THREE.Color(COLORS.TERMINAL_GREEN);
const _gradMid = new THREE.Color(COLORS.TERMINAL_AMBER);
const _gradLow = new THREE.Color(COLORS.NEON_RED);
const _gradOut = new THREE.Color();

/** Exported for its pin (UnitOverlayLayer.test.ts). */
export function hpFillColor(pct: number): string {
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
