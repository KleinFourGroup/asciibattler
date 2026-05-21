/**
 * GameOverScene (A5). DOM-only wrapper around GameOverScreen. Variant
 * ('defeat' | 'complete') is fixed at construction — the run:victory /
 * run:defeated bus event determines which one Game spawns.
 */

import { GameOverScreen, type GameOverVariant } from '../ui/GameOverScreen';
import type { Scene, SceneContext } from './Scene';

export class GameOverScene implements Scene {
  private screen: GameOverScreen | null = null;

  constructor(private readonly variant: GameOverVariant) {}

  mount(ctx: SceneContext): void {
    this.screen = new GameOverScreen(ctx.uiMount, ctx.dispatcher, ctx.audio);
    this.screen.show(this.variant);
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
