/**
 * 74f — the event screen (spec §Events; the port model). Shown while the
 * run holds in the serialized `event` phase: the event's name, the current
 * page's text, and one button per choice. The §74 shape-lock rule:
 * condition-FAILING choices render SHOWN-DISABLED with the requirement
 * visible ("this is a strategy game — players should be able to plan").
 * A MET condition still lists its requirement, dimmer — the choice's cost
 * of entry stays legible either way, and the row doesn't jump when the
 * player's state crosses the threshold between visits.
 *
 * The PortScreen discipline: the screen holds the LIVE Run (scene-scoped,
 * disposed on swap) and fully re-renders the body off `event:pageChanged`
 * (a resolved choice that hopped pages). Terminals never come back here:
 * return-to-map lands via Game's silent-transition catcher (the leavePort
 * shape) and start-encounter fires `battle:started`, which self-swaps.
 * `run:bitsChanged` also re-renders — a same-page bits move can't happen
 * today (effects execute only on choice resolution), but the
 * affordability disables must not be able to go stale if that changes.
 *
 * Display honesty: enabled/disabled comes from `run.eventChoiceEnabled`
 * (the same check the engine applies at dispatch) — never a re-derivation
 * that could drift. The `art` seam renders nothing this cluster (spec
 * scope guard).
 *
 * 101e — layout stability: the text and the choice list are each a STACK of
 * every page of the event in one grid cell (`.event-stack`), the pages that
 * are not current reserved (`reserveSlot` — hidden, inert, slot kept). The
 * tallest page sizes both cells, so on this centered column a page turn
 * moves neither the heading nor the first choice (measured before: the
 * heading 195 → 275 px, and the next page's "Leave" landed under the choice
 * just clicked). No measuring — the browser sizes the cell, resizes included.
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

  /** Full re-render from live state (the PortScreen renderBody discipline —
   *  the choice indices in every button are true after each page hop). */
  private renderBody(): void {
    if (this.bodyEl === null) return;
    this.bodyEl.replaceChildren();
    const page = this.run.currentEventPage();
    if (page === null) return; // a terminal resolved — the fading DOM needs nothing

    const heading = document.createElement('div');
    heading.className = 'event-heading';
    heading.textContent = `? ${this.run.activeEventName ?? t('event.fallbackName')}`;
    this.bodyEl.appendChild(heading);

    // Every page, authored order; the grid cell overlaps them. A current
    // page the catalog walk cannot find (unreachable) renders alone.
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

  /** One page's choice list. `live` = the current page: real enabled state
   *  + click handlers. A reserved page gets the same boxes (the label and,
   *  where authored, the requirement line — the only things that set a
   *  row's height), disabled and unwired. */
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
