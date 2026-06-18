/**
 * H4b — the pre-turn screen. Shown before each turn's tactical battle (on
 * `turn:starting`), it names the turn + shows both health pools and the drawn
 * hand, then waits for the player's "Fight ▸" click. (H4b shipped a 2s
 * auto-advance; K3 REMOVED it — the user's call — because the redraw decision
 * below shouldn't race a timer. M3 then removed the post-turn timer too.)
 *
 * H5b — the placeholder hint became the real **drawn hand**: a row of compact
 * cards (glyph + level) for the units the deck dealt this turn (the
 * `turn:starting.hand` payload).
 *
 * K3 — the hand is interactive while the turn's redraw budget allows: click
 * cards to select them, then **Redraw** sends the selection to the discard and
 * draws replacements into the same positions (the `redrawCards` command;
 * budget knobs in `config/deck.json`). The screen re-renders PURELY off the
 * `turn:handRedrawn` event (forwarded by PreTurnScene), so the displayed hand
 * is always the Run's authoritative one — never an optimistic local copy.
 *
 * K4 — **Empower** shares the same card selection: with EXACTLY ONE card
 * selected, the Empower button buffs it for the rest of the encounter (the
 * `empowerUnit` command). Empowered cards carry a `▲` badge (one per stack —
 * the `empowerMagnitudes` column the events deliver, so a card empowered on
 * an earlier turn and drawn back still badges). Same events-only refresh:
 * `turn:unitEmpowered` → `updateEmpower`.
 *
 * L1 — the gates are DAEMON-owned now: a banner under the map line names the
 * run's idol, the empower hint/badge derive from the ACTIVE daemon's buff
 * (payload-carried — the retired `EMPOWER` singleton ships disabled), and a
 * chance gate that denied this turn (Mercury's cold coin) renders an inert
 * "the idol is silent" line where its control would be — distinguishable from
 * "spent" (no line) because gate-denial is computed ONCE from the fresh
 * `turn:starting` budget.
 */

import type { GameEvents } from '../core/events';
import type { UnitTemplate, UnitStats } from '../sim/Unit';
import type { RedrawAvailability } from '../run/redraw';
import type { EmpowerAvailability } from '../run/empower';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { StatusEffect } from '../sim/statusEffects';
import { getLayout, PROCEDURAL_MAP_NAME } from '../sim/layouts';
import { STAT_LABELS } from './statLabels';
import { fadeIn, fadeOutAndRemove } from './fade';
import { renderPoolGauge } from './poolGauge';
import { buildUnitCard, unitCardFromTemplate } from './UnitCard';
import { CardListButton } from './CardListModal';

export class PreTurnScreen {
  private container: HTMLDivElement | null = null;
  // K3 — the live hand + redraw budget (swapped by `updateHand`), the selected
  // hand POSITIONS, and the DOM bits `refreshHand` rebuilds in place.
  // K4 — plus the empower budget + per-card stack column (`updateEmpower`).
  private hand: readonly UnitTemplate[] = [];
  // R1 — the full player roster (for the roster-view modal), distinct from the
  // turn's drawn `hand`. Set in `show`.
  private roster: readonly UnitTemplate[] = [];
  // R2 — the encounter deck's other two piles (resolved templates, recruitment
  // order), for the draw/discard pile views. Set in `show`, refreshed by
  // `updateHand` so a reopened pile view reflects a redraw.
  private drawPile: readonly UnitTemplate[] = [];
  private discardPile: readonly UnitTemplate[] = [];
  private redraw: RedrawAvailability = { redrawsRemaining: 0, cardsRemaining: 0 };
  private empower: EmpowerAvailability = { empowersRemaining: 0 };
  private empowerMagnitudes: readonly number[] = [];
  // L1 — the run's daemon (the banner + the buff the hint/badge spell out) and
  // the per-turn chance-denial flags. The flags are computed ONCE in `show`
  // from the FRESH `turn:starting` budget (gate exists but granted nothing →
  // denied), so a later spent budget never reads as "denied".
  private daemon: GameEvents['turn:starting']['daemon'] = null;
  private redrawDenied = false;
  private empowerDenied = false;
  private readonly selected = new Set<number>();
  private handWrap: HTMLDivElement | null = null;
  private redrawButton: HTMLButtonElement | null = null;
  private empowerButton: HTMLButtonElement | null = null;
  // R1/R2 — the shared card-list affordances: roster (top-right) + draw
  // (bottom-right) + discard (bottom-left) pile views. All disposed on hide.
  private cardListButtons: CardListButton[] = [];

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(info: GameEvents['turn:starting'], roster: readonly UnitTemplate[]): void {
    this.hide();
    this.roster = roster;
    this.hand = info.hand;
    this.drawPile = info.drawPile;
    this.discardPile = info.discardPile;
    this.redraw = info.redraw;
    this.empower = info.empower;
    this.empowerMagnitudes = info.empowerMagnitudes;
    this.daemon = info.daemon;
    this.redrawDenied =
      (info.daemon?.redrawGate ?? false) && info.redraw.redrawsRemaining === 0;
    this.empowerDenied =
      (info.daemon?.empowerGate ?? false) && info.empower.empowersRemaining === 0;
    this.selected.clear();
    this.container = this.render(info);
    this.container.classList.add('screen-fade');
    this.mount.appendChild(this.container);
    fadeIn(this.container);
  }

