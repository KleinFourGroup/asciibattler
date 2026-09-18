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
    // 102d — the finished run is still `ctx.run` here (a reset replaces it
    // only off this screen's own button); its ledger is the stats' source.
    this.screen.show(this.variant, ctx.run?.fallenLedger ?? []);
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
