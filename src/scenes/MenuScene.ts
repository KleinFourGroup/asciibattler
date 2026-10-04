/**
 * MenuScene (116c). DOM-only wrapper around MenuScreen, the boot screen on a
 * plain URL (src/scenes/menuRules.ts). With the CharacterSelectScene, one of
 * the two scenes that mount with `ctx.run === null`: the menu comes before
 * any run, and after one has ended.
 */

import { MenuScreen } from '../ui/MenuScreen';
import type { Scene, SceneContext } from './Scene';

export class MenuScene implements Scene {
  private screen: MenuScreen | null = null;

  mount(ctx: SceneContext): void {
    this.screen = new MenuScreen(ctx.uiMount, ctx.audio, ctx.save, ctx.menu);
    this.screen.show();
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
