// In-battle HUD: the four card/control panes (Q1 speed · Q3 objective · Q4
// player cards · Q5 enemy cards) plus the hop/turn chip and the location
// banner. Q6 dismantled the old monolithic side panel (both team rosters, the
// per-unit stat lines, and the inline You/Foe pools) now that the card panes
// own the live HP and the pool gauges. Live-updates from unit:* events.

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { World } from '../sim/World';
import type { Unit } from '../sim/Unit';
import { fadeIn, fadeOutAndRemove } from './fade';
import { buildUnitCard, unitCardFromUnit, type UnitCardHandles } from './UnitCard';
import { renderPoolGauge } from './poolGauge';
import type { PlaybackSpeed } from './PlaybackSpeed';
import type { Keybindings } from './Keybindings';
import type { KeybindAction } from '../config/keybindings';
import type { ObjectiveControls, ObjectiveArmMode } from './ObjectiveController';

/** Q1 — which rebindable action sets each speed, for the pane's per-button
 *  hotkey subscription + tooltip. A config speed outside this set still gets a
 *  button (no hotkey); a hotkey for a disabled speed is simply not subscribed. */
const SPEED_HOTKEY: ReadonlyMap<number, KeybindAction> = new Map([
  [0.5, 'speedHalf'],
  [1, 'speed1'],
  [2, 'speed2'],
  [3, 'speed3'],
]);

/** Q3 — the four objective-pane commands. `stop` is O's at-will default (to the
 *  player it reads as "clear other objectives"). `engage`/`focus` ARM a target
 *  pick; `hold`/`stop` apply on click. */
type ObjectiveButtonMode = ObjectiveArmMode | 'hold' | 'stop';

interface ObjectiveButtonDef {
  readonly mode: ObjectiveButtonMode;
  readonly label: string;
  /** A small leading glyph — the engage `⌖` / focus `!` echo the board marker. */
  readonly icon: string;
  readonly action: KeybindAction;
  /** engage/focus arm a target pick; hold/stop apply immediately. */
  readonly arms: boolean;
}

const OBJECTIVE_BUTTONS: readonly ObjectiveButtonDef[] = [
  { mode: 'engage', label: 'Engage', icon: '⌖', action: 'engageObjective', arms: true },
  { mode: 'focus', label: 'Focus', icon: '!', action: 'focusObjective', arms: true },
  { mode: 'hold', label: 'Hold', icon: '⊓', action: 'holdObjective', arms: false },
  { mode: 'stop', label: 'Stop', icon: '✕', action: 'stopObjective', arms: false },
];

/** H4b — the encounter pool snapshot the HUD renders (from `Run` state). */
interface EncounterPools {
  turn: number;
  playerHealth: number;
  playerHealthMax: number;
  enemyHealth: number;
  enemyHealthMax: number;
}

