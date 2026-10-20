/**
 * The port screen: one sectioned, scrolling screen, shown while the run is
 * docked (`phase === 'port'`). The stock's sections first (units on
 * recruit-skin unit cards, packets, daemons, all rolled on docking), then
 * the cargo's (sell held packets; the pay-to-remove crew service), with
 * Leave in the control column.
 *
 * As RewardScreen does, the screen holds the live Run (scene-scoped,
 * disposed on swap) and renders the body again after every command it
 * dispatches, so slot indices, sold badges, affordability disables and the
 * cache list are always true. It also renders again on `run:bitsChanged`
 * and `run:cacheChanged`: the cache modal stays usable while docked (view
 * and discard), and a discard there would otherwise leave this screen's
 * sell indices stale, selling the wrong packet.
 *
 * Prices show exactly what the engine charges (the slot's saved price, or
 * the shared price-book helpers), never a re-derivation that could drift.
 * An unaffordable buy shows disabled, not hidden, since seeing what you
 * can't afford is the point of a shop; a sold slot keeps its row with a
 * SOLD badge (the stock flags a sale rather than splicing the slot out).
 */

import { daemonById } from '../config/daemons';
import { t } from '../i18n/ui';
import { packetById } from '../config/packets';
import { PRICES, packetPrice, sellPrice } from '../config/prices';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { Run } from '../run/Run';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { buildUnitCard, unitCardFromTemplate } from './UnitCard';
import { CardListModal } from './CardListModal';
import { Screen } from './Screen';
import { button } from './button';
import { mountControl } from './chip';
import { fadeOutAndRemove } from './fade';

