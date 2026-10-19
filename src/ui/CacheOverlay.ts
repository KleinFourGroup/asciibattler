/**
 * The cache chip and its modal. The chip is page-lifetime, like the bits
 * chip: Game owns it, and it never rides a scene's mount and dispose. It
 * reads `▤ held/size`, second in the chrome column, under the bits chip.
 *
 * Gotcha #116 applies: `run:cacheChanged` drives the repaints in a run, and
 * `run:started` only shows the chip again, since it fires before Game
 * assigns the new run. Game calls `refresh()` after each assignment
 * (`resetRun`, `confirmCharacter`, `adopt`). A defeat or a victory hides
 * the chip and closes the modal.
 *
 * The modal (the chip's click, on the modal shell, src/ui/modal.ts) opens
 * anywhere: viewing and Discard always, and Fire where the phase allows
 * (`turn-intro` → `preTurn`, `map` → `outOfBattle`, as the engine derives
 * it), so the UI offers only what the engine would take. A target-`none`
 * packet fires from its row; a unit-target packet used out of battle
 * (Overclock) opens a roster picker under its row. A unit-target packet at
 * the gate (Hype, Shield, Cull) fires from the pre-turn screen's own packet
 * row, where its hand cards are, so this modal offers it no Fire there.
 *
 * The forced keep: while `cacheOverflow > 0` (an event gave a packet into a
 * full cache; a daemon that shrank the cache would too, though none ships)
 * the modal opens itself in discard-only mode and can't be dismissed until
 * the overflow is gone. A discard is always offered, so it never locks.
 */

import type { EventBus } from '../core/EventBus';
import { t } from '../i18n/ui';
import { attachTooltip } from './tooltip';
import type { GameEvents } from '../core/events';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { UnitTemplate } from '../sim/Unit';
import { packetById, type PacketConfig, type UseContext } from '../config/packets';
import { glyphForArchetype, nameForArchetype } from '../sim/archetypes';
import type { RunPhase } from '../run/Run';
import { chipPulse } from './chip';
import { openModal, type ModalHandle } from './modal';
import { reserveSlot } from './reserveSlot';

/** The live run state the overlay reads, injected as getters (as the bits
 *  chip's `getBits` is), so a new Run is read without a rewire. */
interface CacheOverlayDeps {
  getCache: () => readonly string[];
  getSize: () => number;
  getOverflow: () => number;
  getPhase: () => RunPhase;
  getRoster: () => readonly UnitTemplate[];
}

export class CacheOverlay {
  /** A real `<button>`, as the map chip is; the `.chip` plate styles it,
   *  and the focus ring and the hover's focus twin cover focus. */
  private readonly el: HTMLButtonElement;
  private readonly value: HTMLSpanElement;
  private readonly pulse: () => void;
  /** The modal shell (src/ui/modal.ts): it owns the overlay, the
   *  header, the ✕, Esc / backdrop (gated by `setDismissable` — the
   *  forced-keep flow) and the focus trap; this class owns the body. */
  private modal: ModalHandle | null = null;
  /** The last overflow count the overflow banner showed while this modal
   *  has been open (0: never shown). The banner is the body's first node,
   *  above every Discard, so the forced keep's last discard would remove it
   *  and pull the list up under the pointer; once shown, it keeps its slot
   *  (reserved, the same text and so the same box) until the modal closes. */
  private heldOverflow = 0;

