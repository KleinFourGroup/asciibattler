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
 * `empowerUnit` command). Buffed cards carry `▲` chips (78c: one chip PER
 * BUFF KEY, each hover-titled with its own mods — the `empowerStacks`
 * column the events deliver, so a card empowered on an earlier turn and
 * drawn back still badges). Same events-only refresh:
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
 * budget retired with the §49 shape-lock) drives the strip below, and
 * every command carries `grantIndex`.
 *
 * 49f — THE GUIDED FIRE STRIP (the §49 fire-UX shape-lock, rendered): one
 * chip per queue entry in acquisition order; the ACTIVE chip (the engine's
 * derived cursor — `grantViews[].active`) auto-arms with a glow + effect
 * hint, and the hand cards on screen are its click targets. An armed
 * EMPOWER fires on a single card click; an armed REDRAW multi-selects up
 * to its card cap and confirms ON THE CHIP. **Pass ▸** finalizes the
 * active grant unspent (`passGrant` — `passIsFinal` flipped TRUE in this
 * commit, the locked default; the engine enforces the order, this strip
 * just renders it honestly). Fight ▸ stays the implicit pass-all (the
 * queue expires at turn start). Later chips render queued/dimmed; passed
 * chips render struck. The strip is strict-shaped even under a free-mode
 * config override (a test/fuzz relaxation — the UI never offers more than
 * strict allows).
 *
 * 49f — the at-will PACKET row: the gate's held `preTurn`-usable packets
 * (read live from the cache via the injected thunk) render as their own
 * chips BELOW the strip — at-will, any moment during the gate, before or
 * between idol chips (the kickoff economy lock). A target-`none` packet
 * fires on chip click; a unit-target one (hype) ARMS pick-a-card targeting
 * (click again to cancel). Fires ride the same `usePacket` command the
 * cache modal uses; the screen refreshes off `run:packetUsed` /
 * `run:cacheChanged` (PreTurnScene forwards both).
 */

import type { GameEvents } from '../core/events';
import type { UnitTemplate } from '../sim/Unit';
import type { TurnGrantView } from '../run/daemon';
import type { EmpowerStackView } from '../run/empower';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { getLayout, PROCEDURAL_MAP_NAME } from '../sim/layouts';
import { packetById, type PacketConfig } from '../config/packets';
import { DECK } from '../config/deck';
import { fadeIn, fadeOutAndRemove } from './fade';
import { renderPoolGauge } from './poolGauge';
import { buildUnitCard, unitCardFromTemplate, buffKeyLabel, buffModsSummary } from './UnitCard';
import { empowerColor } from '../render/statusDisplay';
import { CardListButton } from './CardListModal';

/**
 * 65f — one deck-transaction cue (the `deck:*` event stream): buffered by
 * Game for the deal (the cues fire before `turn:starting` mounts the
 * scene) and forwarded live by PreTurnScene for gate-time actions. The
 * screen queues them and plays the pile pulses SERIALLY on its own clock;
 * the swap payloads stay authoritative (cue-not-truth — events.ts).
 */
