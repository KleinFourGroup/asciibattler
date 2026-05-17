/**
 * Game Over modal. Two variants:
 *   - 'defeat'  — enemy wiped the player team. (Step 4.5)
 *   - 'complete' — player won the terminal battle. (Step 4.6)
 *
 * Same structure for both: heading, subtext, "Begin a new run" button.
 * Variant only changes the copy and accent color, so reusing one component
 * keeps the reset/button flow uniform.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
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
    private readonly bus: EventBus<GameEvents>,
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
      this.bus.emit('run:resetRequested', {});
    });
    panel.appendChild(button);

    return panel;
  }
}
