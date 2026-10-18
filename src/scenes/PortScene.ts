/**
 * PortScene wraps PortScreen, DOM only, as RewardScene does. It takes no
 * payload: the screen reads the live stock off `ctx.run.portStock`, rolled
 * at the dock, and re-renders in place after each trade. It never dismisses
 * itself: `leavePort` lands the run on 'map' with no event, and Game's
 * dispatch swaps the map in.
 */

import { PortScreen } from '../ui/PortScreen';
import { requireRun, type Scene, type SceneContext } from './Scene';

export class PortScene implements Scene {
  private screen: PortScreen | null = null;

  mount(ctx: SceneContext): void {
    this.screen = new PortScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, requireRun(ctx), ctx.bus, ctx.controlSlot);
    this.screen.show();
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
