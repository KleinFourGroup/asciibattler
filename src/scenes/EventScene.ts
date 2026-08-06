/**
 * EventScene (74f). DOM-only wrapper around EventScreen — the PortScene
 * shape. Takes no payload: the screen reads the LIVE active page off
 * `ctx.run` (`currentEventPage` / `eventChoiceEnabled`) and re-renders off
 * `event:pageChanged`. Terminal exits never dismiss this scene from
 * inside: a return-to-map lands the run on 'map' with no emit, so Game's
 * chooseEventOption case swaps the map explicitly (the leavePort
 * silent-transition pattern), and a start-encounter fires
 * `battle:started`, whose subscription swaps the BattleScene.
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
