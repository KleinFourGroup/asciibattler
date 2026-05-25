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
    );

    // HUD and BattleRenderer must be bound BEFORE any spawn so unit:spawned
    // handlers find the world. Terrain comes before teams so the spawn rows
    // are guaranteed clear (walls + water never land on them per
    // config.spawnRowsClear — see src/config/terrain.ts).
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
    applyTerrain(this.world, encounter);
    // After terrain is in place, the terrain renderer reflects the tile
    // grid. Walls render via SpriteRenderer (they're neutral-team Units),
    // and their per-tile Y is picked up via `terrain.heightAt` inside
    // BattleRenderer.
    ctx.terrain.setTiles(this.world.tileGrid, this.world.gridW, this.world.gridH);
    this.terrain = ctx.terrain;
    // D3 — frame the camera to whatever rectangle this encounter rolled
    // (procedural sizes range up to 20×20; hand-authored up to 32×32).
    ctx.renderer.fitToBoard(this.world.gridW, this.world.gridH);
    // D4 — anchor the scroll-mode camera on the player spawn area so a
    // toggle-to-scroll (or the eventual D5 default flip) shows the
    // player's team first. spawnTeam puts player at grid rows 1 and 2;
    // gridToWorld maps grid row r → world z = gridH/2 - r - 0.5, so the
    // midpoint of player rows is world z = gridH/2 - 2. Renderer clamps
    // for boards too small to actually pan. No-op visually in fit mode,
    // but the target is preserved across toggles.
    ctx.renderer.setCameraTarget(0, this.world.gridH / 2 - 2);
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
