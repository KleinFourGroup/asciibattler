/**
 * MapScene (A5). DOM-only wrapper around MapScreen. Reads node-map state
 * from `ctx.run` on mount — no constructor args, since the run state is the
 * source of truth.
 *
 * tick(dt) is a no-op: the map is event-driven (clicks dispatch enterNode);
 * there's nothing animating per frame yet. If a future feature adds idle
 * animation to the map view (parallax, hover effects, the 3D map of A5's
 * own deferred-motivation), it goes here.
 */

import { MapScreen } from '../ui/MapScreen';
import type { Scene, SceneContext } from './Scene';

export class MapScene implements Scene {
  private screen: MapScreen | null = null;

  mount(ctx: SceneContext): void {
    this.screen = new MapScreen(ctx.uiMount, ctx.dispatcher, ctx.audio);
    this.screen.show(ctx.run.nodeMap, ctx.run.currentNodeId, ctx.run.visitedNodes);
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.screen?.hide();
    this.screen = null;
  }
}
