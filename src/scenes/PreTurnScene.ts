/**
 * PreTurnScene wraps PreTurnScreen, DOM only, as PromotionScene does. It
 * takes the `turn:starting` payload in its constructor, from Game at the
 * swap. The Fight button sends `advanceTurn`, which starts the turn's
 * battle; nothing advances on a timer, so a redraw never races one.
 *
 * It forwards the gate's events to the screen, which updates in place: a
 * redraw (`turn:handRedrawn`), an empower (`turn:unitEmpowered`), the deck
 * cues, a packet used, a grant passed and the cache changing. The
 * subscriptions live from mount to dispose, as the HUD's hotkeys do;
 * outside this screen the gate's commands are refused anyway.
 */

import { PreTurnScreen, type DeckCue } from '../ui/PreTurnScreen';
import type { GameEvents } from '../core/events';
import { requireRun, type Scene, type SceneContext } from './Scene';

export class PreTurnScene implements Scene {
  private screen: PreTurnScreen | null = null;
  private unsubscribes: Array<() => void> = [];

  // `dealCues` are the deal's deck cues, which fire before this scene exists,
  // so Game buffers them for it.
  constructor(
    private readonly info: GameEvents['turn:starting'],
    private readonly dealCues: readonly DeckCue[] = [],
  ) {}

  mount(ctx: SceneContext): void {
    this.screen = new PreTurnScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, ctx.controlSlot);
    // The cache as a function, read when the packet row renders.
    const run = requireRun(ctx);
    this.screen.show(this.info, run.team, () => run.cache, this.dealCues);
    this.unsubscribes = [
      ctx.bus.on('turn:handRedrawn', (payload) => this.screen?.updateHand(payload)),
      // The gate's deck cues (a redraw, Surge, Cull) queue on the screen;
      // they always come before the hand's swap in the same dispatch, which
      // plays them.
      ctx.bus.on('deck:cardDrawn', (e) => this.screen?.enqueueCue({ kind: 'drawn', ...e })),
      ctx.bus.on('deck:cardDiscarded', (e) =>
        this.screen?.enqueueCue({ kind: 'discarded', ...e }),
      ),
      ctx.bus.on('deck:reshuffled', (e) => this.screen?.enqueueCue({ kind: 'reshuffled', ...e })),
      ctx.bus.on('turn:unitEmpowered', (payload) => this.screen?.updateEmpower(payload)),
      // A packet used at the gate (from the strip or the cache modal)
      // refreshes the grants, badges and pools in place; a Pass moves the
      // strip's auto-arm on; any other change to the cache re-renders the
      // packet row.
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
