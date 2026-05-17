import * as THREE from 'three';
import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { SpriteRenderer } from './render/SpriteRenderer';
import { TerrainRenderer } from './render/TerrainRenderer';
import { BattleRenderer } from './render/BattleRenderer';
import { COLORS } from './render/palette';
import { Clock } from './core/Clock';
import { EventBus } from './core/EventBus';
import { RNG } from './core/RNG';
import { World } from './sim/World';
import { rollUnit } from './sim/archetypes';
import { MovementBehavior } from './sim/behaviors/MovementBehavior';
import { AttackBehavior } from './sim/behaviors/AttackBehavior';
import { DeathBehavior } from './sim/behaviors/DeathBehavior';
import { GRID_SIZE, TICK_RATE } from './config';
import type { GameEvents } from './core/events';
import { generate as generateNodeMap, dump as dumpNodeMap, type NodeMap } from './run/NodeMap';
import { MapScreen } from './ui/MapScreen';

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
  // TODO(roadmap-5.3): debug grid overlay — remove before MVP ships.
  private readonly gridHelper: THREE.GridHelper;
  // TODO(roadmap-4.3): currentNodeId moves to Run.ts when the run state machine
  // lands. For now Game owns it so MapScreen stays a pure view.
  private readonly nodeMap: NodeMap;
  private currentNodeId: number;
  private readonly mapScreen: MapScreen;

  constructor(canvas: HTMLCanvasElement, fontAtlas: FontAtlas, uiMount: HTMLElement) {
    this.fontAtlas = fontAtlas;

    // TODO(roadmap-4.3): Run will fork this RNG from the run-level stream
    // instead of hardcoding a seed here.
    this.world = new World(this.bus, new RNG(54321), GRID_SIZE);

    this.clock = new Clock(TICK_RATE, () => this.world.tick());

    this.renderer = new Renderer(canvas, (dt) => {
      this.clock.advance(dt);
      this.battleRenderer.update(dt);
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

    // GridHelper: 12 divisions over a 12-unit span aligns its lines with the
    // BattleRenderer cell edges (centered on origin). Lifted to y=0 to sit
    // between the terrain (base y=-0.5) and the sprites (y=0.5).
    this.gridHelper = new THREE.GridHelper(
      GRID_SIZE,
      GRID_SIZE,
      COLORS.FLOURESCENT_BLUE,
      COLORS.FLOURESCENT_BLUE,
    );
    this.gridHelper.position.y = 0;
    this.renderer.scene.add(this.gridHelper);

    this.spawnInitialUnits();

    window.addEventListener('keydown', this.handleKeyDown);
    console.log('[keys] q: toggle post-process · g: toggle grid overlay');

    // Step 1.3 verify: prove the clock is ticking at ~10Hz independent of FPS.
    // TODO(roadmap-5.3): remove (or gate behind a debug flag) once real sim
    // code starts logging.
    this.bus.on('tick', ({ tick }) => {
      if (tick % 10 === 0) console.log(`[clock] tick ${tick}`);
    });

    // Step 3.7 verify: log HP changes until the HUD lands.
    // TODO(roadmap-5.1): replaced by the in-battle HUD.
    this.bus.on('unit:attacked', ({ attackerId, targetId, damage }) => {
      const target = this.world.findUnit(targetId);
      if (!target) return;
      console.log(
        `[attack] #${attackerId} → #${targetId}: -${damage} HP (now ${target.currentHp}/${target.stats.maxHp})`,
      );
    });

    // Step 3.9 verify: log battle outcome. Phase 4 wires this to Run state.
    this.bus.on('battle:ended', ({ winner }) => {
      console.log(`[battle] ended — winner: ${winner}`);
    });

    // Step 4.2: render the node map. Hardcoded seed for now — Run.ts will
    // own NodeMap generation from the run-level RNG stream at Step 4.3.
    this.nodeMap = generateNodeMap(new RNG(54321));
    this.currentNodeId = this.nodeMap.rootId;
    console.log(dumpNodeMap(this.nodeMap));
    this.mapScreen = new MapScreen(uiMount, this.bus);
    this.mapScreen.show(this.nodeMap, this.currentNodeId);

    // Step 4.2 verify: log node entry until Run.ts wires battle transitions.
    this.bus.on('run:nodeEntered', ({ nodeId }) => {
      console.log(`[run] entered node ${nodeId}`);
      this.currentNodeId = nodeId;
      this.mapScreen.show(this.nodeMap, this.currentNodeId);
    });
  }

  start(): void {
    this.renderer.start();
  }

  /**
   * Step 3.2 verify + CHECKPOINT 5 mixed-archetype sanity check: each side
   * fields a 3-melee front rank and a 2-ranged rear rank. Stats rolled from
   * the battle RNG so the lineup is deterministic for seed 54321. Step 4.3
   * lifts team composition into Run.
   */
  private spawnInitialUnits(): void {
    const MELEE_COLUMNS = [2, 6, 10] as const;
    const RANGED_COLUMNS = [4, 8] as const;
    this.spawnRank('player', 'melee', MELEE_COLUMNS, 2);
    this.spawnRank('player', 'ranged', RANGED_COLUMNS, 1);
    this.spawnRank('enemy', 'melee', MELEE_COLUMNS, 9);
    this.spawnRank('enemy', 'ranged', RANGED_COLUMNS, 10);
  }

  private spawnRank(
    team: 'player' | 'enemy',
    archetype: 'melee' | 'ranged',
    columns: readonly number[],
    row: number,
  ): void {
    for (const x of columns) {
      const u = this.world.spawnUnit(rollUnit(archetype, this.world.rng), team, { x, y: row });
      u.behaviors.push(new MovementBehavior(), new AttackBehavior(), new DeathBehavior());
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'q') {
      const enabled = this.renderer.togglePostProcess();
      console.log(`[post-process] palette quantization: ${enabled ? 'ON' : 'OFF'}`);
    } else if (e.key === 'g') {
      this.gridHelper.visible = !this.gridHelper.visible;
      console.log(`[grid] overlay: ${this.gridHelper.visible ? 'ON' : 'OFF'}`);
    }
  };
}
