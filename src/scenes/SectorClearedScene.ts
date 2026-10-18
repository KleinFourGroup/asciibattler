/**
 * SectorClearedScene wraps SectorClearedScreen, DOM only, as GameOverScene
 * does: what it shows is fixed at construction, from the `sector:cleared`
 * payload Game hands over, since by then the run's getters name the new
 * sector. Its button sends `dismissSectorCleared`, and Game's dispatch swaps
 * in the new sector's map.
 */

import { SectorClearedScreen } from '../ui/SectorClearedScreen';
import type { Scene, SceneContext } from './Scene';

export class SectorClearedScene implements Scene {
  private screen: SectorClearedScreen | null = null;

  constructor(
    private readonly clearedSectorTitle: string,
    private readonly nextSectorTitle: string,
    // The pool before the seam's floor and after it, from the same payload.
    private readonly poolBefore: number,
    private readonly poolAfter: number,
  ) {}

  mount(ctx: SceneContext): void {
    this.screen = new SectorClearedScreen(ctx.uiMount, ctx.dispatcher, ctx.audio);
    this.screen.show(this.clearedSectorTitle, this.nextSectorTitle, this.poolBefore, this.poolAfter);
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