export class HUD {
  private readonly banner: HTMLElement;
  private readonly hopLabel: HTMLElement;
  /** Q1 — the speed-command pane (top-right): one button per enabled speed
   *  (ascending) + a pause/play toggle. Repainted on each speed change; the
   *  underlying speed + paused state live on the page-lifetime `playback`. */
  private readonly speedPane: HTMLElement;
  /** Speed value → its pane button, for the active-state repaint. */
  private readonly speedButtons = new Map<number, HTMLButtonElement>();
  /** The pause/play toggle, or null when `pauseEnabled` is off (no control). */
  private readonly pauseButton: HTMLButtonElement | null;
  /** Q2 — the pre-battle countdown readout (centered): a "Battle begins in N"
   *  count + a Fight-now button. BattleScene drives it via show/hideCountdown. */
  private readonly countdownEl: HTMLElement;
  private readonly countdownCount: HTMLElement;
  /** Whether the countdown is on-screen — flips the pause toggle's label to
   *  "Fight now" while it holds. */
  private inCountdown = false;
  /** Last whole-second painted into the readout, to skip redundant DOM writes. */
  private countdownShown = -1;
  private readonly playback: PlaybackSpeed;
  /** J3 — the rebindable-hotkey registry. The HUD subscribes its control
   *  surface (fast-forward + the objective controls) to it and reads `labelFor`
   *  for button labels so a rebind shows up in the UI. */
  private readonly keybindings: Keybindings;
  /** J3/Q3 — the objective input controller (arm engage/focus, or hold/stop).
   *  Owned by BattleScene; the HUD pane buttons + hotkeys drive it. */
  private readonly objective: ObjectiveControls;
  /** Q3 — the objective-command pane (bottom-right): Engage / Focus / Hold /
   *  Stop on O's typed model. Lives outside the side-panel root (like the speed
   *  pane) so it anchors bottom-right; same screen-fade lifecycle. */
  private readonly objectivePane: HTMLElement;
  /** Objective mode → its pane button, for the active/armed repaint. */
  private readonly objectiveButtons = new Map<ObjectiveButtonMode, HTMLButtonElement>();
  /** The mode currently being target-picked (engage/focus), or null — flipped by
   *  the controller via `setObjectiveArmed`. */
  private armedMode: ObjectiveArmMode | null = null;
  /** The player team's current objective mode, tracked off `objective:set` /
   *  `objective:cleared` so the active button reads "engaged". Starts at the
   *  at-will default (`stop`). */
  private activeObjectiveMode: ObjectiveButtonMode = 'stop';
  /** Q4 — the player unit pane (bottom-center): a wrapping grid of `compact`
   *  cards for the fielded player units + the relocated run health-pool gauge
   *  beneath them. Lives outside the side-panel root (like the other panes) so
   *  it anchors bottom-center; same screen-fade lifecycle. */
  private readonly playerCardPane: HTMLElement;
  /** The wrapping row the compact cards mount into. */
  private readonly playerCardRow: HTMLElement;
  /** The run health-pool gauge's slot beneath the cards (repainted in show()). */
  private readonly playerPoolWrap: HTMLElement;
  /** Q5 — the enemy unit pane (top-center, below the banner): the enemy
   *  encounter pool gauge above an analogous wrapping grid of red-teamed
   *  `compact` cards. The vertical mirror of the player pane. */
  private readonly enemyCardPane: HTMLElement;
  /** The wrapping row the enemy compact cards mount into. */
  private readonly enemyCardRow: HTMLElement;
  /** The enemy encounter-pool gauge's slot above the cards (repainted in show()). */
  private readonly enemyPoolWrap: HTMLElement;
  /** unitId → its compact card handles, for O(1) HP refresh + death gray-out.
   *  BOTH teams (player + enemy); dead cards stay (grayed) for positional
   *  stability. The team is fixed at spawn, so one map keyed by id suffices —
   *  only the append target (which pane's row) differs. */
  private readonly cards = new Map<number, UnitCardHandles>();
  private world: World | null = null;
  /**
   * Bus unsubscribers. A5 makes HUD a per-battle object (owned by
   * BattleScene), so subscriptions get torn down on dispose to keep them
   * from accumulating across battles.
   */
  private readonly subscriptions: Array<() => void> = [];