export interface DeckCue {
  readonly kind: 'drawn' | 'discarded' | 'reshuffled';
  readonly drawPile: number;
  readonly discardPile: number;
}

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
  private empowerStacks: readonly EmpowerStackView[][] = [];
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
  // 49f — the held cache, read LIVE at render time (a thunk from
  // PreTurnScene — `ctx.run.cache`), so the packet row always reflects the
  // authoritative cache; and the armed unit-target packet (hype's
  // pick-a-card state), a CACHE index. Any cache change disarms — indices
  // shift under fires/discards, and re-deriving beats holding a stale one.
  private getCache: () => readonly string[] = () => [];
  private armedPacketIndex: number | null = null;
  // R1/R2 — the shared card-list affordances: roster (top-right) + draw
  // (bottom-right) + discard (bottom-left) pile views. All disposed on hide.
  private cardListButtons: CardListButton[] = [];
  // 65e — the folded per-turn draw amount (the "Draw: N" chip; the §65
  // transparency surface). Set in `show` from the turn:starting payload.
  private drawAmount = 0;
  // 65e — hand positions to ENTER-animate on the next `refreshHand` ('all'
  // = the initial deal, staggered). Consumed once, then cleared — refreshes
  // driven by non-hand events (cache/grant changes) must not replay it.
  private enterPositions: Set<number> | 'all' | null = null;
  // 65f — the queued deck cues (seeded by `show` from Game's deal buffer,
  // appended live by PreTurnScene at the gate), the serial-pulse timers,
  // the transient displayed-count overrides (null = authoritative), the
  // exit clones awaiting their cue, and named pile-button refs.
  private pendingCues: DeckCue[] = [];
  // 65f — cues are consumed ONLY by the refresh that carries the hand swap
  // (show / updateHand). The intermediate repaints of the same dispatch
  // (run:cacheChanged / run:packetUsed fire BEFORE the hand emit) must
  // neither consume the queue nor cancel a playing schedule — the first
  // browser-verify caught exactly that: an early refresh consumed the cues
  // and the final one killed the freshly scheduled timers, stranding the
  // count overrides at their pre-sequence values.
  private playCuesOnNextRefresh = false;
  private cueTimers: number[] = [];
  private displayedDraw: number | null = null;
  private displayedDiscard: number | null = null;
  private exitClones: HTMLElement[] = [];
  private drawPileButton: CardListButton | null = null;
  private discardPileButton: CardListButton | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {}

  show(
    info: GameEvents['turn:starting'],
    roster: readonly UnitTemplate[],
    getCache: () => readonly string[],
    dealCues: readonly DeckCue[] = [],
  ): void {
    this.hide();
    this.roster = roster;
    this.getCache = getCache;
    this.armedPacketIndex = null;
    this.hand = info.hand;
    this.drawPile = info.drawPile;
    this.discardPile = info.discardPile;
    this.drawAmount = info.drawAmount;
    this.enterPositions = 'all'; // 65e — the initial deal animates in, staggered
    // 65f — the deal's cue sequence, buffered by Game since the scene
    // wasn't mounted yet. The LEADING discarded cues are the previous
    // turn's hand recycling — its epilogue, not this turn's story — so the
    // playback drops them (the user's turn-2 feel read): the screen opens
    // with the discard count already at its post-recycle value and the
    // narrative starts at the deal. The recycle is always a strict prefix
    // (drawTurnHand discards before it draws); a mid-DEAL reshuffle stays,
    // and on a dry-pile turn the sequence now OPENS on the reshuffle
    // flash. Presentation policy only — the Run's cue stream stays honest
    // at the chokepoint.
    const deal = [...dealCues];
    while (deal[0]?.kind === 'discarded') deal.shift();
    this.pendingCues = deal;
    this.playCuesOnNextRefresh = true;
    this.grants = info.grants;
    this.empowerStacks = info.empowerStacks;
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
    // 65f — kill the pulse schedule FIRST (its callbacks touch the buttons
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
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
    }
    this.handWrap = null;
    this.poolsEl = null;
    this.armedPacketIndex = null;
  }

  /** 65f — a live deck cue landed at the gate (PreTurnScene forwards the
   *  `deck:*` events): queue it for the swap event that follows in the same
   *  dispatch (the cues always precede `turn:handRedrawn` — Run emits the
   *  hand swap LAST). */
  enqueueCue(cue: DeckCue): void {
    this.pendingCues.push(cue);
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
    // 65e — identity diff BEFORE the swap (payload hand entries are
    // references into the run's team templates, so `===` is a stable card
    // key): changed/new positions enter-animate; outgoing cards exit as
    // fixed-position clones. Redraw = same length (replaced slots exit AND
    // enter); Surge = longer (appended slots enter); Cull = shorter (the
    // two-pointer walk finds the spliced-out cards).
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
    this.playCuesOnNextRefresh = true; // 65f — this IS the hand-swap refresh

    this.hand = payload.hand;
    // R2 — the redraw shuffled cards between piles; refresh the stored copies so
    // a reopened pile view reflects it (the buttons read these at click time).
    this.drawPile = payload.drawPile;
    this.discardPile = payload.discardPile;
    this.grants = payload.grants;
    this.empowerStacks = payload.empowerStacks;
    this.selected.clear();
    this.refreshHand();
    // 51e — the pile counts on the chip faces moved with the cards.
    for (const button of this.cardListButtons) button.refresh();
  }

  /**
   * 65e — exit animation: clone each outgoing card at its current screen
   * rect (the hand row is about to be rebuilt), let the clone fall/fade via
   * CSS, then remove it. Pure presentation — the authoritative state moved
   * in the Run before the event fired. Positions index the OLD hand row.
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
      // 65f — the clone holds as a static GHOST (fixed, in place) until its
      // discard cue fires in the serial schedule; `beginExit` starts the
      // fall. scheduleCueSequence pairs clones to cues in creation order.
      clone.classList.add('preturn-card-ghost');
      clone.style.left = `${rect.left}px`;
      clone.style.top = `${rect.top}px`;
      clone.style.width = `${rect.width}px`;
      this.mount.appendChild(clone);
      this.exitClones.push(clone);
    }
  }

  /** 65f — start a ghost clone's exit fall + arrange its removal
   *  (animationend is the normal path; the timeout is the safety net — a
   *  backgrounded tab can throttle animations indefinitely). */
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

  /** 65f — repaint just the two pile chips (their `getCount` thunks read
   *  the displayed overrides while a pulse schedule is playing). */
  private refreshPileButtons(): void {
    this.drawPileButton?.refresh();
    this.discardPileButton?.refresh();
  }

  /** 65f — one chip pulse: retrigger the CSS animation via class removal +
   *  a forced reflow. */
  private pulse(button: CardListButton | null, cls: string): void {
    const el = button?.el;
    if (!el) return;
    el.classList.remove('card-list-button--pulse', 'card-list-button--reshuffle');
    void el.offsetWidth; // reflow — restart the animation
    el.classList.add(cls);
  }

  /**
   * 65f — play the queued deck cues SERIALLY (the §65f shape-lock: one
   * pulse per card, counts ticking one by one; the reshuffle is a single
   * distinct pulse). Runs at the end of every `refreshHand`:
   * - each `drawn` cue reveals its entering card (animation-delay synced
   *   to the pulse cadence) and pulses the draw chip;
   * - each `discarded` cue releases its exit ghost and pulses the discard
   *   chip;
   * - `reshuffled` pulses BOTH chips once with the distinct flash.
   * The displayed counts ride overrides and reconcile to the authoritative
   * piles when the schedule drains. Fight ▸ stays LIVE throughout — the
   * user-signed fast-forward: advancing hides the screen, which clears the
   * timers and sweeps the ghosts (never make the player wait for theater).
   * No cues queued → the 65e quick stagger + immediate exits (the
   * empower/cache refreshes and any diff the cues didn't cover).
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
    // Seed the displayed counts at the PRE-sequence values, reconstructed
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
   * K4 — a `turn:unitEmpowered` landed (PreTurnScene forwards it): the hand is
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
   * 49f — a `run:packetUsed` landed while this gate is up (PreTurnScene
   * forwards it): a cache-modal fire just changed gate state — a reroute
   * INSERTED a redraw grant, a patch healed the player pool, a venom
   * changed nothing visible here. Swap in the re-derived queue + badges and
   * re-render the pools from the post-effect health (same events-only
   * refresh as the redraw/empower paths).
   */
  updatePacketUsed(payload: GameEvents['run:packetUsed']): void {
    this.grants = payload.grants;
    this.empowerStacks = payload.empowerStacks;
    this.selected.clear();
    this.armedPacketIndex = null; // the fire consumed a slot — indices shifted
    this.refreshHand();
    if (this.poolsEl !== null) {
      this.poolsEl.replaceChildren(
        renderPoolGauge('player', 'Your Pool', payload.playerHealth, this.poolBounds.playerMax),
        renderPoolGauge('enemy', 'Enemy Pool', this.poolBounds.enemy, this.poolBounds.enemyMax),
      );
    }
  }

  /**
   * 49f — a `passGrant` finalized the active grant (`turn:grantPassed`,
   * strict mode): swap in the re-derived queue so the strip advances its
   * auto-arm to the new cursor.
   */
  updateGrantPassed(payload: GameEvents['turn:grantPassed']): void {
    this.grants = payload.grants;
    this.selected.clear();
    this.refreshHand();
  }

  /**
   * 49f — the cache changed under this gate (a modal discard, a reward
   * accept can't happen here but addDaemon shrink can): re-render the
   * packet row from the live thunk. Indices shifted → disarm.
   */
  updateCache(): void {
    this.armedPacketIndex = null;
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
    // 51e — the face labels carry live counts ("Draw Pile · 12"), re-read
    // via refresh() wherever the stored pile copies swap (updateHand).
    // 65f — the pile buttons get named refs (the pulse targets), and their
    // counts read the schedule's displayed overrides while a serial pulse
    // sequence plays (null = the authoritative pile).
    this.drawPileButton = new CardListButton(this.mount, this.audio, {
      text: 'Draw Pile',
      title: 'Draw Pile',
      position: 'draw',
      getUnits: () => this.drawPile,
      getCount: () => this.displayedDraw ?? this.drawPile.length,
      emptyText: 'The draw pile is empty.',
    });
    this.discardPileButton = new CardListButton(this.mount, this.audio, {
      text: 'Discard Pile',
      title: 'Discard Pile',
      position: 'discard',
      getUnits: () => this.discardPile,
      getCount: () => this.displayedDiscard ?? this.discardPile.length,
      emptyText: 'The discard pile is empty.',
    });
    this.cardListButtons = [
      new CardListButton(this.mount, this.audio, {
        text: 'Roster',
        title: 'Your Roster',
        position: 'roster',
        getUnits: () => this.roster,
        getCount: () => this.roster.length,
        emptyText: 'No units in your roster.',
      }),
      this.drawPileButton,
      this.discardPileButton,
    ];
    for (const button of this.cardListButtons) panel.appendChild(button.el);

    // 65e — the "Draw: N" chip (the §65 transparency surface): the folded
    // per-turn draw amount, anchored above the Draw Pile button — where the
    // player already reasons about the deck. Non-interactive.
    const drawChip = document.createElement('div');
    drawChip.className = 'preturn-draw-chip';
    drawChip.textContent = `Draw: ${this.drawAmount}`;
    drawChip.title =
      'Cards dealt into your hand each turn. Daemons can raise it permanently; packets can draw extra this turn.';
    panel.appendChild(drawChip);

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

  /** 49f — the strip's cursor: the engine-derived active grant (first
   *  pending — `grantViews[].active`), or null when the queue is spent. */
  private activeGrant(): TurnGrantView | null {
    return this.grants.find((g) => g.active && !g.passed && g.remaining > 0) ?? null;
  }

  /** 49f — the armed unit-target packet, re-resolved from the LIVE cache
   *  (never a held def — indices shift under fires/discards; a dangling
   *  index resolves to null, i.e. disarmed). */
  private armedPacket(): { cacheIndex: number; packet: PacketConfig } | null {
    if (this.armedPacketIndex === null) return null;
    const id = this.getCache()[this.armedPacketIndex];
    const packet = id !== undefined ? packetById(id) : undefined;
    if (packet === undefined) return null;
    return { cacheIndex: this.armedPacketIndex, packet };
  }

  /**
   * K3/K4→49f — (re)build the hand block in place: label, card row
   * (clickable while something is armed), the GUIDED STRIP (one chip per
   * queue entry + Pass), the at-will packet row, and the denial lines.
   * Runs at first render and after every gate event (`turn:handRedrawn` /
   * `turn:unitEmpowered` / `turn:grantPassed` / `run:packetUsed` /
   * `run:cacheChanged`) — one render path, no optimistic copies.
   */
  private refreshHand(): void {
    const wrap = this.handWrap;
    if (!wrap) return;
    wrap.replaceChildren();

    const label = document.createElement('div');
    label.className = 'preturn-hand-label';
    label.textContent = `Your hand — ${this.hand.length} drawn`;
    wrap.appendChild(label);

    const armed = this.armedPacket();
    const active = this.activeGrant();
    const selectable = armed !== null || active !== null;
    const cards = document.createElement('div');
    cards.className = 'preturn-hand-cards';
    // 73c — balanced two-row wrap past the standard deal: cap the row at
    // ceil(n/2) columns so an over-drawn hand (Surge under maxHandSize 10)
    // wraps 5+5 instead of orphaning a second row (9+1 at 1920px). Hands at
    // or under the configured deal keep the single row. Card width/gap are
    // the CSS vars on this class (ui.css) — no pixel constants here.
    if (this.hand.length > DECK.handSize) {
      const cols = Math.ceil(this.hand.length / 2);
      cards.style.maxWidth = `calc(${cols} * var(--hand-card-w) + ${cols - 1} * var(--hand-gap))`;
    }
    // 65e — the one-shot enter set (the initial deal, a redraw refill, a
    // Surge draw). 65f: the entering nodes are collected in reveal order
    // and handed to the cue scheduler, which syncs each card's delay to
    // its `drawn` pulse (falling back to the quick stagger when no cues
    // are queued).
    const entering = this.enterPositions;
    this.enterPositions = null;
    const enteringNodes: HTMLElement[] = [];
    this.hand.forEach((unit, pos) => {
      const card = renderHandCard(unit, this.empowerStacks[pos] ?? []);
      if (entering === 'all' || (entering !== null && entering.has(pos))) {
        card.classList.add('preturn-card-enter');
        enteringNodes.push(card);
      }
      if (selectable) {
        card.classList.add('unit-card--clickable');
        if (this.selected.has(pos)) card.classList.add('is-selected');
        card.addEventListener('click', () => this.onCardClick(pos));
      }
      cards.appendChild(card);
    });
    wrap.appendChild(cards);
    // 65f — the serial pile-pulse schedule plays ONLY on the hand-swap
    // refresh; intermediate repaints (cache/grant/empower) leave the queue
    // and any playing schedule alone (see the playCuesOnNextRefresh doc).
    if (this.playCuesOnNextRefresh) {
      this.playCuesOnNextRefresh = false;
      this.scheduleCueSequence(enteringNodes);
    } else {
      enteringNodes.forEach((node, i) => {
        node.style.animationDelay = `${i * 45}ms`;
      });
    }

    // The armed-packet banner (hype's pick-a-card state) outranks the
    // strip's own hints — it's the transient, user-initiated mode.
    if (armed !== null) {
      const banner = document.createElement('div');
      banner.className = 'preturn-arm-hint';
      banner.textContent =
        `▤ ${armed.packet.name} armed — click a card to fire it (click the chip again to cancel)`;
      wrap.appendChild(banner);
    }

    if (this.grants.length > 0) wrap.appendChild(this.renderStrip());
    const packetRow = this.renderPacketRow();
    if (packetRow !== null) wrap.appendChild(packetRow);

    for (const name of this.deniedRedrawIdols) {
      wrap.appendChild(renderGateDenied(`${name} is silent — no redraw this turn`));
    }
    for (const name of this.deniedEmpowerIdols) {
      wrap.appendChild(renderGateDenied(`${name} is silent — no empower this turn`));
    }
  }

  /**
   * 49f — a hand-card click routes by what's armed. An armed PACKET fires
   * on it (usePacket, consume-on-fire); an active EMPOWER grant fires on it
   * (one click = the pick — the strip's inline hand targeting); an active
   * REDRAW grant toggles the multi-select up to ITS card cap (confirm on
   * the chip). Refreshes ride the result events (the J3 events-only
   * pattern) — a toggle re-renders locally.
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
   * 49f — the guided strip: one chip per queue entry in acquisition order
   * (the resolve-walk order the strict engine enforces), plus Pass while a
   * cursor exists. The ACTIVE chip glows and carries its hint; an active
   * REDRAW chip is also the confirm button (enabled at 1..maxCards
   * selected). Queued chips wait dimmed; spent/passed chips stay as the
   * turn's receipt (passed = struck).
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
      pass.textContent = 'Pass ▸';
      pass.title = `Skip ${active.name} — final for this turn (the queue moves on)`;
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
        hint.textContent = 'click a card to empower';
        chip.disabled = true; // the cards are the buttons
      } else {
        const n = this.selected.size;
        hint.textContent = n === 0 ? 'click cards to swap' : `swap ${n} ▸ confirm`;
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
   * 49f — the at-will packet row: the held `preTurn`-usable packets, read
   * LIVE from the cache. A target-`none` chip fires on click (before,
   * between, or after idol chips — the at-will economy lock); a unit-target
   * chip (hype) toggles the pick-a-card arming state.
   */
  private renderPacketRow(): HTMLDivElement | null {
    const row = document.createElement('div');
    row.className = 'preturn-packets';
    const label = document.createElement('span');
    label.className = 'preturn-packets-label';
    label.textContent = '▤ packets:';
    row.appendChild(label);

    let count = 0;
    this.getCache().forEach((id, cacheIndex) => {
      const packet = packetById(id);
      if (packet === undefined || !packet.usableIn.includes('preTurn')) return;
      row.appendChild(this.renderPacketChip(packet, cacheIndex));
      count += 1;
    });
    return count > 0 ? row : null;
  }

  private renderPacketChip(packet: PacketConfig, cacheIndex: number): HTMLButtonElement {
    const chip = document.createElement('button');
    chip.type = 'button';
    const isArmed = this.armedPacketIndex === cacheIndex;
    chip.className = `packet-chip${isArmed ? ' packet-chip--armed' : ''}`;
    chip.textContent = `▤ ${packet.name}`;
    chip.title =
      packet.description +
      (packet.target === 'unit' ? ' — click, then pick a card' : ' — fires on click');
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

/** P3 — one drawn card: the shared `full` UnitCard (pre-turn skin), so the hand
 *  shows the same all-stats + abilities-with-derived-stats + XP-to-next bar the
 *  player drafts on. K4→78c — a buffed card (its roster slot carries buffs)
 *  stacks ONE `▲` chip PER BUFF KEY in the badge corner, each titled with its
 *  own key + mods (the payload's per-key `EmpowerStackView` list — the old
 *  summed integer merged five keys' hover text into one line). The selection
 *  (K3 redraw / K4 empower) classes + click ride on top, applied by the
 *  caller. */
function renderHandCard(unit: UnitTemplate, stacks: readonly EmpowerStackView[]): HTMLDivElement {
  const { el } = buildUnitCard(unitCardFromTemplate(unit), { mode: 'full', skin: 'preturn' });

  if (stacks.length > 0) {
    const badge = document.createElement('div');
    badge.className = 'preturn-card-empower';
    for (const stack of stacks) {
      const chip = document.createElement('div');
      chip.className = 'preturn-card-empower-chip';
      chip.dataset['buffKey'] = stack.key;
      // 78d — per-key color off the shared EMPOWER_DISPLAY map (the same
      // color the in-battle marker uses, so the vocabulary carries over).
      chip.style.color = empowerColor(stack.key);
      chip.textContent = stack.magnitude <= 3 ? '▲'.repeat(stack.magnitude) : `▲×${stack.magnitude}`;
      chip.title = `${buffKeyLabel(stack.key)} ×${stack.magnitude} — ${buffModsSummary(stack.mods)}`;
      badge.appendChild(chip);
    }
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

