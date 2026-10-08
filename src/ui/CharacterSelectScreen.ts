/**
 * 63e — the character-select screen: where a new run starts when no
 * `?character=` pins the choice. The menu's New run opens it (116c); on a
 * page booted by a run dial it is the first screen, and the landing screen
 * after a reset. Functional, not art-directed (the §63 scope guard): one
 * card per catalog character — name, description, roster summary, starting
 * daemon — click to confirm.
 *
 * The confirm dispatches `chooseCharacter`, which GAME handles by
 * CONSTRUCTING the Run (the choice precedes Run construction — the §63
 * seam). With the menu, this is one of the two UI surfaces that legally
 * exist with `ctx.run === null`.
 *
 * 116c — Back, under the cards, returns to the menu with nothing started: a
 * pass, so it wears the pass's look (`btn--dim`). It is always there, so
 * nothing on the screen comes or goes. Continue, the three notices about
 * saving and the build's ID, which stood here from 115g, are the menu's.
 *
 * 117e — THE ESCALATION PICKER (Round 8 spec D8): under each card, a
 * stepper for the level that card starts its run at, from 0 to the
 * character's ceiling (`EscalationContext.ceiling`), opening at the ceiling
 * and remembering nothing. It shows once the character has won a run. Its
 * slot is under every card from the first visit, hidden but kept
 * (`reserveSlot`), and holds a line for every level of the ladder in one
 * cell, so no card moves when a picker appears and nothing moves as a level
 * is stepped. A card's click starts the run at its own picker's level.
 */

import { CHARACTERS, type CharacterConfig } from '../config/characters';
import { daemonById } from '../config/daemons';
import { ESCALATION_MAX } from '../config/escalation';
import { nameForArchetype } from '../sim/archetypes';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { EscalationContext, MenuContext } from '../scenes/Scene';
import { Screen } from './Screen';
import { button } from './button';
import { escalationAdds, escalationName, escalationTooltip } from './escalationText';
import { reserveSlot } from './reserveSlot';
import { attachTooltip, refreshTooltip } from './tooltip';
import { t } from '../i18n/ui';

/** "6× Mercenary · 4× Archer" — counts in roster order, display names. */
function rosterSummary(character: CharacterConfig): string {
  const counts = new Map<string, number>();
  for (const a of character.roster) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts.entries()]
    .map(([archetype, n]) => `${n}× ${nameForArchetype(archetype)}`)
    .join(' · ');
}

