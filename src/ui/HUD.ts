// In-battle HUD: current floor, both team rosters with HP bars, "battle
// resolving" status. Step 5.1. Live-updates from unit:* events.

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { World } from '../sim/World';
import type { Unit } from '../sim/Unit';
import { fadeIn, fadeOutAndRemove } from './fade';

export class HUD {
  private readonly root: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly floorLabel: HTMLElement;
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

  constructor(mount: HTMLElement, bus: EventBus<GameEvents>) {
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
  show(world: World, floor: number, locationName: string): void {
    this.world = world;
    this.floorLabel.textContent = `Floor ${floor}`;
    this.banner.textContent = locationName;
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
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
    fadeOutAndRemove(this.root);
    fadeOutAndRemove(this.banner);
    this.world = null;
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
    updateRow(row, unit);
    return row;
  }
}

function updateRow(row: HTMLElement, unit: Unit): void {
  const fill = row.querySelector<HTMLElement>('.hud-hp-fill');
  const text = row.querySelector<HTMLElement>('.hud-hp-text');
  if (!fill || !text) return;
  // Clamp displayed HP: currentHp can briefly dip negative between the lethal
  // unit:attacked and DeathBehavior firing in the next tick (~100ms). Show 0
  // so the player never sees an "M-10/48" flash.
  const hp = Math.max(0, unit.currentHp);
  const pct = hp / unit.stats.maxHp;
  fill.style.width = `${pct * 100}%`;
  text.textContent = `${hp}/${unit.stats.maxHp}`;
}
