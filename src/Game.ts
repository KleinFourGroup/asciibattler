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

/** The after-turn outro's floor (ms): the resolved board lingers at least
 *  this long (death fades, hitsplats drain) before Game sends the turn's
 *  `advanceTurn`, and longer while the battle's own settle runs
 *  (`BattleScene.outro`). */
const TURN_OUTRO_MS = 900;

/**
 * The top-level orchestrator. It holds what lives for the page's life (the
 * EventBus, the Renderer and its persistent meshes, the chrome) and the live
 * Run, and it manages the scenes.
 *
 * What is on screen is `activeScene`. It is swapped on the Run's lifecycle
 * events (the subscriptions in the constructor), on a landing on the map,
 * which no event announces (`dispatch`), and on the transitions no Run
 * owns: the boot, a character confirmed, a run reset, left or continued,
 * and the menu's New run and Back.
 *
 * Game is the `RunDispatcher` the screens and the chips send commands to.
 * It handles `chooseCharacter` and `resetRun` itself, since they make or
 * replace the Run, and forwards the rest to the live Run. The UI holds
 * Game, not the Run, so a Run replaced under it is invisible to the UI.
 */
export class Game implements RunDispatcher {
  private readonly bus = new EventBus<GameEvents>();
  /**
   * The run journal's recorder (src/journal). Page-lifetime, and on the bus
   * before any Run, as its header asks. `dispatch` hands it each command
   * before the Run applies it; `createRun` and `devLoadRun` open a journal,
   * `continueRun` resumes one, and `resetRun` and `quitToMenu` abandon one.
   * Every call goes through `journaling`, so a recorder that throws can't
   * take the game with it. A journal closed by its run's end is kept in the
   * store (src/store/journals.ts), within that section's budget.
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
   * The run slot as this tab may use it (src/store/runSlot.ts). Every read,
   * write and clear of the save goes through it, so a second tab (the
   * two-tab lock held by another) leaves the first tab's save alone and
   * plays unsaved.
   */
  private readonly runSlot: RunSlot;
  private readonly renderer: Renderer;
  private readonly fontAtlas: FontAtlas;
  private readonly sprites: SpriteRenderer;
  private readonly overlays: UnitOverlayLayer;
  /** The bits, pool and cache chips (the cache's with its modal):
   *  page-lifetime chrome in the chrome column, which no scene swap
   *  touches. Their lifecycle is in BitsOverlay's header (gotcha #116):
   *  repainted after the Run is replaced (`refresh`), shown for a loaded
   *  run (`reveal`), hidden for one that was left (`conceal`). */
  private readonly bitsOverlay: BitsOverlay;
  private readonly poolOverlay: PoolOverlay;
  private readonly cacheOverlay: CacheOverlay;
  /** The sector-map chip and its read-only overlay. Whether it is offered
   *  is the scene's, pushed from `swap`. */
  private readonly sectorMapOverlay: SectorMapOverlay;
  /** The settings chip and modal; the chip is the control column's first
   *  row. The menu opens the same modal through the scene context. */
  private readonly settingsOverlay: SettingsOverlay;
  /** The control column's second row (src/ui/chip.ts): the screen that is up
   *  mounts its own top-right control here, through the scene context. */
  private readonly controlSlot: HTMLDivElement;
  /** The credits panel: the menu's row opens it, and so does leaving the
   *  first won run's end screen on a page that goes to the menu
   *  (`resetRun`). */
  private readonly credits: CreditsOverlay;
  /** The can't-save chip, and whether a run is on screen (live, and not at
   *  its end screen), which is when a second tab's chip shows. */
  private readonly cantSave: CantSaveChip;
  private runOnScreen = false;
  private readonly terrain: TerrainRenderer;
  /** The backdrop apron, the fogged ring around the board. */
  private readonly apron: ApronRenderer;
  /** The mist floor (page-lifetime scenery; only its uTime advances). */
  private readonly backdrop: BackdropRenderer;
  /** The screen host: the scenes' mount (every screen and the HUD), the
   *  first child of #ui, ahead of the two columns and the tooltip host.
   *  Stacking doesn't rest on that order: the host is a static, unsized
   *  div whose screens are absolute or fixed against #ui, and the columns
   *  are fixed with their own z-index. The Tab walk does: with the chips
   *  ahead, a screen's last control would reach them only past the
   *  document's end, through the browser's own UI, and around. */
  private readonly screenHost: HTMLDivElement;
  private readonly audio: AudioPlayer;
  /**
   * The battle's playback speed, page-lifetime so the chosen speed carries
   * across turns and battles; every scene has it through the context. The
   * steps are `config/playback.json`'s, and in a battle the HUD's pane has
   * a button and a hotkey for each (`HUD.selectSpeed`).
   */
  private readonly playback = new PlaybackSpeed();
  /** The deck-cue buffer: the deal's cues fire before the pre-turn scene
   *  mounts, so Game holds them for it (the wiring in the constructor). */
  private readonly deckCues: DeckCue[] = [];
  /**
   * The page-lifetime keybinding registry. It owns the one `window` keydown
   * listener (attached in the constructor) and takes the settings' key
   * overrides. Game subscribes the keys that work on every screen (the
   * map, the tooltip); a battle's HUD subscribes its own through the scene
   * context and lets them go on dispose.
   */
  private readonly keybindings = new Keybindings();
  /** The page's settings (src/settings). The constructor connects them to
   *  what they set; a dev console reaches them as `__game.settings`. */
  private readonly settings = settings;
  /**
   * The live run, or null when there is none: at the menu and at character
   * select (a `character` dial constructs one at boot, skipping both).
   * Replaced on a reset, a Continue and a dev load. A run-level command
   * that arrives while it is null is dropped loudly in `dispatch`.
   */
  private run: Run | null;
  /**
   * The RunConfig parsed once from the launch URL, the base of every run
   * this page creates (`createRun`), so a reset re-rolls a run of the same
   * shape. A pinned `seed` gives the same run on each reset; with none,
   * each run is seeded from the clock.
   */
  private readonly runConfig: RunConfig;
  /**
   * Whether this page booted to the menu: a plain URL, with no run dial and
   * no board bookmark (src/scenes/menuRules.ts). Fixed for the page's life.
   * It decides the first screen and where a run's end goes: the menu here;
   * on a page booted by a dial, a fresh run with a `character` dial and
   * character select without one.
   */
  private readonly menuBoot: boolean;
  /**
   * The menu's seed field, as text. The menu hands it over with New run,
   * character select's Back finds it as it was left, and the run that is
   * created takes it (`createRun`), which empties it: a seed is one run's.
   */
  private seedText = '';
  /** The scene mounted now; null only until the constructor's first swap. */
  private activeScene: Scene | null = null;
  /** The in-flight outro's cancellation token (`afterOutro`); null when no
   *  outro is pending. */
  private pendingOutro: { cancelled: boolean } | null = null;
  /** The live run's dials as URL query text: what its journal's seed start
   *  holds, and what the run slot keeps beside the snapshot, so a load
   *  reads the inputs the run was created with. */
  private runDials = '';
  /** The Escalation level the live run's won end opened for its character,
   *  for the end screen to say; null until a win opens one, and again when
   *  another run takes its place. */
  private unlocked: number | null = null;
  /** The outro's timer (`afterOutro`). Any swap cancels it, with the
   *  token, so an advance set before a swap never fires after it. */
  private pendingSwapTimer: number | null = null;
  /** Set once the page has failed (`halt`), for its life. */
  private halted = false;

