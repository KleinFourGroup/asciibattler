import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { SpriteRenderer } from './render/SpriteRenderer';
import { TerrainRenderer } from './render/TerrainRenderer';
import { BattleRenderer } from './render/BattleRenderer';
import { Clock } from './core/Clock';
import { EventBus } from './core/EventBus';
import { RNG } from './core/RNG';
import { World } from './sim/World';
import { rollUnit } from './sim/archetypes';
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
  private readonly world: World;
  // Public so noUnusedLocals doesn't fire on the construct-and-subscribe field.
  // The bus subscription keeps the instance alive regardless of this reference.
  readonly battleRenderer: BattleRenderer;

  constructor(canvas: HTMLCanvasElement, fontAtlas: FontAtlas) {
    this.fontAtlas = fontAtlas;

    // TODO(roadmap-4.3): Run will fork this RNG from the run-level stream
    // instead of hardcoding a seed here.
    this.world = new World(this.bus, new RNG(54321), GRID_SIZE);

    this.clock = new Clock(TICK_RATE, () => this.world.tick());

    this.renderer = new Renderer(canvas, (dt) => {
      this.clock.advance(dt);
    });

    // Terrain first so opaque-before-transparent render order is natural.
    // Seed is hardcoded for Step 2.4 verify; the Run will own this at Step 4.3.
    this.terrain = new TerrainRenderer(12345, GRID_SIZE);
    this.renderer.scene.add(this.terrain.mesh);

    this.sprites = new SpriteRenderer(this.fontAtlas);
    this.renderer.scene.add(this.sprites.mesh);

    // The sim/render seam: subscribes to unit:* events and translates them
    // into SpriteRenderer calls. Constructed before any spawns so the spawn
    // events fire after the subscription is in place.
    this.battleRenderer = new BattleRenderer(this.sprites, this.world, this.bus);

    this.spawnInitialUnits();

    window.addEventListener('keydown', this.handleKeyDown);
    console.log('[step 2.5] press `q` to toggle palette-quantization post-process');

    // Step 1.3 verify: prove the clock is ticking at ~10Hz independent of FPS.
    // TODO(roadmap-5.3): remove (or gate behind a debug flag) once real sim
    // code starts logging.
    this.bus.on('tick', ({ tick }) => {
      if (tick % 10 === 0) console.log(`[clock] tick ${tick}`);
    });
  }

  start(): void {
    this.renderer.start();
  }

  /**
   * Step 3.2 verify: a fixed face-off — 5 player melees vs 5 enemy melees,
   * front and back rows, evenly spread. Stats rolled from the battle RNG so
   * the lineup is deterministic for seed 54321. Step 4.3 lifts team
   * composition into Run.
   */
  private spawnInitialUnits(): void {
    const COLUMNS = [2, 4, 6, 8, 10] as const;
    const PLAYER_ROW = 2;
    const ENEMY_ROW = 9;
    for (const x of COLUMNS) {
      this.world.spawnUnit(rollUnit('melee', this.world.rng), 'player', { x, y: PLAYER_ROW });
    }
    for (const x of COLUMNS) {
      this.world.spawnUnit(rollUnit('melee', this.world.rng), 'enemy', { x, y: ENEMY_ROW });
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'q') {
      const enabled = this.renderer.togglePostProcess();
      console.log(`[post-process] palette quantization: ${enabled ? 'ON' : 'OFF'}`);
    }
  };
}
