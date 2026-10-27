/**
 * The pre-turn screen, shown before each turn's battle (on `turn:starting`):
 * the turn, the encounter, the hop and the battlefield, a line per owned
 * daemon, both pools with the risk line and the last-turn strip, the drawn
 * hand, the grant strip and the packet row. It waits for Fight; there is no
 * timer, since a redraw decision shouldn't race one.
 *
 * It re-renders only off the events PreTurnScene forwards
 * (`turn:handRedrawn`, `turn:unitEmpowered`, `turn:grantPassed`,
 * `run:packetUsed`, `run:cacheChanged`), so the hand on screen is always the
 * Run's, never an optimistic local copy.
 *
 * The grant strip: one chip per entry of the turn's grant queue, in the
 * order the grants were gained (the payload's `grants`; every command
 * carries its `grantIndex`). The active chip, the engine's cursor
 * (`grantViews[].active`), arms itself with a glow and a hint, and the
 * hand's cards are its targets: an armed empower fires on a card's click,
 * and an armed redraw selects up to its cap and confirms on the chip. Pass
 * finalizes the active grant unspent (`passGrant`); Fight is the implicit
 * pass of them all, since the queue expires at the turn's start. Later
 * chips wait dimmed, and passed ones are struck. The strip keeps the strict
 * shape under a config with `passIsFinal` off (a test's or the fuzz's), so
 * the UI never offers more than the strict order allows.
 *
 * A daemon whose chance hook denied this turn (Mercury's coin) leaves an
 * inert line where its control would be. Denial is computed once, from the
 * fresh `turn:starting` payload, so a spent grant, which keeps its queue
 * entry, never reads as denied.
 *
 * The packet row: the held packets usable before a turn, read live from the
 * cache through the injected thunk, as chips under the strip, usable at will
 * before or between the grant chips. A target-`none` packet fires on a
 * click; a unit-target one (Hype, Shield, Cull) arms a card pick, and a
 * second click cancels it. Fires use the `usePacket` command the cache
 * modal uses, and the screen refreshes off `run:packetUsed` and
 * `run:cacheChanged`.
 */

import type { GameEvents } from '../core/events';
import type { UnitTemplate } from '../sim/Unit';
import type { TurnGrantView } from '../run/daemon';
import type { EmpowerStackView } from '../run/empower';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { getLayout } from '../sim/layouts';
import { t } from '../i18n/ui';
import { packetById, type PacketConfig } from '../config/packets';
import { DECK } from '../config/deck';
import { POOL_LABELS, chipLineLabels, riskLineTitle } from './chipLabels';
import { rulesForTurn } from '../run/chipRule';
import type { FallenRecord } from '../run/Run';
import { fallenGlyphRun, fallenLines, fallenSide } from './fallenSide';
import { Screen } from './Screen';
import { button } from './button';
import { attachTooltip } from './tooltip';
import { pressable } from './pressable';
import { reserveSlot } from './reserveSlot';
import { renderPoolGauge } from './poolGauge';
import { buildUnitCard, unitCardFromTemplate, buffChipTooltip, buffModsSummary } from './UnitCard';
import { empowerColor, empowerLabel } from '../render/statusDisplay';
import { CardListButton } from './CardListModal';
import { mountControl } from './chip';

/** The previous turn, as `turn:starting` carries it for the strip. */
type LastTurn = NonNullable<GameEvents['turn:starting']['lastTurn']>;

/**
 * One deck cue (the `deck:*` events): buffered by Game for the deal, since
 * the cues fire before `turn:starting` mounts the scene, and forwarded live
 * by PreTurnScene for the gate's actions. The screen queues them and plays
 * the pile pulses one at a time on its own clock; the swap payloads stay the
 * truth (a cue is not, events.ts).
 */
export interface DeckCue {
  readonly kind: 'drawn' | 'discarded' | 'reshuffled';
  readonly drawPile: number;
  readonly discardPile: number;
}

