/**
 * The reward screen. Shown when a turn boundary that did not lose the run
 * yields a non-empty offer (the `reward` run phase): after a turn the gate
 * chain is the reward, then the promotion, then the next turn or the
 * encounter's end, so a bits tally or a camp's loot can raise it between
 * two turns. Each portion is a row: Accept settles it (bits through
 * `Run.gainBits`; a daemon joins ownership at once). One Continue ▸ under
 * the rows declines every remaining portion, so walking away takes one
 * click (the engine's decline command, looped; the engine still declines
 * portion by portion). Resolving the last portion advances the run: the
 * event that follows (`promotion:pending`, `turn:starting`,
 * `recruit:offered`, `sector:cleared`, `run:victory`) swaps this scene out,
 * so the screen never dismisses itself.
 *
 * Bits rows never show the rolled base: they render
 * `run.effectiveBits(base)`, the code path the settle uses, read again from
 * live state after every resolution. So accepting a bits-fold daemon
 * (Moneta) from a mixed offer re-prices the remaining bits rows on the spot.
 *
 * An accepted row stays in place, dimmed and marked taken, until the screen
 * leaves. The engine splices a resolved portion out of
 * `run.pendingRewards`, and on this centered column a vanished row
 * re-centered the panel and moved every Accept below it under the pointer.
 * So the screen keeps a ledger of the offer as first shown; the live offer
 * is always the ledger's untaken rows, in order, which is what maps a row
 * back onto its engine index.
 *
 * The ledger FOLLOWS the live offer, whoever resolved a portion: a row whose
 * portion has left `run.pendingRewards` is marked taken at the next render,
 * and the scene asks every frame whether one has (`follow`). A journal
 * replayed through the dispatcher never goes through this screen's click
 * handler, and its rows have to tick off all the same.
 */

import { daemonById } from '../config/daemons';
import { t } from '../i18n/ui';
import { packetById } from '../config/packets';
import { glyphForArchetype, nameForArchetype } from '../sim/archetypes';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { Run } from '../run/Run';
import type { RewardPortion } from '../run/rewards';
import { Screen } from './Screen';
import { button } from './button';

/** One row of the offer as shown. `settledBits` freezes a taken bits row at
 *  the amount it paid (the live rows keep re-pricing). */
interface LedgerRow {
  readonly portion: RewardPortion;
  taken: boolean;
  settledBits: number | null;
}

