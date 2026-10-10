import { Renderer } from './render/Renderer';
import { FontAtlas } from './render/FontAtlas';
import { SpriteRenderer } from './render/SpriteRenderer';
import { UnitOverlayLayer } from './render/UnitOverlayLayer';
import { TerrainRenderer } from './render/TerrainRenderer';
import { ApronRenderer } from './render/ApronRenderer';
import { BackdropRenderer } from './render/BackdropRenderer';
import { EventBus } from './core/EventBus';
import type { GameEvents } from './core/events';
import { Run, type RunSnapshot } from './run/Run';
import { parseRunConfigFromURL, runConfigToQueryString, type RunConfig } from './run/RunConfig';
import type { RunCommand, RunDispatcher } from './run/Command';
import type { Scene, SceneContext } from './scenes/Scene';
import { MapScene } from './scenes/MapScene';
import { BattleScene } from './scenes/BattleScene';
import { RecruitScene } from './scenes/RecruitScene';
import { PromotionScene } from './scenes/PromotionScene';
import { RewardScene } from './scenes/RewardScene';
import { PortScene } from './scenes/PortScene';
import { EventScene } from './scenes/EventScene';
import { RestScene } from './scenes/RestScene';
import { BitsOverlay } from './ui/BitsOverlay';
import { PoolOverlay } from './ui/PoolOverlay';
import { CacheOverlay } from './ui/CacheOverlay';
import { cantSaveReason } from './ui/cantSave';
import { CantSaveChip } from './ui/CantSaveChip';
import { CreditsOverlay } from './ui/CreditsOverlay';
import { SectorMapOverlay } from './ui/SectorMapOverlay';
import { SettingsOverlay } from './ui/SettingsOverlay';
import { createChromeColumn, createControlColumn } from './ui/chip';
import { installTooltipHost, toggleTooltipKey } from './ui/tooltip';
import { GameOverScene } from './scenes/GameOverScene';
import { SectorClearedScene } from './scenes/SectorClearedScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { MenuScene } from './scenes/MenuScene';
import { bootsToMenu, creditsOnTheWay, seedFromText } from './scenes/menuRules';
import { characterById, type CharacterConfig } from './config/characters';
import { PreTurnScene } from './scenes/PreTurnScene';
import type { DeckCue } from './ui/PreTurnScreen';
import { AudioPlayer } from './audio/AudioPlayer';
import { attachEventSounds } from './audio/eventSounds';
import { PlaybackSpeed } from './ui/PlaybackSpeed';
import { Keybindings } from './ui/Keybindings';
import { HEALTH } from './config/health';
import { configHash } from './config/configHash';
import { BUILD_ID } from './buildId';
import { JournalRecorder } from './journal/JournalRecorder';
import type { RunJournal } from './journal/journal';
import { store } from './store';
import { settings } from './settings';
import { connectSettings } from './settings/apply';
import { setReducedMotionOverride } from './render/motion';
import { setAuraFxMode } from './render/auraFx';
import { setShakePolicy } from './ui/lossFx';
import { setTextScale } from './ui/textScale';
import { backupOf } from './store/backup';
import { SECTION_NAMES } from './store/store';
import { pageReading } from './diagnostics/page';
import { diagnosticsFileName, diagnosticsReport, diagnosticsText, graphicsOf, sectionSizes } from './diagnostics/report';
import { keepJournal } from './store/journals';
import { PROGRESS_SECTION, bestWinAfter, escalationCeiling, levelWithinCeiling, runCounts } from './store/progress';
import type { RunLock } from './store/runLock';
import { lastRunJournal, openRunSlot, type RunSlot, type RunSlotRead } from './store/runSlot';

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
 *   - run:victory → the win recorded in the store's progress, if the run
 *     counts (`recordWin`), then GameOverScene('complete')
 *   - run:defeated → GameOverScene('defeat')
 *   - chooseRecruit returning to phase=='map' → MapScene (driven from
 *     dispatch, since no bus event fires for that transition)
 *   - resetRun → MapScene (new Run) with a `?character=` pin; else the
 *     MenuScene on a page that booted to it (116c), or the
 *     CharacterSelectScene on a page booted by a run dial (63e — the choice
 *     is per-run)
 *   - chooseCharacter (63e, select-scene confirm) → construct the Run, at
 *     the picked Escalation level held to the character's ceiling →
 *     MapScene
 *   - the menu's New run → CharacterSelectScene, and its Back → MenuScene
 *     (116c; neither is a command, since no run exists on either side)
 *
 * A2: implements `RunDispatcher`. UI screens (now Scene-owned) hold this as
 * their command sink. Game forwards `enterNode` / `chooseRecruit` to the
 * live Run and handles `resetRun` itself (a Run can't reset itself).
 * Because UI captures `Game` rather than `Run`, swapping the underlying Run
 * on reset is invisible to the UI.
 */
export class Game implements RunDispatcher {
  private readonly bus = new EventBus<GameEvents>();
  /**
   * The run journal's recorder (Round 8 spec D4; src/journal). Page-lifetime
   * and on the bus before any Run, as its header asks. `dispatch` hands it
   * each command before the Run applies it; `createRun` and `devLoadRun`
   * open a journal, `resetRun` abandons one. Every call goes through
   * `journaling`, so a recorder that throws can't take the game with it.
   * A journal closed by its run's end is kept in the store
   * (src/store/journals.ts), within that section's size budget.
   */
  private readonly journalRecorder = new JournalRecorder(
    this.bus,
    { build: BUILD_ID, configHash: configHash() },
    Date.now,
    (journal) => {
      this.finishedJournal = journal;
      // A run that reached its end joins the store's finished journals. One
      // abandoned (reset or replaced before its end) is not kept.
      if (journal.segments.at(-1)?.end?.reason !== 'abandoned') keepJournal(store, journal);
    },
  );
  /** The journal of the run that just ended, until the next run starts. */
  private finishedJournal: RunJournal | null = null;
  /** Set when the recorder threw: this page records no more. */
  private journalBroken = false;
  /**
   * 115f — the run slot as this tab may use it (src/store/runSlot.ts). Every
   * read, write and clear of the save goes through it, so a second tab (the
   * two-tab lock held by another) leaves the first tab's save alone and
   * plays unsaved.
   */
  private readonly runSlot: RunSlot;
  private readonly renderer: Renderer;
  private readonly fontAtlas: FontAtlas;
  private readonly sprites: SpriteRenderer;
  private readonly overlays: UnitOverlayLayer;
  /** 48d — the persistent bits chip (page-lifetime, survives scene swaps);
   *  held for `resetRun`'s post-reassignment `refresh()`. */
  private readonly bitsOverlay: BitsOverlay;
  /** 94e — the persistent run-pool chip (the bits chip's sibling). */
  private readonly poolOverlay: PoolOverlay;
  /** 49f — the persistent cache chip + modal (the bits chip's sibling; same
   *  gotcha #116 lifecycle, incl. the resetRun `refresh()`). */
  private readonly cacheOverlay: CacheOverlay;
  /** 78e — the sector-map chip + read-only overlay (a chrome-column
   *  chip). Scene-derived availability is pushed from `swap`. */
  private readonly sectorMapOverlay: SectorMapOverlay;
  /** 116d — the settings chip and modal (the chip is the control column's
   *  first row). The menu opens the same modal through the scene context. */
  private readonly settingsOverlay: SettingsOverlay;
  /** The control column's second row (src/ui/chip.ts): the screen that is up
   *  mounts its own top-right control here, through the scene context. */
  private readonly controlSlot: HTMLDivElement;
  /** 116j — the credits panel: the menu's row opens it, and so does the end
   *  of the first won run (`resetRun`). */
  private readonly credits: CreditsOverlay;
  /** 116i — the can't-save chip, and whether a run is on screen (live, and
   *  not at its end screen), which is when a second tab's chip shows. */
  private readonly cantSave: CantSaveChip;
  private runOnScreen = false;
  private readonly terrain: TerrainRenderer;
  /** M4 — the backdrop apron ring. Dev consoles reach it as `__game.apron`
   *  (TS `private` is runtime-accessible) for the dither A/B flip. */
  private readonly apron: ApronRenderer;
  /** M4 — the mist floor (page-lifetime scenery; only its uTime advances). */
  private readonly backdrop: BackdropRenderer;
  /** 100e2 — the SCREEN HOST: the scenes' mount (every Screen + the HUD),
   *  created FIRST inside #ui so it sits BEFORE the chrome column and the
   *  tooltip host in DOM order. A static, unsized div — the screens are
   *  absolute / fixed and resolve against #ui exactly as before; the column
   *  is fixed with its own z-index, so stacking never depended on DOM order.
   *  What DOES depend on it is the Tab walk: with the column first, the only
   *  forward path from a screen's last control to the chips ran off the
   *  document's end — through Firefox's own UI — and around (the user's
   *  100c1 + 100e reads). Screens first, chips last, no detour. */
  private readonly screenHost: HTMLDivElement;
  private readonly audio: AudioPlayer;
  /**
   * I3 — fast-forward speed (1×/2×/3×). Page-lifetime so the chosen speed
   * persists across turns/battles; surfaced to every Scene via buildContext.
   * The HUD owns the per-battle button + hotkey that cycle it.
   */
  private readonly playback = new PlaybackSpeed();
  /** 65f — the deck-cue buffer (page-lifetime): the deal's per-card cues
   *  fire before `turn:starting` mounts the scene, so Game buffers them and
   *  hands the sequence over at swap time (see the wiring comment). */
  private readonly deckCues: DeckCue[] = [];
  /**
   * J3 — the page-lifetime keybinding registry. Owns the single `window`
   * keydown listener (attached in the constructor); per-battle consumers (the
   * HUD) subscribe via `keybindings.on(...)` and tear down on dispose, so a
   * hotkey only does anything during a battle. Persists across scene swaps so a
   * future in-game rebind sticks — hence page-lifetime, surfaced via
   * buildContext like `playback`.
   */
  private readonly keybindings = new Keybindings();
  /** 116b — the page's settings (src/settings). The constructor connects
   *  them to what they set; a dev console reaches them as `__game.settings`. */
  private readonly settings = settings;
  /**
   * Active run. Replaced on `resetRun`, and — 63e — NULL while the
   * CharacterSelectScene is up (the choice precedes Run construction; a
   * `?character=` pin skips that state entirely). Every method treats
   * `this.run` as the authoritative source for meta state; run-level
   * commands arriving while null are dropped loud in `dispatch`.
   */
  private run: Run | null;
  /**
   * G1 — the RunConfig parsed once from the launch URL. Reused on `resetRun`
   * so a reset re-rolls a fresh run with the *same* shape (short floor count /
   * forced layout / roster). A pinned `seed` reproduces the same run on reset;
   * an unset seed gives a new `Date.now()` run each time.
   */
  private readonly runConfig: RunConfig;
  /**
   * 116c — whether this page booted to the menu: a plain URL, with no run
   * dial and no board bookmark (src/scenes/menuRules.ts). Fixed for the
   * page's life. It decides the first screen and where a run's end goes: the
   * menu here, and as before the menu on a page booted by a dial, so no
   * driver's path changed.
   */
  private readonly menuBoot: boolean;
  /**
   * 116c — the menu's seed field, as text. The menu hands it over with New
   * run, character select's Back finds it as it was left, and the run that
   * is created takes it (`createRun`), which empties it: a seed is one run's,
   * so the run after it is seeded from the clock again.
   */
  private seedText = '';
  /** The scene currently mounted. Null only briefly during swap(). */
  private activeScene: Scene | null = null;
  /** 96.5b2 — the in-flight outro's cancellation token (`afterOutro`);
   *  null when no outro is pending. */
  private pendingOutro: { cancelled: boolean } | null = null;
  /** 115e — the live run's dials as URL query text: what its journal's
   *  seed start holds, and what the run slot keeps beside the snapshot, so
   *  a load reads the inputs the run was created with. */
  private runDials = '';
  /** 117e — the Escalation level the live run's won end opened for its
   *  character, for the end screen to say; null until a win opens one, and
   *  again when another run takes its place. */
  private unlocked: number | null = null;
  /** M3 — a scheduled deferred swap (the after-turn outro). Any direct
   *  swap() cancels it, so a scheduled scene can never replace one that
   *  arrived after it. */
  private pendingSwapTimer: number | null = null;
  /** 117.5i — set once the page has failed (`halt`), for its life. */
  private halted = false;

  constructor(canvas: HTMLCanvasElement, fontAtlas: FontAtlas, uiMount: HTMLElement, runLock: RunLock) {
    this.fontAtlas = fontAtlas;
    // 115f — before any run exists: a pinned boot saves below.
    this.runSlot = openRunSlot(store, this.bus, runLock);
    // 100e2 — the screen host goes in before any other #ui child (see the
    // field): the chrome column + the tooltip host append after it below.
    // (#ui itself is not kept — the page-lifetime chrome takes it here, at
    // construction, and nothing reads it later.)
    this.screenHost = document.createElement('div');
    this.screenHost.className = 'screen-host';
    uiMount.appendChild(this.screenHost);
    this.audio = new AudioPlayer();
    // 116b — the settings reach what they set: each consumer takes its stored
    // value here, before the first screen mounts, and its new value on every
    // change (src/settings/apply.ts). The page's life is the subscription's.
    connectSettings(this.settings, {
      setVolume: (master, sfx) => this.audio.setVolume(master, sfx),
      setKeys: (overrides) => this.keybindings.setOverrides(overrides),
      setSpeed: (value) => {
        this.playback.select(value);
      },
      setMotion: setReducedMotionOverride,
      setShake: setShakePolicy,
      setAura: setAuraFxMode,
      setTextScale,
    });

    // G1 — one URL parser builds the RunConfig (seed / floors / roster /
    // layout / width). No params ⇒ empty config ⇒ a normal `Date.now()`-seeded
    // run, byte-identical to pre-G1. Supersedes the old inline `?roster=`.
    this.runConfig = parseRunConfigFromURL();
    this.menuBoot = bootsToMenu(location.search);

    // 63e — construct the Run NOW only when `?character=` pins the choice;
    // otherwise it stays null until the CharacterSelectScene confirms
    // (`confirmCharacter`). Late Run construction is safe ordering-wise:
    // Game has no direct battle:ended listener, and every Run follow-on
    // event (recruit:offered/run:victory/run:defeated) is emitted from
    // within Run's own handler AFTER it updates phase — subscription order
    // doesn't matter for those (the devLoadRun precedent).
    this.run = this.runConfig.character !== undefined ? this.createRun() : null;
    // 115e — a boot with a character in its dials starts its own run, never
    // continues one, and saves over the slot (the §115 shape-lock, call 8).
    if (this.run !== null) this.autosave(this.run);

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
    this.overlays = new UnitOverlayLayer(() => this.renderer.camera, canvas, uiMount);

    // 48d: the persistent bits overlay — page-lifetime chrome appended once
    // to the shared #ui mount, NEVER touched by scene swaps (the first UI
    // element to survive them). The first paint happens in its constructor
    // (Run's init never emits run:bitsChanged, and the first run:started
    // predates this line); resetRun re-paints via refresh() after the run
    // reassignment (see the ordering note there).
    // 63e — getters are null-safe (a pre-select boot has no run; the chip
    // starts hidden then and `run:started` reveals it on confirm).
    // 96e — the chips mount into ONE chrome column (src/ui/chip.ts);
    // their order is CSS `order`, not construction order, so the
    // construction (and subscription) order below is untouched.
    // The control column goes into the tree first: Tab leaves a screen for
    // Settings and the screen's own control, then walks the chips, and the
    // can't-save chip stays the walk's last stop.
    const controls = createControlColumn(uiMount);
    this.controlSlot = controls.slot;
    const chips = createChromeColumn(uiMount);
    // 97a — the ONE tooltip host (src/ui/tooltip.ts): page-lifetime chrome
    // like the column; every `attachTooltip` site renders into it.
    installTooltipHost(uiMount);
    this.bitsOverlay = new BitsOverlay(
      chips,
      this.bus,
      () => this.run?.bits ?? 0,
      this.run === null,
    );

    // 94e: the persistent run-pool chip — the bits chip's page-lifetime
    // sibling (the user's "the pool everywhere"); the same first-paint /
    // refresh() ordering as the bits chip.
    this.poolOverlay = new PoolOverlay(
      chips,
      this.bus,
      () => ({ current: this.run?.playerHealth ?? 0, max: HEALTH.playerHealthMax }),
      this.run === null,
    );

    // 49f: the cache chip — the bits chip's page-lifetime sibling (stacked
    // below it). Getters close over `this.run` so a reset's Run swap is
    // invisible (the dispatcher pattern); `this` is the RunDispatcher.
    this.cacheOverlay = new CacheOverlay(
      uiMount,
      chips,
      this.bus,
      this,
      this.audio,
      {
        getCache: () => this.run?.cache ?? [],
        getSize: () => this.run?.effectiveCacheSize ?? 0,
        getOverflow: () => this.run?.cacheOverflow ?? 0,
        getPhase: () => this.run?.phase ?? 'map',
        getRoster: () => this.run?.team ?? [],
      },
      this.run === null,
    );

    // 78e: the sector-map chip + read-only overlay — a chrome-column chip
    // (bits → cache → map). One view getter closing over `this.run`
    // (the dispatcher pattern — a reset's Run swap is invisible); the
    // `toggleSectorMap` keybind subscribes at THIS layer, the first
    // page-lifetime keybind consumer, so `M` works on every screen the chip
    // shows on (scene availability is pushed from `swap`).
    this.sectorMapOverlay = new SectorMapOverlay(
      uiMount,
      chips,
      this,
      this.audio,
      () => {
        if (this.run === null) return null;
        return {
          map: this.run.nodeMap,
          currentNodeId: this.run.currentNodeId,
          visited: this.run.visitedNodes,
          roster: this.run.team,
          sectorTitle: this.run.currentSectorTitle,
          forewarning: this.run.bossForewarning,
        };
      },
      () => this.keybindings.labelFor('toggleSectorMap'),
    );
    this.keybindings.on('toggleSectorMap', () => this.sectorMapOverlay.toggle());
    // 116d — the settings: a chip while a run is live, and the modal that
    // chip and the menu's row both open. The modal holds the playback and
    // suspends the key registry while it is up (src/ui/SettingsOverlay.ts).
    this.settingsOverlay = new SettingsOverlay(
      uiMount,
      controls.column,
      this.audio,
      this.settings,
      this.playback,
      this.keybindings,
      {
        runLive: () => this.run !== null,
        runSaved: () => this.runSlot.peek() === 'saved',
        quitToMenu: () => this.quitToMenu(),
        // 116h — the data rows: the whole store out and in (src/store/backup.ts),
        // and the journal of the last run that ended (src/store/runSlot.ts).
        data: {
          backup: () => {
            const dump = store.dump();
            return dump === null ? null : backupOf(dump, BUILD_ID, Date.now());
          },
          importBlocked: () =>
            this.runSlot.lock === 'elsewhere' ? 'elsewhere' : store.status().canSave ? null : 'unavailable',
          restore: (backup) => store.restore(backup.sections),
          lastRun: () => lastRunJournal(store, this.runSlot),
          // 118f — the player's diagnostics (src/diagnostics/report.ts): each
          // reading is taken when the row is clicked, and a section of the
          // store is told by its size alone.
          diagnostics: () => {
            const at = new Date().toISOString();
            const report = diagnosticsReport({
              at,
              build: BUILD_ID,
              page: pageReading,
              graphics: () => graphicsOf(this.renderer.webgl.getContext()),
              settings: () => this.settings.get(),
              store: () => ({
                ...store.status(),
                previousBuild: store.previousBuild,
                lock: this.runSlot.lock,
                sections: sectionSizes(store.dump(), SECTION_NAMES),
              }),
              run: () => ({ live: this.run !== null, slot: this.runSlot.peek() }),
            });
            return { text: diagnosticsText(report), fileName: diagnosticsFileName(at) };
          },
        },
      },
    );
    this.credits = new CreditsOverlay(uiMount, this.audio);
    // 116i — the can't-save chip: last in the column and in the Tab walk,
    // shown while the page can't save (src/ui/CantSaveChip.ts). The store's
    // status is its last write's, so the chip goes when a write lands again;
    // `swap` paints it too, for a second tab's run (`paintCantSave`).
    this.cantSave = new CantSaveChip(chips, cantSaveReason(store.status().canSave, this.runSlot.lock, false));
    store.onStatus((status) => {
      this.paintCantSave();
      if (!status.canSave) console.warn("[store] can't save:", status.error); // i18n-ok: a dev console line
    });
    // 97b — the tooltip key, page-lifetime like the map key: pin the open
    // tooltip / close a pinned one / open pinned for the focused or hovered
    // trigger (src/ui/tooltip.ts).
    this.keybindings.on('showTooltip', () => toggleTooltipKey());

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
    // 48c — the reward offer's screen (battle → rewards → promotion →
    // recruit). No payload: the screen reads the live offer off ctx.run.
    this.bus.on('reward:offered', () => this.swap(new RewardScene()));
    // 50e — docking at a port (replaces the 50c interim auto-undock stub).
    // No payload: the screen reads the live stock off ctx.run.portStock.
    this.bus.on('port:entered', () => this.swap(new PortScene()));
    // 74f — an event node opened its page (the ~75% non-resolve entry).
    // No payload: the screen reads the live page off ctx.run (the port
    // pattern). This closes the 74e interim hazard — the event phase has
    // a scene now.
    this.bus.on('event:entered', () => this.swap(new EventScene()));
    // A rest node opened its gate (and a loaded run resumed at it). No
    // payload: the screen reads what the rest would do off ctx.run.
    this.bus.on('rest:entered', () => this.swap(new RestScene()));
    this.bus.on('run:defeated', () => this.swap(new GameOverScene('defeat')));
    // The win is recorded here and not at the end screen's button: the
    // autosave empties the slot at this same command, so a tab closed on the
    // end screen would otherwise lose the win with the run already gone.
    this.bus.on('run:victory', () => {
      this.recordWin();
      this.swap(new GameOverScene('complete'));
    });
    // 67b — the between-sector beat (the 67a gate's screen). Titles ride the
    // payload: the cleared sector is gone from Run by emit time, so no getter
    // can name it (the GameOverScene fixed-at-construction shape).
    // §90 — the seam pool pair rides along: the screen names the floor's heal.
    this.bus.on('sector:cleared', (e) =>
      this.swap(
        new SectorClearedScene(e.clearedSectorTitle, e.nextSectorTitle, e.poolBefore, e.poolAfter),
      ),
    );

    // H4b — the turn gates. These only fire when `run.pauseAtTurnGates` is
    // on (Game sets it in createRun); the headless loop never emits them.
    // `turn:starting` opens the pre-turn screen; `turn:resolved` is the
    // turn-outcome gate, which since 96.5d has NO screen — Game advances it
    // itself after the outro. Both continue via the `advanceTurn` command,
    // whose continuations (battle:started / the next turn:starting /
    // recruit:offered / promotion:pending / run:*) drive their own swaps.
    //
    // M3 — turn:resolved fires from inside the ending world.tick(), but the
    // advance is DEFERRED by a brief outro so the final board state breathes
    // (death fades + hitsplats drain + the 96.5b2 orbs landing) before the
    // next screen masks it. Safe to linger: World.tick() no-ops once
    // `_ended`, so the BattleScene's clock spins harmlessly through the
    // outro, and nothing else can advance until the deferred dispatch —
    // swap() cancels the timer anyway, defensively.
    // 65f — the deck-cue buffer: the deal's per-card cues fire DURING
    // `startNextTurn`, before `turn:starting` mounts the scene, so a
    // scene-scoped subscription can never see them. Game (page-lifetime)
    // buffers them and hands the deal sequence to the scene at swap time;
    // `battle:started` clears the buffer (any cue after it belongs to the
    // NEXT turn's recycle+deal — gate-time cues the mounted scene consumed
    // live are flushed with it).
    this.bus.on('deck:cardDrawn', (e) => this.deckCues.push({ kind: 'drawn', ...e }));
    this.bus.on('deck:cardDiscarded', (e) => this.deckCues.push({ kind: 'discarded', ...e }));
    this.bus.on('deck:reshuffled', (e) => this.deckCues.push({ kind: 'reshuffled', ...e }));
    this.bus.on('battle:started', () => {
      this.deckCues.length = 0;
    });
    // 96.5d → 115e — the previous turn's outcome (the "last turn" strip)
    // rides the payload, from the Run, so a pre-turn screen resumed from a
    // save shows it too.
    this.bus.on('turn:starting', (info) => {
      this.swap(new PreTurnScene(info, this.deckCues.splice(0)));
    });
    // 96.5b2 → 96.5d — the after-turn outro: the LONGER of the fixed
    // TURN_OUTRO_MS and the BattleScene's own settle (the loss orbs landing
    // + the ghost commit + the settle beat), so a survivors end sequence is
    // never cut short and a decisive casualties end still breathes the full
    // 900 ms. Then, instead of mounting the post-turn screen (deleted at
    // 96.5d — the live bar carries the outcome), Game dispatches the
    // `advanceTurn` the screen's Continue used to: Run's turn-outcome phase
    // is untouched (the fuzz bot drives it the same way), and the
    // continuation (reward / promotion / recruit / the next turn:starting /
    // run:*) drives its own swap.
    this.bus.on('turn:resolved', () => {
      const settle =
        this.activeScene instanceof BattleScene ? this.activeScene.outro() : Promise.resolve();
      this.afterOutro(TURN_OUTRO_MS, settle, () => {
        this.dispatch({ kind: 'advanceTurn' });
      });
    });

    // §104 — every EVENT-keyed sound, one subscriber over the registry
    // (src/audio/eventSounds.ts: which event plays what, and why the rest
    // are silent). Page-lifetime, so it survives scene swaps; the battle
    // cues (death / heal / dash) are safe here because BattleScene builds
    // the only World on this bus.
    attachEventSounds(this.bus, this.audio);

    // J3 — one page-lifetime keydown sink for every rebindable hotkey. On
    // `window` (not the canvas) so a binding fires without the play area being
    // focused, matching the I3 fast-forward listener it replaces. Dispatch is a
    // no-op until a scene subscribes a handler, so this can attach once at boot.
    window.addEventListener('keydown', this.keybindings.handleKeyDown);

    // Boot into the map (a `?character=` pin constructed the Run above), the
    // menu (116c — a plain URL), or the character select (a run dial with no
    // character: 63e — the choice precedes Run construction).
    if (this.run !== null) this.swap(new MapScene());
    else this.swap(this.menuBoot ? new MenuScene() : new CharacterSelectScene());
  }

  /**
   * 116c — the menu's New run: on to character select, holding the seed
   * field's text for the run that is confirmed there. A run saved in the slot
   * is untouched until then, so Back still finds Continue.
   */
  private openCharacterSelect(seedText: string): void {
    if (this.run !== null) {
      console.warn('[Game] the menu New run ignored: a run is already live');
      return;
    }
    this.seedText = seedText;
    this.swap(new CharacterSelectScene());
  }

  /**
   * 116d — Quit to menu, from the settings modal during a run. It is what
   * closing the tab is: the slot keeps the run as of its last gate (a fight
   * in progress comes back at its turn's pre-turn screen, DESIGN "Saving"),
   * and the menu's Continue returns to it. So the slot is left as it is,
   * which is why this is not `resetRun`. The page's own journal of the run
   * is let go; the slot holds the journal as saved, and Continue resumes
   * that in a new segment. A run this tab can't save (another tab's slot, a
   * blocked store) is lost, and the modal says so beside the button.
   */
  private quitToMenu(): void {
    if (this.run === null) return;
    this.journaling((recorder) => recorder.abandon());
    this.finishedJournal = null;
    this.run.dispose();
    this.run = null;
    this.deckCues.length = 0;
    // No run-end event hides the chips for a run that was left.
    this.bitsOverlay.conceal();
    this.poolOverlay.conceal();
    this.cacheOverlay.conceal();
    this.swap(new MenuScene());
  }

  /** 116c — character select's Back: the menu, with nothing started. */
  private backToMenu(): void {
    if (this.run !== null) {
      console.warn('[Game] character select Back ignored: a run is already live');
      return;
    }
    this.swap(new MenuScene());
  }

  /**
   * 63e — the CharacterSelectScreen's confirm: resolve the chosen character
   * and CONSTRUCT the Run (the §63 seam — Game holds the choice, constructs
   * on confirm). The new Run's `run:started` re-shows the overlay chips
   * (their subscriptions are live by now — unlike the pinned-boot path);
   * the refresh() pair after the assignment is the 48d/49f re-paint
   * ordering. A confirm while a Run already exists is a misroute — ignore.
   *
   * THE UNLOCKS ARE READ HERE, and nowhere else in a run's life (Round 8
   * spec D8): the picked level is held to the character's ceiling as the
   * store's progress has it now. The screen offers no level above the
   * ceiling, so the clamp only bites on a command that didn't come from it.
   * The picked level is the run's: a level in the URL beside no character is
   * replaced by it, where one beside `character=` never comes through here
   * and is played as written, unclamped (a driver's run, or a journal
   * replayed in the page on a store that never won).
   */
  private confirmCharacter(characterId: string, picked: number): void {
    if (this.run !== null) {
      console.warn(`[Game] chooseCharacter '${characterId}' ignored — a run is already live`);
      return;
    }
    const character = characterById(characterId);
    if (character === undefined) {
      throw new Error(`Game.confirmCharacter: unknown character id '${characterId}'`);
    }
    const ceiling = escalationCeiling(store.read(PROGRESS_SECTION).bestWin, character.id);
    this.run = this.createRun(character, levelWithinCeiling(picked, ceiling));
    this.autosave(this.run);
    this.bitsOverlay.refresh();
    this.poolOverlay.refresh();
    this.cacheOverlay.refresh();
    this.swap(new MapScene());
  }

  /**
   * 117d — a won run, written into the store's progress if it counts
   * (src/store/progress.ts): its dials hold its character, at most a level,
   * and nothing else, and its level is within that character's ceiling. The
   * record is the highest level won, so a win told twice (`Run.resume()`
   * re-emits a loaded end state's event) is written once. A win that raises
   * the character's ceiling is kept in `unlocked` for the end screen; a win
   * told again raises nothing and leaves it as it is.
   */
  private recordWin(): void {
    const run = this.run;
    if (run === null) return;
    const id = run.character.id;
    const win: { opened: number | null } = { opened: null };
    // Built on the record as it is stored now (`store.update`), not on this
    // page's copy: a second tab may have recorded a win since this page read
    // the section, and a write of the copy would put the record back
    // without it.
    store.update(PROGRESS_SECTION, ({ bestWin }) => {
      const ceiling = escalationCeiling(bestWin, id);
      if (!runCounts(this.runDials, run.escalation, ceiling)) return {};
      const after = bestWinAfter(bestWin, id, run.escalation);
      if (after === bestWin) return {};
      const opened = escalationCeiling(after, id);
      if (opened > ceiling) win.opened = opened;
      return { bestWin: after };
    });
    if (win.opened !== null) this.unlocked = win.opened;
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
    // 117.5i — a halted game applies nothing (`halt`). What still arrives is
    // a timer set before the failure, an outro's advance for one.
    if (this.halted) return;
    // 63e — the two GAME-level commands work without a live Run:
    // chooseCharacter CONSTRUCTS it (the select-precedes-Run seam);
    // resetRun tears down whatever exists. Everything else needs a Run —
    // a run-level command arriving pre-select is a scene sequencing bug,
    // so warn loud and drop rather than silently no-op it.
    if (command.kind === 'chooseCharacter') {
      this.confirmCharacter(command.characterId, command.escalation);
      return;
    }
    if (command.kind === 'resetRun') {
      this.resetRun();
      return;
    }
    const run = this.run;
    if (run === null) {
      console.warn(`[Game] '${command.kind}' ignored — no Run yet (character select pending)`);
      return;
    }
    // Recorded before it is applied, so what it sets off follows it in the
    // journal; the `settle` after the switch closes the journal if this
    // command ended the run.
    this.journaling((recorder) => recorder.command(command));
    switch (command.kind) {
      case 'enterNode':
        // If the hop is accepted, Run synchronously emits `battle:started`,
        // which fires the BattleScene swap before this line returns.
        // Rejected hops (non-frontier, wrong phase) emit nothing — we stay
        // on the map.
        run.dispatch(command);
        // 50e — docking emits `port:entered`, whose bus subscription swaps
        // the PortScene (the reward:offered pattern) — nothing to do here.
        // A rest node (`rest:entered`), an event page (`event:entered`) and a
        // battle (`battle:started`) each fire their own swap too. The phase
        // is still 'map' only when the hop was rejected, and the map is
        // remounted then as it always was.
        if (run.phase === 'map') {
          this.swap(new MapScene());
        }
        break;
      case 'chooseRestOption':
        // The rest gate's option. A rest that levelled someone emits
        // `promotion:pending`, which swaps itself; otherwise the run lands
        // on 'map' with no event (the leavePort pattern), so swap here.
        run.dispatch(command);
        if (run.phase === 'map') {
          this.swap(new MapScene());
        }
        break;
      case 'leavePort':
        // 50c — undock lands on 'map' with no event emit (the chooseRecruit
        // silent-transition pattern), so swap explicitly.
        run.dispatch(command);
        if (run.phase === 'map') {
          this.swap(new MapScene());
        }
        break;
      case 'chooseEventOption':
        // 74b — resolve an event choice. A page hop re-renders the (74f)
        // EventScreen off `event:pageChanged`; a start-encounter terminal
        // fires `battle:started` (self-swapping); a return-to-map terminal
        // lands on 'map' with no emit (the leavePort silent-transition
        // pattern), so swap explicitly.
        run.dispatch(command);
        if (run.phase === 'map') {
          this.swap(new MapScene());
        }
        break;
      case 'buyPortUnit':
      case 'buyPortPacket':
      case 'buyPortDaemon':
      case 'sellPacket':
      case 'payToRemoveUnit':
        // 50d — port transactions: run-level state only, no phase change
        // (the §50e port screen re-renders in place after dispatch, the
        // RewardScreen pattern; the overlays repaint off run:bitsChanged /
        // run:cacheChanged).
        run.dispatch(command);
        break;
      case 'chooseRecruit':
        run.dispatch(command);
        // Non-terminal recruit: phase falls back to 'map' with no event
        // emit. The terminal-floor case fires `run:victory` which is handled
        // by the bus subscription above.
        if (run.phase === 'map') {
          this.swap(new MapScene());
        }
        break;
      case 'passRecruit':
        // H6b — declining the offer also lands on 'map' with no event emit,
        // so swap explicitly (same pattern as chooseRecruit). A non-terminal
        // recruit is the only phase that reaches here; the terminal floor
        // routes through run:victory, never the recruit screen.
        run.dispatch(command);
        if (run.phase === 'map') {
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
        run.dispatch(command);
        if (run.phase === 'map') {
          this.swap(new MapScene());
        }
        break;
      case 'advanceTurn':
        // H4b — resume from a turn gate (pre/post-turn screen). The continuation
        // (start the battle, the next pre-turn screen, recruit, promotion, or
        // defeat) emits its own bus event that drives the scene swap, so there's
        // nothing to swap explicitly here.
        run.dispatch(command);
        break;
      case 'dismissSectorCleared':
        // 67a — release the between-sector gate; Run falls back to 'map' on
        // the NEW sector with no event emit, so swap explicitly (the
        // chooseRecruit / dismissPromotion pattern). The SectorClearedScene
        // that dispatches this lands at 67b — until then the gate is only
        // reachable headlessly (the shipped DAG has no non-sink terminal).
        run.dispatch(command);
        if (run.phase === 'map') {
          this.swap(new MapScene());
        }
        break;
      case 'acceptReward':
      case 'declineReward':
        // 48c — resolve one reward portion. Mid-offer the RewardScreen
        // re-renders in place; the LAST resolution advances the run, whose
        // event (promotion:pending / recruit:offered / run:victory) drives
        // its own swap — no silent-map path exists off a won encounter.
        run.dispatch(command);
        break;
      case 'redrawCards':
        // K3 — redraw at the pre-turn gate. The phase doesn't change (the
        // pre-turn screen stays up and refreshes in place off the
        // `turn:handRedrawn` emit), so there's no scene swap here either.
        run.dispatch(command);
        break;
      case 'empowerUnit':
        // K4 — empower at the pre-turn gate. Same in-place pattern as
        // redrawCards: the screen refreshes off `turn:unitEmpowered`.
        run.dispatch(command);
        break;
      case 'discardPacket':
        // 49b — cache discard: run-level state only, legal in any phase; the
        // cache surfaces repaint off `run:cacheChanged` (no scene swap).
        run.dispatch(command);
        break;
      case 'passGrant':
        // 49d — finalize the active grant at the pre-turn gate. Same
        // in-place pattern as redrawCards: the screen refreshes off
        // `turn:grantPassed` (no phase change, no scene swap).
        run.dispatch(command);
        break;
      case 'usePacket':
        // 49e — fire a held packet. No phase change in either context (the
        // pre-turn screen / map stay up); consumers repaint off
        // `run:cacheChanged` + `run:packetUsed` (no scene swap).
        run.dispatch(command);
        break;
      default:
        // Exhaustiveness guard (48c): this switch re-enumerates RunCommand by
        // hand, and a missing case silently DROPS the command — exactly how
        // acceptReward/declineReward shipped unroutable in 48b (the bridge
        // dispatched into the void; the browser-verify caught it). A new
        // command now fails to compile until it's routed here.
        command satisfies never;
        break;
    }
    this.journaling((recorder) => recorder.settle());
    this.autosave(run);
  }

  /**
   * 115e — THE AUTOSAVE (Round 8 spec D3). After every command the run
   * waits at a gate (every phase but `battle` and `turn-outcome`), the run
   * slot gets the snapshot, the dials, and the journal as the save keeps it;
   * a run's end empties the slot. A write the store refuses is silent here:
   * the run plays on, unsaved, and the can't-save chip says so from the
   * store's status (116i). In a second tab the slot refuses every write and
   * clear (115f).
   */
  private autosave(run: Run): void {
    if (run.phase === 'defeat' || run.phase === 'complete') {
      this.runSlot.clear();
      return;
    }
    if (run.phase === 'battle' || run.phase === 'turn-outcome') return;
    const snapshot = run.toJSON();
    let journal: RunJournal | null = null;
    this.journaling((recorder) => {
      journal = recorder.saved(snapshot);
    });
    this.runSlot.write({ snapshot, dials: this.runDials, journal });
  }

  /**
   * 115e — load the saved run from the run slot and go on from the screen it
   * was saved at (spec D3): the Run with its dials, its journal resumed in a
   * new segment, and the gate's screen re-mounted by `Run.resume()`. Returns
   * the read: on `empty` or `rejected` nothing changes, and a rejected
   * slot's text stays in place (`store.readStrict`); on `elsewhere` the run
   * is open in another tab and the slot was not read (115f). The menu's
   * Continue row calls this, through the scene context's `save`.
   */
  continueRun(): RunSlotRead {
    const read = this.runSlot.read();
    if (read.status !== 'ok') return read;
    const { run, wire } = read.value;
    this.adopt(run, wire.dials, (recorder) => {
      recorder.resume(wire.journal, wire.snapshot, wire.dials, () => run.toJSON());
    });
    return read;
  }

  /**
   * 53f → 115e — swap the live Run for a loaded one (the `resetRun` teardown
   * ordering) and mount the screen of the gate it was saved at. The caller
   * has already loaded it, so a corrupt save or a stale schema threw with
   * the live run untouched (both runs are bus-subscribed for the lines in
   * between; nothing emits synchronously there). `pauseAtTurnGates` is set
   * by hand: `fromJSON` leaves the headless default (false), which would
   * skip every pre-turn screen, and the H4b flag is Game's to set.
   */
  private adopt(restored: Run, dials: string, journal: (recorder: JournalRecorder) => void): void {
    restored.pauseAtTurnGates = true;
    // Opening or resuming the journal abandons the replaced run's, if open.
    this.journaling(journal);
    this.finishedJournal = null;
    this.run?.dispose();
    this.run = restored;
    this.runDials = dials;
    this.unlocked = null;
    // The replaced run's deal cues belong to no screen of this one.
    this.deckCues.length = 0;
    // 48d/49f — re-paint the page-lifetime chips AFTER the reassignment so
    // their getters read the new run.
    this.bitsOverlay.refresh();
    this.poolOverlay.refresh();
    this.cacheOverlay.refresh();
    // 115g — and show them. A created run's `run:started` reveals the chips;
    // a loaded run emits none, so one continued from the boot screen (or
    // loaded after a run's end) would play with its chips hidden. Before the
    // resume, so a loaded end state's own event hides them again.
    this.bitsOverlay.reveal();
    this.poolOverlay.reveal();
    this.cacheOverlay.reveal();
    if (restored.phase === 'map') this.swap(new MapScene());
    else restored.resume();
  }

  /**
   * Every call on the journal's recorder goes through here. Recording is
   * passive and must stay harmless: if the recorder throws, the error is
   * logged once, this page records no more, and the game carries on with no
   * journal to export.
   */
  private journaling(act: (recorder: JournalRecorder) => void): void {
    if (this.journalBroken) return;
    try {
      act(this.journalRecorder);
    } catch (err) {
      this.journalBroken = true;
      this.finishedJournal = null;
      this.journalRecorder.dispose();
      console.error('[journal] recording failed; this page records no more', err);
    }
  }

  /**
   * The run's journal: the one being recorded, or, once the run has ended,
   * the finished one until the next run starts. Null with no run, or after
   * the recorder failed.
   */
  currentJournal(): RunJournal | null {
    return this.journalRecorder.journal ?? this.finishedJournal;
  }

  start(): void {
    this.renderer.start();
  }

  /**
   * 117.5i — the page has failed and is about to say so (the failure plate,
   * src/failure). The loop stops with its last frame on the canvas, no
   * hotkey fires, and no command is applied from here on: a failure can
   * leave a run half-changed, and a command applied after it would save
   * that over the last good save. There is no way back but a reload.
   */
  halt(): void {
    this.halted = true;
    this.renderer.halt();
    this.keybindings.suspend();
  }

  /**
   * Tear down the current Run and leave its end screen. Wired to the
   * GameOverScreen's first button via the `resetRun` command. On a page that
   * booted to the menu that is the menu (116c); on a page booted by a run
   * dial it is a fresh run, seeded from the clock unless the URL pins a seed.
   *
   * This empties the run slot, so it is the route for a run that is over.
   * Quit to menu leaves a live run saved for Continue, so it has its own
   * route (`quitToMenu`).
   */
  private resetRun(): void {
    // A run reset before its end leaves an abandoned journal; one that had
    // ended already closed its journal, and this is a no-op. Either way the
    // finished journal belongs to the run being replaced.
    this.journaling((recorder) => recorder.abandon());
    this.finishedJournal = null;
    const won = this.run?.phase === 'complete';
    this.run?.dispose();
    this.unlocked = null;
    // 115e — the replaced run is gone, so its save goes with it; a pinned
    // character's new run saves over the slot below.
    this.runSlot.clear();
    // 63e — the locked reset fork: a `?character=` pin goes straight to a
    // fresh run + map; without it no run exists until a character is chosen
    // (the choice is per-run, not sticky). The chips were hidden by the
    // run:defeated/run:victory that preceded the reset button, so that path
    // leaves them hidden until the next run:started.
    if (this.runConfig.character !== undefined) {
      this.run = this.createRun();
      this.autosave(this.run);
      // 48d — re-paint the bits chip AFTER the reassignment: the new Run's
      // `run:started` fired mid-construction (before this.run pointed at
      // it), so the overlay's event-driven paint would have read the dead
      // run.
      this.bitsOverlay.refresh();
      this.poolOverlay.refresh();
      // 49f — same ordering for the cache chip (also closes a stale modal).
      this.cacheOverlay.refresh();
      this.swap(new MapScene());
    } else {
      this.run = null;
      this.bitsOverlay.refresh();
      this.poolOverlay.refresh();
      this.cacheOverlay.refresh();
      // 116c — a run's end goes to the menu on a page that booted to it, the
      // defeat and the win alike (the §116 shape-lock, call 3).
      this.swap(this.menuBoot ? new MenuScene() : new CharacterSelectScene());
      // 116j — the first won run goes there by way of the credits: the panel
      // opens over the menu, once. The flag is stored as the panel is shown,
      // so a tab closed on the credits doesn't bring them back.
      // 117d-post — asked of the flag as it is stored now, and written the
      // same way (`store.update`): another tab may have shown them since
      // this page read the section, and the write must not put this page's
      // copy of the record of wins back over that tab's.
      const credits = { show: false };
      store.update(PROGRESS_SECTION, ({ creditsSeen }) => {
        if (!creditsOnTheWay(won, this.menuBoot, creditsSeen)) return {};
        credits.show = true;
        return { creditsSeen: true };
      });
      if (credits.show) this.credits.open();
    }
  }

  /**
   * 53f — the dev export half: the live run's wire image, for the DEV export
   * key ([devKeys.ts](src/dev/devKeys.ts)). A read-only dump — phase gating
   * (the map-only load rule) is enforced on the LOAD side, so any phase may
   * be exported (a non-map file is still headless-fixture material).
   */
  devExportRun(): RunSnapshot {
    if (this.run === null) {
      throw new Error('devExportRun: no run to export (character select pending)');
    }
    return this.run.toJSON();
  }

  /**
   * 53f → 115e — the dev load half: swap the live Run for one loaded from an
   * exported snapshot, at any gate (`Run.resume()` re-mounts its screen). A
   * file holds no dials, so the run loads with none, and its journal starts
   * from the snapshot. A `battle` or `turn-outcome` export has no screen to
   * come back to and is refused before anything changes.
   */
  devLoadRun(snap: RunSnapshot): void {
    if (snap.phase === 'battle' || snap.phase === 'turn-outcome') {
      throw new Error(`devLoadRun: a '${snap.phase}' snapshot is not at a gate, so it has no screen to resume at`);
    }
    const restored = Run.fromJSON(snap, this.bus);
    this.adopt(restored, '', (recorder) =>
      recorder.open({ kind: 'snapshot', snapshot: snap, dials: '' }, () => restored.toJSON()),
    );
  }

  /**
   * G1 — build a fresh Run from the parsed RunConfig. Shared by the
   * constructor, `resetRun`, and — 63e — `confirmCharacter`, which passes
   * the scene-chosen character (layered over the URL config; a URL
   * `?character=` pin means this is never called with one). 116c — the
   * menu's seed field is layered the same way, for this run alone: its seed
   * goes into the run's dials, which is how a seeded run is told from one
   * seeded by the clock (the slot and the journal's start keep the dials).
   * 117d — and so is the Escalation level picked with the character, which
   * the dials spell for the journal's replay (level 0 by no dial).
   */
  private createRun(character?: CharacterConfig, escalation?: number): Run {
    const typedSeed = seedFromText(this.seedText);
    this.seedText = '';
    const config: RunConfig = {
      ...this.runConfig,
      ...(character !== undefined ? { character } : {}),
      ...(escalation !== undefined ? { escalation } : {}),
      ...(typedSeed !== undefined ? { seed: typedSeed } : {}),
    };
    const seed = config.seed ?? Date.now();
    const run = new Run(seed, this.bus, config);
    // H4b — the live game pauses at turn gates so the pre/post-turn screens can
    // show. (Headless tests + the fuzz harness leave this off → the synchronous
    // H4a loop, so they're unaffected.)
    run.pauseAtTurnGates = true;
    // The journal's start: the seed and the run dials as the URL would spell
    // them, the character among them. Game's config comes from the URL alone,
    // so that text reconstructs it (src/journal/replayJournal.ts); the run
    // slot keeps the same text (115e).
    this.runDials = runConfigToQueryString(config);
    this.unlocked = null;
    const dials = this.runDials;
    this.journaling((recorder) => recorder.open({ kind: 'seed', seed, dials }, () => run.toJSON()));
    this.finishedJournal = null;
    if (this.runConfig.startingRoster) {
      const desc = this.runConfig.startingRoster
        .map((e) => (e.level > 1 ? `${e.archetype} Lv${e.level}` : e.archetype)) // i18n-ok: a dev console line, never rendered
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
    // 78e — scene-derived map-chip availability: hidden on the map itself
    // (the live view is already up), pre-run (no run → no map), and
    // game-over. Pushed here so every swap path (event-driven, boot, reset)
    // stays covered by the one chokepoint.
    this.sectorMapOverlay.setAvailable(
      this.run !== null &&
        !(next instanceof MapScene) &&
        !(next instanceof CharacterSelectScene) &&
        !(next instanceof GameOverScene),
    );
    // 116d — the settings chip shows while a run is live, up to its end
    // screen (the menu has its own row). The same chokepoint.
    this.runOnScreen = this.run !== null && !(next instanceof GameOverScene);
    this.settingsOverlay.setAvailable(this.runOnScreen);
    // 116i-post — and the can't-save chip, which a second tab shows for as
    // long as its unsaved run is on screen.
    this.paintCantSave();
    // 96.5a — the morale chip hides while a turn screen or the battle is up:
    // the HUD's gauges and the pre/post-turn gauges are the one in-encounter
    // read (the §95 playtest: "morale reads twice"). Same chokepoint, same
    // reason — every swap path is covered. The chrome column collapses the
    // slot (96e decision D: the pool chip is display-only, nothing below it
    // shifts).
    this.poolOverlay.setSuppressed(next instanceof PreTurnScene || next instanceof BattleScene);
  }

  /** M3 → 96.5b2 → 96.5d — run `action` after BOTH `ms` (the fixed after-turn
   *  outro, letting the current scene play out) and `settle` (the battle's
   *  own outro: the loss orbs + the ghost commit). The action runs at fire
   *  time against the freshest state; superseded by any direct swap() — the
   *  timer is cleared and the token flips, so a reset mid-outro never fires
   *  a stale advance. (M3's `swapAfter` mounted the post-turn screen here;
   *  96.5d's action dispatches the advance the screen's Continue used to.) */
  private afterOutro(ms: number, settle: Promise<void>, action: () => void): void {
    this.cancelPendingSwap();
    const token = { cancelled: false };
    this.pendingOutro = token;
    const timer = new Promise<void>((resolve) => {
      this.pendingSwapTimer = window.setTimeout(() => {
        this.pendingSwapTimer = null;
        resolve();
      }, ms);
    });
    void Promise.all([timer, settle]).then(() => {
      if (token.cancelled) return;
      this.pendingOutro = null;
      action();
    });
  }

  /** 116i — show the can't-save chip for as long as the page has a reason
   *  it can't save (src/ui/cantSave.ts): the store's status, on every
   *  screen, or a second tab's run while it is on screen. */
  private paintCantSave(): void {
    this.cantSave.set(cantSaveReason(store.status().canSave, this.runSlot.lock, this.runOnScreen));
  }

  private cancelPendingSwap(): void {
    if (this.pendingSwapTimer !== null) {
      window.clearTimeout(this.pendingSwapTimer);
      this.pendingSwapTimer = null;
    }
    if (this.pendingOutro !== null) {
      this.pendingOutro.cancelled = true;
      this.pendingOutro = null;
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
      // 100e2 — the scenes mount into the screen host (before the chrome
      // column in DOM order); the page-lifetime chrome keeps #ui itself.
      uiMount: this.screenHost,
      controlSlot: this.controlSlot,
      dispatcher: this,
      run: this.run,
      journal: () => this.currentJournal(),
      save: {
        slot: () => this.runSlot.peek(),
        canSave: () => store.status().canSave,
        continue: () => this.continueRun().status,
      },
      menu: {
        atBoot: this.menuBoot,
        seedText: () => this.seedText,
        newRun: (seedText) => this.openCharacterSelect(seedText),
        back: () => this.backToMenu(),
        openSettings: () => this.settingsOverlay.open(),
        openCredits: () => this.credits.open(),
      },
      escalation: {
        ceiling: (characterId) => escalationCeiling(store.read(PROGRESS_SECTION).bestWin, characterId),
        unlocked: this.unlocked,
      },
      audio: this.audio,
      playback: this.playback,
      keybindings: this.keybindings,
    };
  }
}
