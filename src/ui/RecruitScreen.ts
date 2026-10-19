/**
 * The recruit screen, the offer after a won encounter that was not the
 * sector's terminal. It renders the offer as a row of unit cards; a click
 * on a card dispatches `chooseRecruit`, which Run handles by appending the
 * template to the roster and returning to the map.
 *
 * A pure view: it doesn't track the chosen card or touch the roster.
 * RecruitScene shows it at mount, with the `recruit:offered` payload Game
 * hands it at the swap, and hides it at dispose.
 */

import type { UnitTemplate } from '../sim/Unit';
import { t } from '../i18n/ui';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { Screen } from './Screen';
import { button } from './button';
import { buildUnitCard, unitCardFromTemplate } from './UnitCard';
import { pressable } from './pressable';
import { CardListButton } from './CardListModal';
import { mountControl } from './chip';

export class RecruitScreen extends Screen {
  // The roster button (a row of the control column). Disposed on hide, so a
  // dismissed screen can't leave an open overlay or a live Esc handler.
  private rosterButton: CardListButton | null = null;

  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly controlSlot: HTMLElement,
  ) {
    super(mount);
  }

  show(offer: readonly UnitTemplate[], roster: readonly UnitTemplate[]): void {
    this.hide();
    this.present(this.render(offer, roster));
  }

  override hide(): void {
    this.rosterButton?.dispose();
    this.rosterButton = null;
    super.hide();
  }

  private render(
    offer: readonly UnitTemplate[],
    roster: readonly UnitTemplate[],
  ): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'recruit-screen';

    // The roster view shows the roster as it is, before this pick.
    this.rosterButton = new CardListButton(this.mount, this.audio, {
      text: t('roster.button'),
      title: t('roster.title'),
      position: 'roster',
      getUnits: () => roster,
      emptyText: t('roster.empty'),
    });
    mountControl(this.controlSlot, this.rosterButton.el);

    const heading = document.createElement('div');
    heading.className = 'recruit-heading';
    heading.textContent = t('recruit.heading');
    panel.appendChild(heading);

    const cards = document.createElement('div');
    cards.className = 'recruit-cards';
    for (const template of offer) {
      cards.appendChild(this.renderCard(template));
    }
    panel.appendChild(cards);

    // Decline the offer: always offered and free. It leaves the roster and
    // the deck as they are and returns to the map (a counter to diluting the
    // deck, worth more as the roster outgrows the hand).
    const pass = button(t('common.pass'), {
      className: 'btn--primary btn--dim',
      onClick: () => {
        this.audio.play('click');
        this.dispatcher.dispatch({ kind: 'passRecruit' });
      },
    });
    panel.appendChild(pass);

    return panel;
  }

  private renderCard(template: UnitTemplate): HTMLDivElement {
    // The card is the unit card's recruit skin (amber, two-column stats, the
    // abilities shown, clickable); the click handler is this screen's.
    const { el } = buildUnitCard(unitCardFromTemplate(template), {
      mode: 'full',
      skin: 'recruit',
    });

    // The keyboard route (role=button, Enter and Space; `pressable.ts`).
    pressable(el);
    el.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'chooseRecruit', unitTemplate: template });
    });

    return el;
  }
}
