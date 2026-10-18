/**
 * BattleScene owns one battle: the World and its clock, the BattleRenderer,
 * the HUD, the objective controller and the pre-battle countdown. It reads
 * the encounter from `ctx.run.currentEncounter`, which `Run.beginTurn` sets
 * before it emits `battle:started`, on which Game mounts this scene.
 *
 * Mount order matters: the HUD's `show` and the BattleRenderer's `attach`
 * run before the teams spawn, so their `unit:spawned` handlers find the
 * world bound, and the terrain goes in before the teams, so the spawn
 * regions are clear of scenery.
 */

import { Clock } from '../core/Clock';
import { RNG } from '../core/RNG';
import { World } from '../sim/World';
import { applyTerrain, pickSpawnRegions, setupRngFor, spawnTeam } from '../sim/battleSetup';
import { BattleRenderer, gridToWorld } from '../render/BattleRenderer';
import type { TerrainRenderer } from '../render/TerrainRenderer';
import type { ApronRenderer } from '../render/ApronRenderer';
import type { BackdropRenderer } from '../render/BackdropRenderer';
import { HUD } from '../ui/HUD';
import { ObjectiveController } from '../ui/ObjectiveController';
import type { PlaybackSpeed } from '../ui/PlaybackSpeed';
import { TICK_RATE, secondsToTicks } from '../config';
import { HEALTH } from '../config/health';
import { PLAYBACK } from '../config/playback';
import { getLayout, type Theme } from '../sim/layouts';
import { t } from '../i18n/ui';
import { PreBattleCountdown } from './PreBattleCountdown';
import { requireRun, type Scene, type SceneContext } from './Scene';
import { reducedMotion } from '../render/motion';

/** The theme as the banner's suffix shows it: themes are stored lowercase
 *  (`grassland`, `volcanic`, …), and the suffix reads as a proper noun. */
