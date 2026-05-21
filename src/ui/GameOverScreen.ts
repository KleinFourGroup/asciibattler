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
import type { AudioPlayer } from '../audio/AudioPlayer';
import { fadeIn, fadeOutAndRemove } from './fade';

export type GameOverVariant = 'defeat' | 'complete';

interface VariantCopy {
  heading: string;
  subtext: string;
}

const COPY: Record<GameOverVariant, VariantCopy> = {
  defeat: { heading: 'Defeat', subtext: 'Your team has fallen.' },
  complete: { heading: 'Run Complete', subtext: 'You reached the terminal node.' },
};

export class GameOverScreen {
  private container: HTMLDivElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(variant: GameOverVariant = 'defeat'): void {
    this.hide();
    this.container = this.render(variant);
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
