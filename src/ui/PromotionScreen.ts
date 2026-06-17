/**
 * E4 — promotion modal; M2 — staggered reveal redesign (two-phase). Shown
 * at turn boundaries (M1) whenever at least one player unit crossed an XP
 * threshold. Phase 1: each card pops in CARD_STAGGER_MS after the previous
 * one, landing in its PRE-level state (old level, old stats, all rows dim
 * amber). Phase 2, only after the LAST card lands: cards reveal ONE AT A
 * TIME — level first, then each grown stat turns green and flips to the
 * new value with a `+N` chip — so the eye is never drawn to two units at
 * once (the active card carries .is-revealing, a brightened border). Each
 * reveal beat plays the healtick blip. (The original cascading-pipeline
 * shape — cards revealing while later ones were still landing — was
 * revised to this after playtest: multiple simultaneous motions.)
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
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { fadeIn, fadeOutAndRemove } from './fade';
import { buildUnitCard, unitCardFromPromotion } from './UnitCard';

/** Reveal cadence (M2). INTRO_DELAY_MS lets the screen's own fade-in
 *  (FADE_MS=180) finish before the first card pops, so the entrance
 *  isn't masked by the container fade. */
const INTRO_DELAY_MS = 220;
const CARD_STAGGER_MS = 400;
/** Gap between the LAST card landing and the first reveal beat — the
 *  phase boundary, where the eye settles before stats start ticking. */
const LAND_TO_REVEAL_MS = 660;
const REVEAL_STAGGER_MS = 400;
/** Extra breath between one card finishing its reveals and the next card
 *  starting (on top of the trailing REVEAL_STAGGER_MS) — the eye-jump cue. */
const CARD_HANDOFF_MS = 400;

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
    const rendered = promotions.map((p) => this.renderCard(p));
    // Phase 1 — entrances. Every card lands before any reveal fires.
    rendered.forEach(({ el }, i) => {
      cards.appendChild(el);
      this.scheduleBeat(INTRO_DELAY_MS + i * CARD_STAGGER_MS, () =>
        el.classList.add('is-landed'),
      );
    });
    // Phase 2 — reveals, strictly one card at a time. The active card
    // carries .is-revealing so the single focal point is explicit.
    let at =
      INTRO_DELAY_MS + (rendered.length - 1) * CARD_STAGGER_MS + LAND_TO_REVEAL_MS;
    for (const { el, reveals } of rendered) {
      this.scheduleBeat(at, () => el.classList.add('is-revealing'));
      for (const reveal of reveals) {
        this.scheduleBeat(at, reveal);
        at += REVEAL_STAGGER_MS;
      }
      this.scheduleBeat(at, () => el.classList.remove('is-revealing'));
      at += CARD_HANDOFF_MS;
    }
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
   * Builds one card in its pre-level state (via the shared `UnitCard` builder,
   * promotion skin) and returns the reveal beats that animate it: [0] the level
   * tick, then one per grown stat, in canonical stat order. The card's DOM +
   * styling live in the component; this screen owns only the M2 timeline,
   * driving the card through the `levelValue` + `statRows` handles. Unchanged
   * rows never reveal — they just print the (identical) value.
   */
  private renderCard(p: PromotionInfo): {
    el: HTMLDivElement;
    reveals: ((skipped: boolean) => void)[];
  } {
    const { el, levelValue, statRows } = buildUnitCard(unitCardFromPromotion(p), {
      mode: 'full',
      skin: 'promotion',
    });

    const reveals: ((skipped: boolean) => void)[] = [];
    reveals.push((skipped) => {
      levelValue.textContent = `Lv ${p.newLevel}`;
      levelValue.classList.add('is-revealed');
      if (!skipped) this.audio.play('healtick');
    });

    // Iterate the card's stat rows in render order (POW first, then the combat
    // grid) so the reveal beats fire top-to-bottom matching the card layout.
    for (const [key, { row, value, right }] of statRows) {
      const delta = p.newStats[key] - p.oldStats[key];
      if (delta <= 0) continue;
      reveals.push((skipped) => {
        row.classList.add('unit-card__stat--gain');
        value.textContent = String(p.newStats[key]);
        value.classList.add('is-revealed');
        const chip = document.createElement('span');
        chip.className = 'unit-card__stat-delta';
        chip.textContent = `+${delta}`;
        right.appendChild(chip);
        if (!skipped) this.audio.play('healtick');
      });
    }

    return { el, reveals };
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
