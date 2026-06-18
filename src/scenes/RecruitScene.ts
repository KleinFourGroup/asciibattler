/**
 * RecruitScene (A5). DOM-only wrapper around RecruitScreen. Takes the offer
 * via constructor — the bus payload from `recruit:offered` is the freshest
 * source, and a Scene swap may happen before `ctx.run.currentOffer` is
 * read, so caller passes it explicitly.
 */

import { RecruitScreen } from '../ui/RecruitScreen';
import type { UnitTemplate } from '../sim/Unit';
import type { Scene, SceneContext } from './Scene';

export class RecruitScene implements Scene {
  private screen: RecruitScreen | null = null;

  constructor(private readonly offer: readonly UnitTemplate[]) {}

  mount(ctx: SceneContext): void {
    this.screen = new RecruitScreen(ctx.uiMount, ctx.dispatcher, ctx.audio);
    this.screen.show(this.offer, ctx.run.team);
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
