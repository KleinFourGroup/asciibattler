// The battle HUD: the speed strip, the objective pane, the two card panes
// (the player's at the bottom, the enemy's at the top, each with its pool
// gauge), the hop chip, the location banner and the pre-battle countdown.
// The cards follow the battle off the bus (`unit:*`, `status:ticked`), and
// the gauges' ghosts follow the deaths and the battle's end.

import type { EventBus } from '../core/EventBus';
import { t } from '../i18n/ui';
import { attachTooltip, keyedTooltip, refreshTooltip } from './tooltip';
import { pressable } from './pressable';
import type { GameEvents } from '../core/events';
import type { World } from '../sim/World';
import type { Unit } from '../sim/Unit';
import { fadeIn, fadeOutAndRemove } from './fade';
import {
  buildUnitCard,
  unitCardFromUnit,
  updateCardStatusRow,
  updateCardEmpowerMarkers,
  type UnitCardHandles,
} from './UnitCard';
import { EMPOWER_DISPLAY } from '../render/statusDisplay';
import { readUnitStatuses } from '../sim/statusReadout';
import { createPoolGauge, type PoolGaugeHandle } from './poolGauge';
import {
  bookedImmediateLoss,
  lossEventsAtEnd,
  lossEventsForDeath,
  type PoolLossEvent,
} from '../run/chipRule';
import {
  SETTLE_MS,
  SURVIVOR_STAGGER_MS,
  centerOf,
  flyOrb,
  lossCue,
  shakeAllowed,
  shakeView,
  type OrbHandle,
} from './lossFx';
import { reducedMotion } from '../render/motion';

/** A wall-clock wait: the loss fx are presentation and never read the sim's clock. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
import type { PlaybackSpeed } from './PlaybackSpeed';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { Keybindings } from './Keybindings';
import type { KeybindAction } from '../config/keybindings';
import type { ObjectiveControls, ObjectiveArmMode } from './ObjectiveController';

/** The rebindable action that sets each speed, for its button's hotkey and
 *  tooltip. A config speed outside this map still gets a button, with no
 *  hotkey; a hotkey for a disabled speed is not subscribed. */
const SPEED_HOTKEY: ReadonlyMap<number, KeybindAction> = new Map([
  [0.5, 'speedHalf'],
  [1, 'speed1'],
  [2, 'speed2'],
  [3, 'speed3'],
]);

/** The objective pane's four commands. `stop` returns the team to at-will.
 *  `engage` and `focus` arm a target pick; `hold` and `stop` apply on click. */
type ObjectiveButtonMode = ObjectiveArmMode | 'hold' | 'stop';

interface ObjectiveButtonDef {
  readonly mode: ObjectiveButtonMode;
  readonly label: string;
  /** A small leading glyph; focus's `!` is the board's focus marker. */
  readonly icon: string;
  readonly action: KeybindAction;
  /** Whether the button arms a target pick (engage, focus) or applies at once. */
  readonly arms: boolean;
}

const OBJECTIVE_BUTTONS: readonly ObjectiveButtonDef[] = [
  {
    mode: 'engage',
    label: t('hud.objective.engage'),
    icon: '◎',
    action: 'engageObjective',
    arms: true,
  },
  {
    mode: 'focus',
    label: t('hud.objective.focus'),
    icon: '!',
    action: 'focusObjective',
    arms: true,
  },
  { mode: 'hold', label: t('hud.objective.hold'), icon: '⊓', action: 'holdObjective', arms: false },
  { mode: 'stop', label: t('hud.objective.stop'), icon: '✕', action: 'stopObjective', arms: false },
];

/** The pools the HUD shows, as BattleScene reads them from the Run. */
interface EncounterPools {
  turn: number;
  playerHealth: number;
  playerHealthMax: number;
  enemyHealth: number;
  enemyHealthMax: number;
  /** The encounter's name, the enemy gauge's label; "Foe" when absent. */
  enemyName?: string;
  /** The pre-turn risk bound (`Run.previewPoolAtRisk`, the risk line's
   *  number): the player gauge's notch, which the ghost grows toward, so the
   *  two screens read as one. */
  poolAtRisk?: number;
  /** The enemy pool's bound (`Run.previewPoolsAtRisk().enemy`), the enemy
   *  gauge's notch: one gauge notched and the other not reads as an
   *  oversight. */
  enemyPoolAtRisk?: number;
}

