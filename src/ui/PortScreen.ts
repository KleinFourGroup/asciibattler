/**
 * 50e — the port screen (spec §Ports; the §50 kickoff shape-lock: ONE
 * sectioned scrolling screen). Shown while the run is docked (`phase ===
 * 'port'`): the STOCK sections (units on recruit-skin UnitCards, packets,
 * daemons — all rolled at dock, §50d) then the YOUR-CARGO sections (sell
 * held packets; the pay-to-remove crew service), with a fixed Leave button.
 *
 * The RewardScreen discipline throughout: the screen holds the LIVE Run
 * (scene-scoped, disposed on swap) and fully re-renders the body after
 * every command it dispatches, so slot indices, sold badges, affordability
 * disables, and the cache list are always true. It ALSO re-renders off
 * `run:bitsChanged` + `run:cacheChanged` — the cache modal stays usable
 * while docked (view/discard), and a modal discard would otherwise leave
 * this screen's sell indices stale (selling the wrong packet, a real bug).
 *
 * Display honesty: prices render exactly what the engine charges (the
 * slot's serialized price / the shared price-book helpers) — never a
 * re-derivation that could drift. Unaffordable buys render DISABLED, not
 * hidden (the shape-lock: seeing what you can't afford is the point of a
 * shop); sold slots keep their row with a SOLD badge (§50d's flag-not-splice
 * makes that free).
 */

import { daemonById } from '../config/daemons';
import { packetById } from '../config/packets';
import { PRICES, packetPrice, sellPrice } from '../config/prices';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { Run } from '../run/Run';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { buildUnitCard, unitCardFromTemplate } from './UnitCard';
import { CardListModal } from './CardListModal';
import { fadeIn, fadeOutAndRemove } from './fade';