export class CharacterSelectScreen extends Screen {

  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly menu: MenuContext,
    private readonly escalation: EscalationContext,
  ) {
    super(mount);
  }

  show(): void {
    this.hide();
    this.present(this.render());
  }

  private render(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'charselect-screen';

    const heading = document.createElement('div');
    heading.className = 'charselect-heading';
    heading.textContent = t('charselect.heading');
    panel.appendChild(heading);

    const row = document.createElement('div');
    row.className = 'charselect-row';
    panel.appendChild(row);

    for (const character of CHARACTERS) {
      row.appendChild(this.renderSlot(character));
    }

    panel.appendChild(
      button(t('charselect.back'), {
        className: 'btn--primary btn--dim',
        onClick: () => {
          this.audio.play('click');
          this.menu.back();
        },
      }),
    );

    return panel;
  }

  /** A character's column: its card, and under it the Escalation picker. */
  private renderSlot(character: CharacterConfig): HTMLDivElement {
    const slot = document.createElement('div');
    slot.className = 'charselect-slot';
    const picker = this.renderPicker(character);
    slot.append(this.renderCard(character, picker.level), picker.el);
    return slot;
  }

  private renderCard(character: CharacterConfig, level: () => number): HTMLButtonElement {
    // A card-shaped button: the factory mints it (type · class · click), the
    // card chrome stays its own class — it is not the primary-action idiom.
    const card = button('', {
      className: 'charselect-card',
      onClick: () => {
        this.audio.play('click');
        this.dispatcher.dispatch({ kind: 'chooseCharacter', characterId: character.id, escalation: level() });
      },
    });

    const name = document.createElement('div');
    name.className = 'charselect-card__name';
    name.textContent = character.name;
    card.appendChild(name);

    const desc = document.createElement('div');
    desc.className = 'charselect-card__desc';
    desc.textContent = character.description;
    card.appendChild(desc);

    const roster = document.createElement('div');
    roster.className = 'charselect-card__roster';
    roster.textContent = rosterSummary(character);
    card.appendChild(roster);

    const daemon = document.createElement('div');
    daemon.className = 'charselect-card__daemon';
    // Parse-validated ref; the id is an acceptable fallback if the catalogs
    // ever drift (display-only — Run construction still fails loud).
    daemon.textContent = daemonById(character.daemon)?.name ?? character.daemon;
    card.appendChild(daemon);

    return card;
  }

  /**
   * The picker under a card: − · the level's name · +, and under them what
   * that level adds. The name is the tooltip's text site (every level in
   * effect, and how the next is opened). A step changes text and classes in
   * place: the buttons keep their boxes and the keyboard's focus.
   */
  private renderPicker(character: CharacterConfig): { el: HTMLDivElement; level: () => number } {
    const ceiling = this.escalation.ceiling(character.id);
    let level = ceiling;

    const el = document.createElement('div');
    el.className = 'charselect-level';

    const name = document.createElement('span');
    name.className = 'charselect-level__name';
    name.tabIndex = 0;
    attachTooltip(name, () => escalationTooltip(level));

    // Every level of the ladder has its line in the one cell, whatever the
    // ceiling, so the cell is as tall under every card and at every step.
    const adds = document.createElement('div');
    adds.className = 'charselect-level__adds';
    const lines: HTMLDivElement[] = [];
    for (let n = 0; n <= ESCALATION_MAX; n++) {
      const line = document.createElement('div');
      line.className = 'charselect-level__line';
      line.textContent = escalationAdds(n);
      lines.push(line);
      adds.appendChild(line);
    }

    const step = (label: string, by: number, aria: string): HTMLButtonElement => {
      const control = button(label, {
        className: 'charselect-level__step',
        onClick: () => {
          const next = level + by;
          if (next < 0 || next > ceiling) return;
          level = next;
          this.audio.play('click');
          paint();
        },
      });
      control.setAttribute('aria-label', aria);
      return control;
    };
    const lower = step('−', -1, t('escalation.lower', { character: character.name }));
    const raise = step('+', 1, t('escalation.raise', { character: character.name }));

    /** A step with nowhere to go is inert: dimmed, said so, and out of the
     *  Tab order. It keeps the focus it has, so a held Enter stops there. */
    const inert = (control: HTMLButtonElement, is: boolean): void => {
      control.classList.toggle('is-inert', is);
      if (is) control.setAttribute('aria-disabled', 'true');
      else control.removeAttribute('aria-disabled');
      control.tabIndex = is ? -1 : 0;
    };
    const paint = (): void => {
      name.textContent = escalationName(level);
      // The reservation idiom's two halves (reserveSlot.ts), switched as the
      // level moves: the lines that are not the level's keep the cell's size.
      lines.forEach((line, n) => {
        line.classList.toggle('is-reserved', n !== level);
        if (n === level) line.removeAttribute('aria-hidden');
        else line.setAttribute('aria-hidden', 'true');
      });
      inert(lower, level === 0);
      inert(raise, level === ceiling);
      refreshTooltip(name);
    };

    const stepper = document.createElement('div');
    stepper.className = 'charselect-level__stepper';
    stepper.setAttribute('role', 'group');
    stepper.setAttribute('aria-label', t('escalation.group', { character: character.name }));
    stepper.append(lower, name, raise);
    el.append(stepper, adds);
    paint();
    // No level above 0 to pick: the slot is kept and nothing shows.
    if (ceiling === 0) reserveSlot(el);
    return { el, level: () => level };
  }
}
