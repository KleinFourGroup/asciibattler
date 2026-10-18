/**
 * A scene owns what is on screen: one is active at a time, and Game swaps
 * them as the run's phase changes (`Game.swap`).
 *
 * The lifecycle:
 *   - `mount(ctx)` — wire up the DOM, the 3D content and the bus
 *     subscriptions. Called once, right after construction.
 *   - `tick(dt)` — each frame of the renderer's loop, for animation and the
 *     battle's clock; a DOM-only scene usually does nothing.
 *   - `dispose()` — tear it all down: remove the DOM, detach the 3D content,
 *     unsubscribe. Called by Game before the next scene mounts.
 *
 * `SceneContext` bundles the page-lifetime resources a scene may need. Game
 * builds it at each swap, so `ctx.run` is the current run. A scene that
 * needs arguments of its own (the recruit offer, the game-over variant)
 * takes them in its constructor.
 */

import type * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { Renderer } from '../render/Renderer';
import type { SpriteRenderer } from '../render/SpriteRenderer';
import type { UnitOverlayLayer } from '../render/UnitOverlayLayer';
import type { TerrainRenderer } from '../render/TerrainRenderer';
import type { ApronRenderer } from '../render/ApronRenderer';
import type { BackdropRenderer } from '../render/BackdropRenderer';
import type { FontAtlas } from '../render/FontAtlas';
import type { Run } from '../run/Run';
import type { RunDispatcher } from '../run/Command';
import type { RunJournal } from '../journal/journal';
import type { RunSlotRead, RunSlotState } from '../store/runSlot';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { PlaybackSpeed } from '../ui/PlaybackSpeed';
import type { Keybindings } from '../ui/Keybindings';

export interface SceneContext {
  readonly bus: EventBus<GameEvents>;
  readonly scene3D: THREE.Scene;
  /** BattleScene fits the camera to each battle's board with it
   *  (`fitToBoard`). */
  readonly renderer: Renderer;
  readonly sprites: SpriteRenderer;
  readonly overlays: UnitOverlayLayer;
  readonly terrain: TerrainRenderer;
  /** The apron ring around the board. BattleScene gives it the board's tile
   *  grid and clears it with the terrain on dispose. */
  readonly apron: ApronRenderer;
  /** The mist floor the apron fades into, the same for every encounter;
   *  BattleScene drives only its time. */
  readonly backdrop: BackdropRenderer;
  readonly fontAtlas: FontAtlas;
  readonly uiMount: HTMLElement;
  /** The control column's second row (src/ui/chip.ts): a scene whose screen
   *  owns a top-right control (Roster, Leave port, the speed strip) hands it
   *  this to mount the control into. */
  readonly controlSlot: HTMLElement;
  readonly dispatcher: RunDispatcher;
  /** Null when no run is live: the menu and character select mount without
   *  one. A scene that needs the run takes it through `requireRun`, so the
   *  type makes each scene say whether it can mount without one. */
  readonly run: Run | null;
  /** The run's journal as Game holds it now (`Game.currentJournal`): the one
   *  being recorded, or the finished one once the run has ended; null with
   *  no run. A function, because the journal of a run that just ended closes
   *  after the end screen has mounted. */
  readonly journal: () => RunJournal | null;
  /** The saved run, as the menu asks after it. Functions, read when the
   *  screen is drawn. */
  readonly save: SaveContext;
  /** The menu's routes: where a run's end goes, New run and Back. */
  readonly menu: MenuContext;
  /** The Escalation unlocks, as character select and the end screen ask
   *  after them. */
  readonly escalation: EscalationContext;
  readonly audio: AudioPlayer;
  /** The page-lifetime playback speed. BattleScene reads `current` each tick
   *  to scale `dt`; the HUD's speed pane and its hotkeys set it. It lasts
   *  across swaps, so it lives here and not on a scene. */
  readonly playback: PlaybackSpeed;
  /** The page-lifetime registry of rebindable hotkeys. The HUD subscribes its
   *  battle controls' hotkeys on mount and drops them on dispose; a rebind
   *  lasts across scenes. */
  readonly keybindings: Keybindings;
}

export interface SaveContext {
  /** The run slot now, read without loading the run into the game. */
  slot(): RunSlotState;
  /** False when the store can't save: storage refused at boot, or a write
   *  that has failed since. */
  canSave(): boolean;
  /** Continue the saved run (`Game.continueRun`). `ok`: the run is live and
   *  its screen is mounting; anything else: nothing changed. */
  continue(): RunSlotRead['status'];
}

/**
 * The menu's side of the game. These are routes between two screens
 * that have no run, so they are functions here and not run commands: a
 * command kind would join the journal's kinds and the chaos census.
 */
export interface MenuContext {
  /** True on a page that booted to the menu (a plain URL;
   *  src/scenes/menuRules.ts): a run's end goes back to it. False on a page
   *  booted by a run dial, where a run's end starts the next run. */
  readonly atBoot: boolean;
  /** The seed field's text as the page holds it: kept from New run through
   *  character select's Back, and emptied when a run takes it. */
  seedText(): string;
  /** The menu's New run: on to character select. The run started there takes
   *  `seedText` as its seed; an empty one leaves the seed to the clock. */
  newRun(seedText: string): void;
  /** Character select's Back: the menu, with nothing started. */
  back(): void;
  /** The menu's Settings row: open the settings modal, the one the chip
   *  opens during a run (src/ui/SettingsOverlay.ts). */
  openSettings(): void;
  /** The menu's Credits row: open the credits panel
   *  (src/ui/CreditsOverlay.ts). */
  openCredits(): void;
}

/**
 * What a screen may know of the Escalation unlocks (the store's progress,
 * src/store/progress.ts). The screens never read the store.
 */
export interface EscalationContext {
  /** The highest level `characterId` may start a run at, as the store has
   *  it now. A function, read when the screen is drawn. */
  ceiling(characterId: string): number;
  /** The level the live run's won end opened for its character; null when
   *  the run has not ended, was lost, or its win opened nothing (a win under
   *  the ceiling or at the ladder's top, or a run that doesn't count). */
  readonly unlocked: number | null;
}

export interface Scene {
  mount(ctx: SceneContext): void;
  tick(dt: number): void;
  dispose(): void;
}

/** The context's live run, for a scene that needs one. A null here is a
 *  sequencing bug in Game (a scene that needs the run mounted before one was
 *  made), so it throws. */
export function requireRun(ctx: SceneContext): Run {
  if (ctx.run === null) {
    throw new Error('Scene requires a live Run, but none exists yet (pre-select boot)');
  }
  return ctx.run;
}
