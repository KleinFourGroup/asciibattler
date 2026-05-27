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
import { attackRangeForArchetype, glyphForArchetype } from '../sim/archetypes';
import { deriveStats } from '../sim/stats';
import { ticksToSeconds } from '../config';
import { fadeIn, fadeOutAndRemove } from './fade';

export class RecruitScreen {
  private container: HTMLDivElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(offer: readonly UnitTemplate[]): void {
    this.hide();
    this.container = this.render(offer);
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

  private render(offer: readonly UnitTemplate[]): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'recruit-screen';

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

    return panel;
  }

  private renderCard(template: UnitTemplate): HTMLDivElement {
    const card = document.createElement('div');
    card.className = `recruit-card recruit-card--${template.archetype}`;

    const glyph = document.createElement('div');
    glyph.className = 'recruit-glyph';
    glyph.textContent = glyphForArchetype(template.archetype);
    card.appendChild(glyph);

    const label = document.createElement('div');
    label.className = 'recruit-archetype';
    label.textContent = template.archetype;
    card.appendChild(label);

    // E1: card values are DERIVED (maxHp / cooldowns / crit) — the
    // template only carries base stats. Mirroring `World.spawnUnit`'s
    // derive call so the card preview matches the actual in-battle unit
    // exactly. Basic damage comes from the archetype's primary stat
    // (melee → strength, ranged → ranged) — same lookup
    // `basicAttackDamage` uses inside AttackBehavior.
    const s = template.stats;
    const attackRange = attackRangeForArchetype(template.archetype);
    const derived = deriveStats(s, attackRange);
    const baseDamage = template.archetype === 'melee' ? s.strength : s.ranged;
    const statsEl = document.createElement('div');
    statsEl.className = 'recruit-stats';
    statsEl.append(
      statLine('HP', String(derived.maxHp)),
      statLine('DMG', String(baseDamage)),
      statLine('RNG', String(derived.attackRange)),
      statLine('ATK', `${ticksToSeconds(derived.attackCooldownTicks).toFixed(2)}s`),
      statLine('MOV', `${ticksToSeconds(derived.moveCooldownTicks).toFixed(2)}s`),
      statLine('CRIT', `${Math.round(derived.critChance * 100)}%`),
    );
    card.appendChild(statsEl);

    card.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'chooseRecruit', unitTemplate: template });
    });

    return card;
  }
}

function statLine(label: string, value: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'recruit-stat';
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.textContent = value;
  div.append(labelEl, valueEl);
  return div;
}