export class HUD {
  private readonly banner: HTMLElement;
  /** The hop chip's and the banner's row (ui.css `.hud-top`). */
  private readonly topRow: HTMLElement;
  private readonly hopLabel: HTMLElement;
  /** The speed strip (the control column's second row): a pause toggle and
   *  one button per enabled speed, repainted on each change. The speed and
   *  the paused state live on the page-lifetime `playback`. */
  private readonly speedPane: HTMLElement;
  /** Speed value → its pane button, for the active-state repaint. */
  private readonly speedButtons = new Map<number, HTMLButtonElement>();
  /** The pause/play toggle, or null when `pauseEnabled` is off (no control). */
  private readonly pauseButton: HTMLButtonElement | null;
  /** The pre-battle countdown (centered): "Battle begins in" over the count,
   *  and a Fight now button. BattleScene drives it through `showCountdown`
   *  and `hideCountdown`. */
  private readonly countdownEl: HTMLElement;
  private readonly countdownCount: HTMLElement;
  /** Whether the countdown is on-screen — flips the pause toggle's label to
   *  "Fight now" while it holds. */
  private inCountdown = false;
  /** Last whole-second painted into the readout, to skip redundant DOM writes. */
  private countdownShown = -1;
  /** Tears down the countdown's anchor watch (the enemy pane's
   *  ResizeObserver and the window's resize listener); null while not
   *  counting. */
  private countdownAnchorWatch: (() => void) | null = null;
  private readonly playback: PlaybackSpeed;
  /** The hotkey registry. The HUD subscribes the speed strip's and the
   *  objective pane's controls to it, and reads `labelFor` for their words,
   *  so a rebind shows. */
  private readonly keybindings: Keybindings;
  /** The objective input controller, owned by BattleScene; the pane's
   *  buttons, their hotkeys and the enemy cards drive it. */
  private readonly objective: ObjectiveControls;
  /** The page-lifetime audio player (from the scene's context), for the
   *  landing cue. */
  private readonly audio: AudioPlayer;
  /** The objective pane (bottom right): Engage, Focus, Hold and Stop. */
  private readonly objectivePane: HTMLElement;
  /** Objective mode → its pane button, for the active/armed repaint. */
  private readonly objectiveButtons = new Map<ObjectiveButtonMode, HTMLButtonElement>();
  /** The mode currently being target-picked (engage/focus), or null — flipped by
   *  the controller via `setObjectiveArmed`. */
  private armedMode: ObjectiveArmMode | null = null;
  /** The player team's objective mode, tracked off `objective:set` and
   *  `objective:cleared`, so the active button reads engaged. `'atWill'`, the
   *  default, matches no button: Stop is an action (clear the objective), not
   *  a state, so it is never highlighted. */
  private activeObjectiveMode: ObjectiveButtonMode | 'atWill' = 'atWill';
  /** The player's pane (bottom center): a wrapping row of compact cards for
   *  the fielded units, with the run's pool gauge under it. */
  private readonly playerCardPane: HTMLElement;
  /** The wrapping row the compact cards mount into. */
  private readonly playerCardRow: HTMLElement;
  /** The run health-pool gauge's slot beneath the cards (repainted in show()). */
  private readonly playerPoolWrap: HTMLElement;
  /** The enemy's pane (top center, under the banner): the encounter's pool
   *  gauge over a wrapping row of the enemy's compact cards, the player
   *  pane's mirror. */
  private readonly enemyCardPane: HTMLElement;
  /** The wrapping row the enemy compact cards mount into. */
  private readonly enemyCardRow: HTMLElement;
  /** The enemy encounter-pool gauge's slot above the cards (repainted in show()). */
  private readonly enemyPoolWrap: HTMLElement;
  /** The live gauge handles, null when `show` gets no encounter; the loss
   *  events move their ghosts. */
  private playerGauge: PoolGaugeHandle | null = null;
  private enemyGauge: PoolGaugeHandle | null = null;
  /** The loss per pool not yet booked this battle (uncapped; the gauge
   *  clamps). A restore opens it at the fallen already booked. */
  private pending = { player: 0, enemy: 0 };
  /** The orbs in flight (cancelled on dispose, so a teardown mid-flight
   *  leaves no glyph on the page) and their landing promises. */
  private readonly orbs = new Set<OrbHandle>();
  private readonly inFlight = new Set<Promise<void>>();
  /** The after-battle settle: the end sequence launched, every orb landed,
   *  the settle beat, the commit. Null until `battle:ended`. */
  private settled: Promise<void> | null = null;
  /** unitId → its compact card handles, for O(1) HP refresh + death gray-out.
   *  BOTH teams (player + enemy); dead cards stay (grayed) for positional
   *  stability. The team is fixed at spawn, so one map keyed by id suffices —
   *  only the append target (which pane's row) differs. */
  private readonly cards = new Map<number, UnitCardHandles>();
  private world: World | null = null;
  /** The sim tick the cards' status rows were last painted at. The readout
   *  is the same between ticks, so `refreshStatuses` recomputes at most once
   *  a tick (BattleScene calls it every frame). `-1` forces a first pass. */
  private statusTick = -1;
  /** Bus and hotkey unsubscribers. The HUD lives for one battle (BattleScene
   *  owns it), so `dispose` tears them down and they don't pile up across
   *  battles. */
  private readonly subscriptions: Array<() => void> = [];
  /** The enemy cards' tooltip detaches, keyed by unit (torn down with the
   *  cards at `show()` and `dispose()`). */
  private readonly cardTooltips = new Map<number, () => void>();

