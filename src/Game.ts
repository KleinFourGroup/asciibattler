import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { SpriteRenderer } from './render/SpriteRenderer';
import { TerrainRenderer } from './render/TerrainRenderer';
import { BattleRenderer } from './render/BattleRenderer';
import { Clock } from './core/Clock';
import { EventBus } from './core/EventBus';
import { RNG } from './core/RNG';
import { World } from './sim/World';
import { spawnTeam } from './sim/battleSetup';
import { GRID_SIZE, TICK_RATE } from './config';
import type { GameEvents } from './core/events';
import { Run } from './run/Run';
import type { RunCommand, RunDispatcher } from './run/Command';
import { MapScreen } from './ui/MapScreen';
import { RecruitScreen } from './ui/RecruitScreen';
import { GameOverScreen } from './ui/GameOverScreen';
import { HUD } from './ui/HUD';

/**
 * Top-level orchestrator. Owns the EventBus, Clock, Renderer, FontAtlas,
 * SpriteRenderer, the Run state machine, and the active battle World (when
 * one is running).
 *
 * A2: implements `RunDispatcher`. UI screens hold this as their command
 * sink. Game forwards `enterNode` / `chooseRecruit` to the live Run and
 * handles `resetRun` itself (resetting can't be done by the Run being
 * reset). Because UI captures `Game` rather than `Run`, swapping the
 * underlying Run on reset is invisible to the UI.
 */
export class Game implements RunDispatcher {
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
  /**
   * Active run. Replaced on `resetRun` command, so it's not readonly — but
   * every method should still treat `this.run` as the authoritative source
   * for meta state.
   */
  private run: Run;
  private readonly mapScreen: MapScreen;
  private readonly recruitScreen: RecruitScreen;
  private readonly gameOverScreen: GameOverScreen;
  private readonly hud: HUD;

  constructor(canvas: HTMLCanvasElement, fontAtlas: FontAtlas, uiMount: HTMLElement) {
    this.fontAtlas = fontAtlas;

    // Construct Run first so its battle:ended handler subscribes before
    // Game's — Game's handler reads run.phase, which Run must have already
    // updated by then.
    this.run = new Run(Date.now(), this.bus);

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

    this.bus.on('battle:started', () => this.beginBattle());
    this.bus.on('battle:ended', () => this.endBattle());

    // UI screens hold `this` as their RunDispatcher. Captured-once is fine
    // because Game persists for the lifetime of the page; the `run` field
    // it forwards to is what gets swapped on reset.
    this.mapScreen = new MapScreen(uiMount, this);
    this.recruitScreen = new RecruitScreen(uiMount, this);
    this.gameOverScreen = new GameOverScreen(uiMount, this);
    this.hud = new HUD(uiMount, this.bus);

    this.bus.on('recruit:offered', ({ units }) => {
      this.recruitScreen.show(units);
    });
    this.bus.on('run:defeated', () => {
      this.gameOverScreen.show('defeat');
    });
    this.bus.on('run:victory', () => {
      this.gameOverScreen.show('complete');
    });

    this.mapScreen.show(this.run.nodeMap, this.run.currentNodeId, this.run.visitedNodes);
  }

  /**
   * RunDispatcher entry point. UI screens call this; Game routes:
   *   - `resetRun` → tear down the current Run and start a fresh one.
   *   - everything else → forward to `this.run.dispatch(cmd)`, then react
   *     to whatever phase Run is now in.
   */
  dispatch(command: RunCommand): void {
    switch (command.kind) {
      case 'enterNode':
        this.run.dispatch(command);
        // Hide the map screen once the run actually moved into a battle —
        // if the hop was rejected (non-frontier, wrong phase) the map
        // stays visible.
        if (this.run.phase === 'battle') {
          this.mapScreen.hide();
        }
        break;
      case 'chooseRecruit':
        this.run.dispatch(command);
        if (this.run.phase === 'map') {
          this.recruitScreen.hide();
          this.mapScreen.show(
            this.run.nodeMap,
            this.run.currentNodeId,
            this.run.visitedNodes,
          );
        }
        break;
      case 'resetRun':
        this.resetRun();
        break;
    }
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

    this.world = new World(this.bus, new RNG(encounter.worldSeed), GRID_SIZE);
    // HUD.show must run before spawnTeam so its unit:spawned handler finds
    // the bound world; same ordering rule as BattleRenderer.attach.
    this.hud.show(this.world, this.run.currentFloor);
    this.battleRenderer.attach(this.world);
    spawnTeam(this.world, 'player', encounter.playerTeam);
    spawnTeam(this.world, 'enemy', encounter.enemyTeam);
  }

  /**
   * Tear down the finished battle. Run has already advanced its phase by the
   * time this runs (subscription order); we just react to the new phase.
   */
  private endBattle(): void {
    this.battleRenderer.detach();
    this.hud.hide();
    this.world = null;

    // Run has already advanced its phase by now (subscription order). On
    // victory the recruit:offered handler already showed RecruitScreen; on
    // defeat the run:defeated handler showed GameOverScreen. Nothing to do
    // here either way.
  }

  /**
   * Tear down the current Run and start a fresh one with a new seed. Wired
   * to GameOverScreen's "Begin a new run" button via the `resetRun`
   * command. Date.now() seed gives a different map and team per restart;
   * replay / shareable seeds can hook in later by reading from URL or a
   * debug panel.
   */
  private resetRun(): void {
    this.gameOverScreen.hide();
    this.run.dispose();
    this.run = new Run(Date.now(), this.bus);
    this.mapScreen.show(this.run.nodeMap, this.run.currentNodeId, this.run.visitedNodes);
  }

}