  constructor(
    mount: HTMLElement,
    bus: EventBus<GameEvents>,
    playback: PlaybackSpeed,
    keybindings: Keybindings,
    objective: ObjectiveControls,
  ) {
    this.playback = playback;
    this.keybindings = keybindings;
    this.objective = objective;

    // C1d follow-up: top-of-screen banner naming the current battle's
    // layout ("Corridor" / "Diamond" / "Labyrinth" / "Uncharted Ground" for
    // procedural). Centered at the top; same screen-fade lifecycle as the panes.
    this.banner = document.createElement('div');
    this.banner.className = 'battle-banner screen-fade';
    mount.appendChild(this.banner);

    // Q6 — the hop/turn chip, the one survivor of the dismantled side panel,
    // now a standalone top-left element (mirroring the top-right speed pane),
    // with the banner centered between them. Its own screen-fade lifecycle.
    this.hopLabel = document.createElement('div');
    this.hopLabel.className = 'hud-hop screen-fade';
    mount.appendChild(this.hopLabel);

    // Q1 — speed-command pane (top-right): one button per ENABLED speed
    // (ascending) + a pause/play toggle. Lives outside the side-panel root (like
    // the banner) so it can sit top-right; same screen-fade lifecycle. Each
    // button is the in-battle affordance; the hotkeys (J3 rebindable registry:
    // `speedHalf`/`speed1`/`speed2`/`speed3`, `togglePause`) mirror them. All
    // route through the shared `playback`, which holds the speed + paused state
    // so they persist into the next battle. Hotkey subscriptions are
    // battle-scoped — pushed onto `subscriptions` so dispose tears them down
    // (the registry + its window listener are page-lifetime; only these handlers
    // come and go per battle). Space=pause doubles as the Q2 countdown's "Fight
    // now" once that lands (a countdown is a pause with an auto-unpause timer).
    this.speedPane = document.createElement('div');
    this.speedPane.className = 'hud-speed-pane screen-fade';
    // Pause leads — it's the slowest (speed 0), so it sits leftmost ahead of the
    // ascending speed run.
    if (playback.pauseEnabled) {
      this.pauseButton = document.createElement('button');
      this.pauseButton.type = 'button';
      this.pauseButton.className = 'hud-speed hud-speed--pause';
      this.pauseButton.addEventListener('click', () => this.togglePause());
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
    }
    mount.appendChild(this.speedPane);
    this.renderSpeedPane();

    // Q2 — the pre-battle countdown readout (centered, under the banner). Shown
    // only while the sim is parked at turn start; BattleScene drives it via
    // show/hideCountdown. The Fight-now button just RESUMES playback — that
    // unpause is the skip signal BattleScene watches, so the button, the ▶ pause
    // toggle, and the Space hotkey are one unified "start the fight" control.
    this.countdownEl = document.createElement('div');
    this.countdownEl.className = 'battle-countdown screen-fade';
    const countdownLabel = document.createElement('div');
    countdownLabel.className = 'battle-countdown__label';
    countdownLabel.textContent = 'Battle begins in';
    this.countdownCount = document.createElement('div');
    this.countdownCount.className = 'battle-countdown__count';
    const fightNow = document.createElement('button');
    fightNow.type = 'button';
    fightNow.className = 'battle-countdown__fight';
    fightNow.textContent = `▶ Fight now (${keybindings.labelFor('togglePause')})`;
    fightNow.addEventListener('click', () => this.fightNow());
    this.countdownEl.append(countdownLabel, this.countdownCount, fightNow);
    mount.appendChild(this.countdownEl);

    // Q3 — the objective-command pane (bottom-right): Engage / Focus / Hold /
    // Stop on O's typed objective model. Engage + Focus ARM a target pick (the
    // next left-click, or right-click the board → engage); Hold + Stop apply
    // immediately. Lives outside the side-panel root (like the speed pane) so it
    // anchors bottom-right; same screen-fade lifecycle. Each button is a
    // rebindable hotkey too; the labels show the live binding so a rebind shows
    // up. Hotkey subscriptions are battle-scoped (pushed onto `subscriptions`).
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
    }
    mount.appendChild(this.objectivePane);
    this.renderObjectivePane();
    // Track the player team's live objective mode so the active button reads
    // "engaged" however it was set (pane / hotkey / right-click). A `set` carries
    // the mode; a `clear` reverts to the at-will default (`stop`).
    this.subscriptions.push(
      bus.on('objective:set', ({ team, objective }) => {
        if (team !== 'player') return;
        this.activeObjectiveMode = objective.mode === 'atWill' ? 'stop' : objective.mode;
        this.renderObjectivePane();
      }),
    );
    this.subscriptions.push(
      bus.on('objective:cleared', ({ team }) => {
        if (team !== 'player') return;
        this.activeObjectiveMode = 'stop';
        this.renderObjectivePane();
      }),
    );

    // Q4 — the player unit pane (bottom-center): a wrapping grid of `compact`
    // UnitCards for the fielded player units, with the run health-pool gauge
    // (relocated from the old HUD `pools` block — which stays until Q6) beneath
    // them. Cards are built on `unit:spawned`, their HP bars driven on
    // attacked/burned/healed, and grayed in place on death (kept, not removed,
    // so the grid order is positionally stable across the turn). Lives outside
    // the side-panel root (like the speed/objective panes) so it anchors
    // bottom-center; same screen-fade lifecycle.
    this.playerCardPane = document.createElement('div');
    this.playerCardPane.className = 'hud-player-pane screen-fade';
    this.playerCardRow = document.createElement('div');
    this.playerCardRow.className = 'hud-player-cards';
    this.playerPoolWrap = document.createElement('div');
    this.playerPoolWrap.className = 'hud-player-pool';
    this.playerCardPane.append(this.playerCardRow, this.playerPoolWrap);
    mount.appendChild(this.playerCardPane);

