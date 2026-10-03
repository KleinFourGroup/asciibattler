/**
 * 63e — the character-select screen: the run's FIRST screen when no
 * `?character=` pins the choice (and the landing screen after a reset
 * without the pin). Functional, not art-directed (the §63 scope guard):
 * one card per catalog character — name, description, roster summary,
 * starting daemon — click to confirm.
 *
 * The confirm dispatches `chooseCharacter`, which GAME handles by
 * CONSTRUCTING the Run (the choice precedes Run construction — the §63
 * seam). This screen is the one UI surface that legally exists with
 * `ctx.run === null`.
 *
 * 115g — it is also the boot screen until §116's menu, so it stands in for
 * the menu's Continue row and for what a boot has to tell the player about
 * saving: Continue when the run slot holds a run this tab can load, and a
 * notice for a rejected save, for a run open in another tab, and for a store
 * that can't save. They are drawn once, when the screen is shown, so nothing
 * above the cards comes or goes while the player aims at one.
 */

import { CHARACTERS, type CharacterConfig } from '../config/characters';
import { daemonById } from '../config/daemons';
import { nameForArchetype } from '../sim/archetypes';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { SaveContext } from '../scenes/Scene';
import { runRejectedMessage } from '../store/runSlot';
import { Screen } from './Screen';
import { button } from './button';
import { t } from '../i18n/ui';
import { BUILD_ID } from '../buildId';

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
    private readonly save: SaveContext,
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

    const slot = this.save.slot();
    if (slot === 'saved') {
      panel.appendChild(
        button(t('save.continue'), {
          className: 'btn--primary charselect-continue',
          onClick: () => {
            this.audio.play('click');
            // The save loaded when this screen was drawn. If it no longer
            // does, draw the screen again, which says why.
            if (this.save.continue() !== 'ok') this.show();
          },
        }),
      );
    }
    const notices: string[] = [];
    if (slot === 'rejected') notices.push(runRejectedMessage());
    if (slot === 'elsewhere') notices.push(t('save.elsewhere'));
    if (!this.save.canSave()) notices.push(t('save.unavailable'));
    if (notices.length > 0) {
      const list = document.createElement('div');
      list.className = 'charselect-notices';
      for (const text of notices) {
        const notice = document.createElement('div');
        notice.className = 'charselect-notice';
        // The glyph stays outside the locale value (DESIGN §UI idioms, Strings).
        notice.textContent = `⚠ ${text}`;
        list.appendChild(notice);
      }
      panel.appendChild(list);
    }

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

    // The build's ID, small in a corner of the boot screen: what a player
    // quotes in a bug report. It moves to the title menu when there is one.
    const build = document.createElement('div');
    build.className = 'charselect-build';
    build.textContent = BUILD_ID;
    panel.appendChild(build);

    return panel;
  }

  private renderCard(character: CharacterConfig): HTMLButtonElement {
    // A card-shaped button: the factory mints it (type · class · click), the
    // card chrome stays its own class — it is not the primary-action idiom.
    const card = button('', {
      className: 'charselect-card',
      onClick: () => {
        this.audio.play('click');
        this.dispatcher.dispatch({ kind: 'chooseCharacter', characterId: character.id });
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