export class PreTurnScreen extends Screen {
  // The live hand, swapped by `updateHand`; the selected hand positions; and
  // the DOM `refreshHand` rebuilds in place.
  private hand: readonly UnitTemplate[] = [];
  // The whole roster, for the roster view; the turn's drawn `hand` is apart.
  // Set in `show`.
  private roster: readonly UnitTemplate[] = [];
  // The encounter deck's other two piles (templates in recruitment order),
  // for the pile views. Set in `show` and refreshed by `updateHand`, so a
  // reopened view shows a redraw.
  private drawPile: readonly UnitTemplate[] = [];
  private discardPile: readonly UnitTemplate[] = [];
  // This turn's grant queue (one chip per entry, in queue order) and the
  // hand's badge column.
  private grants: readonly TurnGrantView[] = [];
  private empowerStacks: readonly EmpowerStackView[][] = [];
  // The pools block and its fixed bounds, held so a packet fired at the gate
  // (Patch heals the player's pool) can repaint the gauges in place.
  private poolsEl: HTMLDivElement | null = null;
  private poolBounds = { playerMax: 0, enemy: 0, enemyMax: 0 };
  /** The risk line, held so a hand swap or a packet fire repaints it from
   *  the payload's bound, derived again for the new hand or pool. */
  private riskEl: HTMLDivElement | null = null;
  /** The previous turn's outcome for the last-turn strip; null on an
   *  encounter's first turn. */
  private lastTurn: LastTurn | null = null;
  // The chance denials, computed once in `show` from the fresh
  // `turn:starting` payload (a daemon has the hook but granted nothing:
  // denied), so a grant spent later never reads as denied.
  private deniedRedrawIdols: string[] = [];
  private deniedEmpowerIdols: string[] = [];
  private readonly selected = new Set<number>();
  private handWrap: HTMLDivElement | null = null;
  // The held cache, read live at render time (a thunk from PreTurnScene,
  // `ctx.run.cache`), so the packet row always shows the Run's cache; and
  // the armed unit-target packet (a card pick pending), as a cache index.
  // Any cache change disarms: indices shift under fires and discards, and
  // deriving again beats holding a stale one.
  private getCache: () => readonly string[] = () => [];
  private armedPacketIndex: number | null = null;
  // The two reserved slots, held for the screen's life once they have
  // appeared. The arm hint sits above the packet chip that toggles it, so
  // showing it would push the chip from under the pointer; and the packet
  // row would vanish when its last packet fired. `armSlotName` is the packet
  // name the hidden hint is sized with.
  private armSlotName: string | null = null;
  private packetRowHeld = false;
  // The card-list buttons: the roster (a row of the control column) and the
  // draw (bottom right) and discard (bottom left) piles. All disposed on
  // hide.
  private cardListButtons: CardListButton[] = [];
  // The turn's folded draw amount, for the "Draw: N" chip. Set in `show`
  // from the payload.
  private drawAmount = 0;
  // Hand positions to animate in on the next `refreshHand` ('all' is the
  // first deal, staggered). Consumed once, then cleared: a refresh driven by
  // another event (a cache or grant change) must not replay it.
  private enterPositions: Set<number> | 'all' | null = null;
  // The queued deck cues (seeded by `show` from Game's deal buffer, added
  // live by PreTurnScene at the gate), the pulse timers, the shown counts
  // while a sequence plays (null is the pile's own), the exit clones
  // waiting for their cue, and the two pile buttons by name.
  private pendingCues: DeckCue[] = [];
  // Cues are consumed only by the refresh that carries the hand swap
  // (`show`, `updateHand`). The repaints earlier in the same dispatch
  // (`run:cacheChanged` and `run:packetUsed` fire before the hand's emit)
  // must neither consume the queue nor cancel a playing schedule: an early
  // refresh would consume the cues, and the last one kill the timers just
  // scheduled, leaving the counts at their values before the sequence.
  private playCuesOnNextRefresh = false;
  private cueTimers: number[] = [];
  private displayedDraw: number | null = null;
  private displayedDiscard: number | null = null;
  private exitClones: HTMLElement[] = [];
  private drawPileButton: CardListButton | null = null;
  private discardPileButton: CardListButton | null = null;

  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    /** The control column's second row: where the roster button mounts. */
    private readonly controlSlot: HTMLElement,
  ) {
    super(mount);
  }

  show(
    info: GameEvents['turn:starting'],
    roster: readonly UnitTemplate[],
    getCache: () => readonly string[],
    dealCues: readonly DeckCue[] = [],
  ): void {
    this.hide();
    // The previous turn's outcome, a strip under the gauges from turn 2 on.
    // The Run sends it on the payload, null on an encounter's first turn.
    this.lastTurn = info.lastTurn;
    this.roster = roster;
    this.getCache = getCache;
    this.armedPacketIndex = null;
    this.armSlotName = null;
    this.packetRowHeld = false;
    this.hand = info.hand;
    this.drawPile = info.drawPile;
    this.discardPile = info.discardPile;
    this.drawAmount = info.drawAmount;
    this.enterPositions = 'all'; // the first deal animates in, staggered
    // The deal's cues, buffered by Game, since the scene wasn't mounted yet.
    // The leading discarded cues are the previous turn's hand going to the
    // discard, its epilogue and not this turn's story, so the playback drops
    // them: the screen opens with the discard count already past them, and
    // the story starts at the deal. They are always a strict prefix
    // (`drawTurnHand` discards before it draws); a reshuffle during the deal
    // stays, and on a dry-pile turn the sequence opens on its flash. This is
    // presentation only: the Run's cue stream stays whole.
    const deal = [...dealCues];
    while (deal[0]?.kind === 'discarded') deal.shift();
    this.pendingCues = deal;
    this.playCuesOnNextRefresh = true;
    this.grants = info.grants;
    this.empowerStacks = info.empowerStacks;
    // Denial is per daemon and hook kind: the daemon has the hook, but this
    // turn's queue holds no entry of that kind from it (the coin came up
    // cold). Computed once from the fresh payload: a spent grant keeps its
    // queue entry, so it never reads as denied.
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
    this.present(this.render(info));
  }

  override hide(): void {
    // Stop the pulse schedule first (its callbacks touch the buttons
    // disposed below), drop the count overrides, and sweep any exit clones
    // still awaiting their cue.
    this.clearCueTimers();
    this.displayedDraw = null;
    this.displayedDiscard = null;
    for (const clone of this.exitClones) clone.remove();
    this.exitClones = [];
    this.pendingCues = [];
    for (const button of this.cardListButtons) button.dispose();
    this.cardListButtons = [];
    this.drawPileButton = null;
    this.discardPileButton = null;
    super.hide();
    this.handWrap = null;
    this.poolsEl = null;
    this.armedPacketIndex = null;
  }

  /** A live deck cue landed at the gate (PreTurnScene forwards the `deck:*`
   *  events): queue it for the swap event later in the same dispatch. The
   *  cues always come before `turn:handRedrawn`, since the Run emits the hand
   *  swap last. */
  enqueueCue(cue: DeckCue): void {
    this.pendingCues.push(cue);
  }

  /**
   * A `turn:handRedrawn` landed (PreTurnScene forwards it): swap in the new
   * hand, the piles, the grants and the badges. The selection clears, since
   * the swapped positions hold new cards; with no grant left active, the
   * cards stop being selectable. The badge column comes derived again for
   * the new hand (a refill can seat a card already empowered).
   */
  updateHand(payload: GameEvents['turn:handRedrawn']): void {
    // An identity diff before the swap (the payload's hand entries are
    // references into the run's team templates, so `===` is a stable card
    // key): changed and new positions animate in, and outgoing cards leave
    // as fixed-position clones. A redraw keeps the length (a replaced slot
    // leaves and enters); Surge lengthens it (the added slots enter); Cull
    // shortens it (the two-pointer walk finds the cards taken out).
    const prev = this.hand;
    const next = payload.hand;
    const enter = new Set<number>();
    const exits: number[] = [];
    if (next.length >= prev.length) {
      for (let i = 0; i < next.length; i++) {
        if (next[i] !== prev[i]) {
          enter.add(i);
          if (i < prev.length) exits.push(i); // a replaced slot's outgoing card
        }
      }
    } else {
      let j = 0;
      for (let i = 0; i < prev.length; i++) {
        if (j < next.length && prev[i] === next[j]) j++;
        else exits.push(i);
      }
    }
    this.animateExits(exits);
    this.enterPositions = enter.size > 0 ? enter : null;
    this.playCuesOnNextRefresh = true; // this is the hand-swap refresh
    this.paintRisk(payload.poolAtRisk); // the bound moved with the hand

    this.hand = payload.hand;
    // The change moved cards between piles; refresh the stored copies, so a
    // reopened pile view shows it (the buttons read these at click time).
    this.drawPile = payload.drawPile;
    this.discardPile = payload.discardPile;
    this.grants = payload.grants;
    this.empowerStacks = payload.empowerStacks;
    this.selected.clear();
    this.refreshHand();
    // The pile counts on the button faces moved with the cards.
    for (const button of this.cardListButtons) button.refresh();
  }

  /**
   * The exit animation: clone each outgoing card at its current screen
   * rect (the hand row is about to be rebuilt), let the clone fall/fade via
   * CSS, then remove it. Pure presentation — the authoritative state moved
   * in the Run before the event fired. Positions index the old hand row.
   */
  private animateExits(positions: readonly number[]): void {
    if (positions.length === 0) return;
    const cards = this.handWrap?.querySelector('.preturn-hand-cards');
    if (!cards) return;
    for (const pos of positions) {
      const node = cards.children[pos];
      if (!(node instanceof HTMLElement)) continue;
      const rect = node.getBoundingClientRect();
      const clone = node.cloneNode(true) as HTMLElement;
      // The clone holds as a still ghost (fixed, in place) until its
      // discard cue fires in the schedule; `beginExit` starts the fall.
      // `scheduleCueSequence` pairs clones with cues in creation order.
      clone.classList.add('preturn-card-ghost');
      clone.style.left = `${rect.left}px`;
      clone.style.top = `${rect.top}px`;
      clone.style.width = `${rect.width}px`;
      this.mount.appendChild(clone);
      this.exitClones.push(clone);
    }
  }

  /** Start a ghost clone's fall and arrange its removal (`animationend` is
   *  the normal path; the timeout is the safety net, since a background tab
   *  can hold an animation indefinitely). */
  private beginExit(clone: HTMLElement): void {
    clone.classList.add('preturn-card-exit');
    const remove = (): void => clone.remove();
    clone.addEventListener('animationend', remove, { once: true });
    setTimeout(remove, 600);
  }

  private clearCueTimers(): void {
    for (const timer of this.cueTimers) clearTimeout(timer);
    this.cueTimers = [];
  }

  /** Repaint just the two pile buttons (their `getCount` thunks read the
   *  shown counts while a pulse schedule plays). */
  private refreshPileButtons(): void {
    this.drawPileButton?.refresh();
    this.discardPileButton?.refresh();
  }

  /** One pile button's pulse: restart the CSS animation by removing the
   *  class and forcing a reflow. */
  private pulse(button: CardListButton | null, cls: string): void {
    const el = button?.el;
    if (!el) return;
    el.classList.remove('card-list-button--pulse', 'card-list-button--reshuffle');
    void el.offsetWidth; // reflow — restart the animation
    el.classList.add(cls);
  }

  /**
   * Play the queued deck cues one at a time: one pulse per card, the counts
   * ticking one by one, and the reshuffle a single pulse of its own. It
   * runs at the end of the refresh that carries the hand swap:
   * - each `drawn` cue reveals its entering card (its animation delay set to
   *   the pulse cadence) and pulses the draw pile's button;
   * - each `discarded` cue releases its exit ghost and pulses the discard
   *   pile's;
   * - `reshuffled` pulses both once with its own flash.
   * The shown counts ride overrides and return to the piles' own when the
   * schedule drains. Fight stays live throughout: advancing hides the
   * screen, which clears the timers and sweeps the ghosts, so the player
   * never waits on the show. With no cues queued, it plays the quick
   * stagger and the exits at once.
   */
  private scheduleCueSequence(enteringNodes: readonly HTMLElement[]): void {
    const cues = this.pendingCues;
    this.pendingCues = [];
    this.clearCueTimers();
    const clones = this.exitClones;
    this.exitClones = [];

    if (cues.length === 0) {
      enteringNodes.forEach((node, i) => {
        node.style.animationDelay = `${i * 45}ms`;
      });
      for (const clone of clones) this.beginExit(clone);
      return;
    }

    const CADENCE = 130;
    // Seed the shown counts at their values before the sequence, rebuilt
    // from the first cue's post-move counts.
    const first = cues[0]!;
    if (first.kind === 'drawn') {
      this.displayedDraw = first.drawPile + 1;
      this.displayedDiscard = first.discardPile;
    } else if (first.kind === 'discarded') {
      this.displayedDraw = first.drawPile;
      this.displayedDiscard = first.discardPile - 1;
    } else {
      this.displayedDraw = 0;
      this.displayedDiscard = first.drawPile;
    }
    this.refreshPileButtons();

    let drawnIdx = 0;
    let discardIdx = 0;
    cues.forEach((cue, k) => {
      const t = k * CADENCE;
      if (cue.kind === 'drawn') {
        const node = enteringNodes[drawnIdx++];
        if (node) node.style.animationDelay = `${t}ms`;
      }
      const clone = cue.kind === 'discarded' ? clones[discardIdx++] : undefined;
      this.cueTimers.push(
        window.setTimeout(() => {
          this.displayedDraw = cue.drawPile;
          this.displayedDiscard = cue.discardPile;
          if (cue.kind === 'reshuffled') {
            this.pulse(this.drawPileButton, 'card-list-button--reshuffle');
            this.pulse(this.discardPileButton, 'card-list-button--reshuffle');
          } else if (cue.kind === 'drawn') {
            this.pulse(this.drawPileButton, 'card-list-button--pulse');
          } else {
            this.pulse(this.discardPileButton, 'card-list-button--pulse');
          }
          if (clone) this.beginExit(clone);
          this.refreshPileButtons();
        }, t),
      );
    });
    // Defensive: a clone the cues didn't cover exits immediately (a diff
    // the cue stream doesn't narrate must not leave a frozen ghost).
    for (let i = discardIdx; i < clones.length; i++) this.beginExit(clones[i]!);
    // Reconcile: overrides off, authoritative counts back.
    this.cueTimers.push(
      window.setTimeout(() => {
        this.displayedDraw = null;
        this.displayedDiscard = null;
        this.refreshPileButtons();
      }, cues.length * CADENCE + 200),
    );
  }

  /**
   * A `turn:unitEmpowered` landed (PreTurnScene forwards it): the hand is
   * unchanged but the picked card's slot now carries the buff. Swap in the
   * re-derived queue + the new badge column; the selection clears (the pick
   * was consumed by the action).
   */
  updateEmpower(payload: GameEvents['turn:unitEmpowered']): void {
    this.grants = payload.grants;
    this.empowerStacks = payload.empowerStacks;
    this.selected.clear();
    this.refreshHand();
  }

  /**
   * A `run:packetUsed` landed while this gate is up (PreTurnScene forwards
   * it): a packet fired, from this screen's row or the cache modal, and
   * changed the gate's state. Reroute added a redraw grant, Patch healed the
   * player's pool, Venom changed nothing shown here. Swap in the queue and
   * the badges, derived again, and repaint the pools from the health after
   * the effect (the same events-only refresh as the redraw and empower
   * paths).
   */
  updatePacketUsed(payload: GameEvents['run:packetUsed']): void {
    this.grants = payload.grants;
    this.empowerStacks = payload.empowerStacks;
    this.selected.clear();
    this.armedPacketIndex = null; // the fire consumed a slot — indices shifted
    this.refreshHand();
    if (this.poolsEl !== null) {
      this.poolsEl.replaceChildren(
        renderPoolGauge('player', POOL_LABELS.player, payload.playerHealth, this.poolBounds.playerMax),
        renderPoolGauge('enemy', POOL_LABELS.enemy, this.poolBounds.enemy, this.poolBounds.enemyMax),
      );
    }
    this.paintRisk(payload.poolAtRisk); // the pool moved, so did the bound
  }

  /** The risk line's one paint site (`turn:starting`, a hand swap, a packet
   *  fire): "⚠ At risk this turn: up to N morale". */
  private paintRisk(poolAtRisk: number): void {
    if (this.riskEl === null) return;
    this.riskEl.textContent = `⚠ ${t('preturn.risk', { n: poolAtRisk })}`;
  }

  /**
   * A `passGrant` finalized the active grant (`turn:grantPassed`, with
   * `passIsFinal` on): swap in the queue, derived again, so the strip arms
   * the new cursor.
   */
  updateGrantPassed(payload: GameEvents['turn:grantPassed']): void {
    this.grants = payload.grants;
    this.selected.clear();
    this.refreshHand();
  }

  /**
   * The cache changed under this gate (a fire, or a discard from the cache
   * modal): repaint the packet row from the live thunk, and disarm, since
   * the indices shifted.
   */
  updateCache(): void {
    this.armedPacketIndex = null;
    this.refreshHand();
  }

  /** The one advance path: the Fight button's. */
  private advance(): void {
    this.dispatcher.dispatch({ kind: 'advanceTurn' });
  }

  private render(info: GameEvents['turn:starting']): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'preturn-screen';

    // The card-list buttons. The piles are fixed corner buttons, so a tall
    // hand's scroll can't move them, and read their stored copies at click
    // time (`updateHand` refreshes them). Their faces carry live counts
    // ("Draw Pile · 12"), read again by `refresh()` where the copies swap.
    // They are held by name, as the pulse targets, and while a pulse
    // sequence plays their counts read the schedule's (null is the pile's
    // own).
    this.drawPileButton = new CardListButton(this.mount, this.audio, {
      text: t('preturn.drawPile'),
      title: t('preturn.drawPile'),
      position: 'draw',
      getUnits: () => this.drawPile,
      getCount: () => this.displayedDraw ?? this.drawPile.length,
      emptyText: t('preturn.drawPileEmpty'),
    });
    this.discardPileButton = new CardListButton(this.mount, this.audio, {
      text: t('preturn.discardPile'),
      title: t('preturn.discardPile'),
      position: 'discard',
      getUnits: () => this.discardPile,
      getCount: () => this.displayedDiscard ?? this.discardPile.length,
      emptyText: t('preturn.discardPileEmpty'),
    });
    const rosterButton = new CardListButton(this.mount, this.audio, {
      text: t('roster.button'),
      title: t('roster.title'),
      position: 'roster',
      getUnits: () => this.roster,
      getCount: () => this.roster.length,
      emptyText: t('roster.empty'),
    });
    this.cardListButtons = [rosterButton, this.drawPileButton, this.discardPileButton];
    // Roster is a row of the control column; the piles stay corner buttons
    // of this screen (their words are too long for the column's plate).
    mountControl(this.controlSlot, rosterButton.el);
    panel.append(this.drawPileButton.el, this.discardPileButton.el);

    // The "Draw: N" chip: the turn's folded draw amount, above the Draw Pile
    // button, where the player already reasons about the deck. Not a
    // control.
    const drawChip = document.createElement('div');
    drawChip.className = 'preturn-draw-chip';
    drawChip.textContent = t('preturn.draw', { n: this.drawAmount });
    // A text site: a tap toggles its tooltip, and Tab reaches it.
    drawChip.tabIndex = 0;
    attachTooltip(drawChip, t('preturn.drawChip.tooltip'));
    panel.appendChild(drawChip);

    const heading = document.createElement('div');
    heading.className = 'preturn-heading';
    heading.textContent = t('preturn.turn', { turn: info.turn });
    panel.appendChild(heading);

    // The encounter's name, the fight's headline, so the player reads the
    // stakes before turn 1. An elite or boss fight wears a kind badge (the
    // elite in the map's `*` hue).
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
    sub.textContent = t('common.hop', { hop: info.hop });
    panel.appendChild(sub);

    // The encounter's battlefield (one map per encounter), so the redraw
    // below is an informed choice: a hand-authored layout's name, or
    // `map.uncharted` for a procedural roll, the string the battle's banner
    // shows.
    const map = document.createElement('div');
    map.className = 'preturn-map';
    const mapName = info.map.layoutId === null
      ? t('map.uncharted')
      : (getLayout(info.map.layoutId)?.name ?? info.map.layoutId);
    map.textContent = `◎ ${mapName} — ${info.map.gridW}×${info.map.gridH}`;
    panel.appendChild(map);

    // One line per owned daemon, in the relic accent (FLOURESCENT_BLUE)
    // against the amber battlefield line. A run with no daemon shows none.
    for (const daemon of info.daemons) {
      const line = document.createElement('div');
      line.className = 'preturn-daemon';
      line.textContent = `◈ ${daemon.name} — ${daemon.description}`;
      panel.appendChild(line);
    }

    const pools = document.createElement('div');
    pools.className = 'preturn-pools';
    pools.append(
      renderPoolGauge('player', POOL_LABELS.player, info.playerHealth, info.playerHealthMax),
      renderPoolGauge('enemy', POOL_LABELS.enemy, info.enemyHealth, info.enemyHealthMax),
    );
    panel.appendChild(pools);
    // The risk line, right under the gauges it reads against: the most
    // morale this turn can cost (the whole hand falling,
    // `Run.previewPoolAtRisk`), capped at the pool. The player sees the
    // worst case before spending a redraw or an empower.
    const risk = document.createElement('div');
    risk.className = 'preturn-risk';
    risk.tabIndex = 0;
    attachTooltip(risk, () => riskLineTitle());
    panel.appendChild(risk);
    // Held, and painted through one function, so the hand-swap and
    // packet-fire refreshes repaint the same line; the ⚠ stays outside the
    // localized string.
    this.riskEl = risk;
    this.paintRisk(info.poolAtRisk);
    // The last-turn strip, from turn 2 on: the skirmish's result and each
    // side's fallen as a glyph run with its loss, under the morale reads it
    // explains.
    if (this.lastTurn !== null) panel.appendChild(renderLastTurn(this.lastTurn));
    // Held for the packet fire's repaint (`updatePacketUsed`).
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

    const fight = button(`${t('preturn.fight')} ▸`, {
      className: 'btn--primary preturn-continue',
      onClick: () => {
        this.audio.play('click');
        this.advance();
      },
    });
    panel.appendChild(fight);

    return panel;
  }

  /** The strip's cursor: the engine's active grant (the first pending,
   *  `grantViews[].active`), or null when the queue is spent. */
  private activeGrant(): TurnGrantView | null {
    return this.grants.find((g) => g.active && !g.passed && g.remaining > 0) ?? null;
  }

  /** The armed unit-target packet, resolved again from the live cache, never
   *  held (indices shift under fires and discards; an index left dangling
   *  resolves to null, disarmed). */
  private armedPacket(): { cacheIndex: number; packet: PacketConfig } | null {
    if (this.armedPacketIndex === null) return null;
    const id = this.getCache()[this.armedPacketIndex];
    const packet = id !== undefined ? packetById(id) : undefined;
    if (packet === undefined) return null;
    return { cacheIndex: this.armedPacketIndex, packet };
  }

  /**
   * Build the hand block in place: the label, the card row (clickable while
   * something is armed), the grant strip (one chip per queue entry, and
   * Pass), the packet row and the denial lines. It runs at the first render
   * and after every gate event (`turn:handRedrawn`, `turn:unitEmpowered`,
   * `turn:grantPassed`, `run:packetUsed`, `run:cacheChanged`): one render
   * path, no optimistic copies.
   */
  private refreshHand(): void {
    const wrap = this.handWrap;
    if (!wrap) return;
    wrap.replaceChildren();

    const label = document.createElement('div');
    label.className = 'preturn-hand-label';
    label.textContent = t('preturn.handLabel', { n: this.hand.length });
    wrap.appendChild(label);

    const armed = this.armedPacket();
    const active = this.activeGrant();
    const selectable = armed !== null || active !== null;
    const cards = document.createElement('div');
    cards.className = 'preturn-hand-cards';
    // A balanced two-row wrap past the standard deal: the row is capped at
    // ceil(n/2) columns, so an over-drawn hand (Surge, up to `maxHandSize`)
    // wraps 5 and 5 rather than leaving one card on a second row. A hand at
    // or under the deal keeps one row. The card width and gap are this
    // class's CSS variables (ui.css), not constants here.
    if (this.hand.length > DECK.handSize) {
      const cols = Math.ceil(this.hand.length / 2);
      cards.style.maxWidth = `calc(${cols} * var(--hand-card-w) + ${cols - 1} * var(--hand-gap))`;
    }
    // The one-shot enter set (the first deal, a redraw's refill, a Surge
    // draw). The entering nodes are collected in reveal order and handed to
    // the cue schedule, which sets each card's delay to its `drawn` pulse
    // (or the quick stagger when no cues are queued).
    const entering = this.enterPositions;
    this.enterPositions = null;
    const enteringNodes: HTMLElement[] = [];
    this.hand.forEach((unit, pos) => {
      const card = renderHandCard(unit, this.empowerStacks[pos] ?? [], selectable);
      if (entering === 'all' || (entering !== null && entering.has(pos))) {
        card.classList.add('preturn-card-enter');
        enteringNodes.push(card);
      }
      if (selectable) {
        if (this.selected.has(pos)) card.classList.add('is-selected');
        // A keyboard route (role=button, Enter and Space, src/ui/
        // pressable.ts); the hand re-renders on every pick, so the toggle's
        // `aria-pressed` is set at build time from the selection.
        pressable(card, { pressed: this.selected.has(pos) });
        card.addEventListener('click', () => this.onCardClick(pos));
      }
      cards.appendChild(card);
    });
    wrap.appendChild(cards);
    // The pile-pulse schedule plays only on the hand-swap refresh; the
    // other repaints (a cache, grant or empower change) leave the queue and
    // any playing schedule alone (`playCuesOnNextRefresh` says why).
    if (this.playCuesOnNextRefresh) {
      this.playCuesOnNextRefresh = false;
      this.scheduleCueSequence(enteringNodes);
    } else {
      enteringNodes.forEach((node, i) => {
        node.style.animationDelay = `${i * 45}ms`;
      });
    }

    const packets = this.renderPacketRow();
    if (packets.armable !== null) this.armSlotName = packets.armable;
    if (packets.count > 0) this.packetRowHeld = true;

    // The armed-packet banner (a card pick pending) outranks the strip's own
    // hints, as the passing mode the player chose. The line keeps its slot
    // (`reserveSlot`, `visibility: hidden`) from the moment a unit-target
    // chip could raise it.
    const hintName = armed?.packet.name ?? this.armSlotName;
    if (hintName !== null) {
      const banner = document.createElement('div');
      banner.className = 'preturn-arm-hint';
      banner.textContent = t('preturn.packet.armedHint', { name: hintName });
      if (armed === null) reserveSlot(banner);
      wrap.appendChild(banner);
    }

    if (this.grants.length > 0) wrap.appendChild(this.renderStrip());
    if (this.packetRowHeld) {
      if (packets.count === 0) {
        // An emptied row holds its height with one inert chip — the chip's
        // own box, not a measured min-height.
        const spacer = document.createElement('button');
        spacer.type = 'button';
        spacer.className = 'packet-chip';
        spacer.disabled = true;
        spacer.textContent = '▤';
        packets.row.appendChild(spacer);
        reserveSlot(packets.row);
      }
      wrap.appendChild(packets.row);
    }

    for (const name of this.deniedRedrawIdols) {
      wrap.appendChild(renderGateDenied(t('preturn.redraw.silent', { name })));
    }
    for (const name of this.deniedEmpowerIdols) {
      wrap.appendChild(renderGateDenied(t('preturn.empower.silent', { name })));
    }
  }

  /**
   * A hand card's click goes by what is armed. An armed packet fires on it
   * (`usePacket`, used up on the fire); an active empower grant fires on it
   * (one click is the pick); an active redraw grant toggles the card in its
   * selection, up to its own cap (confirmed on the chip). Refreshes ride the
   * result events; a toggle re-renders here.
   */
  private onCardClick(pos: number): void {
    const armed = this.armedPacket();
    if (armed !== null) {
      this.audio.play('click');
      this.dispatcher.dispatch({
        kind: 'usePacket',
        cacheIndex: armed.cacheIndex,
        handIndex: pos,
      });
      return; // the refresh rides run:packetUsed
    }
    const active = this.activeGrant();
    if (active === null) return;
    if (active.effect.kind === 'empower') {
      this.audio.play('click');
      this.dispatcher.dispatch({
        kind: 'empowerUnit',
        handIndex: pos,
        grantIndex: active.grantIndex,
      });
      return; // the refresh rides turn:unitEmpowered
    }
    if (this.selected.has(pos)) {
      this.selected.delete(pos);
    } else {
      if (this.selected.size >= active.effect.maxCards) return;
      this.selected.add(pos);
    }
    this.audio.play('click');
    this.refreshHand();
  }

  /**
   * The grant strip: one chip per queue entry in the order gained (the
   * order the engine enforces with `passIsFinal` on), and Pass while a
   * cursor exists. The active chip glows and carries its hint; an active
   * redraw chip is also the confirm button (enabled at 1 to `maxCards`
   * selected). Queued chips wait dimmed; spent and passed chips stay as the
   * turn's receipt, the passed ones struck.
   */
  private renderStrip(): HTMLDivElement {
    const strip = document.createElement('div');
    strip.className = 'preturn-strip';
    for (const grant of this.grants) strip.appendChild(this.renderGrantChip(grant));
    const active = this.activeGrant();
    if (active !== null) {
      const pass = document.createElement('button');
      pass.type = 'button';
      pass.className = 'preturn-pass';
      pass.textContent = `${t('common.pass')} ▸`;
      attachTooltip(pass, t('preturn.pass.tooltip', { name: active.name }), { touch: 'press' });
      pass.addEventListener('click', () => {
        this.audio.play('click');
        // The refresh rides turn:grantPassed → updateGrantPassed.
        this.dispatcher.dispatch({ kind: 'passGrant' });
      });
      strip.appendChild(pass);
    }
    return strip;
  }

  /** One grant chip. Active redraw = the confirm button; everything else
   *  is a state display (the card clicks do the acting). */
  private renderGrantChip(grant: TurnGrantView): HTMLButtonElement {
    const isActive = grant.active && !grant.passed && grant.remaining > 0;
    const chip = document.createElement('button');
    chip.type = 'button';
    const state = grant.passed
      ? 'passed'
      : grant.remaining <= 0
        ? 'spent'
        : isActive
          ? 'active'
          : 'queued';
    chip.className = `fire-chip fire-chip--${state}`;

    const summary =
      grant.effect.kind === 'redraw'
        ? `redraw ≤${grant.effect.maxCards}`
        : buffModsSummary(grant.effect.buff.mods);
    const main = document.createElement('span');
    main.className = 'fire-chip-main';
    main.textContent =
      `◈ ${grant.name} — ${summary}` + (grant.remaining > 1 ? ` ×${grant.remaining}` : '');
    chip.appendChild(main);

    if (isActive) {
      const hint = document.createElement('span');
      hint.className = 'fire-chip-hint';
      if (grant.effect.kind === 'empower') {
        hint.textContent = t('preturn.empower.hint');
        chip.disabled = true; // the cards are the buttons
      } else {
        const n = this.selected.size;
        hint.textContent = n === 0 ? t('preturn.swap.hint') : t('preturn.swap.confirm', { n });
        chip.disabled = n === 0 || n > grant.effect.maxCards;
        chip.addEventListener('click', () => {
          this.audio.play('click');
          // The refresh rides turn:handRedrawn → updateHand.
          this.dispatcher.dispatch({
            kind: 'redrawCards',
            handIndices: [...this.selected],
            grantIndex: grant.grantIndex,
          });
        });
      }
      chip.appendChild(hint);
    } else {
      chip.disabled = true;
    }
    return chip;
  }

  /**
   * The packet row: the held packets usable before a turn, read live from
   * the cache. A target-`none` chip fires on click, at will (before,
   * between or after the grant chips); a unit-target chip toggles the card
   * pick.
   */
  private renderPacketRow(): { row: HTMLDivElement; count: number; armable: string | null } {
    const row = document.createElement('div');
    row.className = 'preturn-packets';
    const label = document.createElement('span');
    label.className = 'preturn-packets-label';
    label.textContent = '▤ packets:';
    row.appendChild(label);

    let count = 0;
    let armable: string | null = null;
    this.getCache().forEach((id, cacheIndex) => {
      const packet = packetById(id);
      if (packet === undefined || !packet.usableIn.includes('preTurn')) return;
      row.appendChild(this.renderPacketChip(packet, cacheIndex));
      count += 1;
      if (armable === null && packet.target === 'unit') armable = packet.name;
    });
    return { row, count, armable };
  }

  private renderPacketChip(packet: PacketConfig, cacheIndex: number): HTMLButtonElement {
    const chip = document.createElement('button');
    chip.type = 'button';
    const isArmed = this.armedPacketIndex === cacheIndex;
    chip.className = `packet-chip${isArmed ? ' packet-chip--armed' : ''}`;
    chip.textContent = `▤ ${packet.name}`;
    // The packet's prose (its locale entry) on the first line, the click
    // hint on the second; a long press on touch, since the tap fires.
    attachTooltip(
      chip,
      `${packet.description}\n${packet.target === 'unit' ? t('preturn.packet.pickHint') : t('preturn.packet.fireHint')}`,
      { touch: 'press' },
    );
    chip.addEventListener('click', () => {
      this.audio.play('click');
      if (packet.target === 'none') {
        // Consume-on-fire; the refresh rides run:packetUsed.
        this.dispatcher.dispatch({ kind: 'usePacket', cacheIndex });
      } else {
        this.armedPacketIndex = isArmed ? null : cacheIndex;
        this.refreshHand();
      }
    });
    return chip;
  }
}