    // Q5 — the enemy unit pane (top-center, below the banner): the enemy
    // encounter pool gauge ABOVE an analogous wrapping grid of `compact` cards
    // (red-teamed). The vertical mirror of the player pane — anchored at the top
    // and growing down, with the pool above the cards (the player pane's cards
    // sit above its pool). Cards are built/updated/grayed by the SAME unit:*
    // handlers as the player cards (the `cards` map + the addCard team-switch);
    // the gauge (relocated from the old HUD `pools` block, which stays until Q6)
    // repaints in show(). A capped card-row height + scroll keeps a large
    // post-N2 swarm from overrunning the board.
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
    // Q4 — the compact cards' HP bars must track ALL visible HP changes, not
    // just direct attacks: a fire-tile burn or a healer's heal moves HP too (the
    // events.ts contract: refresh on attacked/burned/healed). The roster rows
    // get the same fix for free (they only listened to `attacked` before).
    this.subscriptions.push(bus.on('unit:burned', ({ unitId }) => this.refreshHp(unitId)));
    this.subscriptions.push(bus.on('unit:healed', ({ unitId }) => this.refreshHp(unitId)));
    this.subscriptions.push(bus.on('unit:died', ({ unitId }) => this.removeUnit(unitId)));
  }

  /**
   * Bind to a fresh battle world. Must be called *before* the battle starts
   * spawning so unit:spawned events find a world to look up against.
   * `locationName` populates the top banner — pass PROCEDURAL_MAP_NAME
   * ("Uncharted Ground") for procedural encounters (no hand-authored layout).
   */
  show(
    world: World,
    hop: number,
    locationName: string,
    encounter?: EncounterPools,
  ): void {
    this.world = world;
    // Q6 — the hop chip folds in the per-turn counter (the dropped HUD-pool
    // "Turn N" line) so no run context is lost with the old panel gone.
    this.hopLabel.textContent = encounter
      ? `Hop ${hop} · Turn ${encounter.turn}`
      : `Hop ${hop}`;
    this.banner.textContent = locationName;
    // Q4/Q5 — reset both card panes: drop last battle's cards (one map covers
    // both teams), repaint the pool gauges from this encounter's pools.
    this.playerCardRow.replaceChildren();
    this.enemyCardRow.replaceChildren();
    this.cards.clear();
    this.renderPlayerPool(encounter);
    this.renderEnemyPool(encounter);
    fadeIn(this.hopLabel);
    fadeIn(this.banner);
    fadeIn(this.speedPane);
    fadeIn(this.objectivePane);
    fadeIn(this.playerCardPane);
    fadeIn(this.enemyCardPane);
  }

  hide(): void {
    // Just drop is-visible; the elements stay in the DOM and fade back in on
    // the next battle.
    this.hopLabel.classList.remove('is-visible');
    this.banner.classList.remove('is-visible');
    this.speedPane.classList.remove('is-visible');
    this.objectivePane.classList.remove('is-visible');
    this.playerCardPane.classList.remove('is-visible');
    this.enemyCardPane.classList.remove('is-visible');
    this.world = null;
  }

  /**
   * Permanent teardown — BattleScene calls this when the battle ends.
   * Unsubscribes from the bus, then fades the root out and removes it so the
   * following Scene's screen-fade can take over cleanly.
   */
  dispose(): void {
    // J3 — this also drops the per-speed + pause keybinding subscriptions (they
    // were pushed onto `subscriptions`), so the hotkeys stop firing across
    // battles. The chosen speed + paused state survive — they live on the
    // page-lifetime `playback`; the registry + its window listener are
    // page-lifetime too.
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
    fadeOutAndRemove(this.hopLabel);
    fadeOutAndRemove(this.banner);
    fadeOutAndRemove(this.speedPane);
    fadeOutAndRemove(this.objectivePane);
    fadeOutAndRemove(this.playerCardPane);
    fadeOutAndRemove(this.enemyCardPane);
    fadeOutAndRemove(this.countdownEl);
    this.world = null;
  }

  /** Q1 — select a running speed (the click + hotkey handler), then repaint. */
  private selectSpeed(value: number): void {
    this.playback.setSpeed(value);
    this.renderSpeedPane();
  }

  /** Q1 — pause/unpause the sim (the toggle + hotkey handler), then repaint. */
  private togglePause(): void {
    this.playback.togglePause();
    this.renderSpeedPane();
  }

  /** Q1 — paint the speed pane: the selected running speed reads "engaged"
   *  (`aria-pressed` + `.is-active`), but only while NOT paused; the pause
   *  toggle shows ⏸ when running / ▶ when paused and engages while paused.
   *  Tooltips show the live binding so a rebind is reflected here. */
  private renderSpeedPane(): void {
    const paused = this.playback.isPaused;
    const selected = this.playback.selectedSpeed;
    for (const [value, btn] of this.speedButtons) {
      const active = !paused && value === selected;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
      const action = SPEED_HOTKEY.get(value);
      btn.title = action
        ? `${value}× speed (${this.keybindings.labelFor(action)})`
        : `${value}× speed`;
    }
    if (this.pauseButton) {
      this.pauseButton.textContent = paused ? '▶' : '⏸';
      this.pauseButton.classList.toggle('is-active', paused);
      this.pauseButton.setAttribute('aria-pressed', String(paused));
      // Q2 — during the countdown the board is held and ▶ means "start the
      // fight", so the toggle reads "Fight now" rather than "Resume".
      const label = this.inCountdown ? 'Fight now' : paused ? 'Resume' : 'Pause';
      this.pauseButton.setAttribute('aria-label', label);
      this.pauseButton.title = `${label} (${this.keybindings.labelFor('togglePause')})`;
    }
  }

  /** Q2 — show / update the pre-battle countdown readout (BattleScene drives it
   *  each held frame with the whole seconds remaining). Re-renders the speed
   *  pane on entry so the pause toggle reads "Fight now" while held. */
  showCountdown(seconds: number): void {
    if (!this.inCountdown) {
      this.inCountdown = true;
      this.countdownEl.classList.add('is-visible');
      this.positionCountdown();
      this.renderSpeedPane();
    }
    if (seconds !== this.countdownShown) {
      this.countdownShown = seconds;
      this.countdownCount.textContent = String(seconds);
    }
  }

  /**
   * Q5 fix — keep the countdown readout clear of the top enemy pane. The CSS
   * default (`max(18%, 230px)`) clears a ONE-row pane on any viewport, but on a
   * narrow/short screen the enemy cards wrap to 2–3 rows and the pane bottom
   * grows past any static value — so measure it and push the readout below the
   * pane's actual bottom when needed. Only ever moves it DOWN from the CSS
   * default (never above the aesthetic 18%/230 placement the one-row case uses).
   * Measured on countdown entry; the pane is static while the sim is parked, and
   * the enemy cards are spawned before the first held frame drives this.
   */
  private positionCountdown(): void {
    const enemyBottom = this.enemyCardPane.getBoundingClientRect().bottom;
    const cssDefault = Math.max(window.innerHeight * 0.18, 230);
    const top = Math.max(cssDefault, enemyBottom + 24);
    this.countdownEl.style.top = `${Math.round(top)}px`;
  }

  /** Q2 — hide the countdown readout (the fight has started). */
  hideCountdown(): void {
    if (!this.inCountdown) return;
    this.inCountdown = false;
    this.countdownShown = -1;
    this.countdownEl.classList.remove('is-visible');
    this.renderSpeedPane();
  }

  /** Q2 — the Fight-now control (the readout button): resume playback. That
   *  unpause is the skip signal BattleScene watches, so this button, the ▶ pause
   *  toggle, and the Space hotkey all start the fight through one path. */
  private fightNow(): void {
    this.playback.resume();
    this.renderSpeedPane();
  }

  /** Q3 — dispatch an objective-pane button (click or hotkey): engage/focus arm
   *  a target pick, hold/stop apply immediately. */
  private invokeObjective(def: ObjectiveButtonDef): void {
    if (def.mode === 'engage' || def.mode === 'focus') this.objective.arm(def.mode);
    else if (def.mode === 'hold') this.objective.hold();
    else this.objective.stop();
  }

  /** Q3 — BattleScene flips this when the controller arms/disarms (via
   *  onArmedChange), so the armed button shows its "click a target" state
   *  whether arming came from the pane or the hotkey. */
  setObjectiveArmed(mode: ObjectiveArmMode | null): void {
    this.armedMode = mode;
    this.renderObjectivePane();
  }

  /** Q3 — paint the objective pane: the team's ACTIVE mode reads "engaged"
   *  (`.is-active` + `aria-pressed`); the armed target-pick button (engage/focus)
   *  swaps to a "click a target" prompt + `.is-armed`. Labels carry the live
   *  hotkey so a rebind shows up. */
  private renderObjectivePane(): void {
    for (const def of OBJECTIVE_BUTTONS) {
      const btn = this.objectiveButtons.get(def.mode);
      if (!btn) continue;
      const key = this.keybindings.labelFor(def.action);
      const armed = def.arms && this.armedMode === def.mode;
      const active = this.activeObjectiveMode === def.mode;
      btn.textContent = armed
        ? `${def.icon} Click a target…`
        : `${def.icon} ${def.label} (${key})`;
      btn.title = def.arms
        ? `${def.label}: click then left-click a target${def.mode === 'engage' ? ', or right-click the board' : ''} (${key})`
        : `${def.label} (${key})`;
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
    // Neutrals (walls, environment) are background, not combatants — no card.
    if (unit.team === 'neutral') return;
    // Q4/Q5 — both teams get a compact card in their pane (player bottom-center,
    // enemy top).
    this.addCard(unitId, unit);
  }

  /** Q4/Q5 — build a compact card for a freshly spawned combatant and append it
   *  to its team's pane (player bottom-center / enemy top). Append order = spawn
   *  order (≈ hand-slot order for the player), so each grid stays positionally
   *  stable across the turn. */
  private addCard(unitId: number, unit: Unit): void {
    const team = unit.team === 'enemy' ? 'enemy' : 'player';
    const handles = buildUnitCard(unitCardFromUnit(unit), { mode: 'compact', skin: 'hud', team });
    this.cards.set(unitId, handles);
    (team === 'enemy' ? this.enemyCardRow : this.playerCardRow).appendChild(handles.el);
  }

  private refreshHp(unitId: number): void {
    if (!this.world) return;
    const unit = this.world.findUnit(unitId);
    if (!unit) return;
    const card = this.cards.get(unitId);
    if (card) updateCardHp(card, unit);
  }

  private removeUnit(unitId: number): void {
    // Q4 — the card is NOT removed: it grays in place (death readout) so the
    // grid keeps a stable order through the turn. Empty the bar in case the
    // lethal hit's clamp left it above 0.
    const card = this.cards.get(unitId);
    if (card) {
      card.el.classList.add('is-dead');
      if (card.hpFill) card.hpFill.style.width = '0%';
    }
  }

  /** Q4 — paint the run health-pool gauge beneath the player cards (the brief's
   *  "player run health-pool bar"). Cleared when no encounter info is supplied
   *  (e.g. a bare test mount). */
  private renderPlayerPool(e?: EncounterPools): void {
    this.playerPoolWrap.replaceChildren();
    if (!e) return;
    this.playerPoolWrap.appendChild(
      renderPoolGauge('player', 'You', e.playerHealth, e.playerHealthMax),
    );
  }

  /** Q5 — paint the enemy encounter health-pool gauge above the enemy cards.
   *  Cleared when no encounter info is supplied (e.g. a bare test mount). */
  private renderEnemyPool(e?: EncounterPools): void {
    this.enemyPoolWrap.replaceChildren();
    if (!e) return;
    this.enemyPoolWrap.appendChild(
      renderPoolGauge('enemy', 'Foe', e.enemyHealth, e.enemyHealthMax),
    );
  }

}

/** Q4 — drive a compact card's HP bar from the live unit. Clamps like the sim:
 *  currentHp can dip negative for ~1 tick before DeathBehavior fires. */
function updateCardHp(card: UnitCardHandles, unit: Unit): void {
  if (!card.hpFill) return;
  const hp = Math.max(0, unit.currentHp);
  const pct = unit.derived.maxHp > 0 ? hp / unit.derived.maxHp : 0;
  card.hpFill.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
}
