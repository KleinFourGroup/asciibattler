/**
 * 48c — the reward screen. Shown when a turn boundary yields a non-empty
 * offer (the `reward` run phase — battle → rewards → promotion → recruit,
 * the shape-locked ordering; since 51a a battle-tally portion can raise it
 * MID-ENCOUNTER too). Each portion is a row: Accept settles it (bits
 * through `Run.gainBits`; a daemon joins ownership immediately). 51b — the
 * per-row Decline retired (the §51 click-burden call): one **Continue ▸**
 * under the rows declines every remaining portion (the engine command,
 * looped — declinable-per-portion is preserved at the engine level).
 * Resolving the last portion advances the run — the follow-on event
 * (promotion:pending / recruit:offered / turn:starting / run:victory) swaps
 * this scene out, so the screen never dismisses itself.
 *
 * Display honesty (the shape-lock rider, worklog §48): bits rows never show
 * the rolled base — they render `run.effectiveBits(base)`, the SAME code
 * path the settle uses, re-read from live state after every resolution. So
 * accepting a bits-fold daemon (Moneta) from a mixed offer visibly re-prices
 * the remaining bits rows on the spot — derive-don't-cache doing
 * player-facing work.
 *
 * 101e — layout stability: an ACCEPTED row STAYS in place, dimmed and marked
 * taken, until the screen leaves (user-signed at the §101 kickoff). The
 * engine splices a resolved portion out of `run.pendingRewards`, and on this
 * centered column a vanished row re-centered the panel — every Accept below
 * it jumped 38 px under the pointer. So the screen keeps a LEDGER of the
 * offer as first shown; the live offer is always the ledger's un-taken rows,
 * in order, which is what maps a row back onto its engine index.
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

/** 101e — one row of the offer AS SHOWN. `settledBits` freezes a taken bits
 *  row at the amount it actually paid (the live rows keep re-pricing). */
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
    // live Run is safe — reads always reflect the current offer + folds.
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

    // 51b — the single exit: Continue declines every remaining portion
    // (accept what you want, walk away in one click instead of N).
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

  /**
   * (Re)render the rows from the ledger over the LIVE offer. A pending
   * row's engine index is its position among the un-taken rows (the offer
   * shrinks as portions resolve; `resolve` recomputes it at click time), so
   * a full re-render after each command keeps every button true.
   * 49c: cache state re-derives here too, so accepting/swapping a packet
   * visibly moves the `n/size` line and flips later packet rows between the
   * plain Accept and the swap control.
   */
  private renderPortions(): void {
    if (this.portionsEl === null) return;
    this.portionsEl.replaceChildren();
    this.syncLedger();

    // 49c — the live cache line (spec §Cache: "the reward screen shows
    // cache state"), rendered only for an offer that carries a packet — a
    // bits/daemon-only offer has no cache decision to inform. 101e: keyed on
    // the LEDGER, so the line holds its slot after the last packet resolves.
    if (this.ledger.some((r) => r.portion.kind === 'packet')) {
      const cacheLine = document.createElement('div');
      cacheLine.className = 'reward-cache-line';
      // ▤ is the cache mark (the coming 49f chip vocabulary).
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
        // 51a — a battle-tally portion names its earner ("◈ Idol of Laverna
        // — N bits", the labeled-row shape-lock). 51f — the earner can be a
        // packet-injected rule too (no shipped instance since 88c daemonized
        // miner): resolve through both catalogs with the matching mark
        // (◈ daemon / ▤ packet — the grantViews fallback chain); a miss on
        // both falls back to the raw id.
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
        // ◈ is the daemon mark (the PreTurnScreen banner vocabulary).
        title.textContent = `◈ ${daemon?.name ?? portion.daemonId}`;
        body.appendChild(title);
        if (daemon !== undefined) {
          const desc = document.createElement('div');
          desc.className = 'reward-portion__desc';
          desc.textContent = daemon.description;
          body.appendChild(desc);
        }
      } else if (portion.kind === 'unit') {
        // 74c — a roster grant: the portion carries the ROLLED template
        // (offer-time roll, the port-stock shape), so the row shows the
        // real recruit — glyph, name, level.
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
        // 74c — a flat pool heal (display the authored amount; the settle
        // clamps at max — the rest-node discipline).
        const title = document.createElement('div');
        title.className = 'reward-portion__title';
        title.textContent = `+${portion.amount} morale`;
        body.appendChild(title);
      } else {
        // 49c — a packet portion (def-resolved for display; the id is
        // boot-asserted, so the fallback never renders for authored tables).
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
        // 101e — the badge wears the Accept button's box (ui.css), so the
        // row's height cannot change across its own click.
        const taken = document.createElement('div');
        taken.className = 'reward-taken';
        taken.textContent = t('reward.taken');
        actions.appendChild(taken);
      } else if (portion.kind === 'packet' && !this.run.cacheHasRoom) {
        // 49c — the decline-or-swap control: pick a held packet to drop,
        // then Swap dispatches the accept WITH the slot (the engine
        // enforces the same contract — a swap-less accept would no-op).
        // 51b: skipping it is Continue's job now (declines ride the exit).
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

  /** 49c — the full-cache swap picker: a select over the HELD packets (by
   *  slot) + a Swap button carrying the chosen `swapCacheIndex`. Rebuilt on
   *  every re-render, so the slot list is always the live cache. */
  private swapControl(ledgerIndex: number): HTMLSpanElement {
    const wrap = document.createElement('span');
    wrap.className = 'reward-swap';

    const select = document.createElement('select');
    select.className = 'reward-swap__select';
    // 100d — the accessible name (see PortScreen.swapBuyControl: aria-label,
    // not a visible label — the row must not shift).
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
   * 101e — the ledger follows the live offer. Its un-taken rows must BE
   * `run.pendingRewards`, in order (same objects — nothing but this screen's
   * own commands resolves a portion while it is up). First render, or any
   * mismatch: rebuild from the live offer — the pre-101e behavior, never a
   * row whose button points at the wrong portion.
   */
  private syncLedger(): void {
    const live = this.run.pendingRewards ?? [];
    const pending = this.ledger.filter((r) => !r.taken);
    if (pending.length === live.length && pending.every((r, i) => r.portion === live[i])) return;
    this.ledger = live.map((portion) => ({ portion, taken: false, settledBits: null }));
  }

  /** Accept one ledger row (with the full-cache swap slot, when given). The
   *  row is marked taken only if the offer actually shrank — the engine's
   *  silent no-ops (a swap-less accept on a full cache) leave it pending. */
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
    // Resolving the LAST portion advances the run synchronously inside the
    // dispatch — Game swaps the scene and `hide()` has already nulled the
    // mount points, making this re-render a no-op on the fading DOM.
    this.renderPortions();
  }

  /** 51b — decline every remaining portion front-to-back. Resolving the
   *  last one advances the run synchronously (the scene swap hides us).
   *  The shrink guard breaks on a silent no-op — never expected while the
   *  phase is 'reward', belt over suspenders against an infinite loop. */
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