  constructor(
    /** The page mount, the modal's host (a fixed full-viewport overlay,
     *  which must not sit inside the chrome column's stacking context). */
    private readonly mount: HTMLElement,
    /** The chrome column the chip mounts into (src/ui/chip.ts). */
    chips: HTMLElement,
    bus: EventBus<GameEvents>,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly deps: CacheOverlayDeps,
    /** Start hidden before a run exists, as the bits chip does. */
    startHidden = false,
  ) {
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'chip cache-overlay';
    this.pulse = chipPulse(this.el);
    if (startHidden) this.el.classList.add('is-hidden');
    // The chip's tooltip (a long press on touch; the tap opens the modal).
    attachTooltip(this.el, t('cache.chipTooltip'), { touch: 'press' });
    this.value = document.createElement('span');
    this.value.className = 'cache-overlay__value';
    const label = document.createElement('span');
    label.className = 'cache-overlay__label';
    label.textContent = 'cache';
    this.el.appendChild(this.value);
    this.el.appendChild(label);
    this.el.addEventListener('click', () => {
      this.audio.play('click');
      this.openModal();
    });
    chips.appendChild(this.el);
    this.refresh();

    // Page-lifetime subscriptions — never unsubscribed (the chip lives as
    // long as the bus does).
    bus.on('run:cacheChanged', () => {
      this.paintChip();
      this.pulse();
      // An open modal re-renders in place (a fire or a discard just landed);
      // an overflow (the forced keep) opens it on any screen.
      if (this.modal !== null) this.renderModalContents();
      else if (this.deps.getOverflow() > 0) this.openModal();
    });
    // Shows the chip only; the repaint is Game's `refresh()` (gotcha #116:
    // this event fires before Game assigns the new run).
    bus.on('run:started', () => this.el.classList.remove('is-hidden'));
    bus.on('run:defeated', () => this.hideForRunEnd());
    bus.on('run:victory', () => this.hideForRunEnd());
  }

  /** Show the chip for a run that was loaded, not created: a loaded run
   *  emits no `run:started`, so Game says so itself (`Game.adopt`). */
  reveal(): void {
    this.el.classList.remove('is-hidden');
  }

  /** Hide the chip, and close its modal, for a run that was left, not
   *  ended (Quit to menu): no `run:defeated` or `run:victory` says so. */
  conceal(): void {
    this.hideForRunEnd();
  }

  /** Re-read the live cache: the first paint, and Game's repaint after it
   *  assigns a run. Also closes an open modal, since the cache is now
   *  another run's. */
  refresh(): void {
    this.paintChip();
    this.closeModal();
  }

  private hideForRunEnd(): void {
    this.el.classList.add('is-hidden');
    this.closeModal();
  }

  private paintChip(): void {
    const held = this.deps.getCache().length;
    const size = this.deps.getSize();
    this.value.textContent = `▤ ${held}/${size}`;
    this.el.classList.toggle('is-over', this.deps.getOverflow() > 0);
  }

  /** The engine's phase-to-context rule (`Run.handleUsePacket`), mirrored,
   *  so the UI offers only what `usePacket` would take. */
  private currentContext(): UseContext | null {
    const phase = this.deps.getPhase();
    return phase === 'turn-intro' ? 'preTurn' : phase === 'map' ? 'outOfBattle' : null;
  }

  // ── the modal ──────────────────────────────────────────────────────────

  private openModal(): void {
    if (this.modal !== null) return; // idempotent
    this.heldOverflow = 0;
    this.modal = openModal(this.mount, {
      panelClass: 'cache-modal',
      onCloseClick: () => this.audio.play('click'),
      onClose: () => {
        this.modal = null;
      },
    });
    this.renderModalContents();
  }

  private closeModal(): void {
    this.modal?.close(); // the shell's onClose nulls the handle
  }

