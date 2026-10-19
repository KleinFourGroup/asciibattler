/**
 * The promotion screen, shown when at least one of the player's units
 * leveled, at a turn's end or a rest. Its reveal runs in two phases. First
 * each card pops in `CARD_STAGGER_MS` after the one before, in its state
 * before the level (the old level and stats, every row dim amber). Then,
 * only after the last card lands, the cards reveal one at a time (the
 * level first, then each grown stat turns green and flips to its new value
 * with a `+N` chip, then the derived lines), so the eye is never drawn to
 * two units at once; the active card carries `.is-revealing`, a brighter
 * border. Each beat of the reveal plays the `stattick` tick.
 *
 * A click anywhere on the panel but Continue fast-forwards every pending
 * beat to the revealed end, silently. Continue is always enabled and
 * dismisses at once: the screen comes at any turn a unit levels, so the
 * player is never held behind the animation. It dispatches
 * `dismissPromotion`, which Run routes (`handleDismissPromotion`): inside
 * an encounter the turn's gate chain goes on, after a rest the map.
 *
 * When no unit leveled, Run skips the screen; it has no empty state.
 */

import type { PromotionInfo } from '../core/events';
import { t } from '../i18n/ui';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { Screen } from './Screen';
import { button } from './button';
import { buildUnitCard, unitCardFromPromotion } from './UnitCard';
import { promotionDeltaParts } from './promotionDelta';

/** The reveal's cadence. `INTRO_DELAY_MS` lets the screen's own 180 ms
 *  fade-in (`.screen-fade`) finish before the first card pops, so the
 *  container's fade doesn't mask the entrance. */
const INTRO_DELAY_MS = 220;
const CARD_STAGGER_MS = 400;
/** The gap between the last card landing and the first reveal beat: the
 *  phases' boundary, where the eye settles before the stats tick. */
const LAND_TO_REVEAL_MS = 660;
const REVEAL_STAGGER_MS = 400;
/** An extra pause between one card's last reveal and the next card's
 *  first (on top of the trailing `REVEAL_STAGGER_MS`), the cue for the eye
 *  to move. */
const CARD_HANDOFF_MS = 400;

interface Beat {
  at: number;
  fired: boolean;
  fire: (skipped: boolean) => void;
}

export class PromotionScreen extends Screen {
  private beats: Beat[] = [];
  private timers: number[] = [];

  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {
    super(mount);
  }

  show(promotions: readonly PromotionInfo[]): void {
    this.hide();
    this.present(this.render(promotions));
  }

  override hide(): void {
    this.cancelTimeline();
    super.hide();
  }

  private render(promotions: readonly PromotionInfo[]): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'promotion-screen';

    const heading = document.createElement('div');
    heading.className = 'promotion-heading';
    heading.textContent = t('promotion.heading', { count: promotions.length });
    panel.appendChild(heading);

    const cards = document.createElement('div');
    cards.className = 'promotion-cards';
    const rendered = promotions.map((p) => this.renderCard(p));
    // The entrances: every card lands before any reveal fires.
    rendered.forEach(({ el }, i) => {
      cards.appendChild(el);
      this.scheduleBeat(INTRO_DELAY_MS + i * CARD_STAGGER_MS, () =>
        el.classList.add('is-landed'),
      );
    });
    // The reveals, strictly one card at a time. The active card carries
    // `.is-revealing`, so the one focal point is marked.
    let at =
      INTRO_DELAY_MS + (rendered.length - 1) * CARD_STAGGER_MS + LAND_TO_REVEAL_MS;
    for (const { el, reveals } of rendered) {
      this.scheduleBeat(at, () => el.classList.add('is-revealing'));
      // The tick's one site. Flat on purpose: a tally rising a scale degree
      // a beat was tried against it by ear, and the flat tick won. A skipped
      // beat is silent.
      for (const reveal of reveals) {
        this.scheduleBeat(at, (skipped) => {
          reveal();
          if (!skipped) this.audio.play('stattick');
        });
        at += REVEAL_STAGGER_MS;
      }
      this.scheduleBeat(at, () => el.classList.remove('is-revealing'));
      at += CARD_HANDOFF_MS;
    }
    panel.appendChild(cards);

    const cont = button(t('common.continue'), {
      className: 'btn--primary',
      onClick: () => {
        this.audio.play('click');
        this.dispatcher.dispatch({ kind: 'dismissPromotion' });
      },
    });
    panel.appendChild(cont);

    // A click anywhere skips, but on Continue, whose click dismisses.
    panel.addEventListener('click', (ev) => {
      if (cont.contains(ev.target as Node)) return;
      this.finishTimeline();
    });

    return panel;
  }

  /**
   * Builds one card in its state before the level (the unit card, promotion
   * skin) and returns the beats that reveal it: the level first, then one
   * per grown stat in the card's row order (POW first), then the derived
   * lines if any. The card's DOM and styling are the unit card's; this
   * screen owns the timeline, driving the card through the `levelValue` and
   * `statRows` handles. An unchanged row never reveals; it shows the same
   * value throughout.
   */
  private renderCard(p: PromotionInfo): {
    el: HTMLDivElement;
    reveals: (() => void)[];
  } {
    const { el, levelValue, statRows } = buildUnitCard(unitCardFromPromotion(p), {
      mode: 'full',
      skin: 'promotion',
    });

    const reveals: (() => void)[] = [];
    reveals.push(() => {
      levelValue.textContent = t('common.lv', { level: p.newLevel });
      levelValue.classList.add('is-revealed');
    });

    // The card's stat rows in their order (POW first, then the combat grid),
    // so the beats fire top to bottom as the card is laid out.
    for (const [key, { row, value, right }] of statRows) {
      const delta = p.newStats[key] - p.oldStats[key];
      if (delta <= 0) continue;
      reveals.push(() => {
        row.classList.add('unit-card__stat--gain');
        value.textContent = String(p.newStats[key]);
        value.classList.add('is-revealed');
        const chip = document.createElement('span');
        chip.className = 'unit-card__stat-delta';
        chip.textContent = `+${delta}`;
        right.appendChild(chip);
      });
    }

    // The derived block, what the grown points bought, as one last beat
    // after the stats. The wording is `promotionDeltaParts`, pure and tested
    // headless; an empty result (a level that grew only power) makes no
    // block. The block is in the DOM from the card's landing and holds its
    // height (the CSS gates on `visibility`), so the reveal can't grow the
    // card and re-center the card row mid-timeline.
    const deltas = promotionDeltaParts(p.oldStats, p.newStats, p.archetype);
    if (deltas.length > 0) {
      const box = document.createElement('div');
      box.className = 'unit-card__derived';
      for (const line of deltas) {
        const row = document.createElement('div');
        row.className = 'unit-card__derived-row';
        row.textContent = line;
        box.appendChild(row);
      }
      el.appendChild(box);
      reveals.push(() => {
        box.classList.add('is-revealed');
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
