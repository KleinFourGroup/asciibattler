/**
 * E4 — promotion modal; M2 — staggered reveal redesign. Shown at turn
 * boundaries (M1) whenever at least one player unit crossed an XP
 * threshold. Each promoted unit's card pops in CARD_STAGGER_MS after the
 * previous one, landing in its PRE-level state (old level, old stats, all
 * rows dim amber). Once a card lands it starts revealing its own gains —
 * level first, then each grown stat turns green and flips to the new
 * value with a `+N` chip — while later cards are still popping in (the
 * cascading-pipeline shape locked in the M2 design round). Each reveal
 * beat plays the healtick blip.
 *
 * Clicking anywhere except Continue fast-forwards every pending beat to
 * the fully-revealed end state (audio muted — no blip machine-gun).
 * Continue is always enabled and dismisses immediately: with M1's
 * per-turn cadence this screen is frequent, so the player is never
 * trapped behind the animation. A single "Continue" dispatches
 * `dismissPromotion`, which Run resolves into the next step (next turn,
 * recruit offer, or run:victory).
 *
 * If no units leveled, the scene is skipped entirely (no empty-state).
 * That branch lives in Run.
 */

import type { PromotionInfo } from '../core/events';
import type { UnitStats } from '../sim/Unit';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { fadeIn, fadeOutAndRemove } from './fade';
import { STAT_LABELS } from './statLabels';

/** Reveal cadence (M2). INTRO_DELAY_MS lets the screen's own fade-in
 *  (FADE_MS=180) finish before the first card pops, so the entrance
 *  isn't masked by the container fade. */
const INTRO_DELAY_MS = 220;
const CARD_STAGGER_MS = 200;
/** Gap between a card landing and its first reveal beat — lets the
 *  entrance pop settle so the level tick reads as a separate beat. */
const LAND_TO_REVEAL_MS = 260;
const REVEAL_STAGGER_MS = 200;

interface Beat {
  at: number;
  fired: boolean;
  fire: (skipped: boolean) => void;
}

export class PromotionScreen {
  private container: HTMLDivElement | null = null;
  private beats: Beat[] = [];
  private timers: number[] = [];

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
    this.cancelTimeline();
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
    promotions.forEach((p, i) => {
      const { el, reveals } = this.renderCard(p);
      cards.appendChild(el);
      const landAt = INTRO_DELAY_MS + i * CARD_STAGGER_MS;
      this.scheduleBeat(landAt, () => el.classList.add('is-landed'));
      reveals.forEach((reveal, k) =>
        this.scheduleBeat(landAt + LAND_TO_REVEAL_MS + k * REVEAL_STAGGER_MS, reveal),
      );
    });
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

    // Click-anywhere-to-skip (Continue excluded — its click dismisses).
    panel.addEventListener('click', (ev) => {
      if (button.contains(ev.target as Node)) return;
      this.finishTimeline();
    });

    return panel;
  }

  /**
   * Builds one card in its pre-level state and returns the reveal beats
   * that animate it: [0] the level tick, then one per grown stat, in
   * canonical stat order. Unchanged rows never reveal — they just print
   * the (identical) value.
   */
  private renderCard(p: PromotionInfo): {
    el: HTMLDivElement;
    reveals: ((skipped: boolean) => void)[];
  } {
    const card = document.createElement('div');
    card.className = `promotion-card promotion-card--${p.archetype}`;

    const glyph = document.createElement('div');
    glyph.className = 'promotion-glyph';
    glyph.textContent = p.glyph;
    card.appendChild(glyph);

    const levelLine = document.createElement('div');
    levelLine.className = 'promotion-level';
    const levelLabel = document.createElement('span');
    levelLabel.textContent = `${p.archetype.toUpperCase()} • `;
    const levelValue = document.createElement('span');
    levelValue.className = 'promotion-level-value';
    levelValue.textContent = `Lv ${p.oldLevel}`;
    levelLine.append(levelLabel, levelValue);
    card.appendChild(levelLine);

    const reveals: ((skipped: boolean) => void)[] = [];
    reveals.push((skipped) => {
      levelValue.textContent = `Lv ${p.newLevel}`;
      levelValue.classList.add('is-revealed');
      if (!skipped) this.audio.play('healtick');
    });

    const stats = document.createElement('div');
    stats.className = 'promotion-stats';
    for (const key of Object.keys(STAT_LABELS) as (keyof UnitStats)[]) {
      const before = p.oldStats[key];
      const after = p.newStats[key];
      const delta = after - before;
      const row = document.createElement('div');
      row.className = 'promotion-stat';
      const label = document.createElement('span');
      label.textContent = STAT_LABELS[key];
      const right = document.createElement('span');
      right.className = 'promotion-stat-right';
      const value = document.createElement('span');
      value.className = 'promotion-stat-value';
      value.textContent = String(before);
      right.appendChild(value);
      row.append(label, right);
      stats.appendChild(row);
      if (delta > 0) {
        reveals.push((skipped) => {
          row.classList.add('promotion-stat--gain');
          value.textContent = String(after);
          value.classList.add('is-revealed');
          const chip = document.createElement('span');
          chip.className = 'promotion-stat-delta';
          chip.textContent = `+${delta}`;
          right.appendChild(chip);
          if (!skipped) this.audio.play('healtick');
        });
      }
    }
    card.appendChild(stats);

    return { el: card, reveals };
  }

  private scheduleBeat(at: number, fire: (skipped: boolean) => void): void {
    const beat: Beat = { at, fired: false, fire };
    this.beats.push(beat);
    const id = window.setTimeout(() => {
      beat.fired = true;
      fire(false);
    }, at);
    this.timers.push(id);
  }

  /** Skip: fire every pending beat now, in timeline order, audio muted. */
  private finishTimeline(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
    for (const beat of [...this.beats].sort((a, b) => a.at - b.at)) {
      if (!beat.fired) {
        beat.fired = true;
        beat.fire(true);
      }
    }
  }

  /** Teardown: pending beats must not fire (or blip) on a dismissed screen. */
  private cancelTimeline(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
    this.beats = [];
  }
}