  constructor(canvas: HTMLCanvasElement, fontAtlas: FontAtlas, uiMount: HTMLElement, runLock: RunLock) {
    this.fontAtlas = fontAtlas;
    // Before any run exists: a boot with a character dial saves below.
    this.runSlot = openRunSlot(store, this.bus, runLock);
    // The screen host goes in before any other #ui child (see the field).
    // #ui itself is not kept: the page-lifetime chrome takes it here, and
    // the scenes get the host.
    this.screenHost = document.createElement('div');
    this.screenHost.className = 'screen-host';
    uiMount.appendChild(this.screenHost);
    this.audio = new AudioPlayer();
    // The settings reach what they set: each consumer takes its stored value
    // here, before the first screen mounts, and its new value on every
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

    // The RunConfig from the URL's run dials; with none, an empty config,
    // and each run is seeded from the clock.
    this.runConfig = parseRunConfigFromURL();
    this.menuBoot = bootsToMenu(location.search);

    // The Run is built now only when a `character` dial names the
    // character; otherwise it stays null until character select confirms
    // (`confirmCharacter`) or the menu's Continue loads one. A Run built
    // after Game's subscriptions behaves as one built before them: Game
    // listens to none of the events the Run listens to (`battle:ended`,
    // `unit:died`), and the Run emits each event Game swaps on after it has
    // set its phase.
    this.run = this.runConfig.character !== undefined ? this.createRun() : null;
    // A boot with a character in its dials starts its own run, never
    // continues one, and saves over the slot.
    if (this.run !== null) this.autosave(this.run);

    // The Renderer runs the active scene's tick each frame. After it (the
    // sprites lerped for the frame) the glyph billboards are sorted back to
    // front: they are `depthWrite: false`, so draw order is their only
    // occlusion. The render follows onFrame.
    this.renderer = new Renderer(canvas, (dt) => {
      this.activeScene?.tick(dt);
      this.sprites.sortByDepth(this.renderer.camera);
    });

    // The terrain: one mesh for every board, sized once for the largest
    // (src/render/TerrainRenderer.ts); BattleScene gives it each battle's
    // tiles.
    this.terrain = new TerrainRenderer();
    this.renderer.scene.add(this.terrain.mesh);

    // The apron: a fogged, unplayable ring that carries the board outward
    // so it doesn't float in the void, its heights read through the terrain
    // so the seam doesn't show (src/render/ApronRenderer.ts).
    this.apron = new ApronRenderer(this.terrain);
    this.renderer.scene.add(this.apron.mesh);

    // The mist floor the apron dissolves into: independent of the
    // encounter, so it is added once and never reset.
    this.backdrop = new BackdropRenderer();
    this.renderer.scene.add(this.backdrop.mesh);

    this.sprites = new SpriteRenderer(this.fontAtlas);
    // Both meshes live in the same scene; layer membership routes them to
    // the right composer. `mesh` (layer 0) → mainComposer (visible color);
    // `bloomMesh` (BLOOM_LAYER) → bloomComposer (halo input).
    this.renderer.scene.add(this.sprites.mesh);
    this.renderer.scene.add(this.sprites.bloomMesh);

    // The per-unit DOM overlay (the HP bar, the action bar, the level
    // badge). Its container goes in before #ui, so the HUD and the screens
    // paint over it: the overlays are world content, the HUD is chrome.
    this.overlays = new UnitOverlayLayer(() => this.renderer.camera, canvas, uiMount);

    // The chrome chips. Each one's first paint is its constructor's read of
    // its getter, and every getter is null-safe: with no run yet, each chip
    // starts hidden and the run's `run:started` shows it (the lifecycle is
    // in BitsOverlay's header). The chips mount into the chrome column
    // (src/ui/chip.ts), where CSS `order` places them, so the construction
    // and subscription order below is free. The control column goes into
    // the tree first: Tab leaves a screen for Settings and the screen's own
    // control, then walks the chips, and the can't-save chip is the walk's
    // last stop.
    const controls = createControlColumn(uiMount);
    this.controlSlot = controls.slot;
    const chips = createChromeColumn(uiMount);
    // The one tooltip host (src/ui/tooltip.ts), page-lifetime like the
    // columns; every `attachTooltip` renders into it.
    installTooltipHost(uiMount);
    this.bitsOverlay = new BitsOverlay(
      chips,
      this.bus,
      () => this.run?.bits ?? 0,
      this.run === null,
    );

    this.poolOverlay = new PoolOverlay(
      chips,
      this.bus,
      () => ({ current: this.run?.playerHealth ?? 0, max: HEALTH.playerHealthMax }),
      this.run === null,
    );

    // The cache chip and its modal, which sends its commands to Game.
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

    // The sector-map chip and its overlay. Its view getter reads the live
    // run, so a replaced Run is invisible to it. Its key subscribes here,
    // at the page's layer, so the map opens on every screen that offers the
    // chip (`swap` says which).
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
    // The settings: a chip while a run is live, and the modal that chip and
    // the menu's row both open. The modal holds the playback and suspends
    // the key registry while it is up (src/ui/SettingsOverlay.ts).
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
        // The data rows: the whole store out and in (src/store/backup.ts),
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
          // The player's diagnostics (src/diagnostics/report.ts): each
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
    // The can't-save chip: last in the column and in the Tab walk, shown
    // while the store's status says the page can't save
    // (src/ui/CantSaveChip.ts); `swap` paints it too, for a second tab's run
    // (`paintCantSave`).
    this.cantSave = new CantSaveChip(chips, cantSaveReason(store.status().canSave, this.runSlot.lock, false));
    store.onStatus((status) => {
      this.paintCantSave();
      if (!status.canSave) console.warn("[store] can't save:", status.error); // i18n-ok: a dev console line
    });
    // The tooltip key, page-lifetime like the map key: pin the open
    // tooltip / close a pinned one / open pinned for the focused or hovered
    // trigger (src/ui/tooltip.ts).
    this.keybindings.on('showTooltip', () => toggleTooltipKey());

    // The scene swaps on the Run's lifecycle events. The Run emits each
    // after it has set its phase and the gate's state, so the new scene
    // reads ctx.run as the gate has it.
    this.bus.on('battle:started', () => this.swap(new BattleScene()));
    // A turn that levelled units comes here after its reward and before
    // the next turn or the encounter's end, so the recruit offer, rolled at
    // the encounter's end, still comes once per won encounter short of the
    // sector's terminal. A rest that levelled units comes here too, and
    // goes on to the map.
    this.bus.on('promotion:pending', ({ promotions }) =>
      this.swap(new PromotionScene(promotions)),
    );
    this.bus.on('recruit:offered', ({ units }) => this.swap(new RecruitScene(units)));
    // The reward offer's screen, a turn's first gate (the reward, the
    // promotion, then the next turn or the encounter's end). The screen
    // reads the live offer off ctx.run.
    this.bus.on('reward:offered', () => this.swap(new RewardScene()));
    // Docking at a port. The screen reads the live stock off
    // ctx.run.portStock.
    this.bus.on('port:entered', () => this.swap(new PortScene()));
    // An event node opened its page. The screen reads the live page off
    // ctx.run.
    this.bus.on('event:entered', () => this.swap(new EventScene()));
    // A rest node opened its gate (or a loaded run resumed at it). The
    // screen reads what the rest would do off ctx.run.
    this.bus.on('rest:entered', () => this.swap(new RestScene()));
    this.bus.on('run:defeated', () => this.swap(new GameOverScene('defeat')));
    // The win is recorded here and not at the end screen's button: the
    // autosave empties the slot at this same command, so a tab closed on the
    // end screen would otherwise lose the win with the run already gone.
    this.bus.on('run:victory', () => {
      this.recordWin();
      this.swap(new GameOverScene('complete'));
    });
    // The between-sector screen. The payload carries both sectors' titles
    // and the pool before and after the seam's floor raised it.
    this.bus.on('sector:cleared', (e) =>
      this.swap(
        new SectorClearedScene(e.clearedSectorTitle, e.nextSectorTitle, e.poolBefore, e.poolAfter),
      ),
    );

    // The turn gates, which fire only with `run.pauseAtTurnGates` on (Game
    // sets it on every run it makes or loads). `turn:starting` opens the
    // pre-turn screen. `turn:resolved` has no screen: Game sends its
    // `advanceTurn` after the outro. Each advance goes on to an event whose
    // subscription swaps the scene (`battle:started`, a reward, a
    // promotion, the next `turn:starting`, a recruit, a sector's end, the
    // run's end).
    //
    // `turn:resolved` fires inside the World's last tick, and the advance
    // waits for the outro, so the final board plays out before the next
    // screen covers it. Lingering is safe: an ended World's tick does
    // nothing, so the battle scene's clock spins through the outro, and
    // nothing else advances the run before the deferred dispatch; a swap
    // cancels the timer anyway.
    //
    // The deck-cue buffer: the deal's cues fire inside `startNextTurn`,
    // before `turn:starting` mounts the scene, so no scene's subscription
    // can see them. Game holds them and hands the deal to the scene at the
    // swap. `battle:started` empties the buffer, and with it the cues the
    // mounted pre-turn scene took live at its gate (a redraw).
    this.bus.on('deck:cardDrawn', (e) => this.deckCues.push({ kind: 'drawn', ...e }));
    this.bus.on('deck:cardDiscarded', (e) => this.deckCues.push({ kind: 'discarded', ...e }));
    this.bus.on('deck:reshuffled', (e) => this.deckCues.push({ kind: 'reshuffled', ...e }));
    this.bus.on('battle:started', () => {
      this.deckCues.length = 0;
    });
    // The previous turn's outcome (the pre-turn screen's "last turn" strip)
    // rides the payload, from the Run, so a pre-turn screen resumed from a
    // save shows it too.
    this.bus.on('turn:starting', (info) => {
      this.swap(new PreTurnScene(info, this.deckCues.splice(0)));
    });
    // The after-turn outro: the longer of TURN_OUTRO_MS and the battle's own
    // settle (`BattleScene.outro`), so a long end sequence is never cut
    // short and a short one still lingers. Then Game sends the turn's
    // `advanceTurn`, as the fuzz bot does, and its continuation swaps the
    // scene.
    this.bus.on('turn:resolved', () => {
      const settle =
        this.activeScene instanceof BattleScene ? this.activeScene.outro() : Promise.resolve();
      this.afterOutro(TURN_OUTRO_MS, settle, () => {
        this.dispatch({ kind: 'advanceTurn' });
      });
    });

    // Every event-keyed sound, one page-lifetime subscriber over the
    // registry (src/audio/eventSounds.ts: which event plays what, why the
    // rest are silent, and why the battle's cues are safe at this layer).
    attachEventSounds(this.bus, this.audio);

    // The one keydown sink for every rebindable hotkey, on `window` (not the
    // canvas) so a binding fires without the play area focused.
    window.addEventListener('keydown', this.keybindings.handleKeyDown);

    // Boot into the map (a `character` dial built the Run above), the menu
    // (a plain URL), or character select (a run dial with no character).
    if (this.run !== null) this.swap(new MapScene());
    else this.swap(this.menuBoot ? new MenuScene() : new CharacterSelectScene());
  }

