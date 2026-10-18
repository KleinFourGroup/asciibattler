/**
 * RewardScene wraps RewardScreen, DOM only. It takes no payload: the screen
 * reads the live offer off `ctx.run.pendingRewards`, since the
 * `reward:offered` payload is a copy, the live list shrinks as portions
 * resolve, and the bits rows are priced from the run's folds as they stand.
 * Resolving the last portion moves the run on, and the event that follows
 * (`promotion:pending`, `recruit:offered`, `run:victory`) swaps the scene.
 */

import { RewardScreen } from '../ui/RewardScreen';
import { requireRun, type Scene, type SceneContext } from './Scene';

export class RewardScene implements Scene {
  private screen: RewardScreen | null = null;

  mount(ctx: SceneContext): void {
    this.screen = new RewardScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, requireRun(ctx));
    this.screen.show();
  }

  // The rows follow the live offer every frame, so a portion resolved by a
  // command the screen did not send (a replayed journal's) ticks off too.
  tick(_dt: number): void {
    this.screen?.follow();
  }

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