export class RewardScreen extends Screen {
  private portionsEl: HTMLDivElement | null = null;
  private ledger: LedgerRow[] = [];

  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    // Scene-scoped like the screen itself (disposed on swap), so holding the
    // live Run is safe: reads always reflect the current offer and folds.
    private readonly run: Run,
  ) {
    super(mount);
  }

  show(): void {
    this.hide();
    const panel = document.createElement('div');
    panel.className = 'reward-screen';

    const heading = document.createElement('div');
    heading.className = 'reward-heading';
    heading.textContent = t('reward.heading');
    panel.appendChild(heading);

    this.portionsEl = document.createElement('div');
    this.portionsEl.className = 'reward-portions';
    panel.appendChild(this.portionsEl);
    this.ledger = [];
    this.renderPortions();

    // The one exit: Continue declines every remaining portion (accept what
    // you want, then walk away in one click instead of one a row).
    const cont = button(`${t('common.continue')} ▸`, {
      className: 'btn--primary',
      tooltip: t('reward.continueTitle'),
      onClick: () => this.continueRun(),
    });
    panel.appendChild(cont);

    this.present(panel);
  }

  override hide(): void {
    super.hide();
    this.portionsEl = null;
  }

  /** Re-render if a portion was resolved since the last render (the scene
   *  calls this every frame; with nothing resolved it does nothing). */
  follow(): void {
    if (this.portionsEl === null) return;
    const live = this.run.pendingRewards ?? [];
    if (this.ledger.some((r) => !r.taken && !live.includes(r.portion))) this.renderPortions();
  }

  /**
   * Render the rows from the ledger over the live offer. A pending row's
   * engine index is its position among the untaken rows (the offer shrinks
   * as portions resolve; `resolve` computes it again at click time), so a
   * full render after each command keeps every button true. The cache's
   * state is read here too, so accepting or swapping a packet moves the
   * `n/size` line and flips later packet rows between the plain Accept and
   * the swap control.
   */
  private renderPortions(): void {
    if (this.portionsEl === null) return;
    this.portionsEl.replaceChildren();
    this.syncLedger();

    // The live cache line, rendered only for an offer that carries a packet:
    // an offer with none has no cache decision to inform. Keyed on the
    // ledger, so the line holds its slot after the last packet resolves.
    if (this.ledger.some((r) => r.portion.kind === 'packet')) {
      const cacheLine = document.createElement('div');
      cacheLine.className = 'reward-cache-line';
      // ▤ is the cache mark, as on the cache chip.
      cacheLine.textContent = `▤ cache ${this.run.cache.length}/${this.run.effectiveCacheSize}`;
      this.portionsEl.appendChild(cacheLine);
    }

    this.ledger.forEach((entry, ledgerIndex) => {
      const portion = entry.portion;
      const row = document.createElement('div');
      row.className = entry.taken ? 'reward-portion is-taken' : 'reward-portion';

      const body = document.createElement('div');
      body.className = 'reward-portion__body';
      if (portion.kind === 'bits') {
        const title = document.createElement('div');
        title.className = 'reward-portion__title';
        // A battle-tally portion names its earner ("◈ Idol of Laverna — N
        // bits"). The earner can be a packet's injected rule too (no shipped
        // packet injects one), so the name is looked up in both catalogs, as
        // `Run.grantViews` names a source, with the matching mark (◈ a
        // daemon, ▤ a packet); a miss in both shows the raw id.
        let source = '';
        if (portion.source !== undefined) {
          const daemon = daemonById(portion.source);
          const packet = daemon === undefined ? packetById(portion.source) : undefined;
          const mark = packet !== undefined ? '▤' : '◈';
          source = `${mark} ${daemon?.name ?? packet?.name ?? portion.source} — `;
        }
        const bits = entry.settledBits ?? this.run.effectiveBits(portion.base);
        title.textContent = `${source}${bits} bits`;
        body.appendChild(title);
      } else if (portion.kind === 'daemon') {
        const daemon = daemonById(portion.daemonId);
        const title = document.createElement('div');
        title.className = 'reward-portion__title';
        // ◈ is the daemon mark, as on the pre-turn screen.
        title.textContent = `◈ ${daemon?.name ?? portion.daemonId}`;
        body.appendChild(title);
        if (daemon !== undefined) {
          const desc = document.createElement('div');
          desc.className = 'reward-portion__desc';
          desc.textContent = daemon.description;
          body.appendChild(desc);
        }
      } else if (portion.kind === 'unit') {
        // A roster grant: the portion carries the template rolled with the
        // offer, as a port's stock does, so the row shows the real recruit's
        // glyph, name and level.
        const title = document.createElement('div');
        title.className = 'reward-portion__title';
        const glyph = glyphForArchetype(portion.template.archetype);
        title.textContent = `${glyph} ${t('reward.unitTitle', {
          name: nameForArchetype(portion.template.archetype),
          level: portion.template.level,
        })}`;
        body.appendChild(title);
        const desc = document.createElement('div');
        desc.className = 'reward-portion__desc';
        desc.textContent = t('reward.joinsRoster');
        body.appendChild(desc);
      } else if (portion.kind === 'poolHealth') {
        // A flat pool heal: the row shows the authored amount, and the
        // settle caps the pool at its maximum.
        const title = document.createElement('div');
        title.className = 'reward-portion__title';
        title.textContent = `+${portion.amount} morale`;
        body.appendChild(title);
      } else {
        // A packet portion, looked up for display; the boot checks the
        // tables' packet ids, so the fallback never renders for them.
        const packet = packetById(portion.packetId);
        const title = document.createElement('div');
        title.className = 'reward-portion__title';
        title.textContent = `▤ ${packet?.name ?? portion.packetId}`;
        body.appendChild(title);
        if (packet !== undefined) {
          const desc = document.createElement('div');
          desc.className = 'reward-portion__desc';
          desc.textContent = packet.description;
          body.appendChild(desc);
        }
      }
      row.appendChild(body);

      const actions = document.createElement('div');
      actions.className = 'reward-portion__actions';
      if (entry.taken) {
        // The badge wears the Accept button's box (ui.css), so the row's
        // height can't change across its own click.
        const taken = document.createElement('div');
        taken.className = 'reward-taken';
        taken.textContent = t('reward.taken');
        actions.appendChild(taken);
      } else if (portion.kind === 'packet' && !this.run.cacheHasRoom) {
        // The swap control: pick a held packet to drop, and Swap dispatches
        // the accept with the slot (the engine holds the same contract; an
        // accept with no swap would be a no-op). Skipping it is Continue's
        // job.
        actions.appendChild(this.swapControl(ledgerIndex));
      } else {
        actions.appendChild(
          button(t('reward.accept'), {
            className: 'reward-accept',
            onClick: () => this.resolve(ledgerIndex),
          }),
        );
      }
      row.appendChild(actions);

      this.portionsEl!.appendChild(row);
    });
  }

  /** The full cache's swap picker: a select over the held packets (by slot)
   *  and a Swap button carrying the chosen `swapCacheIndex`. Rebuilt on
   *  every render, so the slot list is always the live cache. */
  private swapControl(ledgerIndex: number): HTMLSpanElement {
    const wrap = document.createElement('span');
    wrap.className = 'reward-swap';

    const select = document.createElement('select');
    select.className = 'reward-swap__select';
    // The accessible name (see PortScreen.swapBuyControl: aria-label, not a
    // visible label, so the row doesn't shift).
    select.setAttribute('aria-label', t('common.swapSelectLabel'));
    this.run.cache.forEach((packetId, slot) => {
      const option = document.createElement('option');
      option.value = String(slot);
      option.textContent = packetById(packetId)?.name ?? packetId;
      select.appendChild(option);
    });
    wrap.appendChild(select);

    wrap.appendChild(
      button(t('reward.swap'), {
        className: 'reward-accept reward-swap__button',
        onClick: () => this.resolve(ledgerIndex, Number(select.value)),
      }),
    );
    return wrap;
  }

  /**
   * The ledger follows the live offer. A row whose portion has left
   * `run.pendingRewards` was resolved (by this screen's click or by a command
   * sent from elsewhere), so it is taken; a bits row then freezes at what the
   * live folds pay now, which is what it paid when this runs in the frame it
   * was accepted. (A declined row would read the same; a decline comes only
   * from Continue, which resolves the whole offer and swaps the scene.)
   * After that its untaken rows must be the live offer, in order (the same
   * objects). On the first render, or any mismatch, the ledger is rebuilt
   * from the live offer, never left with a row whose button points at the
   * wrong portion.
   */
  private syncLedger(): void {
    const live = this.run.pendingRewards ?? [];
    for (const row of this.ledger) {
      if (row.taken || live.includes(row.portion)) continue;
      row.taken = true;
      row.settledBits = row.portion.kind === 'bits' ? this.run.effectiveBits(row.portion.base) : null;
    }
    const pending = this.ledger.filter((r) => !r.taken);
    if (pending.length === live.length && pending.every((r, i) => r.portion === live[i])) return;
    this.ledger = live.map((portion) => ({ portion, taken: false, settledBits: null }));
  }

  /** Accept one ledger row (with the full cache's swap slot, when given).
   *  The row is marked taken only if the offer shrank: the engine's silent
   *  no-ops (an accept with no swap on a full cache) leave it pending. */
  private resolve(ledgerIndex: number, swapCacheIndex?: number): void {
    const entry = this.ledger[ledgerIndex];
    if (entry === undefined || entry.taken) return;
    const index = this.ledger.slice(0, ledgerIndex).filter((r) => !r.taken).length;
    const before = this.run.pendingRewards?.length ?? 0;
    const settledBits =
      entry.portion.kind === 'bits' ? this.run.effectiveBits(entry.portion.base) : null;
    this.audio.play('pickup');
    this.dispatcher.dispatch(
      swapCacheIndex === undefined
        ? { kind: 'acceptReward', index }
        : { kind: 'acceptReward', index, swapCacheIndex },
    );
    if ((this.run.pendingRewards?.length ?? 0) < before) {
      entry.taken = true;
      entry.settledBits = settledBits;
    }
    // Resolving the last portion advances the run synchronously inside the
    // dispatch: Game swaps the scene and `hide()` has already nulled the
    // mount points, which makes this render a no-op on the fading DOM.
    this.renderPortions();
  }

  /** Decline every remaining portion, front to back. Resolving the last one
   *  advances the run synchronously (the scene swap hides the screen). The
   *  shrink guard breaks on a silent no-op, never expected while the phase
   *  is 'reward', against an infinite loop. */
  private continueRun(): void {
    this.audio.play('click');
    let remaining = this.run.pendingRewards?.length ?? 0;
    while (this.run.phase === 'reward' && remaining > 0) {
      this.dispatcher.dispatch({ kind: 'declineReward', index: 0 });
      const next = this.run.pendingRewards?.length ?? 0;
      if (next >= remaining) break;
      remaining = next;
    }
  }
}
