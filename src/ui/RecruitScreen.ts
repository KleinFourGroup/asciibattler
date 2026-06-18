/**
 * Post-victory recruit modal. Renders the offer as a row of unit cards;
 * clicking a card dispatches a `chooseRecruit` command on the run
 * dispatcher, which Run handles by appending the template to the team and
 * transitioning back to map phase.
 *
 * Like MapScreen, this is a pure view — it doesn't track which card is
 * chosen or update Run.team. show/hide is driven by Game in response to
 * recruit:offered events and the chooseRecruit command.
 */

import type { UnitTemplate } from '../sim/Unit';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { fadeIn, fadeOutAndRemove } from './fade';
import { buildUnitCard, unitCardFromTemplate } from './UnitCard';
import { CardListButton } from './CardListModal';

export class RecruitScreen {
  private container: HTMLDivElement | null = null;
  // R1 — the shared "view roster" affordance (top-right). Disposed on hide so
  // a dismissed screen can't leave an open overlay or a live Esc handler.
  private rosterButton: CardListButton | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(offer: readonly UnitTemplate[], roster: readonly UnitTemplate[]): void {
    this.hide();
    this.container = this.render(offer, roster);
    this.container.classList.add('screen-fade');
    this.mount.appendChild(this.container);
    fadeIn(this.container);
  }

  hide(): void {
    this.rosterButton?.dispose();
    this.rosterButton = null;
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
    }
  }

  private render(
    offer: readonly UnitTemplate[],
    roster: readonly UnitTemplate[],
  ): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'recruit-screen';

    // R1 — the roster view shows the CURRENT roster (before this pick).
    this.rosterButton = new CardListButton(this.mount, this.audio, {
      text: 'Roster',
      title: 'Your Roster',
      position: 'roster',
      getUnits: () => roster,
      emptyText: 'No units in your roster.',
    });
    panel.appendChild(this.rosterButton.el);

    const heading = document.createElement('div');
    heading.className = 'recruit-heading';
    heading.textContent = 'Victory — choose a new unit';
    panel.appendChild(heading);

    const cards = document.createElement('div');
    cards.className = 'recruit-cards';
    for (const template of offer) {
      cards.appendChild(this.renderCard(template));
    }
    panel.appendChild(cards);

    // H6b — decline the offer. Trial default: always available + free. Leaves
    // the roster + deck untouched and returns to the map (the deck-dilution
    // counterplay grows as the roster outpaces the hand).
    const pass = document.createElement('button');
    pass.className = 'recruit-pass';
    pass.textContent = 'Pass';
    pass.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'passRecruit' });
    });
    panel.appendChild(pass);

    return panel;
  }

  private renderCard(template: UnitTemplate): HTMLDivElement {
    // P1 — the card markup, stat block, and the "card can't disagree with the
    // unit" ability readings now live in the shared `UnitCard` builder. The
    // recruit skin keeps this screen's look (amber, two-col stats, abilities
    // shown) and its click affordance; the click handler stays here.
    const { el } = buildUnitCard(unitCardFromTemplate(template), {
      mode: 'full',
      skin: 'recruit',
    });

    el.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'chooseRecruit', unitTemplate: template });
    });

    return el;
  }
}
