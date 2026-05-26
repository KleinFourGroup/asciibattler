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
import { TICK_RATE } from '../config';
import { getLayout } from '../sim/layouts';
import type { Scene, SceneContext } from './Scene';

export class BattleScene implements Scene {
  private clock: Clock | null = null;
  private world: World | null = null;
  private battleRenderer: BattleRenderer | null = null;
  private hud: HUD | null = null;
  /** Held only so `dispose` can clear the terrain's per-tile state — the
   *  renderer itself is page-lifetime and owned by Game. */
  private terrain: TerrainRenderer | null = null;
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
    this.battleRenderer = new BattleRenderer(ctx.sprites, ctx.bars, ctx.terrain, ctx.bus);
    this.hud = new HUD(ctx.uiMount, ctx.bus);

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
        ctx.audio.play(attacker.stats.attackRange <= 1 ? 'melee' : 'shoot');
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
    const locationName =
      encounter.layoutId === null
        ? 'Nowhere'
        : (getLayout(encounter.layoutId)?.name ?? encounter.layoutId);
    this.hud.show(this.world, ctx.run.currentFloor, locationName);
    this.battleRenderer.attach(this.world);
    const spawnRegions = applyTerrain(this.world, encounter);
    // After terrain is in place, the terrain renderer reflects the tile
    // grid. Walls render via SpriteRenderer (they're neutral-team Units),
    // and their per-tile Y is picked up via `terrain.heightAt` inside
    // BattleRenderer.
    ctx.terrain.setTiles(this.world.tileGrid, this.world.gridW, this.world.gridH);
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
    this.clock?.advance(dt);
    this.battleRenderer?.update(dt);
    // D7.C: drive the terrain shader's `uTime` for per-tile fire flicker
    // and healing pulse. Lives on tick (not the rAF loop) because only
    // BattleScene puts animated tile kinds into the renderer — non-battle
    // scenes call terrain.clear() and don't need the animation to advance.
    this.terrain?.advanceTime(dt);
  }

  dispose(): void {
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
    this.battleRenderer?.detach();
    this.battleRenderer?.dispose();
    this.hud?.dispose();
    // Drop the terrain's per-battle tile visuals so the next non-battle
    // scene (map / recruit / gameover) isn't painting stale terrain under
    // nothing.
    this.terrain?.clear();
    this.battleRenderer = null;
    this.hud = null;
    this.world = null;
    this.clock = null;
    this.terrain = null;
  }
}
