/**
 * Game Over modal. Step 4.5 covers the defeat path; Step 4.6 will extend
 * this with a 'complete' variant for reaching the terminal node.
 *
 * Like the other screens, this is a pure view — the button emits
 * `run:resetRequested` and Game owns the Run-replacement work.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

export class GameOverScreen {
  private container: HTMLDivElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly bus: EventBus<GameEvents>,
  ) {}

  show(): void {
    this.hide();
    this.container = this.render();
    this.mount.appendChild(this.container);
  }

  hide(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  private render(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'gameover-screen';

    const heading = document.createElement('div');
    heading.className = 'gameover-heading';
    heading.textContent = 'Defeat';
    panel.appendChild(heading);

    const subtext = document.createElement('div');
    subtext.className = 'gameover-subtext';
    subtext.textContent = 'Your team has fallen.';
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
