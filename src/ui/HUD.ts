// In-battle HUD: current floor, both team rosters with HP bars, "battle
// resolving" status. Step 5.1. Live-updates from unit:* events.

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { World } from '../sim/World';
import type { Unit } from '../sim/Unit';

export class HUD {
  private readonly root: HTMLElement;
  private readonly floorLabel: HTMLElement;
  private readonly status: HTMLElement;
  private readonly playerBody: HTMLElement;
  private readonly enemyBody: HTMLElement;
  private world: World | null = null;
  /** unitId → roster row element so updates and removals are O(1). */
  private readonly rows = new Map<number, HTMLElement>();

  constructor(mount: HTMLElement, bus: EventBus<GameEvents>) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.hidden = true;

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

    // Subscriptions live for the HUD's lifetime (matches BattleRenderer's
    // pattern). Per-battle attach/detach is handled by show()/hide().
    bus.on('unit:spawned', ({ unitId }) => this.addUnit(unitId));
    bus.on('unit:attacked', ({ targetId }) => this.refreshHp(targetId));
    bus.on('unit:died', ({ unitId }) => this.removeUnit(unitId));
  }

  /**
   * Bind to a fresh battle world. Must be called *before* the battle starts
   * spawning so unit:spawned events find a world to look up against.
   */
  show(world: World, floor: number): void {
    this.world = world;
    this.floorLabel.textContent = `Floor ${floor}`;
    this.playerBody.replaceChildren();
    this.enemyBody.replaceChildren();
    this.rows.clear();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.world = null;
  }

  private addUnit(unitId: number): void {
    if (!this.world) return;
    const unit = this.world.findUnit(unitId);
    if (!unit) return;
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
