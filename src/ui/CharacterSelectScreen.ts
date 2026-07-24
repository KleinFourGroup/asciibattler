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
 */

import { CHARACTERS, type CharacterConfig } from '../config/characters';
import { daemonById } from '../config/daemons';
import { nameForArchetype } from '../sim/archetypes';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { fadeIn, fadeOutAndRemove } from './fade';

/** "6× Mercenary · 4× Archer" — counts in roster order, display names. */
function rosterSummary(character: CharacterConfig): string {
  const counts = new Map<string, number>();
  for (const a of character.roster) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts.entries()]
    .map(([archetype, n]) => `${n}× ${nameForArchetype(archetype)}`)
    .join(' · ');
}

export class CharacterSelectScreen {
  private container: HTMLDivElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(): void {
    this.hide();
    this.container = this.render();
    this.container.classList.add('screen-fade');
    this.mount.appendChild(this.container);
    fadeIn(this.container);
  }

  hide(): void {
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
    }
  }

  private render(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'charselect-screen';

    const heading = document.createElement('div');
    heading.className = 'charselect-heading';
    heading.textContent = 'Choose Your Character';
    panel.appendChild(heading);

    const row = document.createElement('div');
    row.className = 'charselect-row';
    panel.appendChild(row);

    for (const character of CHARACTERS) {
      row.appendChild(this.renderCard(character));
    }

    return panel;
  }

  private renderCard(character: CharacterConfig): HTMLButtonElement {
    const card = document.createElement('button');
    card.className = 'charselect-card';

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

    card.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'chooseCharacter', characterId: character.id });
    });

    return card;
  }
}
