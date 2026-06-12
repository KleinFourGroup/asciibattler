/**
 * PostTurnScene (H4b). DOM-only wrapper around PostTurnScreen, mirroring
 * PromotionScene. Takes the `turn:resolved` payload via constructor. The screen
 * advances on the Continue click (M3 removed the auto-timer) via `advanceTurn`,
 * which rolls into the next turn or ends the encounter (recruit / promotion /
 * defeat).
 */

import { PostTurnScreen } from '../ui/PostTurnScreen';
import type { GameEvents } from '../core/events';
import type { Scene, SceneContext } from './Scene';

export class PostTurnScene implements Scene {
  private screen: PostTurnScreen | null = null;

  constructor(private readonly info: GameEvents['turn:resolved']) {}

  mount(ctx: SceneContext): void {
    this.screen = new PostTurnScreen(ctx.uiMount, ctx.dispatcher, ctx.audio);
    this.screen.show(this.info);
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
