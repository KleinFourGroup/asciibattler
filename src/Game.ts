import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { SpriteRenderer } from './render/SpriteRenderer';
import { TerrainRenderer } from './render/TerrainRenderer';
import { BattleRenderer } from './render/BattleRenderer';
import { Clock } from './core/Clock';
import { EventBus } from './core/EventBus';
import { RNG } from './core/RNG';
import { World } from './sim/World';
import { MovementBehavior } from './sim/behaviors/MovementBehavior';
import { AttackBehavior } from './sim/behaviors/AttackBehavior';
import { GRID_SIZE, TICK_RATE } from './config';
import type { GameEvents } from './core/events';
import type { Team, UnitTemplate } from './sim/Unit';
import { Run } from './run/Run';
import type { RunCommand, RunDispatcher } from './run/Command';
import { MapScreen } from './ui/MapScreen';
import { RecruitScreen } from './ui/RecruitScreen';
import { GameOverScreen } from './ui/GameOverScreen';
import { HUD } from './ui/HUD';

/**
 * CHECKPOINT 5 formation anchors for the starting 3-melee + 2-ranged team.
 * Preserved exactly so default-team battle outcomes don't shift; recruited
 * extras fall through to `distributeColumns`.
 */
const DEFAULT_MELEE_COLUMNS = [2, 6, 10] as const;
const DEFAULT_RANGED_COLUMNS = [4, 8] as const;

/**
 * Evenly spread `count` units across grid columns 1..10 (leaving columns 0
 * and 11 as buffer). Returns integer column indices. Handles up to 10 units
 * per rank without collisions; recruitment-driven team growth bounded by
 * MVP run length stays well inside that.
 */
function distributeColumns(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [6];
  const cols: number[] = [];
  const left = 1;
  const right = 10;
  for (let i = 0; i < count; i++) {
    cols.push(Math.round(left + ((right - left) * i) / (count - 1)));
  }
  return cols;
}

function meleeColumnsFor(count: number): readonly number[] {
  return count === DEFAULT_MELEE_COLUMNS.length
    ? DEFAULT_MELEE_COLUMNS
    : distributeColumns(count);
}

function rangedColumnsFor(count: number): readonly number[] {
  return count === DEFAULT_RANGED_COLUMNS.length
    ? DEFAULT_RANGED_COLUMNS
    : distributeColumns(count);
}

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
    this.spawnTeam('player', encounter.playerTeam);
    this.spawnTeam('enemy', encounter.enemyTeam);
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

  /**
   * Spawn a pre-rolled team into the active world. Melee fills the front
   * rank (row 2 player / 9 enemy), ranged fills the rear (row 1 / 10), each
   * spread evenly across the row so growing teams from recruitment don't
   * fall off a fixed column array.
   */
  private spawnTeam(team: Team, templates: readonly UnitTemplate[]): void {
    if (!this.world) throw new Error('spawnTeam called without an active world');
    const meleeRow = team === 'player' ? 2 : 9;
    const rangedRow = team === 'player' ? 1 : 10;

    const melee = templates.filter((t) => t.archetype === 'melee');
    const ranged = templates.filter((t) => t.archetype === 'ranged');
    const meleeCols = meleeColumnsFor(melee.length);
    const rangedCols = rangedColumnsFor(ranged.length);

    for (let i = 0; i < melee.length; i++) {
      const u = this.world.spawnUnit(melee[i]!, team, { x: meleeCols[i]!, y: meleeRow });
      u.behaviors.push(new MovementBehavior(), new AttackBehavior());
    }
    for (let i = 0; i < ranged.length; i++) {
      const u = this.world.spawnUnit(ranged[i]!, team, { x: rangedCols[i]!, y: rangedRow });
      u.behaviors.push(new MovementBehavior(), new AttackBehavior());
    }
  }
}