export class PortScreen extends Screen {
  private bodyEl: HTMLDivElement | null = null;
  private unsubscribes: Array<() => void> = [];
  /** Leave port, while the screen is up (a row of the control column). */
  private leaveEl: HTMLButtonElement | null = null;
  // The crew-removal picker (the card-list modal's selectable roster view).
  // One instance per screen, disposed on hide (which closes an open modal).
  private readonly removalPicker: CardListModal;

  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly run: Run,
    private readonly bus: EventBus<GameEvents>,
    /** The control column's second row: where Leave port mounts. */
    private readonly controlSlot: HTMLElement,
  ) {
    super(mount);
    this.removalPicker = new CardListModal(mount, audio);
  }

  show(): void {
    this.hide();
    const panel = document.createElement('div');
    panel.className = 'port-screen';

    const heading = document.createElement('div');
    heading.className = 'port-heading';
    heading.textContent = `$ ${t('port.heading')}`;
    panel.appendChild(heading);

    const subtitle = document.createElement('div');
    subtitle.className = 'port-subtitle';
    subtitle.textContent = t('port.subtitle');
    panel.appendChild(subtitle);

    // In the control column (src/ui/chip.ts), so it survives the scroll:
    // leaving must never take finding the bottom of a long stock list.
    this.leaveEl = button(`${t('port.leave')} ▸`, {
      className: 'chip control-chip',
      onClick: () => {
        this.audio.play('click');
        this.dispatcher.dispatch({ kind: 'leavePort' });
      },
    });
    mountControl(this.controlSlot, this.leaveEl);

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'port-body';
    panel.appendChild(this.bodyEl);
    this.renderBody();

    // Render again when bits or the cache move, from any source (this
    // screen's own buys render through the dispatch path too; a second
    // renderBody on the same state is idempotent and cheap at this scale).
    this.unsubscribes.push(
      this.bus.on('run:bitsChanged', () => this.renderBody()),
      this.bus.on('run:cacheChanged', () => this.renderBody()),
    );

    this.present(panel);
  }

  override hide(): void {
    this.removalPicker.dispose();
    for (const off of this.unsubscribes) off();
    this.unsubscribes = [];
    // Leave is outside the panel, so it fades out beside it.
    if (this.leaveEl !== null) {
      fadeOutAndRemove(this.leaveEl);
      this.leaveEl = null;
    }
    super.hide();
    this.bodyEl = null;
  }

  /** A full render from live state, as RewardScreen's renderPortions is, so
   *  the indices in every button are true after each command. */
  private renderBody(): void {
    if (this.bodyEl === null) return;
    this.bodyEl.replaceChildren();
    const stock = this.run.portStock;
    if (stock === null) return; // undocking: the fading DOM needs nothing

    this.bodyEl.appendChild(this.sectionHeading(t('port.section.units')));
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

    this.bodyEl.appendChild(this.sectionHeading(t('port.section.packets')));
    if (stock.packets.length === 0) this.bodyEl.appendChild(this.emptyLine(t('port.soldOut')));
    stock.packets.forEach((slot, index) => {
      const packet = packetById(slot.packetId);
      this.bodyEl!.appendChild(
        this.stockRow(
          `▤ ${packet?.name ?? slot.packetId}`,
          packet?.description,
          slot.price,
          slot.sold,
          // A full cache takes the swap control: the engine holds the same
          // contract, so a buy with no swap would be a silent no-op anyway.
          !this.run.cacheHasRoom && !slot.sold
            ? this.swapBuyControl(index, slot.price)
            : undefined,
          () => this.transact('pickup', { kind: 'buyPortPacket', index }),
        ),
      );
    });

    this.bodyEl.appendChild(this.sectionHeading(t('port.section.daemons')));
    if (stock.daemons.length === 0) {
      this.bodyEl.appendChild(this.emptyLine(t('port.daemonsOwned')));
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

    this.bodyEl.appendChild(this.sectionHeading(t('port.section.sell')));
    if (this.run.cache.length === 0) {
      this.bodyEl.appendChild(this.emptyLine(t('port.cacheEmpty')));
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
        button(t('port.sell'), {
          className: 'port-buy',
          onClick: () => this.transact('pickup', { kind: 'sellPacket', cacheIndex }),
        }),
      );
      row.appendChild(actions);
      this.bodyEl!.appendChild(row);
    });

    this.bodyEl.appendChild(this.sectionHeading(t('port.section.removal')));
    // One row opens the roster picker: the modal shows the full cards
    // (stats, abilities, XP), since a unit's name and level alone can't
    // tell two units apart; select one, and confirm removes it.
    const removalNote = this.emptyLine(t('port.removalNote', { price: PRICES.unitRemovalPrice }));
    this.bodyEl.appendChild(removalNote);
    const row = document.createElement('div');
    row.className = 'port-row';
    row.appendChild(this.rowBody(`✕ ${t('port.removalRow')}`, undefined));
    const actions = document.createElement('div');
    actions.className = 'port-row__actions';
    actions.appendChild(this.priceTag(PRICES.unitRemovalPrice));
    const choose = button(`${t('port.choose')} ▸`, {
      className: 'port-remove',
      onClick: () => {
        this.audio.play('click');
        this.openRemovalPicker();
      },
    });
    // The engine's silent no-op conditions, surfaced as disables.
    if (this.run.team.length <= 1 || this.run.bits < PRICES.unitRemovalPrice) {
      choose.disabled = true;
    }
    actions.appendChild(choose);
    row.appendChild(actions);
    this.bodyEl.appendChild(row);
  }

  /** The removal picker: the selectable roster view over the live crew
   *  (select one, and confirm dispatches `payToRemoveUnit`). The modal
   *  reports the source index, which is the rosterIndex (`run.team` is
   *  passed unsorted, and the mapping would hold under a sorted display
   *  order too). */
  private openRemovalPicker(): void {
    this.removalPicker.open(t('port.removalTitle'), this.run.team, {
      selection: {
        count: 1,
        confirmText: `${t('port.removalConfirm', { price: PRICES.unitRemovalPrice })} ▸`,
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

  /** A packet or daemon stock row: the title and description on the left;
   *  on the right a SOLD badge, or the price and Buy (or the full cache's
   *  swap control). */
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
      const buy = button(t('common.buy'), { className: 'port-buy', onClick: onBuy });
      if (this.run.bits < price) buy.disabled = true;
      actions.appendChild(buy);
    }
    row.appendChild(actions);
    return row;
  }

  /** The unit slot's footer: a SOLD badge, or the price and Buy (disabled
   *  when the bits fall short). */
  private priceFooter(price: number, sold: boolean, onBuy: () => void): HTMLDivElement {
    const footer = document.createElement('div');
    footer.className = 'port-unit-slot__footer';
    if (sold) {
      footer.appendChild(this.soldBadge());
    } else {
      footer.appendChild(this.priceTag(price));
      const buy = button(t('common.buy'), { className: 'port-buy', onClick: onBuy });
      if (this.run.bits < price) buy.disabled = true;
      footer.appendChild(buy);
    }
    return footer;
  }

  /** RewardScreen's swap: pick a held packet to drop, and the buy carries
   *  `swapCacheIndex`. Rebuilt on every render, so it is always live. */
  private swapBuyControl(stockIndex: number, price: number): HTMLSpanElement {
    const wrap = document.createElement('span');
    wrap.className = 'port-swap';
    const select = document.createElement('select');
    select.className = 'port-swap__select';
    // The select's accessible name. `aria-label`, not a visible `<label>`: a
    // label element would shift the row, and the button beside it already
    // names the action.
    select.setAttribute('aria-label', t('common.swapSelectLabel'));
    this.run.cache.forEach((packetId, slot) => {
      const option = document.createElement('option');
      option.value = String(slot);
      option.textContent = packetById(packetId)?.name ?? packetId;
      select.appendChild(option);
    });
    wrap.appendChild(select);
    const swapIn = button(t('port.swapIn'), {
      className: 'port-buy port-swap__button',
      onClick: () =>
        this.transact('pickup', {
          kind: 'buyPortPacket',
          index: stockIndex,
          swapCacheIndex: Number(select.value),
        }),
    });
    if (this.run.bits < price) swapIn.disabled = true;
    wrap.appendChild(swapIn);
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
}
