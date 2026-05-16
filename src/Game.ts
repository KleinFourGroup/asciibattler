import * as THREE from 'three';
import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { SpriteRenderer } from './render/SpriteRenderer';
import { COLORS } from './render/palette';
import { Clock } from './core/Clock';
import { EventBus } from './core/EventBus';
import { TICK_RATE } from './config';
import type { GameEvents } from './core/events';

/**
 * Top-level orchestrator. Owns the EventBus, Clock, Renderer, FontAtlas,
 * SpriteRenderer, and (eventually) the run state machine + current screen.
 */
export class Game {
  private readonly bus = new EventBus<GameEvents>();
  private readonly clock: Clock;
  private readonly renderer: Renderer;
  private readonly fontAtlas: FontAtlas;
  private readonly sprites: SpriteRenderer;
  private tickCount = 0;

  constructor(canvas: HTMLCanvasElement, fontAtlas: FontAtlas) {
    this.fontAtlas = fontAtlas;

    this.clock = new Clock(TICK_RATE, () => {
      this.tickCount++;
      this.bus.emit('tick', { tick: this.tickCount });
    });

    this.renderer = new Renderer(canvas, (dt) => this.clock.advance(dt));

    this.sprites = new SpriteRenderer(this.fontAtlas);
    this.renderer.scene.add(this.sprites.mesh);

    // Step 2.2 verify: 5 sprites at fixed positions so we can confirm
    // billboarding (orbit the camera — they always face you), per-instance
    // color (each is a different palette entry), and per-instance glyph.
    // Removed at Step 3.2 when real units take over.
    const testSprites: Array<{ glyph: string; color: string; x: number; z: number }> = [
      { glyph: 'M', color: COLORS.TERMINAL_GREEN, x: -2, z: 0 },
      { glyph: 'a', color: COLORS.FLOURESCENT_BLUE, x: -1, z: -1 },
      { glyph: '@', color: COLORS.TERMINAL_AMBER, x: 0, z: 0 },
      { glyph: 'M', color: COLORS.NEON_RED, x: 1, z: -1 },
      { glyph: 'a', color: COLORS.NEON_PURPLE, x: 2, z: 0 },
    ];
    for (const s of testSprites) {
      this.sprites.addSprite(s.glyph, s.color, new THREE.Vector3(s.x, 0.5, s.z));
    }

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
