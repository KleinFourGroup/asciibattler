// In-battle HUD: current floor, both team rosters with HP bars, "battle
// resolving" status. Step 5.1. Live-updates from unit:* events.

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { World } from '../sim/World';
import type { Unit } from '../sim/Unit';
import { fadeIn, fadeOutAndRemove } from './fade';
import { isAtLevelCap, xpToNext, displayLevel } from '../sim/xp';
import { STAT_LABELS } from './statLabels';
import type { PlaybackSpeed } from './PlaybackSpeed';
import type { Keybindings } from './Keybindings';
import type { KeybindAction } from '../config/keybindings';
import type { ObjectiveControls } from './ObjectiveController';

/** Q1 — which rebindable action sets each speed, for the pane's per-button
 *  hotkey subscription + tooltip. A config speed outside this set still gets a
 *  button (no hotkey); a hotkey for a disabled speed is simply not subscribed. */
const SPEED_HOTKEY: ReadonlyMap<number, KeybindAction> = new Map([
  [0.5, 'speedHalf'],
  [1, 'speed1'],
  [2, 'speed2'],
  [3, 'speed3'],
]);

/** H4b — the encounter pool snapshot the HUD renders (from `Run` state). */
interface EncounterPools {
  turn: number;
  playerHealth: number;
  playerHealthMax: number;
  enemyHealth: number;
  enemyHealthMax: number;
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly floorLabel: HTMLElement;
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
  /** J3 — the objective input controller (arm set-mode / clear). Owned by
   *  BattleScene; the HUD buttons + hotkeys drive it. */
  private readonly objective: ObjectiveControls;
  /** J3 — the two objective controls + the live "armed" flag the Set button
   *  reflects (BattleScene flips it via `setObjectiveArmed`). */
  private readonly setObjectiveButton: HTMLButtonElement;
  private readonly clearObjectiveButton: HTMLButtonElement;
  private objectiveArmed = false;
  /** H4b — the encounter health pools + turn number, populated per battle. */
  private readonly pools: HTMLElement;
  private readonly status: HTMLElement;
  private readonly playerBody: HTMLElement;
  private readonly enemyBody: HTMLElement;
  private world: World | null = null;
  /** unitId → roster row element so updates and removals are O(1). */
  private readonly rows = new Map<number, HTMLElement>();
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
    this.root = document.createElement('div');
    // `screen-fade` keeps the panel at opacity:0 until show() flips
    // is-visible; that's also why the HUD doesn't use `hidden` — `display:
    // none` can't transition.
    this.root.className = 'hud screen-fade';

    // C1d follow-up: top-of-screen banner naming the current battle's
    // layout ("Corridor" / "Diamond" / "Labyrinth" / "Nowhere" for
    // procedural). Lives outside the side-panel root so it can center on
    // the viewport; same screen-fade lifecycle as the panel.
    this.banner = document.createElement('div');
    this.banner.className = 'battle-banner screen-fade';
    mount.appendChild(this.banner);

    this.floorLabel = document.createElement('div');
    this.floorLabel.className = 'hud-floor';
    this.root.appendChild(this.floorLabel);

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

    // J3 — the objective controls: Set (arm "pick a target" mode → next
    // left-click sets; right-clicking the board also sets) + Clear. Both are
    // buttons AND rebindable hotkeys; the button labels show the live binding.
    const objectiveControls = document.createElement('div');
    objectiveControls.className = 'hud-objective';
    this.setObjectiveButton = document.createElement('button');
    this.setObjectiveButton.type = 'button';
    this.setObjectiveButton.className = 'hud-objective-set';
    this.setObjectiveButton.addEventListener('click', () => this.objective.armSet());
    this.clearObjectiveButton = document.createElement('button');
    this.clearObjectiveButton.type = 'button';
    this.clearObjectiveButton.className = 'hud-objective-clear';
    this.clearObjectiveButton.addEventListener('click', () => this.objective.clear());
    objectiveControls.append(this.setObjectiveButton, this.clearObjectiveButton);
    this.root.appendChild(objectiveControls);
    this.renderObjectiveButtons();
    this.subscriptions.push(keybindings.on('setObjective', () => this.objective.armSet()));
    this.subscriptions.push(keybindings.on('clearObjective', () => this.objective.clear()));

    // H4b — the two encounter pools (run-wide player pool vs per-encounter enemy
    // pool) + the current turn. Static during a single turn (the pools chip
    // between turns, surfaced on the post-turn screen); populated from `Run`
    // state in show().
    this.pools = document.createElement('div');
    this.pools.className = 'hud-pools';
    this.root.appendChild(this.pools);

    this.status = document.createElement('div');
    this.status.className = 'hud-status';
    this.status.textContent = 'Battle resolving…';
    this.root.appendChild(this.status);

