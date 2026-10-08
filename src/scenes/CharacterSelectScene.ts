/**
 * CharacterSelectScene (63e). DOM-only wrapper around CharacterSelectScreen —
 * the GameOverScene shape. With the MenuScene, one of the two scenes that
 * mount with `ctx.run === null` (it exists precisely so the choice can
 * precede Run construction); it deliberately never calls `requireRun`.
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
