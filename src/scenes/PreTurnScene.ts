/**
 * PreTurnScene (H4b). DOM-only wrapper around PreTurnScreen, mirroring
 * PromotionScene. Takes the `turn:starting` payload via constructor — Game
 * pulls it from the event at swap time. The player advances via the Fight
 * button → `advanceTurn` command, which starts the turn's battle (the H4b
 * auto-advance is gone as of K3 — the redraw decision shouldn't race a timer).
 *
 * K3 — also forwards `turn:handRedrawn` to the screen so a redraw swaps the
 * displayed hand in place. The subscription is scene-scoped (mount → dispose),
 * matching the HUD's battle-scoped hotkey pattern: outside this screen the
 * event has no listener (and the command can't fire anyway — phase-gated).
 */

import { PreTurnScreen } from '../ui/PreTurnScreen';
import type { GameEvents } from '../core/events';
import type { Scene, SceneContext } from './Scene';

export class PreTurnScene implements Scene {
  private screen: PreTurnScreen | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly info: GameEvents['turn:starting']) {}

  mount(ctx: SceneContext): void {
    this.screen = new PreTurnScreen(ctx.uiMount, ctx.dispatcher, ctx.audio);
    this.screen.show(this.info);
    this.unsubscribe = ctx.bus.on('turn:handRedrawn', (payload) =>
      this.screen?.updateHand(payload),
    );
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.screen?.hide();
    this.screen = null;
  }
}