  constructor(
    mount: HTMLElement,
    bus: EventBus<GameEvents>,
    playback: PlaybackSpeed,
    keybindings: Keybindings,
    objective: ObjectiveControls,
    audio: AudioPlayer,
    /** The control column's second row (src/ui/chip.ts): the speed strip's
     *  place, under the settings chip. */
    controlSlot: HTMLElement,
  ) {
    this.playback = playback;
    this.keybindings = keybindings;
    this.objective = objective;
    this.audio = audio;

    // The banner: the battle's ground, as BattleScene words it.
    this.banner = document.createElement('div');
    this.banner.className = 'battle-banner screen-fade';
    // The top row holds the hop chip and the banner between the two columns
    // (ui.css `.hud-top`): one grid, so neither can sit over the other.
    this.topRow = document.createElement('div');
    this.topRow.className = 'hud-top';
    mount.appendChild(this.topRow);

    // The hop chip, top left, with the banner centered between it and the
    // control column.
    this.hopLabel = document.createElement('div');
    // It wears the shared `.chip` plate; `.hud-hop` gives only its place in
    // the row (ui.css).
    this.hopLabel.className = 'chip hud-hop screen-fade';
    this.topRow.append(this.hopLabel, this.banner);

    // The speed strip, the control column's second row in a battle (top
    // right, under the settings chip): a pause toggle, then one button per
    // enabled speed, ascending. The hotkeys (`speedHalf` to `speed3`,
    // `togglePause`) do what the buttons do, and all of them go through the
    // page-lifetime `playback`, so the speed and the pause carry into the
    // next battle. The hotkey subscriptions are this battle's, on
    // `subscriptions`; the registry and its window listener are the page's.
    // During the countdown, resuming is Fight now.
    this.speedPane = document.createElement('div');
    this.speedPane.className = 'hud-speed-pane screen-fade';
    // The starting-speed setting selects a speed from outside this pane
    // (the settings modal, open over the battle), so the buttons follow
    // the controller and not only this pane's own clicks.
    this.subscriptions.push(playback.onSelect(() => this.renderSpeedPane()));
    // Pause leads — it's the slowest (speed 0), so it sits leftmost ahead of the
    // ascending speed run.
    if (playback.pauseEnabled) {
      this.pauseButton = document.createElement('button');
      this.pauseButton.type = 'button';
      this.pauseButton.className = 'hud-speed hud-speed--pause';
      this.pauseButton.addEventListener('click', () => this.togglePause());
      // The words are live (pause, resume, fight now), so the
      // content is a thunk read at every open; renderSpeedPane refreshes an
      // open one when the hotkey path flips the label.
      attachTooltip(
        this.pauseButton,
        keyedTooltip(
          () => this.pauseLabel(),
          () => keybindings.labelFor('togglePause'),
        ),
        { touch: 'press' },
      );
      this.speedPane.appendChild(this.pauseButton);
      this.subscriptions.push(keybindings.on('togglePause', () => this.togglePause()));
    } else {
      this.pauseButton = null;
    }
    for (const value of playback.steps) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hud-speed';
      btn.textContent = `${value}×`;
      btn.addEventListener('click', () => this.selectSpeed(value));
      this.speedButtons.set(value, btn);
      this.speedPane.appendChild(btn);
      // Hotkey only for an offered speed — a disabled speed's digit falls
      // through to the browser rather than being silently swallowed.
      const action = SPEED_HOTKEY.get(value);
      if (action) this.subscriptions.push(keybindings.on(action, () => this.selectSpeed(value)));
      // The tooltip carries the live binding, so a rebind shows.
      attachTooltip(
        btn,
        action
          ? keyedTooltip(t('hud.tooltip.speed', { speed: value }), () =>
              keybindings.labelFor(action),
            )
          : t('hud.tooltip.speed', { speed: value }),
        { touch: 'press' },
      );
    }
    controlSlot.appendChild(this.speedPane);
    this.renderSpeedPane();

    // The countdown (centered, under the banner), shown while the sim waits
    // at the turn's start. Fight now resumes playback, which is the skip
    // BattleScene watches for, so this button, the pause toggle, its hotkey
    // and a speed button all start the fight the same way.
    this.countdownEl = document.createElement('div');
    this.countdownEl.className = 'battle-countdown screen-fade';
    const countdownLabel = document.createElement('div');
    countdownLabel.className = 'battle-countdown__label';
    countdownLabel.textContent = t('hud.countdown.label');
    this.countdownCount = document.createElement('div');
    this.countdownCount.className = 'battle-countdown__count';
    const fightNow = document.createElement('button');
    fightNow.type = 'button';
    fightNow.className = 'battle-countdown__fight';
    // The key is part of the button's words, so a rebind made while
    // this battle is up re-labels it (the tooltips read theirs at each open).
    const labelFightNow = (): void => {
      fightNow.textContent = `▶ ${t('hud.pause.fightNow')} (${keybindings.labelFor('togglePause')})`;
    };
    labelFightNow();
    this.subscriptions.push(keybindings.onChange(labelFightNow));
    fightNow.addEventListener('click', () => this.fightNow());
    this.countdownEl.append(countdownLabel, this.countdownCount, fightNow);
    mount.appendChild(this.countdownEl);

