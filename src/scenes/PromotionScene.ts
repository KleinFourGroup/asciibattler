/**
 * PromotionScene wraps PromotionScreen, DOM only. It takes the promotions in
 * its constructor, from the `promotion:pending` payload at the swap. Its
 * button sends `dismissPromotion`, which Run resolves into the run's next
 * step: the encounter's next turn or its end, or the map after a rest.
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
