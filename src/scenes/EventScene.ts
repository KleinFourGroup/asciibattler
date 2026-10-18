/**
 * EventScene wraps EventScreen, DOM only, as PortScene does. It takes no
 * payload: the screen reads the live page off `ctx.run`
 * (`currentEventPage`, `eventChoiceEnabled`) and re-renders on
 * `event:pageChanged`. It never dismisses itself: a return to the map lands
 * the run on 'map' with no event, and Game's dispatch swaps the map in; a
 * start-encounter emits `battle:started`, whose subscription swaps in the
 * BattleScene.
 */

import { EventScreen } from '../ui/EventScreen';
import { requireRun, type Scene, type SceneContext } from './Scene';

export class EventScene implements Scene {
  private screen: EventScreen | null = null;

  mount(ctx: SceneContext): void {
    this.screen = new EventScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, requireRun(ctx), ctx.bus);
    this.screen.show();
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
