/**
 * GameOverScene (A5). DOM-only wrapper around GameOverScreen. Variant
 * ('defeat' | 'complete') is fixed at construction — the run:victory /
 * run:defeated bus event determines which one Game spawns.
 */

import { GameOverScreen, type GameOverVariant } from '../ui/GameOverScreen';
import { seedShown } from './menuRules';
import type { Scene, SceneContext } from './Scene';

export class GameOverScene implements Scene {
  private screen: GameOverScreen | null = null;

  constructor(private readonly variant: GameOverVariant) {}

  mount(ctx: SceneContext): void {
    this.screen = new GameOverScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, ctx.journal, ctx.menu.atBoot);
    // 102d — the finished run is still `ctx.run` here (a reset replaces it
    // only off this screen's own button); its ledger is the stats' source,
    // and its stream root the seed the screen shows (116c-post2).
    const run = ctx.run;
    this.screen.show(
      this.variant,
      run?.fallenLedger ?? [],
      run !== null ? seedShown(run.streamRoot) : null,
      run !== null ? { level: run.escalation, unlocked: ctx.escalation.unlocked, character: run.character.name } : null,
    );
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
