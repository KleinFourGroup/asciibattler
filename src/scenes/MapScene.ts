/**
 * MapScene wraps MapScreen, DOM only, reading the node map off `ctx.run` at
 * mount; the run holds the state, so the constructor takes nothing. Nothing
 * on the map animates, so `tick` does nothing.
 */

import { MapScreen } from '../ui/MapScreen';
import { requireRun, type Scene, type SceneContext } from './Scene';

export class MapScene implements Scene {
  private screen: MapScreen | null = null;

  mount(ctx: SceneContext): void {
    const run = requireRun(ctx);
    this.screen = new MapScreen(ctx.uiMount, ctx.dispatcher, ctx.audio, { controlSlot: ctx.controlSlot });
    this.screen.show(
      run.nodeMap,
      run.currentNodeId,
      run.visitedNodes,
      run.team,
      run.currentSectorTitle,
      // Set at the sector's entry, as the sector's title is, so it is always
      // there.
      run.bossForewarning,
    );
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
