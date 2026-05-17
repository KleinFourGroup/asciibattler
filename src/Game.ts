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
import { MovementBehavior } from './sim/behaviors/MovementBehavior';
import { AttackBehavior } from './sim/behaviors/AttackBehavior';
import { DeathBehavior } from './sim/behaviors/DeathBehavior';
import { GRID_SIZE, TICK_RATE } from './config';
import type { GameEvents } from './core/events';
import type { Team, UnitTemplate } from './sim/Unit';
import { Run } from './run/Run';
import { dump as dumpNodeMap } from './run/NodeMap';
import { MapScreen } from './ui/MapScreen';

// Hardcoded for development. TODO(roadmap-4.5): roll fresh from Date.now()
// on defeat / new run.
const RUN_SEED = 54321;

const MELEE_COLUMNS = [2, 6, 10] as const;
const RANGED_COLUMNS = [4, 8] as const;

/**
 * Top-level orchestrator. Owns the EventBus, Clock, Renderer, FontAtlas,
 * SpriteRenderer, the Run state machine, and the active battle World (when
 * one is running).
 */
export class Game {
  private readonly bus = new EventBus<GameEvents>();
  private readonly clock: Clock;
  private readonly renderer: Renderer;
  private readonly fontAtlas: FontAtlas;
  private readonly sprites: SpriteRenderer;
  private readonly terrain: TerrainRenderer;
  /**
   * The active battle's World, or null when between battles (map screen,
   * defeat). Recreated per battle on `battle:started`; torn down on
   * `battle:ended`.
   */
  private world: World | null = null;
  // Public so noUnusedLocals doesn't fire on the construct-and-subscribe field.
  // The bus subscription keeps the instance alive regardless of this reference.
  readonly battleRenderer: BattleRenderer;
  // TODO(roadmap-5.3): debug grid overlay — remove before MVP ships.
  private readonly gridHelper: THREE.GridHelper;
  private readonly run: Run;
  private readonly mapScreen: MapScreen;

  constructor(canvas: HTMLCanvasElement, fontAtlas: FontAtlas, uiMount: HTMLElement) {
    this.fontAtlas = fontAtlas;

    // Construct Run first so its battle:ended handler subscribes before
    // Game's — Game's handler reads run.phase, which Run must have already
    // updated by then.
    this.run = new Run(RUN_SEED, this.bus);
    console.log(dumpNodeMap(this.run.nodeMap));

    this.clock = new Clock(TICK_RATE, () => this.world?.tick());

    this.renderer = new Renderer(canvas, (dt) => {
      this.clock.advance(dt);
      this.battleRenderer.update(dt);
    });

    // Terrain first so opaque-before-transparent render order is natural.
    // Terrain seed is independent — terrain is decorative and doesn't need
    // to follow the run RNG.
    this.terrain = new TerrainRenderer(12345, GRID_SIZE);
    this.renderer.scene.add(this.terrain.mesh);

    this.sprites = new SpriteRenderer(this.fontAtlas);
    this.renderer.scene.add(this.sprites.mesh);

    // The sim/render seam: subscribes to unit:* events and translates them
    // into SpriteRenderer calls. Bus subscriptions are set up here; per-
    // battle World binding happens later via `attach` in beginBattle().
    this.battleRenderer = new BattleRenderer(this.sprites, this.bus);

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
      const target = this.world?.findUnit(targetId);
      if (!target) return;
      console.log(
        `[attack] #${attackerId} → #${targetId}: -${damage} HP (now ${target.currentHp}/${target.stats.maxHp})`,
      );
    });

    this.bus.on('battle:started', () => this.beginBattle());
    this.bus.on('battle:ended', ({ winner }) => this.endBattle(winner));

    this.mapScreen = new MapScreen(uiMount, this.bus);
    this.mapScreen.show(this.run.nodeMap, this.run.currentNodeId);
  }

  start(): void {
    this.renderer.start();
  }

  /**
   * Spin up a fresh World for the encounter Run just announced. Order
   * matters: attach BattleRenderer to the new world *before* spawning, so
   * unit:spawned events find the renderer ready.
   */
  private beginBattle(): void {
    const encounter = this.run.currentEncounter;
    if (!encounter) {
      throw new Error('battle:started fired without a Run encounter');
    }

    this.mapScreen.hide();
    this.world = new World(this.bus, new RNG(encounter.worldSeed), GRID_SIZE);
    this.battleRenderer.attach(this.world);
    this.spawnTeam('player', encounter.playerTeam);
    this.spawnTeam('enemy', encounter.enemyTeam);
  }

  /**
   * Tear down the finished battle. Run has already advanced its phase by the
   * time this runs (subscription order); we just react to the new phase.
   */
  private endBattle(winner: Team): void {
    console.log(`[battle] ended — winner: ${winner}`);
    this.battleRenderer.detach();
    this.world = null;

    if (this.run.phase === 'map') {
      this.mapScreen.show(this.run.nodeMap, this.run.currentNodeId);
    } else if (this.run.phase === 'defeat') {
      // TODO(roadmap-4.5): wire the Game Over screen + fresh-run reset.
      console.log('[run] defeated — refresh the page to start a new run');
    }
  }

  /**
   * Spawn a pre-rolled team into the active world. Positions follow the
   * CHECKPOINT 5 formation: 3 melee front rank, 2 ranged rear rank. Player
   * faces north (rows 1–2); enemy faces south (rows 9–10).
   */
  private spawnTeam(team: Team, templates: readonly UnitTemplate[]): void {
    if (!this.world) throw new Error('spawnTeam called without an active world');
    const meleeRow = team === 'player' ? 2 : 9;
    const rangedRow = team === 'player' ? 1 : 10;
    let meleeIdx = 0;
    let rangedIdx = 0;
    for (const tmpl of templates) {
      const position =
        tmpl.archetype === 'melee'
          ? { x: MELEE_COLUMNS[meleeIdx++]!, y: meleeRow }
          : { x: RANGED_COLUMNS[rangedIdx++]!, y: rangedRow };
      const u = this.world.spawnUnit(tmpl, team, position);
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
