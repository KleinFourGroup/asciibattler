/**
 * PreTurnScene (H4b). DOM-only wrapper around PreTurnScreen, mirroring
 * PromotionScene. Takes the `turn:starting` payload via constructor — Game
 * pulls it from the event at swap time. The player advances via the Fight
 * button → `advanceTurn` command, which starts the turn's battle (the H4b
 * auto-advance is gone as of K3 — the redraw decision shouldn't race a timer).
 *
 * K3 — also forwards `turn:handRedrawn` to the screen so a redraw swaps the
 * displayed hand in place. The subscriptions are scene-scoped (mount →
 * dispose), matching the HUD's battle-scoped hotkey pattern: outside this
 * screen the events have no listener (and the commands can't fire anyway —
 * phase-gated).
 *
 * K4 — same forwarding for `turn:unitEmpowered` (badge + budget refresh).
 */

import { PreTurnScreen } from '../ui/PreTurnScreen';
import type { GameEvents } from '../core/events';
import type { Scene, SceneContext } from './Scene';

export class PreTurnScene implements Scene {
  private screen: PreTurnScreen | null = null;
  private unsubscribes: Array<() => void> = [];

  constructor(private readonly info: GameEvents['turn:starting']) {}

  mount(ctx: SceneContext): void {
    this.screen = new PreTurnScreen(ctx.uiMount, ctx.dispatcher, ctx.audio);
    this.screen.show(this.info, ctx.run.team);
    this.unsubscribes = [
      ctx.bus.on('turn:handRedrawn', (payload) => this.screen?.updateHand(payload)),
      ctx.bus.on('turn:unitEmpowered', (payload) => this.screen?.updateEmpower(payload)),
    ];
  }

  tick(_dt: number): void {}

  dispose(): void {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
    this.screen?.hide();
    this.screen = null;
  }
}
