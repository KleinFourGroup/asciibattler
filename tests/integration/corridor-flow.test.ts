/**
 * E5 — corridor flow. combat-feedback flagged that on the long-corridor
 * layouts (Endless Corridors, Strafing Funnel) "units backpedal and
 * reroute, seemingly at random." The ROOT cause (theory 2) was target
 * thrash: `findTarget` re-picked the nearest enemy every tick, and in a
 * corridor packed with front-line enemies the "nearest" flipped tick-to-
 * tick, sending each unit's A* path bouncing between targets.
 *
 * E5.A's target stickiness is the fix. This test pins the property at the
 * integration level: across a full headless battle on the corridor
 * layouts, each player unit's committed `targetId` changes only a bounded
 * number of times — it re-targets on death / a much-closer rival / a
 * ranged LOS timeout, NOT every tick. (The layout-deadlock suite already
 * proves these battles resolve; the boids sidestep mechanic is pinned
 * deterministically in MovementBehavior.test.ts. This is specifically the
 * "no thrash" guard.)
 *
 * MAX_TARGET_CHANGES is calibrated to the observed post-E5 worst case (4-6
 * across these seeds: a re-target per enemy death plus a couple of
 * opportunistic switches) with ~2.5x headroom. Pre-E5 the count was
 * effectively unbounded (a fresh nearest-pick every tick over hundreds of
 * ticks); the cap catches a regression back to that.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { World } from '../../src/sim/World';
import { RNG } from '../../src/core/RNG';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import { getLayout } from '../../src/sim/layouts';
import type { GameEvents } from '../../src/core/events';
import type { BattleEncounter } from '../../src/run/Run';

const LAYOUTS = ['endlessCorridors', 'strafingFunnel'] as const;
const SEEDS = [100, 101, 102, 103];
const MAX_TICKS = 2000;
// A player unit may legitimately re-target a handful of times (each enemy
// death, the occasional much-closer rival or ranged LOS timeout). Pre-E5's
// per-tick nearest-pick would blow far past this over a multi-hundred-tick
// battle.
const MAX_TARGET_CHANGES = 15;

describe('E5: corridor flow (target stickiness, no thrash)', () => {
  for (const layoutId of LAYOUTS) {
    for (const seed of SEEDS) {
      it(`${layoutId} seed=${seed}: resolves and no player unit re-targets > ${MAX_TARGET_CHANGES}x`, () => {
        const layout = getLayout(layoutId)!;
        const bus = new EventBus<GameEvents>();
        const world = new World(bus, new RNG(seed), layout.gridW, layout.gridH);

        const teamRng = new RNG(seed * 31 + 7);
        const team = () => [
          rollUnit('mercenary', teamRng),
          rollUnit('mercenary', teamRng),
          rollUnit('mercenary', teamRng),
          rollUnit('ranged', teamRng),
          rollUnit('ranged', teamRng),
        ];
        const encounter: BattleEncounter = {
          worldSeed: seed,
          terrainSeed: seed,
          layoutId,
          gridW: layout.gridW,
          gridH: layout.gridH,
          theme: 'default', // cosmetic only — no sim effect on this flow test
          playerTeam: team(),
          enemyTeam: team(),
        };
        spawnEncounter(world, encounter);

        // Count committed-target changes per player unit across the battle.
        const lastTarget = new Map<number, number | null>();
        const changes = new Map<number, number>();
        let ticks = 0;
        while (!world.ended && ticks < MAX_TICKS) {
          world.tick();
          ticks++;
          for (const u of world.units) {
            if (u.team !== 'player') continue;
            if (lastTarget.has(u.id) && lastTarget.get(u.id) !== u.targetId && u.targetId !== null) {
              changes.set(u.id, (changes.get(u.id) ?? 0) + 1);
            }
            lastTarget.set(u.id, u.targetId);
          }
        }

        expect(
          world.ended,
          `seed=${seed} layout=${layoutId} did not resolve in ${MAX_TICKS} ticks (got ${ticks})`,
        ).toBe(true);

        const worst = Math.max(0, ...changes.values());
        expect(
          worst,
          `seed=${seed} layout=${layoutId} a player unit re-targeted ${worst} times (cap ${MAX_TARGET_CHANGES})`,
        ).toBeLessThanOrEqual(MAX_TARGET_CHANGES);
      });
    }
  }
});
