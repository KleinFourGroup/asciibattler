/**
 * RecruitScene wraps RecruitScreen, DOM only. It takes the offer in its
 * constructor, from the `recruit:offered` payload Game hands over at the
 * swap.
 */

import { RecruitScreen } from '../ui/RecruitScreen';
import type { UnitTemplate } from '../sim/Unit';
import { requireRun, type Scene, type SceneContext } from './Scene';

export class RecruitScene implements Scene {
  private screen: RecruitScreen | null = null;

  constructor(private readonly offer: readonly UnitTemplate[]) {}

  mount(ctx: SceneContext): void {
    this.screen = new RecruitScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, ctx.controlSlot);
    this.screen.show(this.offer, requireRun(ctx).team);
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