  /**
   * The menu's New run: on to character select, holding the seed
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
   * Quit to menu, from the settings modal during a run. It is what
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

  /** Character select's Back: the menu, with nothing started. */
  private backToMenu(): void {
    if (this.run !== null) {
      console.warn('[Game] character select Back ignored: a run is already live');
      return;
    }
    this.swap(new MenuScene());
  }

  /**
   * Character select's confirm: resolve the chosen character and build the
   * Run. The new Run's `run:started` shows the chips, whose subscriptions
   * are live by now; the `refresh` calls after the assignment repaint them
   * from the new run (gotcha #116). A confirm while a Run already exists is a
   * misroute, and is ignored.
   *
   * The unlocks are applied here, and nowhere else in a run's life: the
   * picked level is held to the character's ceiling as the store's
   * progress has it now. The screen offers no level above the ceiling, so
   * the clamp only bites on a command that didn't come from it.
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
   * A won run, written into the store's progress if it counts
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
   * The RunDispatcher's entry, which the screens and the chips call.
   * `chooseCharacter` builds a Run and `resetRun` replaces it; every other
   * command goes to the live Run. Most of the Run's transitions emit an
   * event whose subscription swaps the scene; a landing on the map emits
   * none, so the switch below swaps the map in.
   */
  dispatch(command: RunCommand): void {
    // A halted game applies nothing (`halt`). What still arrives is a timer
    // set before the failure, an outro's advance for one.
    if (this.halted) return;
    // The two game-level commands work without a live Run. Every other one
    // needs a Run: a run-level command with none is a scene's sequencing
    // bug, so it is dropped with a warning rather than silently.
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
    run.dispatch(command);
    switch (command.kind) {
      case 'enterNode':
      case 'chooseRestOption':
      case 'leavePort':
      case 'chooseEventOption':
      case 'chooseRecruit':
      case 'passRecruit':
      case 'dismissPromotion':
      case 'dismissSectorCleared':
        // Each of these can land the run on 'map', and no event says so: a
        // hop refused, a rest that levelled no one, an undock, an event's
        // return to the map, a recruit taken or passed short of the run's
        // end, a promotion after a rest, the sector gate released onto the
        // new sector's map. Their other landings emit an event whose
        // subscription swaps the scene or re-renders it.
        if (run.phase === 'map') this.swap(new MapScene());
        break;
      case 'buyPortUnit':
      case 'buyPortPacket':
      case 'buyPortDaemon':
      case 'sellPacket':
      case 'payToRemoveUnit':
      case 'advanceTurn':
      case 'acceptReward':
      case 'declineReward':
      case 'redrawCards':
      case 'empowerUnit':
      case 'discardPacket':
      case 'passGrant':
      case 'usePacket':
        // None of these lands on 'map' from another phase. A port trade, a
        // packet used or discarded, the gate's redraw, empower and pass, and
        // a reward resolved before the last leave the phase as it is, and
        // the screen repaints in place; a turn gate's advance and a reward's
        // last resolution move on through an event that swaps the scene.
        break;
      default:
        // The switch lists RunCommand by hand, so a new command fails to
        // compile until it is put in one of the two groups above.
        command satisfies never;
        break;
    }
    this.journaling((recorder) => recorder.settle());
    this.autosave(run);
  }

