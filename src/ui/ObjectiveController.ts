/**
 * J3 / Q3 — the in-battle objective INPUT controller (the pointer + command side
 * of the objective UI). Battle-scoped, owned by `BattleScene`; the render side
 * (the `X`/`!` marker) lives in `BattleRenderer`, driven independently off the
 * `objective:set` / `objective:cleared` events this controller's commands emit.
 *
 * Q3 generalized J3's single Set/Clear into the four objective-pane commands on
 * O's typed `TeamObjective` model, always for the PLAYER team:
 *   - **Engage / Focus** need a target → `arm(mode)` enters "pick a target" mode,
 *     then the next **left-click** sets the objective in that mode (a left-click
 *     is otherwise inert in battle — the camera pans on WASD/edge-scroll). The
 *     target is resolved through the pure `objectiveAtCell` (enemy under the
 *     cursor → enemy target, else a rally tile).
 *   - **right-click** the board always sets an **Engage** directly (the J3 fast
 *     path — no arming), regardless of any pending arm.
 *   - **Hold / Stop** need no target → `hold()` / `stop()` apply immediately.
 *     `stop()` reverts to at-will (the old "clear").
 *
 * Everything routes through `world.enqueueCommand`, so the mutation lands at the
 * deterministic top-of-tick drain (J1), never mid-tick.
 */

import type { World } from '../sim/World';
import type { Renderer, PickCandidate } from '../render/Renderer';
import type { TerrainRenderer } from '../render/TerrainRenderer';
import { objectiveAtCell, type EnemyAtCell } from '../sim/objective';

/** The two target-requiring modes the pane ARMS (Q3) — `hold`/`stop` apply
 *  immediately and are never armed. */
export type ObjectiveArmMode = 'engage' | 'focus';

/** The HUD-facing slice: arm a target-pick (engage/focus), or apply hold/stop
 *  immediately. The HUD buttons/hotkeys call these; it doesn't see the pointer
 *  plumbing. */
export interface ObjectiveControls {
  arm(mode: ObjectiveArmMode): void;
  hold(): void;
  stop(): void;
}

export class ObjectiveController implements ObjectiveControls {
  /** The pending target-pick mode while armed, or null when idle. Right-click
   *  bypasses this and always engages. */
  private armedMode: ObjectiveArmMode | null = null;
  /**
   * Set by the owner (BattleScene) to reflect the armed mode on the HUD pane
   * (which button shows "click a target", or none). Default no-op so the
   * controller works headless / unwired.
   */
  onArmedChange: (mode: ObjectiveArmMode | null) => void = () => {};

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

  /** Arm a target-pick for `engage`/`focus` — the next left-click on the board
   *  sets the objective in that mode. Re-arming switches the pending mode;
   *  re-arming the same mode is a no-op. Right-click bypasses this (always
   *  engages). */
  arm(mode: ObjectiveArmMode): void {
    if (this.armedMode === mode) return;
    this.armedMode = mode;
    this.onArmedChange(mode);
  }

  /** Set a HOLD objective (units act in place, no target). Cancels any pending
   *  arm. */
  hold(): void {
    this.world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'hold' },
    });
    this.disarm();
  }

  /** Stop — revert the player team to at-will (the old "clear"). Cancels any
   *  pending arm. */
  stop(): void {
    this.world.enqueueCommand({ kind: 'clearObjective', team: 'player' });
    this.disarm();
  }

  dispose(): void {
    const canvas = this.renderer.webgl.domElement;
    canvas.removeEventListener('contextmenu', this.onContextMenu);
    canvas.removeEventListener('click', this.onClick);
  }

  private disarm(): void {
    if (this.armedMode === null) return;
    this.armedMode = null;
    this.onArmedChange(null);
  }

  /** Right-click always sets an Engage directly (and suppresses the browser
   *  context menu) — the J3 fast path, independent of any pending arm. */
  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    this.setFromClient(e.clientX, e.clientY, 'engage');
    this.disarm();
  };

  /** Left-click is only meaningful while armed; otherwise inert. It sets in the
   *  armed mode. A click that misses the board keeps you armed so you can retry. */
  private onClick = (e: MouseEvent): void => {
    if (this.armedMode === null) return;
    if (this.setFromClient(e.clientX, e.clientY, this.armedMode)) this.disarm();
  };

  /**
   * Resolve a click into an objective of `mode` and enqueue it. Returns whether
   * a command was enqueued (false = clicked into the void off the board).
   *
   * Order matters: try the enemy BILLBOARD first (clicking the visible glyph —
   * accounts for the camera-facing sprite floating above its tile), then fall
   * back to the terrain CELL (clicking the ground / a unit's feet → that enemy
   * if one stands there, else a rally tile).
   */
  private setFromClient(clientX: number, clientY: number, mode: ObjectiveArmMode): boolean {
    const enemyId = this.renderer.pickInstance(clientX, clientY, this.enemyBillboards());
    if (enemyId !== null) {
      this.world.enqueueCommand({
        kind: 'setObjective',
        team: 'player',
        objective: { mode, target: { kind: 'enemy', unitId: enemyId } },
      });
      return true;
    }

    const cell = this.renderer.pickCell(clientX, clientY, this.terrain.mesh);
    if (!cell) return false;
    const enemies: EnemyAtCell[] = this.world.units
      .filter((u) => u.team === 'enemy' && u.currentHp > 0)
      .map((u) => ({ id: u.id, cell: u.position }));
    this.world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode, target: objectiveAtCell(cell, enemies) },
    });
    return true;
  }
}