    const rosters = document.createElement('div');
    rosters.className = 'hud-rosters';
    const player = this.makeRoster('Player', 'hud-roster--player');
    const enemy = this.makeRoster('Enemy', 'hud-roster--enemy');
    this.playerBody = player.body;
    this.enemyBody = enemy.body;
    rosters.appendChild(player.root);
    rosters.appendChild(enemy.root);
    this.root.appendChild(rosters);

    mount.appendChild(this.root);

    this.subscriptions.push(bus.on('unit:spawned', ({ unitId }) => this.addUnit(unitId)));
    this.subscriptions.push(bus.on('unit:attacked', ({ targetId }) => this.refreshHp(targetId)));
    this.subscriptions.push(bus.on('unit:died', ({ unitId }) => this.removeUnit(unitId)));
  }

  /**
   * Bind to a fresh battle world. Must be called *before* the battle starts
   * spawning so unit:spawned events find a world to look up against.
   * `locationName` populates the top banner — pass "Nowhere" for procedural
   * encounters (no hand-authored layout).
   */
  show(
    world: World,
    floor: number,
    locationName: string,
    encounter?: EncounterPools,
  ): void {
    this.world = world;
    this.floorLabel.textContent = `Floor ${floor}`;
    this.banner.textContent = locationName;
    this.renderPools(encounter);
    this.playerBody.replaceChildren();
    this.enemyBody.replaceChildren();
    this.rows.clear();
    fadeIn(this.root);
    fadeIn(this.banner);
    fadeIn(this.speedPane);
  }

  hide(): void {
    // Just drop is-visible; the panel stays in the DOM and fades back in on
    // the next battle. Rows from the dying battle are kept until the next
    // show() so the fade-out has something to display.
    this.root.classList.remove('is-visible');
    this.banner.classList.remove('is-visible');
    this.speedPane.classList.remove('is-visible');
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
    fadeOutAndRemove(this.root);
    fadeOutAndRemove(this.banner);
    fadeOutAndRemove(this.speedPane);
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
      this.renderSpeedPane();
    }
    if (seconds !== this.countdownShown) {
      this.countdownShown = seconds;
      this.countdownCount.textContent = String(seconds);
    }
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

  /** J3 — BattleScene flips this when the controller arms/disarms (via
   *  onArmedChange), so the Set button shows the active "click a target" state
   *  whether arming came from the button or the hotkey. */
  setObjectiveArmed(armed: boolean): void {
    this.objectiveArmed = armed;
    this.renderObjectiveButtons();
  }

  /** J3 — paint the two objective buttons. Labels carry the live hotkey (so a
   *  rebind shows up); the Set button switches to its armed prompt + an
   *  is-armed class while waiting for the target click. */
  private renderObjectiveButtons(): void {
    const setKey = this.keybindings.labelFor('setObjective');
    const clearKey = this.keybindings.labelFor('clearObjective');
    this.setObjectiveButton.textContent = this.objectiveArmed
      ? '⌖ Click a target…'
      : `⌖ Set Objective (${setKey})`;
    this.setObjectiveButton.title = `Set objective: click here then left-click a target, or right-click the board (${setKey})`;
    this.setObjectiveButton.setAttribute('aria-pressed', String(this.objectiveArmed));
    this.setObjectiveButton.classList.toggle('is-armed', this.objectiveArmed);
    this.clearObjectiveButton.textContent = `✕ Clear (${clearKey})`;
    this.clearObjectiveButton.title = `Clear objective (${clearKey})`;
  }

  private addUnit(unitId: number): void {
    if (!this.world) return;
    const unit = this.world.findUnit(unitId);
    if (!unit) return;
    // Neutrals (walls, environment) don't appear in either roster — they're
    // background, not combatants.
    if (unit.team === 'neutral') return;
    const row = this.makeRow(unit);
    this.rows.set(unitId, row);
    (unit.team === 'player' ? this.playerBody : this.enemyBody).appendChild(row);
  }

  private refreshHp(unitId: number): void {
    if (!this.world) return;
    const unit = this.world.findUnit(unitId);
    const row = this.rows.get(unitId);
    if (!unit || !row) return;
    updateRow(row, unit);
  }

  private removeUnit(unitId: number): void {
    const row = this.rows.get(unitId);
    if (!row) return;
    row.remove();
    this.rows.delete(unitId);
  }

  /** H4b — render the encounter pools + turn into the HUD panel. Cleared when
   *  no encounter info is supplied (e.g. a bare test mount). */
  private renderPools(e?: EncounterPools): void {
    this.pools.replaceChildren();
    if (!e) return;
    const turn = document.createElement('div');
    turn.className = 'hud-pool-turn';
    turn.textContent = `Turn ${e.turn}`;
    this.pools.append(
      turn,
      poolRow('player', 'You', e.playerHealth, e.playerHealthMax),
      poolRow('enemy', 'Foe', e.enemyHealth, e.enemyHealthMax),
    );
  }

  private makeRoster(label: string, modifier: string): { root: HTMLElement; body: HTMLElement } {
    const root = document.createElement('div');
    root.className = `hud-roster ${modifier}`;
    const heading = document.createElement('div');
    heading.className = 'hud-roster-heading';
    heading.textContent = label;
    const body = document.createElement('div');
    body.className = 'hud-roster-body';
    root.appendChild(heading);
    root.appendChild(body);
    return { root, body };
  }

  private makeRow(unit: Unit): HTMLElement {
    const row = document.createElement('div');
    row.className = 'hud-row';

    const glyph = document.createElement('span');
    glyph.className = 'hud-glyph';
    glyph.textContent = unit.glyph;

    const bar = document.createElement('div');
    bar.className = 'hud-hp';
    const fill = document.createElement('div');
    fill.className = 'hud-hp-fill';
    bar.appendChild(fill);

    const text = document.createElement('span');
    text.className = 'hud-hp-text';

    row.appendChild(glyph);
    row.appendChild(bar);
    row.appendChild(text);

    // E4: secondary line beneath the HP for the persistent unit
    // metadata. Player rows show `Lv N · XP/Next` so the leveling
    // progress is visible across the run; enemy rows just show
    // `Lv N` (their XP is meaningless — they don't level via XP).
    // Neutrals already get filtered out in addUnit, so they never
    // reach makeRow.
    const sub = document.createElement('div');
    sub.className = 'hud-sub';
    row.appendChild(sub);

    // GP3: a second sub-line with the raw driving stats (DEF · MOB · SPD)
    // so the live tracker surfaces what GP1/GP2 added — a light touch on
    // the 240px panel. Reads `unit.stats` directly (no deriveStats); the
    // full ability detail stays on the recruit card. Shown for both teams.
    const stats = document.createElement('div');
    stats.className = 'hud-stats';
    row.appendChild(stats);

    updateRow(row, unit);
    return row;
  }
}

