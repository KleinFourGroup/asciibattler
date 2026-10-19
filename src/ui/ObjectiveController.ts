/**
 * The battle's objective input: the pointer and command side of the
 * objective UI, always for the player's team. BattleScene owns it for one
 * battle; the board's marker (`X` for engage, `!` for focus) is
 * BattleRenderer's, drawn off the `objective:set` and `objective:cleared`
 * these commands cause.
 *
 * The pane's four commands, on the typed `TeamObjective`:
 *
 * - Engage and Focus need a target: `arm(mode)` waits for one, and the next
 *   left click sets the objective in that mode, resolved as `setFromClient`
 *   says.
 * - Unarmed, a left click sets an Engage at once and a right click a Focus;
 *   a right click ignores a pending arm.
 * - Hold and Stop need no target and apply at once; `stop()` reverts to
 *   at-will.
 *
 * Everything goes through `world.enqueueCommand`, so the change lands at the
 * deterministic drain at the top of a tick, never mid-tick.
 */

import type { World } from '../sim/World';
import type { Renderer, PickCandidate } from '../render/Renderer';
import type { TerrainRenderer } from '../render/TerrainRenderer';
import { objectiveAtCell, type EnemyAtCell, type NeutralAtCell, type ObjectiveTarget } from '../sim/objective';
import { cellsOccupiedBy } from '../sim/occupancy';
import { validNeutralObjectiveTarget } from '../sim/Targeting';

/** The two modes that take a target, which the pane arms; `hold` and `stop`
 *  apply at once and are never armed. */
export type ObjectiveArmMode = 'engage' | 'focus';

/** The HUD's slice: arm a target pick (engage, focus), set an objective on a
 *  known target (an enemy card's click), or apply hold or stop at once. The
 *  HUD's buttons, hotkeys and cards call these; it never sees the pointer
 *  plumbing. */
export interface ObjectiveControls {
  arm(mode: ObjectiveArmMode): void;
  setOn(mode: ObjectiveArmMode, target: ObjectiveTarget): void;
  hold(): void;
  stop(): void;
}

export class ObjectiveController implements ObjectiveControls {
  /** The pending target-pick mode while armed, or null when idle. A right
   *  click ignores it and always focuses. */
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
    /** The terrain mesh `pickCell` raycasts against, so the pick lands on
     *  the real tile surface (exact on raised/lowered tiles) rather than a flat
     *  plane (which drifts by a tile where heights differ). */
    private readonly terrain: TerrainRenderer,
    /** The living enemies' billboards (rendered positions) for the screen-space
     *  hit-test, supplied by BattleScene off the BattleRenderer so the click
     *  resolves against the glyph the player sees, not the tile behind it. */
    private readonly enemyBillboards: () => readonly PickCandidate[],
    /** The billboards of the living neutrals an order may name (a
     *  destructible or a camp member, `validNeutralObjectiveTarget`),
     *  supplied the same way, so a manual Focus or Engage can order an attack
     *  on one. Ranked after the enemies in the hit-test. */
    private readonly destructibleBillboards: () => readonly PickCandidate[],
  ) {
    const canvas = this.renderer.webgl.domElement;
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('click', this.onClick);
  }

  /** Arm a target pick for `engage` or `focus`: the next left click on the
   *  board sets the objective in that mode, over the unarmed click's engage.
   *  Arming another mode switches the pending one; arming the same mode does
   *  nothing. A right click ignores the arm and always focuses. */
  arm(mode: ObjectiveArmMode): void {
    if (this.armedMode === mode) return;
    this.armedMode = mode;
    this.onArmedChange(mode);
  }

  /** Set an objective of `mode` on a known target, with no board pick (an
   *  enemy card's click: the card names its unit). It enqueues through the
   *  same place as the pointer's paths, and cancels a pending arm, since the
   *  click used it. */
  setOn(mode: ObjectiveArmMode, target: ObjectiveTarget): void {
    this.enqueueObjective(mode, target);
    this.disarm();
  }

  /** Set a Hold objective (units act in place, no target). Cancels any pending
   *  arm. */
  hold(): void {
    this.world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'hold' },
    });
    this.disarm();
  }

  /** Stop: revert the player team to at-will. Cancels any pending arm. */
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

  /** A right click always sets a Focus at once, whatever is armed, and
   *  suppresses the browser's context menu. */
  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    this.setFromClient(e.clientX, e.clientY, 'focus');
    this.disarm();
  };

  /** A left click sets the armed mode when one is pending (a click that
   *  misses the board keeps the arm, so the player can retry); otherwise it
   *  sets an Engage (a miss orders nothing, so a stray click into the void is
   *  harmless). */
  private onClick = (e: MouseEvent): void => {
    if (this.armedMode === null) {
      this.setFromClient(e.clientX, e.clientY, 'engage');
      return;
    }
    if (this.setFromClient(e.clientX, e.clientY, this.armedMode)) this.disarm();
  };

  /**
   * Resolve a click into an objective of `mode` and enqueue it. Returns whether
   * a command was enqueued (false = clicked into the void off the board).
   *
   * The order, enemy over neutral over terrain cell:
   *   1. an enemy's billboard, the glyph as drawn (a camera-facing sprite
   *      that floats above its tile);
   *   2. the billboard of a neutral an order may name (a destructible or a
   *      camp member): an attack on it. A hostile in front still wins, as it
   *      is checked first;
   *   3. the terrain cell: an enemy at that cell, else such a neutral whose
   *      footprint covers it (so a click on any tile of a multi-tile body
   *      resolves where its one centered glyph doesn't reach), else a rally
   *      tile.
   */
  private setFromClient(clientX: number, clientY: number, mode: ObjectiveArmMode): boolean {
    const enemyId = this.renderer.pickInstance(clientX, clientY, this.enemyBillboards());
    if (enemyId !== null) {
      this.enqueueObjective(mode, { kind: 'enemy', unitId: enemyId });
      return true;
    }

    const neutralId = this.renderer.pickInstance(clientX, clientY, this.destructibleBillboards());
    if (neutralId !== null) {
      this.enqueueObjective(mode, { kind: 'neutral', unitId: neutralId });
      return true;
    }

    const cell = this.renderer.pickCell(clientX, clientY, this.terrain.mesh);
    if (!cell) return false;
    const enemies: EnemyAtCell[] = this.world.units
      .filter((u) => u.team === 'enemy' && u.currentHp > 0)
      .map((u) => ({ id: u.id, cell: u.position }));
    // The neutrals an order may name. A click on a camp member orders an
    // attack, and that first blow aggros its camp.
    const neutrals: NeutralAtCell[] = this.world.units
      .filter((u) => validNeutralObjectiveTarget(this.world, u.id) !== null)
      .map((u) => ({ id: u.id, cells: cellsOccupiedBy(u) }));
    this.enqueueObjective(mode, objectiveAtCell(cell, enemies, neutrals));
    return true;
  }

  /** Enqueue a player `setObjective` command in `mode`, for the drain at the
   *  top of a tick: the one place `setFromClient`'s three paths and `setOn`
   *  set an objective. */
  private enqueueObjective(mode: ObjectiveArmMode, target: ObjectiveTarget): void {
    this.world.enqueueCommand({ kind: 'setObjective', team: 'player', objective: { mode, target } });
  }
}