  /**
   * The autosave. When the run waits at a gate (every phase but `battle`
   * and `turn-outcome`) after a command or its start, the run slot gets the
   * snapshot, the dials, and the journal as the save keeps it; a run's end
   * empties the slot. A write the store refuses is silent here: the run
   * plays on, unsaved, and the can't-save chip says so from the store's
   * status. In a second tab the slot refuses every write and clear.
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
   * Load the saved run from the run slot and go on from the screen it was
   * saved at: the Run with its dials, its journal resumed in a new segment,
   * and the gate's screen mounted again (`adopt`). Returns the read: on
   * `empty` or `rejected` nothing changes, and a rejected slot's text stays
   * in place (`store.readStrict`); on `elsewhere` the run is open in
   * another tab and the slot was not read. The menu's Continue row calls
   * this, through the scene context's `save`.
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
   * Swap the live Run for a loaded one and mount the screen of the gate it
   * was saved at: the map here, any other through `Run.resume()`'s event.
   * The caller has loaded it already, so a save that failed to load left
   * the live run untouched (both runs are subscribed to the bus for the
   * lines in between, and nothing emits there). `pauseAtTurnGates` is set
   * by hand: `fromJSON` leaves it off, which would skip every pre-turn
   * screen, and the flag is Game's to set.
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
    // Repaint the chips after the assignment, so their getters read the new
    // run (gotcha #116).
    this.bitsOverlay.refresh();
    this.poolOverlay.refresh();
    this.cacheOverlay.refresh();
    // And show them. A created run's `run:started` shows the chips; a loaded
    // run emits none, so one continued from the menu (or loaded after a
    // run's end) would play with its chips hidden. Before the resume, so a
    // loaded end state's own event hides them again.
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
   * The page has failed and is about to say so (the failure plate,
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
   * Tear down the current Run and leave its end screen, the `resetRun` of
   * the GameOverScreen's first button. On a page that booted to the menu
   * that goes to the menu; on a page booted by a run dial, to a fresh run
   * with a `character` dial (seeded from the clock unless the URL pins a
   * seed) and to character select without one.
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
    // The replaced run is gone, so its save goes with it; a `character`
    // dial's new run saves over the slot below.
    this.runSlot.clear();
    // A `character` dial goes straight to a fresh run and its map; without
    // one no run exists until a character is chosen, since the choice is
    // per run. The chips were hidden by the run's end event, so that path
    // leaves them hidden until the next `run:started`.
    if (this.runConfig.character !== undefined) {
      this.run = this.createRun();
      this.autosave(this.run);
      // Repaint the chips after the assignment: the new Run's `run:started`
      // fired inside its constructor, before this.run pointed at it, so an
      // event-driven paint would have read the dead run (gotcha #116). The
      // cache chip's refresh closes a stale modal too.
      this.bitsOverlay.refresh();
      this.poolOverlay.refresh();
      this.cacheOverlay.refresh();
      this.swap(new MapScene());
    } else {
      this.run = null;
      this.bitsOverlay.refresh();
      this.poolOverlay.refresh();
      this.cacheOverlay.refresh();
      // A run's end goes to the menu on a page that booted to it, the defeat
      // and the win alike.
      this.swap(this.menuBoot ? new MenuScene() : new CharacterSelectScene());
      // The first won run goes there by way of the credits: the panel opens
      // over the menu, once. The flag is stored as the panel is shown, so a
      // tab closed on the credits doesn't bring them back. It is asked of
      // the flag as it is stored now, and written the same way
      // (`store.update`): another tab may have shown them since this page
      // read the section, and the write must not put this page's copy of
      // the record of wins back over that tab's.
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
   * The dev export: the live run's wire image, for the dev export key
   * (src/dev/devKeys.ts). A read-only dump, so any phase may be exported;
   * the load refuses a phase with no screen to resume at (`devLoadRun`),
   * and such a file is still a headless fixture.
   */
  devExportRun(): RunSnapshot {
    if (this.run === null) {
      throw new Error('devExportRun: no run to export (character select pending)');
    }
    return this.run.toJSON();
  }