function updateRow(row: HTMLElement, unit: Unit): void {
  const fill = row.querySelector<HTMLElement>('.hud-hp-fill');
  const text = row.querySelector<HTMLElement>('.hud-hp-text');
  const sub = row.querySelector<HTMLElement>('.hud-sub');
  const stats = row.querySelector<HTMLElement>('.hud-stats');
  if (!fill || !text) return;
  // Clamp displayed HP: currentHp can briefly dip negative between the lethal
  // unit:attacked and DeathBehavior firing in the next tick (~100ms). Show 0
  // so the player never sees an "M-10/48" flash.
  const hp = Math.max(0, unit.currentHp);
  const pct = hp / unit.derived.maxHp;
  fill.style.width = `${pct * 100}%`;
  text.textContent = `${hp}/${unit.derived.maxHp}`;
  if (sub) sub.textContent = formatSub(unit);
  if (stats) stats.textContent = formatStats(unit);
}

function poolRow(
  side: 'player' | 'enemy',
  label: string,
  current: number,
  max: number,
): HTMLElement {
  const row = document.createElement('div');
  row.className = `hud-pool-row hud-pool-row--${side}`;
  const name = document.createElement('span');
  name.className = 'hud-pool-label';
  name.textContent = label;
  const value = document.createElement('span');
  value.className = 'hud-pool-value';
  value.textContent = `${Math.max(0, current)}/${max}`;
  row.append(name, value);
  return row;
}

function formatSub(unit: Unit): string {
  const lv = displayLevel(unit.level);
  if (unit.team !== 'player') return `Lv ${lv}`;
  if (isAtLevelCap(unit.level)) return `Lv ${lv} · MAX`;
  return `Lv ${lv} · ${unit.xp}/${xpToNext(unit.level)} XP`;
}

// GP3: the raw driving-stat line beneath the Lv/XP sub. The three stats the
// player tunes around in combat (defense + the two cadence dials), plus H1's
// `power` — the Phase-H meta-currency (survivors chip the opposing health pool
// by Σ`power`), surfaced here from day one though it's inert until H4. Uses the
// shared STAT_LABELS so HUD / card / promotion read identically.
function formatStats(unit: Unit): string {
  const s = unit.stats;
  return `${STAT_LABELS.defense} ${s.defense} · ${STAT_LABELS.mobility} ${s.mobility} · ${STAT_LABELS.speed} ${s.speed} · ${STAT_LABELS.power} ${s.power}`;
}
