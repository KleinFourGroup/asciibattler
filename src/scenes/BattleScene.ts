/**
 * BattleScene (A5). Owns the per-battle ensemble: World, BattleRenderer, HUD,
 * and the simulation Clock. Reads the encounter from `ctx.run.currentEncounter`
 * — Run has already announced `battle:started` by the time Game constructs
 * this scene, so the encounter is guaranteed present.
 *
 * Mount order matters: HUD.show and BattleRenderer.attach must both run
 * BEFORE spawnTeam, so their `unit:spawned` handlers find the world bound.
 * Same ordering rule the pre-A5 Game.beginBattle observed.
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
import { getLayout, PROCEDURAL_MAP_NAME, type Theme } from '../sim/layouts';
import { PreBattleCountdown } from './PreBattleCountdown';
import type { Scene, SceneContext } from './Scene';

/** D8 — banner suffix helper. The theme enum stores lowercase
 *  (default / rock / volcanic); the banner wants Title Case so the
 *  suffix reads as a proper noun. */
function titleCaseTheme(theme: Theme): string {
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

// N2 — the per-turn tick cap, the SAME single source as the fuzz harness + arena
// (`config/health.json` maxTurnSeconds via the TICK_RATE contract). A live turn
// that reaches it without a decisive end is force-resolved as a DRAW rather than
// ticking forever — the driver wiring `World.resolveAsDraw` was always meant to
// have (the headless harness already did this; the live game never did until now,
// so a true stall used to soft-lock the battle).
const MAX_TURN_TICKS = secondsToTicks(HEALTH.maxTurnSeconds);

export class BattleScene implements Scene {
  private clock: Clock | null = null;
  private world: World | null = null;
  private battleRenderer: BattleRenderer | null = null;
  private hud: HUD | null = null;
  /** Held only so `dispose` can clear the terrain's per-tile state — the
   *  renderer itself is page-lifetime and owned by Game. */
  private terrain: TerrainRenderer | null = null;
  /** M4 — same holding pattern as `terrain`: page-lifetime renderer, held
   *  so `dispose` can clear the ring and `tick` can drive its fog creep. */
  private apron: ApronRenderer | null = null;
  /** M4 — the mist floor; battle-time only drives its uTime (no per-
   *  encounter content, so no clear on dispose). */
  private backdrop: BackdropRenderer | null = null;
  /** I3 — the page-lifetime fast-forward controller (from ctx). Read live in
   *  `tick` so a mid-battle speed change takes effect next frame. */
  private playback: PlaybackSpeed | null = null;
  /** J3 — the objective input controller (canvas right-click / armed left-click
   *  → setObjective/clearObjective commands). Battle-scoped; torn down in
   *  dispose so its canvas listeners don't outlive the battle. */
  private objective: ObjectiveController | null = null;
  /** Q2 — the pre-battle countdown (replaces the M3 materialize hold): the sim
   *  clock stays parked while the player reads the board + sets orders, then the
   *  fight starts. Counted in REAL dt (a fast-forward speed can't shorten it —
   *  and the sim is paused during it anyway). Render-only: the world just starts
   *  ticking later — the tick sequence itself is untouched. Null between
   *  battles; built fresh on mount. */
  private countdown: PreBattleCountdown | null = null;
  private readonly subscriptions: Array<() => void> = [];

  mount(ctx: SceneContext): void {
    const encounter = ctx.run.currentEncounter;
    if (!encounter) {
      throw new Error('BattleScene.mount: no Run encounter');
    }

    this.world = new World(
      ctx.bus,
      new RNG(encounter.worldSeed),
      encounter.gridW,
      encounter.gridH,
    );
    this.clock = new Clock(TICK_RATE, () => {
      const w = this.world;
      if (!w || w.ended) return;
      w.tick();
      // N2 — enforce the per-turn cap: a turn that runs to the budget without a
      // decisive end force-resolves as a DRAW (chips both pools; the run rolls on
      // through the post-turn screen) instead of ticking forever. resolveAsDraw is
      // a no-op once ended, so a tick that races a natural end can't double-resolve.
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
    // J3 — the objective controller needs the World (to enqueue commands + read
    // enemy positions) and the Renderer (canvas listeners + screen→cell pick).
    // Built before the HUD so the HUD's buttons/hotkeys can drive it; the HUD
    // reflects its armed state back via onArmedChange.
    // The enemy-billboard provider reads the BattleRenderer's LIVE sprite
    // positions (created just above), so the click hit-test matches the glyph
    // on screen. Null-guarded for the brief window before/after a battle.
    this.objective = new ObjectiveController(
      this.world,
      ctx.renderer,
      ctx.terrain,
      () => this.battleRenderer?.enemyBillboards() ?? [],
    );
    this.hud = new HUD(ctx.uiMount, ctx.bus, ctx.playback, ctx.keybindings, this.objective);
    this.objective.onArmedChange = (mode) => this.hud?.setObjectiveArmed(mode);

    // B6 audio: per-battle subscriptions for the non-keyed combat sounds.
    // Lives here rather than Game so it tears down with the world.
    //
    // §Z — every KEYED attack cue (one FxKey → visual + sound) now rides the FX
    // registry, driven by BattleRenderer off `action:phase`: the mage bolt's
    // `magicboom` + the catapult's `shoot` (Z1), and — as of Z3 — the melee
    // swing's `melee` + the bow's `shoot` whoosh. Driving the whoosh off the
    // phase event means a MISS plays it for free (the phase fires on hit AND
    // miss), so the old `unit:attacked` / `unit:missed` audio handlers (which
    // inferred melee-vs-ranged from the attacker's range) are gone. What stays
    // here is the per-event sounds with no fx key: death, fire/heal tile chips,
    // and the dash leap.
    //
    // C1b: skip neutral-team deaths — walls have HP plumbed but the
    // generic combat death cry would read as a unit dying rather than a
    // wall crumbling. When C2's AoE damage actually lands wall hits, swap
    // this for a dedicated `wall_destroyed` sample.
    this.subscriptions.push(
      ctx.bus.on('unit:died', ({ team }) => {
        if (team === 'neutral') return;
        ctx.audio.play('death');
      }),
      // 27d/27e — the fire-tile burn SFX re-homed off the retired `unit:burned`
      // onto the `burn` status's tick fx (one FxKey = visual + sound, the §Z
      // model); BattleRenderer's status-fx driver plays it. Likewise the
      // healing-tile chip-heal sound now rides the `rejuvenate` tick fx.
      // D7.C — the ABILITY-heal cue stays here on `unit:healed` (the heal
      // mechanic's own event). Skip amount === 0 (a heal onto a full unit emits
      // a no-op per gotcha #80; a sound on a zero-effect event would feel buggy).
      ctx.bus.on('unit:healed', ({ amount }) => {
        if (amount <= 0) return;
        ctx.audio.play('healtick');
      }),
      // N1 — the rogue dash whoosh, off the first-class `unit:dashed` (mirrors
      // the swap cue). Keying off the LEAP itself — not an inferred move
      // distance — means a one-cell dash (closing on an enemy 2 cells away, which
      // lands adjacent) still whooshes. Team-agnostic: anything that leaps fires it.
      ctx.bus.on('unit:dashed', () => {
        ctx.audio.play('dash');
      }),
    );

    // HUD and BattleRenderer must be bound BEFORE any spawn so unit:spawned
    // handlers find the world. Terrain comes before teams so the spawn
    // tiles are guaranteed clear (walls + water never land on them per
    // the D5 schema in src/config/layouts.ts and the procedural mask in
    // src/sim/terrainGen.ts).
    //
    // C1d follow-up: resolve the encounter's layoutId to a display name for
    // the top banner. Procedural encounters (layoutId === null) read as the
    // shared PROCEDURAL_MAP_NAME (R3: one constant, so the banner + the
    // pre-turn map line can't drift — was "Nowhere" here).
    // D8: append the theme as a banner suffix (e.g. "Corridor — Volcanic")
    // so the visual reskin reads as deliberate flavor, not a bug. The
    // `default` theme is the canonical look — no suffix added, to keep
    // the banner clean when the palette is the baseline.
    const locationName =
      encounter.layoutId === null
        ? PROCEDURAL_MAP_NAME
        : (getLayout(encounter.layoutId)?.name ?? encounter.layoutId);
    const bannerText =
      encounter.theme === 'default'
        ? locationName
        : `${locationName} — ${titleCaseTheme(encounter.theme)}`;
    // H4b — surface the encounter pools + the turn being fought. `turnIndex`
    // counts RESOLVED turns, so the current turn is +1. Pools are this turn's
    // pre-chip state (they chip on the post-turn screen).
    this.hud.show(this.world, ctx.run.currentHop, bannerText, {
      turn: ctx.run.turnIndex + 1,
      playerHealth: ctx.run.playerHealth,
      playerHealthMax: HEALTH.playerHealthMax,
      enemyHealth: ctx.run.enemyHealth,
      // U3 — per-encounter pool max + name (replaces the global enemyHealthMax /
      // the hardcoded "Foe").
      enemyHealthMax: ctx.run.enemyHealthPoolMax,
      ...(ctx.run.currentEncounterName ? { enemyName: ctx.run.currentEncounterName } : {}),
    });
    this.battleRenderer.attach(this.world);
    const spawnRegions = applyTerrain(this.world, encounter);
    // After terrain is in place, the terrain renderer reflects the tile
    // grid. Walls render via SpriteRenderer (they're neutral-team Units),
    // and their per-tile Y is picked up via `terrain.heightAt` inside
    // BattleRenderer.
    ctx.terrain.setTiles(
      this.world.tileGrid,
      this.world.gridW,
      this.world.gridH,
      encounter.theme,
    );
    this.terrain = ctx.terrain;
    // M4 — the backdrop apron continues the board outward (clamp-to-edge
    // tile sampling) and fog-fades it into the void. Same grid + theme as
    // the board mesh; the sim never sees these tiles.
    ctx.apron.setTiles(
      this.world.tileGrid,
      this.world.gridW,
      this.world.gridH,
      encounter.theme,
    );
    this.apron = ctx.apron;
    this.backdrop = ctx.backdrop;
    // D3 — frame the camera to whatever rectangle this encounter rolled
    // (procedural sizes range up to 20×20; hand-authored up to 32×32).
    ctx.renderer.fitToBoard(this.world.gridW, this.world.gridH);

    // D5 — pick a region for each team off the same fork the fuzz
    // harness uses, then place units one per shuffled tile within
    // their region.
    const setupRng = setupRngFor(encounter);
    const { player: playerRegion, enemy: enemyRegion } = pickSpawnRegions(
      spawnRegions,
      setupRng,
    );

    // D5.E — anchor the scroll-mode camera on the centroid of the
    // player's rolled spawn region (replaces D4's `(0, gridH/2 - 2)`
    // legacy heuristic from the row-formation era). Region tiles are
    // grid coords; convert the mean through `gridToWorld` so the anchor
    // lands in the same world-XZ space the renderer pans. fit mode
    // ignores this visually, but the target is preserved across the
    // backtick toggle. Renderer.clampCameraTarget caps to the board.
    let sumX = 0;
    let sumY = 0;
    for (const t of playerRegion.tiles) {
      sumX += t.x;
      sumY += t.y;
    }
    const meanX = sumX / playerRegion.tiles.length;
    const meanY = sumY / playerRegion.tiles.length;
    const anchor = gridToWorld(
      { x: meanX, y: meanY },
      this.world.gridW,
      this.world.gridH,
    );
    ctx.renderer.setCameraTarget(anchor.x, anchor.z);

    spawnTeam(this.world, 'player', encounter.playerTeam, playerRegion, setupRng);
    spawnTeam(this.world, 'enemy', encounter.enemyTeam, enemyRegion, setupRng);

    // Q2 — open the pre-battle countdown: the combatants are placed (instantly,
    // no materialize fade now), the board is fully readable, and the sim is
    // parked while the player sets orders. Pausing `playback` is what makes the
    // unified pause key double as "Fight now" — resuming (Space / the ▶ button /
    // a speed button) is the skip signal `tick` watches for. See `tick`.
    this.countdown = new PreBattleCountdown(PLAYBACK.countdownSeconds);
    this.playback?.pause();
  }

  tick(dt: number): void {
    // Q2 — while the sim is PARKED (the pre-battle countdown or a mid-battle
    // pause) it never reaches the top-of-tick command drain, so apply any queued
    // player orders here. That's what makes an objective's X marker appear the
    // moment it's issued instead of only when the sim resumes — no unit acts
    // while parked, so it's observably identical to draining at the next tick.
    if (this.countdown?.active || this.playback?.isPaused) this.world?.drainCommands();

    // Q2 — the pre-battle countdown. While it holds, the sim is parked and only
    // the visuals advance, at REAL dt (a fast-forward can't shorten the window).
    if (this.countdown?.active) {
      this.countdown.advance(dt);
      // Fight now: the unified pause control / a speed button resumed playback —
      // that unpause is the skip signal (no separate hotkey, no double-fire).
      if (this.playback && this.playback.pauseEnabled && !this.playback.isPaused) {
        this.countdown.skip();
      }
      if (this.countdown.active) {
        // Still counting: paint the readout + advance visuals only.
        this.hud?.showCountdown(this.countdown.displaySeconds);
        this.battleRenderer?.update(dt);
        this.terrain?.advanceTime(dt);
        this.apron?.advanceTime(dt);
        this.backdrop?.advanceTime(dt);
      } else {
        // Just ended (expiry or skip): start the sim at the selected speed and
        // clear the readout. The sim's first tick lands NEXT frame — this
        // boundary frame's leftover dt is dropped (≤ one frame, invisible), the
        // same M3 rule that kept the parked-hold determinism-clean.
        this.playback?.resume();
        this.hud?.hideCountdown();
      }
      return;
    }
    // I3 — fast-forward. Scale the real frame `dt` by the active speed and feed
    // it to EVERYTHING in the battle (sim clock + render animations + terrain
    // shader) so the whole scene stays visually coherent at 2×/3×. Determinism
    // is preserved: the Clock still fires whole fixed-timestep ticks — scaling
    // `dt` only changes how many tick()s land per frame, not the tick sequence
    // or its RNG (a tick-batch, not a TICK_RATE change). Read live so a
    // mid-battle cycle takes effect immediately.
    const dtScaled = dt * (this.playback?.current ?? 1);
    this.clock?.advance(dtScaled);
    this.battleRenderer?.update(dtScaled);
    // D7.C: drive the terrain shader's `uTime` for per-tile fire flicker
    // and healing pulse. Lives on tick (not the rAF loop) because only
    // BattleScene puts animated tile kinds into the renderer — non-battle
    // scenes call terrain.clear() and don't need the animation to advance.
    this.terrain?.advanceTime(dtScaled);
    // M4 — the apron's fog creep (and any clamp-extended fire/healing
    // flicker) + the mist floor's drift ride the same scaled time as the
    // board's tile animation.
    this.apron?.advanceTime(dtScaled);
    this.backdrop?.advanceTime(dtScaled);
  }

  dispose(): void {
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
    this.objective?.dispose();
    this.battleRenderer?.detach();
    this.battleRenderer?.dispose();
    this.hud?.dispose();
    // Drop the terrain's per-battle tile visuals so the next non-battle
    // scene (map / recruit / gameover) isn't painting stale terrain under
    // nothing.
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
    // Q2 — never leave the page-lifetime playback stuck paused if the scene
    // tears down mid-countdown (an abnormal swap; the normal path already
    // resumed when the countdown ended). No-op when already running.
    this.playback?.resume();
    this.playback = null;
    this.countdown = null;
  }
}
