/**
 * The sector-map chip and overlay: a page-lifetime UI element, like
 * BitsOverlay and CacheOverlay (Game owns it, it is appended once to #ui,
 * and it never rides the scene mount and dispose cycle). The chip (`⊞ map`)
 * stacks below the cache chip in the left chrome column; clicking it, or the
 * `toggleSectorMap` keybind (`M`), which Game subscribes so it works on
 * every screen, opens a full-viewport read-only MapScreen: the plan-ahead
 * glance from a port or an encounter. Escape, the ✕ close or a re-toggle
 * closes it.
 *
 * Availability follows the scene, pushed by `Game.swap` through
 * `setAvailable`: hidden with no run, on MapScene (the live map is already
 * on screen), at character select and at the run's end; shown everywhere
 * else a run exists. Going unavailable also closes an open overlay (a swap
 * to the real map screen would otherwise leave a stale copy over it).
 *
 * The view is read through one getter, as CacheOverlay's is, so a
 * `resetRun` swap is invisible and the overlay renders the live run's map at
 * open time; nothing is cached between opens.
 */

import type { AudioPlayer } from '../audio/AudioPlayer';
import type { RunDispatcher } from '../run/Command';
import type { NodeMap } from '../run/NodeMap';
import type { UnitTemplate } from '../sim/Unit';
import { MapScreen, type BossForewarning } from './MapScreen';
import { openModal, type ModalHandle } from './modal';
import { t } from '../i18n/ui';
import { attachTooltip, keyedTooltip } from './tooltip';

/** Everything a read-only map render needs: MapScreen.show's arguments,
 *  bundled (Game builds it from the live Run; null when there is no run). */
interface SectorMapView {
  readonly map: NodeMap;
  readonly currentNodeId: number;
  readonly visited: ReadonlySet<number>;
  readonly roster: readonly UnitTemplate[];
  readonly sectorTitle: string;
  readonly forewarning: BossForewarning | null;
}

export class SectorMapOverlay {
  private readonly chip: HTMLButtonElement;
  /** The modal shell's viewport variant (src/ui/modal.ts): it owns the
   *  host, the ✕ close, Esc and the focus trap; the read-only MapScreen
   *  renders into it. */
  private modal: ModalHandle | null = null;
  private screen: MapScreen | null = null;
  /** Scene-derived availability (Game.swap pushes it); the chip hides and the
   *  keybind no-ops while false. */
  private available = false;
  private readonly keyLabel: () => string;

  constructor(
    /** The page mount: the overlay's host (fixed full-viewport, z 40; it
     *  must not sit inside the chrome column's stacking context). */
    private readonly mount: HTMLElement,
    /** The chrome column the chip mounts into (src/ui/chip.ts). */
    chips: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly getView: () => SectorMapView | null,
    /** The live keybind label, read each time it is shown (the chip's tooltip
     *  at every open, the overlay's hint when the overlay is built), so a
     *  rebind shows up the way it does on the HUD's button tooltips. */
    keyLabel: () => string,
  ) {
    this.keyLabel = keyLabel;
    this.chip = document.createElement('button');
    this.chip.type = 'button';
    this.chip.className = 'chip sector-map-chip is-hidden';
    this.chip.textContent = '⊞ map';
    // The chip's tooltip (a long-press on touch; the chip's tap opens the
    // map).
    attachTooltip(this.chip, keyedTooltip(t('sectormap.chipTooltip'), keyLabel), { touch: 'press' });
    this.chip.addEventListener('click', () => this.toggle());
    chips.appendChild(this.chip);
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
    if (this.modal !== null) {
      this.close();
      return;
    }
    if (!this.available) return;
    const view = this.getView();
    if (view === null) return;
    this.audio.play('click');
    // A clickable close: the read-only map screen is opaque and
    // full-viewport, so the backdrop can't be reached and the chip is buried
    // under the overlay; without the shell's ✕ a mouse or touch player has
    // no way out. The keyboard stays the fast path, and the game must be
    // playable without it. (The face reads `✕ CLOSE`; the class upper-cases
    // it.)
    const modal = openModal(this.mount, {
      variant: 'viewport',
      closeText: `✕ ${t('common.close')}`,
      onClose: () => {
        this.screen?.hide();
        this.screen = null;
        this.modal = null;
      },
    });
    this.modal = modal;
    const hint = document.createElement('div');
    hint.className = 'sector-map-overlay__hint';
    hint.textContent = t('sectormap.hint', { key: this.keyLabel() });
    modal.content.appendChild(hint);
    // The read-only screen renders into the overlay host; the dispatcher is
    // passed but never called (readOnly suppresses the frontier clicks).
    this.screen = new MapScreen(modal.content, this.dispatcher, this.audio, { readOnly: true });
    this.screen.show(
      view.map,
      view.currentNodeId,
      view.visited,
      view.roster,
      view.sectorTitle,
      view.forewarning,
    );
  }

  private close(): void {
    this.modal?.close(); // the shell's onClose hides the screen and nulls both
  }
}
