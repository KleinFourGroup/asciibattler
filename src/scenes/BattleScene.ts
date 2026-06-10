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
import { HUD } from '../ui/HUD';
import { ObjectiveController } from '../ui/ObjectiveController';
import type { PlaybackSpeed } from '../ui/PlaybackSpeed';
import { TICK_RATE } from '../config';
import { HEALTH } from '../config/health';
import { getLayout, type Theme } from '../sim/layouts';
import type { Scene, SceneContext } from './Scene';

/** D8 — banner suffix helper. The theme enum stores lowercase
 *  (default / rock / volcanic); the banner wants Title Case so the
 *  suffix reads as a proper noun. */
function titleCaseTheme(theme: Theme): string {
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

export class BattleScene implements Scene {
  private clock: Clock | null = null;
  private world: World | null = null;
  private battleRenderer: BattleRenderer | null = null;
  private hud: HUD | null = null;
  /** Held only so `dispose` can clear the terrain's per-tile state — the
   *  renderer itself is page-lifetime and owned by Game. */
  private terrain: TerrainRenderer | null = null;
  /** I3 — the page-lifetime fast-forward controller (from ctx). Read live in
   *  `tick` so a mid-battle speed change takes effect next frame. */
  private playback: PlaybackSpeed | null = null;
  /** J3 — the objective input controller (canvas right-click / armed left-click
   *  → setObjective/clearObjective commands). Battle-scoped; torn down in
   *  dispose so its canvas listeners don't outlive the battle. */
  private objective: ObjectiveController | null = null;
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
    this.clock = new Clock(TICK_RATE, () => this.world?.tick());
    this.battleRenderer = new BattleRenderer(
      ctx.sprites,
      ctx.overlays,
      ctx.terrain,
      ctx.renderer.camera,
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
    this.objective.onArmedChange = (armed) => this.hud?.setObjectiveArmed(armed);

    // B6 audio: per-battle subscriptions that need the World to look up
    // the attacker's archetype (attackRange<=1 → melee, else ranged).
    // Lives here rather than Game so it tears down with the world.
    //
    // C1b: skip neutral-team deaths — walls have HP plumbed but the
    // generic combat death cry would read as a unit dying rather than a
    // wall crumbling. When C2's AoE damage actually lands wall hits, swap
    // this for a dedicated `wall_destroyed` sample.
    this.subscriptions.push(
      ctx.bus.on('unit:attacked', ({ attackerId }) => {
        const attacker = this.world?.findUnit(attackerId);
        if (!attacker) return;
        // E7.C/E7.D — the mage's bolt and the catapult's shot each play one
        // sound off their own dedicated event (below), not the per-hit
        // `unit:attacked`. For the mage that avoids multishot audio (one event
        // per AoE victim); for the catapult the event also fires on an aborted
        // shot where no `unit:attacked` exists.
        if (attacker.archetype === 'mage' || attacker.archetype === 'catapult') return;
        ctx.audio.play(attacker.derived.attackRange <= 1 ? 'melee' : 'shoot');
      }),
      // I2 — a dodged strike still played its swing/shot, so it makes the SAME
      // sound as a connecting one (the "whoosh" is the attack, not the impact).
      // Only single-target strikes emit `unit:missed` (mage/catapult are
      // unmissable), so the same melee/ranged branch applies; the archetype
      // guard mirrors the hit path defensively.
      ctx.bus.on('unit:missed', ({ attackerId }) => {
        const attacker = this.world?.findUnit(attackerId);
        if (!attacker) return;
        if (attacker.archetype === 'mage' || attacker.archetype === 'catapult') return;
        ctx.audio.play(attacker.derived.attackRange <= 1 ? 'melee' : 'shoot');
      }),
      // E7.C — one sound per mage bolt cast (fires even on a whiff), matching
      // the single projectile + explosion visual.
      ctx.bus.on('magic:detonated', () => {
        ctx.audio.play('magicboom');
      }),
      // E7.D — one sound per catapult shot, fired on hit AND abort (so a
      // fizzle still thunks), matching the single arcing-projectile visual.
      // Reuses `shoot` for now — a dedicated catapult SFX is a later polish.
      ctx.bus.on('catapult:fired', () => {
        ctx.audio.play('shoot');
      }),
      ctx.bus.on('unit:died', ({ team }) => {
        if (team === 'neutral') return;
        ctx.audio.play('death');
      }),
      // D7.C — fire chip damage. The sim emits unit:burned regardless of
      // whether the unit died from the same tick's damage; ordering is
      // fine because the audio fires before the death's `unit:died`
      // sound, so both land in the same tick like a "burn → death cry"
      // sequence.
      ctx.bus.on('unit:burned', () => {
        ctx.audio.play('burn');
      }),
      // D7.C — healing tile chip heal. Skip when amount === 0 (the sim
      // emits a no-op heal each cadence tick on a maxHp unit per gotcha
      // #80; playing a sound for a zero-effect event would feel buggy).
      ctx.bus.on('unit:healed', ({ amount }) => {
        if (amount <= 0) return;
        ctx.audio.play('healtick');
      }),
    );

    // HUD and BattleRenderer must be bound BEFORE any spawn so unit:spawned
    // handlers find the world. Terrain comes before teams so the spawn
    // tiles are guaranteed clear (walls + water never land on them per
    // the D5 schema in src/config/layouts.ts and the procedural mask in
    // src/sim/terrainGen.ts).
    //
    // C1d follow-up: resolve the encounter's layoutId to a display name for
    // the top banner. Procedural encounters (layoutId === null) read as
    // "Nowhere" — no hand-authored location, no name.
    // D8: append the theme as a banner suffix (e.g. "Corridor — Volcanic")
    // so the visual reskin reads as deliberate flavor, not a bug. The
    // `default` theme is the canonical look — no suffix added, to keep
    // the banner clean when the palette is the baseline.
    const locationName =
      encounter.layoutId === null
        ? 'Nowhere'
        : (getLayout(encounter.layoutId)?.name ?? encounter.layoutId);
    const bannerText =
      encounter.theme === 'default'
        ? locationName
        : `${locationName} — ${titleCaseTheme(encounter.theme)}`;
    // H4b — surface the encounter pools + the turn being fought. `turnIndex`
    // counts RESOLVED turns, so the current turn is +1. Pools are this turn's
    // pre-chip state (they chip on the post-turn screen).
    this.hud.show(this.world, ctx.run.currentFloor, bannerText, {
      turn: ctx.run.turnIndex + 1,
      playerHealth: ctx.run.playerHealth,
      playerHealthMax: HEALTH.playerHealthMax,
      enemyHealth: ctx.run.enemyHealth,
      enemyHealthMax: HEALTH.enemyHealthMax,
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
  }

  tick(dt: number): void {
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
    this.battleRenderer = null;
    this.hud = null;
    this.objective = null;
    this.world = null;
    this.clock = null;
    this.terrain = null;
    this.playback = null;
  }
}
