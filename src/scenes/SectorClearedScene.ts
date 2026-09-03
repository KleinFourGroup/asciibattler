/**
 * SectorClearedScene (67b). DOM-only wrapper around SectorClearedScreen —
 * the GameOverScene shape: the display pair is fixed at construction (from
 * the `sector:cleared` payload Game hands over; the cleared sector is
 * unnameable from Run getters by then). Its button dispatches
 * `dismissSectorCleared`, whose Game route swaps to the new sector's map.
 */

import { SectorClearedScreen } from '../ui/SectorClearedScreen';
import type { Scene, SceneContext } from './Scene';

export class SectorClearedScene implements Scene {
  private screen: SectorClearedScreen | null = null;

  constructor(
    private readonly clearedSectorTitle: string,
    private readonly nextSectorTitle: string,
    // §90 — the seam pool pair (pre-floor → post-floor) from the same payload.
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