  hide(): void {
    for (const button of this.cardListButtons) button.dispose();
    this.cardListButtons = [];
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
    }
    this.handWrap = null;
    this.redrawButton = null;
    this.empowerButton = null;
  }

  /**
   * K3 — a `turn:handRedrawn` landed (PreTurnScene forwards it): swap to the
   * post-redraw hand + decremented budget. The selection clears — the swapped
   * positions hold fresh cards now, and in the shipped one-batch mode the
   * whole control disappears (budget exhausted → cards stop being selectable).
   * K4 — the badge column comes re-derived for the NEW hand (a refill can seat
   * an already-empowered card).
   */
  updateHand(payload: GameEvents['turn:handRedrawn']): void {
    this.hand = payload.hand;
    // R2 — the redraw shuffled cards between piles; refresh the stored copies so
    // a reopened pile view reflects it (the buttons read these at click time).
    this.drawPile = payload.drawPile;
    this.discardPile = payload.discardPile;
    this.redraw = payload.redraw;
    this.empowerMagnitudes = payload.empowerMagnitudes;
    this.selected.clear();
    this.refreshHand();
  }

  /**
   * K4 — a `turn:unitEmpowered` landed (PreTurnScene forwards it): the hand is
   * unchanged but the picked card's slot now carries the buff. Swap in the
   * decremented budget + the new badge column; the selection clears (the pick
   * was consumed by the action).
   */
  updateEmpower(payload: GameEvents['turn:unitEmpowered']): void {
    this.empower = payload.empower;
    this.empowerMagnitudes = payload.empowerMagnitudes;
    this.selected.clear();
    this.refreshHand();
  }

  /** Single advance path — the Fight button lands here. (The auto-advance
   *  timer that used to share this funnel is gone as of K3.) */
  private advance(): void {
    this.dispatcher.dispatch({ kind: 'advanceTurn' });
  }

  private render(info: GameEvents['turn:starting']): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'preturn-screen';

    // R1/R2 — the card-list affordances (all position: fixed so they ignore
    // this screen's vertical scroll for a tall hand): the roster view top-right,
    // and the draw/discard pile views in the bottom corners. The pile buttons
    // read their stored copies at click time (refreshed by `updateHand`).
    this.cardListButtons = [
      new CardListButton(this.mount, this.audio, {
        text: 'Roster',
        title: 'Your Roster',
        position: 'roster',
        getUnits: () => this.roster,
        emptyText: 'No units in your roster.',
      }),
      new CardListButton(this.mount, this.audio, {
        text: 'Draw Pile',
        title: 'Draw Pile',
        position: 'draw',
        getUnits: () => this.drawPile,
        emptyText: 'The draw pile is empty.',
      }),
      new CardListButton(this.mount, this.audio, {
        text: 'Discard Pile',
        title: 'Discard Pile',
        position: 'discard',
        getUnits: () => this.discardPile,
        emptyText: 'The discard pile is empty.',
      }),
    ];
    for (const button of this.cardListButtons) panel.appendChild(button.el);

    const heading = document.createElement('div');
    heading.className = 'preturn-heading';
    heading.textContent = `Turn ${info.turn}`;
    panel.appendChild(heading);

    const sub = document.createElement('div');
    sub.className = 'preturn-sub';
    sub.textContent = `Floor ${info.floor}`;
    panel.appendChild(sub);

    // K3.5 — the encounter's battlefield (one map per encounter), so the
    // redraw below is an informed choice. Hand-authored layouts show their
    // authored display name; a procedural roll shows the shared
    // PROCEDURAL_MAP_NAME (R3 — same constant as the in-battle banner).
    const map = document.createElement('div');
    map.className = 'preturn-map';
    const mapName = info.map.layoutId === null
      ? PROCEDURAL_MAP_NAME
      : (getLayout(info.map.layoutId)?.name ?? info.map.layoutId);
    map.textContent = `⌖ ${mapName} — ${info.map.gridW}×${info.map.gridH}`;
    panel.appendChild(map);

    // L1 — the run's daemon banner: which idol governs the gates below. The
    // relic layer reads FLOURESCENT_BLUE (the K4 empower accent) against the
    // amber battlefield line. Daemon-less runs (fuzz control arm) show none.
    if (info.daemon) {
      const daemon = document.createElement('div');
      daemon.className = 'preturn-daemon';
      daemon.textContent = `◈ ${info.daemon.name} — ${info.daemon.description}`;
      panel.appendChild(daemon);
    }

    const pools = document.createElement('div');
    pools.className = 'preturn-pools';
    pools.append(
      renderPoolGauge('player', 'Your Pool', info.playerHealth, info.playerHealthMax),
      renderPoolGauge('enemy', 'Enemy Pool', info.enemyHealth, info.enemyHealthMax),
    );
    panel.appendChild(pools);

    this.handWrap = document.createElement('div');
    this.handWrap.className = 'preturn-hand';
    this.refreshHand();
    panel.appendChild(this.handWrap);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preturn-continue';
    button.textContent = 'Fight ▸';
    button.addEventListener('click', () => {
      this.audio.play('click');
      this.advance();
    });
    panel.appendChild(button);

    return panel;
  }

  private get canRedraw(): boolean {
    return this.redraw.redrawsRemaining > 0 && this.redraw.cardsRemaining > 0;
  }

  private get canEmpower(): boolean {
    return this.empower.empowersRemaining > 0;
  }

  /**
   * K3/K4 — (re)build the hand block in place: label, card row (selectable
   * while EITHER budget allows), and the redraw + empower controls. Runs at
   * first render and after every `turn:handRedrawn` / `turn:unitEmpowered`.
   */
  private refreshHand(): void {
    const wrap = this.handWrap;
    if (!wrap) return;
    wrap.replaceChildren();
    this.redrawButton = null;
    this.empowerButton = null;

    const label = document.createElement('div');
    label.className = 'preturn-hand-label';
    label.textContent = `Your hand — ${this.hand.length} drawn`;
    wrap.appendChild(label);

    const selectable = this.canRedraw || this.canEmpower;
    const cards = document.createElement('div');
    cards.className = 'preturn-hand-cards';
    const buffSummary = this.buffSummary;
    this.hand.forEach((unit, pos) => {
      const card = renderHandCard(unit, this.empowerMagnitudes[pos] ?? 0, buffSummary);
      if (selectable) {
        card.classList.add('unit-card--clickable');
        if (this.selected.has(pos)) card.classList.add('is-selected');
        card.addEventListener('click', () => this.toggleCard(pos, card));
      }
      cards.appendChild(card);
    });
    wrap.appendChild(cards);

    // L1 — a control renders only when its gate granted this turn; a chance
    // gate that denied (e.g. Mercury's cold coin) shows the inert line instead.
    if (this.canRedraw) wrap.appendChild(this.renderRedrawControl());
    else if (this.redrawDenied) {
      wrap.appendChild(renderGateDenied('the idol is silent — no redraw this turn'));
    }
    if (this.canEmpower) wrap.appendChild(this.renderEmpowerControl());
    else if (this.empowerDenied) {
      wrap.appendChild(renderGateDenied('the idol is silent — no empower this turn'));
    }
  }

  /** L1 — the ACTIVE daemon's buff, spelled out for the hint + badge title
   *  (null when the daemon grants no empower at all). */
  private get buffSummary(): string | null {
    const mods = this.daemon?.empowerBuff;
    return mods ? buffModsSummary(mods) : null;
  }

  /** K3/K4 — toggle a card's selection. The cap is the larger of the two
   *  consumers' needs: the redraw card budget (only binding when
   *  `maxCardsPerTurn` < hand size — a Phase-L daemon mode) or ONE for
   *  empower, so a redraw-exhausted turn can still pick its empower target. */
  private toggleCard(pos: number, card: HTMLDivElement): void {
    if (this.selected.has(pos)) {
      this.selected.delete(pos);
      card.classList.remove('is-selected');
    } else {
      const cap = Math.max(this.canRedraw ? this.redraw.cardsRemaining : 0, this.canEmpower ? 1 : 0);
      if (this.selected.size >= cap) return;
      this.selected.add(pos);
      card.classList.add('is-selected');
    }
    this.audio.play('click');
    this.syncRedrawButton();
    this.syncEmpowerButton();
  }

  /** K3 — the Redraw button + budget hint under the card row. Only rendered
   *  while a redraw is available this turn. */
  private renderRedrawControl(): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'preturn-redraw';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preturn-redraw-button';
    button.addEventListener('click', () => {
      if (this.selected.size === 0 || this.selected.size > this.redraw.cardsRemaining) return;
      this.audio.play('click');
      // No optimistic update — the authoritative new hand comes back via
      // `turn:handRedrawn` → `updateHand` (the J3 events-only pattern).
      this.dispatcher.dispatch({ kind: 'redrawCards', handIndices: [...this.selected] });
    });
    this.redrawButton = button;

    const hint = document.createElement('div');
    hint.className = 'preturn-redraw-hint';
    const { redrawsRemaining, cardsRemaining } = this.redraw;
    hint.textContent =
      `swap up to ${cardsRemaining} card${cardsRemaining === 1 ? '' : 's'}` +
      ` — ${redrawsRemaining} redraw${redrawsRemaining === 1 ? '' : 's'} left`;

    row.append(button, hint);
    this.syncRedrawButton();
    return row;
  }

  /** K4 — the Empower button + buff hint, the redraw control's sibling. Only
   *  rendered while an empower is available this turn. Acts on the single
   *  selected card; the hint spells out the buff (L1: derived from the ACTIVE
   *  daemon's `empowerBuff` mods, never hardcoded) so the choice is informed. */
  private renderEmpowerControl(): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'preturn-redraw preturn-empower';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preturn-redraw-button preturn-empower-button';
    button.textContent = 'Empower ▲';
    button.addEventListener('click', () => {
      if (this.selected.size !== 1) return;
      this.audio.play('click');
      // Same events-only refresh: the result comes back via
      // `turn:unitEmpowered` → `updateEmpower`.
      this.dispatcher.dispatch({ kind: 'empowerUnit', handIndex: [...this.selected][0]! });
    });
    this.empowerButton = button;

    const hint = document.createElement('div');
    hint.className = 'preturn-redraw-hint';
    const { empowersRemaining } = this.empower;
    hint.textContent =
      `pick one card: ${this.buffSummary ?? 'the daemon buff'} for this encounter` +
      ` — ${empowersRemaining} left`;

    row.append(button, hint);
    this.syncEmpowerButton();
    return row;
  }

  private syncRedrawButton(): void {
    const button = this.redrawButton;
    if (!button) return;
    button.textContent = `Redraw (${this.selected.size})`;
    // Over-the-card-budget selections can exist when empower raised the cap
    // (an L-daemon mode); the redraw ask is then invalid as a whole.
    button.disabled =
      this.selected.size === 0 || this.selected.size > this.redraw.cardsRemaining;
  }

  /** K4 — Empower wants exactly ONE card picked. */
  private syncEmpowerButton(): void {
    const button = this.empowerButton;
    if (!button) return;
    button.disabled = this.selected.size !== 1;
  }
}