/** One drawn card: the shared `full` UnitCard (the pre-turn skin), so the
 *  hand shows the same stats, abilities and XP bar as the roster's cards. A
 *  buffed card (its roster slot carries buffs) stacks one `▲` chip per buff
 *  key in the badge corner, each with its own key and mods (the payload's
 *  per-key `EmpowerStackView` list). A `selectable` card is built as a
 *  control, so its rarity stars take the long-press and a tap is the pick;
 *  the selection's state and click are the caller's. */
function renderHandCard(
  unit: UnitTemplate,
  stacks: readonly EmpowerStackView[],
  selectable: boolean,
): HTMLDivElement {
  const { el } = buildUnitCard(unitCardFromTemplate(unit), {
    mode: 'full',
    skin: 'preturn',
    clickable: selectable,
  });

  if (stacks.length > 0) {
    const badge = document.createElement('div');
    badge.className = 'preturn-card-empower';
    for (const stack of stacks) {
      const chip = document.createElement('div');
      chip.className = 'preturn-card-empower-chip';
      chip.dataset['buffKey'] = stack.key;
      // The key's colour from the shared EMPOWER_DISPLAY map, the colour the
      // battle's marker uses, so the vocabulary carries over.
      chip.style.color = empowerColor(stack.key);
      chip.textContent = stack.magnitude <= 3 ? '▲'.repeat(stack.magnitude) : `▲×${stack.magnitude}`;
      // The label beside the triangles, always shown.
      const label = document.createElement('span');
      label.className = 'preturn-card-empower-chip-label';
      label.textContent = empowerLabel(stack.key);
      chip.appendChild(label);
      // A text site nested in a control (the card's click is the redraw or
      // empower pick), so the touch route is the long press: a tap on the
      // badge corner belongs to the card. Tab reaches it.
      chip.tabIndex = 0;
      attachTooltip(chip, buffChipTooltip(stack.key, stack.magnitude, stack.mods), { touch: 'press' });
      badge.appendChild(chip);
    }
    el.appendChild(badge);
  }

  return el;
}

