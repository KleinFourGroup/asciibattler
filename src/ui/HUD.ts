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
import type { ObjectiveControls } from './ObjectiveController';

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
  /** I3 — the fast-forward cycle button (1×/2×/3×). Label re-rendered on each
   *  cycle; the underlying speed lives on the page-lifetime `playback`. */
  private readonly speedButton: HTMLButtonElement;
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

    // I3 — fast-forward control: a button + a hotkey, both cycling 1×/2×/3×.
    // The button is the in-battle affordance; the hotkey (J3: the rebindable
    // `fastForward` binding, default KeyF) is the keyboard shortcut. Both call
    // cycleSpeed(); the shared `playback` holds the value so it persists into
    // the next battle. The hotkey subscription is battle-scoped — pushed onto
    // `subscriptions` so dispose tears it down (the registry + its window
    // listener are page-lifetime; only this handler comes and goes per battle).
    this.speedButton = document.createElement('button');
    this.speedButton.type = 'button';
    this.speedButton.className = 'hud-speed';
    this.speedButton.addEventListener('click', () => this.cycleSpeed());
    this.root.appendChild(this.speedButton);
    this.renderSpeed();
    this.subscriptions.push(keybindings.on('fastForward', () => this.cycleSpeed()));

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
  }

  hide(): void {
    // Just drop is-visible; the panel stays in the DOM and fades back in on
    // the next battle. Rows from the dying battle are kept until the next
    // show() so the fade-out has something to display.
    this.root.classList.remove('is-visible');
    this.banner.classList.remove('is-visible');
    this.world = null;
  }

  /**
   * Permanent teardown — BattleScene calls this when the battle ends.
   * Unsubscribes from the bus, then fades the root out and removes it so the
   * following Scene's screen-fade can take over cleanly.
   */
  dispose(): void {
    // J3 — this also drops the `fastForward` keybinding subscription (it was
    // pushed onto `subscriptions`), so the hotkey stops firing across battles.
    // The chosen speed itself survives — it lives on the page-lifetime
    // `playback`; the registry + its window listener are page-lifetime too.
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
    fadeOutAndRemove(this.root);
    fadeOutAndRemove(this.banner);
    this.world = null;
  }

  /** I3 — cycle to the next speed and re-render the button. Shared by the
   *  click handler and the hotkey. */
  private cycleSpeed(): void {
    this.playback.cycle();
    this.renderSpeed();
  }

  /** I3 — paint the button to the current speed: a chevron run mirroring the
   *  multiplier (▶ / ▶▶ / ▶▶▶) plus the explicit `N×`. `aria-pressed` flags any
   *  faster-than-real speed so it reads as "engaged". */
  private renderSpeed(): void {
    const speed = this.playback.current;
    const chevrons = '▶'.repeat(Math.max(1, Math.round(speed)));
    this.speedButton.textContent = `${chevrons} ${this.playback.label}`;
    // J3 — the tooltip shows the live binding so a rebind is reflected here.
    this.speedButton.title = `Fast-forward (${this.keybindings.labelFor('fastForward')})`;
    this.speedButton.setAttribute('aria-pressed', String(speed > 1));
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
