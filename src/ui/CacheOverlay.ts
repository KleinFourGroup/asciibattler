/**
 * 49f — the persistent cache chip + modal: the SECOND page-lifetime UI
 * element (the 48d BitsOverlay precedent — Game-owned, appended once to
 * #ui, never rides the scene mount/dispose cycle). The chip (`▤ n/6`)
 * stacks BELOW the bits chip (the in-battle hop chip owns the slot to the
 * bits chip's right — a left-column of persistent chrome never collides;
 * §51's cohesion review owns refinements, per the .hud-hop note).
 *
 * Gotcha #116 applies verbatim: `run:cacheChanged` drives mid-run repaints;
 * `run:started` is a re-SHOW signal only (it fires from inside the new
 * Run's constructor, before Game reassigns `this.run`, so a repaint would
 * read the DEAD run); `Game.resetRun` calls `refresh()` explicitly after
 * the reassignment; defeat/victory hide the chip (and close the modal).
 *
 * The modal (the chip's click target — the R1 roster-modal shell) opens
 * ANYWHERE: view + Discard always; **Fire** where the phase-derived context
 * allows (`turn-intro` → preTurn, `map` → outOfBattle — the 49e engine
 * contract; the UI derives the same way and only offers what the engine
 * would accept). Target-`none` packets fire straight from their row; a
 * unit-target OUT-OF-BATTLE packet (overclock) expands an inline roster
 * picker. A unit-target PRE-TURN packet (hype) shows no Fire here yet —
 * its pick-a-card targeting lands with the guided strip (49f commit 2).
 *
 * The forced-keep shrink flow lives here too: while `cacheOverflow > 0`
 * (a size-shrinking daemon landed under current holdings) the modal
 * FORCE-OPENS in discard-only mode and can't be dismissed until the
 * overflow resolves — discards are always available, so no soft-lock.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { UnitTemplate } from '../sim/Unit';
import { packetById, type PacketConfig, type UseContext } from '../config/packets';
import { glyphForArchetype } from '../sim/archetypes';
import type { RunPhase } from '../run/Run';

/** How long the value-change pulse glows (matches the bits chip). */
const PULSE_MS = 450;

/** The live run state the overlay reads — injected as getters (the
 *  BitsOverlay `getBits` pattern), so a Run swap on reset is invisible. */
export interface CacheOverlayDeps {
  getCache: () => readonly string[];
  getSize: () => number;
  getOverflow: () => number;
  getPhase: () => RunPhase;
  getRoster: () => readonly UnitTemplate[];
}

