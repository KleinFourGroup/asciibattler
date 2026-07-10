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
 * run's idol(s), the empower hints/badges derive from the granting idols'
 * buffs (payload-carried — the retired `EMPOWER` singleton ships disabled),
 * and a chance hook that denied this turn (Mercury's cold coin) renders an
 * inert "the idol is silent" line where its control would be —
 * distinguishable from "spent" (no line) because denial is computed ONCE
 * from the fresh `turn:starting` payload.
 *
 * 47d — multi-daemon: the banner is a STACKED list (one line per owned
 * idol), and empower is PER-SOURCE — one control per granting idol, so the
 * player picks which blessing lands on which card.
 *
 * 49d — the grant QUEUE: the payload's `grants` list (one entry per granted
 * idol effect in acquisition order, redraw included — the summed redraw
 * budget retired with the §49 shape-lock) drives one control per entry, and
 * every command carries `grantIndex`. This is the MECHANICAL adaptation
 * (free-order mode — `passIsFinal` ships false): the guided chip strip with
 * auto-arm + Pass replaces this rendering at 49f and flips the toggle on.
 */

import type { GameEvents } from '../core/events';
import type { UnitTemplate, UnitStats } from '../sim/Unit';
import type { TurnGrantView } from '../run/daemon';
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
  // 49d — this turn's grant queue (one control per entry, queue order).
  private grants: readonly TurnGrantView[] = [];
  private empowerMagnitudes: readonly number[] = [];
  // 49f — the pools block + its static bounds, kept so a gate-time packet
  // fire (patch heals the player pool) can re-render the gauges in place.
  private poolsEl: HTMLDivElement | null = null;
  private poolBounds = { playerMax: 0, enemy: 0, enemyMax: 0 };
  // L1→47d — the per-turn chance-denial state, computed ONCE in `show` from
  // the FRESH `turn:starting` payload (an idol authors the hook but granted
  // nothing → denied), so a later spent budget never reads as "denied".
  private deniedRedrawIdols: string[] = [];
  private deniedEmpowerIdols: string[] = [];
  private readonly selected = new Set<number>();
  private handWrap: HTMLDivElement | null = null;
  // 49d — per-redraw-grant buttons carry their own card cap.
  private redrawButtons: Array<{ button: HTMLButtonElement; maxCards: number }> = [];
  private empowerButtons: HTMLButtonElement[] = [];
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
    this.grants = info.grants;
    this.empowerMagnitudes = info.empowerMagnitudes;
    // 49d — denial is per idol per hook kind: the idol authors the hook but
    // this turn's queue holds no matching entry from it (the coin came up
    // cold). Computed ONCE from the fresh payload — a spent grant keeps its
    // queue entry, so it can never read as "denied".
    this.deniedRedrawIdols = info.daemons
      .filter(
        (d) =>
          d.redrawGate &&
          !info.grants.some((g) => g.daemonId === d.id && g.effect.kind === 'redraw'),
      )
      .map((d) => d.name);
    this.deniedEmpowerIdols = info.daemons
      .filter(
        (d) =>
          d.empowerGate &&
          !info.grants.some((g) => g.daemonId === d.id && g.effect.kind === 'empower'),
      )
      .map((d) => d.name);
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
    this.poolsEl = null;
    this.redrawButtons = [];
    this.empowerButtons = [];
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
    this.grants = payload.grants;
    this.empowerMagnitudes = payload.empowerMagnitudes;
    this.selected.clear();
    this.refreshHand();
  }

  /**
   * K4 — a `turn:unitEmpowered` landed (PreTurnScene forwards it): the hand is
   * unchanged but the picked card's slot now carries the buff. Swap in the
   * re-derived queue + the new badge column; the selection clears (the pick
   * was consumed by the action).
   */
  updateEmpower(payload: GameEvents['turn:unitEmpowered']): void {
    this.grants = payload.grants;
    this.empowerMagnitudes = payload.empowerMagnitudes;
    this.selected.clear();
    this.refreshHand();
  }

  /**
   * 49f — a `run:packetUsed` landed while this gate is up (PreTurnScene
   * forwards it): a cache-modal fire just changed gate state — a reroute
   * INSERTED a redraw grant, a patch healed the player pool, a venom/miner
   * changed nothing visible here. Swap in the re-derived queue + badges and
   * re-render the pools from the post-effect health (same events-only
   * refresh as the redraw/empower paths).
   */
  updatePacketUsed(payload: GameEvents['run:packetUsed']): void {
    this.grants = payload.grants;
    this.empowerMagnitudes = payload.empowerMagnitudes;
    this.selected.clear();
    this.refreshHand();
    if (this.poolsEl !== null) {
      this.poolsEl.replaceChildren(
        renderPoolGauge('player', 'Your Pool', payload.playerHealth, this.poolBounds.playerMax),
        renderPoolGauge('enemy', 'Enemy Pool', this.poolBounds.enemy, this.poolBounds.enemyMax),
      );
    }
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

    // Wb1 — the encounter's NAME (the fight's headline), so the player reads
    // the stakes before turn 1 instead of guessing. An elite/boss fight rides a
    // kind badge (the elite uses the `*` map-glyph hue).
    const encounter = document.createElement('div');
    encounter.className = 'preturn-encounter';
    const encName = document.createElement('span');
    encName.className = 'preturn-encounter-name';
    encName.textContent = info.encounter.name;
    encounter.appendChild(encName);
    if (info.encounter.kind !== 'normal') {
      const badge = document.createElement('span');
      badge.className = `preturn-encounter-kind preturn-encounter-kind--${info.encounter.kind}`;
      badge.textContent = info.encounter.kind;
      encounter.appendChild(badge);
    }
    panel.appendChild(encounter);

    const sub = document.createElement('div');
    sub.className = 'preturn-sub';
    sub.textContent = `Hop ${info.hop}`;
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

    // L1→47d — the daemon banners: one stacked line per owned idol (the 47
    // shape-lock; a single-idol run renders exactly the old banner). The
    // relic layer reads FLOURESCENT_BLUE (the K4 empower accent) against the
    // amber battlefield line. Daemon-less runs (fuzz control arm) show none.
    for (const daemon of info.daemons) {
      const line = document.createElement('div');
      line.className = 'preturn-daemon';
      line.textContent = `◈ ${daemon.name} — ${daemon.description}`;
      panel.appendChild(line);
    }

    const pools = document.createElement('div');
    pools.className = 'preturn-pools';
    pools.append(
      renderPoolGauge('player', 'Your Pool', info.playerHealth, info.playerHealthMax),
      renderPoolGauge('enemy', 'Enemy Pool', info.enemyHealth, info.enemyHealthMax),
    );
    panel.appendChild(pools);
    // 49f — held for the packet-fire re-render (`updatePacketUsed`).
    this.poolsEl = pools;
    this.poolBounds = {
      playerMax: info.playerHealthMax,
      enemy: info.enemyHealth,
      enemyMax: info.enemyHealthMax,
    };

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

  /** 49d — the queue entries still holding budget, by kind. */
  private pendingGrants(kind: 'redraw' | 'empower'): TurnGrantView[] {
    return this.grants.filter((g) => g.effect.kind === kind && g.remaining > 0 && !g.passed);
  }

  private get canRedraw(): boolean {
    return this.pendingGrants('redraw').length > 0;
  }

  private get canEmpower(): boolean {
    return this.pendingGrants('empower').length > 0;
  }

  /**
   * K3/K4 — (re)build the hand block in place: label, card row (selectable
   * while EITHER budget allows), and one control per pending grant in QUEUE
   * order (49d). Runs at first render and after every `turn:handRedrawn` /
   * `turn:unitEmpowered`.
   */
  private refreshHand(): void {
    const wrap = this.handWrap;
    if (!wrap) return;
    wrap.replaceChildren();
    this.redrawButtons = [];
    this.empowerButtons = [];

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

    // 49d — one control per pending grant, in QUEUE order (the acquisition
    // order the strict mode will enforce; free mode just renders them all).
    // A chance hook that denied (e.g. Mercury's cold coin) shows the inert
    // line instead, naming its idol when several are owned.
    for (const grant of this.grants) {
      if (grant.remaining <= 0 || grant.passed) continue;
      if (grant.effect.kind === 'redraw') {
        wrap.appendChild(this.renderRedrawControl(grant));
      } else {
        wrap.appendChild(this.renderEmpowerControl(grant));
      }
    }
    for (const name of this.deniedRedrawIdols) {
      wrap.appendChild(renderGateDenied(`${name} is silent — no redraw this turn`));
    }
    for (const name of this.deniedEmpowerIdols) {
      wrap.appendChild(renderGateDenied(`${name} is silent — no empower this turn`));
    }
  }

  /** L1→49d — every granting idol's empower buff, spelled out for the badge
   *  title (null when nothing grants an empower this turn). */
  private get buffSummary(): string | null {
    const empowers = this.grants.filter((g) => g.effect.kind === 'empower');
    if (empowers.length === 0) return null;
    return empowers
      .map((g) => (g.effect.kind === 'empower' ? buffModsSummary(g.effect.buff.mods) : ''))
      .join(' / ');
  }

  /** K3/K4 — toggle a card's selection. The cap is the largest consumer's
   *  need: the biggest pending redraw grant's card cap, or ONE for empower,
   *  so a redraw-exhausted turn can still pick its empower target. */
  private toggleCard(pos: number, card: HTMLDivElement): void {
    if (this.selected.has(pos)) {
      this.selected.delete(pos);
      card.classList.remove('is-selected');
    } else {
      const redrawCap = Math.max(
        0,
        ...this.pendingGrants('redraw').map((g) =>
          g.effect.kind === 'redraw' ? g.effect.maxCards : 0,
        ),
      );
      const cap = Math.max(redrawCap, this.canEmpower ? 1 : 0);
      if (this.selected.size >= cap) return;
      this.selected.add(pos);
      card.classList.add('is-selected');
    }
    this.audio.play('click');
    this.syncRedrawButtons();
    this.syncEmpowerButtons();
  }

  /** K3→49d — one Redraw button + budget hint PER pending redraw grant (the
   *  per-source model; a single-redraw-idol run renders one control as
   *  before, naming its idol only when several granted). */
  private renderRedrawControl(grant: TurnGrantView): HTMLDivElement {
    if (grant.effect.kind !== 'redraw') throw new Error('renderRedrawControl: wrong kind');
    const { maxCards } = grant.effect;
    const row = document.createElement('div');
    row.className = 'preturn-redraw';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preturn-redraw-button';
    button.dataset['label'] =
      this.pendingGrants('redraw').length > 1 ? `Redraw (${grant.name})` : 'Redraw';
    button.addEventListener('click', () => {
      if (this.selected.size === 0 || this.selected.size > maxCards) return;
      this.audio.play('click');
      // No optimistic update — the authoritative new hand comes back via
      // `turn:handRedrawn` → `updateHand` (the J3 events-only pattern).
      this.dispatcher.dispatch({
        kind: 'redrawCards',
        handIndices: [...this.selected],
        grantIndex: grant.grantIndex,
      });
    });
    this.redrawButtons.push({ button, maxCards });

    const hint = document.createElement('div');
    hint.className = 'preturn-redraw-hint';
    hint.textContent =
      `swap up to ${maxCards} card${maxCards === 1 ? '' : 's'}` +
      ` — ${grant.remaining} redraw${grant.remaining === 1 ? '' : 's'} left`;

    row.append(button, hint);
    this.syncRedrawButtons();
    return row;
  }

  /** K4→49d — one Empower button + buff hint PER pending empower grant, the
   *  redraw controls' sibling. Acts on the single selected card; the hint
   *  spells out the idol's OWN buff (payload-carried, never hardcoded) so
   *  the choice is informed. The button names its idol only when several
   *  sources granted (a single-idol run keeps the plain 'Empower ▲' look). */
  private renderEmpowerControl(grant: TurnGrantView): HTMLDivElement {
    if (grant.effect.kind !== 'empower') throw new Error('renderEmpowerControl: wrong kind');
    const { buff } = grant.effect;
    const row = document.createElement('div');
    row.className = 'preturn-redraw preturn-empower';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preturn-redraw-button preturn-empower-button';
    button.textContent =
      this.pendingGrants('empower').length > 1 ? `Empower ▲ (${grant.name})` : 'Empower ▲';
    button.addEventListener('click', () => {
      if (this.selected.size !== 1) return;
      this.audio.play('click');
      // Same events-only refresh: the result comes back via
      // `turn:unitEmpowered` → `updateEmpower`.
      this.dispatcher.dispatch({
        kind: 'empowerUnit',
        handIndex: [...this.selected][0]!,
        grantIndex: grant.grantIndex,
      });
    });
    this.empowerButtons.push(button);

    const hint = document.createElement('div');
    hint.className = 'preturn-redraw-hint';
    hint.textContent =
      `pick one card: ${buffModsSummary(buff.mods)} for this encounter` +
      ` — ${grant.remaining} left`;

    row.append(button, hint);
    this.syncEmpowerButtons();
    return row;
  }

  /** 49d — every redraw button syncs against ITS grant's card cap. */
  private syncRedrawButtons(): void {
    for (const { button, maxCards } of this.redrawButtons) {
      button.textContent = `${button.dataset['label']} (${this.selected.size})`;
      // Over-the-cap selections can exist when empower raised the cap (an
      // L-daemon mode); the redraw ask is then invalid as a whole.
      button.disabled = this.selected.size === 0 || this.selected.size > maxCards;
    }
  }

  /** K4 — Empower wants exactly ONE card picked (every source's button). */
  private syncEmpowerButtons(): void {
    for (const button of this.empowerButtons) {
      button.disabled = this.selected.size !== 1;
    }
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
