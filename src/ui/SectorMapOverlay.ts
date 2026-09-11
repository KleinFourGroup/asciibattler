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
import { openModal, type ModalHandle } from './modal';
import { t } from '../i18n/ui';

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
  /** 96f — the modal shell's viewport variant (src/ui/modal.ts): it owns
   *  the host, the ✕ close, Esc / backdrop and the focus trap; the read-only
   *  MapScreen renders into it. */
  private modal: ModalHandle | null = null;
  private screen: MapScreen | null = null;
  /** Scene-derived availability (Game.swap pushes it); the chip hides and the
   *  keybind no-ops while false. */
  private available = false;
  private readonly keyLabel: string;

  constructor(
    /** The page mount — the OVERLAY's host (fixed full-viewport, z 40; it
     *  must not sit inside the chrome column's stacking context). */
    private readonly mount: HTMLElement,
    /** 96e — the chrome column the CHIP mounts into (src/ui/chip.ts). */
    chips: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly getView: () => SectorMapView | null,
    /** The live keybind label for the chip tooltip (tracks a rebind the same
     *  way the HUD button tooltips do — resolved at construction; a rebind
     *  screen, when it lands, re-labels via its own pass). */
    keyLabel: string,
  ) {
    this.keyLabel = keyLabel;
    this.chip = document.createElement('button');
    this.chip.type = 'button';
    this.chip.className = 'chip sector-map-chip is-hidden';
    this.chip.textContent = '⊞ map';
    this.chip.title = `Sector map (${keyLabel})`;
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
    // 78e fix — a CLICKABLE close (user call): the read-only map screen is
    // opaque and full-viewport, so the backdrop is unreachable and the chip
    // is buried beneath the overlay — without the shell's ✕ a pure-mouse
    // (or touch) player has no way out. Keyboard stays the fast path; the
    // game must remain playable without it. (The face reads `✕ CLOSE`
    // either way — the class upper-cases it.)
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
    hint.textContent = t('sectormap.hint', { key: this.keyLabel });
    modal.content.appendChild(hint);
    // The read-only screen renders INTO the overlay host; the dispatcher
    // is threaded but never called (readOnly suppresses the frontier clicks).
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
    this.modal?.close(); // the shell's onClose hides the screen + nulls
  }
}
