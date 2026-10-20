/**
 * The event screen. Shown while the run holds in the saved `event` phase:
 * the event's name, the current page's text, and one button per choice. A
 * choice whose condition fails shows disabled with its requirement in view,
 * so a player can plan for it. A met condition still lists its
 * requirement, dimmer: the choice's cost of entry stays legible either way,
 * and the row doesn't jump when the player's state crosses the threshold
 * between visits.
 *
 * As PortScreen does, the screen holds the live Run (scene-scoped, disposed
 * on swap) and renders the body again on `event:pageChanged` (a resolved
 * choice that moved to a page). A terminal never comes back here:
 * `return-to-map` lands on the map through Game's dispatch-time route (no
 * event says so, as with `leavePort`), and `start-encounter` starts the
 * fight's first turn, whose `turn:starting` swaps in the pre-turn screen.
 * `run:bitsChanged` also renders it again: bits move only in a choice's
 * effects, which always end in a page change or a terminal, but the
 * affordability disables must not be able to go stale if that changes.
 *
 * Enabled or disabled comes from `run.eventChoiceEnabled` (the check the
 * engine applies at dispatch), never a re-derivation that could drift. A
 * page's `art` parses and renders nothing.
 *
 * The text and the choice list are each a stack of every page of the event
 * in one grid cell (`.event-stack`), the pages that are not current
 * reserved (`reserveSlot`: hidden, inert, slot kept). The tallest page sizes
 * both cells, so on this centered column a page turn moves neither the
 * heading nor the first choice, and the next page's choice can't land under
 * the pointer that just clicked. Nothing is measured: the browser sizes the
 * cell, resizes included.
 */

import { describeEventCondition } from './eventConditionText';
import { t } from '../i18n/ui';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { Run } from '../run/Run';
import type { EventPage } from '../config/events';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { Screen } from './Screen';
import { reserveSlot } from './reserveSlot';

export class EventScreen extends Screen {
  private bodyEl: HTMLDivElement | null = null;
  private unsubscribes: Array<() => void> = [];

  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly run: Run,
    private readonly bus: EventBus<GameEvents>,
  ) {
    super(mount);
  }

  show(): void {
    this.hide();
    const panel = document.createElement('div');
    panel.className = 'event-screen';

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'event-body';
    panel.appendChild(this.bodyEl);
    this.renderBody();

    this.unsubscribes.push(
      this.bus.on('event:pageChanged', () => this.renderBody()),
      this.bus.on('run:bitsChanged', () => this.renderBody()),
    );

    this.present(panel);
  }

  override hide(): void {
    for (const off of this.unsubscribes) off();
    this.unsubscribes = [];
    super.hide();
    this.bodyEl = null;
  }

  /** A full render from live state, as PortScreen's renderBody is, so the
   *  choice indices in every button are true after each page change. */
  private renderBody(): void {
    if (this.bodyEl === null) return;
    this.bodyEl.replaceChildren();
    const page = this.run.currentEventPage();
    if (page === null) return; // a terminal resolved: the fading DOM needs nothing

    const heading = document.createElement('div');
    heading.className = 'event-heading';
    heading.textContent = `? ${this.run.activeEventName ?? t('event.fallbackName')}`;
    this.bodyEl.appendChild(heading);

    // Every page, in authored order; the grid cell overlaps them. A current
    // page the catalog walk can't find (unreachable) renders alone.
    const all = this.run.activeEventPages();
    const pages = all.includes(page) ? all : [page];

    const textStack = document.createElement('div');
    textStack.className = 'event-stack';
    const choiceStack = document.createElement('div');
    choiceStack.className = 'event-stack';
    for (const p of pages) {
      const text = document.createElement('div');
      text.className = 'event-page-text';
      text.textContent = p.text;
      const choices = this.renderChoices(p, p === page);
      if (p !== page) {
        reserveSlot(text);
        reserveSlot(choices);
      }
      textStack.appendChild(text);
      choiceStack.appendChild(choices);
    }
    this.bodyEl.append(textStack, choiceStack);
  }

  /** One page's choice list. `live` is the current page: the real enabled
   *  state and click handlers. A reserved page gets the same boxes (the
   *  label and, where authored, the requirement line, the only things that
   *  set a row's height), disabled and unwired. */
  private renderChoices(page: EventPage, live: boolean): HTMLDivElement {
    const choices = document.createElement('div');
    choices.className = 'event-choices';
    page.choices.forEach((choice, choiceIndex) => {
      const enabled = live && this.run.eventChoiceEnabled(choiceIndex);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'event-choice';
      const label = document.createElement('div');
      label.className = 'event-choice__label';
      label.textContent = `▸ ${choice.label}`;
      button.appendChild(label);
      if (choice.condition !== undefined) {
        const req = document.createElement('div');
        req.className = enabled
          ? 'event-choice__req'
          : 'event-choice__req event-choice__req--unmet';
        req.textContent = t('event.requires', { cond: describeEventCondition(choice.condition) });
        button.appendChild(req);
      }
      if (enabled) {
        button.addEventListener('click', () => {
          this.audio.play('click');
          this.dispatcher.dispatch({ kind: 'chooseEventOption', choiceIndex });
        });
      } else {
        button.disabled = true;
      }
      choices.appendChild(button);
    });
    return choices;
  }
}
