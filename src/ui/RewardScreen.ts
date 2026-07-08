/**
 * 48c — the reward screen. Shown when a won encounter's reward refs rolled a
 * non-empty offer (the `reward` run phase — battle → rewards → promotion →
 * recruit, the shape-locked ordering). Each portion is a row resolved
 * INDEPENDENTLY (the declinable-per-portion spec lock): Accept settles it
 * (bits through `Run.gainBits`; a daemon joins ownership immediately),
 * Decline discards it. Resolving the last portion advances the run — the
 * follow-on event (promotion:pending / recruit:offered / run:victory) swaps
 * this scene out, so the screen never dismisses itself.
 *
 * Display honesty (the shape-lock rider, worklog §48): bits rows never show
 * the rolled base — they render `run.effectiveBits(base)`, the SAME code
 * path the settle uses, re-read from live state after every resolution. So
 * accepting a bits-fold daemon (Moneta) from a mixed offer visibly re-prices
 * the remaining bits rows on the spot — derive-don't-cache doing
 * player-facing work.
 */

import { daemonById } from '../config/daemons';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { Run } from '../run/Run';
import { fadeIn, fadeOutAndRemove } from './fade';

export class RewardScreen {
  private container: HTMLDivElement | null = null;
  private portionsEl: HTMLDivElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    // Scene-scoped like the screen itself (disposed on swap), so holding the
    // live Run is safe — reads always reflect the current offer + folds.
    private readonly run: Run,
  ) {}

  show(): void {
    this.hide();
    const panel = document.createElement('div');
    panel.className = 'reward-screen screen-fade';

    const heading = document.createElement('div');
    heading.className = 'reward-heading';
    heading.textContent = 'Rewards';
    panel.appendChild(heading);

    this.portionsEl = document.createElement('div');
    this.portionsEl.className = 'reward-portions';
    panel.appendChild(this.portionsEl);
    this.renderPortions();

    this.container = panel;
    this.mount.appendChild(panel);
    fadeIn(panel);
  }

  hide(): void {
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
      this.portionsEl = null;
    }
  }

  /**
   * (Re)render the rows from the LIVE offer. Row indices map 1:1 onto
   * `run.pendingRewards` positions — the offer shrinks as portions resolve,
   * so a full re-render after each command keeps every button's index true.
   */
  private renderPortions(): void {
    if (this.portionsEl === null) return;
    this.portionsEl.replaceChildren();
    const portions = this.run.pendingRewards ?? [];
    portions.forEach((portion, index) => {
      const row = document.createElement('div');
      row.className = 'reward-portion';

      const body = document.createElement('div');
      body.className = 'reward-portion__body';
      if (portion.kind === 'bits') {
        const title = document.createElement('div');
        title.className = 'reward-portion__title';
        title.textContent = `${this.run.effectiveBits(portion.base)} bits`;
        body.appendChild(title);
      } else {
        const daemon = daemonById(portion.daemonId);
        const title = document.createElement('div');
        title.className = 'reward-portion__title';
        // ◈ is the daemon mark (the PreTurnScreen banner vocabulary).
        title.textContent = `◈ ${daemon?.name ?? portion.daemonId}`;
        body.appendChild(title);
        if (daemon !== undefined) {
          const desc = document.createElement('div');
          desc.className = 'reward-portion__desc';
          desc.textContent = daemon.description;
          body.appendChild(desc);
        }
      }
      row.appendChild(body);

      const actions = document.createElement('div');
      actions.className = 'reward-portion__actions';
      actions.appendChild(this.actionButton('Accept', 'reward-accept', () =>
        this.resolve(index, 'accept'),
      ));
      actions.appendChild(this.actionButton('Decline', 'reward-decline', () =>
        this.resolve(index, 'decline'),
      ));
      row.appendChild(actions);

      this.portionsEl!.appendChild(row);
    });
  }

  private actionButton(label: string, className: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private resolve(index: number, action: 'accept' | 'decline'): void {
    this.audio.play(action === 'accept' ? 'pickup' : 'click');
    this.dispatcher.dispatch(
      action === 'accept'
        ? { kind: 'acceptReward', index }
        : { kind: 'declineReward', index },
    );
    // Resolving the LAST portion advances the run synchronously inside the
    // dispatch — Game swaps the scene and `hide()` has already nulled the
    // mount points, making this re-render a no-op on the fading DOM.
    this.renderPortions();
  }
}
