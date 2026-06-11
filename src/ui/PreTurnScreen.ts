/**
 * H4b — the pre-turn screen. Shown before each turn's tactical battle (on
 * `turn:starting`), it names the turn + shows both health pools and the drawn
 * hand, then waits for the player's "Fight ▸" click. (H4b shipped a 2s
 * auto-advance; K3 REMOVED it — the user's call — because the redraw decision
 * below shouldn't race a timer. The post-turn screen keeps its auto-advance.)
 *
 * H5b — the placeholder hint became the real **drawn hand**: a row of compact
 * cards (glyph + level) for the units the deck dealt this turn (the
 * `turn:starting.hand` payload).
 *
 * K3 — the hand is interactive while the turn's redraw budget allows: click
 * cards to select them, then **Redraw** sends the selection to the discard and
 * draws replacements into the same positions (the `redrawCards` command;
 * budget knobs in `config/deck.json`). The screen re-renders PURELY off the
 * `turn:handRedrawn` event (forwarded by PreTurnScene), so the displayed hand
 * is always the Run's authoritative one — never an optimistic local copy.
 */

import type { GameEvents } from '../core/events';
import type { UnitTemplate } from '../sim/Unit';
import type { RedrawAvailability } from '../run/redraw';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { glyphForArchetype } from '../sim/archetypes';
import { fadeIn, fadeOutAndRemove } from './fade';
import { renderPoolGauge } from './poolGauge';

export class PreTurnScreen {
  private container: HTMLDivElement | null = null;
  // K3 — the live hand + redraw budget (swapped by `updateHand`), the selected
  // hand POSITIONS, and the DOM bits `refreshHand` rebuilds in place.
  private hand: readonly UnitTemplate[] = [];
  private redraw: RedrawAvailability = { redrawsRemaining: 0, cardsRemaining: 0 };
  private readonly selected = new Set<number>();
  private handWrap: HTMLDivElement | null = null;
  private redrawButton: HTMLButtonElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(info: GameEvents['turn:starting']): void {
    this.hide();
    this.hand = info.hand;
    this.redraw = info.redraw;
    this.selected.clear();
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
    this.handWrap = null;
    this.redrawButton = null;
  }

  /**
   * K3 — a `turn:handRedrawn` landed (PreTurnScene forwards it): swap to the
   * post-redraw hand + decremented budget. The selection clears — the swapped
   * positions hold fresh cards now, and in the shipped one-batch mode the
   * whole control disappears (budget exhausted → cards stop being selectable).
   */
  updateHand(payload: GameEvents['turn:handRedrawn']): void {
    this.hand = payload.hand;
    this.redraw = payload.redraw;
    this.selected.clear();
    this.refreshHand();
  }

  /** Single advance path — the Fight button lands here. (The auto-advance
   *  timer that used to share this funnel is gone as of K3.) */
  private advance(): void {
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

    this.handWrap = document.createElement('div');
    this.handWrap.className = 'preturn-hand';
    this.refreshHand();
    panel.appendChild(this.handWrap);

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

  /**
   * K3 — (re)build the hand block in place: label, card row (selectable while
   * the budget allows), and the redraw control. Runs at first render and after
   * every `turn:handRedrawn`.
   */
  private refreshHand(): void {
    const wrap = this.handWrap;
    if (!wrap) return;
    wrap.replaceChildren();
    this.redrawButton = null;

    const label = document.createElement('div');
    label.className = 'preturn-hand-label';
    label.textContent = `Your hand — ${this.hand.length} drawn`;
    wrap.appendChild(label);

    const canRedraw = this.redraw.redrawsRemaining > 0 && this.redraw.cardsRemaining > 0;
    const cards = document.createElement('div');
    cards.className = 'preturn-hand-cards';
    this.hand.forEach((unit, pos) => {
      const card = renderHandCard(unit);
      if (canRedraw) {
        card.classList.add('preturn-card--selectable');
        if (this.selected.has(pos)) card.classList.add('is-selected');
        card.addEventListener('click', () => this.toggleCard(pos, card));
      }
      cards.appendChild(card);
    });
    wrap.appendChild(cards);

    if (canRedraw) wrap.appendChild(this.renderRedrawControl());
  }

  /** K3 — toggle a card's selection. Selecting past the card budget is
   *  ignored (only binding when `maxCardsPerTurn` < hand size — a Phase-L
   *  daemon mode; the shipped default lets the whole hand go). */
  private toggleCard(pos: number, card: HTMLDivElement): void {
    if (this.selected.has(pos)) {
      this.selected.delete(pos);
      card.classList.remove('is-selected');
    } else {
      if (this.selected.size >= this.redraw.cardsRemaining) return;
      this.selected.add(pos);
      card.classList.add('is-selected');
    }
    this.audio.play('click');
    this.syncRedrawButton();
  }

  /** K3 — the Redraw button + budget hint under the card row. Only rendered
   *  while a redraw is available this turn. */
  private renderRedrawControl(): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'preturn-redraw';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preturn-redraw-button';
    button.addEventListener('click', () => {
      if (this.selected.size === 0) return;
      this.audio.play('click');
      // No optimistic update — the authoritative new hand comes back via
      // `turn:handRedrawn` → `updateHand` (the J3 events-only pattern).
      this.dispatcher.dispatch({ kind: 'redrawCards', handIndices: [...this.selected] });
    });
    this.redrawButton = button;

    const hint = document.createElement('div');
    hint.className = 'preturn-redraw-hint';
    const { redrawsRemaining, cardsRemaining } = this.redraw;
    hint.textContent =
      `swap up to ${cardsRemaining} card${cardsRemaining === 1 ? '' : 's'}` +
      ` — ${redrawsRemaining} redraw${redrawsRemaining === 1 ? '' : 's'} left`;

    row.append(button, hint);
    this.syncRedrawButton();
    return row;
  }

  private syncRedrawButton(): void {
    const button = this.redrawButton;
    if (!button) return;
    button.textContent = `Redraw (${this.selected.size})`;
    button.disabled = this.selected.size === 0;
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
