import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { SpriteRenderer } from './render/SpriteRenderer';
import { BarRenderer } from './render/BarRenderer';
import { TerrainRenderer } from './render/TerrainRenderer';
import { WaterRenderer } from './render/WaterRenderer';
import { EventBus } from './core/EventBus';
import { GRID_SIZE } from './config';
import type { GameEvents } from './core/events';
import { Run } from './run/Run';
import type { RunCommand, RunDispatcher } from './run/Command';
import type { Scene, SceneContext } from './scenes/Scene';
import { MapScene } from './scenes/MapScene';
import { BattleScene } from './scenes/BattleScene';
import { RecruitScene } from './scenes/RecruitScene';
import { GameOverScene } from './scenes/GameOverScene';
import { AudioPlayer } from './audio/AudioPlayer';

/**
 * Top-level orchestrator. Owns the EventBus, Renderer, FontAtlas, persistent
 * 3D meshes (TerrainRenderer + SpriteRenderer), and the Run state machine —
 * everything that lives for the page's lifetime.
 *
 * A5 turned Game from a battle host into a scene manager. The "what's on
 * screen right now" lives in `activeScene`, which is swapped on Run
 * lifecycle events:
 *
 *   - battle:started → BattleScene
 *   - recruit:offered → RecruitScene
 *   - run:victory → GameOverScene('complete')
 *   - run:defeated → GameOverScene('defeat')
 *   - chooseRecruit returning to phase=='map' → MapScene (driven from
 *     dispatch, since no bus event fires for that transition)
 *   - resetRun → MapScene (new Run)
 *
 * A2: implements `RunDispatcher`. UI screens (now Scene-owned) hold this as
 * their command sink. Game forwards `enterNode` / `chooseRecruit` to the
 * live Run and handles `resetRun` itself (a Run can't reset itself).
 * Because UI captures `Game` rather than `Run`, swapping the underlying Run
 * on reset is invisible to the UI.
 */
export class Game implements RunDispatcher {
  private readonly bus = new EventBus<GameEvents>();
  private readonly renderer: Renderer;
  private readonly fontAtlas: FontAtlas;
  private readonly sprites: SpriteRenderer;
  private readonly bars: BarRenderer;
  private readonly terrain: TerrainRenderer;
  private readonly water: WaterRenderer;
  private readonly uiMount: HTMLElement;
  private readonly audio: AudioPlayer;
  /**
   * Active run. Replaced on `resetRun` command, so it's not readonly — but
   * every method should still treat `this.run` as the authoritative source
   * for meta state.
   */
  private run: Run;
  /** The scene currently mounted. Null only briefly during swap(). */
  private activeScene: Scene | null = null;

