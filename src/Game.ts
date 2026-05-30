import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { SpriteRenderer } from './render/SpriteRenderer';
import { UnitOverlayLayer } from './render/UnitOverlayLayer';
import { TerrainRenderer } from './render/TerrainRenderer';
import { EventBus } from './core/EventBus';
import type { GameEvents } from './core/events';
import { Run } from './run/Run';
import { RNG } from './core/RNG';
import { rollUnit, type Archetype } from './sim/archetypes';
import type { RunCommand, RunDispatcher } from './run/Command';
import type { Scene, SceneContext } from './scenes/Scene';
import { MapScene } from './scenes/MapScene';
import { BattleScene } from './scenes/BattleScene';
import { RecruitScene } from './scenes/RecruitScene';
import { PromotionScene } from './scenes/PromotionScene';
import { GameOverScene } from './scenes/GameOverScene';
import { AudioPlayer } from './audio/AudioPlayer';

/**
 * E7.A — dev-only starting-roster override. `?roster=rogue,melee,ranged`
 * replaces the rolled starting team so new archetypes can be playtested
 * before recruitment integration (F1) makes them draftable. Unknown tokens
 * are dropped; an empty / all-invalid list leaves the rolled team intact.
 * Rolls off a throwaway RNG (dev-only, determinism irrelevant) so it never
 * perturbs the run's own forked streams. Normal play never sets the param,
 * so production + tests are untouched. Extend `DEV_ROSTER_ARCHETYPES` as
 * E7.B–D land their archetypes.
 */
const DEV_ROSTER_ARCHETYPES: readonly Archetype[] = ['melee', 'ranged', 'rogue', 'healer', 'mage'];

function applyRosterOverride(run: Run): void {
  if (typeof location === 'undefined') return;
  const param = new URLSearchParams(location.search).get('roster');
  if (!param) return;
  const valid = param
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((a): a is Archetype => (DEV_ROSTER_ARCHETYPES as readonly string[]).includes(a));
  if (valid.length === 0) return;
  const rng = new RNG(1);
  run.team = valid.map((a) => rollUnit(a, rng));
  console.warn(`[dev] starting roster override: ${valid.join(', ')}`);
}

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
  private readonly overlays: UnitOverlayLayer;
  private readonly terrain: TerrainRenderer;
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
    applyRosterOverride(this.run);

    // Renderer drives the per-frame tick of whatever scene is active.
    this.renderer = new Renderer(canvas, (dt) => this.activeScene?.tick(dt));

    // C1c terrain: faceted low-poly prism-per-tile. Renders floor + water
    // tiles directly (no separate WaterRenderer); BattleScene calls
    // setTiles after applyTerrain has populated world.tileGrid. D3
    // sizes the vertex buffers at LAYOUT_MAX_SIDE² so any per-encounter
    // grid up to that cap renders without reallocation; setDrawRange
    // exposes only the active cells.
    this.terrain = new TerrainRenderer();
    this.renderer.scene.add(this.terrain.mesh);

    this.sprites = new SpriteRenderer(this.fontAtlas);
    // Both meshes live in the same scene; layer membership routes them to
    // the right composer. `mesh` (layer 0) → mainComposer (visible color);
    // `bloomMesh` (BLOOM_LAYER) → bloomComposer (halo input).
    this.renderer.scene.add(this.sprites.mesh);
    this.renderer.scene.add(this.sprites.bloomMesh);

    // E3.6: per-unit DOM overlay (HP bar + action progress + level
    // badge). Replaces the pre-E3.6 canvas-instanced BarRenderer. The
    // container is inserted BEFORE the existing #ui mount so HUD panels
    // paint on top — overlays are world content, the HUD is chrome and
    // wins z-order disputes. #scanlines (z-index 1000) still rakes
    // across the overlays.
    this.overlays = new UnitOverlayLayer(this.renderer.camera, canvas, uiMount);

    // Scene transitions driven by Run lifecycle events. All three of the
    // post-battle handlers fire from Run.handleBattleEnded *after* Run has
    // already updated phase + currentOffer, so the new Scene can read
    // ctx.run consistently.
    this.bus.on('battle:started', () => this.swap(new BattleScene()));
    // E4: promotion fires BEFORE recruit:offered when units leveled up.
    // Run rolls the recruit offer only after `dismissPromotion`, so
    // recruit:offered still fires exactly once per non-terminal win.
    this.bus.on('promotion:pending', ({ promotions }) =>
      this.swap(new PromotionScene(promotions)),
    );
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
      case 'dismissPromotion':
        // Run resolves dismiss into either recruit:offered (non-terminal
        // victory) or run:victory (terminal), both of which fire their
        // own scene swaps via bus subscription. No explicit swap here.
        this.run.dispatch(command);
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
    applyRosterOverride(this.run);
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
      renderer: this.renderer,
      sprites: this.sprites,
      overlays: this.overlays,
      terrain: this.terrain,
      fontAtlas: this.fontAtlas,
      uiMount: this.uiMount,
      dispatcher: this,
      run: this.run,
      audio: this.audio,
    };
  }
}