function titleCaseTheme(theme: Theme): string {
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

// The turn's cap, `maxTurnSeconds` in ticks, as the fuzz harness has it: a
// turn that reaches it undecided is resolved as a draw (the clock's callback
// below).
const MAX_TURN_TICKS = secondsToTicks(HEALTH.maxTurnSeconds);

export class BattleScene implements Scene {
  private clock: Clock | null = null;
  private world: World | null = null;
  private battleRenderer: BattleRenderer | null = null;
  private hud: HUD | null = null;
  /** Held only so `dispose` can clear the terrain's per-tile state — the
   *  renderer itself is page-lifetime and owned by Game. */
  private terrain: TerrainRenderer | null = null;
  /** Held, as `terrain` is, so `dispose` can clear the ring and `tick` can
   *  drive its fog. */
  private apron: ApronRenderer | null = null;
  /** The mist floor: a battle drives only its time, so nothing is cleared on
   *  dispose. */
  private backdrop: BackdropRenderer | null = null;
  /** The page-lifetime playback speed (from ctx), read each tick so a change
   *  mid-battle takes effect the next frame. */
  private playback: PlaybackSpeed | null = null;
  /** The objective input (`ObjectiveController`): a left click sets Engage,
   *  a right click Focus, and a left click after an arm sets the armed mode.
   *  Disposed with the battle, so its canvas listeners do not outlive it. */
  private objective: ObjectiveController | null = null;
  /** The pre-battle countdown: the sim's clock stays parked while the player
   *  reads the board and sets orders, then the fight starts. Counted in real
   *  time, so a speed-up cannot shorten it; the world starts ticking later,
   *  and its tick sequence is unchanged. Null between battles; built at
   *  mount. */
  private countdown: PreBattleCountdown | null = null;

  /** The after-turn outro's own settle: resolves once the HUD's loss orbs
   *  have landed, the ghost has committed and the settle beat has passed,
   *  which under the survivors rule can run past the fixed outro. Game
   *  waits for the longer of this and `TURN_OUTRO_MS`, then sends the
   *  turn's advance. Resolved at once with no battle up. */
  outro(): Promise<void> {
    return this.hud?.lossesSettled() ?? Promise.resolve();
  }

  mount(ctx: SceneContext): void {
    const run = requireRun(ctx);
    const encounter = run.currentEncounter;
    if (!encounter) {
      throw new Error('BattleScene.mount: no Run encounter');
    }

    this.world = new World(ctx.bus, new RNG(encounter.worldSeed), encounter.gridW, encounter.gridH);
    // The turn's battle rules, as `Run.beginTurn` compiled them; the fuzz
    // harness installs them the same way.
    this.world.installBattleRules(encounter.battleRules ?? []);
    this.clock = new Clock(TICK_RATE, () => {
      const w = this.world;
      if (!w || w.ended) return;
      w.tick();
      // The turn's cap. `resolveAsDraw` does nothing once the battle has
      // ended, so a tick that ends it naturally cannot resolve it twice.
      if (!w.ended && w.currentTick >= MAX_TURN_TICKS) w.resolveAsDraw();
    });
    this.battleRenderer = new BattleRenderer(
      ctx.sprites,
      ctx.overlays,
      ctx.terrain,
      ctx.renderer,
      ctx.audio,
      ctx.bus,
    );
    this.playback = ctx.playback;
    // The objective controller takes the World (to queue its commands and read
    // the enemies' places) and the Renderer (its canvas listeners and the
    // screen-to-cell pick). It is built before the HUD, whose buttons and
    // hotkeys drive it, and the HUD shows its armed state through
    // `onArmedChange`. Its billboard providers read the BattleRenderer's live
    // sprite positions, so a click hits the glyph on screen.
    this.objective = new ObjectiveController(
      this.world,
      ctx.renderer,
      ctx.terrain,
      () => this.battleRenderer?.enemyBillboards() ?? [],
      // Destructible neutrals are click targets too, so a manual Engage or
      // Focus can order an attack on one.
      () => this.battleRenderer?.destructibleBillboards() ?? [],
    );
    this.hud = new HUD(
      ctx.uiMount,
      ctx.bus,
      ctx.playback,
      ctx.keybindings,
      this.objective,
      ctx.audio,
      ctx.controlSlot,
    );
    this.objective.onArmedChange = (mode) => this.hud?.setObjectiveArmed(mode);

    // Battle audio subscribes nothing here. A keyed attack or status cue (one
    // fx key, its visual and its sound) plays through the FX registry, driven
    // by the BattleRenderer off `action:phase`, so a miss plays its whoosh
    // too. The cues with no fx key (a death, the ability heal, the dash's
    // leap) are rows of src/audio/eventSounds.ts, which Game attaches once.

    // The banner: the layout's name, or `map.uncharted` for a procedural
    // board (the pre-turn screen's map line reads the same string), with the
    // theme after it ("Corridor — Volcanic") unless it is `grassland`, the
    // baseline look.
    const locationName =
      encounter.layoutId === null
        ? t('map.uncharted')
        : (getLayout(encounter.layoutId)?.name ?? encounter.layoutId);
    const bannerText =
      encounter.theme === 'grassland'
        ? locationName
        : `${locationName} — ${titleCaseTheme(encounter.theme)}`;
    // The pools as they stand before this turn is charged, and the turn being
    // fought (`turnIndex` counts the resolved turns).
    this.hud.show(this.world, run.currentHop, bannerText, {
      turn: run.turnIndex + 1,
      playerHealth: run.playerHealth,
      playerHealthMax: HEALTH.playerHealthMax,
      enemyHealth: run.enemyHealth,
      enemyHealthMax: run.enemyHealthPoolMax,
      ...(run.currentEncounterName ? { enemyName: run.currentEncounterName } : {}),
      // The notch on each gauge: the player's bound is the risk line's
      // number, the enemy's the fielded wave's.
      ...(() => {
        const bounds = run.previewPoolsAtRisk();
        return { poolAtRisk: bounds.player, enemyPoolAtRisk: bounds.enemy };
      })(),
    });
    this.battleRenderer.attach(this.world);
    const spawnRegions = applyTerrain(this.world, encounter);
    // The terrain renderer draws the tile grid. Walls draw as sprites (they
    // are neutral units), each at its tile's height, which the BattleRenderer
    // reads from `terrain.heightAt`.
    ctx.terrain.setTiles(this.world.tileGrid, this.world.gridW, this.world.gridH, encounter.theme);
    this.terrain = ctx.terrain;
    // The apron continues the board outward, clamping at its edge tiles, and
    // fades into the mist: the board mesh's grid and theme, in tiles the sim
    // never sees.
    ctx.apron.setTiles(this.world.tileGrid, this.world.gridW, this.world.gridH, encounter.theme);
    this.apron = ctx.apron;
    this.backdrop = ctx.backdrop;
    ctx.renderer.fitToBoard(this.world.gridW, this.world.gridH);

    // One setup stream picks each team's region and shuffles its tiles, the
    // stream `spawnEncounter` draws for the fuzz harness and the replays, so
    // they place the teams as this scene does.
    const setupRng = setupRngFor(encounter);
    const { player: playerRegion, enemy: enemyRegion } = pickSpawnRegions(spawnRegions, setupRng);

    // Anchor the scroll-mode camera on the centre of the player's spawn
    // region, converted through `gridToWorld` into the world space the
    // renderer pans. Fit mode does not show it, but the target is kept across
    // the dev chord's mode toggle (Ctrl+Alt+C); the renderer clamps it to the
    // board.
    let sumX = 0;
    let sumY = 0;
    for (const t of playerRegion.tiles) {
      sumX += t.x;
      sumY += t.y;
    }
    const meanX = sumX / playerRegion.tiles.length;
    const meanY = sumY / playerRegion.tiles.length;
    const anchor = gridToWorld({ x: meanX, y: meanY }, this.world.gridW, this.world.gridH);
    ctx.renderer.setCameraTarget(anchor.x, anchor.z);

    spawnTeam(this.world, 'player', encounter.playerTeam, playerRegion, setupRng);
    spawnTeam(this.world, 'enemy', encounter.enemyTeam, enemyRegion, setupRng);

    // Open the countdown: the units are placed, the board is readable, and the
    // sim is parked while the player sets orders. Pausing `playback` lets the
    // pause control double as Fight now: resuming it (Space, the ▶ button, a
    // speed button) is the skip `tick` watches for.
    this.countdown = new PreBattleCountdown(PLAYBACK.countdownSeconds);
    this.playback?.pause();
  }

  tick(dt: number): void {
    // While the sim is parked (the countdown, or a pause) it never reaches the
    // command drain at the top of a tick, so queued orders are applied here,
    // and an objective's marker shows when it is issued. No unit acts while
    // parked, so this is the same as draining at the next tick.
    if (this.countdown?.active || this.playback?.isPaused) this.world?.drainCommands();

    // Held (the settings modal is up over the battle): everything below
    // stands still. After the countdown that needs nothing here, since
    // `playback.current` reads 0 while held; the countdown runs on real time,
    // so it is stopped by hand.
    const held = this.playback?.isHeld === true;

    // The countdown: the sim is parked and only the visuals advance, on real
    // time, so a speed-up cannot shorten it.
    if (this.countdown?.active) {
      // The countdown's own frame time: none while held, so the readout, the
      // sprites and the shaders all stand still with it.
      const countdownDt = held ? 0 : dt;
      this.countdown.advance(countdownDt);
      // Fight now: a resumed playback (the pause control, a speed button) is
      // the skip, so there is no hotkey of its own to fire twice.
      if (!held && this.playback && this.playback.pauseEnabled && !this.playback.isPaused) {
        this.countdown.skip();
      }
      if (this.countdown.active) {
        // Still counting: paint the readout and advance the visuals.
        // `refreshStatuses` runs here as on the running path, so a seeded
        // status or an empower shows during the countdown (the HUD's tick
        // gate makes it a no-op after the first pass), and before
        // `showCountdown`, whose first measure reads the enemy pane's bottom,
        // which these rows are part of.
        this.hud?.refreshStatuses();
        this.hud?.showCountdown(this.countdown.displaySeconds);
        this.battleRenderer?.update(countdownDt);
        this.advanceShaderTime(countdownDt);
      } else {
        // Just ended, by expiry or skip: start the sim at the selected speed
        // and clear the readout. The first tick lands next frame; this frame's
        // leftover `dt`, at most one frame, is dropped, and the tick sequence
        // is unchanged.
        this.playback?.resume();
        this.hud?.hideCountdown();
      }
      return;
    }
    // The speed scales the frame's `dt` for everything in the battle (the
    // sim's clock, the render animations, the shaders), so the scene stays
    // coherent at 2× and 3×. The clock still fires whole fixed ticks, so a
    // speed changes how many land in a frame, not the tick sequence or its
    // rolls.
    const dtScaled = dt * (this.playback?.current ?? 1);
    this.clock?.advance(dtScaled);
    this.battleRenderer?.update(dtScaled);
    // The compact cards' status rows, which the HUD repaints only when the
    // sim's tick has moved.
    this.hud?.refreshStatuses();
    this.advanceShaderTime(dtScaled);
  }

  /**
   * Advance the shaders' `uTime` on the battle's scaled time: the board's
   * fire flicker and healing pulse, the apron's fog creep and the mist
   * floor's drift. It runs from `tick` and not the renderer's loop, since
   * only a battle puts animated tiles on the board, and the terrain is
   * cleared when the battle scene goes.
   *
   * The one gate for shader motion: under reduced motion the time holds, so
   * every `uTime`-driven motion (the fire, the healing shimmer, the mist, the
   * fog, deep water's bands) stops at once in all three shaders, with no
   * uniform and no shader branch. The gate is read each frame, so the dev
   * chord (Ctrl+Alt+A) flips it live.
   */
  private advanceShaderTime(dt: number): void {
    const d = reducedMotion() ? 0 : dt;
    this.terrain?.advanceTime(d);
    this.apron?.advanceTime(d);
    this.backdrop?.advanceTime(d);
  }

  dispose(): void {
    this.objective?.dispose();
    this.battleRenderer?.detach();
    this.battleRenderer?.dispose();
    this.hud?.dispose();
    // Clear the battle's tiles, so the next scene is not drawn over a stale
    // board.
    this.terrain?.clear();
    this.apron?.clear();
    this.battleRenderer = null;
    this.hud = null;
    this.objective = null;
    this.world = null;
    this.clock = null;
    this.terrain = null;
    this.apron = null;
    this.backdrop = null;
    // A swap mid-countdown must not leave the page-lifetime playback paused.
    // Otherwise the countdown's end has resumed it, and this does nothing.
    this.playback?.resume();
    this.playback = null;
    this.countdown = null;
  }
}
