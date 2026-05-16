import * as THREE from 'three';
import { Renderer } from './render/Renderer';
import { COLORS } from './render/palette';
import { Clock } from './core/Clock';
import { EventBus } from './core/EventBus';
import { TICK_RATE } from './config';
import type { GameEvents } from './core/events';

/**
 * Top-level orchestrator. Owns the EventBus, Clock, Renderer, and (eventually)
 * the run state machine + current screen.
 *
 * Wiring at Step 1.3:
 *   Renderer (RAF loop) -> dt -> Clock.advance -> onTick callback ->
 *   bus.emit('tick', { tick }). Anything that wants to react to ticks
 *   subscribes to the bus, never reaches into the clock.
 */
export class Game {
  private readonly bus = new EventBus<GameEvents>();
  private readonly clock: Clock;
  private readonly renderer: Renderer;
  private tickCount = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.clock = new Clock(TICK_RATE, () => {
      this.tickCount++;
      this.bus.emit('tick', { tick: this.tickCount });
    });

    this.renderer = new Renderer(canvas, (dt) => this.clock.advance(dt));

    // Step 0.2 placeholder — confirms the render loop, camera, and palette
    // wiring. Removed once the SpriteRenderer takes over (Steps 2.2 / 3.2).
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: COLORS.TERMINAL_AMBER,
        wireframe: true,
      }),
    );
    this.renderer.scene.add(cube);

    // Step 1.3 verify: prove the clock is ticking at ~10Hz independent of FPS.
    // Remove (or move behind a debug flag) once real sim code starts logging.
    this.bus.on('tick', ({ tick }) => {
      if (tick % 10 === 0) console.log(`[clock] tick ${tick}`);
    });
  }

  start(): void {
    this.renderer.start();
  }
}
