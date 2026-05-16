import * as THREE from 'three';
import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { SpriteRenderer, type SpriteHandle } from './render/SpriteRenderer';
import { TerrainRenderer } from './render/TerrainRenderer';
import { COLORS } from './render/palette';
import { Clock } from './core/Clock';
import { EventBus } from './core/EventBus';
import { GRID_SIZE, TICK_RATE } from './config';
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
  private readonly terrain: TerrainRenderer;
  private tickCount = 0;

  // Step 2.3 verify state. Removed at Step 3.2 when real units take over.
  private elapsedSeconds = 0;
  private readonly orbiterHandle: SpriteHandle;
  private readonly extraHandles: SpriteHandle[] = [];

  private static readonly _scratchVec3 = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, fontAtlas: FontAtlas) {
    this.fontAtlas = fontAtlas;

    this.clock = new Clock(TICK_RATE, () => {
      this.tickCount++;
      this.bus.emit('tick', { tick: this.tickCount });
    });

    this.renderer = new Renderer(canvas, (dt) => {
      this.clock.advance(dt);
      this.updateAnimation(dt);
    });

    // Terrain first so opaque-before-transparent render order is natural.
    // Seed is hardcoded for Step 2.4 verify; the Run will own this at Step 4.3.
    this.terrain = new TerrainRenderer(12345, GRID_SIZE);
    this.renderer.scene.add(this.terrain.mesh);

    this.sprites = new SpriteRenderer(this.fontAtlas);
    this.renderer.scene.add(this.sprites.mesh);

    // Step 2.2 verify: 5 fixed sprites. Removed at Step 3.2.
    const fixedSprites = [
      { glyph: 'M', color: COLORS.TERMINAL_GREEN, x: -2, z: 0 },
      { glyph: 'a', color: COLORS.FLOURESCENT_BLUE, x: -1, z: -1 },
      { glyph: '@', color: COLORS.TERMINAL_AMBER, x: 0, z: 0 },
      { glyph: 'M', color: COLORS.NEON_RED, x: 1, z: -1 },
      { glyph: 'a', color: COLORS.NEON_PURPLE, x: 2, z: 0 },
    ];
    for (const s of fixedSprites) {
      this.sprites.addSprite(s.glyph, s.color, new THREE.Vector3(s.x, 0.5, s.z));
    }

    // Step 2.3 verify: one sprite that orbits via updateSprite() calls. Lives
    // above the row so it's clearly distinguished from the fixed ones.
    this.orbiterHandle = this.sprites.addSprite(
      '@',
      COLORS.TERMINAL_AMBER,
      new THREE.Vector3(0, 1.8, 0),
    );

    // Spawn/despawn via keyboard so the user can watch instance-count
    // compaction work in practice.
    window.addEventListener('keydown', this.handleKeyDown);
    console.log('[step 2.3] press `s` to spawn a random sprite, `d` to despawn one');
    console.log('[step 2.5] press `q` to toggle palette-quantization post-process');

    // Step 1.3 verify: prove the clock is ticking at ~10Hz independent of FPS.
    // Remove (or move behind a debug flag) once real sim code starts logging.
    this.bus.on('tick', ({ tick }) => {
      if (tick % 10 === 0) console.log(`[clock] tick ${tick}`);
    });
  }

  start(): void {
    this.renderer.start();
  }

  /** Per-frame visual updates. Distinct from the tick-driven simulation. */
  private updateAnimation(dt: number): void {
    this.elapsedSeconds += dt;
    const r = 2.5;
    const ang = this.elapsedSeconds * 1.2; // rad/sec
    Game._scratchVec3.set(Math.cos(ang) * r, 1.8, Math.sin(ang) * r);
    this.sprites.updateSprite(this.orbiterHandle, { position: Game._scratchVec3 });
  }

  private static readonly RANDOM_GLYPHS = ['M', 'a', '@'] as const;
  private static readonly RANDOM_COLORS = [
    COLORS.TERMINAL_GREEN,
    COLORS.NEON_RED,
    COLORS.FLOURESCENT_BLUE,
    COLORS.TERMINAL_AMBER,
    COLORS.NEON_PURPLE,
  ];

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 's' || e.key === '+') {
      const x = (Math.random() - 0.5) * 6;
      const z = (Math.random() - 0.5) * 6;
      const glyph = Game.RANDOM_GLYPHS[Math.floor(Math.random() * Game.RANDOM_GLYPHS.length)]!;
      const color = Game.RANDOM_COLORS[Math.floor(Math.random() * Game.RANDOM_COLORS.length)]!;
      const h = this.sprites.addSprite(glyph, color, new THREE.Vector3(x, 0.5, z));
      this.extraHandles.push(h);
      console.log(`[sprites] spawn -> count=${this.sprites.count}`);
    } else if (e.key === 'd' || e.key === '-') {
      const h = this.extraHandles.pop();
      if (h) {
        this.sprites.removeSprite(h);
        console.log(`[sprites] despawn -> count=${this.sprites.count}`);
      } else {
        console.log('[sprites] no dynamic sprites left to despawn');
      }
    } else if (e.key === 'q') {
      const enabled = this.renderer.togglePostProcess();
      console.log(`[post-process] palette quantization: ${enabled ? 'ON' : 'OFF'}`);
    }
  };
}