/** The inert line a chance-denied gate leaves where its control would be
 *  (Mercury's cold coin). A spent gate leaves none. */
function renderGateDenied(text: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'preturn-gate-denied';
  row.textContent = `◈ ${text}`;
  return row;
}

/**
 * The last-turn strip: one line under the gauges, `Last turn · Skirmish won
 * · yours M M −2 · theirs A M M R −7`, off the previous turn as
 * `turn:starting` carries it (`lastTurn`). The fallen rows are copies of
 * `Run.fallenLedger`'s, and each side's power over the turn is what the
 * casualty rule charged, so the numbers are the ledger's, not derived
 * again. The loss numbers carry the rule's wording as a tooltip
 * (`chipLineLabels`).
 */
function renderLastTurn(info: LastTurn): HTMLDivElement {
  const strip = document.createElement('div');
  strip.className = 'preturn-lastturn';

  const label = document.createElement('span');
  label.className = 'preturn-lastturn-label';
  label.textContent = t('lastturn.label');

  const result = document.createElement('span');
  result.className = `preturn-lastturn-result preturn-lastturn-result--${info.winner}`;
  result.textContent =
    info.winner === 'player'
      ? t('lastturn.won')
      : info.winner === 'enemy'
        ? t('lastturn.lost')
        : info.reason === 'cap'
          ? t('lastturn.drawnCap')
          : t('lastturn.drawnWipe');

  const labels = chipLineLabels(rulesForTurn(info.reason));
  strip.append(
    label,
    result,
    lastTurnSide('player', t('lastturn.yours'), info.fallen, labels.toPlayerPool),
    lastTurnSide('enemy', t('lastturn.theirs'), info.fallen, labels.toEnemyPool),
  );
  return strip;
}

/** One side of the strip: its label, its fallen as a glyph run (`nobody
 *  fell` when none), and the loss the rows add up to. */
function lastTurnSide(
  side: 'player' | 'enemy',
  label: string,
  rows: readonly FallenRecord[],
  ruleWording: string,
): HTMLSpanElement {
  // The cell is fallenSide.ts's, which the run-end stats use too. One
  // fallen per line: a text site, a tap toggles it, and Tab reaches it.
  const mine = rows.filter((r) => r.side === side);
  return fallenSide({
    side,
    label,
    glyphs: fallenGlyphRun(mine),
    glyphTooltip: fallenLines(mine),
    loss: mine.reduce((s, r) => s + r.power, 0),
    lossTooltip: ruleWording,
  });
}

