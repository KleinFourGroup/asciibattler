/**
 * PortScene (50e). DOM-only wrapper around PortScreen — the RewardScene
 * shape. Takes no payload: the screen reads the LIVE docked stock from
 * `ctx.run.portStock` (rolled at dock, §50d) and re-renders in place after
 * every transaction. `leavePort` lands the run back on 'map' with no event
 * emit, so Game's leavePort case swaps the map explicitly (the
 * chooseRecruit silent-transition pattern) — this scene never dismisses
 * itself.
 */

import { PortScreen } from '../ui/PortScreen';
import type { Scene, SceneContext } from './Scene';

export class PortScene implements Scene {
  private screen: PortScreen | null = null;

  mount(ctx: SceneContext): void {
    this.screen = new PortScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, ctx.run, ctx.bus);
    this.screen.show();
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
