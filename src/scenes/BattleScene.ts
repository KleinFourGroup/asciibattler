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
import { spawnTeam } from '../sim/battleSetup';
import { BattleRenderer } from '../render/BattleRenderer';
import { HUD } from '../ui/HUD';
import { GRID_SIZE, TICK_RATE } from '../config';
import type { Scene, SceneContext } from './Scene';

export class BattleScene implements Scene {
  private clock: Clock | null = null;
  private world: World | null = null;
  private battleRenderer: BattleRenderer | null = null;
  private hud: HUD | null = null;

  mount(ctx: SceneContext): void {
    const encounter = ctx.run.currentEncounter;
    if (!encounter) {
      throw new Error('BattleScene.mount: no Run encounter');
    }

    this.world = new World(ctx.bus, new RNG(encounter.worldSeed), GRID_SIZE);
    this.clock = new Clock(TICK_RATE, () => this.world?.tick());
    this.battleRenderer = new BattleRenderer(ctx.sprites, ctx.bars, ctx.bus);
    this.hud = new HUD(ctx.uiMount, ctx.bus);

    // HUD and BattleRenderer must be bound BEFORE spawnTeam so unit:spawned
    // handlers find the world.
    this.hud.show(this.world, ctx.run.currentFloor);
    this.battleRenderer.attach(this.world);
    spawnTeam(this.world, 'player', encounter.playerTeam);
    spawnTeam(this.world, 'enemy', encounter.enemyTeam);
  }

  tick(dt: number): void {
    this.clock?.advance(dt);
    this.battleRenderer?.update(dt);
  }

  dispose(): void {
    this.battleRenderer?.detach();
    this.battleRenderer?.dispose();
    this.hud?.dispose();
    this.battleRenderer = null;
    this.hud = null;
    this.world = null;
    this.clock = null;
  }
}
