/**
 * PreTurnScene (H4b). DOM-only wrapper around PreTurnScreen, mirroring
 * PromotionScene. Takes the `turn:starting` payload via constructor — Game
 * pulls it from the event at swap time. The screen auto-advances (or a click
 * skips) via the `advanceTurn` command, which starts the turn's battle.
 */

import { PreTurnScreen } from '../ui/PreTurnScreen';
import type { GameEvents } from '../core/events';
import type { Scene, SceneContext } from './Scene';

export class PreTurnScene implements Scene {
  private screen: PreTurnScreen | null = null;

  constructor(private readonly info: GameEvents['turn:starting']) {}

  mount(ctx: SceneContext): void {
    this.screen = new PreTurnScreen(ctx.uiMount, ctx.dispatcher, ctx.audio);
    this.screen.show(this.info);
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