    // The objective pane: Engage and Focus arm a target pick (the next left
    // click), Hold and Stop apply at once. Unarmed, a left click on the board
    // engages and a right click focuses (ObjectiveController). Each button
    // has a hotkey too, a subscription of this battle's, and its words show
    // the live binding.
    this.objectivePane = document.createElement('div');
    this.objectivePane.className = 'hud-objective-pane screen-fade';
    for (const def of OBJECTIVE_BUTTONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hud-objective-btn';
      btn.addEventListener('click', () => this.invokeObjective(def));
      this.objectiveButtons.set(def.mode, btn);
      this.objectivePane.appendChild(btn);
      this.subscriptions.push(keybindings.on(def.action, () => this.invokeObjective(def)));
      // Each mode's hint: engage names the bare left click, focus the right
      // click, and hold and stop name themselves. The key is read at each
      // open, so a rebind shows.
      const hint =
        def.mode === 'engage'
          ? t('hud.tooltip.engage')
          : def.mode === 'focus'
            ? t('hud.tooltip.focus')
            : def.label;
      attachTooltip(
        btn,
        keyedTooltip(hint, () => keybindings.labelFor(def.action)),
        { touch: 'press' },
      );
    }
    mount.appendChild(this.objectivePane);
    this.renderObjectivePane();
    // The buttons' words carry their keys, so a rebind redraws them.
    this.subscriptions.push(keybindings.onChange(() => this.renderObjectivePane()));
    // Track the player team's objective so the active button reads engaged
    // however it was set (the pane, a hotkey, a board click). A `set` carries
    // the mode, an at-will one included; a `clear` reverts to `'atWill'`,
    // which highlights nothing.
    this.subscriptions.push(
      bus.on('objective:set', ({ team, objective }) => {
        if (team !== 'player') return;
        this.activeObjectiveMode = objective.mode;
        this.renderObjectivePane();
      }),
    );
    this.subscriptions.push(
      bus.on('objective:cleared', ({ team }) => {
        if (team !== 'player') return;
        this.activeObjectiveMode = 'atWill';
        this.renderObjectivePane();
      }),
    );

    // The player's pane (bottom center): compact cards for the fielded units,
    // with the run's pool gauge under them. A card is built on
    // `unit:spawned`, its bar driven by `unit:attacked`, `status:ticked` and
    // `unit:healed`, and grayed in place at a death, kept so the row's order
    // holds through the turn.
    this.playerCardPane = document.createElement('div');
    this.playerCardPane.className = 'hud-player-pane screen-fade';
    this.playerCardRow = document.createElement('div');
    this.playerCardRow.className = 'hud-player-cards';
    this.playerPoolWrap = document.createElement('div');
    this.playerPoolWrap.className = 'hud-player-pool';
    this.playerCardPane.append(this.playerCardRow, this.playerPoolWrap);
    mount.appendChild(this.playerCardPane);

    // The enemy's pane (top center, under the banner): the encounter's pool
    // gauge over the enemy's compact cards, growing down, the player pane's
    // mirror. The same handlers build and update both teams' cards (one
    // `cards` map; `addCard` picks the row), and the gauge is painted in
    // `show`. The row's capped height and its scroll keep a large swarm off
    // the board (ui.css `.hud-enemy-cards`).
    this.enemyCardPane = document.createElement('div');
    this.enemyCardPane.className = 'hud-enemy-pane screen-fade';
    this.enemyCardRow = document.createElement('div');
    this.enemyCardRow.className = 'hud-enemy-cards';
    this.enemyPoolWrap = document.createElement('div');
    this.enemyPoolWrap.className = 'hud-enemy-pool';
    this.enemyCardPane.append(this.enemyPoolWrap, this.enemyCardRow);
    mount.appendChild(this.enemyCardPane);

