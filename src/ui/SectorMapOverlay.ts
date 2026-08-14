/**
 * 78e — the sector-map chip + overlay: the THIRD page-lifetime UI element
 * (the 48d BitsOverlay / 49f CacheOverlay lineage — Game-owned, appended once
 * to #ui, never rides the scene mount/dispose cycle). The chip (`⊞ map`)
 * stacks below the cache chip in the left chrome column; clicking it — or the
 * `toggleSectorMap` keybind (`M`), subscribed at the GAME layer so it works
 * on every screen — opens a full-viewport READ-ONLY MapScreen (the plan-ahead
 * glance the spec wants in ports and encounters: "which camps feed which
 * routes"). Escape, the backdrop, or a re-toggle closes it.
 *
 * Availability is SCENE-derived, pushed by `Game.swap` via `setAvailable`:
 * hidden on MapScene (the live map is already on screen), pre-run (no run →
 * no map), and game-over — visible everywhere else a run exists. Going
 * unavailable also closes an open overlay (a swap to the real map screen
 * would otherwise leave a stale copy floating over it).
 *
 * The view is read through ONE getter (the CacheOverlay getter discipline),
 * so a `resetRun` swap is invisible and the overlay always renders the LIVE
 * run's map at open time — nothing is cached between opens.
 */

import type { AudioPlayer } from '../audio/AudioPlayer';
import type { RunDispatcher } from '../run/Command';
import type { NodeMap } from '../run/NodeMap';
import type { UnitTemplate } from '../sim/Unit';
import { MapScreen, type BossForewarning } from './MapScreen';

/** Everything a read-only map render needs — the MapScreen.show argument list,
 *  bundled (Game builds it from the live Run; null = no run yet). */
export interface SectorMapView {
  readonly map: NodeMap;
  readonly currentNodeId: number;
  readonly visited: ReadonlySet<number>;
  readonly roster: readonly UnitTemplate[];
  readonly sectorTitle: string;
  readonly forewarning: BossForewarning | null;
}

export class SectorMapOverlay {
  private readonly chip: HTMLButtonElement;
  private overlayEl: HTMLDivElement | null = null;
  private screen: MapScreen | null = null;
  /** Scene-derived availability (Game.swap pushes it); the chip hides and the
   *  keybind no-ops while false. */
  private available = false;
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly getView: () => SectorMapView | null,
    /** The live keybind label for the chip tooltip (tracks a rebind the same
     *  way the HUD button tooltips do — resolved at construction; a rebind
     *  screen, when it lands, re-labels via its own pass). */
    keyLabel: string,
  ) {
    this.chip = document.createElement('button');
    this.chip.type = 'button';
    this.chip.className = 'sector-map-chip is-hidden';
    this.chip.textContent = '⊞ map';
    this.chip.title = `Sector map (${keyLabel})`;
    this.chip.addEventListener('click', () => this.toggle());
    mount.appendChild(this.chip);
  }

  /** Game.swap pushes scene-derived availability. Going unavailable closes an
   *  open overlay (the real MapScene is about to render the same map live). */
  setAvailable(available: boolean): void {
    this.available = available;
    this.chip.classList.toggle('is-hidden', !available);
    if (!available) this.close();
  }

  /** The chip click + the `toggleSectorMap` keybind (Game subscribes). */
  toggle(): void {
    if (this.overlayEl !== null) {
      this.close();
      return;
    }
    if (!this.available) return;
    const view = this.getView();
    if (view === null) return;
    this.audio.play('click');
    const overlay = document.createElement('div');
    overlay.className = 'sector-map-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    const hint = document.createElement('div');
    hint.className = 'sector-map-overlay__hint';
    hint.textContent = '[ map view — M / Esc closes ]';
    overlay.appendChild(hint);
    this.overlayEl = overlay;
    this.mount.appendChild(overlay);
    // The read-only screen renders INTO the overlay backdrop; the dispatcher
    // is threaded but never called (readOnly suppresses the frontier clicks).
    this.screen = new MapScreen(overlay, this.dispatcher, this.audio, { readOnly: true });
    this.screen.show(
      view.map,
      view.currentNodeId,
      view.visited,
      view.roster,
      view.sectorTitle,
      view.forewarning,
    );
    window.addEventListener('keydown', this.onKeyDown);
  }

  private close(): void {
    if (this.overlayEl === null) return;
    window.removeEventListener('keydown', this.onKeyDown);
    this.screen?.hide();
    this.screen = null;
    this.overlayEl.remove();
    this.overlayEl = null;
  }
}