/** P3 — one drawn card: the shared `full` UnitCard (pre-turn skin), so the hand
 *  shows the same all-stats + abilities-with-derived-stats + XP-to-next bar the
 *  player drafts on. K4 — an empowered card (its roster slot carries the buff)
 *  adds a `▲` badge overlay, one chevron per stack; the title spells out the
 *  active daemon's buff. The selection (K3 redraw / K4 empower) classes + click
 *  ride on top, applied by the caller. */
function renderHandCard(
  unit: UnitTemplate,
  empowerMagnitude: number,
  buffSummary: string | null,
): HTMLDivElement {
  const { el } = buildUnitCard(unitCardFromTemplate(unit), { mode: 'full', skin: 'preturn' });

  if (empowerMagnitude > 0) {
    const badge = document.createElement('div');
    badge.className = 'preturn-card-empower';
    badge.textContent =
      empowerMagnitude <= 3 ? '▲'.repeat(empowerMagnitude) : `▲×${empowerMagnitude}`;
    badge.title =
      `Empowered ×${empowerMagnitude}` + (buffSummary ? ` — ${buffSummary}` : '');
    el.appendChild(badge);
  }

  return el;
}

/** L1 — the inert line a chance-denied gate leaves where its control would be
 *  (Mercury's cold coin). Distinct from a SPENT gate, which leaves nothing. */
function renderGateDenied(text: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'preturn-gate-denied';
  row.textContent = `◈ ${text}`;
  return row;
}

/** K4 — human-readable summary of a buff's mods ("+4 STR · +4 RNG · +4 MAG")
 *  in the canonical stat order, so the hint can never drift from the source.
 *  L1 — parameterized: the mods come from the ACTIVE daemon via the
 *  `turn:starting` payload (the `EMPOWER` singleton is retired). */
function buffModsSummary(mods: StatusEffect['mods']): string {
  const parts: string[] = [];
  for (const stat of Object.keys(STAT_LABELS) as (keyof UnitStats)[]) {
    const mod = mods[stat];
    if (!mod) continue;
    if (mod.add !== undefined) {
      parts.push(`${mod.add >= 0 ? '+' : ''}${mod.add} ${STAT_LABELS[stat]}`);
    }
    if (mod.mul !== undefined) parts.push(`×${mod.mul} ${STAT_LABELS[stat]}`);
  }
  return parts.join(' · ');
}
