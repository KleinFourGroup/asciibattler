import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { SpriteRenderer } from './render/SpriteRenderer';
import { UnitOverlayLayer } from './render/UnitOverlayLayer';
import { TerrainRenderer } from './render/TerrainRenderer';
import { ApronRenderer } from './render/ApronRenderer';
import { BackdropRenderer } from './render/BackdropRenderer';
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
import { PlaybackSpeed } from './ui/PlaybackSpeed';
import { Keybindings } from './ui/Keybindings';

/** M3 — the after-turn outro (ms): how long the resolved battle board
 *  lingers (death fades, hitsplats drain) before the post-turn outcome
 *  screen replaces it. Tunable by feel during playtest. */
const TURN_OUTRO_MS = 900;

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
  /** M4 — the backdrop apron ring. Dev consoles reach it as `__game.apron`
   *  (TS `private` is runtime-accessible) for the dither A/B flip. */
  private readonly apron: ApronRenderer;
  /** M4 — the mist floor (page-lifetime scenery; only its uTime advances). */
  private readonly backdrop: BackdropRenderer;
  private readonly uiMount: HTMLElement;
  private readonly audio: AudioPlayer;
  /**
   * I3 — fast-forward speed (1×/2×/3×). Page-lifetime so the chosen speed
   * persists across turns/battles; surfaced to every Scene via buildContext.
   * The HUD owns the per-battle button + hotkey that cycle it.
   */
  private readonly playback = new PlaybackSpeed();
  /**
   * J3 — the page-lifetime keybinding registry. Owns the single `window`
   * keydown listener (attached in the constructor); per-battle consumers (the
   * HUD) subscribe via `keybindings.on(...)` and tear down on dispose, so a
   * hotkey only does anything during a battle. Persists across scene swaps so a
   * future in-game rebind sticks — hence page-lifetime, surfaced via
   * buildContext like `playback`.
   */
  private readonly keybindings = new Keybindings();
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
  /** M3 — a scheduled deferred swap (the after-turn outro). Any direct
   *  swap() cancels it, so a scheduled scene can never replace one that
   *  arrived after it. */
  private pendingSwapTimer: number | null = null;

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

    // Renderer drives the per-frame tick of whatever scene is active. After the
    // scene has updated (sprite positions lerped for this frame), Qb#2 depth-
    // sorts the transparent sprite billboards back-to-front so their paint order
    // matches camera depth — they're `depthWrite: false`, so draw order is their
    // only occlusion arbiter. Runs before the render, which follows onFrame.
    this.renderer = new Renderer(canvas, (dt) => {
      this.activeScene?.tick(dt);
      this.sprites.sortByDepth(this.renderer.camera);
    });

    // C1c terrain: faceted low-poly prism-per-tile. Renders floor + water
    // tiles directly (no separate WaterRenderer); BattleScene calls
    // setTiles after applyTerrain has populated world.tileGrid. D3
    // sizes the vertex buffers at LAYOUT_MAX_SIDE² so any per-encounter
    // grid up to that cap renders without reallocation; setDrawRange
    // exposes only the active cells.
    this.terrain = new TerrainRenderer();
    this.renderer.scene.add(this.terrain.mesh);

    // M4: the backdrop apron — a fog-faded non-playable ring continuing
    // the board outward so it doesn't float in the void. Reads heights
    // through the live TerrainRenderer (same fixed-seed noise field) so
    // the seam is invisible. Layer 0 only — never in the bloom pass, and
    // pickCell raycasts terrain.mesh explicitly so the ring is unclickable.
    this.apron = new ApronRenderer(this.terrain);
    this.renderer.scene.add(this.apron.mesh);

    // M4: the mist floor the apron dissolves into. Encounter-independent
    // (origin-centered, fixed size) so it's added once and never reset;
    // non-battle scenes mask the canvas with opaque DOM (G2), so it only
    // shows behind live battles.
    this.backdrop = new BackdropRenderer();
    this.renderer.scene.add(this.backdrop.mesh);

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

    // Scene transitions driven by Run lifecycle events. All of the
    // post-battle handlers fire *after* Run has already updated phase +
    // currentOffer, so the new Scene can read ctx.run consistently.
    this.bus.on('battle:started', () => this.swap(new BattleScene()));
    // E4: promotion fires BEFORE recruit:offered when units leveled up.
    // Run rolls the recruit offer only after `dismissPromotion`, so
    // recruit:offered still fires exactly once per non-terminal win.
    // M1: promotions fire at TURN boundaries, so this swap also lands
    // mid-encounter (post-turn screen → here → the next pre-turn screen).
    this.bus.on('promotion:pending', ({ promotions }) =>
      this.swap(new PromotionScene(promotions)),
    );
    this.bus.on('recruit:offered', ({ units }) => this.swap(new RecruitScene(units)));
    // 48b BRIDGE (temporary — 48c's RewardScene replaces this): auto-accept
    // every reward portion so the live game flows through the new reward
    // phase without a screen. The launch skeleton rewards are bits-only, so
    // this is invisible until 48d's overlay lands.
    this.bus.on('reward:offered', ({ rewards }) => {
      for (let i = rewards.length; i > 0; i--) {
        this.dispatch({ kind: 'acceptReward', index: 0 });
      }
    });
    this.bus.on('run:defeated', () => this.swap(new GameOverScene('defeat')));
    this.bus.on('run:victory', () => this.swap(new GameOverScene('complete')));

    // H4b — the turn-gate screens. These only fire when `run.pauseAtTurnGates`
    // is on (Game sets it in createRun); the headless loop never emits them.
    // `turn:starting` opens the pre-turn screen; `turn:resolved` the post-turn
    // outcome screen. Both advance via the `advanceTurn` command, whose
    // continuations (battle:started / the next turn:starting / recruit:offered /
    // promotion:pending / run:*) drive their own swaps.
    //
    // M3 — turn:resolved fires from inside the ending world.tick(), but the
    // PostTurnScene swap is DEFERRED by a brief outro so the final board state
    // breathes (death fades + hitsplats drain) before the outcome screen
    // masks it. Safe to linger: World.tick() no-ops once `_ended`, so the
    // BattleScene's clock spins harmlessly through the outro, and nothing
    // else can swap until `advanceTurn` (which the outcome screen hasn't
    // offered yet) — swap() cancels the timer anyway, defensively.
    this.bus.on('turn:starting', (info) => this.swap(new PreTurnScene(info)));
    this.bus.on('turn:resolved', (info) =>
      this.swapAfter(TURN_OUTRO_MS, () => new PostTurnScene(info)),
    );

    // B6 audio hooks at the page-lifetime layer. Subscriptions tied to
    // World/Scene lifetimes live in BattleScene (see unit:attacked /
    // unit:died handlers there); subscriptions that span scenes belong
    // here so they survive scene swaps.
    this.bus.on('recruit:offered', () => this.audio.play('recruit'));
    this.bus.on('run:victory', () => this.audio.play('win'));
    this.bus.on('run:defeated', () => this.audio.play('lose'));

    // J3 — one page-lifetime keydown sink for every rebindable hotkey. On
    // `window` (not the canvas) so a binding fires without the play area being
    // focused, matching the I3 fast-forward listener it replaces. Dispatch is a
    // no-op until a scene subscribes a handler, so this can attach once at boot.
    window.addEventListener('keydown', this.keybindings.handleKeyDown);

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
      case 'passRecruit':
        // H6b — declining the offer also lands on 'map' with no event emit,
        // so swap explicitly (same pattern as chooseRecruit). A non-terminal
        // recruit is the only phase that reaches here; the terminal floor
        // routes through run:victory, never the recruit screen.
        this.run.dispatch(command);
        if (this.run.phase === 'map') {
          this.swap(new MapScene());
        }
        break;
      case 'dismissPromotion':
        // M1: mid-encounter, Run resolves dismiss back into the turn loop —
        // the next turn:starting (gated) fires its own swap. On a won final
        // turn it resolves into recruit:offered (non-terminal) or run:victory
        // (terminal), likewise self-swapping. After a G3 rest-triggered
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
      case 'redrawCards':
        // K3 — redraw at the pre-turn gate. The phase doesn't change (the
        // pre-turn screen stays up and refreshes in place off the
        // `turn:handRedrawn` emit), so there's no scene swap here either.
        this.run.dispatch(command);
        break;
      case 'empowerUnit':
        // K4 — empower at the pre-turn gate. Same in-place pattern as
        // redrawCards: the screen refreshes off `turn:unitEmpowered`.
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
    this.cancelPendingSwap();
    this.activeScene?.dispose();
    this.activeScene = next;
    next.mount(this.buildContext());
  }

  /** M3 — swap after `ms`, letting the current scene play out (the
   *  after-turn outro). The factory runs at fire time so the scene mounts
   *  against the freshest state. Superseded by any direct swap(). */
  private swapAfter(ms: number, make: () => Scene): void {
    this.cancelPendingSwap();
    this.pendingSwapTimer = window.setTimeout(() => {
      this.pendingSwapTimer = null;
      this.swap(make());
    }, ms);
  }

  private cancelPendingSwap(): void {
    if (this.pendingSwapTimer !== null) {
      window.clearTimeout(this.pendingSwapTimer);
      this.pendingSwapTimer = null;
    }
  }

  private buildContext(): SceneContext {
    return {
      bus: this.bus,
      scene3D: this.renderer.scene,
      renderer: this.renderer,
      sprites: this.sprites,
      overlays: this.overlays,
      terrain: this.terrain,
      apron: this.apron,
      backdrop: this.backdrop,
      fontAtlas: this.fontAtlas,
      uiMount: this.uiMount,
      dispatcher: this,
      run: this.run,
      audio: this.audio,
      playback: this.playback,
      keybindings: this.keybindings,
    };
  }
}
