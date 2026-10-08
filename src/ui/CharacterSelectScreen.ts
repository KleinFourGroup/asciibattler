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
 */

import { CHARACTERS, type CharacterConfig } from '../config/characters';
import { daemonById } from '../config/daemons';
import { nameForArchetype } from '../sim/archetypes';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { MenuContext } from '../scenes/Scene';
import { Screen } from './Screen';
import { button } from './button';
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
      row.appendChild(this.renderCard(character));
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

  private renderCard(character: CharacterConfig): HTMLButtonElement {
    // A card-shaped button: the factory mints it (type · class · click), the
    // card chrome stays its own class — it is not the primary-action idiom.
    const card = button('', {
      className: 'charselect-card',
      onClick: () => {
        this.audio.play('click');
        // Level 0 until the picker stands under each card.
        this.dispatcher.dispatch({ kind: 'chooseCharacter', characterId: character.id, escalation: 0 });
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
}
