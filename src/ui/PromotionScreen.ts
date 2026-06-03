/**
 * E4 — pre-recruit promotion modal. Shown between BattleScene and
 * RecruitScene whenever at least one player unit crossed an XP
 * threshold in the just-completed battle. Lists each promoted unit
 * with archetype + glyph + old→new level + per-stat deltas. A single
 * "Continue" button dispatches `dismissPromotion`, which Run resolves
 * into the normal post-battle step (recruit offer or run:victory).
 *
 * If no units leveled, the scene is skipped entirely (no empty-state).
 * That branch lives in Run.handleBattleEnded.
 */

import type { PromotionInfo } from '../core/events';
import type { UnitStats } from '../sim/Unit';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { fadeIn, fadeOutAndRemove } from './fade';

const STAT_LABELS: Record<keyof UnitStats, string> = {
  constitution: 'CON',
  strength: 'STR',
  ranged: 'RNG',
  magic: 'MAG',
  luck: 'LCK',
  agility: 'AGI',
  mobility: 'MOB',
};

export class PromotionScreen {
  private container: HTMLDivElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(promotions: readonly PromotionInfo[]): void {
    this.hide();
    this.container = this.render(promotions);
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

  private render(promotions: readonly PromotionInfo[]): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'promotion-screen';

    const heading = document.createElement('div');
    heading.className = 'promotion-heading';
    heading.textContent =
      promotions.length === 1 ? 'Level Up!' : `${promotions.length} Promotions`;
    panel.appendChild(heading);

    const cards = document.createElement('div');
    cards.className = 'promotion-cards';
    for (const p of promotions) cards.appendChild(this.renderCard(p));
    panel.appendChild(cards);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'promotion-continue';
    button.textContent = 'Continue';
    button.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'dismissPromotion' });
    });
    panel.appendChild(button);

    return panel;
  }

  private renderCard(p: PromotionInfo): HTMLDivElement {
    const card = document.createElement('div');
    card.className = `promotion-card promotion-card--${p.archetype}`;

    const glyph = document.createElement('div');
    glyph.className = 'promotion-glyph';
    glyph.textContent = p.glyph;
    card.appendChild(glyph);

    const levelLine = document.createElement('div');
    levelLine.className = 'promotion-level';
    levelLine.textContent = `${p.archetype.toUpperCase()} • Lv ${p.oldLevel} → ${p.newLevel}`;
    card.appendChild(levelLine);

    const stats = document.createElement('div');
    stats.className = 'promotion-stats';
    for (const key of Object.keys(STAT_LABELS) as (keyof UnitStats)[]) {
      const before = p.oldStats[key];
      const after = p.newStats[key];
      const delta = after - before;
      const row = document.createElement('div');
      row.className = 'promotion-stat';
      if (delta > 0) row.classList.add('promotion-stat--gain');
      const label = document.createElement('span');
      label.textContent = STAT_LABELS[key];
      const value = document.createElement('span');
      // Show "6 → 7 (+1)" only on the gain rows; unchanged rows just
      // print the value so the eye is drawn to actual growth.
      value.textContent =
        delta > 0 ? `${before} → ${after} (+${delta})` : String(after);
      row.append(label, value);
      stats.appendChild(row);
    }
    card.appendChild(stats);

    return card;
  }
}
