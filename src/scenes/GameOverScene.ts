/**
 * GameOverScene wraps GameOverScreen, DOM only. Its variant ('defeat' or
 * 'complete') is fixed at construction, by which of `run:defeated` and
 * `run:victory` Game heard.
 */

import { GameOverScreen, type GameOverVariant } from '../ui/GameOverScreen';
import { seedShown } from './menuRules';
import type { Scene, SceneContext } from './Scene';

export class GameOverScene implements Scene {
  private screen: GameOverScreen | null = null;

  constructor(private readonly variant: GameOverVariant) {}

  mount(ctx: SceneContext): void {
    this.screen = new GameOverScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, ctx.journal, ctx.menu.atBoot);
    // The finished run is still `ctx.run` here, replaced only when the player
    // leaves this screen: its ledger is the stats' source, and its stream
    // root the seed the screen shows.
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
