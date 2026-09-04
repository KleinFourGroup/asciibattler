/**
 * H4b — the post-turn outcome screen. Shown after each turn resolves (on
 * `turn:resolved`): the tactical winner, what each pool LOST this turn (the
 * APPLIED chips, §91a2 — labeled by the rule set the turn paid, §91d: the
 * opposing survivors under the survivors rule, each pool's own fallen under
 * casualties, both on a tick-capped turn under the surcharge), both pools
 * after the chip, and the encounter's status. Advances ONLY on the Continue
 * click (M3 removed the H4b auto-timer, matching the K3 pre-turn change —
 * turn pacing is fully player-driven); `advanceTurn` either rolls into the
 * next turn or ends the encounter.
 */

import type { GameEvents } from '../core/events';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { rulesForTurn } from '../run/chipRule';
import { chipLineLabels } from './chipLabels';
import { fadeIn, fadeOutAndRemove } from './fade';
import { renderPoolGauge } from './poolGauge';

export class PostTurnScreen {
  private container: HTMLDivElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(info: GameEvents['turn:resolved']): void {
    this.hide();
    this.container = this.render(info);
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

  private advance(): void {
    this.dispatcher.dispatch({ kind: 'advanceTurn' });
  }

  private render(info: GameEvents['turn:resolved']): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'postturn-screen';

    const heading = document.createElement('div');
    heading.className = `postturn-heading postturn-heading--${info.winner}`;
    // §91d — a draw names its kind: a tick-cap stall (the surcharge's trigger)
    // reads differently from a mutual wipe (the largest casualty turn).
    heading.textContent =
      info.winner === 'player'
        ? 'Skirmish Won'
        : info.winner === 'enemy'
          ? 'Skirmish Lost'
          : info.reason === 'cap'
            ? 'Skirmish Drawn — tick cap'
            : info.reason === 'mutualWipe'
              ? 'Skirmish Drawn — mutual wipe'
              : 'Skirmish Drawn';
    panel.appendChild(heading);

    // §91d — the chip lines are labeled by the rule set THIS turn paid (the
    // live modes + the reason), so the words match the applied numbers under
    // either rule, and a two-rule cap turn says so.
    const labels = chipLineLabels(rulesForTurn(info.reason));
    const chips = document.createElement('div');
    chips.className = 'postturn-chips';
    chips.append(
      chipLine('player', labels.toEnemyPool, info.enemyPoolChip),
      chipLine('enemy', labels.toPlayerPool, info.playerPoolChip),
    );
    panel.appendChild(chips);

    const pools = document.createElement('div');
    pools.className = 'postturn-pools';
    pools.append(
      renderPoolGauge('player', 'Your Pool', info.playerHealth, info.playerHealthMax),
      renderPoolGauge('enemy', 'Enemy Pool', info.enemyHealth, info.enemyHealthMax),
    );
    panel.appendChild(pools);

    const status = document.createElement('div');
    status.className = `postturn-status postturn-status--${info.result}`;
    status.textContent =
      info.result === 'won'
        ? 'Encounter cleared!'
        : info.result === 'lost'
          ? 'Your run ends here.'
          : `Next: Turn ${info.turn + 1}`;
    panel.appendChild(status);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'postturn-continue';
    button.textContent = 'Continue ▸';
    button.addEventListener('click', () => {
      this.audio.play('click');
      this.advance();
    });
    panel.appendChild(button);

    return panel;
  }
}

function chipLine(side: 'player' | 'enemy', label: string, amount: number): HTMLDivElement {
  const row = document.createElement('div');
  row.className = `postturn-chip postturn-chip--${side}`;
  const text = document.createElement('span');
  text.textContent = label;
  const value = document.createElement('span');
  value.className = 'postturn-chip-amount';
  // A 0 chip (a side fully wiped this turn) shows "0", not "−0".
  value.textContent = amount > 0 ? `−${amount}` : '0';
  row.append(text, value);
  return row;
}
