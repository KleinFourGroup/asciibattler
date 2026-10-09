/**
 * RestScene. DOM-only wrapper around RestScreen — the EventScene shape.
 * Takes no payload: the screen reads what the rest would do off `ctx.run`.
 * It never dismisses itself: the option's command lands the run on
 * 'promotion' (`promotion:pending` swaps) or on 'map' (Game's
 * `chooseRestOption` case swaps the map).
 */

import { RestScreen } from '../ui/RestScreen';
import { requireRun, type Scene, type SceneContext } from './Scene';

export class RestScene implements Scene {
  private screen: RestScreen | null = null;

  mount(ctx: SceneContext): void {
    this.screen = new RestScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, requireRun(ctx));
    this.screen.show();
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
