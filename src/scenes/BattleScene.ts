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
import { applyTerrain, spawnTeam } from '../sim/battleSetup';
import { BattleRenderer } from '../render/BattleRenderer';
import type { TerrainRenderer } from '../render/TerrainRenderer';
import { HUD } from '../ui/HUD';
import { GRID_SIZE, TICK_RATE } from '../config';
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

    this.world = new World(ctx.bus, new RNG(encounter.worldSeed), GRID_SIZE);
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
    );

    // HUD and BattleRenderer must be bound BEFORE any spawn so unit:spawned
    // handlers find the world. Terrain comes before teams so the spawn rows
    // are guaranteed clear (walls + water never land on them per
    // config.spawnRowsClear — see src/config/terrain.ts).
    this.hud.show(this.world, ctx.run.currentFloor);
    this.battleRenderer.attach(this.world);
    applyTerrain(this.world, encounter);
    // After terrain is in place, the terrain renderer reflects the tile
    // grid. Walls render via SpriteRenderer (they're neutral-team Units),
    // and their per-tile Y is picked up via `terrain.heightAt` inside
    // BattleRenderer.
    ctx.terrain.setTiles(this.world.tileGrid, this.world.gridSize);
    this.terrain = ctx.terrain;
    spawnTeam(this.world, 'player', encounter.playerTeam);
    spawnTeam(this.world, 'enemy', encounter.enemyTeam);
  }

  tick(dt: number): void {
    this.clock?.advance(dt);
    this.battleRenderer?.update(dt);
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