    this.subscriptions.push(bus.on('unit:spawned', ({ unitId }) => this.addUnit(unitId)));
    this.subscriptions.push(bus.on('unit:attacked', ({ targetId }) => this.refreshHp(targetId)));
    // A card's bar follows every HP change, not only a strike: a status tick
    // (a burn, a rejuvenate) or a heal moves HP too.
    this.subscriptions.push(bus.on('status:ticked', ({ unitId }) => this.refreshHp(unitId)));
    this.subscriptions.push(bus.on('unit:healed', ({ unitId }) => this.refreshHp(unitId)));
    this.subscriptions.push(
      bus.on('unit:died', (death) => {
        this.removeUnit(death.unitId);
        // A casualty's loss is a fact at the death (the loss-event model,
        // src/run/chipRule.ts), and the payload's power is what the World
        // booked, so the ghost and the ledger agree.
        this.applyLosses(lossEventsForDeath(death));
      }),
    );
    // The end sequence: a cap turn's survivors surcharge is a fact only now.
    // The end events fly as orbs, one per standing survivor, staggered; once
    // every orb in flight has landed comes the settle beat, then the commit,
    // and `lossesSettled()` resolves. It is BattleScene's `outro`, which Game
    // waits on before the turn advances.
    this.subscriptions.push(
      bus.on('battle:ended', ({ winner, reason }) => {
        if (!this.world) return;
        const why = reason ?? (winner === 'draw' ? 'cap' : 'decisive');
        const endEvents = lossEventsAtEnd(why, this.world.survivorsByUnit());
        this.settled = this.runEndSequence(endEvents);
      }),
    );
  }

  /** Deliver a batch of loss events: each flies as an orb from its cause's
   *  card to the gauge that pays, and the ghost grows on the landing. A cause
   *  with no card, a missing gauge, or reduced motion lands at once. */
  private applyLosses(events: readonly PoolLossEvent[]): void {
    for (const e of events) this.deliver(e);
  }

  private deliver(e: PoolLossEvent): void {
    const gauge = e.target === 'player' ? this.playerGauge : this.enemyGauge;
    const card = this.cards.get(e.cause.unitId);
    const land = (): void => {
      this.pending[e.target] += e.amount;
      if (!gauge) return;
      gauge.setPending(this.pending[e.target]);
      gauge.pulse();
      const max = gauge.reading().max;
      // The landing cue, scaled with the loss (gain up, pitch down). It plays
      // under reduced motion too, a sound being no motion, and for either
      // pool whatever the shake policy: the shake follows the policy, the
      // cue every landing.
      this.audio.play('moraleloss', lossCue(e.amount, max));
      if (shakeAllowed(e.target)) shakeView(e.amount, max);
    };
    const mount = this.playerCardPane.parentElement;
    if (!gauge || !card || !mount || reducedMotion()) {
      land();
      return;
    }
    const orb = flyOrb(
      mount,
      centerOf(card.el),
      gauge.anchor(),
      e.target,
      e.amount,
      gauge.reading().max,
    );
    this.orbs.add(orb);
    const flight = orb.done.then(() => {
      this.orbs.delete(orb);
      this.inFlight.delete(flight);
      // A cancelled orb (dispose mid-flight) still books its loss — the
      // ghost's arithmetic must not depend on the animation completing.
      land();
    });
    this.inFlight.add(flight);
  }

  /** Launch the end events at the stagger, wait for every orb in flight
   *  (the last deaths' included), the settle beat, then commit. */
  private async runEndSequence(events: readonly PoolLossEvent[]): Promise<void> {
    const reduced = reducedMotion();
    for (let i = 0; i < events.length; i++) {
      if (i > 0 && !reduced) await delay(SURVIVOR_STAGGER_MS);
      this.deliver(events[i]!);
    }
    while (this.inFlight.size > 0) await Promise.all([...this.inFlight]);
    await delay(SETTLE_MS);
    this.commitLosses();
  }

  /** Resolves when the after-battle sequence has committed (at once when no
   *  battle has ended on this HUD). */
  lossesSettled(): Promise<void> {
    return this.settled ?? Promise.resolve();
  }

  /** The ghost becomes the fill: Run has already booked the same charge
   *  through `resolveTurn`, and this is the bar catching up to it. */
  private commitLosses(): void {
    this.playerGauge?.commit();
    this.enemyGauge?.commit();
    this.pending = { player: 0, enemy: 0 };
  }

  /** Drop every orb (a teardown mid-flight, or a fresh `show()`). */
  private cancelOrbs(): void {
    for (const orb of this.orbs) orb.cancel();
    this.orbs.clear();
  }

  /**
   * Bind to a fresh battle world. Call it before the teams spawn, so the
   * `unit:spawned` handlers find a world. `locationName` is the banner's
   * text (BattleScene's: the layout's name, or `map.uncharted` for a
   * procedural board).
   */
  show(world: World, hop: number, locationName: string, encounter?: EncounterPools): void {
    this.world = world;
    // The hop chip carries the turn too, when there is an encounter.
    this.hopLabel.textContent = encounter
      ? t('hud.hopTurn', { hop, turn: encounter.turn })
      : t('common.hop', { hop });
    this.banner.textContent = locationName;
    // Reset both panes: last battle's cards out (one map holds both teams),
    // the gauges painted from this encounter's pools.
    this.playerCardRow.replaceChildren();
    this.enemyCardRow.replaceChildren();
    this.cards.clear();
    this.detachCardTooltips();
    this.renderPlayerPool(encounter);
    this.renderEnemyPool(encounter);
    // The opening ghost: a fresh battle has booked nothing; a mid-battle
    // restore opens at the deaths already booked (the World's snapshot keeps
    // the accumulator), so the bar reads the same after a reload.
    this.pending = bookedImmediateLoss(world.fallenPowerSoFar());
    this.playerGauge?.setPending(this.pending.player);
    this.enemyGauge?.setPending(this.pending.enemy);
    // A fresh battle starts with no orbs and no settle pending.
    this.cancelOrbs();
    this.settled = null;
    // The notch on each bar: the pre-turn bound on the player's, its mirror
    // on the enemy's.
    this.playerGauge?.setCeiling(encounter?.poolAtRisk ?? 0);
    this.enemyGauge?.setCeiling(encounter?.enemyPoolAtRisk ?? 0);
    fadeIn(this.hopLabel);
    fadeIn(this.banner);
    fadeIn(this.speedPane);
    fadeIn(this.objectivePane);
    fadeIn(this.playerCardPane);
    fadeIn(this.enemyCardPane);
  }

  /**
   * Permanent teardown, from BattleScene's `dispose` when the scene is
   * swapped out. Unsubscribes everything, then fades out and removes each
   * element, so the next scene's fade takes over cleanly.
   */
  dispose(): void {
    // The hotkey subscriptions are on `subscriptions` too, so the hotkeys
    // stop here. The speed and the pause survive on the page-lifetime
    // `playback`, and the registry and its window listener are the page's.
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
    this.detachCardTooltips();
    // A dispose mid-countdown (a scene swap) must not leave the observer and
    // the window listener behind.
    this.unwatchCountdownAnchor();
    fadeOutAndRemove(this.hopLabel);
    fadeOutAndRemove(this.banner);
    // The row has no fade of its own; it goes with the two it holds.
    fadeOutAndRemove(this.topRow);
    fadeOutAndRemove(this.speedPane);
    fadeOutAndRemove(this.objectivePane);
    fadeOutAndRemove(this.playerCardPane);
    fadeOutAndRemove(this.enemyCardPane);
    fadeOutAndRemove(this.countdownEl);
    // An orb mid-flight would outlive the panes it flew between.
    this.cancelOrbs();
    this.world = null;
  }

  /** Select a running speed (the click and hotkey handler), then repaint. */
  private selectSpeed(value: number): void {
    this.playback.setSpeed(value);
    this.renderSpeedPane();
  }

  /** Pause or resume the sim (the toggle and hotkey handler), then repaint. */
  private togglePause(): void {
    this.playback.togglePause();
    this.renderSpeedPane();
  }

  /** Paint the speed strip: the selected speed reads engaged (`aria-pressed`
   *  and `.is-active`) only while not paused; the pause toggle shows `❚❚`
   *  while running and ▶ while paused, and engages while paused. The
   *  tooltips show the live binding, so a rebind shows here. */
  private renderSpeedPane(): void {
    const paused = this.playback.isPaused;
    const selected = this.playback.selectedSpeed;
    for (const [value, btn] of this.speedButtons) {
      const active = !paused && value === selected;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
    if (this.pauseButton) {
      // `❚❚`, not U+23F8 ⏸: the shipped font lacks the pause symbol
      // (tests/font-coverage.test.ts), and a heavy pair of bars reads as one.
      this.pauseButton.textContent = paused ? '▶' : '❚❚';
      this.pauseButton.classList.toggle('is-active', paused);
      this.pauseButton.setAttribute('aria-pressed', String(paused));
      this.pauseButton.setAttribute('aria-label', this.pauseLabel());
      // An open tooltip re-reads the label (the hotkey path repaints
      // without a click; the click path refreshes itself).
      refreshTooltip(this.pauseButton);
    }
  }

  /** During the countdown the board waits and ▶ starts the fight, so the
   *  toggle reads "Fight now" rather than "Resume". */
  private pauseLabel(): string {
    if (this.inCountdown) return t('hud.pause.fightNow');
    return this.playback.isPaused ? t('hud.pause.resume') : t('hud.pause.pause');
  }

  /** Show or update the countdown (BattleScene calls it each frame of the
   *  countdown with the whole seconds left). Repaints the speed strip on
   *  entry, so the pause toggle reads "Fight now" while it counts. */
  showCountdown(seconds: number): void {
    if (!this.inCountdown) {
      this.inCountdown = true;
      this.countdownEl.classList.add('is-visible');
      this.positionCountdown();
      this.watchCountdownAnchor();
      this.renderSpeedPane();
    }
    if (seconds !== this.countdownShown) {
      this.countdownShown = seconds;
      this.countdownCount.textContent = String(seconds);
    }
  }

  /**
   * Keep the countdown clear of the enemy pane. The CSS default
   * (`max(18%, 230px)`) clears a one-row pane on any viewport, but on a
   * narrow or short screen the enemy cards wrap to two or three rows and the
   * pane's bottom passes any fixed value, so this measures the pane and
   * moves the readout below it when needed, never above the CSS default. It
   * runs on the countdown's entry and for as long as it counts
   * (`watchCountdownAnchor`): a card added during the countdown, a status or
   * empower row appearing (`refreshStatuses` paints them on the waiting
   * clock) and a re-wrap on a resize all move the pane's bottom.
   */
  private positionCountdown(): void {
    const enemyBottom = this.enemyCardPane.getBoundingClientRect().bottom;
    const cssDefault = Math.max(window.innerHeight * 0.18, 230);
    const top = Math.max(cssDefault, enemyBottom + 24);
    this.countdownEl.style.top = `${Math.round(top)}px`;
  }

  /**
   * Re-measure the countdown as its anchor moves. The enemy pane's bottom is
   * the readout's anchor and the countdown its only consumer, so the readout
   * follows the pane rather than every compact card reserving its status and
   * empower rows to hold one number still. A ResizeObserver on the pane (its
   * box changes when a card is added, a row appears or the cards re-wrap)
   * and the window's `resize` (a height-only resize moves the 18% default
   * without resizing the pane) both live only while the countdown counts;
   * `unwatchCountdownAnchor` runs on hide and on dispose. The observer
   * delivers between layout and paint, so the readout never paints a frame
   * at a stale `top`.
   */
  private watchCountdownAnchor(): void {
    this.unwatchCountdownAnchor();
    const reposition = (): void => {
      if (this.inCountdown) this.positionCountdown();
    };
    window.addEventListener('resize', reposition);
    // Guarded: a headless DOM (a test harness) has no ResizeObserver; the
    // entry measure + the resize listener still stand there.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reposition);
    observer?.observe(this.enemyCardPane);
    this.countdownAnchorWatch = () => {
      window.removeEventListener('resize', reposition);
      observer?.disconnect();
    };
  }

  private unwatchCountdownAnchor(): void {
    this.countdownAnchorWatch?.();
    this.countdownAnchorWatch = null;
  }

  /** Hide the countdown (the fight has started). */
  hideCountdown(): void {
    if (!this.inCountdown) return;
    this.inCountdown = false;
    this.countdownShown = -1;
    this.unwatchCountdownAnchor();
    this.countdownEl.classList.remove('is-visible');
    this.renderSpeedPane();
  }

  /** Fight now (the countdown's button): resume playback. That is the skip
   *  BattleScene watches for, as the pause toggle, its hotkey and a speed
   *  button are. */
  private fightNow(): void {
    this.playback.resume();
    this.renderSpeedPane();
  }

  /** Run an objective button (click or hotkey): engage and focus arm a
   *  target pick, hold and stop apply at once. */
  private invokeObjective(def: ObjectiveButtonDef): void {
    if (def.mode === 'engage' || def.mode === 'focus') this.objective.arm(def.mode);
    else if (def.mode === 'hold') this.objective.hold();
    else this.objective.stop();
  }

  /** BattleScene calls this when the controller arms or disarms
   *  (`onArmedChange`), so the armed button shows its pick prompt whether the
   *  arm came from the pane or a hotkey. */
  setObjectiveArmed(mode: ObjectiveArmMode | null): void {
    this.armedMode = mode;
    this.renderObjectivePane();
  }

  /** Paint the objective pane: the team's active mode reads engaged
   *  (`.is-active` and `aria-pressed`); the armed button (engage or focus)
   *  swaps to the pick prompt and `.is-armed`. The words carry the live
   *  hotkey, so a rebind shows. */
  private renderObjectivePane(): void {
    for (const def of OBJECTIVE_BUTTONS) {
      const btn = this.objectiveButtons.get(def.mode);
      if (!btn) continue;
      const key = this.keybindings.labelFor(def.action);
      const armed = def.arms && this.armedMode === def.mode;
      const active = this.activeObjectiveMode === def.mode;
      btn.textContent = armed
        ? `${def.icon} ${t('hud.objective.pickTarget')}`
        : `${def.icon} ${def.label} (${key})`;
      // Active highlight yields to the armed prompt so the two greens don't fight.
      btn.classList.toggle('is-active', active && !armed);
      btn.classList.toggle('is-armed', armed);
      btn.setAttribute('aria-pressed', String(active));
    }
  }

  private addUnit(unitId: number): void {
    if (!this.world) return;
    const unit = this.world.findUnit(unitId);
    if (!unit) return;
    // Neutrals (walls, scenery) are background, not combatants: no card.
    // Camp members are neutrals and get none either, by a signed decision
    // (a camp reads through its sprites and overlays); don't widen the gate.
    if (unit.team === 'neutral') return;
    // Both teams get a compact card, each in its own pane.
    this.addCard(unitId, unit);
  }

  /** Build a compact card for a newly spawned combatant and append it to its
   *  team's pane. The order is the spawn order (about the hand's slot order
   *  for the player), so each row holds still through the turn. */
  private addCard(unitId: number, unit: Unit): void {
    const team = unit.team === 'enemy' ? 'enemy' : 'player';
    const handles = buildUnitCard(unitCardFromUnit(unit), { mode: 'compact', skin: 'hud', team });
    // Reset the per-tick status and marker gate: the countdown holds the
    // clock at tick 0, so a card added after this tick's one pass would show
    // no empower markers or seeded statuses until the fight starts. With the
    // reset, the next frame's `refreshStatuses` repaints every card on the
    // waiting clock.
    this.statusTick = -1;
    // Enemy cards are objective targets: a left click engages and a right
    // click focuses, the board's fast paths on the cards. Player cards stay
    // inert, since a click on one has no meaning under the team-wide
    // objective. Liveness is checked at the click, not here, so a card goes
    // inert the moment its unit dies.
    if (team === 'enemy') {
      handles.el.classList.add('hud-card-targetable');
      // The keyboard route: role=button and Enter (Space is the battle's
      // pause hotkey, and `pressable` defers to it). The tab stop gives the
      // tooltip its focus route.
      pressable(handles.el);
      // Hover and focus only (`touch: 'none'`): the card's contextmenu is the
      // focus objective, so a long press can't also be the tooltip, and a tap
      // acts. The tooltip is never the only route: the objective pane
      // carries the same two actions.
      this.cardTooltips.set(
        unitId,
        attachTooltip(
          handles.el,
          t('hud.card.targetHint', {
            engage: t('hud.objective.engage'),
            focus: t('hud.objective.focus'),
          }),
          { touch: 'none' },
        ),
      );
      // A click honours an armed pick, as the board's does: arm Focus on the
      // pane (or by its hotkey), then click, tap or Enter the card. That is
      // the focus objective's keyboard and touch route; a right click stays
      // the mouse's shortcut.
      handles.el.addEventListener('click', () =>
        this.setObjectiveOnCard(unitId, this.armedMode ?? 'engage'),
      );
      handles.el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.setObjectiveOnCard(unitId, 'focus');
      });
    }
    this.cards.set(unitId, handles);
    (team === 'enemy' ? this.enemyCardRow : this.playerCardRow).appendChild(handles.el);
  }

  /** An enemy card's click: set the objective in `mode` on that unit,
   *  through the same `ObjectiveControls` as the pane's buttons. A dead or
   *  reaped unit does nothing (a grayed card is not a target). */
  private setObjectiveOnCard(unitId: number, mode: ObjectiveArmMode): void {
    const unit = this.world?.findUnit(unitId);
    if (!unit || unit.currentHp <= 0) return;
    this.objective.setOn(mode, { kind: 'enemy', unitId });
  }

  private refreshHp(unitId: number): void {
    if (!this.world) return;
    const unit = this.world.findUnit(unitId);
    if (!unit) return;
    const card = this.cards.get(unitId);
    if (card) updateCardHp(card, unit);
  }

  /** Drop every enemy card's tooltip registration (closing an open one). */
  private detachCardTooltips(): void {
    for (const detach of this.cardTooltips.values()) detach();
    this.cardTooltips.clear();
  }

  private removeUnit(unitId: number): void {
    // The card stays, grayed in place, so the row keeps its order through
    // the turn; its bar empties whatever the last HP event drew.
    const card = this.cards.get(unitId);
    if (card) {
      card.el.classList.add('is-dead');
      if (card.hpFill) card.hpFill.style.width = '0%';
      // A dead enemy card leaves the Tab order: a click on it does nothing,
      // so its tab stop would be a dead end. `aria-disabled`, never
      // `disabled`, as the map's inert nodes have it.
      if (card.el.getAttribute('role') === 'button') {
        card.el.tabIndex = -1;
        card.el.setAttribute('aria-disabled', 'true');
      }
    }
  }

  /** Paint the run's pool gauge under the player's cards; empty when `show`
   *  gets no encounter. */
  private renderPlayerPool(e?: EncounterPools): void {
    this.playerPoolWrap.replaceChildren();
    this.playerGauge = null;
    if (!e) return;
    // A live handle: the ghost moves with each loss event.
    this.playerGauge = createPoolGauge(
      'player',
      t('hud.pool.you'),
      e.playerHealth,
      e.playerHealthMax,
    );
    this.playerPoolWrap.appendChild(this.playerGauge.el);
  }

  /** Paint the encounter's pool gauge over the enemy's cards; empty when
   *  `show` gets no encounter. */
  private renderEnemyPool(e?: EncounterPools): void {
    this.enemyPoolWrap.replaceChildren();
    this.enemyGauge = null;
    if (!e) return;
    this.enemyGauge = createPoolGauge(
      'enemy',
      e.enemyName ?? t('hud.pool.foe'),
      e.enemyHealth,
      e.enemyHealthMax,
    );
    this.enemyPoolWrap.appendChild(this.enemyGauge.el);
  }

  /**
   * Refresh every compact card's status row. Called each frame by
   * BattleScene but gated on the sim tick advancing: the readout is constant
   * between ticks (it's derived from `currentTick`), so this recomputes at most
   * once per tick. A reaped unit (`findUnit` → null) clears its row, so a dead
   * card doesn't keep stale chips while it sits grayed in the pane.
   */
  refreshStatuses(): void {
    const world = this.world;
    if (!world || world.currentTick === this.statusTick) return;
    this.statusTick = world.currentTick;
    for (const [unitId, card] of this.cards) {
      const unit = world.findUnit(unitId);
      updateCardStatusRow(card, unit ? readUnitStatuses(unit.effects, world.currentTick) : []);
      // The empower markers ride the same gate: the stat buffs
      // `readUnitStatuses` skips, those in EMPOWER_DISPLAY (one table gives a
      // marker its colour and decides whether it shows). A reaped unit
      // clears its markers as it clears its status row.
      updateCardEmpowerMarkers(
        card,
        unit ? unit.effects.filter((e) => e.key in EMPOWER_DISPLAY) : [],
      );
    }
  }
}

/** Drive a compact card's bar from the live unit, clamped: currentHp can sit
 *  below 0 until the unit is reaped (`World.reapUnit`). */
function updateCardHp(card: UnitCardHandles, unit: Unit): void {
  if (!card.hpFill) return;
  const hp = Math.max(0, unit.currentHp);
  const pct = unit.derived.maxHp > 0 ? hp / unit.derived.maxHp : 0;
  card.hpFill.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
}
