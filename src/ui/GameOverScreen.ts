/**
 * Game Over modal. Two variants:
 *   - 'defeat'  — enemy wiped the player team.
 *   - 'complete' — player won the terminal battle.
 *
 * Same structure for both: heading, subtext, "Begin a new run" button.
 * Variant only changes the copy and accent color, so reusing one component
 * keeps the reset/button flow uniform. The button dispatches a `resetRun`
 * command (Game handles it by disposing the current Run and starting a
 * fresh one).
 */

import type { RunDispatcher } from '../run/Command';
import { t } from '../i18n/ui';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { Screen } from './Screen';

export type GameOverVariant = 'defeat' | 'complete';

interface VariantCopy {
  heading: string;
  subtext: string;
}

const COPY: Record<GameOverVariant, VariantCopy> = {
  defeat: { heading: t('gameover.defeat.heading'), subtext: t('gameover.defeat.subtext') },
  complete: { heading: t('gameover.complete.heading'), subtext: t('gameover.complete.subtext') },
};

export class GameOverScreen extends Screen {

  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {
    super(mount);
  }

  show(variant: GameOverVariant = 'defeat'): void {
    this.hide();
    this.present(this.render(variant));
  }

  private render(variant: GameOverVariant): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = `gameover-screen gameover-screen--${variant}`;

    const copy = COPY[variant];

    const heading = document.createElement('div');
    heading.className = 'gameover-heading';
    heading.textContent = copy.heading;
    panel.appendChild(heading);

    const subtext = document.createElement('div');
    subtext.className = 'gameover-subtext';
    subtext.textContent = copy.subtext;
    panel.appendChild(subtext);

    const button = document.createElement('button');
    button.className = 'gameover-button';
    button.textContent = 'Begin a new run';
    button.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'resetRun' });
    });
    panel.appendChild(button);

    return panel;
  }
}
