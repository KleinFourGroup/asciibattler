/**
 * H4b — the pre-turn screen. Shown before each turn's tactical battle (on
 * `turn:starting`), it names the turn + shows both health pools, then auto-
 * advances after a beat (a "Fight" click skips ahead). Both paths dispatch
 * `advanceTurn`, which starts the turn's battle.
 *
 * H5b — the placeholder hint became the real **drawn hand**: a row of compact
 * cards (glyph + level) for the units the deck dealt this turn (the
 * `turn:starting.hand` payload). The auto-advance stays; a future H6 step can
 * turn this into a real confirm/deploy action — they all still funnel through
 * the single `advance()`.
 */

import type { GameEvents } from '../core/events';
import type { UnitTemplate } from '../sim/Unit';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { glyphForArchetype } from '../sim/archetypes';
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

    panel.appendChild(this.renderHand(info.hand));

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

  /** H5b — the drawn hand: a label + a row of compact unit cards. */
  private renderHand(hand: readonly UnitTemplate[]): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'preturn-hand';

    const label = document.createElement('div');
    label.className = 'preturn-hand-label';
    label.textContent = `Your hand — ${hand.length} drawn`;
    wrap.appendChild(label);

    const cards = document.createElement('div');
    cards.className = 'preturn-hand-cards';
    for (const unit of hand) cards.appendChild(renderHandCard(unit));
    wrap.appendChild(cards);

    return wrap;
  }
}

/** One drawn card: the archetype glyph over a `Lv N` tag, tinted by archetype
 *  (the `--<archetype>` modifier mirrors the recruit card's team-color hooks). */
function renderHandCard(unit: UnitTemplate): HTMLDivElement {
  const card = document.createElement('div');
  card.className = `preturn-card preturn-card--${unit.archetype}`;

  const glyph = document.createElement('div');
  glyph.className = 'preturn-card-glyph';
  glyph.textContent = glyphForArchetype(unit.archetype);
  card.appendChild(glyph);

  const level = document.createElement('div');
  level.className = 'preturn-card-level';
  level.textContent = `Lv ${unit.level}`;
  card.appendChild(level);

  return card;
}
