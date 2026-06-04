import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { SpriteRenderer } from './render/SpriteRenderer';
import { UnitOverlayLayer } from './render/UnitOverlayLayer';
import { TerrainRenderer } from './render/TerrainRenderer';
import { EventBus } from './core/EventBus';
import type { GameEvents } from './core/events';
import { Run } from './run/Run';
import { parseRunConfigFromURL, type RunConfig } from './run/RunConfig';
import type { RunCommand, RunDispatcher } from './run/Command';
import type { Scene, SceneContext } from './scenes/Scene';
import { MapScene } from './scenes/MapScene';
import { BattleScene } from './scenes/BattleScene';
import { RecruitScene } from './scenes/RecruitScene';
import { PromotionScene } from './scenes/PromotionScene';
import { GameOverScene } from './scenes/GameOverScene';
import { PreTurnScene } from './scenes/PreTurnScene';
import { PostTurnScene } from './scenes/PostTurnScene';
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
  /**
   * G1 — the RunConfig parsed once from the launch URL. Reused on `resetRun`
   * so a reset re-rolls a fresh run with the *same* shape (short floor count /
   * forced layout / roster). A pinned `seed` reproduces the same run on reset;
   * an unset seed gives a new `Date.now()` run each time.
   */
  private readonly runConfig: RunConfig;
  /** The scene currently mounted. Null only briefly during swap(). */
  private activeScene: Scene | null = null;

  constructor(canvas: HTMLCanvasElement, fontAtlas: FontAtlas, uiMount: HTMLElement) {
    this.fontAtlas = fontAtlas;
    this.uiMount = uiMount;
    this.audio = new AudioPlayer();

    // G1 — one URL parser builds the RunConfig (seed / floors / roster /
    // layout / width). No params ⇒ empty config ⇒ a normal `Date.now()`-seeded
    // run, byte-identical to pre-G1. Supersedes the old inline `?roster=`.
    this.runConfig = parseRunConfigFromURL();

    // Construct Run first so its battle:ended handler subscribes before any
    // Game listener that reads run.phase. The recruit:offered/run:victory/
    // run:defeated subscriptions below all run *after* Run has updated phase
    // because Run emits those from within its own battle:ended handler.
    this.run = this.createRun();

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

    // H4b — the turn-gate screens. These only fire when `run.pauseAtTurnGates`
    // is on (Game sets it in createRun); the headless loop never emits them.
    // `turn:starting` opens the pre-turn screen; `turn:resolved` the post-turn
    // outcome screen. Both advance via the `advanceTurn` command, whose
    // continuations (battle:started / the next turn:starting / recruit:offered /
    // promotion:pending / run:*) drive their own swaps. The turn:resolved swap
    // fires from inside the ending world.tick() — safe because BattleScene.tick
    // + the Clock callback null-guard everything dispose() tears down.
    this.bus.on('turn:starting', (info) => this.swap(new PreTurnScene(info)));
    this.bus.on('turn:resolved', (info) => this.swap(new PostTurnScene(info)));

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
        // G3 — a rest node resolves inline. If it banked XP without a
        // level-up, phase falls to 'map' with no event (like chooseRecruit
        // below), so refresh the map explicitly. A battle (battle:started) or
        // a rest-with-promotion (promotion:pending) fires its own swap.
        if (this.run.phase === 'map') {
          this.swap(new MapScene());
        }
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
        // After a battle win, Run resolves dismiss into either recruit:offered
        // (non-terminal) or run:victory (terminal), both of which fire their
        // own scene swaps via bus subscription. After a G3 rest-triggered
        // promotion it instead falls back to 'map' with no event, so swap
        // explicitly (same pattern as chooseRecruit / enterNode above).
        this.run.dispatch(command);
        if (this.run.phase === 'map') {
          this.swap(new MapScene());
        }
        break;
      case 'advanceTurn':
        // H4b — resume from a turn gate (pre/post-turn screen). The continuation
        // (start the battle, the next pre-turn screen, recruit, promotion, or
        // defeat) emits its own bus event that drives the scene swap, so there's
        // nothing to swap explicitly here.
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
    this.run = this.createRun();
    this.swap(new MapScene());
  }

  /**
   * G1 — build a fresh Run from the parsed RunConfig. Shared by the
   * constructor and `resetRun` so both honor `?floors=` / `?layout=` /
   * `?roster=` / `?width=` (and a pinned `?seed=`) identically.
   */
  private createRun(): Run {
    const run = new Run(this.runConfig.seed ?? Date.now(), this.bus, this.runConfig);
    // H4b — the live game pauses at turn gates so the pre/post-turn screens can
    // show. (Headless tests + the fuzz harness leave this off → the synchronous
    // H4a loop, so they're unaffected.)
    run.pauseAtTurnGates = true;
    if (this.runConfig.startingRoster) {
      const desc = this.runConfig.startingRoster
        .map((e) => (e.level > 1 ? `${e.archetype} Lv${e.level}` : e.archetype))
        .join(', ');
      console.warn(`[dev] starting roster override: ${desc}`);
    }
    return run;
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
