/**
 * J3 — the in-battle objective INPUT controller (the pointer + command side of
 * the objective UI). Battle-scoped, owned by `BattleScene`; the render side (the
 * `X` marker) lives in `BattleRenderer`, driven independently off the
 * `objective:set` / `objective:cleared` events this controller's commands emit.
 *
 * Two ways to set an objective, both resolving through the pure `objectiveAtCell`
 * (enemy under the cursor → enemy objective, else a rally tile):
 *   - **right-click** the board → set directly.
 *   - the **Set Objective** button / hotkey → ARM "pick a target" mode, then the
 *     next **left-click** sets (a left-click is otherwise inert in battle, as it
 *     has always been — the camera pans on WASD/edge-scroll, not drag).
 *
 * Clearing is a button / hotkey → a `clearObjective` command. Everything routes
 * through `world.enqueueCommand`, so the mutation lands at the deterministic
 * top-of-tick drain (J1), never mid-tick.
 */

import type { World } from '../sim/World';
import type { Renderer, PickCandidate } from '../render/Renderer';
import type { TerrainRenderer } from '../render/TerrainRenderer';
import { objectiveAtCell, type EnemyAtCell } from '../sim/objective';

/** The HUD-facing slice: arm set-mode + clear. The HUD buttons/hotkeys call
 *  these; it doesn't see the pointer plumbing. */
export interface ObjectiveControls {
  armSet(): void;
  clear(): void;
}

export class ObjectiveController implements ObjectiveControls {
  private armed = false;
  /**
   * Set by the owner (BattleScene) to reflect armed state on the HUD's Set
   * button. Default no-op so the controller works headless / unwired.
   */
  onArmedChange: (armed: boolean) => void = () => {};

  constructor(
    private readonly world: World,
    private readonly renderer: Renderer,
    /** J3 — the terrain mesh `pickCell` raycasts against, so the pick lands on
     *  the real tile surface (exact on raised/lowered tiles) rather than a flat
     *  plane (which drifts by a tile where heights differ). */
    private readonly terrain: TerrainRenderer,
    /** J3 — living enemy billboards (rendered positions) for the screen-space
     *  hit-test, supplied by BattleScene off the BattleRenderer so the click
     *  resolves against the GLYPH the player sees, not the tile behind it. */
    private readonly enemyBillboards: () => readonly PickCandidate[],
  ) {
    const canvas = this.renderer.webgl.domElement;
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('click', this.onClick);
  }

  /** Arm "set objective" mode — the next left-click on the board sets it.
   *  Idempotent. Right-click bypasses this and sets immediately. */
  armSet(): void {
    if (this.armed) return;
    this.armed = true;
    this.onArmedChange(true);
  }

  /** Clear the active objective. */
  clear(): void {
    this.world.enqueueCommand({ kind: 'clearObjective' });
  }

  dispose(): void {
    const canvas = this.renderer.webgl.domElement;
    canvas.removeEventListener('contextmenu', this.onContextMenu);
    canvas.removeEventListener('click', this.onClick);
  }

  private disarm(): void {
    if (!this.armed) return;
    this.armed = false;
    this.onArmedChange(false);
  }

  /** Right-click sets directly (and suppresses the browser context menu). */
  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    this.setFromClient(e.clientX, e.clientY);
    this.disarm();
  };

  /** Left-click is only meaningful while armed; otherwise inert. A click that
   *  misses the board keeps you armed so you can retry. */
  private onClick = (e: MouseEvent): void => {
    if (!this.armed) return;
    if (this.setFromClient(e.clientX, e.clientY)) this.disarm();
  };

  /**
   * Resolve a click into an objective and enqueue it. Returns whether a command
   * was enqueued (false = clicked into the void off the board).
   *
   * Order matters: try the enemy BILLBOARD first (clicking the visible glyph —
   * accounts for the camera-facing sprite floating above its tile), then fall
   * back to the terrain CELL (clicking the ground / a unit's feet → that enemy
   * if one stands there, else a rally tile).
   */
  private setFromClient(clientX: number, clientY: number): boolean {
    const enemyId = this.renderer.pickInstance(clientX, clientY, this.enemyBillboards());
    if (enemyId !== null) {
      this.world.enqueueCommand({ kind: 'setObjective', objective: { kind: 'enemy', unitId: enemyId } });
      return true;
    }

    const cell = this.renderer.pickCell(clientX, clientY, this.terrain.mesh);
    if (!cell) return false;
    const enemies: EnemyAtCell[] = this.world.units
      .filter((u) => u.team === 'enemy' && u.currentHp > 0)
      .map((u) => ({ id: u.id, cell: u.position }));
    this.world.enqueueCommand({
      kind: 'setObjective',
      objective: objectiveAtCell(cell, enemies),
    });
    return true;
  }
}
