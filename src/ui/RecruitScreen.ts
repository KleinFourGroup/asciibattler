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
import {
  abilityIdsForArchetype,
  rangeForArchetype,
  baseMoveCooldownSecondsForArchetype,
  glyphForArchetype,
} from '../sim/archetypes';
import { deriveStats, attackCooldownTicksFor, damageStatFor } from '../sim/stats';
import { abilityConfig } from '../config/abilities';
import { ticksToSeconds } from '../config';
import { fadeIn, fadeOutAndRemove } from './fade';
import { isAtLevelCap, xpToNext } from '../sim/xp';

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
    label.textContent = `Level ${template.level} ${template.archetype}`;
    card.appendChild(label);

    // E1: card values are DERIVED (maxHp / cooldowns / crit) — the
    // template only carries the leveled stat snapshot (E3). Mirroring
    // `World.spawnUnit`'s derive call so the card preview matches the
    // actual in-battle unit exactly. Basic damage comes from the
    // archetype's primary stat (melee → strength, ranged → ranged) —
    // same lookup `basicAttackDamage` uses inside AbilityBehavior.
    const s = template.stats;
    const attackRange = rangeForArchetype(template.archetype);
    const moveCD = baseMoveCooldownSecondsForArchetype(template.archetype);
    const derived = deriveStats(s, attackRange, moveCD);
    const baseDamage = damageStatFor(template.archetype, s);
    // E5 pre-work: ATK cadence now comes from the archetype's primary
    // ability config (scaled by speed), matching what the unit will
    // actually fire at in battle. Archetypes carry one basic strike
    // today; the `[0]` is the primary ability and the guard covers a
    // hypothetical ability-less archetype.
    const primaryAbilityId = abilityIdsForArchetype(template.archetype)[0];
    const attackSeconds =
      primaryAbilityId === undefined
        ? null
        : ticksToSeconds(
            attackCooldownTicksFor(abilityConfig(primaryAbilityId).cooldownSeconds, s.speed),
          );
    const statsEl = document.createElement('div');
    statsEl.className = 'recruit-stats';
    statsEl.append(
      statLine('HP', String(derived.maxHp)),
      statLine('DMG', String(baseDamage)),
      statLine('RNG', String(derived.attackRange)),
      statLine('ATK', attackSeconds === null ? '—' : `${attackSeconds.toFixed(2)}s`),
      statLine('MOV', `${ticksToSeconds(derived.moveCooldownTicks).toFixed(2)}s`),
      statLine('CRIT', `${Math.round(derived.critChance * 100)}%`),
      // E4: surface the level-up cost so the player knows what banked
      // XP is doing on the persistent roster (fresh recruits arrive at
      // xp=0 so the value here is `0/xpToNext(level)`).
      statLine(
        'XP',
        isAtLevelCap(template.level)
          ? 'MAX'
          : `${template.xp}/${xpToNext(template.level)}`,
      ),
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
