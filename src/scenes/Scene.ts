/**
 * Scene system (A5). A Scene owns the "what's on screen right now" — at most
 * one is active at a time, and Game swaps them on Run phase transitions.
 *
 * Three lifecycle hooks:
 *   - `mount(ctx)` — wire up DOM / 3D content, bus subscriptions, etc. Called
 *     once, immediately after construction.
 *   - `tick(dt)` — driven from Renderer's RAF loop. Drives in-flight
 *     animation, simulation clock, etc. DOM-only scenes typically no-op.
 *   - `dispose()` — tear everything down: remove DOM, detach 3D, unsubscribe
 *     from the bus. Called by Game before mounting the next Scene.
 *
 * `SceneContext` is the bundle of persistent, page-lifetime resources every
 * Scene may need. Built fresh by Game on each swap so `ctx.run` reflects the
 * current run (the field gets replaced on reset). Scenes that need
 * scene-specific arguments (recruit offer, gameover variant) take them via
 * their constructor.
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
  /** D3: BattleScene calls `renderer.fitToBoard(gridW, gridH)` per encounter so
   *  the camera frames variable-size arenas. Non-battle scenes ignore it. */
  readonly renderer: Renderer;
  readonly sprites: SpriteRenderer;
  readonly overlays: UnitOverlayLayer;
  readonly terrain: TerrainRenderer;
  /** M4 — the backdrop apron ring around the playable board. BattleScene
   *  feeds it the same tile grid as `terrain`; non-battle scenes ignore it
   *  (it clears alongside terrain on battle dispose). */
  readonly apron: ApronRenderer;
  /** M4 — the mist floor the apron dissolves into. Encounter-independent
   *  scenery; BattleScene only drives its uTime. */
  readonly backdrop: BackdropRenderer;
  readonly fontAtlas: FontAtlas;
  readonly uiMount: HTMLElement;
  /** The control column's second row (src/ui/chip.ts): a scene whose screen
   *  owns a top-right control (Roster, Leave port, the speed strip) hands it
   *  this to mount the control into. */
  readonly controlSlot: HTMLElement;
  readonly dispatcher: RunDispatcher;
  /** 63e — NULL exactly when no Run exists yet (the menu and the
   *  CharacterSelectScene mount before Run construction). Every other
   *  scene asserts via `requireRun(ctx)` at mount — the compiler makes each
   *  scene say whether it can run pre-Run (the kickoff shape-lock). */
  readonly run: Run | null;
  /** The run's journal as Game holds it now (`Game.currentJournal`): the one
   *  being recorded, or the finished one once the run has ended; null with
   *  no run. A function, because the journal of a run that just ended closes
   *  after the end screen has mounted. */
  readonly journal: () => RunJournal | null;
  /** 115g — the saved run, as the menu asks after it. Functions, read when
   *  the screen is drawn. */
  readonly save: SaveContext;
  /** 116c — the menu's routes: where a run's end goes, New run and Back. */
  readonly menu: MenuContext;
  /** 117e — the Escalation unlocks, as character select and the end screen
   *  ask after them. */
  readonly escalation: EscalationContext;
  readonly audio: AudioPlayer;
  /** I3 — the page-lifetime fast-forward speed. BattleScene reads `current`
   *  live each tick to scale `dt`; the HUD button + hotkey cycle it. Persists
   *  across scene swaps (set-and-forget), so it lives here, not on the Scene. */
  readonly playback: PlaybackSpeed;
  /** J3 — the page-lifetime rebindable-hotkey registry. The HUD subscribes its
   *  battle-scoped handlers (fast-forward + the objective controls) on mount
   *  and tears them down on dispose; a rebind persists across scenes. */
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
 * 116c — the menu's side of the game. These are routes between two screens
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
  /** 116d — the menu's Settings row: open the settings modal, the one the
   *  chip opens during a run (src/ui/SettingsOverlay.ts). */
  openSettings(): void;
  /** 116j — the menu's Credits row: open the credits panel
   *  (src/ui/CreditsOverlay.ts). */
  openCredits(): void;
}

/**
 * 117e — what a screen may know of the Escalation unlocks (the store's
 * progress, src/store/progress.ts). The screens never read the store.
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

/** 63e — assert the context carries a live Run (every scene except the
 *  MenuScene and the CharacterSelectScene). A null here is a Game sequencing
 *  bug — a run-dependent scene mounted before select confirmed — so throw
 *  loud. */
export function requireRun(ctx: SceneContext): Run {
  if (ctx.run === null) {
    throw new Error('Scene requires a live Run, but none exists yet (pre-select boot)');
  }
  return ctx.run;
}