  /** Build the modal's body from live state, at open and after every
   *  `run:cacheChanged` while open, so a fire, a discard or an overflow
   *  shows with no optimistic local copy. The shell keeps the header: the
   *  title is read again, and the ✕, Esc and the backdrop wait on the
   *  overflow. */
  private renderModalContents(): void {
    const modal = this.modal;
    if (modal === null) return;

    const cache = this.deps.getCache();
    const size = this.deps.getSize();
    const overflow = this.deps.getOverflow();

    modal.setTitle(t('cache.title', { held: cache.length, size }));
    // The forced keep: while the cache holds more packets than slots, the
    // modal can't be dismissed until the player discards down to its size.
    modal.setDismissable(overflow === 0);

    const body: Node[] = [];
    if (overflow > 0) this.heldOverflow = overflow;
    if (this.heldOverflow > 0) {
      const banner = document.createElement('div');
      banner.className = 'cache-shrink-banner';
      banner.textContent = `⚠ ${t('cache.overflow', { count: this.heldOverflow })}`;
      if (overflow === 0) reserveSlot(banner);
      body.push(banner);
    }

    const list = document.createElement('div');
    list.className = 'cache-list';
    if (cache.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'roster-empty';
      empty.textContent = t('cache.empty');
      list.appendChild(empty);
    } else {
      cache.forEach((id, index) => {
        // The cache holds only catalog ids (`addPacket` and a load both
        // throw on another), so a miss can't happen; it is skipped anyway.
        const packet = packetById(id);
        if (packet !== undefined) list.appendChild(this.renderRow(packet, index, overflow > 0));
      });
    }
    body.push(list);
    modal.replaceBody(...body);
  }

  /** One held slot: its name, its description and its actions. During the
   *  forced keep the row offers Discard only. */
  private renderRow(packet: PacketConfig, cacheIndex: number, shrinkMode: boolean): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'cache-row';

    const text = document.createElement('div');
    text.className = 'cache-row-text';
    const name = document.createElement('div');
    name.className = 'cache-row-name';
    name.textContent = `▤ ${packet.name}`;
    const desc = document.createElement('div');
    desc.className = 'cache-row-desc';
    desc.textContent = packet.description;
    text.append(name, desc);
    row.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'cache-row-actions';

    const context = this.currentContext();
    const fireable =
      !shrinkMode &&
      context !== null &&
      packet.usableIn.includes(context) &&
      // A unit-target fire at the gate targets a hand card, so it arms from
      // the pre-turn screen's packet row, where the cards are; this row
      // offers it no Fire there.
      (packet.target === 'none' || context === 'outOfBattle');
    if (fireable) {
      const fire = document.createElement('button');
      fire.type = 'button';
      fire.className = 'cache-fire-button';
      fire.textContent = t('cache.fire');
      fire.addEventListener('click', () => {
        this.audio.play('click');
        if (packet.target === 'none') {
          // Used up on the fire: the result comes back through
          // `run:cacheChanged` and `run:packetUsed`, with no optimistic update.
          this.dispatcher.dispatch({ kind: 'usePacket', cacheIndex });
        } else {
          this.toggleRosterPicker(row, cacheIndex);
        }
      });
      actions.appendChild(fire);
    }

    const discard = document.createElement('button');
    discard.type = 'button';
    discard.className = 'cache-discard-button';
    discard.textContent = t('cache.discard');
    discard.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'discardPacket', cacheIndex });
    });
    actions.appendChild(discard);

    row.appendChild(actions);
    return row;
  }

  /** The roster picker for a unit-target fire out of battle (Overclock: the
   *  roster unit to buff for the next encounter). It opens under the row,
   *  and a second Fire click closes it. */
  private toggleRosterPicker(row: HTMLDivElement, cacheIndex: number): void {
    const existing = row.querySelector('.cache-roster-pick');
    if (existing !== null) {
      existing.remove();
      return;
    }
    const pick = document.createElement('div');
    pick.className = 'cache-roster-pick';
    const hint = document.createElement('div');
    hint.className = 'cache-roster-pick-hint';
    hint.textContent = t('cache.pickRosterUnit');
    pick.appendChild(hint);
    this.deps.getRoster().forEach((unit, rosterIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cache-roster-pick-unit';
      // The archetype's display name, not its id.
      button.textContent = `${glyphForArchetype(unit.archetype)} ${nameForArchetype(unit.archetype)} — Lv ${unit.level}`;
      button.addEventListener('click', () => {
        this.audio.play('click');
        this.dispatcher.dispatch({ kind: 'usePacket', cacheIndex, rosterIndex });
      });
      pick.appendChild(button);
    });
    row.appendChild(pick);
  }
}