export class CacheOverlay {
  private readonly el: HTMLDivElement;
  private readonly value: HTMLSpanElement;
  private pulseTimer: number | null = null;
  private modalOverlay: HTMLDivElement | null = null;
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.deps.getOverflow() === 0) this.closeModal();
  };

  constructor(
    private readonly mount: HTMLElement,
    bus: EventBus<GameEvents>,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly deps: CacheOverlayDeps,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'cache-overlay';
    this.el.title = 'The cache — your held packets';
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
    mount.appendChild(this.el);
    this.refresh();

    // Page-lifetime subscriptions — never unsubscribed (the chip lives as
    // long as the bus does).
    bus.on('run:cacheChanged', () => {
      this.paintChip();
      this.pulse();
      // A held modal re-renders in place (a fire/discard just landed); an
      // overflow (the forced-keep shrink) force-opens it on ANY screen.
      if (this.modalOverlay !== null) this.renderModalContents();
      else if (this.deps.getOverflow() > 0) this.openModal();
    });
    // Re-SHOW only — the reset re-paint comes from Game.resetRun via
    // refresh() (gotcha #116: this event fires before Game's run reference
    // is reassigned).
    bus.on('run:started', () => this.el.classList.remove('is-hidden'));
    bus.on('run:defeated', () => this.hideForRunEnd());
    bus.on('run:victory', () => this.hideForRunEnd());
  }

  /** Re-read the live cache (the first paint + Game.resetRun's re-paint).
   *  Also closes any open modal — a reset's cache is a different run's. */
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

  private pulse(): void {
    if (this.pulseTimer !== null) window.clearTimeout(this.pulseTimer);
    this.el.classList.add('is-pulsing');
    this.pulseTimer = window.setTimeout(() => {
      this.el.classList.remove('is-pulsing');
      this.pulseTimer = null;
    }, PULSE_MS);
  }

  /** The 49e engine's phase→context derivation, mirrored for availability
   *  (the UI offers only what `usePacket` would accept). */
  private currentContext(): UseContext | null {
    const phase = this.deps.getPhase();
    return phase === 'turn-intro' ? 'preTurn' : phase === 'map' ? 'outOfBattle' : null;
  }

  // ── the modal ──────────────────────────────────────────────────────────

  private openModal(): void {
    if (this.modalOverlay !== null) return; // idempotent
    const overlay = document.createElement('div');
    overlay.className = 'roster-overlay';
    overlay.addEventListener('click', (e) => {
      // Backdrop click dismisses — except mid-shrink (forced-keep).
      if (e.target === overlay && this.deps.getOverflow() === 0) this.closeModal();
    });
    this.modalOverlay = overlay;
    this.mount.appendChild(overlay);
    window.addEventListener('keydown', this.onKeyDown);
    this.renderModalContents();
  }

  private closeModal(): void {
    if (this.modalOverlay === null) return;
    window.removeEventListener('keydown', this.onKeyDown);
    this.modalOverlay.remove();
    this.modalOverlay = null;
  }

  /** (Re)build the modal panel from live state — run at open and after
   *  every `run:cacheChanged` while open, so a fire/discard/shrink is
   *  reflected without an optimistic local copy (the K3 events-only
   *  discipline, applied to a modal). */
  private renderModalContents(): void {
    const overlay = this.modalOverlay;
    if (overlay === null) return;
    overlay.replaceChildren();

    const cache = this.deps.getCache();
    const size = this.deps.getSize();
    const overflow = this.deps.getOverflow();

    const modal = document.createElement('div');
    modal.className = 'roster-modal cache-modal';

    const header = document.createElement('div');
    header.className = 'roster-modal-header';
    const title = document.createElement('div');
    title.className = 'roster-modal-title';
    title.textContent = `Cache — ${cache.length}/${size}`;
    header.appendChild(title);
    if (overflow === 0) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'roster-modal-close';
      close.textContent = '✕';
      close.setAttribute('aria-label', 'Close');
      close.addEventListener('click', () => {
        this.audio.play('click');
        this.closeModal();
      });
      header.appendChild(close);
    }
    modal.appendChild(header);

    // The forced-keep banner: a shrink left more packets than slots — the
    // modal is un-dismissable until the player discards down to capacity.
    if (overflow > 0) {
      const banner = document.createElement('div');
      banner.className = 'cache-shrink-banner';
      banner.textContent =
        `⚠ over capacity — discard ${overflow} packet${overflow === 1 ? '' : 's'} to continue`;
      modal.appendChild(banner);
    }

    const list = document.createElement('div');
    list.className = 'cache-list';
    if (cache.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'roster-empty';
      empty.textContent = 'The cache is empty — packets arrive as battle rewards.';
      list.appendChild(empty);
    } else {
      cache.forEach((id, index) => {
        // The cache holds catalog-validated ids (the 49b addPacket / load
        // contract) — a miss is unreachable, skipped defensively.
        const packet = packetById(id);
        if (packet !== undefined) list.appendChild(this.renderRow(packet, index, overflow > 0));
      });
    }
    modal.appendChild(list);
    overlay.appendChild(modal);
  }

  /** One held slot: name + description + its actions. Mid-shrink the row is
   *  discard-only (the forced-keep flow). */
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
      // A unit-target PRE-TURN fire (hype) targets a hand card — that
      // arming flow belongs to the guided strip (49f commit 2); until it
      // lands, the row simply offers no Fire at the gate.
      (packet.target === 'none' || context === 'outOfBattle');
    if (fireable) {
      const fire = document.createElement('button');
      fire.type = 'button';
      fire.className = 'cache-fire-button';
      fire.textContent = 'Fire ▸';
      fire.addEventListener('click', () => {
        this.audio.play('click');
        if (packet.target === 'none') {
          // Consume-on-fire: the result comes back via run:cacheChanged /
          // run:packetUsed (no optimistic update).
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
    discard.textContent = 'Discard';
    discard.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'discardPacket', cacheIndex });
    });
    actions.appendChild(discard);

    row.appendChild(actions);
    return row;
  }

  /** The inline roster picker for a unit-target OUT-OF-BATTLE fire
   *  (overclock: "pick the roster unit to buff for the next encounter").
   *  Expands under the row; a second Fire click collapses it. */
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
    hint.textContent = 'pick a roster unit:';
    pick.appendChild(hint);
    this.deps.getRoster().forEach((unit, rosterIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cache-roster-pick-unit';
      button.textContent = `${glyphForArchetype(unit.archetype)} ${unit.archetype} — Lv ${unit.level}`;
      button.addEventListener('click', () => {
        this.audio.play('click');
        this.dispatcher.dispatch({ kind: 'usePacket', cacheIndex, rosterIndex });
      });
      pick.appendChild(button);
    });
    row.appendChild(pick);
  }
}
