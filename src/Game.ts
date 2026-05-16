import * as THREE from 'three';
import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { Clock } from './core/Clock';
import { EventBus } from './core/EventBus';
import { TICK_RATE } from './config';
import type { GameEvents } from './core/events';

/**
 * Top-level orchestrator. Owns the EventBus, Clock, Renderer, FontAtlas, and
 * (eventually) the run state machine + current screen.
 */
export class Game {
  private readonly bus = new EventBus<GameEvents>();
  private readonly clock: Clock;
  private readonly renderer: Renderer;
  // FontAtlas is held here so the SpriteRenderer (Step 2.2) can consume it.
  private readonly fontAtlas: FontAtlas;
  private tickCount = 0;

  constructor(canvas: HTMLCanvasElement, fontAtlas: FontAtlas) {
    this.fontAtlas = fontAtlas;

    this.clock = new Clock(TICK_RATE, () => {
      this.tickCount++;
      this.bus.emit('tick', { tick: this.tickCount });
    });

    this.renderer = new Renderer(canvas, (dt) => this.clock.advance(dt));

    // Step 2.1 verify: render the atlas to a plane in the scene so glyph
    // quality, spacing, and UV math can be eyeballed. Removed at Step 2.2
    // when the real SpriteRenderer takes over.
    const atlasPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2), // matches the 512x256 atlas aspect
      new THREE.MeshBasicMaterial({
        map: this.fontAtlas.texture,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    // Tilt to face the default camera (Renderer puts the camera at (0,8,8)
    // looking at origin — a -45° rotation around X aligns the plane normal).
    atlasPlane.rotation.x = -Math.PI / 4;
    this.renderer.scene.add(atlasPlane);

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
