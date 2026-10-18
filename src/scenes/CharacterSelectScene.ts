/**
 * CharacterSelectScene wraps CharacterSelectScreen, DOM only, as
 * GameOverScene does. With MenuScene, one of the two scenes that mount with
 * no run: the choice comes before the run is made, so it never calls
 * `requireRun`.
 */

import { CharacterSelectScreen } from '../ui/CharacterSelectScreen';
import type { Scene, SceneContext } from './Scene';

export class CharacterSelectScene implements Scene {
  private screen: CharacterSelectScreen | null = null;

  mount(ctx: SceneContext): void {
    this.screen = new CharacterSelectScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, ctx.menu, ctx.escalation);
    this.screen.show();
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
