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
import { packetById } from '../config/packets';
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
   * 49c: cache state re-derives here too, so accepting/swapping a packet
   * visibly moves the `n/size` line and flips later packet rows between the
   * plain Accept and the swap control.
   */
  private renderPortions(): void {
    if (this.portionsEl === null) return;
    this.portionsEl.replaceChildren();
    const portions = this.run.pendingRewards ?? [];

    // 49c — the live cache line (spec §Cache: "the reward screen shows
    // cache state"), rendered only while a packet portion is pending — a
    // bits/daemon-only offer has no cache decision to inform.
    if (portions.some((p) => p.kind === 'packet')) {
      const cacheLine = document.createElement('div');
      cacheLine.className = 'reward-cache-line';
      // ▤ is the cache mark (the coming 49f chip vocabulary).
      cacheLine.textContent = `▤ cache ${this.run.cache.length}/${this.run.effectiveCacheSize}`;
      this.portionsEl.appendChild(cacheLine);
    }

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
      } else if (portion.kind === 'daemon') {
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
      } else {
        // 49c — a packet portion (def-resolved for display; the id is
        // boot-asserted, so the fallback never renders for authored tables).
        const packet = packetById(portion.packetId);
        const title = document.createElement('div');
        title.className = 'reward-portion__title';
        title.textContent = `▤ ${packet?.name ?? portion.packetId}`;
        body.appendChild(title);
        if (packet !== undefined) {
          const desc = document.createElement('div');
          desc.className = 'reward-portion__desc';
          desc.textContent = packet.description;
          body.appendChild(desc);
        }
      }
      row.appendChild(body);

      const actions = document.createElement('div');
      actions.className = 'reward-portion__actions';
      if (portion.kind === 'packet' && !this.run.cacheHasRoom) {
        // 49c — the decline-or-swap control: pick a held packet to drop,
        // then Swap dispatches the accept WITH the slot (the engine
        // enforces the same contract — a swap-less accept would no-op).
        actions.appendChild(this.swapControl(index));
      } else {
        actions.appendChild(this.actionButton('Accept', 'reward-accept', () =>
          this.resolve(index, 'accept'),
        ));
      }
      actions.appendChild(this.actionButton('Decline', 'reward-decline', () =>
        this.resolve(index, 'decline'),
      ));
      row.appendChild(actions);

      this.portionsEl!.appendChild(row);
    });
  }

  /** 49c — the full-cache swap picker: a select over the HELD packets (by
   *  slot) + a Swap button carrying the chosen `swapCacheIndex`. Rebuilt on
   *  every re-render, so the slot list is always the live cache. */
  private swapControl(portionIndex: number): HTMLSpanElement {
    const wrap = document.createElement('span');
    wrap.className = 'reward-swap';

    const select = document.createElement('select');
    select.className = 'reward-swap__select';
    this.run.cache.forEach((packetId, slot) => {
      const option = document.createElement('option');
      option.value = String(slot);
      option.textContent = packetById(packetId)?.name ?? packetId;
      select.appendChild(option);
    });
    wrap.appendChild(select);

    wrap.appendChild(this.actionButton('Swap', 'reward-accept reward-swap__button', () => {
      this.audio.play('pickup');
      this.dispatcher.dispatch({
        kind: 'acceptReward',
        index: portionIndex,
        swapCacheIndex: Number(select.value),
      });
      this.renderPortions();
    }));
    return wrap;
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
