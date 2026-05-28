/**
 * PromotionScene (E4). DOM-only wrapper around PromotionScreen. Takes
 * the promotion list via constructor — Game pulls it from the
 * `promotion:pending` event payload at swap time. Dismiss button
 * dispatches `dismissPromotion`, which Run resolves into the normal
 * post-battle step (recruit offer or run:victory).
 */

import { PromotionScreen } from '../ui/PromotionScreen';
import type { PromotionInfo } from '../core/events';
import type { Scene, SceneContext } from './Scene';

export class PromotionScene implements Scene {
  private screen: PromotionScreen | null = null;

  constructor(private readonly promotions: readonly PromotionInfo[]) {}

  mount(ctx: SceneContext): void {
    this.screen = new PromotionScreen(ctx.uiMount, ctx.dispatcher, ctx.audio);
    this.screen.show(this.promotions);
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
