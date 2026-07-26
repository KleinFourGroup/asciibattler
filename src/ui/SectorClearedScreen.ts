/**
 * 67b — the sector-cleared screen (the between-sector beat). A GameOverScreen
 * clone by design (the §67 shape-lock): same opaque-black full-viewport
 * chrome, heading + subtext + one button — but the run continues, so the
 * button dispatches `dismissSectorCleared` (releasing the 67a gate back to
 * the NEW sector's map) rather than `resetRun`. The titles arrive from the
 * `sector:cleared` payload at construction (the cleared sector is gone from
 * the Run by the time this screen exists — the getter can't name it).
 */

import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { fadeIn, fadeOutAndRemove } from './fade';

export class SectorClearedScreen {
  private container: HTMLDivElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(clearedSectorTitle: string, nextSectorTitle: string): void {
    this.hide();
    this.container = this.render(clearedSectorTitle, nextSectorTitle);
    this.container.classList.add('screen-fade');
    this.mount.appendChild(this.container);
    fadeIn(this.container);
  }

  hide(): void {
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
    }
  }

  private render(clearedSectorTitle: string, nextSectorTitle: string): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'sectorcleared-screen';

    const heading = document.createElement('div');
    heading.className = 'sectorcleared-heading';
    heading.textContent = 'Sector Cleared';
    panel.appendChild(heading);

    const subtext = document.createElement('div');
    subtext.className = 'sectorcleared-subtext';
    subtext.textContent = `${clearedSectorTitle} is behind you.`;
    panel.appendChild(subtext);

    const next = document.createElement('div');
    next.className = 'sectorcleared-next';
    next.textContent = `Next: ${nextSectorTitle}`;
    panel.appendChild(next);

    const button = document.createElement('button');
    button.className = 'sectorcleared-button';
    button.textContent = 'Press on';
    button.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'dismissSectorCleared' });
    });
    panel.appendChild(button);

    return panel;
  }
}
