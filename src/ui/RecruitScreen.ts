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

import type { UnitTemplate, Archetype, UnitStats } from '../sim/Unit';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import {
  abilityIdsForArchetype,
  rangeForArchetype,
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

    // GP3: card values are DERIVED (maxHp / cooldowns / crit) — the
    // template only carries the leveled stat snapshot (E3). Mirroring
    // `World.spawnUnit`'s derive call so the card preview matches the
    // actual in-battle unit exactly.
    const s = template.stats;
    const derived = deriveStats(s, rangeForArchetype(template.archetype));

    // Section A — compact two-column stat block. HP / DEF / CRIT / XP fill
    // the 2-col grid; the MOVE line spans the full width with its driving
    // stat (mobility) inline — GP3's "show the driving stat next to its
    // effect". Per-ability DMG / RNG / cadence moved to Section B below.
    const statsEl = document.createElement('div');
    statsEl.className = 'recruit-stats';
    statsEl.append(
      statLine('HP', String(derived.maxHp)),
      statLine('DEF', String(s.defense)),
      statLine('CRIT', `${Math.round(derived.critChance * 100)}%`),
      // E4: surface the level-up cost so the player knows what banked XP
      // is doing on the persistent roster (fresh recruits arrive at xp=0).
      statLine(
        'XP',
        isAtLevelCap(template.level) ? 'MAX' : `${template.xp}/${xpToNext(template.level)}`,
      ),
      statLine(
        'MOVE',
        `${ticksToSeconds(derived.moveCooldownTicks).toFixed(2)}s · mob ${s.mobility}`,
        'recruit-move',
      ),
    );
    card.appendChild(statsEl);

    // Section B — abilities list. One row per ability id (in stored order),
    // built as a loop so a future multi-ability unit just renders more
    // rows. This self-documents *what the unit does* (Strike / Heal / Bolt)
    // — the real legibility win over the old single ATK number, and it lets
    // the healer read honestly ("N heal", not a misleading "DMG 0").
    const abilities = document.createElement('div');
    abilities.className = 'recruit-abilities';
    const abilitiesHeading = document.createElement('div');
    abilitiesHeading.className = 'recruit-abilities-heading';
    abilitiesHeading.textContent = 'Abilities';
    abilities.appendChild(abilitiesHeading);
    for (const id of abilityIdsForArchetype(template.archetype)) {
      abilities.appendChild(abilityRow(id, template.archetype, s));
    }
    card.appendChild(abilities);

    card.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'chooseRecruit', unitTemplate: template });
    });

    return card;
  }
}

/**
 * GP3 — render-only ability descriptor map. Display labels + whether the
 * ability heals or damages live HERE (UI), NOT in `config/abilities.json`
 * (which stays mechanics-only — no `name` field; locked at the GP3 tee-up).
 * An ability that ships before its entry falls back to its raw id + a
 * damage reading, so the card never throws on an unmapped ability.
 */
const ABILITY_UI: Record<string, { label: string; effect: 'damage' | 'heal' }> = {
  melee_strike: { label: 'Strike', effect: 'damage' },
  ranged_shot: { label: 'Shot', effect: 'damage' },
  gambit_strike: { label: 'Gambit', effect: 'damage' },
  heal_ally: { label: 'Heal', effect: 'heal' },
  magic_bolt: { label: 'Bolt', effect: 'damage' },
  catapult_shot: { label: 'Lob', effect: 'damage' },
};

function statLine(label: string, value: string, extraClass?: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = extraClass ? `recruit-stat ${extraClass}` : 'recruit-stat';
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.textContent = value;
  div.append(labelEl, valueEl);
  return div;
}

/**
 * GP3 — one ability row: name, then `N dmg · rng R` (or `N heal · rng R`)
 * with an AoE tag when the ability has a blast, then `cadence s · agi A`.
 * The damage / heal amount reuses the sim's single-source-of-truth helpers
 * (`damageStatFor`, or the `magic`-scaled heal matching `healAmountFor`) so
 * the card can't disagree with what the unit actually does in battle.
 * Range / cadence / AoE come from `config/abilities.json` via `abilityConfig`.
 */
function abilityRow(id: string, archetype: Archetype, stats: UnitStats): HTMLDivElement {
  const ui = ABILITY_UI[id] ?? { label: id, effect: 'damage' as const };
  const cfg = abilityConfig(id);

  const row = document.createElement('div');
  row.className = 'recruit-ability';

  const name = document.createElement('div');
  name.className = 'recruit-ability-name';
  name.textContent = ui.label;
  row.appendChild(name);

  const detail = document.createElement('div');
  detail.className = 'recruit-ability-detail';
  const amount = ui.effect === 'heal' ? stats.magic : damageStatFor(archetype, stats);
  detail.textContent = `${amount} ${ui.effect === 'heal' ? 'heal' : 'dmg'} · rng ${cfg.range}`;
  if (cfg.aoe) {
    const side = cfg.aoe.radius * 2 + 1;
    const tag = document.createElement('span');
    tag.className = 'recruit-ability-aoe';
    tag.textContent = `AoE ${side}×${side}`;
    detail.append(' ', tag);
  }
  row.appendChild(detail);

  const cadence = document.createElement('div');
  cadence.className = 'recruit-ability-cadence';
  const seconds = ticksToSeconds(attackCooldownTicksFor(cfg.cooldownSeconds, stats.agility));
  cadence.textContent = `${seconds.toFixed(2)}s · agi ${stats.agility}`;
  row.appendChild(cadence);

  return row;
}
