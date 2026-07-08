/**
 * RewardScene (48c). DOM-only wrapper around RewardScreen — the
 * PromotionScene shape. Takes no payload: the screen reads the LIVE offer
 * from `ctx.run.pendingRewards` (the reward:offered payload is a copy; the
 * live list shrinks as portions resolve, and bits displays derive from the
 * run's current folds). Resolving the last portion advances the run, whose
 * follow-on event (promotion:pending / recruit:offered / run:victory) drives
 * the next swap.
 */

import { RewardScreen } from '../ui/RewardScreen';
import type { Scene, SceneContext } from './Scene';

export class RewardScene implements Scene {
  private screen: RewardScreen | null = null;

  mount(ctx: SceneContext): void {
    this.screen = new RewardScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, ctx.run);
    this.screen.show();
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