export class PortScreen {
  private container: HTMLDivElement | null = null;
  private bodyEl: HTMLDivElement | null = null;
  private unsubscribes: Array<() => void> = [];
  // 51d — the crew-removal picker (the 51c selectable roster view). One
  // instance per screen, disposed on hide (closes a lingering overlay).
  private readonly removalPicker: CardListModal;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly run: Run,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.removalPicker = new CardListModal(mount, audio);
  }

  show(): void {
    this.hide();
    const panel = document.createElement('div');
    panel.className = 'port-screen screen-fade';

    const heading = document.createElement('div');
    heading.className = 'port-heading';
    heading.textContent = '$ Port';
    panel.appendChild(heading);

    const subtitle = document.createElement('div');
    subtitle.className = 'port-subtitle';
    subtitle.textContent = 'Dock and trade — your bits, top-left.';
    panel.appendChild(subtitle);

    // Fixed (viewport-pinned) so it survives the scroll — leaving must never
    // require finding the bottom of a long stock list.
    const leave = document.createElement('button');
    leave.type = 'button';
    leave.className = 'port-leave';
    leave.textContent = 'Leave port ▸';
    leave.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'leavePort' });
    });
    panel.appendChild(leave);

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'port-body';
    panel.appendChild(this.bodyEl);
    this.renderBody();

    // Re-render on bits/cache movement from ANY source (own buys re-render
    // via the dispatch path too — a second renderBody on the same state is
    // idempotent and cheap at this scale).
    this.unsubscribes.push(
      this.bus.on('run:bitsChanged', () => this.renderBody()),
      this.bus.on('run:cacheChanged', () => this.renderBody()),
    );

    this.container = panel;
    this.mount.appendChild(panel);
    fadeIn(panel);
  }

  hide(): void {
    this.removalPicker.dispose();
    for (const off of this.unsubscribes) off();
    this.unsubscribes = [];
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
      this.bodyEl = null;
    }
  }

  /** Full re-render from live state (the RewardScreen renderPortions
   *  discipline — indices in every button are true after each command). */
  private renderBody(): void {
    if (this.bodyEl === null) return;
    this.bodyEl.replaceChildren();
    const stock = this.run.portStock;
    if (stock === null) return; // undocking — the fading DOM needs nothing

    this.bodyEl.appendChild(this.sectionHeading('Units for hire'));
    const unitGrid = document.createElement('div');
    unitGrid.className = 'port-unit-grid';
    stock.units.forEach((slot, index) => {
      const wrap = document.createElement('div');
      wrap.className = 'port-unit-slot';
      const { el } = buildUnitCard(unitCardFromTemplate(slot.template), {
        mode: 'full',
        skin: 'recruit',
        clickable: false,
      });
      wrap.appendChild(el);
      wrap.appendChild(
        this.priceFooter(slot.price, slot.sold, () =>
          this.transact('pickup', { kind: 'buyPortUnit', index }),
        ),
      );
      unitGrid.appendChild(wrap);
    });
    this.bodyEl.appendChild(unitGrid);

    this.bodyEl.appendChild(this.sectionHeading('Packets'));
    if (stock.packets.length === 0) this.bodyEl.appendChild(this.emptyLine('Sold out.'));
    stock.packets.forEach((slot, index) => {
      const packet = packetById(slot.packetId);
      this.bodyEl!.appendChild(
        this.stockRow(
          `▤ ${packet?.name ?? slot.packetId}`,
          packet?.description,
          slot.price,
          slot.sold,
          // A full cache takes the 49c swap control — the engine enforces the
          // same contract, so a swap-less buy would silently no-op anyway.
          !this.run.cacheHasRoom && !slot.sold
            ? this.swapBuyControl(index, slot.price)
            : undefined,
          () => this.transact('pickup', { kind: 'buyPortPacket', index }),
        ),
      );
    });

    this.bodyEl.appendChild(this.sectionHeading('Daemons'));
    if (stock.daemons.length === 0) {
      this.bodyEl.appendChild(this.emptyLine('Nothing you don’t already own.'));
    }
    stock.daemons.forEach((slot, index) => {
      const daemon = daemonById(slot.daemonId);
      this.bodyEl!.appendChild(
        this.stockRow(
          `◈ ${daemon?.name ?? slot.daemonId}`,
          daemon?.description,
          slot.price,
          slot.sold,
          undefined,
          () => this.transact('pickup', { kind: 'buyPortDaemon', index }),
        ),
      );
    });

    this.bodyEl.appendChild(this.sectionHeading('Sell packets'));
    if (this.run.cache.length === 0) {
      this.bodyEl.appendChild(this.emptyLine('Your cache is empty.'));
    }
    this.run.cache.forEach((packetId, cacheIndex) => {
      const packet = packetById(packetId);
      const refund = sellPrice(packetPrice(packetId));
      const row = document.createElement('div');
      row.className = 'port-row';
      row.appendChild(this.rowBody(`▤ ${packet?.name ?? packetId}`, undefined));
      const actions = document.createElement('div');
      actions.className = 'port-row__actions';
      actions.appendChild(this.priceTag(refund));
      actions.appendChild(
        this.actionButton('Sell', 'port-buy', () =>
          this.transact('pickup', { kind: 'sellPacket', cacheIndex }),
        ),
      );
      row.appendChild(actions);
      this.bodyEl!.appendChild(row);
    });

    this.bodyEl.appendChild(this.sectionHeading('Crew removal'));
    // 51d — the signature-thin per-unit rows ("rogue · Lv 5" × N identical)
    // retire for the 51c roster PICKER: one launch row; the modal shows the
    // full cards (stats/abilities/XP), select one, confirm strikes it.
    const removalNote = this.emptyLine(
      `Pay ${PRICES.unitRemovalPrice} bits to strike a unit from the roster — its deck card goes with it.`,
    );
    this.bodyEl.appendChild(removalNote);
    const row = document.createElement('div');
    row.className = 'port-row';
    row.appendChild(this.rowBody(`✕ Strike a unit from the crew`, undefined));
    const actions = document.createElement('div');
    actions.className = 'port-row__actions';
    actions.appendChild(this.priceTag(PRICES.unitRemovalPrice));
    const button = this.actionButton('Choose… ▸', 'port-remove', () => {
      this.audio.play('click');
      this.openRemovalPicker();
    });
    // The engine's silent no-op conditions, surfaced as disables.
    if (this.run.team.length <= 1 || this.run.bits < PRICES.unitRemovalPrice) {
      button.disabled = true;
    }
    actions.appendChild(button);
    row.appendChild(actions);
    this.bodyEl.appendChild(row);
  }

  /** 51d — the removal picker: the 51c selectable roster view over the live
   *  crew (select 1 → confirm = `payToRemoveUnit`). The modal reports the
   *  SOURCE index, which IS the rosterIndex (`run.team` passed unsorted —
   *  and the mapping would hold even under a sorted display order). */
  private openRemovalPicker(): void {
    this.removalPicker.open('Strike a unit', this.run.team, {
      selection: {
        count: 1,
        confirmText: `Remove for ${PRICES.unitRemovalPrice} bits ▸`,
        onConfirm: ([rosterIndex]) => {
          if (rosterIndex === undefined) return;
          this.transact('click', { kind: 'payToRemoveUnit', rosterIndex });
        },
      },
    });
  }

  private transact(sound: 'pickup' | 'click', command: Parameters<RunDispatcher['dispatch']>[0]): void {
    this.audio.play(sound);
    this.dispatcher.dispatch(command);
    this.renderBody();
  }

  private sectionHeading(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'port-section-heading';
    el.textContent = text;
    return el;
  }

  private emptyLine(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'port-empty-line';
    el.textContent = text;
    return el;
  }

  private rowBody(title: string, desc: string | undefined): HTMLDivElement {
    const body = document.createElement('div');
    body.className = 'port-row__body';
    const titleEl = document.createElement('div');
    titleEl.className = 'port-row__title';
    titleEl.textContent = title;
    body.appendChild(titleEl);
    if (desc !== undefined) {
      const descEl = document.createElement('div');
      descEl.className = 'port-row__desc';
      descEl.textContent = desc;
      body.appendChild(descEl);
    }
    return body;
  }

  /** A packet/daemon stock row: title + desc left; SOLD badge, or price +
   *  Buy (or the full-cache swap control) right. */
  private stockRow(
    title: string,
    desc: string | undefined,
    price: number,
    sold: boolean,
    control: HTMLElement | undefined,
    onBuy: () => void,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'port-row';
    row.appendChild(this.rowBody(title, desc));
    const actions = document.createElement('div');
    actions.className = 'port-row__actions';
    if (sold) {
      actions.appendChild(this.soldBadge());
    } else if (control !== undefined) {
      actions.appendChild(this.priceTag(price));
      actions.appendChild(control);
    } else {
      actions.appendChild(this.priceTag(price));
      const button = this.actionButton('Buy', 'port-buy', onBuy);
      if (this.run.bits < price) button.disabled = true;
      actions.appendChild(button);
    }
    row.appendChild(actions);
    return row;
  }

  /** The unit slot's footer: SOLD badge, or price + Buy (disabled broke). */
  private priceFooter(price: number, sold: boolean, onBuy: () => void): HTMLDivElement {
    const footer = document.createElement('div');
    footer.className = 'port-unit-slot__footer';
    if (sold) {
      footer.appendChild(this.soldBadge());
    } else {
      footer.appendChild(this.priceTag(price));
      const button = this.actionButton('Buy', 'port-buy', onBuy);
      if (this.run.bits < price) button.disabled = true;
      footer.appendChild(button);
    }
    return footer;
  }

  /** The 49c/RewardScreen swap idiom: pick a held packet to drop, then the
   *  buy carries `swapCacheIndex`. Rebuilt every re-render — always live. */
  private swapBuyControl(stockIndex: number, price: number): HTMLSpanElement {
    const wrap = document.createElement('span');
    wrap.className = 'port-swap';
    const select = document.createElement('select');
    select.className = 'port-swap__select';
    this.run.cache.forEach((packetId, slot) => {
      const option = document.createElement('option');
      option.value = String(slot);
      option.textContent = packetById(packetId)?.name ?? packetId;
      select.appendChild(option);
    });
    wrap.appendChild(select);
    const button = this.actionButton('Swap in', 'port-buy port-swap__button', () =>
      this.transact('pickup', {
        kind: 'buyPortPacket',
        index: stockIndex,
        swapCacheIndex: Number(select.value),
      }),
    );
    if (this.run.bits < price) button.disabled = true;
    wrap.appendChild(button);
    return wrap;
  }

  private priceTag(price: number): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = 'port-price';
    el.textContent = `${price} bits`;
    return el;
  }

  private soldBadge(): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = 'port-sold';
    el.textContent = 'SOLD';
    return el;
  }

  private actionButton(label: string, className: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }
}
