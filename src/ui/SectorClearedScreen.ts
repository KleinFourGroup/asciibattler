/**
 * The sector-cleared screen, the beat between two sectors. It copies
 * GameOverScreen by design: the same opaque black full-viewport chrome, a
 * heading, subtext and one button. But the run goes on, so the button
 * dispatches `dismissSectorCleared` (releasing the gate onto the new
 * sector's map) rather than `resetRun`. The titles and pools come from the
 * `sector:cleared` payload, through SectorClearedScene (by the time this
 * screen exists the run's getters name the new sector).
 */

import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { HEALTH } from '../config/health';
import { Screen } from './Screen';
import { button } from './button';
import { t } from '../i18n/ui';

/** The pool can hold a fraction where a dial gives one (`chipMultiplier`,
 *  or the rest's and the seam's shares of the maximum); print integers bare
 *  and anything else to one decimal, since the beat between acts isn't a
 *  ledger. Exported for the rest page's effect line (RestScreen.ts). */
export function fmtPool(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * The seam floor's line. A heal reads as "Morale restored 14 → 40"; a pool
 * the floor didn't touch (already at or above it) reads as the plain carried
 * value, so the screen never implies a heal that didn't happen.
 */
function sectorClearedPoolLine(poolBefore: number, poolAfter: number): string {
  if (poolAfter > poolBefore) {
    return t('sectorcleared.poolRestored', { before: fmtPool(poolBefore), after: fmtPool(poolAfter) });
  }
  return t('sectorcleared.poolCarries', {
    pool: fmtPool(poolAfter),
    max: fmtPool(HEALTH.playerHealthMax),
  });
}

export class SectorClearedScreen extends Screen {

  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {
    super(mount);
  }

  show(
    clearedSectorTitle: string,
    nextSectorTitle: string,
    poolBefore: number,
    poolAfter: number,
  ): void {
    this.hide();
    this.present(this.render(clearedSectorTitle, nextSectorTitle, poolBefore, poolAfter));
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
    heading.textContent = t('sectorcleared.heading');
    panel.appendChild(heading);

    const subtext = document.createElement('div');
    subtext.className = 'sectorcleared-subtext';
    subtext.textContent = t('sectorcleared.behind', { sector: clearedSectorTitle });
    panel.appendChild(subtext);

    // The seam floor's heal, named: the acts read as independent only if no
    // heal is hidden, since the player adds up their own numbers.
    const pool = document.createElement('div');
    pool.className = 'sectorcleared-pool';
    pool.textContent = sectorClearedPoolLine(poolBefore, poolAfter);
    panel.appendChild(pool);

    const next = document.createElement('div');
    next.className = 'sectorcleared-next';
    next.textContent = t('sectorcleared.next', { sector: nextSectorTitle });
    panel.appendChild(next);

    const pressOn = button(t('sectorcleared.pressOn'), {
      className: 'btn--primary btn--exit',
      onClick: () => {
        this.audio.play('click');
        this.dispatcher.dispatch({ kind: 'dismissSectorCleared' });
      },
    });
    panel.appendChild(pressOn);

    return panel;
  }
}
