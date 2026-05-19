/**
 * Scene system (A5). A Scene owns the "what's on screen right now" — at most
 * one is active at a time, and Game swaps them on Run phase transitions.
 *
 * Three lifecycle hooks:
 *   - `mount(ctx)` — wire up DOM / 3D content, bus subscriptions, etc. Called
 *     once, immediately after construction.
 *   - `tick(dt)` — driven from Renderer's RAF loop. Drives in-flight
 *     animation, simulation clock, etc. DOM-only scenes typically no-op.
 *   - `dispose()` — tear everything down: remove DOM, detach 3D, unsubscribe
 *     from the bus. Called by Game before mounting the next Scene.
 *
 * `SceneContext` is the bundle of persistent, page-lifetime resources every
 * Scene may need. Built fresh by Game on each swap so `ctx.run` reflects the
 * current run (the field gets replaced on reset). Scenes that need
 * scene-specific arguments (recruit offer, gameover variant) take them via
 * their constructor.
 */

import type * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { SpriteRenderer } from '../render/SpriteRenderer';
import type { TerrainRenderer } from '../render/TerrainRenderer';
import type { FontAtlas } from '../render/FontAtlas';
import type { Run } from '../run/Run';
import type { RunDispatcher } from '../run/Command';

export interface SceneContext {
  readonly bus: EventBus<GameEvents>;
  readonly scene3D: THREE.Scene;
  readonly sprites: SpriteRenderer;
  readonly terrain: TerrainRenderer;
  readonly fontAtlas: FontAtlas;
  readonly uiMount: HTMLElement;
  readonly dispatcher: RunDispatcher;
  readonly run: Run;
}

export interface Scene {
  mount(ctx: SceneContext): void;
  tick(dt: number): void;
  dispose(): void;
}