  constructor(canvas: HTMLCanvasElement, fontAtlas: FontAtlas, uiMount: HTMLElement) {
    this.fontAtlas = fontAtlas;
    this.uiMount = uiMount;
    this.audio = new AudioPlayer();

    // Construct Run first so its battle:ended handler subscribes before any
    // Game listener that reads run.phase. The recruit:offered/run:victory/
    // run:defeated subscriptions below all run *after* Run has updated phase
    // because Run emits those from within its own battle:ended handler.
    this.run = new Run(Date.now(), this.bus);

    // Renderer drives the per-frame tick of whatever scene is active.
    this.renderer = new Renderer(canvas, (dt) => this.activeScene?.tick(dt));

    // Terrain seed is independent — terrain is decorative and doesn't need
    // to follow the run RNG.
    this.terrain = new TerrainRenderer(12345, GRID_SIZE);
    this.renderer.scene.add(this.terrain.mesh);

    // C1a shallow-water visual stand-in. Empty at boot; BattleScene calls
    // setTiles after applyTerrain has populated world.tileGrid.
    this.water = new WaterRenderer();
    this.renderer.scene.add(this.water.mesh);

    this.sprites = new SpriteRenderer(this.fontAtlas);
    // Both meshes live in the same scene; layer membership routes them to
    // the right composer. `mesh` (layer 0) → mainComposer (visible color);
    // `bloomMesh` (BLOOM_LAYER) → bloomComposer (halo input).
    this.renderer.scene.add(this.sprites.mesh);
    this.renderer.scene.add(this.sprites.bloomMesh);

    // B3: HP / action-progress bars. Single mesh on layer 0 — bars don't
    // bloom by design (the visual budget stays on the sprites).
    this.bars = new BarRenderer();
    this.renderer.scene.add(this.bars.mesh);

    // Scene transitions driven by Run lifecycle events. All three of the
    // post-battle handlers fire from Run.handleBattleEnded *after* Run has
    // already updated phase + currentOffer, so the new Scene can read
    // ctx.run consistently.
    this.bus.on('battle:started', () => this.swap(new BattleScene()));
    this.bus.on('recruit:offered', ({ units }) => this.swap(new RecruitScene(units)));
    this.bus.on('run:defeated', () => this.swap(new GameOverScene('defeat')));
    this.bus.on('run:victory', () => this.swap(new GameOverScene('complete')));

    // B6 audio hooks at the page-lifetime layer. Subscriptions tied to
    // World/Scene lifetimes live in BattleScene (see unit:attacked /
    // unit:died handlers there); subscriptions that span scenes belong
    // here so they survive scene swaps.
    this.bus.on('recruit:offered', () => this.audio.play('recruit'));
    this.bus.on('run:victory', () => this.audio.play('win'));
    this.bus.on('run:defeated', () => this.audio.play('lose'));

    // Boot into the map.
    this.swap(new MapScene());
  }

  /**
   * RunDispatcher entry point. UI screens (held by Scenes) call this; Game
   * routes:
   *   - `resetRun` → tear down the current Run and start a fresh one.
   *   - everything else → forward to `this.run.dispatch(cmd)`. Most phase
   *     transitions emit a bus event that drives the Scene swap; the one
   *     exception is recruit → map, which is silent, so we swap explicitly.
   */
  dispatch(command: RunCommand): void {
    switch (command.kind) {
      case 'enterNode':
        // If the hop is accepted, Run synchronously emits `battle:started`,
        // which fires the BattleScene swap before this line returns.
        // Rejected hops (non-frontier, wrong phase) emit nothing — we stay
        // on the map.
        this.run.dispatch(command);
        break;
      case 'chooseRecruit':
        this.run.dispatch(command);
        // Non-terminal recruit: phase falls back to 'map' with no event
        // emit. The terminal-floor case fires `run:victory` which is handled
        // by the bus subscription above.
        if (this.run.phase === 'map') {
          this.swap(new MapScene());
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
   * Tear down the current Run and start a fresh one with a new seed. Wired
   * to GameOverScreen's "Begin a new run" button via the `resetRun`
   * command. Date.now() seed gives a different map and team per restart;
   * replay / shareable seeds can hook in later by reading from URL or a
   * debug panel.
   */
  private resetRun(): void {
    this.run.dispose();
    this.run = new Run(Date.now(), this.bus);
    this.swap(new MapScene());
  }

  /**
   * Disposing the old scene before mounting the new one keeps subscriptions
   * and DOM single-instanced. Context is rebuilt per-swap so `ctx.run`
   * reflects the current run instance (which may have been swapped by
   * resetRun since the last call).
   */
  private swap(next: Scene): void {
    this.activeScene?.dispose();
    this.activeScene = next;
    next.mount(this.buildContext());
  }

  private buildContext(): SceneContext {
    return {
      bus: this.bus,
      scene3D: this.renderer.scene,
      sprites: this.sprites,
      bars: this.bars,
      terrain: this.terrain,
      water: this.water,
      fontAtlas: this.fontAtlas,
      uiMount: this.uiMount,
      dispatcher: this,
      run: this.run,
      audio: this.audio,
    };
  }
}
