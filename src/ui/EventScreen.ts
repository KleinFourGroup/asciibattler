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
 */

import { describeEventCondition } from '../config/events';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { Run } from '../run/Run';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { fadeIn, fadeOutAndRemove } from './fade';

export class EventScreen {
  private container: HTMLDivElement | null = null;
  private bodyEl: HTMLDivElement | null = null;
  private unsubscribes: Array<() => void> = [];

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly run: Run,
    private readonly bus: EventBus<GameEvents>,
  ) {}

  show(): void {
    this.hide();
    const panel = document.createElement('div');
    panel.className = 'event-screen screen-fade';

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'event-body';
    panel.appendChild(this.bodyEl);
    this.renderBody();

    this.unsubscribes.push(
      this.bus.on('event:pageChanged', () => this.renderBody()),
      this.bus.on('run:bitsChanged', () => this.renderBody()),
    );

    this.container = panel;
    this.mount.appendChild(panel);
    fadeIn(panel);
  }

  hide(): void {
    for (const off of this.unsubscribes) off();
    this.unsubscribes = [];
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
      this.bodyEl = null;
    }
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
    heading.textContent = `? ${this.run.activeEventName ?? 'Event'}`;
    this.bodyEl.appendChild(heading);

    const text = document.createElement('div');
    text.className = 'event-page-text';
    text.textContent = page.text;
    this.bodyEl.appendChild(text);

    const choices = document.createElement('div');
    choices.className = 'event-choices';
    page.choices.forEach((choice, choiceIndex) => {
      const enabled = this.run.eventChoiceEnabled(choiceIndex);
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
        req.textContent = `Requires ${describeEventCondition(choice.condition)}`;
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
    this.bodyEl.appendChild(choices);
  }
}
