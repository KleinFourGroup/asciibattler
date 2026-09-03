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
import { HEALTH } from '../config/health';
import { fadeIn, fadeOutAndRemove } from './fade';

/** The pool carries fractional chips (power × 1.1/level); print integers bare
 *  and anything else to one decimal — the between-acts beat isn't a ledger. */
function fmtPool(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * §90 — the seam-floor line. A heal reads as "Pool restored 14 → 20"; a pool
 * the floor didn't touch (already full, or a floor of 0) reads as the plain
 * carried value so the screen never implies a heal that didn't happen.
 */
export function sectorClearedPoolLine(poolBefore: number, poolAfter: number): string {
  if (poolAfter > poolBefore) {
    return `Pool restored ${fmtPool(poolBefore)} → ${fmtPool(poolAfter)}`;
  }
  return `Pool ${fmtPool(poolAfter)} / ${fmtPool(HEALTH.playerHealthMax)} carries on`;
}

export class SectorClearedScreen {
  private container: HTMLDivElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(
    clearedSectorTitle: string,
    nextSectorTitle: string,
    poolBefore: number,
    poolAfter: number,
  ): void {
    this.hide();
    this.container = this.render(clearedSectorTitle, nextSectorTitle, poolBefore, poolAfter);
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

  private render(
    clearedSectorTitle: string,
    nextSectorTitle: string,
    poolBefore: number,
    poolAfter: number,
  ): HTMLDivElement {
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

    // §90 — the seam floor's heal, named (a hidden heal is the one thing the
    // independent-acts frame must not be: the player adds their own numbers).
    const pool = document.createElement('div');
    pool.className = 'sectorcleared-pool';
    pool.textContent = sectorClearedPoolLine(poolBefore, poolAfter);
    panel.appendChild(pool);

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
