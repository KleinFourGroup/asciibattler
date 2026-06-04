/**
 * H4b — the pre-turn screen. Shown before each turn's tactical battle (on
 * `turn:starting`), it names the turn + shows both health pools, then auto-
 * advances after a beat (a "Fight" click skips ahead). Both paths dispatch
 * `advanceTurn`, which starts the turn's battle.
 *
 * This is the seam the H5/H6 card-drawn hand lands on: the `.preturn-hint`
 * placeholder becomes the deck-draw, and the auto-advance becomes a real
 * confirm. Built extensible (a single `advance()` the timer + the button + a
 * future deploy action all funnel through) per the user's design.
 */

import type { GameEvents } from '../core/events';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { fadeIn, fadeOutAndRemove } from './fade';
import { renderPoolGauge } from './poolGauge';

/** Auto-advance delay (ms). Tunable by feel during playtest. */
const PRETURN_AUTO_MS = 2000;

export class PreTurnScreen {
  private container: HTMLDivElement | null = null;
  private timer: number | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(info: GameEvents['turn:starting']): void {
    this.hide();
    this.container = this.render(info);
    this.container.classList.add('screen-fade');
    this.mount.appendChild(this.container);
    fadeIn(this.container);
    this.timer = window.setTimeout(() => this.advance(), PRETURN_AUTO_MS);
  }

  hide(): void {
    this.clearTimer();
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Single advance path — the auto-timer and the Fight click both land here,
   *  so the timer is cleared exactly once and a double-fire can't double-tap
   *  the (phase-guarded) command. */
  private advance(): void {
    this.clearTimer();
    this.dispatcher.dispatch({ kind: 'advanceTurn' });
  }

  private render(info: GameEvents['turn:starting']): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'preturn-screen';

    const heading = document.createElement('div');
    heading.className = 'preturn-heading';
    heading.textContent = `Turn ${info.turn}`;
    panel.appendChild(heading);

    const sub = document.createElement('div');
    sub.className = 'preturn-sub';
    sub.textContent = `Floor ${info.floor}`;
    panel.appendChild(sub);

    const pools = document.createElement('div');
    pools.className = 'preturn-pools';
    pools.append(
      renderPoolGauge('player', 'Your Pool', info.playerHealth, info.playerHealthMax),
      renderPoolGauge('enemy', 'Enemy Pool', info.enemyHealth, info.enemyHealthMax),
    );
    panel.appendChild(pools);

    const hint = document.createElement('div');
    hint.className = 'preturn-hint';
    hint.textContent = 'Deploying your squad…';
    panel.appendChild(hint);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preturn-continue';
    button.textContent = 'Fight ▸';
    button.addEventListener('click', () => {
      this.audio.play('click');
      this.advance();
    });
    panel.appendChild(button);

    return panel;
  }
}
