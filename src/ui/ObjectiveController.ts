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
import type { Renderer } from '../render/Renderer';
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

  /** Pick the cell under the cursor, resolve it, enqueue the set. Returns
   *  whether a command was enqueued (false = clicked off the board). */
  private setFromClient(clientX: number, clientY: number): boolean {
    const cell = this.renderer.pickCell(clientX, clientY);
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