  /**
   * The dev load: swap the live Run for one loaded from an
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
   * Build a fresh Run from the parsed RunConfig, for the constructor,
   * `resetRun` and `confirmCharacter`. Three inputs are layered over the
   * URL's config, for this run alone: the character chosen at select (with
   * a URL `character` dial none is passed), the Escalation level picked
   * with it, and the menu's seed field. They go into the run's dials, which
   * the slot and the journal's start keep, so a seeded run is told from one
   * seeded by the clock and the journal's replay plays the same level
   * (level 0 by no dial).
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
    // The live game stops at the turn gates (`Run.pauseAtTurnGates`), so the
    // pre-turn screen can show and the battle's outro can play.
    run.pauseAtTurnGates = true;
    // The journal's start: the seed and the run dials as the URL would spell
    // them, the layered inputs among them, so that text rebuilds the config
    // (src/journal/replayJournal.ts); the run slot keeps the same text.
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
    // Whether the map chip is offered: not with no run, not on the map
    // itself (the live view is up), at character select or at a run's end.
    // Pushed here so every swap path (an event, the boot, a reset) is
    // covered by the one chokepoint.
    this.sectorMapOverlay.setAvailable(
      this.run !== null &&
        !(next instanceof MapScene) &&
        !(next instanceof CharacterSelectScene) &&
        !(next instanceof GameOverScene),
    );
    // The settings chip shows while a run is live, up to its end screen
    // (the menu has its own row). The same chokepoint.
    this.runOnScreen = this.run !== null && !(next instanceof GameOverScene);
    this.settingsOverlay.setAvailable(this.runOnScreen);
    // And the can't-save chip, which a second tab shows for as long as its
    // unsaved run is on screen.
    this.paintCantSave();
    // The pool chip hides while the pre-turn screen or the battle is up, so
    // the pools are read once in an encounter, from those screens' own
    // gauges. The chrome column collapses its slot; the chip below it is
    // display-only, so no click target moves.
    this.poolOverlay.setSuppressed(next instanceof PreTurnScene || next instanceof BattleScene);
  }

  /** Run `action` after both `ms` (the outro's floor) and `settle` (the
   *  battle's own outro). The action runs at fire time against the freshest
   *  state. Any swap supersedes it: the timer is cleared and the token
   *  flips, so a reset mid-outro never fires a stale advance. */
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

  /** Show the can't-save chip for as long as the page has a reason
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
      // The scenes mount into the screen host (see the field).
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
