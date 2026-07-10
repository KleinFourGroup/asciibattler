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
    // 49f — the cache thunk feeds the at-will packet row (read live at
    // render time, the CardListButton getUnits pattern).
    this.screen.show(this.info, ctx.run.team, () => ctx.run.cache);
    this.unsubscribes = [
      ctx.bus.on('turn:handRedrawn', (payload) => this.screen?.updateHand(payload)),
      ctx.bus.on('turn:unitEmpowered', (payload) => this.screen?.updateEmpower(payload)),
      // 49f — a packet fire at this gate (strip row or cache modal)
      // refreshes grants/badges/pools in place; a Pass advances the strip's
      // auto-arm; any other cache change re-renders the packet row.
      ctx.bus.on('run:packetUsed', (payload) => this.screen?.updatePacketUsed(payload)),
      ctx.bus.on('turn:grantPassed', (payload) => this.screen?.updateGrantPassed(payload)),
      ctx.bus.on('run:cacheChanged', () => this.screen?.updateCache()),
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
